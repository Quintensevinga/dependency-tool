// Leesbare URL per pagina, zodat verversen, terug/vooruit in de browser en
// het delen van een link op dezelfde pagina uitkomen. Bewust zonder
// router-library: drie tabbladen en een teampagina rechtvaardigen geen extra
// dependency. Paden:
//   /heatmap · /analyse · /team/<team-id>
//   /ketenoverzicht                       hele keten
//   /ketenoverzicht/team                  één team, nog niet gekozen
//   /ketenoverzicht/<team-id>             één team (focus)
//   /ketenoverzicht/teams/<id>,<id>,…     meerdere teams
// De overlays (dependency-detail, formulier, instellingen) zijn tijdelijke
// toestand en krijgen bewust geen eigen URL. Op Vercel zorgt vercel.json
// ervoor dat elk pad index.html serveert (single-page app); de Vite dev-server
// doet dat standaard al.
const TAB_PATHS = { heatmap: '/heatmap', chain: '/ketenoverzicht', analyse: '/analyse' }
const CHAIN_VIEW_MODES = ['chain', 'team', 'teams']

export const DEFAULT_CHAIN_VIEW = { mode: 'chain', teamId: '', teamIds: [] }

// Maakt van willekeurige invoer (URL, localStorage) een geldige weergave:
// bekende stand, bestaande team-ids.
export function sanitizeChainView(raw, teams) {
  const exists = (id) => typeof id === 'string' && teams.some((tm) => tm.id === id)
  const mode = CHAIN_VIEW_MODES.includes(raw?.mode) ? raw.mode : 'chain'
  return {
    mode,
    teamId: mode === 'team' && exists(raw?.teamId) ? raw.teamId : '',
    teamIds: mode === 'teams' && Array.isArray(raw?.teamIds) ? raw.teamIds.filter(exists) : [],
  }
}

export function pathForNav({ activeTab, teamPageTeamId, chainView }) {
  if (teamPageTeamId) return `/team/${encodeURIComponent(teamPageTeamId)}`
  if (activeTab === 'chain' && chainView) {
    const base = TAB_PATHS.chain
    if (chainView.mode === 'team') return chainView.teamId ? `${base}/${encodeURIComponent(chainView.teamId)}` : `${base}/team`
    if (chainView.mode === 'teams') return chainView.teamIds.length > 0 ? `${base}/teams/${chainView.teamIds.map(encodeURIComponent).join(',')}` : `${base}/teams`
  }
  return TAB_PATHS[activeTab] ?? TAB_PATHS.heatmap
}

// Levert { activeTab, teamPageTeamId, chainView } voor een bekend pad, of
// null voor een onbekend pad (dan valt de app terug op de laatst bewaarde
// pagina). Bij een teampagina is activeTab null: het onderliggende tabblad
// blijft dan wat het was, net als bij navigatie via de zijbalk. chainView is
// alleen gezet voor een ketenoverzicht-pad (nog niet gevalideerd op
// bestaande teams — dat doet sanitizeChainView in App).
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
    return id ? { activeTab: null, teamPageTeamId: id } : null
  }
  if (path === TAB_PATHS.chain) return { activeTab: 'chain', teamPageTeamId: null, chainView: DEFAULT_CHAIN_VIEW }
  if (path === `${TAB_PATHS.chain}/team`) return { activeTab: 'chain', teamPageTeamId: null, chainView: { mode: 'team', teamId: '', teamIds: [] } }
  const multi = path.match(/^\/ketenoverzicht\/teams(?:\/([^/]*))?$/)
  if (multi) {
    const ids = (multi[1] ?? '').split(',').map(decode).filter(Boolean)
    return { activeTab: 'chain', teamPageTeamId: null, chainView: { mode: 'teams', teamId: '', teamIds: ids } }
  }
  const single = path.match(/^\/ketenoverzicht\/([^/]+)$/)
  if (single) {
    const id = decode(single[1])
    return id ? { activeTab: 'chain', teamPageTeamId: null, chainView: { mode: 'team', teamId: id, teamIds: [] } } : null
  }
  const tab = Object.entries(TAB_PATHS).find(([, tabPath]) => tabPath === path)?.[0]
  return tab ? { activeTab: tab, teamPageTeamId: null } : null
}
