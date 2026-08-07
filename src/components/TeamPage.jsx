import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { WORKFLOW_STAGES, BRON_TYPES, SENIORITY_LEVELS, RISICO_BIJ_UITVAL, WORKFLOW_STAP_TO_STAGE, FLOWTYPE_LEVELS } from '../data/constants'
import {
  translateWorkflowStage,
  translateCategorie,
  translateRiskLevel,
  translateBronType,
  translateSeniority,
  translateRisicoBijUitval,
  translateFlowtype,
  translateStatus,
} from '../i18n/labels'
import { stageColor, bronTypeColor, ANNOTATION_PALETTE } from '../lib/workflowStyles'
import { calculateRisk, compareRiskDesc } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { generateId, emptyTeamWorkflow, emptyApplicatieflow } from '../lib/storage'
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

// Lange 'lane'-balk boven de workflow-stage-rij die de Applicatieflow-kant
// van het team samenvat (of, gesplitst, per applicatie een eigen lane) —
// analoog aan de stage-rij voor Ontwikkelflow, maar zonder vaste kolommen
// omdat Applicatieflow geen workflowstap kent. Klikbaar: springt naar het
// Applicatieflow-tabblad.
function ApplicatieflowBannerNode({ data }) {
  return (
    <div
      className="relative flex items-center gap-1.5 rounded-lg border-2 border-[#2a5f8a]/50 bg-[#2a5f8a]/10 px-2 py-2 shadow-sm"
      style={{ width: data.width }}
    >
      {/* Onzichtbare handles zodat app-naar-app-koppelingen (uit de
          Applicatieflow-vragenlijst) hier als lijn op kunnen aansluiten. */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {data.onToggleCollapse && (
        <button
          type="button"
          onClick={data.onToggleCollapse}
          title={data.toggleLabel}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#2a5f8a] hover:bg-[#2a5f8a]/15"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform ${data.collapsed ? '-rotate-90' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={data.onClick}
        className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 pr-1.5 text-left"
      >
        <span className="truncate text-sm font-semibold text-[#2a5f8a]">{data.label}</span>
        <span className="shrink-0 text-xs text-[#2a5f8a]/70">{data.count > 0 ? data.count : data.emptyLabel}</span>
      </button>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

// Achtergrondkader dat banner + kolomkoppen + markers van één Applicatieflow-
// lane omsluit, zodat de lane als één geheel oogt in plaats van losse
// zwevende elementen. Niet interactief (pointer-events-none, ongedragbaar,
// laagste zIndex) zodat het canvas pannen/klikken op de echte nodes eronder
// niet in de weg zit.
function LaneGroupNode({ data }) {
  return (
    <div
      className="pointer-events-none rounded-2xl border border-[#2a5f8a]/25 bg-[#2a5f8a]/[0.04]"
      style={{ width: data.width, height: data.height }}
    />
  )
}

// Kolomkop binnen een Applicatieflow-lane (7x herhaald per lane), gestyled
// als mini-variant van StageNode (zelfde kleurstrip per stage) zodat de
// kolommen visueel bij de stage-rij eronder passen i.p.v. losse tekst.
function SmallLabelNode({ data }) {
  return (
    <div
      className="relative w-40 truncate rounded-md border bg-white/90 px-2 py-1 text-center"
      style={{ borderColor: data.color ? `${data.color}66` : '#e2e8f0' }}
    >
      {data.color && <div className="absolute inset-x-0 top-0 h-1 rounded-t-md" style={{ backgroundColor: data.color }} />}
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{data.text}</span>
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
  applicatieflowBanner: ApplicatieflowBannerNode,
  smallLabel: SmallLabelNode,
  laneGroup: LaneGroupNode,
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
  applications,
  splitApplicaties,
  applicatieflowConnecties,
  t,
  language,
  onOpenApplicatieflow,
  laneFilterQuery,
  collapsedLaneIds,
  onToggleLaneCollapse,
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
    if (dep.flowtype !== 'ontwikkelflow') continue
    const stage = WORKFLOW_STAP_TO_STAGE[dep.workflowStap]
    if (!stage) continue
    if (!depsByStage[stage]) depsByStage[stage] = []
    depsByStage[stage].push(dep)
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

  // --- Applicatieflow-lane(s) boven de stage-rij ---
  // Applicatieflow en workflowstap horen bij elkaar: elke lane krijgt daarom
  // zijn eigen mini-versie van dezelfde 7 WORKFLOW_STAGES-kolommen als de
  // Ontwikkelflow-rij hieronder (zelfde x-posities, dus verticaal precies
  // uitgelijnd), gevuld met de dependencies die in die stap vallen. Deps
  // zonder (optionele) workflowstap krijgen een aparte 'Geen workflowstap'-
  // strook onderaan de lane. In samengevoegde modus is dat één lane voor alle
  // Applicatieflow-dependencies; met splitApplicaties aan krijgt elke
  // applicatie zijn eigen lane, plus een lane voor nog niet gelabelde deps.
  const applicatieflowDeps = teamDependencies.filter((d) => d.flowtype === 'applicatieflow')
  const BANNER_WIDTH = (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 160
  const MARKER_W = 170
  const MARKERS_PER_ROW = Math.max(1, Math.floor(BANNER_WIDTH / MARKER_W))
  const BANNER_TITLE_H = 44
  const STAGE_LABEL_H = 18
  const MARKER_ROW_H = 40
  const LANE_GAP = 22

  function groupApplicatieflowDeps(deps) {
    const byStage = {}
    const noStage = []
    deps.forEach((dep) => {
      const stage = WORKFLOW_STAP_TO_STAGE[dep.workflowStap]
      if (!stage) {
        noStage.push(dep)
        return
      }
      if (!byStage[stage]) byStage[stage] = []
      byStage[stage].push(dep)
    })
    const maxStageStack = Math.max(0, ...WORKFLOW_STAGES.map((s) => byStage[s]?.length ?? 0))
    // Geen kolomkoppen (stage-namen) meer per lane — die staan één keer
    // gedeeld boven de hele stapel (zie appflow-header hieronder), anders
    // dupliceren ze zich per applicatie zodra Split applicaties aanstaat.
    const stageRowsHeight = BANNER_TITLE_H + maxStageStack * MARKER_ROW_H
    const noStageRows = noStage.length > 0 ? Math.max(1, Math.ceil(noStage.length / MARKERS_PER_ROW)) : 0
    const extraHeight = noStage.length > 0 ? 8 + STAGE_LABEL_H + noStageRows * MARKER_ROW_H : 0
    return { byStage, noStage, stageRowsHeight, height: stageRowsHeight + extraHeight }
  }

  const LANE_PAD_X = 14
  const LANE_PAD_TOP = 10
  const LANE_PAD_BOTTOM = 14

  function pushApplicatieflowLane(id, label, deps, y, collapsed) {
    const bid = `appbanner:${id}`
    const { byStage, noStage, stageRowsHeight, height } = groupApplicatieflowDeps(deps)
    const effectiveHeight = collapsed ? BANNER_TITLE_H : height

    const bgId = `${bid}:bg`
    nodes.push({
      id: bgId,
      type: 'laneGroup',
      position: { x: STAGE_START_X - LANE_PAD_X, y: y - LANE_PAD_TOP },
      data: { width: BANNER_WIDTH + LANE_PAD_X * 2, height: effectiveHeight + LANE_PAD_TOP + LANE_PAD_BOTTOM },
      draggable: false,
      selectable: false,
      zIndex: -1,
    })

    nodes.push({
      id: bid,
      type: 'applicatieflowBanner',
      position: withSavedPosition(bid, { x: STAGE_START_X, y }),
      data: {
        width: BANNER_WIDTH,
        label,
        count: deps.length,
        emptyLabel: t('teampage.applicatieflowBannerEmpty'),
        onClick: onOpenApplicatieflow,
        collapsed,
        onToggleCollapse: onToggleLaneCollapse ? () => onToggleLaneCollapse(id) : undefined,
        toggleLabel: collapsed ? t('teampage.laneExpand') : t('teampage.laneCollapse'),
      },
      draggable: true,
    })

    if (collapsed) return

    WORKFLOW_STAGES.forEach((stage, i) => {
      const stageDeps = byStage[stage] ?? []
      stageDeps.forEach((dep, di) => {
        const mid = `${bid}:dep:${dep.id}`
        nodes.push({
          id: mid,
          type: 'dependencyMarker',
          position: withSavedPosition(mid, { x: STAGE_START_X + i * STAGE_GAP, y: y + BANNER_TITLE_H + di * MARKER_ROW_H }),
          data: { titel: dep.titel, risk: calculateRisk(dep), dependency: dep },
          draggable: true,
        })
        edges.push({ id: `${bid}->${mid}`, source: bid, target: mid, style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' } })
      })
    })

    if (noStage.length > 0) {
      const labelId = `${bid}:nostage-label`
      nodes.push({
        id: labelId,
        type: 'smallLabel',
        position: withSavedPosition(labelId, { x: STAGE_START_X, y: y + stageRowsHeight + 8 }),
        data: { text: t('teampage.geenWorkflowstap') },
        draggable: false,
      })
      noStage.forEach((dep, di) => {
        const row = Math.floor(di / MARKERS_PER_ROW)
        const col = di % MARKERS_PER_ROW
        const mid = `${bid}:dep:${dep.id}`
        nodes.push({
          id: mid,
          type: 'dependencyMarker',
          position: withSavedPosition(mid, { x: STAGE_START_X + col * MARKER_W, y: y + stageRowsHeight + 8 + STAGE_LABEL_H + row * MARKER_ROW_H }),
          data: { titel: dep.titel, risk: calculateRisk(dep), dependency: dep },
          draggable: true,
        })
        edges.push({ id: `${bid}->${mid}`, source: bid, target: mid, style: { stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '2 2' } })
      })
    }
  }

  // LANE_STACK_GAP houdt rekening met de padding van elke lane's achtergrond-
  // kader (LANE_PAD_TOP/BOTTOM), anders overlappen de kaders van opeenvolgende
  // lanes elkaar net iets.
  const LANE_STACK_GAP = LANE_GAP + LANE_PAD_TOP + LANE_PAD_BOTTOM
  let applicatieflowTop = STAGE_Y - LANE_GAP - LANE_PAD_BOTTOM
  let topLaneY = null
  function placeApplicatieflowLane(id, label, deps) {
    const collapsed = collapsedLaneIds?.has(id) ?? false
    const height = collapsed ? BANNER_TITLE_H : groupApplicatieflowDeps(deps).height
    applicatieflowTop -= height
    pushApplicatieflowLane(id, label, deps, applicatieflowTop, collapsed)
    topLaneY = applicatieflowTop
    applicatieflowTop -= LANE_STACK_GAP
  }

  if (splitApplicaties && applications.length > 0) {
    const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
    const query = (laneFilterQuery ?? '').trim().toLowerCase()
    const visibleApplications = query ? applications.filter((app) => (app.naam || '').toLowerCase().includes(query)) : applications
    // Niet-gelabelde Applicatieflow-deps horen niet bij een specifieke
    // applicatie, dus geen aparte 'niet gelabeld'-bucket ertussenin: ze
    // vormen de algemene Applicatieflow-basislaag (zelfde naam/stijl als de
    // samengevoegde weergave), direct tegen de stage-rij aan. De per-
    // applicatie lanen stapelen daar bovenop (eerste applicatie het dichtst).
    // Blijft altijd zichtbaar, ook als er op applicatienaam gefilterd wordt.
    if (unlabeled.length > 0) placeApplicatieflowLane('unlabeled', t('teampage.flowtypeApplicatieflow'), unlabeled)
    for (let i = visibleApplications.length - 1; i >= 0; i -= 1) {
      const app = visibleApplications[i]
      const appDeps = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).includes(app.id))
      placeApplicatieflowLane(app.id, app.naam || '—', appDeps)
    }

    // De koppelingen uit de Applicatieflow-vragenlijst ('welke applicatie
    // geeft werk/data door aan welke andere') worden hier als directe lijnen
    // tussen de lane-banners getekend — dat verving het losse netwerk-canvas
    // dat ApplicatieflowTab eerder zelf tekende.
    applicatieflowConnecties.forEach((c) => {
      const sourceId = `appbanner:${c.van}`
      const targetId = `appbanner:${c.naar}`
      if (!nodes.some((n) => n.id === sourceId) || !nodes.some((n) => n.id === targetId)) return
      edges.push({
        id: `appconn:${c.id}`,
        source: sourceId,
        target: targetId,
        style: { stroke: '#2a5f8a', strokeWidth: 2 },
        animated: true,
      })
    })
  } else {
    placeApplicatieflowLane('all', t('teampage.flowtypeApplicatieflow'), applicatieflowDeps)
  }

  // Eén gedeelde kolomkoppen-rij boven de hele lane-stapel (i.p.v. per lane
  // herhaald) — de kolommen liggen toch al op dezelfde x-positie als de
  // Ontwikkelflow-stage-rij eronder, dus één set namen is genoeg.
  if (topLaneY !== null) {
    const headerY = topLaneY - LANE_PAD_TOP - STAGE_LABEL_H - 6
    WORKFLOW_STAGES.forEach((stage, i) => {
      const labelId = `appflow-header:${stage}`
      nodes.push({
        id: labelId,
        type: 'smallLabel',
        position: withSavedPosition(labelId, { x: STAGE_START_X + i * STAGE_GAP, y: headerY }),
        data: { text: translateWorkflowStage(stage, language), color: stageColor(stage) },
        draggable: false,
      })
    })
  }

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
  // applicatieflowTop is negatief zodra er lanes boven de stage-rij staan;
  // die extra ruimte (naar boven) telt hier mee zodat het canvas niet te
  // krap oogt met meerdere gesplitste applicatie-lanes.
  const canvasHeight = Math.max(420, annotationBaseY + annotationRows * 190 + 100, STAGE_Y - applicatieflowTop + 300)

  return { nodes, edges, canvasWidth, canvasHeight }
}

function canvasHeightFor(inputs, outputs) {
  return IO_Y_START + Math.max(inputs.length, outputs.length) * IO_Y_GAP
}

function emptyIoItem(kind) {
  return kind === 'input'
    ? { id: generateId(), label: '', flowtype: '', bron_type: '', linkedTeam: '', linkedOutputId: '', applicatieId: '' }
    : { id: generateId(), label: '', flowtype: '', applicatieId: '' }
}

function ioItemSummary(item, kind, teams, teamWorkflows, applications, language) {
  const parts = []
  if (item.flowtype) parts.push(translateFlowtype(item.flowtype, language))
  if (kind === 'input' && item.bron_type) parts.push(translateBronType(item.bron_type, language))
  if (kind === 'input' && item.linkedTeam) {
    const team = teams.find((tm) => tm.id === item.linkedTeam)
    const out = (teamWorkflows[item.linkedTeam]?.outputs ?? []).find((o) => o.id === item.linkedOutputId)
    parts.push(`${team?.naam ?? item.linkedTeam}${out ? ` → ${out.label || '—'}` : ''}`)
  }
  if (item.applicatieId) {
    const app = applications.find((a) => a.id === item.applicatieId)
    if (app) parts.push(app.naam || '—')
  }
  return parts.join(' · ')
}

// Klein modal-formulier voor één input-/output-item — vervangt de eerder
// altijd-open inline velden per rij, zodat de lijst daarboven een rustig,
// leesbaar overzicht blijft en je alleen bij bewerken de details ziet.
function IoItemModal({ kind, item, onSave, onRemove, onClose, teams, currentTeamId, teamWorkflows, applications, t, language }) {
  const [draft, setDraft] = useState(() => ({ ...emptyIoItem(kind), ...item }))
  const isEditing = Boolean(item)
  const showBron = kind === 'input'
  const showLink = kind === 'input'

  function update(fields) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave(draft)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {isEditing ? t('teampage.ioEditTitle') : t('teampage.ioAddTitle')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <input
              autoFocus
              value={draft.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder={t('teampage.ioLabelPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('form.flowtype')}</label>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label={t('form.flowtype')}>
              {FLOWTYPE_LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ flowtype: draft.flowtype === value ? '' : value })}
                  aria-pressed={draft.flowtype === value}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    draft.flowtype === value ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {translateFlowtype(value, language)}
                </button>
              ))}
            </div>
          </div>

          {showBron && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.ioBronLabel')}</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={draft.bron_type ?? ''}
                  onChange={(e) => update({ bron_type: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                >
                  <option value="">{t('teampage.ioBronNone')}</option>
                  {BRON_TYPES.map((bron) => (
                    <option key={bron} value={bron}>
                      {translateBronType(bron, language)}
                    </option>
                  ))}
                </select>
                {draft.bron_type && (
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bronTypeColor(draft.bron_type) }} />
                )}
              </div>
            </div>
          )}

          {showLink && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.ioLinkLabel')}</label>
              <div className="flex flex-col gap-1.5">
                <select
                  value={draft.linkedTeam ?? ''}
                  onChange={(e) => update({ linkedTeam: e.target.value, linkedOutputId: '' })}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
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
                {draft.linkedTeam && (
                  <select
                    value={draft.linkedOutputId ?? ''}
                    onChange={(e) => update({ linkedOutputId: e.target.value })}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
                  >
                    <option value="">{t('teampage.ioLinkItemPlaceholder')}</option>
                    {(teamWorkflows[draft.linkedTeam]?.outputs ?? []).map((out) => (
                      <option key={out.id} value={out.id}>
                        {out.label || '—'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {applications.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.ioApplicatieLabel')}</label>
              <select
                value={draft.applicatieId ?? ''}
                onChange={(e) => update({ applicatieId: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="">{t('teampage.ioApplicatieNone')}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.naam || '—'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            {isEditing ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-[#9a3b2e]/30 px-2.5 py-1.5 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
              >
                {t('teampage.remove')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('form.cancel')}
              </button>
              <button type="submit" className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]">
                {t('form.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function IoListEditor({ title, kind, items, onAdd, onUpdate, onRemove, showLink, showBron, teams, currentTeamId, teamWorkflows, applications, t, language }) {
  // undefined = gesloten, null = nieuw item, object = item in bewerking
  const [modalItem, setModalItem] = useState(undefined)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() => setModalItem(null)}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {t('teampage.ioAdd')}
        </button>
      </div>
      {items.length === 0 && <p className="text-xs text-slate-400">{t('teampage.ioEmpty')}</p>}
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const summary = ioItemSummary(item, kind, teams, teamWorkflows, applications, language)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setModalItem(item)}
                className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1 truncate text-slate-700">{item.label || '—'}</span>
                {summary && <span className="max-w-[55%] shrink-0 truncate text-xs text-slate-400">{summary}</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {modalItem !== undefined && (
        <IoItemModal
          kind={kind}
          item={modalItem}
          teams={teams}
          currentTeamId={currentTeamId}
          teamWorkflows={teamWorkflows}
          applications={applications}
          t={t}
          language={language}
          onClose={() => setModalItem(undefined)}
          onSave={(draft) => {
            if (modalItem) onUpdate(draft.id, draft)
            else onAdd(draft)
            setModalItem(undefined)
          }}
          onRemove={
            modalItem
              ? () => {
                  onRemove(modalItem.id)
                  setModalItem(undefined)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

// Klein modal voor de toelichting/risico-bij-uitval van één applicatie —
// getriggerd vanuit 'Applicaties in beheer/ontwikkeling' zelf. Stond eerder
// in een eigen 'Applicatie-details'-blok naast de koppel-vragenlijst, wat
// samen met die lijst als dubbelop aanvoelde.
function ApplicationDetailModal({ app, data, onSave, onClose, t, language }) {
  const [draft, setDraft] = useState(() => ({ toelichting: '', risico_bij_uitval: '', risico_toelichting: '', ...data }))

  function update(fields) {
    const next = { ...draft, ...fields }
    setDraft(next)
    onSave(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{app.naam || '—'}</h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailToelichting')}</label>
            <textarea
              value={draft.toelichting ?? ''}
              onChange={(e) => update({ toelichting: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">{t('appflow.detailRisico')}</label>
            <select
              value={draft.risico_bij_uitval ?? ''}
              onChange={(e) => update({ risico_bij_uitval: e.target.value })}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {RISICO_BIJ_UITVAL.map((val) => (
                <option key={val} value={val}>
                  {translateRisicoBijUitval(val, language)}
                </option>
              ))}
            </select>
          </div>
          {draft.risico_bij_uitval === 'ja' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailRisicoToelichting')}</label>
              <input
                value={draft.risico_toelichting ?? ''}
                onChange={(e) => update({ risico_toelichting: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
          >
            {t('appflow.detailClose')}
          </button>
        </div>
      </div>
    </div>
  )
}

function emptyCapacityRow() {
  return { id: generateId(), functieId: '', seniority: '', risico_bij_uitval: '', risico_toelichting: '', aantal: 1, fase: '' }
}

// Klein modal-formulier voor één capaciteitsrij, inclusief de inline
// 'nieuwe functie/rol toevoegen'-subflow die voorheen los per rij op de
// pagina zelf stond.
function CapacityRowModal({ row, activeFuncties, addFunctie, onSave, onRemove, onClose, t, language }) {
  const [draft, setDraft] = useState(() => ({ ...emptyCapacityRow(), ...row }))
  const [addingRole, setAddingRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const isEditing = Boolean(row)

  function update(fields) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  function handleRoleChange(value) {
    if (value === NEW_ROLE_SENTINEL) {
      setAddingRole(true)
      return
    }
    update({ functieId: value })
  }

  function confirmNewRole() {
    const name = newRoleName.trim()
    if (!name) return
    const id = addFunctie(name)
    if (id) update({ functieId: id })
    setNewRoleName('')
    setAddingRole(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave(draft)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {isEditing ? t('teampage.capacityEditTitle') : t('teampage.capacityAddTitle')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityRolPlaceholder')}</label>
            {addingRole ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder={t('teampage.capacityRolPlaceholder')}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={confirmNewRole}
                  className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-sm text-white hover:bg-[#1f4a6c]"
                >
                  {t('form.categorieNewConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingRole(false)
                    setNewRoleName('')
                  }}
                  className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {t('form.cancel')}
                </button>
              </div>
            ) : (
              <select
                value={draft.functieId ?? ''}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityAantal')}</label>
              <input
                type="number"
                min={0}
                value={draft.aantal}
                onChange={(e) => update({ aantal: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacitySeniority')}</label>
              <select
                value={draft.seniority ?? ''}
                onChange={(e) => update({ seniority: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="">—</option>
                {SENIORITY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateSeniority(lvl, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityFase')}</label>
            <select
              value={draft.fase ?? ''}
              onChange={(e) => update({ fase: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {WORKFLOW_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {translateWorkflowStage(stage, language)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityRisicoLabel')}</label>
            <select
              value={draft.risico_bij_uitval ?? ''}
              onChange={(e) => update({ risico_bij_uitval: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {RISICO_BIJ_UITVAL.map((val) => (
                <option key={val} value={val}>
                  {translateRisicoBijUitval(val, language)}
                </option>
              ))}
            </select>
          </div>
          {draft.risico_bij_uitval === 'ja' && (
            <div>
              <input
                value={draft.risico_toelichting ?? ''}
                onChange={(e) => update({ risico_toelichting: e.target.value })}
                placeholder={t('teampage.capacityRisicoToelichtingPlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            {isEditing ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-[#9a3b2e]/30 px-2.5 py-1.5 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
              >
                {t('teampage.remove')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('form.cancel')}
              </button>
              <button type="submit" className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]">
                {t('form.save')}
              </button>
            </div>
          </div>
        </form>
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
  const [capacityModalRow, setCapacityModalRow] = useState(undefined)
  const [appDetailId, setAppDetailId] = useState(null)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [appFilterQuery, setAppFilterQuery] = useState('')
  const [splitApplicaties, setSplitApplicaties] = useState(false)
  // Welke Run flow-lanes op het canvas zijn ingeklapt — puur presentatie,
  // niet bewaard, zodat teams met veel applicaties de stapel compact kunnen
  // houden zonder een onleesbare muur aan lanes.
  const [collapsedLaneIds, setCollapsedLaneIds] = useState(() => new Set())

  const toggleLaneCollapsed = useCallback((id) => {
    setCollapsedLaneIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (!localStorage.getItem(TOUR_SEEN_KEY)) {
      startTour()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startTour() {
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
    { target: 'applicatieflow-section', title: t('tour.step.applicatieflow.title'), body: t('tour.step.applicatieflow.body') },
    { target: 'capacity', title: t('tour.step.capacity.title'), body: t('tour.step.capacity.body') },
    { target: 'dependencies', title: t('tour.step.dependencies.title'), body: t('tour.step.dependencies.body') },
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

  // Drieledige splitsing per de Ontwikkelflow/Applicatieflow-scheiding:
  // legacy-data zonder flowtype blijft expliciet zichtbaar i.p.v. geraden.
  const legacyFlowDeps = useMemo(() => teamDependencies.filter((d) => !d.flowtype), [teamDependencies])
  const ontwikkelflowDeps = useMemo(() => teamDependencies.filter((d) => d.flowtype === 'ontwikkelflow'), [teamDependencies])
  const applicatieflowDeps = useMemo(() => teamDependencies.filter((d) => d.flowtype === 'applicatieflow'), [teamDependencies])

  function setApplicatieId(dep, appId) {
    updateDependency(dep.id, { applicatieIds: appId ? [appId] : [] })
  }

  function DependencyRow({ dep, showAppPicker }) {
    const risk = calculateRisk(dep)
    const style = riskStyle(risk.level)
    return (
      <li className="py-2">
        <button
          type="button"
          onClick={() => setSelectedDependency(dep)}
          className="flex w-full items-center gap-2 text-left text-sm hover:bg-slate-50"
        >
          <CategoryIcon categorie={dep.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="flex-1 truncate text-slate-700">{dep.titel}</span>
          <span className="shrink-0 text-xs text-slate-400">{translateCategorie(dep.categorie, language)}</span>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>{translateRiskLevel(risk.level, language)}</span>
        </button>
        {(dep.status || dep.actieAfspraak) && (
          <div className="mt-0.5 flex items-center gap-1.5 pl-5 text-[11px] text-slate-400">
            {dep.status && <span className="shrink-0">{translateStatus(dep.status, language)}</span>}
            {dep.status && dep.actieAfspraak && <span aria-hidden="true">·</span>}
            {dep.actieAfspraak && <span className="truncate">{dep.actieAfspraak}</span>}
          </div>
        )}
        {showAppPicker && workflow.applications.length > 0 && (
          <div className="mt-1 pl-5">
            <select
              value={(dep.applicatieIds ?? [])[0] ?? ''}
              onChange={(e) => setApplicatieId(dep, e.target.value)}
              title={t('teampage.appLabelHint')}
              className={`rounded border-none bg-transparent py-0 pl-0 pr-4 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#2a5f8a] ${
                (dep.applicatieIds ?? []).length > 0 ? 'font-medium text-[#2a5f8a]' : 'text-slate-400'
              }`}
            >
              <option value="">{t('teampage.appLabelNone')}</option>
              {workflow.applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.naam || '—'}
                </option>
              ))}
            </select>
          </div>
        )}
      </li>
    )
  }

  // Gedeelde weergave voor een dependency-lijst gegroepeerd per workflowstap
  // (+ 'Geen workflowstap'-restgroep) — gebruikt voor zowel de Ontwikkelflow-
  // groep als, per applicatie, de Applicatieflow-groepen: die twee horen
  // conceptueel bij elkaar, dus dezelfde indeling overal.
  function StageGroupedDeps({ deps, showAppPicker }) {
    return (
      <>
        {WORKFLOW_STAGES.map((stage) => {
          const stageDeps = deps.filter((d) => WORKFLOW_STAP_TO_STAGE[d.workflowStap] === stage)
          if (stageDeps.length === 0) return null
          return (
            <div key={stage} className="mb-2">
              <div className="mb-1 text-[11px] font-medium text-slate-400">{translateWorkflowStage(stage, language)}</div>
              <ul className="divide-y divide-slate-100">
                {stageDeps.map((dep) => (
                  <DependencyRow key={dep.id} dep={dep} showAppPicker={showAppPicker} />
                ))}
              </ul>
            </div>
          )
        })}
        {(() => {
          const noStage = deps.filter((d) => !WORKFLOW_STAP_TO_STAGE[d.workflowStap])
          if (noStage.length === 0) return null
          return (
            <div className="mb-2">
              <div className="mb-1 text-[11px] font-medium text-slate-400">{t('teampage.geenWorkflowstap')}</div>
              <ul className="divide-y divide-slate-100">
                {noStage.map((dep) => (
                  <DependencyRow key={dep.id} dep={dep} showAppPicker={showAppPicker} />
                ))}
              </ul>
            </div>
          )
        })()}
      </>
    )
  }

  const applicatieflowSectionRef = useRef(null)
  const onOpenApplicatieflow = useCallback(() => {
    applicatieflowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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
    workflow.applications,
    splitApplicaties,
    workflow.applicatieflow?.connecties ?? [],
    t,
    language,
    onOpenApplicatieflow,
    appFilterQuery,
    collapsedLaneIds,
    toggleLaneCollapsed,
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

  function addCapacityRow(row) {
    patch({ capacity: [...workflow.capacity, row] })
  }
  function updateCapacityRow(id, fields) {
    patch({ capacity: workflow.capacity.map((c) => (c.id === id ? { ...c, ...fields } : c)) })
  }
  function removeCapacityRow(id) {
    patch({ capacity: workflow.capacity.filter((c) => c.id !== id) })
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

  function saveAppDetail(appId, fields) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    patch({ applicatieflow: { ...applicatieflow, details: { ...applicatieflow.details, [appId]: { ...applicatieflow.details[appId], ...fields } } } })
  }

  function addInput(item) {
    patch({ inputs: [...workflow.inputs, item] })
  }
  function updateInput(id, fields) {
    patch({ inputs: workflow.inputs.map((i) => (i.id === id ? { ...i, ...fields } : i)) })
  }
  function removeInput(id) {
    patch({ inputs: workflow.inputs.filter((i) => i.id !== id) })
  }

  function addOutput(item) {
    patch({ outputs: [...workflow.outputs, item] })
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
      {/* Eén omsluitend kader zodat workflow/applicaties/capaciteit/dependencies
          visueel als één teamcontext-geheel lezen i.p.v. losse kaarten. */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/60 p-5">
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

      {(
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
              {lineToolActive && <span className="text-[11px] font-medium text-[#2a5f8a]">{t('teampage.toolbarLineActive')}</span>}
              {splitApplicaties && workflow.applications.length > 4 && (
                <input
                  value={appFilterQuery}
                  onChange={(e) => setAppFilterQuery(e.target.value)}
                  placeholder={t('teampage.appFilterPlaceholder')}
                  className="ml-auto w-40 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                />
              )}
              <div
                className={`inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs ${splitApplicaties && workflow.applications.length > 4 ? '' : 'ml-auto'}`}
                role="group"
                aria-label={t('teampage.viewModeLabel')}
              >
                <button
                  type="button"
                  onClick={() => setSplitApplicaties(false)}
                  aria-pressed={!splitApplicaties}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    !splitApplicaties ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('teampage.viewMerged')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitApplicaties(true)}
                  aria-pressed={splitApplicaties}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    splitApplicaties ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('teampage.splitApplicaties')}
                </button>
              </div>
            </div>

            <div data-tour="workflow-canvas" className="relative rounded-lg border border-slate-100" style={{ height: Math.min(Math.max(canvasHeight, 460), 640) }}>
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
            <ul className="space-y-2">
              {workflow.applications.map((app) => {
                const detail = workflow.applicatieflow?.details?.[app.id]
                const hasDetail = Boolean(detail?.toelichting || detail?.risico_bij_uitval)
                return (
                  <li key={app.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                    <input
                      value={app.naam}
                      onChange={(e) => updateApplication(app.id, { naam: e.target.value })}
                      placeholder={t('teampage.applicationsPlaceholder')}
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                    />
                    {detail?.risico_bij_uitval === 'ja' && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a3b2e]" title={t('appflow.detailRisico')} />
                    )}
                    <button
                      type="button"
                      onClick={() => setAppDetailId(app.id)}
                      className={`shrink-0 text-xs font-medium ${hasDetail ? 'text-[#2a5f8a]' : 'text-slate-400 hover:text-[#2a5f8a]'}`}
                    >
                      {hasDetail ? t('appflow.detailEdit') : t('appflow.detailAdd')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeApplication(app.id)}
                      aria-label={t('teampage.remove')}
                      title={t('teampage.remove')}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-[#9a3b2e]/10 hover:text-[#9a3b2e]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {appDetailId &&
            (() => {
              const app = workflow.applications.find((a) => a.id === appDetailId)
              if (!app) return null
              return (
                <ApplicationDetailModal
                  app={app}
                  data={workflow.applicatieflow?.details?.[appDetailId] ?? {}}
                  onSave={(fields) => saveAppDetail(appDetailId, fields)}
                  onClose={() => setAppDetailId(null)}
                  t={t}
                  language={language}
                />
              )
            })()}

          <div ref={applicatieflowSectionRef} data-tour="applicatieflow-section" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.tabApplicatieflow')}</h3>
            </div>
            <ApplicatieflowTab workflow={workflow} patch={patch} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IoListEditor
              title={t('teampage.inputsTitle')}
              kind="input"
              items={workflow.inputs}
              onAdd={addInput}
              onUpdate={updateInput}
              onRemove={removeInput}
              showLink
              showBron
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              applications={workflow.applications}
              t={t}
              language={language}
            />
            <IoListEditor
              title={t('teampage.outputsTitle')}
              kind="output"
              items={workflow.outputs}
              onAdd={addOutput}
              onUpdate={updateOutput}
              onRemove={removeOutput}
              showLink={false}
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              applications={workflow.applications}
              t={t}
              language={language}
            />
          </div>

          <div data-tour="capacity" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.capacityTitle')}</h3>
              <button
                type="button"
                onClick={() => setCapacityModalRow(null)}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.capacityAdd')}
              </button>
            </div>
            {workflow.capacity.length === 0 && <p className="text-xs text-slate-400">{t('teampage.capacityEmpty')}</p>}
            <ul className="divide-y divide-slate-100">
              {workflow.capacity.map((row) => {
                const summary = [
                  row.seniority && translateSeniority(row.seniority, language),
                  row.fase && translateWorkflowStage(row.fase, language),
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setCapacityModalRow(row)}
                      className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {row.risico_bij_uitval === 'ja' && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a3b2e]" title={t('teampage.capacityRisicoLabel')} />
                      )}
                      <span className="min-w-0 flex-1 truncate text-slate-700">{functieName(row.functieId) || '—'}</span>
                      {summary && <span className="shrink-0 text-xs text-slate-400">{summary}</span>}
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{row.aantal}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {capacityModalRow !== undefined && (
            <CapacityRowModal
              row={capacityModalRow}
              activeFuncties={activeFuncties}
              addFunctie={addFunctie}
              t={t}
              language={language}
              onClose={() => setCapacityModalRow(undefined)}
              onSave={(draft) => {
                if (capacityModalRow) updateCapacityRow(draft.id, draft)
                else addCapacityRow(draft)
                setCapacityModalRow(undefined)
              }}
              onRemove={
                capacityModalRow
                  ? () => {
                      removeCapacityRow(capacityModalRow.id)
                      setCapacityModalRow(undefined)
                    }
                  : undefined
              }
            />
          )}

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

            {legacyFlowDeps.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9a3b2e]">
                  {t('teampage.flowtypeUndetermined')} · {legacyFlowDeps.length}
                </h4>
                <p className="mb-1.5 mt-0.5 text-[11px] text-slate-400">{t('teampage.flowtypeUndeterminedHint')}</p>
                <ul className="divide-y divide-slate-100">
                  {legacyFlowDeps.map((dep) => (
                    <DependencyRow key={dep.id} dep={dep} showAppPicker={false} />
                  ))}
                </ul>
              </div>
            )}

            {ontwikkelflowDeps.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('teampage.flowtypeOntwikkelflow')} · {ontwikkelflowDeps.length}
                </h4>
                <StageGroupedDeps deps={ontwikkelflowDeps} showAppPicker />
              </div>
            )}

            {(
              <div>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('teampage.flowtypeApplicatieflow')} · {applicatieflowDeps.length}
                </h4>
                {applicatieflowDeps.length === 0 && (
                  <p className="mb-2 text-xs text-slate-400">{t('teampage.applicatieflowEmpty')}</p>
                )}
                {workflow.applications.length > 3 && (
                  <input
                    value={appFilterQuery}
                    onChange={(e) => setAppFilterQuery(e.target.value)}
                    placeholder={t('teampage.appFilterPlaceholder')}
                    className="mb-2 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                  />
                )}
                {workflow.applications
                  .filter((app) => !appFilterQuery.trim() || (app.naam || '').toLowerCase().includes(appFilterQuery.trim().toLowerCase()))
                  .map((app) => {
                    const appDeps = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).includes(app.id))
                    if (appDeps.length === 0) return null
                    return (
                      <div key={app.id} className="mb-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                        <div className="mb-1.5 text-xs font-semibold text-slate-600">{app.naam || '—'}</div>
                        <StageGroupedDeps deps={appDeps} showAppPicker />
                      </div>
                    )
                  })}
                {(() => {
                  const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
                  if (unlabeled.length === 0) return null
                  return (
                    <div className="mb-3 rounded-lg border border-dashed border-slate-200 p-2.5">
                      <div className="mb-1.5 text-xs font-semibold text-slate-500">{t('teampage.appLabelNone')}</div>
                      <StageGroupedDeps deps={unlabeled} showAppPicker />
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </>
      )}
      </div>

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
