// Eén klein, herkenbaar icoon per conceptcluster. Sommige categorieën delen
// bewust hetzelfde icoon omdat ze hetzelfde soort afhankelijkheid zijn op
// team- vs. ketenniveau (bv. kennis, proces) of dezelfde formele aard hebben
// (governance/wetgeving) — het label/tooltip maakt het verschil expliciet.
const ICON_PATHS = {
  knowledge: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </>
  ),
  process: (
    <>
      <path d="M4 12h13" />
      <path d="M12 6l7 6-7 6" />
    </>
  ),
  role: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <circle cx="12" cy="10" r="2" />
      <path d="M9 16h6" />
    </>
  ),
  decision: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  technical: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  environment: (
    <>
      <path d="m12 3 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </>
  ),
  capacity: (
    <>
      <circle cx="9" cy="8" r="2.5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path d="M14.5 15.2c2.1.3 3.5 1.9 3.5 4.3" />
    </>
  ),
  access: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  governance: (
    <>
      <path d="M12 3v18M7 7h10" />
      <path d="M4 7l3-4 3 4M20 7l-3-4-3 4" />
      <path d="M4 7a3 3 0 0 0 6 0M14 7a3 3 0 0 0 6 0" />
    </>
  ),
  stakeholder: (
    <>
      <path d="M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M21 18a4 4 0 0 0-6.4-3.2M3 18a5 5 0 0 1 10 0v1H3v-1Z" />
    </>
  ),
  contract: (
    <>
      <path d="M6 3h9l4 4v14H6Z" />
      <path d="M14 3v4h5" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
}

const CATEGORY_ICON_KEY = {
  'Kennis-concentratie': 'knowledge',
  'Kennis-afhankelijkheid extern': 'knowledge',
  'Proces-/workflow-afhankelijkheid': 'process',
  'Rol-afhankelijkheid': 'role',
  'Besluitvormingsafhankelijkheid': 'decision',
  'Technische afhankelijkheid': 'technical',
  'Data-afhankelijkheid': 'data',
  'Omgevingsafhankelijkheid': 'environment',
  'Capaciteit specialistisch team': 'capacity',
  'Toegang/rechten-blokkade': 'access',
  'Governance/proces-afhankelijkheid': 'governance',
  'Wetgevingsafhankelijkheid': 'governance',
  'Stakeholderafhankelijkheid': 'stakeholder',
  'Contract-/inkoopafhankelijkheid': 'contract',
  'Overig intern': 'other',
  'Overig extern': 'other',
}

export function CategoryIcon({ categorie, className = 'h-3.5 w-3.5' }) {
  const key = CATEGORY_ICON_KEY[categorie] ?? 'other'
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[key]}
    </svg>
  )
}
