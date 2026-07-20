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
} from '../lib/storage'

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

  const teamName = useCallback(
    (id) => state.teams.find((t) => t.id === id)?.naam ?? (id ? 'Onbekend team' : '—'),
    [state.teams],
  )
  const functieName = useCallback(
    (id) => state.functies.find((f) => f.id === id)?.naam ?? id ?? '—',
    [state.functies],
  )
  const functieNames = useCallback(
    (ids) => (Array.isArray(ids) && ids.length > 0 ? ids.map(functieName).join(', ') : ''),
    [functieName],
  )

  const activeTeams = useMemo(() => state.teams.filter((t) => t.actief), [state.teams])
  const activeFuncties = useMemo(() => state.functies.filter((f) => f.actief), [state.functies])

  // --- teams ---

  const addTeam = useCallback(
    (naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return null
      const existingIds = new Set(state.teams.map((t) => t.id))
      const id = uniqueSlug(trimmed, existingIds)
      const today = new Date().toISOString().slice(0, 10)
      const team = { id, naam: trimmed, actief: true, createdAt: today, updatedAt: today }
      const next = { ...state, teams: [...state.teams, team] }
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
      const next = { ...state, teams: state.teams.filter((t) => t.id !== id) }
      persist(next)
      if (currentTeamId === id) setCurrentTeamId(firstActiveTeamId(next.teams))
      return true
    },
    [state, persist, currentTeamId],
  )

  // --- functies/rollen ---

  const addFunctie = useCallback(
    (naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return null
      const existingIds = new Set(state.functies.map((f) => f.id))
      const id = uniqueSlug(trimmed, existingIds)
      const next = { ...state, functies: [...state.functies, { id, naam: trimmed, actief: true }] }
      persist(next)
      return id
    },
    [state, persist],
  )

  const renameFunctie = useCallback(
    (id, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      const next = {
        ...state,
        functies: state.functies.map((f) => (f.id === id ? { ...f, naam: trimmed } : f)),
      }
      persist(next)
    },
    [state, persist],
  )

  const archiveFunctie = useCallback(
    (id) => {
      const next = { ...state, functies: state.functies.map((f) => (f.id === id ? { ...f, actief: false } : f)) }
      persist(next)
    },
    [state, persist],
  )

  const unarchiveFunctie = useCallback(
    (id) => {
      const next = { ...state, functies: state.functies.map((f) => (f.id === id ? { ...f, actief: true } : f)) }
      persist(next)
    },
    [state, persist],
  )

  // Retourneert true bij succes, false als de functie nog bij een
  // dependency als eigenaar staat.
  const deleteFunctie = useCallback(
    (id) => {
      const inUse = state.dependencies.some((d) => Array.isArray(d.eigenaarFunctieIds) && d.eigenaarFunctieIds.includes(id))
      if (inUse) return false
      const next = { ...state, functies: state.functies.filter((f) => f.id !== id) }
      persist(next)
      return true
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

  const value = useMemo(
    () => ({
      schemaVersion: state.schemaVersion,
      teams: state.teams,
      activeTeams,
      functies: state.functies,
      activeFuncties,
      dependencies: state.dependencies,
      usingMockData: state.usingMockData,
      currentTeamId,
      setCurrentTeamId,
      scope,
      setScope,
      teamName,
      functieName,
      functieNames,
      addTeam,
      renameTeam,
      archiveTeam,
      unarchiveTeam,
      deleteTeam,
      addFunctie,
      renameFunctie,
      archiveFunctie,
      unarchiveFunctie,
      deleteFunctie,
      addDependency,
      updateDependency,
      deleteDependency,
      clearAllData,
      loadMockData,
      importState,
    }),
    [
      state,
      activeTeams,
      activeFuncties,
      currentTeamId,
      scope,
      teamName,
      functieName,
      functieNames,
      addTeam,
      renameTeam,
      archiveTeam,
      unarchiveTeam,
      deleteTeam,
      addFunctie,
      renameFunctie,
      archiveFunctie,
      unarchiveFunctie,
      deleteFunctie,
      addDependency,
      updateDependency,
      deleteDependency,
      clearAllData,
      loadMockData,
      importState,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
