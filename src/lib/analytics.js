// Analyses over ALLE data in de tool: zuivere functies zonder React, elk met
// een uitlegbare regel (geen black box, zie CLAUDE.md). De analysepagina
// (components/AnalysePage.jsx) rendert de uitkomsten; dit bestand rekent.
//
// Tijd: `stateAt` speelt de wijzigingshistorie van een dependency terug naar
// een datum, waardoor trends en doorlooptijden uit de huidige dataset zelf
// komen — geen losse meetmomenten nodig.

import { calculateRisk, riskLevelRank } from './risk'
import { berekenFlowverlies, bepaalKwadrant, isStilRisico, isQuickWin, isVerouderd } from './analysis'
import { resolveChainEdges } from './teamWorkflow'
import { CATEGORIES_INTERN, CATEGORIES_EXTERN, WORKFLOW_STAGES, DEADLINE_TEKST_VERPLICHT } from '../data/constants'

const DAG_MS = 24 * 60 * 60 * 1000

export function isoDag(date) {
  return date.toISOString().slice(0, 10)
}

export function dagenTussen(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAG_MS)
}

function dagenGeledenIso(n, vandaag) {
  return isoDag(new Date(vandaag.getTime() - n * DAG_MS))
}

function tel(items, sleutel) {
  const map = new Map()
  for (const item of items) {
    const k = sleutel(item)
    if (k == null || k === '') continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

function gemiddelde(nums) {
  const lijst = nums.filter((n) => typeof n === 'number' && Number.isFinite(n))
  if (lijst.length === 0) return null
  return Math.round((lijst.reduce((a, b) => a + b, 0) / lijst.length) * 10) / 10
}

function mediaan(nums) {
  const lijst = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b)
  if (lijst.length === 0) return null
  const mid = Math.floor(lijst.length / 2)
  return lijst.length % 2 === 0 ? Math.round((lijst[mid - 1] + lijst[mid]) / 2) : lijst[mid]
}

export const NIVEAUS = ['Laag', 'Gemiddeld', 'Hoog', 'Kritiek']

// ---------------------------------------------------------------------------
// Tijdreizen: toestand op een datum
// ---------------------------------------------------------------------------

const HERLEIDBARE_VELDEN = ['status', 'impact', 'frequentie', 'categorie', 'scope', 'geaccepteerd']

// Toestand van een dependency op een datum: null als hij toen nog niet
// bestond of al gesloten was; anders het record met de veldwaarden van toen.
// Replay: de eerste wijziging ná de datum vertelt wat de waarde óp die datum
// was (haar 'van'); zonder latere wijziging geldt de huidige waarde. Een
// record zonder aanmaakdatum (oude data) telt als altijd bestaand.
export function stateAt(dep, datum) {
  if (dep.aangemaakt_op && dep.aangemaakt_op > datum) return null
  if (dep.gesloten_op && dep.gesloten_op <= datum) return null
  const historie = dep.historie ?? []
  const result = { ...dep }
  for (const veld of HERLEIDBARE_VELDEN) {
    const later = historie.filter((e) => e.veld === veld && e.datum > datum)
    if (later.length > 0) result[veld] = later[0].van
  }
  return result
}

// Wekelijkse reeks (oud → nu): open dependencies per status en per niveau,
// som van de risicoscores, en per week het aantal nieuwe en gesloten.
export function trendReeks(deps, { weken = 26, vandaag = new Date() } = {}) {
  const punten = []
  for (let i = weken; i >= 0; i -= 1) {
    const datum = dagenGeledenIso(i * 7, vandaag)
    const weekStart = dagenGeledenIso(i * 7 + 7, vandaag)
    const open = deps.map((d) => stateAt(d, datum)).filter(Boolean)
    const perStatus = { 'bekend risico': 0, 'actief blokkerend': 0, gemitigeerd: 0 }
    const perNiveau = { Laag: 0, Gemiddeld: 0, Hoog: 0, Kritiek: 0 }
    let scoreSom = 0
    for (const d of open) {
      perStatus[d.status] = (perStatus[d.status] ?? 0) + 1
      const r = calculateRisk(d)
      perNiveau[r.level] += 1
      scoreSom += r.score
    }
    punten.push({
      datum,
      open: open.length,
      perStatus,
      perNiveau,
      scoreSom,
      nieuw: deps.filter((d) => d.aangemaakt_op && d.aangemaakt_op > weekStart && d.aangemaakt_op <= datum).length,
      gesloten: deps.filter((d) => d.gesloten_op && d.gesloten_op > weekStart && d.gesloten_op <= datum).length,
    })
  }
  return punten
}

// Nu tegenover N dagen geleden: de "vorige meting" die de samenvattingskaart
// tot nu toe niet kon tonen.
export function vergelijking(deps, { dagen = 30, vandaag = new Date() } = {}) {
  const toen = dagenGeledenIso(dagen, vandaag)
  const nu = isoDag(vandaag)
  const meet = (datum) => {
    const open = deps.map((d) => stateAt(d, datum)).filter(Boolean)
    const risks = open.map((d) => calculateRisk(d))
    return {
      open: open.length,
      hoogOfKritiek: risks.filter((r) => riskLevelRank(r.level) >= riskLevelRank('Hoog')).length,
      kritiek: risks.filter((r) => r.level === 'Kritiek').length,
      blokkerend: open.filter((d) => d.status === 'actief blokkerend').length,
      gemiddeldeScore: gemiddelde(risks.map((r) => r.score)),
    }
  }
  return { dagen, toen: meet(toen), nu: meet(nu) }
}

// ---------------------------------------------------------------------------
// Doorlooptijden
// ---------------------------------------------------------------------------

// Per dependency: dagen van aanmaak tot mitigatie (eerste statuswijziging
// naar gemitigeerd), tot sluiting, en hoe lang hij in totaal 'actief
// blokkerend' is geweest (elke blokkerende periode uit de historie, een nog
// lopende periode tot vandaag).
export function doorlooptijden(deps, { vandaag = new Date() } = {}) {
  const nu = isoDag(vandaag)
  return deps.map((dep) => {
    const historie = dep.historie ?? []
    const mitigatie = historie.find((e) => e.veld === 'status' && e.naar === 'gemitigeerd')
    let blokkerendDagen = 0
    let start = null
    for (const e of historie.filter((x) => x.veld === 'status')) {
      if (e.naar === 'actief blokkerend' && start === null) start = e.datum
      if (e.van === 'actief blokkerend' && start !== null) {
        blokkerendDagen += dagenTussen(start, e.datum)
        start = null
      }
    }
    if (start !== null && dep.status === 'actief blokkerend' && !dep.gesloten_op) blokkerendDagen += dagenTussen(start, nu)
    if (start !== null && dep.gesloten_op) blokkerendDagen += dagenTussen(start, dep.gesloten_op)
    return {
      dep,
      totMitigatie: dep.aangemaakt_op && mitigatie ? dagenTussen(dep.aangemaakt_op, mitigatie.datum) : null,
      totSluiting: dep.aangemaakt_op && dep.gesloten_op ? dagenTussen(dep.aangemaakt_op, dep.gesloten_op) : null,
      leeftijd: dep.aangemaakt_op ? dagenTussen(dep.aangemaakt_op, dep.gesloten_op ?? nu) : null,
      blokkerendDagen,
      escalaties: historie.filter((e) => e.veld === 'status' && e.naar === 'actief blokkerend').length,
    }
  })
}

export function doorlooptijdSamenvatting(rijen) {
  const mit = rijen.map((r) => r.totMitigatie).filter((n) => n !== null)
  const sluit = rijen.map((r) => r.totSluiting).filter((n) => n !== null)
  const blok = rijen.filter((r) => r.blokkerendDagen > 0).map((r) => r.blokkerendDagen)
  return {
    aantalGemitigeerd: mit.length,
    gemiddeldTotMitigatie: gemiddelde(mit),
    mediaanTotMitigatie: mediaan(mit),
    aantalGesloten: sluit.length,
    gemiddeldTotSluiting: gemiddelde(sluit),
    mediaanTotSluiting: mediaan(sluit),
    aantalOoitBlokkerend: blok.length,
    gemiddeldBlokkerend: gemiddelde(blok),
  }
}

export function groepeer(items, sleutel) {
  const map = new Map()
  for (const item of items) {
    const k = sleutel(item)
    if (k == null || k === '') continue
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

// ---------------------------------------------------------------------------
// Portfolio: verdelingen, kwadranten, labels, leeftijd
// ---------------------------------------------------------------------------

export function portfolio(open, { vandaag = new Date() } = {}) {
  const nu = isoDag(vandaag)
  const risks = open.map((d) => ({ dep: d, risk: calculateRisk(d) }))
  const perNiveau = Object.fromEntries(NIVEAUS.map((n) => [n, risks.filter((r) => r.risk.level === n).length]))
  const kwadranten = { quick_win: [], opschalen: [], opruimen: [], accepteren: [], onvolledig: [] }
  for (const d of open) {
    const k = bepaalKwadrant(d)
    kwadranten[k ?? 'onvolledig'].push(d)
  }
  return {
    totaal: open.length,
    perNiveau,
    perStatus: Object.fromEntries(tel(open, (d) => d.status)),
    perScope: Object.fromEntries(tel(open, (d) => d.scope)),
    perFlowtype: Object.fromEntries(tel(open, (d) => d.flowtype ?? 'onbepaald')),
    perCategorie: [...tel(open, (d) => d.categorie)].sort((a, b) => b[1] - a[1]),
    perEffect: [...tel(open, (d) => d.effectOpFlow)].sort((a, b) => b[1] - a[1]),
    kwadranten,
    stilRisico: risks.filter(({ dep, risk }) => isStilRisico(dep, risk.level)).map((r) => r.dep),
    quickWins: open.filter((d) => isQuickWin(d)),
    verouderd: open.filter((d) => isVerouderd(d)),
    gemitigeerdMaarHoog: risks.filter(({ dep, risk }) => dep.status === 'gemitigeerd' && riskLevelRank(risk.level) >= riskLevelRank('Hoog')).map((r) => r.dep),
    zonderActieAfspraak: open.filter((d) => d.status !== 'gemitigeerd' && !d.actieAfspraak?.trim()),
    hoogZonderActieAfspraak: risks
      .filter(({ dep, risk }) => riskLevelRank(risk.level) >= riskLevelRank('Hoog') && !dep.actieAfspraak?.trim() && dep.status !== 'gemitigeerd')
      .map((r) => r.dep),
    gemitigeerdZonderTekst: open.filter((d) => d.status === 'gemitigeerd' && !d.mitigatie?.trim()),
    mitigatieZonderStatus: open.filter((d) => d.status !== 'gemitigeerd' && d.mitigatie?.trim()),
    geaccepteerd: open.filter((d) => d.geaccepteerd),
    acuut: open.filter((d) => d.aangemaakt_op && dagenTussen(d.aangemaakt_op, nu) <= 30),
    chronisch: open.filter((d) => d.aangemaakt_op && dagenTussen(d.aangemaakt_op, nu) > 365),
    deadlines: open
      .filter((d) => DEADLINE_TEKST_VERPLICHT.includes(d.deadline))
      .sort((a, b) => (a.deadline === 'harde_deadline' ? -1 : 1) - (b.deadline === 'harde_deadline' ? -1 : 1)),
    // Sluimerend: bekend risico op Hoog/Kritiek, ouder dan een half jaar, zonder afspraak.
    sluimerend: risks
      .filter(({ dep, risk }) => dep.status === 'bekend risico' && riskLevelRank(risk.level) >= riskLevelRank('Hoog') && dep.aangemaakt_op && dagenTussen(dep.aangemaakt_op, nu) > 180 && !dep.actieAfspraak?.trim())
      .map((r) => r.dep),
    geaccepteerdHoog: risks.filter(({ dep, risk }) => dep.geaccepteerd && riskLevelRank(risk.level) >= riskLevelRank('Hoog')).map((r) => r.dep),
    // Gemitigeerd maar na 90 dagen nog niet afgesloten (datum uit de historie).
    gemitigeerdNietGesloten: open
      .filter((d) => d.status === 'gemitigeerd')
      .map((d) => ({ dep: d, datum: mitigatieDatum(d) }))
      .filter((r) => r.datum && dagenTussen(r.datum, nu) > 90)
      .map((r) => ({ dep: r.dep, dagen: dagenTussen(r.datum, nu) }))
      .sort((a, b) => b.dagen - a.dagen),
    top: risks.sort((a, b) => b.risk.score - a.risk.score).slice(0, 15).map((r) => r.dep),
  }
}

// Laatste statuswijziging naar gemitigeerd, of null.
function mitigatieDatum(dep) {
  const events = (dep.historie ?? []).filter((e) => e.veld === 'status' && e.naar === 'gemitigeerd')
  return events.length > 0 ? events[events.length - 1].datum : null
}

// Score per rij over twee assen (team × categorie), met per cel het aantal
// en het hoogste niveau — de basis voor hotspots.
export function hotspots(open, teams) {
  const cellen = []
  for (const team of teams) {
    for (const categorie of [...new Set([...CATEGORIES_INTERN, ...CATEGORIES_EXTERN])]) {
      const deps = open.filter((d) => d.teamId === team.id && d.categorie === categorie)
      if (deps.length === 0) continue
      const hoogste = deps.map((d) => calculateRisk(d)).sort((a, b) => b.score - a.score)[0]
      cellen.push({ teamId: team.id, categorie, aantal: deps.length, hoogste: hoogste.level, deps })
    }
  }
  const gemiddeld = cellen.length > 0 ? cellen.reduce((s, c) => s + c.aantal, 0) / cellen.length : 0
  return cellen
    .map((c) => ({ ...c, factor: gemiddeld > 0 ? Math.round((c.aantal / gemiddeld) * 10) / 10 : 0 }))
    .sort((a, b) => b.aantal - a.aantal)
}

// ---------------------------------------------------------------------------
// Concentratie: partijen, team-op-team, kennis
// ---------------------------------------------------------------------------

// Externe partijen als hubs: uit dependencies (partij-id of vrije naam,
// teams uitgesloten) én uit input-/output-items (partij-id of vrije naam).
export function partijOverzicht({ open, teamWorkflows, externalParties, teams }) {
  const byId = new Map(externalParties.map((p) => [p.id, p]))
  const byName = new Map(externalParties.map((p) => [p.naam.trim().toLowerCase(), p]))
  const teamNamen = new Set(teams.map((tm) => tm.naam.trim().toLowerCase()))
  const partijen = new Map()
  const resolve = (partijId, naam) => {
    const schoon = typeof naam === 'string' ? naam.trim() : ''
    const record = (partijId && byId.get(partijId)) || (schoon && byName.get(schoon.toLowerCase())) || null
    if (!record && !schoon) return null
    if (!record && teamNamen.has(schoon.toLowerCase())) return null
    const key = record ? `id:${record.id}` : `naam:${schoon.toLowerCase()}`
    if (!partijen.has(key)) {
      partijen.set(key, {
        key,
        id: record?.id ?? null,
        naam: record?.naam ?? schoon,
        type: record?.type ?? '',
        status: record?.status ?? 'niet_in_register',
        teams: new Set(),
        deps: [],
        inputs: 0,
        outputs: 0,
      })
    }
    return partijen.get(key)
  }
  for (const d of open) {
    if (d.geraaktTeamId) continue
    const p = resolve(d.geraaktPartijId, d.geraakte_team_extern)
    if (!p) continue
    p.teams.add(d.teamId)
    p.deps.push(d)
  }
  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    for (const item of wf.inputs ?? []) {
      const p = resolve(item.externalPartyId, item.externalTeam)
      if (p) {
        p.teams.add(teamId)
        p.inputs += 1
      }
    }
    for (const item of wf.outputs ?? []) {
      const p = resolve(item.externalPartyId, item.externalTeam)
      if (p) {
        p.teams.add(teamId)
        p.outputs += 1
      }
    }
  }
  return [...partijen.values()]
    .map((p) => {
      const risks = p.deps.map((d) => calculateRisk(d))
      const hoogste = risks.sort((a, b) => b.score - a.score)[0]?.level ?? null
      return {
        ...p,
        teams: [...p.teams],
        aantalTeams: p.teams.size,
        hoogste,
        blokkerend: p.deps.filter((d) => d.status === 'actief blokkerend').length,
        flowverlies: p.deps.reduce((s, d) => s + (berekenFlowverlies(d)?.score ?? 0), 0),
      }
    })
    .sort((a, b) => b.aantalTeams - a.aantalTeams || b.deps.length - a.deps.length)
}

// Wie blokkeert wie: dependencies met een ander team als veroorzaker
// (op id, anders op exact matchende naam), als lijst van paren én als
// netto-balans per team (veroorzaakt bij anderen minus zelf ondervonden).
export function teamOpTeam(open, teams) {
  const naamNaarId = new Map(teams.map((tm) => [tm.naam.trim().toLowerCase(), tm.id]))
  const paren = new Map()
  for (const d of open) {
    const cause = d.geraaktTeamId ?? naamNaarId.get((d.geraakte_team_extern ?? '').trim().toLowerCase()) ?? null
    if (!cause || cause === d.teamId) continue
    const key = `${cause}->${d.teamId}`
    if (!paren.has(key)) paren.set(key, { veroorzaker: cause, getroffen: d.teamId, deps: [] })
    paren.get(key).deps.push(d)
  }
  const rijen = [...paren.values()]
    .map((p) => ({ ...p, aantal: p.deps.length, hoogste: p.deps.map((d) => calculateRisk(d)).sort((a, b) => b.score - a.score)[0]?.level ?? null }))
    .sort((a, b) => b.aantal - a.aantal)
  const balans = teams.map((tm) => {
    const veroorzaakt = rijen.filter((r) => r.veroorzaker === tm.id).reduce((s, r) => s + r.aantal, 0)
    const ondervonden = rijen.filter((r) => r.getroffen === tm.id).reduce((s, r) => s + r.aantal, 0)
    return { teamId: tm.id, veroorzaakt, ondervonden, netto: veroorzaakt - ondervonden }
  })
  return { rijen, balans }
}

// Kennisconcentratie per team: kennis-dependencies (aantal, hoog of
// kritiek), capaciteitsrijen met risico bij uitval, seniority-mix. Een
// simpele, uitlegbare "bus-factor"-score: kennis-hoog + risicorijen.
export function kennisConcentratie(open, teamWorkflows, teams) {
  return teams
    .map((tm) => {
      const kennis = open.filter((d) => d.teamId === tm.id && d.categorie === 'Kennis-concentratie')
      const kennisHoog = kennis.filter((d) => riskLevelRank(calculateRisk(d).level) >= riskLevelRank('Hoog'))
      const cap = teamWorkflows[tm.id]?.capacity ?? []
      const risicoRijen = cap.filter((c) => c.risico_bij_uitval === 'ja')
      const totaal = cap.reduce((s, c) => s + (Number(c.aantal) || 0), 0)
      const senior = cap.filter((c) => c.seniority === 'senior').reduce((s, c) => s + (Number(c.aantal) || 0), 0)
      const junior = cap.filter((c) => c.seniority === 'junior').reduce((s, c) => s + (Number(c.aantal) || 0), 0)
      const apps = teamWorkflows[tm.id]?.applicatieflow?.details ?? {}
      const appsRisico = Object.values(apps).filter((d) => d?.risico_bij_uitval === 'ja').length
      return {
        teamId: tm.id,
        kennis: kennis.length,
        kennisHoog: kennisHoog.length,
        risicoRijen: risicoRijen.length,
        appsRisico,
        totaal,
        senior,
        junior,
        score: kennisHoog.length * 2 + kennis.length + risicoRijen.length + appsRisico,
        deps: kennis,
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// Keten
// ---------------------------------------------------------------------------

// `open` is de (eventueel op team gefilterde) set; `openAlle` de ongefilterde,
// zodat 'koppeling zonder dependency' niet vals alarm slaat voor dependencies
// die het andere team heeft geregistreerd. Met `teamFilter` worden de
// uitkomsten na afloop teruggebracht tot wat dat team raakt.
export function ketenKengetallen({ teams, teamWorkflows, open, openAlle = open, vandaag = new Date(), teamFilter = null }) {
  const nu = isoDag(vandaag)
  const inScope = (teamId) => !teamFilter || teamId === teamFilter
  const raakt = (teamId, item) => !teamFilter || teamId === teamFilter || item.linkedTeam === teamFilter
  const edgesAll = resolveChainEdges(teamWorkflows)
  const edges = edgesAll.filter((e) => e.status !== 'voorgesteld')
  const ids = new Set(teams.map((tm) => tm.id))
  const perTeam = teams.map((tm) => {
    const inkomend = edges.filter((e) => e.targetTeam === tm.id && e.sourceTeam !== tm.id)
    const uitgaand = edges.filter((e) => e.sourceTeam === tm.id && e.targetTeam !== tm.id)
    return {
      teamId: tm.id,
      inkomend: inkomend.length,
      uitgaand: uitgaand.length,
      partnersIn: new Set(inkomend.map((e) => e.sourceTeam)).size,
      partnersUit: new Set(uitgaand.map((e) => e.targetTeam)).size,
      totaal: inkomend.length + uitgaand.length,
    }
  })
  // Cycli: DFS over teamniveau.
  const adj = new Map(teams.map((tm) => [tm.id, new Set()]))
  for (const e of edges) if (ids.has(e.sourceTeam) && ids.has(e.targetTeam) && e.sourceTeam !== e.targetTeam) adj.get(e.sourceTeam).add(e.targetTeam)
  const cycli = []
  const seen = new Set()
  function dfs(start, node, pad) {
    for (const next of adj.get(node) ?? []) {
      if (next === start) {
        const cyc = [...pad]
        const key = [...cyc].sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          cycli.push(cyc)
        }
      } else if (!pad.includes(next) && pad.length < 6) {
        dfs(start, next, [...pad, next])
      }
    }
  }
  for (const tm of teams) dfs(tm.id, tm.id, [tm.id])
  // Losse items en verzoeken.
  const losseInputs = []
  const losseOutputs = []
  const verzoeken = []
  const geconsumeerd = new Set(edges.map((e) => `${e.sourceTeam}:${e.sourceOutputId}`))
  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    for (const item of wf.inputs ?? []) {
      if (!item.linkedTeam && !item.externalPartyId && !item.externalTeam) losseInputs.push({ teamId, item })
      if (item.linkedTeam && item.linkStatus === 'voorgesteld') verzoeken.push({ teamId, item, kind: 'input', leeftijd: item.linkVoorgesteldOp ? dagenTussen(item.linkVoorgesteldOp, nu) : null })
    }
    for (const item of wf.outputs ?? []) {
      if (!geconsumeerd.has(`${teamId}:${item.id}`) && !item.externalPartyId && !item.externalTeam && !(item.linkedTeam && item.linkStatus === 'voorgesteld')) losseOutputs.push({ teamId, item })
      if (item.linkedTeam && item.linkStatus === 'voorgesteld') verzoeken.push({ teamId, item, kind: 'output', leeftijd: item.linkVoorgesteldOp ? dagenTussen(item.linkVoorgesteldOp, nu) : null })
    }
  }
  const afgewezen = Object.entries(teamWorkflows).flatMap(([teamId, wf]) => [...(wf.inputs ?? []), ...(wf.outputs ?? [])].filter((i) => i.linkStatus === 'afgewezen').map((item) => ({ teamId, item })))
  const besluiten = Object.entries(teamWorkflows)
    .flatMap(([teamId, wf]) => [...(wf.inputs ?? []), ...(wf.outputs ?? [])].map((item) => ({ teamId, item })))
    .filter(({ teamId, item }) => item.linkVoorgesteldOp && item.linkBesluitOp && raakt(teamId, item))
    .map(({ item }) => dagenTussen(item.linkVoorgesteldOp, item.linkBesluitOp))
  // Mismatch: dependency op een team zonder ketenkoppeling, en koppelingen
  // zonder dependency in beide richtingen.
  const naamNaarId = new Map(teams.map((tm) => [tm.naam.trim().toLowerCase(), tm.id]))
  const gekoppeld = new Set(edges.flatMap((e) => [`${e.sourceTeam}|${e.targetTeam}`, `${e.targetTeam}|${e.sourceTeam}`]))
  const depZonderKoppeling = []
  const depParen = new Set()
  const veroorzakerVan = (d) => {
    const cause = d.geraaktTeamId ?? naamNaarId.get((d.geraakte_team_extern ?? '').trim().toLowerCase()) ?? null
    return !cause || cause === d.teamId ? null : cause
  }
  for (const d of openAlle) {
    const cause = veroorzakerVan(d)
    if (!cause) continue
    depParen.add(`${cause}|${d.teamId}`)
    depParen.add(`${d.teamId}|${cause}`)
  }
  for (const d of open) {
    const cause = veroorzakerVan(d)
    if (cause && !gekoppeld.has(`${cause}|${d.teamId}`)) depZonderKoppeling.push({ dep: d, cause })
  }
  const koppelingZonderDep = []
  const gezien = new Set()
  for (const e of edges) {
    const key = `${e.sourceTeam}|${e.targetTeam}`
    if (gezien.has(key)) continue
    gezien.add(key)
    if (!depParen.has(key)) koppelingZonderDep.push(e)
  }
  // Applicaties als single point of failure: risico bij uitval plus wat eraan hangt.
  const spof = []
  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    for (const app of wf.applications ?? []) {
      const detail = wf.applicatieflow?.details?.[app.id]
      const deps = open.filter((d) => d.teamId === teamId && (d.applicatieIds ?? []).includes(app.id))
      const io = [...(wf.inputs ?? []), ...(wf.outputs ?? [])].filter((i) => i.applicatieId === app.id).length
      const conns = (wf.applicatieflow?.connecties ?? []).filter((c) => c.van === app.id || c.naar === app.id).length
      spof.push({ teamId, app, risico: detail?.risico_bij_uitval === 'ja', deps: deps.length, io, conns, hoogste: deps.map((d) => calculateRisk(d)).sort((a, b) => b.score - a.score)[0]?.level ?? null, last: deps.length + io + conns })
    }
  }
  return {
    edges,
    perTeam: perTeam.filter((r) => inScope(r.teamId)).sort((a, b) => b.totaal - a.totaal),
    cycli: teamFilter ? cycli.filter((c) => c.includes(teamFilter)) : cycli,
    losseInputs: losseInputs.filter((x) => inScope(x.teamId)),
    losseOutputs: losseOutputs.filter((x) => inScope(x.teamId)),
    verzoeken: verzoeken.filter((v) => raakt(v.teamId, v.item)).sort((a, b) => (b.leeftijd ?? 0) - (a.leeftijd ?? 0)),
    afgewezen: afgewezen.filter((x) => raakt(x.teamId, x.item)),
    goedkeuring: { aantal: besluiten.length, gemiddeld: gemiddelde(besluiten), mediaan: mediaan(besluiten) },
    depZonderKoppeling,
    koppelingZonderDep: teamFilter ? koppelingZonderDep.filter((e) => e.sourceTeam === teamFilter || e.targetTeam === teamFilter) : koppelingZonderDep,
    spof: spof.filter((s) => inScope(s.teamId)).sort((a, b) => Number(b.risico) - Number(a.risico) || b.last - a.last),
  }
}

// ---------------------------------------------------------------------------
// Applicaties en ontwikkelproces
// ---------------------------------------------------------------------------

export function werkstapBelasting(open, teamWorkflows) {
  return WORKFLOW_STAGES.map((stage) => {
    const deps = open.filter((d) => d.flowtype === 'ontwikkelflow' && d.workflowStap === stage)
    const capaciteit = Object.values(teamWorkflows).flatMap((wf) => wf.capacity ?? []).filter((c) => c.fase === stage)
    return {
      stage,
      deps: deps.length,
      blokkerend: deps.filter((d) => d.status === 'actief blokkerend').length,
      effecten: [...tel(deps, (d) => d.effectOpFlow)].sort((a, b) => b[1] - a[1]).slice(0, 3),
      personen: capaciteit.reduce((s, c) => s + (Number(c.aantal) || 0), 0),
      teamsMetCapaciteit: new Set(Object.entries(teamWorkflows).filter(([, wf]) => (wf.capacity ?? []).some((c) => c.fase === stage)).map(([id]) => id)).size,
    }
  })
}

export function procesOverstijgend(open) {
  return {
    ontwikkelflowZonderStap: open.filter((d) => d.flowtype === 'ontwikkelflow' && !d.workflowStap),
    applicatieOverstijgend: open.filter((d) => d.flowtype === 'applicatieflow' && (d.applicatieIds ?? []).length === 0),
    multiApp: open.filter((d) => (d.applicatieIds ?? []).length > 1),
    zonderFlowtype: open.filter((d) => !d.flowtype),
  }
}

// Flowverlies (wachttijd × frequentie) opgeteld: per team, per partij en
// per categorie — "wat kost het om niets te doen".
export function flowverliesSommen(open, teams, partijen) {
  const perTeam = teams
    .map((tm) => {
      const deps = open.filter((d) => d.teamId === tm.id)
      const scores = deps.map((d) => berekenFlowverlies(d)?.score ?? null)
      return { teamId: tm.id, som: scores.reduce((s, n) => s + (n ?? 0), 0), aantal: deps.length, onvolledig: scores.filter((n) => n === null).length }
    })
    .sort((a, b) => b.som - a.som)
  const perCategorie = [...groepeer(open, (d) => d.categorie)]
    .map(([categorie, deps]) => ({ categorie, som: deps.reduce((s, d) => s + (berekenFlowverlies(d)?.score ?? 0), 0), aantal: deps.length }))
    .sort((a, b) => b.som - a.som)
  const perPartij = partijen.map((p) => ({ naam: p.naam, som: p.flowverlies, aantal: p.deps.length })).sort((a, b) => b.som - a.som)
  return { perTeam, perCategorie, perPartij }
}

// ---------------------------------------------------------------------------
// Datakwaliteit en beheer
// ---------------------------------------------------------------------------

export function hygiene({ open, alle, teamWorkflows, externalParties, teams }) {
  const partijIds = new Set(externalParties.map((p) => p.id))
  const geweigerd = new Set(externalParties.filter((p) => p.status === 'geweigerd').map((p) => p.id))
  const teamNamen = new Set(teams.map((tm) => tm.naam.trim().toLowerCase()))
  const titels = groepeer(open, (d) => d.titel.trim().toLowerCase())
  const dubbeleTitels = [...titels.values()].filter((deps) => deps.length > 1 && new Set(deps.map((d) => d.teamId)).size > 1).flat()
  const intern = new Set(CATEGORIES_INTERN)
  const extern = new Set(CATEGORIES_EXTERN)
  const checks = [
    { key: 'flowtype', records: open.filter((d) => !d.flowtype) },
    { key: 'profiel', records: open.filter((d) => !d.wachttijd || !d.deadline || !d.oplosbaarheid) },
    { key: 'deadlineTekst', records: open.filter((d) => DEADLINE_TEKST_VERPLICHT.includes(d.deadline) && !d.deadlineTekst?.trim()) },
    { key: 'categorieScope', records: open.filter((d) => (d.scope === 'intern' && !intern.has(d.categorie)) || (d.scope === 'extern' && !extern.has(d.categorie))) },
    { key: 'externZonderPartij', records: open.filter((d) => d.scope === 'extern' && !d.geraaktPartijId && !d.geraaktTeamId && !teamNamen.has((d.geraakte_team_extern ?? '').trim().toLowerCase())) },
    { key: 'partijOnbekend', records: open.filter((d) => d.geraaktPartijId && !partijIds.has(d.geraaktPartijId)) },
    { key: 'partijGeweigerd', records: open.filter((d) => d.geraaktPartijId && geweigerd.has(d.geraaktPartijId)) },
    { key: 'effectLeeg', records: open.filter((d) => !d.effectOpFlow) },
    { key: 'geenToelichting', records: open.filter((d) => !d.toelichting?.trim()) },
    { key: 'dubbeleTitels', records: dubbeleTitels },
    { key: 'verouderd', records: open.filter((d) => isVerouderd(d)) },
    { key: 'zonderAanmaak', records: alle.filter((d) => !d.aangemaakt_op) },
  ]
  const ioChecks = []
  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    const apps = new Set((wf.applications ?? []).map((a) => a.id))
    for (const item of [...(wf.inputs ?? []), ...(wf.outputs ?? [])]) {
      if (item.applicatieId && !apps.has(item.applicatieId)) ioChecks.push({ teamId, item, key: 'ioAppOnbekend' })
      if (item.externalPartyId && !partijIds.has(item.externalPartyId)) ioChecks.push({ teamId, item, key: 'ioPartijOnbekend' })
      if (!item.flowtype) ioChecks.push({ teamId, item, key: 'ioZonderFlowtype' })
    }
  }
  const appsZonderRelatie = []
  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    for (const app of wf.applications ?? []) {
      const gebruikt =
        open.some((d) => (d.applicatieIds ?? []).includes(app.id)) ||
        [...(wf.inputs ?? []), ...(wf.outputs ?? [])].some((i) => i.applicatieId === app.id) ||
        (wf.applicatieflow?.connecties ?? []).some((c) => c.van === app.id || c.naar === app.id)
      if (!gebruikt) appsZonderRelatie.push({ teamId, app })
    }
  }
  return { checks, ioChecks, appsZonderRelatie }
}

export function registratieGedrag(changeLog, teams, { weken = 12, vandaag = new Date() } = {}) {
  const nu = vandaag.getTime()
  const perWeek = []
  for (let i = weken - 1; i >= 0; i -= 1) {
    const eind = nu - i * 7 * DAG_MS
    const begin = eind - 7 * DAG_MS
    const inWeek = changeLog.filter((c) => {
      const ts = new Date(c.timestamp).getTime()
      return ts > begin && ts <= eind
    })
    perWeek.push({
      datum: isoDag(new Date(eind)),
      aangemaakt: inWeek.filter((c) => c.type === 'dependency_created').length,
      gewijzigd: inWeek.filter((c) => c.type === 'dependency_updated').length,
      gesloten: inWeek.filter((c) => c.type === 'dependency_closed').length,
      koppelingen: inWeek.filter((c) => c.type.startsWith('link_')).length,
    })
  }
  const drieMaanden = nu - 90 * DAG_MS
  const recent = changeLog.filter((c) => new Date(c.timestamp).getTime() > drieMaanden)
  const perTeam = teams
    .map((tm) => {
      const eigen = recent.filter((c) => c.teamId === tm.id)
      return {
        teamId: tm.id,
        aangemaakt: eigen.filter((c) => c.type === 'dependency_created').length,
        gewijzigd: eigen.filter((c) => c.type === 'dependency_updated').length,
        gesloten: eigen.filter((c) => c.type === 'dependency_closed').length,
        totaal: eigen.length,
      }
    })
    .sort((a, b) => b.totaal - a.totaal)
  const openReview = changeLog
    .filter((c) => c.type === 'dependency_created' && c.status === 'pending')
    .map((c) => ({ ...c, leeftijd: Math.round((nu - new Date(c.timestamp).getTime()) / DAG_MS) }))
    .sort((a, b) => b.leeftijd - a.leeftijd)
  const duplicaten = changeLog.filter((c) => c.type === 'dependency_created' && c.duplicateOfId)
  return { perWeek, perTeam, openReview, duplicaten, totaal: changeLog.length }
}

// ---------------------------------------------------------------------------
// Ontwikkeling: score-verandering, leeftijd, statusovergangen, projectie
// ---------------------------------------------------------------------------

// Per open dependency de risicoscore van N dagen geleden tegenover nu
// (replay via stateAt); alleen dependencies die toen al bestonden.
export function scoreVerandering(alle, { dagen = 30, vandaag = new Date() } = {}) {
  const toen = dagenGeledenIso(dagen, vandaag)
  const rijen = []
  for (const dep of alle) {
    if (dep.gesloten_op) continue
    const vorige = stateAt(dep, toen)
    if (!vorige) continue
    const van = calculateRisk(vorige)
    const naar = calculateRisk(dep)
    if (van.score === naar.score) continue
    rijen.push({ dep, van: van.score, naar: naar.score, vanNiveau: van.level, naarNiveau: naar.level, delta: naar.score - van.score })
  }
  return {
    dagen,
    verslechterd: rijen.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta || b.naar - a.naar),
    verbeterd: rijen.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta || b.van - a.van),
  }
}

