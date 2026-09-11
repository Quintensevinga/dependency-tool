import {
  MOCK_TEAMS,
  MOCK_DEPENDENCIES,
  MOCK_TEAM_WORKFLOWS,
  MOCK_EXTERNAL_PARTIES,
  MOCK_CHANGE_LOG,
  MOCK_ADMIN_SETTINGS,
} from '../data/mockData'
import { WORKFLOW_STAGES, BRON_TYPES, EXTERNAL_PARTY_STATUS, LINK_STATUS } from '../data/constants'
import { slugify, uniqueSlug } from './slug'

export const STORAGE_KEY = 'dependency-insight:v1'
// 5: input-/output-items kennen linkStatus/linkNieuw/punten, applicatie-
// koppelingen kennen punten (zie migrateIoItem/migrateConnection).
// 6: dependencies kennen een wijzigingshistorie (historie) en een sluitdatum
// (gesloten_op); koppelingsverzoeken kennen voorstel-/besluitdatums; de
// wijzigingenlog kent naast review-entries ook losse gebeurtenissen.
export const SCHEMA_VERSION = 6

// Los van SCHEMA_VERSION: die volgt de datastructuur, dit volgt de inhoud
// van de meegeleverde voorbeelddata (data/mockData.js). Ophogen bij een
// inhoudelijke wijziging (nieuwe teams/namen, extra historie, ...) zorgt dat
// iemand die de site al opende maar nog nooit eigen data invoerde
// (usingMockData: true) bij het volgende bezoek automatisch de nieuwe
// voorbeelddata krijgt i.p.v. vast te blijven zitten op wat ooit geseed is.
// Raakt echte gebruikersdata (usingMockData: false) nooit — zie loadState().
// Belangrijk: dit werkt alleen als een volgende inhoudelijke wijziging aan
// mockData.js dit getal ook echt ophoogt bij het mergen — anders detecteert
// dit mechanisme niets en blijven bestaande usingMockData-bezoekers alsnog
// op oude inhoud.
// 1: 8-teams demodataset met wijzigingshistorie (historie) en analysepagina.
// 2: teamnamen omgedoopt naar het Marvel-thema (ids ongewijzigd).
export const MOCK_DATA_VERSION = 2

export const MAX_SNAPSHOTS_PER_TEAM = 10

export { slugify, uniqueSlug }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Alleen een echte, parseerbare datumtekst blijft staan; al het andere
// (leeg, getal, 'gisteren') wordt null. Een onparseerbare datum liep anders
// als NaN de analyse in en liet daar de hele app op een fout vastlopen.
function isoDatumOf(value) {
  return typeof value === 'string' && value && !Number.isNaN(Date.parse(value)) ? value : null
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
    // Optionele, team-specifieke toelichting per ontwikkelflowstap (sleutel =
    // WORKFLOW_STAGES-waarde). Losse vrije tekst, geen systeem-uitleg — leeg
    // laat niets zien op het canvas.
    stageNotes: {},
  }
}

// Alleen bekende stage-sleutels met een echte, niet-lege tekst behouden —
// beschermt tegen corrupte/handmatig aangepaste importdata zonder te crashen.
function sanitizeStageNotes(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const clean = {}
  for (const stage of WORKFLOW_STAGES) {
    if (typeof raw[stage] === 'string' && raw[stage].trim()) clean[stage] = raw[stage]
  }
  return clean
}

