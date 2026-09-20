import { MarkerType } from 'reactflow'
import { emptyTeamWorkflow } from './storage'
import { orderChain } from './chainLayout'
import { orderTeamsByChain, traceForwardChain } from './teamWorkflow'

// De graafberekening van het ketenoverzicht: teams, koppelingen en externe
// partijen erin, kaarten en lijnen eruit.
//
// Stond in ChainOverview.jsx tussen de schermcomponenten; hier staat hij naast
// chainLayout.js, waar de rest van de ketenwiskunde al zat. Verplaatst, niet
// verbouwd.
//
// De kleuren en streepjespatronen horen bij deze berekening maar worden ook
// door de legenda gebruikt, en zijn daarom geexporteerd -- zo kan de legenda
// nooit uit de pas lopen met de tekening.

// Externe partij: eigen, rustige kleur los van de risico-ernstkleuren.
export const EXT_COLOR = '#5c6b8a'
// Wachtend koppelverzoek: gestippeld i.p.v. een eigen kleur, zodat de
// risicokleur van de lijn intact blijft.
export const PENDING_EDGE_STYLE = { strokeDasharray: '3 4', opacity: 0.8 }
// Terugkoppeling naar een team eerder in de keten: langer streepje, zodat 'ie
// naast een wachtend verzoek herkenbaar blijft.
export const BACK_EDGE_STYLE = { strokeDasharray: '5 4' }
// Gebundelde lijn tussen twee ingeklapte teams: grijs met een teller, geen
// kleur (kleur hoort bij een specifieke koppeling).
export const AGG_COLOR = '#64748b'
// Herkenbaarheidsreeks per koppeling, los van de risico-ernstkleuren.
export const CONNECTION_COLORS = ['#0ea5e9', '#4338ca', '#9333ea', '#0d9488', '#d97706', '#e11d48']

function partyNode(p, layer, selected) {
  return {
    id: `party:${p.key}`,
    type: 'externalParty',
    position: { x: 0, y: 0 },
    data: {
      key: p.key,
      naam: p.naam,
      type: p.type,
      teamCount: new Set([...p.sources.keys(), ...p.sinks.keys()]).size,
      selected,
      layer,
    },
  }
}

function externalEdgeData(p, teamNaam, direction, refs) {
  return { external: true, partyKey: p.key, partyNaam: p.naam, teamNaam, direction, refs }
}

