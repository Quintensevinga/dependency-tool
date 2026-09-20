// Lay-outberekening van het teamcanvas: invoer erin, kaarten en lijnen eruit.
//
// Stond in TeamPage.jsx, tussen de schermcomponenten. Het is een zuivere
// berekening zonder React, dus hier is hij los te lezen en los te testen --
// en TeamPage werd er ruim duizend regels korter van.
//
// Verplaatst, niet verbouwd: de inhoud is regel voor regel dezelfde als
// voorheen. Wat er hier bij hoort en nergens anders gebruikt wordt (de
// canvas-constanten, gutterRoute en canvasHeightFor) is meeverhuisd.

import { WORKFLOW_STAGES, WORKFLOW_STAP_TO_STAGE } from '../data/constants'
import { calculateRisk } from './risk'
import { stageColor, bronTypeColor } from './workflowStyles'
import { translateLinkStatus } from '../i18n/labels'

const STAGE_GAP = 220
const STAGE_START_X = 260
const STAGE_Y = 260
const IO_Y_START = 40
const IO_Y_GAP = 90
// Kaartbreedte (w-44 = 176px) plus tussenruimte: de stap opzij wanneer een
// IO-kolom vol is en er een kolom naast begint (zie stackCenteredInZone).
const IO_COLUMN_STEP = 196
// Kaartbreedte (w-44). Nodig om overlap te kunnen meten in de
// ontdubbelingspas hieronder.
const IO_CARD_WIDTH = 176

const HIGH_RISK_LEVELS = ['Hoog', 'Kritiek']
// Node-types die meedimmen zodra er canvas-focus actief is (zie

// Route een lijn via een vaste 'gang' (verticale kolom zonder lane-content)
// tussen bron en doel: horizontaal naar de gang, verticaal naar de juiste
// hoogte, horizontaal het doel in. Gebruikt voor Applicatieflow-IO (de gangen
// tussen de IO-kolommen en de zone) en voor applicatiekoppelingen (de
// linkergang naast de lanes) — zie computeWorkflowLayout. Degenereert vanzelf
// tot een rechte lijn zodra bron en doel al op dezelfde hoogte staan
// (roundedOrthPath slaat een nul-lengte segment stilzwijgend over).
function gutterRoute(x1, y1, gutterX, x2, y2) {
  return [
    [x1, y1],
    [gutterX, y1],
    [gutterX, y2],
    [x2, y2],
  ]
}

function canvasHeightFor(inputs, outputs) {
  return IO_Y_START + Math.max(inputs.length, outputs.length) * IO_Y_GAP
}