export const LEEFTIJD_KLASSEN = [
  { key: '0-30', tot: 30 },
  { key: '31-90', tot: 90 },
  { key: '91-180', tot: 180 },
  { key: '181-365', tot: 365 },
  { key: '>365', tot: Infinity },
]

// Dagen sinds aanmaak van de open dependencies, in klassen, totaal en per team.
export function leeftijdsverdeling(open, teams, { vandaag = new Date() } = {}) {
  const nu = isoDag(vandaag)
  const leeftijd = (d) => (d.aangemaakt_op ? dagenTussen(d.aangemaakt_op, nu) : null)
  const rij = (deps) => {
    const klassen = Object.fromEntries(LEEFTIJD_KLASSEN.map((k) => [k.key, 0]))
    let onbekend = 0
    for (const d of deps) {
      const n = leeftijd(d)
      if (n === null) onbekend += 1
      else klassen[LEEFTIJD_KLASSEN.find((k) => n <= k.tot).key] += 1
    }
    const lijst = deps.map(leeftijd)
    return { aantal: deps.length, klassen, onbekend, gemiddeld: gemiddelde(lijst), mediaan: mediaan(lijst) }
  }
  return { totaal: rij(open), perTeam: teams.map((tm) => ({ teamId: tm.id, ...rij(open.filter((d) => d.teamId === tm.id)) })) }
}

