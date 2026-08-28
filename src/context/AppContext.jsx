import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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

// Vindt alle teams die via een input/output-koppeling (linkedTeam) nog naar
// het gegeven team verwijzen — gebruikt door deleteTeam (zie B-09) om een
// verweesde ketenkoppeling te voorkomen, net als de bestaande
// dependency-check hieronder al deed voor dependencies.
function teamsReferencingViaWorkflow(teamWorkflows, teamId) {
  return Object.entries(teamWorkflows)
    .filter(([otherTeamId]) => otherTeamId !== teamId)
    .filter(
      ([, workflow]) =>
        (workflow.inputs ?? []).some((item) => item.linkedTeam === teamId) ||
        (workflow.outputs ?? []).some((item) => item.linkedTeam === teamId),
    )
    .map(([otherTeamId]) => otherTeamId)
}

export function AppProvider({ children }) {
  // Eén keer geladen (niet meer twee keer, zie B-08) — het tweede stukje
  // state (currentTeamId) wordt hieronder synchroon van hetzelfde resultaat
  // afgeleid i.p.v. loadState() nogmaals aan te roepen.
  const [{ state: initialState, corrupted: initiallyCorrupted }] = useState(() => loadState())
  const [state, setState] = useState(initialState)
  const [currentTeamId, setCurrentTeamId] = useState(() => firstActiveTeamId(initialState.teams))
  const [scope, setScope] = useState('intern')
  // Zie B-05: localStorage was onleesbaar bij het opstarten en is stilzwijgend
  // vervangen door demodata — de UI (App.jsx) toont hierop een waarschuwing
  // met een downloadoptie voor de bewaarde ruwe tekst (getCorruptRawData).
  const [corruptedOnLoad, setCorruptedOnLoad] = useState(initiallyCorrupted)
  // Zie B-04: laatste keer dat wegschrijven naar localStorage mislukte (bv.
  // vol quotum) — de wijziging staat dan wel in de UI maar is niet bewaard.
  const [saveError, setSaveError] = useState(false)
  const lastSaveOkRef = useRef(true)

  // persist accepteert voortaan een updater-functie (prev => next) i.p.v.
  // een kant-en-klaar nieuw object — zie B-10. Alle acties hieronder lezen
  // hun 'huidige' state daardoor altijd via prev, nooit via de state-variabele
  // uit hun eigen closure. Dat voorkomt dat twee acties binnen dezelfde
  // gebeurtenis (bv. addCustomRole gevolgd door updateTeamWorkflow) elkaar
  // overschrijven doordat ze allebei van dezelfde, inmiddels verouderde
  // snapshot uitgaan. persist zelf heeft daardoor ook geen dependency op
  // state meer nodig — 'm stabiel over de hele levensduur van de provider.
  const persist = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      lastSaveOkRef.current = saveState(next)
      return next
    })
  }, [])

  // Ná elke state-wijziging (niet ín de setState-updater zelf, zie de noot
  // hierboven) de laatst bekende opslag-uitkomst doorzetten naar UI-state.
  useEffect(() => {
    setSaveError(!lastSaveOkRef.current)
  }, [state])

  // Verbergt de melding zonder de onderliggende oorzaak op te lossen — een
  // volgende mislukte opslagpoging (via persist) zet 'm vanzelf weer aan.
  const dismissSaveError = useCallback(() => setSaveError(false), [])

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
      let newId = null
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => {
        const existingIds = new Set(prev.teams.map((t) => t.id))
        const id = uniqueSlug(trimmed, existingIds)
        newId = id
        const team = { id, naam: trimmed, actief: true, createdAt: today, updatedAt: today }
        return {
          ...prev,
          teams: [...prev.teams, team],
          teamWorkflows: { ...prev.teamWorkflows, [id]: emptyTeamWorkflow() },
          teamSnapshots: { ...prev.teamSnapshots, [id]: [] },
        }
      })
      if (newId) setCurrentTeamId(newId)
      return newId
    },
    [persist],
  )

  const renameTeam = useCallback(
    (id, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => ({
        ...prev,
        teams: prev.teams.map((t) => (t.id === id ? { ...t, naam: trimmed, updatedAt: today } : t)),
      }))
    },
    [persist],
  )

  const archiveTeam = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      let nextTeams = null
      persist((prev) => {
        nextTeams = prev.teams.map((t) => (t.id === id ? { ...t, actief: false, updatedAt: today } : t))
        return { ...prev, teams: nextTeams }
      })
      setCurrentTeamId((prevCurrent) => (prevCurrent === id ? firstActiveTeamId(nextTeams.filter((t) => t.id !== id)) : prevCurrent))
    },
    [persist],
  )

  const unarchiveTeam = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => ({
        ...prev,
        teams: prev.teams.map((t) => (t.id === id ? { ...t, actief: true, updatedAt: today } : t)),
      }))
    },
    [persist],
  )

  // Retourneert true bij succes, false als het team nog dependencies heeft
  // óf als een ander team er via een input/output-koppeling (linkedTeam) nog
  // naar verwijst (zie B-09 — die tweede check ontbrak eerder, waardoor
  // resolveChainEdges een verweesde ketenkoppeling stilzwijgend liet vallen).
  // In beide gevallen moet de UI archiveren aanbieden i.p.v. verwijderen.
  const deleteTeam = useCallback(
    (id) => {
      let blocked = false
      let nextTeams = null
      persist((prev) => {
        const depInUse = prev.dependencies.some((d) => d.teamId === id)
        const referencedByWorkflow = teamsReferencingViaWorkflow(prev.teamWorkflows, id).length > 0
        if (depInUse || referencedByWorkflow) {
          blocked = true
          return prev
        }
        const teamWorkflows = { ...prev.teamWorkflows }
        delete teamWorkflows[id]
        const teamSnapshots = { ...prev.teamSnapshots }
        delete teamSnapshots[id]
        nextTeams = prev.teams.filter((t) => t.id !== id)
        return { ...prev, teams: nextTeams, teamWorkflows, teamSnapshots }
      })
      if (blocked) return false
      setCurrentTeamId((prevCurrent) => (prevCurrent === id ? firstActiveTeamId(nextTeams) : prevCurrent))
      return true
    },
    [persist],
  )

  // --- teamworkflow (teampagina: workflowbord, applicatieflow, momentopnamen) ---

  const updateTeamWorkflow = useCallback(
    (teamId, patch) => {
      persist((prev) => {
        const current = prev.teamWorkflows[teamId] ?? emptyTeamWorkflow()
        return { ...prev, teamWorkflows: { ...prev.teamWorkflows, [teamId]: { ...current, ...patch } } }
      })
    },
    [persist],
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
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => {
        const workflow = prev.teamWorkflows[teamId]
        if (!workflow) return prev
        const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
        return {
          ...prev,
          dependencies: prev.dependencies.map((d) =>
            (d.applicatieIds ?? []).includes(appId)
              ? { ...d, applicatieIds: d.applicatieIds.filter((a) => a !== appId), laatst_bijgewerkt: today }
              : d,
          ),
          teamWorkflows: {
            ...prev.teamWorkflows,
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
      })
    },
    [persist],
  )

  // Momentopnamen: een losstaande, volledige kopie van teamWorkflows[teamId]
  // op een moment in de tijd. Bewust een deep clone zodat latere wijzigingen
  // aan de live workflow de bewaarde momentopname nooit aliassen. Maximaal
  // MAX_SNAPSHOTS_PER_TEAM per team — de oudste rolt er automatisch uit.
  const saveSnapshot = useCallback(
    (teamId, naam) => {
      persist((prev) => {
        const workflow = prev.teamWorkflows[teamId] ?? emptyTeamWorkflow()
        const existing = prev.teamSnapshots[teamId] ?? []
        const snapshot = {
          id: generateId(),
          // Datum+tijd i.p.v. 'Momentopname N': een oplopend nummer blijft
          // hangen op het hoogste nummer zodra de limiet bereikt is (de
          // oudste rolt eruit, maar 'length + 1' bleef daarna altijd
          // hetzelfde getal opleveren) — zie B-11.
          naam: naam?.trim() || `Momentopname ${new Date().toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'medium' })}`,
          timestamp: new Date().toISOString(),
          data: deepClone(workflow),
        }
        const next = [...existing, snapshot].slice(-MAX_SNAPSHOTS_PER_TEAM)
        return { ...prev, teamSnapshots: { ...prev.teamSnapshots, [teamId]: next } }
      })
    },
    [persist],
  )

  const renameSnapshot = useCallback(
    (teamId, snapshotId, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      persist((prev) => {
        const existing = prev.teamSnapshots[teamId] ?? []
        const next = existing.map((s) => (s.id === snapshotId ? { ...s, naam: trimmed } : s))
        return { ...prev, teamSnapshots: { ...prev.teamSnapshots, [teamId]: next } }
      })
    },
    [persist],
  )

  // Zie B-12: vóór het overschrijven van de live workflow wordt automatisch
  // een momentopname van de HUIDIGE stand bewaard, zodat 'terugzetten' altijd
  // omkeerbaar blijft (zelf ook weer terug te zetten).
  const restoreSnapshot = useCallback(
    (teamId, snapshotId) => {
      persist((prev) => {
        const existing = prev.teamSnapshots[teamId] ?? []
        const snapshot = existing.find((s) => s.id === snapshotId)
        if (!snapshot) return prev
        const currentWorkflow = prev.teamWorkflows[teamId] ?? emptyTeamWorkflow()
        const autoSnapshot = {
          id: generateId(),
          naam: 'Automatisch bewaard voor herstel',
          timestamp: new Date().toISOString(),
          data: deepClone(currentWorkflow),
        }
        const nextSnapshots = [...existing, autoSnapshot].slice(-MAX_SNAPSHOTS_PER_TEAM)
        return {
          ...prev,
          teamWorkflows: { ...prev.teamWorkflows, [teamId]: deepClone(snapshot.data) },
          teamSnapshots: { ...prev.teamSnapshots, [teamId]: nextSnapshots },
        }
      })
    },
    [persist],
  )

  const deleteSnapshot = useCallback(
    (teamId, snapshotId) => {
      persist((prev) => {
        const next = (prev.teamSnapshots[teamId] ?? []).filter((s) => s.id !== snapshotId)
        return { ...prev, teamSnapshots: { ...prev.teamSnapshots, [teamId]: next } }
      })
    },
    [persist],
  )

  // --- externe partijen (centrale, admin-beheerde lijst) ---

  // Retourneert direct het nieuwe id (niet pas na een re-render), zodat een
  // aanroeper (bv. PartyPicker) het net aangemaakte partij-id meteen in het
  // omringende formulier kan zetten. Het id wordt vooraf gegenereerd (niet
  // afhankelijk van prev) zodat dat betrouwbaar synchroon teruggegeven kan
  // worden, ook al verwerkt persist de daadwerkelijke toevoeging via prev.
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
      persist((prev) => ({ ...prev, externalParties: [...prev.externalParties, party] }))
      return id
    },
    [persist],
  )

  const renameExternalParty = useCallback(
    (id, naam) => {
      const trimmed = naam.trim()
      if (!trimmed) return
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => ({
        ...prev,
        externalParties: prev.externalParties.map((p) => (p.id === id ? { ...p, naam: trimmed, updatedAt: today } : p)),
      }))
    },
    [persist],
  )

  const approveExternalParty = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => ({
        ...prev,
        externalParties: prev.externalParties.map((p) => (p.id === id ? { ...p, status: 'actief', updatedAt: today } : p)),
      }))
    },
    [persist],
  )

  // Weigeren verwijdert het record niet: verwijzingen vanuit dependencies of
  // input/output-items blijven bestaan en tonen een waarschuwing i.p.v. de
  // partij (en daarmee de context van die verwijzing) stilzwijgend te laten
  // verdwijnen.
  const rejectExternalParty = useCallback(
    (id) => {
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => ({
        ...prev,
        externalParties: prev.externalParties.map((p) => (p.id === id ? { ...p, status: 'geweigerd', updatedAt: today } : p)),
      }))
    },
    [persist],
  )

  // Retourneert true bij succes, false als de partij nog ergens aan
  // gekoppeld is (dan moet de UI weigeren/archiveren aanbieden i.p.v.
  // verwijderen).
  const deleteExternalParty = useCallback(
    (id) => {
      let blocked = false
      persist((prev) => {
        const inUse =
          prev.dependencies.some((d) => d.geraaktPartijId === id) ||
          Object.values(prev.teamWorkflows).some(
            (w) => (w.inputs ?? []).some((i) => i.externalPartyId === id) || (w.outputs ?? []).some((o) => o.externalPartyId === id),
          )
        if (inUse) {
          blocked = true
          return prev
        }
        return { ...prev, externalParties: prev.externalParties.filter((p) => p.id !== id) }
      })
      return !blocked
    },
    [persist],
  )

  // --- dependencies ---

  const addDependency = useCallback(
    (dependency) => {
      const today = new Date().toISOString().slice(0, 10)
      const record = { ...dependency, id: generateId(), laatst_bijgewerkt: today, aangemaakt_op: today }
      persist((prev) => {
        const duplicate = findPotentialDuplicate(record, prev.dependencies)
        const logEntry = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          teamId: record.teamId,
          type: 'dependency_created',
          dependencyId: record.id,
          duplicateOfId: duplicate?.id ?? null,
          status: 'pending',
        }
        return {
          ...prev,
          dependencies: [...prev.dependencies, record],
          changeLog: [...prev.changeLog, logEntry],
          usingMockData: false,
        }
      })
      return record
    },
    [persist],
  )

  // Voor 'N dependencies tegelijk aanmaken' (bv. een ketenafhankelijkheid
  // voor meerdere teams): alle records in één keer bouwen en in één
  // state-update persisten (dit was al zo, en blijft met de functionele
  // persist hieronder correct ook als er nóg een actie in hetzelfde event
  // volgt).
  const addDependencies = useCallback(
    (deps) => {
      const now = new Date().toISOString().slice(0, 10)
      const records = deps.map((dependency) => ({ ...dependency, id: generateId(), laatst_bijgewerkt: now, aangemaakt_op: now }))
      persist((prev) => ({ ...prev, dependencies: [...prev.dependencies, ...records], usingMockData: false }))
      return records
    },
    [persist],
  )

  const updateDependency = useCallback(
    (id, updates) => {
      const today = new Date().toISOString().slice(0, 10)
      persist((prev) => ({
        ...prev,
        dependencies: prev.dependencies.map((d) => (d.id === id ? { ...d, ...updates, laatst_bijgewerkt: today } : d)),
        usingMockData: false,
      }))
    },
    [persist],
  )

  const deleteDependency = useCallback(
    (id) => {
      persist((prev) => ({ ...prev, dependencies: prev.dependencies.filter((d) => d.id !== id) }))
    },
    [persist],
  )

  // --- admin-logpagina: review van teamwijzigingen + dependency-dedup ---

  // Bevestigt een gelogde wijziging. Bij een gemarkeerd duplicaat maakt dit
  // de dependency voor béíde teams zichtbaar door voor elk team een eigen
  // kopie van de ander te materialiseren (zelfde aanpak als de bestaande
  // 'meerdere teams'-aanmaakflow) — geen gedeeld record, wel herkenbaar
  // gekoppeld via dedupGroupId.
  const approveChange = useCallback(
    (logId) => {
      persist((prev) => {
        const entry = prev.changeLog.find((c) => c.id === logId)
        if (!entry) return prev
        let dependencies = prev.dependencies
        if (entry.duplicateOfId) {
          const nieuw = dependencies.find((d) => d.id === entry.dependencyId)
          const bestaand = dependencies.find((d) => d.id === entry.duplicateOfId)
          if (nieuw && bestaand) {
            const today = new Date().toISOString().slice(0, 10)
            const dedupGroupId = nieuw.dedupGroupId ?? bestaand.dedupGroupId ?? generateId()
            const kopieVoorNieuwTeam = buildCrossTeamCopy(bestaand, nieuw.teamId, dedupGroupId, today)
            const kopieVoorBestaandTeam = buildCrossTeamCopy(nieuw, bestaand.teamId, dedupGroupId, today)
            dependencies = [
              ...dependencies.map((d) => (d.id === nieuw.id || d.id === bestaand.id ? { ...d, dedupGroupId } : d)),
              kopieVoorNieuwTeam,
              kopieVoorBestaandTeam,
            ]
          }
        }
        const changeLog = prev.changeLog.map((c) => (c.id === logId ? { ...c, status: 'approved' } : c))
        return { ...prev, dependencies, changeLog }
      })
    },
    [persist],
  )

  const rejectChange = useCallback(
    (logId) => {
      persist((prev) => ({ ...prev, changeLog: prev.changeLog.map((c) => (c.id === logId ? { ...c, status: 'rejected' } : c)) }))
    },
    [persist],
  )

  // Wordt aangeroepen nadat de admin de dependency zelf heeft aangepast via
  // het gewone bewerk-formulier (updateDependency) — deze actie zet alleen
  // de status van de log-entry, verandert geen data.
  const markChangeEdited = useCallback(
    (logId) => {
      persist((prev) => ({ ...prev, changeLog: prev.changeLog.map((c) => (c.id === logId ? { ...c, status: 'edited' } : c)) }))
    },
    [persist],
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
    const ok = saveState(next)
    setState(next)
    setCurrentTeamId(firstActiveTeamId(next.teams))
    setSaveError(!ok)
  }, [])

  const dismissCorruptedNotice = useCallback(() => setCorruptedOnLoad(false), [])

  // Admin: pagina's/secties tonen of verbergen. Puur UI, geen datawijziging —
  // zie DEFAULT_ADMIN_SETTINGS in lib/storage.js voor de volledige structuur.
  const updateAdminSettings = useCallback(
    (next) => {
      persist((prev) => ({ ...prev, adminSettings: next }))
    },
    [persist],
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
      saveError,
      dismissSaveError,
      corruptedOnLoad,
      dismissCorruptedNotice,
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
      saveError,
      dismissSaveError,
      corruptedOnLoad,
      dismissCorruptedNotice,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
