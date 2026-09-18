import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { migrateState, SCHEMA_VERSION } from './storage'

// Een oude export zoals die vóór de huidige schemaversie uit de app kwam:
// teams als losse tekst, en een dependency met uitsluitend oude waarden. Geen
// bestand nodig — dit is de volledige invoer.
function oudeExport() {
  return {
    teams: ['Team Alfa'],
    dependencies: [
      {
        id: 'dep-1',
        team: 'Team Alfa',
        titel: 'Oude regel',
        impact: 'hoog',
        frequentie: 'incidenteel',
        workflowStap: 'build',
        categorie: 'Procesafhankelijkheid',
        status: 'bekend risico',
      },
    ],
  }
}

// migrateState vult ontbrekende datumvelden met de datum van vandaag
// (createdAt/updatedAt op nieuwe teams, laatst_bijgewerkt op de dependency).
// Zonder een vaste klok zou deze test morgen falen.
const VASTE_DAG = '2026-01-15'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${VASTE_DAG}T12:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

// TEST 4 — migratie van een oude export.
describe('migrateState — oude export', () => {
  it('zet de schemaversie op de huidige', () => {
    expect(migrateState(oudeExport()).schemaVersion).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(6)
  })

  it('maakt van de teamtekst een team met een geslugd id', () => {
    const { teams } = migrateState(oudeExport())
    expect(teams).toEqual([
      {
        id: 'team-alfa', // kleine letters, spatie wordt koppelteken (slug.js)
        naam: 'Team Alfa',
        actief: true,
        createdAt: VASTE_DAG,
        updatedAt: VASTE_DAG,
      },
    ])
  })

  it('zet elke oude waarde op de dependency om naar de huidige', () => {
    const [dep] = migrateState(oudeExport()).dependencies

    expect(dep.teamId).toBe('team-alfa')
    expect(dep.impact).toBe('zwaar') // 'hoog' -> 'zwaar'
    expect(dep.frequentie).toBe('soms') // 'incidenteel' -> 'soms'
    expect(dep.workflowStap).toBe('ontwikkeling_configuratie') // 'build' -> ...
    expect(dep.categorie).toBe('Governance/proces-afhankelijkheid') // 'Procesafhankelijkheid' -> ...
    // flowtype ontbrak, maar er was een workflowstap: dan wordt het ontwikkelflow.
    expect(dep.flowtype).toBe('ontwikkelflow')
    expect(dep.laatst_bijgewerkt).toBe(VASTE_DAG)
  })

  it('vult de ontbrekende velden aan met lege, niet-verzonnen waarden', () => {
    const [dep] = migrateState(oudeExport()).dependencies

    expect(dep.effectOpFlow).toBeNull()
    expect(dep.actieAfspraak).toBe('')
    expect(dep.applicatieIds).toEqual([])
    expect(dep.geaccepteerd).toBe(false)
  })

  // De migratie verwijdert alleen eigenaarFunctieIds en oplossingsniveau. Het
  // oude veld 'team' blijft dus gewoon naast het nieuwe teamId staan; dat is
  // bewust en wordt hier vastgelegd zodat een latere opschoning opvalt.
  it('laat het oude veld team op de dependency staan', () => {
    const [dep] = migrateState(oudeExport()).dependencies
    expect(dep.team).toBe('Team Alfa')
  })

  it('verwijdert de vervallen velden eigenaarFunctieIds en oplossingsniveau', () => {
    const invoer = oudeExport()
    invoer.dependencies[0].eigenaarFunctieIds = ['f1']
    invoer.dependencies[0].oplossingsniveau = 'team'

    const [dep] = migrateState(invoer).dependencies
    expect(dep).not.toHaveProperty('eigenaarFunctieIds')
    expect(dep).not.toHaveProperty('oplossingsniveau')
  })
})

// TEST 5 — idempotentie. De migratie draait bij élke keer dat de app opent
// opnieuw, ook over data die al gemigreerd is. Twee keer draaien moet dus exact
// hetzelfde opleveren als één keer.
describe('migrateState — idempotent', () => {
  it('levert bij twee keer draaien exact hetzelfde resultaat op', () => {
    const eenmaal = migrateState(oudeExport())
    const tweemaal = migrateState(migrateState(oudeExport()))
    expect(tweemaal).toEqual(eenmaal)
  })

  it('is ook idempotent op een lege invoer', () => {
    const eenmaal = migrateState({})
    expect(migrateState(migrateState({}))).toEqual(eenmaal)
  })
})
