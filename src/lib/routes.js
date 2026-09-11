// Leesbare URL per pagina, zodat verversen, terug/vooruit in de browser en
// het delen van een link op dezelfde pagina uitkomen. Bewust zonder
// router-library: drie tabbladen en een teampagina rechtvaardigen geen extra
// dependency. Paden:
//   /heatmap · /ketenoverzicht · /ketenoverzicht/<team-id> (focusteam) ·
//   /analyse · /team/<team-id>
// De overlays (dependency-detail, formulier, instellingen) zijn tijdelijke
// toestand en krijgen bewust geen eigen URL. Op Vercel zorgt vercel.json
// ervoor dat elk pad index.html serveert (single-page app); de Vite dev-server
// doet dat standaard al.
const TAB_PATHS = { heatmap: '/heatmap', chain: '/ketenoverzicht', analyse: '/analyse' }

export function pathForNav({ activeTab, teamPageTeamId, chainFocusTeamId }) {
  if (teamPageTeamId) return `/team/${encodeURIComponent(teamPageTeamId)}`
  if (activeTab === 'chain' && chainFocusTeamId) return `${TAB_PATHS.chain}/${encodeURIComponent(chainFocusTeamId)}`
  return TAB_PATHS[activeTab] ?? TAB_PATHS.heatmap
}

// Levert { activeTab, teamPageTeamId, chainFocusTeamId } voor een bekend pad,
// of null voor een onbekend pad (dan valt de app terug op de laatst bewaarde
// pagina). Bij een teampagina is activeTab null: het onderliggende tabblad
// blijft dan wat het was, net als bij navigatie via de zijbalk.
export function navFromPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const decode = (raw) => {
    try {
      return decodeURIComponent(raw)
    } catch {
      return null
    }
  }
  const team = path.match(/^\/team\/([^/]+)$/)
  if (team) {
    const id = decode(team[1])
    return id ? { activeTab: null, teamPageTeamId: id, chainFocusTeamId: undefined } : null
  }
  const chain = path.match(/^\/ketenoverzicht\/([^/]+)$/)
  if (chain) {
    const id = decode(chain[1])
    return id ? { activeTab: 'chain', teamPageTeamId: null, chainFocusTeamId: id } : null
  }
  const tab = Object.entries(TAB_PATHS).find(([, tabPath]) => tabPath === path)?.[0]
  return tab ? { activeTab: tab, teamPageTeamId: null, chainFocusTeamId: tab === 'chain' ? '' : undefined } : null
}
