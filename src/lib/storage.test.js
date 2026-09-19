import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { migrateState, migrateAdminSettings, validateImportShape, telOnvolledigeNamen, SCHEMA_VERSION } from './storage'

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

// Punt 6 — een leeg of onbruikbaar element in de dependencylijst mag niet de
// hele dataset kosten. Vóór de reparatie gooide migrateDependency hier een
// TypeError; bij het opstarten zit die in de try van loadState, waardoor de
// complete opslag als onleesbaar werd bestempeld en vervangen door demodata.
describe('migrateState — onbruikbare records in de dependencylijst', () => {
  const ROMMEL = { teams: ['Team Alfa'], dependencies: [null, { titel: 'x' }, 'tekst'] }

  it('gooit geen uitzondering', () => {
    expect(() => migrateState(ROMMEL)).not.toThrow()
  })

  it('houdt precies de records over die wél een object zijn', () => {
    const { dependencies } = migrateState(ROMMEL)
    expect(dependencies).toHaveLength(1)
    expect(dependencies[0].titel).toBe('x')
  })

  it('telt hoeveel records zijn overgeslagen', () => {
    const report = {}
    migrateState(ROMMEL, report)
    expect(report.skippedDependencies).toBe(2)
  })

  it('telt een array ook als onbruikbaar record', () => {
    const report = {}
    const { dependencies } = migrateState({ dependencies: [[], { titel: 'x' }] }, report)
    expect(dependencies).toHaveLength(1)
    expect(report.skippedDependencies).toBe(1)
  })

  it('meldt nul overgeslagen records bij een schone lijst', () => {
    const report = {}
    migrateState(oudeExport(), report)
    expect(report.skippedDependencies).toBe(0)
  })

  // Het overslaan geldt alleen voor de lokale opslag. Bij importeren wordt
  // hetzelfde geval al eerder en strenger afgevangen, en dat moet zo blijven:
  // een importbestand is iemands bewuste invoer, daar hoort een duidelijke
  // fout bij in plaats van stilzwijgend minder records.
  it('laat de strengere importcontrole ongemoeid', () => {
    expect(() => validateImportShape({ teams: [], dependencies: [null] })).toThrow(/positie 1 is geen geldig object/)
  })
})

