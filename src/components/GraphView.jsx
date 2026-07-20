import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, { Background, Controls, Handle, Position, applyNodeChanges } from 'reactflow'
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
import { useModalA11y } from '../lib/a11y'

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

// Brede, permanent zichtbare 'connector-balk' i.p.v. een kleine stip: een
// stip van een paar pixels is in de praktijk vrijwel onvindbaar met een muis.
// De balk is bewust groot (grote hit-area) maar rustig getint zodat hij niet
// domineert; op hover licht hij op als duidelijke sleep-affordance.
const handleStyle = {
  width: '55%',
  height: 11,
  borderRadius: 5,
  background: '#33493c',
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
      style={{ borderColor: data.count > 0 ? style.hex : '#d9cfc0', minWidth: 168, opacity: dimmed ? 0.3 : 1 }}
    >
      <Handle type="target" position={Position.Bottom} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <div className="text-sm font-semibold text-stone-800">{data.label}</div>
      {data.count > 0 ? (
        <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {data.count} {t('graph.totalCount')}
        </div>
      ) : (
        <div className="mt-1.5 text-xs text-stone-400">{t('graph.noDeps')}</div>
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
      className="cursor-pointer rounded-xl border-2 border-dashed bg-stone-50/80 px-3 py-2 shadow-sm transition-all duration-200"
      style={{ width: 156, borderColor: data.selected ? style.hex : '#d6cdbd', opacity: dimmed ? 0.25 : 1 }}
    >
      <Handle type="source" position={Position.Top} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <Handle type="target" position={Position.Top} style={handleStyle} className={handleClassName} title={HANDLE_HINT} />
      <div className="mb-1 flex items-center gap-1.5">
        <CategoryIcon categorie={data.categorie} className="h-3.5 w-3.5 shrink-0 text-stone-500" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{t('graph.categoryNode')}</span>
      </div>
      <div className="truncate text-xs font-medium text-stone-700">{translateCategorie(data.categorie, language)}</div>
      <div className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${style.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {data.count}
      </div>
    </div>
  )
}

const nodeTypes = { team: TeamNode, category: CategoryNode }

function EdgeLabel({ categorie, count }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 shadow-sm" style={{ color: '#6b5645' }}>
      <CategoryIcon categorie={categorie} className="h-3 w-3" />
      {count > 1 && <span className="text-[11px] font-semibold">{count}×</span>}
    </div>
  )
}

// Zuivere layout-berekening, losgetrokken van React state zodat we handmatig
// versleepte posities kunnen behouden wanneer de onderliggende data wijzigt
// (zie de merge in de useEffect hieronder). De tweede rij groepeert nu op
// categorie (dezelfde taxonomie als het matrix-overzicht) i.p.v. op externe
// partij, zodat beide weergaven 1-op-1 met elkaar overeenkomen.
function computeLayout(visibleTeams, visibleDependencies) {
  const TEAM_NODE_WIDTH = 190
  const CAT_NODE_WIDTH = 172
  const CAT_PER_ROW = 7

  const categoriesPresent = [...new Set(visibleDependencies.map((d) => d.categorie))].sort()
  const catRowCount = Math.max(1, Math.ceil(categoriesPresent.length / CAT_PER_ROW))
  const canvasWidth = Math.max(
    visibleTeams.length * TEAM_NODE_WIDTH,
    Math.min(categoriesPresent.length, CAT_PER_ROW) * CAT_NODE_WIDTH,
    1100,
  )
  const columnX = (index, count, nodeWidth) => (canvasWidth / count) * (index + 0.5) - nodeWidth / 2

  const nodeList = visibleTeams.map((team, i) => {
    const teamDeps = visibleDependencies.filter((d) => d.teamId === team.id)
    return {
      id: `team:${team.id}`,
      type: 'team',
      position: { x: columnX(i, visibleTeams.length, TEAM_NODE_WIDTH), y: 20 },
      data: { label: team.naam, count: teamDeps.length, risk: highestRisk(teamDeps), deps: teamDeps },
      draggable: true,
    }
  })

  categoriesPresent.forEach((categorie, i) => {
    const row = Math.floor(i / CAT_PER_ROW)
    const col = i % CAT_PER_ROW
    const itemsInRow = Math.min(CAT_PER_ROW, categoriesPresent.length - row * CAT_PER_ROW)
    const catDeps = visibleDependencies.filter((d) => d.categorie === categorie)
    nodeList.push({
      id: `cat:${categorie}`,
      type: 'category',
      position: { x: columnX(col, itemsInRow, CAT_NODE_WIDTH), y: 300 + row * 108 },
      data: { categorie, count: catDeps.length, risk: highestRisk(catDeps), deps: catDeps },
      draggable: true,
    })
  })

  const edgeMap = new Map()
  for (const dep of visibleDependencies) {
    const key = `team:${dep.teamId}->cat:${dep.categorie}`
    if (!edgeMap.has(key)) edgeMap.set(key, [])
    edgeMap.get(key).push(dep)
  }

  const edgeList = [...edgeMap.entries()].map(([key, deps]) => {
    const [source, target] = key.split('->')
    const risk = highestRisk(deps)
    const style = riskStyle(risk.level)
    const categorie = deps[0].categorie
    const teamLabel = visibleTeams.find((tm) => tm.id === deps[0].teamId)?.naam ?? source.replace('team:', '')
    return {
      id: key,
      source,
      target,
      label: <EdgeLabel categorie={categorie} count={deps.length} />,
      style: { stroke: style.hex, strokeWidth: 1.5 + Math.min(deps.length, 4) },
      data: { deps, categorie, sourceLabel: teamLabel, targetLabel: target.replace('cat:', '') },
    }
  })

  const graphHeight = Math.max(560, 360 + catRowCount * 108)

  return { nodes: nodeList, edges: edgeList, categoriesPresent, graphHeight }
}

export default function GraphView({ onSelect, onQuickCreate }) {
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
  const [selectedWorkflowStap, setSelectedWorkflowStap] = useState([...WORKFLOW_STAP_LEVELS, ''])
  const [selectedOplossingsniveau, setSelectedOplossingsniveau] = useState([...OPLOSSINGSNIVEAU_LEVELS, ''])
  const [excludedFunctieIds, setExcludedFunctieIds] = useState(() => new Set())

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
        if (!selectedWorkflowStap.includes(d.workflowStap ?? '')) return false
        if (!selectedOplossingsniveau.includes(d.oplossingsniveau ?? '')) return false
        const owners = Array.isArray(d.eigenaarFunctieIds) ? d.eigenaarFunctieIds : []
        return owners.length > 0 ? owners.some((id) => selectedFunctieIds.includes(id)) : selectedFunctieIds.includes('')
      }),
    [dependencies, selectedTeamIds, selectedRiskLevels, selectedWorkflowStap, selectedOplossingsniveau, selectedFunctieIds],
  )

  const [nodes, setNodes] = useState(() => computeLayout(visibleTeams, visibleDependencies).nodes)
  const [edges, setEdges] = useState([])
  const [categoriesPresent, setCategoriesPresent] = useState([])
  const [graphHeight, setGraphHeight] = useState(560)

  // Herberekent de layout zodra teams/afhankelijkheden/filters wijzigen, maar
  // behoudt de positie van blokjes die de gebruiker handmatig heeft versleept
  // (alleen echt nieuwe blokjes krijgen een verse berekende positie).
  useEffect(() => {
    const layout = computeLayout(visibleTeams, visibleDependencies)
    setNodes((prevNodes) => {
      const prevById = new Map(prevNodes.map((n) => [n.id, n]))
      return layout.nodes.map((n) => {
        const prev = prevById.get(n.id)
        return prev ? { ...n, position: prev.position } : n
      })
    })
    setEdges(layout.edges)
    setCategoriesPresent(layout.categoriesPresent)
    setGraphHeight(layout.graphHeight)
  }, [visibleTeams, visibleDependencies])

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  // Highlight-status toepassen op de weergegeven (niet de bewaarde) nodes/edges,
  // zodat het klikken op de legenda geen posities beïnvloedt.
  const displayNodes = useMemo(() => {
    if (!highlightedCategory) return nodes
    return nodes.map((n) => {
      if (n.type === 'category') {
        return { ...n, data: { ...n.data, selected: n.data.categorie === highlightedCategory, dimmed: n.data.categorie !== highlightedCategory } }
      }
      const hasMatch = n.data.deps?.some((d) => d.categorie === highlightedCategory)
      return { ...n, data: { ...n.data, dimmed: !hasMatch } }
    })
  }, [nodes, highlightedCategory])

  const displayEdges = useMemo(() => {
    if (!highlightedCategory) return edges
    return edges.map((e) => {
      const match = e.data.categorie === highlightedCategory
      return {
        ...e,
        style: { ...e.style, opacity: match ? 1 : 0.12 },
        zIndex: match ? 10 : 0,
      }
    })
  }, [edges, highlightedCategory])

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

  function renderHoverContent() {
    if (!hover) return null
    if (hover.kind === 'node') {
      const breakdown = riskBreakdown(hover.payload.deps)
      return (
        <div>
          <div className="mb-1.5 font-semibold text-stone-50">{hover.payload.label}</div>
          <div className="space-y-1">
            {RISK_LEVELS.slice()
              .reverse()
              .map((level) => {
                const style = riskStyle(level)
                return (
                  <div key={level} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-stone-300">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                      {translateRiskLevel(level, language)}
                    </span>
                    <span className="font-medium text-stone-50">{breakdown[level]}</span>
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
        <div className="mb-1 font-semibold text-stone-50">
          {sourceLabel} → {translateCategorie(targetLabel, language)}
        </div>
        <div className="mb-2 text-stone-300">
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
              <li key={dep.id} className="text-stone-200">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: riskStyle(calculateRisk(dep).level).hex }}
                  />
                  <span className="truncate">{dep.titel}</span>
                </div>
                {dep.geraakte_team_extern && (
                  <div className="ml-3 truncate text-[11px] text-stone-400">
                    {t('graph.viaExternalParty', { party: dep.geraakte_team_extern })}
                  </div>
                )}
                {meta.length > 0 && <div className="ml-3 truncate text-[11px] text-stone-400">{meta.join(' · ')}</div>}
              </li>
            )
          })}
        </ul>
        {deps.length > preview.length && (
          <div className="mt-1 text-stone-400">{t('tooltip.moreItems', { count: deps.length - preview.length })}</div>
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

  const listPanelRef = useRef(null)
  useModalA11y({ open: Boolean(listPanel), onClose: () => setListPanel(null), containerRef: listPanelRef })

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="relative rounded-xl border border-stone-200 bg-white shadow-sm" style={{ height: graphHeight }}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onConnect={handleConnect}
            isValidConnection={(connection) => connection.source?.startsWith('team:')}
            onNodeClick={(_, node) => openNodeListPanel(node)}
            onNodeMouseEnter={(event, node) => {
              if (node.data.deps.length === 0) return
              setHover({ x: event.clientX, y: event.clientY, kind: 'node', payload: node.data })
            }}
            onNodeMouseMove={(event, node) => {
              if (node.data.deps.length === 0) return
              setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))
            }}
            onNodeMouseLeave={() => setHover(null)}
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
            fitViewOptions={{ padding: 0.2 }}
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
            <Background color="#e7ded0" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] text-stone-400 shadow-sm">
            {t('graph.hint')}
          </div>

          {hover && (
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
              className="absolute right-4 top-4 w-72 rounded-xl border border-stone-200 bg-white shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                <span className="text-xs font-semibold text-stone-700">{listPanel.title}</span>
                <button
                  type="button"
                  onClick={() => setListPanel(null)}
                  aria-label={t('nav.close')}
                  className="text-stone-400 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>
              <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto">
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
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-stone-50"
                      >
                        <CategoryIcon categorie={dep.categorie} className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        <span className="flex-1 truncate text-stone-700">{dep.titel}</span>
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

        {categoriesPresent.length > 0 && (
          <div className="mt-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">
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
                      active ? 'bg-[#33493c]/10 text-[#33493c] font-medium' : 'text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <CategoryIcon categorie={cat} className="h-3.5 w-3.5 shrink-0" />
                    {translateCategorie(cat, language)}
                  </button>
                )
              })}
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
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateWorkflowStap(v, language)),
        }}
        oplossingsniveau={{
          options: [...OPLOSSINGSNIVEAU_LEVELS, ''],
          selected: selectedOplossingsniveau,
          onToggle: toggleOplossingsniveau,
          renderLabel: (v) => (v === '' ? t('filter.notSet') : translateOplossingsniveau(v, language)),
        }}
        eigenaarFunctie={{
          options: [...functies, { id: '', naam: t('filter.notSet') }],
          selected: selectedFunctieIds,
          onToggle: toggleFunctieFilter,
        }}
      />
    </div>
  )
}
