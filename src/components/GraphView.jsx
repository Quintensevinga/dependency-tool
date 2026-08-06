import { useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import {
  translateRiskLevel,
  translateCategorie,
  translateWorkflowStap,
  translateEffectOpFlow,
  translateOplossingsniveau,
} from '../i18n/labels'
import { RISK_LEVELS, CATEGORIES_INTERN, WORKFLOW_STAP_LEVELS, OPLOSSINGSNIVEAU_LEVELS } from '../data/constants'
import { CategoryIcon } from '../data/categoryIcons'
import FloatingTooltip from './FloatingTooltip'
import TeamFilterPanel from './TeamFilterPanel'
import ScopeToggle from './ScopeToggle'
import { useModalA11y } from '../lib/a11y'
import { useMergedLayout } from './flow/useMergedLayout'

function highestRisk(deps) {
  let best = { level: 'Laag', score: 0 }
  for (const d of deps) {
    const r = calculateRisk(d)
    if (r.score > best.score) best = r
  }
  return best
}

function riskBreakdown(deps) {
  const counts = Object.fromEntries(RISK_LEVELS.map((l) => [l, 0]))
  for (const d of deps) counts[calculateRisk(d).level]++
  return counts
}

// Gedeelde groepering (team × categorie -> deps), gebruikt door zowel de
// bipartite-edges als de Cluster/Heatmap-weergaven, zodat alle drie modi
// exact dezelfde onderliggende data tonen.
function groupByTeamCategory(visibleDependencies) {
  const map = new Map()
  for (const dep of visibleDependencies) {
    const key = `${dep.teamId}::${dep.categorie}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(dep)
  }
  return map
}

// Brede, permanent zichtbare 'connector-balk' i.p.v. een kleine stip: een
// stip van een paar pixels is in de praktijk vrijwel onvindbaar met een muis.
// De balk is bewust groot (grote hit-area) maar rustig getint zodat hij niet
// domineert; op hover licht hij op als duidelijke sleep-affordance.
const handleStyle = {
  width: '55%',
  height: 11,
  borderRadius: 5,
  background: '#2a5f8a',
  border: '2px solid white',
  opacity: 0.55,
  cursor: 'crosshair',
}
const handleClassName = 'transition-opacity duration-150 hover:!opacity-100'
const HANDLE_HINT = 'Sleep om een nieuwe dependency te leggen'

function TeamNode({ data }) {
  const { t } = useLanguage()
  const style = riskStyle(data.risk.level)
  const dimmed = data.dimmed
  return (
    <div
      className="cursor-grab rounded-xl border-2 bg-white px-4 py-3 shadow-md transition-all duration-200 hover:shadow-lg active:cursor-grabbing"
      style={{ borderColor: data.count > 0 ? style.hex : '#cbd5e1', minWidth: 168, opacity: dimmed ? 0.3 : 1 }}
    >
      <Handle type="target" position={Position.Bottom} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <div className="text-sm font-semibold text-slate-800">{data.label}</div>
      {data.count > 0 ? (
        <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {data.count} {t('graph.totalCount')}
        </div>
      ) : (
        <div className="mt-1.5 text-xs text-slate-400">{t('graph.noDeps')}</div>
      )}
    </div>
  )
}

function CategoryNode({ data }) {
  const { t, language } = useLanguage()
  const style = riskStyle(data.risk.level)
  const dimmed = data.dimmed
  return (
    <div
      className="cursor-pointer rounded-xl border-2 border-dashed bg-slate-50/80 px-3 py-2 shadow-sm transition-all duration-200"
      style={{ width: 156, borderColor: data.selected ? style.hex : '#cbd5e1', opacity: dimmed ? 0.25 : 1 }}
    >
      <Handle type="source" position={Position.Top} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <Handle type="target" position={Position.Top} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <div className="mb-1 flex items-center gap-1.5">
        <CategoryIcon categorie={data.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('graph.categoryNode')}</span>
      </div>
      <div className="truncate text-xs font-medium text-slate-700">{translateCategorie(data.categorie, language)}</div>
      <div className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${style.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {data.count}
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        {data.teamCount} {t('graph.linkedTeams')}
      </div>
    </div>
  )
}

const nodeTypes = { team: TeamNode, category: CategoryNode }

function EdgeLabel({ categorie, count }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 shadow-sm" style={{ color: '#475569' }}>
      <CategoryIcon categorie={categorie} className="h-3 w-3" />
      {count > 1 && <span className="text-[11px] font-semibold">{count}×</span>}
    </div>
  )
}

// Zuivere layout-berekening, losgetrokken van React state zodat we handmatig
// versleepte posities kunnen behouden wanneer de onderliggende data wijzigt
// (zie de merge in de useEffect hieronder). Teams als verticale rail links,
// categorieën (dezelfde taxonomie als het matrix-overzicht) als verticale
// rail rechts — leesbaarder dan een volle grid met kruisende lijnen, en beter
// geschikt voor hover-gebaseerde focus (zie hoverTeamId state).
function computeLayout(visibleTeams, visibleDependencies) {
  const TEAM_NODE_WIDTH = 210
  const CAT_NODE_WIDTH = 200
  const ROW_H = 96
  const COLUMN_GAP = 640

  const categoriesPresent = [...new Set(visibleDependencies.map((d) => d.categorie))].sort()
  const rowCount = Math.max(visibleTeams.length, categoriesPresent.length)

  const nodeList = visibleTeams.map((team, i) => {
    const teamDeps = visibleDependencies.filter((d) => d.teamId === team.id)
    return {
      id: `team:${team.id}`,
      type: 'team',
      position: { x: 0, y: 20 + i * ROW_H },
      data: { label: team.naam, count: teamDeps.length, risk: highestRisk(teamDeps), deps: teamDeps },
      draggable: true,
    }
  })

  categoriesPresent.forEach((categorie, i) => {
    const catDeps = visibleDependencies.filter((d) => d.categorie === categorie)
    const teamCount = new Set(catDeps.map((d) => d.teamId)).size
    nodeList.push({
      id: `cat:${categorie}`,
      type: 'category',
      position: { x: TEAM_NODE_WIDTH + COLUMN_GAP, y: 20 + i * ROW_H },
      data: { categorie, count: catDeps.length, teamCount, risk: highestRisk(catDeps), deps: catDeps },
      draggable: true,
    })
  })

  const edgeList = [...groupByTeamCategory(visibleDependencies).entries()].map(([key, deps]) => {
    const [teamId, categorie] = key.split('::')
    const source = `team:${teamId}`
    const target = `cat:${categorie}`
    const risk = highestRisk(deps)
    const style = riskStyle(risk.level)
    const teamLabel = visibleTeams.find((tm) => tm.id === teamId)?.naam ?? teamId
    return {
      id: `${source}->${target}`,
      source,
      target,
      label: <EdgeLabel categorie={categorie} count={deps.length} />,
      style: { stroke: style.hex, strokeWidth: 1.5 + Math.min(deps.length, 4) },
      data: { deps, categorie, sourceLabel: teamLabel, targetLabel: categorie },
    }
  })

  const graphHeight = Math.max(460, 60 + rowCount * ROW_H)

  return { nodes: nodeList, edges: edgeList, categoriesPresent, graphHeight }
}

export default function GraphView({ onSelect, onQuickCreate, viewMode, highlight, onClearHighlight, onDrillToRelatie }) {
  const { teams, dependencies, functies } = useAppContext()
  const { t, language } = useLanguage()
  const [listPanel, setListPanel] = useState(null)
  const [hover, setHover] = useState(null) // { x, y, kind: 'node'|'edge', payload }
  // Gearchiveerde teams staan bij openen standaard uit (verdwijnen uit de
  // standaardselectie), maar blijven aan- te vinken zodat historische data
  // opvraagbaar blijft.
  const [deselectedTeamIds, setDeselectedTeamIds] = useState(() => new Set(teams.filter((tm) => !tm.actief).map((tm) => tm.id)))
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  const [highlightedCategory, setHighlightedCategory] = useState(null)
  // Presentatie-only focus-op-hover, geen databewerking. Bevat de node-id
  // ('team:x' of 'cat:y') van de gehoverde node — symmetrisch: hoveren op
  // een team dimt niet-gekoppelde categorieën en vice versa.
  const [hoverNodeId, setHoverNodeId] = useState(null)
  const [selectedWorkflowStap, setSelectedWorkflowStap] = useState([...WORKFLOW_STAP_LEVELS, ''])
  const [selectedOplossingsniveau, setSelectedOplossingsniveau] = useState([...OPLOSSINGSNIVEAU_LEVELS, ''])
  const [excludedFunctieIds, setExcludedFunctieIds] = useState(() => new Set())
  // Lokale scope-filter (i.p.v. de globale AppContext-scope die Matrix
  // gebruikt) zodat Netwerkweergave standaard alles blijft tonen — mixen van
  // Teamniveau/Ketenniveau was hier altijd al het gedrag, dit voegt enkel de
  // mogelijkheid toe om te versmallen.
  const [scope, setScope] = useState('alle')
  // Kolom-/rij-/cel-hover in Heatmap-modus: presentatie-only, dimt/markeert
  // cellen buiten/binnen de gehoverde kolom, rij of losse cel. Een cel-hover
  // wint van rij/kolom-hover (spotlight op precies één cel i.p.v. de hele
  // rij/kolom), analoog aan hoe pinnedPair straks ook los per as kan matchen.
  const [hoverHeatmapCol, setHoverHeatmapCol] = useState(null)
  const [hoverHeatmapRow, setHoverHeatmapRow] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  // Doorklik-highlight vanuit een Heatmap-cel: een gepind team+categorie-paar
  // op de Relatiekaart, blijft actief tot de gebruiker 'm zelf wist (i.t.t.
  // hoverNodeId hierboven, dat alleen tijdens hover geldt).
  const [pinnedPair, setPinnedPair] = useState(null)

  const selectedTeamIds = useMemo(() => teams.filter((tm) => !deselectedTeamIds.has(tm.id)).map((tm) => tm.id), [teams, deselectedTeamIds])

  const visibleTeams = useMemo(() => teams.filter((tm) => selectedTeamIds.includes(tm.id)), [teams, selectedTeamIds])
  const selectedFunctieIds = useMemo(
    () => [...functies.map((f) => f.id), ''].filter((id) => !excludedFunctieIds.has(id)),
    [functies, excludedFunctieIds],
  )
  const visibleDependencies = useMemo(
    () =>
      dependencies.filter((d) => {
        if (!selectedTeamIds.includes(d.teamId) || !selectedRiskLevels.includes(calculateRisk(d).level)) return false
        if (scope !== 'alle' && d.scope !== scope) return false
        if (!selectedWorkflowStap.includes(d.workflowStap ?? '')) return false
        if (!selectedOplossingsniveau.includes(d.oplossingsniveau ?? '')) return false
        const owners = Array.isArray(d.eigenaarFunctieIds) ? d.eigenaarFunctieIds : []
        return owners.length > 0 ? owners.some((id) => selectedFunctieIds.includes(id)) : selectedFunctieIds.includes('')
      }),
    [dependencies, selectedTeamIds, selectedRiskLevels, scope, selectedWorkflowStap, selectedOplossingsniveau, selectedFunctieIds],
  )

  // useMergedLayout (dezelfde hulp-hook als Ketenoverzicht/Teampagina) onthoudt
  // alleen de positie van nodes die de gebruiker zelf heeft versleept
  // (moved: true). Alle overige nodes krijgen bij elke wijziging — bv. een
  // team aan/uitvinken — altijd hun vers berekende positie. De vorige,
  // eigen implementatie hield voor élke al eerder geziene node-id de oude
  // positie vast, ook als die node ondertussen van index/rij was gewisseld
  // (bv. omdat een team ervoor werd uit-/aangevinkt) — daardoor belandden
  // teruggezette teams boven op een ander blokje i.p.v. op hun eigen rij.
  const [layout, onNodesChange] = useMergedLayout(computeLayout, [visibleTeams, visibleDependencies])
  const { nodes, edges, categoriesPresent } = layout
  // Zelfde team×categorie-groepering als de bipartite-edges, herbruikt door
  // Cluster/Heatmap zodat alle drie modi exact dezelfde data tonen.
  const groups = useMemo(() => groupByTeamCategory(visibleDependencies), [visibleDependencies])

  // Zet een inkomende highlight-prop (vanuit een Heatmap-cel-, rij- of
  // kolomklik, via App.jsx) om in een gepind team en/of categorie en opent
  // meteen het detailpaneel voor die selectie — enkel bij een echte
  // wijziging van de prop, niet bij elke herberekening van groups/teams.
  // Eén van beide velden mag leeg zijn: dan geldt de pin voor de hele
  // rij (team) of hele kolom (categorie) i.p.v. één specifieke cel.
  useEffect(() => {
    if (!highlight || (!highlight.teamId && !highlight.categorie)) {
      setPinnedPair(null)
      return
    }
    const { teamId = null, categorie = null } = highlight
    setPinnedPair({ teamId, categorie })
    const team = teamId ? teams.find((tm) => tm.id === teamId) : null
    let deps
    let title
    if (teamId && categorie) {
      deps = groups.get(`${teamId}::${categorie}`) ?? []
      title = `${team?.naam ?? teamId} → ${translateCategorie(categorie, language)}`
    } else if (teamId) {
      deps = visibleDependencies.filter((d) => d.teamId === teamId)
      title = team?.naam ?? teamId
    } else {
      deps = visibleDependencies.filter((d) => d.categorie === categorie)
      title = translateCategorie(categorie, language)
    }
    if (deps.length > 0) setListPanel({ title, deps })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight])

  // Highlight-status toepassen op de weergegeven (niet de bewaarde) nodes/edges,
  // zodat het klikken op de legenda geen posities beïnvloedt.
  const displayNodes = useMemo(() => {
    if (pinnedPair) {
      const { teamId, categorie } = pinnedPair
      if (teamId && categorie) {
        const teamNodeId = `team:${teamId}`
        const catNodeId = `cat:${categorie}`
        return nodes.map((n) => ({ ...n, data: { ...n.data, dimmed: n.id !== teamNodeId && n.id !== catNodeId } }))
      }
      if (teamId) {
        const teamNodeId = `team:${teamId}`
        return nodes.map((n) => {
          if (n.id === teamNodeId) return { ...n, data: { ...n.data, dimmed: false } }
          if (n.type === 'team') return { ...n, data: { ...n.data, dimmed: true } }
          const hasMatch = n.data.deps?.some((d) => d.teamId === teamId)
          return { ...n, data: { ...n.data, dimmed: !hasMatch } }
        })
      }
      const catNodeId = `cat:${categorie}`
      return nodes.map((n) => {
        if (n.id === catNodeId) return { ...n, data: { ...n.data, dimmed: false, selected: true } }
        if (n.type === 'category') return { ...n, data: { ...n.data, dimmed: true } }
        const hasMatch = n.data.deps?.some((d) => d.categorie === categorie)
        return { ...n, data: { ...n.data, dimmed: !hasMatch } }
      })
    }
    if (highlightedCategory) {
      return nodes.map((n) => {
        if (n.type === 'category') {
          return { ...n, data: { ...n.data, selected: n.data.categorie === highlightedCategory, dimmed: n.data.categorie !== highlightedCategory } }
        }
        const hasMatch = n.data.deps?.some((d) => d.categorie === highlightedCategory)
        return { ...n, data: { ...n.data, dimmed: !hasMatch } }
      })
    }
    if (hoverNodeId) {
      const isTeamHover = hoverNodeId.startsWith('team:')
      return nodes.map((n) => {
        if (n.id === hoverNodeId) return { ...n, data: { ...n.data, dimmed: false } }
        if (isTeamHover ? n.type === 'team' : n.type === 'category') return { ...n, data: { ...n.data, dimmed: true } }
        const hasMatch = n.data.deps?.some((d) => (isTeamHover ? `team:${d.teamId}` : `cat:${d.categorie}`) === hoverNodeId)
        return { ...n, data: { ...n.data, dimmed: !hasMatch } }
      })
    }
    return nodes
  }, [nodes, highlightedCategory, hoverNodeId, pinnedPair])

  const displayEdges = useMemo(() => {
    if (pinnedPair) {
      const { teamId, categorie } = pinnedPair
      if (teamId && categorie) {
        const teamNodeId = `team:${teamId}`
        const catNodeId = `cat:${categorie}`
        return edges.map((e) => {
          const match = e.source === teamNodeId && e.target === catNodeId
          return { ...e, style: { ...e.style, opacity: match ? 1 : 0.08 }, zIndex: match ? 10 : 0 }
        })
      }
      const matchId = teamId ? `team:${teamId}` : `cat:${categorie}`
      return edges.map((e) => {
        const match = e.source === matchId || e.target === matchId
        return { ...e, style: { ...e.style, opacity: match ? 0.95 : 0.06 }, zIndex: match ? 10 : 0 }
      })
    }
    if (highlightedCategory) {
      return edges.map((e) => {
        const match = e.data.categorie === highlightedCategory
        return { ...e, style: { ...e.style, opacity: match ? 1 : 0.12 }, zIndex: match ? 10 : 0 }
      })
    }
    if (hoverNodeId) {
      return edges.map((e) => {
        const match = e.source === hoverNodeId || e.target === hoverNodeId
        return { ...e, style: { ...e.style, opacity: match ? 0.95 : 0.06 }, zIndex: match ? 10 : 0 }
      })
    }
    return edges
  }, [edges, highlightedCategory, hoverNodeId, pinnedPair])

  function toggleTeam(teamId) {
    setDeselectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  function toggleRiskLevel(level) {
    setSelectedRiskLevels((prev) => (prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]))
  }

  function toggleWorkflowStap(v) {
    setSelectedWorkflowStap((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  function toggleOplossingsniveau(v) {
    setSelectedOplossingsniveau((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  // Uitsluitingsset i.p.v. inclusielijst, zodat een later toegevoegde functie
  // automatisch zichtbaar blijft i.p.v. verborgen (zelfde patroon als Matrix).
  function toggleFunctieFilter(id) {
    setExcludedFunctieIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleHighlight(categorie) {
    setHighlightedCategory((prev) => (prev === categorie ? null : categorie))
  }

  function clearPinnedPair() {
    setPinnedPair(null)
    onClearHighlight?.()
  }

  function renderHoverContent() {
    if (!hover) return null
    if (hover.kind === 'node') {
      const breakdown = riskBreakdown(hover.payload.deps)
      // Teamnodes hebben data.label, categorienodes (en de Heatmap-tooltip
      // hieronder) alleen data.categorie — zonder deze fallback toonde een
      // categorie-hover een lege titel.
      const title = hover.payload.label ?? translateCategorie(hover.payload.categorie, language)
      return (
        <div>
          <div className="mb-1.5 font-semibold text-slate-50">{title}</div>
          <div className="space-y-1">
            {RISK_LEVELS.slice()
              .reverse()
              .map((level) => {
                const style = riskStyle(level)
                return (
                  <div key={level} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                      {translateRiskLevel(level, language)}
                    </span>
                    <span className="font-medium text-slate-50">{breakdown[level]}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )
    }

    const { deps, sourceLabel, targetLabel } = hover.payload
    const risk = highestRisk(deps)
    const preview = deps.slice(0, 3)
    return (
      <div>
        <div className="mb-1 font-semibold text-slate-50">
          {sourceLabel} → {translateCategorie(targetLabel, language)}
        </div>
        <div className="mb-2 text-slate-300">
          {deps.length} {t('tooltip.dependencies')} · {t('tooltip.highestRisk')}: {translateRiskLevel(risk.level, language)}
        </div>
        <ul className="space-y-1">
          {preview.map((dep) => {
            const meta = [
              dep.workflowStap && translateWorkflowStap(dep.workflowStap, language),
              dep.effectOpFlow && translateEffectOpFlow(dep.effectOpFlow, language),
              dep.oplossingsniveau && translateOplossingsniveau(dep.oplossingsniveau, language),
            ].filter(Boolean)
            return (
              <li key={dep.id} className="text-slate-200">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: riskStyle(calculateRisk(dep).level).hex }}
                  />
                  <span className="truncate">{dep.titel}</span>
                </div>
                {dep.geraakte_team_extern && (
                  <div className="ml-3 truncate text-[11px] text-slate-400">
                    {t('graph.viaExternalParty', { party: dep.geraakte_team_extern })}
                  </div>
                )}
                {meta.length > 0 && <div className="ml-3 truncate text-[11px] text-slate-400">{meta.join(' · ')}</div>}
              </li>
            )
          })}
        </ul>
        {deps.length > preview.length && (
          <div className="mt-1 text-slate-400">{t('tooltip.moreItems', { count: deps.length - preview.length })}</div>
        )}
      </div>
    )
  }

  function handleConnect(connection) {
    if (!onQuickCreate || !connection.source || !connection.target || connection.source === connection.target) return
    const sourceTeamId = connection.source.replace(/^team:/, '')
    const categorie = connection.target.replace(/^cat:/, '')
    const scope = CATEGORIES_INTERN.includes(categorie) ? 'intern' : 'extern'
    onQuickCreate(sourceTeamId, categorie, scope)
  }

  function openNodeListPanel(node) {
    if (node.data.deps.length === 0) return
    const title = node.type === 'team' ? node.data.label : translateCategorie(node.data.categorie, language)
    setListPanel({ title, deps: node.data.deps })
  }

  // Zelfde detailpaneel als bipartite-nodes/edges, hergebruikt door Cluster-
  // chips en Heatmap-cellen zodat alle drie modi identiek gedrag hebben.
  function openCellListPanel(teamLabel, categorie, deps) {
    if (deps.length === 0) return
    setListPanel({ title: `${teamLabel} → ${translateCategorie(categorie, language)}`, deps })
  }

  const listPanelRef = useRef(null)
  useModalA11y({ open: Boolean(listPanel), onClose: () => setListPanel(null), containerRef: listPanelRef })

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          {pinnedPair && viewMode === 'bipartite' ? (
            <button
              type="button"
              onClick={clearPinnedPair}
              className="flex items-center gap-1.5 rounded-full border border-[#2a5f8a]/30 bg-[#2a5f8a]/10 px-3 py-1 text-xs font-medium text-[#2a5f8a] hover:bg-[#2a5f8a]/15"
            >
              {pinnedPair.teamId && pinnedPair.categorie
                ? t('graph.highlightActive', {
                    team: teams.find((tm) => tm.id === pinnedPair.teamId)?.naam ?? pinnedPair.teamId,
                    categorie: translateCategorie(pinnedPair.categorie, language),
                  })
                : pinnedPair.teamId
                  ? t('graph.highlightActiveTeam', { team: teams.find((tm) => tm.id === pinnedPair.teamId)?.naam ?? pinnedPair.teamId })
                  : t('graph.highlightActiveCategorie', { categorie: translateCategorie(pinnedPair.categorie, language) })}
              <span aria-hidden="true">✕</span>
            </button>
          ) : (
            <span />
          )}
          <ScopeToggle scope={scope} onChange={setScope} />
        </div>

        <div
          className={`relative rounded-xl border border-slate-200 bg-white shadow-sm ${viewMode !== 'bipartite' ? 'overflow-auto' : ''}`}
          style={{ height: 'max(640px, calc(100vh - 232px))' }}
        >
          {viewMode === 'bipartite' && (
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onConnect={handleConnect}
            isValidConnection={(connection) => connection.source?.startsWith('team:')}
            onNodeClick={(_, node) => openNodeListPanel(node)}
            onNodeMouseEnter={(event, node) => {
              if (node.type === 'team' || node.type === 'category') setHoverNodeId(node.id)
              if (node.data.deps.length === 0) return
              setHover({ x: event.clientX, y: event.clientY, kind: 'node', payload: node.data })
            }}
            onNodeMouseMove={(event, node) => {
              if (node.data.deps.length === 0) return
              setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))
            }}
            onNodeMouseLeave={() => {
              setHoverNodeId(null)
              setHover(null)
            }}
            onEdgeClick={(_, edge) => {
              setListPanel({
                title: `${edge.data.sourceLabel} → ${translateCategorie(edge.data.targetLabel, language)}`,
                deps: edge.data.deps,
              })
            }}
            onEdgeMouseEnter={(event, edge) => setHover({ x: event.clientX, y: event.clientY, kind: 'edge', payload: edge.data })}
            onEdgeMouseMove={(event) => setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
            onEdgeMouseLeave={() => setHover(null)}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            nodesConnectable
            nodesDraggable
            elementsSelectable
            panOnDrag
            zoomOnScroll
            zoomOnPinch
          >
            <Background color="#e2e8f0" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
          )}

          {viewMode === 'heatmap' && (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {categoriesPresent.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('graph.noDeps')}</div>
                ) : (
                  <div
                    className="grid gap-2"
                    style={{
                      // 1fr i.p.v. een vaste max-breedte/hoogte: cellen vullen exact de
                      // beschikbare ruimte en schalen dus mee met het scherm, met een
                      // ondergrens zodat ze bij heel veel teams/categorieën leesbaar
                      // blijven (dan schakelt overflow-auto over op scrollen).
                      gridTemplateColumns: `minmax(140px, 220px) repeat(${categoriesPresent.length}, minmax(56px, 1fr))`,
                      gridTemplateRows: `auto repeat(${visibleTeams.length}, minmax(48px, 1fr))`,
                    }}
                  >
                    <div className="sticky top-0 z-20 bg-white" />
                    {categoriesPresent.map((cat) => {
                      const catDeps = visibleTeams.flatMap((team) => groups.get(`${team.id}::${cat}`) ?? [])
                      return (
                        <button
                          key={`head-${cat}`}
                          type="button"
                          onClick={() => (onDrillToRelatie ? onDrillToRelatie(null, cat) : toggleHighlight(cat))}
                          onMouseEnter={(event) => {
                            setHoverHeatmapCol(cat)
                            setHover({ x: event.clientX, y: event.clientY, kind: 'node', payload: { categorie: cat, deps: catDeps } })
                          }}
                          onMouseMove={(event) => setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                          onMouseLeave={() => {
                            setHoverHeatmapCol(null)
                            setHover(null)
                          }}
                          title={translateCategorie(cat, language)}
                          className={`sticky top-0 z-20 flex cursor-pointer flex-col items-center gap-1 rounded-md px-1 pb-1.5 pt-1 transition-colors ${
                            hoverHeatmapCol === cat ? 'bg-[#2a5f8a]/10' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <CategoryIcon categorie={cat} className="h-5 w-5 shrink-0 text-slate-400" />
                          <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-slate-500">
                            {translateCategorie(cat, language)}
                          </span>
                        </button>
                      )
                    })}
                    {visibleTeams.flatMap((team) => [
                      <button
                        key={`label-${team.id}`}
                        type="button"
                        onClick={() => (onDrillToRelatie ? onDrillToRelatie(team, null) : undefined)}
                        onMouseEnter={() => setHoverHeatmapRow(team.id)}
                        onMouseLeave={() => setHoverHeatmapRow(null)}
                        title={team.naam}
                        className={`flex cursor-pointer items-center whitespace-nowrap rounded-md px-2 text-left text-sm font-medium transition-colors ${
                          hoverHeatmapRow === team.id ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {team.naam}
                      </button>,
                      ...categoriesPresent.map((cat) => {
                        const deps = groups.get(`${team.id}::${cat}`) ?? []
                        const cellKey = `${team.id}::${cat}`
                        // Cel-hover wint van rij-/kolom-hover: hoveren van één
                        // cel dimt alle andere cellen (ook binnen dezelfde
                        // rij/kolom), i.p.v. de hele kolom/rij te markeren —
                        // dat blijft voorbehouden aan het hoveren van de
                        // rij-/kolomkop zelf.
                        const dimmed = hoveredCell
                          ? hoveredCell !== cellKey
                          : hoverHeatmapCol
                            ? hoverHeatmapCol !== cat
                            : hoverHeatmapRow
                              ? hoverHeatmapRow !== team.id
                              : false
                        if (deps.length === 0) {
                          return (
                            <div
                              key={cellKey}
                              className="rounded-lg bg-slate-50 transition-opacity"
                              style={{ opacity: dimmed ? 0.35 : 1 }}
                            />
                          )
                        }
                        const risk = highestRisk(deps)
                        const style = riskStyle(risk.level)
                        return (
                          <button
                            key={cellKey}
                            type="button"
                            onClick={() => (onDrillToRelatie ? onDrillToRelatie(team, cat) : openCellListPanel(team.naam, cat, deps))}
                            onMouseEnter={(event) => {
                              setHoveredCell(cellKey)
                              setHover({
                                x: event.clientX,
                                y: event.clientY,
                                kind: 'node',
                                payload: { label: `${team.naam} · ${translateCategorie(cat, language)}`, deps },
                              })
                            }}
                            onMouseMove={(event) => setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                            onMouseLeave={() => {
                              setHoveredCell(null)
                              setHover(null)
                            }}
                            title={`${team.naam} · ${translateCategorie(cat, language)} · ${translateRiskLevel(risk.level, language)}`}
                            className={`flex items-center justify-center rounded-lg text-sm font-semibold transition-all hover:opacity-80 ${style.badge}`}
                            style={{ opacity: dimmed ? 0.35 : 1 }}
                          >
                            {deps.length}
                          </button>
                        )
                      }),
                    ])}
                  </div>
                )}
              </div>

              {categoriesPresent.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 bg-white px-4 py-2.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t('graph.legendHint')}</span>
                  {categoriesPresent.map((cat) => (
                    <span key={`legend-${cat}`} className="flex items-center gap-1 text-xs text-slate-500">
                      <CategoryIcon categorie={cat} className="h-3.5 w-3.5 shrink-0" />
                      {translateCategorie(cat, language)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'bipartite' && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] text-slate-400 shadow-sm">
              {t('graph.hint')}
            </div>
          )}

          {hover && (viewMode === 'bipartite' || viewMode === 'heatmap') && (
            <FloatingTooltip x={hover.x} y={hover.y}>
              {renderHoverContent()}
            </FloatingTooltip>
          )}

          {listPanel && (
            <div
              ref={listPanelRef}
              role="dialog"
              aria-modal="false"
              aria-label={listPanel.title}
              className="absolute right-4 top-4 w-72 rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">{listPanel.title}</span>
                <button
                  type="button"
                  onClick={() => setListPanel(null)}
                  aria-label={t('nav.close')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {listPanel.deps.map((dep) => {
                  const risk = calculateRisk(dep)
                  const style = riskStyle(risk.level)
                  return (
                    <li key={dep.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(dep)
                          setListPanel(null)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"
                      >
                        <CategoryIcon categorie={dep.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="flex-1 truncate text-slate-700">{dep.titel}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 ${style.badge}`}>
                          {translateRiskLevel(risk.level, language)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {categoriesPresent.length > 0 && viewMode === 'bipartite' && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {t('graph.legendHint')}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {categoriesPresent.map((cat) => {
                const active = highlightedCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleHighlight(cat)}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors ${
                      active ? 'bg-[#2a5f8a]/10 text-[#2a5f8a] font-medium' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <CategoryIcon categorie={cat} className="h-3.5 w-3.5 shrink-0" />
                    {translateCategorie(cat, language)}
                  </button>
                )
              })}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {t('graph.riskLegendTitle')}
              </span>
              {RISK_LEVELS.slice()
                .reverse()
                .map((level) => (
                  <span key={level} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: riskStyle(level).hex }} />
                    {translateRiskLevel(level, language)}
                  </span>
                ))}
              <span className="text-[11px] text-slate-400">{t('graph.lineWidthHint')}</span>
            </div>
          </div>
        )}
      </div>

      <TeamFilterPanel
        teams={teams}
        selected={selectedTeamIds}
        onToggle={toggleTeam}
        onSelectAll={() => setDeselectedTeamIds(new Set())}
        onSelectNone={() => setDeselectedTeamIds(new Set(teams.map((tm) => tm.id)))}
        riskLevels={selectedRiskLevels}
        onToggleRisk={toggleRiskLevel}
        onHideLowRisk={() => setSelectedRiskLevels(['Hoog', 'Kritiek'])}
        onShowAllRisk={() => setSelectedRiskLevels(RISK_LEVELS)}
        workflowStap={{
          options: [...WORKFLOW_STAP_LEVELS, ''],
          selected: selectedWorkflowStap,
          onToggle: toggleWorkflowStap,
          onSelectAll: () => setSelectedWorkflowStap([...WORKFLOW_STAP_LEVELS, '']),
          onSelectNone: () => setSelectedWorkflowStap([]),
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateWorkflowStap(v, language)),
        }}
        oplossingsniveau={{
          options: [...OPLOSSINGSNIVEAU_LEVELS, ''],
          selected: selectedOplossingsniveau,
          onToggle: toggleOplossingsniveau,
          onSelectAll: () => setSelectedOplossingsniveau([...OPLOSSINGSNIVEAU_LEVELS, '']),
          onSelectNone: () => setSelectedOplossingsniveau([]),
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateOplossingsniveau(v, language)),
        }}
        eigenaarFunctie={{
          options: [...functies, { id: '', naam: t('filter.notSet') }],
          selected: selectedFunctieIds,
          onToggle: toggleFunctieFilter,
          onSelectAll: () => setExcludedFunctieIds(new Set()),
          onSelectNone: () => setExcludedFunctieIds(new Set([...functies.map((f) => f.id), ''])),
        }}
      />
    </div>
  )
}
