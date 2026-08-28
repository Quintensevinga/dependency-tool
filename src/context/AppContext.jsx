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

// Zoekt een bestaande dependency op een ánder team die dezelfde categorie
// deelt én een overlappende partij- of applicatiereferentie heeft — het
// signaal dat twee teams onafhankelijk van elkaar (waarschijnlijk) dezelfde
// onderliggende afhankelijkheid hebben vastgelegd.
function findPotentialDuplicate(newDep, existingDependencies) {
  return existingDependencies.find((d) => {
    if (d.teamId === newDep.teamId || d.categorie !== newDep.categorie) return false
    const samePartij = newDep.geraaktPartijId && d.geraaktPartijId === newDep.geraaktPartijId
    const overlapApp = (newDep.applicatieIds ?? []).some((id) => (d.applicatieIds ?? []).includes(id))
    return samePartij || overlapApp
  })
}

// Bouwt een onafhankelijke kopie van een dependency voor een ander team —
// zelfde patroon als de bestaande 'meerdere teams'-aanmaakflow in
// DependencyForm/TeamPage (elk team krijgt zijn eigen record, geen gedeeld
// record met een team-lijst erop). dedupGroupId koppelt de betrokken records
// achteraf herkenbaar aan elkaar.
function buildCrossTeamCopy(dependency, teamId, dedupGroupId, today) {
  const { id: _id, extraTeamIds: _extra, geaccepteerd: _geaccepteerd, ...rest } = dependency
  return { ...rest, id: generateId(), teamId, dedupGroupId, geaccepteerd: false, laatst_bijgewerkt: today, aangemaakt_op: today }
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

  // --- externe partijen (centrale, admin-beheerde lijst) ---

  // Retourneert direct het nieuwe id (niet pas na een re-render), zodat een
  // aanroeper (bv. PartyPicker) het net aangemaakte partij-id meteen in het
  // omringende formulier kan zetten.
  const addExternalParty = useCallback(
    (naam, type, { pending = false, teamId = null } = {}) => {
      const trimmed = naam.trim()
      if (!trimmed) return null
      const today = new Date().toISOString().slice(0, 10)
      const id = generateId()
      const party = {
        id,
        naam: trimmed,
        type: type || 'stakeholder',
        status: pending ? 'in_afwachting' : 'actief',
        createdAt: today,
        updatedAt: today,
        voorgesteldDoorTeamId: teamId,
      }
      persist({ ...state, externalParties: [...state.externalParties, party] })
      return id
    },
    [state, persist],
  )

  const renameExternalParty = useCallback(
    (id, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      const today = new Date().toISOString().slice(0, 10)
      persist({
        ...state,
        externalParties: state.externalParties.map((p) => (p.id === id ? { ...p, naam: trimmed, updatedAt: today } : p)),
      })
    },
    [state, persist],
  )

  const approveExternalParty = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      persist({
        ...state,
        externalParties: state.externalParties.map((p) => (p.id === id ? { ...p, status: 'actief', updatedAt: today } : p)),
      })
    },
    [state, persist],
  )

  // Weigeren verwijdert het record niet: verwijzingen vanuit dependencies of
  // input/output-items blijven bestaan en tonen een waarschuwing i.p.v. de
  // partij (en daarmee de context van die verwijzing) stilzwijgend te laten
  // verdwijnen.
  const rejectExternalParty = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      persist({
        ...state,
        externalParties: state.externalParties.map((p) => (p.id === id ? { ...p, status: 'geweigerd', updatedAt: today } : p)),
      })
    },
    [state, persist],
  )

  // Retourneert true bij succes, false als de partij nog ergens aan
  // gekoppeld is (dan moet de UI weigeren/archiveren aanbieden i.p.v.
  // verwijderen).
  const deleteExternalParty = useCallback(
    (id) => {
      const inUse =
        state.dependencies.some((d) => d.geraaktPartijId === id) ||
        Object.values(state.teamWorkflows).some(
          (w) => (w.inputs ?? []).some((i) => i.externalPartyId === id) || (w.outputs ?? []).some((o) => o.externalPartyId === id),
        )
      if (inUse) return false
      persist({ ...state, externalParties: state.externalParties.filter((p) => p.id !== id) })
      return true
    },
    [state, persist],
  )

  // --- dependencies ---

  const addDependency = useCallback(
    (dependency) => {
      const today = new Date().toISOString().slice(0, 10)
      const record = { ...dependency, id: generateId(), laatst_bijgewerkt: today, aangemaakt_op: today }
      const duplicate = findPotentialDuplicate(record, state.dependencies)
      const logEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        teamId: record.teamId,
        type: 'dependency_created',
        dependencyId: record.id,
        duplicateOfId: duplicate?.id ?? null,
        status: 'pending',
      }
      const next = {
        ...state,
        dependencies: [...state.dependencies, record],
        changeLog: [...state.changeLog, logEntry],
        usingMockData: false,
      }
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
      const records = deps.map((dependency) => ({ ...dependency, id: generateId(), laatst_bijgewerkt: now, aangemaakt_op: now }))
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

  // --- admin-logpagina: review van teamwijzigingen + dependency-dedup ---

  // Bevestigt een gelogde wijziging. Bij een gemarkeerd duplicaat maakt dit
  // de dependency voor béíde teams zichtbaar door voor elk team een eigen
  // kopie van de ander te materialiseren (zelfde aanpak als de bestaande
  // 'meerdere teams'-aanmaakflow) — geen gedeeld record, wel herkenbaar
  // gekoppeld via dedupGroupId.
  const approveChange = useCallback(
    (logId) => {
      const entry = state.changeLog.find((c) => c.id === logId)
      if (!entry) return
      let dependencies = state.dependencies
      if (entry.duplicateOfId) {
        const nieuw = dependencies.find((d) => d.id === entry.dependencyId)
        const bestaand = dependencies.find((d) => d.id === entry.duplicateOfId)
        if (nieuw && bestaand) {
          const today = new Date().toISOString().slice(0, 10)
          const dedupGroupId = nieuw.dedupGroupId ?? bestaand.dedupGroupId ?? generateId()
          const kopieVoorNieuwTeam = buildCrossTeamCopy(bestaand, nieuw.teamId, dedupGroupId, today)
          const kopieVoorBestaandTeam = buildCrossTeamCopy(nieuw, bestaand.teamId, dedupGroupId, today)
          dependencies = [
            ...dependencies.map((d) =>
              d.id === nieuw.id || d.id === bestaand.id ? { ...d, dedupGroupId } : d,
            ),
            kopieVoorNieuwTeam,
            kopieVoorBestaandTeam,
          ]
        }
      }
      const changeLog = state.changeLog.map((c) => (c.id === logId ? { ...c, status: 'approved' } : c))
      persist({ ...state, dependencies, changeLog })
    },
    [state, persist],
  )

  const rejectChange = useCallback(
    (logId) => {
      const changeLog = state.changeLog.map((c) => (c.id === logId ? { ...c, status: 'rejected' } : c))
      persist({ ...state, changeLog })
    },
    [state, persist],
  )

  // Wordt aangeroepen nadat de admin de dependency zelf heeft aangepast via
  // het gewone bewerk-formulier (updateDependency) — deze actie zet alleen
  // de status van de log-entry, verandert geen data.
  const markChangeEdited = useCallback(
    (logId) => {
      const changeLog = state.changeLog.map((c) => (c.id === logId ? { ...c, status: 'edited' } : c))
      persist({ ...state, changeLog })
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
      externalParties: state.externalParties,
      addExternalParty,
      renameExternalParty,
      approveExternalParty,
      rejectExternalParty,
      deleteExternalParty,
      changeLog: state.changeLog,
      approveChange,
      rejectChange,
      markChangeEdited,
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
      addExternalParty,
      renameExternalParty,
      approveExternalParty,
      rejectExternalParty,
      deleteExternalParty,
      approveChange,
      rejectChange,
      markChangeEdited,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
