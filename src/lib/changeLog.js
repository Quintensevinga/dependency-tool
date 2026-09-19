// Bovengrens op het wijzigingenlog. Het log is de enige post in de opslag die
// met de tijd blijft doorgroeien: teams, dependencies en werkstromen groeien mee
// met de organisatie, het log groeit gewoon door. Een regel is ruwweg 200 tot
// 300 tekens, dus tienduizend regels is al 2 tot 3 MB van een opslagbudget dat
// rond de 5 MB ligt.
//
// 2.000 regels is ruim: de analyse kijkt het verst terug over 12 weken en drie
// maanden (analytics.js) en slapende teams over 60 dagen, dus zelfs bij honderd
// wijzigingen per week blijft er meer dan een jaar staan.
export const MAX_LOGREGELS = 2000

// Nieuwe regels komen ACHTERAAN (overal `[...prev.changeLog, entry]`), dus de
// nieuwste staan aan het eind. Afkappen betekent hier dus de LAATSTE 2.000
// houden; precies andersom zou alle recente geschiedenis weggooien.
//
// Een uitzondering die nooit wordt afgekapt: aanmeldingen die nog in de review
// staan. Dat is de wachtrij van de beheerpagina, en die mag niet stilzwijgend
// leeglopen omdat iemand veel gewijzigd heeft.
//
// De uitzondering is precies zo scherp als die beheerpagina zelf: die toont
// alleen regels waarvan de dependency nog bestaat (AdminLogPage.jsx). Dat is
// geen detail. De migratie zet elke 'dependency_created' zonder geldige status
// terug op 'pending' (storage.js), dus een oude import kan zo duizenden
// wees-regels opleveren die nergens te zien zijn -- zonder deze scherpte zou de
// bovengrens daardoor volledig buiten werking raken (gemeten: 3164 regels
// bleven staan waar er 2000 hadden moeten overblijven).
export function wachtOpReview(regel, dependencies) {
  if (regel?.type !== 'dependency_created' || regel?.status !== 'pending') return false
  if (!Array.isArray(dependencies)) return true
  return dependencies.some((d) => d.id === regel.dependencyId)
}

export function begrensLog(state) {
  const log = state.changeLog
  if (!Array.isArray(log) || log.length <= MAX_LOGREGELS) return state
  const recent = log.slice(-MAX_LOGREGELS)
  const bewaard = new Set(recent.map((c) => c.id))
  const wachtrij = log.slice(0, -MAX_LOGREGELS).filter((c) => !bewaard.has(c.id) && wachtOpReview(c, state.dependencies))
  return { ...state, changeLog: wachtrij.length > 0 ? [...wachtrij, ...recent] : recent }
}

// Hoe oud een regel moet zijn om met de archiveerknop mee te gaan. Twaalf
// maanden is bewust ruim: de analyse kijkt het verst terug over 12 weken en
// drie maanden, en slapende teams over 60 dagen. Wie archiveert raakt dus geen
// gegevens kwijt die een grafiek op de Analysepagina nog nodig heeft.
export const ARCHIVEER_NA_MAANDEN = 12

export function archiveerGrens(vandaag = new Date()) {
  const grens = new Date(vandaag)
  grens.setMonth(grens.getMonth() - ARCHIVEER_NA_MAANDEN)
  return grens
}

// Splitst het log in wat gearchiveerd mag worden en wat blijft. Regels die nog
// op beoordeling wachten blijven altijd staan, net als bij de bovengrens
// hierboven: dat is de wachtrij van de beheerpagina, geen geschiedenis.
// Een regel zonder bruikbare datum blijft ook staan -- niet kunnen vaststellen
// hoe oud iets is, is geen reden om het weg te gooien.
export function splitsArchief(changeLog, dependencies = null, vandaag = new Date()) {
  const log = Array.isArray(changeLog) ? changeLog : []
  const grens = archiveerGrens(vandaag).getTime()
  const archief = []
  const blijft = []
  for (const regel of log) {
    const tijd = Date.parse(regel?.timestamp ?? '')
    if (!Number.isNaN(tijd) && tijd < grens && !wachtOpReview(regel, dependencies)) archief.push(regel)
    else blijft.push(regel)
  }
  // Oudste datum die na het archiveren nog in het log zit: dat is het antwoord
  // op 'vanaf wanneer heeft de analyse straks nog gegevens'.
  const oudsteResterend = blijft
    .map((r) => Date.parse(r?.timestamp ?? ''))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0]
  return { archief, blijft, oudsteResterend: oudsteResterend ? new Date(oudsteResterend) : null }
}
