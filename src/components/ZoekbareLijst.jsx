import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

// Vanaf hoeveel items het zoekveld verschijnt, en hoeveel er standaard getoond
// worden voordat 'toon meer' het overneemt. Dezelfde grenzen op alle plekken,
// zodat de lijsten zich overal hetzelfde gedragen. De acht komt uit het
// bestaande patroon bij de externe partijen (ExternalPartyFilter).
export const ZOEKVELD_VANAF = 8
export const STANDAARD_GETOOND = 12

// Gedeelde logica voor 'een lijst die te lang wordt om in te kiezen': zoeken
// erboven, afkappen eronder. Bewust een hook en geen kant-en-klaar lijstje: de
// vier plekken waar dit op staat (filterpaneel, zijbalk, teamsmenu van het
// ketenoverzicht, teamkeuze in het formulier) tekenen hun rijen alle vier
// anders — een gedeeld lijstcomponent zou al die varianten als props terug
// moeten inbouwen en daarmee onleesbaar worden.
//
// `labelVan` levert de getoonde naam. Daar wordt op gezocht, niet op het ruwe
// veld: de getoonde naam kan afwijken van de opgeslagen naam (teamLabels).
// `isGekozen` houdt een aangevinkt of geselecteerd item altijd zichtbaar, ook
// voorbij de afkapgrens — anders verdwijnt een actieve selectie uit beeld en
// lijkt het filter leeg.
export function useZoekbareLijst({ items, labelVan, isGekozen, zoekVanaf = ZOEKVELD_VANAF, toonEerst = STANDAARD_GETOOND, zichtbaar = true }) {
  const [zoek, setZoek] = useState('')
  const [uitgeklapt, setUitgeklapt] = useState(false)

  const zoekveldZichtbaar = items.length > zoekVanaf
  // Ingetypte tekst wissen zodra het zoekveld verdwijnt (bv. omdat er teams
  // verwijderd zijn), anders blijft er onzichtbaar gefilterd worden.
  useEffect(() => {
    if (!zoekveldZichtbaar) setZoek('')
  }, [zoekveldZichtbaar])

  // Hetzelfde bij het dichtklappen van het paneel waar de lijst in staat:
  // opnieuw openen hoort de volledige lijst te tonen, niet de rest van een
  // zoekopdracht van vorige week. Aanroepers die hun lijst bij het sluiten
  // volledig uit beeld halen (zoals een modaal venster) hoeven dit niet mee te
  // geven; die verliezen deze state toch al.
  useEffect(() => {
    if (zichtbaar) return
    setZoek('')
    setUitgeklapt(false)
  }, [zichtbaar])

  const naald = zoek.trim().toLowerCase()

  const gefilterd = useMemo(() => {
    if (!naald) return items
    return items.filter((item) => labelVan(item).toLowerCase().includes(naald))
    // labelVan is bij elke render een nieuwe functie; die hoort hier niet in de
    // deps, anders draait de memo alsnog elke keer. De uitkomst hangt af van de
    // items en de zoektekst, en die staan er wel in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, naald])

  // Zodra er gezocht wordt vervalt de afkapping: wie typt wil de treffers zien,
  // niet de eerste twaalf daarvan.
  const alles = uitgeklapt || Boolean(naald)

  // Welke items blijven altijd zichtbaar, ook voorbij de afkapgrens? Niet
  // simpelweg 'de aangevinkte': twee van de vier lijsten hier zijn filters die
  // standaard *alles* aangevinkt hebben, en dan zou die regel de afkapping
  // volledig buiten werking zetten (gemeten: dertig van de dertig in beeld).
  //
  // Het gaat om de items die van de rest afwijken, en dat is steeds de
  // minderheid: staan er drie teams aan van de dertig, dan zijn dat die drie;
  // staat er een van de dertig uit, dan is dat die ene. Zo raak je nooit uit
  // beeld wat je zelf hebt aangeraakt, en blijft de lijst toch kort. Is die
  // minderheid zelf langer dan de afkapgrens, dan valt de uitzondering weg --
  // dan is het geen uitzondering meer.
  const gekozenAantal = isGekozen ? gefilterd.filter(isGekozen).length : 0
  const meesteStaanAan = gekozenAantal * 2 > gefilterd.length
  const afwijkendAantal = meesteStaanAan ? gefilterd.length - gekozenAantal : gekozenAantal
  const houdAfwijkendZichtbaar = Boolean(isGekozen) && afwijkendAantal > 0 && afwijkendAantal <= toonEerst
  const isAfwijkend = (item) => (meesteStaanAan ? !isGekozen(item) : isGekozen(item))

  const getoond = useMemo(() => {
    if (alles) return gefilterd
    return gefilterd.filter((item, index) => index < toonEerst || (houdAfwijkendZichtbaar && isAfwijkend(item)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gefilterd, alles, toonEerst, houdAfwijkendZichtbaar, meesteStaanAan])

  return {
    zoek,
    setZoek,
    zoekveldZichtbaar,
    zoekt: Boolean(naald),
    getoond,
    gevonden: gefilterd.length,
    totaal: items.length,
    verborgen: gefilterd.length - getoond.length,
    uitgeklapt,
    setUitgeklapt,
  }
}

// Het zoekveld zelf. `className` blijft van de aanroeper: het staat een keer op
// een donkere zijbalk en drie keer op een licht paneel.
export function LijstZoekveld({ waarde, onChange, label, className }) {
  return (
    <input
      type="search"
      value={waarde}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
      className={className}
    />
  )
}

// 'Toon meer (nog X)' / 'Toon minder'. Rendert niets zolang er niets verborgen
// is en de lijst niet uitgeklapt staat.
export function ToonMeerKnop({ verborgen, uitgeklapt, onToggle, className }) {
  const { t } = useLanguage()
  if (verborgen <= 0 && !uitgeklapt) return null
  return (
    <button type="button" onClick={onToggle} className={className}>
      {uitgeklapt ? t('lijst.toonMinder') : t('lijst.toonMeer', { count: verborgen })}
    </button>
  )
}
