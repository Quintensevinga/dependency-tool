import { describe, it, expect } from 'vitest'
import { begrensLog, splitsArchief, MAX_LOGREGELS } from './changeLog'
import { migrateState } from './storage'

function regel(i, extra = {}) {
  return {
    id: `log-${i}`,
    timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    teamId: 'team-1',
    type: 'dependency_updated',
    dependencyId: `dep-${i}`,
    titel: `Regel ${i}`,
    details: null,
    status: null,
    ...extra,
  }
}

// Nieuwe regels komen achteraan, dus de nieuwste staan aan het eind van de
// lijst. Deze tests leggen vooral die richting vast: draai je 'm om, dan gooi je
// alle recente geschiedenis weg en houd je de oudste -- en dat is precies het
// soort fout dat pas maanden later opvalt.
describe('begrensLog', () => {
  it('laat een log onder de grens ongemoeid, en geeft hetzelfde object terug', () => {
    const state = { changeLog: [regel(1), regel(2)], teams: [] }
    expect(begrensLog(state)).toBe(state)
  })

  it('laat een log precies op de grens ongemoeid', () => {
    const state = { changeLog: Array.from({ length: MAX_LOGREGELS }, (_, i) => regel(i)) }
    expect(begrensLog(state)).toBe(state)
  })

  it('houdt de NIEUWSTE regels en gooit de oudste weg', () => {
    const log = Array.from({ length: MAX_LOGREGELS + 500 }, (_, i) => regel(i))
    const uit = begrensLog({ changeLog: log })
    expect(uit.changeLog).toHaveLength(MAX_LOGREGELS)
    // De laatste regel van de invoer is de nieuwste en moet blijven staan.
    expect(uit.changeLog.at(-1).id).toBe(`log-${MAX_LOGREGELS + 499}`)
    // De eerste 500 zijn de oudste en zijn weg.
    expect(uit.changeLog[0].id).toBe('log-500')
    expect(uit.changeLog.some((c) => c.id === 'log-0')).toBe(false)
  })

  it('bewaart een oude reviewregel die nog op beoordeling wacht', () => {
    // Deze staat helemaal vooraan (dus het oudst) en zou zonder uitzondering
    // afgekapt worden -- terwijl het de wachtrij van de beheerpagina is.
    const wachtend = regel(-1, { id: 'review-oud', type: 'dependency_created', status: 'pending', dependencyId: 'dep-bestaat' })
    const log = [wachtend, ...Array.from({ length: MAX_LOGREGELS + 100 }, (_, i) => regel(i))]
    const uit = begrensLog({ changeLog: log, dependencies: [{ id: 'dep-bestaat' }] })
    expect(uit.changeLog.some((c) => c.id === 'review-oud')).toBe(true)
    expect(uit.changeLog).toHaveLength(MAX_LOGREGELS + 1)
    // En hij staat vooraan, zodat de volgorde 'oud naar nieuw' klopt blijft.
    expect(uit.changeLog[0].id).toBe('review-oud')
  })

  it('bewaart een al afgehandelde oude reviewregel niet', () => {
    const afgehandeld = regel(-1, { id: 'review-af', type: 'dependency_created', status: 'approved' })
    const log = [afgehandeld, ...Array.from({ length: MAX_LOGREGELS + 100 }, (_, i) => regel(i))]
    const uit = begrensLog({ changeLog: log })
    expect(uit.changeLog.some((c) => c.id === 'review-af')).toBe(false)
  })

  it('struikelt niet over een ontbrekend of onzinnig log', () => {
    for (const onzin of [undefined, null, 'log', 42, {}]) {
      const state = { changeLog: onzin }
      expect(begrensLog(state)).toBe(state)
    }
  })

  it('laat de rest van de state ongemoeid', () => {
    const teams = [{ id: 'team-1', naam: 'Team 1' }]
    const log = Array.from({ length: MAX_LOGREGELS + 1 }, (_, i) => regel(i))
    const uit = begrensLog({ changeLog: log, teams, usingMockData: false })
    expect(uit.teams).toBe(teams)
    expect(uit.usingMockData).toBe(false)
  })
})

describe('begrensLog — de reviewuitzondering kan de grens niet buiten werking zetten', () => {
  it('bewaart geen pending regels waarvan de dependency niet meer bestaat', () => {
    // De migratie zet elke 'dependency_created' zonder geldige status terug op
    // 'pending' (storage.js). Een oude import levert zo duizenden wees-regels
    // op die op geen enkel scherm te zien zijn. Zonder deze scherpte bleef het
    // log gewoon doorgroeien -- in de browser gemeten op 3164 regels waar er
    // 2000 hadden moeten overblijven.
    const wezen = Array.from({ length: 1000 }, (_, i) =>
      regel(i, { id: `wees-${i}`, type: 'dependency_created', status: 'pending', dependencyId: `weg-${i}` }),
    )
    const log = [...wezen, ...Array.from({ length: MAX_LOGREGELS }, (_, i) => regel(i + 5000))]
    const uit = begrensLog({ changeLog: log, dependencies: [] })
    expect(uit.changeLog).toHaveLength(MAX_LOGREGELS)
    expect(uit.changeLog.some((c) => c.id.startsWith('wees-'))).toBe(false)
  })

  it('bewaart ze wél zodra hun dependency nog bestaat', () => {
    const echt = regel(0, { id: 'review-echt', type: 'dependency_created', status: 'pending', dependencyId: 'dep-1' })
    const log = [echt, ...Array.from({ length: MAX_LOGREGELS }, (_, i) => regel(i + 5000))]
    const uit = begrensLog({ changeLog: log, dependencies: [{ id: 'dep-1' }] })
    expect(uit.changeLog.some((c) => c.id === 'review-echt')).toBe(true)
  })
})

