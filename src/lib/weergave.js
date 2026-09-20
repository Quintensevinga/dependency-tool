import { useCallback, useEffect, useRef, useState } from 'react'

// Bewaarde weergavekeuzes: filters, schakelaars, welke kaarten je hebt
// weggeklikt. Alles wat je instelt om een groot scherm hanteerbaar te maken en
// wat anders na één keer verversen weg is.
//
// Bewust in dezelfde losse sleutel als de navigatiestand en niet in de
// hoofdgegevens: dit is weergave, geen inhoud. Het hoort dus ook niet mee te
// gaan in exporteren en importeren — een collega die jouw export inleest krijgt
// jouw data, niet jouw filterstand.
export const NAV_KEY = 'dependency-insight:nav'

export function leesNav() {
  try {
    const ruw = JSON.parse(localStorage.getItem(NAV_KEY))
    return ruw && typeof ruw === 'object' ? ruw : {}
  } catch {
    // Opslag geblokkeerd of onleesbaar: dan gewoon zonder bewaarde stand
    // verder. Een filterstand is het niet waard om de app op te laten vallen.
    return {}
  }
}

// Samenvoegen en niet overschrijven: de navigatiestand en de weergavekeuzes
// delen deze sleutel, en die worden op verschillende momenten weggeschreven.
// Zonder deze merge gooide het ene deel telkens het andere weg.
export function schrijfNav(partial) {
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify({ ...leesNav(), ...partial }))
  } catch {
    // Vol of geblokkeerd: niets aan te doen, en een mislukte filterstand mag
    // nooit een wijziging in de echte data in de weg zitten.
  }
}

function leesWeergave(sleutel) {
  const weergave = leesNav().weergave
  return weergave && typeof weergave === 'object' ? weergave[sleutel] : undefined
}

function schrijfWeergave(sleutel, waarde) {
  const nav = leesNav()
  const weergave = nav.weergave && typeof nav.weergave === 'object' ? nav.weergave : {}
  schrijfNav({ weergave: { ...weergave, [sleutel]: waarde } })
}

// Zelfde vorm als useState, maar bewaard onder `sleutel`.
//
// `saneer` is niet optioneel gedrag maar de kern: een bewaarde keuze kan
// onmogelijk zijn geworden — een team dat verwijderd is, een filterwaarde die
// niet meer bestaat. Zo'n waarde hoort netjes terug te vallen op de standaard
// in plaats van een leeg scherm of een foutmelding op te leveren. Datzelfde
// patroon staat al in routes.js (sanitizeChainView) en wordt hier per bewaarde
// waarde herhaald.
export function useBewaardeStand(sleutel, standaard, saneer) {
  const saneerRef = useRef(saneer)
  saneerRef.current = saneer

  const [waarde, setWaarde] = useState(() => {
    const opgeslagen = leesWeergave(sleutel)
    if (opgeslagen === undefined) return standaard
    try {
      return saneerRef.current ? saneerRef.current(opgeslagen, standaard) : opgeslagen
    } catch {
      return standaard
    }
  })

  // Wegschrijven in een effect en niet in de setter: zo wordt elke manier
  // waarop de waarde verandert meegenomen, ook een functionele update ergens
  // diep in een component.
  const eersteRender = useRef(true)
  useEffect(() => {
    if (eersteRender.current) {
      eersteRender.current = false
      return
    }
    schrijfWeergave(sleutel, waarde)
  }, [sleutel, waarde])

  return [waarde, setWaarde]
}

// Voor lijstfilters: houd alleen waarden over die nog bestaan. Blijft er niets
// over (of stond er onzin), dan de standaard.
export function saneerLijst(opgeslagen, standaard, toegestaan) {
  if (!Array.isArray(opgeslagen)) return standaard
  const geldig = opgeslagen.filter((x) => toegestaan.includes(x))
  // Bewust géén terugval bij een lege lijst: 'alles uitgevinkt' is een geldige
  // keuze die de gebruiker zelf gemaakt heeft, en die terugdraaien bij het
  // verversen zou hem verbaasd achterlaten. Alleen onzin valt terug.
  return geldig.length === opgeslagen.length || geldig.length > 0 ? geldig : standaard
}

// Voor een enkele waarde uit een vaste verzameling.
export function saneerKeuze(opgeslagen, standaard, toegestaan) {
  return toegestaan.includes(opgeslagen) ? opgeslagen : standaard
}

// Voor een ja/nee-schakelaar.
export function saneerVlag(opgeslagen, standaard) {
  return typeof opgeslagen === 'boolean' ? opgeslagen : standaard
}

// Sets worden als lijst bewaard (JSON kent geen Set).
export function useBewaardeSet(sleutel, standaard = []) {
  const [lijst, setLijst] = useBewaardeStand(sleutel, standaard, (opgeslagen) => (Array.isArray(opgeslagen) ? opgeslagen : standaard))
  const set = useRef(new Set(lijst))
  set.current = new Set(lijst)
  const setSet = useCallback(
    (bijwerken) => {
      setLijst((vorige) => {
        const nieuw = typeof bijwerken === 'function' ? bijwerken(new Set(vorige)) : bijwerken
        return [...(nieuw instanceof Set ? nieuw : new Set(nieuw))]
      })
    },
    [setLijst],
  )
  return [set.current, setSet]
}
