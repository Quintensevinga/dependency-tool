import { MOCK_TEAMS, MOCK_DEPENDENCIES } from '../data/mockData'
import { DEFAULT_FUNCTIES } from '../data/constants'
import { slugify, uniqueSlug } from './slug'

const STORAGE_KEY = 'dependency-insight:v1'
export const SCHEMA_VERSION = 2

export { slugify, uniqueSlug }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// --- migratie ---

// Zet teams (oud: array van strings, of al objecten) om naar het canonieke
// { id, naam, actief, createdAt, updatedAt }-formaat. Retourneert ook een
// map van teamnaam -> id, nodig om dependency.team (oude string-koppeling)
// te kunnen omzetten naar dependency.teamId.
function migrateTeams(rawTeams) {
  const teams = []
  const existingIds = new Set()
  const nameToId = new Map()

  for (const raw of Array.isArray(rawTeams) ? rawTeams : []) {
    if (raw && typeof raw === 'object' && raw.id) {
      const id = String(raw.id)
      if (existingIds.has(id)) continue
      existingIds.add(id)
      const team = {
        id,
        naam: String(raw.naam ?? raw.id),
        actief: raw.actief !== false,
        createdAt: raw.createdAt ?? todayIso(),
        updatedAt: raw.updatedAt ?? todayIso(),
      }
      teams.push(team)
      nameToId.set(team.naam, id)
    } else if (typeof raw === 'string' && raw.trim()) {
      const naam = raw.trim()
      if (nameToId.has(naam)) continue
      const id = uniqueSlug(naam, existingIds)
      existingIds.add(id)
      const team = { id, naam, actief: true, createdAt: todayIso(), updatedAt: todayIso() }
      teams.push(team)
      nameToId.set(naam, id)
    }
  }

  return { teams, nameToId, existingIds }
}

// Zorgt dat elke dependency een geldige teamId heeft. Ondersteunt drie
// gevallen: dependency heeft al teamId, dependency heeft nog het oude
// team-naamveld, of dependency verwijst naar een team dat niet (meer)
// in de teamlijst voorkomt (dan wordt het team alsnog aangemaakt zodat er
// geen data verloren gaat).
function resolveTeamId(dep, teamsState) {
  if (dep.teamId && teamsState.existingIds.has(dep.teamId)) return dep.teamId

  const naam = typeof dep.team === 'string' ? dep.team.trim() : ''
  if (naam) {
    if (teamsState.nameToId.has(naam)) return teamsState.nameToId.get(naam)
    const id = uniqueSlug(naam, teamsState.existingIds)
    teamsState.existingIds.add(id)
    teamsState.nameToId.set(naam, id)
    teamsState.teams.push({ id, naam, actief: true, createdAt: todayIso(), updatedAt: todayIso() })
    return id
  }

  // Onherleidbare dependency (geen team, geen teamId): laat leeg. De UI
  // toont dit als "onbekend team" i.p.v. te crashen.
  return dep.teamId ?? null
}

function migrateFuncties(rawFuncties) {
  if (Array.isArray(rawFuncties) && rawFuncties.length > 0) {
    const existingIds = new Set()
    const clean = []
    for (const raw of rawFuncties) {
      if (!raw || typeof raw !== 'object') continue
      const id = raw.id ? String(raw.id) : uniqueSlug(raw.naam ?? 'functie', existingIds)
      if (existingIds.has(id)) continue
      existingIds.add(id)
      clean.push({ id, naam: String(raw.naam ?? id), actief: raw.actief !== false })
    }
    return clean.length > 0 ? clean : DEFAULT_FUNCTIES.map((f) => ({ ...f }))
  }
  return DEFAULT_FUNCTIES.map((f) => ({ ...f }))
}

function migrateDependency(raw, teamsState) {
  const teamId = resolveTeamId(raw, teamsState)
  return {
    ...raw,
    teamId,
    eigenaarFunctieIds: Array.isArray(raw.eigenaarFunctieIds) ? raw.eigenaarFunctieIds : [],
    workflowStap: raw.workflowStap ?? null,
    effectOpFlow: raw.effectOpFlow ?? null,
    oplossingsniveau: raw.oplossingsniveau ?? null,
    actieAfspraak: typeof raw.actieAfspraak === 'string' ? raw.actieAfspraak : '',
  }
}

// Centrale migratiefunctie: accepteert data in willekeurig oud of nieuw
// formaat (localStorage of JSON-import) en retourneert altijd een volledig
// geldige, actuele state met schemaVersion = SCHEMA_VERSION. Idempotent:
// mag ook op reeds-gemigreerde data losgelaten worden zonder schade.
export function migrateState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const teamsState = migrateTeams(source.teams)
  const dependencies = (Array.isArray(source.dependencies) ? source.dependencies : []).map((dep) =>
    migrateDependency(dep, teamsState),
  )
  const functies = migrateFuncties(source.functies)

  return {
    schemaVersion: SCHEMA_VERSION,
    teams: teamsState.teams,
    functies,
    dependencies,
    usingMockData: Boolean(source.usingMockData),
  }
}

// Structurele validatie van een geïmporteerd JSON-bestand. Gooit een
// duidelijke, Nederlandstalige foutmelding i.p.v. stil te falen of de
// bestaande data te overschrijven met onbruikbare data. Veldniveau-waarden
// (scope/impact/frequentie/status/categorie) worden bewust niet hard
// afgekeurd: de rest van de app valt daar al terug op veilige defaults
// (zie risk.js en categoriesForScope), zodat één rommelig record niet de
// hele import blokkeert.
export function validateImportShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Bestand bevat geen geldig export-object (verwacht JSON met "teams" en "dependencies").')
  }
  if (!Array.isArray(parsed.teams)) {
    throw new Error('Bestand mist een geldige "teams"-lijst.')
  }
  if (!Array.isArray(parsed.dependencies)) {
    throw new Error('Bestand mist een geldige "dependencies"-lijst.')
  }
  for (const [i, dep] of parsed.dependencies.entries()) {
    if (!dep || typeof dep !== 'object') {
      throw new Error(`Dependency op positie ${i + 1} is geen geldig object.`)
    }
    if (!dep.titel || typeof dep.titel !== 'string') {
      throw new Error(`Dependency op positie ${i + 1} mist een titel.`)
    }
  }
}

// --- publieke API ---

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    teams: [],
    functies: DEFAULT_FUNCTIES.map((f) => ({ ...f })),
    dependencies: [],
    usingMockData: false,
  }
}

function mockState() {
  return migrateState({
    teams: MOCK_TEAMS,
    dependencies: MOCK_DEPENDENCIES,
    usingMockData: true,
  })
}

export function loadState() {
  try {
    const rawText = localStorage.getItem(STORAGE_KEY)
    if (!rawText) {
      const initial = mockState()
      saveState(initial)
      return initial
    }
    const parsed = JSON.parse(rawText)
    const migrated = migrateState(parsed)
    // Schrijf gemigreerde data direct terug zodat oude localStorage-data
    // maar één keer gemigreerd hoeft te worden.
    if (parsed.schemaVersion !== SCHEMA_VERSION) saveState(migrated)
    return migrated
  } catch {
    return mockState()
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }))
}

export function resetToEmpty() {
  const state = emptyState()
  saveState(state)
  return state
}

export function resetToMockData() {
  const state = mockState()
  saveState(state)
  return state
}

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `dep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
