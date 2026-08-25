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

// --- Workflowstap, effect op flow ---
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

// --- Flowtype: scheidt "hoort bij het ontwikkelproces" van "gaat over een
// applicatie" — bepaalt of workflowstap verplicht is en of de dependency op
// het workflow-canvas dan wel bij een applicatie op de teampagina verschijnt.
export const FLOWTYPE_LEVELS = ['ontwikkelflow', 'applicatieflow']

// Vaste mapping van de (fijnmaziger) per-dependency workflowstap naar de
// (grovere) teamcanvas-stages, zodat een Ontwikkelflow-dependency op de
// juiste kolom van het workflow-canvas verschijnt. 'hardening' heeft bewust
// geen bronwaarde: dat is een canvas-only fase (capaciteit), geen moment
// waarop een dependency zelf wordt vastgelegd.
export const WORKFLOW_STAP_TO_STAGE = {
  idee_input: 'analyse_refinement',
  refinement: 'analyse_refinement',
  ready: 'ontwikkeling_configuratie',
  build: 'ontwikkeling_configuratie',
  test: 'testen',
  acceptatie: 'acceptatie',
  release: 'release_overdracht',
  beheer: 'beheer_nazorg',
}

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

