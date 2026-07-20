// Vertaal-mappings voor de vaste (Nederlandse) datamodel-waarden.
// De opgeslagen data blijft altijd Nederlands (canoniek); dit is puur een weergavelaag.

export const CATEGORIE_LABELS = {
  'Kennis-concentratie': { nl: 'Kennis-concentratie', en: 'Knowledge concentration' },
  'Proces-/workflow-afhankelijkheid': { nl: 'Proces-/workflow-afhankelijkheid', en: 'Process/workflow dependency' },
  'Rol-afhankelijkheid': { nl: 'Rol-afhankelijkheid', en: 'Role dependency' },
  'Besluitvormingsafhankelijkheid': { nl: 'Besluitvormingsafhankelijkheid', en: 'Decision-making dependency' },
  'Technische afhankelijkheid': { nl: 'Technische afhankelijkheid', en: 'Technical dependency' },
  'Data-afhankelijkheid': { nl: 'Data-afhankelijkheid', en: 'Data dependency' },
  'Omgevingsafhankelijkheid': { nl: 'Omgevingsafhankelijkheid', en: 'Environment dependency' },
  'Overig intern': { nl: 'Overig intern', en: 'Other internal' },
  'Capaciteit specialistisch team': { nl: 'Capaciteit specialistisch team', en: 'Specialist team/vendor capacity' },
  'Kennis-afhankelijkheid extern': { nl: 'Kennis-afhankelijkheid extern', en: 'External knowledge dependency' },
  'Toegang/rechten-blokkade': { nl: 'Toegang/rechten-blokkade', en: 'Access/permissions blockage' },
  'Governance/proces-afhankelijkheid': { nl: 'Governance/proces-afhankelijkheid', en: 'Governance/process dependency' },
  'Procesafhankelijkheid': { nl: 'Procesafhankelijkheid', en: 'Process dependency (chain)' },
  'Stakeholderafhankelijkheid': { nl: 'Stakeholderafhankelijkheid', en: 'Stakeholder dependency' },
  'Wetgevingsafhankelijkheid': { nl: 'Wetgevingsafhankelijkheid', en: 'Legislative dependency' },
  'Contract-/inkoopafhankelijkheid': { nl: 'Contract-/inkoopafhankelijkheid', en: 'Contract/procurement dependency' },
  'Overig extern': { nl: 'Overig extern', en: 'Other external' },
}

