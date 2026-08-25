import { useEffect, useRef, useState } from 'react'
import SettingsPanel from './SettingsPanel'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'

function MatrixIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
function NetworkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.2 8.2 15.8 11M8.2 15.8 15.8 13" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
function ChainIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="8" width="9" height="8" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <rect x="12" y="8" width="9" height="8" rx="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
function HeatmapIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="9.5" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="16" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.2" />
      <rect x="3" y="9.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="16" y="9.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="3" y="16" width="5" height="5" rx="1" fill="currentColor" opacity="0.2" />
      <rect x="9.5" y="16" width="5" height="5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="16" y="16" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

// Platte navigatielijst i.p.v. Netwerkweergave met geneste Heatmap/Relatiekaart-
// subtabs: Heatmap en Relatiekaart zijn nu evenwaardige top-level items, in de
// door de gebruiker gevraagde volgorde. 'graphMode' bepaalt zowel welke
// GraphView-modus als de actieve/hoogtelichte status; 'tab' bepaalt welk
// hoofdtabblad (activeTab in App.jsx) actief wordt.
const NAV_ITEMS = [
  { key: 'heatmap', tab: 'graph', graphMode: 'heatmap', icon: HeatmapIcon, labelKey: 'graph.mode.heatmap' },
  { key: 'bipartite', tab: 'graph', graphMode: 'bipartite', icon: NetworkIcon, labelKey: 'graph.mode.bipartite' },
  { key: 'matrix', tab: 'matrix', graphMode: null, icon: MatrixIcon, labelKey: 'tab.matrix' },
  { key: 'chain', tab: 'chain', graphMode: null, icon: ChainIcon, labelKey: 'tab.chain' },
]

function SettingsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.4-2-3.4-2.3.8a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.4a7.6 7.6 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.4 2 3.4 2.3-.8a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.4a7.6 7.6 0 0 0 1.7-1l2.3.8 2-3.4-2-1.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function ArchiveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RailButton({ active, title, onClick, children, label, collapsed }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-3 rounded-lg py-2.5 text-left text-sm font-medium transition-colors ${
        collapsed ? 'w-10 justify-center px-0' : 'w-full px-3'
      } ${active ? 'bg-[#2a5f8a] text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

function CollapseIcon({ collapsed }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={collapsed ? 'rotate-180' : ''}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Vastzetten (pin) vs automatisch verbergen (auto-hide) — gevuld wanneer de
// zijbalk momenteel gepind is ('open'/'icons'), open/leeg wanneer 'auto'.
function PinIcon({ pinned }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'}>
      <path
        d="M14.5 3.5 20.5 9.5 17 13l-.5 5-2.5-2.5L9 20l-1-1 4.5-4.5L10 12l3.5-3.5L14.5 3.5Z"
        stroke="currentColor"
        strokeWidth={pinned ? '0.5' : '1.6'}
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Chevron voor de smalle auto-hide-handle: wijst naar rechts (de zijbalk
// schuift die kant op open).
function ChevronRightIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TeamRow({ team, active, onNavigateToTeam }) {
  const { renameTeam, archiveTeam, deleteTeam, teamLabels } = useAppContext()
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  // Bewerken gaat over de échte naam; alleen de weergave krijgt bij dubbele
  // namen een volgnummer.
  const [value, setValue] = useState(team.naam)
  const label = teamLabels[team.id] ?? team.naam
  const [blocked, setBlocked] = useState(false)

  function submitRename(e) {
    e.preventDefault()
    if (value.trim()) renameTeam(team.id, value.trim())
    setEditing(false)
  }

  function handleDelete(e) {
    e.stopPropagation()
    const ok = deleteTeam(team.id)
    if (!ok) {
      setBlocked(true)
      window.setTimeout(() => setBlocked(false), 4000)
    }
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={submitRename} className="flex items-center gap-1.5 px-2 py-1">
          <label htmlFor={`sidebar-rename-${team.id}`} className="sr-only">
            {t('settings.rename')}
          </label>
          <input
            id={`sidebar-rename-${team.id}`}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={submitRename}
            className="w-full rounded-md border-none bg-white/8 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/30"
          />
        </form>
      </li>
    )
  }

  return (
    <li className="group">
      <div className={`flex items-center gap-0.5 rounded-lg pr-1 transition-colors ${active ? 'bg-[#2a5f8a]' : 'hover:bg-white/8'}`}>
        <button
          type="button"
          onClick={() => onNavigateToTeam(team.id)}
          title={label}
          className={`min-w-0 flex-1 truncate px-3 py-1.5 text-left text-sm ${active ? 'font-medium text-white' : 'text-slate-300'}`}
        >
          {label}
        </button>
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            title={t('settings.rename')}
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            title={t('settings.archive')}
            onClick={(e) => {
              e.stopPropagation()
              archiveTeam(team.id)
            }}
            className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white"
          >
            <ArchiveIcon />
          </button>
          <button
            type="button"
            title={t('settings.delete')}
            onClick={handleDelete}
            className="rounded p-1 text-slate-300 hover:bg-[#e8a2ab]/20 hover:text-[#e8a2ab]"
          >
            <DeleteIcon />
          </button>
        </span>
      </div>
      {blocked && <p className="px-3 pb-1 text-[10px] text-[#e8a2ab]">{t('settings.teams.deleteBlocked')}</p>}
    </li>
  )
}

function TeamsSection({ activeTeamId, onNavigateToTeam }) {
  const { activeTeams } = useAppContext()
  const { t } = useLanguage()
  const [open, setOpen] = useState(true)

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
      >
        {t('nav.teams')}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto px-1">
            {activeTeams.length === 0 && <li className="px-2 py-1.5 text-xs text-slate-500">{t('team.noTeams')}</li>}
            {activeTeams.map((team) => (
              <TeamRow key={team.id} team={team} active={team.id === activeTeamId} onNavigateToTeam={onNavigateToTeam} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onExportPng,
  onNavigateToTeam,
  activeTeamId,
  graphViewMode,
  onGraphViewModeChange,
  mode,
  onModeChange,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { t } = useLanguage()
  const { adminSettings } = useAppContext()

  // 'auto': bijna volledig verborgen, alleen een handle — schuift tijdelijk
  // open bij hover/focus (autoExpanded) zonder de content-padding in App.jsx
  // aan te passen, dus als een overlay bovenop het canvas i.p.v. het opzij
  // te duwen zoals 'open'/'icons' dat wél doen.
  const isAuto = mode === 'auto'
  const [autoExpanded, setAutoExpanded] = useState(false)
  const navRef = useRef(null)

  useEffect(() => {
    if (!isAuto) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setAutoExpanded(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isAuto])

  // Bij modewissel (bv. vastzetten vanuit een andere stand) telt de
  // tijdelijke open-stand niet meer mee.
  useEffect(() => {
    setAutoExpanded(false)
  }, [mode])

  // collapsed = smal/iconen-weergave. Bij 'auto' + tijdelijk open tonen we
  // bewust de brede weergave (herkenbaar, makkelijker te scannen tijdens een
  // kort bezoek) i.p.v. de smalle iconenrail.
  const collapsed = mode === 'icons'

  // Admin-toggles filteren de navigatie i.p.v. de losse view-componenten elk
  // voor zich te laten checken of ze zelf nog wel getoond mogen worden.
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.key === 'heatmap') return adminSettings.pages.netwerk && adminSettings.sections.netwerk.heatmap
    if (item.key === 'bipartite') return adminSettings.pages.netwerk && adminSettings.sections.netwerk.relatiekaart
    if (item.key === 'matrix') return adminSettings.pages.matrix
    if (item.key === 'chain') return adminSettings.pages.keten
    return true
  })

  // Na een navigatie-actie klapt een niet-gepinde (auto-hide) zijbalk weer
  // dicht — gepind ('open'/'icons') blijft gewoon staan zoals voorheen.
  function afterNavigate() {
    if (isAuto) setAutoExpanded(false)
  }

  if (isAuto && !autoExpanded) {
    return (
      <button
        type="button"
        onMouseEnter={() => setAutoExpanded(true)}
        onFocus={() => setAutoExpanded(true)}
        title={t('nav.showNavigation')}
        aria-label={t('nav.showNavigation')}
        className="fixed left-0 top-1/2 z-30 hidden h-16 w-3.5 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-white/10 bg-[#16324a] text-slate-400 transition-colors hover:w-4 hover:text-white md:flex"
      >
        <ChevronRightIcon />
      </button>
    )
  }

  return (
    <nav
      ref={navRef}
      onMouseLeave={isAuto ? () => setAutoExpanded(false) : undefined}
      onBlur={
        isAuto
          ? (e) => {
              if (!navRef.current?.contains(e.relatedTarget)) setAutoExpanded(false)
            }
          : undefined
      }
      className={`fixed bottom-0 left-0 top-[57px] z-30 hidden flex-col gap-1 overflow-y-auto bg-[#16324a] py-3 transition-[width] md:flex ${
        collapsed ? 'w-14 items-center px-2' : 'w-56 px-2.5'
      } ${isAuto ? 'shadow-2xl shadow-black/30' : ''}`}
      aria-label={t('nav.views')}
    >
      <div className={collapsed ? 'mb-1 flex flex-col gap-1' : 'mb-1 flex items-center gap-1'}>
        {!isAuto && (
          <button
            type="button"
            onClick={() => onModeChange(mode === 'open' ? 'icons' : 'open')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className={`flex h-8 items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white ${
              collapsed ? 'w-10 justify-center' : 'flex-1 justify-between px-2.5'
            }`}
          >
            {!collapsed && <span className="text-xs font-medium">{t('nav.collapse')}</span>}
            <CollapseIcon collapsed={collapsed} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onModeChange(isAuto ? 'open' : 'auto')}
          title={isAuto ? t('nav.pin') : t('nav.autoHide')}
          aria-label={isAuto ? t('nav.pin') : t('nav.autoHide')}
          className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isAuto
              ? 'border-[#2a5f8a]/50 bg-[#2a5f8a]/20 text-white hover:bg-[#2a5f8a]/30'
              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <PinIcon pinned={isAuto} />
        </button>
      </div>

      {visibleNavItems.map((item) => {
        const Icon = item.icon
        const active = item.graphMode ? activeTab === 'graph' && graphViewMode === item.graphMode : activeTab === item.tab
        return (
          <RailButton
            key={item.key}
            active={active}
            title={t(item.labelKey)}
            label={t(item.labelKey)}
            onClick={() => {
              if (item.graphMode) onGraphViewModeChange(item.graphMode)
              onTabChange(item.tab)
              afterNavigate()
            }}
            collapsed={collapsed}
          >
            <Icon />
          </RailButton>
        )
      })}

      <div className={`my-1 h-px bg-white/10 ${collapsed ? 'w-8' : ''}`} />

      {!collapsed && adminSettings.pages.team && (
        <TeamsSection
          activeTeamId={activeTeamId}
          onNavigateToTeam={(teamId) => {
            onNavigateToTeam(teamId)
            afterNavigate()
          }}
        />
      )}

      <div className="relative mt-auto">
        <RailButton
          title={t('header.settings')}
          label={t('header.settings')}
          onClick={() => setSettingsOpen((v) => !v)}
          collapsed={collapsed}
        >
          <SettingsIcon />
        </RailButton>
        {settingsOpen && (
          // position:fixed (i.p.v. absolute) zodat het paneel niet wordt
          // meegeklemd door de overflow-auto van <nav> hierboven (nodig voor
          // de scrollbare teamlijst) — een absolute descendant die buiten
          // nav's eigen breedte uitsteekt werd anders behandeld als scrollbare
          // inhoud van nav zelf, waardoor nav automatisch wegscrolde zodra het
          // paneel focus kreeg en het paneel grotendeels onzichtbaar werd.
          <div className={collapsed ? 'fixed bottom-3 left-[68px] z-50' : 'fixed bottom-3 left-[232px] z-50'}>
            <SettingsPanel onClose={() => setSettingsOpen(false)} onExportPng={onExportPng} />
          </div>
        )}
      </div>
    </nav>
  )
}
