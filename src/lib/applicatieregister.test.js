import { describe, it, expect } from 'vitest'
import { plan, voerUit, applicatiesMetMeerdereTeams } from './applicatieregister'

// Het testgeval uit de opdracht: team A en B met 'Polis Gateway', team C met
// 'polis-gateway' (andere schrijfwijze, onder de vergelijkingsregel dezelfde
// naam) en team D met 'Gateway (oud)' als twijfelgeval.
function proefState() {
  return {
    teams: [
      { id: 'a', naam: 'Team A' },
      { id: 'b', naam: 'Team B' },
      { id: 'c', naam: 'Team C' },
      { id: 'd', naam: 'Team D' },
    ],
    dependencies: [
      { id: 'dep-1', teamId: 'a', titel: 'Eén', applicatieIds: ['app-a'] },
      { id: 'dep-2', teamId: 'b', titel: 'Twee', applicatieIds: ['app-b'] },
    ],
    teamWorkflows: {
      a: {
        applications: [{ id: 'app-a', naam: 'Polis Gateway' }],
        inputs: [{ id: 'in-a', label: 'In A', applicatieId: 'app-a' }],
        outputs: [],
        applicatieflow: { connecties: [{ van: 'app-a', naar: 'app-a' }], details: { 'app-a': { risico_bij_uitval: 'ja' } }, layout: {} },
        layout: { 'app-a': { x: 10, y: 20 } },
      },
      b: {
        applications: [{ id: 'app-b', naam: 'Polis Gateway' }],
        inputs: [],
        outputs: [{ id: 'out-b', label: 'Uit B', applicatieId: 'app-b' }],
        applicatieflow: { connecties: [], details: {}, layout: {} },
        layout: { 'app-b': { x: 30, y: 40 } },
      },
      c: {
        applications: [{ id: 'app-c', naam: 'polis-gateway' }],
        inputs: [],
        outputs: [],
        applicatieflow: { connecties: [], details: {}, layout: {} },
        layout: {},
      },
      d: {
        applications: [{ id: 'app-d', naam: 'Gateway (oud)' }],
        inputs: [],
        outputs: [],
        applicatieflow: { connecties: [], details: {}, layout: {} },
        layout: {},
      },
    },
  }
}

describe('plan (droogloop)', () => {
  it('meldt dat de drie gelijknamige records samengevoegd worden', () => {
    const r = plan(proefState())
    expect(r.samenvoegingen).toHaveLength(1)
    expect(r.samenvoegingen[0].teams.sort()).toEqual(['a', 'b', 'c'])
    // De langste naam wint: die draagt meestal de meeste informatie.
    expect(r.samenvoegingen[0].naam).toBe('Polis Gateway')
    expect(r.verdwijnendeRecords).toBe(2)
  })

  it('laat het twijfelgeval staan en meldt het apart', () => {
    const r = plan(proefState())
    expect(r.ongewijzigd.map((x) => x.naam)).toContain('Gateway (oud)')
    expect(r.twijfel.some((t) => t.namen.includes('Gateway (oud)'))).toBe(true)
  })

  it('verandert niets aan de meegegeven state', () => {
    const state = proefState()
    const kopie = JSON.parse(JSON.stringify(state))
    plan(state)
    expect(state).toEqual(kopie)
  })

  it('struikelt niet over lege of onzinnige invoer', () => {
    expect(plan({}).totaalApplicaties).toBe(0)
    expect(plan(null).samenvoegingen).toHaveLength(0)
    expect(plan({ teamWorkflows: { a: null } }).totaalApplicaties).toBe(0)
  })
})

describe('voerUit', () => {
  it('maakt één registerrecord van de drie en houdt het twijfelgeval apart', () => {
    const { state } = voerUit(proefState())
    const namen = state.applicatieregister.map((a) => a.naam).sort()
    expect(namen).toEqual(['Gateway (oud)', 'Polis Gateway'])
  })

  it('hangt alle soorten verwijzingen mee om', () => {
    const { state } = voerUit(proefState())
    const doel = state.applicatieregister.find((a) => a.naam === 'Polis Gateway').id
    // dependency
    expect(state.dependencies.find((d) => d.id === 'dep-2').applicatieIds).toEqual([doel])
    // input/output-item
    expect(state.teamWorkflows.b.outputs[0].applicatieId).toBe(doel)
    // de applicatielijst van het team zelf
    expect(state.teamWorkflows.c.applications[0].id).toBe(doel)
    // bewaarde canvaspositie (op id gesleuteld)
    expect(state.teamWorkflows.b.layout[doel]).toEqual({ x: 30, y: 40 })
    expect(state.teamWorkflows.b.layout['app-b']).toBeUndefined()
  })

  it('laat de verwijzingen van het twijfelgeval ongemoeid', () => {
    const { state } = voerUit(proefState())
    expect(state.teamWorkflows.d.applications[0].id).toBe('app-d')
  })

  it('houdt dezelfde applicatie niet twee keer in één team', () => {
    const basis = proefState()
    basis.teamWorkflows.a.applications.push({ id: 'app-a2', naam: 'polis gateway' })
    const { state } = voerUit(basis)
    expect(state.teamWorkflows.a.applications).toHaveLength(1)
  })

  it('is idempotent: nog een keer draaien verandert niets meer', () => {
    const eerste = voerUit(proefState()).state
    const tweede = voerUit(eerste).state
    expect(tweede.teamWorkflows).toEqual(eerste.teamWorkflows)
    expect(tweede.dependencies).toEqual(eerste.dependencies)
    expect(tweede.applicatieregister.map((a) => a.id).sort()).toEqual(eerste.applicatieregister.map((a) => a.id).sort())
  })
})

describe('applicatiesMetMeerdereTeams', () => {
  it('geeft niets terug voordat de omzetting gedraaid is', () => {
    // Zonder omzetting heeft elk team zijn eigen id, dus deelt niemand iets --
    // precies het probleem dat punt 30 oplost.
    expect(applicatiesMetMeerdereTeams(proefState())).toHaveLength(0)
  })

  it('toont de samengevoegde applicatie met drie teams', () => {
    const { state } = voerUit(proefState())
    const uit = applicatiesMetMeerdereTeams(state)
    expect(uit).toHaveLength(1)
    expect(uit[0].naam).toBe('Polis Gateway')
    expect(uit[0].aantalTeams).toBe(3)
  })
})
