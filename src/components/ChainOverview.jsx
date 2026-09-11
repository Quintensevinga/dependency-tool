import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlowProvider,
  getSmoothStepPath,
  internalsSymbol,
  useNodesInitialized,
  useReactFlow,
  useStoreApi,
  useUpdateNodeInternals,
} from 'reactflow'
// Volledige ELK-bundel op de hoofdthread: een ketenlay-out van enkele
// tientallen nodes rekent in milliseconden, een web worker is de complexiteit
// (Vite-workerconfiguratie) hier niet waard. Komt alleen in de lazy chunk van
// dit scherm terecht (zie App.jsx).
import ELK from 'elkjs/lib/elk.bundled.js'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { bronTypeColor } from '../lib/workflowStyles'
import { translateRiskLevel, translateBronType } from '../i18n/labels'
import { resolveChainEdges, orderTeamsByChain, traceForwardChain } from '../lib/teamWorkflow'
import { orderChain, roundedOrthPath, polylineMidpoint, buildElkGraph, applyElkLayout, fallbackPositions, fanInOffsets, ELK_LAYOUT_OPTIONS } from '../lib/chainLayout'
import { emptyTeamWorkflow } from '../lib/storage'
import { fitViewAvoidingCorner } from '../lib/flowFit'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useTeamSelection } from '../lib/useTeamSelection'
import TeamFilterPanel from './TeamFilterPanel'

function highestRisk(deps) {
  let best = { level: 'Laag', score: 0 }
  for (const d of deps) {
    const r = calculateRisk(d)
    if (r.score > best.score) best = r
  }
  return best
}

// Externe partijen (systeem, ander bedrijfsonderdeel, leverancier, CAB, …)
// staan standaard als eigen kaartje naast de teams die ze raken — ELK zet ze
// links van de teams die ze voeden, rechts van de teams die aan haar leveren,
// of ertussenin — met een lijn naar elk item (of, zonder getoond item, naar de
// kaart) dat ze noemt. Per groep (partijen van het focusteam / van de andere
// teams) uit te zetten in het filterpaneel; dan zakken ze terug in een
// stapel-tab ónder de kaart (links = bronnen en afhankelijkheden, rechts =
// ontvangers), vanwaar één partij alsnog als kaartje te selecteren is. Bewust
// grijs, buiten de risicokleurenreeks — een partij heeft zelf geen
// risicoscore; de lijnen tonen de relatie (input/output/afhankelijkheid),
// niet een ernst.
const EXT_COLOR = '#5c6b8a'
// Alle lijnen in een eigen laag bóven de kaarten (React Flow tekent lijnen
// standaard onder de nodes). Een item-handle zit ín de kaart, op de rand van
// het itemblokje zelf (kaartrand + padding verder naar binnen): met de lijnen
// eronder stopte elke lijn visueel al bij de kaartrand en 'zweefde' het
// handle-bolletje op het blokje los van zijn lijn. Nu loopt de lijn door tot
// op het blokje. Geen risico op lijnen dwars over kaarten: ELK routeert om
// elke kaart heen (zie chainLayout.js); alleen dit korte stukje ligt bewust
// over de eigen kaartrand.
const EDGE_Z = 1
const OV_EXT_WIDTH = 176
// Koppeling die nog op akkoord van het andere team wacht (zie LINK_STATUS in
// constants.js): gestippeld i.p.v. een eigen kleur, zodat de risicokleur van
// de lijn intact blijft.
const PENDING_EDGE_STYLE = { strokeDasharray: '3 4', opacity: 0.8 }
// Terugkoppeling (koppeling terug naar een team eerder in de keten): eigen,
// langer streepje zodat 'ie naast een wachtend verzoek herkenbaar blijft.
const BACK_EDGE_STYLE = { strokeDasharray: '5 4' }
// Gebundelde lijn tussen twee teams die allebei ingeklapt zijn: één grijze
// lijn met een teller, geen kleur (kleur hoort bij één specifieke koppeling).
const AGG_COLOR = '#64748b'
// Hoeveel ketenstappen vanaf het focusteam maximaal in beeld komen.
const MAX_DEPTH = 3

function ExternalPartyNode({ id, data }) {
  const { t, language } = useLanguage()
  // Handles bij het (opnieuw) verschijnen van de hub expliciet laten
  // registreren — zelfde patroon als de teamkaart, zie FocusChainCardNode.
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, updateNodeInternals])
  const dot = bronTypeColor(data.type) ?? EXT_COLOR
  const teamsLabel = data.teamCount === 1 ? t('chain.externalPartyTeamsOne') : t('chain.externalPartyTeams', { count: data.teamCount })
  return (
    <div
      className={`relative cursor-pointer rounded-xl border-2 bg-slate-50 px-3 py-2 shadow-sm transition-shadow hover:shadow-md ${data.selected ? 'ring-2 ring-[#2a5f8a]' : ''}`}
      style={{ width: OV_EXT_WIDTH, borderColor: `${EXT_COLOR}55` }}
      title={t('chain.clickPartyHint')}
    >
      <Handle type="source" position={Position.Right} id="right-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Right} id="right-target" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ opacity: 0.4 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ opacity: 0.4 }} />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#3f4a63]">{data.naam}</span>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-slate-400">{[translateBronType(data.type, language), teamsLabel].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

// Verzamelt alle externe partijen die aan teams hangen: via input-/output-
// items (externalPartyId, anders de vrije externalTeam-naam) en via
// dependencies (geraaktPartijId, anders de vrije geraakte_team_extern-naam —
// mits dat geen eigen team is, want dan is het een team-op-team-
// afhankelijkheid en geen externe partij). Eén record per partij (op id,
// anders op naam), zodat een generieke afhankelijkheid als "CAB" of
// "IAM-beheer" als één hub verschijnt met lijnen naar álle teams die 'm
// noemen. Zuivere functie; de graafopbouw filtert zelf op de zichtbare teams.
function buildExternalPartyGraph(teamWorkflows, dependencies, externalParties, teams, teamLabels) {
  const byId = new Map(externalParties.map((p) => [p.id, p]))
  const byName = new Map(externalParties.map((p) => [p.naam.trim().toLowerCase(), p]))
  const teamNames = new Set(teams.flatMap((tm) => [tm.naam, teamLabels[tm.id] ?? tm.naam]).map((n) => n.trim().toLowerCase()))
  const parties = new Map()

  function resolve(partyId, naam, fallbackType) {
    const cleanNaam = typeof naam === 'string' ? naam.trim() : ''
    const record = (partyId && byId.get(partyId)) || (cleanNaam && byName.get(cleanNaam.toLowerCase())) || null
    if (!record && !cleanNaam) return null
    const key = record ? `id:${record.id}` : `naam:${cleanNaam.toLowerCase()}`
    if (!parties.has(key)) {
      parties.set(key, { key, naam: record?.naam ?? cleanNaam, type: record?.type ?? fallbackType ?? '', sources: new Map(), sinks: new Map() })
    }
    return parties.get(key)
  }
  function add(map, teamId, ref) {
    if (!map.has(teamId)) map.set(teamId, [])
    map.get(teamId).push(ref)
  }

  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    for (const item of wf.inputs ?? []) {
      const party = resolve(item.externalPartyId, item.externalTeam, item.bron_type)
      if (party) add(party.sources, teamId, { kind: 'input', id: item.id, label: item.label })
    }
    for (const item of wf.outputs ?? []) {
      const party = resolve(item.externalPartyId, item.externalTeam, item.bron_type)
      if (party) add(party.sinks, teamId, { kind: 'output', id: item.id, label: item.label })
    }
  }
  for (const dep of dependencies) {
    if (!dep.teamId) continue
    // Een ander team in deze tool als veroorzaker (op id, of op exact
    // matchende naam) is geen externe partij.
    if (dep.geraaktTeamId) continue
    const naam = typeof dep.geraakte_team_extern === 'string' ? dep.geraakte_team_extern.trim() : ''
    if (!dep.geraaktPartijId && (!naam || teamNames.has(naam.toLowerCase()))) continue
    const party = resolve(dep.geraaktPartijId, naam, '')
    if (party) add(party.sources, dep.teamId, { kind: 'dependency', id: dep.id, label: dep.titel })
  }
  return [...parties.values()]
}

// Partijen per team, gesplitst in bronnen/afhankelijkheden (stapel-tab links)
// en ontvangers (stapel-tab rechts). Zelfde partij kan in beide staan (bv. een
// bankpartner: instructies in, betaalbestand uit).
function partiesByTeam(partyGraph) {
  const result = new Map()
  const bucket = (teamId, side) => {
    if (!result.has(teamId)) result.set(teamId, { left: [], right: [] })
    return result.get(teamId)[side]
  }
  for (const p of partyGraph ?? []) {
    for (const [teamId, refs] of p.sources) bucket(teamId, 'left').push({ party: p, refs })
    for (const [teamId, refs] of p.sinks) bucket(teamId, 'right').push({ party: p, refs })
  }
  return result
}

// Het kaartje van een externe partij; de positie bepaalt ELK. `layer` is
// alleen een hint voor de noodlay-out: vóór het eerste team dat ze voedt, ná
// het laatste team dat aan haar levert, of ertussenin.
function partyNode(p, layer, selected) {
  return {
    id: `party:${p.key}`,
    type: 'externalParty',
    position: { x: 0, y: 0 },
    data: {
      key: p.key,
      naam: p.naam,
      type: p.type,
      teamCount: new Set([...p.sources.keys(), ...p.sinks.keys()]).size,
      selected,
      layer,
    },
  }
}

function externalEdgeData(p, teamNaam, direction, refs) {
  return { external: true, partyKey: p.key, partyNaam: p.naam, teamNaam, direction, refs }
}

// Legenda rechtsboven ín het canvas: een knopje dat een kaartje met de
// lijnsoorten en klikacties open- en dichtklapt. De voorbeeldlijntjes
// gebruiken exact dezelfde kleuren en streepjespatronen als de echte lijnen
// (CONNECTION_COLORS, AGG_COLOR, EXT_COLOR, PENDING_EDGE_STYLE,
// BACK_EDGE_STYLE), zodat de legenda nooit uit de pas loopt met de tekening.
function LegendLine({ color, dash, width = 2, opacity = 1 }) {
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true" className="shrink-0">
      <path d="M1 6H29" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" opacity={opacity} />
      <path d="M27 2.5L32 6L27 9.5" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </svg>
  )
}

function ChainLegend() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const rows = [
    { key: 'legendItemLink', sample: <LegendLine color={CONNECTION_COLORS[0]} /> },
    {
      key: 'legendBundle',
      sample: (
        <span className="relative inline-flex shrink-0 items-center">
          <LegendLine color={AGG_COLOR} />
          <span className="absolute left-[9px] top-[-3px] rounded-full border border-slate-300 bg-white px-1 text-[8px] font-semibold leading-[11px] text-slate-600">3</span>
        </span>
      ),
    },
    { key: 'legendPending', sample: <LegendLine color={CONNECTION_COLORS[0]} dash={PENDING_EDGE_STYLE.strokeDasharray} /> },
    { key: 'legendBackflow', sample: <LegendLine color={CONNECTION_COLORS[1]} dash={BACK_EDGE_STYLE.strokeDasharray} /> },
    { key: 'legendPartyItem', sample: <LegendLine color={EXT_COLOR} width={1.5} /> },
    { key: 'legendPartyDependency', sample: <LegendLine color={EXT_COLOR} width={1.5} dash={BACK_EDGE_STYLE.strokeDasharray} opacity={0.7} /> },
    {
      key: 'legendFocus',
      sample: <span className="inline-block h-3 w-[34px] shrink-0 rounded border-2 border-[#2a5f8a] bg-white" aria-hidden="true" />,
    },
    {
      key: 'legendStack',
      sample: (
        <span className="inline-flex w-[34px] shrink-0 justify-center" aria-hidden="true">
          <span className="inline-flex h-3 items-center gap-0.5 rounded-b border-2 border-t-0 border-[#5c6b8a]/40 bg-slate-50 px-1 text-[8px] font-bold leading-none text-[#3f4a63]">
            {stackGlyph}
          </span>
        </span>
      ),
    },
  ]
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm ${
          open ? 'border-[#2a5f8a] bg-[#2a5f8a] text-white' : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-white'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {t('chain.legendButton')}
      </button>
      {open && (
        <div className="w-[268px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-[11px] text-slate-600 shadow-md backdrop-blur-sm">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('chain.legendTitle')}</div>
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li key={row.key} className="flex items-start gap-2">
                <span className="mt-[2px] inline-flex shrink-0">{row.sample}</span>
                <span>{t(`chain.${row.key}`)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-500">{t('chain.legendClicks')}</div>
        </div>
      )}
    </div>
  )
}

