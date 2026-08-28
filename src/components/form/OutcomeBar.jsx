import { calculateRisk } from '../../lib/risk'
import { berekenFlowverlies, berekenUrgentie } from '../../lib/analysis'
import { riskStyle } from '../../lib/riskStyles'
import { translateRiskLevel, translateImpact, translateFrequentie, translateStatus } from '../../i18n/labels'

// Toont tijdens het invullen wat de drie uitkomsten worden. Twee redenen:
// het maakt van dit blok iets dat resultaat oplevert i.p.v. nog meer
// invulwerk, en de invuller kan zijn eigen inschatting toetsen ("Kritiek?
// zo erg is het niet") — dat verbetert de datakwaliteit meer dan welke
// helptekst ook.
//
// De opbouw staat er letterlijk onder: een score die je niet kunt navertellen
// is een score die niemand vertrouwt.
export default function OutcomeBar({ dependency, t, language }) {
  const risico = calculateRisk(dependency)
  const flow = berekenFlowverlies(dependency)
  const urgentie = berekenUrgentie(dependency)

  const heeftBasis = dependency.impact && dependency.frequentie && dependency.status
  if (!heeftBasis) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('form.uitkomstTitel')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('form.uitkomstOnvolledig')}</p>
      </div>
    )
  }

  const { breakdown } = risico
  const tekens = risico.breakdown.statusCorrection < 0 ? '−' : '+'
  const opbouw = t('form.uitkomstOpbouw', {
    impact: translateImpact(dependency.impact, language),
    impactPunten: breakdown.impactPoints,
    frequentie: translateFrequentie(dependency.frequentie, language),
    frequentiePunten: breakdown.frequencyPoints,
    teken: tekens,
    statusPunten: Math.abs(breakdown.statusCorrection),
    status: translateStatus(dependency.status, language),
    score: risico.score,
  })

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('form.uitkomstTitel')}</p>
      <div className="flex flex-wrap gap-2">
        <Pil label={t('matrix.col.risico')} waarde={translateRiskLevel(risico.level, language)} niveau={risico.level} />
        <Pil
          label={t('form.flowverlies')}
          waarde={flow ? translateRiskLevel(flow.level, language) : t('form.nogNietIngevuld')}
          niveau={flow?.level}
        />
        <Pil
          label={t('form.urgentie')}
          waarde={urgentie ? translateRiskLevel(urgentie.level, language) : t('form.nogNietIngevuld')}
          niveau={urgentie?.level}
        />
      </div>
      <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] tabular-nums text-slate-400">{opbouw}</p>
    </div>
  )
}

function Pil({ label, waarde, niveau }) {
  const style = niveau ? riskStyle(niveau) : null
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[13px]">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="font-semibold" style={style ? { color: style.hex } : { color: '#94a3b8' }}>
        {waarde}
      </span>
    </span>
  )
}
