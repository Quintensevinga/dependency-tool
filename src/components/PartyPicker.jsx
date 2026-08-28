import { useState } from 'react'
import { BRON_TYPES } from '../data/constants'
import { translateBronType } from '../i18n/labels'

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none'

// Kiezer voor een externe partij (team/rol/persoon/systeem/omgeving/
// stakeholder) tegen de centrale, admin-beheerde lijst — vervangt vrije tekst
// op de plekken waar voorheen zomaar een naam werd getypt. Kent een partij
// niet? Meteen aanmaken vanuit dit veld: die komt met status 'in_afwachting'
// in de admin-lijst terecht totdat een admin 'm goedkeurt of weigert.
// Verwijst het veld al naar een inmiddels geweigerde partij, dan blijft die
// referentie zichtbaar (nooit stilzwijgend laten verdwijnen) met een
// waarschuwing en een snelkoppeling om een vervangende partij aan te maken.
export default function PartyPicker({ value, onChange, externalParties, addExternalParty, currentTeamId, t, language }) {
  const [creating, setCreating] = useState(false)
  const [naam, setNaam] = useState('')
  const [type, setType] = useState('stakeholder')

  const selectable = externalParties.filter((p) => p.status !== 'geweigerd')
  const linked = externalParties.find((p) => p.id === value)
  const linkedIsRejected = linked?.status === 'geweigerd'

  // Bewust geen <form>: dit component wordt zelf altijd binnen een ander
  // formulier gebruikt (DependencyForm/IoItemModal) — een geneste <form>
  // laat een 'submit'-event tot aan dat buitenste formulier doorborrelen,
  // wat daar ongewild het hele formulier submit/sluit. Losse click/Enter-
  // afhandeling i.p.v. onSubmit voorkomt dat.
  function submitNew() {
    const trimmed = naam.trim()
    if (!trimmed) return
    const id = addExternalParty(trimmed, type, { pending: true, teamId: currentTeamId })
    // Geeft ook meteen de naam mee: state.externalParties in de aanroeper is
    // op dit moment nog niet bijgewerkt (persist() is async), dus die kan de
    // zojuist aangemaakte partij nog niet via een lookup vinden.
    onChange(id, trimmed)
    setCreating(false)
    setNaam('')
  }

  if (linkedIsRejected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[#9a3b2e]/30 bg-[#9a3b2e]/5 px-2.5 py-2 text-xs text-[#9a3b2e]">
        <span aria-hidden="true">▲</span>
        <span className="flex-1">{t('party.rejectedWarning', { naam: linked.naam })}</span>
        <button
          type="button"
          onClick={() => {
            onChange('', '')
            setCreating(true)
          }}
          className="shrink-0 font-medium underline"
        >
          {t('party.addNew')}
        </button>
      </div>
    )
  }

  if (creating) {
    return (
      <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
        <input
          autoFocus
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitNew()
            }
          }}
          placeholder={t('party.namePlaceholder')}
          className={inputClass}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          {BRON_TYPES.map((bt) => (
            <option key={bt} value={bt}>
              {translateBronType(bt, language)}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setCreating(false)} className="text-xs font-medium text-slate-500 hover:underline">
            {t('form.cancel')}
          </button>
          <button type="button" onClick={submitNew} className="rounded-md bg-[#2a5f8a] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1f4a6c]">
            {t('party.create')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value ?? ''}
        onChange={(e) => {
          const id = e.target.value
          const found = selectable.find((p) => p.id === id)
          onChange(id, found?.naam ?? '')
        }}
        className={inputClass}
      >
        <option value="">{t('party.none')}</option>
        {selectable.map((p) => (
          <option key={p.id} value={p.id}>
            {p.naam} {p.status === 'in_afwachting' ? `(${t('party.pending')})` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {t('party.addNew')}
      </button>
    </div>
  )
}
