import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import ScopeToggle from './ScopeToggle'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  translateRiskLevel,
  translateWorkflowStap,
  translateEffectOpFlow,
  translateOplossingsniveau,
  getCategoryDescription,
} from '../i18n/labels'
import FloatingTooltip from './FloatingTooltip'
import TeamFilterPanel from './TeamFilterPanel'
import { CategoryIcon } from '../data/categoryIcons'
import { RISK_LEVELS, WORKFLOW_STAP_LEVELS, EFFECT_OP_FLOW_LEVELS, OPLOSSINGSNIVEAU_LEVELS } from '../data/constants'

export default function MatrixView({ onSelect }) {
  const { dependencies, teams, functies, teamName, functieNames, scope } = useAppContext()
  const { t, language } = useLanguage()
  const [sortBy, setSortBy] = useState('risk_desc')
  const [hover, setHover] = useState(null) // { x, y, dependency, risk }
  // Matrix is een organisatiebreed overzicht en start dus altijd bij alle
  // teams — teamnavigatie (sidebar) en view-filtering (hier) zijn losgekoppeld.
  const [selectedTeams, setSelectedTeams] = useState(() => teams.map((tm) => tm.id))
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  const [selectedWorkflowStap, setSelectedWorkflowStap] = useState([...WORKFLOW_STAP_LEVELS, ''])
  const [selectedEffectOpFlow, setSelectedEffectOpFlow] = useState([...EFFECT_OP_FLOW_LEVELS, ''])
  const [selectedOplossingsniveau, setSelectedOplossingsniveau] = useState([...OPLOSSINGSNIVEAU_LEVELS, ''])
  const [excludedFunctieIds, setExcludedFunctieIds] = useState(() => new Set())

  function toggleTeam(id) {
    setSelectedTeams((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleRiskLevel(level) {
    setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]))
  }
  function toggleWorkflowStap(v) {
    setSelectedWorkflowStap((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  function toggleEffectOpFlow(v) {
    setSelectedEffectOpFlow((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  function toggleOplossingsniveau(v) {
    setSelectedOplossingsniveau((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  // Uitsluitingsset i.p.v. inclusielijst, zodat een later toegevoegde
  // functie automatisch zichtbaar blijft in het filter i.p.v. verborgen.
  function toggleFunctieFilter(id) {
    setExcludedFunctieIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectedFunctieIds = useMemo(
    () => [...functies.map((f) => f.id), ''].filter((id) => !excludedFunctieIds.has(id)),
    [functies, excludedFunctieIds],
  )

  const SORT_OPTIONS = [
    { id: 'risk_desc', label: t('matrix.sort.riskDesc') },
    { id: 'risk_asc', label: t('matrix.sort.riskAsc') },
    { id: 'updated_desc', label: t('matrix.sort.updated') },
  ]

  const rows = useMemo(() => {
    const filtered = dependencies.filter((d) => {
      if (!selectedTeams.includes(d.teamId) || d.scope !== scope) return false
      if (!selectedWorkflowStap.includes(d.workflowStap ?? '')) return false
      if (!selectedEffectOpFlow.includes(d.effectOpFlow ?? '')) return false
      if (!selectedOplossingsniveau.includes(d.oplossingsniveau ?? '')) return false
      const owners = Array.isArray(d.eigenaarFunctieIds) ? d.eigenaarFunctieIds : []
      const ownerMatch = owners.length > 0 ? owners.some((id) => selectedFunctieIds.includes(id)) : selectedFunctieIds.includes('')
      return ownerMatch
    })
    const withRisk = filtered
      .map((d) => ({ dependency: d, risk: calculateRisk(d) }))
      .filter(({ risk }) => selectedRiskLevels.includes(risk.level))

    withRisk.sort((a, b) => {
      if (sortBy === 'risk_asc') return a.risk.score - b.risk.score
      if (sortBy === 'updated_desc') return b.dependency.laatst_bijgewerkt.localeCompare(a.dependency.laatst_bijgewerkt)
      return b.risk.score - a.risk.score
    })

    return withRisk
  }, [
    dependencies,
    selectedTeams,
    scope,
    sortBy,
    selectedRiskLevels,
    selectedWorkflowStap,
    selectedEffectOpFlow,
    selectedOplossingsniveau,
    selectedFunctieIds,
  ])

  const teamLabel =
    selectedTeams.length === 1
      ? teamName(selectedTeams[0])
      : selectedTeams.length === 0
        ? t('matrix.count')
        : t('matrix.multipleTeams', { count: selectedTeams.length })
  const showTeamColumn = selectedTeams.length !== 1

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">
            {teamLabel}
            <span className="ml-2 font-normal text-slate-400">({rows.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <ScopeToggle />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label={t('matrix.sort.label')}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">{t('matrix.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                {showTeamColumn && <th className="px-5 py-2.5 font-medium">{t('matrix.col.team')}</th>}
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.titel')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.categorie')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.eigenaar')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.workflowstap')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.effectOpFlow')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.oplossingsniveau')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.impact')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.frequentie')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.status')}</th>
                <th className="sticky right-0 border-l border-slate-200 bg-white px-5 py-2.5 font-medium">
                  {t('matrix.col.risico')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ dependency, risk }) => {
                const style = riskStyle(risk.level)
                return (
                  <tr
                    key={dependency.id}
                    onClick={() => onSelect(dependency)}
                    onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, dependency, risk })}
                    onMouseMove={(e) => setHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                    onMouseLeave={() => setHover(null)}
                    className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-[#2a5f8a]/[0.03]"
                  >
                    {showTeamColumn && <td className="px-5 py-3 text-slate-500">{teamName(dependency.teamId)}</td>}
                    <td className="px-5 py-3 font-medium text-slate-800">{dependency.titel}</td>
                    <td className="px-5 py-3 text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <CategoryIcon categorie={dependency.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {translateCategorie(dependency.categorie, language)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{functieNames(dependency.eigenaarFunctieIds) || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{translateWorkflowStap(dependency.workflowStap, language) || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{translateEffectOpFlow(dependency.effectOpFlow, language) || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{translateOplossingsniveau(dependency.oplossingsniveau, language) || '—'}</td>
                    <td className="px-5 py-3 capitalize text-slate-500">{translateImpact(dependency.impact, language)}</td>
                    <td className="px-5 py-3 capitalize text-slate-500">
                      {translateFrequentie(dependency.frequentie, language)}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{translateStatus(dependency.status, language)}</td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.round((risk.score / 11) * 100))}%`, backgroundColor: style.hex }}
                          />
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}
                        >
                          {translateRiskLevel(risk.level, language)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}

        {hover && (
          <FloatingTooltip x={hover.x} y={hover.y}>
            <div className="font-semibold text-slate-50">{hover.dependency.titel}</div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {translateCategorie(hover.dependency.categorie, language)}
            </div>
            <div className="mb-2 text-slate-300">
              {getCategoryDescription(hover.dependency.categorie, hover.dependency.scope, language)}
            </div>
            {hover.dependency.toelichting && <div className="mb-2 text-slate-300">{hover.dependency.toelichting}</div>}
            {(hover.dependency.workflowStap || hover.dependency.effectOpFlow || hover.dependency.oplossingsniveau) && (
              <div className="mb-2 space-y-0.5 text-slate-300">
                {hover.dependency.workflowStap && <div>{t('detail.workflowStap')}: {translateWorkflowStap(hover.dependency.workflowStap, language)}</div>}
                {hover.dependency.effectOpFlow && <div>{t('detail.effectOpFlow')}: {translateEffectOpFlow(hover.dependency.effectOpFlow, language)}</div>}
                {hover.dependency.oplossingsniveau && <div>{t('detail.oplossingsniveau')}: {translateOplossingsniveau(hover.dependency.oplossingsniveau, language)}</div>}
              </div>
            )}
            <div className="space-y-1 border-t border-slate-600/50 pt-2">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">
                  {translateImpact(hover.dependency.impact, language)} × {translateFrequentie(hover.dependency.frequentie, language)}
                </span>
                <span className="font-medium text-slate-50">
                  {hover.risk.breakdown.impactPoints} × {hover.risk.breakdown.frequencyPoints} = {hover.risk.breakdown.baseScore}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">{translateStatus(hover.dependency.status, language)}</span>
                <span className="font-medium text-slate-50">
                  {hover.risk.breakdown.statusCorrection > 0 ? '+' : ''}
                  {hover.risk.breakdown.statusCorrection}
                </span>
              </div>
              <div className="flex justify-between gap-3 font-medium">
                <span className="text-slate-200">{t('tooltip.finalScore')}</span>
                <span style={{ color: riskStyle(hover.risk.level).onDark }}>
                  {hover.risk.score} → {translateRiskLevel(hover.risk.level, language)}
                </span>
              </div>
            </div>
            <div className="mt-2 border-t border-slate-600/50 pt-2 text-slate-300">
              {hover.dependency.mitigatie ? hover.dependency.mitigatie : t('tooltip.noMitigation')}
            </div>
          </FloatingTooltip>
        )}
      </div>

      <TeamFilterPanel
        teams={teams}
        selected={selectedTeams}
        onToggle={toggleTeam}
        onSelectAll={() => setSelectedTeams(teams.map((tm) => tm.id))}
        onSelectNone={() => setSelectedTeams([])}
        riskLevels={selectedRiskLevels}
        onToggleRisk={toggleRiskLevel}
        onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
        onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
        workflowStap={{
          options: [...WORKFLOW_STAP_LEVELS, ''],
          selected: selectedWorkflowStap,
          onToggle: toggleWorkflowStap,
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateWorkflowStap(v, language)),
        }}
        effectOpFlow={{
          options: [...EFFECT_OP_FLOW_LEVELS, ''],
          selected: selectedEffectOpFlow,
          onToggle: toggleEffectOpFlow,
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateEffectOpFlow(v, language)),
        }}
        oplossingsniveau={{
          options: [...OPLOSSINGSNIVEAU_LEVELS, ''],
          selected: selectedOplossingsniveau,
          onToggle: toggleOplossingsniveau,
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateOplossingsniveau(v, language)),
        }}
        eigenaarFunctie={{
          options: [...functies, { id: '', naam: t('filter.notSet') }],
          selected: selectedFunctieIds,
          onToggle: toggleFunctieFilter,
        }}
      />
    </div>
  )
}