export function computeWorkflowLayout(
  inputs,
  outputs,
  resolveLinkLabel,
  savedLayout,
  annotations,
  annotationEdges,
  annotationHandlers,
  capacity,
  teamDependencies,
  applications,
  splitApplicaties,
  applicatieflowConnecties,
  t,
  language,
  onOpenApplicatieflow,
  laneFilterQuery,
  collapsedLaneIds,
  onToggleLaneCollapse,
  viewFilters,
  onOpenAppDetail,
  stageNotes,
) {
  const {
    showIO = true,
    showOverstijgend = true,
    riskFilterOn = false,
    showExternalTeams = false,
  } = viewFilters ?? {}
  const nodes = []
  const edges = []
  const depNodeIdByDepId = new Map()

  function withSavedPosition(id, defaultPosition) {
    return savedLayout?.[id] ?? defaultPosition
  }

  const capacityByStage = {}
  for (const row of capacity) {
    if (!row.fase) continue
    if (!capacityByStage[row.fase]) capacityByStage[row.fase] = []
    capacityByStage[row.fase].push(row)
  }
  // De workflowstap bepaalt waar een Ontwikkelflow-dependency terechtkomt —
  // niet of hij toevallig een applicatielabel heeft. Mét stap staat hij onder
  // die stagekolom (ook zonder applicatielabel); zónder herleidbare stap is
  // hij per definitie niet aan één fase gebonden en valt hij in de
  // 'Proces-overstijgend'-lane onder de hele kolomstapel. Dit is dezelfde
  // groepering als de dependencylijst onder het canvas al hanteerde.
  const depsByStage = {}
  for (const dep of teamDependencies) {
    if (dep.flowtype !== 'ontwikkelflow') continue
    const stage = WORKFLOW_STAP_TO_STAGE[dep.workflowStap]
    if (!stage) continue
    if (!depsByStage[stage]) depsByStage[stage] = []
    depsByStage[stage].push(dep)
  }
  const ontwikkelflowOverstijgendDeps = teamDependencies.filter(
    (dep) => dep.flowtype === 'ontwikkelflow' && !WORKFLOW_STAP_TO_STAGE[dep.workflowStap],
  )
  const maxStackPerStage = Math.max(
    0,
    ...WORKFLOW_STAGES.map((s) => (capacityByStage[s]?.length ?? 0) + (depsByStage[s]?.length ?? 0)),
  )

  // --- Gedeelde as: Applicatieflow (boven) en Ontwikkelflow (onder) als één canvas ---
  // Deze zonegrenzen worden hier, vóór de lane-plaatsing, berekend — niet pas
  // erna — zodat de lane-stapeling (verderop) zijn eigen vloer kan afleiden
  // van de échte Applicatieflow-zonegrens (`applicatieflowZoneBottom`) i.p.v. van een los
  // vast getal. Dat voorkomt dat lane-inhoud structureel buiten zijn eigen
  // zone kan vallen, ongeacht hoeveel content erin zit.
  // +176 (i.p.v. de kaartbreedte zelf, 176px = w-44) zodat de zone-rechterrand
  // na de laatste stage-kaart exact zoveel ruimte overhoudt (ZONE_INNER_PAD_X)
  // als de zone-linkerrand vóór de eerste stage-kaart al had — anders staat de
  // laatste kolom (Beheer/nazorg) vrijwel tegen de rand aan.
  const BANNER_WIDTH = (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 176
  // Padding van elk lane-achtergrondkader — hier al gedeclareerd (i.p.v. pas
  // in de lane-sectie verderop) omdat zowel de zonegrenzen als de lane-vloer
  // (verderop) er beide van afhangen.
  const LANE_PAD_X = 14
  const LANE_PAD_TOP = 10
  const LANE_PAD_BOTTOM = 14
  // Los van LANE_PAD_X (de padding van een individuele lane t.o.v. zíjn
  // eigen inhoud): dit is de ademruimte tussen de buitenste flow-achtergrond
  // (het grote canvasvlak) en waar de content — stage-kaarten én lane-
  // inhoud, want beide starten op STAGE_START_X — daadwerkelijk begint.
  // Groter dan LANE_PAD_X zodat de lane-containers niet tegen de buitenrand
  // geplakt ogen. Beide flows delen dezelfde ZONE_X/ZONE_WIDTH, dus
  // Ontwikkelflow schuift automatisch evenveel op als Applicatieflow.
  const ZONE_INNER_PAD_X = 32
  // Beide lagen delen dezelfde linker-/rechtergrens (ZONE_X/ZONE_WIDTH,
  // afgeleid van dezelfde STAGE_GAP-kolommen als de lanes/stage-rij), zodat
  // ze als één geheel ogen i.p.v. een los wit blok onder een los blauw blok.
  const ZONE_X = STAGE_START_X - ZONE_INNER_PAD_X
  const ZONE_WIDTH = BANNER_WIDTH + ZONE_INNER_PAD_X * 2
  // Lege 'gangen' zonder lane-content, waar nodig gebruikt om een lijn
  // gegarandeerd langs andere lanes/chips heen te leiden (zie
  // gutterRoute/appconn-edges en de "rest"-outputplaatsing verderop).
  // Applicatieflow-inputlijnen hebben zo'n gerichte route niet nodig: een
  // input-item staat altijd links van de hele zone, dus de bocht van React
  // Flow's eigen smoothstep-lijn valt daar vanzelf al in de lege ruimte vóór
  // de zone (bevestigd: bij tegenoverliggende handles ligt die bocht op het
  // midden tussen bron- en doel-x, en dat midden ligt bij deze afstanden nooit
  // ín de zone). BUS_CHANNEL_X (drie banen, voor de applicatiekoppelingen) en
  // OUTPUT_GUTTER_X (één brede gang voorbij ELKE lane, voor generieke/niet-
  // lane-gekoppelde outputitems) hebben die garantie niet vanzelf en routeren
  // daarom wél expliciet.
  const BUS_CHANNEL_X = [ZONE_X - 28, ZONE_X - 16, ZONE_X - 4]
  const OUTPUT_GUTTER_X = ZONE_X + ZONE_WIDTH + 10

  // --- Applicatieflow-lane bouwstenen ---
  // Hier al gedeclareerd (i.p.v. pas in de Applicatieflow-lanesectie verderop)
  // omdat zowel de Ontwikkelflow-zonehoogte hieronder (die moet rekening
  // houden met de Proces-overstijgend-lane) als de latere Applicatieflow-lanes ze
  // allebei nodig hebben.
  const LANE_BANNER_W = 210
  const LANE_ITEM_W = 195
  const LANE_CONTENT_GAP = 18
  const LANE_ROW_H = 52
  // Halve bannerhoogte (ankerpunt voor het handle op het lane-kader, zie
  // LaneGroupNode) en een ruwe schatting van één IoNode-hoogte (voor de
  // rij-reservering verderop als een lane meer gekoppelde IO-kaarten heeft
  // dan chip-rijen) — geen DOM-meting, zelfde schattingsstijl als de rest
  // van dit bestand.
  const LANE_BANNER_CENTER_Y = LANE_ROW_H / 2
  const IO_CARD_HEIGHT_ESTIMATE = 80
  const LANE_GAP = 22
  const LANE_PACK_GAP_X = 24
  // Extra ademruimte tussen de laatste chip van de ene applicatie en de
  // eerste van de volgende binnen de Applicatiegerelateerd-groep (Samen-
  // gevoegd) — puur visuele clustering, geen aparte kaart/lane per app.
  const LANE_CLUSTER_GAP = 16
  // Overstijgend-lanes ('Applicatie-overstijgend'/'Proces-overstijgend') hebben
  // geen eigen bannerkaart — alleen het losse label-pilletje op het
  // achtergrondkader (LaneGroupNode). Chips beginnen daarom aan de
  // linkerkant van het kader i.p.v. na een banner, met deze marge bovenaan
  // zodat ze nooit tegen het pilletje aan komen te staan.
  const LANE_BADGE_PAD_TOP = 46
  const LANE_PACK_MAX_WIDTH = BANNER_WIDTH - LANE_PAD_X * 2

  // Berekent voor elke dep een {row, x}-positie binnen de lane, en hoeveel
  // breedte de volst gevulde rij daadwerkelijk gebruikt — dat laatste bepaalt
  // de lane z'n eigen (compacte) breedte i.p.v. altijd de volle zonebreedte.
  function layoutLaneItems(deps, perRow, appIdOf) {
    const itemPos = new Map()
    let maxRowWidth = 0
    let row = 0
    let col = 0
    let x = 0
    let prevAppId = null
    deps.forEach((dep) => {
      if (col >= perRow) {
        row += 1
        col = 0
        x = 0
        prevAppId = null
      }
      const appId = appIdOf ? appIdOf(dep) : null
      if (appIdOf && prevAppId !== null && appId !== prevAppId) x += LANE_CLUSTER_GAP
      itemPos.set(dep.id, { row, x })
      x += LANE_ITEM_W
      if (x > maxRowWidth) maxRowWidth = x
      col += 1
      prevAppId = appId
    })
    return { itemPos, maxRowWidth }
  }

  // Chips vullen eerst de volle beschikbare breedte van de lane (zoveel
  // kolommen als er passen) en wrappen pas naar een tweede rij als het echt
  // niet meer past — elke lane krijgt altijd zijn eigen rij (forceOwnRow),
  // dus er is geen reden meer om ze kunstmatig op een laag vast aantal
  // kolommen te houden.
  function groupApplicatieflowDeps(deps, appIdOf, accent) {
    const hasBanner = accent !== 'overstijgend'
    const availableWidth = LANE_PACK_MAX_WIDTH - (hasBanner ? LANE_BANNER_W + LANE_CONTENT_GAP : 0)
    const maxCols = Math.max(1, Math.floor(availableWidth / LANE_ITEM_W))
    const perRow = Math.max(1, Math.min(maxCols, deps.length))
    const rows = deps.length > 0 ? Math.ceil(deps.length / perRow) : 1
    const contentHeight = Math.max(LANE_ROW_H, rows * LANE_ROW_H)
    const height = hasBanner ? contentHeight : LANE_BADGE_PAD_TOP + contentHeight
    const { itemPos, maxRowWidth } = layoutLaneItems(deps, perRow, appIdOf)
    const contentWidth = Math.max(LANE_ITEM_W, maxRowWidth)
    const width = hasBanner ? LANE_BANNER_W + LANE_CONTENT_GAP + contentWidth : contentWidth
    return { height, itemPos, width }
  }

  // Losse boven-/onderpadding: bovenaan moet er ruimte zijn voor het
  // label-pilletje ('RUN FLOW'/'ONTWIKKELFLOW', ~52-55px hoog inclusief zijn
  // eigen top-offset) zodat de eerste lane/stage-rij er niet overheen valt;
  // onderaan is dat niet nodig, dus die padding mag kleiner blijven.
  const ZONE_TOP_PAD = 66
  const ZONE_BOTTOM_PAD = 30
  const devZoneTop = STAGE_Y - ZONE_TOP_PAD
  // Proces-overstijgend-lane: eigen sectie ónder de gewone kolomstapel, met
  // een vaste marge zodat hij nooit tegen de laatste kaart van de
  // kolomstapel aan komt te staan — en, als hij niet nodig is (geen
  // procesoverstijgende Ontwikkelflow-dependencies, of uitgezet via
  // 'Weergeven'), telt hij niet mee in de zonehoogte (geen lege
  // placeholder-ruimte).
  const appStackBottom = STAGE_Y + 80 + maxStackPerStage * 38
  const OVERSTIJGEND_BAND_GAP = 30
  const hasOntwikkelflowOverstijgend = showOverstijgend && ontwikkelflowOverstijgendDeps.length > 0
  const overstijgendBandTop = appStackBottom + OVERSTIJGEND_BAND_GAP
  const overstijgendBandHeight = hasOntwikkelflowOverstijgend
    ? groupApplicatieflowDeps(ontwikkelflowOverstijgendDeps, undefined, 'overstijgend').height + LANE_PAD_TOP + LANE_PAD_BOTTOM
    : 0
  const devZoneBottom = (hasOntwikkelflowOverstijgend ? overstijgendBandTop + overstijgendBandHeight : appStackBottom) + ZONE_BOTTOM_PAD
  // SEAM_H is geen lege kloof maar de hoogte van een overgangsvlak (zie
  // 'zone:seam' verderop) dat de blauwe Applicatieflow-tint geleidelijk laat
  // overlopen in de witte Ontwikkelflow-zone, zodat het één doorlopend
  // canvas oogt i.p.v. twee losse afgeronde blokken met een randje ertussen.
  const SEAM_H = 16
  const applicatieflowZoneBottom = devZoneTop - SEAM_H

  WORKFLOW_STAGES.forEach((stage, i) => {
    const id = `stage:${stage}`
    nodes.push({
      id,
      type: 'stage',
      position: withSavedPosition(id, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y }),
      data: { stage, color: stageColor(stage), note: stageNotes?.[stage] ?? '' },
      draggable: true,
    })
    if (i > 0) {
      edges.push({
        id: `stage:${WORKFLOW_STAGES[i - 1]}->stage:${stage}`,
        source: `stage:${WORKFLOW_STAGES[i - 1]}`,
        target: `stage:${stage}`,
        style: { stroke: '#64748b', strokeWidth: 2, opacity: 0.55 },
      })
    }

    const stageCapacity = capacityByStage[stage] ?? []
    stageCapacity.forEach((row, ci) => {
      const bid = `capacity:${row.id}`
      nodes.push({
        id: bid,
        type: 'capacityBadge',
        position: withSavedPosition(bid, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y + 80 + ci * 38 }),
        data: {
          rowId: row.id,
          functieNaam: row.rol,
          seniority: row.seniority,
          risico: row.risico_bij_uitval === 'ja',
          risicoToelichting: row.risico_toelichting,
        },
        draggable: true,
      })
      edges.push({
        id: `stage:${stage}->${bid}`,
        source: `stage:${stage}`,
        target: bid,
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.45 },
      })
    })

    const stageDeps = depsByStage[stage] ?? []
    stageDeps.forEach((dep, di) => {
      const mid = `dependency:${dep.id}`
      depNodeIdByDepId.set(dep.id, mid)
      const risk = calculateRisk(dep)
      nodes.push({
        id: mid,
        type: 'dependencyMarker',
        position: withSavedPosition(mid, { x: STAGE_START_X + i * STAGE_GAP, y: STAGE_Y + 80 + (stageCapacity.length + di) * 38 }),
        data: { titel: dep.titel, risk, dependency: dep, dimmed: riskFilterOn && !HIGH_RISK_LEVELS.includes(risk.level) },
        draggable: true,
      })
      edges.push({
        id: `stage:${stage}->${mid}`,
        source: `stage:${stage}`,
        target: mid,
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.45 },
      })
      // Ontwikkelflow-dependency mag optioneel óók een applicatielabel dragen
      // (Applicatieflow en Ontwikkelflow zijn geen losse werelden) — teken dan een
      // subtiele stippellijn naar de lane-banner van die applicatie, alleen
      // zinvol met Split applicaties aan (anders bestaat er geen aparte lane).
      if (splitApplicaties) {
        ;(dep.applicatieIds ?? []).forEach((appId) => {
          edges.push({
            id: `crossflow:${dep.id}:${appId}`,
            source: `appbanner:${appId}`,
            sourceHandle: 'right-out',
            target: mid,
            style: { stroke: '#7a5c8a', strokeWidth: 1, strokeDasharray: '5 4', opacity: 0.04 },
          })
        })
      }
    })
  })

  // --- Proces-overstijgend-lane: eigen, duidelijk afgebakende sectie ónder
  // de gewone kolomstapel, voor Ontwikkelflow-dependencies zonder
  // applicatielabel. Geen kolomuitlijning per workflowstap (die horen per
  // definitie niet bij één specifieke fase) — gebruikt dezelfde lane-opbouw
  // als Applicatieflow's 'Applicatie-overstijgend', alleen losstaand onder de hele
  // kolomstapel geplaatst zodat de twee elkaar nooit raken.
  if (hasOntwikkelflowOverstijgend) {
    const { height: tbHeight, width: tbWidth } = groupApplicatieflowDeps(ontwikkelflowOverstijgendDeps, undefined, 'overstijgend')
    pushApplicatieflowLane(
      'ontwikkelflow-overstijgend',
      t('teampage.procesOverstijgend'),
      ontwikkelflowOverstijgendDeps,
      STAGE_START_X,
      overstijgendBandTop + LANE_PAD_TOP,
      false,
      'overstijgend',
      undefined,
      undefined,
      tbWidth,
      tbHeight,
      undefined,
    )
  }

  // --- Applicatieflow-lane(s) boven de stage-rij ---
  // Applicatieflow-dependencies horen bij hún applicatie, niet bij een
  // workflowstap — ze staan dus NIET meer op de Ontwikkelflow-kolommen
  // uitgelijnd (dat maakte een lane een tweede, gedupliceerde kolomrij).
  // Elke lane is compact: breedte volgt de eigen inhoud (banner + chips,
  // wrap pas als de volle zonebreedte niet meer past) i.p.v. altijd de volle
  // zonebreedte — meerdere lanes pakken daardoor naast elkaar in dezelfde
  // rij ('shelf'-packing, zie packLaneGroup hieronder) i.p.v. elk een eigen,
  // vaak grotendeels lege rij te vullen. Overstijgend krijgt altijd zijn eigen
  // rij (nooit naast een applicatie-lane gepakt) zodat de zone-indeling —
  // Applicatieflow-applicaties versus Applicatie-overstijgend — visueel duidelijk
  // blijft, ook als de lanes zelf compacter worden.
  const applicatieflowDeps = teamDependencies.filter((d) => d.flowtype === 'applicatieflow')

  // Input/output vast eerder gesplitst dan voorheen (i.p.v. pas na de
  // lane-plaatsing) — nodig omdat de lane-plaatsing hieronder al moet weten
  // hoeveel IO-kaarten er per applicatie aan hangen (zie appIdsWithLane/
  // splitByLane/ioRows), zodat een rij genoeg hoogte reserveert. Zuivere
  // filters op de meegegeven inputs/outputs en showIO — geen afhankelijkheid
  // van lane-plaatsing zelf.
  const effectiveInputs = showIO ? inputs : []
  const effectiveOutputs = showIO ? outputs : []
  const applicatieflowInputs = effectiveInputs.filter((item) => item.flowtype !== 'ontwikkelflow')
  const devInputs = effectiveInputs.filter((item) => item.flowtype === 'ontwikkelflow')
  const applicatieflowOutputs = effectiveOutputs.filter((item) => item.flowtype !== 'ontwikkelflow')
  const devOutputs = effectiveOutputs.filter((item) => item.flowtype === 'ontwikkelflow')

  // Applicaties die in Split-modus een eigen lane krijgen (banner + evt.
  // chips, zie pushApplicatieflowLane/placeLaneGroup hieronder) — alleen dán
  // heeft "dit item hoort bij die lane" betekenis. Zonder lane (Samengevoegd,
  // of een applicatie zonder Applicatieflow-dependency) is er geen rij om
  // naast te zetten; zo'n item valt terug op de oude, over de hele zone
  // gecentreerde kolom (zie splitByLane).
  const appIdsWithLane = splitApplicaties
    ? new Set(
        applications
          .filter((app) => applicatieflowDeps.some((d) => (d.applicatieIds ?? []).includes(app.id)))
          .map((app) => app.id),
      )
    : new Set()

  // Splitst Applicatieflow-input/output in wat aan zo'n lane hangt (per
  // applicatie gegroepeerd — komt straks op de rij van die lane, zie
  // laneGeometry/pushApplicatieflowLane) en de rest (ongewijzigd gecentreerd
  // over de hele zone, zie applicatieflowInEdgeTarget/-OutEdgeTarget
  // verderop).
  function splitByLane(items) {
    const byApp = new Map()
    const rest = []
    for (const item of items) {
      if (item.applicatieId && appIdsWithLane.has(item.applicatieId)) {
        if (!byApp.has(item.applicatieId)) byApp.set(item.applicatieId, [])
        byApp.get(item.applicatieId).push(item)
      } else {
        rest.push(item)
      }
    }
    return { byApp, rest }
  }
  const laneLinkedInputs = splitByLane(applicatieflowInputs)
  const laneLinkedOutputs = splitByLane(applicatieflowOutputs)

  function pushApplicatieflowLane(id, label, deps, x, y, collapsed, accent, appTagFor, appIdOf, width, height, connCount) {
    const bid = `appbanner:${id}`
    // Overstijgend heeft geen eigen bannerkaart meer — alleen het label-
    // pilletje op het achtergrondkader zelf, net als de Ontwikkelflow-
    // Overstijgend-band. 'app'/'group'-lanes behouden hun banner (nodig voor de
    // klik-naar-detail en de in/uitklap-toggle).
    const hasBanner = accent !== 'overstijgend'
    const { itemPos } = groupApplicatieflowDeps(deps, appIdOf, accent)
    const effectiveHeight = collapsed ? LANE_ROW_H : height
    const effectiveWidth = collapsed ? LANE_BANNER_W : width

    // Geometrie van deze lane vastleggen voor de IO-plaatsing en de
    // applicatiekoppelingen (bus), die pas ná alle lanes draaien — ook bij
    // een ingeklapte lane: de banner (en dus het ankerpunt) blijft dan
    // gewoon bestaan, alleen de chips zijn verborgen. `height` is de
    // uiteindelijke (eventueel voor IO-kaarten opgehoogde) rijhoogte — de
    // IO-plaatsing centreert daar zelf weer binnen, zie stackCenteredOnPoint.
    if (hasBanner) laneGeometry.set(id, { x, y, bid, width: effectiveWidth, height: effectiveHeight })

    const bgId = `${bid}:bg`
    nodes.push({
      id: bgId,
      type: 'laneGroup',
      position: { x: x - LANE_PAD_X, y: y - LANE_PAD_TOP },
      data: {
        width: effectiveWidth + LANE_PAD_X * 2,
        height: effectiveHeight + LANE_PAD_TOP + LANE_PAD_BOTTOM,
        accent,
        label: hasBanner ? undefined : label,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    })

    if (hasBanner) {
      nodes.push({
        id: bid,
        type: 'applicatieflowBanner',
        position: withSavedPosition(bid, { x, y }),
        data: {
          width: LANE_BANNER_W,
          label,
          count: deps.length,
          deps,
          connCount: connCount ?? 0,
          emptyLabel: t('teampage.applicatieflowBannerEmpty'),
          accent,
          // Een echte applicatie-lane opent de detailmodal van die applicatie;
          // Applicatiegerelateerd heeft geen specifieke applicatie om te
          // tonen en springt daarom naar de Applicaties-sectie.
          onClick: accent === 'app' && onOpenAppDetail ? () => onOpenAppDetail(id) : onOpenApplicatieflow,
          collapsed,
          onToggleCollapse: onToggleLaneCollapse ? () => onToggleLaneCollapse(id) : undefined,
          toggleLabel: collapsed ? t('teampage.laneExpand') : t('teampage.laneCollapse'),
        },
        draggable: true,
      })
    }

    if (collapsed) return

    deps.forEach((dep) => {
      const { row, x: colX } = itemPos.get(dep.id)
      const mid = `${bid}:dep:${dep.id}`
      depNodeIdByDepId.set(dep.id, mid)
      const risk = calculateRisk(dep)
      nodes.push({
        id: mid,
        type: 'dependencyMarker',
        position: withSavedPosition(mid, {
          x: x + (hasBanner ? LANE_BANNER_W + LANE_CONTENT_GAP : 0) + colX,
          y: y + (hasBanner ? 0 : LANE_BADGE_PAD_TOP) + row * LANE_ROW_H,
        }),
        data: {
          titel: dep.titel,
          risk,
          dependency: dep,
          dimmed: riskFilterOn && !HIGH_RISK_LEVELS.includes(risk.level),
          appTag: appTagFor ? appTagFor(dep) : undefined,
        },
        draggable: true,
      })
      // Zonder banner is er geen node meer om de chip mee te verbinden — de
      // omsluitende kader (laneGroup) toont de groepering al visueel.
      if (hasBanner) {
        edges.push({
          id: `${bid}->${mid}`,
          source: bid,
          sourceHandle: 'right-out',
          target: mid,
          style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.45 },
        })
      }
    })
  }

  // LANE_STACK_GAP houdt rekening met de padding van elke lane's achtergrond-
  // kader (LANE_PAD_TOP/BOTTOM), anders overlappen de kaders van opeenvolgende
  // rijen elkaar net iets.
  const LANE_STACK_GAP = LANE_GAP + LANE_PAD_TOP + LANE_PAD_BOTTOM
  // Vloer voor de lane-stapeling wordt afgeleid van de échte Applicatieflow-
  // zonegrens (applicatieflowZoneBottom, hierboven al berekend) in plaats van een
  // los vast getal vanaf STAGE_Y — zo is een minimale marge tussen de
  // dichtstbijzijnde lane en de Ontwikkelflow-naad gegarandeerd in de
  // rekensom zelf, ongeacht hoeveel content er in de lanes zit.
  const APPLICATIEFLOW_GAP_ABOVE_SEAM = 32
  let applicatieflowTop = applicatieflowZoneBottom - APPLICATIEFLOW_GAP_ABOVE_SEAM - LANE_PAD_BOTTOM
  let topLaneY = null
  // Id van de lane/groep dichtst bij de stage-rij — het natuurlijke
  // aanknopingspunt voor Applicatieflow-IO, analoog aan hoe Ontwikkelflow-IO aan de
  // eerste/laatste workflowstap hangt. baseLaneAppId is hetzelfde, maar dan
  // het kale request-id (zonder 'appbanner:'-prefix) — alleen gezet als het
  // om een echte applicatie-lane gaat (dus met een geldige laneGeometry-
  // entry), voor de gerichte gutter-route van de "rest"-outputitems verderop.
  let baseLaneId = null
  let baseLaneAppId = null
  // Per app-id (alleen accent==='app'-lanes) de uiteindelijke geometrie —
  // gevuld door pushApplicatieflowLane zodra de rij geplaatst is, gelezen
  // door de IO-plaatsing verderop zodra alle lanes staan (pas dan is elke
  // lane's definitieve y bekend).
  const laneGeometry = new Map()

  // 'Shelf'-packing: elke aangevraagde lane krijgt zijn eigen (compacte)
  // breedte; lanes pakken links-naar-rechts in dezelfde rij tot de
  // zonebreedte vol is, en wrappen dan naar een nieuwe rij. Een lane met
  // forceOwnRow (Overstijgend) sluit de huidige rij altijd af en krijgt een rij
  // voor zichzelf, zodat 'm nooit tussen applicatie-lanes in komt te staan.
  // Rijen worden ná elkaar geplaatst met de EERSTE rij bovenaan (verst van de
  // stage-rij) en de LAATSTE rij het dichtst bij de stage-rij — lanes die
  // later in de aangeleverde lijst staan (bv. Overstijgend, altijd als laatste
  // toegevoegd) komen dus dicht tegen Ontwikkelflow aan te liggen, als een
  // rustige basislaag onder de applicatie-lanes.
  function placeLaneGroup(requests) {
    if (requests.length === 0) return
    const sized = requests.map((r) => {
      // Overstijgend heeft geen bannerkaart meer en dus ook geen in/uitklap-
      // toggle meer — altijd volledig getoond.
      const collapsed = r.accent === 'overstijgend' ? false : (collapsedLaneIds?.has(r.id) ?? false)
      const { height, width } = groupApplicatieflowDeps(r.deps, r.appIdOf, r.accent)
      // Meer gekoppelde IO-kaarten dan chip-rijen? Dan reserveert de rij
      // extra hoogte, zodat de gestapelde kaarten (zie stackCenteredOnPoint
      // verderop) niet buiten hun eigen rij in de volgende lane belanden.
      // Niet bij een ingeklapte lane — dat is een bewust compacte keuze, de
      // IO-kaarten blijven dan wel op de (kortere) bannerrij aangehaakt.
      const ioHeight = collapsed || !r.ioRows ? 0 : (r.ioRows - 1) * IO_Y_GAP + IO_CARD_HEIGHT_ESTIMATE
      return { ...r, collapsed, height: collapsed ? LANE_ROW_H : Math.max(height, ioHeight), width: collapsed ? LANE_BANNER_W : width }
    })

    const rows = []
    let currentRow = []
    let currentRowWidth = 0
    sized.forEach((lane) => {
      const w = lane.width + LANE_PACK_GAP_X
      const fitsInRow = currentRow.length === 0 || currentRowWidth + w <= LANE_PACK_MAX_WIDTH
      if (lane.forceOwnRow && currentRow.length > 0) {
        rows.push(currentRow)
        currentRow = []
        currentRowWidth = 0
      } else if (!fitsInRow) {
        rows.push(currentRow)
        currentRow = []
        currentRowWidth = 0
      }
      currentRow.push(lane)
      currentRowWidth += w
      if (lane.forceOwnRow) {
        rows.push(currentRow)
        currentRow = []
        currentRowWidth = 0
      }
    })
    if (currentRow.length > 0) rows.push(currentRow)

    const rowHeights = rows.map((row) => Math.max(...row.map((l) => l.height)))
    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rows.length - 1) * LANE_STACK_GAP

    applicatieflowTop -= totalHeight
    let rowY = applicatieflowTop
    rows.forEach((row, ri) => {
      let x = STAGE_START_X
      row.forEach((lane) => {
        pushApplicatieflowLane(lane.id, lane.label, lane.deps, x, rowY, lane.collapsed, lane.accent, lane.appTagFor, lane.appIdOf, lane.width, lane.height, lane.connCount)
        // Alleen een lane mét banner (laneGeometry-entry; Overstijgend heeft
        // er geen) kan het ankerpunt zijn — zónder deze check kon baseLaneId
        // op een niet-bestaande 'appbanner:unlabeled'-node uitkomen zodra
        // Overstijgend de laatst geplaatste rij was (in Split-modus altijd
        // het geval als Overstijgend voorkomt, want die staat altijd als
        // laatste in de aangeleverde lijst) — met als gevolg dat React Flow
        // alle Applicatieflow-IO-lijnen naar dat doel stilzwijgend liet
        // vallen. Rijen worden hier top-naar-onder doorlopen, dus de LAATST
        // geziene geldige (bannerde) lane is vanzelf de rij het dichtst bij
        // de stage-rij — precies het oorspronkelijke doel van baseLaneId.
        if (laneGeometry.has(lane.id)) {
          baseLaneId = `appbanner:${lane.id}`
          baseLaneAppId = lane.id
        }
        x += lane.width + LANE_PACK_GAP_X
      })
      rowY += rowHeights[ri] + LANE_STACK_GAP
    })
    topLaneY = applicatieflowTop
    applicatieflowTop -= LANE_STACK_GAP
  }

  function primaryAppId(dep) {
    return (dep.applicatieIds ?? [])[0]
  }

  function appTagLabel(dep) {
    const names = (dep.applicatieIds ?? []).map((id) => applications.find((a) => a.id === id)?.naam).filter(Boolean)
    if (names.length === 0) return undefined
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
  }

  if (splitApplicaties && applications.length > 0) {
    const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
    const overstijgendRequest =
      unlabeled.length > 0 && showOverstijgend
        ? { id: 'unlabeled', label: t('teampage.appOverstijgend'), deps: unlabeled, accent: 'overstijgend', forceOwnRow: true }
        : null

    // Applicatielanes: applicaties zijn hier de hoofdstructuur, elke
    // applicatie krijgt zijn eigen compacte lane (blauw) die naast andere
    // lanes pakt i.p.v. een eigen volle rij te vullen. Een applicatie zonder
    // Applicatieflow-dependencies krijgt bewust GEEN lane (leeg blokje is een
    // storende placeholder) — hij blijft gewoon beheersbaar in de sectie
    // 'Applicaties in beheer/ontwikkeling' onder het canvas, alleen niet op
    // dit canvas zichtbaar zolang er niets aan gelabeld is. Overstijgend staat
    // er altijd los onder, als eigen rij.
    const query = (laneFilterQuery ?? '').trim().toLowerCase()
    const visibleApplications = query ? applications.filter((app) => (app.naam || '').toLowerCase().includes(query)) : applications
    // Aantal app-naar-app-koppelingen per applicatie, voor het '↔ N'-badge op
    // de banner — vervangt de permanent geteekende lijn als rust-indicator.
    const connCountByAppId = {}
    applicatieflowConnecties.forEach((c) => {
      connCountByAppId[c.van] = (connCountByAppId[c.van] ?? 0) + 1
      connCountByAppId[c.naar] = (connCountByAppId[c.naar] ?? 0) + 1
    })
    const appRequests = visibleApplications
      .map((app) => ({
        id: app.id,
        label: app.naam || '—',
        deps: applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).includes(app.id)),
        accent: 'app',
        connCount: connCountByAppId[app.id] ?? 0,
        // Elke applicatie krijgt in Split per applicatie zijn eigen rij
        // (nooit naast een andere applicatie-lane gepakt), zodat de lijst
        // altijd netjes onder elkaar staat: banner links, dependencies rechts.
        forceOwnRow: true,
        // Hoeveel IO-kaarten straks aan déze rij komen te hangen (zie
        // laneLinkedInputs/-Outputs) — bepaalt of de rij extra hoogte nodig
        // heeft (zie de ioHeight-berekening in placeLaneGroup's sized-stap).
        ioRows: Math.max(laneLinkedInputs.byApp.get(app.id)?.length ?? 0, laneLinkedOutputs.byApp.get(app.id)?.length ?? 0),
      }))
      .filter((r) => r.deps.length > 0)
    placeLaneGroup(overstijgendRequest ? [...appRequests, overstijgendRequest] : appRequests)

    // De koppelingen uit de Applicatieflow-vragenlijst ('welke applicatie
    // geeft werk/data door aan welke andere') lopen als 'bus' door de lege
    // gang links van de lanes (BUS_CHANNEL_X) i.p.v. rechtstreeks van banner
    // naar banner — een directe lijn zou bij twee lanes met een derde
    // ertussen dwars over die tussenliggende lane/chips heen lopen. Beide
    // uiteinden haken daarom aan de LINKERkant van hun banner aan (bus-out/
    // left-in, zie ApplicatieflowBannerNode); channelIndex verdeelt
    // gelijktijdige koppelingen simpelweg cyclisch over de drie banen, zodat
    // ze elkaar niet allemaal op precies dezelfde x overlappen. Rust-opacity
    // ligt hoger dan de losse IO-lijnen (0.04): dit zijn de koppelingen
    // tussen applicaties zelf, de structuur van de zone, geen losse ruis.
    let channelIndex = 0
    applicatieflowConnecties.forEach((c) => {
      const sourceId = `appbanner:${c.van}`
      const targetId = `appbanner:${c.naar}`
      if (!nodes.some((n) => n.id === sourceId) || !nodes.some((n) => n.id === targetId)) return
      const vanNaam = applications.find((a) => a.id === c.van)?.naam || '—'
      const naarNaam = applications.find((a) => a.id === c.naar)?.naam || '—'
      const sourceGeo = laneGeometry.get(c.van)
      const targetGeo = laneGeometry.get(c.naar)
      const channelX = BUS_CHANNEL_X[channelIndex % BUS_CHANNEL_X.length]
      channelIndex += 1
      const points =
        sourceGeo && targetGeo
          ? gutterRoute(sourceGeo.x, sourceGeo.y + LANE_BANNER_CENTER_Y, channelX, targetGeo.x, targetGeo.y + LANE_BANNER_CENTER_Y)
          : undefined
      edges.push({
        id: `appconn:${c.id}`,
        source: sourceId,
        sourceHandle: 'bus-out',
        target: targetId,
        targetHandle: 'left-in',
        type: 'layout',
        style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.25 },
        // Hover toont de opsomming, klik opent 'm bewerkbaar in het
        // focuspaneel (zie onEdgeClick / buildFocusPanelContent).
        data: {
          points,
          kind: 'appconn',
          connId: c.id,
          tooltipTitle: `${vanNaam} → ${naarNaam}`,
          tooltipSub: t('teampage.edgeFocusTypeAppConn'),
          punten: c.punten ?? [],
        },
      })
    })
  } else {
    // Samengevoegd = totaalbeeld van het team: applicaties zijn hier bewust
    // GEEN eigen node/lane meer, alleen nog context. Twee rustige subgroepen
    // binnen de Applicatieflow-zone: Overstijgend (niet-gelabeld, groen) en
    // Applicatiegerelateerd (gelabeld, neutraal) — in die laatste staan alle
    // gelabelde deps door elkaar in één wrap-rooster, elk met een klein
    // applicatienaam-tagje. Licht gesorteerd op eerste applicatielabel zodat
    // deps van dezelfde app in de praktijk vaak naast elkaar vallen, zonder
    // een harde scheiding/eigen lane per app te forceren.
    const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
    const labeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length > 0)
    const appIndexOf = new Map(applications.map((a, i) => [a.id, i]))
    const sortedLabeled = [...labeled].sort((a, b) => {
      const aIdx = Math.min(...(a.applicatieIds ?? []).map((id) => appIndexOf.get(id) ?? 999), 999)
      const bIdx = Math.min(...(b.applicatieIds ?? []).map((id) => appIndexOf.get(id) ?? 999), 999)
      return aIdx - bIdx
    })
    const groupRequests = []
    if (sortedLabeled.length > 0) {
      groupRequests.push({
        id: 'grouped',
        label: t('teampage.applicatiegerelateerd'),
        deps: sortedLabeled,
        accent: 'group',
        appTagFor: appTagLabel,
        appIdOf: primaryAppId,
      })
    }
    if (unlabeled.length > 0 && showOverstijgend) {
      groupRequests.push({ id: 'unlabeled', label: t('teampage.appOverstijgend'), deps: unlabeled, accent: 'overstijgend', forceOwnRow: true })
    }
    placeLaneGroup(groupRequests)
  }

  const lastStage = WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1]

  // ZONE_X/ZONE_WIDTH/ZONE_TOP_PAD/devZoneTop/devZoneBottom/SEAM_H/
  // applicatieflowZoneBottom zijn al hierboven berekend (vóór de lane-plaatsing) —
  // hier volgt alleen nog applicatieflowZoneTop, die pas ná lane-plaatsing bekend
  // kan zijn (afhankelijk van topLaneY).
  const applicatieflowZoneTop =
    topLaneY !== null ? topLaneY - LANE_PAD_TOP - ZONE_TOP_PAD : applicatieflowZoneBottom - 140

  nodes.push({
    id: 'zone:applicatieflow',
    type: 'flowZone',
    position: { x: ZONE_X, y: applicatieflowZoneTop },
    data: {
      width: ZONE_WIDTH,
      height: applicatieflowZoneBottom - applicatieflowZoneTop,
      background: 'linear-gradient(180deg, #eef5fa 0%, #eaf1f7 100%)',
      border: '1px solid #2a5f8a26',
      radius: '22px 22px 0 0',
      shadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)',
      label: t('teampage.zoneApplicatieflow'),
      labelBg: '#2a5f8a',
      labelColor: '#fff',
      labelBorder: 'none',
      labelDotColor: '#bcd6ea',
      labelShadow: '0 2px 6px rgba(42,95,138,0.35)',
      // Applicaties zijn in Samengevoegd geen eigen node meer — dit
      // tekstregeltje geeft nog wel aan hoeveel er meespelen, puur als
      // context bij de zone zelf.
      subtitle: !splitApplicaties && applications.length > 0 ? t('teampage.zoneApplicatieflowAppsSubtitle', { count: applications.length }) : undefined,
    },
    draggable: false,
    selectable: false,
    zIndex: -3,
  })
  nodes.push({
    id: 'zone:devflow',
    type: 'flowZone',
    position: { x: ZONE_X, y: devZoneTop },
    data: {
      width: ZONE_WIDTH,
      height: devZoneBottom - devZoneTop,
      background: '#fdfdfe',
      border: '1px solid #e6eaef',
      radius: '0 0 20px 20px',
      shadow: '0 1px 2px rgba(15,23,42,0.03)',
      label: t('teampage.zoneOntwikkelflow'),
      labelBg: '#f4f6f8',
      labelColor: '#475569',
      labelBorder: '1px solid #e6eaef',
      labelDotColor: '#94a3b8',
      labelShadow: 'none',
    },
    draggable: false,
    selectable: false,
    zIndex: -3,
  })
  // Naadloze overgang: vult exact de ruimte tussen de twee zones met een
  // vloeiende kleurovergang, geen randradius/border — de twee afgeronde
  // blokken lezen zo als één doorlopend canvas i.p.v. twee losse vlakken.
  nodes.push({
    id: 'zone:seam',
    type: 'flowZone',
    position: { x: ZONE_X, y: applicatieflowZoneBottom },
    data: {
      width: ZONE_WIDTH,
      height: SEAM_H,
      background: 'linear-gradient(180deg, #eaf1f7 0%, #fdfdfe 100%)',
    },
    draggable: false,
    selectable: false,
    zIndex: -3,
  })

  // Input/output splitsen op flowcontext: items zonder flowtype of met
  // 'applicatieflow' horen bij de Applicatieflow-zone (huidig gedrag, dus geen
  // breaking change voor bestaande data); items met 'ontwikkelflow' vallen
  // nu binnen de Ontwikkelflow-zone zelf i.p.v. over de volle canvashoogte
  // te zweven.
  // Compacte flowcontext direct op de IO-kaart (i.p.v. alleen bij hover):
  // hoort dit bij Applicatieflow of Ontwikkelflow, en bij een applicatie of
  // Overstijgend?
  function ioMetaLabel(item) {
    const flowLabel = item.flowtype === 'ontwikkelflow' ? t('teampage.zoneOntwikkelflow') : t('teampage.zoneApplicatieflow')
    const app = item.applicatieId ? applications.find((a) => a.id === item.applicatieId) : null
    const scopeLabel = app ? app.naam || '—' : t('teampage.appOverstijgend')
    return `${flowLabel} · ${scopeLabel}`
  }

  // Voor de "rest" (niet-lane-gekoppelde) IO-items: gecentreerd over de hele
  // zone, maar met een MAXIMUM aantal kaarten per kolom. Zonder dat maximum
  // stapelde een te grote groep gewoon door tot onder de zone, en omdat de
  // applicatieflow- en de ontwikkelflow-stapel dezelfde x delen, kwamen de
  // kaarten daar over elkaar heen te liggen (gemeten op de acht demoteams in
  // beide standen: 4 overlappende paren, ergste geval 57px). Past een stapel
  // niet meer, dan begint er een kolom NAAST de vorige — naar buiten toe, dus
  // inputs verder naar links en outputs verder naar rechts. De zones blijven
  // zo los van elkaar en kunnen elkaars ruimte niet meer in.
  //
  // Geeft per item ook de kolomindex terug; de aanroeper vertaalt die naar een
  // x-verschuiving (IO_COLUMN_STEP), want alleen die weet welke kant "naar
  // buiten" is.
  function stackCenteredInZone(items, zoneTop, zoneBottom) {
    const beschikbaar = Math.max(0, zoneBottom - zoneTop - 24)
    // +1 omdat n kaarten (n-1) keer IO_Y_GAP beslaan. Minstens 1, anders zou
    // een zeer lage zone een oneindig aantal kolommen opleveren.
    const perKolom = Math.max(1, Math.floor(beschikbaar / IO_Y_GAP) + 1)
    return items.map((item, i) => {
      const col = Math.floor(i / perKolom)
      const inCol = i % perKolom
      // Elke kolom apart centreren: een laatste, halfvolle kolom hangt dan niet
      // scheef onderaan maar staat netjes midden in de zone.
      const aantalHier = Math.min(perKolom, items.length - col * perKolom)
      const totalH = Math.max(0, aantalHier - 1) * IO_Y_GAP
      const startY = zoneTop + Math.max(24, (zoneBottom - zoneTop - totalH) / 2)
      return { item, y: startY + inCol * IO_Y_GAP, col }
    })
  }

  // Voor lane-gekoppelde IO-items: gecentreerd rond één vast punt (de rij van
  // hun eigen lane) i.p.v. over een bereik — de kaarten stapelen dus symmetrisch
  // om de lane heen, ongeacht hoeveel extra hoogte die rij daarvoor gereserveerd
  // kreeg (zie de ioRows-boost in placeLaneGroup's sized-berekening).
  function stackCenteredOnPoint(items, centerY) {
    const totalH = Math.max(0, items.length - 1) * IO_Y_GAP
    const startY = centerY - totalH / 2
    return items.map((item, i) => ({ item, y: startY + i * IO_Y_GAP }))
  }

  // Als er geen enkele lane bestaat (geen applicaties/Overstijgend-deps) hebben
  // Applicatieflow-IO-lijntjes niets om aan te haken binnen de Applicatieflow-zone zelf —
  // zonder dit anker vielen ze terug op de Ontwikkelflow-stagerij, waardoor
  // het leek alsof een Applicatieflow-input bij Ontwikkelflow hoorde.
  let applicatieflowInEdgeTarget = baseLaneId
  let applicatieflowOutEdgeTarget = baseLaneId
  if (!baseLaneId) {
    nodes.push({
      id: 'applicatieflowAnchor',
      type: 'flowAnchor',
      position: { x: ZONE_X + ZONE_WIDTH / 2, y: (applicatieflowZoneTop + applicatieflowZoneBottom) / 2 },
      draggable: false,
      selectable: false,
    })
    applicatieflowInEdgeTarget = 'applicatieflowAnchor'
    applicatieflowOutEdgeTarget = 'applicatieflowAnchor'
  }

  // Node-data voor een Applicatieflow-IO-kaart — identiek voor lane-
  // gekoppelde en gecentreerde items, alleen positie en lijndoel verschillen
  // (zie de vier blokken hieronder).
  function applicatieflowIoData(kind, item) {
    return {
      kind,
      itemId: item.id,
      label: item.label,
      linkLabel: resolveLinkLabel(item, kind === 'output' ? 'output' : undefined),
      bronColor: bronTypeColor(item.bron_type),
      externalTeam: item.externalTeam,
      meta: ioMetaLabel(item),
      linkStatus: item.linkStatus,
      linkStatusLabel: translateLinkStatus(item.linkStatus, language),
      ghost: Boolean(item._ghostRequest),
      request: item._ghostRequest ?? item._pendingRequest ?? null,
      requestLabel: item._ghostRequest
        ? t('teampage.requestProposedBy', { team: item._ghostRequest.proposerNaam })
        : item._pendingRequest
          ? t('teampage.requestForItem', { team: item._pendingRequest.proposerNaam })
          : '',
    }
  }
  const applicatieflowIoEdgeData = (item) => ({ kind: 'io', itemId: item.id, tooltipTitle: item.label || '—', tooltipSub: ioMetaLabel(item), punten: item.punten ?? [] })

  // "Rest": items zonder eigen lane (Samengevoegd, Overstijgend, of een
  // applicatie zonder lane) — ongewijzigd gecentreerd over de hele zone. Geen
  // eigen `type: 'layout'` nodig: het inputitem staat altijd links van de
  // héle zone (x = ZONE_X - 210, ruim vóór STAGE_START_X), dus bij
  // tegenoverliggende handles (bron rechts op de kaart, doel links op de
  // banner/het anker) legt React Flow's eigen smoothstep-berekening de bocht
  // op het midden tussen bron- en doel-x — en dat midden ligt bij deze
  // afstanden altijd nog vóór de zone, dus nooit over een lane heen.
  stackCenteredInZone(laneLinkedInputs.rest, applicatieflowZoneTop, applicatieflowZoneBottom).forEach(({ item, y, col }) => {
    const id = `input:${item.id}`
    nodes.push({ id, type: 'ioItem', position: withSavedPosition(id, { x: ZONE_X - 210 - col * IO_COLUMN_STEP, y }), data: applicatieflowIoData('input', item), draggable: true })
    edges.push({
      id: `input:${item.id}->${applicatieflowInEdgeTarget}`,
      source: id,
      target: applicatieflowInEdgeTarget,
      style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.04 },
      data: applicatieflowIoEdgeData(item),
    })
  })
  // Lane-gekoppeld: item hangt aan een specifieke, zichtbare applicatie-lane
  // (Split-modus) — komt op de hoogte van die lane's eigen rij te staan
  // i.p.v. gecentreerd over de hele zone, en haakt rechtstreeks op die ene
  // banner aan. Bron en doel liggen daardoor al op nagenoeg dezelfde hoogte,
  // dus de lijn loopt vanzelf (bijna) recht en kan geen ándere lane kruisen —
  // elke rij heeft een eigen, niet-overlappende hoogteband (forceOwnRow).
  for (const [appId, items] of laneLinkedInputs.byApp) {
    const geo = laneGeometry.get(appId)
    if (!geo) continue
    stackCenteredOnPoint(items, geo.y + LANE_BANNER_CENTER_Y).forEach(({ item, y }) => {
      const id = `input:${item.id}`
      nodes.push({ id, type: 'ioItem', position: withSavedPosition(id, { x: ZONE_X - 210, y }), data: applicatieflowIoData('input', item), draggable: true })
      edges.push({
        id: `input:${item.id}->${geo.bid}`,
        source: id,
        target: geo.bid,
        targetHandle: 'left-in',
        style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.04 },
        data: applicatieflowIoEdgeData(item),
      })
    })
  }
  stackCenteredInZone(laneLinkedOutputs.rest, applicatieflowZoneTop, applicatieflowZoneBottom).forEach(({ item, y, col }) => {
    const id = `output:${item.id}`
    nodes.push({ id, type: 'ioItem', position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20 + col * IO_COLUMN_STEP, y }), data: applicatieflowIoData('output', item), draggable: true })
    // Bron ligt op de rij van baseLaneAppId (het generieke ankerpunt), doel
    // ergens anders in de zone gecentreerd — die twee liggen dus NIET op
    // dezelfde hoogte, en een rechtstreekse lijn zou (bij een brede lane
    // ertussen) dwars over diens chips heen kunnen lopen. Route daarom altijd
    // via de zone-brede rechtergang (voorbij elke lane, ongeacht hoe breed),
    // vanaf het bekende right-out-ankerpunt van de basislane. Alleen relevant
    // als er een echte lane is (baseLaneAppId) — zonder lane bestaat dit
    // kruisingsrisico niet (er is dan niets om overheen te lopen).
    const baseGeo = baseLaneAppId ? laneGeometry.get(baseLaneAppId) : null
    const points = baseGeo
      ? gutterRoute(baseGeo.x + LANE_BANNER_W, baseGeo.y + LANE_BANNER_CENTER_Y, OUTPUT_GUTTER_X, ZONE_X + ZONE_WIDTH + 20, y)
      : undefined
    edges.push({
      id: `${applicatieflowOutEdgeTarget}->output:${item.id}`,
      source: applicatieflowOutEdgeTarget,
      target: id,
      type: points ? 'layout' : undefined,
      style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.04 },
      data: { points, ...applicatieflowIoEdgeData(item) },
    })
  })
  // Lane-gekoppeld: vertrekt vanaf de RECHTERRAND van het lane-kader zelf
  // (voorbij alle chips van die lane, zie de 'lane-out'-handle op
  // LaneGroupNode) i.p.v. vanaf de banner — anders zou de lijn dwars over de
  // eigen chips van die lane heen lopen. Bron en doel liggen op dezelfde
  // hoogte (beide horen bij dezelfde rij), dus verder geen eigen route nodig.
  for (const [appId, items] of laneLinkedOutputs.byApp) {
    const geo = laneGeometry.get(appId)
    if (!geo) continue
    stackCenteredOnPoint(items, geo.y + geo.height / 2).forEach(({ item, y }) => {
      const id = `output:${item.id}`
      nodes.push({ id, type: 'ioItem', position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20, y }), data: applicatieflowIoData('output', item), draggable: true })
      edges.push({
        id: `${geo.bid}:bg->output:${item.id}`,
        source: `${geo.bid}:bg`,
        sourceHandle: 'lane-out',
        target: id,
        style: { stroke: '#2a5f8a', strokeWidth: 1.5, opacity: 0.04 },
        data: applicatieflowIoEdgeData(item),
      })
    })
  }
  stackCenteredInZone(devInputs, devZoneTop, devZoneBottom).forEach(({ item, y, col }) => {
    const id = `input:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X - 210 - col * IO_COLUMN_STEP, y }),
      data: {
        kind: 'input',
        itemId: item.id,
        label: item.label,
        linkLabel: resolveLinkLabel(item),
        bronColor: bronTypeColor(item.bron_type),
        externalTeam: item.externalTeam,
        meta: ioMetaLabel(item),
        linkStatus: item.linkStatus,
        linkStatusLabel: translateLinkStatus(item.linkStatus, language),
        ghost: Boolean(item._ghostRequest),
        request: item._ghostRequest ?? item._pendingRequest ?? null,
        requestLabel: item._ghostRequest
          ? t('teampage.requestProposedBy', { team: item._ghostRequest.proposerNaam })
          : item._pendingRequest
            ? t('teampage.requestForItem', { team: item._pendingRequest.proposerNaam })
            : '',
      },
      draggable: true,
    })
    edges.push({
      id: `input:${item.id}->stage:${WORKFLOW_STAGES[0]}`,
      source: id,
      target: `stage:${WORKFLOW_STAGES[0]}`,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.04 },
      data: { kind: 'io', itemId: item.id, tooltipTitle: item.label || '—', tooltipSub: ioMetaLabel(item), punten: item.punten ?? [] },
    })
  })
  stackCenteredInZone(devOutputs, devZoneTop, devZoneBottom).forEach(({ item, y, col }) => {
    const id = `output:${item.id}`
    nodes.push({
      id,
      type: 'ioItem',
      position: withSavedPosition(id, { x: ZONE_X + ZONE_WIDTH + 20 + col * IO_COLUMN_STEP, y }),
      data: {
        kind: 'output',
        itemId: item.id,
        label: item.label,
        linkLabel: resolveLinkLabel(item, 'output'),
        bronColor: bronTypeColor(item.bron_type),
        externalTeam: item.externalTeam,
        meta: ioMetaLabel(item),
        linkStatus: item.linkStatus,
        linkStatusLabel: translateLinkStatus(item.linkStatus, language),
        ghost: Boolean(item._ghostRequest),
        request: item._ghostRequest ?? item._pendingRequest ?? null,
        requestLabel: item._ghostRequest
          ? t('teampage.requestProposedBy', { team: item._ghostRequest.proposerNaam })
          : item._pendingRequest
            ? t('teampage.requestForItem', { team: item._pendingRequest.proposerNaam })
            : '',
      },
      draggable: true,
    })
    edges.push({
      id: `stage:${lastStage}->output:${item.id}`,
      source: `stage:${lastStage}`,
      target: id,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.04 },
      data: { kind: 'io', itemId: item.id, tooltipTitle: item.label || '—', tooltipSub: ioMetaLabel(item), punten: item.punten ?? [] },
    })
  })

  // Externe teams als subtiele randcontext: alleen via de 'Externe teams
  // tonen'-toggle, als kleine pil-nodes links van het canvas verbonden met
  // stippellijnen naar elke dependency/IO-chip die dat team noemt. Geen
  // aparte, altijd-zichtbare rij — de chips zelf tonen al een klein tagje
  // (zie DependencyMarkerNode/IoNode) ongeacht deze toggle.
  if (showExternalTeams) {
    const externalTeamRefs = new Map()
    function touchExtTeam(name, nodeId) {
      if (!name) return
      if (!externalTeamRefs.has(name)) externalTeamRefs.set(name, [])
      externalTeamRefs.get(name).push(nodeId)
    }
    teamDependencies.forEach((dep) => {
      const nodeId = depNodeIdByDepId.get(dep.id)
      if (nodeId) touchExtTeam(dep.geraakte_team_extern, nodeId)
    })
    inputs.forEach((item) => touchExtTeam(item.externalTeam, `input:${item.id}`))
    outputs.forEach((item) => touchExtTeam(item.externalTeam, `output:${item.id}`))

    const posById = new Map(nodes.map((n) => [n.id, n.position]))
    let extIndex = 0
    for (const [name, refs] of externalTeamRefs) {
      const extId = `externalTeam:${name}`
      nodes.push({
        id: extId,
        type: 'externalTeam',
        position: withSavedPosition(extId, { x: ZONE_X - 420, y: applicatieflowZoneTop + extIndex * 66 }),
        data: { naam: name },
        draggable: true,
      })
      refs.forEach((refId) => {
        if (!posById.has(refId)) return
        edges.push({
          id: `extconn:${name}:${refId}`,
          source: extId,
          target: refId,
          style: { stroke: '#5c6b8a', strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.3 },
        })
      })
      extIndex += 1
    }
  }

  annotations.forEach((item, i) => {
    const id = `annotation:${item.id}`
    nodes.push({
      id,
      type: 'annotation',
      position: withSavedPosition(id, {
        x: 40 + (i % 6) * 190,
        y: Math.max(devZoneBottom + 20, canvasHeightFor(inputs, outputs) + 40) + Math.floor(i / 6) * 190,
      }),
      data: {
        kind: item.kind,
        shape: item.shape,
        symbol: item.symbol,
        text: item.text,
        color: item.color,
        onText: (text) => annotationHandlers.onText(item.id, text),
        ariaLabel: t('teampage.annotationTextLabel'),
        onColor: (color) => annotationHandlers.onColor(item.id, color),
        onRemove: () => annotationHandlers.onRemove(item.id),
      },
      draggable: true,
    })
  })

  annotationEdges.forEach((edge) => {
    edges.push({
      id: `annotation-edge:${edge.id}`,
      source: edge.source,
      target: edge.target,
      style: { stroke: edge.color, strokeWidth: 2.5 },
    })
  })

  const annotationRows = Math.ceil(annotations.length / 6)
  const annotationBaseY = Math.max(devZoneBottom + 20, canvasHeightFor(inputs, outputs) + 40)
  const canvasWidth = STAGE_START_X + (WORKFLOW_STAGES.length - 1) * STAGE_GAP + 460
  // applicatieflowTop is negatief zodra er lanes boven de stage-rij staan;
  // die extra ruimte (naar boven) telt hier mee zodat het canvas niet te
  // krap oogt met meerdere gesplitste applicatie-lanes.
  const canvasHeight = Math.max(420, annotationBaseY + annotationRows * 190 + 100, STAGE_Y - applicatieflowTop + 300)

  // Sluitend vangnet tegen kaartoverlap in de in- en uitvoerkolommen.
  // stackCenteredInZone laat een te volle stapel al doorlopen naar een kolom
  // ernaast, maar dat gold alleen voor de niet-lane-gekoppelde items. De
  // lane-gekoppelde stapels (stackCenteredOnPoint) staan op dezelfde x en
  // konden daar alsnog doorheen lopen: op de demodata viel dat niet op (nul
  // overlap), maar één extra input per team leverde er al twee op.
  //
  // Deze pas schuift een overlappende kaart naar buiten toe (inputs naar
  // links, outputs naar rechts) tot hij vrij staat. Handmatig versleepte
  // kaarten blijven staan: die keuze van de gebruiker wint altijd. Veilig na
  // het opbouwen van de edges, want de IO-lijnen dragen geen vaste punten —
  // React Flow leidt die af uit de uiteindelijke node-posities.
  const ioNodes = nodes.filter((n) => /^(input|output):/.test(n.id))
  for (const node of ioNodes) {
    if (savedLayout?.[node.id]) continue
    const naarBuiten = node.id.startsWith('input:') ? -1 : 1
    const botst = () =>
      ioNodes.some(
        (ander) =>
          ander !== node &&
          Math.abs(ander.position.x - node.position.x) < IO_CARD_WIDTH &&
          Math.abs(ander.position.y - node.position.y) < IO_CARD_HEIGHT_ESTIMATE,
      )
    // Bovengrens puur als noodrem: zonder vrije plek stopt hij liever dan
    // eindeloos door te schuiven.
    for (let poging = 0; poging < 12 && botst(); poging++) {
      node.position = { ...node.position, x: node.position.x + naarBuiten * IO_COLUMN_STEP }
    }
  }

  // smoothstep i.p.v. de standaard bezier-lijn: minder kriskras op een druk
  // teamcanvas met veel gelijktijdige input/output/dependency-verbindingen.
  const routedEdges = edges.map((e) => ({ type: 'smoothstep', ...e }))

  return { nodes, edges: routedEdges, canvasWidth, canvasHeight }
}
