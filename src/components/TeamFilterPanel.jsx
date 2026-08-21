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

function PanelToggleIcon({ direction }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={direction === 'left' ? 'rotate-180' : ''}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AllNoneFooter({ onSelectAll, onSelectNone, t }) {
  if (!onSelectAll && !onSelectNone) return null
  return (
    <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-xs">
      {onSelectAll && (
        <button type="button" onClick={onSelectAll} className="font-medium text-[#2a5f8a] hover:underline">
          {t('filter.selectAll')}
        </button>
      )}
      {onSelectNone && (
        <button type="button" onClick={onSelectNone} className="font-medium text-slate-400 hover:underline">
          {t('filter.selectNone')}
        </button>
      )}
    </div>
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
}) {
  const { t, language } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)

  const anyNarrowed =
    (selected.length > 0 && selected.length < teams.length) ||
    (riskLevels.length > 0 && riskLevels.length < RISK_LEVELS.length) ||
    [workflowStap, effectOpFlow].some(
      (group) => group && group.selected.length > 0 && group.selected.length < group.options.length,
    )

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title={t('filter.expand')}
        className="flex h-fit shrink-0 flex-col items-center gap-2.5 rounded-xl border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-2 py-3.5 text-[#2a5f8a] shadow-sm hover:bg-[#2a5f8a]/10"
      >
        <PanelToggleIcon direction="left" />
        <span className="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wide">{t('filter.title')}</span>
        {anyNarrowed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2a5f8a]" title={t('filter.active')} />}
      </button>
    )
  }

  return (
    <div className="w-56 shrink-0 space-y-4">
      {/* Paneelbrede in/uitklap-knop: bewust met accentkleur i.p.v. het
          neutrale wit/grijs van de individuele filtergroepen hieronder, zodat
          'm niet aanziet voor zomaar nog een groep — dit klapt het hele
          paneel in tot een smalle balk. */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        title={t('filter.collapse')}
        className="flex w-full items-center justify-between rounded-xl border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-3 py-2 text-[#2a5f8a] shadow-sm hover:bg-[#2a5f8a]/10"
      >
        <span className="text-xs font-semibold uppercase tracking-wide">{t('filter.title')}</span>
        <PanelToggleIcon direction="right" />
      </button>

      <CheckboxGroup
        title={t('filter.teams')}
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
          footer={<AllNoneFooter onSelectAll={workflowStap.onSelectAll} onSelectNone={workflowStap.onSelectNone} t={t} />}
        />
      )}

      {effectOpFlow && (
        <CheckboxGroup
          title={t('filter.effectOpFlow')}
          options={effectOpFlow.options}
          selected={effectOpFlow.selected}
          onToggle={effectOpFlow.onToggle}
          renderLabel={effectOpFlow.renderLabel}
          footer={<AllNoneFooter onSelectAll={effectOpFlow.onSelectAll} onSelectNone={effectOpFlow.onSelectNone} t={t} />}
        />
      )}

    </div>
  )
}
