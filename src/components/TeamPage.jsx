import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import {
  WORKFLOW_STAGES,
  BRON_TYPES,
  SENIORITY_LEVELS,
  RISICO_BIJ_UITVAL,
  WORKFLOW_STAP_TO_STAGE,
  FLOWTYPE_LEVELS,
  WORKFLOW_STAP_LEVELS,
  STATUS_LEVELS,
  RISK_LEVELS,
} from '../data/constants'
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
import { buildDuplicatePrefill } from '../lib/duplicateDependency'
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

const HIGH_RISK_LEVELS = ['Hoog', 'Kritiek']
// Node-types die meedimmen zodra er canvas-focus actief is (zie
// displayNodes in TeamPage) — structurele elementen (zones, lane-
// achtergronden, workflowstappen) staan hier bewust niet bij.
const DIMMABLE_NODE_TYPES = new Set(['dependencyMarker', 'ioItem', 'applicatieflowBanner', 'externalTeam', 'capacityBadge'])
// Node-types die op klik het compacte focuspaneel openen i.p.v. meteen een
// volledige modal (zie handleNodeClick in TeamPage). dependencyMarker zit
// hier bewust niet meer bij — die opent nu meteen de volledige modal.
const FOCUSABLE_NODE_TYPES = new Set(['applicatieflowBanner', 'ioItem', 'externalTeam', 'capacityBadge'])

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

// Onzichtbaar ankerpunt in het midden van de Run flow-zone — alleen gebruikt
// als edge-target voor Run flow-IO-lijntjes wanneer er geen enkele
// applicatie-/Teambreed-lane bestaat om aan te haken (anders viel de lijn
// terug op de Ontwikkelflow-stagerij, wat het leek alsof de input/output bij
// Ontwikkelflow hoorde terwijl 'ie in de Run flow-zone stond).
function FlowAnchorNode() {
  return (
    <div className="h-px w-px">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function StageNode({ data }) {
  const { language } = useLanguage()
  return (
    <div
      className="relative w-44 overflow-hidden rounded-xl border border-slate-200/90 bg-white py-3.5 pl-3.5 pr-4 shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
      style={{ borderLeftWidth: 4, borderLeftColor: data.color }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.35 }} />
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: data.color }} />
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
      {/* Compacte flowcontext direct op de kaart — hoort dit bij Run flow of
          Ontwikkelflow, en bij een applicatie of Teambreed — i.p.v. alleen
          via hover zichtbaar. */}
      {data.meta && <div className="mt-0.5 truncate text-[9px] font-medium text-slate-400">{data.meta}</div>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0.35 }} />
    </div>
  )
}