// --- admin: pagina's/secties aan- of uitzetten ---
// Puur zichtbaarheid, geen dataverwijdering: een uitgezette sectie levert
// gewoon geen JSX op, de onderliggende data blijft ongemoeid. Alles staat
// standaard aan. Instellingen zelf zit hier bewust niet in — die pagina (en
// daarmee Admin) moet altijd bereikbaar blijven, dus is niet uit te zetten.
export const DEFAULT_ADMIN_SETTINGS = {
  // Aparte feature-toggle, geen pagina/sectie-zichtbaarheid: schakelt het
  // uitgebreide analysemodel (flowverlies/urgentie naast de risicoscore) aan
  // of uit. Uit = de app gedraagt zich exact zoals vandaag, geen fallback-
  // code nodig — zie src/lib/analysis.js.
  uitgebreideAnalyse: false,
  pages: {
    heatmap: true,
    keten: true,
    team: true,
    analyse: true,
  },
  sections: {
    heatmap: { categorieUitleg: true, selectiepaneel: true, filters: true },
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
// Impact en frequentie zijn van 3 resp. 2 niveaus naar 4 gegaan. Oude waarden
// blijven geldig in bestaande localStorage- en exportbestanden, dus vertalen
// we ze hier eenmalig naar de nieuwe sleutels. De mapping houdt de relatieve
// positie aan: 'laag' was niet het laagst denkbare, dus die wordt 'beperkt'
// en niet 'klein' — 'klein' is een nieuw niveau eronder.
const IMPACT_MIGRATIE = { laag: 'beperkt', midden: 'duidelijk', hoog: 'zwaar' }
const FREQUENTIE_MIGRATIE = { incidenteel: 'soms' }

export function migrateAdminSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  // Per bekende sleutel overnemen i.p.v. een spread van het hele opgeslagen
  // object: pagina's die niet meer bestaan (Matrix-overzicht, Netwerkweergave)
  // bleven anders als losse sleutel in de state en in elke nieuwe JSON-export
  // hangen — zelfde regel als de sections-lus hieronder al hanteerde.
  const savedPages = source.pages && typeof source.pages === 'object' ? source.pages : {}
  const pages = {}
  for (const [pageKey, fallback] of Object.entries(DEFAULT_ADMIN_SETTINGS.pages)) {
    pages[pageKey] = typeof savedPages[pageKey] === 'boolean' ? savedPages[pageKey] : fallback
  }
  const sections = {}
  for (const [pageKey, defaults] of Object.entries(DEFAULT_ADMIN_SETTINGS.sections)) {
    const savedPage = source.sections?.[pageKey]
    sections[pageKey] = { ...defaults, ...(savedPage && typeof savedPage === 'object' ? savedPage : {}) }
  }
  const uitgebreideAnalyse = typeof source.uitgebreideAnalyse === 'boolean' ? source.uitgebreideAnalyse : DEFAULT_ADMIN_SETTINGS.uitgebreideAnalyse
  return { pages, sections, uitgebreideAnalyse }
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

  // Een teamId dat naar geen enkel team (meer) wijst — alleen mogelijk bij
  // handmatig samengestelde importdata — leverde een dependency die in geen
  // enkele weergave zichtbaar was: elke view filtert op de teamlijst. Het
  // record onzichtbaar wegstoppen is erger dan een placeholder-team met de
  // verweesde id als naam: zo staat het in beeld en kan de gebruiker het
  // hernoemen of naar het juiste team verplaatsen. Zelfde aanpak als de
  // naam-route hierboven, die ook al teams bijmaakt.
  if (typeof dep.teamId === 'string' && dep.teamId.trim()) {
    const id = dep.teamId.trim()
    teamsState.existingIds.add(id)
    teamsState.teams.push({ id, naam: id, actief: true, createdAt: todayIso(), updatedAt: todayIso() })
    return id
  }

  // Onherleidbare dependency (geen team, geen teamId): laat leeg. De UI
  // toont dit als "onbekend team" i.p.v. te crashen.
  return dep.teamId ?? null
}

// Oudere data kende 8 fijnmazige workflowstappen die niet 1-op-1 overeenkwamen
// met de 7 (bredere) canvas-stages — verwarrend, want wat je in het formulier
// koos leek dan niet overeen te komen met de kolom waar de dependency
// verscheen. Workflowstap deelt nu dezelfde sleutels als de canvas-stage
// (zie WORKFLOW_STAP_LEVELS in constants.js); deze map zet bestaande waarden
// eenmalig om naar de nieuwe, bredere sleutels.
const LEGACY_WORKFLOWSTAP_MIGRATION = {
  idee_input: 'analyse_refinement',
  refinement: 'analyse_refinement',
  ready: 'ontwikkeling_configuratie',
  build: 'ontwikkeling_configuratie',
  test: 'testen',
  release: 'release_overdracht',
  beheer: 'beheer_nazorg',
}

// 'Procesafhankelijkheid' en 'Governance/proces-afhankelijkheid' waren twee
// bakken voor hetzelfde begrip (zie CATEGORIES_EXTERN in constants.js) —
// bestaande data valt terug op de overgebleven waarde. Belangrijk dat dit
// vóór elke score-/analysewerking gebeurt: categorie is de cluster-sleutel
// in het meetmodel.
const CATEGORIE_MIGRATIE = {
  Procesafhankelijkheid: 'Governance/proces-afhankelijkheid',
}

// Alleen entries met een datum en een veldnaam blijven staan; van/naar mogen
// leeg zijn (bv. een sluiting). Chronologisch gesorteerd zodat "toestand op
// datum X" een simpele replay is.
function sanitizeHistorie(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((e) => e && typeof e === 'object' && typeof e.datum === 'string' && e.datum && typeof e.veld === 'string' && e.veld)
    .map((e) => ({ datum: e.datum, veld: e.veld, van: e.van ?? null, naar: e.naar ?? null }))
    .sort((a, b) => a.datum.localeCompare(b.datum))
}

function migrateDependency(raw, teamsState) {
  const teamId = resolveTeamId(raw, teamsState)
  const { eigenaarFunctieIds: _eigenaarFunctieIds, oplossingsniveau: _oplossingsniveau, ...rest } = raw
  rest.categorie = CATEGORIE_MIGRATIE[rest.categorie] ?? rest.categorie
  // Bestaande data met een workflowstap wordt aangenomen Ontwikkelflow te
  // zijn; zonder workflowstap blijft flowtype expliciet onbepaald (null) —
  // nooit stilzwijgend als Applicatieflow geraden, dat toont de UI als
  // "Flowtype nog te bepalen" totdat de gebruiker het bewerkt.
  const flowtype = raw.flowtype ?? (raw.workflowStap ? 'ontwikkelflow' : null)
  // Applicatieflow kent conceptueel géén workflowstap — dat hoort bij
  // Ontwikkelflow. Een eventuele (legacy/vervuilde) waarde wordt hier, bij de
  // bron, genegeerd i.p.v. per view apart genegeerd, zodat canvas, lijst,
  // filters en detailpaneel nooit meer een andere indeling kunnen tonen.
  const workflowStap =
    flowtype === 'applicatieflow'
      ? null
      : raw.workflowStap
        ? (LEGACY_WORKFLOWSTAP_MIGRATION[raw.workflowStap] ?? raw.workflowStap)
        : null
  return {
    ...rest,
    teamId,
    workflowStap,
    flowtype,
    impact: IMPACT_MIGRATIE[rest.impact] ?? rest.impact,
    frequentie: FREQUENTIE_MIGRATIE[rest.frequentie] ?? rest.frequentie,
    effectOpFlow: raw.effectOpFlow ?? null,
    actieAfspraak: typeof raw.actieAfspraak === 'string' ? raw.actieAfspraak : '',
    applicatieIds: Array.isArray(raw.applicatieIds) ? raw.applicatieIds : [],
    geaccepteerd: raw.geaccepteerd === true,
    // Ontbreekt dit veld (bv. handmatig samengestelde of erg oude importdata),
    // dan crasht sorteren op "recent bijgewerkt" (.localeCompare op undefined).
    // Terugval op vandaag i.p.v. een lege string: consistent met hoe elders al
    // met vandaag-als-fallback wordt gewerkt, en sorteert 'm tussen de andere
    // records i.p.v. altijd onderaan/bovenaan te dwingen.
    laatst_bijgewerkt: isoDatumOf(raw.laatst_bijgewerkt) ?? todayIso(),
    // Team-als-veroorzaker ook op id (niet alleen op naam): expliciet
    // meegegeven, anders afgeleid uit een exact matchende teamnaam, zodat
    // analyses nooit op naam hoeven te matchen. Nooit geraden bij twijfel.
    geraaktTeamId:
      typeof raw.geraaktTeamId === 'string' && teamsState.existingIds.has(raw.geraaktTeamId)
        ? raw.geraaktTeamId
        : (typeof rest.geraakte_team_extern === 'string' && teamsState.nameToId.get(rest.geraakte_team_extern.trim())) || null,
    oplosbaarheid: typeof raw.oplosbaarheid === 'string' ? raw.oplosbaarheid : '',
    wachttijd: typeof raw.wachttijd === 'string' ? raw.wachttijd : '',
    deadline: typeof raw.deadline === 'string' ? raw.deadline : '',
    deadlineTekst: typeof raw.deadlineTekst === 'string' ? raw.deadlineTekst : '',
    // Bestaande dependencies kennen geen aanmaakmoment — geen datum verzinnen
    // (onvolledig ≠ nul), de UI toont dit expliciet als "onbekend". Alleen
    // nieuw aangemaakte records (via AppContext.addDependency) krijgen dit
    // vanaf nu automatisch gezet.
    aangemaakt_op: isoDatumOf(raw.aangemaakt_op),
    // Wijzigingshistorie (status, impact, frequentie, …) met datum — de basis
    // voor trends en doorlooptijden. Wordt vanaf nu door AppContext gevuld bij
    // elke wijziging; oudere data start met een lege historie (onvolledig ≠
    // verzonnen).
    historie: sanitizeHistorie(raw.historie),
    // Gesloten dependencies blijven bewaard mét historie, maar tellen niet
    // meer mee in de operationele weergaven (zie activeDependencies in
    // AppContext).
    gesloten_op: isoDatumOf(raw.gesloten_op),
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
  const teamWorkflows = migrateTeamWorkflows(source.teamWorkflows, teamsState.teams)
  const teamSnapshots = migrateTeamSnapshots(source.teamSnapshots, teamsState.teams)
  const externalParties = migrateExternalParties(source.externalParties)
  const changeLog = migrateChangeLog(source.changeLog)

  const adminSettings = migrateAdminSettings(source.adminSettings)

  return {
    schemaVersion: SCHEMA_VERSION,
    teams: teamsState.teams,
    dependencies,
    teamWorkflows,
    teamSnapshots,
    externalParties,
    changeLog,
    usingMockData: Boolean(source.usingMockData),
    adminSettings,
  }
}

// Zorgt dat elk team een geldig teamWorkflow-record heeft (id-based, ook na
// import van een export die dit nog niet kende). Onbekende/verweesde keys
// (team inmiddels verwijderd) worden hier stilzwijgend niet meegenomen.
// Oudere data kende een 'functieId' dat verwees naar een los beheerde
// functies/rollen-lijst; die lijst is vervallen. Bestaande rijen behouden
// hun rol-tekst door functieId direct als leestekst te hergebruiken.
function migrateCapacityRow(row) {
  if (!row || typeof row !== 'object') return row
  if (row.rol !== undefined) {
    const { functieId: _functieId, ...rest } = row
    return rest
  }
  const { functieId, ...rest } = row
  return { ...rest, rol: functieId ?? '' }
}

// Vrije opsomming (korte punten) bij een lijn op het teamcanvas — alleen
// echte, niet-lege tekstregels blijven staan.
function sanitizePunten(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter((p) => typeof p === 'string' && p.trim())
}

// Cross-team koppeling van een input-/output-item. Een al bestaande, opgeloste
// koppeling (linkedTeam + een item-id) telt als 'geaccepteerd': retroactief
// om akkoord vragen zou elke bestaande ketenlijn in oudere data/exports plots
// op 'wacht op akkoord' zetten. Alleen nieuwe koppelingen (via de teampagina)
// starten als verzoek — zie LINK_STATUS in constants.js.
function migrateIoItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return rawItem
  // Presentatievelden van de teampagina (_pendingRequest/_ghostRequest) die
  // in oudere data via het bewerk-formulier per ongeluk zijn meegeschreven,
  // horen niet in het record en gaan hier weg.
  const { _pendingRequest: _pending, _ghostRequest: _ghost, ...item } = rawItem
  const hasLink = Boolean(item.linkedTeam && (item.linkedOutputId || item.linkedInputId))
  const linkStatus = LINK_STATUS.includes(item.linkStatus) ? item.linkStatus : hasLink ? 'geaccepteerd' : ''
  return {
    ...item,
    punten: sanitizePunten(item.punten),
    linkStatus,
    linkNieuw: item.linkNieuw === true,
    // Datum van het koppelingsverzoek en van het besluit erover: samen de
    // doorlooptijd van goedkeuring.
    linkVoorgesteldOp: typeof item.linkVoorgesteldOp === 'string' ? item.linkVoorgesteldOp : '',
    linkBesluitOp: typeof item.linkBesluitOp === 'string' ? item.linkBesluitOp : '',
  }
}

function migrateConnection(conn) {
  if (!conn || typeof conn !== 'object') return conn
  return { ...conn, punten: sanitizePunten(conn.punten) }
}

function migrateTeamWorkflows(rawWorkflows, teams) {
  const source = rawWorkflows && typeof rawWorkflows === 'object' ? rawWorkflows : {}
  const result = {}
  for (const team of teams) {
    const workflow =
      source[team.id] && typeof source[team.id] === 'object' ? { ...emptyTeamWorkflow(), ...source[team.id] } : emptyTeamWorkflow()
    const applicatieflow = {
      ...emptyApplicatieflow(),
      ...(workflow.applicatieflow && typeof workflow.applicatieflow === 'object' ? workflow.applicatieflow : {}),
    }
    result[team.id] = {
      ...workflow,
      capacity: (workflow.capacity ?? []).map(migrateCapacityRow),
      inputs: (workflow.inputs ?? []).map(migrateIoItem),
      outputs: (workflow.outputs ?? []).map(migrateIoItem),
      applicatieflow: { ...applicatieflow, connecties: (applicatieflow.connecties ?? []).map(migrateConnection) },
      stageNotes: sanitizeStageNotes(workflow.stageNotes),
    }
  }
  return result
}

// Externe partijen: centrale, admin-beheerde lijst (team/rol/persoon/systeem/
// omgeving/stakeholder) met een goedkeuring/weigering-workflow. Onbekend
// type/status vallen terug op een veilige default i.p.v. de import te
// blokkeren — zelfde filosofie als de rest van deze migratielaag.
function migrateExternalParties(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p) => p && typeof p === 'object' && typeof p.naam === 'string' && p.naam.trim())
    .map((p) => ({
      id: p.id ? String(p.id) : generateId(),
      naam: p.naam.trim(),
      type: BRON_TYPES.includes(p.type) ? p.type : 'stakeholder',
      status: EXTERNAL_PARTY_STATUS.includes(p.status) ? p.status : 'actief',
      createdAt: p.createdAt ?? todayIso(),
      updatedAt: p.updatedAt ?? todayIso(),
      voorgesteldDoorTeamId: p.voorgesteldDoorTeamId ?? null,
    }))
}

