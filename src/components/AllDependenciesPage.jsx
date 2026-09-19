import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS, WORKFLOW_STAP_LEVELS } from '../data/constants'
import { calculateRisk } from '../lib/risk'
import { translateCategorie, translateWorkflowStap } from '../i18n/labels'
import DependencyTable from './DependencyTable'
import TeamFilterPanel from './TeamFilterPanel'
import { useTeamSelection } from '../lib/useTeamSelection'

// Eén pagina waar je door álle dependencies van álle teams tegelijk kunt
// zoeken. De drie zoekvelden die de app al had kijken elk maar naar een deel:
// binnen de externe partijen, binnen één team, of binnen de applicaties van
// één team. Wie een dependency zocht en niet wist bij welk team hij hoorde,
// moest team voor team langs.
//
// De tabel eronder is de bestaande gedeelde DependencyTable (dezelfde als de
// heatmap gebruikt), hier met sorteerbare koppen en een bovengrens aan.
export default function AllDependenciesPage({ onSelect, onNavigateToTeam, adminSections }) {
  const { dependencies, teams, teamName } = useAppContext()
  const { t, language } = useLanguage()
  const [zoek, setZoek] = useState('')
  const { selectedTeamIds, toggleTeam, selectAll: selectAllTeams, selectNone: selectNoTeams } = useTeamSelection(teams)
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  // Ook de lege workflowstap is een geldige waarde (een dependency hoeft er
  // geen te hebben); zonder '' in de lijst zou 'alles aan' die records stil
  // wegfilteren. Zelfde aanpak als in de heatmap.
  const [selectedWorkflowStap, setSelectedWorkflowStap] = useState([...WORKFLOW_STAP_LEVELS, ''])
  const [scope, setScope] = useState('alle')

  const gefilterd = useMemo(() => {
    const naald = zoek.trim().toLowerCase()
    return dependencies.filter((d) => {
      if (!selectedTeamIds.includes(d.teamId)) return false
      if (!selectedRiskLevels.includes(calculateRisk(d).level)) return false
      const stap = WORKFLOW_STAP_LEVELS.includes(d.workflowStap) ? d.workflowStap : ''
      if (!selectedWorkflowStap.includes(stap)) return false
      if (scope !== 'alle' && d.scope !== scope) return false
      if (!naald) return true
      // Zoeken over wat er op het scherm staat: titel, toelichting, teamnaam,
      // categorie en de betrokken partij. De categorie in de getoonde taal,
      // niet de interne sleutel — anders levert 'kennis' niets op zodra je in
      // het Engels kijkt.
      const velden = [
        d.titel,
        d.toelichting,
        teamName(d.teamId),
        translateCategorie(d.categorie, language),
        d.geraakte_team_extern,
      ]
      return velden.some((veld) => typeof veld === 'string' && veld.toLowerCase().includes(naald))
    })
  }, [dependencies, zoek, selectedTeamIds, selectedRiskLevels, selectedWorkflowStap, scope, teamName, language])

  const scopeKnop = (waarde, label) => (
    <button
      key={waarde}
      type="button"
      onClick={() => setScope(waarde)}
      aria-pressed={scope === waarde}
      className={`rounded px-2.5 py-1 text-xs transition-colors ${scope === waarde ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">{t('dependencies.title')}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('dependencies.intro')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder={t('dependencies.searchPlaceholder')}
              aria-label={t('dependencies.searchPlaceholder')}
              className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label={t('form.scope')}>
              {scopeKnop('alle', t('scope.alle'))}
              {scopeKnop('intern', t('scope.intern'))}
              {scopeKnop('extern', t('scope.extern'))}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('dependencies.count', { count: gefilterd.length, total: dependencies.length })}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DependencyTable
            dependencies={gefilterd}
            onSelect={onSelect}
            onTeamClick={onNavigateToTeam}
            sorteerbaar
            emptyLabel={t('dependencies.empty')}
          />
        </div>
      </div>

      {adminSections?.filters !== false && (
        <TeamFilterPanel
          teams={teams}
          selected={selectedTeamIds}
          onToggle={toggleTeam}
          onSelectAll={selectAllTeams}
          onSelectNone={selectNoTeams}
          riskLevels={selectedRiskLevels}
          onToggleRisk={(level) =>
            setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]))
          }
          onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
          onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
          workflowStap={{
            options: [...WORKFLOW_STAP_LEVELS, ''],
            selected: selectedWorkflowStap,
            onToggle: (stap) =>
              setSelectedWorkflowStap((prev) => (prev.includes(stap) ? prev.filter((x) => x !== stap) : [...prev, stap])),
            onSelectAll: () => setSelectedWorkflowStap([...WORKFLOW_STAP_LEVELS, '']),
            onSelectNone: () => setSelectedWorkflowStap([]),
            renderLabel: (v) => (v === '' ? t('filter.notSet') : translateWorkflowStap(v, language)),
          }}
        />
      )}
    </div>
  )
}
