import { Handle, Position, BaseEdge, getSmoothStepPath } from 'reactflow'
import { useLanguage } from '../../context/LanguageContext'
import { translateRiskLevel, translateSeniority, translateWorkflowStage } from '../../i18n/labels'
import { riskStyle } from '../../lib/riskStyles'
import { ANNOTATION_PALETTE } from '../../lib/workflowStyles'
import { roundedOrthPath } from '../../lib/chainLayout'
import { useBufferedText } from '../../lib/useBufferedText'

// De kaarten van het teamcanvas: elk node-type dat computeWorkflowLayout
// oplevert, plus de edge-renderer en de twee registers (nodeTypes/edgeTypes)
// die React Flow nodig heeft.
//
// Stonden in TeamPage.jsx tussen de schermlogica. Verplaatst, niet verbouwd --
// de inhoud is regel voor regel dezelfde.

export const LINK_STATUS_CHIP = {
  voorgesteld: 'bg-amber-100 text-amber-800',
  geaccepteerd: 'bg-[#2a5f8a]/10 text-[#2a5f8a]',
  afgewezen: 'bg-[#9a3b2e]/10 text-[#9a3b2e]',
}

export function ColorSwatchRow({ value, onChange }) {
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

// Onzichtbaar ankerpunt in het midden van de Applicatieflow-zone — alleen gebruikt
// als edge-target voor Applicatieflow-IO-lijntjes wanneer er geen enkele
// applicatie-/Overstijgend-lane bestaat om aan te haken (anders viel de lijn
// terug op de Ontwikkelflow-stagerij, wat het leek alsof de input/output bij
// Ontwikkelflow hoorde terwijl 'ie in de Applicatieflow-zone stond).
function FlowAnchorNode() {
  return (
    <div className="h-px w-px">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function StageNode({ data }) {
  const { language, t } = useLanguage()
  return (
    <div
      className="relative w-44 overflow-hidden rounded-xl border border-slate-200/90 bg-white py-3.5 pl-3.5 pr-4 shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
      style={{ borderLeftWidth: 4, borderLeftColor: data.color }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.35 }} />
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: data.color }} />
      <div className="flex items-center justify-between gap-1.5">
        <div className="text-sm font-semibold tracking-tight text-slate-800">{translateWorkflowStage(data.stage, language)}</div>
        {/* Klein, terughoudend icoon i.p.v. de tekst zelf op het canvas —
            gevuld wanneer het team een toelichting heeft vastgelegd, anders
            een faint uitnodiging om er een toe te voegen. Klik op de hele
            kaart opent de editor (zie handleNodeClick). */}
        <span
          title={data.note || t('teampage.stageNoteHint')}
          className={`shrink-0 ${data.note ? 'text-[#2a5f8a]' : 'text-slate-300'}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill={data.note ? 'currentColor' : 'none'}
              fillOpacity={data.note ? 0.12 : 0}
            />
            <path d="M14 4v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0.35 }} />
    </div>
  )
}

function IoNode({ data }) {
  const isInput = data.kind === 'input'
  return (
    <div
      className={`relative w-44 rounded-lg border px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${
        data.ghost ? 'cursor-pointer border-dashed border-amber-400 bg-amber-50/60' : 'border-slate-200 bg-white'
      }`}
      style={data.bronColor && !data.ghost ? { borderLeftColor: data.bronColor, borderLeftWidth: 3 } : undefined}
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
      {/* Alleen de niet-definitieve koppelingsstatussen op de kaart zelf —
          een geaccepteerde koppeling is de normale toestand. */}
      {data.requestLabel ? (
        // Koppelingsverzoek van een ander team: schaduwkaart (nieuw item) of
        // badge op het bestaande item — klik opent accepteren/afwijzen.
        <div className="mt-0.5 inline-flex rounded bg-amber-100 px-1 py-[1px] text-[9px] font-semibold text-amber-800">{data.requestLabel}</div>
      ) : (
        (data.linkStatus === 'voorgesteld' || data.linkStatus === 'afgewezen') && (
          <div className={`mt-0.5 inline-flex rounded px-1 py-[1px] text-[9px] font-semibold ${LINK_STATUS_CHIP[data.linkStatus]}`}>
            {data.linkStatusLabel}
          </div>
        )
      )}
      {/* Compacte flowcontext direct op de kaart — hoort dit bij Applicatieflow of
          Ontwikkelflow, en bij een applicatie of Overstijgend — i.p.v. alleen
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
// 'app' (blauw, #2a5f8a) voor echte applicatie-lanes/-kaarten, 'overstijgend'
// (groen, #5c8a72) voor de niet-gelabelde basislaag — zodat Overstijgend
// meteen herkenbaar als eigen, normale categorie oogt i.p.v. een applicatie-
// kloon.
// 'app' (blauw) = één specifieke applicatie, 'overstijgend' (groen) = de niet-
// gelabelde basislaag, 'group' (neutraal slate) = de verzamel-groep
// 'Applicatiegerelateerd' in Samengevoegd — bewust geen appkleur, want dit
// is geen applicatie maar een categorie van meerdere applicaties samen.
function laneAccentColor(accent) {
  if (accent === 'overstijgend') return '#5c8a72'
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
      {/* Drie onzichtbare handles, alle met een eigen id — nodig zodra een
          node meer dan één handle aan dezelfde kant heeft (hier: twee
          source-handles links+rechts), anders kan React Flow niet meer
          betrouwbaar bepalen welke een edge zonder expliciete handle-id moet
          gebruiken. 'left-in' = generieke linker-ingang (Applicatieflow-input
          die naast deze lane hangt, of de bus die hier eindigt). 'bus-out' =
          linker-uitgang, alleen voor app-naar-app-koppelingen die via de
          linkergoot lopen (zie appconn-edges in computeWorkflowLayout).
          'right-out' = rechter-uitgang, voor de chip-kolom (crossflow) en de
          ongewijzigde Samengevoegd-route naar de output-kolom. */}
      <Handle type="target" position={Position.Left} id="left-in" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="bus-out" style={{ opacity: 0 }} />
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
      <Handle type="source" position={Position.Right} id="right-out" style={{ opacity: 0 }} />
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
      {/* Onzichtbaar handle op de rechterrand van het HELE kader (niet de
          banner) — een outputitem dat bij deze lane hoort vertrekt hiervandaan,
          dus ná alle chips, in plaats van vanaf de banner (links) er dwars
          overheen. Geen eigen top-offset: React Flow centreert een handle
          zonder die stijl standaard op 50% van de gerenderde hoogte van dít
          element (data.height hierboven), en dat IS precies het midden van de
          gereserveerde rij — ook als die extra hoog staat voor gestapelde
          IO-kaarten (zie de ioRows-boost in placeLaneGroup). pointer-events-
          none van de ouder is geen probleem: dit handle wordt nooit door de
          gebruiker versleept, alleen door eigen edges bij id aangesproken. */}
      <Handle type="source" position={Position.Right} id="lane-out" style={{ opacity: 0 }} />
      {/* Optioneel label-pilletje, bv. voor de losstaande Ontwikkelflow-
          Overstijgend-band — de gewone Applicatieflow-lanes tonen hun naam al
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

// Omsluitende achtergrondlaag voor Applicatieflow (boven) resp. Ontwikkelflow
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
      {/* Zonder label (bv. de smalle 'seam'-overgangsstrook tussen Applicatieflow
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
          deze Applicatieflow meespelen — puur context, geen aparte structuur. */}
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

  const tekstVeld = useBufferedText(data.text, data.onText)

  return (
    <div className="group relative w-40">
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <button
        type="button"
        onClick={() => {
          // Eerst de openstaande wijziging weggooien, dan pas verwijderen:
          // zonder dit schrijft de flush bij unmount de zojuist verwijderde
          // aantekening gewoon weer terug.
          tekstVeld.cancel()
          data.onRemove()
        }}
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
            value={tekstVeld.value}
            onChange={(e) => tekstVeld.onChange(e.target.value)}
            onBlur={tekstVeld.flush}
            aria-label={data.ariaLabel}
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

export const nodeTypes = {
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


// Tekent de orthogonale route die computeWorkflowLayout voor een edge heeft
// uitgerekend (data.points), met afgeronde hoeken — zelfde renderer als het
// ketenoverzicht (lib/chainLayout.js), hier ingezet voor Applicatieflow-IO en
// applicatiekoppelingen zodat die nooit meer dwars over een andere lane of
// chip heen lopen. Edges zonder data.points (fasepijl, capaciteit, crossflow,
// Ontwikkelflow-IO, annotaties) vallen terug op de standaard
// smoothstep-berekening, exact zoals voorheen.
function LayoutEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }) {
  const path = data?.points
    ? roundedOrthPath(data.points)
    : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 })[0]
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}

export const edgeTypes = { layout: LayoutEdge }
