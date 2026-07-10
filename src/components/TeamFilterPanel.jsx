import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { translateRiskLevel } from '../i18n/labels'
import { riskStyle } from '../lib/riskStyles'

export default function TeamFilterPanel({
  teams,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  riskLevels,
  onToggleRisk,
  onHideLowRisk,
  onShowAllRisk,
}) {
  const { t, language } = useLanguage()

  return (
    <div className="w-56 shrink-0 space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{t('nav.teams')}</h3>
        <div className="space-y-2">
          {teams.map((team) => (
            <label key={team} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={selected.includes(team)}
                onChange={() => onToggle(team)}
                className="h-3.5 w-3.5 rounded border-stone-300 accent-[#33493c]"
              />
              {team}
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3 text-xs">
          <button type="button" onClick={onSelectAll} className="font-medium text-[#33493c] hover:underline">
            {t('filter.selectAll')}
          </button>
          <button type="button" onClick={onSelectNone} className="font-medium text-stone-400 hover:underline">
            {t('filter.selectNone')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{t('filter.riskLevel')}</h3>
        <div className="space-y-2">
          {RISK_LEVELS.slice()
            .reverse()
            .map((level) => {
              const style = riskStyle(level)
              return (
                <label key={level} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={riskLevels.includes(level)}
                    onChange={() => onToggleRisk(level)}
                    className="h-3.5 w-3.5 rounded border-stone-300 accent-[#33493c]"
                  />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                  {translateRiskLevel(level, language)}
                </label>
              )
            })}
        </div>
        <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3 text-xs">
          <button type="button" onClick={onHideLowRisk} className="font-medium text-[#33493c] hover:underline">
            {t('filter.hideLowRisk')}
          </button>
          <button type="button" onClick={onShowAllRisk} className="font-medium text-stone-400 hover:underline">
            {t('filter.selectAll')}
          </button>
        </div>
      </div>
    </div>
  )
}
