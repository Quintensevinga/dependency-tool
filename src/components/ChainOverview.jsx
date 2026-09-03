import { useEffect, useMemo, useState } from 'react'
import { BaseEdge, Handle, MarkerType, Panel, Position, ReactFlowProvider, useReactFlow, useUpdateNodeInternals } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { RISK_LEVELS } from '../data/constants'
import { calculateRisk, riskLevelRank } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { translateRiskLevel, translateBronType } from '../i18n/labels'
import { resolveChainEdges, orderTeamsByChain, layerTeamsByChain, aggregateChainLinks, traceForwardChain } from '../lib/teamWorkflow'
import { emptyTeamWorkflow } from '../lib/storage'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useMergedLayout } from './flow/useMergedLayout'
import TeamFilterPanel from './TeamFilterPanel'
import ScopeToggle from './ScopeToggle'

function highestRisk(deps) {
  let best = { level: 'Laag', score: 0 }
  for (const d of deps) {
    const r = calculateRisk(d)
    if (r.score > best.score) best = r
  }
  return best
}

function TeamHeaderNode({ id, data }) {
  const { t, language } = useLanguage()
  const style = riskStyle(data.risk.level)
  const dimmed = data.dimmed || data.groupKind === 'context'

  // De IN/OUT-rijhandles hieronder verschijnen/verdwijnen dynamisch met
  // data.expanded — in tegenstelling tot de zes teamhandles hieronder (altijd
  // aanwezig) moet reactflow hier expliciet verteld worden dat de handle-set
  // van deze node is gewijzigd, anders blijven eerder gemeten handle-posities
  // hangen en klopt de aanhechting van edges niet meer na het uit-/inklappen.
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [data.expanded, id, updateNodeInternals])

  return (
    // Gedimd i.p.v. verborgen bij een actief risicofilter of "Toon context":
    // een team wegfilteren zou de keten zelf doorknippen, terwijl dat team er
    // nog steeds in zit — of, bij context, bewust even op de achtergrond staat.
    <div
      className={`relative cursor-pointer rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md transition-opacity hover:shadow-lg ${data.expanded ? 'w-80' : 'w-52'}`}
      style={{ borderColor: data.count > 0 ? style.hex : '#cbd5e1', opacity: dimmed ? 0.4 : 1 }}
      title={
        data.dimmed
          ? t('chain.dimmedByRiskFilter')
          : data.expandable
            ? data.pinned
              ? t('chain.clickToUnpinHint')
              : t('chain.clickToPinHint')
            : t('chain.clickToFocusHint')
      }
    >
      {/* Zes met een expliciete id onderscheiden handles: nodig zodra een node
          meerdere handles van hetzelfde type heeft (reactflow-vereiste). Altijd
          aanwezig, ook in focusmodus — die zet nooit sourceHandle/targetHandle
          op zijn edges en blijft dus het eerst-gedeclareerde paar (right-source/
          left-target) gebruiken. De geaggregeerde overview-edges (zie
          computeChainOverviewLayout) kiezen bewust welke handle-id ze gebruiken,
          afhankelijk van naburige vs. overgeslagen kolommen — of, zodra dit team
          is uitgeklapt, springen ze naar de specifieke item-handle hieronder. */}
      <Handle type="source" position={Position.Right} id="right-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ opacity: 0.4 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Right} id="right-target" style={{ opacity: 0.4 }} />
      <Handle type="source" position={Position.Top} id="top-source" style={{ opacity: 0.4 }} />
      <Handle type="target" position={Position.Top} id="top-target" style={{ opacity: 0.4 }} />
      <div className="text-sm font-semibold text-slate-800">{data.label}</div>
      {data.count > 0 ? (
        <div className={`mt-1 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {translateRiskLevel(data.risk.level, language)} · {data.count}
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-400">{t('graph.noDeps')}</div>
      )}
      {data.empty && <div className="mt-1 text-[11px] italic text-slate-400">{t('chain.emptyTeam')}</div>}
      {data.expanded && (
        <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">in</div>
            {data.workflow.inputs.map((input) => (
              <div key={input.id} className="relative rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                <Handle type="target" position={Position.Left} id={`item-in:${input.id}`} style={{ opacity: 0.4 }} />
                {input.label || '—'}
              </div>
            ))}
            {data.workflow.inputs.length === 0 && <div className="text-[11px] text-slate-300">—</div>}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">out</div>
            {data.workflow.outputs.map((output) => (
              <div key={output.id} className="relative rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                {output.label || '—'}
                <Handle type="source" position={Position.Right} id={`item-out:${output.id}`} style={{ opacity: 0.4 }} />
              </div>
            ))}
            {data.workflow.outputs.length === 0 && <div className="text-[11px] text-slate-300">—</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// Klein, decoratief label boven een groep kolommen — puur een tekstnode, geen
// interactie. Gebruikt door de overview-modus voor de "Geen ketenkoppeling"-
// tray.
function ChainGroupLabelNode({ data }) {
  return <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{data.label}</div>
}

// Zichtbare zoom-toolbar boven het canvas (i.p.v. enkel React Flow's kleine
// standaard knoppen linksonder) — moet binnen een ReactFlowProvider zitten
// om via useReactFlow() bij de zoom/fitView-acties van déze canvas-instantie
// te kunnen.
function ChainZoomToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { t } = useLanguage()
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => zoomOut()}
        title={t('chain.zoomOut')}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => fitView({ padding: 0.15, duration: 200 })}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {t('chain.fitToScreen')}
      </button>
      <button
        type="button"
        onClick={() => zoomIn()}
        title={t('chain.zoomIn')}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50"
      >
        +
      </button>
    </div>
  )
}

// Past het canvas opnieuw in beeld zodra de getoonde teamselectie wijzigt, of
// wanneer de zijbalk *definitief* wisselt (open/iconen/auto) en zo de
// beschikbare breedte permanent verandert (fitKey bevat sidebarMode).
// ReactFlow's fitView-prop werkt alleen bij de eerste render; zonder dit bleef
// na het aanzetten van de focusmodus de uitgezoomde transform van het volledige
// overzicht staan, waardoor de drie overgebleven kolommen buiten beeld vielen.
function ChainAutoFit({ fitKey }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    // 200ms i.p.v. een enkele rAF: dekt zowel de React Flow-commit-lag van
    // nieuwe nodes als de CSS-transitie van <main>'s padding-left bij een
    // sidebarMode-wissel, zodat er tegen de uiteindelijke bounds gefit wordt.
    const id = window.setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 200)
    return () => window.clearTimeout(id)
  }, [fitKey, fitView])
  return null
}

const OV_ITEM_ROW_BASE_HEIGHT = 30 // één regel + padding + tussenruimte
const OV_ITEM_ROW_EXTRA_LINE = 14 // extra hoogte per regel die terugloopt
const OV_ITEM_CHARS_PER_LINE = 16 // ruwe, bewust voorzichtige schatting voor een kolom van ~130px op 11px tekst

// Schatting van de gerenderde hoogte van één IN/OUT-rijtje op basis van de
// labellengte — puur uit data, geen DOM-meting (die zou een meet-
// terugkoppelingslus introduceren, bewust vermeden in dit bestand). Zonder dit
// ging elk rijtje voor een vaste hoogte door, ook als de tekst in de
// werkelijke, smalle kolom over meerdere regels terugloopt — met een te lage
// geschatte kaarthoogte en dus overlap met de kaart/tray eronder tot gevolg.
// Gedeeld tussen computeFocusChainLayout en computeChainOverviewLayout.
function estimateItemRowHeight(label) {
  const lines = Math.max(1, Math.ceil((label?.length || 1) / OV_ITEM_CHARS_PER_LINE))
  return OV_ITEM_ROW_BASE_HEIGHT + (lines - 1) * OV_ITEM_ROW_EXTRA_LINE
}

// Vaste, kleine kwalitatieve kleurenreeks voor Focusmodus: elke specifieke
// output→input-relatie krijgt zijn eigen kleur (cyclisch toegewezen), zowel op
// de kaartranden als op de verbindingslijn — zo is in één oogopslag te zien
// welke twee kaartjes bij elkaar horen, ook als er meerdere lijnen door
// elkaar heen lopen. Bewust geen stoplichtkleuren (CLAUDE.md); dit is een
// eigen, herkenbaarheids-kleurenreeks, los van de risico-ernstkleuren in
// riskStyles.js.
const CONNECTION_COLORS = ['#0ea5e9', '#4338ca', '#9333ea', '#0d9488', '#d97706', '#e11d48']

const FC_CARD_WIDTH = 230
const FC_COLUMN_GAP = 70
const FC_ROW_GAP = 28
const FC_CARD_HEADER_HEIGHT = 55
const BACKFLOW_DIP = 70
const BACKFLOW_LANE_GAP = 22
const SIDESTEP_BULGE = 45
const SIDESTEP_LANE_GAP = 24

function FocusChainCardNode({ id, data }) {
  const { t, language } = useLanguage()

  // De item-handles hieronder verschijnen/verdwijnen met de inhoud van deze
  // ene kaart (bv. na een wijziging op de teampagina) — reactflow moet
  // expliciet verteld worden dat de handle-set is gewijzigd, anders klopt de
  // aanhechting van edges niet meer (zelfde patroon als de overview-kaart).
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [data.items, id, updateNodeInternals])

  return (
    <div
      className="relative cursor-pointer rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-md hover:shadow-lg"
      style={{ width: FC_CARD_WIDTH, borderColor: data.isFocus ? '#2a5f8a' : '#cbd5e1' }}
      title={t('chain.clickToFocusHint')}
    >
      <div className="text-sm font-semibold text-slate-800">{data.label}</div>
      <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2">
        {data.items.map((item) => {
          const active = data.activeItemIds?.has(item.id) ?? false
          const activeHandleStyle = { opacity: 1, width: 9, height: 9, background: '#d97706' }
          return (
            <div
              key={item.id}
              className={`relative rounded border px-2 py-1 text-[11px] text-slate-600 transition-colors ${active ? 'bg-amber-50 ring-2 ring-amber-400' : 'bg-slate-50'}`}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: item.color ?? '#cbd5e1',
                borderTopColor: active ? '#fbbf24' : '#e2e8f0',
                borderRightColor: active ? '#fbbf24' : '#e2e8f0',
                borderBottomColor: active ? '#fbbf24' : '#e2e8f0',
              }}
            >
              {item.kind === 'in' && (
                <>
                  {/* Twee handles op hetzelfde inputitem: links voor een
                      voorwaartse koppeling (bron ligt links, dus komt van
                      links binnen), rechts voor een terugkoppeling (bron ligt
                      rechts van dit kaartje in de keten) — welke van de twee
                      een edge daadwerkelijk gebruikt bepaalt
                      computeFocusChainLayout op basis van kolomrichting, niet
                      een vast links/rechts-schema. Zonder dit moest een
                      terugkoppeling altijd aan de kant "tegen de rijrichting
                      in" aankoppelen en dus dwars om de eigen kaart heen
                      lussen om er te komen. */}
                  <Handle type="target" position={Position.Left} id={`item-in:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                  <Handle type="target" position={Position.Right} id={`item-in-rev:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                </>
              )}
              <span className="block text-[8px] font-medium uppercase tracking-wide text-slate-400">{item.kind === 'in' ? 'in' : 'out'}</span>
              {item.label || '—'}
              {itemOriginCaption(item, t, language) && <span className="block text-[9px] text-slate-400">{itemOriginCaption(item, t, language)}</span>}
              {item.kind === 'out' && (
                <>
                  <Handle type="source" position={Position.Right} id={`item-out:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                  <Handle type="source" position={Position.Left} id={`item-out-rev:${item.id}`} style={active ? activeHandleStyle : { opacity: 0.4 }} />
                </>
              )}
            </div>
          )
        })}
        {data.items.length === 0 && <div className="text-[11px] italic text-slate-300">—</div>}
      </div>
    </div>
  )
}