function migrateTeamSnapshots(rawSnapshots, teams) {
  const source = rawSnapshots && typeof rawSnapshots === 'object' ? rawSnapshots : {}
  const result = {}
  for (const team of teams) {
    result[team.id] = Array.isArray(source[team.id]) ? source[team.id] : []
  }
  return result
}

// Wijzigingenlog voor de admin-logpagina: één entry per aangemaakte
// dependency, met een eventuele markering als mogelijk duplicaat van een
// dependency op een ander team (zie AppContext.jsx addDependency/
// findPotentialDuplicate). Onbekende/corrupte entries vallen weg i.p.v. de
// hele import te blokkeren.
// 'dependency_created' is de review-entry van de admin-logpagina (met
// goedkeurstatus en eventuele duplicaatmarkering); de overige types zijn
// losse gebeurtenissen zonder review, puur voor de analyse (registratie-
// gedrag, sluitingen, koppelingsverzoeken). Een verwijderde dependency
// bestaat niet meer, daarom draagt elke entry de titel zelf mee.
export const CHANGE_LOG_TYPES = [
  'dependency_created',
  'dependency_updated',
  'dependency_closed',
  'dependency_reopened',
  'dependency_deleted',
  'link_proposed',
  'link_accepted',
  'link_rejected',
]

