import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BaseEdge,
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
import { orderChain, roundedOrthPath, buildElkGraph, applyElkLayout, fallbackPositions } from '../lib/chainLayout'
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
// als eigen kaartjes in de keten, door ELK naast de teams gezet die ze
// raken: wat input levert of waar een team van afhankelijk is komt vóór dat
// team, wat alleen output ontvangt erna. Bewust grijs, buiten de
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

function ExternalPartyNode({ data }) {
  const { t, language } = useLanguage()
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
// afhankelijkheid en geen externe partij). Eén kaartje per partij (op id,
// anders op naam), zodat een generieke afhankelijkheid als "CAB" of
// "IAM-beheer" als één hub verschijnt met lijnen naar álle teams die 'm
// noemen — precies wat het ketenoverzicht zonder deze partijen niet kon
// laten zien. Zuivere functie; de lay-outfuncties filteren zelf op de
// zichtbare teams.
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

// Splitst de partijen voor een gegeven set zichtbare teams in een linker-
// kolom (levert input of is een afhankelijkheid) en een rechterkolom (alleen
// output-ontvanger). Gedeeld door beide lay-outfuncties.
function partitionParties(partyGraph, visibleTeamIds) {
  const relevant = (partyGraph ?? [])
    .map((p) => ({
      ...p,
      sourceTeams: [...p.sources.keys()].filter((id) => visibleTeamIds.has(id)),
      sinkTeams: [...p.sinks.keys()].filter((id) => visibleTeamIds.has(id)),
    }))
    .filter((p) => p.sourceTeams.length > 0 || p.sinkTeams.length > 0)
  return {
    left: relevant.filter((p) => p.sourceTeams.length > 0),
    right: relevant.filter((p) => p.sourceTeams.length === 0),
  }
}

// Eén node per externe partij; de positie bepaalt ELK (zie ChainCanvas), niet
// meer een vast raster aan de rand. `layer` is alleen een hint voor de
// noodlay-out: bronnen vóór het eerste team dat ze voeden, pure ontvangers ná
// het laatste team dat aan ze levert. `selected` wordt pas in displayNodes
// gezet, zodat een partij aanklikken geen nieuwe lay-out uitlokt.
function partyNode(p, layer) {
  return {
    id: `party:${p.key}`,
    type: 'externalParty',
    position: { x: 0, y: 0 },
    data: {
      key: p.key,
      naam: p.naam,
      type: p.type,
      teamCount: new Set([...p.sourceTeams, ...p.sinkTeams]).size,
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

// Past het canvas opnieuw in beeld zodra de getoonde teamselectie wijzigt, of
// wanneer de zijbalk *definitief* wisselt (open/iconen/auto) en zo de
// beschikbare breedte permanent verandert (fitKey bevat sidebarMode).
// ReactFlow's fitView-prop werkt alleen bij de eerste render; zonder dit bleef
// na het aanzetten van de focusmodus de uitgezoomde transform van het volledige
// overzicht staan, waardoor de drie overgebleven kolommen buiten beeld vielen.
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
    if (!internal?.width || !internal?.height) return null
    const bounds = internal[internalsSymbol]?.handleBounds
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
        const size = dims.get(n.id)
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

// Vaste, kleine kwalitatieve kleurenreeks voor Focusmodus: elke specifieke
// output→input-relatie krijgt zijn eigen kleur (cyclisch toegewezen), zowel op
// de kaartranden als op de verbindingslijn — zo is in één oogopslag te zien
// welke twee kaartjes bij elkaar horen, ook als er meerdere lijnen door
// elkaar heen lopen. Bewust geen stoplichtkleuren (CLAUDE.md); dit is een
// eigen, herkenbaarheids-kleurenreeks, los van de risico-ernstkleuren in
// riskStyles.js.
const CONNECTION_COLORS = ['#0ea5e9', '#4338ca', '#9333ea', '#0d9488', '#d97706', '#e11d48']

const FC_CARD_WIDTH = 230

function FocusChainCardNode({ id, data }) {
  const { t, language } = useLanguage()

  // De item-handles hieronder verschijnen/verdwijnen met de inhoud van deze
  // ene kaart (bv. na een wijziging op de teampagina) — reactflow moet
  // expliciet verteld worden dat de handle-set is gewijzigd, anders klopt de
  // aanhechting van edges niet meer (zelfde patroon als de overview-kaart).
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [data.items, id, updateNodeInternals])

  return (
    <div
      className="relative cursor-pointer rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md hover:shadow-lg"
      style={{ width: FC_CARD_WIDTH, borderColor: data.isFocus ? '#2a5f8a' : '#cbd5e1' }}
      title={t('chain.clickToFocusHint')}
    >
      {/* Kaart-handles (naast de item-handles hieronder): voor lijnen die aan
          geen specifiek item hangen — een afhankelijkheid van een externe
          partij, of een koppelingsverzoek om een nog niet bestaand item. */}
      <Handle type="target" position={Position.Left} id="card-in" style={{ top: 18, opacity: 0.4 }} />
      <Handle type="target" position={Position.Right} id="card-in-rev" style={{ top: 18, opacity: 0.4 }} />
      <Handle type="source" position={Position.Right} id="card-out" style={{ top: 30, opacity: 0.4 }} />
      <Handle type="source" position={Position.Left} id="card-out-rev" style={{ top: 30, opacity: 0.4 }} />
      <div className="text-sm font-semibold text-slate-800">{data.label}</div>
      <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2">
        {data.items.map((item) => {
          const active = data.activeItemIds?.has(item.id) ?? false
          const activeHandleStyle = { opacity: 1, width: 9, height: 9, background: '#d97706' }
          return (
            <div
              key={item.id}
              className={`relative rounded border px-2 py-1 text-[11px] text-slate-600 transition-colors ${active ? 'bg-amber-50 ring-2 ring-amber-400' : 'bg-slate-50'}`}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: item.color ?? '#cbd5e1',
                borderTopColor: active ? '#fbbf24' : '#e2e8f0',
                borderRightColor: active ? '#fbbf24' : '#e2e8f0',
                borderBottomColor: active ? '#fbbf24' : '#e2e8f0',
              }}
            >
              {item.kind === 'in' && (
                <>
                  {/* Twee handles op hetzelfde inputitem: links voor een
                      voorwaartse koppeling (bron ligt links, dus komt van
                      links binnen), rechts voor een terugkoppeling (bron ligt
                      rechts van dit kaartje in de keten) — welke van de twee
                      een edge daadwerkelijk gebruikt bepaalt
                      computeFocusChainLayout op basis van kolomrichting, niet
                      een vast links/rechts-schema. Zonder dit moest een
                      terugkoppeling altijd aan de kant "tegen de rijrichting
                      in" aankoppelen en dus dwars om de eigen kaart heen
                      lussen om er te komen. */}
                  <Handle type="target" position={Position.Left} id={`item-in:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                  <Handle type="target" position={Position.Right} id={`item-in-rev:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                </>
              )}
              <span className="block text-[8px] font-medium uppercase tracking-wide text-slate-400">{item.kind === 'in' ? 'in' : 'out'}</span>
              {item.label || '—'}
              {itemOriginCaption(item, t, language) && <span className="block text-[9px] text-slate-400">{itemOriginCaption(item, t, language)}</span>}
              {item.kind === 'out' && (
                <>
                  <Handle type="source" position={Position.Right} id={`item-out:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                  <Handle type="source" position={Position.Left} id={`item-out-rev:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                </>
              )}
            </div>
          )
        })}
        {data.items.length === 0 && <div className="text-[11px] italic text-slate-300">—</div>}
      </div>
    </div>
  )
}

// Elk item toont altijd waar het vandaan komt / naartoe gaat — niet alleen
// bij een team-koppeling (bestond al), maar ook wanneer het door een eigen
// applicatie/systeem gegenereerd wordt, of van een rol/persoon/stakeholder/
// omgeving komt, of naar een externe partij gaat. Zonder dit oogde het
// willekeurig welke kaartjes wél en welke geen herkomst toonden.
function itemOriginCaption(item, t, language) {
  const origin = item.origin
  if (!origin) return null
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
// meer dwars door een tussenliggende kaart — het probleem waarvoor eerdere
// versies van dit scherm eigen boog-edges (onderlangs, zijwaarts) nodig
// hadden. Zolang er nog geen ELK-resultaat is (eerste meting), of ELK faalde,
// valt de lijn terug op React Flow's eigen smoothstep-route tussen de
// handles — nooit "geen lijn". Streepjespatronen (terugkoppeling, wachtend
// verzoek) komen via `style` mee uit computeChainGraph.
function ElkEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }) {
  const path = data?.points
    ? roundedOrthPath(data.points)
    : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 })[0]
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}

