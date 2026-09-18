import { describe, it, expect } from 'vitest'
import { calculateRisk, MAX_RISK_SCORE } from './risk'

// TEST 1 — gouden tabel over alle 48 combinaties van calculateRisk.
//
// De verwachte waarden hieronder zijn MET DE HAND uitgerekend en staan hier
// bewust als letterlijke getallen. Ze worden expres NIET uit IMPACT_POINTS,
// FREQUENCY_POINTS of STATUS_CORRECTION in risk.js afgeleid: die tabellen zijn
// precies wat deze test moet bewaken. Een gouden tabel die zijn verwachting
// haalt uit dezelfde tabel die hij controleert, test niets — wijzig je daar een
// cijfer, dan wijzigt de verwachting mee en blijft de test groen.
//
// De formule waarmee onderstaande kolommen zijn uitgerekend:
//   impactpunten     klein 1, beperkt 2, duidelijk 3, zwaar 4
//   frequentiepunten eenmalig 1, soms 2, regelmatig 3, structureel 4
//   statuscorrectie  'actief blokkerend' +2, 'bekend risico' 0, 'gemitigeerd' -2
//   score            max(1, impactpunten x frequentiepunten + statuscorrectie)
//   niveau           t/m 6 Laag, t/m 12 Gemiddeld, t/m 16 Hoog, daarboven Kritiek
//
// Kolommen: impact, frequentie, status, impactpunten, frequentiepunten,
// statuscorrectie, score, niveau.
const GOUDEN_TABEL = [
  // impact: klein (1 punt)
  ['klein', 'eenmalig', 'actief blokkerend', 1, 1, 2, 3, 'Laag'],
  ['klein', 'eenmalig', 'bekend risico', 1, 1, 0, 1, 'Laag'],
  ['klein', 'eenmalig', 'gemitigeerd', 1, 1, -2, 1, 'Laag'],
  ['klein', 'soms', 'actief blokkerend', 1, 2, 2, 4, 'Laag'],
  ['klein', 'soms', 'bekend risico', 1, 2, 0, 2, 'Laag'],
  ['klein', 'soms', 'gemitigeerd', 1, 2, -2, 1, 'Laag'],
  ['klein', 'regelmatig', 'actief blokkerend', 1, 3, 2, 5, 'Laag'],
  ['klein', 'regelmatig', 'bekend risico', 1, 3, 0, 3, 'Laag'],
  ['klein', 'regelmatig', 'gemitigeerd', 1, 3, -2, 1, 'Laag'],
  ['klein', 'structureel', 'actief blokkerend', 1, 4, 2, 6, 'Laag'],
  ['klein', 'structureel', 'bekend risico', 1, 4, 0, 4, 'Laag'],
  ['klein', 'structureel', 'gemitigeerd', 1, 4, -2, 2, 'Laag'],

  // impact: beperkt (2 punten)
  ['beperkt', 'eenmalig', 'actief blokkerend', 2, 1, 2, 4, 'Laag'],
  ['beperkt', 'eenmalig', 'bekend risico', 2, 1, 0, 2, 'Laag'],
  ['beperkt', 'eenmalig', 'gemitigeerd', 2, 1, -2, 1, 'Laag'],
  ['beperkt', 'soms', 'actief blokkerend', 2, 2, 2, 6, 'Laag'],
  ['beperkt', 'soms', 'bekend risico', 2, 2, 0, 4, 'Laag'],
  ['beperkt', 'soms', 'gemitigeerd', 2, 2, -2, 2, 'Laag'],
  ['beperkt', 'regelmatig', 'actief blokkerend', 2, 3, 2, 8, 'Gemiddeld'],
  ['beperkt', 'regelmatig', 'bekend risico', 2, 3, 0, 6, 'Laag'],
  ['beperkt', 'regelmatig', 'gemitigeerd', 2, 3, -2, 4, 'Laag'],
  ['beperkt', 'structureel', 'actief blokkerend', 2, 4, 2, 10, 'Gemiddeld'],
  ['beperkt', 'structureel', 'bekend risico', 2, 4, 0, 8, 'Gemiddeld'],
  ['beperkt', 'structureel', 'gemitigeerd', 2, 4, -2, 6, 'Laag'],

  // impact: duidelijk (3 punten)
  ['duidelijk', 'eenmalig', 'actief blokkerend', 3, 1, 2, 5, 'Laag'],
  ['duidelijk', 'eenmalig', 'bekend risico', 3, 1, 0, 3, 'Laag'],
  ['duidelijk', 'eenmalig', 'gemitigeerd', 3, 1, -2, 1, 'Laag'],
  ['duidelijk', 'soms', 'actief blokkerend', 3, 2, 2, 8, 'Gemiddeld'],
  ['duidelijk', 'soms', 'bekend risico', 3, 2, 0, 6, 'Laag'],
  ['duidelijk', 'soms', 'gemitigeerd', 3, 2, -2, 4, 'Laag'],
  ['duidelijk', 'regelmatig', 'actief blokkerend', 3, 3, 2, 11, 'Gemiddeld'],
  ['duidelijk', 'regelmatig', 'bekend risico', 3, 3, 0, 9, 'Gemiddeld'],
  ['duidelijk', 'regelmatig', 'gemitigeerd', 3, 3, -2, 7, 'Gemiddeld'],
  ['duidelijk', 'structureel', 'actief blokkerend', 3, 4, 2, 14, 'Hoog'],
  ['duidelijk', 'structureel', 'bekend risico', 3, 4, 0, 12, 'Gemiddeld'],
  ['duidelijk', 'structureel', 'gemitigeerd', 3, 4, -2, 10, 'Gemiddeld'],

  // impact: zwaar (4 punten)
  ['zwaar', 'eenmalig', 'actief blokkerend', 4, 1, 2, 6, 'Laag'],
  ['zwaar', 'eenmalig', 'bekend risico', 4, 1, 0, 4, 'Laag'],
  ['zwaar', 'eenmalig', 'gemitigeerd', 4, 1, -2, 2, 'Laag'],
  ['zwaar', 'soms', 'actief blokkerend', 4, 2, 2, 10, 'Gemiddeld'],
  ['zwaar', 'soms', 'bekend risico', 4, 2, 0, 8, 'Gemiddeld'],
  ['zwaar', 'soms', 'gemitigeerd', 4, 2, -2, 6, 'Laag'],
  ['zwaar', 'regelmatig', 'actief blokkerend', 4, 3, 2, 14, 'Hoog'],
  ['zwaar', 'regelmatig', 'bekend risico', 4, 3, 0, 12, 'Gemiddeld'],
  ['zwaar', 'regelmatig', 'gemitigeerd', 4, 3, -2, 10, 'Gemiddeld'],
  ['zwaar', 'structureel', 'actief blokkerend', 4, 4, 2, 18, 'Kritiek'],
  ['zwaar', 'structureel', 'bekend risico', 4, 4, 0, 16, 'Hoog'],
  ['zwaar', 'structureel', 'gemitigeerd', 4, 4, -2, 14, 'Hoog'],
]

