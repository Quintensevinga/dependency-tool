import { MOCK_TEAMS, MOCK_DEPENDENCIES, MOCK_TEAM_WORKFLOWS } from '../data/mockData'
import { DEFAULT_FUNCTIES } from '../data/constants'
import { slugify, uniqueSlug } from './slug'

const STORAGE_KEY = 'dependency-insight:v1'
export const SCHEMA_VERSION = 4

export const MAX_SNAPSHOTS_PER_TEAM = 10

export { slugify, uniqueSlug }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function emptyApplicatieflow() {
  return { connecties: [], details: {}, layout: {} }
}

export function emptyTeamWorkflow() {
  return {
    applications: [],
    capacity: [],
    inputs: [],
    outputs: [],
    layout: {},
    annotations: [],
    annotationEdges: [],
    applicatieflow: emptyApplicatieflow(),
  }
}

// --- admin: pagina's/secties aan- of uitzetten ---
// Puur zichtbaarheid, geen dataverwijdering: een uitgezette sectie levert
// gewoon geen JSX op, de onderliggende data blijft ongemoeid. Alles staat
// standaard aan. Instellingen zelf zit hier bewust niet in — die pagina (en
// daarmee Admin) moet altijd bereikbaar blijven, dus is niet uit te zetten.
export const DEFAULT_ADMIN_SETTINGS = {
  pages: {
    matrix: true,
    netwerk: true,
    keten: true,
    team: true,
  },
  sections: {
    matrix: { samenvattingskaarten: true, keyObservations: true, tabel: true, filters: true },
    netwerk: { heatmap: true, relatiekaart: true, categorieUitleg: true, selectiepaneel: true, filters: true },
    keten: { filters: true, legenda: true },
    team: {
      applicatieflow: true,
      ontwikkelflow: true,
      applicaties: true,
      input: true,
      output: true,
      capaciteit: true,
      dependencies: true,
      aantekeningen: true,
      filters: true,
    },
  },
}

// Merget opgeslagen instellingen diep met de defaults: een nieuw toegevoegde
// toggle in een latere versie staat zo altijd aan, en een onbekende/oude
// sleutel in geïmporteerde data valt gewoon weg i.p.v. de UI te breken.
export function migrateAdminSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const pages = { ...DEFAULT_ADMIN_SETTINGS.pages, ...(source.pages && typeof source.pages === 'object' ? source.pages : {}) }
  const sections = {}
  for (const [pageKey, defaults] of Object.entries(DEFAULT_ADMIN_SETTINGS.sections)) {
    const savedPage = source.sections?.[pageKey]
    sections[pageKey] = { ...defaults, ...(savedPage && typeof savedPage === 'object' ? savedPage : {}) }
  }
  return { pages, sections }
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
    // Bestaande data met een workflowstap wordt aangenomen Ontwikkelflow te
    // zijn; zonder workflowstap blijft flowtype expliciet onbepaald (null) —
    // nooit stilzwijgend als Applicatieflow geraden, dat toont de UI als
    // "Flowtype nog te bepalen" totdat de gebruiker het bewerkt.
    flowtype: raw.flowtype ?? (raw.workflowStap ? 'ontwikkelflow' : null),
    applicatieIds: Array.isArray(raw.applicatieIds) ? raw.applicatieIds : [],
    geaccepteerd: raw.geaccepteerd === true,
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
  const teamWorkflows = migrateTeamWorkflows(source.teamWorkflows, teamsState.teams)
  const teamSnapshots = migrateTeamSnapshots(source.teamSnapshots, teamsState.teams)

  const adminSettings = migrateAdminSettings(source.adminSettings)

  return {
    schemaVersion: SCHEMA_VERSION,
    teams: teamsState.teams,
    functies,
    dependencies,
    teamWorkflows,
    teamSnapshots,
    usingMockData: Boolean(source.usingMockData),
    adminSettings,
  }
}

// Zorgt dat elk team een geldig teamWorkflow-record heeft (id-based, ook na
// import van een export die dit nog niet kende). Onbekende/verweesde keys
// (team inmiddels verwijderd) worden hier stilzwijgend niet meegenomen.
function migrateTeamWorkflows(rawWorkflows, teams) {
  const source = rawWorkflows && typeof rawWorkflows === 'object' ? rawWorkflows : {}
  const result = {}
  for (const team of teams) {
    result[team.id] = source[team.id] && typeof source[team.id] === 'object' ? { ...emptyTeamWorkflow(), ...source[team.id] } : emptyTeamWorkflow()
  }
  return result
}

function migrateTeamSnapshots(rawSnapshots, teams) {
  const source = rawSnapshots && typeof rawSnapshots === 'object' ? rawSnapshots : {}
  const result = {}
  for (const team of teams) {
    result[team.id] = Array.isArray(source[team.id]) ? source[team.id] : []
  }
  return result
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
    teamWorkflows: {},
    teamSnapshots: {},
    usingMockData: false,
    adminSettings: migrateAdminSettings(),
  }
}

// Zet de illustratieve MOCK_TEAM_WORKFLOWS (gekoppeld op teamnaam, met
// leesbare rolnamen en teamnaam-verwijzingen) om naar het echte, id-based
// schema — dezelfde ids die migrateTeams() voor diezelfde namen genereert,
// dus geen aparte name->id-tabel nodig buiten wat hier lokaal wordt opgebouwd.
function applyMockTeamWorkflows(state) {
  const nameToId = new Map(state.teams.map((t) => [t.naam, t.id]))
  const teamWorkflows = { ...state.teamWorkflows }

  for (const [teamNaam, seed] of Object.entries(MOCK_TEAM_WORKFLOWS)) {
    const teamId = nameToId.get(teamNaam)
    if (!teamId) continue
    teamWorkflows[teamId] = {
      ...emptyTeamWorkflow(),
      applications: seed.applications ?? [],
      capacity: (seed.capacity ?? []).map((row) => ({
        id: row.id,
        functieId: row.rol ? slugify(row.rol) : '',
        seniority: row.seniority ?? '',
        aantal: row.aantal ?? 1,
        fase: row.fase ?? '',
        risico_bij_uitval: row.risico_bij_uitval ?? '',
        risico_toelichting: row.risico_toelichting ?? '',
      })),
      inputs: (seed.inputs ?? []).map((item) => ({
        ...item,
        linkedTeam: item.linkedTeam ? (nameToId.get(item.linkedTeam) ?? '') : '',
      })),
      outputs: seed.outputs ?? [],
      layout: seed.layout ?? {},
      applicatieflow: {
        ...emptyApplicatieflow(),
        connecties: seed.applicatieflowConnecties ?? [],
      },
    }
  }

  return { ...state, teamWorkflows }
}

function mockState() {
  const base = migrateState({
    teams: MOCK_TEAMS,
    dependencies: MOCK_DEPENDENCIES,
    usingMockData: true,
  })
  return applyMockTeamWorkflows(base)
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
