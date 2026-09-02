// Zuivere functie die ketenkoppelingen herleidt uit de teamWorkflows: een
// input van team B die expliciet verwijst naar een output-item van team A
// (via id-referentie, nooit tekst-matching) levert één gekoppelde edge op.
// Niet-gekoppelde input/output-items worden hier simpelweg niet in
// opgenomen — de aanroeper rendert ze los, nooit als foutstatus.
export function resolveChainEdges(teamWorkflows) {
  const edges = []

  for (const [team, workflow] of Object.entries(teamWorkflows)) {
    for (const input of workflow.inputs ?? []) {
      if (!input.linkedTeam || !input.linkedOutputId) continue
      const sourceWorkflow = teamWorkflows[input.linkedTeam]
      const sourceOutput = sourceWorkflow?.outputs?.find((o) => o.id === input.linkedOutputId)
      if (!sourceOutput) continue
      edges.push({
        id: `${input.linkedTeam}:${sourceOutput.id}->${team}:${input.id}`,
        sourceTeam: input.linkedTeam,
        sourceOutputId: sourceOutput.id,
        sourceLabel: sourceOutput.label,
        targetTeam: team,
        targetInputId: input.id,
        targetLabel: input.label,
      })
    }
  }

  return edges
}

// Kernberekening achter zowel orderTeamsByChain als layerTeamsByChain hieronder:
// topologische laag-toewijzing + barycenter-heuristiek i.p.v. de toevallige volgorde
// waarin teams uit de context komen. Geen externe graph-layout-bibliotheek nodig voor
// deze schaal (enkele teams); zelfde principe als bekende tools (dagre e.d.), hier
// eenvoudig zelf geïmplementeerd. Geeft de lagen ongeflattened terug (Map<laag, Team[]>,
// al barycenter-gesorteerd binnen elke laag) plus de teams zonder ketenkoppeling — de
// aanroepers hieronder bepalen zelf of ze dit tot één rij samenvoegen (orderTeamsByChain)
// of laag-voor-laag gebruiken voor een 2D-plaatsing (layerTeamsByChain).
function computeLayerGroups(teams, chainEdges) {
  const teamIds = new Set(teams.map((t) => t.id))
  const outgoing = new Map(teams.map((t) => [t.id, []]))
  const incoming = new Map(teams.map((t) => [t.id, []]))
  const inDegree = new Map(teams.map((t) => [t.id, 0]))
  const hasAnyConnection = new Set()

  for (const edge of chainEdges) {
    if (!teamIds.has(edge.sourceTeam) || !teamIds.has(edge.targetTeam) || edge.sourceTeam === edge.targetTeam) continue
    outgoing.get(edge.sourceTeam).push(edge.targetTeam)
    incoming.get(edge.targetTeam).push(edge.sourceTeam)
    inDegree.set(edge.targetTeam, inDegree.get(edge.targetTeam) + 1)
    hasAnyConnection.add(edge.sourceTeam)
    hasAnyConnection.add(edge.targetTeam)
  }

  // Laag-toewijzing (Kahn's-algoritme): begin bij teams zonder inkomende
  // ketenverwijzing, werk laagsgewijs verder via hun uitgaande verwijzingen. Een team
  // dat door een cyclus (zeldzaam: twee teams die over-en-weer aan elkaar leveren)
  // nooit op 0 resterende in-degree komt, blijft niet oneindig wachten — zie de
  // terugvalstap na de lus, die zulke restanten gewoon een laag ná de rest zet.
  const layer = new Map(teams.map((t) => [t.id, 0]))
  const remaining = new Map(inDegree)
  const processed = new Set()
  let frontier = teams.filter((t) => hasAnyConnection.has(t.id) && inDegree.get(t.id) === 0).map((t) => t.id)
  frontier.forEach((id) => processed.add(id))

  while (frontier.length > 0) {
    const next = []
    for (const id of frontier) {
      for (const targetId of outgoing.get(id)) {
        layer.set(targetId, Math.max(layer.get(targetId), layer.get(id) + 1))
        remaining.set(targetId, remaining.get(targetId) - 1)
        if (remaining.get(targetId) === 0 && !processed.has(targetId)) {
          processed.add(targetId)
          next.push(targetId)
        }
      }
    }
    frontier = next
  }
  const maxLayer = Math.max(0, ...[...layer.values()])
  for (const t of teams) {
    if (hasAnyConnection.has(t.id) && !processed.has(t.id)) layer.set(t.id, maxLayer + 1)
  }

  // Groepeer per laag, en sorteer binnen een laag op de gemiddelde eindpositie van de
  // directe voorgangers (barycenter-heuristiek, één pass) — vermindert kruisende
  // lijnen zonder een volledige graph-layout-bibliotheek nodig te hebben.
  const connectedTeams = teams.filter((t) => hasAnyConnection.has(t.id))
  const layerGroups = new Map()
  for (const t of connectedTeams) {
    const l = layer.get(t.id)
    if (!layerGroups.has(l)) layerGroups.set(l, [])
    layerGroups.get(l).push(t)
  }

  // columnIndex blijft een doorlopende teller over álle lagen heen (i.p.v. per laag
  // opnieuw bij 0 beginnend) — puur als sorteersleutel voor de barycenter-heuristiek
  // van de eerstvolgende laag; de output hieronder blijft keurig per laag gegroepeerd.
  const columnIndex = new Map()
  let runningIndex = 0
  const sortedLayers = new Map()
  for (const l of [...layerGroups.keys()].sort((a, b) => a - b)) {
    const withBarycenter = layerGroups.get(l).map((t) => {
      const positions = incoming.get(t.id).map((id) => columnIndex.get(id)).filter((v) => v !== undefined)
      const barycenter = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : Infinity
      return { team: t, barycenter }
    })
    withBarycenter.sort((a, b) => a.barycenter - b.barycenter)
    const sortedTeams = withBarycenter.map(({ team }) => team)
    sortedTeams.forEach((team) => columnIndex.set(team.id, runningIndex++))
    sortedLayers.set(l, sortedTeams)
  }

  // Teams zonder enige ketenverbinding horen niet tussen de geordende keten — die
  // blijven los, achteraan, in hun oorspronkelijke relatieve volgorde (zelfde "nooit
  // als foutstatus" patroon als de rest van de app voor ongekoppelde data).
  const isolated = teams.filter((t) => !hasAnyConnection.has(t.id))
  return { layerGroups: sortedLayers, isolated }
}