// Elk item toont altijd waar het vandaan komt / naartoe gaat — niet alleen
// bij een team-koppeling (bestond al), maar ook wanneer het door een eigen
// applicatie/systeem gegenereerd wordt, of van een rol/persoon/stakeholder/
// omgeving komt, of naar een externe partij gaat. Zonder dit oogde het
// willekeurig welke kaartjes wél en welke geen herkomst toonden.
function itemOriginCaption(item, t, language) {
  const origin = item.origin
  if (!origin) return null
  if (origin.kind === 'team') return item.kind === 'in' ? t('chain.itemFromTeam', { team: origin.naam }) : t('chain.itemToTeam', { team: origin.naam })
  if (origin.kind === 'systeem') return item.kind === 'in' ? t('chain.itemFromSystem', { naam: origin.naam }) : t('chain.itemViaSystem', { naam: origin.naam })
  if (origin.kind === 'bronType') return t('chain.itemFromBronType', { type: translateBronType(origin.bronType, language) })
  return t('chain.itemExternal', { naam: origin.naam })
}

const nodeTypes = { chainHeader: TeamHeaderNode, focusCard: FocusChainCardNode, chainGroupLabel: ChainGroupLabelNode }

// Eigen edge voor een terugkoppeling (een koppeling die niet voorwaarts naar
// een nieuwe kolom gaat, maar terug naar een team dat al eerder in de keten
// staat — incl. het focusteam zelf bij een cyclus): reactflow's ingebouwde
// edge-types routeren altijd tussen de daadwerkelijke handle-posities, wat bij
// "terug naar links" een lelijke/kruisende lijn zou geven. Deze edge tekent
// zelf één rustige boog onderlangs — vaste, bescheiden marge i.p.v. meeschalen
// met de absolute y-positie (dat laatste schoot in een eerdere ronde van dit
// scherm honderden pixels door, zie git-historie); focusketens zijn klein
// genoeg dat een vaste marge ruim voldoende is.
function FocusBackflowEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd, data }) {
  // `data.dip` komt kant-en-klaar uit computeFocusChainLayout: de laagste
  // kaartrand van de HELE weergave (ongeacht welke kolommen deze specifieke
  // koppeling overspant) plus een oplopende marge per terugkoppeling
  // (laneIndex-volgorde). Een marge t.o.v. de eigen bron/doel-y (eerdere
  // versie) schoot bij hoge kaarten dwars door de kaarten ertussen; onder de
  // laagste kaart van de hele tekening is altijd vrije ruimte.
  const dip = data.dip
  const path = `M ${sourceX},${sourceY} C ${sourceX},${dip} ${targetX},${dip} ${targetX},${targetY}`
  return <BaseEdge path={path} style={{ ...style, strokeDasharray: '5 4' }} markerEnd={markerEnd} />
}

