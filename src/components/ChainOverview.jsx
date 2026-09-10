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
import { orderChain, roundedOrthPath, polylineMidpoint, buildElkGraph, applyElkLayout, fallbackPositions } from '../lib/chainLayout'
import { emptyTeamWorkflow } from '../lib/storage'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import TeamFilterPanel from './TeamFilterPanel'
import ScopeToggle from './ScopeToggle'

function highestRisk(deps) {
  let best = { level: 'Laag', score: 0 }
  for (const d of deps) {
    const r = calculateRisk(d)
    if (r.score > best.score) best = r
  }
  return best
}

// Externe partijen (systeem, ander bedrijfsonderdeel, leverancier, CAB, …)
// zitten in rust als stapel-tab ónder de kaart (links = bronnen en
// afhankelijkheden, rechts = ontvangers) en verschijnen pas als eigen kaartje
// zodra één partij geselecteerd is: dan zet ELK die als hub naast de teams
// die ze raakt, met een lijn naar elk van die teams. Bewust grijs, buiten de
// risicokleurenreeks — een partij heeft zelf geen risicoscore; de lijnen
// tonen de relatie (input/output/afhankelijkheid), niet een ernst.
const EXT_COLOR = '#5c6b8a'
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

// De hub-node van de geselecteerde partij; de positie bepaalt ELK. `layer` is
// alleen een hint voor de noodlay-out: vóór het eerste team dat ze voedt, of
// ná het laatste team dat aan haar levert.
function partyNode(p, layer) {
  return {
    id: `party:${p.key}`,
    type: 'externalParty',
    position: { x: 0, y: 0 },
    data: {
      key: p.key,
      naam: p.naam,
      type: p.type,
      teamCount: new Set([...p.sources.keys(), ...p.sinks.keys()]).size,
      selected: true,
      layer,
    },
  }
}

function externalEdgeData(p, teamNaam, direction, refs) {
  return { external: true, partyKey: p.key, partyNaam: p.naam, teamNaam, direction, refs }
}

// Zichtbare zoom-toolbar boven het canvas (i.p.v. enkel React Flow's kleine
// standaard knoppen linksonder) — moet binnen een ReactFlowProvider zitten
// om via useReactFlow() bij de zoom/fitView-acties van déze canvas-instantie
// te kunnen.
function ChainZoomToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { t } = useLanguage()
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => zoomOut()}
        title={t('chain.zoomOut')}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => fitView({ padding: 0.15, duration: 200 })}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {t('chain.fitToScreen')}
      </button>
      <button
        type="button"
        onClick={() => zoomIn()}
        title={t('chain.zoomIn')}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50"
      >
        +
      </button>
    </div>
  )
}

// Past het canvas opnieuw in beeld zodra er een nieuwe lay-out staat (elke
// selectie/focus/diepte-wijziging levert er een op), of wanneer de zijbalk
// *definitief* wisselt (open/iconen/auto) en zo de beschikbare breedte
// permanent verandert (fitKey bevat sidebarMode). ReactFlow's fitView-prop
// werkt alleen bij de eerste render.
function ChainAutoFit({ fitKey }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    // 200ms i.p.v. een enkele rAF: dekt zowel de React Flow-commit-lag van
    // nieuwe nodes als de CSS-transitie van <main>'s padding-left bij een
    // sidebarMode-wissel, zodat er tegen de uiteindelijke bounds gefit wordt.
    const id = window.setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 200)
    return () => window.clearTimeout(id)
  }, [fitKey, fitView])
  return null
}

const elk = new ELK()