// Voorbeeldtekst per categorie, per scope (dezelfde categorienaam kan op
// teamniveau en ketenniveau een ander voorbeeld hebben). Getoond op hover.
export const CATEGORY_DESCRIPTIONS = {
  intern: {
    'Kennis-concentratie': {
      nl: 'Kennis is geconcentreerd bij één persoon binnen het team, bijvoorbeeld een senior developer of functioneel beheerder.',
      en: 'Knowledge is concentrated with a single person within the team, e.g. a senior developer or functional administrator.',
    },
    'Proces-/workflow-afhankelijkheid': {
      nl: 'Een interne werkstap of overdracht binnen het team hangt af van één specifieke aanpak of persoon.',
      en: 'An internal work step or handover within the team depends on one specific approach or person.',
    },
    'Rol-afhankelijkheid': {
      nl: 'Besluitvorming of goedkeuring binnen het team ligt bij één rol met de enige bevoegdheid of het enige mandaat.',
      en: 'Decision-making or approval within the team rests with a single role holding sole authority or mandate.',
    },
    'Besluitvormingsafhankelijkheid': {
      nl: 'Voortgang hangt af van akkoord van een specifieke rol binnen het team, bijvoorbeeld de product owner.',
      en: 'Progress depends on sign-off from a specific role within the team, e.g. the product owner.',
    },
    'Technische afhankelijkheid': {
      nl: 'Eigen tooling, scripts of koppelvlakken die slechts door één persoon worden begrepen of onderhouden.',
      en: 'In-house tooling, scripts or interfaces that only one person understands or maintains.',
    },
    'Data-afhankelijkheid': {
      nl: 'Eigen testdata, rapportagedata of autorisatiebeheer is kwetsbaar of onvoldoende geborgd.',
      en: "The team's own test data, reporting data or authorization management is fragile or insufficiently safeguarded.",
    },
    'Omgevingsafhankelijkheid': {
      nl: 'De eigen ontwikkel- of testomgeving is instabiel of onvoldoende beschikbaar.',
      en: "The team's own development or test environment is unstable or insufficiently available.",
    },
    'Overig intern': {
      nl: 'Andere interne afhankelijkheid die niet in de bovenstaande categorieën past.',
      en: "Another internal dependency that doesn't fit the categories above.",
    },
  },
  extern: {
    'Capaciteit specialistisch team': {
      nl: 'Beperkte capaciteit bij een extern team of leverancier leidt tot wachttijd, bijvoorbeeld bij infra- of platformteams.',
      en: 'Limited capacity at an external team or vendor causes waiting time, e.g. infra or platform teams.',
    },
    'Kennis-afhankelijkheid extern': {
      nl: 'Domeinkennis of expertise ligt bij een ander team of externe partij.',
      en: 'Domain knowledge or expertise sits with another team or external party.',
    },
    'Toegang/rechten-blokkade': {
      nl: 'Toegang of autorisatie wordt traag, gedeeltelijk of soms helemaal niet toegekend door een ander team, waardoor processen stagneren of volledig stilvallen.',
      en: 'Access or authorization is granted slowly, partially, or sometimes not at all by another team, causing processes to stagnate or grind to a complete halt.',
    },
    'Governance/proces-afhankelijkheid': {
      nl: 'Een formeel change- of CAB-proces bepaalt het tempo van wijzigingen.',
      en: 'A formal change or CAB process dictates the pace of changes.',
    },
    'Besluitvormingsafhankelijkheid': {
      nl: 'Goedkeuring is vereist van een extern orgaan, bijvoorbeeld een architectuurboard, security-afdeling of management.',
      en: 'Approval is required from an external body, e.g. an architecture board, security department or management.',
    },
    'Technische afhankelijkheid': {
      nl: 'Een API, database, koppelvlak of tool van een ander team of externe partij is randvoorwaardelijk.',
      en: 'An API, database, interface or tool owned by another team or external party is a hard prerequisite.',
    },
    'Procesafhankelijkheid': {
      nl: 'Overdracht-, intake-, change- of releaseprocessen met andere teams bepalen de doorlooptijd.',
      en: 'Handover, intake, change or release processes with other teams determine the lead time.',
    },
    'Data-afhankelijkheid': {
      nl: 'Productie-, rapportage- of testdata en autorisaties worden extern beheerd.',
      en: 'Production, reporting or test data and authorizations are managed externally.',
    },
    'Omgevingsafhankelijkheid': {
      nl: 'Een gedeelde test-, acceptatie- of productieomgeving wordt door een ander team beheerd.',
      en: 'A shared test, acceptance or production environment is managed by another team.',
    },
    'Stakeholderafhankelijkheid': {
      nl: 'Afhankelijk van input, akkoord of beschikbaarheid van een gebruikersgroep, opdrachtgever of externe partij.',
      en: 'Depends on input, sign-off or availability of a user group, client or external party.',
    },
    'Wetgevingsafhankelijkheid': {
      nl: 'Een wetswijziging koppelt het werkproces dwingend aan externe instanties of specifieke technologie.',
      en: 'A change in legislation forces the work process to couple to external bodies or specific technology.',
    },
    'Contract-/inkoopafhankelijkheid': {
      nl: 'Leverancierscontract, aanbesteding of SLA bepaalt wat mogelijk is en op welke termijn.',
      en: "A vendor contract, procurement process or SLA determines what's possible and on what timeline.",
    },
    'Overig extern': {
      nl: 'Andere externe afhankelijkheid die niet in de bovenstaande categorieën past.',
      en: "Another external dependency that doesn't fit the categories above.",
    },
  },
}

