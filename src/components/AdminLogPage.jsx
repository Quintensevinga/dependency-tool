import { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { translateCategorie } from '../i18n/labels'
import DependencyForm from './DependencyForm'

const STATUS_STYLE = {
  pending: 'bg-[#2a5f8a]/10 text-[#2a5f8a]',
  approved: 'bg-emerald-600/10 text-emerald-700',
  edited: 'bg-amber-500/10 text-amber-700',
  rejected: 'bg-slate-200 text-slate-500',
}

// Wijzigingenlog voor de admin: elke nieuw aangemaakte dependency komt hier
// binnen, met een markering als die (waarschijnlijk) een duplicaat is van
// een dependency op een ander team. De admin houdt hiermee regie zonder de
// teams zelf te blokkeren — de dependency bestaat al, dit is puur review +
// (bij een duplicaat) de twee teams aan elkaar koppelen.
export default function AdminLogPage() {
  const { changeLog, dependencies, teamName, approveChange, rejectChange, markChangeEdited, updateDependency } = useAppContext()
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)

  const sorted = [...changeLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const pending = sorted.filter((c) => c.status === 'pending')
  const afgehandeld = sorted.filter((c) => c.status !== 'pending')

  function depFor(id) {
    return dependencies.find((d) => d.id === id)
  }

  function Row({ entry }) {
    const dep = depFor(entry.dependencyId)
    const duplicate = entry.duplicateOfId ? depFor(entry.duplicateOfId) : null
    if (!dep) return null
    return (
      <div className="rounded-md border border-slate-200 bg-white p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-700">{dep.titel}</div>
            <div className="text-[11px] text-slate-400">
              {teamName(entry.teamId)} · {translateCategorie(dep.categorie, language)} ·{' '}
              {new Date(entry.timestamp).toLocaleString(language === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[entry.status]}`}>
            {t(`adminlog.status.${entry.status}`)}
          </span>
        </div>
        {duplicate && (
          <div className="mt-1.5 rounded bg-[#9a3b2e]/5 px-2 py-1.5 text-[11px] text-[#9a3b2e]">
            {t('adminlog.duplicateWarning', { team: teamName(duplicate.teamId), titel: duplicate.titel })}
          </div>
        )}
        {entry.status === 'pending' && (
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => approveChange(entry.id)}
              className="rounded-md border border-emerald-600/30 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-600/5"
            >
              {t('adminlog.approve')}
            </button>
            <button
              type="button"
              onClick={() => setEditingLogId(entry.id)}
              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('adminlog.edit')}
            </button>
            <button
              type="button"
              onClick={() => rejectChange(entry.id)}
              className="rounded-md border border-[#9a3b2e]/30 px-2 py-1 text-[11px] font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
            >
              {t('adminlog.reject')}
            </button>
          </div>
        )}
      </div>
    )
  }

  const editingEntry = editingLogId ? sorted.find((c) => c.id === editingLogId) : null
  const editingDep = editingEntry ? depFor(editingEntry.dependencyId) : null

  return (
    <div className="rounded-md border border-slate-200">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="text-xs font-semibold text-slate-700">
          {t('adminlog.title')}
          {pending.length > 0 && <span className="ml-1.5 rounded-full bg-[#9a3b2e] px-1.5 py-0.5 text-[10px] font-medium text-white">{pending.length}</span>}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-100 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-slate-400">{t('adminlog.helper')}</p>
          {sorted.length === 0 && <p className="py-1.5 text-xs text-slate-400">{t('settings.empty')}</p>}
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {pending.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
            {afgehandeld.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-[11px] font-medium text-slate-400">
                  {t('adminlog.handledCount', { count: afgehandeld.length })}
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  {afgehandeld.map((entry) => (
                    <Row key={entry.id} entry={entry} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {editingEntry && editingDep && (
        <DependencyForm
          initialData={editingDep}
          onCancel={() => setEditingLogId(null)}
          onSave={(payload) => {
            updateDependency(editingDep.id, payload)
            markChangeEdited(editingEntry.id)
            setEditingLogId(null)
          }}
        />
      )}
    </div>
  )
}
