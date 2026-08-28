import { useEffect, useMemo, useState } from 'react'
import { BaseEdge, Handle, MarkerType, Position, ReactFlowProvider, useReactFlow } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { calculateRisk, riskLevelRank } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { translateRiskLevel } from '../i18n/labels'
import { resolveChainEdges, orderTeamsByChain, aggregateChainLinks, resolveConnectedTeamIds } from '../lib/teamWorkflow'
import { emptyTeamWorkflow } from '../lib/storage'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useMergedLayout } from './flow/useMergedLayout'
import TeamFilterPanel from './TeamFilterPanel'
import ScopeToggle from './ScopeToggle'
import FloatingTooltip from './FloatingTooltip'

const COLUMN_WIDTH = 480
const INPUT_X = 0
const OUTPUT_X = 220
const HEADER_Y = 20
const GROUP_LABEL_Y = HEADER_Y - 38
const IO_Y_START = 90
const IO_Y_GAP = 68

function highestRisk(deps) {
  let best = { level: 'Laag', score: 0 }
  for (const d of deps) {
    const r = calculateRisk(d)
    if (r.score > best.score) best = r
  }
  return best
}

function TeamHeaderNode({ data }) {
  const { t, language } = useLanguage()
  const style = riskStyle(data.risk.level)
  const dimmed = data.dimmed || data.groupKind === 'context'
  return (
    // Gedimd i.p.v. verborgen bij een actief risicofilter of "Toon context":
    // een team wegfilteren zou de keten zelf doorknippen, terwijl dat team er
    // nog steeds in zit — of, bij context, bewust even op de achtergrond staat.
    <div
      className="relative w-52 cursor-pointer rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md transition-opacity hover:shadow-lg"
      style={{ borderColor: data.count > 0 ? style.hex : '#cbd5e1', opacity: dimmed ? 0.4 : 1 }}
      title={data.dimmed ? t('chain.dimmedByRiskFilter') : t('chain.clickToFocusHint')}
    >
      {/* Zes met een expliciete id onderscheiden handles: nodig zodra een node
          meerdere handles van hetzelfde type heeft (reactflow-vereiste). Altijd
          aanwezig, ook in focusmodus — die zet nooit sourceHandle/targetHandle
          op zijn edges en blijft dus het eerst-gedeclareerde paar (right-source/
          left-target) gebruiken. Alleen de geaggregeerde overview-edges (zie
          computeChainOverviewLayout) kiezen bewust welke handle-id ze gebruiken,
          afhankelijk van naburige vs. overgeslagen kolommen. */}
      <Handle type="source" position={Position.Right} id="right-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ opacity: 0.4 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Right} id="right-target" style={{ opacity: 0.4 }} />
      <Handle type="source" position={Position.Top} id="top-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Top} id="top-target" style={{ opacity: 0.4 }} />
      <div className="text-sm font-semibold text-slate-800">{data.label}</div>
      {data.count > 0 ? (
        <div className={`mt-1 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {translateRiskLevel(data.risk.level, language)} · {data.count}
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-400">{t('graph.noDeps')}</div>
      )}
      {data.empty && <div className="mt-1 text-[11px] italic text-slate-400">{t('chain.emptyTeam')}</div>}
    </div>
  )
}

// Klein, decoratief label boven een kolomgroep in Focusmodus (Inkomend /
// Geselecteerd team / Uitgaand / Overige teams) — puur een tekstnode, geen
// interactie, zodat de richting van de keten in één oogopslag leesbaar is.
function ChainGroupLabelNode({ data }) {
  return <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{data.label}</div>
}

// Decoratieve swimlane-achtergrond per teamkolom — een gewone ReactFlow-node
// (geen los gepositioneerde div) zodat hij meepant/zoomt met de rest van het
// canvas i.p.v. los te raken van de andere nodes.
function LaneNode({ data }) {
  return (
    <div
      className="pointer-events-none rounded-lg"
      style={{
        width: COLUMN_WIDTH - 40,
        height: data.height,
        backgroundColor: data.index % 2 === 0 ? 'rgba(100,116,139,0.05)' : 'rgba(100,116,139,0.09)',
      }}
    />
  )
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

function ChainIoNode({ data }) {
  return (
    <div className="relative w-48 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {data.kind === 'input' ? '→ in' : 'out →'}
      </div>
      <div className="text-xs font-medium text-slate-700">{data.label || '—'}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0.4 }} />
    </div>
  )
}

const nodeTypes = { chainHeader: TeamHeaderNode, chainIo: ChainIoNode, lane: LaneNode, chainGroupLabel: ChainGroupLabelNode }

// Aangepaste edge voor "overgeslagen kolommen" in de overview-modus: reactflow's
// ingebouwde bezier-curvatuur biedt géén boog wanneer bron en doel op dezelfde
// hoogte staan (de curvatuurformule voor Position.Top gaat uit van een doel dat
// hoger ligt dan de bron — bij twee teamkaarten in dezelfde rij levert dat een
// volkomen platte lijn op, exact ter hoogte van de bovenkant van elke
// tussenliggende kolom, ontdekt tijdens browserverificatie). Deze edge tekent
// daarom zelf een eenvoudige kwadratische boog met een apex die meeschaalt met
// de overspanning, zodat de lijn altijd duidelijk boven de tussenliggende
// teamkaarten uit komt.
function ChainSkipEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius }) {
  const midX = (sourceX + targetX) / 2
  const span = Math.abs(targetX - sourceX)
  const apex = Math.min(Math.max(span * 0.35, 50), 160)
  const topY = Math.min(sourceY, targetY) - apex
  const path = `M ${sourceX},${sourceY} Q ${midX},${topY} ${targetX},${targetY}`
  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={midX}
      labelY={topY + apex * 0.3}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  )
}

const chainEdgeTypes = { chainSkip: ChainSkipEdge }

function computeChainLayout(visibleTeams, teamWorkflows, teamRisk, teamLabels = {}, groupInfo = null, chainEdgesAll = []) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const nodes = []
  const edges = []

  // Vooraf berekend (i.p.v. pas na de node-loop) zodat de swimlane-achtergrond
  // precies zo hoog is als de content — een te hoge lane-node zou fitView's
  // begrenzing opblazen en de eigenlijke kaartjes piepklein maken.
  const maxIoCount = Math.max(
    1,
    ...visibleTeams.map((team) => {
      const wf = teamWorkflows[team.id] ?? emptyTeamWorkflow()
      return Math.max(wf.inputs.length, wf.outputs.length)
    }),
  )
  const canvasHeight = Math.max(420, IO_Y_START + maxIoCount * IO_Y_GAP + 60)

  // Kolomindex per team (vast, want visibleTeams' volgorde ligt al vast) en een
  // omgekeerde opzoektabel van output naar de kolomindices van de teams die 'm via
  // een input gebruiken — hiermee kunnen IN/OUT-kaartjes zó gesorteerd worden dat
  // een lijn naar/van een naburige kolom recht(er) loopt i.p.v. zigzaggend, zie de
  // sortering vlak vóór de input/output-node-loops hieronder.
  const teamColumnIndex = new Map(visibleTeams.map((team, ti) => [team.id, ti]))
  const outputTargetColumns = new Map()
  for (const edge of chainEdgesAll) {
    const key = `${edge.sourceTeam}:${edge.sourceOutputId}`
    const targetColumn = teamColumnIndex.get(edge.targetTeam)
    if (targetColumn === undefined) continue
    if (!outputTargetColumns.has(key)) outputTargetColumns.set(key, [])
    outputTargetColumns.get(key).push(targetColumn)
  }

  // Focusmodus: label boven de eerste kolom van elke groep (Inkomend/
  // Geselecteerd team/Uitgaand/Overige teams) zodra die groep niet leeg is.
  if (groupInfo) {
    let seen = new Set()
    visibleTeams.forEach((team, ti) => {
      const kind = groupInfo.kindById.get(team.id)
      if (!kind || seen.has(kind)) return
      seen.add(kind)
      nodes.push({
        id: `group-label:${kind}`,
        type: 'chainGroupLabel',
        position: { x: ti * COLUMN_WIDTH, y: GROUP_LABEL_Y },
        data: { label: groupInfo.labelByKind[kind] },
        draggable: false,
        selectable: false,
        focusable: false,
      })
    })
  }

  visibleTeams.forEach((team, ti) => {
    const columnX = ti * COLUMN_WIDTH
    nodes.push({
      id: `lane:${team.id}`,
      type: 'lane',
      position: { x: columnX - 20, y: 0 },
      data: { index: ti, height: canvasHeight },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    })
    const workflow = teamWorkflows[team.id] ?? emptyTeamWorkflow()
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    const empty = workflow.inputs.length === 0 && workflow.outputs.length === 0

    nodes.push({
      id: `team-header:${team.id}`,
      type: 'chainHeader',
      position: { x: columnX, y: HEADER_Y },
      data: {
        teamId: team.id,
        label: naamVan(team),
        risk,
        count: risk.count ?? 0,
        empty,
        dimmed: risk.dimmed ?? false,
        groupKind: groupInfo?.kindById.get(team.id) ?? null,
      },
      draggable: true,
    })

    // Inputs sorteren op de kolomindex van hun gekoppelde team (ongekoppelde
    // achteraan, stabiel) — outputs op het gemiddelde van de kolomindices van de
    // teams die ze via een input gebruiken. Maakt de lijn naar/van een gekoppeld
    // kaartje rechter i.p.v. dat de kaartjes toevallig in de opslagvolgorde staan.
    const sortedInputs = [...workflow.inputs].sort((a, b) => {
      const colA = a.linkedTeam ? (teamColumnIndex.get(a.linkedTeam) ?? Infinity) : Infinity
      const colB = b.linkedTeam ? (teamColumnIndex.get(b.linkedTeam) ?? Infinity) : Infinity
      return colA - colB
    })
    const sortedOutputs = [...workflow.outputs].sort((a, b) => {
      const colsA = outputTargetColumns.get(`${team.id}:${a.id}`)
      const colsB = outputTargetColumns.get(`${team.id}:${b.id}`)
      const avgA = colsA ? colsA.reduce((x, y) => x + y, 0) / colsA.length : Infinity
      const avgB = colsB ? colsB.reduce((x, y) => x + y, 0) / colsB.length : Infinity
      return avgA - avgB
    })

    sortedInputs.forEach((input, i) => {
      nodes.push({
        id: `chain-input:${team.id}:${input.id}`,
        type: 'chainIo',
        position: { x: columnX + INPUT_X, y: IO_Y_START + i * IO_Y_GAP },
        data: { kind: 'input', label: input.label },
        draggable: true,
      })
    })

    sortedOutputs.forEach((output, i) => {
      nodes.push({
        id: `chain-output:${team.id}:${output.id}`,
        type: 'chainIo',
        position: { x: columnX + OUTPUT_X, y: IO_Y_START + i * IO_Y_GAP },
        data: { kind: 'output', label: output.label },
        draggable: true,
      })
    })
  })

  // chainEdgesAll wordt één keer bovenin de component berekend (zie
  // chainEdgesAll-useMemo) en hier hergebruikt — resolveChainEdges filtert
  // zelf al niets weg op zichtbaarheid, dat gebeurt hieronder via teamIdSet,
  // dus rekenen op de volledige set en pas daarna filteren geeft exact
  // hetzelfde resultaat als eerst filteren en dan berekenen.
  const teamIdSet = new Set(visibleTeams.map((team) => team.id))
  const chainEdges = chainEdgesAll
  const teamNaamById = Object.fromEntries(visibleTeams.map((team) => [team.id, naamVan(team)]))
  chainEdges.forEach((edge) => {
    if (!teamIdSet.has(edge.sourceTeam) || !teamIdSet.has(edge.targetTeam)) return
    edges.push({
      id: edge.id,
      source: `chain-output:${edge.sourceTeam}:${edge.sourceOutputId}`,
      target: `chain-input:${edge.targetTeam}:${edge.targetInputId}`,
      style: { stroke: '#2a5f8a', strokeWidth: 2 },
      animated: true,
      // Zonder deze data was een ketenlijn alleen een streep: je kon nergens
      // aflezen wélke output aan wélke input hangt zonder beide kaartjes te
      // zoeken. Hover en klik gebruiken dit (zie ChainOverview).
      data: {
        sourceTeamNaam: teamNaamById[edge.sourceTeam] ?? edge.sourceTeam,
        sourceLabel: edge.sourceLabel,
        targetTeamNaam: teamNaamById[edge.targetTeam] ?? edge.targetTeam,
        targetLabel: edge.targetLabel,
      },
    })
  })

  const canvasWidth = Math.max(visibleTeams.length * COLUMN_WIDTH + 260, 600)

  // smoothstep i.p.v. de standaard bezier-lijn: minder kriskras bij meerdere
  // teams met overlappende in/output-koppelingen.
  const routedEdges = edges.map((e) => ({ type: 'smoothstep', ...e }))

  return { nodes, edges: routedEdges, canvasWidth, canvasHeight }
}

const OV_COLUMN_WIDTH = 300
const OV_ROW_Y = 120
const OV_ROW_HEIGHT = 90
const OV_TRAY_GAP = 70
const OV_TRAY_LABEL_Y = OV_ROW_Y + OV_ROW_HEIGHT + OV_TRAY_GAP - 30
const OV_TRAY_Y = OV_ROW_Y + OV_ROW_HEIGHT + OV_TRAY_GAP

// Geaggregeerde ketenstroom-lay-out voor de overview-modus (niet gefocust op
// één team): één kaart per team i.p.v. één kaart per los IN/OUT-item, en één
// pijl per teampaar i.p.v. één lijn per itempaar. Lost het "lijnen lopen door
// niet-gerelateerde tussenkolommen heen"-probleem structureel op — er zijn
// per definitie nooit meer pijlen dan teamparen. Focusmodus blijft de losse
// computeChainLayout hierboven gebruiken, ongewijzigd.
// _groupInfo blijft ongebruikt maar staat wél op de 5e positie: useMergedLayout
// geeft dezelfde deps-array door aan welke van de twee lay-outfuncties er ook
// actief is (zie de useMergedLayout-aanroep in ChainOverview) — de array moet
// bij elke render dezelfde lengte houden (React waarschuwt anders: "changed
// size between renders"), dus computeChainLayout en computeChainOverviewLayout
// delen exact dezelfde argumentvolgorde, ook al gebruikt deze functie
// groupInfo niet.
function computeChainOverviewLayout(visibleTeams, teamWorkflows, teamRisk, teamLabels = {}, _groupInfo, chainEdgesAll = [], connectedTeamIds = new Set(), noConnectionLabel = '') {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const nodes = []

  const connectedVisible = visibleTeams.filter((team) => connectedTeamIds.has(team.id))
  const isolatedVisible = visibleTeams.filter((team) => !connectedTeamIds.has(team.id))
  const rowColumnIndex = new Map(connectedVisible.map((team, i) => [team.id, i]))

  function pushTeamHeader(team, columnX, y) {
    const workflow = teamWorkflows[team.id] ?? emptyTeamWorkflow()
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    const empty = workflow.inputs.length === 0 && workflow.outputs.length === 0
    nodes.push({
      id: `team-header-ov:${team.id}`,
      type: 'chainHeader',
      position: { x: columnX, y },
      data: { teamId: team.id, label: naamVan(team), risk, count: risk.count ?? 0, empty, dimmed: risk.dimmed ?? false, groupKind: null },
      draggable: true,
    })
  }

  connectedVisible.forEach((team, ti) => pushTeamHeader(team, ti * OV_COLUMN_WIDTH, OV_ROW_Y))

  if (isolatedVisible.length > 0) {
    nodes.push({
      id: 'group-label:no-connection',
      type: 'chainGroupLabel',
      position: { x: 0, y: OV_TRAY_LABEL_Y },
      data: { label: noConnectionLabel },
      draggable: false,
      selectable: false,
      focusable: false,
    })
    isolatedVisible.forEach((team, ti) => pushTeamHeader(team, ti * OV_COLUMN_WIDTH, OV_TRAY_Y))
  }

  // Aggregatie per teampaar (i.p.v. per los itempaar) — dikte/kleur/label
  // worden hieronder afgeleid, geen custom edge-component nodig.
  const teamIdSet = new Set(visibleTeams.map((team) => team.id))
  const teamNaamById = Object.fromEntries(visibleTeams.map((team) => [team.id, naamVan(team)]))
  const groups = aggregateChainLinks(chainEdgesAll).filter((g) => teamIdSet.has(g.sourceTeam) && teamIdSet.has(g.targetTeam))

  const edges = groups.map((g) => {
    const colA = rowColumnIndex.get(g.sourceTeam)
    const colB = rowColumnIndex.get(g.targetTeam)
    const dist = colB - colA
    let sourceHandle
    let targetHandle
    let type
    if (Math.abs(dist) === 1) {
      // Naburige kolommen: korte rechtstreekse lijn, zelfde visuele taal als
      // de huidige item-niveau lijnen.
      sourceHandle = dist === 1 ? 'right-source' : 'left-source'
      targetHandle = dist === 1 ? 'left-target' : 'right-target'
      type = 'smoothstep'
    } else {
      // Eén of meer kolommen overgeslagen: via de bovenkant, zodat de
      // bezier-curve óver de tussenliggende, niet-gerelateerde teamkolommen
      // heen boogt i.p.v. er dwars doorheen te lopen — de kern van deze fix.
      sourceHandle = 'top-source'
      targetHandle = 'top-target'
      type = 'chainSkip'
    }

    // Er bestaat geen risicoscore per ketenkoppeling (dependencies hangen aan
    // een teamId, niet aan een specifieke partner) — zie CLAUDE.md
    // ("risicoscores zijn altijd uitlegbaar, nooit een black box"). De kleur
    // toont daarom bewust een benadering: het hoogste van de twee gekoppelde
    // teams' eigen, al bestaande risiconiveau (dezelfde badge als op de
    // teamkaart) — geen nieuwe, verzonnen metriek per lijn.
    const riskA = teamRisk[g.sourceTeam]?.level ?? 'Laag'
    const riskB = teamRisk[g.targetTeam]?.level ?? 'Laag'
    const level = riskLevelRank(riskA) >= riskLevelRank(riskB) ? riskA : riskB
    const style = riskStyle(level)
    const count = g.links.length

    return {
      id: g.id,
      source: `team-header-ov:${g.sourceTeam}`,
      target: `team-header-ov:${g.targetTeam}`,
      sourceHandle,
      targetHandle,
      type,
      style: { stroke: style.hex, strokeWidth: Math.min(2 + count * 1.5, 8) },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.hex, width: 16, height: 16 },
      label: count > 1 ? String(count) : undefined,
      labelStyle: { fill: style.hex, fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: 'white' },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 6,
      data: {
        sourceTeamNaam: teamNaamById[g.sourceTeam] ?? g.sourceTeam,
        targetTeamNaam: teamNaamById[g.targetTeam] ?? g.targetTeam,
        links: g.links.map((l) => ({ sourceLabel: l.sourceLabel, targetLabel: l.targetLabel })),
      },
    }
  })

  return { nodes, edges }
}

export default function ChainOverview({ adminSections, sidebarMode }) {
  const { teams, dependencies, teamWorkflows, teamLabels } = useAppContext()
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

  // Focusmodus: bij veel teams wordt de swimlane-rij zo breed dat de fit
  // tegen de zoom-ondergrens aanloopt en de helft buiten beeld valt. Focus op
  // één team toont alleen dat team plus zijn directe ketenpartners, in de
  // volgorde inkomend → focus → uitgaand, zodat de richting af te lezen is aan
  // de positie. "chainMode" is losgekoppeld van focusTeamId: zo onthoudt de
  // tool welk team je koos toen je terugschakelde naar Ketenflow.
  const [chainMode, setChainMode] = useState('overview')
  const [focusTeamId, setFocusTeamId] = useState('')
  // Verbergen is de standaard (rust); deze knop laat de rest van de teams
  // alsnog zien, sterk gedimd, voor wie de bredere context wil terugzien.
  const [showContext, setShowContext] = useState(false)

  const focusActive = chainMode === 'focus' && Boolean(focusTeamId)

  // Eén keer berekend, hergebruikt door zowel chainPartners hieronder als
  // computeChainLayout (via useMergedLayout) — voorheen liep resolveChainEdges
  // twee keer per render.
  const chainEdgesAll = useMemo(() => resolveChainEdges(teamWorkflows), [teamWorkflows])

  const chainPartners = useMemo(() => {
    if (!focusActive) return null
    const focus = teams.find((tm) => tm.id === focusTeamId)
    if (!focus) return null
    const edges = chainEdgesAll
    const incoming = new Set(edges.filter((e) => e.targetTeam === focusTeamId).map((e) => e.sourceTeam))
    const outgoing = new Set(edges.filter((e) => e.sourceTeam === focusTeamId).map((e) => e.targetTeam))
    incoming.delete(focusTeamId)
    outgoing.delete(focusTeamId)
    // Een partner die zowel levert als afneemt hoort maar één kolom te krijgen;
    // die houden we aan de inkomende kant, links van het focusteam.
    for (const id of incoming) outgoing.delete(id)
    return { focus, incoming, outgoing, incomingCount: edges.filter((e) => e.targetTeam === focusTeamId).length, outgoingCount: edges.filter((e) => e.sourceTeam === focusTeamId).length }
  }, [focusActive, focusTeamId, teams, chainEdgesAll])

  const visibleTeams = useMemo(() => {
    // Overzichtsmodus: kolomvolgorde op ketenlogica i.p.v. de toevallige
    // teams-volgorde uit de context — zie orderTeamsByChain in lib/teamWorkflow.js.
    // Focusmodus (hieronder) heeft al een eigen, gerichte inkomend/uitgaand-
    // groepering en blijft ongewijzigd.
    if (!chainPartners) return orderTeamsByChain(filteredTeams, chainEdgesAll)
    const { focus, incoming, outgoing } = chainPartners
    const byId = (id) => teams.find((tm) => tm.id === id)
    const core = [...[...incoming].map(byId).filter(Boolean), focus, ...[...outgoing].map(byId).filter(Boolean)]
    if (!showContext) return core
    const directIds = new Set(core.map((tm) => tm.id))
    const context = filteredTeams.filter((tm) => !directIds.has(tm.id))
    return [...core, ...context]
  }, [chainPartners, filteredTeams, teams, showContext, chainEdgesAll])

  // groupKind per zichtbaar team — drijft zowel de dim-styling van de
  // teamkaart als de "Inkomend/Geselecteerd team/Uitgaand/Overige teams"-
  // labels boven de kolommen.
  const groupInfo = useMemo(() => {
    if (!chainPartners) return null
    const kindById = new Map()
    for (const id of chainPartners.incoming) kindById.set(id, 'incoming')
    kindById.set(chainPartners.focus.id, 'focus')
    for (const id of chainPartners.outgoing) kindById.set(id, 'outgoing')
    for (const tm of visibleTeams) if (!kindById.has(tm.id)) kindById.set(tm.id, 'context')
    return {
      kindById,
      labelByKind: {
        incoming: t('chain.groupIncoming'),
        focus: t('chain.groupFocus'),
        outgoing: t('chain.groupOutgoing'),
        context: t('chain.groupContext'),
      },
    }
  }, [chainPartners, visibleTeams, t])

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
  // dependencies, ongeacht het huidige risicofilter.
  const focusStats = useMemo(() => {
    if (!chainPartners) return null
    const inScope = dependencies.filter((d) => d.teamId === focusTeamId && (scope === 'alle' || d.scope === scope))
    return {
      incoming: chainPartners.incomingCount,
      outgoing: chainPartners.outgoingCount,
      total: chainPartners.incomingCount + chainPartners.outgoingCount,
      risk: inScope.length > 0 ? highestRisk(inScope) : null,
    }
  }, [chainPartners, dependencies, focusTeamId, scope])

  // Alleen relevant in overview-modus (focusmodus heeft nooit een team zonder
  // ketenkoppeling in beeld, die groepering gebeurt daar al anders).
  const connectedTeamIds = useMemo(() => resolveConnectedTeamIds(visibleTeams, chainEdgesAll), [visibleTeams, chainEdgesAll])

  // Eén vaste deps-vorm voor beide lay-outfuncties (zie de toelichting bij
  // computeChainOverviewLayout's _groupInfo-parameter): useEffect/useMergedLayout
  // vereist een deps-array met een stabiele lengte over renders heen, ook al
  // wisselt welke van de twee functies er daadwerkelijk gebruikt wordt.
  const [{ nodes, edges }, onNodesChange] = useMergedLayout(focusActive ? computeChainLayout : computeChainOverviewLayout, [
    visibleTeams,
    teamWorkflows,
    teamRisk,
    teamLabels,
    groupInfo,
    chainEdgesAll,
    connectedTeamIds,
    t('chain.groupNoConnection'),
  ])

  // Hover toont de koppeling vluchtig, klik pint 'm vast — zodat je een lijn
  // kunt vasthouden terwijl je in het canvas rondkijkt of scrollt.
  const [hoverEdge, setHoverEdge] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)

  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId])

  // Een vastgepinde lijn licht op, de rest zakt weg. Zonder die demping is een
  // enkele keten niet te volgen zodra er tientallen lijnen door elkaar lopen.
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!selectedEdgeId) return e
        const active = e.id === selectedEdgeId
        return {
          ...e,
          animated: active,
          style: { ...e.style, strokeWidth: active ? 3.5 : 1.5, opacity: active ? 1 : 0.15 },
        }
      }),
    [edges, selectedEdgeId],
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

  function focusOnTeam(teamId) {
    setChainMode('focus')
    setFocusTeamId(teamId)
  }

  function clearFocus() {
    setChainMode('overview')
    setFocusTeamId('')
  }

  const teamFilterActive = deselectedTeamIds.size > 0
  const riskFilterActive = selectedRiskLevels.length < RISK_LEVELS.length
  const anyFilterActive = teamFilterActive || riskFilterActive

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs" role="group" aria-label={t('chain.modeLabel')}>
              <button
                type="button"
                onClick={() => setChainMode('overview')}
                aria-pressed={chainMode === 'overview'}
                className={`rounded px-2.5 py-1.5 font-medium transition-colors ${
                  chainMode === 'overview' ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('chain.modeOverview')}
              </button>
              <button
                type="button"
                onClick={() => setChainMode('focus')}
                aria-pressed={chainMode === 'focus'}
                className={`rounded px-2.5 py-1.5 font-medium transition-colors ${
                  chainMode === 'focus' ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('chain.modeFocus')}
              </button>
            </div>
            {anyFilterActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                {t('filter.active')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden text-xs text-slate-400 sm:inline"
              title={focusActive ? t('chain.edgeHint') : t('chain.overviewLegend')}
            >
              {focusActive ? t('chain.edgeHint') : t('chain.overviewLegend')}
            </span>
            <ScopeToggle scope={scope} onChange={setScope} />
          </div>
        </div>

        {chainMode === 'focus' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              {focusTeamId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2a5f8a]/10 px-3 py-1 text-xs font-medium text-[#2a5f8a]">
                  {t('chain.focusPillLabel', { team: teamLabels[focusTeamId] ?? teams.find((tm) => tm.id === focusTeamId)?.naam ?? '—' })}
                </span>
              ) : (
                <span className="text-xs text-slate-400">{t('chain.focusChoosePrompt')}</span>
              )}
              <select
                id="chain-focus"
                value={focusTeamId}
                onChange={(e) => setFocusTeamId(e.target.value)}
                className="max-w-[168px] truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="">{t('chain.focusPlaceholder')}</option>
                {filteredTeams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {teamLabels[tm.id] ?? tm.naam}
                  </option>
                ))}
              </select>
              {focusTeamId && (
                <button type="button" onClick={clearFocus} className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
                  {t('chain.focusClear')}
                </button>
              )}
              {focusTeamId && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={showContext}
                    onChange={(e) => setShowContext(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
                  />
                  {t('chain.showContext')}
                </label>
              )}
            </div>
            {focusStats && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
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
            )}
          </div>
        )}

        {focusActive && chainPartners && chainPartners.incoming.size === 0 && chainPartners.outgoing.size === 0 && !showContext ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
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
            <ChainAutoFit fitKey={`${nodes.length}:${chainMode}:${focusTeamId}:${sidebarMode}`} />
            <div
              className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ height: 'max(560px, calc(100vh - 280px))' }}
            >
              <PannableFlowCanvas
                nodes={nodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={chainEdgeTypes}
                onNodesChange={onNodesChange}
                onNodeClick={(_, node) => {
                  if (node.type === 'chainHeader') focusOnTeam(node.data.teamId)
                }}
                onEdgeClick={(_, edge) => setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id))}
                onEdgeMouseEnter={(event, edge) => setHoverEdge({ x: event.clientX, y: event.clientY, data: edge.data })}
                onEdgeMouseMove={(event) => setHoverEdge((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                onEdgeMouseLeave={() => setHoverEdge(null)}
                onPaneClick={() => setSelectedEdgeId(null)}
              />
              {hoverEdge?.data && (
                <FloatingTooltip x={hoverEdge.x} y={hoverEdge.y}>
                  {Array.isArray(hoverEdge.data.links) ? (
                    <>
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {hoverEdge.data.links.length === 1
                          ? t('chain.edgeTooltipCountOne')
                          : t('chain.edgeTooltipCount', { count: hoverEdge.data.links.length })}
                      </div>
                      {hoverEdge.data.links.slice(0, 6).map((link, i) => (
                        <div key={i} className="text-slate-300">
                          <span className="text-slate-50">{link.sourceLabel || '—'}</span> → {link.targetLabel || '—'}
                        </div>
                      ))}
                      {hoverEdge.data.links.length > 6 && (
                        <div className="mt-1 text-slate-400">{t('chain.edgeTooltipMore', { count: hoverEdge.data.links.length - 6 })}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {t('chain.edgeTooltipTitle')}
                      </div>
                      <div className="text-slate-300">
                        <span className="text-slate-50">{hoverEdge.data.sourceTeamNaam}</span> · {hoverEdge.data.sourceLabel || '—'}
                      </div>
                      <div className="text-slate-400">↓</div>
                      <div className="text-slate-300">
                        <span className="text-slate-50">{hoverEdge.data.targetTeamNaam}</span> · {hoverEdge.data.targetLabel || '—'}
                      </div>
                    </>
                  )}
                </FloatingTooltip>
              )}
            </div>
          </ReactFlowProvider>
        )}

        {selectedEdge?.data && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-4 py-2.5">
            <div className="min-w-0 flex-1 text-xs">
              {Array.isArray(selectedEdge.data.links) ? (
                <>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
                    {selectedEdge.data.sourceTeamNaam} → {selectedEdge.data.targetTeamNaam} ·{' '}
                    {selectedEdge.data.links.length === 1
                      ? t('chain.edgeSelectedCountOne')
                      : t('chain.edgeSelectedCount', { count: selectedEdge.data.links.length })}
                  </div>
                  <div className="space-y-1">
                    {selectedEdge.data.links.map((link, i) => (
                      <div key={i} className="text-slate-700">
                        <span className="text-slate-400">{t('chain.edgeOutput')}: </span>
                        {link.sourceLabel || '—'}
                        <span className="text-slate-400"> · {t('chain.edgeInput')}: </span>
                        {link.targetLabel || '—'}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">{t('chain.edgeSelectedTitle')}</div>
                  <div className="text-slate-700">
                    <span className="font-medium">{selectedEdge.data.sourceTeamNaam}</span>
                    <span className="text-slate-400"> · {t('chain.edgeOutput')}: </span>
                    {selectedEdge.data.sourceLabel || '—'}
                  </div>
                  <div className="text-slate-700">
                    <span className="font-medium">{selectedEdge.data.targetTeamNaam}</span>
                    <span className="text-slate-400"> · {t('chain.edgeInput')}: </span>
                    {selectedEdge.data.targetLabel || '—'}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedEdgeId(null)}
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
