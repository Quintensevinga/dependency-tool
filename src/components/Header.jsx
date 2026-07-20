import { useState } from 'react'
import ScopeToggle from './ScopeToggle'
import TabSelector from './TabSelector'
import ConfidentialityBadge from './ConfidentialityBadge'
import SettingsPanel from './SettingsPanel'
import TeamNavDrawer from './TeamNavDrawer'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'

function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div
      className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-xs"
      role="group"
      aria-label={t('header.language')}
    >
      {['nl', 'en'].map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={`rounded px-2 py-1 font-medium uppercase transition-colors ${
            language === lang ? 'bg-[#33493c] text-white' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}

function HamburgerButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md border border-stone-300 p-2 text-stone-600 hover:bg-stone-50"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export default function Header({ activeTab, onTabChange, onNewDependency, onExportPng }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const { currentTeamId, teamName } = useAppContext()
  const { t } = useLanguage()

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <HamburgerButton onClick={() => setNavOpen(true)} label={t('nav.teams')} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-stone-900">{t('app.title')}</h1>
              {currentTeamId && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                  {teamName(currentTeamId)}
                </span>
              )}
            </div>
            <div className="mt-1">
              <ConfidentialityBadge />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ScopeToggle />
          <button
            type="button"
            onClick={onNewDependency}
            disabled={!currentTeamId}
            className="rounded-md bg-[#33493c] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#263a2f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('header.newDependency')}
          </button>
          <LanguageToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label={t('header.settings')}
              aria-expanded={settingsOpen}
              title={t('header.settings')}
              className="rounded-md border border-stone-300 p-2 text-stone-500 hover:bg-stone-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.4-2-3.4-2.3.8a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.4a7.6 7.6 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.4 2 3.4 2.3-.8a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.4a7.6 7.6 0 0 0 1.7-1l2.3.8 2-3.4-2-1.4Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} onExportPng={onExportPng} />}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <TabSelector activeTab={activeTab} onChange={onTabChange} />
      </div>

      <TeamNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </header>
  )
}
