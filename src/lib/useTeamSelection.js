import { useCallback, useMemo, useState } from 'react'

// Teamselectie voor de filterpanelen (Heatmap, Ketenoverzicht).
// De standaard per team volgt uit de data: actieve teams aan,
// gearchiveerde teams uit (tenzij includeArchived) — en die standaard wordt
// bij elke render opnieuw bepaald, niet één keer bij het openen van de
// weergave. Archiveren of de-archiveren terwijl de weergave open staat
// (Instellingen is een overlay; de weergave blijft gemount) werkt zo meteen
// door in de selectie. Alleen een expliciete keuze van de gebruiker
// (aan-/uitvinken, Alles, Geen) overschrijft die standaard, per team.
export function useTeamSelection(teams, { includeArchived = false } = {}) {
  const [overrides, setOverrides] = useState(() => new Map())

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
