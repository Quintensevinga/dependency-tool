#!/usr/bin/env node
// Eenmalige audit van een Dependency Insight JSON-export (Instellingen →
// Exporteren JSON). Twee controles, bewust gescheiden:
//
//   1. Wezen-referenties — verwijzingen (teamId, extraTeamIds, geraaktPartijId,
//      applicatieIds, linkedTeam/linkedOutputId/linkedInputId, externalPartyId,
//      changeLog-verwijzingen) die naar een verdwenen record wijzen. Dat is
//      kapotte data: er is iets stuk.
//
//   2. Scheefstand — records zonder naam en externe partijen die onder de
//      vergelijkingsregel twee keer voorkomen. Dat is geen kapotte data maar
//      slordigheid die je wilt zien; de app blijft gewoon werken.
//
// Die tweede is daarom zachter: hij bepaalt de afsluitcode niet. Anders zou
// iemand met twintig historische slordigheden de audit nooit meer groen zien en
// er dus ook niet meer naar kijken.
//
// Rapporteert alleen — repareert niets automatisch, want dat vereist een keuze
// per geval.
//
// Gebruik:
//   node scripts/audit-relations.mjs pad/naar/export.json

import fs from 'node:fs'
import { vindScheefstand } from '../src/lib/scheefstand.js'

