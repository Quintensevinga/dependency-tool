import { useCallback, useEffect, useMemo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { WORKFLOW_STAGES, BRON_TYPES, SENIORITY_LEVELS, RISICO_BIJ_UITVAL } from '../data/constants'
import {
  translateWorkflowStage,
  translateCategorie,
  translateRiskLevel,
  translateBronType,
  translateSeniority,
  translateRisicoBijUitval,
} from '../i18n/labels'
import { stageColor, bronTypeColor, ANNOTATION_PALETTE } from '../lib/workflowStyles'
import { calculateRisk, compareRiskDesc } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { generateId, emptyTeamWorkflow } from '../lib/storage'
import { CategoryIcon } from '../data/categoryIcons'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useMergedLayout } from './flow/useMergedLayout'
import DependencyForm from './DependencyForm'
import DependencyDetail from './DependencyDetail'
import ApplicatieflowTab from './ApplicatieflowTab'
import SpotlightTour from './SpotlightTour'

const TOUR_SEEN_KEY = 'dependency-insight:team-tour-seen'

const STAGE_GAP = 190
const STAGE_START_X = 260
const STAGE_Y = 260
const IO_Y_START = 40
const IO_Y_GAP = 90

const NEW_ROLE_SENTINEL = '__new_role__'

function ColorSwatchRow({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {ANNOTATION_PALETTE.map((swatch) => (
        <button
          key={swatch.value}
          type="button"
          onClick={() => onChange(swatch.value)}
          className="h-4 w-4 shrink-0 rounded-full border"
          style={{
            backgroundColor: swatch.value,
            borderColor: value === swatch.value ? '#1e293b' : 'rgba(0,0,0,0.15)',
            borderWidth: value === swatch.value ? 2 : 1,
          }}
        />
      ))}
    </div>
  )
}

function StageNode({ data }) {
  const { language } = useLanguage()
  return (
    <div className="relative w-40 rounded-xl border-2 bg-white px-3 py-2.5 shadow-md" style={{ borderColor: data.color }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <div className="mb-1 h-1.5 -mt-2.5 -mx-3 rounded-t-lg" style={{ backgroundColor: data.color }} />
      <div className="text-xs font-semibold text-slate-800">{translateWorkflowStage(data.stage, language)}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0.4 }} />
    </div>
  )
}

function IoNode({ data }) {
  return (
    <div
      className="relative w-44 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 shadow-sm"
      style={data.bronColor ? { borderLeftColor: data.bronColor, borderLeftWidth: 4 } : undefined}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {data.kind === 'input' ? '→ in' : 'out →'}
      </div>
      <div className="text-xs font-medium text-slate-700">{data.label || '—'}</div>
      {data.linkLabel && <div className="mt-0.5 truncate text-[10px] text-slate-400">{data.linkLabel}</div>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0.4 }} />
    </div>
  )
}

function CapacityBadgeNode({ data }) {
  const { language } = useLanguage()
  return (
    <div className="relative flex w-40 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 shadow-sm">
      <Handle type="target" position={Position.Top} style={{ opacity: 0.3 }} />
      {data.risico && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a3b2e]" title={data.risicoToelichting} />}
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{data.functieNaam || '—'}</span>
      <span className="shrink-0 text-[10px] text-slate-400">{translateSeniority(data.seniority, language)}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0.3 }} />
    </div>
  )
}

function DependencyMarkerNode({ data }) {
  const { language } = useLanguage()
  const style = riskStyle(data.risk.level)
  return (
    <div
      className="relative flex w-40 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm"
      style={{ borderColor: style.hex, backgroundColor: `${style.hex}14` }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0.3 }} />
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{data.titel}</span>
      <span className="shrink-0 text-[10px] text-slate-400">{translateRiskLevel(data.risk.level, language)}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0.3 }} />
    </div>
  )
}