describe('splitsArchief', () => {
  const nu = new Date('2026-09-19T12:00:00.000Z')
  const opDatum = (id, iso, extra = {}) => ({ ...regel(0, extra), id, timestamp: iso })

  it('archiveert alleen regels ouder dan twaalf maanden', () => {
    const log = [
      opDatum('oud', '2024-01-01T00:00:00.000Z'),
      opDatum('randje-oud', '2025-09-18T00:00:00.000Z'),
      opDatum('randje-nieuw', '2025-09-20T00:00:00.000Z'),
      opDatum('nieuw', '2026-09-01T00:00:00.000Z'),
    ]
    const { archief, blijft } = splitsArchief(log, [], nu)
    expect(archief.map((r) => r.id)).toEqual(['oud', 'randje-oud'])
    expect(blijft.map((r) => r.id)).toEqual(['randje-nieuw', 'nieuw'])
  })

  it('laat een oude reviewregel met bestaande dependency staan', () => {
    const log = [opDatum('review', '2024-01-01T00:00:00.000Z', { type: 'dependency_created', status: 'pending', dependencyId: 'dep-1' })]
    expect(splitsArchief(log, [{ id: 'dep-1' }], nu).archief).toHaveLength(0)
    expect(splitsArchief(log, [], nu).archief).toHaveLength(1)
  })

  it('laat een regel zonder bruikbare datum staan', () => {
    // Niet kunnen vaststellen hoe oud iets is, is geen reden om het weg te
    // gooien.
    const log = [opDatum('kapot', 'gisteren'), opDatum('leeg', '')]
    expect(splitsArchief(log, [], nu).archief).toHaveLength(0)
  })

  it('meldt vanaf welke datum er straks nog gegevens zijn', () => {
    const log = [opDatum('oud', '2024-01-01T00:00:00.000Z'), opDatum('nieuw', '2026-03-05T00:00:00.000Z')]
    const { oudsteResterend } = splitsArchief(log, [], nu)
    expect(oudsteResterend.toISOString().slice(0, 10)).toBe('2026-03-05')
  })
})

// importState in AppContext schrijft rechtstreeks naar de opslag en gaat niet
// langs persist. Deze test legt de samenstelling vast die daar gebruikt wordt:
// begrensLog(migrateState(bestand)). Zonder die begrenzing landde een bestand
// met 8000 logregels ongemoeid in de opslag (in de browser gemeten) en sloeg de
// bovengrens pas toe bij de eerstvolgende wijziging -- terwijl juist die eerste
// schrijfactie op het opslagquotum kan stuklopen.
describe('een import komt ook langs de bovengrens', () => {
  const team = { id: 'team-1', naam: 'Team 1', actief: true }
  const dep = { id: 'dep-1', teamId: 'team-1', titel: 'Een dependency' }

  function importBestand(aantalLogregels, extraLog = []) {
    return {
      teams: [team],
      dependencies: [dep],
      teamWorkflows: {},
      externalParties: [],
      changeLog: [
        ...extraLog,
        ...Array.from({ length: aantalLogregels }, (_, i) => ({
          id: `imp-${i}`,
          timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
          teamId: 'team-1',
          type: 'dependency_updated',
          dependencyId: 'dep-1',
          titel: `Regel ${i}`,
        })),
      ],
    }
  }

  it('kapt een te lang log uit een importbestand meteen af', () => {
    const uit = begrensLog(migrateState(importBestand(8000)))
    expect(uit.changeLog).toHaveLength(MAX_LOGREGELS)
    // De nieuwste blijven staan: de laatste regel van het bestand is de nieuwste.
    expect(uit.changeLog.at(-1).id).toBe('imp-7999')
  })

  it('houdt een reviewregel uit dat bestand overeind', () => {
    const wachtend = {
      id: 'review-import',
      timestamp: new Date(2020, 0, 1).toISOString(),
      teamId: 'team-1',
      type: 'dependency_created',
      dependencyId: 'dep-1',
      titel: 'Wacht op review',
      status: 'pending',
    }
    const uit = begrensLog(migrateState(importBestand(8000, [wachtend])))
    expect(uit.changeLog.some((c) => c.id === 'review-import')).toBe(true)
  })

  it('laat een import onder de grens ongemoeid', () => {
    const gemigreerd = migrateState(importBestand(50))
    expect(begrensLog(gemigreerd)).toBe(gemigreerd)
  })
})