// Statusovergangen uit de historie: van→naar geteld, mitigaties die niet
// standhielden (gemitigeerd → weer open, en nu nog niet gemitigeerd) en
// heropeningen na sluiting.
export function statusOvergangen(alle) {
  const matrix = new Map()
  const teruggevallen = []
  const heropend = []
  for (const dep of alle) {
    for (const e of dep.historie ?? []) {
      if (e.veld === 'status' && e.van && e.naar) {
        const key = `${e.van}→${e.naar}`
        matrix.set(key, (matrix.get(key) ?? 0) + 1)
        if (e.van === 'gemitigeerd' && !dep.gesloten_op && dep.status !== 'gemitigeerd') teruggevallen.push({ dep, datum: e.datum, naar: e.naar })
      }
      if (e.veld === 'gesloten' && e.van && !e.naar) heropend.push({ dep, datum: e.datum })
    }
  }
  const laatstePerDep = (rijen) => {
    const gezien = new Set()
    return rijen
      .sort((a, b) => b.datum.localeCompare(a.datum))
      .filter((r) => {
        if (gezien.has(r.dep.id)) return false
        gezien.add(r.dep.id)
        return true
      })
  }
  return {
    matrix: [...matrix]
      .map(([k, aantal]) => {
        const [van, naar] = k.split('→')
        return { van, naar, aantal }
      })
      .sort((a, b) => b.aantal - a.aantal),
    teruggevallen: laatstePerDep(teruggevallen),
    heropend: laatstePerDep(heropend),
  }
}

