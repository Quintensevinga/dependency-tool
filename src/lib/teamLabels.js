// Twee teams mogen dezelfde naam dragen (de tool dwingt uniekheid niet af, en
// bestaande data kan het al bevatten). In lijsten, dropdowns en filters waren
// ze daardoor niet uit elkaar te houden. Deze helper voegt alléén bij een
// dubbele naam een volgnummer toe, op basis van de volgorde waarin de teams
// staan — unieke namen blijven dus precies zoals ze zijn.
//
// Puur presentatie: de opgeslagen teamnaam verandert hier nooit door.

function duplicateNameSet(teams) {
  const seen = new Set()
  const duplicates = new Set()
  for (const team of teams) {
    const naam = team?.naam ?? ''
    if (seen.has(naam)) duplicates.add(naam)
    else seen.add(naam)
  }
  return duplicates
}

// Retourneert een map van teamId -> weergavenaam.
export function buildTeamLabels(teams) {
  const list = Array.isArray(teams) ? teams : []
  const duplicates = duplicateNameSet(list)
  const counters = new Map()
  const labels = {}
  for (const team of list) {
    const naam = team?.naam ?? ''
    if (!duplicates.has(naam)) {
      labels[team.id] = naam
      continue
    }
    const n = (counters.get(naam) ?? 0) + 1
    counters.set(naam, n)
    labels[team.id] = `${naam} (${n})`
  }
  return labels
}

// Losse variant voor plekken die maar één team tonen.
export function teamLabel(teams, teamId) {
  return buildTeamLabels(teams)[teamId]
}