function AnnotationNode({ data }) {
  const shapeClass =
    data.shape === 'circle' ? 'rounded-full' : data.shape === 'diamond' ? 'rounded-md rotate-45' : 'rounded-md'

  return (
    <div className="group relative w-40">
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <button
        type="button"
        onClick={data.onRemove}
        className="absolute -right-2 -top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] text-slate-500 shadow-sm group-hover:flex"
      >
        ✕
      </button>
      {data.kind === 'symbol' ? (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-sm"
          style={{ backgroundColor: `${data.color}33`, border: `2px solid ${data.color}` }}
        >
          {data.symbol}
        </div>
      ) : data.kind === 'shape' ? (
        <div
          className={`flex h-20 w-20 items-center justify-center border-2 px-1 text-center text-[11px] text-slate-700 shadow-sm ${shapeClass}`}
          style={{ borderColor: data.color, backgroundColor: `${data.color}1a` }}
        >
          <span className={data.shape === 'diamond' ? '-rotate-45' : ''}>{data.text}</span>
        </div>
      ) : (
        <div
          className="min-h-20 w-40 rounded-sm px-2.5 py-2 text-xs text-slate-800 shadow-sm"
          style={{ backgroundColor: `${data.color}33`, border: `1px solid ${data.color}` }}
        >
          <textarea
            value={data.text}
            onChange={(e) => data.onText(e.target.value)}
            rows={3}
            placeholder="…"
            className="w-full resize-none bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      )}
      <div className="mt-1">
        <ColorSwatchRow value={data.color} onChange={data.onColor} />
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0.4 }} />
    </div>
  )
}

const nodeTypes = {
  stage: StageNode,
  ioItem: IoNode,
  annotation: AnnotationNode,
  capacityBadge: CapacityBadgeNode,
  dependencyMarker: DependencyMarkerNode,
}

