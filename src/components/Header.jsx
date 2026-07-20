import { useState } from 'react'
import SettingsPanel from './SettingsPanel'
import TeamNavDrawer from './TeamNavDrawer'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'

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

function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div className="inline-flex rounded-md bg-white/8 p-0.5 text-xs" title={t('header.language')}>
      {['nl', 'en'].map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={`rounded px-2 py-1 font-medium uppercase transition-colors ${
            language === lang ? 'bg-[#2a5f8a] text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}

function RailButton({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-[#2a5f8a] text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function Header({ activeTab, onTabChange, onNewDependency, onExportPng, onNavigateToTeam }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const { teams, activeTeams, dependencies, currentTeamId, setCurrentTeamId } = useAppContext()
  const { t } = useLanguage()

  const criticalCount = dependencies.filter((d) => calculateRisk(d).level === 'Kritiek').length

  return (
    <>
      <header className="border-b border-slate-900/10 bg-[#101a2b]">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-6 py-3">
          <h1 className="text-[15px] font-semibold tracking-tight text-white">{t('app.title')}</h1>
          <div className="h-5 w-px bg-white/15" />
          <div className="flex items-center gap-1.5">
            <select
              value={currentTeamId ?? ''}
              onChange={(e) => setCurrentTeamId(e.target.value || null)}
              title={t('header.teamSelectHint')}
              className="rounded-md border-none bg-white/8 px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              <option value="">{t('header.allTeams')}</option>
              {activeTeams.map((team) => (
                <option key={team.id} value={team.id} className="text-slate-900">
                  {team.naam}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              title={t('nav.teams')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-white/8 hover:text-white"
            >
              +
            </button>
          </div>
          <div className="h-5 w-px bg-white/15" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-bold text-[#e8a2ab]">{criticalCount}</span>
            <span className="text-[11px] text-slate-400">{t('stats.critical')}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-bold text-white">{teams.length}</span>
            <span className="text-[11px] text-slate-400">{t('nav.teams')}</span>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={onNewDependency}
              disabled={!currentTeamId}
              className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('header.newDependency')}
            </button>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <nav
        className="fixed bottom-0 left-0 top-[57px] z-30 hidden w-14 flex-col items-center gap-1 bg-[#16324a] py-3 md:flex"
        aria-label={t('nav.views')}
      >
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICONS[id]
          return (
            <RailButton key={id} active={activeTab === id} title={t(TAB_LABEL_KEYS[id])} onClick={() => onTabChange(id)}>
              <Icon />
            </RailButton>
          )
        })}
        <div className="relative mt-auto">
          <RailButton title={t('header.settings')} onClick={() => setSettingsOpen((v) => !v)}>
            <SettingsIcon />
          </RailButton>
          {settingsOpen && (
            <div className="absolute bottom-0 left-full ml-2">
              <SettingsPanel onClose={() => setSettingsOpen(false)} onExportPng={onExportPng} />
            </div>
          )}
        </div>
      </nav>

      <TeamNavDrawer open={navOpen} onClose={() => setNavOpen(false)} onNavigateToTeam={onNavigateToTeam} />
    </>
  )
}
