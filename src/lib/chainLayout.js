// Lay-outhulpen voor het ketenoverzicht (ChainOverview.jsx): cyclus-breking
// in de voorwaartse keten, de opbouw van de ELK-graaf (elkjs, algoritme
// 'layered') en het terugvertalen van ELK's resultaat naar React Flow-
// posities en lijnpunten. Zuivere functies — het meten van kaarten/handles
// en het aanroepen van ELK zelf gebeurt in de component.

// Breekt cycli in de voorwaartse keten vanaf het focusteam: een DFS vanaf de
// focus markeert elke koppeling naar een team dat nog "open" staat op de
// DFS-stapel (een voorouder, incl. het focusteam zelf) als terugkoppeling.
// Alle overige koppelingen vormen samen een DAG, precies wat ELK nodig heeft
// om zelf géén willekeurige lijnen te hoeven omkeren. Levert daarnaast een
// langste-pad-laag per team (0 = focus) — alleen nog gebruikt voor de
// noodlay-out als ELK onverhoopt faalt, ELK bepaalt de kolommen zelf.
export function orderChain(focusId, teamIds, chainEdges) {
  const out = new Map([...teamIds].map((id) => [id, []]))
  for (const edge of chainEdges) {
    if (edge.sourceTeam === edge.targetTeam) continue
    if (!teamIds.has(edge.sourceTeam) || !teamIds.has(edge.targetTeam)) continue
    out.get(edge.sourceTeam).push(edge)
  }
  const state = new Map() // 1 = op de stapel, 2 = afgehandeld
  const backEdgeIds = new Set()
  const finished = []
  function visit(id) {
    state.set(id, 1)
    for (const edge of out.get(id)) {
      const targetState = state.get(edge.targetTeam)
      if (targetState === 1) backEdgeIds.add(edge.id)
      else if (!targetState) visit(edge.targetTeam)
    }
    state.set(id, 2)
    finished.push(id)
  }
  if (teamIds.has(focusId)) visit(focusId)
  for (const id of teamIds) if (!state.get(id)) visit(id)

  const layerOf = new Map([...teamIds].map((id) => [id, 0]))
  for (const id of finished.reverse()) {
    for (const edge of out.get(id)) {
      if (backEdgeIds.has(edge.id)) continue
      layerOf.set(edge.targetTeam, Math.max(layerOf.get(edge.targetTeam), layerOf.get(id) + 1))
    }
  }
  return { layerOf, backEdgeIds }
}

// Aan welke kant van de kaart een handle zit, afgeleid van de handle-naam
// (zie FocusChainCardNode/ExternalPartyNode). Alleen nodig als React Flow de
// handle (nog) niet gemeten heeft; normaal komt de kant uit de meting.
export function handleSide(handleId) {
  if (handleId.startsWith('item-in-rev') || handleId === 'card-in-rev' || handleId === 'card-out' || handleId.startsWith('right-')) return 'EAST'
  if (handleId.startsWith('item-out')) return handleId.includes('-rev') ? 'WEST' : 'EAST'
  return 'WEST'
}

