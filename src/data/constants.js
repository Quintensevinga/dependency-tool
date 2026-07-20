export const SCOPES = ['intern', 'extern']

export const CATEGORIES_INTERN = [
  'Kennis-concentratie',
  'Proces-/workflow-afhankelijkheid',
  'Rol-afhankelijkheid',
  'Besluitvormingsafhankelijkheid',
  'Technische afhankelijkheid',
  'Data-afhankelijkheid',
  'Omgevingsafhankelijkheid',
  'Overig intern',
]

export const CATEGORIES_EXTERN = [
  'Capaciteit specialistisch team',
  'Kennis-afhankelijkheid extern',
  'Toegang/rechten-blokkade',
  'Governance/proces-afhankelijkheid',
  'Besluitvormingsafhankelijkheid',
  'Technische afhankelijkheid',
  'Procesafhankelijkheid',
  'Data-afhankelijkheid',
  'Omgevingsafhankelijkheid',
  'Stakeholderafhankelijkheid',
  'Wetgevingsafhankelijkheid',
  'Contract-/inkoopafhankelijkheid',
  'Overig extern',
]

export const IMPACT_LEVELS = ['laag', 'midden', 'hoog']

export const FREQUENCY_LEVELS = ['incidenteel', 'structureel']

export const STATUS_LEVELS = ['bekend risico', 'actief blokkerend', 'gemitigeerd']

export const RISK_LEVELS = ['Laag', 'Gemiddeld', 'Hoog', 'Kritiek']

export function categoriesForScope(scope) {
  return scope === 'extern' ? CATEGORIES_EXTERN : CATEGORIES_INTERN
}

// --- Workflowstap, effect op flow, oplossingsniveau ---
// Vaste, canonieke sleutels (geen vrije tekst) zodat later betrouwbaar
// gefilterd en gegroepeerd kan worden. Labels/vertalingen staan in i18n/labels.js.

export const WORKFLOW_STAP_LEVELS = [
  'idee_input',
  'refinement',
  'ready',
  'build',
  'test',
  'acceptatie',
  'release',
  'beheer',
]

export const EFFECT_OP_FLOW_LEVELS = [
  'wachten',
  'herwerk',
  'contextswitch',
  'vertraging',
  'onduidelijkheid',
  'blokkade',
  'extra_afstemming',
  'niet_startklaar',
  'anders',
]

export const OPLOSSINGSNIVEAU_LEVELS = ['team', 'samenwerking', 'opschaling', 'monitoren']

// --- Teamworkflow-bord (teampagina, ketenoverzicht) ---
// Vaste, globale werkstappen-reeks (niet per team aanpasbaar in v1).

export const WORKFLOW_STAGES = [
  'analyse_refinement',
  'ontwikkeling_configuratie',
  'testen',
  'acceptatie',
  'hardening',
  'release_overdracht',
  'beheer_nazorg',
]

// "Van wie/wat komt dit input-item?" — brontype van een workflow input-item.
export const BRON_TYPES = ['team', 'rol', 'persoon', 'systeem', 'omgeving', 'stakeholder']

export const SENIORITY_LEVELS = ['junior', 'medior', 'senior']

// "Vormt het wegvallen van deze persoon/rol een risico voor de workflow?"
export const RISICO_BIJ_UITVAL = ['ja', 'nee']

// --- Standaard functies/rollen (seed-lijst, aanpasbaar via Instellingen) ---
// Elke functie krijgt een stabiele id (slug) zodat filteren/groeperen op
// eigenaarfunctie betrouwbaar blijft, ook als de naam ooit wijzigt.
export const DEFAULT_FUNCTIES = [
  { id: 'product-owner', naam: 'Product Owner', actief: true },
  { id: 'scrum-master', naam: 'Scrum Master', actief: true },
  { id: 'developer', naam: 'Developer', actief: true },
  { id: 'tester', naam: 'Tester', actief: true },
  { id: 'testcoordinator', naam: 'Testcoördinator', actief: true },
  { id: 'architect', naam: 'Architect', actief: true },
  { id: 'business-analist', naam: 'Business analist', actief: true },
  { id: 'beheerder', naam: 'Beheerder', actief: true },
  { id: 'functioneel-beheerder', naam: 'Functioneel beheerder', actief: true },
  { id: 'technisch-beheerder', naam: 'Technisch beheerder', actief: true },
  { id: 'security-officer', naam: 'Security officer', actief: true },
  { id: 'privacy-officer', naam: 'Privacy officer', actief: true },
  { id: 'manager', naam: 'Manager', actief: true },
  { id: 'leverancier', naam: 'Leverancier', actief: true },
  { id: 'stakeholder-business', naam: 'Stakeholder / business', actief: true },
  { id: 'overig', naam: 'Overig', actief: true },
]