// Ordent teams op ketenvolgorde (topologische laag + barycenter-heuristiek) i.p.v. de
// toevallige volgorde waarin ze uit de context komen — voorkomt dat verbindingslijnen
// dwars over tussenliggende, niet-gerelateerde teamkolommen heen moeten lopen.
export function orderTeamsByChain(teams, chainEdges) {
  const { layerGroups, isolated } = computeLayerGroups(teams, chainEdges)
  return [...[...layerGroups.values()].flat(), ...isolated]
}

// Dezelfde laagindeling als orderTeamsByChain, maar ongeflattened — voor de gelaagde
// 2D-plaatsing in de overview van Ketenoverzicht (kolom = laag, rij = positie binnen de
// laag), i.p.v. alle teams op één vaste horizontale rij te dwingen.
export function layerTeamsByChain(teams, chainEdges) {
  const { layerGroups, isolated } = computeLayerGroups(teams, chainEdges)
  return { layers: [...layerGroups.values()], isolated }
}

// Groepeert de item-niveau ketenkoppelingen (resolveChainEdges) tot één
// koppeling per teampaar, voor de geaggregeerde ketenstroom-weergave
// (Ketenoverzicht, overview-modus). Zelfkoppelingen worden uitgesloten —
// orderTeamsByChain behandelt zo'n team ook al niet als "verbonden".
export function aggregateChainLinks(chainEdges) {
  const groups = new Map()
  for (const edge of chainEdges) {
    if (edge.sourceTeam === edge.targetTeam) continue
    const key = `${edge.sourceTeam}->${edge.targetTeam}`
    if (!groups.has(key)) {
      groups.set(key, { id: `chain-agg:${key}`, sourceTeam: edge.sourceTeam, targetTeam: edge.targetTeam, links: [] })
    }
    groups.get(key).links.push(edge)
  }
  return [...groups.values()]
}

// Volgt de keten voorwaarts vanaf één gekozen team, laag voor laag (BFS): elke
// keer dat een output van het huidige team naar een ander team gaat, komt dat
// team in de eerstvolgende kolom — net zo lang als de keten reikt. Een team
// dat al eerder in de keten voorkomt (incl. het focusteam zelf bij een
// cyclus) wordt niet nogmaals toegevoegd — de aanroeper herkent zo'n
// koppeling zelf via columnOf (doel-kolom <= bron-kolom) en tekent 'm als
// terugkoppeling i.p.v. als nieuwe stap. Voorkomt oneindig doorlopen bij een
// cyclus in de data (bv. Casio -> Sterke verhalen -> Equinox -> Casio, zoals
// in de mockdata voorkomt).
export function traceForwardChain(focusTeamId, teams, chainEdges) {
  const teamIds = new Set(teams.map((t) => t.id))
  if (!teamIds.has(focusTeamId)) return { columns: [], columnOf: new Map() }

  const outgoing = new Map(teams.map((t) => [t.id, []]))
  for (const edge of chainEdges) {
    if (edge.sourceTeam === edge.targetTeam) continue
    if (!teamIds.has(edge.sourceTeam) || !teamIds.has(edge.targetTeam)) continue
    outgoing.get(edge.sourceTeam)?.push(edge.targetTeam)
  }

  const byId = new Map(teams.map((t) => [t.id, t]))
  const columnOf = new Map([[focusTeamId, 0]])
  const columns = [[byId.get(focusTeamId)]]
  let frontier = [focusTeamId]
  while (frontier.length > 0) {
    const next = []
    for (const id of frontier) {
      for (const targetId of outgoing.get(id) ?? []) {
        if (!columnOf.has(targetId)) {
          columnOf.set(targetId, columns.length)
          next.push(targetId)
        }
      }
    }
    if (next.length === 0) break
    const unique = [...new Set(next)]
    columns.push(unique.map((id) => byId.get(id)).filter(Boolean))
    frontier = unique
  }
  return { columns, columnOf }
}
