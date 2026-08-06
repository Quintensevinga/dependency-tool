import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { RISICO_BIJ_UITVAL } from '../data/constants'
import { translateRisicoBijUitval } from '../i18n/labels'
import { generateId, emptyApplicatieflow } from '../lib/storage'

// Puur de koppel-vragenlijst (welke applicatie geeft werk/data door aan
// welke andere) + per-applicatie detail (toelichting, risico bij uitval).
// Het eigen netwerk-canvas is bewust verwijderd: de koppelingen worden nu
// als lijnen getekend tussen de applicatie-lanes op het hoofd-workflow-
// canvas zodra 'Split applicaties' daar aanstaat — dat voorkomt een tweede,
// losstaand canvas dat hetzelfde probeert te tonen.
export default function ApplicatieflowTab({ workflow, patch }) {
  const { t, language } = useLanguage()
  const [detailAppId, setDetailAppId] = useState(null)

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

  function saveDetail(appId, fields) {
    patchApplicatieflow({ details: { ...applicatieflow.details, [appId]: { ...applicatieflow.details[appId], ...fields } } })
  }

  const detailApp = applications.find((a) => a.id === detailAppId)
  const detailData = detailAppId ? (applicatieflow.details[detailAppId] ?? {}) : {}

  if (applications.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
        {t('appflow.noApplications')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{t('appflow.questionTitle')}</h3>
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{t('appflow.detailsListTitle')}</h3>
        <ul className="divide-y divide-slate-100">
          {applications.map((app) => {
            const data = applicatieflow.details[app.id] ?? {}
            return (
              <li key={app.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{app.naam || '—'}</span>
                {data.risico_bij_uitval === 'ja' && (
                  <span className="shrink-0 rounded bg-[#9a3b2e]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#9a3b2e]">
                    {t('appflow.detailRisico')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDetailAppId(app.id)}
                  className="shrink-0 text-xs font-medium text-[#2a5f8a] hover:underline"
                >
                  {data.toelichting || data.risico_bij_uitval ? t('appflow.detailEdit') : t('appflow.detailAdd')}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">{detailApp.naam}</h3>
              <button type="button" onClick={() => setDetailAppId(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailToelichting')}</label>
                <textarea
                  value={detailData.toelichting ?? ''}
                  onChange={(e) => saveDetail(detailAppId, { toelichting: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">{t('appflow.detailRisico')}</label>
                <select
                  value={detailData.risico_bij_uitval ?? ''}
                  onChange={(e) => saveDetail(detailAppId, { risico_bij_uitval: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                >
                  <option value="">—</option>
                  {RISICO_BIJ_UITVAL.map((val) => (
                    <option key={val} value={val}>
                      {translateRisicoBijUitval(val, language)}
                    </option>
                  ))}
                </select>
              </div>
              {detailData.risico_bij_uitval === 'ja' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailRisicoToelichting')}</label>
                  <input
                    value={detailData.risico_toelichting ?? ''}
                    onChange={(e) => saveDetail(detailAppId, { risico_toelichting: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setDetailAppId(null)}
                className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
              >
                {t('appflow.detailClose')}
              </button>
            </div>
          </div>
        </div>
      )}
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