// Orthogonaal pad (M/L) met afgeronde hoeken door een reeks punten, zoals
// ELK die teruggeeft: start, bochten, einde.
export function roundedOrthPath(points, radius = 8) {
  if (!points || points.length < 2) return ''
  let d = `M ${points[0][0]},${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [cx, cy] = points[i]
    const [nx, ny] = points[i + 1]
    const d1 = Math.hypot(cx - px, cy - py)
    const d2 = Math.hypot(nx - cx, ny - cy)
    if (d1 === 0 || d2 === 0) continue
    const r = Math.min(radius, d1 / 2, d2 / 2)
    const ax = cx - ((cx - px) / d1) * r
    const ay = cy - ((cy - py) / d1) * r
    const bx = cx + ((nx - cx) / d2) * r
    const by = cy + ((ny - cy) / d2) * r
    d += ` L ${ax},${ay} Q ${cx},${cy} ${bx},${by}`
  }
  const [lx, ly] = points[points.length - 1]
  d += ` L ${lx},${ly}`
  return d
}

// Punt halverwege de totale lengte van een polylijn — daar hangt de teller
// van een gebundelde lijn, zodat 'ie altijd óp de lijn ligt (het rekenkundige
// midden tussen begin en eind kan bij een omweg naast de lijn vallen).
export function polylineMidpoint(points) {
  if (!points || points.length === 0) return null
  if (points.length === 1) return points[0]
  const lengths = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    lengths.push(len)
    total += len
  }
  let remaining = total / 2
  for (let i = 1; i < points.length; i++) {
    const len = lengths[i - 1]
    if (remaining <= len) {
      const t = len === 0 ? 0 : remaining / len
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t]
    }
    remaining -= len
  }
  return points[points.length - 1]
}

// Afstanden in px; 'nodeNodeBetweenLayers' is de kolomtussenruimte (ELK
// vergroot die zelf zodra er meer lijnbanen tussen twee kolommen nodig zijn),
// 'nodeNode' de tussenruimte tussen kaarten in één kolom.
export const ELK_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.spacing.nodeNode': '28',
  'elk.layered.spacing.edgeNodeBetweenLayers': '24',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '12',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  // SIMPLE stapelt de kaarten per kolom compact onder elkaar i.p.v. ze te
  // verschuiven om lijnen recht te trekken (BRANDES_KOEPF/NETWORK_SIMPLEX):
  // met kaarten van honderden pixels hoog schoof een team anders tot onder
  // de vorige kaart om één poort uit te lijnen (gemeten: ~30% hogere
  // tekening). Extra bochten zijn geen probleem, ELK routeert toch
  // orthogonaal om de kaarten heen.
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  // Invoervolgorde (focusteam eerst, dan ketenvolgorde) als tie-breaker, zodat
  // dezelfde data ook telkens dezelfde tekening oplevert.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

// Bouwt de ELK-invoer: elke React Flow-node wordt een ELK-node met vaste
// poorten (FIXED_POS) op precies de gemeten handle-posities, elke edge een
// ELK-edge tussen twee poorten. Een terugkoppeling (edge.data.back) gaat
// omgekeerd de graaf in — bron en doel gewisseld — zodat ELK een zuivere
// DAG ziet; bij het terugvertalen (applyElkLayout) worden de punten weer
// omgedraaid. `sizes` is per node-id { width, height, handles: Map<handleId,
// { x, y, side }> } (x/y = middelpunt van de handle t.o.v. de node).
//
// Vertrekpunten zijn gedeeld: alle lijnen die uit hetzelfde blokje
// vertrekken (fan-out van één output naar meerdere teams, één kleur) delen
// één poort en lopen samen tot ze uit elkaar moeten — dat leest als een
// vertakking. Aankomstpunten niet: `fanIn` (zie fanInOffsets) geeft elke lijn
// die op hetzelfde blokje aankomt een eigen poortje, een paar pixels boven of
// onder het handle-midden, zodat lijnen van verschillende bronnen (andere
// kleuren) naast elkaar het blokje in lopen i.p.v. over elkaar heen, waarbij
// de bovenste de rest verborg. Zonder `fanIn` (eerste ronde) delen ook de
// aankomstpunten één poort.
export function buildElkGraph(graph, sizes, layoutOptions = ELK_LAYOUT_OPTIONS, fanIn = null) {
  const ports = new Map() // nodeId -> Map<portId, { handleId, offset }>
  const port = (nodeId, handleId, ownEdgeId = null, offset = 0) => {
    if (!ports.has(nodeId)) ports.set(nodeId, new Map())
    const id = ownEdgeId ? `${nodeId}#${handleId}#${ownEdgeId}` : `${nodeId}#${handleId}`
    ports.get(nodeId).set(id, { handleId, offset })
    return id
  }
  const edges = graph.edges.map((edge) => {
    // Poort aan de echte bron en het echte doel (waar de pijl landt) — los van
    // de omkering voor ELK hieronder.
    const sourcePort = port(edge.source, edge.sourceHandle)
    const own = fanIn?.get(`${edge.target}#${edge.targetHandle}`)?.get(edge.id)
    const targetPort = own === undefined ? port(edge.target, edge.targetHandle) : port(edge.target, edge.targetHandle, edge.id, own)
    const back = edge.data?.back === true
    return { id: edge.id, sources: [back ? targetPort : sourcePort], targets: [back ? sourcePort : targetPort] }
  })
  const children = graph.nodes.map((node) => {
    const size = sizes.get(node.id)
    const elkPorts = [...(ports.get(node.id) ?? [])].map(([id, { handleId, offset }]) => {
      const measured = size.handles.get(handleId)
      const side = measured?.side ?? handleSide(handleId)
      const x = measured?.x ?? (side === 'EAST' ? size.width : 0)
      const y = (measured?.y ?? size.height / 2) + offset
      return { id, x: x - 0.5, y: y - 0.5, width: 1, height: 1, layoutOptions: { 'elk.port.side': side } }
    })
    return { id: node.id, width: size.width, height: size.height, ports: elkPorts, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } }
  })
  return { id: 'root', layoutOptions, children, edges }
}