// Lineaire doortrekking van de laatste N weken: gemiddeld nieuw en gesloten
// per week, en wat dat over de horizon betekent. Geen model, alleen tempo.
export function projectie(trend, { weken = 13, horizon = 13 } = {}) {
  const recent = trend.slice(-weken)
  if (recent.length === 0) return null
  const som = (k) => recent.reduce((s, p) => s + p[k], 0)
  const nieuwPerWeek = som('nieuw') / recent.length
  const geslotenPerWeek = som('gesloten') / recent.length
  const netto = nieuwPerWeek - geslotenPerWeek
  const openNu = trend[trend.length - 1].open
  const r1 = (n) => Math.round(n * 10) / 10
  return {
    weken,
    horizon,
    nieuwPerWeek: r1(nieuwPerWeek),
    geslotenPerWeek: r1(geslotenPerWeek),
    nettoPerWeek: r1(netto),
    openNu,
    openOverHorizon: Math.max(0, Math.round(openNu + netto * horizon)),
    wekenTotLeeg: geslotenPerWeek > 0 ? Math.round(openNu / geslotenPerWeek) : null,
  }
}

// ---------------------------------------------------------------------------
// Keten: stroomopwaarts risico, wederzijdse afhankelijkheid, kaartvolledigheid
// ---------------------------------------------------------------------------

