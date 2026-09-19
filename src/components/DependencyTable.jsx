import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk, MAX_RISK_SCORE } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import {
  translateCategorie,
  translateImpact,
  translateFrequentie,
  translateStatus,
  translateRiskLevel,
  translateWorkflowStap,
  translateEffectOpFlow,
  getCategoryDescription,
} from '../i18n/labels'
import FloatingTooltip from './FloatingTooltip'
import { CategoryIcon } from '../data/categoryIcons'

// Waarop elke sorteerbare kolom vergelijkt. Bewust de getoonde waarde en niet
// het ruwe veld: de gebruiker sorteert wat hij ziet, en een vertaalde categorie
// staat in een andere volgorde dan de interne sleutel. Risico sorteert op de
// score en niet op het niveaulabel, anders komt 'Hoog' voor 'Kritiek'.
const SORTEERWAARDEN = {
  team: ({ dependency }, { teamName }) => teamName(dependency.teamId) ?? '',
  titel: ({ dependency }) => dependency.titel ?? '',
  categorie: ({ dependency }, { language }) => translateCategorie(dependency.categorie, language),
  workflowstap: ({ dependency }, { language }) => translateWorkflowStap(dependency.workflowStap, language) || '',
  effectOpFlow: ({ dependency }, { language }) => translateEffectOpFlow(dependency.effectOpFlow, language) || '',
  impact: ({ risk }) => risk.breakdown.impactPoints,
  frequentie: ({ risk }) => risk.breakdown.frequencyPoints,
  status: ({ dependency }, { language }) => translateStatus(dependency.status, language),
  risico: ({ risk }) => risk.score,
}

// Hoeveel rijen er standaard getoond worden voordat 'toon meer' het overneemt.
// Alleen actief waar de aanroeper erom vraagt (sorteerbaar=true): de bestaande
// lijsten (heatmap-selectie, teampagina) zijn voorgefilterd en dus kort.
const MAX_RIJEN = 100

