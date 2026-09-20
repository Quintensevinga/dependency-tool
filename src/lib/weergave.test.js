import { describe, it, expect } from 'vitest'
import { saneerLijst, saneerKeuze, saneerVlag } from './weergave'

// Een bewaarde keuze kan onmogelijk worden: een team verdwijnt, een
// filterwaarde bestaat niet meer. Deze drie regelen de terugval; zonder hen
// levert zo'n waarde een leeg scherm of een foutmelding op.
describe('saneerLijst', () => {
  const toegestaan = ['Laag', 'Gemiddeld', 'Hoog', 'Kritiek']

  it('houdt alleen waarden die nog bestaan', () => {
    expect(saneerLijst(['Hoog', 'Verdwenen', 'Laag'], toegestaan, toegestaan)).toEqual(['Hoog', 'Laag'])
  })

  it('laat een volledig geldige lijst ongemoeid', () => {
    expect(saneerLijst(['Hoog'], toegestaan, toegestaan)).toEqual(['Hoog'])
  })

  it('respecteert een bewust lege keuze', () => {
    // 'alles uitgevinkt' is een keuze van de gebruiker; die bij het verversen
    // terugdraaien zou hem verbaasd achterlaten.
    expect(saneerLijst([], toegestaan, toegestaan)).toEqual([])
  })

  it('valt terug op de standaard bij onzin', () => {
    for (const onzin of [null, undefined, 'Hoog', 42, {}]) {
      expect(saneerLijst(onzin, toegestaan, toegestaan)).toBe(toegestaan)
    }
  })

  it('valt terug wanneer er niets geldigs overblijft', () => {
    expect(saneerLijst(['Verdwenen', 'Ook weg'], toegestaan, toegestaan)).toBe(toegestaan)
  })
})

describe('saneerKeuze', () => {
  it('houdt een bestaande keuze', () => {
    expect(saneerKeuze('extern', 'alle', ['alle', 'intern', 'extern'])).toBe('extern')
  })

  it('valt terug op de standaard bij een verdwenen of onzinnige keuze', () => {
    expect(saneerKeuze('verdwenen', 'alle', ['alle', 'intern'])).toBe('alle')
    expect(saneerKeuze(null, 'alle', ['alle'])).toBe('alle')
    expect(saneerKeuze(3, 'alle', ['alle'])).toBe('alle')
  })
})

describe('saneerVlag', () => {
  it('houdt een echte booleaan, ook false', () => {
    expect(saneerVlag(false, true)).toBe(false)
    expect(saneerVlag(true, false)).toBe(true)
  })

  it('valt terug bij alles wat geen booleaan is', () => {
    for (const onzin of [null, undefined, 'true', 1, 0, {}]) {
      expect(saneerVlag(onzin, true)).toBe(true)
    }
  })
})