function CapacityBadgeNode({ data }) {
  const { language } = useLanguage()
  return (
    <div className="relative flex w-44 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
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
  const { t } = useLanguage()
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
          onClick={(e) => {
            // Los van de node-klik (die opent het focuspaneel) — in/uitklappen
            // mag geen focus openen.
            e.stopPropagation()
            data.onToggleCollapse()
          }}
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
      {/* Geen eigen onClick meer: de node-klik (ReactFlow's onNodeClick, zie
          handleNodeClick in TeamPage) opent nu het focuspaneel; data.onClick
          (naar de app-detailmodal of Applicatieflow-sectie) is verplaatst
          naar de actieknop in dat paneel. */}
      <div className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 pr-1.5 text-left">
        <span className="truncate text-sm font-semibold" style={{ color: accentColor }}>
          {data.label}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {/* Rust-indicator voor applicatiekoppelingen i.p.v. een permanent
              zichtbare lijn: de lijn zelf staat op zeer lage rust-opacity en
              licht pas op bij hover/focus (zie appconn-edges hierboven). */}
          {data.accent === 'app' && data.connCount > 0 && (
            <span
              className="rounded-full px-1.5 py-[1px] text-[10px] font-medium"
              style={{ color: accentColor, backgroundColor: `${accentColor}14` }}
              title={t('teampage.laneConnCountHint', { count: data.connCount })}
            >
              ↔ {data.connCount}
            </span>
          )}
          <span className="text-xs" style={{ color: `${accentColor}b3` }}>
            {data.count > 0 ? data.count : data.emptyLabel}
          </span>
        </span>
      </div>
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
      className="pointer-events-none relative rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      style={{
        width: data.width,
        height: data.height,
        border: `1px solid ${accentColor}2e`,
        background: data.accent === 'app' ? 'rgba(255,255,255,0.6)' : `${accentColor}0a`,
      }}
    >
      {/* Optioneel label-pilletje, bv. voor de losstaande Ontwikkelflow-
          Teambreed-band — de gewone Applicatieflow-lanes tonen hun naam al
          via de banner zelf en geven hier geen label mee. */}
      {data.label && (
        <span
          className="absolute left-3.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: accentColor, boxShadow: `0 2px 6px ${accentColor}59` }}
        >
          {data.label}
        </span>
      )}
    </div>
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
      {/* Zonder label (bv. de smalle 'seam'-overgangsstrook tussen Run flow
          en Ontwikkelflow) is dit puur een decoratief vlak. */}
      {data.label && (
        <span
          className="absolute left-5 top-3.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ background: data.labelBg, color: data.labelColor, border: data.labelBorder, boxShadow: data.labelShadow }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.labelDotColor }} />
          {data.label}
        </span>
      )}
      {/* Korte samenvatting naast het label, bv. hoeveel applicaties er in
          deze Run flow meespelen — puur context, geen aparte structuur. */}
      {data.subtitle && (
        <span className="absolute left-5 top-[46px] text-[11px] font-medium" style={{ color: data.labelColor === '#fff' ? '#5479a3' : '#94a3b8' }}>
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
  flowAnchor: FlowAnchorNode,
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
  const {
    showIO = true,
    showTeambreed = true,
    riskFilterOn = false,
    showExternalTeams = false,
  } = viewFilters ?? {}
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
  // De workflowstap bepaalt waar een Ontwikkelflow-dependency terechtkomt —
  // niet of hij toevallig een applicatielabel heeft. Mét stap staat hij onder
  // die stagekolom (ook zonder applicatielabel); zónder herleidbare stap is
  // hij per definitie niet aan één fase gebonden en valt hij in de
  // 'Proces-overstijgend'-lane onder de hele kolomstapel. Dit is dezelfde
  // groepering als de dependencylijst onder het canvas al hanteerde.
  const depsByStage = {}
  for (const dep of teamDependencies) {
    if (dep.flowtype !== 'ontwikkelflow') continue
    const stage = WORKFLOW_STAP_TO_STAGE[dep.workflowStap]
    if (!stage) continue
    if (!depsByStage[stage]) depsByStage[stage] = []
    depsByStage[stage].push(dep)
  }
  const ontwikkelflowTeambreedDeps = teamDependencies.filter(
    (dep) => dep.flowtype === 'ontwikkelflow' && !WORKFLOW_STAP_TO_STAGE[dep.workflowStap],
  )
  const maxStackPerStage = Math.max(
    0,
    ...WORKFLOW_STAGES.map((s) => (capacityByStage[s]?.length ?? 0) + (depsByStage[s]?.length ?? 0)),
  )

  // --- Gedeelde as: Run flow (boven) en Ontwikkelflow (onder) als één canvas ---
  // Deze zonegrenzen worden hier, vóór de lane-plaatsing, berekend — niet pas
  // erna — zodat de lane-stapeling (verderop) zijn eigen vloer kan afleiden
  // van de échte Run flow-zonegrens (`runflowZoneBottom`) i.p.v. van een los
  // vast getal. Dat voorkomt dat lane-inhoud structureel buiten zijn eigen
  // zone kan vallen, ongeacht hoeveel content erin zit.
  // +176 (i.p.v. de kaartbreedte zelf, 176px = w-44) zodat de zone-rechterrand
  // na de laatste stage-kaart exact zoveel ruimte overhoudt (LANE_PAD_X) als
  // de zone-linkerrand vóór de eerste stage-kaart al had — anders staat de
  // laatste kolom (Beheer/nazorg) vrijwel tegen de rand aan.
  const BANNER_WIDTH = (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 176
  // Padding van elk lane-achtergrondkader — hier al gedeclareerd (i.p.v. pas
  // in de lane-sectie verderop) omdat zowel de zonegrenzen als de lane-vloer
  // (verderop) er beide van afhangen.
  const LANE_PAD_X = 14
  const LANE_PAD_TOP = 10
  const LANE_PAD_BOTTOM = 14
  // Beide lagen delen dezelfde linker-/rechtergrens (ZONE_X/ZONE_WIDTH,
  // afgeleid van dezelfde STAGE_GAP-kolommen als de lanes/stage-rij), zodat
  // ze als één geheel ogen i.p.v. een los wit blok onder een los blauw blok.
  const ZONE_X = STAGE_START_X - LANE_PAD_X
  const ZONE_WIDTH = BANNER_WIDTH + LANE_PAD_X * 2

  // --- Applicatieflow-lane bouwstenen ---
  // Hier al gedeclareerd (i.p.v. pas in de Run flow-lanesectie verderop)
  // omdat zowel de Ontwikkelflow-zonehoogte hieronder (die moet rekening
  // houden met de Proces-overstijgend-lane) als de latere Run flow-lanes ze
  // allebei nodig hebben.
  const LANE_BANNER_W = 210
  const LANE_ITEM_W = 195
  const LANE_CONTENT_GAP = 18
  const LANE_ROW_H = 52
  const LANE_GAP = 22
  const LANE_PACK_GAP_X = 24
  // Extra ademruimte tussen de laatste chip van de ene applicatie en de
  // eerste van de volgende binnen de Applicatiegerelateerd-groep (Samen-
  // gevoegd) — puur visuele clustering, geen aparte kaart/lane per app.
  const LANE_CLUSTER_GAP = 16
  // Teambreed-lanes ('Applicatie-overstijgend'/'Proces-overstijgend') hebben
  // geen eigen bannerkaart — alleen het losse label-pilletje op het
  // achtergrondkader (LaneGroupNode). Chips beginnen daarom aan de
  // linkerkant van het kader i.p.v. na een banner, met deze marge bovenaan
  // zodat ze nooit tegen het pilletje aan komen te staan.
  const LANE_BADGE_PAD_TOP = 46
  const LANE_PACK_MAX_WIDTH = BANNER_WIDTH - LANE_PAD_X * 2

  // Berekent voor elke dep een {row, x}-positie binnen de lane, en hoeveel
  // breedte de volst gevulde rij daadwerkelijk gebruikt — dat laatste bepaalt
  // de lane z'n eigen (compacte) breedte i.p.v. altijd de volle zonebreedte.
  function layoutLaneItems(deps, perRow, appIdOf) {
    const itemPos = new Map()
    let maxRowWidth = 0
    let row = 0
    let col = 0
    let x = 0
    let prevAppId = null
    deps.forEach((dep) => {
      if (col >= perRow) {
        row += 1
        col = 0
        x = 0
        prevAppId = null
      }
      const appId = appIdOf ? appIdOf(dep) : null
      if (appIdOf && prevAppId !== null && appId !== prevAppId) x += LANE_CLUSTER_GAP
      itemPos.set(dep.id, { row, x })
      x += LANE_ITEM_W
      if (x > maxRowWidth) maxRowWidth = x
      col += 1
      prevAppId = appId
    })
    return { itemPos, maxRowWidth }
  }

  // Chips vullen eerst de volle beschikbare breedte van de lane (zoveel
  // kolommen als er passen) en wrappen pas naar een tweede rij als het echt
  // niet meer past — elke lane krijgt altijd zijn eigen rij (forceOwnRow),
  // dus er is geen reden meer om ze kunstmatig op een laag vast aantal
  // kolommen te houden.
  function groupApplicatieflowDeps(deps, appIdOf, accent) {
    const hasBanner = accent !== 'teambreed'
    const availableWidth = LANE_PACK_MAX_WIDTH - (hasBanner ? LANE_BANNER_W + LANE_CONTENT_GAP : 0)
    const maxCols = Math.max(1, Math.floor(availableWidth / LANE_ITEM_W))
    const perRow = Math.max(1, Math.min(maxCols, deps.length))
    const rows = deps.length > 0 ? Math.ceil(deps.length / perRow) : 1
    const contentHeight = Math.max(LANE_ROW_H, rows * LANE_ROW_H)
    const height = hasBanner ? contentHeight : LANE_BADGE_PAD_TOP + contentHeight
    const { itemPos, maxRowWidth } = layoutLaneItems(deps, perRow, appIdOf)
    const contentWidth = Math.max(LANE_ITEM_W, maxRowWidth)
    const width = hasBanner ? LANE_BANNER_W + LANE_CONTENT_GAP + contentWidth : contentWidth
    return { height, itemPos, width }
  }

  // Losse boven-/onderpadding: bovenaan moet er ruimte zijn voor het
  // label-pilletje ('RUN FLOW'/'ONTWIKKELFLOW', ~52-55px hoog inclusief zijn
  // eigen top-offset) zodat de eerste lane/stage-rij er niet overheen valt;
  // onderaan is dat niet nodig, dus die padding mag kleiner blijven.
  const ZONE_TOP_PAD = 66
  const ZONE_BOTTOM_PAD = 30
  const devZoneTop = STAGE_Y - ZONE_TOP_PAD
  // Proces-overstijgend-lane: eigen sectie ónder de gewone kolomstapel, met
  // een vaste marge zodat hij nooit tegen de laatste kaart van de
  // kolomstapel aan komt te staan — en, als hij niet nodig is (geen
  // procesoverstijgende Ontwikkelflow-dependencies, of uitgezet via
  // 'Weergeven'), telt hij niet mee in de zonehoogte (geen lege
  // placeholder-ruimte).
  const appStackBottom = STAGE_Y + 80 + maxStackPerStage * 38
  const TEAMBREED_BAND_GAP = 30
  const hasOntwikkelflowTeambreed = showTeambreed && ontwikkelflowTeambreedDeps.length > 0
  const teambreedBandTop = appStackBottom + TEAMBREED_BAND_GAP
  const teambreedBandHeight = hasOntwikkelflowTeambreed
    ? groupApplicatieflowDeps(ontwikkelflowTeambreedDeps, undefined, 'teambreed').height + LANE_PAD_TOP + LANE_PAD_BOTTOM
    : 0
  const devZoneBottom = (hasOntwikkelflowTeambreed ? teambreedBandTop + teambreedBandHeight : appStackBottom) + ZONE_BOTTOM_PAD
  // SEAM_H is geen lege kloof maar de hoogte van een overgangsvlak (zie
  // 'zone:seam' verderop) dat de blauwe Run flow-tint geleidelijk laat
  // overlopen in de witte Ontwikkelflow-zone, zodat het één doorlopend
  // canvas oogt i.p.v. twee losse afgeronde blokken met een randje ertussen.
  const SEAM_H = 16
  const runflowZoneBottom = devZoneTop - SEAM_H

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
        style: { stroke: '#64748b', strokeWidth: 2, opacity: 0.55 },
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
          rowId: row.id,
          functieNaam: row.rol,
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
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.45 },
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
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.45 },
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
            style: { stroke: '#7a5c8a', strokeWidth: 1, strokeDasharray: '5 4', opacity: 0.04 },
          })
        })
      }
    })
  })

  // --- Proces-overstijgend-lane: eigen, duidelijk afgebakende sectie ónder
  // de gewone kolomstapel, voor Ontwikkelflow-dependencies zonder
  // applicatielabel. Geen kolomuitlijning per workflowstap (die horen per
  // definitie niet bij één specifieke fase) — gebruikt dezelfde lane-opbouw
  // als Run flow's 'Applicatie-overstijgend', alleen losstaand onder de hele
  // kolomstapel geplaatst zodat de twee elkaar nooit raken.
  if (hasOntwikkelflowTeambreed) {
    const { height: tbHeight, width: tbWidth } = groupApplicatieflowDeps(ontwikkelflowTeambreedDeps, undefined, 'teambreed')
    pushApplicatieflowLane(
      'ontwikkelflow-teambreed',
      t('teampage.procesOverstijgend'),
      ontwikkelflowTeambreedDeps,
      STAGE_START_X,
      teambreedBandTop + LANE_PAD_TOP,
      false,
      'teambreed',
      undefined,
      undefined,
      tbWidth,
      tbHeight,
      undefined,
    )
  }

  // --- Run flow-lane(s) boven de stage-rij ---
  // Run flow-dependencies horen bij hún applicatie, niet bij een
  // workflowstap — ze staan dus NIET meer op de Ontwikkelflow-kolommen
  // uitgelijnd (dat maakte een lane een tweede, gedupliceerde kolomrij).
  // Elke lane is compact: breedte volgt de eigen inhoud (banner + chips,
  // wrap pas als de volle zonebreedte niet meer past) i.p.v. altijd de volle
  // zonebreedte — meerdere lanes pakken daardoor naast elkaar in dezelfde
  // rij ('shelf'-packing, zie packLaneGroup hieronder) i.p.v. elk een eigen,
  // vaak grotendeels lege rij te vullen. Teambreed krijgt altijd zijn eigen
  // rij (nooit naast een applicatie-lane gepakt) zodat de zone-indeling —
  // Run flow-applicaties versus Applicatie-overstijgend — visueel duidelijk
  // blijft, ook als de lanes zelf compacter worden.
  const applicatieflowDeps = teamDependencies.filter((d) => d.flowtype === 'applicatieflow')

  function pushApplicatieflowLane(id, label, deps, x, y, collapsed, accent, appTagFor, appIdOf, width, height, connCount) {
    const bid = `appbanner:${id}`
    // Teambreed heeft geen eigen bannerkaart meer — alleen het label-
    // pilletje op het achtergrondkader zelf, net als de Ontwikkelflow-
    // Teambreed-band. 'app'/'group'-lanes behouden hun banner (nodig voor de
    // klik-naar-detail en de in/uitklap-toggle).
    const hasBanner = accent !== 'teambreed'
    const { itemPos } = groupApplicatieflowDeps(deps, appIdOf, accent)
    const effectiveHeight = collapsed ? LANE_ROW_H : height
    const effectiveWidth = collapsed ? LANE_BANNER_W : width

    const bgId = `${bid}:bg`
    nodes.push({
      id: bgId,
      type: 'laneGroup',
      position: { x: x - LANE_PAD_X, y: y - LANE_PAD_TOP },
      data: {
        width: effectiveWidth + LANE_PAD_X * 2,
        height: effectiveHeight + LANE_PAD_TOP + LANE_PAD_BOTTOM,
        accent,
        label: hasBanner ? undefined : label,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    })

    if (hasBanner) {
      nodes.push({
        id: bid,
        type: 'applicatieflowBanner',
        position: withSavedPosition(bid, { x, y }),
        data: {
          width: LANE_BANNER_W,
          label,
          count: deps.length,
          deps,
          connCount: connCount ?? 0,
          emptyLabel: t('teampage.applicatieflowBannerEmpty'),
          accent,
          // Een echte applicatie-lane opent de detailmodal van die applicatie;
          // Applicatiegerelateerd heeft geen specifieke applicatie om te
          // tonen en springt daarom naar de Applicaties-sectie.
          onClick: accent === 'app' && onOpenAppDetail ? () => onOpenAppDetail(id) : onOpenApplicatieflow,
          collapsed,
          onToggleCollapse: onToggleLaneCollapse ? () => onToggleLaneCollapse(id) : undefined,
          toggleLabel: collapsed ? t('teampage.laneExpand') : t('teampage.laneCollapse'),
        },
        draggable: true,
      })
    }

    if (collapsed) return

    deps.forEach((dep) => {
      const { row, x: colX } = itemPos.get(dep.id)
      const mid = `${bid}:dep:${dep.id}`
      depNodeIdByDepId.set(dep.id, mid)
      const risk = calculateRisk(dep)
      nodes.push({
        id: mid,
        type: 'dependencyMarker',
        position: withSavedPosition(mid, {
          x: x + (hasBanner ? LANE_BANNER_W + LANE_CONTENT_GAP : 0) + colX,
          y: y + (hasBanner ? 0 : LANE_BADGE_PAD_TOP) + row * LANE_ROW_H,
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
      // Zonder banner is er geen node meer om de chip mee te verbinden — de
      // omsluitende kader (laneGroup) toont de groepering al visueel.
      if (hasBanner) {
        edges.push({ id: `${bid}->${mid}`, source: bid, target: mid, style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.45 } })
      }
    })
  }

  // LANE_STACK_GAP houdt rekening met de padding van elke lane's achtergrond-
  // kader (LANE_PAD_TOP/BOTTOM), anders overlappen de kaders van opeenvolgende
  // rijen elkaar net iets.
  const LANE_STACK_GAP = LANE_GAP + LANE_PAD_TOP + LANE_PAD_BOTTOM
  // Vloer voor de lane-stapeling wordt afgeleid van de échte Run flow-
  // zonegrens (runflowZoneBottom, hierboven al berekend) in plaats van een
  // los vast getal vanaf STAGE_Y — zo is een minimale marge tussen de
  // dichtstbijzijnde lane en de Ontwikkelflow-naad gegarandeerd in de
  // rekensom zelf, ongeacht hoeveel content er in de lanes zit.
  const RUNFLOW_GAP_ABOVE_SEAM = 32
  let applicatieflowTop = runflowZoneBottom - RUNFLOW_GAP_ABOVE_SEAM - LANE_PAD_BOTTOM
  let topLaneY = null
  // Id van de lane/groep dichtst bij de stage-rij — het natuurlijke
  // aanknopingspunt voor Run flow-IO, analoog aan hoe Ontwikkelflow-IO aan de
  // eerste/laatste workflowstap hangt.
  let baseLaneId = null

  // 'Shelf'-packing: elke aangevraagde lane krijgt zijn eigen (compacte)
  // breedte; lanes pakken links-naar-rechts in dezelfde rij tot de
  // zonebreedte vol is, en wrappen dan naar een nieuwe rij. Een lane met
  // forceOwnRow (Teambreed) sluit de huidige rij altijd af en krijgt een rij
  // voor zichzelf, zodat 'm nooit tussen applicatie-lanes in komt te staan.
  // Rijen worden ná elkaar geplaatst met de EERSTE rij bovenaan (verst van de
  // stage-rij) en de LAATSTE rij het dichtst bij de stage-rij — lanes die
  // later in de aangeleverde lijst staan (bv. Teambreed, altijd als laatste
  // toegevoegd) komen dus dicht tegen Ontwikkelflow aan te liggen, als een
  // rustige basislaag onder de applicatie-lanes.
  function placeLaneGroup(requests) {
    if (requests.length === 0) return
    const sized = requests.map((r) => {
      // Teambreed heeft geen bannerkaart meer en dus ook geen in/uitklap-
      // toggle meer — altijd volledig getoond.
      const collapsed = r.accent === 'teambreed' ? false : (collapsedLaneIds?.has(r.id) ?? false)
      const { height, width } = groupApplicatieflowDeps(r.deps, r.appIdOf, r.accent)
      return { ...r, collapsed, height: collapsed ? LANE_ROW_H : height, width: collapsed ? LANE_BANNER_W : width }
    })

    const rows = []
    let currentRow = []
    let currentRowWidth = 0
    sized.forEach((lane) => {
      const w = lane.width + LANE_PACK_GAP_X
      const fitsInRow = currentRow.length === 0 || currentRowWidth + w <= LANE_PACK_MAX_WIDTH
      if (lane.forceOwnRow && currentRow.length > 0) {
        rows.push(currentRow)
        currentRow = []
        currentRowWidth = 0
      } else if (!fitsInRow) {
        rows.push(currentRow)
        currentRow = []
        currentRowWidth = 0
      }
      currentRow.push(lane)
      currentRowWidth += w
      if (lane.forceOwnRow) {
        rows.push(currentRow)
        currentRow = []
        currentRowWidth = 0
      }
    })
    if (currentRow.length > 0) rows.push(currentRow)

    const rowHeights = rows.map((row) => Math.max(...row.map((l) => l.height)))
    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rows.length - 1) * LANE_STACK_GAP

    applicatieflowTop -= totalHeight
    let rowY = applicatieflowTop
    rows.forEach((row, ri) => {
      let x = STAGE_START_X
      row.forEach((lane) => {
        pushApplicatieflowLane(lane.id, lane.label, lane.deps, x, rowY, lane.collapsed, lane.accent, lane.appTagFor, lane.appIdOf, lane.width, lane.height, lane.connCount)
        if (ri === rows.length - 1 && baseLaneId === null) baseLaneId = `appbanner:${lane.id}`
        x += lane.width + LANE_PACK_GAP_X
      })
      rowY += rowHeights[ri] + LANE_STACK_GAP
    })
    topLaneY = applicatieflowTop
    applicatieflowTop -= LANE_STACK_GAP
  }

  function primaryAppId(dep) {
    return (dep.applicatieIds ?? [])[0]
  }

  function appTagLabel(dep) {
    const names = (dep.applicatieIds ?? []).map((id) => applications.find((a) => a.id === id)?.naam).filter(Boolean)
    if (names.length === 0) return undefined
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
  }

  if (splitApplicaties && applications.length > 0) {
    const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
    const teambreedRequest =
      unlabeled.length > 0 && showTeambreed
        ? { id: 'unlabeled', label: t('teampage.appOverstijgend'), deps: unlabeled, accent: 'teambreed', forceOwnRow: true }
        : null

    // Applicatielanes: applicaties zijn hier de hoofdstructuur, elke
    // applicatie krijgt zijn eigen compacte lane (blauw) die naast andere
    // lanes pakt i.p.v. een eigen volle rij te vullen. Een applicatie zonder
    // Run flow-dependencies krijgt bewust GEEN lane (leeg blokje is een
    // storende placeholder) — hij blijft gewoon beheersbaar in de sectie
    // 'Applicaties in beheer/ontwikkeling' onder het canvas, alleen niet op
    // dit canvas zichtbaar zolang er niets aan gelabeld is. Teambreed staat
    // er altijd los onder, als eigen rij.
    const query = (laneFilterQuery ?? '').trim().toLowerCase()
    const visibleApplications = query ? applications.filter((app) => (app.naam || '').toLowerCase().includes(query)) : applications
    // Aantal app-naar-app-koppelingen per applicatie, voor het '↔ N'-badge op
    // de banner — vervangt de permanent geteekende lijn als rust-indicator.
    const connCountByAppId = {}
    applicatieflowConnecties.forEach((c) => {
      connCountByAppId[c.van] = (connCountByAppId[c.van] ?? 0) + 1
      connCountByAppId[c.naar] = (connCountByAppId[c.naar] ?? 0) + 1
    })
    const appRequests = visibleApplications
      .map((app) => ({
        id: app.id,
        label: app.naam || '—',
        deps: applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).includes(app.id)),
        accent: 'app',
        connCount: connCountByAppId[app.id] ?? 0,
        // Elke applicatie krijgt in Split per applicatie zijn eigen rij
        // (nooit naast een andere applicatie-lane gepakt), zodat de lijst
        // altijd netjes onder elkaar staat: banner links, dependencies rechts.
        forceOwnRow: true,
      }))
      .filter((r) => r.deps.length > 0)
    placeLaneGroup(teambreedRequest ? [...appRequests, teambreedRequest] : appRequests)

    // De koppelingen uit de Applicatieflow-vragenlijst ('welke applicatie
    // geeft werk/data door aan welke andere') worden hier als directe
    // lijnen tussen de lane-banners getekend. Rust-opacity is heel laag (de
    // '↔ N'-badge op de banner is de permanente indicator); de hover-dim-laag
    // verderop licht de lijn pas op zodra je een van de twee gekoppelde
    // banners hovert/focust.
    applicatieflowConnecties.forEach((c) => {
      const sourceId = `appbanner:${c.van}`
      const targetId = `appbanner:${c.naar}`
      if (!nodes.some((n) => n.id === sourceId) || !nodes.some((n) => n.id === targetId)) return
      edges.push({
        id: `appconn:${c.id}`,
        source: sourceId,
        target: targetId,
        style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.05 },
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
    const groupRequests = []
    if (sortedLabeled.length > 0) {
      groupRequests.push({
        id: 'grouped',
        label: t('teampage.applicatiegerelateerd'),
        deps: sortedLabeled,
        accent: 'group',
        appTagFor: appTagLabel,
        appIdOf: primaryAppId,
      })
    }
    if (unlabeled.length > 0 && showTeambreed) {
      groupRequests.push({ id: 'unlabeled', label: t('teampage.appOverstijgend'), deps: unlabeled, accent: 'teambreed', forceOwnRow: true })
    }
    placeLaneGroup(groupRequests)
  }

  const lastStage = WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1]

  // ZONE_X/ZONE_WIDTH/ZONE_TOP_PAD/devZoneTop/devZoneBottom/SEAM_H/
  // runflowZoneBottom zijn al hierboven berekend (vóór de lane-plaatsing) —
  // hier volgt alleen nog runflowZoneTop, die pas ná lane-plaatsing bekend
  // kan zijn (afhankelijk van topLaneY).
  const runflowZoneTop =
    topLaneY !== null ? topLaneY - LANE_PAD_TOP - ZONE_TOP_PAD : runflowZoneBottom - 140

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
  // Naadloze overgang: vult exact de ruimte tussen de twee zones met een
  // vloeiende kleurovergang, geen randradius/border — de twee afgeronde
  // blokken lezen zo als één doorlopend canvas i.p.v. twee losse vlakken.
  nodes.push({
    id: 'zone:seam',
    type: 'flowZone',
    position: { x: ZONE_X, y: runflowZoneBottom },
    data: {
      width: ZONE_WIDTH,
      height: SEAM_H,
      background: 'linear-gradient(180deg, #eaf1f7 0%, #fdfdfe 100%)',
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
  // Compacte flowcontext direct op de IO-kaart (i.p.v. alleen bij hover):
  // hoort dit bij Run flow of Ontwikkelflow, en bij een applicatie of
  // Teambreed?
  function ioMetaLabel(item) {
    const flowLabel = item.flowtype === 'ontwikkelflow' ? t('teampage.zoneOntwikkelflow') : t('teampage.zoneRunflow')
    const app = item.applicatieId ? applications.find((a) => a.id === item.applicatieId) : null
    const scopeLabel = app ? app.naam || '—' : t('teampage.teambreed')
    return `${flowLabel} · ${scopeLabel}`
  }

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
  // Als er geen enkele lane bestaat (geen applicaties/Teambreed-deps) hebben
  // Run flow-IO-lijntjes niets om aan te haken binnen de Run flow-zone zelf —
  // zonder dit anker vielen ze terug op de Ontwikkelflow-stagerij, waardoor
  // het leek alsof een Run flow-input bij Ontwikkelflow hoorde.
  let runflowInEdgeTarget = baseLaneId
  let runflowOutEdgeTarget = baseLaneId
  if (!baseLaneId) {
    nodes.push({
      id: 'runflowAnchor',
      type: 'flowAnchor',
      position: { x: ZONE_X + ZONE_WIDTH / 2, y: (runflowZoneTop + runflowZoneBottom) / 2 },
      draggable: false,
      selectable: false,
    })
    runflowInEdgeTarget = 'runflowAnchor'
    runflowOutEdgeTarget = 'runflowAnchor'
  }

  stackCenteredInZone(runflowInputs, runflowZoneTop, runflowZoneBottom).forEach(({ item, y }) => {
    const id = `input:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X - 210, y }),
      data: { kind: 'input', itemId: item.id, label: item.label, linkLabel: resolveLinkLabel(item), bronColor: bronTypeColor(item.bron_type), externalTeam: item.externalTeam, meta: ioMetaLabel(item) },
      draggable: true,
    })
    edges.push({
      id: `input:${item.id}->${runflowInEdgeTarget}`,
      source: id,
      target: runflowInEdgeTarget,
      style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.04 },
    })
  })
  stackCenteredInZone(runflowOutputs, runflowZoneTop, runflowZoneBottom).forEach(({ item, y }) => {
    const id = `output:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20, y }),
      data: { kind: 'output', itemId: item.id, label: item.label, externalTeam: item.externalTeam, meta: ioMetaLabel(item) },
      draggable: true,
    })
    edges.push({
      id: `${runflowOutEdgeTarget}->output:${item.id}`,
      source: runflowOutEdgeTarget,
      target: id,
      style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.04 },
    })
  })
  stackCenteredInZone(devInputs, devZoneTop, devZoneBottom).forEach(({ item, y }) => {
    const id = `input:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X - 210, y }),
      data: { kind: 'input', itemId: item.id, label: item.label, linkLabel: resolveLinkLabel(item), bronColor: bronTypeColor(item.bron_type), externalTeam: item.externalTeam, meta: ioMetaLabel(item) },
      draggable: true,
    })
    edges.push({
      id: `input:${item.id}->stage:${WORKFLOW_STAGES[0]}`,
      source: id,
      target: `stage:${WORKFLOW_STAGES[0]}`,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.04 },
    })
  })
  stackCenteredInZone(devOutputs, devZoneTop, devZoneBottom).forEach(({ item, y }) => {
    const id = `output:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20, y }),
      data: { kind: 'output', itemId: item.id, label: item.label, externalTeam: item.externalTeam, meta: ioMetaLabel(item) },
      draggable: true,
    })
    edges.push({
      id: `stage:${lastStage}->output:${item.id}`,
      source: `stage:${lastStage}`,
      target: id,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.04 },
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
        y: Math.max(devZoneBottom + 20, canvasHeightFor(inputs, outputs) + 40) + Math.floor(i / 6) * 190,
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
  const annotationBaseY = Math.max(devZoneBottom + 20, canvasHeightFor(inputs, outputs) + 40)
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

// Klein modal voor de toelichting/risico-bij-uitval van één applicatie —
// getriggerd vanuit 'Applicaties in beheer/ontwikkeling' zelf. Stond eerder
// in een eigen 'Applicatie-details'-blok naast de koppel-vragenlijst, wat
// samen met die lijst als dubbelop aanvoelde.
function ApplicationDetailModal({ app, data, onSave, onRename, onRequestRemove, onClose, t, language }) {
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
          <input
            value={app.naam}
            onChange={(e) => onRename(e.target.value)}
            placeholder={t('teampage.applicationsPlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-base font-semibold text-slate-900 hover:border-slate-200 focus:border-[#2a5f8a] focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('form.close')}
            className="ml-2 shrink-0 text-slate-400 hover:text-slate-600"
          >
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
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onRequestRemove}
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/10"
          >
            {t('teampage.remove')}
          </button>
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
  return { id: generateId(), rol: '', seniority: '', risico_bij_uitval: '', risico_toelichting: '', aantal: 1, fase: '' }
}

// Klein modal-formulier voor één capaciteitsrij.
function CapacityRowModal({ row, onSave, onRemove, onClose, t, language }) {
  const [draft, setDraft] = useState(() => ({ ...emptyCapacityRow(), ...row }))
  const isEditing = Boolean(row)

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
            {isEditing ? t('teampage.capacityEditTitle') : t('teampage.capacityAddTitle')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityRolPlaceholder')}</label>
            <input
              value={draft.rol ?? ''}
              onChange={(e) => update({ rol: e.target.value })}
              placeholder={t('teampage.capacityRolPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
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

// Herbruikbare filterknop + dropdown voor dependencies — staat zowel in de
// canvas-toolbar als bij de dependency-lijst, beide keren op dezelfde
// filterstate (alleen de open/dicht-stand van de dropdown is per plek eigen).
function DepFiltersDropdown({
  open,
  onToggle,
  active,
  align = 'right',
  flowtypeFilter,
  setFlowtypeFilter,
  scopeFilter,
  setScopeFilter,
  appLabelFilter,
  setAppLabelFilter,
  applications,
  riskLevelFilter,
  setRiskLevelFilter,
  statusFilter,
  setStatusFilter,
  workflowStapFilter,
  setWorkflowStapFilter,
  onClear,
  t,
  language,
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          active ? 'border-[#2a5f8a]/40 bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {t('teampage.depFiltersButton')}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-[#2a5f8a]" aria-hidden="true" />}▾
      </button>
      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-20 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10`}>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('form.flowtype')}</div>
              <select
                value={flowtypeFilter}
                onChange={(e) => setFlowtypeFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="alle">{t('teampage.filterAll')}</option>
                <option value="ontwikkelflow">{t('form.flowtypeOntwikkelflow')}</option>
                <option value="applicatieflow">{t('form.flowtypeApplicatieflow')}</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('form.scope')}</div>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="alle">{t('scope.alle')}</option>
                <option value="intern">{t('scope.intern')}</option>
                <option value="extern">{t('scope.extern')}</option>
              </select>
            </div>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.filterAppLabel')}</div>
            <select
              value={appLabelFilter}
              onChange={(e) => setAppLabelFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="alle">{t('teampage.filterAll')}</option>
              <option value="overstijgend">{t('teampage.appOverstijgend')}</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.naam || '—'}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('filter.riskLevel')}</span>
              <button type="button" onClick={() => setRiskLevelFilter(new Set(RISK_LEVELS))} className="text-[10px] text-[#2a5f8a] hover:underline">
                {t('filter.selectAll')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {RISK_LEVELS.map((lvl) => {
                const isActive = riskLevelFilter.has(lvl)
                return (
                  <button
                    key={lvl}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setRiskLevelFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(lvl)) next.delete(lvl)
                        else next.add(lvl)
                        return next
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      isActive ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {translateRiskLevel(lvl, language)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('matrix.col.status')}</span>
              <button type="button" onClick={() => setStatusFilter(new Set(STATUS_LEVELS))} className="text-[10px] text-[#2a5f8a] hover:underline">
                {t('filter.selectAll')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_LEVELS.map((s) => {
                const isActive = statusFilter.has(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setStatusFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(s)) next.delete(s)
                        else next.add(s)
                        return next
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      isActive ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {translateStatus(s, language)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('form.workflowStap')}</span>
              <button
                type="button"
                onClick={() => setWorkflowStapFilter(new Set(WORKFLOW_STAP_LEVELS))}
                className="text-[10px] text-[#2a5f8a] hover:underline"
              >
                {t('filter.selectAll')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {WORKFLOW_STAP_LEVELS.map((stap) => {
                const isActive = workflowStapFilter.has(stap)
                return (
                  <button
                    key={stap}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setWorkflowStapFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(stap)) next.delete(stap)
                        else next.add(stap)
                        return next
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      isActive ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {translateWorkflowStap(stap, language)}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            disabled={!active}
            className="mt-3 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('teampage.depFiltersClear')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TeamPage({ teamId, onBack, adminSections }) {
  const {
    teams,
    dependencies,
    teamWorkflows,
    updateTeamWorkflow,
    removeApplicationEverywhere,
    addDependency,
    addDependencies,
    updateDependency,
    deleteDependency,
    teamName,
  } = useAppContext()
  const { t, language } = useLanguage()
  const teamNaam = teamName(teamId)
  const [selectedDependency, setSelectedDependency] = useState(null)
  const [formState, setFormState] = useState(null)
  const [activeColor, setActiveColor] = useState(ANNOTATION_PALETTE[1].value)
  const [capacityModalRow, setCapacityModalRow] = useState(undefined)
  const [appDetailId, setAppDetailId] = useState(null)
  // Applicatie die op verwijderen wacht, mét telling van wat eraan hangt.
  const [appToDelete, setAppToDelete] = useState(null)
  // IO-item aangeklikt op het canvas: opent dezelfde IoItemModal als de
  // Input/Output-lijst, zonder de lijst-lokale modalItem-state aan te raken.
  const [canvasIoTarget, setCanvasIoTarget] = useState(null)
  const [canvasHover, setCanvasHover] = useState(null)
  // Klik op een applicatie/dependency/IO-item/extern team opent eerst een
  // compact focuspaneel naast het canvas i.p.v. meteen de volledige modal —
  // dat paneel heeft zelf een actieknop die de bestaande modal opent. Bevat
  // de aangeklikte ReactFlow-node zelf, zodat het paneel en de dim-laag
  // (displayNodes/displayEdges) er allebei content/id uit kunnen halen.
  const [canvasFocus, setCanvasFocus] = useState(null)
  const [tourActive, setTourActive] = useState(false)
  const [appFilterQuery, setAppFilterQuery] = useState('')
  const [splitApplicaties, setSplitApplicaties] = useState(true)
  // Welke Run flow-lanes op het canvas zijn ingeklapt — puur presentatie,
  // niet bewaard, zodat teams met veel applicaties de stapel compact kunnen
  // houden zonder een onleesbare muur aan lanes.
  const [collapsedLaneIds, setCollapsedLaneIds] = useState(() => new Set())
  // Weergave-filters voor het Teamcanvas: puur presentatie, niet bewaard.
  const [showIO, setShowIO] = useState(true)
  const [showTeambreed, setShowTeambreed] = useState(true)
  // Standaard aan: geaccepteerde afhankelijkheden blijven op het teamcanvas
  // staan (ze zijn wel uit de organisatiebrede Netwerkweergave gefilterd).
  const [showGeaccepteerd, setShowGeaccepteerd] = useState(true)
  const [riskFilterOn, setRiskFilterOn] = useState(false)
  const [showExternalTeams, setShowExternalTeams] = useState(false)
  const [viewFiltersOpen, setViewFiltersOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

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
    (adminSections.applicaties || adminSections.input || adminSections.output || adminSections.capaciteit) && {
      target: 'toolbar',
      title: t('tour.step.applications.title'),
      body: t('tour.step.applications.body'),
    },
    adminSections.dependencies && { target: 'dependencies', title: t('tour.step.dependencies.title'), body: t('tour.step.dependencies.body') },
    adminSections.applicatieflow && {
      target: 'applicatieflow-section',
      title: t('tour.step.applicatieflow.title'),
      body: t('tour.step.applicatieflow.body'),
    },
  ].filter(Boolean)

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

  // --- Dependency-filters: beïnvloeden canvas én lijst tegelijk ---
  // Bewust ruim opgezet (zoeken + 6 aparte filters) i.p.v. één simpele
  // schakelaar, zodat een team met veel dependencies zelf kan bepalen hoeveel
  // hij tegelijk ziet. 'Alle' / een lege Set-selectie betekent hier steeds
  // "geen filter actief" — dat is ook de startstand.
  const [depSearchQuery, setDepSearchQuery] = useState('')
  const [flowtypeFilter, setFlowtypeFilter] = useState('alle')
  const [scopeFilter, setScopeFilter] = useState('alle')
  const [riskLevelFilter, setRiskLevelFilter] = useState(() => new Set(RISK_LEVELS))
  const [statusFilter, setStatusFilter] = useState(() => new Set(STATUS_LEVELS))
  const [workflowStapFilter, setWorkflowStapFilter] = useState(() => new Set(WORKFLOW_STAP_LEVELS))
  const [appLabelFilter, setAppLabelFilter] = useState('alle')
  const [depFiltersOpen, setDepFiltersOpen] = useState(false)
  const [canvasDepFiltersOpen, setCanvasDepFiltersOpen] = useState(false)

  const depFiltersActive =
    depSearchQuery.trim() !== '' ||
    flowtypeFilter !== 'alle' ||
    scopeFilter !== 'alle' ||
    riskLevelFilter.size !== RISK_LEVELS.length ||
    statusFilter.size !== STATUS_LEVELS.length ||
    workflowStapFilter.size !== WORKFLOW_STAP_LEVELS.length ||
    appLabelFilter !== 'alle'

  function clearDepFilters() {
    setDepSearchQuery('')
    setFlowtypeFilter('alle')
    setScopeFilter('alle')
    setRiskLevelFilter(new Set(RISK_LEVELS))
    setStatusFilter(new Set(STATUS_LEVELS))
    setWorkflowStapFilter(new Set(WORKFLOW_STAP_LEVELS))
    setAppLabelFilter('alle')
  }

  function depMatchesSearch(dep, query) {
    if (!query) return true
    const appNamen = (dep.applicatieIds ?? [])
      .map((id) => workflow.applications.find((a) => a.id === id)?.naam)
      .filter(Boolean)
      .join(' ')
    const haystack = [
      dep.titel,
      dep.toelichting,
      dep.categorie,
      dep.workflowStap ? translateWorkflowStap(dep.workflowStap, language) : '',
      appNamen,
      dep.actieAfspraak,
      dep.mitigatie,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  }

  const filteredTeamDependencies = useMemo(() => {
    const query = depSearchQuery.trim().toLowerCase()
    return teamDependencies.filter((dep) => {
      if (flowtypeFilter !== 'alle' && dep.flowtype !== flowtypeFilter) return false
      if (scopeFilter !== 'alle' && dep.scope !== scopeFilter) return false
      if (!riskLevelFilter.has(calculateRisk(dep).level)) return false
      if (dep.status && !statusFilter.has(dep.status)) return false
      if (dep.workflowStap && !workflowStapFilter.has(dep.workflowStap)) return false
      if (appLabelFilter === 'overstijgend' && (dep.applicatieIds ?? []).length > 0) return false
      if (appLabelFilter !== 'alle' && appLabelFilter !== 'overstijgend' && !(dep.applicatieIds ?? []).includes(appLabelFilter))
        return false
      if (!depMatchesSearch(dep, query)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teamDependencies,
    depSearchQuery,
    flowtypeFilter,
    scopeFilter,
    riskLevelFilter,
    statusFilter,
    workflowStapFilter,
    appLabelFilter,
    workflow.applications,
    language,
  ])

  // 'Dependencies van dit team' toont standaard alleen actieve (niet-
  // geaccepteerde) dependencies; geaccepteerde staan achter een eigen tabje
  // — bovenop dezelfde filters/zoekopdracht als de rest van de pagina.
  const [depTab, setDepTab] = useState('actief')
  const acceptedDeps = useMemo(() => filteredTeamDependencies.filter((d) => d.geaccepteerd), [filteredTeamDependencies])
  const visibleTeamDependencies = useMemo(
    () => filteredTeamDependencies.filter((d) => Boolean(d.geaccepteerd) === (depTab === 'geaccepteerd')),
    [filteredTeamDependencies, depTab],
  )

  // Drieledige splitsing per de Ontwikkelflow/Applicatieflow-scheiding:
  // legacy-data zonder flowtype blijft expliciet zichtbaar i.p.v. geraden.
  const legacyFlowDeps = useMemo(() => visibleTeamDependencies.filter((d) => !d.flowtype), [visibleTeamDependencies])
  const ontwikkelflowDeps = useMemo(
    () => visibleTeamDependencies.filter((d) => d.flowtype === 'ontwikkelflow'),
    [visibleTeamDependencies],
  )
  const applicatieflowDeps = useMemo(
    () => visibleTeamDependencies.filter((d) => d.flowtype === 'applicatieflow'),
    [visibleTeamDependencies],
  )

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
  const [applicatieflowOpen, setApplicatieflowOpen] = useState(false)
  const onOpenApplicatieflow = useCallback(() => {
    setApplicatieflowOpen(true)
    requestAnimationFrame(() => applicatieflowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])

  const viewFilters = useMemo(
    () => ({ showIO, showTeambreed, riskFilterOn, showExternalTeams }),
    [showIO, showTeambreed, riskFilterOn, showExternalTeams],
  )

  // Wat het canvas te zien krijgt: dezelfde dependency-filters/zoekopdracht
  // als de lijst eronder (zie filteredTeamDependencies), plus de losse
  // Weergeven-toggle voor geaccepteerd — zo blijven canvas en lijst altijd
  // consistent, ook al heeft de lijst daarbovenop nog het Actief/Geaccepteerd-
  // tabje.
  const canvasDependencies = useMemo(
    () => (showGeaccepteerd ? filteredTeamDependencies : filteredTeamDependencies.filter((d) => !d.geaccepteerd)),
    [filteredTeamDependencies, showGeaccepteerd],
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
    canvasDependencies,
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
  // Focus (klik) wint van hover: zodra iets is aangeklikt blijft de
  // relatie-highlight staan zonder dat de muis erboven hoeft te blijven, en
  // dimt niet-gerelateerde content veel verder weg dan een losse hover.
  const focusNodeId = canvasFocus?.id ?? null
  const activeRelationId = focusNodeId ?? hoverNodeId
  const displayEdges = useMemo(() => {
    if (!activeRelationId) return edges
    return edges.map((edge) => {
      const related = edge.source === activeRelationId || edge.target === activeRelationId
      const isAppConn = edge.id.startsWith('appconn:')
      return {
        ...edge,
        animated: isAppConn ? related : edge.animated,
        style: {
          ...edge.style,
          opacity: related ? 1 : (edge.style?.opacity ?? 1) * (focusNodeId ? 0.1 : 0.15),
          strokeWidth: related && focusNodeId ? (edge.style?.strokeWidth ?? 1) + 0.5 : edge.style?.strokeWidth,
        },
      }
    })
  }, [edges, activeRelationId, focusNodeId])
  // Niet-gerelateerde content-nodes (dependencies/IO/lanes/externe teams)
  // dimmen mee zodra er een focus actief is — structurele elementen (zones,
  // lane-achtergronden, workflowstappen) blijven altijd op volle sterkte,
  // die zijn de vaste oriëntatiepunten van het canvas.
  const displayNodes = useMemo(() => {
    if (!focusNodeId) return nodes
    const relatedIds = new Set([focusNodeId])
    edges.forEach((edge) => {
      if (edge.source === focusNodeId) relatedIds.add(edge.target)
      if (edge.target === focusNodeId) relatedIds.add(edge.source)
    })
    return nodes.map((n) => {
      if (!DIMMABLE_NODE_TYPES.has(n.type)) return n
      return { ...n, style: { ...n.style, opacity: relatedIds.has(n.id) ? 1 : 0.3 } }
    })
  }, [nodes, edges, focusNodeId])

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

  // Klik op een applicatie/IO-item/extern team opent eerst het compacte
  // focuspaneel i.p.v. meteen de volledige modal — die blijven bereikbaar
  // via de actieknop van dat paneel (zie buildFocusPanelContent). Een
  // dependency-marker is een uitzondering: die opent meteen de volledige
  // DependencyDetail, net als een klik in de Heatmap-lijst al deed.
  function handleNodeClick(_, node) {
    if (node.type === 'dependencyMarker') {
      setSelectedDependency(node.data.dependency)
      return
    }
    if (FOCUSABLE_NODE_TYPES.has(node.type)) setCanvasFocus(node)
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
      const scopeLabel = isRunflow
        ? (app?.naam ?? t('teampage.appOverstijgend'))
        : (dep.applicatieIds ?? []).length === 0
          ? t('teampage.procesOverstijgend')
          : translateWorkflowStap(dep.workflowStap, language)
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

  // Rijkere inhoud voor het focuspaneel (klik) — zelfde per-type opbouw als
  // buildCanvasTooltipContent hierboven, maar met een meta-rijenlijst en een
  // actieknop die de bestaande volledige modal opent. Zo blijft canvas-klik
  // licht (paneel) terwijl de bestaande modals bereikbaar blijven.
  function buildFocusPanelContent(node) {
    if (node.type === 'dependencyMarker') {
      const dep = node.data.dependency
      const isRunflow = dep.flowtype === 'applicatieflow'
      const flowLabel = dep.flowtype ? translateFlowtype(dep.flowtype, language) : t('teampage.flowtypeUndetermined')
      const app = isRunflow ? workflow.applications.find((a) => (dep.applicatieIds ?? []).includes(a.id)) : null
      const scopeLabel = isRunflow
        ? (app?.naam ?? t('teampage.appOverstijgend'))
        : (dep.applicatieIds ?? []).length === 0
          ? t('teampage.procesOverstijgend')
          : translateWorkflowStap(dep.workflowStap, language)
      const meta = [
        { label: t('matrix.col.categorie'), value: translateCategorie(dep.categorie, language) },
        { label: t('form.flowtype'), value: flowLabel },
        { label: isRunflow ? t('teampage.focusTypeApp') : t('form.workflowStap'), value: scopeLabel || '—' },
        { label: t('matrix.col.status'), value: translateStatus(dep.status, language) },
      ]
      if (dep.geraakte_team_extern) meta.push({ label: t('teampage.legendExternalTeam'), value: dep.geraakte_team_extern })
      return {
        typeLabel: flowLabel,
        title: dep.titel,
        risk: node.data.risk,
        meta,
        actionLabel: t('teampage.focusOpenDetail'),
        onAction: () => setSelectedDependency(dep),
      }
    }
    if (node.type === 'applicatieflowBanner') {
      const deps = node.data.deps ?? []
      const risks = deps.map((d) => calculateRisk(d))
      const highest = risks.reduce((best, r) => (!best || r.score > best.score ? r : best), null)
      const meta = [{ label: t('tooltip.dependencies'), value: String(deps.length) }]
      if (highest) meta.push({ label: t('tooltip.highestRisk'), value: translateRiskLevel(highest.level, language) })
      // 'teambreed' rendert geen applicatieflowBanner meer (geen banner, geen
      // focus/klik) — hier blijven dus alleen 'app' en 'group' over.
      const typeLabel = node.data.accent === 'app' ? t('teampage.focusTypeApp') : t('teampage.applicatiegerelateerd')
      return {
        typeLabel,
        title: node.data.label,
        risk: highest,
        meta,
        actionLabel: node.data.accent === 'app' ? t('appflow.detailEdit') : t('teampage.focusGotoApplicatieflow'),
        onAction: node.data.onClick,
      }
    }
    if (node.type === 'ioItem') {
      const meta = [{ label: t('teampage.focusFlowcontext'), value: node.data.meta }]
      if (node.data.linkLabel) meta.push({ label: t('teampage.focusLinkedFrom'), value: node.data.linkLabel })
      if (node.data.externalTeam) meta.push({ label: t('teampage.legendExternalTeam'), value: node.data.externalTeam })
      return {
        typeLabel: node.data.kind === 'input' ? t('teampage.focusTypeInput') : t('teampage.focusTypeOutput'),
        title: node.data.label || '—',
        meta,
        actionLabel: t('appflow.detailEdit'),
        onAction: () => {
          const items = node.data.kind === 'input' ? workflow.inputs : workflow.outputs
          const item = items.find((i) => i.id === node.data.itemId)
          if (item) setCanvasIoTarget({ kind: node.data.kind, item })
        },
      }
    }
    if (node.type === 'externalTeam') {
      return { typeLabel: t('teampage.legendExternalTeam'), title: node.data.naam, meta: [] }
    }
    if (node.type === 'capacityBadge') {
      const meta = []
      if (node.data.seniority) meta.push({ label: t('teampage.capacitySeniority'), value: translateSeniority(node.data.seniority, language) })
      return {
        typeLabel: t('teampage.capacityTitle'),
        title: node.data.functieNaam || '—',
        meta,
        actionLabel: t('appflow.detailEdit'),
        onAction: () => {
          const row = workflow.capacity.find((c) => c.id === node.data.rowId)
          if (row) setCapacityModalRow(row)
        },
      }
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
  // Wat hangt er nog aan deze applicatie? Wordt gebruikt om te bepalen of er
  // gewaarschuwd moet worden, en om na bevestiging alles op te ruimen.
  function applicationUsage(id) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    return {
      deps: teamDependencies.filter((d) => (d.applicatieIds ?? []).includes(id)),
      connecties: (applicatieflow.connecties ?? []).filter((c) => c.van === id || c.naar === id),
      ioItems: [...workflow.inputs, ...workflow.outputs].filter((i) => i.applicatieId === id),
    }
  }

  // Eén atomaire actie in de context: dependencies en teamWorkflows zitten in
  // dezelfde state-boom, dus twee losse updates zouden elkaar overschrijven.
  function removeApplication(id) {
    removeApplicationEverywhere(teamId, id)
    setAppToDelete(null)
  }

  // Alleen waarschuwen als er echt iets aan hangt — anders is een dialoog
  // onnodige wrijving bij het opruimen van een lege regel.
  function requestRemoveApplication(app) {
    const usage = applicationUsage(app.id)
    const total = usage.deps.length + usage.connecties.length + usage.ioItems.length
    if (total === 0) {
      removeApplication(app.id)
      return
    }
    setAppToDelete({ app, ...usage })
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

  // Ketenniveau + meerdere teams: het datamodel kent maar één team per
  // dependency, dus 'meerdere teams' wordt hier veilig vertaald naar één
  // echte dependency per gekozen team (zelfde inhoud, eigen id, eigen
  // teamId). extraTeamIds is puur formulierstate en hoort niet in het
  // opgeslagen record.
  function handleSaveDependency(payload) {
    const { extraTeamIds, ...rest } = payload
    if (formState?.editing) {
      updateDependency(formState.editing.id, rest)
    } else if (extraTeamIds?.length) {
      // Eén enkele batch-aanroep i.p.v. addDependency N keer ná elkaar: die
      // zouden allemaal vanuit dezelfde state-snapshot bouwen en elkaar dus
      // overschrijven in plaats van optellen (zie addDependencies).
      addDependencies([rest, ...extraTeamIds.map((teamId) => ({ ...rest, teamId }))])
    } else {
      addDependency(rest)
    }
    setFormState(null)
  }

  function handleDeleteDependency(dep) {
    if (window.confirm(t('detail.confirmDelete', { titel: dep.titel }))) {
      deleteDependency(dep.id)
      setSelectedDependency(null)
    }
  }

  // Opent het formulier voorgevuld met een kopie van de gekozen dependency
  // (zelfde team als origineel, maar wijzigbaar) — pas bij opslaan ontstaat
  // er echt een nieuwe dependency.
  function handleDuplicateDependency(dep) {
    setSelectedDependency(null)
    setFormState({ editing: null, prefill: buildDuplicatePrefill(dep, t('form.duplicateTitlePrefix')) })
  }

  // Reset alleen de handmatig versleepte posities (niet de data zelf) zodat
  // useMergedLayout weer de vers berekende, uitgelijnde posities gebruikt —
  // een gebruiker-gestuurde actie, geen automatische herordening.
  function handleSmartOrder() {
    patch({ layout: {} })
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
        </div>
      </div>

      {(
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.workflowTitle')}</h3>
            </div>

            <div
              data-tour="toolbar"
              className="-mx-4 -mt-4 mb-3 flex min-h-[56px] flex-wrap items-center gap-1.5 rounded-t-xl border-b border-slate-200 bg-slate-50/70 px-4 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {(adminSections.applicaties || adminSections.input || adminSections.output || adminSections.capaciteit) && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAddMenuOpen((v) => !v)}
                      aria-expanded={addMenuOpen}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        addMenuOpen
                          ? 'border-[#2a5f8a]/40 bg-[#2a5f8a]/10 text-[#2a5f8a]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t('teampage.addMenuButton')} ▾
                    </button>
                    {addMenuOpen && (
                      <div className="absolute left-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
                        {adminSections.applicaties && (
                          <button
                            type="button"
                            onClick={() => {
                              addApplication()
                              setAddMenuOpen(false)
                            }}
                            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {t('teampage.applicationsAdd')}
                          </button>
                        )}
                        {adminSections.input && (
                          <button
                            type="button"
                            onClick={() => {
                              setCanvasIoTarget({ kind: 'input', item: null })
                              setAddMenuOpen(false)
                            }}
                            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {t('teampage.inputAdd')}
                          </button>
                        )}
                        {adminSections.output && (
                          <button
                            type="button"
                            onClick={() => {
                              setCanvasIoTarget({ kind: 'output', item: null })
                              setAddMenuOpen(false)
                            }}
                            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {t('teampage.outputAdd')}
                          </button>
                        )}
                        {adminSections.capaciteit && (
                          <button
                            type="button"
                            onClick={() => {
                              setCapacityModalRow(null)
                              setAddMenuOpen(false)
                            }}
                            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {t('teampage.capacityAdd')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {adminSections.aantekeningen && (
                  <>
                    <div className="h-5 w-px bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => addAnnotation('note')}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      {t('teampage.toolbarNote')}
                    </button>
                    <ColorSwatchRow value={activeColor} onChange={setActiveColor} />
                  </>
                )}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {adminSections.dependencies && (
                  <>
                    <input
                      value={depSearchQuery}
                      onChange={(e) => setDepSearchQuery(e.target.value)}
                      placeholder={t('teampage.canvasDepSearchPlaceholder')}
                      className="w-48 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                    />
                    <DepFiltersDropdown
                      open={canvasDepFiltersOpen}
                      onToggle={() => setCanvasDepFiltersOpen((v) => !v)}
                      active={depFiltersActive}
                      flowtypeFilter={flowtypeFilter}
                      setFlowtypeFilter={setFlowtypeFilter}
                      scopeFilter={scopeFilter}
                      setScopeFilter={setScopeFilter}
                      appLabelFilter={appLabelFilter}
                      setAppLabelFilter={setAppLabelFilter}
                      applications={workflow.applications}
                      riskLevelFilter={riskLevelFilter}
                      setRiskLevelFilter={setRiskLevelFilter}
                      statusFilter={statusFilter}
                      setStatusFilter={setStatusFilter}
                      workflowStapFilter={workflowStapFilter}
                      setWorkflowStapFilter={setWorkflowStapFilter}
                      onClear={clearDepFilters}
                      t={t}
                      language={language}
                    />
                  </>
                )}
                {splitApplicaties && workflow.applications.length > 4 && (
                  <input
                    value={appFilterQuery}
                    onChange={(e) => setAppFilterQuery(e.target.value)}
                    placeholder={t('teampage.appFilterPlaceholder')}
                    className="w-40 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                  />
                )}
                <div className="h-5 w-px bg-slate-200" />
                <div
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs shadow-inner"
                  role="group"
                  aria-label={t('teampage.viewModeLabel')}
                >
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
                        { key: 'showGeaccepteerd', label: t('teampage.viewFilterShowGeaccepteerd'), value: showGeaccepteerd, onChange: setShowGeaccepteerd },
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

            {/* Canvas + focuspaneel als flex-rij (zelfde dockingpatroon als
                TeamFilterPanel naast GraphView) — het paneel is een vaste-
                breedte zijkolom die alleen verschijnt zodra canvasFocus
                gezet is, i.p.v. een overlay bovenop het canvas. */}
            <div className="flex items-stretch gap-3" style={{ height: 'clamp(640px, 78vh, 920px)' }}>
              <div
                data-tour="workflow-canvas"
                className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
              >
                <PannableFlowCanvas
                  className="teamcanvas-flow"
                  nodes={displayNodes}
                  edges={displayEdges}
                  nodeTypes={nodeTypes}
                  onNodesChange={handleNodesChange}
                  onNodeClick={handleNodeClick}
                  onPaneClick={() => setCanvasFocus(null)}
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
                  // Bewust géén minZoom in fitViewOptions: die klemde de
                  // automatische fit af terwijl de volledige inhoud verder moet
                  // uitzoomen, waardoor precies de buitenste kolommen — de
                  // input/output-kaarten — bij openen buiten beeld vielen. De
                  // minZoom-prop hieronder blijft de ondergrens voor handmatig
                  // uitzoomen.
                  fitViewOptions={{ padding: 0.06 }}
                  minZoom={0.4}
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

              {canvasFocus &&
                (() => {
                  const content = buildFocusPanelContent(canvasFocus)
                  if (!content) return null
                  const style = content.risk ? riskStyle(content.risk.level) : null
                  return (
                    <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{content.typeLabel}</div>
                          <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">{content.title}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCanvasFocus(null)}
                          aria-label={t('teampage.focusPanelClose')}
                          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {style && (
                          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {translateRiskLevel(content.risk.level, language)}
                          </span>
                        )}
                        {content.meta?.length > 0 && (
                          <dl className="space-y-2">
                            {content.meta.map((row) => (
                              <div key={row.label}>
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{row.label}</dt>
                                <dd className="mt-0.5 text-xs text-slate-700">{row.value || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                      {content.onAction && (
                        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
                          <button
                            type="button"
                            onClick={content.onAction}
                            className="w-full rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]"
                          >
                            {content.actionLabel}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>
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
                  onRename={(naam) => updateApplication(appDetailId, { naam })}
                  onRequestRemove={() => {
                    setAppDetailId(null)
                    requestRemoveApplication(app)
                  }}
                  onClose={() => setAppDetailId(null)}
                  t={t}
                  language={language}
                />
              )
            })()}

          {appToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
              <div role="alertdialog" aria-modal="true" aria-labelledby="app-delete-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
                <h3 id="app-delete-title" className="text-sm font-semibold text-slate-900">
                  {t('teampage.appDeleteTitle', { naam: appToDelete.app.naam || '—' })}
                </h3>
                <p className="mt-2 text-xs text-slate-500">{t('teampage.appDeleteIntro')}</p>
                <ul className="mt-2.5 space-y-1 text-xs text-slate-700">
                  {appToDelete.deps.length > 0 && <li>• {t('teampage.appDeleteDeps', { count: appToDelete.deps.length })}</li>}
                  {appToDelete.connecties.length > 0 && <li>• {t('teampage.appDeleteConns', { count: appToDelete.connecties.length })}</li>}
                  {appToDelete.ioItems.length > 0 && <li>• {t('teampage.appDeleteIo', { count: appToDelete.ioItems.length })}</li>}
                </ul>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAppToDelete(null)}
                    className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t('form.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeApplication(appToDelete.app.id)}
                    className="rounded-md bg-[#9a3b2e] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#7f3125]"
                  >
                    {t('teampage.appDeleteConfirm')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {canvasIoTarget && (
            <IoItemModal
              kind={canvasIoTarget.kind}
              item={canvasIoTarget.item}
              onSave={(draft) => {
                const isNew = !canvasIoTarget.item
                if (canvasIoTarget.kind === 'input') {
                  isNew ? addInput(draft) : updateInput(draft.id, draft)
                } else {
                  isNew ? addOutput(draft) : updateOutput(draft.id, draft)
                }
                setCanvasIoTarget(null)
              }}
              onRemove={
                canvasIoTarget.item
                  ? () => {
                      if (canvasIoTarget.kind === 'input') removeInput(canvasIoTarget.item.id)
                      else removeOutput(canvasIoTarget.item.id)
                      setCanvasIoTarget(null)
                    }
                  : undefined
              }
              onClose={() => setCanvasIoTarget(null)}
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              applications={workflow.applications}
              t={t}
              language={language}
            />
          )}

          {adminSections.dependencies && (
          <div data-tour="dependencies" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{t('teampage.dependenciesTitle')}</h3>
              <button
                type="button"
                onClick={() => setFormState({ editing: null, defaultTeamId: teamId })}
                className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]"
              >
                {t('header.newDependency')}
              </button>
            </div>

            {adminSections.filters && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={depSearchQuery}
                onChange={(e) => setDepSearchQuery(e.target.value)}
                placeholder={t('teampage.depSearchPlaceholder')}
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
              />
              <DepFiltersDropdown
                open={depFiltersOpen}
                onToggle={() => setDepFiltersOpen((v) => !v)}
                active={depFiltersActive}
                flowtypeFilter={flowtypeFilter}
                setFlowtypeFilter={setFlowtypeFilter}
                scopeFilter={scopeFilter}
                setScopeFilter={setScopeFilter}
                appLabelFilter={appLabelFilter}
                setAppLabelFilter={setAppLabelFilter}
                applications={workflow.applications}
                riskLevelFilter={riskLevelFilter}
                setRiskLevelFilter={setRiskLevelFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                workflowStapFilter={workflowStapFilter}
                setWorkflowStapFilter={setWorkflowStapFilter}
                onClear={clearDepFilters}
                t={t}
                language={language}
              />
            </div>
            )}

            <div role="group" aria-label={t('teampage.depTabLabel')} className="mb-3 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDepTab('actief')}
                aria-pressed={depTab === 'actief'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${depTab === 'actief' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('teampage.depTabActief')} · {filteredTeamDependencies.length - acceptedDeps.length}
              </button>
              <button
                type="button"
                onClick={() => setDepTab('geaccepteerd')}
                aria-pressed={depTab === 'geaccepteerd'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${depTab === 'geaccepteerd' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('teampage.depTabGeaccepteerd')} · {acceptedDeps.length}
              </button>
            </div>
            {visibleTeamDependencies.length === 0 && (
              <p className="text-xs text-slate-400">
                {depFiltersActive
                  ? t('teampage.dependenciesEmptyFiltered')
                  : depTab === 'geaccepteerd'
                    ? t('teampage.dependenciesEmptyAccepted')
                    : t('teampage.dependenciesEmpty')}
              </p>
            )}

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
                      <div className="mb-1.5 text-xs font-semibold text-slate-500">{t('teampage.appOverstijgend')}</div>
                      <StageGroupedDeps deps={unlabeled} showAppPicker />
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
          )}

          {adminSections.applicatieflow && (
          <div ref={applicatieflowSectionRef} data-tour="applicatieflow-section" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setApplicatieflowOpen((v) => !v)}
              aria-expanded={applicatieflowOpen}
              className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-slate-800"
            >
              <span className={`text-slate-400 transition-transform ${applicatieflowOpen ? 'rotate-90' : ''}`} aria-hidden="true">
                ›
              </span>
              {t('teampage.tabApplicatieflow')}
            </button>
            {applicatieflowOpen && (
              <div className="mt-3">
                <ApplicatieflowTab workflow={workflow} patch={patch} onAddApplication={adminSections.applicaties ? addApplication : undefined} />
              </div>
            )}
          </div>
          )}

          {capacityModalRow !== undefined && (
            <CapacityRowModal
              row={capacityModalRow}
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
        </>
      )}
      </div>

      {selectedDependency && (
        <DependencyDetail
          // Live opzoeken i.p.v. de gevangen state direct doorgeven: anders
          // toont het paneel na bv. Accepteren nog de oude (niet-
          // geaccepteerde) versie totdat het opnieuw geopend wordt.
          dependency={teamDependencies.find((d) => d.id === selectedDependency.id) ?? selectedDependency}
          onClose={() => setSelectedDependency(null)}
          onEdit={(dep) => {
            setSelectedDependency(null)
            setFormState({ editing: dep })
          }}
          onDelete={handleDeleteDependency}
          onDuplicate={handleDuplicateDependency}
        />
      )}

      {formState && (
        <DependencyForm
          defaultTeamId={formState.defaultTeamId}
          initialData={formState.editing}
          prefill={formState.prefill}
          onSave={handleSaveDependency}
          onCancel={() => setFormState(null)}
        />
      )}

      {tourActive && <SpotlightTour steps={tourSteps} onClose={handleTourClose} />}
    </div>
  )
}
