import { useRef } from 'react'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { useModalA11y } from '../lib/a11y'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  translateRiskLevel,
  translateScope,
  translateWorkflowStap,
  translateEffectOpFlow,
  translateOplossingsniveau,
  getCategoryDescription,
} from '../i18n/labels'
import { CategoryIcon } from '../data/categoryIcons'

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div className="mt-0.5 text-sm text-stone-700">{value}</div>
    </div>
  )
}

export default function DependencyDetail({ dependency, onClose, onEdit, onDelete }) {
  const { t, language } = useLanguage()
  const { teamName, functieNames } = useAppContext()
  const panelRef = useRef(null)
  useModalA11y({ open: Boolean(dependency), onClose, containerRef: panelRef })

  if (!dependency) return null
  const risk = calculateRisk(dependency)
  const style = riskStyle(risk.level)
  const riskLevel = translateRiskLevel(risk.level, language)
  const eigenaar = functieNames(dependency.eigenaarFunctieIds)
  const showLegacyRol = eigenaar === '' && dependency.rol_betrokkene

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-stone-900/30" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependency-detail-title"
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <div className="text-xs font-medium text-stone-400">{teamName(dependency.teamId)}</div>
            <h3 id="dependency-detail-title" className="mt-0.5 text-base font-semibold text-stone-900">
              {dependency.titel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.close')}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-1 text-xs font-medium ${style.badge}`}>{riskLevel}</span>
            <span className="text-xs capitalize text-stone-400">{translateScope(dependency.scope, language)} ·</span>
            <span className="group relative flex items-center gap-1 text-xs text-stone-400 underline decoration-dotted underline-offset-2">
              <CategoryIcon categorie={dependency.categorie} className="h-3 w-3 shrink-0" />
              <span className="cursor-help">{translateCategorie(dependency.categorie, language)}</span>
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-64 rounded-lg bg-[#241f1a] px-3 py-2.5 text-xs normal-case leading-relaxed text-stone-100 shadow-xl group-hover:block">
                {getCategoryDescription(dependency.categorie, dependency.scope, language)}
              </div>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {dependency.workflowStap && (
              <span className="rounded bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                {t('detail.workflowStap')}: {translateWorkflowStap(dependency.workflowStap, language)}
              </span>
            )}
            {dependency.effectOpFlow && (
              <span className="rounded bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                {t('detail.effectOpFlow')}: {translateEffectOpFlow(dependency.effectOpFlow, language)}
              </span>
            )}
            {dependency.oplossingsniveau && (
              <span className="rounded bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                {t('detail.oplossingsniveau')}: {translateOplossingsniveau(dependency.oplossingsniveau, language)}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{t('detail.riskCalc')}</div>
            <div className="mt-1.5 space-y-1 text-xs text-stone-600">
              <div>
                {t('detail.baseFormula', {
                  impact: translateImpact(dependency.impact, language),
                  frequentie: translateFrequentie(dependency.frequentie, language),
                  impactPoints: risk.breakdown.impactPoints,
                  frequencyPoints: risk.breakdown.frequencyPoints,
                })}{' '}
                <span className="font-medium">{risk.breakdown.baseScore}</span>
              </div>
              <div>
                {t('detail.statusCorrection', { status: translateStatus(dependency.status, language) })}{' '}
                <span className="font-medium">
                  {risk.breakdown.statusCorrection > 0 ? '+' : ''}
                  {risk.breakdown.statusCorrection}
                </span>
              </div>
              <div className="pt-1 font-medium text-stone-800">
                {t('detail.finalScore', { score: risk.score, level: riskLevel })}
              </div>
            </div>
          </div>

          <Field label={t('detail.toelichting')} value={dependency.toelichting} />
          <Field label={t('detail.eigenaar')} value={eigenaar} />
          {showLegacyRol && <Field label={t('detail.legacyRol')} value={dependency.rol_betrokkene} />}
          {dependency.scope === 'extern' && (
            <Field label={t('detail.geraaktTeam')} value={dependency.geraakte_team_extern} />
          )}
          <Field label={t('detail.actieAfspraak')} value={dependency.actieAfspraak} />
          <Field label={t('detail.mitigatie')} value={dependency.mitigatie} />
          <Field label={t('detail.updated')} value={dependency.laatst_bijgewerkt} />
        </div>

        <div className="flex gap-2 border-t border-stone-200 px-5 py-3">
          <button
            type="button"
            onClick={() => onEdit(dependency)}
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            {t('detail.edit')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(dependency)}
            className="rounded-md border border-[#6e2a1e]/30 px-3 py-2 text-sm font-medium text-[#6e2a1e] hover:bg-[#6e2a1e]/5"
          >
            {t('detail.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
