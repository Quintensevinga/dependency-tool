import { useEffect, useMemo, useState } from 'react'
import { Handle, Position, ReactFlowProvider, useReactFlow } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { translateRiskLevel } from '../i18n/labels'
import { resolveChainEdges } from '../lib/teamWorkflow'
import { emptyTeamWorkflow } from '../lib/storage'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useMergedLayout } from './flow/useMergedLayout'
import TeamFilterPanel from './TeamFilterPanel'
import ScopeToggle from './ScopeToggle'

const COLUMN_WIDTH = 480
const INPUT_X = 0
const OUTPUT_X = 220
const HEADER_Y = 20
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
  return (
    // Gedimd i.p.v. verborgen bij een actief risicofilter: een team wegfilteren
    // zou de keten zelf doorknippen, terwijl dat team er nog steeds in zit.
    <div
      className="w-52 rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md transition-opacity"
      style={{ borderColor: data.count > 0 ? style.hex : '#cbd5e1', opacity: data.dimmed ? 0.4 : 1 }}
      title={data.dimmed ? t('chain.dimmedByRiskFilter') : undefined}
    >
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

// Past het canvas opnieuw in beeld zodra de getoonde teamselectie wijzigt.
// ReactFlow's fitView-prop werkt alleen bij de eerste render; zonder dit bleef
// na het aanzetten van de focusmodus de uitgezoomde transform van het volledige
// overzicht staan, waardoor de drie overgebleven kolommen buiten beeld vielen.
function ChainAutoFit({ fitKey }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    // Korte vertraging in plaats van een enkele rAF: de nieuwe nodes worden pas
    // in een volgende commit door React Flow zelf ingelezen. Direct fitten zou
    // nog de oude (volledige) bounds meten en dus niets zichtbaar veranderen.
    const id = window.setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 60)
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

const nodeTypes = { chainHeader: TeamHeaderNode, chainIo: ChainIoNode, lane: LaneNode }

function computeChainLayout(visibleTeams, teamWorkflows, teamRisk) {
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
      data: { label: team.naam, risk, count: risk.count ?? 0, empty, dimmed: risk.dimmed ?? false },
      draggable: true,
    })

    workflow.inputs.forEach((input, i) => {
      nodes.push({
        id: `chain-input:${team.id}:${input.id}`,
        type: 'chainIo',
        position: { x: columnX + INPUT_X, y: IO_Y_START + i * IO_Y_GAP },
        data: { kind: 'input', label: input.label },
        draggable: true,
      })
    })

    workflow.outputs.forEach((output, i) => {
      nodes.push({
        id: `chain-output:${team.id}:${output.id}`,
        type: 'chainIo',
        position: { x: columnX + OUTPUT_X, y: IO_Y_START + i * IO_Y_GAP },
        data: { kind: 'output', label: output.label },
        draggable: true,
      })
    })
  })

  const teamIdSet = new Set(visibleTeams.map((team) => team.id))
  const filteredWorkflows = Object.fromEntries(visibleTeams.map((team) => [team.id, teamWorkflows[team.id] ?? emptyTeamWorkflow()]))
  const chainEdges = resolveChainEdges(filteredWorkflows)
  chainEdges.forEach((edge) => {
    if (!teamIdSet.has(edge.sourceTeam) || !teamIdSet.has(edge.targetTeam)) return
    edges.push({
      id: edge.id,
      source: `chain-output:${edge.sourceTeam}:${edge.sourceOutputId}`,
      target: `chain-input:${edge.targetTeam}:${edge.targetInputId}`,
      style: { stroke: '#2a5f8a', strokeWidth: 2 },
      animated: true,
    })
  })

  const canvasWidth = Math.max(visibleTeams.length * COLUMN_WIDTH + 260, 600)

  return { nodes, edges, canvasWidth, canvasHeight }
}

export default function ChainOverview() {
  const { teams, dependencies, teamWorkflows } = useAppContext()
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

  // Focusmodus: bij veel teams wordt de swimlane-rij zo breed dat de fit
  // tegen de zoom-ondergrens aanloopt en de helft buiten beeld valt. Focus op
  // één team toont alleen dat team plus zijn directe ketenpartners, in de
  // volgorde inkomend → focus → uitgaand, zodat de richting af te lezen is aan
  // de positie. Standaard uit, dan blijft het volledige overzicht zoals het was.
  const [focusTeamId, setFocusTeamId] = useState('')

  const visibleTeams = useMemo(() => {
    if (!focusTeamId) return filteredTeams
    const focus = teams.find((tm) => tm.id === focusTeamId)
    if (!focus) return filteredTeams
    const edges = resolveChainEdges(teamWorkflows)
    const incoming = new Set(edges.filter((e) => e.targetTeam === focusTeamId).map((e) => e.sourceTeam))
    const outgoing = new Set(edges.filter((e) => e.sourceTeam === focusTeamId).map((e) => e.targetTeam))
    incoming.delete(focusTeamId)
    outgoing.delete(focusTeamId)
    // Een partner die zowel levert als afneemt hoort maar één kolom te krijgen;
    // die houden we aan de inkomende kant, links van het focusteam.
    for (const id of incoming) outgoing.delete(id)
    const byId = (id) => teams.find((tm) => tm.id === id)
    return [
      ...[...incoming].map(byId).filter(Boolean),
      focus,
      ...[...outgoing].map(byId).filter(Boolean),
    ]
  }, [focusTeamId, filteredTeams, teams, teamWorkflows])

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

  const [{ nodes, edges }, onNodesChange] = useMergedLayout(computeChainLayout, [
    visibleTeams,
    teamWorkflows,
    teamRisk,
  ])

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

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
          {/* truncate + title: de hint is toelichting, de bediening rechts moet
              altijd volledig zichtbaar blijven — zonder dit werd de tekst tot
              één woord per regel geperst. */}
          <span className="min-w-0 truncate" title={focusTeamId ? t('chain.focusHint') : t('chain.hint')}>
            {focusTeamId ? t('chain.focusHint') : t('chain.hint')}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="chain-focus" className="text-xs font-medium text-slate-600">
              {t('chain.focusLabel')}
            </label>
            <select
              id="chain-focus"
              value={focusTeamId}
              onChange={(e) => setFocusTeamId(e.target.value)}
              // max-w: een select schaalt standaard mee met zijn langste optie,
              // en één lange teamnaam duwde daarmee de scope-knoppen buiten de balk.
              className="max-w-[168px] truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">{t('chain.focusAllTeams')}</option>
              {filteredTeams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.naam}
                </option>
              ))}
            </select>
            <ScopeToggle scope={scope} onChange={setScope} />
          </div>
        </div>
        {visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            {t('chain.noTeams')}
          </div>
        ) : (
          <ReactFlowProvider>
            <ChainZoomToolbar />
            <ChainAutoFit fitKey={nodes.length} />
            <div
              className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ height: 'max(560px, calc(100vh - 280px))' }}
            >
              <PannableFlowCanvas nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} />
            </div>
          </ReactFlowProvider>
        )}
      </div>

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
    </div>
  )
}