export const IMPACT_LABELS = {
  laag: { nl: 'laag', en: 'low' },
  midden: { nl: 'midden', en: 'medium' },
  hoog: { nl: 'hoog', en: 'high' },
}

export const FREQUENTIE_LABELS = {
  incidenteel: { nl: 'incidenteel', en: 'occasional' },
  structureel: { nl: 'structureel', en: 'structural' },
}

export const STATUS_LABELS = {
  'bekend risico': { nl: 'bekend risico', en: 'known risk' },
  'actief blokkerend': { nl: 'actief blokkerend', en: 'actively blocking' },
  gemitigeerd: { nl: 'gemitigeerd', en: 'mitigated' },
}

export const RISK_LEVEL_LABELS = {
  Laag: { nl: 'Laag', en: 'Low' },
  Gemiddeld: { nl: 'Gemiddeld', en: 'Medium' },
  Hoog: { nl: 'Hoog', en: 'High' },
  Kritiek: { nl: 'Kritiek', en: 'Critical' },
}

export const SCOPE_LABELS = {
  intern: { nl: 'teamniveau', en: 'team level' },
  extern: { nl: 'ketenniveau', en: 'chain level' },
}

export const WORKFLOW_STAP_LABELS = {
  idee_input: { nl: 'Idee / input', en: 'Idea / input' },
  refinement: { nl: 'Refinement', en: 'Refinement' },
  ready: { nl: 'Ready', en: 'Ready' },
  build: { nl: 'Build', en: 'Build' },
  test: { nl: 'Test', en: 'Test' },
  acceptatie: { nl: 'Acceptatie', en: 'Acceptance' },
  release: { nl: 'Release', en: 'Release' },
  beheer: { nl: 'Beheer', en: 'Operations' },
}

export const EFFECT_OP_FLOW_LABELS = {
  wachten: { nl: 'Wachten', en: 'Waiting' },
  herwerk: { nl: 'Herwerk', en: 'Rework' },
  contextswitch: { nl: 'Contextswitch', en: 'Context switch' },
  vertraging: { nl: 'Vertraging', en: 'Delay' },
  onduidelijkheid: { nl: 'Onduidelijkheid', en: 'Ambiguity' },
  blokkade: { nl: 'Blokkade', en: 'Blockage' },
  extra_afstemming: { nl: 'Extra afstemming nodig', en: 'Extra alignment needed' },
  niet_startklaar: { nl: 'Niet startklaar', en: 'Not ready to start' },
  anders: { nl: 'Anders', en: 'Other' },
}

export const OPLOSSINGSNIVEAU_LABELS = {
  team: { nl: 'Team', en: 'Team' },
  samenwerking: { nl: 'Samenwerking', en: 'Collaboration' },
  opschaling: { nl: 'Opschaling', en: 'Escalation' },
  monitoren: { nl: 'Monitoren', en: 'Monitor' },
}

function lookup(map, key, lang) {
  return map[key]?.[lang] ?? key
}

export const translateCategorie = (key, lang) => lookup(CATEGORIE_LABELS, key, lang)
export const translateImpact = (key, lang) => lookup(IMPACT_LABELS, key, lang)
export const translateFrequentie = (key, lang) => lookup(FREQUENTIE_LABELS, key, lang)
export const translateStatus = (key, lang) => lookup(STATUS_LABELS, key, lang)
export const translateRiskLevel = (key, lang) => lookup(RISK_LEVEL_LABELS, key, lang)
export const translateScope = (key, lang) => lookup(SCOPE_LABELS, key, lang)
export const translateWorkflowStap = (key, lang) => (key ? lookup(WORKFLOW_STAP_LABELS, key, lang) : '')
export const translateEffectOpFlow = (key, lang) => (key ? lookup(EFFECT_OP_FLOW_LABELS, key, lang) : '')
export const translateOplossingsniveau = (key, lang) => (key ? lookup(OPLOSSINGSNIVEAU_LABELS, key, lang) : '')

export function getCategoryDescription(categorie, scope, lang) {
  return CATEGORY_DESCRIPTIONS[scope]?.[categorie]?.[lang] ?? ''
}