// Leest de door React Flow gemeten afmetingen en handle-posities uit zijn
// interne administratie (nodeInternals). Levert null zolang nog niet elke
// node van de graaf gemeten is — dan wacht ChainCanvas op de volgende ronde
// (useNodesInitialized). Handle-posities zijn t.o.v. de node, ongeschaald.
function measureNodes(nodeInternals, graph) {
  const sizes = new Map()
  for (const node of graph.nodes) {
    const internal = nodeInternals.get(node.id)
    // Zonder handleBounds is een node nog niet écht gemeten (React Flow zet
    // maat en handles in één keer); dan liever wachten dan met gegokte
    // handle-posities lay-outen.
    const bounds = internal?.[internalsSymbol]?.handleBounds
    if (!internal?.width || !internal?.height || !bounds) return null
    const handles = new Map()
    for (const handle of [...(bounds?.source ?? []), ...(bounds?.target ?? [])]) {
      if (!handle.id) continue
      handles.set(handle.id, {
        x: handle.x + handle.width / 2,
        y: handle.y + handle.height / 2,
        side: handle.position === Position.Right ? 'EAST' : 'WEST',
      })
    }
    sizes.set(node.id, { width: internal.width, height: internal.height, handles })
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
  const [layout, setLayout] = useState({ version: 0, positions: new Map(), points: new Map() })
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
    const sizes = measureNodes(store.getState().nodeInternals, graph)
    if (!sizes) return
    // Alleen het laatste verzoek telt: een oudere lay-out die later klaar is
    // (ELK is asynchroon) mag een nieuwere niet overschrijven.
    const run = ++runRef.current
    elk
      .layout(buildElkGraph(graph, sizes))
      .then((result) => {
        if (run !== runRef.current) return
        setLayout({ version: run, ...applyElkLayout(result, graph) })
      })
      .catch((error) => {
        if (run !== runRef.current) return
        console.error('Ketenoverzicht: ELK-lay-out mislukt, noodlay-out gebruikt', error)
        setLayout({ version: run, positions: fallbackPositions(graph, sizes), points: new Map() })
      })
    // `dims` hoort in de deps: een kaart die van maat verandert zonder dat de
    // structuur wijzigt (bv. een nagemeten handle-set) krijgt zo ook een
    // nieuwe lay-out.
  }, [nodesInitialized, graph, store, dims])

  const positionedNodes = useMemo(
    () =>
      nodes.map((n) => {
        const position = layout.positions.get(n.id)
        // Maten alleen meegeven aan een node die al een positie heeft, dus al
        // gemeten én gelay-out is. Een (opnieuw) toegevoegde node mag géén
        // oude maat uit `dims` krijgen: React Flow zou 'm dan als gemeten
        // beschouwen, de echte meting overslaan (zelfde maat = geen update) en
        // zijn handles nooit registreren — met lijnen die nooit verschijnen.
        const size = position ? dims.get(n.id) : null
        const withSize = size ? { ...n, width: size.width, height: size.height } : n
        return position ? { ...withSize, position } : { ...withSize, position: { x: 0, y: 0 }, style: { ...n.style, opacity: 0 } }
      }),
    [nodes, layout, dims],
  )
  const routedEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!layout.positions.has(e.source) || !layout.positions.has(e.target)) return { ...e, hidden: true }
        const points = layout.points.get(e.id)
        return points ? { ...e, data: { ...e.data, points } } : e
      }),
    [edges, layout],
  )

  return (
    <>
      <ChainAutoFit fitKey={`${layout.version}:${fitKey}`} />
      <PannableFlowCanvas
        nodes={positionedNodes}
        edges={routedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        elevateEdgesOnSelect
        nodesDraggable={false}
        onNodesChange={onNodesChange}
        {...handlers}
      >
        {children}
      </PannableFlowCanvas>
    </>
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
                <div
                  key={item.id}
                  className={`relative rounded border px-2 py-1 text-[11px] text-slate-600 transition-colors ${
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
// Levert nodes zónder positie en edges zónder lijnpunten: die vult de
// ELK-lay-out in ChainCanvas in. Zuivere functie; selectie/hover-stijl
// (dimmen, amber items) komt er in displayNodes/displayEdges overheen.
function computeChainGraph({ teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, focusTeamId, partyGraph, depth, showBackflow, selection }) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const trace = traceForwardChain(focusTeamId, filteredTeams, chainEdgesAll)
  const columns = trace.columns.slice(0, depth + 1)
  if (columns.length === 0) return { nodes: [], edges: [] }
  const visibleTeams = columns.flat()
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.id))
  const { layerOf, backEdgeIds } = orderChain(focusTeamId, visibleTeamIds, chainEdgesAll)
  const teamNaamById = Object.fromEntries(filteredTeams.map((team) => [team.id, naamVan(team)]))
  const layerOfTeam = (teamId) => layerOf.get(teamId) ?? 0

  // Koppelingen tussen twee zichtbare teams. Een koppeling van een team naar
  // zichzelf is geen ketenstap en heeft in een gelaagde tekening geen plek;
  // de items tonen wel hun onderschrift.
  const itemLinkedTeam = new Map()
  const links = []
  for (const edge of chainEdgesAll) {
    const sourceShown = visibleTeamIds.has(edge.sourceTeam)
    const targetShown = visibleTeamIds.has(edge.targetTeam)
    if (!sourceShown && !targetShown) continue
    if (sourceShown && edge.sourceOutputId) itemLinkedTeam.set(edge.sourceOutputId, edge.targetTeam)
    if (targetShown && edge.targetInputId) itemLinkedTeam.set(edge.targetInputId, edge.sourceTeam)
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
  const touches = (link, teamId) => link.edge.sourceTeam === teamId || link.edge.targetTeam === teamId
  // Welke koppelingen "horen bij" de selectie: alles aan de geselecteerde
  // kaart, of de (gebundelde) lijn zelf.
  const selectedLinks = selectedTeamId
    ? links.filter((link) => touches(link, selectedTeamId))
    : selectedEdgeId
      ? links.filter((link) => link.edge.id === selectedEdgeId || link.pairId === selectedEdgeId)
      : []
  const modeOf = (teamId) => {
    if (selectedTeamId) {
      if (teamId === selectedTeamId) return 'full'
      return selectedLinks.some((link) => touches(link, teamId)) ? 'partial' : 'collapsed'
    }
    if (selectedEdgeId) {
      if (selectedLinks.some((link) => touches(link, teamId))) return 'partial'
      return teamId === focusTeamId ? 'full' : 'collapsed'
    }
    return teamId === focusTeamId ? 'full' : 'collapsed'
  }

  // Herkomst/bestemming van een item: eerst een daadwerkelijke team-koppeling
  // (itemLinkedTeam hierboven, de meest concrete info), dan een externe partij
  // (voor een ketenoverzicht het belangrijkste om te tonen — een item kan
  // zowel via een eigen applicatie lopen als uiteindelijk van een externe
  // partij komen, bv. klantgegevens via het eigen klantportaal maar
  // oorspronkelijk uit de BRP; de externe herkomst weegt dan zwaarder dan
  // welke eigen app het ophaalt), dan de eigen applicatie, dan het generieke
  // bron_type (rol, persoon, stakeholder, omgeving).
  function resolveOrigin(rawItem, appsById) {
    const linkedTeamId = itemLinkedTeam.get(rawItem.id)
    if (linkedTeamId) return { kind: 'team', naam: teamNaamById[linkedTeamId] ?? linkedTeamId }
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

  // Per kaart: welke rijen staan er (stand + selectie), en hoeveel echte
  // items blijven verborgen achter "+N andere items".
  const cards = new Map()
  for (const team of visibleTeams) {
    const mode = modeOf(team.id)
    const { rows, inCount, outCount } = allRows(team.id)
    let shown = []
    if (mode === 'full') shown = rows
    else if (mode === 'partial') {
      const wanted = new Set()
      for (const link of selectedLinks) {
        if (link.edge.sourceTeam === team.id) wanted.add(sourceItemId(link.edge))
        if (link.edge.targetTeam === team.id) wanted.add(targetItemId(link.edge))
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
    const color = CONNECTION_COLORS[colorIndex % CONNECTION_COLORS.length]
    colorIndex += 1
    if (srcShown) itemColor.set(srcId, color)
    if (tgtShown) itemColor.set(tgtId, color)
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
      data: { back, pairId, link: linkData(edge) },
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

  // --- Externe partijen: tellers in de stapel-tabs van elke kaart; alleen de
  // geselecteerde partij wordt een hub-node met een lijn naar elk zichtbaar
  // team dat ze raakt (afhankelijkheden en input-items samengevoegd tot één
  // lijn per team, outputs één lijn per team).
  const byTeam = partyGraph ? partiesByTeam(partyGraph) : null
  const highlightTeams = new Set()
  const hubNodes = []
  if (partyGraph && sel.type === 'party') {
    const p = partyGraph.find((party) => party.key === sel.key)
    const sourceTeams = p ? visibleTeams.map((team) => team.id).filter((id) => p.sources.has(id)) : []
    const sinkTeams = p ? visibleTeams.map((team) => team.id).filter((id) => p.sinks.has(id)) : []
    if (p && sourceTeams.length + sinkTeams.length > 0) {
      const leftOfChain = sourceTeams.length > 0
      const layer = leftOfChain ? Math.min(...sourceTeams.map(layerOfTeam)) - 1 : Math.max(...sinkTeams.map(layerOfTeam)) + 1
      hubNodes.push(partyNode(p, layer))
      const extStyle = (dashed) => ({ stroke: EXT_COLOR, strokeWidth: 1.5, ...(dashed ? BACK_EDGE_STYLE : {}), opacity: 0.85 })
      for (const teamId of sourceTeams) {
        const refs = p.sources.get(teamId)
        highlightTeams.add(teamId)
        edges.push({
          id: `hub:${p.key}->${teamId}`,
          source: `party:${p.key}`,
          target: `focus-card:${teamId}`,
          sourceHandle: 'right-source',
          targetHandle: 'card-in',
          type: 'elk',
          data: { count: refs.length, ...externalEdgeData(p, teamNaamById[teamId] ?? teamId, 'in', refs) },
          style: extStyle(refs.some((ref) => ref.kind === 'dependency')),
          markerEnd: arrow(EXT_COLOR, 12),
        })
      }
      for (const teamId of sinkTeams) {
        const refs = p.sinks.get(teamId)
        highlightTeams.add(teamId)
        // Staat de hub links (ze is óók bron), dan loopt output ernaartoe
        // terug naar links: terugkoppeling.
        const rev = leftOfChain ? '-rev' : ''
        edges.push({
          id: `hub:${teamId}->${p.key}`,
          source: `focus-card:${teamId}`,
          target: `party:${p.key}`,
          sourceHandle: `card-out${rev}`,
          targetHandle: leftOfChain ? 'right-target' : 'left-target',
          type: 'elk',
          data: { back: leftOfChain, count: refs.length, ...externalEdgeData(p, teamNaamById[teamId] ?? teamId, 'out', refs) },
          style: extStyle(false),
          markerEnd: arrow(EXT_COLOR, 12),
        })
      }
    }
  }

  // Kaarten in ketenvolgorde (focusteam eerst): ELK gebruikt die invoer-
  // volgorde als tie-breaker (considerModelOrder), zodat dezelfde data ook
  // telkens dezelfde tekening oplevert. Geen positie: die komt van ELK.
  const nodes = visibleTeams.map((team, index) => {
    const card = cards.get(team.id)
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    const stacks = byTeam ? { left: byTeam.get(team.id)?.left.length ?? 0, right: byTeam.get(team.id)?.right.length ?? 0 } : null
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

  return { nodes: [...nodes, ...hubNodes], edges }
}

// Zuivere graafopbouw ook los van de component bruikbaar (bv. een ad-hoc
// controle op de mockdata in node, zonder browser).
export { computeChainGraph }

export default function ChainOverview({ adminSections, sidebarMode }) {
  const { teams, dependencies, teamWorkflows, teamLabels, externalParties } = useAppContext()
  const { t } = useLanguage()
  // Gearchiveerde teams staan bij openen standaard uit, zelfde gedrag als
  // de netwerkweergave — blijven wel aan te vinken voor historische data.
  const [deselectedTeamIds, setDeselectedTeamIds] = useState(() => new Set(teams.filter((tm) => !tm.actief).map((tm) => tm.id)))
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  // Lokale scope-filter, zelfde opzet als Netwerkweergave: standaard 'alle'
  // zodat het ketenoverzicht zoals voorheen Teamniveau + Ketenniveau gemengd
  // toont, met de optie om te versmallen.
  const [scope, setScope] = useState('alle')

  const selectedTeamIds = useMemo(() => teams.filter((tm) => !deselectedTeamIds.has(tm.id)).map((tm) => tm.id), [teams, deselectedTeamIds])
  const filteredTeams = useMemo(() => teams.filter((tm) => selectedTeamIds.includes(tm.id)), [teams, selectedTeamIds])

  // Het ketenoverzicht kent één weergave: focus op één team, waarna de keten
  // voorwaarts uitrolt (kolom per ketenstap, begrensd door `depth`). Leeg =
  // nog geen eigen keuze en dan valt de weergave terug op defaultFocusTeamId.
  const [focusTeamId, setFocusTeamId] = useState('')
  const [depth, setDepth] = useState(MAX_DEPTH)
  const [showBackflow, setShowBackflow] = useState(true)
  // Externe partijen (systemen, leveranciers, CAB, …) als stapel-tabs onder
  // de kaarten en, geselecteerd, als hub — standaard aan, uit te zetten voor
  // een puur team-op-team beeld.
  const [showExternalParties, setShowExternalParties] = useState(true)
  // Eén selectie tegelijk: een kaart ({type:'card'}), een lijn ({type:'edge',
  // id = koppeling of bundel}), een stapel-tab ({type:'stack'}) of een
  // externe partij ({type:'party'}). De selectie bepaalt mede wat er
  // getekend wordt (zie computeChainGraph); hover niet.
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
    for (const team of visibleTeams) {
      const inScope = dependencies.filter((d) => d.teamId === team.id && (scope === 'alle' || d.scope === scope))
      const deps = inScope.filter((d) => selectedRiskLevels.includes(calculateRisk(d).level))
      result[team.id] = {
        ...highestRisk(deps),
        count: deps.length,
        dimmed: riskFilterActive && deps.length === 0 && inScope.length > 0,
      }
    }
    return result
  }, [visibleTeams, dependencies, selectedRiskLevels, scope])

  // Hub-statistieken voor het gefocuste team: aantal inkomende/uitgaande
  // koppelingen (niet unieke partners — een team met 3 losse koppelingen naar
  // dezelfde partner telt als 3) en het hoogste risiconiveau van zijn eigen
  // dependencies, ongeacht het huidige risicofilter. Rechtstreeks uit
  // chainEdgesAll i.p.v. via focusChainTrace — dit gaat over de dírecte
  // koppelingen van het focusteam zelf, niet over de hele voorwaartse keten.
  const focusStats = useMemo(() => {
    if (!focusActive) return null
    // Verzoeken die nog op akkoord wachten tellen nog niet mee als koppeling.
    const accepted = chainEdgesAll.filter((e) => e.status !== 'voorgesteld')
    const incoming = accepted.filter((e) => e.targetTeam === activeFocusTeamId && e.sourceTeam !== activeFocusTeamId)
    const outgoing = accepted.filter((e) => e.sourceTeam === activeFocusTeamId && e.targetTeam !== activeFocusTeamId)
    const inScope = dependencies.filter((d) => d.teamId === activeFocusTeamId && (scope === 'alle' || d.scope === scope))
    return {
      incoming: incoming.length,
      outgoing: outgoing.length,
      total: incoming.length + outgoing.length,
      risk: inScope.length > 0 ? highestRisk(inScope) : null,
    }
  }, [focusActive, activeFocusTeamId, chainEdgesAll, dependencies, scope])

  // Externe partijen: één keer verzameld uit alle teams/dependencies; de
  // graafopbouw filtert zelf op de zichtbare teams.
  const partyGraph = useMemo(
    () => buildExternalPartyGraph(teamWorkflows, dependencies, externalParties, teams, teamLabels),
    [teamWorkflows, dependencies, externalParties, teams, teamLabels],
  )
  const partyList = useMemo(() => partiesByTeam(partyGraph), [partyGraph])
  const selectedParty = useMemo(
    () => (selection?.type === 'party' && showExternalParties ? (partyGraph.find((p) => p.key === selection.key) ?? null) : null),
    [selection, showExternalParties, partyGraph],
  )

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
        partyGraph: showExternalParties ? partyGraph : null,
        depth,
        showBackflow,
        selection,
      }),
    [teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, activeFocusTeamId, showExternalParties, partyGraph, depth, showBackflow, selection],
  )
  const { nodes, edges } = graph

  // Een selectie die niet meer in beeld is (diepte verlaagd, team weggefilterd,
  // partijen uitgezet) vervalt vanzelf.
  useEffect(() => {
    if (!selection) return
    const hasCard = (teamId) => nodes.some((n) => n.id === `focus-card:${teamId}`)
    const stale =
      (selection.type === 'card' && !hasCard(selection.teamId)) ||
      (selection.type === 'stack' && (!showExternalParties || !hasCard(selection.teamId))) ||
      (selection.type === 'party' && (!showExternalParties || !nodes.some((n) => n.id === `party:${selection.key}`))) ||
      (selection.type === 'edge' && !edges.some((e) => e.id === selection.id || e.data?.pairId === selection.id))
    if (stale) {
      setSelection(null)
      setStackReturn(null)
    }
  }, [selection, nodes, edges, showExternalParties])

  // Een geselecteerde lijn kan een bundel zijn (agg:A->B) die inmiddels als
  // losse koppelingen getekend staat — elk daarvan draagt de bundel als
  // pairId; ze horen allemaal bij de selectie.
  const selectedEdgeId = selection?.type === 'edge' ? selection.id : null
  const selectedEdges = useMemo(
    () => (selectedEdgeId ? edges.filter((e) => e.id === selectedEdgeId || e.data?.pairId === selectedEdgeId) : []),
    [edges, selectedEdgeId],
  )
  const selectedPartyKey = selection?.type === 'party' ? selection.key : null

  // Selectie wint van hover: een vastgezette lijn moet niet weer wegzakken
  // omdat de muis toevallig over een andere lijn beweegt.
  const activeEdgeId = selectedEdgeId ?? hoveredEdgeId

  // Klik pint een lijn vast (blijft staan terwijl je rondkijkt/scrollt);
  // hover geeft alleen lichte visuele feedback ín de lijn zelf (oplichten, de
  // rest kort dimmen). Een geselecteerde externe partij licht ál haar lijnen
  // tegelijk op, zodat in één oogopslag te zien is welke teams eraan hangen.
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const selected = e.id === selectedEdgeId || (selectedEdgeId != null && e.data?.pairId === selectedEdgeId)
        if (!activeEdgeId && !selectedPartyKey) return { ...e, selected }
        const active = e.id === activeEdgeId || e.data?.pairId === activeEdgeId || (selectedPartyKey && e.data?.partyKey === selectedPartyKey)
        return {
          ...e,
          selected,
          animated: active && Boolean(selectedEdgeId || selectedPartyKey),
          style: { ...e.style, strokeWidth: active ? 3.5 : 1.5, opacity: active ? 1 : 0.15 },
        }
      }),
    [edges, activeEdgeId, selectedEdgeId, selectedPartyKey],
  )

  // Bij een geselecteerde lijn lichten de twee item-handles (amber) op, zodat
  // meteen duidelijk is van welk output- naar welk inputkaartje de lijn loopt.
  const activeItemIds = useMemo(() => {
    if (selectedEdges.length === 0) return null
    const ids = selectedEdges
      .flatMap((e) => [e.sourceHandle, e.targetHandle])
      .filter((handle) => handle && handle.startsWith('item-'))
      .map((handle) => handle.replace(/^item-(in|out)(-rev)?:/, ''))
    return new Set(ids)
  }, [selectedEdges])

  const displayNodes = useMemo(() => {
    if (!activeItemIds) return nodes
    return nodes.map((n) => (n.type === 'focusCard' ? { ...n, data: { ...n.data, activeItemIds } } : n))
  }, [nodes, activeItemIds])

  // Rijen voor het detailvak van een geselecteerde partij: per team elk
  // item/dependency dat de partij noemt, alleen voor zichtbare teams.
  const selectedPartyRows = useMemo(() => {
    if (!selectedParty) return []
    const visible = new Set(filteredTeams.map((tm) => tm.id))
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
  }, [selectedParty, filteredTeams])

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

  function toggleTeam(teamId) {
    setDeselectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

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

  const teamFilterActive = deselectedTeamIds.size > 0
  const riskFilterActive = selectedRiskLevels.length < RISK_LEVELS.length
  const anyFilterActive = teamFilterActive || riskFilterActive
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

  const focusStatsBlock = focusStats && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-600 shadow-md backdrop-blur-sm">
      <span>
        {t('chain.statIncoming')}: <b className="text-slate-800">{focusStats.incoming}</b>
      </span>
      <span>
        {t('chain.statOutgoing')}: <b className="text-slate-800">{focusStats.outgoing}</b>
      </span>
      <span>
        {t('chain.statTotal')}: <b className="text-slate-800">{focusStats.total}</b>
      </span>
      {focusStats.risk && (
        <span className="inline-flex items-center gap-1">
          {t('chain.statHighestRisk')}: <RiskBadge level={focusStats.risk.level} />
        </span>
      )}
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
        {showExternalParties && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sectionLabel(t('chain.partiesLabel'))}
            {parties.left.length + parties.right.length === 0 && <span className="text-slate-400">{t('chain.noParties')}</span>}
            {parties.left.map((entry) => partyChip(entry, from('left')))}
            {parties.right.map((entry) => partyChip(entry, from('right')))}
          </div>
        )}
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

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {anyFilterActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                {t('filter.active')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showExternalParties}
                onChange={(e) => setShowExternalParties(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
              />
              {t('chain.showExternalParties')}
            </label>
            <span className="hidden text-xs text-slate-400 sm:inline" title={t('chain.focusLegend')}>
              {t('chain.focusLegend')}
            </span>
            <ScopeToggle scope={scope} onChange={setScope} />
          </div>
        </div>

        {focusActive && focusStats && focusStats.total === 0 ? (
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
            <ChainZoomToolbar />
            <div
              className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ height: 'max(560px, calc(100vh - 280px))' }}
            >
              <ChainCanvas
                graph={graph}
                nodes={displayNodes}
                edges={displayEdges}
                fitKey={`${activeFocusTeamId}:${sidebarMode}`}
                onNodeClick={(event, node) => {
                  if (node.type === 'externalParty') {
                    // Nogmaals klikken op de hub heft de selectie op.
                    if (selection?.type === 'party' && selection.key === node.data.key) clearSelection()
                    else selectParty(node.data.key)
                    return
                  }
                  if (node.type !== 'focusCard') return
                  // Klik op een stapel-tab (zie StackTab) opent de partijenlijst
                  // van die kant; een klik op de kaart zelf selecteert het team —
                  // de focus verleggen gaat via 'Focus op dit team' in het
                  // detailvak of het menu.
                  const stack = event.target.closest?.('[data-stack]')
                  if (stack) {
                    const side = stack.getAttribute('data-stack')
                    setStackReturn(null)
                    setSelection((prev) => (prev?.type === 'stack' && prev.teamId === node.data.teamId && prev.side === side ? null : { type: 'stack', teamId: node.data.teamId, side }))
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
                {focusStatsBlock && <Panel position="top-right">{focusStatsBlock}</Panel>}
              </ChainCanvas>
            </div>
          </ReactFlowProvider>
        )}

        {detail && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-4 py-2.5">
            <div className="min-w-0 flex-1 text-xs">{detail}</div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('graph.selectionClear')}
            </button>
          </div>
        )}
      </div>

      {adminSections.filters && (
        <TeamFilterPanel
          teams={teams}
          selected={selectedTeamIds}
          onToggle={toggleTeam}
          onSelectAll={() => setDeselectedTeamIds(new Set())}
          onSelectNone={() => setDeselectedTeamIds(new Set(teams.map((tm) => tm.id)))}
          riskLevels={selectedRiskLevels}
          onToggleRisk={toggleRiskLevel}
          onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
          onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
        />
      )}
    </div>
  )
}
