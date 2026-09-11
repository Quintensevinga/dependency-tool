// Leesbare URL per pagina, zodat verversen, terug/vooruit in de browser en
// het delen van een link op dezelfde pagina uitkomen. Bewust zonder
// router-library: drie tabbladen en een teampagina rechtvaardigen geen extra
// dependency. Paden:
//   /heatmap · /ketenoverzicht · /analyse · /team/<team-id>
// De overlays (dependency-detail, formulier, instellingen) zijn tijdelijke
// toestand en krijgen bewust geen eigen URL. Op Vercel zorgt vercel.json
// ervoor dat elk pad index.html serveert (single-page app); de Vite dev-server
// doet dat standaard al.
const TAB_PATHS = { heatmap: '/heatmap', chain: '/ketenoverzicht', analyse: '/analyse' }

export function pathForNav({ activeTab, teamPageTeamId }) {
  if (teamPageTeamId) return `/team/${encodeURIComponent(teamPageTeamId)}`
  return TAB_PATHS[activeTab] ?? TAB_PATHS.heatmap
}

// Levert { activeTab, teamPageTeamId } voor een bekend pad, of null voor een
// onbekend pad (dan valt de app terug op de laatst bewaarde pagina). Bij een
// teampagina is activeTab null: het onderliggende tabblad blijft dan wat het
// was, net als bij navigatie via de zijbalk.
export function navFromPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const team = path.match(/^\/team\/([^/]+)$/)
  if (team) {
    try {
      return { activeTab: null, teamPageTeamId: decodeURIComponent(team[1]) }
    } catch {
      return null
    }
  }
  const tab = Object.entries(TAB_PATHS).find(([, tabPath]) => tabPath === path)?.[0]
  return tab ? { activeTab: tab, teamPageTeamId: null } : null
}