// Afstand tussen lijnen die naast elkaar op één blokje aankomen, en de
// maximale breedte van zo'n band — bij veel lijnen op één punt (bv. vijftien
// gebundelde partij-lijnen op een ingeklapte kaart) schuiven ze dichter op
// elkaar i.p.v. de halve kaart te beslaan. De band mag hooguit een deel van
// de kaarthoogte beslaan: op een itemrij (~45px) blijft 'ie zo binnen de rij,
// op een ingeklapte kaart (~96px) is er wat meer ruimte.
const FAN_IN_GAP = 5
const FAN_IN_MAX_BAND = 40
const fanInMaxBand = (height) => Math.min(FAN_IN_MAX_BAND, height * 0.4)

// Per aankomstpunt (node + handle) met twee of meer lijnen: een verticale
// verschuiving per lijn, zodat ze naast elkaar landen. Volgorde = de hoogte
// van hun vertrekpunt in de eerste ELK-ronde (`positions`), van boven naar
// beneden — de lijn die van boven komt landt bovenaan, die van onder
// onderaan, zodat ze elkaar vlak vóór het blokje niet hoeven te kruisen. De
// band blijft binnen de kaart (een ingeklapte kaart heeft zijn aankomstpunt
// dicht bij de bovenrand). Levert Map<`${node}#${handle}`, Map<edgeId,
// offsetY>>; leeg als geen enkel punt meer dan één lijn ontvangt.
export function fanInOffsets(graph, sizes, positions) {
  const groups = new Map()
  for (const edge of graph.edges) {
    const key = `${edge.target}#${edge.targetHandle}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(edge)
  }
  const sourceY = (edge) => {
    const position = positions.get(edge.source)
    const size = sizes.get(edge.source)
    if (!position || !size) return 0
    return position.y + (size.handles.get(edge.sourceHandle)?.y ?? size.height / 2)
  }
  const result = new Map()
  for (const [key, edges] of groups) {
    if (edges.length < 2) continue
    const [nodeId, handleId] = key.split('#')
    const size = sizes.get(nodeId)
    if (!size) continue
    const handleY = size.handles.get(handleId)?.y ?? size.height / 2
    const gap = Math.min(FAN_IN_GAP, fanInMaxBand(size.height) / (edges.length - 1))
    let first = -((edges.length - 1) * gap) / 2
    // Band binnen de kaart houden (4px van de rand).
    const top = handleY + first
    const bottom = handleY + first + (edges.length - 1) * gap
    if (top < 4) first += 4 - top
    else if (bottom > size.height - 4) first -= bottom - (size.height - 4)
    const ordered = [...edges].sort((a, b) => sourceY(a) - sourceY(b))
    result.set(key, new Map(ordered.map((edge, i) => [edge.id, first + i * gap])))
  }
  return result
}

// Vertaalt ELK's resultaat terug: posities per node en de lijnpunten per edge
// (start → bochten → einde, in canvascoördinaten). Terugkoppelingen krijgen
// hun punten weer in de echte richting (bron → doel), zie buildElkGraph.
export function applyElkLayout(result, graph) {
  const positions = new Map()
  for (const child of result.children ?? []) positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  const backIds = new Set(graph.edges.filter((edge) => edge.data?.back === true).map((edge) => edge.id))
  const points = new Map()
  for (const edge of result.edges ?? []) {
    const section = edge.sections?.[0]
    if (!section) continue
    const pts = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => [p.x, p.y])
    points.set(edge.id, backIds.has(edge.id) ? pts.reverse() : pts)
  }
  return { positions, points }
}

// Noodlay-out zonder ELK (bv. een layout-fout in de console): kolommen op
// laag, kaarten onder elkaar. Lijnen vallen dan terug op React Flow's eigen
// smoothstep-routing (zie ElkEdge in ChainOverview.jsx).
export function fallbackPositions(graph, sizes, columnGap = 70, rowGap = 28) {
  const byLayer = new Map()
  for (const node of graph.nodes) {
    const layer = node.data?.layer ?? 0
    if (!byLayer.has(layer)) byLayer.set(layer, [])
    byLayer.get(layer).push(node)
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  const positions = new Map()
  let x = 0
  for (const layer of layers) {
    let y = 0
    let widest = 0
    for (const node of byLayer.get(layer)) {
      const size = sizes.get(node.id)
      positions.set(node.id, { x, y })
      y += size.height + rowGap
      widest = Math.max(widest, size.width)
    }
    x += widest + columnGap
  }
  return positions
}
