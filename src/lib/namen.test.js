import { describe, it, expect } from 'vitest'
import { vergelijkbareNaam, zelfdeNaam } from './namen'

// De vergelijkingsregel wordt op meerdere plekken gebruikt (de partijkiezer nu,
// de controlelijst op dubbele namen later). Deze tests leggen de regel zelf
// vast, niet het scherm eromheen — schuift de regel, dan horen ze rood te
// worden op de plek waar dat zichtbaar is.
describe('vergelijkbareNaam', () => {
  it('negeert hoofdletters', () => {
    expect(vergelijkbareNaam('Belastingdienst')).toBe('belastingdienst')
  })

  it('negeert spaties, streepjes en onderstrepingen', () => {
    expect(vergelijkbareNaam('Polis  Gateway')).toBe('polisgateway')
    expect(vergelijkbareNaam('polis-gateway')).toBe('polisgateway')
    expect(vergelijkbareNaam('polis_gateway')).toBe('polisgateway')
    expect(vergelijkbareNaam(' polis - gateway ')).toBe('polisgateway')
  })

  it('laat andere leestekens wel staan', () => {
    // 'S.H.I.E.L.D.' en 'SHIELD' zijn onder deze regel níét gelijk. Dat is een
    // keuze, geen omissie: punten weghalen zou 'a.s.' en 'as' gelijkstellen.
    expect(vergelijkbareNaam('S.H.I.E.L.D.')).toBe('s.h.i.e.l.d.')
    expect(zelfdeNaam('S.H.I.E.L.D.', 'SHIELD')).toBe(false)
  })

  it('geeft een lege string terug bij onzin', () => {
    for (const onzin of [null, undefined, 42, {}, [], true]) {
      expect(vergelijkbareNaam(onzin)).toBe('')
    }
  })
})

describe('zelfdeNaam', () => {
  it('herkent dezelfde naam in een andere schrijfwijze', () => {
    expect(zelfdeNaam('Polis Gateway', 'polis-gateway')).toBe(true)
    expect(zelfdeNaam('UWV  Gegevensdiensten', 'uwv gegevensdiensten')).toBe(true)
  })

  it('houdt echt verschillende namen uit elkaar', () => {
    expect(zelfdeNaam('Polis', 'Polissen')).toBe(false)
    expect(zelfdeNaam('Team Asgard', 'Team Wakanda')).toBe(false)
  })

  it('laat lege namen nooit matchen', () => {
    // Anders zou elk naamloos record met elk ander naamloos record "dubbel"
    // heten, en dat is precies de melding die niemand kan opvolgen.
    expect(zelfdeNaam('', '')).toBe(false)
    expect(zelfdeNaam('   ', '-')).toBe(false)
    expect(zelfdeNaam(null, null)).toBe(false)
    expect(zelfdeNaam('Polis', '')).toBe(false)
  })
})
