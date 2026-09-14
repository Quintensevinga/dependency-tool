import { useEffect, useState } from 'react'

// Waarden die bij het bouwen ingebakken worden (zie vite.config.js). De
// typeof-vangnetten houden dit bestand bruikbaar buiten een Vite-build
// (tests, node-scripts), waar de defines niet bestaan.
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''

const VERSION_URL = '/version.json'
const POLL_INTERVAL_MS = 5 * 60 * 1000

// Een pagina die herladen wordt haalt altijd de nieuwste code op (Vercel
// serveert index.html met must-revalidate en de assets hebben een hash in
// hun naam). Het probleem zit bij een tab die dagenlang openstaat: die
// herlaadt nooit uit zichzelf en blijft dus draaien op de versie van het
// moment dat hij geopend werd. Deze hook vergelijkt periodiek de
// meegepubliceerde /version.json met de draaiende versie, zodat de app dat
// zelf kan melden i.p.v. dat iemand toevallig een hard refresh doet.
export function useNieuwereVersieBeschikbaar() {
  const [beschikbaar, setBeschikbaar] = useState(false)

  useEffect(() => {
    let afgebroken = false

    async function check() {
      if (afgebroken || document.visibilityState === 'hidden') return
      try {
        const res = await fetch(VERSION_URL, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        // Alleen melden bij een écht andere versie: is de server om wat voor
        // reden dan ook onbereikbaar of antwoordt hij zonder versie, dan
        // gebeurt er niets — een valse "nieuwe versie"-melding is
        // vervelender dan een gemiste.
        if (!afgebroken && typeof data?.version === 'string' && data.version !== APP_VERSION) {
          setBeschikbaar(true)
        }
      } catch {
        // Offline of geblokkeerd: stil laten passeren, de volgende ronde
        // probeert het opnieuw.
      }
    }

    check()
    const timer = window.setInterval(check, POLL_INTERVAL_MS)
    // Terugkomen op de tab is het moment waarop iemand weer gaat werken —
    // dan is de melding het meest bruikbaar, en wachten tot de volgende
    // interval-ronde zou dat missen.
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      afgebroken = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return beschikbaar
}

const LOCAL_KEY_PREFIX = 'dependency-insight:'

// Wist alles wat deze app lokaal bewaart (data, taal, navigatiestatus,
// rondleiding-vlag) op prefix i.p.v. op een lijst sleutels: een nieuwe
// sleutel elders in de app hoeft dan niet ook hier toegevoegd te worden,
// anders blijft er stilletjes een restje staan.
export function wisAlleLokaleOpslag() {
  const keys = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(LOCAL_KEY_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => localStorage.removeItem(key))
  return keys.length
}

// Ondersteunt ?reset=1 (of #reset) als deelbare "begin opnieuw"-link: alles
// lokaal wissen en zonder de parameter herladen, zodat de volgende laadbeurt
// gewoon de verse demodata seedt. Draait vóór React begint (main.jsx), zodat
// de app nooit eerst de oude state rendert.
export function verwerkResetParameter() {
  const url = new URL(window.location.href)
  const gevraagd = url.searchParams.has('reset') || url.hash === '#reset'
  if (!gevraagd) return false
  wisAlleLokaleOpslag()
  url.searchParams.delete('reset')
  url.hash = ''
  window.location.replace(url.pathname + url.search)
  return true
}