// Punt 5 — data uit een nieuwere schemaversie weigeren in plaats van stil
// uitkleden. migrateState bouwt de state onvoorwaardelijk opnieuw op uit de
// velden die déze versie kent, dus alles wat een nieuwere versie extra
// meebrengt zou anders spoorloos wegvallen — en bij het laden ook nog eens
// meteen overschreven worden.
describe('validateImportShape — schemaversie', () => {
  const geldig = { teams: [], dependencies: [] }

  it('weigert een bestand met een hogere schemaversie, met beide nummers in de melding', () => {
    expect(() => validateImportShape({ ...geldig, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(
      new RegExp(`versie ${SCHEMA_VERSION + 1}.*versie ${SCHEMA_VERSION}`),
    )
  })

  it('accepteert de huidige schemaversie', () => {
    expect(() => validateImportShape({ ...geldig, schemaVersion: SCHEMA_VERSION })).not.toThrow()
  })

  it('accepteert een lagere schemaversie', () => {
    expect(() => validateImportShape({ ...geldig, schemaVersion: 1 })).not.toThrow()
  })

  // Oude exports hebben dit veld niet altijd en moeten importeerbaar blijven.
  it('accepteert een bestand zonder schemaversie', () => {
    expect(() => validateImportShape(geldig)).not.toThrow()
  })

  it('accepteert een niet-numerieke schemaversie', () => {
    expect(() => validateImportShape({ ...geldig, schemaVersion: 'zes' })).not.toThrow()
  })
})

// Punt 27 — 'procesoverstijgend' is een expliciete keuze geworden. Een
// Ontwikkelflow-record met een ontbrekende of onbekende werkstap kreeg op het
// canvas de lane 'Proces-overstijgend' toegewezen omdat de lookup niets
// opleverde; een gat zag er zo hetzelfde uit als een keuze. De omzetting mag
// uitsluitend ontwikkelflow-records raken.
describe('migrateState — omzetting naar procesoverstijgend', () => {
  function dep(extra) {
    return { id: 'd', teamId: 'team-alfa', titel: 'x', ...extra }
  }
  function migreer(d) {
    return migrateState({ teams: [{ id: 'team-alfa', naam: 'Team Alfa' }], dependencies: [d] }).dependencies[0]
  }

  it('zet een ontwikkelflow-record met een ontbrekende werkstap om', () => {
    expect(migreer(dep({ flowtype: 'ontwikkelflow' })).workflowStap).toBe('procesoverstijgend')
  })

  it('zet een ontwikkelflow-record met een lege werkstap om', () => {
    expect(migreer(dep({ flowtype: 'ontwikkelflow', workflowStap: '' })).workflowStap).toBe('procesoverstijgend')
  })

  it('zet een ontwikkelflow-record met een onbekende werkstap om', () => {
    expect(migreer(dep({ flowtype: 'ontwikkelflow', workflowStap: 'oude_stap' })).workflowStap).toBe('procesoverstijgend')
  })

  it('laat een bekende werkstap ongemoeid', () => {
    expect(migreer(dep({ flowtype: 'ontwikkelflow', workflowStap: 'testen' })).workflowStap).toBe('testen')
  })

  it('vertaalt een legacy-werkstap eerst en zet die dus NIET om', () => {
    expect(migreer(dep({ flowtype: 'ontwikkelflow', workflowStap: 'build' })).workflowStap).toBe('ontwikkeling_configuratie')
  })

  // Het controlegeval dat niet aangeraakt mag worden: applicatieflow kent
  // conceptueel geen werkstap en heeft die bewust leeg.
  it('laat een applicatieflow-record volledig met rust', () => {
    const d = migreer(dep({ flowtype: 'applicatieflow', workflowStap: '' }))
    expect(d.flowtype).toBe('applicatieflow')
    expect(d.workflowStap).toBeNull()
  })

  it('laat ook een applicatieflow-record met een vervuilde werkstap met rust', () => {
    expect(migreer(dep({ flowtype: 'applicatieflow', workflowStap: 'oude_stap' })).workflowStap).toBeNull()
  })

  // Zonder flowtype is het geen ontwikkelflow-record: die horen in de sectie
  // onder het canvas, niet stilzwijgend in een lane.
  it('laat een record zonder flowtype en zonder werkstap met rust', () => {
    const d = migreer(dep({}))
    expect(d.flowtype).toBeNull()
    expect(d.workflowStap).toBeNull()
  })

  it('is idempotent op een al omgezet record', () => {
    expect(migreer(dep({ flowtype: 'ontwikkelflow', workflowStap: 'procesoverstijgend' })).workflowStap).toBe('procesoverstijgend')
  })
})

// I8 — naamcontrole bij importeren. De naamplicht uit I2 geldt voor wat iemand
// nieuw invoert; wat er al was komt gewoon mee. Een importbestand gaat van hand
// tot hand en is daarmee vaak de enige kopie, dus weggooien zou definitief
// zijn. Tellen en melden dus, niet weigeren.
describe('telOnvolledigeNamen', () => {
  const bestand = {
    teams: [{ id: 'team-a', naam: 'Team A' }, { id: 'team-b', naam: 'Team B' }],
    dependencies: [],
    teamWorkflows: {
      'team-a': {
        inputs: [{ id: 'i1', label: 'Met naam' }, { id: 'i2', label: '' }, { id: 'i3', label: '   ' }],
        outputs: [{ id: 'o1', label: '' }],
        capacity: [{ id: 'c1', rol: 'Tester' }, { id: 'c2', rol: '' }],
      },
      'team-b': {
        inputs: [{ id: 'i4', label: 'Prima' }],
        outputs: [],
        capacity: [{ id: 'c3', rol: 'Architect' }],
      },
    },
  }

  it('telt items zonder naam, inclusief namen van alleen spaties', () => {
    const uitkomst = telOnvolledigeNamen(bestand)
    expect(uitkomst.ioItems).toBe(3)
    expect(uitkomst.capaciteitsregels).toBe(1)
    expect(uitkomst.totaal).toBe(4)
  })

  it('noemt alleen de teams waar iets mist, met hun naam', () => {
    const { perTeam } = telOnvolledigeNamen(bestand)
    expect(perTeam).toEqual([{ teamId: 'team-a', teamNaam: 'Team A', ioItems: 3, capaciteitsregels: 1 }])
  })

  it('geeft nul terug op een schoon bestand', () => {
    const uitkomst = telOnvolledigeNamen({ teams: [], dependencies: [], teamWorkflows: {} })
    expect(uitkomst.totaal).toBe(0)
    expect(uitkomst.perTeam).toEqual([])
  })

  it('valt niet om op ontbrekende of rommelige velden', () => {
    expect(() => telOnvolledigeNamen({})).not.toThrow()
    expect(() => telOnvolledigeNamen({ teamWorkflows: { x: null, y: 'tekst' } })).not.toThrow()
    expect(telOnvolledigeNamen(undefined).totaal).toBe(0)
  })

  // Het blijft tellen, niet weigeren: de import moet gewoon doorgaan.
  it('laat een bestand met naamloze items gewoon door de importcontrole', () => {
    expect(() => validateImportShape(bestand)).not.toThrow()
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

describe('migrateAdminSettings — pagina-schakelaars', () => {
  it('vult een pagina die nog niet in de opgeslagen instellingen stond met de standaardwaarde', () => {
    // Een export van vóór 'Alle dependencies' kent die sleutel niet. Die hoort
    // aan te komen als aan, niet als undefined — anders verdwijnt de pagina
    // stilzwijgend uit de zijbalk voor iedereen die zo'n export terugzet.
    const uit = migrateAdminSettings({ pages: { heatmap: true, keten: true, team: true, analyse: true } })
    expect(uit.pages.dependencies).toBe(true)
    expect(uit.sections.dependencies).toEqual({ filters: true })
  })

  it('respecteert een bewust uitgezette pagina', () => {
    expect(migrateAdminSettings({ pages: { dependencies: false } }).pages.dependencies).toBe(false)
  })

  it("gooit sleutels weg van paginas die niet meer bestaan (Matrix, Netwerk)", () => {
    const uit = migrateAdminSettings({ pages: { matrix: true, netwerk: false, heatmap: false } })
    expect(uit.pages.matrix).toBeUndefined()
    expect(uit.pages.netwerk).toBeUndefined()
    expect(uit.pages.heatmap).toBe(false)
  })
})
