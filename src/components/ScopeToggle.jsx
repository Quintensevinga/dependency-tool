import { useLanguage } from '../context/LanguageContext'

const LABEL_KEYS = { intern: 'scope.intern', extern: 'scope.extern', alle: 'scope.alle' }

// Controlled component (scope/onChange als props) i.p.v. rechtstreeks
// useAppContext(), zodat elke pagina zijn eigen scope-state kan gebruiken —
// Matrix deelt de globale AppContext-scope, Netwerk/Keten hebben elk hun
// eigen lokale state die standaard op 'alle' begint.
export default function ScopeToggle({ scope, onChange, includeAll = true }) {
  const { t } = useLanguage()
  const options = includeAll ? ['intern', 'extern', 'alle'] : ['intern', 'extern']

  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={scope === value}
          className={`rounded px-3 py-1 capitalize transition-colors ${
            scope === value ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t(LABEL_KEYS[value])}
        </button>
      ))}
    </div>
  )
}
