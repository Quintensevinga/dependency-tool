import { describe, it, expect } from 'vitest'
import { vindNaamloos, vindDubbelePartijen, vindScheefstand } from './scheefstand'

const leegExport = { teams: [], dependencies: [], teamWorkflows: {}, externalParties: [] }

describe('vindNaamloos', () => {
  it('vindt een team, dependency, partij, io-item, applicatie en capaciteitsregel zonder naam', () => {
    const uit = vindNaamloos({
      teams: [{ id: 'team-1', naam: 'Team 1' }, { id: 'team-2', naam: '   ' }],
      dependencies: [{ id: 'dep-1', teamId: 'team-1', titel: '' }],
      externalParties: [{ id: 'party-1', naam: '' }],
      teamWorkflows: {
        'team-1': {
          inputs: [{ id: 'in-1', label: '' }, { id: 'in-2', label: 'Wel een naam' }],
          outputs: [{ id: 'out-1', label: '  ' }],
          applications: [{ id: 'app-1', naam: '' }],
          capacity: [{ id: 'cap-1', rol: '' }],
        },
      },
    })
    expect(uit.map((x) => x.soort).sort()).toEqual(['applicatie', 'capaciteit', 'dependency', 'input', 'output', 'partij', 'team'])
    // De teamnaam staat erbij waar die bekend is, zodat je weet waar je moet zijn.
    expect(uit.find((x) => x.soort === 'input').team).toBe('Team 1')
  })

  it('rekent een magere maar bewuste invoer niet als leeg', () => {
    // Een streepje of een punt is iets wat iemand heeft ingetypt, geen gat.
    const uit = vindNaamloos({ ...leegExport, teams: [{ id: 't', naam: '-' }], externalParties: [{ id: 'p', naam: '.' }] })
    expect(uit).toHaveLength(0)
  })

  it('geeft niets terug op een lege of onzinnige invoer', () => {
    expect(vindNaamloos(leegExport)).toHaveLength(0)
    expect(vindNaamloos({})).toHaveLength(0)
    expect(vindNaamloos(null)).toHaveLength(0)
    expect(vindNaamloos({ teamWorkflows: { 'team-1': null } })).toHaveLength(0)
  })

  it('merkt een record met workflowStap procesoverstijgend niet aan', () => {
    // Harde afspraak met beurt 3: procesoverstijgend is een echte keuze, geen
    // ontbrekende waarde. Deze controle kijkt alleen naar namen, dus zo'n
    // record mag hier nooit opduiken.
    const uit = vindNaamloos({
      ...leegExport,
      teams: [{ id: 'team-1', naam: 'Team 1' }],
      dependencies: [{ id: 'dep-1', teamId: 'team-1', titel: 'Heeft een titel', workflowStap: 'procesoverstijgend' }],
    })
    expect(uit).toHaveLength(0)
  })
})

describe('vindDubbelePartijen', () => {
  it('vindt partijen die alleen in schrijfwijze verschillen', () => {
    const uit = vindDubbelePartijen({
      externalParties: [
        { id: 'a', naam: 'Belastingdienst' },
        { id: 'b', naam: 'BELASTINGDIENST' },
        { id: 'c', naam: 'Polis Gateway' },
        { id: 'd', naam: 'polis-gateway' },
        { id: 'e', naam: 'Iets anders' },
      ],
    })
    expect(uit).toHaveLength(2)
    expect(uit.find((g) => g.sleutel === 'belastingdienst').namen.sort()).toEqual(['BELASTINGDIENST', 'Belastingdienst'])
    expect(uit.find((g) => g.sleutel === 'polisgateway').ids.sort()).toEqual(['c', 'd'])
  })

  it('telt geweigerde partijen mee', () => {
    // Die staan nog in de lijst en kunnen nog aan records gekoppeld zijn.
    const uit = vindDubbelePartijen({
      externalParties: [
        { id: 'a', naam: 'Ketenregie', status: 'actief' },
        { id: 'b', naam: 'ketenregie', status: 'geweigerd' },
      ],
    })
    expect(uit).toHaveLength(1)
  })

  it('groepeert naamloze partijen niet als duplicaat', () => {
    // Anders zou elk naamloos paar hier als 'dubbel' verschijnen, terwijl het
    // probleem is dat ze geen naam hebben -- en dat meldt vindNaamloos al.
    const uit = vindDubbelePartijen({ externalParties: [{ id: 'a', naam: '' }, { id: 'b', naam: '   ' }] })
    expect(uit).toHaveLength(0)
  })

  it('meldt niets bij unieke namen', () => {
    expect(vindDubbelePartijen({ externalParties: [{ id: 'a', naam: 'Een' }, { id: 'b', naam: 'Twee' }] })).toHaveLength(0)
    expect(vindDubbelePartijen({})).toHaveLength(0)
  })
})

describe('vindScheefstand', () => {
  it('telt beide uitkomsten bij elkaar op', () => {
    const uit = vindScheefstand({
      teams: [{ id: 't', naam: '' }],
      externalParties: [{ id: 'a', naam: 'Zelfde' }, { id: 'b', naam: 'zelfde' }],
      dependencies: [],
      teamWorkflows: {},
    })
    expect(uit.naamloos).toHaveLength(1)
    expect(uit.dubbelePartijen).toHaveLength(1)
    expect(uit.totaal).toBe(2)
  })

  it('geeft nul op een schone export', () => {
    expect(vindScheefstand(leegExport).totaal).toBe(0)
  })
})
