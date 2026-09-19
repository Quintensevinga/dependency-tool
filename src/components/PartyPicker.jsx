import { useEffect, useState } from 'react'
import { BRON_TYPES } from '../data/constants'
import { translateBronType } from '../i18n/labels'
import { zelfdeNaam } from '../lib/namen'

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none'

// Vanaf hoeveel partijen het zoekveld verschijnt. Zelfde grens als bij de
// partijfilter van het ketenoverzicht (ExternalPartyFilter): onder de acht
// items kost zoeken meer aandacht dan het oplevert.
const ZOEKVELD_VANAF = 8

// Kiezer voor een externe partij (team/rol/persoon/systeem/omgeving/
// stakeholder) tegen de centrale, admin-beheerde lijst — vervangt vrije tekst
// op de plekken waar voorheen zomaar een naam werd getypt. Kent een partij
// niet? Meteen aanmaken vanuit dit veld: die komt met status 'in_afwachting'
// in de admin-lijst terecht totdat een admin 'm goedkeurt of weigert.
// Verwijst het veld al naar een inmiddels geweigerde partij, dan blijft die
// referentie zichtbaar (nooit stilzwijgend laten verdwijnen) met een
// waarschuwing en een snelkoppeling om een vervangende partij aan te maken.
export default function PartyPicker({
  value,
  onChange,
  externalParties,
  addExternalParty,
  currentTeamId,
  teams = [],
  // Het soort dat de gebruiker in het omringende formulier al gekozen heeft
  // (bv. de bron van een inputitem). Zonder deze prop begon het aanmaakvenster
  // altijd op 'stakeholder' en werd dezelfde vraag een tweede keer gesteld.
  defaultType,
  t,
  language,
}) {
  const [creating, setCreating] = useState(false)
  const [naam, setNaam] = useState('')
  const [type, setType] = useState(defaultType || 'stakeholder')
  const [zoek, setZoek] = useState('')

  const selectable = externalParties.filter((p) => p.status !== 'geweigerd')
  const linked = externalParties.find((p) => p.id === value)
  const linkedIsRejected = linked?.status === 'geweigerd'

  const zoekveldZichtbaar = selectable.length > ZOEKVELD_VANAF
  // Ingetypte tekst wissen zodra het zoekveld verdwijnt: anders blijft er
  // onzichtbaar gefilterd worden en lijkt de lijst korter dan hij is.
  useEffect(() => {
    if (!zoekveldZichtbaar) setZoek('')
  }, [zoekveldZichtbaar])

  const naald = zoek.trim().toLowerCase()
  const zichtbaar = naald
    ? // De al gekozen partij blijft altijd in de lijst staan, ook als hij niet
      // op de zoektekst past: een <select> zonder zijn eigen waarde zou stil
      // naar de eerste optie springen.
      selectable.filter((p) => p.naam.toLowerCase().includes(naald) || p.id === value)
    : selectable

  // Bestaat er al een partij met (onder de vergelijkingsregel) dezelfde naam?
  // Bewust een waarschuwing en geen blokkade: twee echte partijen mogen dezelfde
  // naam hebben. Ook geweigerde partijen tellen mee — anders stelt de app
  // vrolijk voor iets opnieuw aan te maken wat een admin net heeft afgewezen.
  const bestaatAl = naam.trim() ? externalParties.find((p) => zelfdeNaam(p.naam, naam)) : null
  const voorstellerNaam = bestaatAl?.voorgesteldDoorTeamId
    ? (teams.find((tm) => tm.id === bestaatAl.voorgesteldDoorTeamId)?.naam ?? null)
    : null

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
    sluitAanmaken()
  }

  function kiesBestaande(partij) {
    onChange(partij.id, partij.naam)
    sluitAanmaken()
  }

  function sluitAanmaken() {
    setCreating(false)
    setNaam('')
  }

  function openAanmaken() {
    // Begin bij het soort dat het omringende formulier al weet, niet bij de
    // standaardwaarde.
    setType(defaultType || 'stakeholder')
    setCreating(true)
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
            openAanmaken()
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
          aria-describedby={bestaatAl ? 'party-bestaat-al' : undefined}
          className={inputClass}
        />
        {bestaatAl && (
          <div id="party-bestaat-al" className="rounded-md border border-[#c98a2e]/40 bg-[#c98a2e]/10 px-2 py-1.5 text-[11px] leading-snug text-[#8a5a12]">
            <span>
              {voorstellerNaam
                ? t('party.duplicateWithTeam', { naam: bestaatAl.naam, team: voorstellerNaam })
                : t('party.duplicate', { naam: bestaatAl.naam })}
            </span>{' '}
            <button type="button" onClick={() => kiesBestaande(bestaatAl)} className="font-medium underline">
              {t('party.duplicateUse')}
            </button>
          </div>
        )}
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass} aria-label={t('party.typeLabel')}>
          {BRON_TYPES.map((bt) => (
            <option key={bt} value={bt}>
              {translateBronType(bt, language)}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={sluitAanmaken} className="text-xs font-medium text-slate-500 hover:underline">
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
    <div className="space-y-1.5">
      {zoekveldZichtbaar && (
        <input
          type="search"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={t('party.search')}
          aria-label={t('party.search')}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
        />
      )}
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
          {zichtbaar.map((p) => (
            <option key={p.id} value={p.id}>
              {p.naam} {p.status === 'in_afwachting' ? `(${t('party.pending')})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openAanmaken}
          className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {t('party.addNew')}
        </button>
      </div>
      {zoekveldZichtbaar && naald && (
        <p className="text-[11px] text-slate-400">{t('party.searchCount', { count: zichtbaar.length, total: selectable.length })}</p>
      )}
    </div>
  )
}
