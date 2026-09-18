import { describe, it, expect } from 'vitest'
import { berekenFlowverlies, berekenUrgentie, bepaalKwadrant } from './analysis'

// TEST 3 — de niveaugrenzen in analysis.js.
//
// Net als bij de gouden tabel in risk.test.js staan de verwachte uitkomsten
// hier als letterlijke waarden, met de hand uitgerekend uit de afgesproken
// formule, en niet afgeleid uit de puntentabellen in analysis.js zelf.
//
//   wachttijdpunten  geen 0, kort 1, dagen 2, sprint_of_meer 3
//   frequentiepunten eenmalig 1, soms 2, regelmatig 3, structureel 4
//   score            wachttijdpunten x frequentiepunten
//   niveau           t/m 2 Laag, t/m 5 Gemiddeld, t/m 8 Hoog, daarboven Kritiek

describe('berekenFlowverlies — niveaugrenzen', () => {
  // Net onder, op en net boven elke grens, met combinaties die ook echt
  // bereikbaar zijn. De producten van {0,1,2,3} x {1,2,3,4} leveren alleen
  // 0,1,2,3,4,6,8,9 en 12 op: de scores 5 en 7 bestaan in de praktijk niet, dus
  // die zijn hier bewust niet als grensgeval gekozen.
  const GEVALLEN = [
    // wachttijd, frequentie, score, niveau
    ['geen', 'eenmalig', 0, 'Laag'],
    ['geen', 'structureel', 0, 'Laag'],
    ['kort', 'eenmalig', 1, 'Laag'],
    ['kort', 'soms', 2, 'Laag'], // op de grens Laag/Gemiddeld
    ['kort', 'regelmatig', 3, 'Gemiddeld'], // net erboven
    ['kort', 'structureel', 4, 'Gemiddeld'],
    ['dagen', 'soms', 4, 'Gemiddeld'],
    ['dagen', 'regelmatig', 6, 'Hoog'], // net boven de grens Gemiddeld/Hoog (5)
    ['dagen', 'structureel', 8, 'Hoog'], // op de grens Hoog/Kritiek
    ['sprint_of_meer', 'regelmatig', 9, 'Kritiek'], // net erboven
    ['sprint_of_meer', 'structureel', 12, 'Kritiek'],
  ]

  it.each(GEVALLEN)('wachttijd=%s frequentie=%s -> score %i (%s)', (wachttijd, frequentie, score, level) => {
    const uitkomst = berekenFlowverlies({ wachttijd, frequentie })
    expect(uitkomst).not.toBeNull()
    expect(uitkomst.score).toBe(score)
    expect(uitkomst.level).toBe(level)
  })

  it('geeft null als het veld wachttijd ontbreekt', () => {
    expect(berekenFlowverlies({ frequentie: 'structureel' })).toBeNull()
  })

  it('geeft null als wachttijd leeg is', () => {
    expect(berekenFlowverlies({ wachttijd: '', frequentie: 'structureel' })).toBeNull()
  })

  // Het verschil dat er hier echt toe doet: 'niet ingevuld' is iets anders dan
  // 'geen wachttijd'. De eerste levert null op (profiel onvolledig), de tweede
  // een echte uitkomst met score 0.
  it("behandelt wachttijd 'geen' als een ingevulde waarde, niet als leeg", () => {
    const uitkomst = berekenFlowverlies({ wachttijd: 'geen', frequentie: 'regelmatig' })
    expect(uitkomst).not.toBeNull()
    expect(uitkomst.score).toBe(0)
    expect(uitkomst.level).toBe('Laag')
  })

  it('valt bij een onbekende frequentie terug op 1 punt', () => {
    expect(berekenFlowverlies({ wachttijd: 'dagen', frequentie: 'onzin' }).score).toBe(2)
  })
})

describe('berekenUrgentie', () => {
  it('geeft null zonder deadline', () => {
    expect(berekenUrgentie({})).toBeNull()
    expect(berekenUrgentie({ deadline: '' })).toBeNull()
  })

  it.each([
    ['geen_datum', 'Laag'],
    ['interne_afspraak', 'Gemiddeld'],
    ['vaste_datum', 'Hoog'],
    ['harde_deadline', 'Kritiek'],
  ])('deadline=%s -> %s', (deadline, level) => {
    expect(berekenUrgentie({ deadline }).level).toBe(level)
  })

  it('valt bij een onbekende deadlinewaarde terug op Laag', () => {
    expect(berekenUrgentie({ deadline: 'onzin' }).level).toBe('Laag')
  })
})

describe('bepaalKwadrant', () => {
  // De vier hoeken. 'dagen' + 'regelmatig' geeft score 6 (Hoog) = veel verlies;
  // 'kort' + 'soms' geeft score 2 (Laag) = weinig verlies.
  it.each([
    ['dagen', 'regelmatig', 'teamlid', 'quick_win'],
    ['dagen', 'regelmatig', 'meerdere_teamleden', 'quick_win'],
    ['dagen', 'regelmatig', 'meerdere_teams', 'opschalen'],
    ['dagen', 'regelmatig', 'organisatorisch', 'opschalen'],
    ['kort', 'soms', 'teamlid', 'opruimen'],
    ['kort', 'soms', 'meerdere_teamleden', 'opruimen'],
    ['kort', 'soms', 'meerdere_teams', 'accepteren'],
    ['kort', 'soms', 'team_overstijgend', 'accepteren'],
  ])('wachttijd=%s frequentie=%s oplosbaarheid=%s -> %s', (wachttijd, frequentie, oplosbaarheid, kwadrant) => {
    expect(bepaalKwadrant({ wachttijd, frequentie, oplosbaarheid })).toBe(kwadrant)
  })

  it('geeft null zolang flowverlies null is (geen wachttijd ingevuld)', () => {
    expect(bepaalKwadrant({ frequentie: 'regelmatig', oplosbaarheid: 'teamlid' })).toBeNull()
  })

  it('geeft null zolang oplosbaarheid ontbreekt', () => {
    expect(bepaalKwadrant({ wachttijd: 'dagen', frequentie: 'regelmatig' })).toBeNull()
    expect(bepaalKwadrant({ wachttijd: 'dagen', frequentie: 'regelmatig', oplosbaarheid: '' })).toBeNull()
  })

  // Randgeval dat makkelijk verkeerd gaat: wachttijd 'geen' is ingevuld, dus
  // flowverlies is niet null maar score 0 / Laag. Het kwadrant is daarmee
  // 'opruimen' en nadrukkelijk niet null.
  it("geeft bij wachttijd 'geen' met oplosbaarheid 'teamlid' de waarde opruimen, niet null", () => {
    expect(bepaalKwadrant({ wachttijd: 'geen', frequentie: 'structureel', oplosbaarheid: 'teamlid' })).toBe('opruimen')
  })
})