// Zwevende toolbar linksonder ín het canvas (zelfde plek en uiterlijk als op
// de teampagina, zie TeamCanvasToolbar): uitzoomen, inzoomen, passend maken.
// Doet ook de automatische fit zodra er een nieuwe lay-out staat (elke
// selectie/focus/diepte-wijziging levert er een op) of de zijbalk
// *definitief* wisselt (fitKey bevat sidebarMode) — React Flow's eigen
// fitView-prop werkt alleen bij de eerste render. Fit houdt rekening met de
// eigen footprint van deze toolbar als kleine safe area (lib/flowFit.js),
// zodat er nooit een kaart onder de knoppen verdwijnt.
function ChainCanvasToolbar({ fitKey }) {
  const instance = useReactFlow()
  const store = useStoreApi()
  const { t } = useLanguage()
  const toolbarRef = useRef(null)

  const fit = useCallback(() => {
    const el = toolbarRef.current
    // De Panel-wrapper van React Flow legt zelf nog 15px marge om de toolbar.
    const safeAreaWidth = el ? el.getBoundingClientRect().width + 30 : 0
    const safeAreaHeight = el ? el.getBoundingClientRect().height + 30 : 0
    fitViewAvoidingCorner(instance, store.getState().domNode, {
      safeAreaWidth,
      safeAreaHeight,
      padding: 0.12,
      minZoom: 0.2,
      maxZoom: 1.5,
      duration: 200,
    })
  }, [instance, store])

  useEffect(() => {
    // 200ms i.p.v. een enkele rAF: dekt zowel de React Flow-commit-lag van
    // nieuwe nodes als de CSS-transitie van <main>'s padding-left bij een
    // sidebarMode-wissel, zodat er tegen de uiteindelijke bounds gefit wordt.
    const id = window.setTimeout(fit, 200)
    return () => window.clearTimeout(id)
  }, [fitKey, fit])

  // En bij het resizen van het venster zelf (het canvas groeit/krimpt mee
  // met de vensterhoogte) — gedebouncet, 'resize' vuurt tientallen keren per
  // seconde.
  useEffect(() => {
    let id
    const handleResize = () => {
      window.clearTimeout(id)
      id = window.setTimeout(fit, 150)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', handleResize)
    }
  }, [fit])

  const btnClass = 'flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700'
  return (
    <Panel position="bottom-left">
      <div ref={toolbarRef} className="flex flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-sm">
        <button type="button" onClick={() => instance.zoomOut()} title={t('chain.zoomOut')} aria-label={t('chain.zoomOut')} className={btnClass}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 11h6M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={() => instance.zoomIn()} title={t('chain.zoomIn')} aria-label={t('chain.zoomIn')} className={btnClass}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M11 8v6M8 11h6M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="my-0.5 h-px w-4 bg-slate-200" />
        <button type="button" onClick={fit} title={t('chain.fitToScreen')} aria-label={t('chain.fitToScreen')} className={btnClass}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </Panel>
  )
}

const elk = new ELK()

// Leest de door React Flow gemeten afmetingen en handle-posities uit zijn
// interne administratie (nodeInternals). Levert null zolang nog niet elke
// node van de graaf gemeten is — dan wacht ChainCanvas op de volgende ronde
// (useNodesInitialized). Handle-posities zijn t.o.v. de node, ongeschaald.
function measureNodes(nodeInternals, dims, graph) {
  const sizes = new Map()
  for (const node of graph.nodes) {
    const internal = nodeInternals.get(node.id)
    // Maat uit onze eigen `dims` (gevuld uit React Flow's dimensions-changes),
    // NIET uit nodeInternals: React Flow bouwt zijn interne administratie bij
    // elke nieuwe nodes-array opnieuw op uit de node-objecten zelf, waardoor
    // een gemeten breedte/hoogte daar weer verdwijnt zodra wij een nieuwe
    // array doorgeven — precies wat deze effect-ronde zelf veroorzaakt. Alleen
    // handleBounds overleeft die herbouw wél, dus die komt hier nog uit de
    // interne administratie. Zonder handleBounds is de node nog niet écht
    // gemeten; dan liever wachten dan met gegokte handle-posities lay-outen.
    const bounds = internal?.[internalsSymbol]?.handleBounds
    const size = dims.get(node.id)
    if (!size?.width || !size?.height || !bounds) return null
    const handles = new Map()
    for (const handle of [...(bounds?.source ?? []), ...(bounds?.target ?? [])]) {
      if (!handle.id) continue
      handles.set(handle.id, {
        x: handle.x + handle.width / 2,
        y: handle.y + handle.height / 2,
        side: handle.position === Position.Right ? 'EAST' : 'WEST',
      })
    }
    sizes.set(node.id, { width: size.width, height: size.height, handles })
  }
  return sizes
}

// Het canvas zelf, binnen de ReactFlowProvider: laat React Flow de kaarten
// eerst renderen en meten, geeft de gemeten maten en handle-posities aan ELK
// (algoritme 'layered', orthogonale routing) en zet daarna posities en
// lijnpunten op de nodes/edges. Geen schatting van kaarthoogtes uit tekst-
// lengte meer (eerdere versies van dit scherm liepen daar telkens op vast):
// er wordt gemeten wat er echt staat. Geen meet-terugkoppelingslus: posities
// veranderen niets aan de maten, dus na één ELK-ronde per structuurwijziging
// is de tekening stabiel. Nodes die nog geen positie hebben (eerste render,
// of net toegevoegd na een focuswissel) staan onzichtbaar op (0,0) tot de
// eerstvolgende lay-out klaar is — zo is er nooit een frame met kaarten op een
// verkeerde plek; hun lijnen blijven zolang verborgen.
function ChainCanvas({ graph, nodes, edges, fitKey, children, ...handlers }) {
  const store = useStoreApi()
  const nodesInitialized = useNodesInitialized()
  const [layout, setLayout] = useState({ version: 0, graph: null, positions: new Map(), points: new Map() })
  const runRef = useRef(0)

  // Gemeten afmetingen per node, bijgehouden uit React Flow's 'dimensions'-
  // wijzigingen en teruggegeven op de nodes (width/height). Dat is geen
  // sier: React Flow neemt bij elke nieuwe nodes-array de maten over van de
  // node-objecten zélf en gooit zijn eigen meting weg — zonder deze
  // terugkoppeling verloor elke kaart na de eerste lay-out zijn maat en
  // sloeg React Flow alle lijnen stilzwijgend over (getest).
  const [dims, setDims] = useState(() => new Map())
  const onNodesChange = useCallback((changes) => {
    const measured = changes.filter((change) => change.type === 'dimensions' && change.dimensions)
    if (measured.length === 0) return
    setDims((prev) => {
      const next = new Map(prev)
      for (const change of measured) next.set(change.id, change.dimensions)
      return next
    })
  }, [])

  useEffect(() => {
    if (!nodesInitialized || graph.nodes.length === 0) return
    const sizes = measureNodes(store.getState().nodeInternals, dims, graph)
    if (!sizes) return
    // Alleen het laatste verzoek telt: een oudere lay-out die later klaar is
    // (ELK is asynchroon) mag een nieuwere niet overschrijven.
    const run = ++runRef.current
    // Twee rondes: de eerste bepaalt de posities; daaruit volgt per
    // aankomstpunt de volgorde van de lijnen die er samen op landen
    // (fanInOffsets), waarna de tweede ronde ze elk een eigen poortje geeft
    // zodat ze naast elkaar aankomen. Zonder zo'n punt volstaat de eerste
    // ronde. Elke ronde krijgt een verse ELK-invoer: ELK schrijft in het
    // object dat het krijgt.
    elk
      .layout(buildElkGraph(graph, sizes))
      .then((first) => {
        if (run !== runRef.current) return null
        const firstLayout = applyElkLayout(first, graph)
        const fanIn = fanInOffsets(graph, sizes, firstLayout.positions)
        if (fanIn.size === 0) return firstLayout
        return elk.layout(buildElkGraph(graph, sizes, ELK_LAYOUT_OPTIONS, fanIn)).then((second) => (run === runRef.current ? applyElkLayout(second, graph) : null))
      })
      .then((result) => {
        if (!result || run !== runRef.current) return
        setLayout({ version: run, graph, ...result })
      })
      .catch((error) => {
        if (run !== runRef.current) return
        console.error('Ketenoverzicht: ELK-lay-out mislukt, noodlay-out gebruikt', error)
        setLayout({ version: run, graph, positions: fallbackPositions(graph, sizes), points: new Map() })
      })
    // `dims` hoort in de deps: een kaart die van maat verandert zonder dat de
    // structuur wijzigt (bv. een nagemeten handle-set) krijgt zo ook een
    // nieuwe lay-out.
  }, [nodesInitialized, graph, store, dims])

  const positionedNodes = useMemo(
    () =>
      nodes.map((n) => {
        const position = layout.positions.get(n.id)
        // Gemeten maat altijd meegeven zodra we 'm kennen, ook vóór de eerste
        // lay-out: React Flow leest breedte/hoogte bij elke nieuwe nodes-array
        // terug uit de node-objecten, dus zonder dit verliest het zijn eigen
        // meting weer — en dan tekent het (stilzwijgend) geen enkele lijn meer
        // en kwam de lay-out zelf nooit op gang (kaarten bleven op 0,0 staan).
        // Een nog niet gemeten node heeft geen `dims`-entry en krijgt dus ook
        // geen maat: de eerste, échte meting van React Flow blijft zo intact.
        const size = dims.get(n.id)
        const withSize = size ? { ...n, width: size.width, height: size.height } : n
        return position ? { ...withSize, position } : { ...withSize, position: { x: 0, y: 0 }, style: { ...n.style, opacity: 0 } }
      }),
    [nodes, layout, dims],
  )
  // Tussen een structuurwijziging (nieuwe graaf: andere kaartstanden, dus
  // andere kaartmaten) en het ELK-resultaat daarvoor zitten een paar frames
  // waarin de oude routes nog bij de nieuwe kaarten staan — een oude route
  // kan dan dwars door een inmiddels hogere kaart lopen. Zolang de lay-out
  // niet bij déze graaf hoort liggen de lijnen daarom even weer ónder de
  // kaarten (zoals React Flow standaard doet), zodat zo'n stukje achter de
  // kaart schuilgaat; zodra de verse routes er zijn komen ze weer bovenop
  // (EDGE_Z) en lopen ze door tot op de itemblokjes.
  const layoutIsFresh = layout.graph === graph
  const routedEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!layout.positions.has(e.source) || !layout.positions.has(e.target)) return { ...e, hidden: true }
        const points = layout.points.get(e.id)
        const routed = points ? { ...e, data: { ...e.data, points } } : e
        return { ...routed, zIndex: layoutIsFresh ? EDGE_Z : 0 }
      }),
    [edges, layout, layoutIsFresh],
  )

  return (
    <PannableFlowCanvas
      nodes={positionedNodes}
      edges={routedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      elevateEdgesOnSelect
      nodesDraggable={false}
      hideControls
      onNodesChange={onNodesChange}
      {...handlers}
    >
      <ChainCanvasToolbar fitKey={`${layout.version}:${fitKey}`} />
      {children}
    </PannableFlowCanvas>
  )
}

