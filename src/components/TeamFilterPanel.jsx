import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { translateRiskLevel } from '../i18n/labels'
import { riskStyle } from '../lib/riskStyles'

function ChevronIcon({ open }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckboxGroup({ title, options, selected, onToggle, renderLabel, renderDot, footer, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const narrowed = selected.length > 0 && selected.length < options.length

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        <span className="flex items-center gap-1.5">
          {narrowed && <span className="h-1.5 w-1.5 rounded-full bg-[#2a5f8a]" title="Filter actief" />}
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-2">
            {options.map((opt) => {
              const value = typeof opt === 'string' ? opt : opt.id
              const label = renderLabel ? renderLabel(opt) : typeof opt === 'string' ? opt : opt.naam
              return (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => onToggle(value)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
                  />
                  {renderDot && renderDot(opt)}
                  {label}
                </label>
              )
            })}
          </div>
          {footer}
        </div>
      )}
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
        defaultOpen
        renderLabel={(team) => (team.actief ? team.naam : `${team.naam} (${t('settings.archived')})`)}
        footer={
          <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-xs">
            <button type="button" onClick={onSelectAll} className="font-medium text-[#2a5f8a] hover:underline">
              {t('filter.selectAll')}
            </button>
            <button type="button" onClick={onSelectNone} className="font-medium text-slate-400 hover:underline">
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
        defaultOpen
        renderLabel={(level) => translateRiskLevel(level, language)}
        renderDot={(level) => <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: riskStyle(level).hex }} />}
        footer={
          <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-xs">
            <button type="button" onClick={onHideLowRisk} className="font-medium text-[#2a5f8a] hover:underline">
              {t('filter.hideLowRisk')}
            </button>
            <button type="button" onClick={onShowAllRisk} className="font-medium text-slate-400 hover:underline">
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
