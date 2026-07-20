import { calculateRisk, riskLevelRank } from './risk'
import { translateCategorie, translateStatus } from '../i18n/labels'

const HIGH_RISK_MIN_RANK = riskLevelRank('Hoog')
const UNKNOWN_TEAM = 'Onbekend team'

function isHighRisk(dep) {
  return riskLevelRank(calculateRisk(dep).level) >= HIGH_RISK_MIN_RANK
}

function teamNaam(teams, teamId) {
  return teams.find((t) => t.id === teamId)?.naam ?? UNKNOWN_TEAM
}

function functieNaam(functies, functieId) {
  return functies.find((f) => f.id === functieId)?.naam ?? functieId
}

function groupCount(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (key == null) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

// Voor velden die meerdere waarden per item kunnen hebben (bv.
// eigenaarFunctieIds): elk item telt mee voor elke waarde in de lijst.
function groupCountMulti(items, valuesFn) {
  const map = new Map()
  for (const item of items) {
    for (const key of valuesFn(item) ?? []) {
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return map
}

function maxEntry(map) {
  let best = null
  for (const [key, count] of map) {
    if (!best || count > best.count) best = { key, count }
  }
  return best
}

// --- Executive summary (organisatiebreed, boven de matrix) ---

export function generateExecutiveStats(dependencies, teams) {
  const criticalCount = dependencies.filter((d) => calculateRisk(d).level === 'Kritiek').length

  const knowledgeRiskByTeam = groupCount(
    dependencies.filter(
      (d) => d.scope === 'intern' && d.categorie === 'Kennis-concentratie' && isHighRisk(d),
    ),
    (d) => d.teamId,
  )
  const topKnowledgeTeam = maxEntry(knowledgeRiskByTeam)

  const externDeps = dependencies.filter((d) => d.scope === 'extern')
  const externCategoryCounts = groupCount(externDeps, (d) => d.categorie)
  const topExternCategory = maxEntry(externCategoryCounts)

  return {
    criticalCount,
    topKnowledgeTeam: topKnowledgeTeam
      ? { team: teamNaam(teams, topKnowledgeTeam.key), count: topKnowledgeTeam.count }
      : null,
    topExternCategory: topExternCategory
      ? { categorie: topExternCategory.key, count: topExternCategory.count, total: externDeps.length }
      : null,
  }
}

// --- Narratieve observaties (regel-gebaseerd, geen AI) ---
// Regels leveren taal-neutrale, gestructureerde data op; formatInsightText()
// zet dit per taal om in een leesbare zin.

const ROLE_CONCENTRATION_MIN_SHARE = 0.4
const ROLE_CONCENTRATION_MIN_COUNT = 2
const SHARED_EXTERNAL_MIN_COUNT = 3

// Groepeert eerst op teamId (technisch, stabiel), en binnen elk team op
// eigenaarfunctie. Een dependency met meerdere eigenaarfuncties telt mee
// voor elke functie waaraan hij is toegekend.
function ruleRoleConcentration(dependencies, teams, functies) {
  const teamIds = [...new Set(dependencies.map((d) => d.teamId))]
  let best = null

  for (const teamId of teamIds) {
    const teamHighRisk = dependencies.filter((d) => d.teamId === teamId && isHighRisk(d))
    if (teamHighRisk.length === 0) continue
    const byFunctie = groupCountMulti(teamHighRisk, (d) => d.eigenaarFunctieIds)
    const top = maxEntry(byFunctie)
    if (!top) continue
    const share = top.count / teamHighRisk.length
    if (top.count >= ROLE_CONCENTRATION_MIN_COUNT && share >= ROLE_CONCENTRATION_MIN_SHARE) {
      const candidate = { teamId, functieId: top.key, count: top.count, total: teamHighRisk.length, share }
      if (!best || candidate.share > best.share || (candidate.share === best.share && candidate.count > best.count)) {
        best = candidate
      }
    }
  }

  if (!best) return null
  return {
    type: 'roleConcentration',
    team: teamNaam(teams, best.teamId),
    role: functieNaam(functies, best.functieId),
    count: best.count,
    total: best.total,
    detail: dependencies.filter(
      (d) => d.teamId === best.teamId && isHighRisk(d) && (d.eigenaarFunctieIds ?? []).includes(best.functieId),
    ),
  }
}

function ruleSharedExternalTeam(dependencies, teams) {
  const teamIds = [...new Set(dependencies.map((d) => d.teamId))]
  let best = null

  for (const teamId of teamIds) {
    const externDeps = dependencies.filter((d) => d.teamId === teamId && d.scope === 'extern')
    const bySource = groupCount(externDeps, (d) => d.geraakte_team_extern)
    const top = maxEntry(bySource)
    if (!top) continue
    if (top.count >= SHARED_EXTERNAL_MIN_COUNT) {
      if (!best || top.count > best.count) {
        best = { teamId, source: top.key, count: top.count }
      }
    }
  }

  if (!best) return null
  return {
    type: 'sharedExternalTeam',
    team: teamNaam(teams, best.teamId),
    source: best.source,
    count: best.count,
    detail: dependencies.filter(
      (d) => d.teamId === best.teamId && d.scope === 'extern' && d.geraakte_team_extern === best.source,
    ),
  }
}

function ruleMostCommonExternalCategory(dependencies) {
  const externDeps = dependencies.filter((d) => d.scope === 'extern')
  if (externDeps.length === 0) return null
  const byCategory = groupCount(externDeps, (d) => d.categorie)
  const top = maxEntry(byCategory)
  if (!top || top.count < 2) return null
  return {
    type: 'mostCommonExternalCategory',
    categorie: top.key,
    count: top.count,
    total: externDeps.length,
    detail: externDeps.filter((d) => d.categorie === top.key),
  }
}

function ruleActiveBlockers(dependencies) {
  const blockers = dependencies.filter((d) => d.status === 'actief blokkerend')
  if (blockers.length === 0) return null
  const teamCount = new Set(blockers.map((d) => d.teamId)).size
  return {
    type: 'activeBlockers',
    count: blockers.length,
    teamCount,
    detail: blockers,
  }
}

export function generateInsights(dependencies, teams, functies) {
  const rules = [
    (deps) => ruleRoleConcentration(deps, teams, functies),
    (deps) => ruleSharedExternalTeam(deps, teams),
    ruleMostCommonExternalCategory,
    ruleActiveBlockers,
  ]
  return rules.map((rule) => rule(dependencies)).filter(Boolean).slice(0, 4)
}

const TEMPLATES = {
  nl: {
    roleConcentration: (i) =>
      `${i.count} van de ${i.total} hoog-risico dependencies binnen ${i.team} zijn geconcentreerd bij de rol '${i.role}' — dit vormt een verhoogd continuïteitsrisico.`,
    sharedExternalTeam: (i) =>
      `${i.team} is voor ${i.count} onderdelen afhankelijk van hetzelfde externe team ('${i.source}'), wat een gedeeld capaciteitsrisico creëert.`,
    mostCommonExternalCategory: (i) =>
      `De meest voorkomende externe blokkade-categorie is '${translateCategorie(i.categorie, 'nl')}', goed voor ${i.count} van de ${i.total} externe dependencies.`,
    activeBlockers: (i) =>
      `Er ${i.count === 1 ? 'is' : 'zijn'} momenteel ${i.count} ${i.count === 1 ? 'dependency' : 'dependencies'} met status '${translateStatus('actief blokkerend', 'nl')}', verspreid over ${i.teamCount} ${i.teamCount === 1 ? 'team' : 'teams'} — dit vraagt directe aandacht.`,
  },
  en: {
    roleConcentration: (i) =>
      `${i.count} of ${i.total} high-risk dependencies within ${i.team} are concentrated with the role '${i.role}' — this represents an elevated continuity risk.`,
    sharedExternalTeam: (i) =>
      `${i.team} depends on the same external team ('${i.source}') for ${i.count} items, creating a shared capacity risk.`,
    mostCommonExternalCategory: (i) =>
      `The most common external blocking category is '${translateCategorie(i.categorie, 'en')}', accounting for ${i.count} of ${i.total} external dependencies.`,
    activeBlockers: (i) =>
      `There ${i.count === 1 ? 'is' : 'are'} currently ${i.count} ${i.count === 1 ? 'dependency' : 'dependencies'} with status '${translateStatus('actief blokkerend', 'en')}', spread across ${i.teamCount} ${i.teamCount === 1 ? 'team' : 'teams'} — this requires immediate attention.`,
  },
}

export function formatInsightText(insight, lang) {
  const templates = TEMPLATES[lang] ?? TEMPLATES.nl
  return templates[insight.type]?.(insight) ?? ''
}
