import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  loadState,
  saveState,
  resetToEmpty,
  resetToMockData,
  generateId,
  migrateState,
  validateImportShape,
  uniqueSlug,
  emptyTeamWorkflow,
  emptyApplicatieflow,
  deepClone,
  MAX_SNAPSHOTS_PER_TEAM,
} from '../lib/storage'
import { buildTeamLabels } from '../lib/teamLabels'

const AppContext = createContext(null)

function firstActiveTeamId(teams) {
  return teams.find((t) => t.actief)?.id ?? null
}

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadState())
  const [currentTeamId, setCurrentTeamId] = useState(() => firstActiveTeamId(loadState().teams))
  const [scope, setScope] = useState('intern')

  const persist = useCallback((next) => {
    setState(next)
    saveState(next)
  }, [])

  // --- lookup-helpers (naam <-> id) ---

  // Weergavenamen: gelijk aan team.naam, behalve wanneer twee teams dezelfde
  // naam dragen — dan krijgen die een volgnummer zodat ze in lijsten en
  // dropdowns uit elkaar te houden zijn.
  const teamLabels = useMemo(() => buildTeamLabels(state.teams), [state.teams])
  const teamName = useCallback(
    (id) => teamLabels[id] ?? (id ? 'Onbekend team' : '—'),
    [teamLabels],
  )
  const activeTeams = useMemo(() => state.teams.filter((t) => t.actief), [state.teams])

  // --- teams ---

  const addTeam = useCallback(
    (naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return null
      const existingIds = new Set(state.teams.map((t) => t.id))
      const id = uniqueSlug(trimmed, existingIds)
      const today = new Date().toISOString().slice(0, 10)
      const team = { id, naam: trimmed, actief: true, createdAt: today, updatedAt: today }
      const next = {
        ...state,
        teams: [...state.teams, team],
        teamWorkflows: { ...state.teamWorkflows, [id]: emptyTeamWorkflow() },
        teamSnapshots: { ...state.teamSnapshots, [id]: [] },
      }
      persist(next)
      setCurrentTeamId(id)
      return id
    },
    [state, persist],
  )

  const renameTeam = useCallback(
    (id, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      const today = new Date().toISOString().slice(0, 10)
      const next = {
        ...state,
        teams: state.teams.map((t) => (t.id === id ? { ...t, naam: trimmed, updatedAt: today } : t)),
      }
      persist(next)
    },
    [state, persist],
  )

  const archiveTeam = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      const next = {
        ...state,
        teams: state.teams.map((t) => (t.id === id ? { ...t, actief: false, updatedAt: today } : t)),
      }
      persist(next)
      if (currentTeamId === id) {
        setCurrentTeamId(firstActiveTeamId(next.teams.filter((t) => t.id !== id)))
      }
    },
    [state, persist, currentTeamId],
  )

  const unarchiveTeam = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      const next = {
        ...state,
        teams: state.teams.map((t) => (t.id === id ? { ...t, actief: true, updatedAt: today } : t)),
      }
      persist(next)
    },
    [state, persist],
  )

  // Retourneert true bij succes, false als het team nog dependencies heeft
  // (dan moet de UI archiveren aanbieden i.p.v. verwijderen).
  const deleteTeam = useCallback(
    (id) => {
      const inUse = state.dependencies.some((d) => d.teamId === id)
      if (inUse) return false
      const teamWorkflows = { ...state.teamWorkflows }
      delete teamWorkflows[id]
      const teamSnapshots = { ...state.teamSnapshots }
      delete teamSnapshots[id]
      const next = { ...state, teams: state.teams.filter((t) => t.id !== id), teamWorkflows, teamSnapshots }
      persist(next)
      if (currentTeamId === id) setCurrentTeamId(firstActiveTeamId(next.teams))
      return true
    },
    [state, persist, currentTeamId],
  )

  // --- teamworkflow (teampagina: workflowbord, applicatieflow, momentopnamen) ---

  const updateTeamWorkflow = useCallback(
    (teamId, patch) => {
      const current = state.teamWorkflows[teamId] ?? emptyTeamWorkflow()
      const next = { ...state, teamWorkflows: { ...state.teamWorkflows, [teamId]: { ...current, ...patch } } }
      persist(next)
    },
    [state, persist],
  )

  // Verwijdert een applicatie én alle verwijzingen ernaar. Bewust één actie:
  // dependencies en teamWorkflows zitten in dezelfde state-boom, en twee losse
  // updates in hetzelfde event zouden allebei van dezelfde momentopname
  // uitgaan — de laatste overschrijft dan de eerste.
  // Dependencies worden niet verwijderd, alleen ontlabeld: zonder deze
  // opruiming bleven ze verwijzen naar een niet-bestaande applicatie en
  // verdwenen ze volledig van de teampagina.
  const removeApplicationEverywhere = useCallback(
    (teamId, appId) => {
      const workflow = state.teamWorkflows[teamId]
      if (!workflow) return
      const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
      const today = new Date().toISOString().slice(0, 10)
      const next = {
        ...state,
        dependencies: state.dependencies.map((d) =>
          (d.applicatieIds ?? []).includes(appId)
            ? { ...d, applicatieIds: d.applicatieIds.filter((a) => a !== appId), laatst_bijgewerkt: today }
            : d,
        ),
        teamWorkflows: {
          ...state.teamWorkflows,
          [teamId]: {
            ...workflow,
            applications: workflow.applications.filter((a) => a.id !== appId),
            applicatieflow: {
              ...applicatieflow,
              connecties: (applicatieflow.connecties ?? []).filter((c) => c.van !== appId && c.naar !== appId),
            },
            inputs: workflow.inputs.map((i) => (i.applicatieId === appId ? { ...i, applicatieId: '' } : i)),
            outputs: workflow.outputs.map((o) => (o.applicatieId === appId ? { ...o, applicatieId: '' } : o)),
          },
        },
        usingMockData: false,
      }
      persist(next)
    },
    [state, persist],
  )

  // Momentopnamen: een losstaande, volledige kopie van teamWorkflows[teamId]
  // op een moment in de tijd. Bewust een deep clone zodat latere wijzigingen
  // aan de live workflow de bewaarde momentopname nooit aliassen. Maximaal
  // MAX_SNAPSHOTS_PER_TEAM per team — de oudste rolt er automatisch uit.
  const saveSnapshot = useCallback(
    (teamId, naam) => {
      const workflow = state.teamWorkflows[teamId] ?? emptyTeamWorkflow()
      const existing = state.teamSnapshots[teamId] ?? []
      const snapshot = {
        id: generateId(),
        naam: naam?.trim() || `Momentopname ${existing.length + 1}`,
        timestamp: new Date().toISOString(),
        data: deepClone(workflow),
      }
      const next = [...existing, snapshot].slice(-MAX_SNAPSHOTS_PER_TEAM)
      persist({ ...state, teamSnapshots: { ...state.teamSnapshots, [teamId]: next } })
    },
    [state, persist],
  )

  const renameSnapshot = useCallback(
    (teamId, snapshotId, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      const existing = state.teamSnapshots[teamId] ?? []
      const next = existing.map((s) => (s.id === snapshotId ? { ...s, naam: trimmed } : s))
      persist({ ...state, teamSnapshots: { ...state.teamSnapshots, [teamId]: next } })
    },
    [state, persist],
  )

  const restoreSnapshot = useCallback(
    (teamId, snapshotId) => {
      const snapshot = (state.teamSnapshots[teamId] ?? []).find((s) => s.id === snapshotId)
      if (!snapshot) return
      persist({ ...state, teamWorkflows: { ...state.teamWorkflows, [teamId]: deepClone(snapshot.data) } })
    },
    [state, persist],
  )

  const deleteSnapshot = useCallback(
    (teamId, snapshotId) => {
      const next = (state.teamSnapshots[teamId] ?? []).filter((s) => s.id !== snapshotId)
      persist({ ...state, teamSnapshots: { ...state.teamSnapshots, [teamId]: next } })
    },
    [state, persist],
  )

  // --- dependencies ---

  const addDependency = useCallback(
    (dependency) => {
      const record = { ...dependency, id: generateId(), laatst_bijgewerkt: new Date().toISOString().slice(0, 10) }
      const next = { ...state, dependencies: [...state.dependencies, record], usingMockData: false }
      persist(next)
      return record
    },
    [state, persist],
  )

  // Voor 'N dependencies tegelijk aanmaken' (bv. een ketenafhankelijkheid
  // voor meerdere teams): meerdere addDependency-aanroepen ná elkaar zouden
  // allemaal vanuit dezelfde (stale) state-snapshot bouwen — élke aanroep
  // overschrijft dan de vorige in plaats van erop voort te bouwen, en alleen
  // de laatste blijft over. Bouw de records daarom in één keer en persist ze
  // in één state-update.
  const addDependencies = useCallback(
    (deps) => {
      const now = new Date().toISOString().slice(0, 10)
      const records = deps.map((dependency) => ({ ...dependency, id: generateId(), laatst_bijgewerkt: now }))
      const next = { ...state, dependencies: [...state.dependencies, ...records], usingMockData: false }
      persist(next)
      return records
    },
    [state, persist],
  )

  const updateDependency = useCallback(
    (id, updates) => {
      const next = {
        ...state,
        dependencies: state.dependencies.map((d) =>
          d.id === id ? { ...d, ...updates, laatst_bijgewerkt: new Date().toISOString().slice(0, 10) } : d,
        ),
        usingMockData: false,
      }
      persist(next)
    },
    [state, persist],
  )

  const deleteDependency = useCallback(
    (id) => {
      const next = { ...state, dependencies: state.dependencies.filter((d) => d.id !== id) }
      persist(next)
    },
    [state, persist],
  )

  // --- data-beheer ---

  const clearAllData = useCallback(() => {
    const next = resetToEmpty()
    setState(next)
    setCurrentTeamId(null)
  }, [])

  const loadMockData = useCallback(() => {
    const next = resetToMockData()
    setState(next)
    setCurrentTeamId(firstActiveTeamId(next.teams))
  }, [])

  // Gooit een fout (met duidelijke NL-boodschap) als het bestand structureel
  // ongeldig is; de aanroeper (SettingsPanel) vangt dit af en toont het.
  const importState = useCallback((imported) => {
    validateImportShape(imported)
    const next = migrateState(imported)
    saveState(next)
    setState(next)
    setCurrentTeamId(firstActiveTeamId(next.teams))
  }, [])

  // Admin: pagina's/secties tonen of verbergen. Puur UI, geen datawijziging —
  // zie DEFAULT_ADMIN_SETTINGS in lib/storage.js voor de volledige structuur.
  const updateAdminSettings = useCallback(
    (next) => {
      persist({ ...state, adminSettings: next })
    },
    [state, persist],
  )

  const value = useMemo(
    () => ({
      schemaVersion: state.schemaVersion,
      teams: state.teams,
      activeTeams,
      dependencies: state.dependencies,
      teamWorkflows: state.teamWorkflows,
      teamSnapshots: state.teamSnapshots,
      usingMockData: state.usingMockData,
      adminSettings: state.adminSettings,
      updateAdminSettings,
      currentTeamId,
      setCurrentTeamId,
      scope,
      setScope,
      teamName,
      teamLabels,
      addTeam,
      renameTeam,
      archiveTeam,
      unarchiveTeam,
      deleteTeam,
      addDependency,
      addDependencies,
      updateDependency,
      deleteDependency,
      clearAllData,
      loadMockData,
      importState,
      updateTeamWorkflow,
      removeApplicationEverywhere,
      saveSnapshot,
      renameSnapshot,
      restoreSnapshot,
      deleteSnapshot,
    }),
    [
      state,
      activeTeams,
      currentTeamId,
      scope,
      teamName,
      teamLabels,
      addTeam,
      renameTeam,
      archiveTeam,
      unarchiveTeam,
      deleteTeam,
      addDependency,
      addDependencies,
      updateDependency,
      deleteDependency,
      clearAllData,
      loadMockData,
      importState,
      updateTeamWorkflow,
      removeApplicationEverywhere,
      saveSnapshot,
      renameSnapshot,
      restoreSnapshot,
      deleteSnapshot,
      updateAdminSettings,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
