import { vergelijkbareNaam } from './namen'

// Eenmalige omzetting van applicaties naar het centrale register.
//
// Een applicatie bestond alleen als regel binnen de werkstroom van één team, met
// een eigen willekeurig id. Twaalf teams die dezelfde gateway gebruiken leverden
// dus twaalf losse records op die de tool nergens met elkaar in verband kon
// brengen — en daarmee was 'welke applicatie is een gedeeld knelpunt' niet te
// beantwoorden.
//
// Deze omzetting maakt van gelijknamige applicaties één registerrecord en hangt
// alle verwijzingen om. Twee eigenschappen die niet onderhandelbaar zijn:
//
//   - hij draait in twee standen. `plan()` rapporteert alleen en raakt niets
//     aan; `voerUit()` schrijft pas weg. De aanroeper hoort altijd eerst het
//     plan te tonen.
//   - twijfelgevallen (namen die op elkaar lijken maar onder de
//     vergelijkingsregel niet gelijk zijn) worden gemeld en nooit automatisch
//     samengevoegd. Samenvoegen is onomkeerbaar; melden kost niets.
//
// Vergelijken gebeurt met dezelfde regel als de partijkiezer en de
// controlelijst (lib/namen.js): hoofdletters, streepjes, spaties en
// onderstrepingen negeren.

