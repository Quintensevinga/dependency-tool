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

// Gelijk aan de canvas-stages (WORKFLOW_STAGES), min 'hardening': dat is een
// canvas-only fase (alleen bereikt via capaciteit), geen moment waarop een
// dependency zelf wordt vastgelegd. Zo komt wat je in het formulier kiest
// 1-op-1 overeen met de kolom waar de dependency straks verschijnt.
export const WORKFLOW_STAP_LEVELS = [
  'analyse_refinement',
  'ontwikkeling_configuratie',
  'testen',
  'acceptatie',
  'release_overdracht',
  'beheer_nazorg',
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

// Workflowstap en canvas-stage delen nu dezelfde sleutels (zie
// WORKFLOW_STAP_LEVELS hierboven); deze map is een identity-map zodat de
// bestaande WORKFLOW_STAP_TO_STAGE[dep.workflowStap]-lookups door de rest
// van de app heen ongewijzigd kunnen blijven werken.
export const WORKFLOW_STAP_TO_STAGE = Object.fromEntries(WORKFLOW_STAP_LEVELS.map((stap) => [stap, stap]))

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

// "Op welk niveau is deze dependency op te lossen?" — vrij invulbaar door de
// aanmaker, geen afgeleide waarde. Vervangt het eerder overwogen afgeleide
// 'oplossingsniveau' (uit scope+categorie) — dit expliciete veld geeft de
// invuller meer controle en is minder grof.
export const OPLOSBAARHEID_LEVELS = ['teamlid', 'meerdere_teamleden', 'meerdere_teams', 'team_overstijgend', 'organisatorisch']

// --- Externe partijen (admin-beheerde centrale lijst) ---
// Hergebruikt BRON_TYPES als partij-type (team/rol/persoon/systeem/omgeving/
// stakeholder) — zelfde soort "van wie/wat" als bij een input-item, nu alleen
// als beheerde, herbruikbare entiteit i.p.v. losse vrije tekst per keer.
export const EXTERNAL_PARTY_STATUS = ['actief', 'in_afwachting', 'geweigerd']

