#!/usr/bin/env node
// Eenmalige audit van referentie-consistentie in een Dependency Insight
// JSON-export (Instellingen → Exporteren JSON). Controleert of alle
// verwijzingen (teamId, extraTeamIds, geraaktPartijId, applicatieIds,
// linkedTeam/linkedOutputId/linkedInputId, externalPartyId, changeLog-
// verwijzingen) nog naar bestaande records wijzen. Rapporteert alleen —
// repareert niets automatisch, want dat vereist een keuze per geval.
//
// Gebruik:
//   node scripts/audit-relations.mjs pad/naar/export.json

import fs from 'node:fs'

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

if (findings.length === 0) {
  console.log(`Geen wezen-referenties gevonden (${dependencies.length} dependencies, ${teams.length} teams, ${externalParties.length} externe partijen, ${changeLog.length} logregels gecontroleerd).`)
  process.exit(0)
}

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
process.exit(1)
