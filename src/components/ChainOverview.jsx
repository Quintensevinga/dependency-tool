import { useMemo, useState } from 'react'
import { Handle, Position } from 'reactflow'
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

const COLUMN_WIDTH = 420
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
    <div className="w-52 rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md" style={{ borderColor: data.count > 0 ? style.hex : '#cbd5e1' }}>
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
      data: { label: team.naam, risk, count: risk.count ?? 0, empty },
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

  const selectedTeamIds = useMemo(() => teams.filter((tm) => !deselectedTeamIds.has(tm.id)).map((tm) => tm.id), [teams, deselectedTeamIds])
  const visibleTeams = useMemo(() => teams.filter((tm) => selectedTeamIds.includes(tm.id)), [teams, selectedTeamIds])

  const teamRisk = useMemo(() => {
    const result = {}
    for (const team of visibleTeams) {
      const deps = dependencies.filter((d) => d.teamId === team.id && selectedRiskLevels.includes(calculateRisk(d).level))
      result[team.id] = { ...highestRisk(deps), count: deps.length }
    }
    return result
  }, [visibleTeams, dependencies, selectedRiskLevels])

  const [{ nodes, edges, canvasWidth, canvasHeight }, onNodesChange] = useMergedLayout(computeChainLayout, [
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
        <div className="mb-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">{t('chain.hint')}</div>
        {visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            {t('chain.noTeams')}
          </div>
        ) : (
          <div className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm" style={{ height: Math.min(canvasHeight, 640) }}>
            <PannableFlowCanvas nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} />
          </div>
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