const edgeTypes = { elk: ElkEdge }

// Ketengraaf: voorwaartse BFS vanaf één gekozen team (traceForwardChain,
// lib/teamWorkflow.js) bepaalt wélke teams meedoen — de enige weergave van
// het ketenoverzicht. De kolommen zelf en de lijnroutes komen daarna van ELK
// (zie ChainCanvas): kolom = laag in de DAG, waardoor twee gekoppelde teams
// nooit meer in dezelfde kolom belanden. Een koppeling terug naar een team
// eerder in de keten (incl. het focusteam zelf bij een cyclus) is een
// terugkoppeling (orderChain, lib/chainLayout.js): gestippeld en via de
// -rev-handles, zodat bron en doel naar elkaar toe wijzen. Elk team toont al
// zijn eigen input- én outputitems als één gestapelde lijst; alleen items die
// naar een óók zichtbare kaart koppelen krijgen een kleur + lijn — een item
// gekoppeld aan een team buiten deze weergave toont enkel een "van/naar
// {team}"-onderschrift, nooit een fantoom-lijn naar een niet-getoonde kaart.
//
// Levert nodes zónder positie en edges zónder lijnpunten: die vult de
// ELK-lay-out in ChainCanvas in. Zuivere functie.
function computeChainGraph(teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, focusTeamId, partyGraph) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const { columns, columnOf } = traceForwardChain(focusTeamId, filteredTeams, chainEdgesAll)
  if (columns.length === 0) return { nodes: [], edges: [] }
  const visibleTeamIds = new Set(columnOf.keys())
  const { layerOf, backEdgeIds } = orderChain(focusTeamId, visibleTeamIds, chainEdgesAll)

  const teamNaamById = Object.fromEntries(filteredTeams.map((team) => [team.id, naamVan(team)]))

  // Kleur + "van/naar"-onderschrift per item: een lijn (en dus kleur) ontstaat
  // alleen tussen twee kaarten die allebei zichtbaar zijn in deze
  // keten-weergave.
  const itemColor = new Map()
  const itemLinkedTeam = new Map()
  const edgesToRender = []
  let colorIndex = 0
  for (const edge of chainEdgesAll) {
    const sourceShown = visibleTeamIds.has(edge.sourceTeam)
    const targetShown = visibleTeamIds.has(edge.targetTeam)
    if (!sourceShown && !targetShown) continue
    if (sourceShown) itemLinkedTeam.set(edge.sourceOutputId, edge.targetTeam)
    if (targetShown) itemLinkedTeam.set(edge.targetInputId, edge.sourceTeam)
    if (!sourceShown || !targetShown) continue
    // Een koppeling van een team naar zichzelf is geen ketenstap en heeft in
    // een gelaagde tekening geen plek; de items tonen wel hun onderschrift.
    if (edge.sourceTeam === edge.targetTeam) continue
    const color = CONNECTION_COLORS[colorIndex % CONNECTION_COLORS.length]
    colorIndex += 1
    itemColor.set(edge.sourceOutputId, color)
    itemColor.set(edge.targetInputId, color)
    edgesToRender.push({ edge, color, back: backEdgeIds.has(edge.id) })
  }

  // Herkomst/bestemming van een item: eerst een daadwerkelijke team-koppeling
  // (itemLinkedTeam hierboven, de meest concrete info), dan een externe partij
  // (voor een ketenoverzicht het belangrijkste om te tonen — een item kan
  // zowel via een eigen applicatie lopen als uiteindelijk van een externe
  // partij komen, bv. klantgegevens via het eigen klantportaal maar
  // oorspronkelijk uit de BRP; de externe herkomst weegt dan zwaarder dan
  // welke eigen app het ophaalt), dan de eigen applicatie, dan het generieke
  // bron_type (rol, persoon, stakeholder, omgeving). Zo toont elk item altijd
  // waar het vandaan komt of naartoe gaat, niet alleen de items die toevallig
  // aan een andere (zichtbare of onzichtbare) team hangen.
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
  function buildItems(team) {
    const wf = teamWorkflows[team.id] ?? emptyTeamWorkflow()
    const appsById = new Map((wf.applications ?? []).map((a) => [a.id, a]))
    return [
      ...wf.inputs.map((input) => ({ id: input.id, label: input.label, kind: 'in', bronType: input.bron_type, applicatieId: input.applicatieId, externalTeam: input.externalTeam })),
      ...wf.outputs.map((output) => ({ id: output.id, label: output.label, kind: 'out', applicatieId: output.applicatieId, externalTeam: output.externalTeam })),
    ].map((item) => ({
      id: item.id,
      label: item.label,
      kind: item.kind,
      color: itemColor.get(item.id) ?? null,
      origin: resolveOrigin(item, appsById),
    }))
  }
  // Kaarten in ketenvolgorde (focusteam eerst): ELK gebruikt die invoer-
  // volgorde als tie-breaker (considerModelOrder), zodat dezelfde data ook
  // telkens dezelfde tekening oplevert. Geen positie: die komt van ELK.
  const nodes = columns.flat().map((team, index) => {
    const items = buildItems(team)
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    return {
      id: `focus-card:${team.id}`,
      type: 'focusCard',
      position: { x: 0, y: 0 },
      data: { teamId: team.id, label: naamVan(team), risk, count: risk.count ?? 0, items, isFocus: index === 0, layer: layerOf.get(team.id) ?? 0 },
    }
  })

  // Welke kant van het kaartje een koppeling gebruikt volgt de richting van
  // de lijn, niet een vast "input=links, output=rechts"-schema: bij een
  // voorwaartse koppeling ligt het doel rechts, dus verlaat de lijn de
  // bronkaart rechts en komt links de doelkaart binnen. Bij een
  // terugkoppeling ligt het doel juist links (een eerdere kolom), dus
  // gebruikt de bronkaart zijn linker-uitgang en de doelkaart zijn rechter-
  // ingang — beide kanten wijzen dan naar elkaar toe, in plaats van dat de
  // lijn eerst de verkeerde kant op moet en helemaal om de eigen kaart heen
  // moet lussen om alsnog terug te komen. Elk item heeft daarom altijd beide
  // handles (zie FocusChainCardNode) — hier wordt alleen gekozen welke van de
  // twee deze specifieke koppeling gebruikt.
  // Een verzoek om een nog niet bestaand tegenhanger-item (linkNieuw) heeft
  // aan één kant geen item-id: dan haakt de lijn aan op de kaart-handle
  // (card-in/card-out, zie FocusChainCardNode) i.p.v. een item-handle.
  const outHandle = (edge, rev) => (edge.sourceOutputId ? `item-out${rev ? '-rev' : ''}:${edge.sourceOutputId}` : `card-out${rev ? '-rev' : ''}`)
  const inHandle = (edge, rev) => (edge.targetInputId ? `item-in${rev ? '-rev' : ''}:${edge.targetInputId}` : `card-in${rev ? '-rev' : ''}`)
  const linkData = (edge) => ({
    link: {
      sourceTeamNaam: teamNaamById[edge.sourceTeam] ?? edge.sourceTeam,
      targetTeamNaam: teamNaamById[edge.targetTeam] ?? edge.targetTeam,
      sourceLabel: edge.sourceLabel,
      targetLabel: edge.targetLabel,
      status: edge.status,
      punten: edge.punten ?? [],
    },
  })
  const pendingStyle = (edge) => (edge.status === 'voorgesteld' ? PENDING_EDGE_STYLE : {})
  const edges = edgesToRender.map(({ edge, color, back }) => ({
    id: edge.id,
    source: `focus-card:${edge.sourceTeam}`,
    target: `focus-card:${edge.targetTeam}`,
    sourceHandle: outHandle(edge, back),
    targetHandle: inHandle(edge, back),
    type: 'elk',
    data: { back, ...linkData(edge) },
    style: { stroke: color, strokeWidth: 2, ...(back ? BACK_EDGE_STYLE : {}), ...pendingStyle(edge) },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
  }))

  // --- Externe partijen in de keten (zie buildExternalPartyGraph): bronnen
  // en afhankelijkheden vóór het team dat ze raken, pure ontvangers erna —
  // waar precies bepaalt ELK. Lijnen haken aan op het specifieke input-/
  // outputitem; afhankelijkheden (dependencies op een partij) hangen aan de
  // kaart zelf en worden per partij+team tot één lijn samengevoegd (voorheen
  // lagen drie identieke lijnen exact over elkaar; het detailvak toont toch
  // al alle refs van die ene lijn).
  if (partyGraph) {
    const { left, right } = partitionParties(partyGraph, visibleTeamIds)
    const layerOfTeam = (teamId) => layerOf.get(teamId) ?? 0
    const marker = { type: MarkerType.ArrowClosed, color: EXT_COLOR, width: 12, height: 12 }
    const extStyle = (dashed) => ({ stroke: EXT_COLOR, strokeWidth: 1.5, ...(dashed ? BACK_EDGE_STYLE : {}), opacity: 0.85 })
    for (const p of left) {
      nodes.push(partyNode(p, Math.min(...p.sourceTeams.map(layerOfTeam)) - 1))
      for (const teamId of p.sourceTeams) {
        const refs = p.sources.get(teamId)
        const depRefs = refs.filter((ref) => ref.kind === 'dependency')
        if (depRefs.length > 0) {
          edges.push({
            id: `ext:${p.key}->${teamId}:deps`,
            source: `party:${p.key}`,
            target: `focus-card:${teamId}`,
            sourceHandle: 'right-source',
            targetHandle: 'card-in',
            type: 'elk',
            style: extStyle(true),
            markerEnd: marker,
            data: externalEdgeData(p, teamNaamById[teamId] ?? teamId, 'in', depRefs),
          })
        }
        for (const ref of refs) {
          if (ref.kind === 'dependency') continue
          edges.push({
            id: `ext:${p.key}->${teamId}:${ref.id}`,
            source: `party:${p.key}`,
            target: `focus-card:${teamId}`,
            sourceHandle: 'right-source',
            targetHandle: `item-in:${ref.id}`,
            type: 'elk',
            style: extStyle(false),
            markerEnd: marker,
            data: externalEdgeData(p, teamNaamById[teamId] ?? teamId, 'in', [ref]),
          })
        }
      }
      // Output naar een partij die óók bron is (bv. een bankpartner: betaal-
      // instructies in, betaalbestand uit) loopt terug naar links en is dus
      // een terugkoppeling: linker item-uitgang naar de rechterkant van de
      // partij.
      for (const teamId of p.sinkTeams) {
        for (const ref of p.sinks.get(teamId)) {
          edges.push({
            id: `ext:${teamId}->${p.key}:${ref.id}`,
            source: `focus-card:${teamId}`,
            target: `party:${p.key}`,
            sourceHandle: `item-out-rev:${ref.id}`,
            targetHandle: 'right-target',
            type: 'elk',
            style: extStyle(false),
            markerEnd: marker,
            data: { back: true, ...externalEdgeData(p, teamNaamById[teamId] ?? teamId, 'out', [ref]) },
          })
        }
      }
    }
    for (const p of right) {
      nodes.push(partyNode(p, Math.max(...p.sinkTeams.map(layerOfTeam)) + 1))
      for (const teamId of p.sinkTeams) {
        for (const ref of p.sinks.get(teamId)) {
          edges.push({
            id: `ext:${teamId}->${p.key}:${ref.id}`,
            source: `focus-card:${teamId}`,
            target: `party:${p.key}`,
            sourceHandle: `item-out:${ref.id}`,
            targetHandle: 'left-target',
            type: 'elk',
            style: extStyle(false),
            markerEnd: marker,
            data: externalEdgeData(p, teamNaamById[teamId] ?? teamId, 'out', [ref]),
          })
        }
      }
    }
  }

  return { nodes, edges }
}