function migrateChangeLog(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c) => c && typeof c === 'object' && c.id)
    .map((c) => {
      const type = CHANGE_LOG_TYPES.includes(c.type) ? c.type : 'dependency_created'
      const isReview = type === 'dependency_created'
      return {
        id: String(c.id),
        timestamp: c.timestamp ?? new Date().toISOString(),
        teamId: c.teamId ?? null,
        type,
        dependencyId: c.dependencyId ?? null,
        duplicateOfId: c.duplicateOfId ?? null,
        titel: typeof c.titel === 'string' ? c.titel : '',
        details: c.details && typeof c.details === 'object' ? c.details : null,
        status: isReview ? (['pending', 'approved', 'edited', 'rejected'].includes(c.status) ? c.status : 'pending') : null,
      }
    })
    .filter((c) => c.type !== 'dependency_created' || c.dependencyId)
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
    dependencies: [],
    teamWorkflows: {},
    teamSnapshots: {},
    externalParties: [],
    changeLog: [],
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
  const idSet = new Set(state.teams.map((t) => t.id))
  const teamWorkflows = { ...state.teamWorkflows }
  // Teamverwijzingen in de seed mogen een team-id of een leesbare teamnaam
  // zijn; een onbekende verwijzing wordt leeg i.p.v. als kapotte verwijzing
  // door te sijpelen.
  const mapTeamRef = (ref) => (ref ? (idSet.has(ref) ? ref : (nameToId.get(ref) ?? '')) : '')

  for (const [teamKey, seed] of Object.entries(MOCK_TEAM_WORKFLOWS)) {
    const teamId = mapTeamRef(teamKey)
    if (!teamId) continue
    teamWorkflows[teamId] = {
      ...emptyTeamWorkflow(),
      applications: seed.applications ?? [],
      capacity: (seed.capacity ?? []).map((row) => ({
        id: row.id,
        rol: row.rol ?? '',
        seniority: row.seniority ?? '',
        aantal: row.aantal ?? 1,
        fase: row.fase ?? '',
        risico_bij_uitval: row.risico_bij_uitval ?? '',
        risico_toelichting: row.risico_toelichting ?? '',
      })),
      // Zelfde normalisatie als een echte import (migrateIoItem): bestaande
      // koppelingen tellen als geaccepteerd, punten/linkNieuw krijgen defaults.
      inputs: (seed.inputs ?? []).map((item) => migrateIoItem({ ...item, linkedTeam: mapTeamRef(item.linkedTeam) })),
      outputs: (seed.outputs ?? []).map((item) => migrateIoItem({ ...item, linkedTeam: mapTeamRef(item.linkedTeam) })),
      layout: seed.layout ?? {},
      annotations: seed.annotations ?? [],
      annotationEdges: seed.annotationEdges ?? [],
      stageNotes: sanitizeStageNotes(seed.stageNotes),
      applicatieflow: {
        ...emptyApplicatieflow(),
        connecties: (seed.applicatieflowConnecties ?? []).map(migrateConnection),
        details: seed.applicatieflowDetails ?? {},
      },
    }
  }

  return { ...state, teamWorkflows }
}

