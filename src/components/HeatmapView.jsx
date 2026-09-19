import { useCallback, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { translateRiskLevel, translateCategorie, translateWorkflowStap } from '../i18n/labels'
import { RISK_LEVELS, WORKFLOW_STAP_LEVELS } from '../data/constants'
import { CategoryIcon } from '../data/categoryIcons'
import FloatingTooltip from './FloatingTooltip'
import TeamFilterPanel from './TeamFilterPanel'
import DependencyTable from './DependencyTable'
import ScopeToggle from './ScopeToggle'
import { useModalA11y } from '../lib/a11y'
import { useTeamSelection } from '../lib/useTeamSelection'

function highestRisk(deps) {
  let best = { level: 'Laag', score: 0 }
  for (const d of deps) {
    const r = calculateRisk(d)
    if (r.score > best.score) best = r
  }
  return best
}

function riskBreakdown(deps) {
  const counts = Object.fromEntries(RISK_LEVELS.map((l) => [l, 0]))
  for (const d of deps) counts[calculateRisk(d).level]++
  return counts
}

// Groepering team × categorie -> deps: precies één cel van de heatmap.
function groupByTeamCategory(visibleDependencies) {
  const map = new Map()
  for (const dep of visibleDependencies) {
    const key = `${dep.teamId}::${dep.categorie}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(dep)
  }
  return map
}

export default function HeatmapView({ onSelect, adminSections, onNavigateToTeam }) {
  const { teams, dependencies, teamLabels } = useAppContext()
  const { t, language } = useLanguage()
  const [hover, setHover] = useState(null) // { x, y, payload: { label?, categorie?, deps } }
  // Gearchiveerde teams staan standaard uit, maar blijven aan te vinken zodat
  // historische data opvraagbaar blijft — zie useTeamSelection.
  const { selectedTeamIds, toggleTeam, selectAll: selectAllTeams, selectNone: selectNoTeams } = useTeamSelection(teams)
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  const [selectedWorkflowStap, setSelectedWorkflowStap] = useState([...WORKFLOW_STAP_LEVELS, ''])
  // Lokale scope-filter die standaard alles toont: mixen van Teamniveau/
  // Ketenniveau was hier altijd al het gedrag, dit voegt enkel de
  // mogelijkheid toe om te versmallen.
  const [scope, setScope] = useState('alle')
  // Kolom-/rij-/cel-hover: presentatie-only, dimt/markeert cellen buiten/
  // binnen de gehoverde kolom, rij of losse cel. Een cel-hover wint van
  // rij/kolom-hover (spotlight op precies één cel i.p.v. de hele rij/kolom).
  const [hoverHeatmapCol, setHoverHeatmapCol] = useState(null)
  const [hoverHeatmapRow, setHoverHeatmapRow] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  // Selectie binnen de heatmap (cel/rij/kolom): de gebruiker blijft op de
  // pagina en krijgt een detailsectie met de bijbehorende dependencies
  // eronder.
  const [heatmapSelection, setHeatmapSelection] = useState(null)
  // Categorie-uitleg staat standaard ingeklapt: puur beschrijvende content die
  // veel verticale ruimte innam.
  const [legendOpen, setLegendOpen] = useState(false)

  const visibleTeams = useMemo(() => teams.filter((tm) => selectedTeamIds.includes(tm.id)), [teams, selectedTeamIds])
  const visibleDependencies = useMemo(
    () =>
      dependencies.filter((d) => {
        // Geaccepteerde afhankelijkheden zijn bewust afgehandeld; ze horen niet
        // meer mee te kleuren in het organisatiebrede risicobeeld. Ze blijven
        // wel gewoon staan op de teampagina.
        if (d.geaccepteerd) return false
        if (!selectedTeamIds.includes(d.teamId) || !selectedRiskLevels.includes(calculateRisk(d).level)) return false
        if (scope !== 'alle' && d.scope !== scope) return false
        if (!selectedWorkflowStap.includes(d.workflowStap ?? '')) return false
        return true
      }),
    [dependencies, selectedTeamIds, selectedRiskLevels, scope, selectedWorkflowStap],
  )

  const categoriesPresent = useMemo(
    () => [...new Set(visibleDependencies.map((d) => d.categorie))].sort(),
    [visibleDependencies],
  )
  const groups = useMemo(() => groupByTeamCategory(visibleDependencies), [visibleDependencies])

  // Titel + dependencies voor een team en/of categorie — team of categorie
  // mag leeg zijn (hele rij resp. hele kolom), en altijd berekend op de
  // actuele (gefilterde) dependencies.
  const selectionInfo = useCallback(
    (teamId, categorie) => {
      const team = teamId ? teams.find((tm) => tm.id === teamId) : null
      const teamNaam = team ? (teamLabels[team.id] ?? team.naam) : teamId
      let deps
      let title
      if (teamId && categorie) {
        deps = groups.get(`${teamId}::${categorie}`) ?? []
        title = `${teamNaam} → ${translateCategorie(categorie, language)}`
      } else if (teamId) {
        deps = visibleDependencies.filter((d) => d.teamId === teamId)
        title = teamNaam
      } else {
        deps = visibleDependencies.filter((d) => d.categorie === categorie)
        title = translateCategorie(categorie, language)
      }
      return { teamId: teamId ?? null, categorie: categorie ?? null, team, deps, title }
    },
    [teams, teamLabels, groups, visibleDependencies, language],
  )

  const heatmapSelectionInfo = useMemo(
    () => (heatmapSelection ? selectionInfo(heatmapSelection.teamId, heatmapSelection.categorie) : null),
    [heatmapSelection, selectionInfo],
  )

  // Alleen selecteren als er ook echt iets te tonen valt — lege rijen/
  // kolommen/cellen (geen dependencies) openen geen lege detailsectie.
  function selectHeatmapCell(team, categorie) {
    const teamId = team ? team.id : null
    if (selectionInfo(teamId, categorie ?? null).deps.length === 0) return
    setHeatmapSelection({ teamId, categorie: categorie ?? null })
  }

  function clearHeatmapSelection() {
    setHeatmapSelection(null)
  }

  function toggleRiskLevel(level) {
    setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]))
  }

  function toggleWorkflowStap(v) {
    setSelectedWorkflowStap((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  function renderHoverContent() {
    if (!hover) return null
    const breakdown = riskBreakdown(hover.payload.deps)
    // Een cel-hover levert data.label ('team · categorie'), een kolomkop
    // alleen data.categorie — zonder deze fallback toonde een kolom-hover
    // een lege titel.
    const title = hover.payload.label ?? translateCategorie(hover.payload.categorie, language)
    return (
      <div>
        <div className="mb-1.5 font-semibold text-slate-50">{title}</div>
        <div className="space-y-1">
          {RISK_LEVELS.slice()
            .reverse()
            .map((level) => {
              const style = riskStyle(level)
              return (
                <div key={level} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                    {translateRiskLevel(level, language)}
                  </span>
                  <span className="font-medium text-slate-50">{breakdown[level]}</span>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  // trapFocus: false — de detailsectie is een sectie ín de pagina (geen
  // modal), dus Tab moet gewoon verder de pagina in kunnen; Escape sluit 'm wel.
  const heatmapPanelRef = useRef(null)
  useModalA11y({ open: Boolean(heatmapSelection), onClose: clearHeatmapSelection, containerRef: heatmapPanelRef, trapFocus: false })

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-end">
          <ScopeToggle scope={scope} onChange={setScope} />
        </div>

        {/* Geen vaste hoogte: de tabel mag zo hoog zijn als de inhoud vraagt —
            anders houdt hij bij weinig teams/categorieën een groot leeg wit
            vlak over onder de tabel, met alles wat je erna ziet
            (detailsectie) ver naar beneden geduwd. */}
        <div className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {categoriesPresent.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('heatmap.noDeps')}</div>
              ) : (
                <div
                  className="grid gap-2"
                  style={{
                    // 1fr i.p.v. een vaste max-breedte/hoogte: cellen vullen exact de
                    // beschikbare ruimte en schalen dus mee met het scherm, met een
                    // ondergrens zodat ze bij heel veel teams/categorieën leesbaar
                    // blijven (dan schakelt overflow-auto over op scrollen).
                    gridTemplateColumns: `minmax(140px, 220px) repeat(${categoriesPresent.length}, minmax(56px, 1fr))`,
                    gridTemplateRows: `auto repeat(${visibleTeams.length}, minmax(48px, 1fr))`,
                  }}
                >
                  <div className="sticky top-0 z-20 bg-white" />
                  {categoriesPresent.map((cat) => {
                    const catDeps = visibleTeams.flatMap((team) => groups.get(`${team.id}::${cat}`) ?? [])
                    return (
                      <button
                        key={`head-${cat}`}
                        type="button"
                        onClick={() => selectHeatmapCell(null, cat)}
                        onMouseEnter={(event) => {
                          setHoverHeatmapCol(cat)
                          setHover({ x: event.clientX, y: event.clientY, payload: { categorie: cat, deps: catDeps } })
                        }}
                        onMouseMove={(event) => setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                        onMouseLeave={() => {
                          setHoverHeatmapCol(null)
                          setHover(null)
                        }}
                        title={translateCategorie(cat, language)}
                        className={`sticky top-0 z-20 flex cursor-pointer flex-col items-center gap-1 rounded-md px-1 pb-1.5 pt-1 transition-colors ${
                          hoverHeatmapCol === cat ? 'bg-[#2a5f8a]/10' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <CategoryIcon categorie={cat} className="h-5 w-5 shrink-0 text-slate-400" />
                        <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-slate-500">
                          {translateCategorie(cat, language)}
                        </span>
                      </button>
                    )
                  })}
                  {visibleTeams.flatMap((team) => [
                    <button
                      key={`label-${team.id}`}
                      type="button"
                      onClick={() => selectHeatmapCell(team, null)}
                      onMouseEnter={() => setHoverHeatmapRow(team.id)}
                      onMouseLeave={() => setHoverHeatmapRow(null)}
                      title={teamLabels[team.id] ?? team.naam}
                      className={`flex min-w-0 cursor-pointer items-center overflow-hidden rounded-md px-2 text-left text-sm font-medium transition-colors ${
                        hoverHeatmapRow === team.id ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {/* truncate op een eigen span (niet op de flex-button
                          zelf): een lange teamnaam liep anders buiten de
                          140px-labelkolom door en schilderde dwars over de
                          datacellen heen. */}
                      <span className="min-w-0 truncate">{teamLabels[team.id] ?? team.naam}</span>
                    </button>,
                    ...categoriesPresent.map((cat) => {
                      const deps = groups.get(`${team.id}::${cat}`) ?? []
                      const cellKey = `${team.id}::${cat}`
                      // Cel-hover wint van rij-/kolom-hover: hoveren van één
                      // cel dimt alle andere cellen (ook binnen dezelfde
                      // rij/kolom), i.p.v. de hele kolom/rij te markeren —
                      // dat blijft voorbehouden aan het hoveren van de
                      // rij-/kolomkop zelf.
                      const dimmed = hoveredCell
                        ? hoveredCell !== cellKey
                        : hoverHeatmapCol
                          ? hoverHeatmapCol !== cat
                          : hoverHeatmapRow
                            ? hoverHeatmapRow !== team.id
                            : false
                      if (deps.length === 0) {
                        return (
                          <div
                            key={cellKey}
                            className="rounded-lg bg-slate-50 transition-opacity"
                            style={{ opacity: dimmed ? 0.35 : 1 }}
                          />
                        )
                      }
                      const risk = highestRisk(deps)
                      const style = riskStyle(risk.level)
                      return (
                        <button
                          key={cellKey}
                          type="button"
                          onClick={() => selectHeatmapCell(team, cat)}
                          onMouseEnter={(event) => {
                            setHoveredCell(cellKey)
                            setHover({
                              x: event.clientX,
                              y: event.clientY,
                              payload: { label: `${teamLabels[team.id] ?? team.naam} · ${translateCategorie(cat, language)}`, deps },
                            })
                          }}
                          onMouseMove={(event) => setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                          onMouseLeave={() => {
                            setHoveredCell(null)
                            setHover(null)
                          }}
                          title={`${teamLabels[team.id] ?? team.naam} · ${translateCategorie(cat, language)} · ${translateRiskLevel(risk.level, language)}`}
                          // Zonder aria-label is de toegankelijke naam van deze
                          // knop alleen het getal ('3'); je hoort dan niet bij
                          // welk team of welke categorie die cel hoort.
                          // Enkelvoud apart: één dependency las voorheen als
                          // "1 dependencies" in de schermlezer.
                          aria-label={t(deps.length === 1 ? 'heatmap.cellLabelEen' : 'heatmap.cellLabel', {
                            team: teamLabels[team.id] ?? team.naam,
                            categorie: translateCategorie(cat, language),
                            count: deps.length,
                            risico: translateRiskLevel(risk.level, language),
                          })}
                          className={`flex items-center justify-center rounded-lg text-sm font-semibold transition-all hover:opacity-80 ${style.badge}`}
                          style={{ opacity: dimmed ? 0.35 : 1 }}
                        >
                          {deps.length}
                        </button>
                      )
                    }),
                  ])}
                </div>
              )}
            </div>

            {categoriesPresent.length > 0 && adminSections.categorieUitleg && (
              <div className="border-t border-slate-100 bg-white px-4 py-2">
                <button
                  type="button"
                  onClick={() => setLegendOpen((v) => !v)}
                  aria-expanded={legendOpen}
                  className="flex items-center gap-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600"
                >
                  <span className={`transition-transform ${legendOpen ? 'rotate-90' : ''}`} aria-hidden="true">
                    ›
                  </span>
                  {legendOpen ? t('heatmap.legendHide') : t('heatmap.legendShow')}
                </button>
                {legendOpen && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-0.5">
                    {categoriesPresent.map((cat) => (
                      <span key={`legend-${cat}`} className="flex items-center gap-1 text-xs text-slate-500">
                        <CategoryIcon categorie={cat} className="h-3.5 w-3.5 shrink-0" />
                        {translateCategorie(cat, language)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {hover && (
            <FloatingTooltip x={hover.x} y={hover.y}>
              {renderHoverContent()}
            </FloatingTooltip>
          )}
        </div>

        {heatmapSelectionInfo && adminSections.selectiepaneel && (
          <div ref={heatmapPanelRef} className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <h2 className="min-w-0 text-sm font-semibold text-slate-800">
                {heatmapSelectionInfo.title}
                <span className="ml-2 font-normal text-slate-400">({heatmapSelectionInfo.deps.length})</span>
              </h2>
              <button
                type="button"
                onClick={clearHeatmapSelection}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                {t('selectie.wissen')}
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="p-4">
              <DependencyTable
                dependencies={heatmapSelectionInfo.deps}
                onSelect={onSelect}
                showTeamColumn={!heatmapSelectionInfo.teamId}
                onTeamClick={onNavigateToTeam}
              />
            </div>
          </div>
        )}
      </div>

      {adminSections.filters && (
        <TeamFilterPanel
          teams={teams}
          selected={selectedTeamIds}
          onToggle={toggleTeam}
          onSelectAll={selectAllTeams}
          onSelectNone={selectNoTeams}
          riskLevels={selectedRiskLevels}
          onToggleRisk={toggleRiskLevel}
          onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
          onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
          workflowStap={{
            options: [...WORKFLOW_STAP_LEVELS, ''],
            selected: selectedWorkflowStap,
            onToggle: toggleWorkflowStap,
            onSelectAll: () => setSelectedWorkflowStap([...WORKFLOW_STAP_LEVELS, '']),
            onSelectNone: () => setSelectedWorkflowStap([]),
            renderLabel: (v) => (v === '' ? t('filter.notSet') : translateWorkflowStap(v, language)),
          }}
        />
      )}
    </div>
  )
}