// Twee namen 'lijken op elkaar' als ze een woord van minstens vier letters
// delen, of als de een helemaal in de ander zit. 'Polis Gateway' en 'Gateway
// (oud)' vallen daar dus onder.
//
// Bewust grof: dit is een melding voor een mens die er zelf naar kijkt, geen
// automatische samenvoeging. Liever een twijfelgeval te veel dan twee
// applicaties die stilzwijgend apart blijven staan terwijl ze hetzelfde zijn.
// De ondergrens van vier letters houdt 'app', 'ii' en losse cijfers eruit.
function woorden(naam) {
  return String(naam ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
}

function lijktOp(naamA, naamB, sleutelA, sleutelB) {
  if (!sleutelA || !sleutelB || sleutelA === sleutelB) return false
  if (sleutelA.includes(sleutelB) || sleutelB.includes(sleutelA)) return true
  const b = new Set(woorden(naamB))
  return woorden(naamA).some((w) => b.has(w))
}

// Alle applicaties van alle teams, met het team erbij.
function alleApplicaties(teamWorkflows, teams) {
  const teamNaam = new Map((teams ?? []).map((tm) => [tm.id, tm.naam]))
  const uit = []
  for (const [teamId, wf] of Object.entries(teamWorkflows ?? {})) {
    for (const app of wf?.applications ?? []) {
      if (!app || typeof app !== 'object' || !app.id) continue
      uit.push({ teamId, teamNaam: teamNaam.get(teamId) ?? teamId, id: app.id, naam: typeof app.naam === 'string' ? app.naam : '' })
    }
  }
  return uit
}

// Wat de omzetting zou doen. Verandert niets.
export function plan(state) {
  const apps = alleApplicaties(state?.teamWorkflows, state?.teams)
  const groepen = new Map()
  for (const app of apps) {
    const sleutel = vergelijkbareNaam(app.naam)
    if (!sleutel) continue
    if (!groepen.has(sleutel)) groepen.set(sleutel, [])
    groepen.get(sleutel).push(app)
  }

  const samenvoegingen = []
  const ongewijzigd = []
  for (const [sleutel, groep] of groepen) {
    // Meerdere records met dezelfde naam bij verschillende teams: samenvoegen.
    // Twee records met dezelfde naam bij hetzelfde team blijven ook staan als
    // één registerrecord -- dat is dezelfde applicatie, twee keer ingevoerd.
    const teams = new Set(groep.map((a) => a.teamId))
    if (groep.length > 1) {
      samenvoegingen.push({
        sleutel,
        // De langste naam wint: die draagt meestal de meeste informatie
        // ('Polis Gateway' boven 'polis-gateway').
        naam: groep.map((a) => a.naam).sort((a, b) => b.length - a.length)[0],
        teams: [...teams],
        records: groep,
      })
    } else {
      ongewijzigd.push({ sleutel, naam: groep[0].naam, record: groep[0] })
    }
  }

  // Twijfelgevallen: namen die op elkaar lijken maar niet gelijk zijn. Alleen
  // melden -- deze blijven allemaal apart staan.
  const sleutels = [...groepen.keys()]
  const twijfel = []
  for (let i = 0; i < sleutels.length; i += 1) {
    for (let j = i + 1; j < sleutels.length; j += 1) {
      const naamA = groepen.get(sleutels[i])[0].naam
      const naamB = groepen.get(sleutels[j])[0].naam
      if (!lijktOp(naamA, naamB, sleutels[i], sleutels[j])) continue
      twijfel.push({ namen: [naamA, naamB] })
    }
  }

  return {
    totaalApplicaties: apps.length,
    samenvoegingen,
    ongewijzigd,
    twijfel,
    // Hoeveel losse records er verdwijnen doordat ze in een registerrecord
    // opgaan. Dit getal hoort in de bevestiging te staan.
    verdwijnendeRecords: samenvoegingen.reduce((n, s) => n + s.records.length - 1, 0),
  }
}

// Vervangt een id overal in een willekeurige structuur. De verwijzingen naar
// applicaties staan verspreid (applicatieIds op dependencies, applicatieId op
// input- en outputitems, de connecties en details van de applicatieflow, en de
// bewaarde canvasposities die op id gesleuteld zijn), en met een generieke
// vervanging blijft er geen plek over die vergeten wordt.
function hangOm(waarde, vertaling) {
  if (Array.isArray(waarde)) return waarde.map((x) => hangOm(x, vertaling))
  if (waarde && typeof waarde === 'object') {
    const uit = {}
    for (const [sleutel, v] of Object.entries(waarde)) {
      // Ook sleutels omhangen: layout en applicatieflow.details zijn op
      // applicatie-id gesleuteld.
      uit[vertaling.get(sleutel) ?? sleutel] = hangOm(v, vertaling)
    }
    return uit
  }
  if (typeof waarde === 'string' && vertaling.has(waarde)) return vertaling.get(waarde)
  return waarde
}

// Voert de omzetting echt uit en geeft een nieuwe state terug. Onomkeerbaar
// voor de aanroeper: er is geen terugweg binnen de app, alleen een export van
// tevoren.
export function voerUit(state, vandaag = new Date()) {
  const rapport = plan(state)
  const vertaling = new Map()
  const register = []
  const datum = vandaag.toISOString().slice(0, 10)

  for (const groep of rapport.samenvoegingen) {
    // Het eerste record levert het id: dan hoeft er bij dat team niets om, en
    // dat scheelt onnodig gesleutel aan bewaarde canvasposities.
    const doelId = groep.records[0].id
    for (const record of groep.records.slice(1)) vertaling.set(record.id, doelId)
    register.push({ id: doelId, naam: groep.naam, eigenaar: '', status: 'actief', createdAt: datum, updatedAt: datum })
  }
  for (const los of rapport.ongewijzigd) {
    register.push({ id: los.record.id, naam: los.naam, eigenaar: '', status: 'actief', createdAt: datum, updatedAt: datum })
  }

  const omgehangen = hangOm({ dependencies: state.dependencies, teamWorkflows: state.teamWorkflows }, vertaling)

  // Na het omhangen kan een team twee keer hetzelfde id in zijn eigen
  // applicatielijst hebben (het had er twee met dezelfde naam). Die dubbele
  // regels eruit, anders staat dezelfde kaart twee keer op het canvas.
  const teamWorkflows = {}
  for (const [teamId, wf] of Object.entries(omgehangen.teamWorkflows ?? {})) {
    const gezien = new Set()
    teamWorkflows[teamId] = {
      ...wf,
      applications: (wf.applications ?? []).filter((app) => {
        if (!app?.id || gezien.has(app.id)) return false
        gezien.add(app.id)
        return true
      }),
    }
  }

  return {
    state: { ...state, dependencies: omgehangen.dependencies, teamWorkflows, applicatieregister: register },
    rapport,
  }
}

// Applicaties die door meer dan één team gebruikt worden. Leest het register en
// telt per applicatie de teams die 'm in hun werkstroom hebben staan.
export function applicatiesMetMeerdereTeams(state) {
  const perId = new Map()
  for (const [teamId, wf] of Object.entries(state?.teamWorkflows ?? {})) {
    for (const app of wf?.applications ?? []) {
      if (!app?.id) continue
      if (!perId.has(app.id)) perId.set(app.id, new Set())
      perId.get(app.id).add(teamId)
    }
  }
  const register = new Map((state?.applicatieregister ?? []).map((a) => [a.id, a]))
  return [...perId.entries()]
    .filter(([, teams]) => teams.size > 1)
    .map(([id, teams]) => ({ id, naam: register.get(id)?.naam ?? id, teamIds: [...teams], aantalTeams: teams.size }))
    .sort((a, b) => b.aantalTeams - a.aantalTeams || a.naam.localeCompare(b.naam))
}
