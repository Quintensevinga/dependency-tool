import { useRef, useState } from 'react'
import {
  categoriesForScope,
  IMPACT_LEVELS,
  FREQUENCY_LEVELS,
  STATUS_LEVELS,
  WORKFLOW_STAP_LEVELS,
  EFFECT_OP_FLOW_LEVELS,
  OPLOSSINGSNIVEAU_LEVELS,
  FLOWTYPE_LEVELS,
} from '../data/constants'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { useModalA11y } from '../lib/a11y'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  translateWorkflowStap,
  translateEffectOpFlow,
  translateOplossingsniveau,
  getCategoryDescription,
} from '../i18n/labels'

const EMPTY_FORM = {
  scope: 'intern',
  flowtype: '',
  categorie: '',
  titel: '',
  toelichting: '',
  eigenaarFunctieIds: [],
  geraakte_team_extern: '',
  impact: '',
  frequentie: '',
  status: '',
  workflowStap: '',
  effectOpFlow: '',
  oplossingsniveau: '',
  mitigatie: '',
  actieAfspraak: '',
}

function Label({ children, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600">
      {children}
      {required && (
        <span className="ml-0.5 text-slate-400" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-slate-400">
      {message}
    </p>
  )
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none'

export default function DependencyForm({ teamId, teamName, initialData, prefill, onSave, onCancel }) {
  const { activeFuncties, functies } = useAppContext()
  const { t, language } = useLanguage()
  const dialogRef = useRef(null)

  // Eenmalig berekende startwaarde, ook bewaard (niet alleen als useState-
  // initializer) zodat we 'm later kunnen vergelijken met de live formstate
  // om te bepalen of de gebruiker iets heeft ingevuld/gewijzigd.
  const initialFormRef = useRef(null)
  if (initialFormRef.current === null) {
    initialFormRef.current = {
      ...EMPTY_FORM,
      ...prefill,
      ...initialData,
      eigenaarFunctieIds: Array.isArray(initialData?.eigenaarFunctieIds) ? [...initialData.eigenaarFunctieIds] : [],
      flowtype: initialData?.flowtype ?? prefill?.flowtype ?? '',
      workflowStap: initialData?.workflowStap ?? '',
      effectOpFlow: initialData?.effectOpFlow ?? '',
      oplossingsniveau: initialData?.oplossingsniveau ?? '',
      actieAfspraak: initialData?.actieAfspraak ?? '',
    }
  }
  const [form, setForm] = useState(() => initialFormRef.current)
  const [touched, setTouched] = useState({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current)

  function handleClose() {
    if (isDirty) {
      setConfirmDiscard(true)
      return
    }
    onCancel()
  }

  useModalA11y({ open: true, onClose: handleClose, containerRef: dialogRef })

  const requiredFields = ['flowtype', 'categorie', 'titel', 'impact', 'frequentie', 'status']
  const errors = {}
  for (const field of requiredFields) {
    if (!form[field]?.trim?.()) errors[field] = t('form.required')
  }
  if (form.eigenaarFunctieIds.length === 0) errors.eigenaarFunctieIds = t('form.required')
  if (form.scope === 'extern' && !form.geraakte_team_extern?.trim()) {
    errors.geraakte_team_extern = t('form.required')
  }
  if (form.flowtype === 'ontwikkelflow' && !form.workflowStap?.trim()) {
    errors.workflowStap = t('form.required')
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function update(field, value) {
    setForm((f) => {
      if (field === 'scope') {
        return { ...f, scope: value, categorie: '' }
      }
      return { ...f, [field]: value }
    })
  }

  function toggleFunctie(id) {
    markTouched('eigenaarFunctieIds')
    setForm((f) => ({
      ...f,
      eigenaarFunctieIds: f.eigenaarFunctieIds.includes(id)
        ? f.eigenaarFunctieIds.filter((x) => x !== id)
        : [...f.eigenaarFunctieIds, id],
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(Object.fromEntries([...requiredFields, 'eigenaarFunctieIds', 'workflowStap'].map((f) => [f, true])))
    if (Object.keys(errors).length > 0) return
    const payload = { ...form, teamId }
    if (form.scope === 'intern') delete payload.geraakte_team_extern
    onSave(payload)
  }

  const categories = categoriesForScope(form.scope)

  // Bij bestaande records kunnen gearchiveerde functies al gekozen zijn;
  // die blijven zichtbaar (en dus verwijderbaar), maar zijn niet meer als
  // nieuwe keuze aan te vinken.
  const archivedButSelected = functies.filter((f) => !f.actief && form.eigenaarFunctieIds.includes(f.id))
  const functieChoices = [...activeFuncties, ...archivedButSelected]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependency-form-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 id="dependency-form-title" className="text-base font-semibold text-slate-900">
              {initialData ? t('form.titleEdit') : t('form.titleNew')}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">{teamName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('form.close')}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Formulier als flex-kolom zodat alleen de veldensectie scrolt en de
            Opslaan/Annuleren-knoppen altijd zichtbaar blijven onderaan —
            voorheen scrollde de hele dialoog inclusief knoppenrij mee, wat bij
            een lang formulier (nu met Flowtype erbij) de knoppen soms buiten
            beeld liet vallen. */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <Label required>{t('form.scope')}</Label>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label={t('form.scope')}>
              {['intern', 'extern'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('scope', value)}
                  aria-pressed={form.scope === value}
                  className={`rounded px-3 py-1 capitalize transition-colors ${
                    form.scope === value ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {value === 'intern' ? t('form.scopeIntern') : t('form.scopeExtern')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label required>{t('form.flowtype')}</Label>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label={t('form.flowtype')}>
              {FLOWTYPE_LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('flowtype', value)}
                  onBlur={() => markTouched('flowtype')}
                  aria-pressed={form.flowtype === value}
                  className={`rounded px-3 py-1 transition-colors ${
                    form.flowtype === value ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {value === 'ontwikkelflow' ? t('form.flowtypeOntwikkelflow') : t('form.flowtypeApplicatieflow')}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">{t('form.flowtypeHelper')}</p>
            {touched.flowtype && <FieldError id="err-flowtype" message={errors.flowtype} />}
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label required htmlFor="dep-categorie">{t('form.categorie')}</Label>
              {form.categorie && (
                <div className="group relative -mt-1 flex items-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="cursor-help text-slate-400" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 11v5.5M12 8v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <div className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-64 rounded-lg bg-[#1e293b] px-3 py-2.5 text-xs leading-relaxed text-slate-100 shadow-xl group-hover:block">
                    {getCategoryDescription(form.categorie, form.scope, language)}
                  </div>
                </div>
              )}
            </div>
            <select
              id="dep-categorie"
              value={form.categorie}
              onChange={(e) => update('categorie', e.target.value)}
              onBlur={() => markTouched('categorie')}
              aria-describedby={touched.categorie && errors.categorie ? 'err-categorie' : undefined}
              className={inputClass}
            >
              <option value="">{t('form.categoriePlaceholder')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} title={getCategoryDescription(cat, form.scope, language)}>
                  {translateCategorie(cat, language)}
                </option>
              ))}
            </select>
            {touched.categorie && <FieldError id="err-categorie" message={errors.categorie} />}
          </div>

          <div>
            <Label required htmlFor="dep-titel">{t('form.titel')}</Label>
            <input
              id="dep-titel"
              value={form.titel}
              onChange={(e) => update('titel', e.target.value)}
              onBlur={() => markTouched('titel')}
              placeholder={t('form.titelPlaceholder')}
              aria-describedby={touched.titel && errors.titel ? 'err-titel' : undefined}
              className={inputClass}
            />
            {touched.titel && <FieldError id="err-titel" message={errors.titel} />}
          </div>

          <div>
            <Label htmlFor="dep-toelichting">{t('form.toelichting')}</Label>
            <textarea
              id="dep-toelichting"
              value={form.toelichting}
              onChange={(e) => update('toelichting', e.target.value)}
              rows={2}
              placeholder={t('form.toelichtingPlaceholder')}
              className={inputClass}
            />
          </div>

          <div>
            <Label required>{t('form.eigenaar')}</Label>
            <p className="mb-1.5 text-xs text-slate-400">{t('form.eigenaarHelper')}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-describedby={touched.eigenaarFunctieIds && errors.eigenaarFunctieIds ? 'err-eigenaar' : undefined}>
              {functieChoices.length === 0 && <span className="text-xs text-slate-400">{t('form.eigenaarNone')}</span>}
              {functieChoices.map((functie) => {
                const selected = form.eigenaarFunctieIds.includes(functie.id)
                return (
                  <button
                    key={functie.id}
                    type="button"
                    onClick={() => toggleFunctie(functie.id)}
                    aria-pressed={selected}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-[#2a5f8a] bg-[#2a5f8a] text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    } ${!functie.actief ? 'opacity-60' : ''}`}
                  >
                    {functie.naam}
                    {!functie.actief && ` (${t('settings.archived')})`}
                  </button>
                )
              })}
            </div>
            {touched.eigenaarFunctieIds && <FieldError id="err-eigenaar" message={errors.eigenaarFunctieIds} />}
          </div>

          {form.scope === 'extern' && (
            <div>
              <Label required htmlFor="dep-geraakt">{t('form.geraaktTeam')}</Label>
              <input
                id="dep-geraakt"
                value={form.geraakte_team_extern}
                onChange={(e) => update('geraakte_team_extern', e.target.value)}
                onBlur={() => markTouched('geraakte_team_extern')}
                placeholder={t('form.geraaktTeamPlaceholder')}
                aria-describedby={touched.geraakte_team_extern && errors.geraakte_team_extern ? 'err-geraakt' : undefined}
                className={inputClass}
              />
              {touched.geraakte_team_extern && <FieldError id="err-geraakt" message={errors.geraakte_team_extern} />}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label required htmlFor="dep-impact">{t('form.impact')}</Label>
              <select
                id="dep-impact"
                value={form.impact}
                onChange={(e) => update('impact', e.target.value)}
                onBlur={() => markTouched('impact')}
                aria-describedby={touched.impact && errors.impact ? 'err-impact' : undefined}
                className={inputClass}
              >
                <option value="">—</option>
                {IMPACT_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateImpact(lvl, language)}
                  </option>
                ))}
              </select>
              {touched.impact && <FieldError id="err-impact" message={errors.impact} />}
            </div>
            <div>
              <Label required htmlFor="dep-frequentie">{t('form.frequentie')}</Label>
              <select
                id="dep-frequentie"
                value={form.frequentie}
                onChange={(e) => update('frequentie', e.target.value)}
                onBlur={() => markTouched('frequentie')}
                aria-describedby={touched.frequentie && errors.frequentie ? 'err-frequentie' : undefined}
                className={inputClass}
              >
                <option value="">—</option>
                {FREQUENCY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateFrequentie(lvl, language)}
                  </option>
                ))}
              </select>
              {touched.frequentie && <FieldError id="err-frequentie" message={errors.frequentie} />}
            </div>
            <div>
              <Label required htmlFor="dep-status">{t('form.status')}</Label>
              <select
                id="dep-status"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                onBlur={() => markTouched('status')}
                aria-describedby={touched.status && errors.status ? 'err-status' : undefined}
                className={inputClass}
              >
                <option value="">—</option>
                {STATUS_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateStatus(lvl, language)}
                  </option>
                ))}
              </select>
              {touched.status && <FieldError id="err-status" message={errors.status} />}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label required={form.flowtype === 'ontwikkelflow'} htmlFor="dep-workflowstap">
                {t('form.workflowStap')}
              </Label>
              {(
                <>
                  <select
                    id="dep-workflowstap"
                    value={form.workflowStap}
                    onChange={(e) => update('workflowStap', e.target.value)}
                    onBlur={() => markTouched('workflowStap')}
                    aria-describedby={touched.workflowStap && errors.workflowStap ? 'err-workflowstap' : undefined}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {WORKFLOW_STAP_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {translateWorkflowStap(lvl, language)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    {form.flowtype === 'ontwikkelflow' ? t('form.workflowStapRequiredHelper') : t('form.workflowStapOptionalHelper')}
                  </p>
                  {touched.workflowStap && <FieldError id="err-workflowstap" message={errors.workflowStap} />}
                </>
              )}
            </div>
            <div>
              <Label htmlFor="dep-effect">{t('form.effectOpFlow')}</Label>
              <select id="dep-effect" value={form.effectOpFlow} onChange={(e) => update('effectOpFlow', e.target.value)} className={inputClass}>
                <option value="">—</option>
                {EFFECT_OP_FLOW_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateEffectOpFlow(lvl, language)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">{t('form.effectOpFlowHelper')}</p>
            </div>
            <div>
              <Label htmlFor="dep-oplossingsniveau">{t('form.oplossingsniveau')}</Label>
              <select id="dep-oplossingsniveau" value={form.oplossingsniveau} onChange={(e) => update('oplossingsniveau', e.target.value)} className={inputClass}>
                <option value="">—</option>
                {OPLOSSINGSNIVEAU_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateOplossingsniveau(lvl, language)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">{t('form.oplossingsniveauHelper')}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="dep-mitigatie">{t('form.mitigatie')}</Label>
            <textarea
              id="dep-mitigatie"
              value={form.mitigatie}
              onChange={(e) => update('mitigatie', e.target.value)}
              rows={2}
              placeholder={t('form.mitigatiePlaceholder')}
              className={inputClass}
            />
          </div>

          <div>
            <Label htmlFor="dep-actie">{t('form.actieAfspraak')}</Label>
            <textarea
              id="dep-actie"
              value={form.actieAfspraak}
              onChange={(e) => update('actieAfspraak', e.target.value)}
              rows={2}
              placeholder={t('form.actieAfspraakPlaceholder')}
              className={inputClass}
            />
          </div>

        </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('form.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
            >
              {t('form.save')}
            </button>
          </div>
        </form>
      </div>

      {confirmDiscard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="discard-confirm-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <p id="discard-confirm-title" className="text-sm text-slate-700">
              {t('form.discardConfirm')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('form.discardContinue')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md bg-[#9a3b2e] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#7f3125]"
              >
                {t('form.discardClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
