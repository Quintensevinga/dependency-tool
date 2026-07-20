import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { generateInsights, formatInsightText } from '../lib/insights'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { translateRiskLevel } from '../i18n/labels'

function InsightRow({ insight, text, teamName }) {
  const [expanded, setExpanded] = useState(false)
  const { t, language } = useLanguage()

  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-slate-700">{text}</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 whitespace-nowrap text-xs font-medium text-[#2a5f8a] hover:underline"
        >
          {expanded ? t('insights.hideDetail') : t('insights.showDetail')}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-left text-xs">
            <tbody>
              {insight.detail.map((dep) => {
                const risk = calculateRisk(dep)
                const style = riskStyle(risk.level)
                return (
                  <tr key={dep.id} className="border-t border-slate-100 first:border-t-0">
                    <td className="px-3 py-1.5 text-slate-700">{dep.titel}</td>
                    <td className="px-3 py-1.5 text-slate-500">{teamName(dep.teamId)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 ${style.badge}`}>
                        {translateRiskLevel(risk.level, language)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  )
}

export default function InsightPanel() {
  const { dependencies, teams, functies, teamName } = useAppContext()
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const insights = useMemo(() => generateInsights(dependencies, teams, functies), [dependencies, teams, functies])

  if (insights.length === 0) return null

  return (
    <div className="rounded-xl border border-[#2a5f8a]/15 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
      >
        <span className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#2a5f8a]">
            <path
              d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.55 1 1.4 1 2.2V17h6v-1.3c0-.8.4-1.65 1-2.2A6 6 0 0 0 12 3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm font-semibold text-[#2a5f8a]">{t('insights.title')}</span>
          <span className="text-xs font-normal text-slate-400">
            {insights.length} {t(insights.length === 1 ? 'insights.collapsedOne' : 'insights.collapsedMany')}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-1">
          <ul className="divide-y divide-slate-100">
            {insights.map((insight, i) => (
              <InsightRow key={i} insight={insight} text={formatInsightText(insight, language)} teamName={teamName} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
