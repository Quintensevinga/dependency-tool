import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'

export default function ScopeToggle() {
  const { scope, setScope } = useAppContext()
  const { t } = useLanguage()

  return (
    <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-sm">
      {['intern', 'extern'].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setScope(value)}
          className={`rounded px-3 py-1 capitalize transition-colors ${
            scope === value ? 'bg-[#33493c] text-white' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {value === 'intern' ? t('scope.intern') : t('scope.extern')}
        </button>
      ))}
    </div>
  )
}
