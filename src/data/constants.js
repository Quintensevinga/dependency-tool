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