// BFS over teamniveau; geeft Map teamId → afstand (start zelf uitgesloten).
function bereik(start, buren) {
  const afstand = new Map()
  const queue = [[start, 0]]
  while (queue.length > 0) {
    const [node, d] = queue.shift()
    for (const next of buren.get(node) ?? []) {
      if (next === start || afstand.has(next)) continue
      afstand.set(next, d + 1)
      queue.push([next, d + 1])
    }
  }
  return afstand
}

// Wat komt er via geaccepteerde koppelingen van stroomopwaarts binnen: hoeveel
// teams leveren (direct en verder), hoeveel blokkerende en hoge dependencies
// die directe toeleveranciers open hebben, en hoeveel teams een team zelf
// stroomafwaarts raakt. `bevestigd` = eigen dependencies die een
// stroomopwaarts team als veroorzaker noemen (kaart en praktijk stemmen overeen).
export function ketenRisico({ teams, teamWorkflows, openAlle }) {
  const edges = resolveChainEdges(teamWorkflows).filter((e) => e.status !== 'voorgesteld' && e.sourceTeam && e.targetTeam && e.sourceTeam !== e.targetTeam)
  const op = new Map(teams.map((tm) => [tm.id, new Set()]))
  const af = new Map(teams.map((tm) => [tm.id, new Set()]))
  for (const e of edges) {
    op.get(e.targetTeam)?.add(e.sourceTeam)
    af.get(e.sourceTeam)?.add(e.targetTeam)
  }
  const naamNaarId = new Map(teams.map((tm) => [tm.naam.trim().toLowerCase(), tm.id]))
  const isHoog = (d) => riskLevelRank(calculateRisk(d).level) >= riskLevelRank('Hoog')
  const isBlok = (d) => d.status === 'actief blokkerend'
  return teams
    .map((tm) => {
      const stroomop = bereik(tm.id, op)
      const stroomaf = bereik(tm.id, af)
      const direct = [...(op.get(tm.id) ?? [])]
      const directDeps = openAlle.filter((d) => direct.includes(d.teamId))
      const ketenDeps = openAlle.filter((d) => stroomop.has(d.teamId))
      const eigen = openAlle.filter((d) => d.teamId === tm.id)
      const bevestigd = eigen.filter((d) => {
        const cause = d.geraaktTeamId ?? naamNaarId.get((d.geraakte_team_extern ?? '').trim().toLowerCase()) ?? null
        return cause && stroomop.has(cause)
      })
      return {
        teamId: tm.id,
        direct: direct.length,
        directTeams: direct,
        stroomopwaarts: stroomop.size,
        stroomafwaarts: stroomaf.size,
        directBlokkerend: directDeps.filter(isBlok).length,
        directHoog: directDeps.filter(isHoog).length,
        ketenBlokkerend: ketenDeps.filter(isBlok).length,
        ketenHoog: ketenDeps.filter(isHoog).length,
        bevestigd: bevestigd.length,
        deps: directDeps.filter((d) => isBlok(d) || isHoog(d)).sort((a, b) => calculateRisk(b).score - calculateRisk(a).score),
      }
    })
    .sort((a, b) => b.directBlokkerend + b.directHoog - (a.directBlokkerend + a.directHoog) || b.stroomafwaarts - a.stroomafwaarts)
}

// Teamparen die dependencies op elkaar hebben (uit de wie-blokkeert-wie-rijen).
export function wederzijds(rijen) {
  const map = new Map(rijen.map((r) => [`${r.veroorzaker}|${r.getroffen}`, r]))
  const gezien = new Set()
  const paren = []
  for (const r of rijen) {
    const terug = map.get(`${r.getroffen}|${r.veroorzaker}`)
    if (!terug) continue
    const key = [r.veroorzaker, r.getroffen].sort().join('|')
    if (gezien.has(key)) continue
    gezien.add(key)
    paren.push({ a: r.veroorzaker, b: r.getroffen, aNaarB: r.aantal, bNaarA: terug.aantal, deps: [...r.deps, ...terug.deps] })
  }
  return paren.sort((x, y) => y.aNaarB + y.bNaarA - (x.aNaarB + x.bNaarA))
}