export default function ChainOverview({ adminSections, sidebarMode }) {
  const { teams, dependencies, teamWorkflows, teamLabels, externalParties } = useAppContext()
  const { t, language } = useLanguage()
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

  // Het ketenoverzicht kent nog maar één weergave: focus op één team, waarna
  // de keten voorwaarts uitrolt (kolom per ketenstap) — zie focusChainTrace/
  // traceForwardChain hieronder. De vroegere geaggregeerde "Ketenflow"-modus
  // (alle teams tegelijk, gelaagd) is verwijderd; leeg = nog geen eigen keuze
  // en dan valt de weergave terug op defaultFocusTeamId.
  const [focusTeamId, setFocusTeamId] = useState('')
  // Externe partijen (systemen, leveranciers, CAB, …) als kaartjes aan de rand
  // van de keten — standaard aan, uit te zetten voor een puur team-op-team
  // beeld. Klik op een partij licht al haar lijnen op en toont de details.
  const [showExternalParties, setShowExternalParties] = useState(true)
  const [selectedPartyKey, setSelectedPartyKey] = useState(null)

  // Eén keer berekend, hergebruikt door defaultFocusTeamId/focusChainTrace
  // hieronder en door computeFocusChainLayout (via useMergedLayout) — voorheen
  // liep resolveChainEdges twee keer per render.
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

  // Voorwaartse BFS vanaf het focusteam (traceForwardChain, lib/teamWorkflow.js):
  // kolom = ketenstap.
  const focusChainTrace = useMemo(() => {
    if (!focusActive) return null
    return traceForwardChain(activeFocusTeamId, filteredTeams, chainEdgesAll)
  }, [focusActive, activeFocusTeamId, filteredTeams, chainEdgesAll])

  const visibleTeams = useMemo(() => focusChainTrace?.columns.flat() ?? [], [focusChainTrace])

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
  // lay-outfuncties filteren zelf op de zichtbare teams (zie partitionParties).
  const partyGraph = useMemo(
    () => buildExternalPartyGraph(teamWorkflows, dependencies, externalParties, teams, teamLabels),
    [teamWorkflows, dependencies, externalParties, teams, teamLabels],
  )
  const selectedParty = useMemo(
    () => (selectedPartyKey && showExternalParties ? (partyGraph.find((p) => p.key === selectedPartyKey) ?? null) : null),
    [selectedPartyKey, showExternalParties, partyGraph],
  )

  // Structuur van de tekening (welke kaarten, welke lijnen, aan welke
  // handles) — bewust zonder selectie-/hover-toestand, want elke wijziging
  // hierin laat ChainCanvas een nieuwe ELK-lay-out berekenen. Handmatig
  // slepen bestaat in dit scherm niet meer: de lay-out is volledig berekend,
  // slepen zou daar alleen maar mee vechten (nodesDraggable staat uit).
  const graph = useMemo(
    () => computeChainGraph(teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, activeFocusTeamId, showExternalParties ? partyGraph : null),
    [teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, activeFocusTeamId, showExternalParties, partyGraph],
  )
  const { nodes, edges } = graph

  // Klik pint een lijn vast (blijft staan terwijl je rondkijkt/scrollt) — dit
  // vervangt een eerdere zwevende hover-tooltip volledig (die bleek buggy en
  // stond de leesbaarheid in de weg). Hover geeft nu alleen nog lichte
  // visuele feedback ín de lijn zelf (lichtjes oplichten, de rest kort dimmen)
  // zonder los infoveld; het klik-paneel hieronder blijft de plek voor detail.
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null)

  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId])

  // Selectie wint van hover: een vastgezette lijn moet niet weer wegzakken
  // omdat de muis toevallig over een andere lijn beweegt.
  const activeEdgeId = selectedEdgeId ?? hoveredEdgeId

  // Een geselecteerde externe partij licht ál haar lijnen tegelijk op (i.p.v.
  // één lijn), zodat in één oogopslag te zien is welke teams eraan hangen.
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const selected = e.id === selectedEdgeId
        if (!activeEdgeId && !selectedPartyKey) return { ...e, selected }
        const active = e.id === activeEdgeId || (selectedPartyKey && e.data?.partyKey === selectedPartyKey)
        return {
          ...e,
          selected,
          animated: active && Boolean(selectedEdgeId || selectedPartyKey),
          style: { ...e.style, strokeWidth: active ? 3.5 : 1.5, opacity: active ? 1 : 0.15 },
        }
      }),
    [edges, activeEdgeId, selectedEdgeId, selectedPartyKey],
  )

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

  // Focusmodus: welke twee item-handles hoort de geselecteerde lijn bij —
  // die kaartjes lichten op zodat meteen duidelijk is van welk output- naar
  // welk inputkaartje de lijn precies loopt, ook als hij onder een paar
  // andere kaarten door loopt.
  const activeItemIds = useMemo(() => {
    if (!focusActive || !selectedEdgeId) return null
    const edge = edges.find((e) => e.id === selectedEdgeId)
    if (!edge) return null
    const ids = [edge.sourceHandle, edge.targetHandle]
      .filter(Boolean)
      .map((handle) => handle.replace(/^item-(in|out)(-rev)?:/, ''))
    return new Set(ids)
  }, [focusActive, selectedEdgeId, edges])

  // Selectie-toestand pas hier op de nodes gezet (en niet in computeChainGraph)
  // zodat een klik op een partij of lijn de structuur — en dus de ELK-lay-out
  // — ongemoeid laat.
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type === 'externalParty') return selectedPartyKey ? { ...n, data: { ...n.data, selected: n.data.key === selectedPartyKey } } : n
        if (n.type === 'focusCard' && activeItemIds) return { ...n, data: { ...n.data, activeItemIds } }
        return n
      }),
    [nodes, activeItemIds, selectedPartyKey],
  )

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

  const teamFilterActive = deselectedTeamIds.size > 0
  const riskFilterActive = selectedRiskLevels.length < RISK_LEVELS.length
  const anyFilterActive = teamFilterActive || riskFilterActive

  // Het team-focusmenu leeft op het canvas zelf (als zwevend paneel, zie
  // <Panel> hieronder) i.p.v. in een aparte balk erboven — alleen bij een
  // lege staat (geen canvas om op te zweven) valt dit terug op een gewone,
  // gecentreerde plek in de melding, zodat je ook dan van focusteam kan
  // wisselen. Geen lege optie: er is altijd één team in beeld (zie
  // activeFocusTeamId).
  const focusPicker = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
      <label htmlFor="chain-focus" className="text-xs font-medium text-[#2a5f8a]">
        {t('chain.focusLabel')}
      </label>
      <select
        id="chain-focus"
        value={activeFocusTeamId}
        onChange={(e) => setFocusTeamId(e.target.value)}
        className="max-w-[200px] truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
      >
        {filteredTeams.map((tm) => (
          <option key={tm.id} value={tm.id}>
            {teamLabels[tm.id] ?? tm.naam}
          </option>
        ))}
      </select>
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
          {t('chain.statHighestRisk')}:
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${riskStyle(focusStats.risk.level).badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${riskStyle(focusStats.risk.level).dot}`} />
            {translateRiskLevel(focusStats.risk.level, language)}
          </span>
        </span>
      )}
    </div>
  )

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
                onChange={(e) => {
                  setShowExternalParties(e.target.checked)
                  if (!e.target.checked) setSelectedPartyKey(null)
                }}
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
                onNodeClick={(_, node) => {
                  if (node.type === 'externalParty') {
                    setSelectedEdgeId(null)
                    setSelectedPartyKey((prev) => (prev === node.data.key ? null : node.data.key))
                    return
                  }
                  // Klik op een ketenkaart verlegt de focus naar dat team, en
                  // de keten rolt vanaf daar opnieuw voorwaarts uit.
                  if (node.type === 'focusCard') setFocusTeamId(node.data.teamId)
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedPartyKey(null)
                  setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id))
                }}
                onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
                onEdgeMouseLeave={() => setHoveredEdgeId(null)}
                onPaneClick={() => {
                  setSelectedEdgeId(null)
                  setSelectedPartyKey(null)
                }}
              >
                <Panel position="top-left">{focusPicker}</Panel>
                {focusStatsBlock && <Panel position="top-right">{focusStatsBlock}</Panel>}
              </ChainCanvas>
            </div>
          </ReactFlowProvider>
        )}

        {(selectedParty || selectedEdge?.data) && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-4 py-2.5">
            <div className="min-w-0 flex-1 text-xs">
              {selectedParty ? (
                // Geselecteerde externe partij: alles wat er in de zichtbare
                // keten aan hangt, per team.
                <>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
                    {t('chain.externalSelectedTitle')} · {selectedParty.naam}
                  </div>
                  <div className="space-y-1">
                    {selectedPartyRows.map((row) => (
                      <div key={row.key} className="text-slate-700">
                        <span className="font-medium">{teamLabels[row.teamId] ?? row.teamId}</span>
                        <span className="text-slate-400"> · {refKindLabel(row.kind)}: </span>
                        {row.label || '—'}
                      </div>
                    ))}
                  </div>
                </>
              ) : selectedEdge.data.external ? (
                <>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
                    {selectedEdge.data.direction === 'in'
                      ? `${selectedEdge.data.partyNaam} → ${selectedEdge.data.teamNaam}`
                      : `${selectedEdge.data.teamNaam} → ${selectedEdge.data.partyNaam}`}
                  </div>
                  <div className="space-y-1">
                    {selectedEdge.data.refs.map((ref) => (
                      <div key={`${ref.kind}:${ref.id}`} className="text-slate-700">
                        <span className="text-slate-400">{refKindLabel(ref.kind)}: </span>
                        {ref.label || '—'}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // Ketenkoppeling(en): geaggregeerd (overview) of één lijn
                // (focusmodus) — elk met status en de opsomming die op de
                // teampagina bij de betrokken items is vastgelegd.
                (() => {
                  const links = selectedEdge.data.links ?? (selectedEdge.data.link ? [selectedEdge.data.link] : [])
                  const first = links[0] ?? {}
                  const sourceNaam = selectedEdge.data.sourceTeamNaam ?? first.sourceTeamNaam ?? ''
                  const targetNaam = selectedEdge.data.targetTeamNaam ?? first.targetTeamNaam ?? ''
                  return (
                    <>
                      <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
                        {sourceNaam} → {targetNaam} ·{' '}
                        {links.length === 1 ? t('chain.edgeSelectedCountOne') : t('chain.edgeSelectedCount', { count: links.length })}
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
                                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                  {t('chain.edgePending')}
                                </span>
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
                })()
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedEdgeId(null)
                setSelectedPartyKey(null)
              }}
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
