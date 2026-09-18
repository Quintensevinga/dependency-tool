import { useCallback, useEffect, useRef, useState } from 'react'

// Standaardpauze na de laatste toetsaanslag. Kort genoeg dat een wijziging
// nooit lang onbewaard blijft, lang genoeg dat doortypen niet elke letter een
// volledige serialisatie van de state kost.
const DEFAULT_DELAY = 400

/**
 * Houdt getypte tekst lokaal bij en schrijft pas weg wanneer de gebruiker
 * klaar is: bij het verlaten van het veld (flush) en automatisch na een korte
 * pauze. Zonder dit ging bij elke ingetypte letter de complete dataset via
 * JSON.stringify naar localStorage — op een flink gevulde dataset begint typen
 * daardoor te hakkelen.
 *
 * Bewust in het component en niet in de opslaglaag: het uitstellen van
 * localStorage-schrijfacties zelf is een aparte, geparkeerde keuze.
 *
 * @param externalValue  de opgeslagen waarde
 * @param commit         schrijft de waarde weg
 * @returns { value, onChange, flush, cancel }
 *   flush  schrijft een openstaande wijziging nu weg (gebruik op onBlur)
 *   cancel gooit een openstaande wijziging weg zonder te schrijven — nodig
 *          wanneer het record zelf verdwijnt, anders schrijft de unmount-flush
 *          een net verwijderd record weer terug
 */
export function useBufferedText(externalValue, commit, { delay = DEFAULT_DELAY } = {}) {
  const [value, setValue] = useState(externalValue ?? '')
  const timerRef = useRef(null)
  // De laatst getypte, nog niet weggeschreven waarde. null betekent: er staat
  // niets open. Bewust een ref en geen state: dit mag geen render triggeren en
  // moet ook in een unmount-cleanup nog de actuele waarde hebben.
  const pendingRef = useRef(null)
  // commit kan per render een nieuwe functie zijn (closure over verse state).
  // Via een ref leest flush altijd de nieuwste, zonder dat flush zelf
  // instabiel wordt — anders zou de unmount-cleanup bij elke render opnieuw
  // draaien en tussentijds wegschrijven.
  const commitRef = useRef(commit)
  commitRef.current = commit

  // Een wijziging van buitenaf (ander record, wijziging elders) overnemen,
  // maar nooit terwijl de gebruiker midden in het typen zit — dat zou de
  // getypte tekst onder de cursor vandaan halen.
  useEffect(() => {
    if (pendingRef.current === null) setValue(externalValue ?? '')
  }, [externalValue])

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (pendingRef.current === null) return
    const openstaand = pendingRef.current
    pendingRef.current = null
    commitRef.current(openstaand)
  }, [])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
  }, [])

  // Verdwijnt het component (modal sluit, rij valt weg), dan mag een nog
  // openstaande wijziging niet verloren gaan.
  useEffect(() => () => flush(), [flush])

  const onChange = useCallback(
    (next) => {
      setValue(next)
      pendingRef.current = next
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, delay)
    },
    [flush, delay],
  )

  return { value, onChange, flush, cancel }
}
