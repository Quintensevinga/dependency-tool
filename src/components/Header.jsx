import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'

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

export default function Header({ onNewDependency }) {
  const { teams, dependencies } = useAppContext()
  const { t } = useLanguage()

  const criticalCount = dependencies.filter((d) => calculateRisk(d).level === 'Kritiek').length

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-900/10 bg-[#101a2b]">
      <div className="flex items-center justify-between gap-5 px-6 py-2.5">
        <div className="flex items-center gap-5">
          <div className="flex min-w-0 flex-col leading-tight">
            <h1 className="text-[15px] font-semibold tracking-tight text-white">{t('app.title')}</h1>
            <span className="text-[11px] text-slate-400">{t('app.subtitle')}</span>
          </div>

          <div className="h-7 w-px bg-white/15" />

          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-bold text-[#e8a2ab]">{criticalCount}</span>
              <span className="text-[11px] text-slate-400">{t('stats.critical')}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-bold text-white">{teams.length}</span>
              <span className="text-[11px] text-slate-400">{t('nav.teams')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onNewDependency}
            className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
          >
            {t('header.newDependency')}
          </button>
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
