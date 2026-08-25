import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'
import ScopeToggle from './ScopeToggle'
import DependencyTable from './DependencyTable'
import TeamFilterPanel from './TeamFilterPanel'
import { translateWorkflowStap, translateEffectOpFlow } from '../i18n/labels'
import { RISK_LEVELS, WORKFLOW_STAP_LEVELS, EFFECT_OP_FLOW_LEVELS } from '../data/constants'

export default function MatrixView({ onSelect, adminSections }) {
  const { dependencies, teams, teamName, scope, setScope } = useAppContext()
  const { t, language } = useLanguage()
  const [sortBy, setSortBy] = useState('risk_desc')
  // Matrix is een organisatiebreed overzicht en start dus altijd bij alle
  // teams — teamnavigatie (sidebar) en view-filtering (hier) zijn losgekoppeld.
  const [selectedTeams, setSelectedTeams] = useState(() => teams.map((tm) => tm.id))
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  const [selectedWorkflowStap, setSelectedWorkflowStap] = useState([...WORKFLOW_STAP_LEVELS, ''])
  const [selectedEffectOpFlow, setSelectedEffectOpFlow] = useState([...EFFECT_OP_FLOW_LEVELS, ''])

  function toggleTeam(id) {
    setSelectedTeams((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleRiskLevel(level) {
    setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]))
  }
  function toggleWorkflowStap(v) {
    setSelectedWorkflowStap((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  function toggleEffectOpFlow(v) {
    setSelectedEffectOpFlow((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const SORT_OPTIONS = [
    { id: 'risk_desc', label: t('matrix.sort.riskDesc') },
    { id: 'risk_asc', label: t('matrix.sort.riskAsc') },
    { id: 'updated_desc', label: t('matrix.sort.updated') },
  ]

  const rows = useMemo(() => {
    const filtered = dependencies.filter((d) => {
      if (!selectedTeams.includes(d.teamId)) return false
      if (scope !== 'alle' && d.scope !== scope) return false
      if (!selectedWorkflowStap.includes(d.workflowStap ?? '')) return false
      if (!selectedEffectOpFlow.includes(d.effectOpFlow ?? '')) return false
      return true
    })
    const withRisk = filtered
      .map((d) => ({ dependency: d, risk: calculateRisk(d) }))
      .filter(({ risk }) => selectedRiskLevels.includes(risk.level))

    withRisk.sort((a, b) => {
      if (sortBy === 'risk_asc') return a.risk.score - b.risk.score
      if (sortBy === 'updated_desc') return b.dependency.laatst_bijgewerkt.localeCompare(a.dependency.laatst_bijgewerkt)
      return b.risk.score - a.risk.score
    })

    return withRisk
  }, [
    dependencies,
    selectedTeams,
    scope,
    sortBy,
    selectedRiskLevels,
    selectedWorkflowStap,
    selectedEffectOpFlow,
  ])

  const teamLabel =
    selectedTeams.length === 1
      ? teamName(selectedTeams[0])
      : selectedTeams.length === 0
        ? t('matrix.count')
        : t('matrix.multipleTeams', { count: selectedTeams.length })
  const showTeamColumn = selectedTeams.length !== 1

  return (
    <div className="flex items-start gap-4">
      {adminSections.tabel && (
        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">
              {teamLabel}
              <span className="ml-2 font-normal text-slate-400">({rows.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <ScopeToggle scope={scope} onChange={setScope} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label={t('matrix.sort.label')}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DependencyTable dependencies={rows.map(({ dependency }) => dependency)} showTeamColumn={showTeamColumn} onSelect={onSelect} />
        </div>
      )}

      {adminSections.filters && (
        <TeamFilterPanel
        teams={teams}
        selected={selectedTeams}
        onToggle={toggleTeam}
        onSelectAll={() => setSelectedTeams(teams.map((tm) => tm.id))}
        onSelectNone={() => setSelectedTeams([])}
        riskLevels={selectedRiskLevels}
        onToggleRisk={toggleRiskLevel}
        onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
        onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
        workflowStap={{
          options: [...WORKFLOW_STAP_LEVELS, ''],
          selected: selectedWorkflowStap,
          onToggle: toggleWorkflowStap,
          onSelectAll: () => setSelectedWorkflowStap([...WORKFLOW_STAP_LEVELS, '']),
          onSelectNone: () => setSelectedWorkflowStap([]),
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateWorkflowStap(v, language)),
        }}
        effectOpFlow={{
          options: [...EFFECT_OP_FLOW_LEVELS, ''],
          selected: selectedEffectOpFlow,
          onToggle: toggleEffectOpFlow,
          onSelectAll: () => setSelectedEffectOpFlow([...EFFECT_OP_FLOW_LEVELS, '']),
          onSelectNone: () => setSelectedEffectOpFlow([]),
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateEffectOpFlow(v, language)),
        }}
      />
      )}
    </div>
  )
}
