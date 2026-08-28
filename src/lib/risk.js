// Object.create(null) i.p.v. gewone objectliteralen: die laatste erven van
// Object.prototype, dus een dependency.impact-waarde als 'constructor' of
// 'toString' zou anders een functie opleveren i.p.v. undefined — met NaN en
// een crash in LEVEL_THRESHOLDS.find() tot gevolg.
const IMPACT_POINTS = Object.assign(Object.create(null), { laag: 1, midden: 2, hoog: 3 })
const FREQUENCY_POINTS = Object.assign(Object.create(null), { incidenteel: 1, structureel: 2 })
const STATUS_CORRECTION = Object.assign(Object.create(null), {
  'actief blokkerend': 2,
  'bekend risico': 0,
  'gemitigeerd': -2,
})

const LEVEL_THRESHOLDS = [
  { max: 2, level: 'Laag' },
  { max: 4, level: 'Gemiddeld' },
  { max: 6, level: 'Hoog' },
  { max: Infinity, level: 'Kritiek' },
]

const LEVEL_ORDER = { Laag: 0, Gemiddeld: 1, Hoog: 2, Kritiek: 3 }

// Afgeleid uit de puntentabellen i.p.v. hardcoded, zodat elke plek die de
// score-range nodig heeft (bv. een risicobalk) automatisch meebeweegt als
// deze formule ooit verandert.
export const MAX_RISK_SCORE =
  Math.max(...Object.values(IMPACT_POINTS)) * Math.max(...Object.values(FREQUENCY_POINTS)) +
  Math.max(...Object.values(STATUS_CORRECTION))

/**
 * Transparante, uitlegbare risicoberekening:
 * basisscore = impact-punten x frequentie-punten (1-6)
 * status-correctie: actief blokkerend +2, bekend risico +0, gemitigeerd -2 (nooit onder 1)
 * eindscore -> classificatie via vaste drempels
 */
export function calculateRisk(dependency) {
  const impactPoints = IMPACT_POINTS[dependency.impact] ?? 1
  const frequencyPoints = FREQUENCY_POINTS[dependency.frequentie] ?? 1
  const baseScore = impactPoints * frequencyPoints
  const statusCorrection = STATUS_CORRECTION[dependency.status] ?? 0
  const score = Math.max(1, baseScore + statusCorrection)
  // .find() kan in theorie undefined opleveren als LEVEL_THRESHOLDS ooit
  // gewijzigd wordt zonder een laatste Infinity-drempel — terugval op de
  // zwaarste classificatie i.p.v. daar verderop op te crashen.
  const level = (LEVEL_THRESHOLDS.find((t) => score <= t.max) ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]).level

  return {
    score,
    level,
    breakdown: {
      impactPoints,
      frequencyPoints,
      baseScore,
      statusCorrection,
    },
  }
}

export function riskLevelRank(level) {
  return LEVEL_ORDER[level] ?? -1
}

export function compareRiskDesc(a, b) {
  return calculateRisk(b).score - calculateRisk(a).score
}

// Voorkomt dat calculateRisk() tijdens het sorteren ~2·n·log(n) keer draait
// i.p.v. n keer (compareRiskDesc herberekent bij elke vergelijking opnieuw):
// bereken de score één keer per item, sorteer op dat vaste getal.
export function sortByRiskDesc(dependencies) {
  return dependencies
    .map((dependency) => ({ dependency, risk: calculateRisk(dependency) }))
    .sort((a, b) => b.risk.score - a.risk.score)
    .map(({ dependency }) => dependency)
}