// Hoe compleet is de kaart van een team: inputs verklaard (koppeling of
// partij), outputs afgenomen of extern, applicaties met detail, koppelingen
// met punten. Volledigheid = gemiddelde van die percentages.
export function kaartVolledigheid({ teams, teamWorkflows }) {
  const edges = resolveChainEdges(teamWorkflows).filter((e) => e.status !== 'voorgesteld')
  const geconsumeerd = new Set(edges.map((e) => `${e.sourceTeam}:${e.sourceOutputId}`))
  const pct = (n, tot) => (tot > 0 ? Math.round((n / tot) * 100) : null)
  const geaccepteerd = (i) => i.linkedTeam && i.linkStatus !== 'voorgesteld' && i.linkStatus !== 'afgewezen'
  return teams
    .map((tm) => {
      const wf = teamWorkflows[tm.id] ?? {}
      const inputs = wf.inputs ?? []
      const outputs = wf.outputs ?? []
      const gekoppeld = inputs.filter(geaccepteerd)
      const inExtern = inputs.filter((i) => !i.linkedTeam && (i.externalPartyId || i.externalTeam)).length
      const inVoorgesteld = inputs.filter((i) => i.linkedTeam && i.linkStatus === 'voorgesteld').length
      const inLos = inputs.length - gekoppeld.length - inExtern - inVoorgesteld
      const afgenomen = (o) => geconsumeerd.has(`${tm.id}:${o.id}`)
      const uitAfgenomen = outputs.filter(afgenomen).length
      const uitExtern = outputs.filter((o) => !afgenomen(o) && (o.externalPartyId || o.externalTeam)).length
      const uitVoorgesteld = outputs.filter((o) => !afgenomen(o) && !(o.externalPartyId || o.externalTeam) && o.linkedTeam && o.linkStatus === 'voorgesteld').length
      const uitOnbenut = outputs.length - uitAfgenomen - uitExtern - uitVoorgesteld
      const metPunten = gekoppeld.filter((i) => {
        const bron = (teamWorkflows[i.linkedTeam]?.outputs ?? []).find((o) => o.id === i.linkedOutputId)
        return (i.punten ?? []).length > 0 || (bron?.punten ?? []).length > 0
      }).length
      const apps = wf.applications ?? []
      const details = wf.applicatieflow?.details ?? {}
      const appsMetDetail = apps.filter((a) => details[a.id]?.risico_bij_uitval).length
      const notities = Object.values(wf.stageNotes ?? {}).filter((n) => (typeof n === 'string' ? n.trim() : n)).length + (wf.annotations ?? []).length
      const onderdelen = [pct(gekoppeld.length + inExtern, inputs.length), pct(uitAfgenomen + uitExtern, outputs.length), pct(appsMetDetail, apps.length), pct(metPunten, gekoppeld.length)].filter((n) => n !== null)
      return {
        teamId: tm.id,
        inputs: inputs.length,
        inGekoppeld: gekoppeld.length,
        inExtern,
        inLos,
        inVoorgesteld,
        outputs: outputs.length,
        uitAfgenomen,
        uitExtern,
        uitOnbenut,
        uitVoorgesteld,
        koppelingen: gekoppeld.length,
        metPunten,
        apps: apps.length,
        appsMetDetail,
        capaciteit: (wf.capacity ?? []).length,
        notities,
        volledigheid: onderdelen.length > 0 ? Math.round(onderdelen.reduce((s, n) => s + n, 0) / onderdelen.length) : null,
      }
    })
    .sort((a, b) => (b.volledigheid ?? -1) - (a.volledigheid ?? -1))
}

// ---------------------------------------------------------------------------
// Concentratie, scorekaart, gedeelde applicaties, slapende teams, duplicaten
// ---------------------------------------------------------------------------

// Pareto-achtig: welk aandeel nemen de drie grootste voor hun rekening.
export function concentratie({ open, partijen, teams }) {
  const top = (rijen, totaal, n = 3) => {
    const lijst = [...rijen].sort((a, b) => b.aantal - a.aantal)
    const kop = lijst.slice(0, n)
    const som = kop.reduce((s, r) => s + r.aantal, 0)
    return { top: kop, aandeel: totaal > 0 ? Math.round((som / totaal) * 100) : 0, totaal }
  }
  const partijDeps = partijen.reduce((s, p) => s + p.deps.length, 0)
  return {
    partijen: top(partijen.map((p) => ({ naam: p.naam, aantal: p.deps.length })), partijDeps),
    categorieen: top([...tel(open, (d) => d.categorie)].map(([naam, aantal]) => ({ naam, aantal })), open.length),
    teams: top(teams.map((tm) => ({ naam: tm.id, aantal: open.filter((d) => d.teamId === tm.id).length })), open.length),
    perTeamTopCategorie: teams.map((tm) => {
      const deps = open.filter((d) => d.teamId === tm.id)
      const [categorie, aantal] = [...tel(deps, (d) => d.categorie)].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
      return { teamId: tm.id, categorie, aantal, aandeel: deps.length > 0 ? Math.round((aantal / deps.length) * 100) : 0 }
    }),
  }
}

// Eén rij per team met de kerncijfers, plus het gemiddelde over de teams.
export function teamScorekaart({ teams, alle, open, kennis, vandaag = new Date() }) {
  const toen = dagenGeledenIso(30, vandaag)
  const grens90 = dagenGeledenIso(90, vandaag)
  const rijen = teams.map((tm) => {
    const deps = open.filter((d) => d.teamId === tm.id)
    const eigenAlle = alle.filter((d) => d.teamId === tm.id)
    const risks = deps.map((d) => calculateRisk(d))
    const nietGemitigeerd = deps.filter((d) => d.status !== 'gemitigeerd')
    const metAfspraak = nietGemitigeerd.filter((d) => d.actieAfspraak?.trim()).length
    const openToen = eigenAlle.map((d) => stateAt(d, toen)).filter(Boolean).length
    return {
      teamId: tm.id,
      open: deps.length,
      hoogPlus: risks.filter((r) => riskLevelRank(r.level) >= riskLevelRank('Hoog')).length,
      kritiek: risks.filter((r) => r.level === 'Kritiek').length,
      blokkerend: deps.filter((d) => d.status === 'actief blokkerend').length,
      gemScore: gemiddelde(risks.map((r) => r.score)),
      verouderdPct: deps.length > 0 ? Math.round((deps.filter((d) => isVerouderd(d)).length / deps.length) * 100) : null,
      afspraakPct: nietGemitigeerd.length > 0 ? Math.round((metAfspraak / nietGemitigeerd.length) * 100) : null,
      flowverlies: deps.reduce((s, d) => s + (berekenFlowverlies(d)?.score ?? 0), 0),
      delta30: deps.length - openToen,
      gesloten90: eigenAlle.filter((d) => d.gesloten_op && d.gesloten_op >= grens90).length,
      kennisScore: kennis.find((k) => k.teamId === tm.id)?.score ?? 0,
    }
  })
  const velden = ['open', 'hoogPlus', 'kritiek', 'blokkerend', 'gemScore', 'verouderdPct', 'afspraakPct', 'flowverlies', 'delta30', 'gesloten90', 'kennisScore']
  const gemiddeld = Object.fromEntries(velden.map((v) => [v, gemiddelde(rijen.map((r) => r[v]))]))
  return { rijen: rijen.sort((a, b) => b.hoogPlus - a.hoogPlus || b.open - a.open), gemiddeld }
}

// Applicaties die via een geaccepteerde ketenkoppeling aan andere teams
// hangen: een output mét applicatie gekoppeld aan een input mét applicatie
// (of andersom). Applicaties zijn per team; dit is de enige route waarlangs
// een applicatie meerdere teams raakt. `deps` = eigen dependencies erop.
export function gedeeldeApplicaties(openAlle, teamWorkflows, teamFilter = null) {
  const edges = resolveChainEdges(teamWorkflows).filter((e) => e.status !== 'voorgesteld' && e.sourceTeam && e.targetTeam && e.sourceTeam !== e.targetTeam)
  const item = (teamId, soort, id) => (teamWorkflows[teamId]?.[soort] ?? []).find((i) => i.id === id)
  const rijen = []
  for (const [teamId, wf] of Object.entries(teamWorkflows)) {
    if (teamFilter && teamId !== teamFilter) continue
    for (const app of wf.applications ?? []) {
      const partners = new Set()
      for (const e of edges) {
        if (e.sourceTeam === teamId && item(teamId, 'outputs', e.sourceOutputId)?.applicatieId === app.id) partners.add(e.targetTeam)
        if (e.targetTeam === teamId && item(teamId, 'inputs', e.targetInputId)?.applicatieId === app.id) partners.add(e.sourceTeam)
      }
      if (partners.size === 0) continue
      const deps = openAlle.filter((d) => d.teamId === teamId && (d.applicatieIds ?? []).includes(app.id))
      rijen.push({ teamId, app, deps, andereTeams: [...partners], risico: wf.applicatieflow?.details?.[app.id]?.risico_bij_uitval === 'ja' })
    }
  }
  return rijen.sort((x, y) => y.andereTeams.length - x.andereTeams.length || y.deps.length - x.deps.length)
}

// Teams zonder enige logregel in N dagen.
export function slapendeTeams(changeLog, teams, { dagen = 60, vandaag = new Date() } = {}) {
  return teams
    .map((tm) => {
      const laatste =
        changeLog
          .filter((c) => c.teamId === tm.id)
          .map((c) => new Date(c.timestamp).getTime())
          .filter((n) => !Number.isNaN(n))
          .sort((a, b) => b - a)[0] ?? null
      const dagenStil = laatste ? Math.round((vandaag.getTime() - laatste) / DAG_MS) : null
      return { teamId: tm.id, laatste: laatste ? isoDag(new Date(laatste)) : null, dagenStil, slapend: dagenStil === null || dagenStil > dagen, grens: dagen }
    })
    .sort((a, b) => (b.dagenStil ?? Infinity) - (a.dagenStil ?? Infinity))
}

