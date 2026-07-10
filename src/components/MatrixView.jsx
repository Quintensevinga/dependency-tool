import { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  translateRiskLevel,
  getCategoryDescription,
} from '../i18n/labels'
import FloatingTooltip from './FloatingTooltip'
import TeamFilterPanel from './TeamFilterPanel'
import { CategoryIcon } from '../data/categoryIcons'
import { RISK_LEVELS } from '../data/constants'

export default function MatrixView({ onSelect }) {
  const { dependencies, teams, currentTeam, scope } = useAppContext()
  const { t, language } = useLanguage()
  const [sortBy, setSortBy] = useState('risk_desc')
  const [hover, setHover] = useState(null) // { x, y, dependency, risk }
  const [selectedTeams, setSelectedTeams] = useState(() => (currentTeam ? [currentTeam] : []))
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)

  // Volgt de globale actieve team-context (hamburgermenu); binnen deze view
  // kan de gebruiker daarna zelf meer teams toevoegen via het filterpaneel.
  useEffect(() => {
    setSelectedTeams(currentTeam ? [currentTeam] : [])
  }, [currentTeam])

  function toggleTeam(team) {
    setSelectedTeams((prev) => (prev.includes(team) ? prev.filter((x) => x !== team) : [...prev, team]))
  }

  function toggleRiskLevel(level) {
    setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]))
  }

  const SORT_OPTIONS = [
    { id: 'risk_desc', label: t('matrix.sort.riskDesc') },
    { id: 'risk_asc', label: t('matrix.sort.riskAsc') },
    { id: 'updated_desc', label: t('matrix.sort.updated') },
  ]

  const rows = useMemo(() => {
    const filtered = dependencies.filter((d) => selectedTeams.includes(d.team) && d.scope === scope)
    const withRisk = filtered
      .map((d) => ({ dependency: d, risk: calculateRisk(d) }))
      .filter(({ risk }) => selectedRiskLevels.includes(risk.level))

    withRisk.sort((a, b) => {
      if (sortBy === 'risk_asc') return a.risk.score - b.risk.score
      if (sortBy === 'updated_desc') return b.dependency.laatst_bijgewerkt.localeCompare(a.dependency.laatst_bijgewerkt)
      return b.risk.score - a.risk.score
    })

    return withRisk
  }, [dependencies, selectedTeams, scope, sortBy, selectedRiskLevels])

  const scopeLabel = scope === 'intern' ? t('matrix.internLabel') : t('matrix.externLabel')
  const teamLabel =
    selectedTeams.length === 1 ? selectedTeams[0] : selectedTeams.length === 0 ? t('matrix.count') : t('matrix.multipleTeams', { count: selectedTeams.length })
  const showTeamColumn = selectedTeams.length !== 1

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-stone-800">
            {teamLabel} — {scopeLabel}
            <span className="ml-2 font-normal text-stone-400">({rows.length})</span>
          </h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 focus:border-[#33493c] focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-stone-400">{t('matrix.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
                {showTeamColumn && <th className="px-5 py-2.5 font-medium">{t('matrix.col.team')}</th>}
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.titel')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.categorie')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.rol')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.impact')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.frequentie')}</th>
                <th className="px-5 py-2.5 font-medium">{t('matrix.col.status')}</th>
                <th className="sticky right-0 border-l border-stone-200 bg-white px-5 py-2.5 font-medium">
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
                    className="cursor-pointer border-b border-stone-100 last:border-b-0 hover:bg-[#33493c]/[0.03]"
                  >
                    {showTeamColumn && <td className="px-5 py-3 text-stone-500">{dependency.team}</td>}
                    <td className="px-5 py-3 font-medium text-stone-800">{dependency.titel}</td>
                    <td className="px-5 py-3 text-stone-500">
                      <span className="flex items-center gap-1.5">
                        <CategoryIcon categorie={dependency.categorie} className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        {translateCategorie(dependency.categorie, language)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-stone-500">{dependency.rol_betrokkene}</td>
                    <td className="px-5 py-3 capitalize text-stone-500">{translateImpact(dependency.impact, language)}</td>
                    <td className="px-5 py-3 capitalize text-stone-500">
                      {translateFrequentie(dependency.frequentie, language)}
                    </td>
                    <td className="px-5 py-3 text-stone-500">{translateStatus(dependency.status, language)}</td>
                    <td className="sticky right-0 border-l border-stone-200 bg-white px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {translateRiskLevel(risk.level, language)}
                      </span>
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
            <div className="font-semibold text-stone-50">{hover.dependency.titel}</div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400">
              {translateCategorie(hover.dependency.categorie, language)}
            </div>
            <div className="mb-2 text-stone-300">
              {getCategoryDescription(hover.dependency.categorie, hover.dependency.scope, language)}
            </div>
            {hover.dependency.toelichting && <div className="mb-2 text-stone-300">{hover.dependency.toelichting}</div>}
            <div className="space-y-1 border-t border-stone-600/50 pt-2">
              <div className="flex justify-between gap-3">
                <span className="text-stone-400">
                  {translateImpact(hover.dependency.impact, language)} × {translateFrequentie(hover.dependency.frequentie, language)}
                </span>
                <span className="font-medium text-stone-50">
                  {hover.risk.breakdown.impactPoints} × {hover.risk.breakdown.frequencyPoints} = {hover.risk.breakdown.baseScore}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-stone-400">{translateStatus(hover.dependency.status, language)}</span>
                <span className="font-medium text-stone-50">
                  {hover.risk.breakdown.statusCorrection > 0 ? '+' : ''}
                  {hover.risk.breakdown.statusCorrection}
                </span>
              </div>
              <div className="flex justify-between gap-3 font-medium">
                <span className="text-stone-200">{t('tooltip.finalScore')}</span>
                <span style={{ color: riskStyle(hover.risk.level).onDark }}>
                  {hover.risk.score} → {translateRiskLevel(hover.risk.level, language)}
                </span>
              </div>
            </div>
            <div className="mt-2 border-t border-stone-600/50 pt-2 text-stone-300">
              {hover.dependency.mitigatie ? hover.dependency.mitigatie : t('tooltip.noMitigation')}
            </div>
          </FloatingTooltip>
        )}
      </div>

      <TeamFilterPanel
        teams={teams}
        selected={selectedTeams}
        onToggle={toggleTeam}
        onSelectAll={() => setSelectedTeams(teams)}
        onSelectNone={() => setSelectedTeams([])}
        riskLevels={selectedRiskLevels}
        onToggleRisk={toggleRiskLevel}
        onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
        onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
      />
    </div>
  )
}