export function computeChainGraph({ teamWorkflows, teamRisk, teamLabels, chainEdgesAll, filteredTeams, focusTeamId, partyGraph, partyOptions, depth, showBackflow, selection }) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  // Zonder focusteam (bij het openen): de hele keten, elk team ingeklapt, in
  // ketenvolgorde — het overzicht om een team uit te kiezen. Mét focusteam:
  // alleen wat de voorwaartse keten vanaf dat team raakt, tot `depth` stappen.
  const overview = !focusTeamId
  const visibleTeams = overview ? orderTeamsByChain(filteredTeams, chainEdgesAll) : traceForwardChain(focusTeamId, filteredTeams, chainEdgesAll).columns.slice(0, depth + 1).flat()
  if (visibleTeams.length === 0) return { nodes: [], edges: [], stream: null }
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.id))
  // Wortel voor de cyclusbreking: het focusteam, of in het overzicht het
  // eerste team in ketenvolgorde.
  const { layerOf, backEdgeIds } = orderChain(overview ? visibleTeams[0].id : focusTeamId, visibleTeamIds, chainEdgesAll)
  // Namen voor álle teams (teamLabels dekt ook gearchiveerde en uitgevinkte
  // teams): een "van/naar {team}"-onderschrift kan naar een team buiten de
  // huidige selectie wijzen, en toonde dan het kale team-id.
  const teamNaamById = { ...teamLabels }
  for (const team of filteredTeams) teamNaamById[team.id] = naamVan(team)
  const layerOfTeam = (teamId) => layerOf.get(teamId) ?? 0

  // Koppelingen tussen twee zichtbare teams. Een koppeling van een team naar
  // zichzelf is geen ketenstap en heeft in een gelaagde tekening geen plek;
  // de items tonen wel hun onderschrift.
  // Per item álle gekoppelde teams: een output kan naar meerdere teams gaan,
  // en het onderschrift somt ze dan op i.p.v. alleen het laatst verwerkte
  // team te tonen.
  const itemLinkedTeams = new Map()
  const addLinkedTeam = (itemId, teamId) => {
    const list = itemLinkedTeams.get(itemId) ?? []
    if (!list.includes(teamId)) itemLinkedTeams.set(itemId, [...list, teamId])
  }
  const links = []
  for (const edge of chainEdgesAll) {
    const sourceShown = visibleTeamIds.has(edge.sourceTeam)
    const targetShown = visibleTeamIds.has(edge.targetTeam)
    if (!sourceShown && !targetShown) continue
    if (sourceShown && edge.sourceOutputId) addLinkedTeam(edge.sourceOutputId, edge.targetTeam)
    if (targetShown && edge.targetInputId) addLinkedTeam(edge.targetInputId, edge.sourceTeam)
    if (!sourceShown || !targetShown || edge.sourceTeam === edge.targetTeam) continue
    const back = backEdgeIds.has(edge.id)
    if (back && !showBackflow) continue
    links.push({ edge, back, pairId: `agg:${edge.sourceTeam}->${edge.targetTeam}` })
  }

  // Een verzoek om een nog niet bestaand tegenhanger-item (linkNieuw) heeft
  // aan één kant geen item-id; die kant krijgt een ghost-rij, zodat de lijn
  // toch aan een item hangt (id 'ghost:<koppeling>').
  const sourceItemId = (edge) => edge.sourceOutputId || `ghost:${edge.id}`
  const targetItemId = (edge) => edge.targetInputId || `ghost:${edge.id}`

  const sel = selection ?? { type: 'none' }
  const selectedTeamId = sel.type === 'card' ? sel.teamId : null
  const selectedEdgeId = sel.type === 'edge' ? sel.id : null
  const selectedItem = sel.type === 'item' ? sel : null
  const selectedPartyKey = sel.type === 'party' ? sel.key : null
  const touches = (link, teamId) => link.edge.sourceTeam === teamId || link.edge.targetTeam === teamId
  // Welke koppelingen "horen bij" een kaart- of lijnselectie: alles aan de
  // geselecteerde kaart, of de (gebundelde) lijn zelf.
  const selectedLinks = selectedTeamId
    ? links.filter((link) => touches(link, selectedTeamId))
    : selectedEdgeId
      ? links.filter((link) => link.edge.id === selectedEdgeId || link.pairId === selectedEdgeId)
      : []

  // --- Externe partijen: elke relatie partij ↔ zichtbaar team, met de
  // items/afhankelijkheden (refs) die die relatie dragen. 'in' = de partij
  // voedt het team (input-items en afhankelijkheden), 'out' = het team levert
  // aan de partij (output-items). Met partyOptions.showDependencies uit
  // vervallen de afhankelijkheids-refs (de gestippelde lijnen — meestal de
  // algemene partijen als CAB of IAM-beheer); een relatie zonder overgebleven
  // refs vervalt, en een partij zonder relaties verdwijnt dan van het canvas.
  // Een geselecteerde partij toont altijd alles wat ze raakt.
  const showDependencies = partyOptions?.showDependencies ?? true
  const drawnRelations = []
  for (const party of partyGraph ?? []) {
    const keepRef = (ref) => showDependencies || party.key === selectedPartyKey || ref.kind !== 'dependency'
    for (const [teamId, refs] of party.sources) {
      const kept = refs.filter(keepRef)
      if (visibleTeamIds.has(teamId) && kept.length > 0) drawnRelations.push({ party, teamId, direction: 'in', refs: kept })
    }
    for (const [teamId, refs] of party.sinks) {
      if (visibleTeamIds.has(teamId) && refs.length > 0) drawnRelations.push({ party, teamId, direction: 'out', refs })
    }
  }
  const relationRefKey = (r, ref) => `${r.party.key}|${r.teamId}|${r.direction}|${ref.kind}:${ref.id}`

  // Herkomst/bestemming van een item: eerst een daadwerkelijke team-koppeling
  // (itemLinkedTeams hierboven, de meest concrete info), dan een externe partij
  // (voor een ketenoverzicht het belangrijkste om te tonen — een item kan
  // zowel via een eigen applicatie lopen als uiteindelijk van een externe
  // partij komen, bv. klantgegevens via het eigen klantportaal maar
  // oorspronkelijk uit een extern klantregister; de externe herkomst weegt
  // welke eigen app het ophaalt), dan de eigen applicatie, dan het generieke
  // bron_type (rol, persoon, stakeholder, omgeving).
  function resolveOrigin(rawItem, appsById) {
    const linkedTeamIds = itemLinkedTeams.get(rawItem.id)
    if (linkedTeamIds?.length) return { kind: 'team', naam: linkedTeamIds.map((id) => teamNaamById[id] ?? id).join(', ') }
    if (rawItem.externalTeam) return { kind: 'extern', naam: rawItem.externalTeam }
    if (rawItem.applicatieId && appsById.has(rawItem.applicatieId)) {
      return { kind: 'systeem', naam: appsById.get(rawItem.applicatieId).naam || '—' }
    }
    if (rawItem.kind === 'in' && rawItem.bronType && rawItem.bronType !== 'team' && rawItem.bronType !== 'systeem') {
      return { kind: 'bronType', bronType: rawItem.bronType }
    }
    return null
  }
  // Alle rijen van een kaart in vaste volgorde: inputs, ghost-inputs,
  // outputs, ghost-outputs.
  function allRows(teamId) {
    const wf = teamWorkflows[teamId] ?? emptyTeamWorkflow()
    const appsById = new Map((wf.applications ?? []).map((a) => [a.id, a]))
    const real = (list, kind) =>
      list.map((item) => ({
        id: item.id,
        label: item.label,
        kind,
        origin: resolveOrigin({ id: item.id, kind, bronType: item.bron_type, applicatieId: item.applicatieId, externalTeam: item.externalTeam }, appsById),
      }))
    const ghosts = (kind) =>
      links
        .filter((link) => (kind === 'in' ? link.edge.targetTeam === teamId && !link.edge.targetInputId : link.edge.sourceTeam === teamId && !link.edge.sourceOutputId))
        .map((link) => ({
          id: `ghost:${link.edge.id}`,
          label: kind === 'in' ? link.edge.targetLabel : link.edge.sourceLabel,
          kind,
          ghost: true,
          origin: { kind: 'ghost', naam: teamNaamById[kind === 'in' ? link.edge.sourceTeam : link.edge.targetTeam] ?? '' },
        }))
    return {
      rows: [...real(wf.inputs ?? [], 'in'), ...ghosts('in'), ...real(wf.outputs ?? [], 'out'), ...ghosts('out')],
      inCount: (wf.inputs ?? []).length,
      outCount: (wf.outputs ?? []).length,
    }
  }
  const rowsByTeam = new Map(visibleTeams.map((team) => [team.id, allRows(team.id)]))

  // --- Stroom vanaf een geselecteerd item of een geselecteerde partij.
  // Stroomafwaarts, over een graaf van items, partijen en teams: een output
  // gaat via zijn ketenkoppeling(en) naar een input elders (één teamgrens,
  // telt als één stap), een input gaat binnen het eigen team door naar álle
  // outputs (het team is een black box: alles wat erin komt kan alles wat
  // eruit gaat beïnvloeden — dezelfde aanname als de ketenvolgorde zelf; kost
  // geen stap), een partij voedt de inputs die haar noemen, een output levert
  // aan de partij die 'm noemt, en een afhankelijkheid van een partij raakt
  // het hele team (dus al zijn outputs). Begrensd op `depth` stappen — de
  // dieptemeter. Daarnaast precies één stap terug: waar het startpunt zelf
  // rechtstreeks vandaan komt (de output/partij die deze input voedt, de
  // outputs die aan deze partij leveren) — niet verder terug, want "wat komt
  // er allemaal vóór dit item" zou via de black-box-aanname meteen de hele
  // keten zijn.
  function computeStream() {
    const forward = new Map()
    const backward = new Map()
    const add = (from, to, cost, tag) => {
      if (!forward.has(from)) forward.set(from, [])
      forward.get(from).push({ to, cost, tag })
      if (cost === 1) {
        if (!backward.has(to)) backward.set(to, [])
        backward.get(to).push({ from, tag })
      }
    }
    for (const [teamId, { rows }] of rowsByTeam) {
      const ins = rows.filter((row) => row.kind === 'in').map((row) => `in:${teamId}:${row.id}`)
      const outs = rows.filter((row) => row.kind === 'out').map((row) => `out:${teamId}:${row.id}`)
      for (const i of ins) for (const o of outs) add(i, o, 0, null)
      for (const o of outs) add(`team:${teamId}`, o, 0, null)
    }
    for (const { edge } of links) add(`out:${edge.sourceTeam}:${sourceItemId(edge)}`, `in:${edge.targetTeam}:${targetItemId(edge)}`, 1, { link: edge.id })
    for (const r of drawnRelations) {
      for (const ref of r.refs) {
        const tag = { relation: relationRefKey(r, ref) }
        if (r.direction === 'in' && ref.kind === 'input') add(`party:${r.party.key}`, `in:${r.teamId}:${ref.id}`, 1, tag)
        else if (r.direction === 'in' && ref.kind === 'dependency') add(`party:${r.party.key}`, `team:${r.teamId}`, 1, tag)
        else if (r.direction === 'out' && ref.kind === 'output') add(`out:${r.teamId}:${ref.id}`, `party:${r.party.key}`, 1, tag)
      }
    }
    const start = selectedItem ? `${selectedItem.kind}:${selectedItem.teamId}:${selectedItem.itemId}` : `party:${selectedPartyKey}`
    const linkIds = new Set()
    const relationKeys = new Set()
    const mark = (tag) => {
      if (!tag) return
      if (tag.link) linkIds.add(tag.link)
      if (tag.relation) relationKeys.add(tag.relation)
    }
    // 0-1-BFS: een stap zonder kosten gaat vóóraan in de rij, zodat elke node
    // met zijn kleinste afstand verwerkt wordt. Elke lijn die binnen de diepte
    // valt hoort bij de stroom, ook als het doel al eerder bereikt was.
    const dist = new Map([[start, 0]])
    const queue = [start]
    while (queue.length > 0) {
      const node = queue.shift()
      const d = dist.get(node)
      for (const { to, cost, tag } of forward.get(node) ?? []) {
        const next = d + cost
        if (next > depth) continue
        mark(tag)
        if (dist.has(to) && dist.get(to) <= next) continue
        dist.set(to, next)
        if (cost === 0) queue.unshift(to)
        else queue.push(to)
      }
    }
    for (const { from, tag } of backward.get(start) ?? []) {
      mark(tag)
      if (!dist.has(from)) dist.set(from, 1)
    }
    const items = new Map()
    const teams = new Set()
    const partyKeys = new Set()
    for (const node of dist.keys()) {
      if (node.startsWith('party:')) {
        partyKeys.add(node.slice('party:'.length))
      } else if (node.startsWith('team:')) {
        teams.add(node.slice('team:'.length))
      } else {
        // 'in:<team>:<item>' — een team-id bevat geen dubbele punt, een
        // item-id (ghost:…) wel.
        const teamStart = node.indexOf(':') + 1
        const itemStart = node.indexOf(':', teamStart) + 1
        const teamId = node.slice(teamStart, itemStart - 1)
        teams.add(teamId)
        if (!items.has(teamId)) items.set(teamId, new Set())
        items.get(teamId).add(node.slice(itemStart))
      }
    }
    return { items, teams, partyKeys, linkIds, relationKeys }
  }
  const stream = selectedItem || selectedPartyKey ? computeStream() : null

  const modeOf = (teamId) => {
    if (selectedTeamId) {
      if (teamId === selectedTeamId) return 'full'
      return selectedLinks.some((link) => touches(link, teamId)) ? 'partial' : 'collapsed'
    }
    if (selectedEdgeId) {
      if (selectedLinks.some((link) => touches(link, teamId))) return 'partial'
      return teamId === focusTeamId ? 'full' : 'collapsed'
    }
    if (stream) {
      // De kaart van het geselecteerde item blijft volledig, zodat een ander
      // item op dezelfde kaart direct aan te klikken is.
      if (selectedItem && teamId === selectedItem.teamId) return 'full'
      if (stream.items.get(teamId)?.size) return 'partial'
      return teamId === focusTeamId ? 'full' : 'collapsed'
    }
    return teamId === focusTeamId ? 'full' : 'collapsed'
  }

  // Per kaart: welke rijen staan er (stand + selectie), en hoeveel echte
  // items blijven verborgen achter "+N andere items".
  const cards = new Map()
  for (const team of visibleTeams) {
    const mode = modeOf(team.id)
    const { rows, inCount, outCount } = rowsByTeam.get(team.id)
    let shown = []
    if (mode === 'full') shown = rows
    else if (mode === 'partial') {
      const wanted = new Set(stream ? stream.items.get(team.id) ?? [] : [])
      if (!stream) {
        for (const link of selectedLinks) {
          if (link.edge.sourceTeam === team.id) wanted.add(sourceItemId(link.edge))
          if (link.edge.targetTeam === team.id) wanted.add(targetItemId(link.edge))
        }
      }
      shown = rows.filter((row) => wanted.has(row.id))
    }
    const realTotal = inCount + outCount
    const realShown = shown.filter((row) => !row.ghost).length
    cards.set(team.id, { mode, rows: shown, more: mode === 'collapsed' ? 0 : realTotal - realShown, inCount, outCount, shownIds: new Set(shown.map((row) => row.id)) })
  }

  // --- Lijnen tussen teams: op itemniveau (eigen kleur) zodra een van beide
  // items zichtbaar is, anders gebundeld per teampaar.
  const linkData = (edge) => ({
    sourceTeamNaam: teamNaamById[edge.sourceTeam] ?? edge.sourceTeam,
    targetTeamNaam: teamNaamById[edge.targetTeam] ?? edge.targetTeam,
    sourceLabel: edge.sourceLabel,
    targetLabel: edge.targetLabel,
    status: edge.status,
    punten: edge.punten ?? [],
  })
  const arrow = (color, size = 14) => ({ type: MarkerType.ArrowClosed, color, width: size, height: size })
  const pendingStyle = (edge) => (edge.status === 'voorgesteld' ? PENDING_EDGE_STYLE : {})
  const inStreamLink = (edge) => (stream ? stream.linkIds.has(edge.id) : undefined)
  const edges = []
  const itemColor = new Map()
  const bundles = new Map()
  let colorIndex = 0
  for (const link of links) {
    const { edge, back, pairId } = link
    const srcId = sourceItemId(edge)
    const tgtId = targetItemId(edge)
    const srcShown = cards.get(edge.sourceTeam).shownIds.has(srcId)
    const tgtShown = cards.get(edge.targetTeam).shownIds.has(tgtId)
    if (!srcShown && !tgtShown) {
      if (!bundles.has(pairId)) bundles.set(pairId, { id: pairId, sourceTeam: edge.sourceTeam, targetTeam: edge.targetTeam, back, links: [] })
      bundles.get(pairId).links.push(edge)
      continue
    }
    // Kleur per output-item i.p.v. per lijn: alle lijnen die uit hetzelfde
    // outputblokje vertrekken (fan-out naar meerdere teams) delen zo één kleur
    // met dat blokje — voorheen hield het blokje alleen de kleur van de laatst
    // getekende lijn over.
    let color = srcId ? itemColor.get(srcId) : undefined
    if (!color) {
      color = CONNECTION_COLORS[colorIndex % CONNECTION_COLORS.length]
      colorIndex += 1
      if (srcShown && srcId) itemColor.set(srcId, color)
    }
    if (tgtShown && tgtId) itemColor.set(tgtId, color)
    // Welke kant van het kaartje een koppeling gebruikt volgt de richting van
    // de lijn: voorwaarts verlaat de lijn de bronkaart rechts en komt links
    // binnen; een terugkoppeling gebruikt de linker-uitgang en rechter-ingang,
    // zodat beide kanten naar elkaar toe wijzen i.p.v. om de eigen kaart heen
    // te lussen. Elk item heeft daarom altijd beide handles.
    const rev = back ? '-rev' : ''
    edges.push({
      id: edge.id,
      source: `focus-card:${edge.sourceTeam}`,
      target: `focus-card:${edge.targetTeam}`,
      sourceHandle: srcShown ? `item-out${rev}:${srcId}` : `card-out${rev}`,
      targetHandle: tgtShown ? `item-in${rev}:${tgtId}` : `card-in${rev}`,
      type: 'elk',
      data: { back, pairId, inStream: inStreamLink(edge), link: linkData(edge) },
      style: { stroke: color, strokeWidth: 2, ...(back ? BACK_EDGE_STYLE : {}), ...pendingStyle(edge) },
      markerEnd: arrow(color),
    })
  }
  for (const bundle of bundles.values()) {
    const pendingCount = bundle.links.filter((edge) => edge.status === 'voorgesteld').length
    const rev = bundle.back ? '-rev' : ''
    edges.push({
      id: bundle.id,
      source: `focus-card:${bundle.sourceTeam}`,
      target: `focus-card:${bundle.targetTeam}`,
      sourceHandle: `card-out${rev}`,
      targetHandle: `card-in${rev}`,
      type: 'elk',
      data: {
        back: bundle.back,
        aggregated: true,
        count: bundle.links.length,
        pendingCount,
        inStream: stream ? bundle.links.some((edge) => stream.linkIds.has(edge.id)) : undefined,
        sourceTeamNaam: teamNaamById[bundle.sourceTeam] ?? bundle.sourceTeam,
        targetTeamNaam: teamNaamById[bundle.targetTeam] ?? bundle.targetTeam,
        links: bundle.links.map(linkData),
      },
      // Een bundel die alléén uit wachtende verzoeken bestaat oogt als zo'n
      // verzoek; gemengd blijft de lijn doorgetrokken en zegt de amber punt
      // op de teller het.
      style: { stroke: AGG_COLOR, strokeWidth: 2, ...(bundle.back ? BACK_EDGE_STYLE : {}), ...(pendingCount === bundle.links.length ? PENDING_EDGE_STYLE : {}) },
      markerEnd: arrow(AGG_COLOR),
    })
  }

  // --- Externe partijen als kaartje, met per relatie een lijn per getoond
  // item (aan het item-handle) en één gebundelde lijn (met teller) aan de
  // kaart voor de rest: afhankelijkheden, en items die op een ingeklapte of
  // gedeeltelijke kaart niet getoond worden.
  // Een gestippelde lijn is een afhankelijkheid van een partij (geen
  // item-koppeling); met alle partijen in beeld zijn dat er veel — daarom
  // lichter dan de doorgetrokken itemlijnen, zodat die de structuur blijven
  // dragen.
  const extStyle = (dashed) => ({ stroke: EXT_COLOR, strokeWidth: 1.5, ...(dashed ? BACK_EDGE_STYLE : {}), opacity: dashed ? 0.55 : 0.85 })
  const partyNodes = []
  const drawnParties = [...new Map(drawnRelations.map((r) => [r.party.key, r.party])).values()]
  for (const party of drawnParties) {
    const rels = drawnRelations.filter((r) => r.party.key === party.key)
    const sourceLayers = rels.filter((r) => r.direction === 'in').map((r) => layerOfTeam(r.teamId))
    const sinkLayers = rels.filter((r) => r.direction === 'out').map((r) => layerOfTeam(r.teamId))
    // Plaatsing: tussen de teams in als alles wat aan haar levert vóór alles
    // ligt wat ze voedt (A → partij → C, geen cyclus); anders links van de
    // keten, waarbij wat aan haar levert als terugkoppeling (gestippeld, via
    // de -rev-handles) naar links terugloopt; alleen ontvangen = rechts.
    const minSource = sourceLayers.length > 0 ? Math.min(...sourceLayers) : null
    const maxSink = sinkLayers.length > 0 ? Math.max(...sinkLayers) : null
    const between = minSource !== null && maxSink !== null && maxSink < minSource
    const leftOfChain = minSource !== null && !between
    const layer = leftOfChain ? minSource - 1 : (maxSink ?? -1) + 1
    partyNodes.push(partyNode(party, layer, party.key === selectedPartyKey))
    for (const r of rels) {
      const card = cards.get(r.teamId)
      const teamNaam = teamNaamById[r.teamId] ?? r.teamId
      const rowRefs = r.refs.filter((ref) => (ref.kind === 'input' || ref.kind === 'output') && card.shownIds.has(ref.id))
      const restRefs = r.refs.filter((ref) => !rowRefs.includes(ref))
      const inStreamRef = (ref) => stream.relationKeys.has(relationRefKey(r, ref))
      const inStream = (refs) => (stream ? refs.some(inStreamRef) : undefined)
      if (r.direction === 'in') {
        for (const ref of rowRefs) {
          edges.push({
            id: `hub:${party.key}->${r.teamId}:${ref.id}`,
            source: `party:${party.key}`,
            target: `focus-card:${r.teamId}`,
            sourceHandle: 'right-source',
            targetHandle: `item-in:${ref.id}`,
            type: 'elk',
            data: { count: 1, inStream: inStream([ref]), ...externalEdgeData(party, teamNaam, 'in', [ref]) },
            style: extStyle(false),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
        if (restRefs.length > 0) {
          edges.push({
            id: `hub:${party.key}->${r.teamId}`,
            source: `party:${party.key}`,
            target: `focus-card:${r.teamId}`,
            sourceHandle: 'right-source',
            targetHandle: 'card-in',
            type: 'elk',
            data: { count: restRefs.length, inStream: inStream(restRefs), ...externalEdgeData(party, teamNaam, 'in', restRefs) },
            style: extStyle(restRefs.some((ref) => ref.kind === 'dependency')),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
      } else {
        const rev = leftOfChain ? '-rev' : ''
        const targetHandle = leftOfChain ? 'right-target' : 'left-target'
        for (const ref of rowRefs) {
          edges.push({
            id: `hub:${r.teamId}:${ref.id}->${party.key}`,
            source: `focus-card:${r.teamId}`,
            target: `party:${party.key}`,
            sourceHandle: `item-out${rev}:${ref.id}`,
            targetHandle,
            type: 'elk',
            data: { back: leftOfChain, count: 1, inStream: inStream([ref]), ...externalEdgeData(party, teamNaam, 'out', [ref]) },
            style: extStyle(false),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
        if (restRefs.length > 0) {
          edges.push({
            id: `hub:${r.teamId}->${party.key}`,
            source: `focus-card:${r.teamId}`,
            target: `party:${party.key}`,
            sourceHandle: `card-out${rev}`,
            targetHandle,
            type: 'elk',
            data: { back: leftOfChain, count: restRefs.length, inStream: inStream(restRefs), ...externalEdgeData(party, teamNaam, 'out', restRefs) },
            style: extStyle(false),
            markerEnd: arrow(EXT_COLOR, 12),
          })
        }
      }
    }
  }

  // Kaarten die in de stroom van een geselecteerd item/partij liggen krijgen
  // een lichte ring (het startpunt zelf niet: dat is al amber/geselecteerd).
  const highlightTeams = new Set(stream ? [...stream.teams].filter((teamId) => teamId !== selectedItem?.teamId) : [])

  // Kaarten in ketenvolgorde (focusteam eerst): ELK gebruikt die invoer-
  // volgorde als tie-breaker (considerModelOrder), zodat dezelfde data ook
  // telkens dezelfde tekening oplevert. Geen positie: die komt van ELK.
  const nodes = visibleTeams.map((team, index) => {
    const card = cards.get(team.id)
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    return {
      id: `focus-card:${team.id}`,
      type: 'focusCard',
      position: { x: 0, y: 0 },
      data: {
        teamId: team.id,
        label: naamVan(team),
        risk,
        depCount: risk.count ?? 0,
        inCount: card.inCount,
        outCount: card.outCount,
        mode: card.mode,
        rows: card.rows.map((row) => ({ ...row, color: itemColor.get(row.id) ?? null })),
        more: card.more,
        isFocus: !overview && index === 0,
        selected: team.id === selectedTeamId,
        highlight: highlightTeams.has(team.id),
        layer: layerOfTeam(team.id),
      },
    }
  })

  // Samenvatting van de stroom voor het detailvak.
  const streamSummary = stream
    ? {
        teamIds: [...stream.teams].filter((teamId) => teamId !== selectedItem?.teamId),
        linkCount: stream.linkIds.size,
        partyKeys: [...stream.partyKeys].filter((key) => key !== selectedPartyKey),
        item: selectedItem ? (rowsByTeam.get(selectedItem.teamId)?.rows.find((row) => row.id === selectedItem.itemId) ?? null) : null,
      }
    : null

  return { nodes: [...nodes, ...partyNodes], edges, stream: streamSummary }
}