describe('calculateRisk — gouden tabel', () => {
  it('dekt precies alle 48 combinaties (4 impact x 4 frequentie x 3 status)', () => {
    expect(GOUDEN_TABEL).toHaveLength(48)
    // Geen dubbele rijen: anders dekt 48 rijen alsnog minder dan 48 gevallen.
    const sleutels = new Set(GOUDEN_TABEL.map(([i, f, s]) => `${i}|${f}|${s}`))
    expect(sleutels.size).toBe(48)
  })

  it.each(GOUDEN_TABEL)(
    'impact=%s frequentie=%s status=%s -> score %i (%s)',
    (impact, frequentie, status, impactPoints, frequencyPoints, statusCorrection, score, level) => {
      const uitkomst = calculateRisk({ impact, frequentie, status })
      expect(uitkomst.score).toBe(score)
      expect(uitkomst.level).toBe(level)
      expect(uitkomst.breakdown).toEqual({
        impactPoints,
        frequencyPoints,
        baseScore: impactPoints * frequencyPoints,
        statusCorrection,
      })
    },
  )

  it('MAX_RISK_SCORE is 18 — de hoogst bereikbare score uit de tabel', () => {
    expect(MAX_RISK_SCORE).toBe(18)
    expect(Math.max(...GOUDEN_TABEL.map((rij) => rij[6]))).toBe(MAX_RISK_SCORE)
  })
})

// TEST 2 — calculateRisk met onzinwaarden.
//
// 'constructor' en 'toString' zijn geen grap: de puntentabellen in risk.js zijn
// met Object.create(null) gemaakt juist zodat die namen undefined opleveren in
// plaats van een geërfde functie van Object.prototype. Precies dat gedrag wordt
// hier vastgelegd — wie die tabellen ooit terugzet naar gewone objectliteralen,
// krijgt hier een rode test in plaats van NaN-scores in productie.
describe('calculateRisk — onzinwaarden', () => {
  it('valt op een leeg object terug op score 1 / Laag', () => {
    const uitkomst = calculateRisk({})
    expect(uitkomst.score).toBe(1)
    expect(uitkomst.level).toBe('Laag')
  })

  it('valt met alleen impact terug op score 1 / Laag', () => {
    const uitkomst = calculateRisk({ impact: 'klein' })
    expect(uitkomst.score).toBe(1)
    expect(uitkomst.level).toBe('Laag')
  })

  it('behandelt prototype-namen als onbekend, niet als geërfde functie', () => {
    const uitkomst = calculateRisk({ impact: 'constructor', frequentie: 'toString', status: 'constructor' })
    expect(uitkomst.score).toBe(1)
    expect(uitkomst.level).toBe('Laag')
    expect(uitkomst.breakdown).toEqual({
      impactPoints: 1,
      frequencyPoints: 1,
      baseScore: 1,
      statusCorrection: 0,
    })
  })

  it('gooit geen uitzondering op onbekende losse waarden', () => {
    expect(() => calculateRisk({ impact: 'onzin', frequentie: 'onzin', status: 'onzin' })).not.toThrow()
  })

  // Bewust NIET vastgelegd: calculateRisk(null) en calculateRisk(undefined).
  // Die gooien een TypeError omdat dependency.impact rechtstreeks gelezen wordt
  // (risk.js). Dat hier als "gewenst gedrag" vastleggen zou een keuze
  // stilzwijgend bevriezen die nooit gemaakt is — wil je dat het daar ook niet
  // klapt, dan is dat een aparte wijziging in risk.js en een apart besluit.
})
