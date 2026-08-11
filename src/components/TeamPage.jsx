import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { WORKFLOW_STAGES, BRON_TYPES, SENIORITY_LEVELS, RISICO_BIJ_UITVAL, WORKFLOW_STAP_TO_STAGE, FLOWTYPE_LEVELS } from '../data/constants'
import {
  translateWorkflowStage,
  translateWorkflowStap,
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
import FloatingTooltip from './FloatingTooltip'

const TOUR_SEEN_KEY = 'dependency-insight:team-tour-seen'

const STAGE_GAP = 220
const STAGE_START_X = 260
const STAGE_Y = 260
const IO_Y_START = 40
const IO_Y_GAP = 90

const NEW_ROLE_SENTINEL = '__new_role__'
const HIGH_RISK_LEVELS = ['Hoog', 'Kritiek']

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
    <div
      className="relative w-44 overflow-hidden rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.35 }} />
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: data.color }} />
      <div className="text-sm font-semibold tracking-tight text-slate-800">{translateWorkflowStage(data.stage, language)}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0.35 }} />
    </div>
  )
}

function IoNode({ data }) {
  const isInput = data.kind === 'input'
  return (
    <div
      className="relative w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      style={data.bronColor ? { borderLeftColor: data.bronColor, borderLeftWidth: 3 } : undefined}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.35 }} />
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide ${
            isInput ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'bg-[#5c8a72]/10 text-[#4a7360]'
          }`}
        >
          {isInput ? '→ in' : 'uit →'}
        </span>
        {data.externalTeam && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5c6b8a]" title={`↔ ${data.externalTeam}`} />
        )}
      </div>
      <div className="mt-1 truncate text-xs font-medium text-slate-700">{data.label || '—'}</div>
      {data.linkLabel && <div className="mt-0.5 truncate text-[10px] text-slate-400">{data.linkLabel}</div>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0.35 }} />
    </div>
  )
}

function CapacityBadgeNode({ data }) {
  const { language } = useLanguage()
  return (
    <div className="relative flex w-44 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <Handle type="target" position={Position.Top} style={{ opacity: 0.3 }} />
      {data.risico && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a3b2e]" title={data.risicoToelichting} />}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{data.functieNaam || '—'}</span>
      <span className="shrink-0 text-[10px] text-slate-400">{translateSeniority(data.seniority, language)}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0.3 }} />
    </div>
  )
}

function DependencyMarkerNode({ data }) {
  const { language } = useLanguage()
  const style = riskStyle(data.risk.level)
  const extTeam = data.dependency.geraakte_team_extern
  return (
    <div
      className="relative flex w-44 cursor-pointer flex-col gap-0.5 rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_3px_8px_rgba(15,23,42,0.1)]"
      style={{ borderLeftWidth: 3, borderLeftColor: style.hex, opacity: data.dimmed ? 0.25 : 1 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{data.titel}</span>
        {extTeam && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5c6b8a]" title={`↔ ${extTeam}`} />}
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
          {translateRiskLevel(data.risk.level, language)}
        </span>
      </div>
      {/* Applicatienaam-tagje: alleen gevuld in Samengevoegd's
          'Applicatiegerelateerd'-groep, waar chips niet meer in een eigen
          applicatie-lane staan — dit is dan de enige context die nog zegt
          welke applicatie(s) het raakt. */}
      {data.appTag && (
        <span className="w-fit rounded px-1.5 py-[1px] text-[9px] font-medium text-[#475569]" style={{ backgroundColor: '#64748b1a' }}>
          {data.appTag}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

// Lange 'lane'-balk boven de workflow-stage-rij die de Applicatieflow-kant
// van het team samenvat (of, gesplitst, per applicatie een eigen lane) —
// analoog aan de stage-rij voor Ontwikkelflow, maar zonder vaste kolommen
// omdat Applicatieflow geen workflowstap kent. Klikbaar: springt naar het
// Applicatieflow-tabblad.
// 'app' (blauw, #2a5f8a) voor echte applicatie-lanes/-kaarten, 'teambreed'
// (groen, #5c8a72) voor de niet-gelabelde basislaag — zodat Teambreed
// meteen herkenbaar als eigen, normale categorie oogt i.p.v. een applicatie-
// kloon.
// 'app' (blauw) = één specifieke applicatie, 'teambreed' (groen) = de niet-
// gelabelde basislaag, 'group' (neutraal slate) = de verzamel-groep
// 'Applicatiegerelateerd' in Samengevoegd — bewust geen appkleur, want dit
// is geen applicatie maar een categorie van meerdere applicaties samen.
function laneAccentColor(accent) {
  if (accent === 'teambreed') return '#5c8a72'
  if (accent === 'group') return '#64748b'
  return '#2a5f8a'
}

function ApplicatieflowBannerNode({ data }) {
  const accentColor = laneAccentColor(data.accent)
  return (
    <div
      className="relative flex items-center gap-1.5 rounded-lg border bg-white px-2 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_3px_10px_rgba(15,23,42,0.1)]"
      style={{ width: data.width, borderColor: `${accentColor}59`, borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      {/* Onzichtbare handles zodat app-naar-app-koppelingen (uit de
          Applicatieflow-vragenlijst) hier als lijn op kunnen aansluiten. */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {data.onToggleCollapse && (
        <button
          type="button"
          onClick={data.onToggleCollapse}
          title={data.toggleLabel}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-black/5"
          style={{ color: accentColor }}
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
        <span className="truncate text-sm font-semibold" style={{ color: accentColor }}>
          {data.label}
        </span>
        <span className="shrink-0 text-xs" style={{ color: `${accentColor}b3` }}>
          {data.count > 0 ? data.count : data.emptyLabel}
        </span>
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
  const accentColor = laneAccentColor(data.accent)
  return (
    <div
      className="pointer-events-none rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      style={{
        width: data.width,
        height: data.height,
        border: `1px solid ${accentColor}2e`,
        background: data.accent === 'app' ? 'rgba(255,255,255,0.6)' : `${accentColor}0a`,
      }}
    />
  )
}

// Omsluitende achtergrondlaag voor Run flow (boven) resp. Ontwikkelflow
// (onder) — beide krijgen dezelfde x/breedte (zie ZONE_X/ZONE_WIDTH in
// computeWorkflowLayout) zodat ze visueel één canvas-as delen i.p.v. los van
// elkaar te ogen. Niet interactief, laagste zIndex van alle nodes.
function FlowZoneNode({ data }) {
  return (
    <div
      className="pointer-events-none relative"
      style={{
        width: data.width,
        height: data.height,
        background: data.background,
        border: data.border,
        borderRadius: data.radius,
        boxShadow: data.shadow,
      }}
    >
      <span
        className="absolute left-5 top-3.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider"
        style={{ background: data.labelBg, color: data.labelColor, border: data.labelBorder, boxShadow: data.labelShadow }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.labelDotColor }} />
        {data.label}
      </span>
      {/* Korte samenvatting naast het label, bv. hoeveel applicaties er in
          deze Run flow meespelen — puur context, geen aparte structuur. */}
      {data.subtitle && (
        <span className="absolute left-5 top-9 text-[11px] font-medium" style={{ color: data.labelColor === '#fff' ? '#5479a3' : '#94a3b8' }}>
          {data.subtitle}
        </span>
      )}
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

// Extern team als subtiele randcontext-node (geen prominente losse rij):
// alleen zichtbaar via de 'Externe teams tonen'-toggle, gepositioneerd links
// van het canvas en verbonden met stippellijnen naar elke dependency/IO-chip
// die dat team noemt.
function ExternalTeamNode({ data }) {
  return (
    <div
      className="relative flex w-40 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      style={{ borderColor: '#5c6b8a40' }}
    >
      <Handle type="source" position={Position.Right} style={{ opacity: 0.25 }} />
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5c6b8a]" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#3f4a63]">{data.naam}</span>
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
  laneGroup: LaneGroupNode,
  flowZone: FlowZoneNode,
  externalTeam: ExternalTeamNode,
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
  viewFilters,
  onOpenAppDetail,
) {
  const { showIO = true, showTeambreed = true, riskFilterOn = false, showExternalTeams = false } = viewFilters ?? {}
  const nodes = []
  const edges = []
  const depNodeIdByDepId = new Map()

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
      depNodeIdByDepId.set(dep.id, mid)
      const risk = calculateRisk(dep)
      nodes.push({
        id: mid,
        type: 'dependencyMarker',
        position: withSavedPosition(mid, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y + 80 + (stageCapacity.length + di) * 38 }),
        data: { titel: dep.titel, risk, dependency: dep, dimmed: riskFilterOn && !HIGH_RISK_LEVELS.includes(risk.level) },
        draggable: true,
      })
      edges.push({
        id: `stage:${stage}->${mid}`,
        source: `stage:${stage}`,
        target: mid,
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' },
      })
      // Ontwikkelflow-dependency mag optioneel óók een applicatielabel dragen
      // (Run flow en Ontwikkelflow zijn geen losse werelden) — teken dan een
      // subtiele stippellijn naar de lane-banner van die applicatie, alleen
      // zinvol met Split applicaties aan (anders bestaat er geen aparte lane).
      if (splitApplicaties) {
        ;(dep.applicatieIds ?? []).forEach((appId) => {
          edges.push({
            id: `crossflow:${dep.id}:${appId}`,
            source: `appbanner:${appId}`,
            target: mid,
            style: { stroke: '#7a5c8a', strokeWidth: 1, strokeDasharray: '5 4', opacity: 0.35 },
          })
        })
      }
    })
  })

  // --- Run flow-lane(s) boven de stage-rij ---
  // Run flow-dependencies horen bij hún applicatie, niet bij een
  // workflowstap — ze staan dus NIET meer op de Ontwikkelflow-kolommen
  // uitgelijnd (dat maakte een lane een tweede, gedupliceerde kolomrij).
  // Een lane is nu een compacte, vaste-hoogte rij: appnaam/banner links,
  // de bijbehorende dependency-chips stromen daar in één simpele rij naast
  // (wrap naar een volgende rij pas als een lane echt veel items heeft). In
  // samengevoegde modus geldt hetzelfde idee maar dan horizontaal: een rij
  // applicatiekaarten met hun eigen deps pal eronder gegroepeerd.
  const applicatieflowDeps = teamDependencies.filter((d) => d.flowtype === 'applicatieflow')
  const BANNER_WIDTH = (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 160
  const LANE_BANNER_W = 210
  const LANE_ITEM_W = 195
  const LANE_CONTENT_GAP = 18
  const LANE_ROW_H = 52
  const LANE_GAP = 22

  function groupApplicatieflowDeps(deps) {
    const contentWidth = Math.max(LANE_ITEM_W, BANNER_WIDTH - LANE_BANNER_W - LANE_CONTENT_GAP)
    const perRow = Math.max(1, Math.floor(contentWidth / LANE_ITEM_W))
    const rows = deps.length > 0 ? Math.ceil(deps.length / perRow) : 1
    const height = Math.max(LANE_ROW_H, rows * LANE_ROW_H)
    return { perRow, height }
  }

  const LANE_PAD_X = 14
  const LANE_PAD_TOP = 10
  const LANE_PAD_BOTTOM = 14

  function pushApplicatieflowLane(id, label, deps, y, collapsed, accent, appTagFor) {
    const bid = `appbanner:${id}`
    const { perRow, height } = groupApplicatieflowDeps(deps)
    const effectiveHeight = collapsed ? LANE_ROW_H : height

    const bgId = `${bid}:bg`
    nodes.push({
      id: bgId,
      type: 'laneGroup',
      position: { x: STAGE_START_X - LANE_PAD_X, y: y - LANE_PAD_TOP },
      data: {
        width: BANNER_WIDTH + LANE_PAD_X * 2,
        height: effectiveHeight + LANE_PAD_TOP + LANE_PAD_BOTTOM,
        accent,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    })

    nodes.push({
      id: bid,
      type: 'applicatieflowBanner',
      position: withSavedPosition(bid, { x: STAGE_START_X, y }),
      data: {
        width: LANE_BANNER_W,
        label,
        count: deps.length,
        emptyLabel: t('teampage.applicatieflowBannerEmpty'),
        accent,
        // Een echte applicatie-lane opent de detailmodal van die applicatie;
        // Teambreed/Applicatiegerelateerd hebben geen specifieke applicatie
        // om te tonen en springen daarom naar de Applicaties-sectie.
        onClick: accent === 'app' && onOpenAppDetail ? () => onOpenAppDetail(id) : onOpenApplicatieflow,
        collapsed,
        onToggleCollapse: onToggleLaneCollapse ? () => onToggleLaneCollapse(id) : undefined,
        toggleLabel: collapsed ? t('teampage.laneExpand') : t('teampage.laneCollapse'),
      },
      draggable: true,
    })

    if (collapsed) return

    deps.forEach((dep, i) => {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      const mid = `${bid}:dep:${dep.id}`
      depNodeIdByDepId.set(dep.id, mid)
      const risk = calculateRisk(dep)
      nodes.push({
        id: mid,
        type: 'dependencyMarker',
        position: withSavedPosition(mid, {
          x: STAGE_START_X + LANE_BANNER_W + LANE_CONTENT_GAP + col * LANE_ITEM_W,
          y: y + row * LANE_ROW_H,
        }),
        data: {
          titel: dep.titel,
          risk,
          dependency: dep,
          dimmed: riskFilterOn && !HIGH_RISK_LEVELS.includes(risk.level),
          appTag: appTagFor ? appTagFor(dep) : undefined,
        },
        draggable: true,
      })
      edges.push({ id: `${bid}->${mid}`, source: bid, target: mid, style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' } })
    })
  }

  // LANE_STACK_GAP houdt rekening met de padding van elke lane's achtergrond-
  // kader (LANE_PAD_TOP/BOTTOM), anders overlappen de kaders van opeenvolgende
  // lanes elkaar net iets.
  const LANE_STACK_GAP = LANE_GAP + LANE_PAD_TOP + LANE_PAD_BOTTOM
  let applicatieflowTop = STAGE_Y - LANE_GAP - LANE_PAD_BOTTOM
  let topLaneY = null
  // Id van de eerst geplaatste (dus dichtst-bij-de-stage-rij) lane/groep —
  // het natuurlijke aanknopingspunt voor Run flow-IO, analoog aan hoe
  // Ontwikkelflow-IO aan de eerste/laatste workflowstap hangt.
  let baseLaneId = null
  function placeApplicatieflowLane(id, label, deps, accent, appTagFor) {
    const collapsed = collapsedLaneIds?.has(id) ?? false
    const height = collapsed ? LANE_ROW_H : groupApplicatieflowDeps(deps).height
    applicatieflowTop -= height
    pushApplicatieflowLane(id, label, deps, applicatieflowTop, collapsed, accent, appTagFor)
    if (baseLaneId === null) baseLaneId = `appbanner:${id}`
    topLaneY = applicatieflowTop
    applicatieflowTop -= LANE_STACK_GAP
  }

  function appTagLabel(dep) {
    const names = (dep.applicatieIds ?? []).map((id) => applications.find((a) => a.id === id)?.naam).filter(Boolean)
    if (names.length === 0) return undefined
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
  }

  if (splitApplicaties && applications.length > 0) {
    // Split per applicatie = applicaties zijn hier de hoofdstructuur: elke
    // applicatie krijgt zijn eigen lane (blauw), Teambreed blijft een aparte
    // basislaag. Geen appTag nodig op de chips — welke applicatie het is,
    // blijkt al uit de lane zelf.
    const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
    const query = (laneFilterQuery ?? '').trim().toLowerCase()
    const visibleApplications = query ? applications.filter((app) => (app.naam || '').toLowerCase().includes(query)) : applications
    if (unlabeled.length > 0 && showTeambreed) placeApplicatieflowLane('unlabeled', t('teampage.teambreed'), unlabeled, 'teambreed')
    for (let i = visibleApplications.length - 1; i >= 0; i -= 1) {
      const app = visibleApplications[i]
      const appDeps = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).includes(app.id))
      placeApplicatieflowLane(app.id, app.naam || '—', appDeps, 'app')
    }

    // De koppelingen uit de Applicatieflow-vragenlijst ('welke applicatie
    // geeft werk/data door aan welke andere') worden hier als directe lijnen
    // tussen de lane-banners getekend — dat verving het losse netwerk-canvas
    // dat ApplicatieflowTab eerder zelf tekende. Standaard subtiel/niet-
    // geanimeerd; de hover-dim-laag verderop licht 'm op bij een gekoppelde app.
    applicatieflowConnecties.forEach((c) => {
      const sourceId = `appbanner:${c.van}`
      const targetId = `appbanner:${c.naar}`
      if (!nodes.some((n) => n.id === sourceId) || !nodes.some((n) => n.id === targetId)) return
      edges.push({
        id: `appconn:${c.id}`,
        source: sourceId,
        target: targetId,
        style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.35 },
      })
    })
  } else {
    // Samengevoegd = totaalbeeld van het team: applicaties zijn hier bewust
    // GEEN eigen node/lane meer, alleen nog context. Twee rustige subgroepen
    // binnen de Run flow-zone: Teambreed (niet-gelabeld, groen) en
    // Applicatiegerelateerd (gelabeld, neutraal) — in die laatste staan alle
    // gelabelde deps door elkaar in één wrap-rooster, elk met een klein
    // applicatienaam-tagje. Licht gesorteerd op eerste applicatielabel zodat
    // deps van dezelfde app in de praktijk vaak naast elkaar vallen, zonder
    // een harde scheiding/eigen lane per app te forceren.
    const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
    const labeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length > 0)
    const appIndexOf = new Map(applications.map((a, i) => [a.id, i]))
    const sortedLabeled = [...labeled].sort((a, b) => {
      const aIdx = Math.min(...(a.applicatieIds ?? []).map((id) => appIndexOf.get(id) ?? 999), 999)
      const bIdx = Math.min(...(b.applicatieIds ?? []).map((id) => appIndexOf.get(id) ?? 999), 999)
      return aIdx - bIdx
    })
    if (unlabeled.length > 0 && showTeambreed) placeApplicatieflowLane('unlabeled', t('teampage.teambreed'), unlabeled, 'teambreed')
    if (sortedLabeled.length > 0) {
      placeApplicatieflowLane('grouped', t('teampage.applicatiegerelateerd'), sortedLabeled, 'group', appTagLabel)
    }
  }

  const lastStage = WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1]

  // --- Gedeelde as: Run flow (boven) en Ontwikkelflow (onder) als één
  // canvas ---
  // Beide lagen delen dezelfde linker-/rechtergrens (ZONE_X/ZONE_WIDTH,
  // afgeleid van dezelfde STAGE_GAP-kolommen als de lanes/stage-rij), zodat
  // ze als één geheel ogen i.p.v. een los wit blok onder een los blauw blok.
  const ZONE_X = STAGE_START_X - LANE_PAD_X
  const ZONE_WIDTH = BANNER_WIDTH + LANE_PAD_X * 2
  const ZONE_PAD = 30
  const devZoneTop = STAGE_Y - ZONE_PAD
  const devZoneBottom = STAGE_Y + 80 + maxStackPerStage * 38 + ZONE_PAD
  const SEAM_GAP = 10
  const runflowZoneBottom = devZoneTop - SEAM_GAP
  const runflowZoneTop =
    topLaneY !== null ? topLaneY - LANE_PAD_TOP - ZONE_PAD : runflowZoneBottom - 140

  nodes.push({
    id: 'zone:runflow',
    type: 'flowZone',
    position: { x: ZONE_X, y: runflowZoneTop },
    data: {
      width: ZONE_WIDTH,
      height: runflowZoneBottom - runflowZoneTop,
      background: 'linear-gradient(180deg, #eef5fa 0%, #eaf1f7 100%)',
      border: '1px solid #2a5f8a26',
      radius: '22px 22px 0 0',
      shadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)',
      label: t('teampage.zoneRunflow'),
      labelBg: '#2a5f8a',
      labelColor: '#fff',
      labelBorder: 'none',
      labelDotColor: '#bcd6ea',
      labelShadow: '0 2px 6px rgba(42,95,138,0.35)',
      // Applicaties zijn in Samengevoegd geen eigen node meer — dit
      // tekstregeltje geeft nog wel aan hoeveel er meespelen, puur als
      // context bij de zone zelf.
      subtitle: !splitApplicaties && applications.length > 0 ? t('teampage.zoneRunflowAppsSubtitle', { count: applications.length }) : undefined,
    },
    draggable: false,
    selectable: false,
    zIndex: -3,
  })
  nodes.push({
    id: 'zone:devflow',
    type: 'flowZone',
    position: { x: ZONE_X, y: devZoneTop },
    data: {
      width: ZONE_WIDTH,
      height: devZoneBottom - devZoneTop,
      background: '#fdfdfe',
      border: '1px solid #e6eaef',
      radius: '0 0 20px 20px',
      shadow: '0 1px 2px rgba(15,23,42,0.03)',
      label: t('teampage.zoneOntwikkelflow'),
      labelBg: '#f4f6f8',
      labelColor: '#475569',
      labelBorder: '1px solid #e6eaef',
      labelDotColor: '#94a3b8',
      labelShadow: 'none',
    },
    draggable: false,
    selectable: false,
    zIndex: -3,
  })

  // Input/output splitsen op flowcontext: items zonder flowtype of met
  // 'applicatieflow' horen bij de Run flow-zone (huidig gedrag, dus geen
  // breaking change voor bestaande data); items met 'ontwikkelflow' vallen
  // nu binnen de Ontwikkelflow-zone zelf i.p.v. over de volle canvashoogte
  // te zweven.
  function stackCenteredInZone(items, zoneTop, zoneBottom) {
    const totalH = Math.max(0, items.length - 1) * IO_Y_GAP
    const startY = zoneTop + Math.max(24, (zoneBottom - zoneTop - totalH) / 2)
    return items.map((item, i) => ({ item, y: startY + i * IO_Y_GAP }))
  }

  const effectiveInputs = showIO ? inputs : []
  const effectiveOutputs = showIO ? outputs : []
  const runflowInputs = effectiveInputs.filter((item) => item.flowtype !== 'ontwikkelflow')
  const devInputs = effectiveInputs.filter((item) => item.flowtype === 'ontwikkelflow')
  const runflowOutputs = effectiveOutputs.filter((item) => item.flowtype !== 'ontwikkelflow')
  const devOutputs = effectiveOutputs.filter((item) => item.flowtype === 'ontwikkelflow')
  const runflowInEdgeTarget = baseLaneId ?? `stage:${WORKFLOW_STAGES[0]}`
  const runflowOutEdgeTarget = baseLaneId ?? `stage:${lastStage}`

  stackCenteredInZone(runflowInputs, runflowZoneTop, runflowZoneBottom).forEach(({ item, y }) => {
    const id = `input:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X - 210, y }),
      data: { kind: 'input', itemId: item.id, label: item.label, linkLabel: resolveLinkLabel(item), bronColor: bronTypeColor(item.bron_type), externalTeam: item.externalTeam },
      draggable: true,
    })
    edges.push({
      id: `input:${item.id}->${runflowInEdgeTarget}`,
      source: id,
      target: runflowInEdgeTarget,
      style: { stroke: '#2a5f8a', strokeWidth: 1.5 },
    })
  })
  stackCenteredInZone(runflowOutputs, runflowZoneTop, runflowZoneBottom).forEach(({ item, y }) => {
    const id = `output:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20, y }),
      data: { kind: 'output', itemId: item.id, label: item.label, externalTeam: item.externalTeam },
      draggable: true,
    })
    edges.push({
      id: `${runflowOutEdgeTarget}->output:${item.id}`,
      source: runflowOutEdgeTarget,
      target: id,
      style: { stroke: '#2a5f8a', strokeWidth: 1.5 },
    })
  })
  stackCenteredInZone(devInputs, devZoneTop, devZoneBottom).forEach(({ item, y }) => {
    const id = `input:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X - 210, y }),
      data: { kind: 'input', itemId: item.id, label: item.label, linkLabel: resolveLinkLabel(item), bronColor: bronTypeColor(item.bron_type), externalTeam: item.externalTeam },
      draggable: true,
    })
    edges.push({
      id: `input:${item.id}->stage:${WORKFLOW_STAGES[0]}`,
      source: id,
      target: `stage:${WORKFLOW_STAGES[0]}`,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })
  })
  stackCenteredInZone(devOutputs, devZoneTop, devZoneBottom).forEach(({ item, y }) => {
    const id = `output:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20, y }),
      data: { kind: 'output', itemId: item.id, label: item.label, externalTeam: item.externalTeam },
      draggable: true,
    })
    edges.push({
      id: `stage:${lastStage}->output:${item.id}`,
      source: `stage:${lastStage}`,
      target: id,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })
  })

  // Externe teams als subtiele randcontext: alleen via de 'Externe teams
  // tonen'-toggle, als kleine pil-nodes links van het canvas verbonden met
  // stippellijnen naar elke dependency/IO-chip die dat team noemt. Geen
  // aparte, altijd-zichtbare rij — de chips zelf tonen al een klein tagje
  // (zie DependencyMarkerNode/IoNode) ongeacht deze toggle.
  if (showExternalTeams) {
    const externalTeamRefs = new Map()
    function touchExtTeam(name, nodeId) {
      if (!name) return
      if (!externalTeamRefs.has(name)) externalTeamRefs.set(name, [])
      externalTeamRefs.get(name).push(nodeId)
    }
    teamDependencies.forEach((dep) => {
      const nodeId = depNodeIdByDepId.get(dep.id)
      if (nodeId) touchExtTeam(dep.geraakte_team_extern, nodeId)
    })
    inputs.forEach((item) => touchExtTeam(item.externalTeam, `input:${item.id}`))
    outputs.forEach((item) => touchExtTeam(item.externalTeam, `output:${item.id}`))

    const posById = new Map(nodes.map((n) => [n.id, n.position]))
    let extIndex = 0
    for (const [name, refs] of externalTeamRefs) {
      const extId = `externalTeam:${name}`
      nodes.push({
        id: extId,
        type: 'externalTeam',
        position: withSavedPosition(extId, { x: ZONE_X - 420, y: runflowZoneTop + extIndex * 66 }),
        data: { naam: name },
        draggable: true,
      })
      refs.forEach((refId) => {
        if (!posById.has(refId)) return
        edges.push({
          id: `extconn:${name}:${refId}`,
          source: extId,
          target: refId,
          style: { stroke: '#5c6b8a', strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.3 },
        })
      })
      extIndex += 1
    }
  }

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
    ? { id: generateId(), label: '', flowtype: '', bron_type: '', linkedTeam: '', linkedOutputId: '', applicatieId: '', externalTeam: '' }
    : { id: generateId(), label: '', flowtype: '', applicatieId: '', externalTeam: '' }
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
  if (item.externalTeam) parts.push(`↔ ${item.externalTeam}`)
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

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.ioExternalTeamLabel')}</label>
            <input
              value={draft.externalTeam ?? ''}
              onChange={(e) => update({ externalTeam: e.target.value })}
              placeholder={t('teampage.ioExternalTeamPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
          </div>

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
  // IO-item aangeklikt op het canvas: opent dezelfde IoItemModal als de
  // Input/Output-lijst, zonder de lijst-lokale modalItem-state aan te raken.
  const [canvasIoTarget, setCanvasIoTarget] = useState(null)
  const [canvasHover, setCanvasHover] = useState(null)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [appFilterQuery, setAppFilterQuery] = useState('')
  const [splitApplicaties, setSplitApplicaties] = useState(false)
  // Welke Run flow-lanes op het canvas zijn ingeklapt — puur presentatie,
  // niet bewaard, zodat teams met veel applicaties de stapel compact kunnen
  // houden zonder een onleesbare muur aan lanes.
  const [collapsedLaneIds, setCollapsedLaneIds] = useState(() => new Set())
  // Weergave-filters voor het Teamcanvas: puur presentatie, niet bewaard.
  const [showIO, setShowIO] = useState(true)
  const [showTeambreed, setShowTeambreed] = useState(true)
  const [riskFilterOn, setRiskFilterOn] = useState(false)
  const [showExternalTeams, setShowExternalTeams] = useState(false)
  const [viewFiltersOpen, setViewFiltersOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)

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

  const viewFilters = useMemo(
    () => ({ showIO, showTeambreed, riskFilterOn, showExternalTeams }),
    [showIO, showTeambreed, riskFilterOn, showExternalTeams],
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
    workflow.applications,
    splitApplicaties,
    workflow.applicatieflow?.connecties ?? [],
    t,
    language,
    onOpenApplicatieflow,
    appFilterQuery,
    collapsedLaneIds,
    toggleLaneCollapsed,
    viewFilters,
    setAppDetailId,
  ])

  // Lijnen worden pas duidelijk als niet-gerelateerde relaties wegvallen
  // zodra je iets aanwijst — zelfde hover-dim-patroon als GraphView.jsx
  // (hoverNodeId + een lichte stijl-laag over de edges, los van de layout-
  // berekening zelf zodat hoveren geen herberekening van nodes triggert).
  const [hoverNodeId, setHoverNodeId] = useState(null)
  const displayEdges = useMemo(() => {
    if (!hoverNodeId) return edges
    return edges.map((edge) => {
      const related = edge.source === hoverNodeId || edge.target === hoverNodeId
      const isAppConn = edge.id.startsWith('appconn:')
      return {
        ...edge,
        animated: isAppConn ? related : edge.animated,
        style: { ...edge.style, opacity: related ? 1 : (edge.style?.opacity ?? 1) * 0.15 },
      }
    })
  }, [edges, hoverNodeId])

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
      if (node.type === 'ioItem') {
        const items = node.data.kind === 'input' ? workflow.inputs : workflow.outputs
        const item = items.find((i) => i.id === node.data.itemId)
        if (item) setCanvasIoTarget({ kind: node.data.kind, item })
      }
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

  // Compacte hover-preview-inhoud per node-type — hergebruikt door alle
  // canvas-elementen (applicatie-lanes, dependencies, IO, workflowstappen,
  // externe teams) i.p.v. per type een eigen tooltip te bouwen.
  function buildCanvasTooltipContent(node) {
    if (node.type === 'dependencyMarker') {
      const dep = node.data.dependency
      const isRunflow = dep.flowtype === 'applicatieflow'
      const flowLabel = dep.flowtype ? translateFlowtype(dep.flowtype, language) : t('teampage.flowtypeUndetermined')
      const app = isRunflow ? workflow.applications.find((a) => (dep.applicatieIds ?? []).includes(a.id)) : null
      const scopeLabel = isRunflow ? app?.naam ?? t('teampage.teambreed') : translateWorkflowStap(dep.workflowStap, language)
      return { title: dep.titel, sub: [flowLabel, scopeLabel, translateRiskLevel(node.data.risk.level, language)].filter(Boolean).join(' · ') }
    }
    if (node.type === 'applicatieflowBanner') {
      return { title: node.data.label, sub: `${t('teampage.zoneRunflow')} · ${node.data.count} ${t('tooltip.dependencies')}` }
    }
    if (node.type === 'ioItem') {
      const parts = [node.data.kind === 'input' ? '→ IN' : 'OUT →', node.data.linkLabel, node.data.externalTeam ? `↔ ${node.data.externalTeam}` : null]
      return { title: node.data.label || '—', sub: parts.filter(Boolean).join(' · ') }
    }
    if (node.type === 'stage') {
      return { title: translateWorkflowStage(node.data.stage, language), sub: t('teampage.zoneOntwikkelflow') }
    }
    if (node.type === 'externalTeam') {
      return { title: node.data.naam, sub: t('teampage.legendExternalTeam') }
    }
    return null
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

  // Reset alleen de handmatig versleepte posities (niet de data zelf) zodat
  // useMergedLayout weer de vers berekende, uitgelijnde posities gebruikt —
  // een gebruiker-gestuurde actie, geen automatische herordening.
  function handleSmartOrder() {
    patch({ layout: {} })
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

            <div
              data-tour="toolbar"
              className="-mx-4 -mt-4 mb-3 flex min-h-[56px] flex-wrap items-center gap-1.5 rounded-t-xl border-b border-slate-200 bg-slate-50/70 px-4 py-2.5"
            >
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => addAnnotation('note')}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('teampage.toolbarNote')}
                </button>
                <button
                  type="button"
                  onClick={() => addAnnotation('shape', { shape: 'rect' })}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('teampage.toolbarRect')}
                </button>
                <button
                  type="button"
                  onClick={() => addAnnotation('shape', { shape: 'circle' })}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('teampage.toolbarCircle')}
                </button>
                <button
                  type="button"
                  onClick={() => addAnnotation('shape', { shape: 'diamond' })}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('teampage.toolbarDiamond')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLineToolActive((v) => !v)
                    setLineStart(null)
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    lineToolActive ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {t('teampage.toolbarLine')}
                </button>
                <div className="mx-1">
                  <ColorSwatchRow value={activeColor} onChange={setActiveColor} />
                </div>
                {lineToolActive && <span className="text-[11px] font-medium text-[#2a5f8a]">{t('teampage.toolbarLineActive')}</span>}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {splitApplicaties && workflow.applications.length > 4 && (
                  <input
                    value={appFilterQuery}
                    onChange={(e) => setAppFilterQuery(e.target.value)}
                    placeholder={t('teampage.appFilterPlaceholder')}
                    className="w-40 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                  />
                )}
                <div
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs shadow-inner"
                  role="group"
                  aria-label={t('teampage.viewModeLabel')}
                >
                  <button
                    type="button"
                    onClick={() => setSplitApplicaties(false)}
                    aria-pressed={!splitApplicaties}
                    className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                      !splitApplicaties ? 'bg-white text-[#2a5f8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('teampage.viewMerged')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitApplicaties(true)}
                    aria-pressed={splitApplicaties}
                    className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                      splitApplicaties ? 'bg-white text-[#2a5f8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('teampage.splitApplicaties')}
                  </button>
                </div>

                <div className="h-5 w-px bg-slate-200" />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setViewFiltersOpen((v) => !v)}
                    aria-expanded={viewFiltersOpen}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      viewFiltersOpen ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {t('teampage.viewFiltersButton')} ▾
                  </button>
                  {viewFiltersOpen && (
                    <div className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/10">
                      {[
                        { key: 'showIO', label: t('teampage.viewFilterShowIO'), value: showIO, onChange: setShowIO },
                        { key: 'showTeambreed', label: t('teampage.viewFilterShowTeambreed'), value: showTeambreed, onChange: setShowTeambreed },
                        { key: 'riskFilterOn', label: t('teampage.viewFilterRiskOnly'), value: riskFilterOn, onChange: setRiskFilterOn },
                        { key: 'showExternalTeams', label: t('teampage.viewFilterShowExternalTeams'), value: showExternalTeams, onChange: setShowExternalTeams },
                      ].map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => f.onChange((v) => !v)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                              f.value ? 'border-[#2a5f8a] bg-[#2a5f8a]' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {f.value && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSmartOrder}
                  title={t('teampage.smartOrderHint')}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('teampage.smartOrder')}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLegendOpen((v) => !v)}
                    aria-expanded={legendOpen}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      legendOpen ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {t('teampage.legend')}
                  </button>
                {legendOpen && (
                  <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.legendRiskTitle')}</div>
                    <div className="mb-3 space-y-1">
                      {['Kritiek', 'Hoog', 'Gemiddeld', 'Laag'].map((level) => (
                        <div key={level} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${riskStyle(level).dot}`} />
                          {translateRiskLevel(level, language)}
                        </div>
                      ))}
                    </div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.legendDisplayTitle')}</div>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-0.5 w-4 shrink-0 bg-[#2a5f8a]" />
                        {t('teampage.legendConnection')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 shrink-0 rounded border border-[#2a5f8a] bg-[#eef4f9]" />
                        {t('teampage.legendInput')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 shrink-0 rounded border border-[#5c8a72] bg-[#eef6f1]" />
                        {t('teampage.legendOutput')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-[#5c8a72]/50 bg-[#5c8a72]/10" />
                        {t('teampage.legendTeambreed')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-[#5c6b8a55] bg-white" />
                        {t('teampage.legendExternalTeam')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>

            <div
              data-tour="workflow-canvas"
              className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
              style={{ height: 'clamp(640px, 78vh, 920px)' }}
            >
              <PannableFlowCanvas
                className="teamcanvas-flow"
                nodes={nodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                onNodesChange={handleNodesChange}
                onNodeClick={handleNodeClick}
                onNodeMouseEnter={(event, node) => {
                  setHoverNodeId(node.id)
                  const content = buildCanvasTooltipContent(node)
                  if (content) setCanvasHover({ x: event.clientX, y: event.clientY, ...content })
                }}
                onNodeMouseMove={(event) => setCanvasHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                onNodeMouseLeave={() => {
                  setHoverNodeId(null)
                  setCanvasHover(null)
                }}
                fitViewOptions={{ padding: 0.12, minZoom: 0.45 }}
                minZoom={0.3}
                maxZoom={1.5}
                backgroundColor="#d3dbe3"
                showMinimap
              />
              {canvasHover && (
                <FloatingTooltip x={canvasHover.x} y={canvasHover.y}>
                  <div className="font-semibold text-slate-50">{canvasHover.title}</div>
                  {canvasHover.sub && <div className="mt-0.5 text-[11px] text-slate-300">{canvasHover.sub}</div>}
                </FloatingTooltip>
              )}
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

          {canvasIoTarget && (
            <IoItemModal
              kind={canvasIoTarget.kind}
              item={canvasIoTarget.item}
              onSave={(draft) => {
                if (canvasIoTarget.kind === 'input') updateInput(draft.id, draft)
                else updateOutput(draft.id, draft)
                setCanvasIoTarget(null)
              }}
              onRemove={() => {
                if (canvasIoTarget.kind === 'input') removeInput(canvasIoTarget.item.id)
                else removeOutput(canvasIoTarget.item.id)
                setCanvasIoTarget(null)
              }}
              onClose={() => setCanvasIoTarget(null)}
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              applications={workflow.applications}
              t={t}
              language={language}
            />
          )}

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
