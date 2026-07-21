import { useState } from 'react'
import SettingsPanel from './SettingsPanel'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'

const TAB_IDS = ['matrix', 'graph', 'chain']
const TAB_LABEL_KEYS = { matrix: 'tab.matrix', graph: 'tab.graph', chain: 'tab.chain' }
// Experiment: Netwerkweergave-submodi ook als knoppen in de sidebar, i.p.v.
// (of naast) de segmented control boven het canvas — puur om te vergelijken.
const GRAPH_MODES = ['bipartite', 'cluster', 'heatmap']

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
const TAB_ICONS = { matrix: MatrixIcon, graph: NetworkIcon, chain: ChainIcon }

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

function RailButton({ active, title, onClick, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
        active ? 'bg-[#2a5f8a] text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white'
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function TeamRow({ team, active, onNavigateToTeam }) {
  const { renameTeam, archiveTeam, deleteTeam } = useAppContext()
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(team.naam)
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
          className={`min-w-0 flex-1 truncate px-3 py-1.5 text-left text-sm ${active ? 'font-medium text-white' : 'text-slate-300'}`}
        >
          {team.naam}
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
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <nav
      className="fixed bottom-0 left-0 top-[57px] z-30 hidden w-56 flex-col gap-1 overflow-y-auto bg-[#16324a] px-2.5 py-3 md:flex"
      aria-label={t('nav.views')}
    >
      {TAB_IDS.map((id) => {
        const Icon = TAB_ICONS[id]
        return (
          <div key={id}>
            <RailButton
              active={activeTab === id}
              title={t(TAB_LABEL_KEYS[id])}
              label={t(TAB_LABEL_KEYS[id])}
              onClick={() => onTabChange(id)}
            >
              <Icon />
            </RailButton>
            {id === 'graph' && activeTab === 'graph' && (
              <div className="ml-8 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2.5">
                {GRAPH_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={graphViewMode === mode}
                    onClick={() => onGraphViewModeChange(mode)}
                    className={`rounded-md px-2.5 py-1 text-left text-xs font-medium transition-colors ${
                      graphViewMode === mode ? 'bg-[#2a5f8a]/70 text-white' : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
                    }`}
                  >
                    {t(`graph.mode.${mode}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="my-1 h-px bg-white/10" />

      <TeamsSection activeTeamId={activeTeamId} onNavigateToTeam={onNavigateToTeam} />

      <div className="relative mt-auto">
        <RailButton title={t('header.settings')} label={t('header.settings')} onClick={() => setSettingsOpen((v) => !v)}>
          <SettingsIcon />
        </RailButton>
        {settingsOpen && (
          // position:fixed (i.p.v. absolute) zodat het paneel niet wordt
          // meegeklemd door de overflow-auto van <nav> hierboven (nodig voor
          // de scrollbare teamlijst) — een absolute descendant die buiten
          // nav's eigen breedte uitsteekt werd anders behandeld als scrollbare
          // inhoud van nav zelf, waardoor nav automatisch wegscrolde zodra het
          // paneel focus kreeg en het paneel grotendeels onzichtbaar werd.
          <div className="fixed bottom-3 left-[232px] z-50">
            <SettingsPanel onClose={() => setSettingsOpen(false)} onExportPng={onExportPng} />
          </div>
        )}
      </div>
    </nav>
  )
}
