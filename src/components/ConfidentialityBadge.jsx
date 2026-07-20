import { useLanguage } from '../context/LanguageContext'

export default function ConfidentialityBadge() {
  const { t } = useLanguage()
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2a5f8a]" />
      {t('badge.privacy')}
    </div>
  )
}