const file = process.argv[2]
if (!file) {
  console.error('Gebruik: node scripts/audit-relations.mjs pad/naar/export.json')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const teams = data.teams ?? []
const dependencies = data.dependencies ?? []
const teamWorkflows = data.teamWorkflows ?? {}
const externalParties = data.externalParties ?? []
const changeLog = data.changeLog ?? []

const teamIds = new Set(teams.map((t) => t.id))
const partyIds = new Set(externalParties.map((p) => p.id))
const depIds = new Set(dependencies.map((d) => d.id))

const findings = []
function report(category, ref) {
  findings.push({ category, ref })
}

function appIdsFor(teamId) {
  return new Set((teamWorkflows[teamId]?.applications ?? []).map((a) => a.id))
}

for (const dep of dependencies) {
  if (dep.teamId && !teamIds.has(dep.teamId)) {
    report('dependency.teamId', `${dep.id} (${dep.titel}) → onbekend team ${dep.teamId}`)
  }
  for (const extraId of dep.extraTeamIds ?? []) {
    if (!teamIds.has(extraId)) report('dependency.extraTeamIds', `${dep.id} (${dep.titel}) → onbekend team ${extraId}`)
  }
  if (dep.geraaktPartijId && !partyIds.has(dep.geraaktPartijId)) {
    report('dependency.geraaktPartijId', `${dep.id} (${dep.titel}) → onbekende partij ${dep.geraaktPartijId}`)
  }
  if (dep.geraaktTeamId && !teamIds.has(dep.geraaktTeamId)) {
    report('dependency.geraaktTeamId', `${dep.id} (${dep.titel}) → onbekend team ${dep.geraaktTeamId}`)
  }
  if (dep.dedupGroupId && !dependencies.some((d) => d.id !== dep.id && d.dedupGroupId === dep.dedupGroupId)) {
    report('dependency.dedupGroupId', `${dep.id} (${dep.titel}) → dedupGroupId ${dep.dedupGroupId} zonder tegenhanger`)
  }
  const apps = appIdsFor(dep.teamId)
  for (const appId of dep.applicatieIds ?? []) {
    if (!apps.has(appId)) report('dependency.applicatieIds', `${dep.id} (${dep.titel}) → onbekende applicatie ${appId} bij team ${dep.teamId}`)
  }
}

for (const [teamId, workflow] of Object.entries(teamWorkflows)) {
  const apps = appIdsFor(teamId)

  function checkIoItem(item, kind) {
    const label = `${kind}:${item.id} (${item.label || '—'}) bij team ${teamId}`
    if (item.applicatieId && !apps.has(item.applicatieId)) {
      report(`${kind}.applicatieId`, `${label} → onbekende applicatie ${item.applicatieId}`)
    }
    if (item.externalPartyId && !partyIds.has(item.externalPartyId)) {
      report(`${kind}.externalPartyId`, `${label} → onbekende partij ${item.externalPartyId}`)
    }
    if (!item.linkedTeam) return
    if (!teamIds.has(item.linkedTeam)) {
      report(`${kind}.linkedTeam`, `${label} → onbekend team ${item.linkedTeam}`)
      return
    }
    if (kind === 'input' && item.linkedOutputId) {
      const outputs = teamWorkflows[item.linkedTeam]?.outputs ?? []
      if (!outputs.some((o) => o.id === item.linkedOutputId)) {
        report('input.linkedOutputId', `${label} → onbekende output ${item.linkedOutputId} bij team ${item.linkedTeam}`)
      }
    }
    if (kind === 'output' && item.linkedInputId) {
      const inputs = teamWorkflows[item.linkedTeam]?.inputs ?? []
      if (!inputs.some((i) => i.id === item.linkedInputId)) {
        report('output.linkedInputId', `${label} → onbekende input ${item.linkedInputId} bij team ${item.linkedTeam}`)
      }
    }
  }

  for (const item of workflow.inputs ?? []) checkIoItem(item, 'input')
  for (const item of workflow.outputs ?? []) checkIoItem(item, 'output')
}

for (const entry of changeLog) {
  if (entry.teamId && !teamIds.has(entry.teamId)) {
    report('changeLog.teamId', `${entry.id} → onbekend team ${entry.teamId}`)
  }
  if (entry.dependencyId && !depIds.has(entry.dependencyId)) {
    report('changeLog.dependencyId', `${entry.id} → onbekende dependency ${entry.dependencyId}`)
  }
  if (entry.duplicateOfId && !depIds.has(entry.duplicateOfId)) {
    report('changeLog.duplicateOfId', `${entry.id} → onbekende dependency ${entry.duplicateOfId}`)
  }
}

// --- 1. wezen-referenties -----------------------------------------------

if (findings.length === 0) {
  console.log(`Geen wezen-referenties gevonden (${dependencies.length} dependencies, ${teams.length} teams, ${externalParties.length} externe partijen, ${changeLog.length} logregels gecontroleerd).`)
} else {
  console.log(`${findings.length} wezen-referentie(s) gevonden:\n`)
  const byCategory = {}
  for (const f of findings) {
    if (!byCategory[f.category]) byCategory[f.category] = []
    byCategory[f.category].push(f.ref)
  }
  for (const [category, refs] of Object.entries(byCategory)) {
    console.log(`${category} (${refs.length}):`)
    for (const ref of refs) console.log(`  - ${ref}`)
    console.log('')
  }
}

// --- 2. scheefstand ------------------------------------------------------

const scheef = vindScheefstand(data)

console.log('---')
if (scheef.totaal === 0) {
  console.log('Geen scheefstand gevonden: elk record heeft een naam en geen twee externe partijen heten hetzelfde.')
} else {
  console.log(`${scheef.totaal} melding(en) over scheefstand. Dit is geen kapotte data — de app werkt gewoon door. Opruimen is een keuze per geval.\n`)

  if (scheef.naamloos.length > 0) {
    console.log(`records zonder naam (${scheef.naamloos.length}):`)
    const perSoort = {}
    for (const x of scheef.naamloos) {
      if (!perSoort[x.soort]) perSoort[x.soort] = []
      perSoort[x.soort].push(x.team ? `${x.omschrijving} (bij ${x.team})` : x.omschrijving)
    }
    for (const [soort, regels] of Object.entries(perSoort)) {
      console.log(`  ${soort} (${regels.length}):`)
      for (const r of regels) console.log(`    - ${r}`)
    }
    console.log('')
  }

  if (scheef.dubbelePartijen.length > 0) {
    console.log(`externe partijen die dubbel voorkomen (${scheef.dubbelePartijen.length}):`)
    for (const groep of scheef.dubbelePartijen) {
      console.log(`  - ${groep.namen.join(' / ')}  [${groep.ids.join(', ')}]`)
    }
    console.log('')
  }
}

// Alleen wezen-referenties bepalen de afsluitcode; zie de toelichting bovenaan.
process.exit(findings.length === 0 ? 0 : 1)