function mockState() {
  const base = migrateState({
    teams: MOCK_TEAMS,
    dependencies: MOCK_DEPENDENCIES,
    externalParties: MOCK_EXTERNAL_PARTIES,
    changeLog: MOCK_CHANGE_LOG,
    adminSettings: MOCK_ADMIN_SETTINGS ?? undefined,
    usingMockData: true,
  })
  return applyMockTeamWorkflows(base)
}

const CORRUPT_STORAGE_KEY = `${STORAGE_KEY}:corrupt`

// Retourneert { state, corrupted } i.p.v. alleen de state: een onleesbaar
// localStorage-record valt terug op demodata (anders crasht de hele app op
// het opstarten), maar dat mag niet stilzwijgend gebeuren — de aanroeper
// (AppContext/App) toont bij corrupted:true een waarschuwing en biedt de
// bewaarde ruwe tekst (zie getCorruptRawData) aan om te downloaden, zodat de
// eigen data van de gebruiker niet spoorloos verdwijnt.
export function loadState() {
  const rawText = localStorage.getItem(STORAGE_KEY)
  if (!rawText) {
    const initial = mockState()
    saveState(initial)
    return { state: initial, corrupted: false }
  }
  try {
    const parsed = JSON.parse(rawText)
    const migrated = migrateState(parsed)
    // Onaangeraakte voorbeelddata verversen naar de nieuwste inhoud i.p.v.
    // vast te blijven zitten op wat ooit geseed is — zie MOCK_DATA_VERSION.
    // Zodra iemand zelf iets wijzigt zet AppContext usingMockData blijvend
    // op false, dus dit raakt nooit eigen ingevoerde data.
    const savedMockVersion = typeof parsed.mockDataVersion === 'number' ? parsed.mockDataVersion : 0
    if (migrated.usingMockData && savedMockVersion < MOCK_DATA_VERSION) {
      const refreshed = mockState()
      saveState(refreshed)
      return { state: refreshed, corrupted: false }
    }
    // Schrijf gemigreerde data direct terug zodat oude localStorage-data
    // maar één keer gemigreerd hoeft te worden.
    if (parsed.schemaVersion !== SCHEMA_VERSION) saveState(migrated)
    return { state: migrated, corrupted: false }
  } catch {
    try {
      localStorage.setItem(CORRUPT_STORAGE_KEY, rawText)
    } catch {
      // Quotum vol o.i.d. — dan kan de ruwe tekst ook niet bewaard worden;
      // de waarschuwing verschijnt evengoed, alleen zonder downloadoptie.
    }
    return { state: mockState(), corrupted: true }
  }
}

export function getCorruptRawData() {
  return localStorage.getItem(CORRUPT_STORAGE_KEY)
}

export function clearCorruptRawData() {
  localStorage.removeItem(CORRUPT_STORAGE_KEY)
}

// Retourneert of het opslaan echt gelukt is (bv. false bij een vol
// localStorage-quotum) i.p.v. de fout ongevangen te laten doorschieten naar
// de aanroepende event handler — de UI toont de wijziging dan anders wel,
// maar bewaart hem niet, zonder dat iemand dat merkt.
export function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION, mockDataVersion: MOCK_DATA_VERSION }),
    )
    return true
  } catch (err) {
    console.error('Opslaan naar localStorage is mislukt:', err)
    return false
  }
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