// Dezelfde dependency door meer dan één team vastgelegd (dedupGroupId).
export function dubbeleRegistraties(open) {
  return [...groepeer(open.filter((d) => d.dedupGroupId), (d) => d.dedupGroupId)]
    .map(([groep, deps]) => ({ groep, deps, teams: [...new Set(deps.map((d) => d.teamId))] }))
    .filter((g) => g.deps.length > 1)
}

// ---------------------------------------------------------------------------
// Signalen: waarschuwingen per record, geprioriteerd
// ---------------------------------------------------------------------------

// Eén regel per geval (dependency, verzoek, applicatie, team, partij), met
// de feiten die de zin nodig heeft. De tekst zelf hoort bij de pagina.
export function signalen({ open, teams, keten, port, kennis, partijen, doorloop, registratie, verandering, overgangen, ketenrisico, wederzijdsParen, slapend, duplicaten, gedeeld, externalParties, vandaag = new Date() }) {
  const nu = isoDag(vandaag)
  const lijst = []
  const add = (key, ernst, prioriteit, params) => lijst.push({ key, ernst, prioriteit, params })
  const nietBijgewerkt = (d) => (d.laatst_bijgewerkt ? dagenTussen(d.laatst_bijgewerkt, nu) : null)
  const sluimerend = new Set(port.sluimerend.map((d) => d.id))
  const stil = new Set(port.stilRisico.map((d) => d.id))
  const geparkeerd = new Set(port.geaccepteerdHoog.map((d) => d.id))
  for (const d of open) {
    const r = calculateRisk(d)
    const hoog = riskLevelRank(r.level) >= riskLevelRank('Hoog')
    const geenAfspraak = !d.actieAfspraak?.trim()
    const blok = doorloop.find((x) => x.dep.id === d.id)?.blokkerendDagen ?? 0
    if (r.level === 'Kritiek' && geenAfspraak) add('kritiekZonderAfspraak', 'hoog', 100 + r.score, { dep: d, score: r.score, status: d.status })
    if (d.deadline === 'harde_deadline' && geenAfspraak && d.status !== 'gemitigeerd') add('hardeDeadlineZonderAfspraak', 'hoog', 90 + r.score, { dep: d, deadlineTekst: d.deadlineTekst })
    if (d.status === 'actief blokkerend' && blok > 60) add('langBlokkerend', 'hoog', 80 + Math.min(blok, 300) / 10, { dep: d, dagen: blok })
    if (d.status === 'actief blokkerend' && isVerouderd(d)) add('blokkerendVerouderd', 'hoog', 75 + r.score, { dep: d, dagen: nietBijgewerkt(d) })
    if (hoog && geenAfspraak && isVerouderd(d) && d.status !== 'gemitigeerd') add('hoogVerouderd', 'midden', 60 + r.score, { dep: d, niveau: r.level, dagen: nietBijgewerkt(d) })
    if (sluimerend.has(d.id)) add('sluimerend', 'midden', 55 + r.score, { dep: d, niveau: r.level, dagen: dagenTussen(d.aangemaakt_op, nu) })
    if (stil.has(d.id)) add('stilRisico', 'midden', 40 + (berekenFlowverlies(d)?.score ?? 0), { dep: d, niveau: r.level, flowverlies: berekenFlowverlies(d)?.level })
    if (geparkeerd.has(d.id)) add('geaccepteerdHoog', 'laag', 30 + r.score, { dep: d, niveau: r.level })
    if (d.geraaktPartijId) {
      const p = externalParties.find((x) => x.id === d.geraaktPartijId)
      if (p?.status === 'geweigerd') add('partijGeweigerd', 'midden', 50, { dep: d, partij: p.naam })
    }
  }
  for (const r of verandering.verslechterd) add('verslechterd', riskLevelRank(r.naarNiveau) >= riskLevelRank('Hoog') ? 'midden' : 'laag', 45 + r.delta, { dep: r.dep, van: r.van, naar: r.naar, vanNiveau: r.vanNiveau, naarNiveau: r.naarNiveau })
  for (const r of overgangen.teruggevallen) add('teruggevallen', 'midden', 50, { dep: r.dep, datum: r.datum, status: r.dep.status })
  for (const r of overgangen.heropend) if (!r.dep.gesloten_op) add('heropend', 'laag', 20, { dep: r.dep, datum: r.datum })
  for (const r of port.gemitigeerdNietGesloten) add('gemitigeerdNietGesloten', 'laag', 15 + r.dagen / 10, { dep: r.dep, dagen: r.dagen })
  for (const v of keten.verzoeken) if ((v.leeftijd ?? 0) > 14) add('verzoekOud', 'midden', 40 + v.leeftijd, { teamId: v.teamId, label: v.item.label, doelTeamId: v.item.linkedTeam, dagen: v.leeftijd })
  for (const c of registratie.openReview) if (c.leeftijd > 7) add('reviewOud', 'laag', 20 + c.leeftijd, { teamId: c.teamId, titel: c.titel, dagen: c.leeftijd })
  for (const s of keten.spof) if (!s.risico && s.last >= 6) add('spofZonderDetail', 'laag', 25 + s.last, { teamId: s.teamId, app: s.app.naam, last: s.last })
  for (const g of gedeeld) if (g.andereTeams.length >= 2) add('gedeeldeApp', 'laag', 20 + g.andereTeams.length, { teamId: g.teamId, app: g.app.naam, teamIds: g.andereTeams, deps: g.deps.length })
  for (const k of kennis) if (k.kennisHoog >= 2 || (k.kennisHoog >= 1 && k.risicoRijen >= 2)) add('kennisBusFactor', 'midden', 50 + k.score, { teamId: k.teamId, kennisHoog: k.kennisHoog, risicoRijen: k.risicoRijen, score: k.score })
  for (const kr of ketenrisico) if (kr.directBlokkerend + kr.directHoog >= 5) add('ketenRisico', 'midden', 45 + kr.directBlokkerend + kr.directHoog, { teamId: kr.teamId, n: kr.direct, blokkerend: kr.directBlokkerend, hoog: kr.directHoog })
  const hubs = partijen.filter((p) => p.aantalTeams >= Math.max(3, Math.ceil(teams.length * 0.5)))
  for (const p of hubs) add('partijHub', 'midden', 40 + p.deps.length, { partij: p.naam, teams: p.aantalTeams, totaal: teams.length, deps: p.deps.length, blokkerend: p.blokkerend })
  for (const w of wederzijdsParen) add('wederzijds', 'laag', 25 + w.aNaarB + w.bNaarA, { teamIdA: w.a, teamIdB: w.b, aNaarB: w.aNaarB, bNaarA: w.bNaarA })
  for (const s of slapend) if (s.slapend) add('slapendTeam', 'laag', 30 + (s.dagenStil ?? 999) / 10, { teamId: s.teamId, dagen: s.dagenStil })
  for (const g of duplicaten) add('dubbeleRegistratie', 'laag', 20 + g.deps.length, { dep: g.deps[0], teamIds: g.teams })
  for (const tm of teams) {
    const eigen = open.filter((d) => d.teamId === tm.id)
    const ver = eigen.filter((d) => isVerouderd(d)).length
    if (eigen.length >= 5 && ver / eigen.length > 0.4) add('teamVerouderd', 'midden', 45 + ver, { teamId: tm.id, verouderd: ver, totaal: eigen.length, pct: Math.round((ver / eigen.length) * 100) })
  }
  const volgorde = { hoog: 0, midden: 1, laag: 2 }
  return lijst.sort((a, b) => volgorde[a.ernst] - volgorde[b.ernst] || b.prioriteit - a.prioriteit)
}

// ---------------------------------------------------------------------------
// Constateringen (regelgebaseerde waarschuwingen)
// ---------------------------------------------------------------------------

