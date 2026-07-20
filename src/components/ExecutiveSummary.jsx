import { useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { generateExecutiveStats } from '../lib/insights'
import { translateCategorie } from '../i18n/labels'
import { riskStyle } from '../lib/riskStyles'

function StatCard({ label, value, valueColor }) {
  return (
    <div className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm">
      <div
        className="text-2xl font-semibold tracking-tight tabular-nums text-stone-900"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs leading-snug text-stone-500">{label}</div>
    </div>
  )
}

export default function ExecutiveSummary() {
  const { dependencies, teams } = useAppContext()
  const { t, language } = useLanguage()
  const stats = useMemo(() => generateExecutiveStats(dependencies, teams), [dependencies, teams])

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label={t('stats.critical')}
        value={stats.criticalCount}
        valueColor={stats.criticalCount > 0 ? riskStyle('Kritiek').hex : undefined}
      />
      <StatCard
        label={t('stats.topKnowledgeTeam')}
        value={stats.topKnowledgeTeam ? `${stats.topKnowledgeTeam.team} (${stats.topKnowledgeTeam.count})` : t('stats.none')}
      />
      <StatCard
        label={t('stats.topExternCategory')}
        value={stats.topExternCategory ? translateCategorie(stats.topExternCategory.categorie, language) : t('stats.none')}
      />
      <StatCard label={t('stats.trend')} value={t('stats.trendNA')} />
    </div>
  )
}
