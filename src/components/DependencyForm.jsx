import { useState } from 'react'
import {
  categoriesForScope,
  IMPACT_LEVELS,
  FREQUENCY_LEVELS,
  STATUS_LEVELS,
} from '../data/constants'
import { useLanguage } from '../context/LanguageContext'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  getCategoryDescription,
} from '../i18n/labels'

const EMPTY_FORM = {
  scope: 'intern',
  categorie: '',
  titel: '',
  toelichting: '',
  rol_betrokkene: '',
  geraakte_team_extern: '',
  impact: '',
  frequentie: '',
  status: '',
  mitigatie: '',
}

function Label({ children, required }) {
  return (
    <label className="mb-1 block text-xs font-medium text-stone-600">
      {children}
      {required && <span className="ml-0.5 text-stone-400">*</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-[#33493c] focus:outline-none'

export default function DependencyForm({ team, initialData, prefill, onSave, onCancel }) {
  const { t, language } = useLanguage()
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...prefill, ...initialData }))
  const [touched, setTouched] = useState({})

  const requiredFields = ['categorie', 'titel', 'rol_betrokkene', 'impact', 'frequentie', 'status']
  const errors = {}
  for (const field of requiredFields) {
    if (!form[field]?.trim?.()) errors[field] = t('form.required')
  }
  if (form.scope === 'extern' && !form.geraakte_team_extern?.trim()) {
    errors.geraakte_team_extern = t('form.required')
  }

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function update(field, value) {
    setForm((f) => {
      if (field === 'scope') {
        return { ...f, scope: value, categorie: '' }
      }
      return { ...f, [field]: value }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(Object.fromEntries(requiredFields.map((f) => [f, true])))
    if (Object.keys(errors).length > 0) return
    const payload = { ...form, team }
    if (form.scope === 'intern') delete payload.geraakte_team_extern
    onSave(payload)
  }

  const categories = categoriesForScope(form.scope)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="border-b border-stone-200 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            {initialData ? t('form.titleEdit') : t('form.titleNew')}
          </h3>
          <p className="mt-0.5 text-xs text-stone-400">{team}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <Label required>{t('form.scope')}</Label>
            <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-sm">
              {['intern', 'extern'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('scope', value)}
                  className={`rounded px-3 py-1 capitalize transition-colors ${
                    form.scope === value ? 'bg-[#33493c] text-white' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {value === 'intern' ? t('form.scopeIntern') : t('form.scopeExtern')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label required>{t('form.categorie')}</Label>
              {form.categorie && (
                <div className="group relative -mt-1 flex items-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="cursor-help text-stone-400">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 11v5.5M12 8v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <div className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-64 rounded-lg bg-[#241f1a] px-3 py-2.5 text-xs leading-relaxed text-stone-100 shadow-xl group-hover:block">
                    {getCategoryDescription(form.categorie, form.scope, language)}
                  </div>
                </div>
              )}
            </div>
            <select
              value={form.categorie}
              onChange={(e) => update('categorie', e.target.value)}
              onBlur={() => markTouched('categorie')}
              className={inputClass}
            >
              <option value="">{t('form.categoriePlaceholder')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} title={getCategoryDescription(cat, form.scope, language)}>
                  {translateCategorie(cat, language)}
                </option>
              ))}
            </select>
            {touched.categorie && errors.categorie && (
              <p className="mt-1 text-xs text-stone-400">{errors.categorie}</p>
            )}
          </div>

          <div>
            <Label required>{t('form.titel')}</Label>
            <input
              value={form.titel}
              onChange={(e) => update('titel', e.target.value)}
              onBlur={() => markTouched('titel')}
              placeholder={t('form.titelPlaceholder')}
              className={inputClass}
            />
            {touched.titel && errors.titel && <p className="mt-1 text-xs text-stone-400">{errors.titel}</p>}
          </div>

          <div>
            <Label>{t('form.toelichting')}</Label>
            <textarea
              value={form.toelichting}
              onChange={(e) => update('toelichting', e.target.value)}
              rows={2}
              placeholder={t('form.toelichtingPlaceholder')}
              className={inputClass}
            />
          </div>

          <div>
            <Label required>{t('form.rol')}</Label>
            <input
              value={form.rol_betrokkene}
              onChange={(e) => update('rol_betrokkene', e.target.value)}
              onBlur={() => markTouched('rol_betrokkene')}
              placeholder={t('form.rolPlaceholder')}
              className={inputClass}
            />
            {touched.rol_betrokkene && errors.rol_betrokkene && (
              <p className="mt-1 text-xs text-stone-400">{errors.rol_betrokkene}</p>
            )}
          </div>

          {form.scope === 'extern' && (
            <div>
              <Label required>{t('form.geraaktTeam')}</Label>
              <input
                value={form.geraakte_team_extern}
                onChange={(e) => update('geraakte_team_extern', e.target.value)}
                onBlur={() => markTouched('geraakte_team_extern')}
                placeholder={t('form.geraaktTeamPlaceholder')}
                className={inputClass}
              />
              {touched.geraakte_team_extern && errors.geraakte_team_extern && (
                <p className="mt-1 text-xs text-stone-400">{errors.geraakte_team_extern}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label required>{t('form.impact')}</Label>
              <select
                value={form.impact}
                onChange={(e) => update('impact', e.target.value)}
                onBlur={() => markTouched('impact')}
                className={inputClass}
              >
                <option value="">—</option>
                {IMPACT_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateImpact(lvl, language)}
                  </option>
                ))}
              </select>
              {touched.impact && errors.impact && <p className="mt-1 text-xs text-stone-400">{errors.impact}</p>}
            </div>
            <div>
              <Label required>{t('form.frequentie')}</Label>
              <select
                value={form.frequentie}
                onChange={(e) => update('frequentie', e.target.value)}
                onBlur={() => markTouched('frequentie')}
                className={inputClass}
              >
                <option value="">—</option>
                {FREQUENCY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateFrequentie(lvl, language)}
                  </option>
                ))}
              </select>
              {touched.frequentie && errors.frequentie && (
                <p className="mt-1 text-xs text-stone-400">{errors.frequentie}</p>
              )}
            </div>
            <div>
              <Label required>{t('form.status')}</Label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                onBlur={() => markTouched('status')}
                className={inputClass}
              >
                <option value="">—</option>
                {STATUS_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateStatus(lvl, language)}
                  </option>
                ))}
              </select>
              {touched.status && errors.status && <p className="mt-1 text-xs text-stone-400">{errors.status}</p>}
            </div>
          </div>

          <div>
            <Label>{t('form.mitigatie')}</Label>
            <textarea
              value={form.mitigatie}
              onChange={(e) => update('mitigatie', e.target.value)}
              rows={2}
              placeholder={t('form.mitigatiePlaceholder')}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              {t('form.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#33493c] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#263a2f]"
            >
              {t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
