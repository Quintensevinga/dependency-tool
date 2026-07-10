import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { loadState, saveState, resetToEmpty, resetToMockData, generateId } from '../lib/storage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadState())
  const [currentTeam, setCurrentTeam] = useState(() => loadState().teams[0] ?? null)
  const [scope, setScope] = useState('intern')

  const persist = useCallback((next) => {
    setState(next)
    saveState(next)
  }, [])

  const addTeam = useCallback(
    (teamName) => {
      const name = teamName.trim()
      if (!name || state.teams.includes(name)) return
      const next = { ...state, teams: [...state.teams, name] }
      persist(next)
      setCurrentTeam(name)
    },
    [state, persist],
  )

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

  const clearAllData = useCallback(() => {
    const next = resetToEmpty()
    setState(next)
    setCurrentTeam(null)
  }, [])

  const loadMockData = useCallback(() => {
    const next = resetToMockData()
    setState(next)
    setCurrentTeam(next.teams[0] ?? null)
  }, [])

  const importState = useCallback((imported) => {
    const next = {
      teams: Array.isArray(imported.teams) ? imported.teams : [],
      dependencies: Array.isArray(imported.dependencies) ? imported.dependencies : [],
      usingMockData: false,
    }
    saveState(next)
    setState(next)
    setCurrentTeam(next.teams[0] ?? null)
  }, [])

  const value = useMemo(
    () => ({
      teams: state.teams,
      dependencies: state.dependencies,
      usingMockData: state.usingMockData,
      currentTeam,
      setCurrentTeam,
      scope,
      setScope,
      addTeam,
      addDependency,
      updateDependency,
      deleteDependency,
      clearAllData,
      loadMockData,
      importState,
    }),
    [state, currentTeam, scope, addTeam, addDependency, updateDependency, deleteDependency, clearAllData, loadMockData, importState],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