// Vaste, kleine kwalitatieve kleurenreeks: elke getekende output→input-
// koppeling op itemniveau krijgt zijn eigen kleur (cyclisch toegewezen, per
// weergave), zowel op de kaartranden als op de verbindingslijn — zo is in één
// oogopslag te zien welke twee kaartjes bij elkaar horen, ook als er meerdere
// lijnen door elkaar heen lopen. Bewust geen stoplichtkleuren (CLAUDE.md);
// dit is een eigen, herkenbaarheids-kleurenreeks, los van de
// risico-ernstkleuren in riskStyles.js.
const CONNECTION_COLORS = ['#0ea5e9', '#4338ca', '#9333ea', '#0d9488', '#d97706', '#e11d48']

const FC_CARD_WIDTH = 230

function RiskBadge({ level }) {
  const { language } = useLanguage()
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${riskStyle(level).badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${riskStyle(level).dot}`} />
      {translateRiskLevel(level, language)}
    </span>
  )
}

const stackGlyph = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M6 12h12M8 17h8" />
  </svg>
)

// Stapel-tab onder de kaart: het aantal externe partijen aan die kant. Klik
// (afgevangen in onNodeClick via data-stack) opent de lijst in het detailvak;
// vandaar kan een partij als hub geselecteerd worden. Geen partij-kaartjes
// en lange grijze lijnen meer in rust — dat was het drukste deel van het oude
// beeld.
function StackTab({ side, count, active, title }) {
  if (!count) return null
  return (
    <div
      data-stack={side}
      title={title}
      className={`absolute bottom-0 flex h-[26px] cursor-pointer items-center gap-1 rounded-b-lg border-2 border-t-0 px-2 text-[10px] font-bold shadow-sm ${
        side === 'left' ? 'left-3' : 'right-3'
      } ${active ? 'border-[#2a5f8a] bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'border-[#5c6b8a]/40 bg-slate-50 text-[#3f4a63]'}`}
    >
      {side === 'right' && <span>{count}</span>}
      <span className={active ? 'text-[#2a5f8a]' : 'text-[#5c6b8a]'}>{stackGlyph}</span>
      {side === 'left' && <span>{count}</span>}
    </div>
  )
}

// Teamkaart in drie standen (data.mode): 'full' toont alle items (het
// focusteam in rust, of de geselecteerde kaart), 'partial' alleen de items
// die aan de selectie hangen plus "+N andere items" (de buren van een
// selectie), 'collapsed' enkel titel, tellers en hoogste risico (alle
// overige teams). Zo blijft het beeld in rust leesbaar, ook met veel teams.
function FocusChainCardNode({ id, data }) {
  const { t, language } = useLanguage()

  // De handle-set van deze kaart verandert met de stand en de getoonde
  // rijen — reactflow moet expliciet verteld worden dat de handle-set is
  // gewijzigd, anders klopt de aanhechting van edges niet meer.
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [data.rows, data.mode, id, updateNodeInternals])

  const hasStacks = Boolean(data.stacks?.left || data.stacks?.right)
  const ring = data.selected ? 'ring-2 ring-[#2a5f8a] ring-offset-2' : data.highlight ? 'ring-[3px] ring-[#2a5f8a]/25' : ''
  return (
    // Buitenste wrapper reserveert ruimte voor de stapel-tabs, zodat de
    // gemeten node-hoogte (en dus ELK's obstakel) de tabs meeneemt en een
    // lijn er niet net doorheen loopt.
    <div className="relative" style={{ width: FC_CARD_WIDTH, paddingBottom: hasStacks ? 14 : 0 }} title={t('chain.clickToFocusHint')}>
      <div
        className={`relative cursor-pointer rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md hover:shadow-lg ${ring}`}
        style={{ borderColor: data.isFocus || data.selected ? '#2a5f8a' : '#cbd5e1' }}
      >
        {/* Kaart-handles (naast de item-handles hieronder): voor lijnen die aan
            geen getoond item hangen — een gebundelde lijn naar een ingeklapte
            kaart, een afhankelijkheid van een externe partij. */}
        <Handle type="target" position={Position.Left} id="card-in" style={{ top: 18, opacity: 0.4 }} />
        <Handle type="target" position={Position.Right} id="card-in-rev" style={{ top: 18, opacity: 0.4 }} />
        <Handle type="source" position={Position.Right} id="card-out" style={{ top: 30, opacity: 0.4 }} />
        <Handle type="source" position={Position.Left} id="card-out-rev" style={{ top: 30, opacity: 0.4 }} />
        <div className="text-sm font-semibold text-slate-800">{data.label}</div>
        {data.mode === 'collapsed' ? (
          <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-2">
            <span className="whitespace-nowrap text-[11px] text-slate-500">{t('chain.collapsedCounts', { inCount: data.inCount, outCount: data.outCount })}</span>
            {data.depCount > 0 && <RiskBadge level={data.risk.level} />}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2">
            {data.rows.map((item) => {
              const active = data.activeItemIds?.has(item.id) ?? false
              const activeHandleStyle = { opacity: 1, width: 9, height: 9, background: '#d97706' }
              const caption = itemOriginCaption(item, t, language)
              return (
                // Klik op een rij (afgevangen in onNodeClick via data-item)
                // selecteert dít item en toont zijn stroom door de keten; klik
                // op de kaart zelf selecteert het team.
                <div
                  key={item.id}
                  data-item={item.id}
                  data-item-kind={item.kind}
                  title={t('chain.clickItemHint')}
                  className={`relative cursor-pointer rounded border px-2 py-1 text-[11px] text-slate-600 transition-colors hover:border-slate-300 ${
                    active ? 'bg-amber-50 ring-2 ring-amber-400' : item.ghost ? 'border-dashed bg-amber-50/60' : 'bg-slate-50'
                  }`}
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: item.color ?? '#cbd5e1',
                    borderTopColor: active ? '#fbbf24' : item.ghost ? '#fbbf24' : '#e2e8f0',
                    borderRightColor: active ? '#fbbf24' : item.ghost ? '#fbbf24' : '#e2e8f0',
                    borderBottomColor: active ? '#fbbf24' : item.ghost ? '#fbbf24' : '#e2e8f0',
                  }}
                >
                  {item.kind === 'in' && (
                    <>
                      {/* Twee handles op hetzelfde inputitem: links voor een
                          voorwaartse koppeling (bron ligt links, dus komt van
                          links binnen), rechts voor een terugkoppeling (bron ligt
                          rechts van dit kaartje in de keten) — welke van de twee
                          een edge gebruikt bepaalt computeChainGraph op basis
                          van de lijnrichting, niet een vast links/rechts-schema. */}
                      <Handle type="target" position={Position.Left} id={`item-in:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                      <Handle type="target" position={Position.Right} id={`item-in-rev:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                    </>
                  )}
                  <span className="block text-[8px] font-medium uppercase tracking-wide text-slate-400">{item.kind === 'in' ? 'in' : 'out'}</span>
                  {item.label || '—'}
                  {caption && <span className={`block text-[9px] ${item.ghost ? 'text-amber-700' : 'text-slate-400'}`}>{caption}</span>}
                  {item.kind === 'out' && (
                    <>
                      <Handle type="source" position={Position.Right} id={`item-out:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                      <Handle type="source" position={Position.Left} id={`item-out-rev:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                    </>
                  )}
                </div>
              )
            })}
            {data.more > 0 && <div className="text-[10px] font-medium text-[#2a5f8a]">{t('chain.moreItems', { count: data.more })}</div>}
            {data.rows.length === 0 && data.more === 0 && <div className="text-[11px] italic text-slate-300">—</div>}
          </div>
        )}
      </div>
      {hasStacks && (
        <>
          <StackTab side="left" count={data.stacks.left} active={data.stackActive === 'left'} title={t('chain.stackSources', { count: data.stacks.left })} />
          <StackTab side="right" count={data.stacks.right} active={data.stackActive === 'right'} title={t('chain.stackSinks', { count: data.stacks.right })} />
        </>
      )}
    </div>
  )
}

// Elk item toont altijd waar het vandaan komt / naartoe gaat — niet alleen
// bij een team-koppeling, maar ook wanneer het door een eigen applicatie/
// systeem gegenereerd wordt, of van een rol/persoon/stakeholder/omgeving
// komt, of naar een externe partij gaat. Een ghost-rij (verzoek om een nog
// niet bestaand item) zegt wie het voorstelde.
function itemOriginCaption(item, t, language) {
  const origin = item.origin
  if (!origin) return null
  if (origin.kind === 'ghost') return t('chain.ghostCaption', { team: origin.naam })
  if (origin.kind === 'team') return item.kind === 'in' ? t('chain.itemFromTeam', { team: origin.naam }) : t('chain.itemToTeam', { team: origin.naam })
  if (origin.kind === 'systeem') return item.kind === 'in' ? t('chain.itemFromSystem', { naam: origin.naam }) : t('chain.itemViaSystem', { naam: origin.naam })
  if (origin.kind === 'bronType') return t('chain.itemFromBronType', { type: translateBronType(origin.bronType, language) })
  return t('chain.itemExternal', { naam: origin.naam })
}

const nodeTypes = {
  focusCard: FocusChainCardNode,
  externalParty: ExternalPartyNode,
}

// Eén edge-type voor alle lijnen: tekent de orthogonale route die ELK heeft
// berekend (data.points: start → bochten → einde, zie ChainCanvas) met
// afgeronde hoeken. ELK routeert om kaarten heen, dus een lijn loopt nooit
// meer dwars door een tussenliggende kaart. Zolang er nog geen ELK-resultaat
// is (eerste meting), of ELK faalde, valt de lijn terug op React Flow's eigen
// smoothstep-route tussen de handles — nooit "geen lijn". Een gebundelde lijn
// (data.count) draagt halverwege een teller; een amber punt erop = minstens
// één onderliggende koppeling wacht nog op akkoord.
function ElkEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }) {
  const path = data?.points
    ? roundedOrthPath(data.points)
    : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 })[0]
  const showBadge = (data?.count ?? 0) > 1 || (data?.pendingCount ?? 0) > 0
  const mid = showBadge ? (data?.points ? polylineMidpoint(data.points) : [(sourceX + targetX) / 2, (sourceY + targetY) / 2]) : null
  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      {mid && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex items-center gap-1 rounded-full border border-slate-300 bg-white px-1.5 py-[1px] text-[10px] font-semibold text-slate-600 shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${mid[0]}px, ${mid[1]}px)`, opacity: style?.opacity ?? 1 }}
          >
            {data.count}
            {data.pendingCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = { elk: ElkEdge }

// Ketengraaf: voorwaartse BFS vanaf één gekozen team (traceForwardChain,
// lib/teamWorkflow.js), begrensd op `depth` ketenstappen, bepaalt wélke teams
// meedoen — de enige weergave van het ketenoverzicht. De kolommen zelf en de
// lijnroutes komen daarna van ELK (zie ChainCanvas): kolom = laag in de DAG,
// waardoor twee gekoppelde teams nooit meer in dezelfde kolom belanden. Een
// koppeling terug naar een team eerder in de keten (incl. het focusteam zelf
// bij een cyclus) is een terugkoppeling (orderChain, lib/chainLayout.js):
// gestippeld en via de -rev-handles, zodat bron en doel naar elkaar toe
// wijzen; met `showBackflow` uit blijven ze weg.
//
// Wat een kaart toont hangt af van de selectie (zie FocusChainCardNode): in
// rust alleen het focusteam volledig, de rest ingeklapt. Een koppeling wordt
// op itemniveau getekend (eigen kleur, aan het item-handle) zodra minstens
// één van haar twee items zichtbaar is; anders gaat ze op in één gebundelde
// lijn per teampaar met een teller. Een item gekoppeld aan een team buiten
// deze weergave toont enkel een "van/naar {team}"-onderschrift, nooit een
// fantoom-lijn naar een niet-getoonde kaart.
//
// Externe partijen (partyGraph, al gefilterd op het subfilter) staan als
// eigen kaartje zodra minstens één van hun relaties met een zichtbaar team
// 'aan' staat (partyOptions.showFocus voor het focusteam, .showOthers voor de
// rest; een geselecteerde partij altijd volledig). Hun lijnen hangen aan het
// item dat ze noemen zodra dat getoond wordt, anders gebundeld aan de kaart.
// Wat níet getekend wordt telt mee in de stapel-tab van die kaart.
//
// Een geselecteerd item of een geselecteerde partij levert een "stroom": de
// verzameling items, teams, partijen en lijnen die er stroomafwaarts aan
// hangt, tot `depth` teamgrenzen ver (zie computeStream) — de dieptemeter
// begrenst dus zowel de tekening als de stroom. Kaarten met stroom-items
// tonen alleen die items; lijnen krijgen data.inStream, waarop displayEdges
// de rest dimt.
//
// Levert nodes zónder positie en edges zónder lijnpunten: die vult de
// ELK-lay-out in ChainCanvas in. Zuivere functie; selectie/hover-stijl
// (dimmen, amber items) komt er in displayNodes/displayEdges overheen.
function computeChainGraph({ teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, focusTeamId, partyGraph, partyOptions, depth, showBackflow, selection }) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const trace = traceForwardChain(focusTeamId, filteredTeams, chainEdgesAll)
  const columns = trace.columns.slice(0, depth + 1)
  if (columns.length === 0) return { nodes: [], edges: [], stream: null }
  const visibleTeams = columns.flat()
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.id))
  const { layerOf, backEdgeIds } = orderChain(focusTeamId, visibleTeamIds, chainEdgesAll)
  // Namen voor álle teams (teamLabels dekt ook gearchiveerde en uitgevinkte
  // teams): een "van/naar {team}"-onderschrift kan naar een team buiten de
  // huidige selectie wijzen, en toonde dan het kale team-id.
  const teamNaamById = { ...teamLabels }
  for (const team of filteredTeams) teamNaamById[team.id] = naamVan(team)
  const layerOfTeam = (teamId) => layerOf.get(teamId) ?? 0

  // Koppelingen tussen twee zichtbare teams. Een koppeling van een team naar
  // zichzelf is geen ketenstap en heeft in een gelaagde tekening geen plek;
  // de items tonen wel hun onderschrift.
  // Per item álle gekoppelde teams: een output kan naar meerdere teams gaan,
  // en het onderschrift somt ze dan op i.p.v. alleen het laatst verwerkte
  // team te tonen.
  const itemLinkedTeams = new Map()
  const addLinkedTeam = (itemId, teamId) => {
    const list = itemLinkedTeams.get(itemId) ?? []
    if (!list.includes(teamId)) itemLinkedTeams.set(itemId, [...list, teamId])
  }
  const links = []
  for (const edge of chainEdgesAll) {
    const sourceShown = visibleTeamIds.has(edge.sourceTeam)
    const targetShown = visibleTeamIds.has(edge.targetTeam)
    if (!sourceShown && !targetShown) continue
    if (sourceShown && edge.sourceOutputId) addLinkedTeam(edge.sourceOutputId, edge.targetTeam)
    if (targetShown && edge.targetInputId) addLinkedTeam(edge.targetInputId, edge.sourceTeam)
    if (!sourceShown || !targetShown || edge.sourceTeam === edge.targetTeam) continue
    const back = backEdgeIds.has(edge.id)
    if (back && !showBackflow) continue
    links.push({ edge, back, pairId: `agg:${edge.sourceTeam}->${edge.targetTeam}` })
  }

  // Een verzoek om een nog niet bestaand tegenhanger-item (linkNieuw) heeft
  // aan één kant geen item-id; die kant krijgt een ghost-rij, zodat de lijn
  // toch aan een item hangt (id 'ghost:<koppeling>').
  const sourceItemId = (edge) => edge.sourceOutputId || `ghost:${edge.id}`
  const targetItemId = (edge) => edge.targetInputId || `ghost:${edge.id}`

  const sel = selection ?? { type: 'none' }
  const selectedTeamId = sel.type === 'card' ? sel.teamId : null
  const selectedEdgeId = sel.type === 'edge' ? sel.id : null
  const selectedItem = sel.type === 'item' ? sel : null
  const selectedPartyKey = sel.type === 'party' ? sel.key : null
  const touches = (link, teamId) => link.edge.sourceTeam === teamId || link.edge.targetTeam === teamId
  // Welke koppelingen "horen bij" een kaart- of lijnselectie: alles aan de
  // geselecteerde kaart, of de (gebundelde) lijn zelf.
  const selectedLinks = selectedTeamId
    ? links.filter((link) => touches(link, selectedTeamId))
    : selectedEdgeId
      ? links.filter((link) => link.edge.id === selectedEdgeId || link.pairId === selectedEdgeId)
      : []

  // --- Externe partijen: elke relatie partij ↔ zichtbaar team, met de
  // items/afhankelijkheden (refs) die die relatie dragen. 'in' = de partij
  // voedt het team (input-items en afhankelijkheden), 'out' = het team levert
  // aan de partij (output-items). Aan of uit per groep; een geselecteerde
  // partij toont altijd al haar relaties, ook uit een uitgezette groep.
  const showFocusParties = partyOptions?.showFocus ?? true
  const showOtherParties = partyOptions?.showOthers ?? true
  const relationEnabled = (party, teamId) => party.key === selectedPartyKey || (teamId === focusTeamId ? showFocusParties : showOtherParties)
  const partyRelations = []
  for (const party of partyGraph ?? []) {
    for (const [teamId, refs] of party.sources) {
      if (visibleTeamIds.has(teamId)) partyRelations.push({ party, teamId, direction: 'in', refs, enabled: relationEnabled(party, teamId) })
    }
    for (const [teamId, refs] of party.sinks) {
      if (visibleTeamIds.has(teamId)) partyRelations.push({ party, teamId, direction: 'out', refs, enabled: relationEnabled(party, teamId) })
    }
  }
  const drawnRelations = partyRelations.filter((r) => r.enabled)
  const relationRefKey = (r, ref) => `${r.party.key}|${r.teamId}|${r.direction}|${ref.kind}:${ref.id}`
  // Stapel-tabs: per kaart de partijen waarvan de relatie met díe kaart niet
  // getekend staat (groep uit), per kant.
  const stackCounts = new Map()
  for (const r of partyRelations) {
    if (r.enabled) continue
    if (!stackCounts.has(r.teamId)) stackCounts.set(r.teamId, { left: new Set(), right: new Set() })
    stackCounts.get(r.teamId)[r.direction === 'in' ? 'left' : 'right'].add(r.party.key)
  }

  // Herkomst/bestemming van een item: eerst een daadwerkelijke team-koppeling
  // (itemLinkedTeams hierboven, de meest concrete info), dan een externe partij
  // (voor een ketenoverzicht het belangrijkste om te tonen — een item kan
  // zowel via een eigen applicatie lopen als uiteindelijk van een externe
  // partij komen, bv. klantgegevens via het eigen klantportaal maar
  // oorspronkelijk uit de BRP; de externe herkomst weegt dan zwaarder dan
  // welke eigen app het ophaalt), dan de eigen applicatie, dan het generieke
  // bron_type (rol, persoon, stakeholder, omgeving).
  function resolveOrigin(rawItem, appsById) {
    const linkedTeamIds = itemLinkedTeams.get(rawItem.id)
    if (linkedTeamIds?.length) return { kind: 'team', naam: linkedTeamIds.map((id) => teamNaamById[id] ?? id).join(', ') }
    if (rawItem.externalTeam) return { kind: 'extern', naam: rawItem.externalTeam }
    if (rawItem.applicatieId && appsById.has(rawItem.applicatieId)) {
      return { kind: 'systeem', naam: appsById.get(rawItem.applicatieId).naam || '—' }
    }
    if (rawItem.kind === 'in' && rawItem.bronType && rawItem.bronType !== 'team' && rawItem.bronType !== 'systeem') {
      return { kind: 'bronType', bronType: rawItem.bronType }
    }
    return null
  }
  // Alle rijen van een kaart in vaste volgorde: inputs, ghost-inputs,
  // outputs, ghost-outputs.
  function allRows(teamId) {
    const wf = teamWorkflows[teamId] ?? emptyTeamWorkflow()
    const appsById = new Map((wf.applications ?? []).map((a) => [a.id, a]))
    const real = (list, kind) =>
      list.map((item) => ({
        id: item.id,
        label: item.label,
        kind,
        origin: resolveOrigin({ id: item.id, kind, bronType: item.bron_type, applicatieId: item.applicatieId, externalTeam: item.externalTeam }, appsById),
      }))
    const ghosts = (kind) =>
      links
        .filter((link) => (kind === 'in' ? link.edge.targetTeam === teamId && !link.edge.targetInputId : link.edge.sourceTeam === teamId && !link.edge.sourceOutputId))
        .map((link) => ({
          id: `ghost:${link.edge.id}`,
          label: kind === 'in' ? link.edge.targetLabel : link.edge.sourceLabel,
          kind,
          ghost: true,
          origin: { kind: 'ghost', naam: teamNaamById[kind === 'in' ? link.edge.sourceTeam : link.edge.targetTeam] ?? '' },
        }))
    return {
      rows: [...real(wf.inputs ?? [], 'in'), ...ghosts('in'), ...real(wf.outputs ?? [], 'out'), ...ghosts('out')],
      inCount: (wf.inputs ?? []).length,
      outCount: (wf.outputs ?? []).length,
    }
  }
  const rowsByTeam = new Map(visibleTeams.map((team) => [team.id, allRows(team.id)]))

  // --- Stroom vanaf een geselecteerd item of een geselecteerde partij.
  // Stroomafwaarts, over een graaf van items, partijen en teams: een output
  // gaat via zijn ketenkoppeling(en) naar een input elders (één teamgrens,
  // telt als één stap), een input gaat binnen het eigen team door naar álle
  // outputs (het team is een black box: alles wat erin komt kan alles wat
  // eruit gaat beïnvloeden — dezelfde aanname als de ketenvolgorde zelf; kost
  // geen stap), een partij voedt de inputs die haar noemen, een output levert
  // aan de partij die 'm noemt, en een afhankelijkheid van een partij raakt
  // het hele team (dus al zijn outputs). Begrensd op `depth` stappen — de
  // dieptemeter. Daarnaast precies één stap terug: waar het startpunt zelf
  // rechtstreeks vandaan komt (de output/partij die deze input voedt, de
  // outputs die aan deze partij leveren) — niet verder terug, want "wat komt
  // er allemaal vóór dit item" zou via de black-box-aanname meteen de hele
  // keten zijn.
  function computeStream() {
    const forward = new Map()
    const backward = new Map()
    const add = (from, to, cost, tag) => {
      if (!forward.has(from)) forward.set(from, [])
      forward.get(from).push({ to, cost, tag })
      if (cost === 1) {
        if (!backward.has(to)) backward.set(to, [])
        backward.get(to).push({ from, tag })
      }
    }
    for (const [teamId, { rows }] of rowsByTeam) {
      const ins = rows.filter((row) => row.kind === 'in').map((row) => `in:${teamId}:${row.id}`)
      const outs = rows.filter((row) => row.kind === 'out').map((row) => `out:${teamId}:${row.id}`)
      for (const i of ins) for (const o of outs) add(i, o, 0, null)
      for (const o of outs) add(`team:${teamId}`, o, 0, null)
    }
    for (const { edge } of links) add(`out:${edge.sourceTeam}:${sourceItemId(edge)}`, `in:${edge.targetTeam}:${targetItemId(edge)}`, 1, { link: edge.id })
    for (const r of drawnRelations) {
      for (const ref of r.refs) {
        const tag = { relation: relationRefKey(r, ref) }
        if (r.direction === 'in' && ref.kind === 'input') add(`party:${r.party.key}`, `in:${r.teamId}:${ref.id}`, 1, tag)
        else if (r.direction === 'in' && ref.kind === 'dependency') add(`party:${r.party.key}`, `team:${r.teamId}`, 1, tag)
        else if (r.direction === 'out' && ref.kind === 'output') add(`out:${r.teamId}:${ref.id}`, `party:${r.party.key}`, 1, tag)
      }
    }
    const start = selectedItem ? `${selectedItem.kind}:${selectedItem.teamId}:${selectedItem.itemId}` : `party:${selectedPartyKey}`
    const linkIds = new Set()
    const relationKeys = new Set()
    const mark = (tag) => {
      if (!tag) return
      if (tag.link) linkIds.add(tag.link)
      if (tag.relation) relationKeys.add(tag.relation)
    }
    // 0-1-BFS: een stap zonder kosten gaat vóóraan in de rij, zodat elke node
    // met zijn kleinste afstand verwerkt wordt. Elke lijn die binnen de diepte
    // valt hoort bij de stroom, ook als het doel al eerder bereikt was.
    const dist = new Map([[start, 0]])
    const queue = [start]
    while (queue.length > 0) {
      const node = queue.shift()
      const d = dist.get(node)
      for (const { to, cost, tag } of forward.get(node) ?? []) {
        const next = d + cost
        if (next > depth) continue
        mark(tag)
        if (dist.has(to) && dist.get(to) <= next) continue
        dist.set(to, next)
        if (cost === 0) queue.unshift(to)
        else queue.push(to)
      }
    }
    for (const { from, tag } of backward.get(start) ?? []) {
      mark(tag)
      if (!dist.has(from)) dist.set(from, 1)
    }
    const items = new Map()
    const teams = new Set()
    const partyKeys = new Set()
    for (const node of dist.keys()) {
      if (node.startsWith('party:')) {
        partyKeys.add(node.slice('party:'.length))
      } else if (node.startsWith('team:')) {
        teams.add(node.slice('team:'.length))
      } else {
        // 'in:<team>:<item>' — een team-id bevat geen dubbele punt, een
        // item-id (ghost:…) wel.
        const teamStart = node.indexOf(':') + 1
        const itemStart = node.indexOf(':', teamStart) + 1
        const teamId = node.slice(teamStart, itemStart - 1)
        teams.add(teamId)
        if (!items.has(teamId)) items.set(teamId, new Set())
        items.get(teamId).add(node.slice(itemStart))
      }
    }
    return { items, teams, partyKeys, linkIds, relationKeys }
  }
  const stream = selectedItem || selectedPartyKey ? computeStream() : null

  const modeOf = (teamId) => {
    if (selectedTeamId) {
      if (teamId === selectedTeamId) return 'full'
      return selectedLinks.some((link) => touches(link, teamId)) ? 'partial' : 'collapsed'
    }
    if (selectedEdgeId) {
      if (selectedLinks.some((link) => touches(link, teamId))) return 'partial'
      return teamId === focusTeamId ? 'full' : 'collapsed'
    }
    if (stream) {
      // De kaart van het geselecteerde item blijft volledig, zodat een ander
      // item op dezelfde kaart direct aan te klikken is.
      if (selectedItem && teamId === selectedItem.teamId) return 'full'
      if (stream.items.get(teamId)?.size) return 'partial'
      return teamId === focusTeamId ? 'full' : 'collapsed'
    }
    return teamId === focusTeamId ? 'full' : 'collapsed'
  }

  // Per kaart: welke rijen staan er (stand + selectie), en hoeveel echte
  // items blijven verborgen achter "+N andere items".
  const cards = new Map()
  for (const team of visibleTeams) {
    const mode = modeOf(team.id)
    const { rows, inCount, outCount } = rowsByTeam.get(team.id)
    let shown = []
    if (mode === 'full') shown = rows
    else if (mode === 'partial') {
      const wanted = new Set(stream ? stream.items.get(team.id) ?? [] : [])
      if (!stream) {
        for (const link of selectedLinks) {
          if (link.edge.sourceTeam === team.id) wanted.add(sourceItemId(link.edge))
          if (link.edge.targetTeam === team.id) wanted.add(targetItemId(link.edge))
        }
      }
      shown = rows.filter((row) => wanted.has(row.id))
    }
    const realTotal = inCount + outCount
    const realShown = shown.filter((row) => !row.ghost).length
    cards.set(team.id, { mode, rows: shown, more: mode === 'collapsed' ? 0 : realTotal - realShown, inCount, outCount, shownIds: new Set(shown.map((row) => row.id)) })
  }

  // --- Lijnen tussen teams: op itemniveau (eigen kleur) zodra een van beide
  // items zichtbaar is, anders gebundeld per teampaar.
  const linkData = (edge) => ({
    sourceTeamNaam: teamNaamById[edge.sourceTeam] ?? edge.sourceTeam,
    targetTeamNaam: teamNaamById[edge.targetTeam] ?? edge.targetTeam,
    sourceLabel: edge.sourceLabel,
    targetLabel: edge.targetLabel,
    status: edge.status,
    punten: edge.punten ?? [],
  })
  const arrow = (color, size = 14) => ({ type: MarkerType.ArrowClosed, color, width: size, height: size })
  const pendingStyle = (edge) => (edge.status === 'voorgesteld' ? PENDING_EDGE_STYLE : {})
  const inStreamLink = (edge) => (stream ? stream.linkIds.has(edge.id) : undefined)
  const edges = []
  const itemColor = new Map()
  const bundles = new Map()
  let colorIndex = 0
  for (const link of links) {
    const { edge, back, pairId } = link
    const srcId = sourceItemId(edge)
    const tgtId = targetItemId(edge)
    const srcShown = cards.get(edge.sourceTeam).shownIds.has(srcId)
    const tgtShown = cards.get(edge.targetTeam).shownIds.has(tgtId)
    if (!srcShown && !tgtShown) {
      if (!bundles.has(pairId)) bundles.set(pairId, { id: pairId, sourceTeam: edge.sourceTeam, targetTeam: edge.targetTeam, back, links: [] })
      bundles.get(pairId).links.push(edge)
      continue
    }
    // Kleur per output-item i.p.v. per lijn: alle lijnen die uit hetzelfde
    // outputblokje vertrekken (fan-out naar meerdere teams) delen zo één kleur
    // met dat blokje — voorheen hield het blokje alleen de kleur van de laatst
    // getekende lijn over.
    let color = srcId ? itemColor.get(srcId) : undefined
    if (!color) {
      color = CONNECTION_COLORS[colorIndex % CONNECTION_COLORS.length]
      colorIndex += 1
      if (srcShown && srcId) itemColor.set(srcId, color)
    }
    if (tgtShown && tgtId) itemColor.set(tgtId, color)
    // Welke kant van het kaartje een koppeling gebruikt volgt de richting van
    // de lijn: voorwaarts verlaat de lijn de bronkaart rechts en komt links
    // binnen; een terugkoppeling gebruikt de linker-uitgang en rechter-ingang,
    // zodat beide kanten naar elkaar toe wijzen i.p.v. om de eigen kaart heen
    // te lussen. Elk item heeft daarom altijd beide handles.
    const rev = back ? '-rev' : ''
    edges.push({
      id: edge.id,
      source: `focus-card:${edge.sourceTeam}`,
      target: `focus-card:${edge.targetTeam}`,
      sourceHandle: srcShown ? `item-out${rev}:${srcId}` : `card-out${rev}`,
      targetHandle: tgtShown ? `item-in${rev}:${tgtId}` : `card-in${rev}`,
      type: 'elk',
      data: { back, pairId, inStream: inStreamLink(edge), link: linkData(edge) },
      style: { stroke: color, strokeWidth: 2, ...(back ? BACK_EDGE_STYLE : {}), ...pendingStyle(edge) },
      markerEnd: arrow(color),
    })
  }
  for (const bundle of bundles.values()) {
    const pendingCount = bundle.links.filter((edge) => edge.status === 'voorgesteld').length
    const rev = bundle.back ? '-rev' : ''
    edges.push({
      id: bundle.id,
      source: `focus-card:${bundle.sourceTeam}`,
      target: `focus-card:${bundle.targetTeam}`,
      sourceHandle: `card-out${rev}`,
      targetHandle: `card-in${rev}`,
      type: 'elk',
      data: {
        back: bundle.back,
        aggregated: true,
        count: bundle.links.length,
        pendingCount,
        inStream: stream ? bundle.links.some((edge) => stream.linkIds.has(edge.id)) : undefined,
        sourceTeamNaam: teamNaamById[bundle.sourceTeam] ?? bundle.sourceTeam,
        targetTeamNaam: teamNaamById[bundle.targetTeam] ?? bundle.targetTeam,
        links: bundle.links.map(linkData),
      },
      // Een bundel die alléén uit wachtende verzoeken bestaat oogt als zo'n
      // verzoek; gemengd blijft de lijn doorgetrokken en zegt de amber punt
      // op de teller het.
      style: { stroke: AGG_COLOR, strokeWidth: 2, ...(bundle.back ? BACK_EDGE_STYLE : {}), ...(pendingCount === bundle.links.length ? PENDING_EDGE_STYLE : {}) },
      markerEnd: arrow(AGG_COLOR),
    })
  }

  // --- Externe partijen als kaartje, met per relatie een lijn per getoond
  // item (aan het item-handle) en één gebundelde lijn (met teller) aan de
  // kaart voor de rest: afhankelijkheden, en items die op een ingeklapte of
  // gedeeltelijke kaart niet getoond worden.
  // Een gestippelde lijn is een afhankelijkheid van een partij (geen
  // item-koppeling); met alle partijen in beeld zijn dat er veel — daarom
  // lichter dan de doorgetrokken itemlijnen, zodat die de structuur blijven
  // dragen.
  const extStyle = (dashed) => ({ stroke: EXT_COLOR, strokeWidth: 1.5, ...(dashed ? BACK_EDGE_STYLE : {}), opacity: dashed ? 0.55 : 0.85 })
  const partyNodes = []
  const drawnParties = [...new Map(drawnRelations.map((r) => [r.party.key, r.party])).values()]
  for (const party of drawnParties) {
    const rels = drawnRelations.filter((r) => r.party.key === party.key)
    const sourceLayers = rels.filter((r) => r.direction === 'in').map((r) => layerOfTeam(r.teamId))
    const sinkLayers = rels.filter((r) => r.direction === 'out').map((r) => layerOfTeam(r.teamId))
    // Plaatsing: tussen de teams in als alles wat aan haar levert vóór alles
    // ligt wat ze voedt (A → partij → C, geen cyclus); anders links van de
    // keten, waarbij wat aan haar levert als terugkoppeling (gestippeld, via
    // de -rev-handles) naar links terugloopt; alleen ontvangen = rechts.
    const minSource = sourceLayers.length > 0 ? Math.min(...sourceLayers) : null
    const maxSink = sinkLayers.length > 0 ? Math.max(...sinkLayers) : null
    const between = minSource !== null && maxSink !== null && maxSink < minSource
    const leftOfChain = minSource !== null && !between
    const layer = leftOfChain ? minSource - 1 : (maxSink ?? -1) + 1
    partyNodes.push(partyNode(party, layer, party.key === selectedPartyKey))
    for (const r of rels) {
      const card = cards.get(r.teamId)
      const teamNaam = teamNaamById[r.teamId] ?? r.teamId
      const rowRefs = r.refs.filter((ref) => (ref.kind === 'input' || ref.kind === 'output') && card.shownIds.has(ref.id))
      const restRefs = r.refs.filter((ref) => !rowRefs.includes(ref))
      const inStreamRef = (ref) => stream.relationKeys.has(relationRefKey(r, ref))
      const inStream = (refs) => (stream ? refs.some(inStreamRef) : undefined)
      if (r.direction === 'in') {
        for (const ref of rowRefs) {
          edges.push({
            id: `hub:${party.key}->${r.teamId}:${ref.id}`,
            source: `party:${party.key}`,
            target: `focus-card:${r.teamId}`,
            sourceHandle: 'right-source',
            targetHandle: `item-in:${ref.id}`,
            type: 'elk',
            data: { count: 1, inStream: inStream([ref]), ...externalEdgeData(party, teamNaam, 'in', [ref]) },
            style: extStyle(false),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
        if (restRefs.length > 0) {
          edges.push({
            id: `hub:${party.key}->${r.teamId}`,
            source: `party:${party.key}`,
            target: `focus-card:${r.teamId}`,
            sourceHandle: 'right-source',
            targetHandle: 'card-in',
            type: 'elk',
            data: { count: restRefs.length, inStream: inStream(restRefs), ...externalEdgeData(party, teamNaam, 'in', restRefs) },
            style: extStyle(restRefs.some((ref) => ref.kind === 'dependency')),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
      } else {
        const rev = leftOfChain ? '-rev' : ''
        const targetHandle = leftOfChain ? 'right-target' : 'left-target'
        for (const ref of rowRefs) {
          edges.push({
            id: `hub:${r.teamId}:${ref.id}->${party.key}`,
            source: `focus-card:${r.teamId}`,
            target: `party:${party.key}`,
            sourceHandle: `item-out${rev}:${ref.id}`,
            targetHandle,
            type: 'elk',
            data: { back: leftOfChain, count: 1, inStream: inStream([ref]), ...externalEdgeData(party, teamNaam, 'out', [ref]) },
            style: extStyle(false),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
        if (restRefs.length > 0) {
          edges.push({
            id: `hub:${r.teamId}->${party.key}`,
            source: `focus-card:${r.teamId}`,
            target: `party:${party.key}`,
            sourceHandle: `card-out${rev}`,
            targetHandle,
            type: 'elk',
            data: { back: leftOfChain, count: restRefs.length, inStream: inStream(restRefs), ...externalEdgeData(party, teamNaam, 'out', restRefs) },
            style: extStyle(false),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
      }
    }
  }

  // Kaarten die in de stroom van een geselecteerd item/partij liggen krijgen
  // een lichte ring (het startpunt zelf niet: dat is al amber/geselecteerd).
  const highlightTeams = new Set(stream ? [...stream.teams].filter((teamId) => teamId !== selectedItem?.teamId) : [])

  // Kaarten in ketenvolgorde (focusteam eerst): ELK gebruikt die invoer-
  // volgorde als tie-breaker (considerModelOrder), zodat dezelfde data ook
  // telkens dezelfde tekening oplevert. Geen positie: die komt van ELK.
  const nodes = visibleTeams.map((team, index) => {
    const card = cards.get(team.id)
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    const counts = stackCounts.get(team.id)
    const stacks = partyGraph ? { left: counts?.left.size ?? 0, right: counts?.right.size ?? 0 } : null
    return {
      id: `focus-card:${team.id}`,
      type: 'focusCard',
      position: { x: 0, y: 0 },
      data: {
        teamId: team.id,
        label: naamVan(team),
        risk,
        depCount: risk.count ?? 0,
        inCount: card.inCount,
        outCount: card.outCount,
        mode: card.mode,
        rows: card.rows.map((row) => ({ ...row, color: itemColor.get(row.id) ?? null })),
        more: card.more,
        isFocus: index === 0,
        selected: team.id === selectedTeamId,
        highlight: highlightTeams.has(team.id),
        stacks,
        stackActive: sel.type === 'stack' && sel.teamId === team.id ? sel.side : null,
        layer: layerOfTeam(team.id),
      },
    }
  })

  // Samenvatting van de stroom voor het detailvak.
  const streamSummary = stream
    ? {
        teamIds: [...stream.teams].filter((teamId) => teamId !== selectedItem?.teamId),
        linkCount: stream.linkIds.size,
        partyKeys: [...stream.partyKeys].filter((key) => key !== selectedPartyKey),
        item: selectedItem ? (rowsByTeam.get(selectedItem.teamId)?.rows.find((row) => row.id === selectedItem.itemId) ?? null) : null,
      }
    : null

  return { nodes: [...nodes, ...partyNodes], edges, stream: streamSummary }
}

// Zuivere graafopbouw ook los van de component bruikbaar (bv. een ad-hoc
// controle op de mockdata in node, zonder browser).
export { computeChainGraph }

export default function ChainOverview({ adminSections, sidebarMode }) {
  const { teams, dependencies, teamWorkflows, teamLabels, externalParties } = useAppContext()
  const { t } = useLanguage()
  // Gearchiveerde teams staan standaard uit, zelfde gedrag als de
  // heatmap — blijven wel aan te vinken voor historische data.
  const { selectedTeamIds, toggleTeam, selectAll: selectAllTeams, selectNone: selectNoTeams } = useTeamSelection(teams)
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)

  const filteredTeams = useMemo(() => teams.filter((tm) => selectedTeamIds.includes(tm.id)), [teams, selectedTeamIds])

  // Het ketenoverzicht kent één weergave: focus op één team, waarna de keten
  // voorwaarts uitrolt (kolom per ketenstap, begrensd door `depth`). Leeg =
  // nog geen eigen keuze en dan valt de weergave terug op defaultFocusTeamId.
  const [focusTeamId, setFocusTeamId] = useState('')
  const [depth, setDepth] = useState(MAX_DEPTH)
  const [showBackflow, setShowBackflow] = useState(true)
  // Externe partijen (systemen, leveranciers, CAB, …): standaard als eigen
  // kaartjes in beeld, per groep uit te zetten in het filterpaneel (dan
  // zakken ze in de stapel-tabs onder de kaarten), plus een subfilter om
  // algemeen bekende partijen (CAB, IAM-beheer, …) helemaal weg te laten.
  const [showFocusParties, setShowFocusParties] = useState(true)
  const [showOtherParties, setShowOtherParties] = useState(true)
  const [hiddenPartyKeys, setHiddenPartyKeys] = useState(() => new Set())
  // Eén selectie tegelijk: een kaart ({type:'card'}), een lijn ({type:'edge',
  // id = koppeling of bundel}), een stapel-tab ({type:'stack'}), een externe
  // partij ({type:'party'}) of één input-/outputitem ({type:'item'}). De
  // selectie bepaalt mede wat er getekend wordt (zie computeChainGraph);
  // hover niet.
  const [selection, setSelection] = useState(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null)
  // Vanuit welke stapel-tab een partij gekozen is, voor de terugweg in het
  // detailvak.
  const [stackReturn, setStackReturn] = useState(null)

  // Eén keer berekend, hergebruikt door defaultFocusTeamId/focusChainTrace
  // hieronder en door computeChainGraph.
  const chainEdgesAll = useMemo(() => resolveChainEdges(teamWorkflows), [teamWorkflows])

  // Zonder eigen keuze focust de weergave op het team dat de langste keten
  // laat zien: de voorwaartse BFS vanaf dat team raakt de meeste andere teams.
  // Zo staat er bij het openen meteen zoveel mogelijk keten in beeld, i.p.v.
  // een leeg canvas met "kies een team". Kandidaten in ketenvolgorde
  // (orderTeamsByChain), zodat bij een gelijke reikwijdte het team wint dat het
  // dichtst bij het begin van de keten staat.
  const defaultFocusTeamId = useMemo(() => {
    let best = ''
    let bestReach = -1
    for (const team of orderTeamsByChain(filteredTeams, chainEdgesAll)) {
      const reach = traceForwardChain(team.id, filteredTeams, chainEdgesAll).columns.flat().length
      if (reach > bestReach) {
        best = team.id
        bestReach = reach
      }
    }
    return best
  }, [filteredTeams, chainEdgesAll])

  // Het team dat daadwerkelijk in beeld is: de eigen keuze zolang die bestaat
  // en niet is weggefilterd, anders het standaardteam hierboven.
  const activeFocusTeamId = useMemo(
    () => (focusTeamId && filteredTeams.some((tm) => tm.id === focusTeamId) ? focusTeamId : defaultFocusTeamId),
    [focusTeamId, filteredTeams, defaultFocusTeamId],
  )

  const focusActive = Boolean(activeFocusTeamId)

  function changeFocus(teamId) {
    setFocusTeamId(teamId)
    setSelection(null)
    setStackReturn(null)
  }

  // Voorwaartse BFS vanaf het focusteam (traceForwardChain, lib/teamWorkflow.js),
  // begrensd op `depth` stappen: kolom = ketenstap.
  const focusChainTrace = useMemo(() => {
    if (!focusActive) return null
    return traceForwardChain(activeFocusTeamId, filteredTeams, chainEdgesAll)
  }, [focusActive, activeFocusTeamId, filteredTeams, chainEdgesAll])

  const visibleTeams = useMemo(() => focusChainTrace?.columns.slice(0, depth + 1).flat() ?? [], [focusChainTrace, depth])

  const teamRisk = useMemo(() => {
    // Alleen dimmen als het filter daadwerkelijk versmald is; met alle niveaus
    // aangevinkt zou anders elk team zonder dependencies gedimd raken.
    const riskFilterActive = selectedRiskLevels.length < RISK_LEVELS.length
    const result = {}
    // Team- én ketenniveau samen: dit is het ketenoverzicht, een scope-
    // schakelaar voegde hier niets toe.
    for (const team of visibleTeams) {
      const all = dependencies.filter((d) => d.teamId === team.id)
      const deps = all.filter((d) => selectedRiskLevels.includes(calculateRisk(d).level))
      result[team.id] = {
        ...highestRisk(deps),
        count: deps.length,
        dimmed: riskFilterActive && deps.length === 0 && all.length > 0,
      }
    }
    return result
  }, [visibleTeams, dependencies, selectedRiskLevels])

  // Externe partijen: één keer verzameld uit alle teams/dependencies; de
  // graafopbouw filtert zelf op de zichtbare teams.
  const partyGraph = useMemo(
    () => buildExternalPartyGraph(teamWorkflows, dependencies, externalParties, teams, teamLabels),
    [teamWorkflows, dependencies, externalParties, teams, teamLabels],
  )
  // Subfilter: welke partijen überhaupt meedoen. De keuzelijst in het
  // filterpaneel toont elke partij die minstens één team uit de teamselectie
  // raakt (ongeacht focus/diepte, zodat de lijst niet meebeweegt met de
  // tekening), op naam gesorteerd.
  const partyFilterOptions = useMemo(() => {
    const selected = new Set(filteredTeams.map((tm) => tm.id))
    return partyGraph
      .filter((p) => [...p.sources.keys(), ...p.sinks.keys()].some((teamId) => selected.has(teamId)))
      .map((p) => ({ key: p.key, naam: p.naam, type: p.type, teamCount: new Set([...p.sources.keys(), ...p.sinks.keys()]).size }))
      .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
  }, [partyGraph, filteredTeams])
  const visiblePartyGraph = useMemo(() => partyGraph.filter((p) => !hiddenPartyKeys.has(p.key)), [partyGraph, hiddenPartyKeys])
  const partyList = useMemo(() => partiesByTeam(visiblePartyGraph), [visiblePartyGraph])
  const selectedParty = useMemo(
    () => (selection?.type === 'party' ? (visiblePartyGraph.find((p) => p.key === selection.key) ?? null) : null),
    [selection, visiblePartyGraph],
  )
  const togglePartyHidden = (key) =>
    setHiddenPartyKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Structuur van de tekening (welke kaarten in welke stand, welke lijnen,
  // aan welke handles) — elke wijziging hierin laat ChainCanvas een nieuwe
  // ELK-lay-out berekenen; hover zit er bewust niet in. Handmatig slepen
  // bestaat in dit scherm niet meer: de lay-out is volledig berekend, slepen
  // zou daar alleen maar mee vechten (nodesDraggable staat uit).
  const graph = useMemo(
    () =>
      computeChainGraph({
        teamWorkflows,
        teamRisk,
        teamLabels,
        chainEdgesAll,
        filteredTeams,
        focusTeamId: activeFocusTeamId,
        partyGraph: visiblePartyGraph,
        partyOptions: { showFocus: showFocusParties, showOthers: showOtherParties },
        depth,
        showBackflow,
        selection,
      }),
    [teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, activeFocusTeamId, visiblePartyGraph, showFocusParties, showOtherParties, depth, showBackflow, selection],
  )
  const { nodes, edges, stream } = graph

  // Een selectie die niet meer in beeld is (diepte verlaagd, team weggefilterd,
  // partij weggefilterd, stapel-tab verdwenen doordat die groep partijen weer
  // als kaartjes staat) vervalt vanzelf.
  useEffect(() => {
    if (!selection) return
    const card = (teamId) => nodes.find((n) => n.id === `focus-card:${teamId}`)
    const stale =
      (selection.type === 'card' && !card(selection.teamId)) ||
      (selection.type === 'item' && !card(selection.teamId)?.data.rows.some((row) => row.id === selection.itemId)) ||
      (selection.type === 'stack' && !card(selection.teamId)?.data.stacks?.[selection.side]) ||
      (selection.type === 'party' && !nodes.some((n) => n.id === `party:${selection.key}`)) ||
      (selection.type === 'edge' && !edges.some((e) => e.id === selection.id || e.data?.pairId === selection.id))
    if (stale) {
      setSelection(null)
      setStackReturn(null)
    }
  }, [selection, nodes, edges])

  // Een geselecteerde lijn kan een bundel zijn (agg:A->B) die inmiddels als
  // losse koppelingen getekend staat — elk daarvan draagt de bundel als
  // pairId; ze horen allemaal bij de selectie.
  const selectedEdgeId = selection?.type === 'edge' ? selection.id : null
  const selectedEdges = useMemo(
    () => (selectedEdgeId ? edges.filter((e) => e.id === selectedEdgeId || e.data?.pairId === selectedEdgeId) : []),
    [edges, selectedEdgeId],
  )
  // Een geselecteerd item of een geselecteerde partij markeert de lijnen van
  // zijn stroom al in de graaf zelf (data.inStream, zie computeChainGraph).
  const streamSelected = selection?.type === 'item' || selection?.type === 'party'

  // Selectie wint van hover: een vastgezette lijn moet niet weer wegzakken
  // omdat de muis toevallig over een andere lijn beweegt.
  const activeEdgeId = selectedEdgeId ?? hoveredEdgeId

  // Klik pint een lijn vast (blijft staan terwijl je rondkijkt/scrollt);
  // hover geeft alleen lichte visuele feedback ín de lijn zelf (oplichten, de
  // rest kort dimmen). Bij een stroom (item/partij) lichten alle lijnen van
  // die stroom op en dimt de rest — niet geanimeerd, dat wordt bij tientallen
  // lijnen tegelijk alleen maar onrustig.
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const selected = e.id === selectedEdgeId || (selectedEdgeId != null && e.data?.pairId === selectedEdgeId)
        if (streamSelected) {
          const active = Boolean(e.data?.inStream)
          return { ...e, selected, style: { ...e.style, strokeWidth: active ? 3 : 1.5, opacity: active ? 1 : 0.12 } }
        }
        if (!activeEdgeId) return { ...e, selected }
        const active = e.id === activeEdgeId || e.data?.pairId === activeEdgeId
        return {
          ...e,
          selected,
          animated: active && Boolean(selectedEdgeId),
          style: { ...e.style, strokeWidth: active ? 3.5 : 1.5, opacity: active ? 1 : 0.15 },
        }
      }),
    [edges, activeEdgeId, selectedEdgeId, streamSelected],
  )

  // Bij een geselecteerde lijn lichten de twee item-handles (amber) op, zodat
  // meteen duidelijk is van welk output- naar welk inputkaartje de lijn loopt;
  // bij een geselecteerd item alleen dat item zelf.
  const activeItemIds = useMemo(() => {
    if (selection?.type === 'item') return new Set([selection.itemId])
    if (selectedEdges.length === 0) return null
    const ids = selectedEdges
      .flatMap((e) => [e.sourceHandle, e.targetHandle])
      .filter((handle) => handle && handle.startsWith('item-'))
      .map((handle) => handle.replace(/^item-(in|out)(-rev)?:/, ''))
    return new Set(ids)
  }, [selectedEdges, selection])

  const displayNodes = useMemo(() => {
    if (!activeItemIds) return nodes
    return nodes.map((n) => (n.type === 'focusCard' ? { ...n, data: { ...n.data, activeItemIds } } : n))
  }, [nodes, activeItemIds])

  // Rijen voor het detailvak van een geselecteerde partij: per team elk
  // item/dependency dat de partij noemt, alleen voor teams die ook echt op het
  // canvas staan (de keten van het focusteam, niet de hele selectie).
  const selectedPartyRows = useMemo(() => {
    if (!selectedParty) return []
    const visible = new Set(visibleTeams.map((tm) => tm.id))
    const rows = []
    for (const [teamId, refs] of selectedParty.sources) {
      if (!visible.has(teamId)) continue
      for (const ref of refs) rows.push({ key: `${teamId}:${ref.kind}:${ref.id}`, teamId, kind: ref.kind, label: ref.label })
    }
    for (const [teamId, refs] of selectedParty.sinks) {
      if (!visible.has(teamId)) continue
      for (const ref of refs) rows.push({ key: `${teamId}:${ref.kind}:${ref.id}`, teamId, kind: ref.kind, label: ref.label })
    }
    return rows
  }, [selectedParty, visibleTeams])

  const refKindLabel = (kind) =>
    kind === 'input' ? t('chain.externalLinkInput') : kind === 'output' ? t('chain.externalLinkOutput') : t('chain.externalLinkDependency')

  // Geselecteerde kaart: koppelingen per partnerteam (gebundeld, ongeacht
  // hoe ze getekend staan) en de externe partijen aan die kaart.
  const selectedCard = useMemo(() => {
    if (selection?.type !== 'card') return null
    const node = nodes.find((n) => n.id === `focus-card:${selection.teamId}`)
    if (!node) return null
    const visible = new Set(nodes.filter((n) => n.type === 'focusCard').map((n) => n.data.teamId))
    const pairs = new Map()
    for (const edge of chainEdgesAll) {
      if (edge.sourceTeam === edge.targetTeam) continue
      if (edge.sourceTeam !== selection.teamId && edge.targetTeam !== selection.teamId) continue
      if (!visible.has(edge.sourceTeam) || !visible.has(edge.targetTeam)) continue
      const key = `${edge.sourceTeam}->${edge.targetTeam}`
      if (!pairs.has(key)) {
        pairs.set(key, {
          key,
          sourceNaam: teamLabels[edge.sourceTeam] ?? teams.find((tm) => tm.id === edge.sourceTeam)?.naam ?? edge.sourceTeam,
          targetNaam: teamLabels[edge.targetTeam] ?? teams.find((tm) => tm.id === edge.targetTeam)?.naam ?? edge.targetTeam,
          count: 0,
          pending: 0,
        })
      }
      const pair = pairs.get(key)
      pair.count += 1
      if (edge.status === 'voorgesteld') pair.pending += 1
    }
    const parties = partyList.get(selection.teamId) ?? { left: [], right: [] }
    return { node, pairs: [...pairs.values()], parties }
  }, [selection, nodes, chainEdgesAll, teamLabels, teams, partyList])

  function toggleRiskLevel(level) {
    setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]))
  }

  function selectParty(key, from = null) {
    setStackReturn(from)
    setSelection({ type: 'party', key })
  }

  function clearSelection() {
    setSelection(null)
    setStackReturn(null)
  }

  const teamNaam = (teamId) => teamLabels[teamId] ?? teams.find((tm) => tm.id === teamId)?.naam ?? teamId

  // Het team-focusmenu leeft op het canvas zelf (als zwevend paneel, zie
  // <Panel> hieronder), samen met de diepteregelaar en de schakelaar voor
  // terugkoppelingen — alleen bij een lege staat (geen canvas om op te
  // zweven) valt dit terug op een gewone, gecentreerde plek in de melding,
  // zodat je ook dan van focusteam kan wisselen. Geen lege optie: er is
  // altijd één team in beeld (zie activeFocusTeamId).
  const focusPicker = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
      <label htmlFor="chain-focus" className="text-xs font-medium text-[#2a5f8a]">
        {t('chain.focusLabel')}
      </label>
      <select
        id="chain-focus"
        value={activeFocusTeamId}
        onChange={(e) => changeFocus(e.target.value)}
        className="max-w-[200px] truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
      >
        {filteredTeams.map((tm) => (
          <option key={tm.id} value={tm.id}>
            {teamLabels[tm.id] ?? tm.naam}
          </option>
        ))}
      </select>
      <span className="h-4 w-px bg-slate-200" />
      <span className="text-xs font-medium text-[#2a5f8a]" title={t('chain.depthHint')}>
        {t('chain.depthLabel')}
      </span>
      <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs" title={t('chain.depthHint')}>
        {Array.from({ length: MAX_DEPTH }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={depth === n}
            onClick={() => setDepth(n)}
            className={`rounded px-2 py-0.5 transition-colors ${depth === n ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="h-4 w-px bg-slate-200" />
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={showBackflow}
          onChange={(e) => setShowBackflow(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
        />
        {t('chain.backflowToggle')}
      </label>
    </div>
  )

  const chipClass = (clickable) =>
    `inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 ${clickable ? 'cursor-pointer hover:border-[#2a5f8a] hover:text-[#2a5f8a]' : ''}`
  const sectionLabel = (text) => <span className="mr-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-400">{text}</span>
  const partyChip = (entry, from) => (
    <button key={`${from.side}:${entry.party.key}`} type="button" onClick={() => selectParty(entry.party.key, from)} className={chipClass(true)}>
      {entry.party.naam}
      <span className="text-slate-400">· {entry.refs.length}</span>
    </button>
  )

  // Het detailvak onder het canvas, per selectiesoort.
  let detail = null
  if (selectedCard) {
    const { node, pairs, parties } = selectedCard
    const { data } = node
    const from = (side) => ({ teamId: data.teamId, side })
    detail = (
      <>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide text-[#2a5f8a]">{data.label}</span>
            <span className="text-slate-500">{t('chain.cardSelectedSummary', { inCount: data.inCount, outCount: data.outCount, depCount: data.depCount })}</span>
            {data.depCount > 0 && <RiskBadge level={data.risk.level} />}
          </div>
          {data.teamId !== activeFocusTeamId && (
            <button
              type="button"
              onClick={() => changeFocus(data.teamId)}
              className="rounded-md bg-[#2a5f8a] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1f4a6c]"
            >
              {t('chain.focusHere')}
            </button>
          )}
        </div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {sectionLabel(t('chain.linksLabel'))}
          {pairs.length === 0 && <span className="text-slate-400">{t('chain.noLinks')}</span>}
          {pairs.map((pair) => (
            <span key={pair.key} className={chipClass(false)}>
              {pair.sourceNaam} → {pair.targetNaam}
              <span className="text-slate-400">· {pair.count}</span>
              {pair.pending > 0 && <span className="text-amber-700">· {t('chain.pendingCount', { count: pair.pending })}</span>}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {sectionLabel(t('chain.partiesLabel'))}
          {parties.left.length + parties.right.length === 0 && <span className="text-slate-400">{t('chain.noParties')}</span>}
          {parties.left.map((entry) => partyChip(entry, from('left')))}
          {parties.right.map((entry) => partyChip(entry, from('right')))}
        </div>
      </>
    )
  } else if (selection?.type === 'item' && stream) {
    // Geselecteerd item: wat het is, en wat er binnen de huidige diepte
    // stroomafwaarts aan hangt (plus waar het zelf rechtstreeks vandaan komt).
    const item = stream.item
    detail = (
      <>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-semibold uppercase tracking-wide text-[#2a5f8a]">
            {t(selection.kind === 'in' ? 'chain.itemSelectedIn' : 'chain.itemSelectedOut', { team: teamNaam(selection.teamId) })} · {item?.label || '—'}
          </span>
          <span className="text-slate-500">
            {t('chain.streamSummary', { depth, teams: stream.teamIds.length, links: stream.linkCount, parties: stream.partyKeys.length })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {sectionLabel(t('chain.streamTeamsLabel'))}
          {stream.teamIds.length + stream.partyKeys.length === 0 && <span className="text-slate-400">{t('chain.streamEmpty')}</span>}
          {stream.teamIds.map((teamId) => (
            <button key={teamId} type="button" onClick={() => changeFocus(teamId)} className={chipClass(true)} title={t('chain.focusHere')}>
              {teamNaam(teamId)}
            </button>
          ))}
          {stream.partyKeys.map((key) => (
            <button key={key} type="button" onClick={() => selectParty(key)} className={chipClass(true)}>
              {partyGraph.find((p) => p.key === key)?.naam ?? key}
            </button>
          ))}
        </div>
      </>
    )
  } else if (selection?.type === 'stack') {
    const entries = partyList.get(selection.teamId)?.[selection.side] ?? []
    detail = (
      <>
        <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
          {t(selection.side === 'left' ? 'chain.stackSelectedSources' : 'chain.stackSelectedSinks', { team: teamNaam(selection.teamId) })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {entries.length === 0 && <span className="text-slate-400">{t('chain.noParties')}</span>}
          {entries.map((entry) => partyChip(entry, { teamId: selection.teamId, side: selection.side }))}
        </div>
      </>
    )
  } else if (selectedParty) {
    // Geselecteerde externe partij: alles wat er in de zichtbare keten aan
    // hangt, per team.
    detail = (
      <>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold uppercase tracking-wide text-[#2a5f8a]">
            {t('chain.externalSelectedTitle')} · {selectedParty.naam}
          </span>
          {stackReturn && (
            <button
              type="button"
              onClick={() => setSelection({ type: 'stack', teamId: stackReturn.teamId, side: stackReturn.side })}
              className="text-[11px] font-medium text-[#2a5f8a] hover:underline"
            >
              {t('chain.partyBackToStack', { count: partyList.get(stackReturn.teamId)?.[stackReturn.side]?.length ?? 0, team: teamNaam(stackReturn.teamId) })}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {selectedPartyRows.map((row) => (
            <div key={row.key} className="text-slate-700">
              <span className="font-medium">{teamNaam(row.teamId)}</span>
              <span className="text-slate-400"> · {refKindLabel(row.kind)}: </span>
              {row.label || '—'}
            </div>
          ))}
        </div>
      </>
    )
  } else if (selectedEdges.length > 0) {
    const first = selectedEdges[0]
    if (first.data.external) {
      detail = (
        <>
          <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
            {first.data.direction === 'in' ? `${first.data.partyNaam} → ${first.data.teamNaam}` : `${first.data.teamNaam} → ${first.data.partyNaam}`}
          </div>
          <div className="space-y-1">
            {first.data.refs.map((ref) => (
              <div key={`${ref.kind}:${ref.id}`} className="text-slate-700">
                <span className="text-slate-400">{refKindLabel(ref.kind)}: </span>
                {ref.label || '—'}
              </div>
            ))}
          </div>
        </>
      )
    } else {
      // Ketenkoppeling(en): één lijn, of alle onderliggende koppelingen van
      // een bundel — elk met status en de opsomming die op de teampagina bij
      // de betrokken items is vastgelegd.
      const links = selectedEdges.flatMap((e) => e.data.links ?? (e.data.link ? [e.data.link] : []))
      const sourceNaam = first.data.sourceTeamNaam ?? links[0]?.sourceTeamNaam ?? ''
      const targetNaam = first.data.targetTeamNaam ?? links[0]?.targetTeamNaam ?? ''
      detail = (
        <>
          <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
            {sourceNaam} → {targetNaam} · {links.length === 1 ? t('chain.edgeSelectedCountOne') : t('chain.edgeSelectedCount', { count: links.length })}
          </div>
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <div key={i} className="text-slate-700">
                <div>
                  <span className="text-slate-400">{t('chain.edgeOutput')}: </span>
                  {link.sourceLabel || '—'}
                  <span className="text-slate-400"> · {t('chain.edgeInput')}: </span>
                  {link.targetLabel || '—'}
                  {link.status === 'voorgesteld' && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{t('chain.edgePending')}</span>
                  )}
                </div>
                {link.punten?.length > 0 && (
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-slate-600">
                    {link.punten.map((p, j) => (
                      <li key={`${j}:${p}`}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )
    }
  }

  // Het canvas vult de hele resterende vensterhoogte: van zijn eigen
  // bovenrand tot de onderrand van het venster, minus het detailvak zodra dat
  // open staat (dat blijft dan óók in beeld, zonder paginascroll). Gemeten
  // i.p.v. een vaste calc(100vh - N): wat erboven staat verschilt per
  // situatie, en het detailvak wisselt van hoogte per selectie. Ondergrens
  // voor kleine schermen; dan scrolt de pagina gewoon.
  const canvasBoxRef = useRef(null)
  const detailBoxRef = useRef(null)
  const [canvasHeight, setCanvasHeight] = useState(560)
  const detailOpen = Boolean(detail)
  useEffect(() => {
    const update = () => {
      const box = canvasBoxRef.current
      // Geen venster (nog) gemeten — bv. een verborgen tabblad — dan de
      // vorige waarde laten staan i.p.v. op de ondergrens te vallen.
      if (!box || !window.innerHeight) return
      const top = box.getBoundingClientRect().top
      const detailHeight = detailBoxRef.current ? detailBoxRef.current.getBoundingClientRect().height + 8 : 0
      // 24px = de pb-6 van <main> (App.jsx).
      setCanvasHeight(Math.max(480, Math.floor(window.innerHeight - top - detailHeight - 24)))
    }
    update()
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    if (detailBoxRef.current) observer.observe(detailBoxRef.current)
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [detailOpen])

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        {/* Leeg-melding alleen als de tekening écht leeg zou zijn: geen andere
            kaart en geen enkele lijn. Een team met alleen een nog niet
            geaccepteerd verzoek (gestippelde lijn) of alleen externe partijen
            heeft wél een canvas — daarom wordt hier op de getekende lijnen
            getoetst, niet op geaccepteerde ketenkoppelingen alleen. */}
        {focusActive && visibleTeams.length === 1 && edges.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            <div className="mb-4 flex justify-center">{focusPicker}</div>
            <div>{t('chain.focusEmptyTitle')}</div>
            <div className="mt-1 text-xs">{t('chain.focusEmptyHint')}</div>
          </div>
        ) : visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            {t('chain.noTeams')}
          </div>
        ) : (
          <ReactFlowProvider>
            <div ref={canvasBoxRef} className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm" style={{ height: canvasHeight }}>
              <ChainCanvas
                graph={graph}
                nodes={displayNodes}
                edges={displayEdges}
                fitKey={`${activeFocusTeamId}:${sidebarMode}`}
                onNodeClick={(event, node) => {
                  if (node.type === 'externalParty') {
                    // Nogmaals klikken op de partij heft de selectie op.
                    if (selection?.type === 'party' && selection.key === node.data.key) clearSelection()
                    else selectParty(node.data.key)
                    return
                  }
                  if (node.type !== 'focusCard') return
                  // Klik op een stapel-tab (zie StackTab) opent de partijenlijst
                  // van die kant; klik op een itemrij (zie FocusChainCardNode)
                  // selecteert dat ene item en toont zijn stroom; een klik op
                  // de kaart zelf selecteert het team — de focus verleggen gaat
                  // via 'Focus op dit team' in het detailvak of het menu.
                  const stack = event.target.closest?.('[data-stack]')
                  if (stack) {
                    const side = stack.getAttribute('data-stack')
                    setStackReturn(null)
                    setSelection((prev) => (prev?.type === 'stack' && prev.teamId === node.data.teamId && prev.side === side ? null : { type: 'stack', teamId: node.data.teamId, side }))
                    return
                  }
                  const row = event.target.closest?.('[data-item]')
                  if (row) {
                    const itemId = row.getAttribute('data-item')
                    const kind = row.getAttribute('data-item-kind')
                    setStackReturn(null)
                    setSelection((prev) => (prev?.type === 'item' && prev.itemId === itemId ? null : { type: 'item', teamId: node.data.teamId, itemId, kind }))
                    return
                  }
                  setStackReturn(null)
                  setSelection((prev) => (prev?.type === 'card' && prev.teamId === node.data.teamId ? null : { type: 'card', teamId: node.data.teamId }))
                }}
                onEdgeClick={(_, edge) => {
                  setStackReturn(null)
                  // Een losse koppeling uit een geselecteerde bundel klikken
                  // laat de bundel-selectie staan; elke andere lijn wisselt.
                  setSelection((prev) => {
                    if (prev?.type === 'edge' && (prev.id === edge.id || edge.data?.pairId === prev.id)) return null
                    return { type: 'edge', id: edge.id }
                  })
                }}
                onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
                onEdgeMouseLeave={() => setHoveredEdgeId(null)}
                onPaneClick={clearSelection}
              >
                <Panel position="top-left">{focusPicker}</Panel>
                <Panel position="top-right">
                  <ChainLegend />
                </Panel>
              </ChainCanvas>
            </div>
          </ReactFlowProvider>
        )}

        {detail && (
          <div ref={detailBoxRef} className="flex items-start justify-between gap-3 rounded-lg border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-4 py-2.5">
            <div className="min-w-0 flex-1 text-xs">{detail}</div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('selectie.wissen')}
            </button>
          </div>
        )}
      </div>

      {adminSections.filters && (
        <TeamFilterPanel
          teams={teams}
          selected={selectedTeamIds}
          onToggle={toggleTeam}
          onSelectAll={selectAllTeams}
          onSelectNone={selectNoTeams}
          riskLevels={selectedRiskLevels}
          onToggleRisk={toggleRiskLevel}
          onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
          onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
          externalParties={{
            showFocus: showFocusParties,
            showOthers: showOtherParties,
            onToggleFocus: () => setShowFocusParties((v) => !v),
            onToggleOthers: () => setShowOtherParties((v) => !v),
            parties: partyFilterOptions,
            hiddenKeys: hiddenPartyKeys,
            onToggleParty: togglePartyHidden,
            onSelectAll: () => setHiddenPartyKeys(new Set()),
            onSelectNone: () => setHiddenPartyKeys(new Set(partyFilterOptions.map((p) => p.key))),
          }}
        />
      )}
    </div>
  )
}