// Voorwaartse koppeling tussen twee item-handles: een gewone smoothstep-edge
// routeert rechthoekig op basis van de handle-richting en kan daardoor ver
// boven de kaartenrij uitschieten zodra bron- en doelrij ver uit elkaar
// liggen (getest: zichtbaar over de bovenkant van tussenliggende kaarten).
// Deze eigen, simpele kubieke boog met horizontale aanloop/aankomst blijft
// per definitie tussen de bron- en doel-y — dus nooit "over" een kaart heen.
function FocusForwardEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd }) {
  const midX = (sourceX + targetX) / 2
  const path = `M ${sourceX},${sourceY} C ${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}

// Koppeling tussen twee teams in DEZELFDE kolom (boven/onder elkaar gestapeld,
// bv. Team Tiem → Team Polis): de onderlangse boog van FocusBackflowEdge werkt
// hier averechts — bron en doel delen vrijwel dezelfde x, dus de afdaling
// onder de héle tekening en weer omhoog naar het doel loopt bijna loodrecht
// dwars door het doelkaartje heen zodra dat de hoogste kaart van de tekening
// is (getest: 70-90% van de lijnlengte bleek verborgen). Deze boogt in plaats
// daarvan zijwaarts uit, buiten de kolom om — nooit verticaal door een kaart
// die er toch al naast staat.
function FocusSidestepEdge({ sourceX, sourceY, targetX, targetY, style, markerEnd, data }) {
  const bulge = data.bulgeX
  const path = `M ${sourceX},${sourceY} C ${bulge},${sourceY} ${bulge},${targetY} ${targetX},${targetY}`
  return <BaseEdge path={path} style={{ ...style, strokeDasharray: '5 4' }} markerEnd={markerEnd} />
}

const focusEdgeTypes = { focusBackflow: FocusBackflowEdge, focusForward: FocusForwardEdge, focusSidestep: FocusSidestepEdge }

// Focusmodus-lay-out: voorwaartse BFS vanaf één gekozen team (traceForwardChain,
// lib/teamWorkflow.js) i.p.v. de vorige inkomend/focus/uitgaand-swimlanes.
// Elke output die naar een ander (nog niet getoond) team gaat, zet dat team in
// de eerstvolgende kolom; van daaruit gaat het weer verder zolang de keten
// reikt. Een koppeling naar een team dat al eerder in de keten staat (incl.
// het focusteam zelf bij een cyclus) wordt niet als nieuwe kolom getekend,
// maar als terugkoppeling (FocusBackflowEdge hierboven). Elk team toont al
// zijn eigen input- én outputitems als één gestapelde lijst; alleen items die
// naar een óók zichtbare kaart koppelen krijgen een kleur + lijn — een item
// gekoppeld aan een team buiten deze weergave toont enkel een "van/naar
// {team}"-onderschrift, nooit een fantoom-lijn naar een niet-getoonde kaart.
//
// Deelt zijn argumentenlijst met computeChainOverviewLayout (useMergedLayout
// vereist een deps-array met stabiele lengte, ongeacht welke van de twee
// functies actief is) — elke functie gebruikt alleen wat 'm aangaat en
// negeert de rest (`_prefix`).
function computeFocusChainLayout(
  teamWorkflows,
  teamRisk,
  teamLabels = {},
  chainEdgesAll = [],
  _layeredTeams,
  _noConnectionLabel,
  _expandedTeamIds,
  _pinnedTeamIds,
  filteredTeams = [],
  focusTeamId = '',
) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const { columns, columnOf } = traceForwardChain(focusTeamId, filteredTeams, chainEdgesAll)
  if (columns.length === 0) return { nodes: [], edges: [] }

  const teamNaamById = Object.fromEntries(filteredTeams.map((team) => [team.id, naamVan(team)]))

  // Kleur + "van/naar"-onderschrift per item: een lijn (en dus kleur) ontstaat
  // alleen tussen twee kaarten die allebei zichtbaar zijn in deze
  // keten-weergave.
  const itemColor = new Map()
  const itemLinkedTeam = new Map()
  const edgesToRender = []
  let colorIndex = 0
  for (const edge of chainEdgesAll) {
    const sourceShown = columnOf.has(edge.sourceTeam)
    const targetShown = columnOf.has(edge.targetTeam)
    if (!sourceShown && !targetShown) continue
    if (sourceShown) itemLinkedTeam.set(edge.sourceOutputId, edge.targetTeam)
    if (targetShown) itemLinkedTeam.set(edge.targetInputId, edge.sourceTeam)
    if (!sourceShown || !targetShown) continue
    const color = CONNECTION_COLORS[colorIndex % CONNECTION_COLORS.length]
    colorIndex += 1
    itemColor.set(edge.sourceOutputId, color)
    itemColor.set(edge.targetInputId, color)
    const sourceCol = columnOf.get(edge.sourceTeam)
    const targetCol = columnOf.get(edge.targetTeam)
    const forward = targetCol > sourceCol
    const sameColumn = targetCol === sourceCol
    edgesToRender.push({ edge, color, forward, sameColumn })
  }

  // Herkomst/bestemming van een item: eerst een daadwerkelijke team-koppeling
  // (itemLinkedTeam hierboven, de meest concrete info), dan een externe partij
  // (voor een ketenoverzicht het belangrijkste om te tonen — een item kan
  // zowel via een eigen applicatie lopen als uiteindelijk van een externe
  // partij komen, bv. klantgegevens via het eigen klantportaal maar
  // oorspronkelijk uit de BRP; de externe herkomst weegt dan zwaarder dan
  // welke eigen app het ophaalt), dan de eigen applicatie, dan het generieke
  // bron_type (rol, persoon, stakeholder, omgeving). Zo toont elk item altijd
  // waar het vandaan komt of naartoe gaat, niet alleen de items die toevallig
  // aan een andere (zichtbare of onzichtbare) team hangen.
  function resolveOrigin(rawItem, appsById) {
    const linkedTeamId = itemLinkedTeam.get(rawItem.id)
    if (linkedTeamId) return { kind: 'team', naam: teamNaamById[linkedTeamId] ?? linkedTeamId }
    if (rawItem.externalTeam) return { kind: 'extern', naam: rawItem.externalTeam }
    if (rawItem.applicatieId && appsById.has(rawItem.applicatieId)) {
      return { kind: 'systeem', naam: appsById.get(rawItem.applicatieId).naam || '—' }
    }
    if (rawItem.kind === 'in' && rawItem.bronType && rawItem.bronType !== 'team' && rawItem.bronType !== 'systeem') {
      return { kind: 'bronType', bronType: rawItem.bronType }
    }
    return null
  }
  function buildItems(team) {
    const wf = teamWorkflows[team.id] ?? emptyTeamWorkflow()
    const appsById = new Map((wf.applications ?? []).map((a) => [a.id, a]))
    return [
      ...wf.inputs.map((input) => ({ id: input.id, label: input.label, kind: 'in', bronType: input.bron_type, applicatieId: input.applicatieId, externalTeam: input.externalTeam })),
      ...wf.outputs.map((output) => ({ id: output.id, label: output.label, kind: 'out', applicatieId: output.applicatieId, externalTeam: output.externalTeam })),
    ].map((item) => ({
      id: item.id,
      label: item.label,
      kind: item.kind,
      color: itemColor.get(item.id) ?? null,
      origin: resolveOrigin(item, appsById),
    }))
  }
  function cardHeight(items) {
    // +12 per item met een herkomst/bestemmings-onderschrift: estimateItemRowHeight
    // is gedeeld met de overview-kaart, die geen onderschrift kent en dus geen
    // idee heeft van deze extra regel — zonder deze correctie werd de kaart
    // stelselmatig te laag ingeschat zodra items gekoppeld zijn (het gangbare
    // geval), met overlap met de kolom eronder tot gevolg.
    const content = items.reduce((sum, item) => sum + estimateItemRowHeight(item.label) + (item.origin ? 12 : 0), 0)
    return FC_CARD_HEADER_HEIGHT + 16 + Math.max(content, OV_ITEM_ROW_BASE_HEIGHT)
  }

  const columnX = []
  let cumulativeX = 0
  for (let ci = 0; ci < columns.length; ci++) {
    columnX.push(cumulativeX)
    cumulativeX += FC_CARD_WIDTH + FC_COLUMN_GAP
  }

  const nodes = []
  let maxCardBottom = 0
  columns.forEach((columnTeams, ci) => {
    let y = 0
    columnTeams.forEach((team) => {
      const items = buildItems(team)
      const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
      nodes.push({
        id: `focus-card:${team.id}`,
        type: 'focusCard',
        position: { x: columnX[ci], y },
        data: { teamId: team.id, label: naamVan(team), risk, count: risk.count ?? 0, items, isFocus: ci === 0 },
        draggable: true,
      })
      const bottom = y + cardHeight(items)
      maxCardBottom = Math.max(maxCardBottom, bottom)
      y = bottom + FC_ROW_GAP
    })
  })

  // Terugkoppelingen routeren onderlangs de VOLLEDIGE tekening (maxCardBottom
  // hierboven, ongeacht welke kolommen ze precies overspannen) i.p.v. een
  // vaste marge t.o.v. hun eigen bron/doel-y: bij kaarten met veel items (dus
  // flink hoger dan de bron/doel-rij) schoot die eigen-marge dwars door de
  // kaarten ertussen heen — precies het "lijnen lopen door kaartjes heen"-
  // probleem. Onder de laagste kaart van de hele weergave is er altijd
  // vrije ruimte, ongeacht kaarthoogte of overspanning.
  // Welke kant van het kaartje een koppeling gebruikt volgt de richting van
  // de lijn, niet een vast "input=links, output=rechts"-schema: bij een
  // voorwaartse koppeling ligt het doel rechts, dus verlaat de lijn de
  // bronkaart rechts en komt links de doelkaart binnen (ongewijzigd). Bij een
  // terugkoppeling ligt het doel juist links (een eerdere kolom), dus
  // gebruikt de bronkaart zijn linker-uitgang en de doelkaart zijn rechter-
  // ingang — beide kanten wijzen dan naar elkaar toe, in plaats van dat de
  // lijn eerst de verkeerde kant op moet en helemaal om de eigen kaart heen
  // moet lussen om alsnog terug te komen. Elk item heeft daarom altijd beide
  // handles (zie FocusChainCardNode) — hier wordt alleen gekozen welke van de
  // twee deze specifieke koppeling gebruikt.
  // Twee teams in dezelfde kolom (boven/onder elkaar gestapeld) zijn géén
  // "terugkoppeling" in de gebruikelijke zin — ze liggen al naast elkaar,
  // dus de onderlangse omweg van hierboven zou hier juist dwars door het
  // doelkaartje heen lopen (zie FocusSidestepEdge). Zo'n koppeling gebruikt
  // daarom aan beide kanten dezelfde (rechter)zijde en boogt daar zijwaarts
  // uit, buiten de kolom om, i.p.v. onderlangs.
  let backflowLane = 0
  let sidestepLane = 0
  const edges = edgesToRender.map(({ edge, color, forward, sameColumn }) => {
    if (sameColumn) {
      const columnRight = columnX[columnOf.get(edge.sourceTeam)] + FC_CARD_WIDTH
      return {
        id: edge.id,
        source: `focus-card:${edge.sourceTeam}`,
        target: `focus-card:${edge.targetTeam}`,
        sourceHandle: `item-out:${edge.sourceOutputId}`,
        targetHandle: `item-in-rev:${edge.targetInputId}`,
        type: 'focusSidestep',
        data: { bulgeX: columnRight + SIDESTEP_BULGE + sidestepLane++ * SIDESTEP_LANE_GAP },
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      }
    }
    return {
      id: edge.id,
      source: `focus-card:${edge.sourceTeam}`,
      target: `focus-card:${edge.targetTeam}`,
      sourceHandle: forward ? `item-out:${edge.sourceOutputId}` : `item-out-rev:${edge.sourceOutputId}`,
      targetHandle: forward ? `item-in:${edge.targetInputId}` : `item-in-rev:${edge.targetInputId}`,
      type: forward ? 'focusForward' : 'focusBackflow',
      data: forward ? undefined : { dip: maxCardBottom + BACKFLOW_DIP + backflowLane++ * BACKFLOW_LANE_GAP },
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    }
  })

  return { nodes, edges }
}

const OV_COLUMN_GAP = 60
const OV_ROW_GAP = 24
const OV_CARD_WIDTH = 208 // w-52
const OV_CARD_WIDTH_EXPANDED = 320 // w-80
const OV_CARD_HEIGHT = 70
const OV_ROW_Y = 120
const OV_TRAY_GAP = 70

// Geaggregeerde, gelaagde ketenstroom-lay-out voor de overview-modus (niet gefocust
// op één team): kolom = ketenstap (topologische laag, zie layerTeamsByChain), rij =
// positie binnen die laag — i.p.v. álle teams op één vaste horizontale lijn te
// dwingen. Dat laatste zorgde ervoor dat elke niet-opeenvolgende koppeling in
// dezelfde smalle strook boven de rij moest passen (een "spaghetti" van elkaar
// overlappende bogen); met teams verspreid over meerdere rijen wordt de
// overgrote meerderheid van de koppelingen "naburig" (opeenvolgende lagen), dus
// kort en direct. Positionering en kaartgrootte volgen volledig uit bekende data
// (aantal IN/OUT-items, uitgeklapt of niet) — geen DOM-meting, dus geen
// meet-terugkoppelingslus. Focusmodus gebruikt de eigen computeFocusChainLayout
// hierboven.
// _layeredTeams/_noConnectionLabel/_expandedTeamIds/_pinnedTeamIds hieronder,
// en _filteredTeams/_focusTeamId bij computeFocusChainLayout hierboven,
// blijven per functie deels ongebruikt maar staan wél op hun positie:
// useMergedLayout geeft dezelfde deps-array door aan welke van de twee
// lay-outfuncties er ook actief is — die array moet bij elke render dezelfde
// lengte houden (React waarschuwt anders: "changed size between renders"),
// dus delen beide functies exact dezelfde, uitgebreide argumentenlijst.
function computeChainOverviewLayout(
  teamWorkflows,
  teamRisk,
  teamLabels = {},
  chainEdgesAll = [],
  layeredTeams = { layers: [], isolated: [] },
  noConnectionLabel = '',
  expandedTeamIds = new Set(),
  pinnedTeamIds = new Set(),
  _filteredTeams,
  _focusTeamId,
) {
  const naamVan = (team) => teamLabels[team.id] ?? team.naam
  const nodes = []

  function cardWidth(team) {
    return expandedTeamIds.has(team.id) ? OV_CARD_WIDTH_EXPANDED : OV_CARD_WIDTH
  }
  function cardHeight(team) {
    if (!expandedTeamIds.has(team.id)) return OV_CARD_HEIGHT
    const wf = teamWorkflows[team.id] ?? emptyTeamWorkflow()
    // Som van de geschatte regelhoogtes per kolom (IN/OUT staan onder elkaar
    // ín hun eigen kolom, niet naast elkaar) — de langste kolom bepaalt de
    // kaarthoogte, net als de kaart zelf (flex, twee kolommen naast elkaar).
    const inputsHeight = wf.inputs.reduce((sum, item) => sum + estimateItemRowHeight(item.label), 0)
    const outputsHeight = wf.outputs.reduce((sum, item) => sum + estimateItemRowHeight(item.label), 0)
    const contentHeight = Math.max(inputsHeight, outputsHeight, OV_ITEM_ROW_BASE_HEIGHT)
    return OV_CARD_HEIGHT + 20 + contentHeight
  }

  function pushTeamHeader(team, x, y) {
    const workflow = teamWorkflows[team.id] ?? emptyTeamWorkflow()
    const risk = teamRisk[team.id] ?? { level: 'Laag', score: 0, count: 0 }
    const empty = workflow.inputs.length === 0 && workflow.outputs.length === 0
    const expanded = expandedTeamIds.has(team.id)
    nodes.push({
      id: `team-header-ov:${team.id}`,
      type: 'chainHeader',
      position: { x, y },
      // Hogere zIndex zodra uitgeklapt: de kaart groeit dan en mag zichtbaar
      // over een buur heen liggen i.p.v. eronder weg te vallen (de dynamische
      // op-/uitschuiving hieronder maakt echte overlap al zeldzaam, dit is de
      // vangnet-afwerking voor de rest).
      zIndex: expanded ? 10 : 0,
      data: {
        teamId: team.id,
        label: naamVan(team),
        risk,
        count: risk.count ?? 0,
        empty,
        dimmed: risk.dimmed ?? false,
        groupKind: null,
        workflow: { inputs: workflow.inputs, outputs: workflow.outputs },
        expandable: true,
        expanded,
        pinned: pinnedTeamIds.has(team.id),
      },
      draggable: true,
    })
  }

  // X: cumulatief per laag, op basis van de breedste kaart in élke vórige laag —
  // een uitgeklapte kaart in laag N schuift laag N+1 en verder dus vanzelf naar
  // rechts op (lost de "uitgeklapte kaart overlapt de buurkolom"-klacht op).
  const layerX = []
  let cumulativeX = 0
  for (const layerTeams of layeredTeams.layers) {
    layerX.push(cumulativeX)
    cumulativeX += Math.max(OV_CARD_WIDTH, ...layerTeams.map(cardWidth)) + OV_COLUMN_GAP
  }

  // Y: per laag, teams gestapeld op basis van hun eigen (evt. uitgeklapte)
  // hoogte — een uitgeklapte kaart schuift teams eronder in dezelfde laag dus
  // vanzelf naar beneden op.
  const layerOf = new Map()
  let maxYReached = OV_ROW_Y
  layeredTeams.layers.forEach((layerTeams, li) => {
    let y = OV_ROW_Y
    layerTeams.forEach((team) => {
      layerOf.set(team.id, li)
      pushTeamHeader(team, layerX[li], y)
      y += cardHeight(team) + OV_ROW_GAP
    })
    maxYReached = Math.max(maxYReached, y)
  })

  // Teams zonder ketenkoppeling: eigen, expliciet gelabeld vak ónder de gelaagde
  // keten (nooit stilzwijgend weggelaten), positie afhankelijk van hoe hoog de
  // gelaagde keten op dit moment reikt — nooit een vaste y die door een
  // uitgeklapte kolom overlapt kan worden.
  if (layeredTeams.isolated.length > 0) {
    nodes.push({
      id: 'group-label:no-connection',
      type: 'chainGroupLabel',
      position: { x: 0, y: maxYReached + OV_TRAY_GAP - 30 },
      data: { label: noConnectionLabel },
      draggable: false,
      selectable: false,
      focusable: false,
    })
    let x = 0
    const trayY = maxYReached + OV_TRAY_GAP
    for (const team of layeredTeams.isolated) {
      pushTeamHeader(team, x, trayY)
      x += cardWidth(team) + OV_COLUMN_GAP
    }
  }

  // Aggregatie per teampaar (i.p.v. per los itempaar) — dikte/kleur/label
  // worden hieronder afgeleid. Zodra minstens één kant is uitgeklapt, wordt de
  // aggregatie ter plekke weer "gesplitst" naar de onderliggende losse
  // koppelingen, elk naar de specifieke item-handle i.p.v. het algemene
  // teampunt — zo springt de lijn zichtbaar mee zodra je een kaart uitklapt.
  const allTeams = [...layeredTeams.layers.flat(), ...layeredTeams.isolated]
  const teamIdSet = new Set(allTeams.map((team) => team.id))
  const teamNaamById = Object.fromEntries(allTeams.map((team) => [team.id, naamVan(team)]))
  const groups = aggregateChainLinks(chainEdgesAll).filter((g) => teamIdSet.has(g.sourceTeam) && teamIdSet.has(g.targetTeam))

  const edges = []
  for (const g of groups) {
    const layerA = layerOf.get(g.sourceTeam)
    const layerB = layerOf.get(g.targetTeam)
    const adjacent = layerA !== undefined && layerB !== undefined && Math.abs(layerB - layerA) === 1
    const dist = (layerB ?? 0) - (layerA ?? 0)

    // Naburige lagen: korte rechtstreekse lijn. Overgeslagen lagen: via de
    // bovenkant, zodat de lijn óver tussenliggende lagen heen loopt i.p.v. er
    // dwars doorheen — reactflow's smoothstep routeert zelf rechthoekig op
    // basis van de daadwerkelijke bron-/doelrichting (in tegenstelling tot een
    // eigen kwadratische boog, die de richting van een specifieke item-handle
    // niet respecteerde — zie eerdere browserverificatie).
    const baseSourceHandle = adjacent ? (dist === 1 ? 'right-source' : 'left-source') : 'top-source'
    const baseTargetHandle = adjacent ? (dist === 1 ? 'left-target' : 'right-target') : 'top-target'

    // Overgeslagen lagen krijgen iets meer "aanloopruimte" vóór de eerste
    // bocht dan reactflow's standaard smoothstep-offset (20px), zodat de lijn
    // niet vlak langs een tussenliggende kaart scheert. Bewust een bescheiden
    // vaste waarde i.p.v. geschaald op de diepte van het eindpunt — een eerste
    // poging die de offset liet meeschalen met de absolute y-positie van de
    // kaart bleek in de praktijk het pad honderden pixels omhoog te schieten
    // (reactflow's smoothstep-offset werkt niet als "afstand tot een vaste
    // hoogte", zie browserverificatie), met een nutteloos ver uitgezoomde
    // fitView tot gevolg.
    const pathOptions = adjacent ? undefined : { offset: 50 }

    // Er bestaat geen risicoscore per ketenkoppeling (dependencies hangen aan
    // een teamId, niet aan een specifieke partner) — zie CLAUDE.md
    // ("risicoscores zijn altijd uitlegbaar, nooit een black box"). De kleur
    // toont daarom bewust een benadering: het hoogste van de twee gekoppelde
    // teams' eigen, al bestaande risiconiveau (dezelfde badge als op de
    // teamkaart) — geen nieuwe, verzonnen metriek per lijn.
    const riskA = teamRisk[g.sourceTeam]?.level ?? 'Laag'
    const riskB = teamRisk[g.targetTeam]?.level ?? 'Laag'
    const level = riskLevelRank(riskA) >= riskLevelRank(riskB) ? riskA : riskB
    const style = riskStyle(level)
    const count = g.links.length
    const sourceExpanded = expandedTeamIds.has(g.sourceTeam)
    const targetExpanded = expandedTeamIds.has(g.targetTeam)

    const sharedData = {
      sourceTeam: g.sourceTeam,
      targetTeam: g.targetTeam,
      sourceTeamNaam: teamNaamById[g.sourceTeam] ?? g.sourceTeam,
      targetTeamNaam: teamNaamById[g.targetTeam] ?? g.targetTeam,
    }

    if (!sourceExpanded && !targetExpanded) {
      edges.push({
        id: g.id,
        source: `team-header-ov:${g.sourceTeam}`,
        target: `team-header-ov:${g.targetTeam}`,
        sourceHandle: baseSourceHandle,
        targetHandle: baseTargetHandle,
        type: 'smoothstep',
        pathOptions,
        style: { stroke: style.hex, strokeWidth: Math.min(2 + count * 1.5, 8) },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.hex, width: 16, height: 16 },
        label: count > 1 ? String(count) : undefined,
        labelStyle: { fill: style.hex, fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: 'white' },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 6,
        data: {
          ...sharedData,
          links: g.links.map((l) => ({
            id: l.id,
            sourceOutputId: l.sourceOutputId,
            targetInputId: l.targetInputId,
            sourceLabel: l.sourceLabel,
            targetLabel: l.targetLabel,
          })),
        },
      })
      continue
    }

    for (const link of g.links) {
      edges.push({
        id: link.id,
        source: `team-header-ov:${g.sourceTeam}`,
        target: `team-header-ov:${g.targetTeam}`,
        sourceHandle: sourceExpanded ? `item-out:${link.sourceOutputId}` : baseSourceHandle,
        targetHandle: targetExpanded ? `item-in:${link.targetInputId}` : baseTargetHandle,
        type: 'smoothstep',
        pathOptions,
        style: { stroke: style.hex, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.hex, width: 16, height: 16 },
        data: { ...sharedData, links: [{ sourceLabel: link.sourceLabel, targetLabel: link.targetLabel }] },
      })
    }
  }

  return { nodes, edges }
}

export default function ChainOverview({ adminSections, sidebarMode }) {
  const { teams, dependencies, teamWorkflows, teamLabels } = useAppContext()
  const { t, language } = useLanguage()
  // Gearchiveerde teams staan bij openen standaard uit, zelfde gedrag als
  // de netwerkweergave — blijven wel aan te vinken voor historische data.
  const [deselectedTeamIds, setDeselectedTeamIds] = useState(() => new Set(teams.filter((tm) => !tm.actief).map((tm) => tm.id)))
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(RISK_LEVELS)
  // Lokale scope-filter, zelfde opzet als Netwerkweergave: standaard 'alle'
  // zodat het ketenoverzicht zoals voorheen Teamniveau + Ketenniveau gemengd
  // toont, met de optie om te versmallen.
  const [scope, setScope] = useState('alle')

  const selectedTeamIds = useMemo(() => teams.filter((tm) => !deselectedTeamIds.has(tm.id)).map((tm) => tm.id), [teams, deselectedTeamIds])
  const filteredTeams = useMemo(() => teams.filter((tm) => selectedTeamIds.includes(tm.id)), [teams, selectedTeamIds])

  // Focusmodus: kies één team, en de keten rolt voorwaarts uit (kolom per
  // stap) vanaf dat team — zie focusChainTrace/traceForwardChain hieronder.
  // "chainMode" is losgekoppeld van focusTeamId: zo onthoudt de tool welk team
  // je koos toen je terugschakelde naar Ketenflow.
  const [chainMode, setChainMode] = useState('overview')
  const [focusTeamId, setFocusTeamId] = useState('')

  const focusActive = chainMode === 'focus' && Boolean(focusTeamId)

  // Eén keer berekend, hergebruikt door zowel focusChainTrace hieronder als
  // computeFocusChainLayout/computeChainOverviewLayout (via useMergedLayout) —
  // voorheen liep resolveChainEdges twee keer per render.
  const chainEdgesAll = useMemo(() => resolveChainEdges(teamWorkflows), [teamWorkflows])

  // Voorwaartse BFS vanaf het focusteam (traceForwardChain, lib/teamWorkflow.js):
  // kolom = ketenstap, i.p.v. de vorige inkomend/focus/uitgaand-swimlanes.
  const focusChainTrace = useMemo(() => {
    if (!focusActive || !teams.some((tm) => tm.id === focusTeamId)) return null
    return traceForwardChain(focusTeamId, filteredTeams, chainEdgesAll)
  }, [focusActive, focusTeamId, filteredTeams, teams, chainEdgesAll])

  const visibleTeams = useMemo(() => {
    // Overzichtsmodus: kolomvolgorde op ketenlogica i.p.v. de toevallige
    // teams-volgorde uit de context — zie orderTeamsByChain in lib/teamWorkflow.js.
    if (focusChainTrace) return focusChainTrace.columns.flat()
    return orderTeamsByChain(filteredTeams, chainEdgesAll)
  }, [focusChainTrace, filteredTeams, chainEdgesAll])

  const teamRisk = useMemo(() => {
    // Alleen dimmen als het filter daadwerkelijk versmald is; met alle niveaus
    // aangevinkt zou anders elk team zonder dependencies gedimd raken.
    const riskFilterActive = selectedRiskLevels.length < RISK_LEVELS.length
    const result = {}
    for (const team of visibleTeams) {
      const inScope = dependencies.filter((d) => d.teamId === team.id && (scope === 'alle' || d.scope === scope))
      const deps = inScope.filter((d) => selectedRiskLevels.includes(calculateRisk(d).level))
      result[team.id] = {
        ...highestRisk(deps),
        count: deps.length,
        dimmed: riskFilterActive && deps.length === 0 && inScope.length > 0,
      }
    }
    return result
  }, [visibleTeams, dependencies, selectedRiskLevels, scope])

  // Hub-statistieken voor het gefocuste team: aantal inkomende/uitgaande
  // koppelingen (niet unieke partners — een team met 3 losse koppelingen naar
  // dezelfde partner telt als 3) en het hoogste risiconiveau van zijn eigen
  // dependencies, ongeacht het huidige risicofilter. Rechtstreeks uit
  // chainEdgesAll i.p.v. via focusChainTrace — dit gaat over de dírecte
  // koppelingen van het focusteam zelf, niet over de hele voorwaartse keten.
  const focusStats = useMemo(() => {
    if (!focusActive) return null
    const incoming = chainEdgesAll.filter((e) => e.targetTeam === focusTeamId && e.sourceTeam !== focusTeamId)
    const outgoing = chainEdgesAll.filter((e) => e.sourceTeam === focusTeamId && e.targetTeam !== focusTeamId)
    const inScope = dependencies.filter((d) => d.teamId === focusTeamId && (scope === 'alle' || d.scope === scope))
    return {
      incoming: incoming.length,
      outgoing: outgoing.length,
      total: incoming.length + outgoing.length,
      risk: inScope.length > 0 ? highestRisk(inScope) : null,
    }
  }, [focusActive, focusTeamId, chainEdgesAll, dependencies, scope])

  // Gelaagde structuur (kolom = ketenstap, rij = positie binnen de stap) voor de
  // 2D-plaatsing in overview-modus — zie layerTeamsByChain in lib/teamWorkflow.js.
  // Alleen gebruikt door computeChainOverviewLayout; focusmodus blijft visibleTeams
  // gebruiken. Kleine, geaccepteerde inefficiëntie: de laag-berekening loopt hierdoor
  // twee keer (ook via orderTeamsByChain in visibleTeams) — verwaarloosbaar op deze
  // schaal (tientallen teams, geen honderden).
  const layeredTeams = useMemo(() => layerTeamsByChain(filteredTeams, chainEdgesAll), [filteredTeams, chainEdgesAll])

  // Hover-uitklap + vastzetten van een teamkaart in overview-modus (alleen daar —
  // focusmodus toont IN/OUT-items al permanent per swimlane). Moet vóór de
  // useMergedLayout-aanroep bestaan: de layoutfunctie gebruikt expandedTeamIds/
  // pinnedTeamIds zelf om kaarten te vergroten én omliggende kaarten dynamisch te
  // laten opschuiven (positionering + edge-routing horen bij elkaar, geen losse
  // overlay-stap meer nodig zoals in de vorige iteratie).
  const [hoveredTeamId, setHoveredTeamId] = useState(null)
  const [pinnedTeamIds, setPinnedTeamIds] = useState(() => new Set())

  const expandedTeamIds = useMemo(() => {
    if (focusActive) return new Set()
    const set = new Set(pinnedTeamIds)
    if (hoveredTeamId) set.add(hoveredTeamId)
    return set
  }, [focusActive, pinnedTeamIds, hoveredTeamId])

  // Eén vaste deps-vorm voor beide lay-outfuncties (zie de toelichting bij
  // computeChainOverviewLayout hierboven): useEffect/useMergedLayout vereist
  // een deps-array met een stabiele lengte over renders heen, ook al wisselt
  // welke van de twee functies er daadwerkelijk gebruikt wordt. Beide worden
  // bewust ook op elke hover/pin-/focusteam-wijziging opnieuw aangeroepen
  // (i.p.v. dat apart te overlayen) — nodig om kaarten daadwerkelijk te laten
  // op-/verschuiven; op deze schaal geen waarneembare performance-impact.
  const [{ nodes, edges }, onNodesChange] = useMergedLayout(focusActive ? computeFocusChainLayout : computeChainOverviewLayout, [
    teamWorkflows,
    teamRisk,
    teamLabels,
    chainEdgesAll,
    layeredTeams,
    t('chain.groupNoConnection'),
    expandedTeamIds,
    pinnedTeamIds,
    filteredTeams,
    focusTeamId,
  ])

  // Klik pint een lijn vast (blijft staan terwijl je rondkijkt/scrollt) — dit
  // vervangt een eerdere zwevende hover-tooltip volledig (die bleek buggy en
  // stond de leesbaarheid in de weg). Hover geeft nu alleen nog lichte
  // visuele feedback ín de lijn zelf (lichtjes oplichten, de rest kort dimmen)
  // zonder los infoveld; het klik-paneel hieronder blijft de plek voor detail.
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null)

  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId])

  // Selectie wint van hover: een vastgezette lijn moet niet weer wegzakken
  // omdat de muis toevallig over een andere lijn beweegt.
  const activeEdgeId = selectedEdgeId ?? hoveredEdgeId

  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const selected = e.id === selectedEdgeId
        if (!activeEdgeId) return { ...e, selected }
        const active = e.id === activeEdgeId
        return {
          ...e,
          selected,
          animated: active && Boolean(selectedEdgeId),
          style: { ...e.style, strokeWidth: active ? 3.5 : 1.5, opacity: active ? 1 : 0.15 },
        }
      }),
    [edges, activeEdgeId, selectedEdgeId],
  )

  // Focusmodus: welke twee item-handles hoort de geselecteerde lijn bij —
  // die kaartjes lichten op zodat meteen duidelijk is van welk output- naar
  // welk inputkaartje de lijn precies loopt, ook als hij onder een paar
  // andere kaarten door loopt.
  const activeItemIds = useMemo(() => {
    if (!focusActive || !selectedEdgeId) return null
    const edge = edges.find((e) => e.id === selectedEdgeId)
    if (!edge) return null
    const ids = [edge.sourceHandle, edge.targetHandle]
      .filter(Boolean)
      .map((handle) => handle.replace(/^item-(in|out)(-rev)?:/, ''))
    return new Set(ids)
  }, [focusActive, selectedEdgeId, edges])

  const displayNodes = useMemo(() => {
    if (!activeItemIds) return nodes
    return nodes.map((n) => (n.type === 'focusCard' ? { ...n, data: { ...n.data, activeItemIds } } : n))
  }, [nodes, activeItemIds])

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

  function focusOnTeam(teamId) {
    setChainMode('focus')
    setFocusTeamId(teamId)
  }

  function clearFocus() {
    setChainMode('overview')
    setFocusTeamId('')
  }

  const teamFilterActive = deselectedTeamIds.size > 0
  const riskFilterActive = selectedRiskLevels.length < RISK_LEVELS.length
  const anyFilterActive = teamFilterActive || riskFilterActive

  // Het team-focusmenu leeft op het canvas zelf (als zwevend paneel, zie
  // <Panel> hieronder) i.p.v. in een aparte balk erboven — alleen bij een
  // lege staat (geen canvas om op te zweven) valt dit terug op een gewone,
  // gecentreerde plek in de melding, zodat je ook dan van focusteam kan
  // wisselen.
  const focusPicker = (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
      {focusTeamId ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2a5f8a]/10 px-3 py-1 text-xs font-medium text-[#2a5f8a]">
          {t('chain.focusPillLabel', { team: teamLabels[focusTeamId] ?? teams.find((tm) => tm.id === focusTeamId)?.naam ?? '—' })}
        </span>
      ) : (
        <span className="text-xs text-slate-400">{t('chain.focusChoosePrompt')}</span>
      )}
      <select
        id="chain-focus"
        value={focusTeamId}
        onChange={(e) => setFocusTeamId(e.target.value)}
        className="max-w-[168px] truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-[#2a5f8a] focus:outline-none"
      >
        <option value="">{t('chain.focusPlaceholder')}</option>
        {filteredTeams.map((tm) => (
          <option key={tm.id} value={tm.id}>
            {teamLabels[tm.id] ?? tm.naam}
          </option>
        ))}
      </select>
      {focusTeamId && (
        <button type="button" onClick={clearFocus} className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
          {t('chain.focusClear')}
        </button>
      )}
    </div>
  )

  const focusStatsBlock = focusStats && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-600 shadow-md backdrop-blur-sm">
      <span>
        {t('chain.statIncoming')}: <b className="text-slate-800">{focusStats.incoming}</b>
      </span>
      <span>
        {t('chain.statOutgoing')}: <b className="text-slate-800">{focusStats.outgoing}</b>
      </span>
      <span>
        {t('chain.statTotal')}: <b className="text-slate-800">{focusStats.total}</b>
      </span>
      {focusStats.risk && (
        <span className="inline-flex items-center gap-1">
          {t('chain.statHighestRisk')}:
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${riskStyle(focusStats.risk.level).badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${riskStyle(focusStats.risk.level).dot}`} />
            {translateRiskLevel(focusStats.risk.level, language)}
          </span>
        </span>
      )}
    </div>
  )

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs" role="group" aria-label={t('chain.modeLabel')}>
              <button
                type="button"
                onClick={() => setChainMode('overview')}
                aria-pressed={chainMode === 'overview'}
                className={`rounded px-2.5 py-1.5 font-medium transition-colors ${
                  chainMode === 'overview' ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('chain.modeOverview')}
              </button>
              <button
                type="button"
                onClick={() => setChainMode('focus')}
                aria-pressed={chainMode === 'focus'}
                className={`rounded px-2.5 py-1.5 font-medium transition-colors ${
                  chainMode === 'focus' ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('chain.modeFocus')}
              </button>
            </div>
            {anyFilterActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                {t('filter.active')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden text-xs text-slate-400 sm:inline"
              title={focusActive ? t('chain.focusLegend') : t('chain.overviewLegend')}
            >
              {focusActive ? t('chain.focusLegend') : t('chain.overviewLegend')}
            </span>
            <ScopeToggle scope={scope} onChange={setScope} />
          </div>
        </div>

        {focusActive && focusStats && focusStats.total === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            {chainMode === 'focus' && <div className="mb-4 flex justify-center">{focusPicker}</div>}
            <div>{t('chain.focusEmptyTitle')}</div>
            <div className="mt-1 text-xs">{t('chain.focusEmptyHint')}</div>
          </div>
        ) : visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
            {chainMode === 'focus' && <div className="mb-4 flex justify-center">{focusPicker}</div>}
            {t('chain.noTeams')}
          </div>
        ) : (
          <ReactFlowProvider>
            <ChainZoomToolbar />
            <ChainAutoFit fitKey={`${nodes.length}:${chainMode}:${focusTeamId}:${sidebarMode}`} />
            <div
              className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ height: 'max(560px, calc(100vh - 280px))' }}
            >
              <PannableFlowCanvas
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={focusEdgeTypes}
                elevateEdgesOnSelect
                onNodesChange={onNodesChange}
                onNodeClick={(_, node) => {
                  if (node.type !== 'chainHeader' && node.type !== 'focusCard') return
                  if (focusActive) {
                    focusOnTeam(node.data.teamId)
                    return
                  }
                  setPinnedTeamIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(node.data.teamId)) next.delete(node.data.teamId)
                    else next.add(node.data.teamId)
                    return next
                  })
                  // Zonder dit blijft de kaart na het ontpinnen nog uitgeklapt
                  // zolang de muis er toevallig nog op staat — wat bij een
                  // klik per definitie zo is. Een klik overschrijft de
                  // hover-status dus altijd expliciet, zodat sluiten meteen
                  // zichtbaar is i.p.v. pas na het wegbewegen van de muis.
                  setHoveredTeamId(null)
                }}
                onNodeMouseEnter={(_, node) => {
                  if (!focusActive && node.type === 'chainHeader') setHoveredTeamId(node.data.teamId)
                }}
                onNodeMouseLeave={(_, node) => {
                  if (node.type === 'chainHeader') setHoveredTeamId((prev) => (prev === node.data.teamId ? null : prev))
                }}
                onEdgeClick={(_, edge) => setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id))}
                onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
                onEdgeMouseLeave={() => setHoveredEdgeId(null)}
                onPaneClick={() => setSelectedEdgeId(null)}
              >
                {chainMode === 'focus' && (
                  <>
                    <Panel position="top-left">{focusPicker}</Panel>
                    {focusStatsBlock && <Panel position="top-right">{focusStatsBlock}</Panel>}
                  </>
                )}
              </PannableFlowCanvas>
            </div>
          </ReactFlowProvider>
        )}

        {!focusActive && selectedEdge?.data && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-[#2a5f8a]/25 bg-[#2a5f8a]/5 px-4 py-2.5">
            <div className="min-w-0 flex-1 text-xs">
              {Array.isArray(selectedEdge.data.links) ? (
                <>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">
                    {selectedEdge.data.sourceTeamNaam} → {selectedEdge.data.targetTeamNaam} ·{' '}
                    {selectedEdge.data.links.length === 1
                      ? t('chain.edgeSelectedCountOne')
                      : t('chain.edgeSelectedCount', { count: selectedEdge.data.links.length })}
                  </div>
                  <div className="space-y-1">
                    {selectedEdge.data.links.map((link, i) => (
                      <div key={i} className="text-slate-700">
                        <span className="text-slate-400">{t('chain.edgeOutput')}: </span>
                        {link.sourceLabel || '—'}
                        <span className="text-slate-400"> · {t('chain.edgeInput')}: </span>
                        {link.targetLabel || '—'}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-[#2a5f8a]">{t('chain.edgeSelectedTitle')}</div>
                  <div className="text-slate-700">
                    <span className="font-medium">{selectedEdge.data.sourceTeamNaam}</span>
                    <span className="text-slate-400"> · {t('chain.edgeOutput')}: </span>
                    {selectedEdge.data.sourceLabel || '—'}
                  </div>
                  <div className="text-slate-700">
                    <span className="font-medium">{selectedEdge.data.targetTeamNaam}</span>
                    <span className="text-slate-400"> · {t('chain.edgeInput')}: </span>
                    {selectedEdge.data.targetLabel || '—'}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedEdgeId(null)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('graph.selectionClear')}
            </button>
          </div>
        )}
      </div>

      {adminSections.filters && (
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
        />
      )}
    </div>
  )
}
