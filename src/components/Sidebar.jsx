import { useState } from 'react'
import SettingsPanel from './SettingsPanel'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'

const TAB_IDS = ['matrix', 'graph', 'chain']
const TAB_LABEL_KEYS = { matrix: 'tab.matrix', graph: 'tab.graph', chain: 'tab.chain' }

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

function TeamsSection({ activeTeamId, onNavigateToTeam }) {
  const { activeTeams, addTeam } = useAppContext()
  const { t } = useLanguage()
  const [open, setOpen] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  function handleSubmitNewTeam(e) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    addTeam(newTeamName)
    setNewTeamName('')
    setCreating(false)
  }

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
          <p className="px-3 pb-1.5 text-[11px] text-slate-500">{t('sidebar.teamsHint')}</p>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto px-1">
            {activeTeams.length === 0 && <li className="px-2 py-1.5 text-xs text-slate-500">{t('team.noTeams')}</li>}
            {activeTeams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => onNavigateToTeam(team.id)}
                  className={`w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    team.id === activeTeamId ? 'bg-[#2a5f8a] font-medium text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {team.naam}
                </button>
              </li>
            ))}
          </ul>

          <div className="px-2 pt-1.5">
            {creating ? (
              <form onSubmit={handleSubmitNewTeam} className="flex items-center gap-1.5">
                <label htmlFor="sidebar-new-team-name" className="sr-only">
                  {t('team.newPlaceholder')}
                </label>
                <input
                  id="sidebar-new-team-name"
                  autoFocus
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={t('team.newPlaceholder')}
                  className="w-full rounded-md border-none bg-white/8 px-2 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-xs text-white hover:bg-[#1f4a6c]"
                >
                  {t('team.confirmAdd')}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full rounded-md px-3 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-white/8 hover:text-slate-200"
              >
                {t('team.add')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ activeTab, onTabChange, onExportPng, onNavigateToTeam, activeTeamId }) {
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
          <RailButton
            key={id}
            active={activeTab === id}
            title={t(TAB_LABEL_KEYS[id])}
            label={t(TAB_LABEL_KEYS[id])}
            onClick={() => onTabChange(id)}
          >
            <Icon />
          </RailButton>
        )
      })}

      <div className="my-1 h-px bg-white/10" />

      <TeamsSection activeTeamId={activeTeamId} onNavigateToTeam={onNavigateToTeam} />

      <div className="relative mt-auto">
        <RailButton title={t('header.settings')} label={t('header.settings')} onClick={() => setSettingsOpen((v) => !v)}>
          <SettingsIcon />
        </RailButton>
        {settingsOpen && (
          <div className="absolute bottom-0 left-full ml-2">
            <SettingsPanel onClose={() => setSettingsOpen(false)} onExportPng={onExportPng} />
          </div>
        )}
      </div>
    </nav>
  )
}
