import { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  translateRiskLevel,
  translateWorkflowStap,
  translateEffectOpFlow,
  translateOplossingsniveau,
  getCategoryDescription,
} from '../i18n/labels'
import FloatingTooltip from './FloatingTooltip'
import { CategoryIcon } from '../data/categoryIcons'

// Gedeelde dependency-tabel: dezelfde kolommen/hover-tooltip als het
// Matrix-overzicht, herbruikt door de Relatiekaart-pagina zodat een selectie
// daar (team/categorie/koppeling) in exact dezelfde vorm getoond wordt.
export default function DependencyTable({ dependencies, onSelect, showTeamColumn = true, emptyLabel }) {
  const { teamName, functieNames } = useAppContext()
  const { t, language } = useLanguage()
  const [hover, setHover] = useState(null)

  const rows = dependencies.map((dependency) => ({ dependency, risk: calculateRisk(dependency) }))

  if (rows.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-slate-400">{emptyLabel ?? t('matrix.empty')}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            {showTeamColumn && <th className="px-5 py-2.5 font-medium">{t('matrix.col.team')}</th>}
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.titel')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.categorie')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.eigenaar')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.workflowstap')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.effectOpFlow')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.oplossingsniveau')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.impact')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.frequentie')}</th>
            <th className="px-5 py-2.5 font-medium">{t('matrix.col.status')}</th>
            <th className="sticky right-0 border-l border-slate-200 bg-white px-5 py-2.5 font-medium">{t('matrix.col.risico')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ dependency, risk }) => {
            const style = riskStyle(risk.level)
            return (
              <tr
                key={dependency.id}
                onClick={() => onSelect(dependency)}
                onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, dependency, risk })}
                onMouseMove={(e) => setHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-[#2a5f8a]/[0.03]"
              >
                {showTeamColumn && <td className="px-5 py-3 text-slate-500">{teamName(dependency.teamId)}</td>}
                <td className="px-5 py-3 font-medium text-slate-800">{dependency.titel}</td>
                <td className="px-5 py-3 text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <CategoryIcon categorie={dependency.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {translateCategorie(dependency.categorie, language)}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{functieNames(dependency.eigenaarFunctieIds) || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{translateWorkflowStap(dependency.workflowStap, language) || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{translateEffectOpFlow(dependency.effectOpFlow, language) || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{translateOplossingsniveau(dependency.oplossingsniveau, language) || '—'}</td>
                <td className="px-5 py-3 capitalize text-slate-500">{translateImpact(dependency.impact, language)}</td>
                <td className="px-5 py-3 capitalize text-slate-500">{translateFrequentie(dependency.frequentie, language)}</td>
                <td className="px-5 py-3 text-slate-500">{translateStatus(dependency.status, language)}</td>
                <td className="sticky right-0 border-l border-slate-200 bg-white px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.round((risk.score / 11) * 100))}%`, backgroundColor: style.hex }}
                      />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                      {translateRiskLevel(risk.level, language)}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {hover && (
        <FloatingTooltip x={hover.x} y={hover.y}>
          <div className="font-semibold text-slate-50">{hover.dependency.titel}</div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {translateCategorie(hover.dependency.categorie, language)}
          </div>
          <div className="mb-2 text-slate-300">
            {getCategoryDescription(hover.dependency.categorie, hover.dependency.scope, language)}
          </div>
          {hover.dependency.toelichting && <div className="mb-2 text-slate-300">{hover.dependency.toelichting}</div>}
          {(hover.dependency.workflowStap || hover.dependency.effectOpFlow || hover.dependency.oplossingsniveau) && (
            <div className="mb-2 space-y-0.5 text-slate-300">
              {hover.dependency.workflowStap && <div>{t('detail.workflowStap')}: {translateWorkflowStap(hover.dependency.workflowStap, language)}</div>}
              {hover.dependency.effectOpFlow && <div>{t('detail.effectOpFlow')}: {translateEffectOpFlow(hover.dependency.effectOpFlow, language)}</div>}
              {hover.dependency.oplossingsniveau && <div>{t('detail.oplossingsniveau')}: {translateOplossingsniveau(hover.dependency.oplossingsniveau, language)}</div>}
            </div>
          )}
          <div className="space-y-1 border-t border-slate-600/50 pt-2">
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">
                {translateImpact(hover.dependency.impact, language)} × {translateFrequentie(hover.dependency.frequentie, language)}
              </span>
              <span className="font-medium text-slate-50">
                {hover.risk.breakdown.impactPoints} × {hover.risk.breakdown.frequencyPoints} = {hover.risk.breakdown.baseScore}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">{translateStatus(hover.dependency.status, language)}</span>
              <span className="font-medium text-slate-50">
                {hover.risk.breakdown.statusCorrection > 0 ? '+' : ''}
                {hover.risk.breakdown.statusCorrection}
              </span>
            </div>
            <div className="flex justify-between gap-3 font-medium">
              <span className="text-slate-200">{t('tooltip.finalScore')}</span>
              <span style={{ color: riskStyle(hover.risk.level).onDark }}>
                {hover.risk.score} → {translateRiskLevel(hover.risk.level, language)}
              </span>
            </div>
          </div>
          <div className="mt-2 border-t border-slate-600/50 pt-2 text-slate-300">
            {hover.dependency.mitigatie ? hover.dependency.mitigatie : t('tooltip.noMitigation')}
          </div>
        </FloatingTooltip>
      )}
    </div>
  )
}