// Gedeelde dependency-tabel: dezelfde kolommen/hover-tooltip op elke plek
// waar een lijst dependencies getoond wordt (Heatmap-selectie, teampagina,
// de pagina 'Alle dependencies'), zodat zo'n lijst overal in exact dezelfde
// vorm verschijnt. `sorteerbaar` zet klikbare kolomkoppen en de bovengrens
// aan; dat is alleen nodig waar de lijst duizenden rijen lang kan worden.
export default function DependencyTable({ dependencies, onSelect, showTeamColumn = true, emptyLabel, onTeamClick, sorteerbaar = false }) {
  const { teamName } = useAppContext()
  const { t, language } = useLanguage()
  const [hover, setHover] = useState(null)
  const [sortering, setSortering] = useState({ kolom: null, aflopend: false })
  const [alleRijen, setAlleRijen] = useState(false)

  const alleRows = useMemo(() => {
    const basis = dependencies.map((dependency) => ({ dependency, risk: calculateRisk(dependency) }))
    if (!sorteerbaar || !sortering.kolom) return basis
    const waardeVan = SORTEERWAARDEN[sortering.kolom]
    if (!waardeVan) return basis
    // Stabiel sorteren op een vergelijkbare waarde. Tekst vergelijken met
    // localeCompare, zodat 'Éen' niet achter 'Zeta' belandt; getallen (score)
    // gewoon numeriek.
    const richting = sortering.aflopend ? -1 : 1
    return [...basis].sort((a, b) => {
      const va = waardeVan(a, { teamName, language })
      const vb = waardeVan(b, { teamName, language })
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * richting
      return String(va).localeCompare(String(vb), language === 'en' ? 'en' : 'nl') * richting
    })
  }, [dependencies, sorteerbaar, sortering, teamName, language])

  const rows = sorteerbaar && !alleRijen ? alleRows.slice(0, MAX_RIJEN) : alleRows
  const verborgen = alleRows.length - rows.length

  function sorteerOp(kolom) {
    setSortering((vorige) => (vorige.kolom === kolom ? { kolom, aflopend: !vorige.aflopend } : { kolom, aflopend: false }))
  }

  if (alleRows.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-slate-400">{emptyLabel ?? t('tabel.empty')}</div>
  }

  // Kolomkop: klikbaar zodra de tabel sorteerbaar is, anders precies zoals hij
  // altijd was.
  const Kop = ({ kolom, label, className = '' }) => {
    const actief = sortering.kolom === kolom
    if (!sorteerbaar || !SORTEERWAARDEN[kolom]) return <th className={`px-5 py-2.5 font-medium ${className}`}>{label}</th>
    return (
      <th className={`px-5 py-2.5 font-medium ${className}`} aria-sort={actief ? (sortering.aflopend ? 'descending' : 'ascending') : 'none'}>
        <button type="button" onClick={() => sorteerOp(kolom)} className={`inline-flex items-center gap-1 uppercase tracking-wide ${actief ? 'text-[#2a5f8a]' : 'hover:text-slate-600'}`}>
          {label}
          <span aria-hidden="true" className={actief ? '' : 'text-slate-300'}>
            {actief ? (sortering.aflopend ? '▾' : '▴') : '▴'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            {showTeamColumn && <Kop kolom="team" label={t('tabel.col.team')} />}
            <Kop kolom="titel" label={t('tabel.col.titel')} />
            <Kop kolom="categorie" label={t('tabel.col.categorie')} />
            <Kop kolom="workflowstap" label={t('tabel.col.workflowstap')} />
            <Kop kolom="effectOpFlow" label={t('tabel.col.effectOpFlow')} />
            {/* Impact en frequentie zijn de twee ingrediënten van de
                risicoscore die rechts al vastgepind staat, en de hover-tooltip
                toont de hele berekening. Op smallere schermen duwden ze juist
                de kolommen met eigen informatie (workflowstap, effect, status)
                buiten beeld; daar wegen ze het minst. */}
            <Kop kolom="impact" label={t('tabel.col.impact')} className="hidden 2xl:table-cell" />
            <Kop kolom="frequentie" label={t('tabel.col.frequentie')} className="hidden 2xl:table-cell" />
            <Kop kolom="status" label={t('tabel.col.status')} />
            <Kop kolom="risico" label={t('tabel.col.risico')} className="sticky right-0 border-l border-slate-200 bg-white" />
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
                {showTeamColumn && (
                  <td className="px-5 py-3 text-slate-500">
                    {onTeamClick ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onTeamClick(dependency.teamId)
                        }}
                        className="rounded text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-[#2a5f8a] hover:decoration-[#2a5f8a]"
                      >
                        {teamName(dependency.teamId)}
                      </button>
                    ) : (
                      teamName(dependency.teamId)
                    )}
                  </td>
                )}
                <td className="px-5 py-3 font-medium text-slate-800">{dependency.titel}</td>
                <td className="px-5 py-3 text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <CategoryIcon categorie={dependency.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {translateCategorie(dependency.categorie, language)}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{translateWorkflowStap(dependency.workflowStap, language) || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{translateEffectOpFlow(dependency.effectOpFlow, language) || '—'}</td>
                <td className="hidden px-5 py-3 capitalize text-slate-500 2xl:table-cell">{translateImpact(dependency.impact, language)}</td>
                <td className="hidden px-5 py-3 capitalize text-slate-500 2xl:table-cell">{translateFrequentie(dependency.frequentie, language)}</td>
                <td className="px-5 py-3 text-slate-500">{translateStatus(dependency.status, language)}</td>
                <td className="sticky right-0 border-l border-slate-200 bg-white px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.round((risk.score / MAX_RISK_SCORE) * 100))}%`, backgroundColor: style.hex }}
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

      {sorteerbaar && (verborgen > 0 || alleRijen) && (
        <div className="border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={() => setAlleRijen((v) => !v)} className="text-xs font-medium text-[#2a5f8a] hover:underline">
            {alleRijen ? t('lijst.toonMinder') : t('lijst.toonMeer', { count: verborgen })}
          </button>
          <span className="ml-2 text-xs text-slate-400">{t('tabel.rijenGetoond', { count: rows.length, total: alleRows.length })}</span>
        </div>
      )}

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
          {(hover.dependency.workflowStap || hover.dependency.effectOpFlow) && (
            <div className="mb-2 space-y-0.5 text-slate-300">
              {hover.dependency.workflowStap && <div>{t('detail.workflowStap')}: {translateWorkflowStap(hover.dependency.workflowStap, language)}</div>}
              {hover.dependency.effectOpFlow && <div>{t('detail.effectOpFlow')}: {translateEffectOpFlow(hover.dependency.effectOpFlow, language)}</div>}
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
