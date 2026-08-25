import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { generateId, emptyApplicatieflow } from '../lib/storage'

// Puur de koppel-vragenlijst: welke applicatie geeft werk/data door aan
// welke andere. Applicatie-details (toelichting, risico bij uitval) staan
// nu bij 'Applicaties in beheer/ontwikkeling' zelf — een apart los blok
// ernaast was dubbelop. Het eigen netwerk-canvas is verwijderd: de
// koppelingen worden als lijnen tussen de applicatie-lanes op het hoofd-
// workflow-canvas getekend zodra 'Split applicaties' daar aanstaat.
export default function ApplicatieflowTab({ workflow, patch, onAddApplication }) {
  const { t } = useLanguage()

  const applications = workflow.applications
  const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()

  function patchApplicatieflow(partial) {
    patch({ applicatieflow: { ...applicatieflow, ...partial } })
  }

  function addConnection(van, naar) {
    if (!van || !naar || van === naar) return
    patchApplicatieflow({ connecties: [...applicatieflow.connecties, { id: generateId(), van, naar }] })
  }

  function removeConnection(id) {
    patchApplicatieflow({ connecties: applicatieflow.connecties.filter((c) => c.id !== id) })
  }

  if (applications.length === 0) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
        {t('appflow.noApplications')}
        {onAddApplication && (
          <button
            type="button"
            onClick={onAddApplication}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t('appflow.addApplication')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{t('appflow.questionTitle')}</h3>
        {onAddApplication && (
          <button
            type="button"
            onClick={onAddApplication}
            className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
          >
            {t('appflow.addApplication')}
          </button>
        )}
      </div>
      {applicatieflow.connecties.length === 0 && <p className="mb-2 text-xs text-slate-400">{t('appflow.connectionsEmpty')}</p>}
      <div className="space-y-2">
        {applicatieflow.connecties.map((c) => {
          const van = applications.find((a) => a.id === c.van)
          const naar = applications.find((a) => a.id === c.naar)
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
              <span className="font-medium text-slate-700">{van?.naam || '—'}</span>
              <span className="text-slate-400">→</span>
              <span className="font-medium text-slate-700">{naar?.naam || '—'}</span>
              <button type="button" onClick={() => removeConnection(c.id)} className="ml-auto text-xs text-[#9a3b2e] hover:underline">
                {t('teampage.remove')}
              </button>
            </div>
          )
        })}
      </div>
      <ConnectionPicker applications={applications} onAdd={addConnection} t={t} />
    </div>
  )
}

function ConnectionPicker({ applications, onAdd, t }) {
  const [van, setVan] = useState('')
  const [naar, setNaar] = useState('')

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
      <select
        value={van}
        onChange={(e) => setVan(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
      >
        <option value="">{t('appflow.vanLabel')}</option>
        {applications.map((a) => (
          <option key={a.id} value={a.id}>
            {a.naam || '—'}
          </option>
        ))}
      </select>
      <span className="text-slate-400">→</span>
      <select
        value={naar}
        onChange={(e) => setNaar(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
      >
        <option value="">{t('appflow.naarLabel')}</option>
        {applications.map((a) => (
          <option key={a.id} value={a.id}>
            {a.naam || '—'}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onAdd(van, naar)
          setVan('')
          setNaar('')
        }}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {t('appflow.addConnection')}
      </button>
    </div>
  )
}