function computeWorkflowLayout(
  inputs,
  outputs,
  resolveLinkLabel,
  savedLayout,
  annotations,
  annotationEdges,
  annotationHandlers,
  capacity,
  teamDependencies,
  functieName,
) {
  const nodes = []
  const edges = []

  function withSavedPosition(id, defaultPosition) {
    return savedLayout?.[id] ?? defaultPosition
  }

  const capacityByStage = {}
  for (const row of capacity) {
    if (!row.fase) continue
    if (!capacityByStage[row.fase]) capacityByStage[row.fase] = []
    capacityByStage[row.fase].push(row)
  }
  const depsByStage = {}
  for (const dep of teamDependencies) {
    if (!dep.workflow_fase) continue
    if (!depsByStage[dep.workflow_fase]) depsByStage[dep.workflow_fase] = []
    depsByStage[dep.workflow_fase].push(dep)
  }
  const maxStackPerStage = Math.max(
    0,
    ...WORKFLOW_STAGES.map((s) => (capacityByStage[s]?.length ?? 0) + (depsByStage[s]?.length ?? 0)),
  )

  inputs.forEach((item, i) => {
    const id = `input:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: 20, y: IO_Y_START + i * IO_Y_GAP }),
      data: { kind: 'input', label: item.label, linkLabel: resolveLinkLabel(item), bronColor: bronTypeColor(item.bron_type) },
      draggable: true,
    })
    edges.push({
      id: `input:${item.id}->stage:${WORKFLOW_STAGES[0]}`,
      source: `input:${item.id}`,
      target: `stage:${WORKFLOW_STAGES[0]}`,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })
  })

  WORKFLOW_STAGES.forEach((stage, i) => {
    const id = `stage:${stage}`
    nodes.push({
      id,
      type: 'stage',
      position: withSavedPosition(id, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y }),
      data: { stage, color: stageColor(stage) },
      draggable: true,
    })
    if (i > 0) {
      edges.push({
        id: `stage:${WORKFLOW_STAGES[i - 1]}->stage:${stage}`,
        source: `stage:${WORKFLOW_STAGES[i - 1]}`,
        target: `stage:${stage}`,
        style: { stroke: '#64748b', strokeWidth: 2 },
      })
    }

    const stageCapacity = capacityByStage[stage] ?? []
    stageCapacity.forEach((row, ci) => {
      const bid = `capacity:${row.id}`
      nodes.push({
        id: bid,
        type: 'capacityBadge',
        position: withSavedPosition(bid, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y + 80 + ci * 38 }),
        data: {
          functieNaam: functieName(row.functieId),
          seniority: row.seniority,
          risico: row.risico_bij_uitval === 'ja',
          risicoToelichting: row.risico_toelichting,
        },
        draggable: true,
      })
      edges.push({
        id: `stage:${stage}->${bid}`,
        source: `stage:${stage}`,
        target: bid,
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' },
      })
    })

    const stageDeps = depsByStage[stage] ?? []
    stageDeps.forEach((dep, di) => {
      const mid = `dependency:${dep.id}`
      nodes.push({
        id: mid,
        type: 'dependencyMarker',
        position: withSavedPosition(mid, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y + 80 + (stageCapacity.length + di) * 38 }),
        data: { titel: dep.titel, risk: calculateRisk(dep), dependency: dep },
        draggable: true,
      })
      edges.push({
        id: `stage:${stage}->${mid}`,
        source: `stage:${stage}`,
        target: mid,
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' },
      })
    })
  })

  const lastStage = WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1]
  outputs.forEach((item, i) => {
    const id = `output:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, {
        x: STAGE_START_X + (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 220,
        y: IO_Y_START + i * IO_Y_GAP,
      }),
      data: { kind: 'output', label: item.label },
      draggable: true,
    })
    edges.push({
      id: `stage:${lastStage}->output:${item.id}`,
      source: `stage:${lastStage}`,
      target: `output:${item.id}`,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })
  })

  annotations.forEach((item, i) => {
    const id = `annotation:${item.id}`
    nodes.push({
      id,
      type: 'annotation',
      position: withSavedPosition(id, {
        x: 40 + (i % 6) * 190,
        y: Math.max(STAGE_Y + 100 + maxStackPerStage * 38, canvasHeightFor(inputs, outputs) + 40) + Math.floor(i / 6) * 190,
      }),
      data: {
        kind: item.kind,
        shape: item.shape,
        symbol: item.symbol,
        text: item.text,
        color: item.color,
        onText: (text) => annotationHandlers.onText(item.id, text),
        onColor: (color) => annotationHandlers.onColor(item.id, color),
        onRemove: () => annotationHandlers.onRemove(item.id),
      },
      draggable: true,
    })
  })

  annotationEdges.forEach((edge) => {
    edges.push({
      id: `annotation-edge:${edge.id}`,
      source: edge.source,
      target: edge.target,
      style: { stroke: edge.color, strokeWidth: 2.5 },
    })
  })

  const annotationRows = Math.ceil(annotations.length / 6)
  const annotationBaseY = Math.max(STAGE_Y + 100 + maxStackPerStage * 38, canvasHeightFor(inputs, outputs) + 40)
  const canvasWidth = STAGE_START_X + (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 460
  const canvasHeight = Math.max(420, annotationBaseY + annotationRows * 190 + 100)

  return { nodes, edges, canvasWidth, canvasHeight }
}

function canvasHeightFor(inputs, outputs) {
  return IO_Y_START + Math.max(inputs.length, outputs.length) * IO_Y_GAP
}

