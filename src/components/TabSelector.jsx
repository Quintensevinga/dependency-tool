import { useLanguage } from '../context/LanguageContext'

export default function TabSelector({ activeTab, onChange }) {
  const { t } = useLanguage()
  const TABS = [
    { id: 'matrix', label: t('tab.matrix') },
    { id: 'graph', label: t('tab.graph') },
  ]

  return (
    <div className="flex gap-6 border-b border-stone-200">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`-mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'border-[#33493c] text-[#33493c]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
