const IMPACT_POINTS = { laag: 1, midden: 2, hoog: 3 }
const FREQUENCY_POINTS = { incidenteel: 1, structureel: 2 }
const STATUS_CORRECTION = {
  'actief blokkerend': 2,
  'bekend risico': 0,
  'gemitigeerd': -2,
}

const LEVEL_THRESHOLDS = [
  { max: 2, level: 'Laag' },
  { max: 4, level: 'Gemiddeld' },
  { max: 6, level: 'Hoog' },
  { max: Infinity, level: 'Kritiek' },
]

const LEVEL_ORDER = { Laag: 0, Gemiddeld: 1, Hoog: 2, Kritiek: 3 }

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
  const level = LEVEL_THRESHOLDS.find((t) => score <= t.max).level

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