function IoListEditor({ title, items, onAdd, onUpdate, onRemove, showLink, showBron, teams, currentTeamId, teamWorkflows, teamName, t, language }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {t('teampage.ioAdd')}
        </button>
      </div>
      {items.length === 0 && <p className="text-xs text-slate-400">{t('teampage.ioEmpty')}</p>}
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-2.5">
            <div className="flex items-start gap-2">
              <input
                value={item.label}
                onChange={(e) => onUpdate(item.id, { label: e.target.value })}
                placeholder={t('teampage.ioLabelPlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="shrink-0 rounded-md border border-[#9a3b2e]/30 px-2 py-1.5 text-xs text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
              >
                {t('teampage.remove')}
              </button>
            </div>
            {showBron && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="shrink-0 text-[11px] text-slate-400">{t('teampage.ioBronLabel')}</span>
                <select
                  value={item.bron_type ?? ''}
                  onChange={(e) => onUpdate(item.id, { bron_type: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                >
                  <option value="">{t('teampage.ioBronNone')}</option>
                  {BRON_TYPES.map((bron) => (
                    <option key={bron} value={bron}>
                      {translateBronType(bron, language)}
                    </option>
                  ))}
                </select>
                {item.bron_type && (
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bronTypeColor(item.bron_type) }} />
                )}
              </div>
            )}
            {showLink && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="shrink-0 text-[11px] text-slate-400">{t('teampage.ioLinkLabel')}</span>
                <select
                  value={item.linkedTeam ?? ''}
                  onChange={(e) => onUpdate(item.id, { linkedTeam: e.target.value, linkedOutputId: '' })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                >
                  <option value="">{t('teampage.ioLinkNone')}</option>
                  {teams
                    .filter((tm) => tm.id !== currentTeamId)
                    .map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.naam}
                      </option>
                    ))}
                </select>
                {item.linkedTeam && (
                  <select
                    value={item.linkedOutputId ?? ''}
                    onChange={(e) => onUpdate(item.id, { linkedOutputId: e.target.value })}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                  >
                    <option value="">{t('teampage.ioLinkItemPlaceholder')}</option>
                    {(teamWorkflows[item.linkedTeam]?.outputs ?? []).map((out) => (
                      <option key={out.id} value={out.id}>
                        {out.label || '—'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeamPage({ teamId, onBack }) {
  const {
    teams,
    dependencies,
    teamWorkflows,
    updateTeamWorkflow,
    addDependency,
    updateDependency,
    deleteDependency,
    teamName,
    activeFuncties,
    addFunctie,
    teamSnapshots,
    saveSnapshot,
    renameSnapshot,
    restoreSnapshot,
    deleteSnapshot,
  } = useAppContext()
  const { t, language } = useLanguage()
  const teamNaam = teamName(teamId)
  const functieName = useCallback((id) => activeFuncties.find((f) => f.id === id)?.naam ?? '', [activeFuncties])
  const [selectedDependency, setSelectedDependency] = useState(null)
  const [formState, setFormState] = useState(null)
  const [activeColor, setActiveColor] = useState(ANNOTATION_PALETTE[1].value)
  const [lineToolActive, setLineToolActive] = useState(false)
  const [lineStart, setLineStart] = useState(null)
  const [addingRoleForRow, setAddingRoleForRow] = useState(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const [activeTeamTab, setActiveTeamTab] = useState('workflow')
  const [tourActive, setTourActive] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(TOUR_SEEN_KEY)) {
      startTour()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startTour() {
    // Alle stappen behalve de laatste wijzen naar elementen binnen het
    // Workflow-tabblad — forceer dat tabblad zodat de rondleiding altijd
    // meteen iets te tonen heeft, ongeacht waar de gebruiker 'm start.
    setActiveTeamTab('workflow')
    setTourActive(true)
  }

  function handleTourClose() {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
    setTourActive(false)
  }

  const tourSteps = [
    { target: 'workflow-canvas', title: t('tour.step.canvas.title'), body: t('tour.step.canvas.body') },
    { target: 'toolbar', title: t('tour.step.toolbar.title'), body: t('tour.step.toolbar.body') },
    { target: 'applications', title: t('tour.step.applications.title'), body: t('tour.step.applications.body') },
    { target: 'capacity', title: t('tour.step.capacity.title'), body: t('tour.step.capacity.body') },
    { target: 'dependencies', title: t('tour.step.dependencies.title'), body: t('tour.step.dependencies.body') },
    { target: 'tab-applicatieflow', title: t('tour.step.applicatieflow.title'), body: t('tour.step.applicatieflow.body') },
    { target: 'snapshots-button', title: t('tour.step.snapshots.title'), body: t('tour.step.snapshots.body') },
  ]

  const workflow = teamWorkflows[teamId] ?? emptyTeamWorkflow()

  function patch(partial) {
    updateTeamWorkflow(teamId, { ...workflow, ...partial })
  }

  const resolveLinkLabel = useCallback(
    (input) => {
      if (!input.linkedTeam || !input.linkedOutputId) return null
      const linkedOutput = (teamWorkflows[input.linkedTeam]?.outputs ?? []).find((o) => o.id === input.linkedOutputId)
      return linkedOutput ? `${teamName(input.linkedTeam)} → ${linkedOutput.label || '—'}` : null
    },
    [teamWorkflows, teamName],
  )

  const annotationHandlers = useMemo(
    () => ({
      onText: (id, text) => {
        updateTeamWorkflow(teamId, { ...workflow, annotations: workflow.annotations.map((a) => (a.id === id ? { ...a, text } : a)) })
      },
      onColor: (id, color) => {
        updateTeamWorkflow(teamId, { ...workflow, annotations: workflow.annotations.map((a) => (a.id === id ? { ...a, color } : a)) })
      },
      onRemove: (id) => {
        updateTeamWorkflow(teamId, { ...workflow, annotations: workflow.annotations.filter((a) => a.id !== id) })
      },
    }),
    [teamId, workflow, updateTeamWorkflow],
  )

  const teamDependencies = useMemo(
    () => dependencies.filter((d) => d.teamId === teamId).sort(compareRiskDesc),
    [dependencies, teamId],
  )

  const [{ nodes, edges, canvasWidth, canvasHeight }, onNodesChange] = useMergedLayout(computeWorkflowLayout, [
    workflow.inputs,
    workflow.outputs,
    resolveLinkLabel,
    workflow.layout,
    workflow.annotations,
    workflow.annotationEdges,
    annotationHandlers,
    workflow.capacity,
    teamDependencies,
    functieName,
  ])

  function handleNodesChange(changes) {
    onNodesChange(changes)
    const finished = changes.filter((c) => c.type === 'position' && c.position && c.dragging === false)
    if (finished.length > 0) {
      const nextLayout = { ...workflow.layout }
      for (const c of finished) nextLayout[c.id] = c.position
      patch({ layout: nextLayout })
    }
  }

  function addAnnotation(kind, extra = {}) {
    patch({
      annotations: [...workflow.annotations, { id: generateId(), kind, text: '', color: activeColor, position: null, ...extra }],
    })
  }

  function handleNodeClick(_, node) {
    if (!lineToolActive) {
      if (node.type === 'dependencyMarker') setSelectedDependency(node.data.dependency)
      return
    }
    if (!lineStart) {
      setLineStart(node.id)
      return
    }
    if (lineStart === node.id) {
      setLineStart(null)
      return
    }
    patch({
      annotationEdges: [...workflow.annotationEdges, { id: generateId(), source: lineStart, target: node.id, color: activeColor }],
    })
    setLineStart(null)
    setLineToolActive(false)
  }

  function addCapacityRow() {
    patch({
      capacity: [
        ...workflow.capacity,
        { id: generateId(), functieId: '', seniority: '', risico_bij_uitval: '', risico_toelichting: '', aantal: 1, fase: '' },
      ],
    })
  }
  function updateCapacityRow(id, fields) {
    patch({ capacity: workflow.capacity.map((c) => (c.id === id ? { ...c, ...fields } : c)) })
  }
  function removeCapacityRow(id) {
    patch({ capacity: workflow.capacity.filter((c) => c.id !== id) })
  }

  function handleRoleChange(rowId, value) {
    if (value === NEW_ROLE_SENTINEL) {
      setAddingRoleForRow(rowId)
      return
    }
    updateCapacityRow(rowId, { functieId: value })
  }

  function confirmNewRole(rowId) {
    const name = newRoleName.trim()
    if (!name) return
    const id = addFunctie(name)
    if (id) updateCapacityRow(rowId, { functieId: id })
    setNewRoleName('')
    setAddingRoleForRow(null)
  }

  function addApplication() {
    patch({ applications: [...workflow.applications, { id: generateId(), naam: '' }] })
  }
  function updateApplication(id, fields) {
    patch({ applications: workflow.applications.map((a) => (a.id === id ? { ...a, ...fields } : a)) })
  }
  function removeApplication(id) {
    patch({ applications: workflow.applications.filter((a) => a.id !== id) })
  }

  function addInput() {
    patch({ inputs: [...workflow.inputs, { id: generateId(), label: '', linkedTeam: '', linkedOutputId: '' }] })
  }
  function updateInput(id, fields) {
    patch({ inputs: workflow.inputs.map((i) => (i.id === id ? { ...i, ...fields } : i)) })
  }
  function removeInput(id) {
    patch({ inputs: workflow.inputs.filter((i) => i.id !== id) })
  }

  function addOutput() {
    patch({ outputs: [...workflow.outputs, { id: generateId(), label: '' }] })
  }
  function updateOutput(id, fields) {
    patch({ outputs: workflow.outputs.map((o) => (o.id === id ? { ...o, ...fields } : o)) })
  }
  function removeOutput(id) {
    patch({ outputs: workflow.outputs.filter((o) => o.id !== id) })
  }

  function handleSaveDependency(payload) {
    if (formState?.editing) {
      updateDependency(formState.editing.id, payload)
    } else {
      addDependency(payload)
    }
    setFormState(null)
  }

  function handleDeleteDependency(dep) {
    if (window.confirm(t('detail.confirmDelete', { titel: dep.titel }))) {
      deleteDependency(dep.id)
      setSelectedDependency(null)
    }
  }

  function handleClearWorkflow() {
    if (window.confirm(t('teampage.clearConfirm', { team: teamNaam }))) {
      updateTeamWorkflow(teamId, emptyTeamWorkflow())
    }
  }

  const snapshots = [...(teamSnapshots[teamId] ?? [])].reverse()

  function handleSaveSnapshot() {
    saveSnapshot(teamId)
  }

  function handleLoadSnapshot(snapshot) {
    if (window.confirm(t('teampage.snapshotsLoadConfirm', { naam: snapshot.naam, team: teamNaam }))) {
      restoreSnapshot(teamId, snapshot.id)
      setSnapshotsOpen(false)
    }
  }

  function formatSnapshotTimestamp(iso) {
    return new Date(iso).toLocaleString(language === 'nl' ? 'nl-NL' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm font-medium text-[#2a5f8a] hover:underline">
          {t('teampage.back')}
        </button>
        <h2 className="text-lg font-semibold text-slate-900">{teamNaam}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startTour}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t('tour.replay')}
          </button>
          <div className="relative">
            <button
              type="button"
              data-tour="snapshots-button"
              onClick={() => setSnapshotsOpen((v) => !v)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('teampage.snapshots')} ({snapshots.length})
            </button>
            {snapshotsOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">{t('teampage.snapshots')}</h3>
                  <button type="button" onClick={() => setSnapshotsOpen(false)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>
                <div className="space-y-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={handleSaveSnapshot}
                    className="w-full rounded-md bg-[#2a5f8a] px-3 py-2 text-xs font-medium text-white hover:bg-[#1f4a6c]"
                  >
                    {t('teampage.snapshotsSave')}
                  </button>
                  <p className="text-[11px] text-slate-400">{t('teampage.snapshotsMaxHint')}</p>
                  {snapshots.length === 0 && <p className="text-xs text-slate-400">{t('teampage.snapshotsEmpty')}</p>}
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {snapshots.map((snapshot) => (
                      <div key={snapshot.id} className="rounded-md border border-slate-200 p-2.5">
                        <input
                          value={snapshot.naam}
                          onChange={(e) => renameSnapshot(teamId, snapshot.id, e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                        />
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">{formatSnapshotTimestamp(snapshot.timestamp)}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadSnapshot(snapshot)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              {t('teampage.snapshotsLoad')}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSnapshot(teamId, snapshot.id)}
                              className="rounded-md border border-[#9a3b2e]/30 px-2 py-1 text-[11px] text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
                            >
                              {t('teampage.remove')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearWorkflow}
            className="rounded-md border border-[#9a3b2e]/30 px-2.5 py-1 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
          >
            {t('teampage.clear')}
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200">
        {['workflow', 'applicatieflow'].map((tabId) => (
          <button
            key={tabId}
            type="button"
            data-tour={tabId === 'applicatieflow' ? 'tab-applicatieflow' : undefined}
            onClick={() => setActiveTeamTab(tabId)}
            className={`-mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
              activeTeamTab === tabId ? 'border-[#2a5f8a] text-[#2a5f8a]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tabId === 'workflow' ? t('teampage.tabWorkflow') : t('teampage.tabApplicatieflow')}
          </button>
        ))}
      </div>

      {activeTeamTab === 'applicatieflow' && <ApplicatieflowTab workflow={workflow} patch={patch} />}

      {activeTeamTab === 'workflow' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.workflowTitle')}</h3>
              <span className="text-[11px] text-slate-400">{t('teampage.workflowHint')}</span>
            </div>

            <div data-tour="toolbar" className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2.5">
              <button
                type="button"
                onClick={() => addAnnotation('note')}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.toolbarNote')}
              </button>
              <button
                type="button"
                onClick={() => addAnnotation('shape', { shape: 'rect' })}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.toolbarRect')}
              </button>
              <button
                type="button"
                onClick={() => addAnnotation('shape', { shape: 'circle' })}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.toolbarCircle')}
              </button>
              <button
                type="button"
                onClick={() => addAnnotation('shape', { shape: 'diamond' })}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.toolbarDiamond')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLineToolActive((v) => !v)
                  setLineStart(null)
                }}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  lineToolActive ? 'border-[#2a5f8a] bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t('teampage.toolbarLine')}
              </button>
              <span className="ml-1 text-[11px] text-slate-400">{t('teampage.toolbarColorLabel')}</span>
              <ColorSwatchRow value={activeColor} onChange={setActiveColor} />
              {lineToolActive && <span className="ml-auto text-[11px] font-medium text-[#2a5f8a]">{t('teampage.toolbarLineActive')}</span>}
            </div>

            <div data-tour="workflow-canvas" className="relative rounded-lg border border-slate-100" style={{ height: Math.min(canvasHeight, 520) }}>
              <PannableFlowCanvas
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={handleNodesChange}
                onNodeClick={handleNodeClick}
              />
            </div>
          </div>

          <div data-tour="applications" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.applicationsTitle')}</h3>
              <button
                type="button"
                onClick={addApplication}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.applicationsAdd')}
              </button>
            </div>
            <p className="mb-3 text-[11px] text-slate-400">{t('teampage.applicationsHint')}</p>
            {workflow.applications.length === 0 && <p className="text-xs text-slate-400">{t('teampage.applicationsEmpty')}</p>}
            <div className="flex flex-wrap gap-2">
              {workflow.applications.map((app) => (
                <div key={app.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                  <input
                    value={app.naam}
                    onChange={(e) => updateApplication(app.id, { naam: e.target.value })}
                    placeholder={t('teampage.applicationsPlaceholder')}
                    className="w-40 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button type="button" onClick={() => removeApplication(app.id)} className="shrink-0 text-xs text-[#9a3b2e] hover:underline">
                    {t('teampage.remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IoListEditor
              title={t('teampage.inputsTitle')}
              items={workflow.inputs}
              onAdd={addInput}
              onUpdate={updateInput}
              onRemove={removeInput}
              showLink
              showBron
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              teamName={teamName}
              t={t}
              language={language}
            />
            <IoListEditor
              title={t('teampage.outputsTitle')}
              items={workflow.outputs}
              onAdd={addOutput}
              onUpdate={updateOutput}
              onRemove={removeOutput}
              showLink={false}
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              teamName={teamName}
              t={t}
            />
          </div>

          <div data-tour="capacity" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.capacityTitle')}</h3>
              <button
                type="button"
                onClick={addCapacityRow}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.capacityAdd')}
              </button>
            </div>
            {workflow.capacity.length === 0 && <p className="text-xs text-slate-400">{t('teampage.capacityEmpty')}</p>}
            <div className="space-y-2.5">
              {workflow.capacity.map((row) => (
                <div key={row.id} className="rounded-md border border-slate-200 p-2.5">
                  <div className="flex items-center gap-2">
                    {addingRoleForRow === row.id ? (
                      <div className="flex flex-1 items-center gap-1.5">
                        <input
                          autoFocus
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder={t('teampage.capacityRolPlaceholder')}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => confirmNewRole(row.id)}
                          className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-sm text-white hover:bg-[#1f4a6c]"
                        >
                          {t('form.categorieNewConfirm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingRoleForRow(null)
                            setNewRoleName('')
                          }}
                          className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          {t('form.cancel')}
                        </button>
                      </div>
                    ) : (
                      <select
                        value={row.functieId ?? ''}
                        onChange={(e) => handleRoleChange(row.id, e.target.value)}
                        className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                      >
                        <option value="">—</option>
                        {activeFuncties.map((functie) => (
                          <option key={functie.id} value={functie.id}>
                            {functie.naam}
                          </option>
                        ))}
                        <option value={NEW_ROLE_SENTINEL}>{t('teampage.capacityNewRole')}</option>
                      </select>
                    )}
                    <input
                      type="number"
                      min={0}
                      value={row.aantal}
                      onChange={(e) => updateCapacityRow(row.id, { aantal: Number(e.target.value) })}
                      title={t('teampage.capacityAantal')}
                      className="w-16 shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeCapacityRow(row.id)}
                      className="shrink-0 rounded-md border border-[#9a3b2e]/30 px-2 py-1.5 text-xs text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
                    >
                      {t('teampage.remove')}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <select
                      value={row.seniority ?? ''}
                      onChange={(e) => updateCapacityRow(row.id, { seniority: e.target.value })}
                      title={t('teampage.capacitySeniority')}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                    >
                      <option value="">{t('teampage.capacitySeniority')}</option>
                      {SENIORITY_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {translateSeniority(lvl, language)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.fase}
                      onChange={(e) => updateCapacityRow(row.id, { fase: e.target.value })}
                      title={t('teampage.capacityFase')}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                    >
                      <option value="">{t('teampage.capacityFase')}</option>
                      {WORKFLOW_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {translateWorkflowStage(stage, language)}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-slate-400">{t('teampage.capacityRisicoLabel')}</span>
                    <select
                      value={row.risico_bij_uitval ?? ''}
                      onChange={(e) => updateCapacityRow(row.id, { risico_bij_uitval: e.target.value })}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                    >
                      <option value="">—</option>
                      {RISICO_BIJ_UITVAL.map((val) => (
                        <option key={val} value={val}>
                          {translateRisicoBijUitval(val, language)}
                        </option>
                      ))}
                    </select>
                    {row.risico_bij_uitval === 'ja' && (
                      <input
                        value={row.risico_toelichting ?? ''}
                        onChange={(e) => updateCapacityRow(row.id, { risico_toelichting: e.target.value })}
                        placeholder={t('teampage.capacityRisicoToelichtingPlaceholder')}
                        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-tour="dependencies" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.dependenciesTitle')}</h3>
              <button
                type="button"
                onClick={() => setFormState({ editing: null })}
                className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]"
              >
                {t('header.newDependency')}
              </button>
            </div>
            {teamDependencies.length === 0 && <p className="text-xs text-slate-400">{t('teampage.dependenciesEmpty')}</p>}
            <ul className="divide-y divide-slate-100">
              {teamDependencies.map((dep) => {
                const risk = calculateRisk(dep)
                const style = riskStyle(risk.level)
                return (
                  <li key={dep.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDependency(dep)}
                      className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <CategoryIcon categorie={dep.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-slate-700">{dep.titel}</span>
                      <span className="shrink-0 text-xs text-slate-400">{translateCategorie(dep.categorie, language)}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>
                        {translateRiskLevel(risk.level, language)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {selectedDependency && (
        <DependencyDetail
          dependency={selectedDependency}
          onClose={() => setSelectedDependency(null)}
          onEdit={(dep) => {
            setSelectedDependency(null)
            setFormState({ editing: dep })
          }}
          onDelete={handleDeleteDependency}
        />
      )}

      {formState && (
        <DependencyForm
          teamId={teamId}
          teamName={teamNaam}
          initialData={formState.editing}
          onSave={handleSaveDependency}
          onCancel={() => setFormState(null)}
        />
      )}

      {tourActive && <SpotlightTour steps={tourSteps} onClose={handleTourClose} />}
    </div>
  )
}
