import { useCallback, useMemo } from 'react'
import { useBewaardeStand } from './weergave'

// Teamselectie voor de filterpanelen (Heatmap, Ketenoverzicht).
// De standaard per team volgt uit de data: actieve teams aan,
// gearchiveerde teams uit (tenzij includeArchived) — en die standaard wordt
// bij elke render opnieuw bepaald, niet één keer bij het openen van de
// weergave. Archiveren of de-archiveren terwijl de weergave open staat
// (Instellingen is een overlay; de weergave blijft gemount) werkt zo meteen
// door in de selectie. Alleen een expliciete keuze van de gebruiker
// (aan-/uitvinken, Alles, Geen) overschrijft die standaard, per team.
// `bewaarSleutel` bewaart de keuze over verversen heen. Bewust de AFWIJKINGEN
// en niet de uitkomst: de standaard wordt hierboven elke render opnieuw uit de
// data afgeleid, dus als je de uitkomst zou bewaren verschijnt een team dat
// later wordt toegevoegd nooit meer vanzelf in de selectie.
export function useTeamSelection(teams, { includeArchived = false, bewaarSleutel = null } = {}) {
  const [afwijkingen, setAfwijkingen] = useBewaardeStand(
    bewaarSleutel ?? 'weergave.zonderSleutel',
    [],
    // Een bewaarde afwijking voor een inmiddels verwijderd team valt gewoon
    // weg; hier hoeft niets voor te gebeuren omdat de lijst hieronder alleen
    // tegen bestaande teams wordt gelegd. Alleen onzin valt terug op leeg.
    (opgeslagen) => (Array.isArray(opgeslagen) ? opgeslagen.filter((x) => Array.isArray(x) && x.length === 2) : []),
  )
  const overrides = useMemo(() => new Map(afwijkingen), [afwijkingen])
  const setOverrides = useCallback(
    (bijwerken) => {
      setAfwijkingen((vorige) => {
        const nieuw = typeof bijwerken === 'function' ? bijwerken(new Map(vorige)) : bijwerken
        return [...(nieuw instanceof Map ? nieuw : new Map(nieuw))]
      })
    },
    [setAfwijkingen],
  )

  const defaultSelected = useCallback((team) => includeArchived || team.actief, [includeArchived])

  const selectedTeamIds = useMemo(
    () => teams.filter((tm) => (overrides.has(tm.id) ? overrides.get(tm.id) : defaultSelected(tm))).map((tm) => tm.id),
    [teams, overrides, defaultSelected],
  )

  const toggleTeam = useCallback(
    (teamId) => {
      setOverrides((prev) => {
        const team = teams.find((tm) => tm.id === teamId)
        const current = prev.has(teamId) ? prev.get(teamId) : team ? defaultSelected(team) : true
        const next = new Map(prev)
        next.set(teamId, !current)
        return next
      })
    },
    [teams, defaultSelected],
  )

  const selectAll = useCallback(() => setOverrides(new Map(teams.map((tm) => [tm.id, true]))), [teams])
  const selectNone = useCallback(() => setOverrides(new Map(teams.map((tm) => [tm.id, false]))), [teams])

  return { selectedTeamIds, toggleTeam, selectAll, selectNone }
}
