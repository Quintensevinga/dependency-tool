// Koppelingsverzoeken met status 'voorgesteld': items van het ene team die naar
// een item of team van een ander team wijzen en daar op akkoord wachten.
//
// Stond eerder vastgeklonken in TeamPage, met het teamId van die pagina erin
// gebakken. De reviewwachtrij in Instellingen heeft precies dezelfde lijst nodig
// maar dan over alle teams heen, en twee kopieën van deze lus zouden na de
// eerste wijziging uit elkaar lopen — vandaar hier, met het ontvangende team als
// optionele parameter.
//
// `voorTeamId` weglaten (of null) levert alle openstaande verzoeken van de hele
// organisatie. Een verzoek draagt altijd zowel het verzendende team (`teamId`,
// waar het item staat) als het ontvangende team (`ontvangerId`, dat moet
// beslissen) — de wachtrij toont die twee naast elkaar en de teampagina gebruikt
// ze om te accepteren.
export function openKoppelverzoeken(teamWorkflows, voorTeamId = null) {
  const lijst = []
  for (const [afzenderId, wf] of Object.entries(teamWorkflows ?? {})) {
    for (const kind of ['input', 'output']) {
      for (const item of wf?.[`${kind}s`] ?? []) {
        if (item?.linkStatus !== 'voorgesteld') continue
        const ontvangerId = item.linkedTeam
        if (!ontvangerId || ontvangerId === afzenderId) continue
        if (voorTeamId && ontvangerId !== voorTeamId) continue
        lijst.push({ kind, item, teamId: afzenderId, ontvangerId })
      }
    }
  }
  return lijst
}
