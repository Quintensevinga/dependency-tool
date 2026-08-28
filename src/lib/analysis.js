// Uitgebreide analyse: flowverlies + urgentie, náást de bestaande
// risicoscore — niet erin samengevoegd. Bewust een los bestand van risk.js:
// calculateRisk() blijft ongemoeid, dit werk heeft zijn eigen aannames en
// drempels die onafhankelijk bij te stellen moeten zijn. Zie het
// scoremodel-document voor de achterliggende analyse (dimensies, ankers).
//
// Belangrijkste architectuurbeslissing uit dat document: bewaar de losse
// waardes (flowverlies, urgentie), niet een opgetelde som — de risicoscore
// is voor triage, deze twee zijn voor patroonanalyse.

// Bewuste duplicatie van FREQUENCY_POINTS uit risk.js i.p.v. die te
// exporteren en hier te hergebruiken: dit bestand moet onafhankelijk van
// risk.js kunnen wijzigen zonder dat bestand aan te raken.
const FREQUENCY_POINTS = { incidenteel: 1, structureel: 2 }

const WACHTTIJD_POINTS = { geen: 0, kort: 1, dagen: 2, sprint_of_meer: 3 }

const FLOWVERLIES_THRESHOLDS = [
  { max: 1, level: 'Laag' },
  { max: 3, level: 'Gemiddeld' },
  { max: 5, level: 'Hoog' },
  { max: Infinity, level: 'Kritiek' },
]

const URGENTIE_LEVELS = {
  geen_datum: 'Laag',
  interne_afspraak: 'Gemiddeld',
  vaste_datum: 'Hoog',
  harde_deadline: 'Kritiek',
}

// Een dependency zonder wachttijd-veld levert geen (kunstmatig lage)
// score op maar 'null' — de UI toont dit als "profiel onvolledig".
export function berekenFlowverlies(dependency) {
  if (!dependency.wachttijd) return null
  const wachttijdPunten = WACHTTIJD_POINTS[dependency.wachttijd] ?? 0
  const frequencyPunten = FREQUENCY_POINTS[dependency.frequentie] ?? 1
  const score = wachttijdPunten * frequencyPunten
  const level = FLOWVERLIES_THRESHOLDS.find((t) => score <= t.max).level
  return { score, level, breakdown: { wachttijdPunten, frequencyPunten } }
}

// Puur afgeleid uit het deadline-veld, geen berekening — zelfde 4-punts
// schaal (Laag/Gemiddeld/Hoog/Kritiek) als risico en flowverlies, zodat
// dezelfde kleurentaal (riskStyle) overal hergebruikt kan worden.
export function berekenUrgentie(dependency) {
  if (!dependency.deadline) return null
  return { level: URGENTIE_LEVELS[dependency.deadline] ?? 'Laag' }
}

const VEROUDERD_DAGEN = 90

function dagenSinds(datumStr) {
  if (!datumStr) return null
  const toen = new Date(datumStr).getTime()
  if (Number.isNaN(toen)) return null
  return (Date.now() - toen) / (1000 * 60 * 60 * 24)
}

// Lang niet bijgewerkt — een vaste drempel van 90 dagen, aanpasbaar als dat
// in de praktijk te streng/soepel blijkt.
export function isVerouderd(dependency) {
  const dagen = dagenSinds(dependency.laatst_bijgewerkt)
  return dagen !== null && dagen > VEROUDERD_DAGEN
}

// Laag/gemiddeld risico, maar wel degelijk merkbaar flowverlies — precies de
// dependencies waar in de praktijk niemand naar omkijkt omdat de risicoscore
// ze niet bovenaan zet.
export function isStilRisico(dependency, riskLevel) {
  const flow = berekenFlowverlies(dependency)
  if (!flow) return false
  const risicoIsLaag = riskLevel === 'Laag' || riskLevel === 'Gemiddeld'
  const flowIsHoog = flow.level === 'Hoog' || flow.level === 'Kritiek'
  return risicoIsLaag && flowIsHoog
}

// Makkelijk oplosbaar (teamniveau) én de moeite waard (flowverlies niet
// verwaarloosbaar) — laaghangend fruit.
export function isQuickWin(dependency) {
  const flow = berekenFlowverlies(dependency)
  if (!flow) return false
  const makkelijkOplosbaar = dependency.oplosbaarheid === 'teamlid' || dependency.oplosbaarheid === 'meerdere_teamleden'
  return makkelijkOplosbaar && flow.level !== 'Laag'
}

export function analyseLabels(dependency, riskLevel) {
  const labels = []
  if (isStilRisico(dependency, riskLevel)) labels.push('stil_risico')
  if (isVerouderd(dependency)) labels.push('verouderd')
  if (isQuickWin(dependency)) labels.push('quick_win')
  return labels
}
