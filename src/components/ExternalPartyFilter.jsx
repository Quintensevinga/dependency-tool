import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { bronTypeColor } from '../lib/workflowStyles'

// Bediening van de externe partijen in het ketenoverzicht (uitklapmenu
// 'Partijen' op de canvasbalk). Eén regel: aangevinkt = kaartje op het
// canvas, uitgevinkt = weg. Bovenaan één schakelaar voor de afhankelijkheden
// (de gestippelde lijnen — meestal de algemene partijen als CAB of
// IAM-beheer), daaronder elke partij apart, met zoekveld, 'alleen' per partij
// (solo: alle andere uit) en Alles/Geen.
export default function ExternalPartyFilter({
  showDependencies,
  onToggleDependencies,
  parties,
  hiddenKeys,
  onToggleParty,
  onOnlyParty,
  onSelectAll,
  onSelectNone,
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const shownCount = parties.filter((p) => !hiddenKeys.has(p.key)).length
  const needle = query.trim().toLowerCase()
  const visible = needle ? parties.filter((p) => p.naam.toLowerCase().includes(needle)) : parties

  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={showDependencies} onChange={onToggleDependencies} className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]" />
        {t('filter.partiesDependencies')}
      </label>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('filter.partiesWhichCount', { shown: shownCount, total: parties.length })}
          </span>
          <span className="flex shrink-0 gap-2 text-xs">
            <button type="button" onClick={onSelectAll} className="font-medium text-[#2a5f8a] hover:underline">
              {t('filter.selectAll')}
            </button>
            <button type="button" onClick={onSelectNone} className="font-medium text-slate-400 hover:underline">
              {t('filter.selectNone')}
            </button>
          </span>
        </div>
        {parties.length > 8 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('filter.partiesSearch')}
            aria-label={t('filter.partiesSearch')}
            className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
          />
        )}
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {visible.length === 0 && <div className="text-xs text-slate-400">{t('chain.noParties')}</div>}
          {visible.map((party) => (
            <div key={party.key} className="group flex items-center gap-2" title={party.naam}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!hiddenKeys.has(party.key)}
                  onChange={() => onToggleParty(party.key)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-[#2a5f8a]"
                />
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: bronTypeColor(party.type) ?? '#5c6b8a' }} />
                <span className="min-w-0 flex-1 truncate">{party.naam}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{party.teamCount}</span>
              </label>
              {/* 'alleen': in één klik enkel deze partij overhouden — de
                  gebruikelijke solo-knop uit lagenpanelen; pas zichtbaar bij
                  hover/focus zodat de lijst rustig blijft. */}
              <button
                type="button"
                onClick={() => onOnlyParty(party.key)}
                title={t('filter.partiesOnlyHint')}
                className="shrink-0 rounded px-1 text-[10px] font-medium text-[#2a5f8a] opacity-0 hover:underline focus:opacity-100 group-hover:opacity-100"
              >
                {t('filter.partiesOnly')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