// Elke regel: sleutel, ernst, en de records die 'm triggeren. De tekst hoort
// bij de pagina (per taal); hier alleen de feiten.
export function constateringen({ open, teams, teamWorkflows, externalParties, keten, port, kennis, partijen, doorloop, registratie, verandering, overgangen, ketenrisico, wederzijdsParen, slapend, duplicaten, gedeeld, proj }) {
  const regels = []
  const push = (key, ernst, records, meta = {}) => {
    if (records.length > 0) regels.push({ key, ernst, aantal: records.length, records, ...meta })
  }
  push('kritiekZonderAfspraak', 'hoog', open.filter((d) => calculateRisk(d).level === 'Kritiek' && !d.actieAfspraak?.trim()))
  push('hardeDeadlineZonderAfspraak', 'hoog', open.filter((d) => d.deadline === 'harde_deadline' && !d.actieAfspraak?.trim() && d.status !== 'gemitigeerd'))
  push('blokkerendVerouderd', 'hoog', open.filter((d) => d.status === 'actief blokkerend' && isVerouderd(d)))
  push('langBlokkerend', 'hoog', doorloop.filter((r) => !r.dep.gesloten_op && r.dep.status === 'actief blokkerend' && r.blokkerendDagen > 60).map((r) => r.dep))
  push('hoogVerouderd', 'midden', port.hoogZonderActieAfspraak.filter((d) => isVerouderd(d)))
  push('stilRisico', 'midden', port.stilRisico)
  push('partijGeweigerd', 'midden', open.filter((d) => d.geraaktPartijId && externalParties.some((p) => p.id === d.geraaktPartijId && p.status === 'geweigerd')))
  push('partijInAfwachting', 'laag', open.filter((d) => d.geraaktPartijId && externalParties.some((p) => p.id === d.geraaktPartijId && p.status === 'in_afwachting')))
  const hubs = partijen.filter((p) => p.aantalTeams >= Math.max(3, Math.ceil(teams.length * 0.5)))
  push('partijHub', 'midden', hubs.flatMap((p) => p.deps), { partijen: hubs.map((p) => p.naam) })
  push('verzoekOud', 'midden', keten.verzoeken.filter((v) => (v.leeftijd ?? 0) > 14).map((v) => v.item), { verzoeken: keten.verzoeken.filter((v) => (v.leeftijd ?? 0) > 14) })
  push('depZonderKoppeling', 'laag', keten.depZonderKoppeling.map((x) => x.dep))
  push('spofZonderDetail', 'laag', keten.spof.filter((s) => !s.risico && s.last >= 6).map((s) => s.app), { apps: keten.spof.filter((s) => !s.risico && s.last >= 6) })
  push('teamVerouderd', 'midden', teams.filter((tm) => { const eigen = open.filter((d) => d.teamId === tm.id); return eigen.length >= 5 && eigen.filter((d) => isVerouderd(d)).length / eigen.length > 0.4 }), { teams: teams.filter((tm) => { const eigen = open.filter((d) => d.teamId === tm.id); return eigen.length >= 5 && eigen.filter((d) => isVerouderd(d)).length / eigen.length > 0.4 }).map((tm) => tm.id) })
  push('kennisBusFactor', 'midden', kennis.filter((k) => k.kennisHoog >= 2 || (k.kennisHoog >= 1 && k.risicoRijen >= 2)), { teams: kennis.filter((k) => k.kennisHoog >= 2 || (k.kennisHoog >= 1 && k.risicoRijen >= 2)).map((k) => k.teamId) })
  push('faseZonderCapaciteit', 'laag', werkstapBelasting(open, teamWorkflows).filter((w) => w.deps >= 3 && w.personen === 0), { fasen: werkstapBelasting(open, teamWorkflows).filter((w) => w.deps >= 3 && w.personen === 0).map((w) => w.stage) })
  push('reviewOud', 'laag', registratie.openReview.filter((c) => c.leeftijd > 7))
  push('gemitigeerdZonderTekst', 'laag', port.gemitigeerdZonderTekst)
  push('profielOnvolledig', 'laag', port.kwadranten.onvolledig)
  // Ontwikkeling en levensloop.
  const verslechterdHoog = (verandering?.verslechterd ?? []).filter((r) => riskLevelRank(r.naarNiveau) >= riskLevelRank('Hoog'))
  push('verslechterd', 'midden', verslechterdHoog.map((r) => r.dep), { rijen: verslechterdHoog })
  push('teruggevallen', 'midden', (overgangen?.teruggevallen ?? []).map((r) => r.dep))
  push('sluimerend', 'midden', port.sluimerend)
  push('geaccepteerdHoog', 'laag', port.geaccepteerdHoog)
  push('gemitigeerdNietGesloten', 'laag', port.gemitigeerdNietGesloten.map((r) => r.dep))
  push('heropend', 'laag', (overgangen?.heropend ?? []).filter((r) => !r.dep.gesloten_op).map((r) => r.dep))
  if (proj && proj.nettoPerWeek >= 0.5) push('backlogGroei', 'midden', [proj], { proj })
  // Keten, applicaties, teams.
  const zwaarBelast = (ketenrisico ?? []).filter((k) => k.directBlokkerend + k.directHoog >= 5)
  push('ketenRisicoHoog', 'midden', zwaarBelast, { teams: zwaarBelast.map((k) => k.teamId) })
  push('wederzijds', 'laag', (wederzijdsParen ?? []).flatMap((w) => w.deps), { paren: wederzijdsParen ?? [] })
  const gedeeldBreed = (gedeeld ?? []).filter((g) => g.andereTeams.length >= 2)
  push('gedeeldeApp', 'laag', gedeeldBreed.map((g) => g.app), { apps: gedeeldBreed })
  const stil = (slapend ?? []).filter((s) => s.slapend)
  push('slapendTeam', 'laag', stil, { teams: stil.map((s) => s.teamId) })
  push('dubbeleRegistratie', 'laag', (duplicaten ?? []).flatMap((g) => g.deps), { groepen: duplicaten ?? [] })
  const volgorde = { hoog: 0, midden: 1, laag: 2 }
  return regels.sort((a, b) => volgorde[a.ernst] - volgorde[b.ernst] || b.aantal - a.aantal)
}

// Eén aanroep die alles berekent; de pagina memoiseert dit op de state.
export function analyseer({ teams, alleDependencies, teamWorkflows, externalParties, changeLog, vandaag = new Date(), teamFilter = null }) {
  const alle = teamFilter ? alleDependencies.filter((d) => d.teamId === teamFilter) : alleDependencies
  const teamsInScope = teamFilter ? teams.filter((tm) => tm.id === teamFilter) : teams
  const open = alle.filter((d) => !d.gesloten_op)
  const openAlle = teamFilter ? alleDependencies.filter((d) => !d.gesloten_op) : open
  // Workflows in scope: bij een teamfilter alleen de eigen inputs/outputs,
  // applicaties en capaciteit; de keten heeft alle workflows nodig voor de edges.
  const wfInScope = teamFilter ? Object.fromEntries(Object.entries(teamWorkflows).filter(([id]) => id === teamFilter)) : teamWorkflows
  const port = portfolio(open, { vandaag })
  const partijen = partijOverzicht({ open, teamWorkflows: wfInScope, externalParties, teams })
  const kennis = kennisConcentratie(open, teamWorkflows, teamsInScope)
  const keten = ketenKengetallen({ teams, teamWorkflows, open, openAlle, vandaag, teamFilter })
  const doorloop = doorlooptijden(alle, { vandaag })
  const registratie = registratieGedrag(teamFilter ? changeLog.filter((c) => c.teamId === teamFilter) : changeLog, teamsInScope, { vandaag })
  const trend = trendReeks(alle, { weken: 26, vandaag })
  const proj = projectie(trend)
  const verandering = scoreVerandering(alle, { dagen: 30, vandaag })
  const overgangen = statusOvergangen(alle)
  const ketenrisico = ketenRisico({ teams, teamWorkflows, openAlle }).filter((k) => teamsInScope.some((tm) => tm.id === k.teamId))
  const wederzijdsParen = wederzijds(teamOpTeam(openAlle, teams).rijen).filter((w) => !teamFilter || w.a === teamFilter || w.b === teamFilter)
  const slapend = slapendeTeams(changeLog, teamsInScope, { dagen: 60, vandaag })
  const duplicaten = dubbeleRegistraties(openAlle).filter((g) => !teamFilter || g.teams.includes(teamFilter))
  const gedeeld = gedeeldeApplicaties(openAlle, teamWorkflows, teamFilter)
  // Scorekaart altijd over alle teams, zodat een team zich kan vergelijken.
  const openAlleTeams = alleDependencies.filter((d) => !d.gesloten_op)
  const scorekaart = teamScorekaart({ teams, alle: alleDependencies, open: openAlleTeams, kennis: kennisConcentratie(openAlleTeams, teamWorkflows, teams), vandaag })
  return {
    teamFilter,
    teams,
    teamsInScope,
    open,
    alle,
    port,
    trend,
    vergelijking: vergelijking(alle, { dagen: 30, vandaag }),
    proj,
    verandering,
    leeftijd: leeftijdsverdeling(open, teamsInScope, { vandaag }),
    overgangen,
    ketenrisico,
    wederzijds: wederzijdsParen,
    kaart: kaartVolledigheid({ teams: teamsInScope, teamWorkflows }),
    concentratie: concentratie({ open, partijen, teams: teamsInScope }),
    scorekaart,
    gedeeld,
    slapend,
    duplicaten,
    doorloop,
    doorloopSamenvatting: doorlooptijdSamenvatting(doorloop),
    doorloopPerTeam: teamsInScope.map((tm) => ({ teamId: tm.id, ...doorlooptijdSamenvatting(doorloop.filter((r) => r.dep.teamId === tm.id)) })),
    hotspots: hotspots(open, teamsInScope),
    partijen,
    teamOpTeam: teamOpTeam(open, teams),
    kennis,
    keten,
    werkstappen: werkstapBelasting(open, wfInScope),
    proces: procesOverstijgend(open),
    flowverlies: flowverliesSommen(open, teamsInScope, partijen),
    hygiene: hygiene({ open, alle, teamWorkflows: wfInScope, externalParties, teams }),
    registratie,
    constateringen: constateringen({ open, teams: teamsInScope, teamWorkflows: wfInScope, externalParties, keten, port, kennis, partijen, doorloop, registratie, verandering, overgangen, ketenrisico, wederzijdsParen, slapend, duplicaten, gedeeld, proj }),
    signalen: signalen({ open, teams: teamsInScope, keten, port, kennis, partijen, doorloop, registratie, verandering, overgangen, ketenrisico, wederzijdsParen, slapend, duplicaten, gedeeld, externalParties, vandaag }),
  }
}
