import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { translateRiskLevel } from '../i18n/labels'
import { riskStyle } from '../lib/riskStyles'

function CheckboxGroup({ title, options, selected, onToggle, renderLabel, renderDot, footer }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      <div className="space-y-2">
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.id
          const label = renderLabel ? renderLabel(opt) : typeof opt === 'string' ? opt : opt.naam
          return (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
                className="h-3.5 w-3.5 rounded border-stone-300 accent-[#33493c]"
              />
              {renderDot && renderDot(opt)}
              {label}
            </label>
          )
        })}
      </div>
      {footer}
    </div>
  )
}

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
  workflowStap,
  effectOpFlow,
  oplossingsniveau,
  eigenaarFunctie,
}) {
  const { t, language } = useLanguage()

  return (
    <div className="w-56 shrink-0 space-y-4">
      <CheckboxGroup
        title={t('nav.teams')}
        options={teams}
        selected={selected}
        onToggle={onToggle}
        renderLabel={(team) => (team.actief ? team.naam : `${team.naam} (${t('settings.archived')})`)}
        footer={
          <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3 text-xs">
            <button type="button" onClick={onSelectAll} className="font-medium text-[#33493c] hover:underline">
              {t('filter.selectAll')}
            </button>
            <button type="button" onClick={onSelectNone} className="font-medium text-stone-400 hover:underline">
              {t('filter.selectNone')}
            </button>
          </div>
        }
      />

      <CheckboxGroup
        title={t('filter.riskLevel')}
        options={RISK_LEVELS.slice().reverse()}
        selected={riskLevels}
        onToggle={onToggleRisk}
        renderLabel={(level) => translateRiskLevel(level, language)}
        renderDot={(level) => <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: riskStyle(level).hex }} />}
        footer={
          <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3 text-xs">
            <button type="button" onClick={onHideLowRisk} className="font-medium text-[#33493c] hover:underline">
              {t('filter.hideLowRisk')}
            </button>
            <button type="button" onClick={onShowAllRisk} className="font-medium text-stone-400 hover:underline">
              {t('filter.selectAll')}
            </button>
          </div>
        }
      />

      {workflowStap && (
        <CheckboxGroup
          title={t('filter.workflowStap')}
          options={workflowStap.options}
          selected={workflowStap.selected}
          onToggle={workflowStap.onToggle}
          renderLabel={workflowStap.renderLabel}
        />
      )}

      {effectOpFlow && (
        <CheckboxGroup
          title={t('filter.effectOpFlow')}
          options={effectOpFlow.options}
          selected={effectOpFlow.selected}
          onToggle={effectOpFlow.onToggle}
          renderLabel={effectOpFlow.renderLabel}
        />
      )}

      {oplossingsniveau && (
        <CheckboxGroup
          title={t('filter.oplossingsniveau')}
          options={oplossingsniveau.options}
          selected={oplossingsniveau.selected}
          onToggle={oplossingsniveau.onToggle}
          renderLabel={oplossingsniveau.renderLabel}
        />
      )}

      {eigenaarFunctie && (
        <CheckboxGroup
          title={t('filter.eigenaarFunctie')}
          options={eigenaarFunctie.options}
          selected={eigenaarFunctie.selected}
          onToggle={eigenaarFunctie.onToggle}
        />
      )}
    </div>
  )
}
