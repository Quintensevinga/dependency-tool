#!/usr/bin/env node
// Bouwt de demodataset voor de managementdemo: een fictieve maar herkenbare
// afdeling met zes teams, hun applicaties, de keten ertussen en ~120
// afhankelijkheden.
//
// WAAROM EEN GENERATOR EN NIET EEN LOS JSON-BESTAND
// De data draagt datums ("nieuw in de laatste 30 dagen", "al 90 dagen niet
// bijgewerkt", "een besluit duurt gemiddeld x dagen"). Een bevroren bestand
// veroudert dus: wat je in de repetitie zag, klopt op de dag zelf niet meer.
// Deze generator rekent alle datums om vanaf een peildatum, zodat je het
// bestand vlak voor de demo opnieuw maakt en alles vers is.
//
// WAT ER BEWUST VERZONNEN IS
// De teamnamen zijn echt. De applicatienamen zijn functienamen (wat iets
// dóet), geen productnamen -- die kunnen niet feitelijk fout zijn. Aantallen,
// datums en doorlooptijden zijn plaatshouders: plausibel en onderling
// consistent, maar niemand moet ze als meting lezen.
//
// WAT ER BEWUST NIET IN ZIT
// Geen persoonsnamen. De sleutelrol bij TET staat als rol vastgelegd
// ("Databasespecialist, 1, senior, risico bij wegvallen: ja") -- de tool kent
// geen personen, en voor dit onderwerp is dat precies goed: de zaal maakt de
// rekensom zelf.
//
// Gebruik:
//   node scripts/demo-dataset.mjs                      -> peildatum = vandaag
//   node scripts/demo-dataset.mjs --datum=2026-11-03   -> peildatum = die dag
//   node scripts/demo-dataset.mjs --uit=pad/naar.json

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrateState } from '../src/lib/storage.js'
import { voerUit } from '../src/lib/applicatieregister.js'
import { calculateRisk } from '../src/lib/risk.js'

const argv = process.argv.slice(2)
const arg = (naam, standaard) => {
  const hit = argv.find((a) => a.startsWith(`--${naam}=`))
  return hit ? hit.slice(naam.length + 3) : standaard
}

const hier = path.dirname(fileURLToPath(import.meta.url))
const UIT = path.resolve(hier, '..', arg('uit', 'docs/demo/demo-dataset.json'))
const PEILDATUM = new Date(arg('datum', new Date().toISOString().slice(0, 10)))
if (Number.isNaN(PEILDATUM.getTime())) {
  console.error('Ongeldige peildatum. Gebruik --datum=JJJJ-MM-DD')
  process.exit(1)
}

// Datums worden allemaal uitgedrukt als "zoveel dagen vóór de peildatum", zodat
// de hele set in één keer meeschuift als je hem opnieuw genereert.
const dag = (terug) => new Date(PEILDATUM.getTime() - terug * 86400000).toISOString().slice(0, 10)
const stempel = (terug, uur = 9) => `${dag(terug)}T${String(uur).padStart(2, '0')}:00:00.000Z`

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
// Polis en UPA verzamelen en leveren gegevens; PLM, WGA en CWS verwerken die
// tot hun eigen product. TET is het technisch expertiseteam waar alle vijf
// voor databasewerk langs moeten. Dat laatste is geen rolverdeling die hier
// benoemd wordt -- het blijkt uit de keten, en dat is de bedoeling.
const TEAMS = [
  ['team-polis', 'Team Polis'],
  ['team-upa', 'Team UPA'],
  ['team-plm', 'Team PLM'],
  ['team-wga', 'Team WGA'],
  ['team-cws', 'Team CWS'],
  ['team-tet', 'Team TET'],
]

// ---------------------------------------------------------------------------
// Externe partijen
// ---------------------------------------------------------------------------
const PARTIJEN = [
  ['party-ssd', 'Externe SSD-toetsing', 'stakeholder', 'actief'],
  ['party-cab', 'Change Advisory Board', 'stakeholder', 'actief'],
  ['party-autorisatie', 'Centraal autorisatiebeheer', 'team', 'actief'],
  ['party-omgevingen', 'Omgevingenbeheer (OTAP)', 'omgeving', 'actief'],
  ['party-ontwikkelpartner', 'Externe ontwikkelpartner', 'team', 'actief'],
  ['party-wetgeving', 'Beleid en wetgeving', 'stakeholder', 'actief'],
  ['party-aanleveraar', 'Externe gegevensaanleveraar', 'systeem', 'actief'],
  ['party-toezicht', 'Toezichthouder', 'stakeholder', 'actief'],
  ['party-inkoop', 'Inkoop en contractmanagement', 'team', 'actief'],
  ['party-legacy', 'Leverancier legacyplatform', 'systeem', 'actief'],
  // Twee voorstellen die nog op goedkeuring wachten: daarmee staat de
  // wachtrij in Instellingen niet leeg als je hem tijdens de demo opent.
  ['party-archief', 'Archiefdienst', 'systeem', 'in_afwachting', 'team-cws'],
  ['party-identiteit', 'Identiteitsvoorziening', 'systeem', 'in_afwachting', 'team-wga'],
]

// ---------------------------------------------------------------------------
// Applicaties per team
// ---------------------------------------------------------------------------
// Elk team beheert één hoofdapplicatie en soms een tweede, vergelijkbare.
// Datawarehouse en Koppelservice zijn de twee gedeelde diensten: die staan bij
// meerdere teams in de werkstroom, elk nog met een eigen id. De omzetting naar
// het centrale applicatieregister (onderaan dit bestand) voegt ze samen -- en
// pas daarna kan de analyse zeggen "deze dienst raakt vier teams".
const APPS = {
  'team-polis': [
    ['polis-app-register', 'Polisregister', 'ja', 'Bron van de waarheid voor polis- en dienstverbandgegevens. Legacykern, over de jaren uitgebouwd; drie teams wachten erop.'],
    ['polis-app-correctie', 'Correctieverwerking', 'nee', 'Verwerkt terugmeldingen en handmatige correcties op het polisregister.'],
    ['polis-app-koppel', 'Koppelservice', 'ja', 'Gedeelde koppeldienst; alle gegevensleveringen lopen hierlangs.'],
  ],
  'team-upa': [
    ['upa-app-portaal', 'Aanleverportaal werkgevers', 'ja', 'Ingang voor alle aangiftes van werkgevers.'],
    ['upa-app-verwerking', 'Aangifteverwerking', 'nee', 'Controleert en verwerkt de binnengekomen aangiftes.'],
    ['upa-app-koppel', 'Koppelservice', 'ja', 'Gedeelde koppeldienst; alle gegevensleveringen lopen hierlangs.'],
  ],
  'team-plm': [
    ['plm-app-dossier', 'Productdossierbeheer', 'ja', 'Houdt per klant het dossier bij dat uit de brongegevens wordt opgebouwd.'],
    ['plm-app-mutatie', 'Mutatieverwerking', 'nee', 'Verwerkt wijzigingen op bestaande dossiers.'],
    ['plm-app-dwh', 'Datawarehouse', 'ja', 'Gedeelde gegevensopslag voor rapportage en controle.'],
    ['plm-app-koppel', 'Koppelservice', 'nee', 'Gedeelde koppeldienst; alle gegevensleveringen lopen hierlangs.'],
  ],
  'team-wga': [
    ['wga-app-berekening', 'Uitkeringsberekening', 'ja', 'Rekent uitkeringen door op basis van polis- en aangiftegegevens.'],
    ['wga-app-beslis', 'Beslisondersteuning', 'nee', 'Ondersteunt de beoordelaar met regels en signalen.'],
    ['wga-app-dwh', 'Datawarehouse', 'ja', 'Gedeelde gegevensopslag voor rapportage en controle.'],
  ],
  'team-cws': [
    ['cws-app-signalering', 'Signaleringsservice', 'ja', 'Signaleert afwijkingen in de geleverde gegevens.'],
    ['cws-app-rapportage', 'Rapportagegenerator', 'ja', 'Levert de verantwoordingsrapportages. Broncode ligt bij de externe ontwikkelpartner.'],
    ['cws-app-dwh', 'Datawarehouse', 'nee', 'Gedeelde gegevensopslag voor rapportage en controle.'],
  ],
  'team-tet': [
    ['tet-app-dwh', 'Datawarehouse', 'ja', 'Centrale gegevensopslag; TET beheert de structuur en de laadprocessen.'],
    ['tet-app-koppel', 'Koppelservice', 'ja', 'Centrale koppeldienst tussen de applicaties van de afdeling.'],
    ['tet-app-querybib', 'Querybibliotheek', 'ja', 'Verzameling complexe query’s die voor alle teams wordt onderhouden.'],
  ],
}

// ---------------------------------------------------------------------------
// De keten: wat gaat er heen en weer
// ---------------------------------------------------------------------------
// Een geaccepteerde ketenkoppeling wordt gelegd op het INPUT-item van het
// ontvangende team (zie resolveChainEdges in lib/teamWorkflow.js). De twee
// terugkoppelingen hieronder maken de lus: WGA meldt onjuiste polisgegevens
// terug aan Polis, en CWS meldt kwaliteitssignalen terug aan UPA. Daarmee telt
// de analyse cycli, en kun je de vraag stellen die je wilt stellen: wat
// gebeurt er als deze pijl wegvalt?
const OUTPUTS = {
  'team-polis': [
    ['polis-out-mutaties', 'Polismutaties', 'polis-app-register'],
    ['polis-out-correcties', 'Gecorrigeerde polisgegevens', 'polis-app-correctie'],
  ],
  'team-upa': [
    ['upa-out-aangiftegegevens', 'Verwerkte aangiftegegevens', 'upa-app-verwerking'],
  ],
  'team-plm': [
    ['plm-out-dossier', 'Productdossier', 'plm-app-dossier'],
  ],
  'team-wga': [
    ['wga-out-terugmelding', 'Terugmelding onjuiste polisgegevens', 'wga-app-berekening'],
    ['wga-out-beschikking', 'Beschikkingsgegevens', 'wga-app-berekening'],
  ],
  'team-cws': [
    ['cws-out-signalen', 'Kwaliteitssignalen', 'cws-app-signalering'],
    ['cws-out-rapportage', 'Verantwoordingsrapportage', 'cws-app-rapportage'],
  ],
  'team-tet': [
    ['tet-out-polis', 'Doorgevoerde databasewijziging', 'tet-app-dwh'],
    ['tet-out-upa', 'Doorgevoerde databasewijziging', 'tet-app-dwh'],
    ['tet-out-plm', 'Doorgevoerde databasewijziging', 'tet-app-dwh'],
    ['tet-out-wga', 'Doorgevoerde databasewijziging', 'tet-app-dwh'],
    ['tet-out-cws', 'Doorgevoerde databasewijziging', 'tet-app-dwh'],
  ],
}

// [id, label, bron (team-id of 'partij:<id>' of ''), bron-output-id, applicatieId]
const INPUTS = {
  'team-polis': [
    ['polis-in-tet', 'Doorgevoerde databasewijziging', 'team-tet', 'tet-out-polis', ''],
    ['polis-in-brongegevens', 'Brongegevens werkgevers', 'partij:party-aanleveraar', '', 'polis-app-register'],
    ['polis-in-terugmelding', 'Terugmelding onjuiste polisgegevens', 'team-wga', 'wga-out-terugmelding', 'polis-app-correctie'],
  ],
  'team-upa': [
    ['upa-in-tet', 'Doorgevoerde databasewijziging', 'team-tet', 'tet-out-upa', ''],
    ['upa-in-aangiftes', 'Aangiftes van werkgevers', 'partij:party-aanleveraar', '', 'upa-app-portaal'],
    ['upa-in-signalen', 'Kwaliteitssignalen', 'team-cws', 'cws-out-signalen', 'upa-app-verwerking'],
  ],
  'team-plm': [
    ['plm-in-tet', 'Doorgevoerde databasewijziging', 'team-tet', 'tet-out-plm', ''],
    ['plm-in-polis', 'Polismutaties', 'team-polis', 'polis-out-mutaties', 'plm-app-dossier'],
    ['plm-in-upa', 'Verwerkte aangiftegegevens', 'team-upa', 'upa-out-aangiftegegevens', 'plm-app-dossier'],
  ],
  'team-wga': [
    ['wga-in-tet', 'Doorgevoerde databasewijziging', 'team-tet', 'tet-out-wga', ''],
    ['wga-in-polis', 'Polismutaties', 'team-polis', 'polis-out-mutaties', 'wga-app-berekening'],
    ['wga-in-correcties', 'Gecorrigeerde polisgegevens', 'team-polis', 'polis-out-correcties', 'wga-app-berekening'],
    ['wga-in-upa', 'Verwerkte aangiftegegevens', 'team-upa', 'upa-out-aangiftegegevens', 'wga-app-berekening'],
  ],
  'team-cws': [
    ['cws-in-tet', 'Doorgevoerde databasewijziging', 'team-tet', 'tet-out-cws', ''],
    ['cws-in-polis', 'Polismutaties', 'team-polis', 'polis-out-mutaties', 'cws-app-signalering'],
    ['cws-in-dossier', 'Productdossier', 'team-plm', 'plm-out-dossier', 'cws-app-signalering'],
    ['cws-in-beschikking', 'Beschikkingsgegevens', 'team-wga', 'wga-out-beschikking', 'cws-app-rapportage'],
  ],
  'team-tet': [],
}

// Twee koppelingen die nog op akkoord wachten -- zo is de goedkeuringsstap
// tijdens de demo te laten zien zonder er een op te moeten voeren.
const VOORSTELLEN = [
  ['team-cws', 'cws-out-rapportage', 'team-plm', '', 'Verantwoordingsrapportage', 9],
  ['team-plm', 'plm-out-dossier', 'team-wga', '', 'Productdossier', 4],
]

// ---------------------------------------------------------------------------
// Capaciteit (rollen, nooit personen)
// ---------------------------------------------------------------------------
// [rol, seniority, aantal, fase, risico, toelichting]
const CAPACITEIT = {
  'team-polis': [
    ['Functioneel beheerder', 'senior', 2, 'beheer_nazorg', 'ja', 'Enige rol met rechten om in productie mee te kijken bij een incident.'],
    ['Applicatiebeheerder legacy', 'senior', 1, 'beheer_nazorg', 'ja', 'Kent de opbouw van het polisregister uit de beginjaren; die kennis staat nergens vastgelegd.'],
    ['Ontwikkelaar', 'medior', 3, 'ontwikkeling_configuratie', 'nee', ''],
    ['Ontwikkelaar', 'junior', 1, 'ontwikkeling_configuratie', 'nee', ''],
    ['Tester', 'medior', 2, 'testen', 'nee', ''],
    ['Product owner', 'senior', 1, 'analyse_refinement', 'nee', ''],
  ],
  'team-upa': [
    ['Analist aangifteketen', 'senior', 1, 'analyse_refinement', 'ja', 'Enige die de volledige aangifteketen van werkgever tot verwerking overziet.'],
    ['Ontwikkelaar', 'medior', 3, 'ontwikkeling_configuratie', 'nee', ''],
    ['Tester', 'medior', 2, 'testen', 'nee', ''],
    ['Functioneel beheerder', 'senior', 1, 'beheer_nazorg', 'nee', ''],
    ['Product owner', 'senior', 1, 'analyse_refinement', 'nee', ''],
  ],
  'team-plm': [
    ['Functioneel beheerder', 'senior', 1, 'beheer_nazorg', 'ja', 'Enige die de inrichting van het productdossier in detail kent.'],
    ['Ontwikkelaar', 'medior', 4, 'ontwikkeling_configuratie', 'nee', ''],
    ['Tester', 'medior', 2, 'testen', 'nee', ''],
    ['Product owner', 'senior', 1, 'analyse_refinement', 'nee', ''],
  ],
  'team-wga': [
    ['Tester beslisregels', 'senior', 1, 'testen', 'ja', 'Enige die de beslisregels achter de uitkeringsberekening in detail kent.'],
    ['Ontwikkelaar', 'medior', 3, 'ontwikkeling_configuratie', 'nee', ''],
    ['Ontwikkelaar', 'junior', 2, 'ontwikkeling_configuratie', 'nee', ''],
    ['Functioneel beheerder', 'senior', 1, 'beheer_nazorg', 'nee', ''],
    ['Product owner', 'senior', 1, 'analyse_refinement', 'nee', ''],
  ],
  'team-cws': [
    ['Rapportagespecialist', 'senior', 1, 'ontwikkeling_configuratie', 'ja', 'Enige met kennis van de rapportagedefinities; de broncode zelf ligt bij de ontwikkelpartner.'],
    ['Ontwikkelaar', 'medior', 2, 'ontwikkeling_configuratie', 'nee', ''],
    ['Tester', 'medior', 1, 'testen', 'nee', ''],
    ['Product owner', 'senior', 1, 'analyse_refinement', 'nee', ''],
  ],
  'team-tet': [
    // De kern van de demo. Bewust als rol vastgelegd, met een feitelijke
    // toelichting en zonder enige persoonsaanduiding.
    ['Databasespecialist', 'senior', 1, 'ontwikkeling_configuratie', 'ja', 'Alle complexe query’s en structuurwijzigingen van de afdeling lopen via deze rol. Er is geen tweede medewerker die dit zelfstandig kan; het opbouwen van vergelijkbare kennis wordt geschat op meerdere jaren.'],
    ['Specialist koppelingen', 'senior', 2, 'ontwikkeling_configuratie', 'nee', ''],
    ['Ontwikkelaar', 'medior', 2, 'ontwikkeling_configuratie', 'nee', ''],
    ['Tester', 'medior', 1, 'testen', 'nee', ''],
  ],
}

// ---------------------------------------------------------------------------
// Applicatieverbindingen
// ---------------------------------------------------------------------------
const CONNECTIES = {
  'team-polis': [['polis-app-register', 'polis-app-koppel', ['Alle leveringen lopen via de koppelservice', 'Dagelijkse batch om 03:00']], ['polis-app-correctie', 'polis-app-register', ['Correcties schrijven terug op de poliskern']]],
  'team-upa': [['upa-app-portaal', 'upa-app-verwerking', ['Aangiftes komen binnen en worden daarna gecontroleerd']], ['upa-app-verwerking', 'upa-app-koppel', ['Levering aan de afnemende teams']]],
  'team-plm': [['plm-app-koppel', 'plm-app-dossier', ['Binnenkomende gegevens vullen het dossier']], ['plm-app-dossier', 'plm-app-dwh', ['Dossiergegevens gaan mee in de rapportagelaag']], ['plm-app-mutatie', 'plm-app-dossier', []]],
  'team-wga': [['wga-app-berekening', 'wga-app-beslis', ['Berekening voedt de beslisondersteuning']], ['wga-app-berekening', 'wga-app-dwh', []]],
  'team-cws': [['cws-app-dwh', 'cws-app-signalering', ['Signalering draait op de gegevens uit het datawarehouse']], ['cws-app-signalering', 'cws-app-rapportage', []]],
  'team-tet': [['tet-app-dwh', 'tet-app-koppel', ['Laadprocessen halen gegevens op via de koppelservice']], ['tet-app-querybib', 'tet-app-dwh', ['Query’s draaien rechtstreeks op het datawarehouse']]],
}

// ---------------------------------------------------------------------------
// Afhankelijkheden
// ---------------------------------------------------------------------------
// Compacte notatie: [categorie, titel, toelichting, impact, frequentie, status, extra?]
//
// extra kan bevatten:
//   naar  -> team-id of partij-id; maakt er een ketenafhankelijkheid van
//   app   -> applicatie-id; maakt er een applicatieflow-afhankelijkheid van
//   stap  -> workflowstap (alleen bij ontwikkelflow)
//   effect, wacht, opl, dl, dlt, actie, mit, oud, dicht
//
// Risicoberekening ter herinnering: impact x frequentie + statuscorrectie
// (actief blokkerend +2, gemitigeerd -2). Kritiek vraagt 17 of hoger, en dat
// kan alleen met zwaar x structureel x actief blokkerend. Daarom staat de
// TET-afhankelijkheid hieronder op Hoog en niet op Kritiek: hij is maximaal in
// impact en frequentie, en wordt alleen van Kritiek af gehouden doordat het nú
// nog goed gaat. Dat is geen tekortkoming van de data -- dat is het verhaal.
const DEPS = {
  'team-tet': [
    ['Kennis-concentratie', 'Complexe databasewijzigingen lopen via één rol',
      'Alle teams melden structuurwijzigingen en complexe query’s aan bij dezelfde rol. Er is geen tweede medewerker die dit werk zelfstandig kan doen. Het opbouwen van vergelijkbare kennis wordt door de specialisten zelf geschat op meerdere jaren; bij uitstroom is de vervangingstermijn een half jaar.',
      'zwaar', 'structureel', 'bekend risico', { stap: 'procesoverstijgend', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'organisatorisch', oud: 420 }],
    ['Kennis-concentratie', 'Geen overdrachtsproces voor de databasekennis',
      'Er is geen lopend traject om de kennis van de databaseopbouw over te dragen. Documentatie beperkt zich tot losse aantekeningen bij individuele wijzigingen.',
      'zwaar', 'structureel', 'bekend risico', { stap: 'procesoverstijgend', effect: 'onduidelijkheid', opl: 'organisatorisch', oud: 300 }],
    ['Technische afhankelijkheid', 'Laadprocessen datawarehouse zijn in de loop der jaren verweven geraakt',
      'De laadprocessen zijn stap voor stap uitgebreid; een wijziging in één proces raakt vaak onvoorzien een ander.', 'zwaar', 'regelmatig', 'bekend risico', { app: 'tet-app-dwh', effect: 'herwerk', oud: 260 }],
    ['Proces-/workflow-afhankelijkheid', 'Wijzigingsverzoeken komen zonder vaste vorm binnen', 'Teams leveren verzoeken aan per mail, in een ticket of mondeling; dat kost elke keer uitzoekwerk.', 'beperkt', 'structureel', 'bekend risico', { stap: 'analyse_refinement', effect: 'extra_afstemming', oud: 190 }],
    ['Rol-afhankelijkheid', 'Geen achtervang bij afwezigheid van de databasespecialist', 'Bij vakantie of ziekte schuift het werk van alle teams op; er is geen afgesproken alternatief.', 'zwaar', 'soms', 'bekend risico', { stap: 'procesoverstijgend', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'organisatorisch', oud: 240 }],
    ['Capaciteit specialistisch team', 'Vraag naar koppelwerk overstijgt de beschikbare capaciteit', 'Vijf teams doen tegelijk een beroep op dezelfde twee specialisten koppelingen.', 'duidelijk', 'structureel', 'actief blokkerend', { naar: 'party-inkoop', effect: 'wachten', wacht: 'sprint_of_meer', oud: 150 }],
    ['Technische afhankelijkheid', 'Querybibliotheek is niet getest', 'De verzameling complexe query’s heeft geen geautomatiseerde controle; fouten komen pas in productie aan het licht.', 'duidelijk', 'regelmatig', 'bekend risico', { app: 'tet-app-querybib', effect: 'herwerk', oud: 170 }],
    ['Data-afhankelijkheid', 'Structuurwijziging raakt alle afnemende teams tegelijk', 'Een wijziging in het datawarehouse moet met vijf teams worden afgestemd voordat hij door kan.', 'duidelijk', 'regelmatig', 'bekend risico', { app: 'tet-app-dwh', effect: 'extra_afstemming', oud: 130 }],
    ['Omgevingsafhankelijkheid', 'Testen van laadprocessen kan alleen in het weekend', 'De testomgeving is doordeweeks in gebruik voor ketentests van andere teams.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-omgevingen', stap: 'testen', effect: 'vertraging', oud: 110 }],
    ['Governance/proces-afhankelijkheid', 'Elke databasewijziging vraagt een aparte CAB-goedkeuring', 'Ook kleine, aantoonbaar risicoloze wijzigingen moeten de volledige procedure doorlopen.', 'beperkt', 'structureel', 'bekend risico', { naar: 'party-cab', stap: 'release_overdracht', effect: 'vertraging', wacht: 'dagen', oud: 200 }],
    ['Besluitvormingsafhankelijkheid', 'Besluit over herbouw van de laadlaag blijft uit', 'Het voorstel ligt sinds het voorjaar bij de stuurgroep; zonder besluit wordt er alleen onderhoud gepleegd.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-wetgeving', stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 220 }],
    ['Technische afhankelijkheid', 'Koppelservice draait op een verouderde versie', 'Upgrade vraagt aanpassingen bij alle vier de aansluitende teams.', 'duidelijk', 'soms', 'bekend risico', { app: 'tet-app-koppel', effect: 'vertraging', oud: 280 }],
    ['Kennis-afhankelijkheid extern', 'Ondersteuning op het legacyplatform loopt via de leverancier', 'Diepgaande vragen over het platform kunnen alleen bij de leverancier worden belegd.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-legacy', effect: 'wachten', wacht: 'dagen', oud: 95 }],
    ['Toegang/rechten-blokkade', 'Rechten op de productiedatabase zijn tot één rol beperkt', 'Onderzoek naar een productieprobleem kan alleen plaatsvinden als die rol beschikbaar is.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'party-autorisatie', effect: 'wachten', oud: 160 }],
    ['Proces-/workflow-afhankelijkheid', 'Prioritering tussen teams gebeurt ad hoc', 'Welk verzoek voorgaat, wordt per geval bepaald; teams weten niet waar ze aan toe zijn.', 'beperkt', 'structureel', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 140 }],
    ['Overig intern', 'Monitoring op de laadprocessen ontbreekt', 'Een mislukte laadrun wordt pas opgemerkt als een afnemer zich meldt.', 'duidelijk', 'soms', 'gemitigeerd', { app: 'tet-app-dwh', effect: 'vertraging', oud: 310, mit: 'Dagelijkse handmatige controle op de laadrapportage.' }],
    ['Data-afhankelijkheid', 'Historische gegevens zijn niet volledig herleidbaar', 'Van een deel van de oudere gegevens is niet vast te stellen uit welke bron ze komen.', 'beperkt', 'soms', 'bekend risico', { app: 'tet-app-dwh', effect: 'onduidelijkheid', oud: 350 }],
  ],

  'team-polis': [
    ['Capaciteit specialistisch team', 'Structuurwijziging polisregister wacht op TET',
      'Wijzigingen in de databasestructuur van het polisregister kunnen alleen door het technisch expertiseteam worden doorgevoerd. De doorlooptijd hangt af van de beschikbaarheid daar.',
      'zwaar', 'regelmatig', 'actief blokkerend', { naar: 'team-tet', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'team_overstijgend', oud: 24 }],
    ['Technische afhankelijkheid', 'Niemand overziet de koppelingen in het polisregister volledig',
      'Het polisregister is over twintig jaar uitgebouwd. Welke andere onderdelen door een wijziging geraakt worden, blijkt in de praktijk pas tijdens het testen.',
      'zwaar', 'structureel', 'bekend risico', { app: 'polis-app-register', effect: 'herwerk', oud: 400 }],
    ['Wetgevingsafhankelijkheid', 'Wetswijziging per 1 januari moet ad hoc worden ingebouwd',
      'De definitieve regeling komt laat beschikbaar, terwijl de ingangsdatum vastligt. Dat betekent elk jaar opnieuw inbouwen onder tijdsdruk.',
      'zwaar', 'regelmatig', 'actief blokkerend', { naar: 'party-wetgeving', stap: 'analyse_refinement', effect: 'niet_startklaar', dl: 'harde_deadline', dlt: '1 januari, wettelijke ingangsdatum', oud: 70 }],
    ['Rol-afhankelijkheid', 'Onderzoek van een productie-incident vraagt een functioneel beheerder',
      'Een tester mag niet in de acceptatieomgeving kijken om gedrag met productie te vergelijken; een functioneel beheerder mag dat wel. Bij een incident wacht het onderzoek dus op diens beschikbaarheid.',
      'zwaar', 'regelmatig', 'actief blokkerend', { stap: 'beheer_nazorg', effect: 'wachten', opl: 'organisatorisch', oud: 120 }],
    ['Data-afhankelijkheid', 'Terugmeldingen van WGA stapelen zich op', 'Gemelde onjuistheden worden handmatig verwerkt; bij piekdrukte loopt de voorraad op en werken afnemers door op oude gegevens.', 'zwaar', 'regelmatig', 'actief blokkerend', { naar: 'team-wga', app: 'polis-app-correctie', effect: 'herwerk', oud: 60 }],
    ['Kennis-concentratie', 'Kennis van de polisadministratie uit de beginjaren zit bij één rol', 'De opbouw van de oudste onderdelen staat nergens beschreven; bij vragen is er één aanspreekpunt.', 'zwaar', 'regelmatig', 'bekend risico', { stap: 'procesoverstijgend', effect: 'wachten', opl: 'organisatorisch', oud: 330 }],
    ['Data-afhankelijkheid', 'Aanlevering van brongegevens is wisselend van kwaliteit', 'Afwijkingen in de aangeleverde bestanden komen pas bij verwerking aan het licht.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'party-aanleveraar', app: 'polis-app-register', effect: 'herwerk', oud: 180 }],
    ['Governance/proces-afhankelijkheid', 'Oplevering kan pas na externe SSD-toetsing', 'Elke release moet langs een externe partij voor de beveiligingstoets; de doorlooptijd daarvan staat los van onze planning.', 'duidelijk', 'structureel', 'actief blokkerend', { naar: 'party-ssd', stap: 'release_overdracht', effect: 'vertraging', wacht: 'sprint_of_meer', oud: 230 }],
    ['Omgevingsafhankelijkheid', 'Acceptatieomgeving wordt gedeeld met UPA', 'Ketentests moeten worden ingepland rond het gebruik door het andere team.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'party-omgevingen', stap: 'acceptatie', effect: 'wachten', oud: 145 }],
    ['Technische afhankelijkheid', 'Dagelijkse batch heeft een vast en krap venster', 'Loopt de batch uit, dan schuift de levering aan drie teams een dag op.', 'duidelijk', 'soms', 'bekend risico', { app: 'polis-app-register', effect: 'vertraging', oud: 210 }],
    ['Besluitvormingsafhankelijkheid', 'Besluit over uitfaseren van de oude correctieroute blijft uit', 'Twee routes naast elkaar in de lucht houden kost structureel onderhoud.', 'beperkt', 'structureel', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 260 }],
    ['Toegang/rechten-blokkade', 'Aanvraag van rechten op een nieuwe omgeving duurt weken', 'Een nieuwe medewerker kan pas na enkele weken volledig meedraaien.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-autorisatie', effect: 'wachten', wacht: 'sprint_of_meer', oud: 100 }],
    ['Proces-/workflow-afhankelijkheid', 'Afstemming over leveringen gebeurt in drie losse overleggen', 'Dezelfde wijziging wordt op meerdere plekken besproken zonder dat er één besluit uitkomt.', 'beperkt', 'regelmatig', 'bekend risico', { stap: 'analyse_refinement', effect: 'extra_afstemming', oud: 125 }],
    ['Technische afhankelijkheid', 'Koppelservice is een gedeelde voorziening zonder eigen testomgeving', 'Een wijziging kan alleen samen met TET worden beproefd.', 'duidelijk', 'soms', 'bekend risico', { app: 'polis-app-koppel', effect: 'vertraging', oud: 155 }],
    ['Overig intern', 'Documentatie van de polisgegevens is verouderd', 'De beschrijving van de gegevensvelden komt niet meer overeen met de praktijk.', 'beperkt', 'structureel', 'bekend risico', { stap: 'procesoverstijgend', effect: 'onduidelijkheid', oud: 290 }],
    ['Data-afhankelijkheid', 'Correcties met terugwerkende kracht raken eerdere berekeningen', 'Een correctie over een afgesloten periode vraagt handwerk bij het afnemende team.', 'duidelijk', 'soms', 'bekend risico', { naar: 'team-wga', app: 'polis-app-correctie', effect: 'herwerk', oud: 175 }],
    ['Kennis-afhankelijkheid extern', 'Ondersteuning op het legacyplatform is contractueel beperkt', 'Buiten kantoortijden is er geen ondersteuning beschikbaar.', 'duidelijk', 'eenmalig', 'bekend risico', { naar: 'party-legacy', effect: 'wachten', oud: 320 }],
    ['Technische afhankelijkheid', 'Certificaten moeten handmatig vernieuwd worden', 'Verloopt een certificaat ongemerkt, dan valt de levering stil.', 'duidelijk', 'soms', 'gemitigeerd', { app: 'polis-app-koppel', effect: 'blokkade', mit: 'Agenda-herinnering zes weken voor verloop.', oud: 240 }],
    ['Omgevingsafhankelijkheid', 'Testdata bevat geen realistische uitzonderingen', 'Randgevallen komen pas in acceptatie naar boven.', 'duidelijk', 'regelmatig', 'bekend risico', { stap: 'testen', effect: 'herwerk', oud: 135 }],
    ['Proces-/workflow-afhankelijkheid', 'Handmatige controlestap voor elke levering', 'Een vaste controle voor het vrijgeven van de dagelijkse levering kost elke ochtend tijd.', 'beperkt', 'structureel', 'bekend risico', { stap: 'beheer_nazorg', effect: 'vertraging', oud: 115 }],
    ['Stakeholderafhankelijkheid', 'Afstemming met beleid over interpretatie van de regeling', 'Bij twijfel over de uitleg van een regel ligt het werk stil tot er antwoord is.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-wetgeving', stap: 'analyse_refinement', effect: 'wachten', wacht: 'dagen', oud: 90 }],
    ['Overig intern', 'Onboarding van een nieuwe ontwikkelaar duurt lang', 'Het duurt maanden voordat iemand zelfstandig aan de poliskern kan werken.', 'beperkt', 'soms', 'bekend risico', { stap: 'procesoverstijgend', effect: 'vertraging', oud: 270 }],
    ['Technische afhankelijkheid', 'Logging is te beperkt om een incident te reconstrueren', 'Bij een verstoring ontbreekt vaak het spoor om de oorzaak te vinden.', 'duidelijk', 'soms', 'bekend risico', { app: 'polis-app-register', effect: 'onduidelijkheid', oud: 185 }],
    ['Contract-/inkoopafhankelijkheid', 'Uitbreiding van de licentie vraagt een inkooptraject', 'Extra verwerkingscapaciteit kan niet op korte termijn worden geregeld.', 'beperkt', 'eenmalig', 'bekend risico', { naar: 'party-inkoop', effect: 'vertraging', oud: 250 }],
  ],

  'team-upa': [
    ['Capaciteit specialistisch team', 'Complexe controles op aangiftes lopen via TET', 'Controles over meerdere jaren heen vragen een query die alleen het expertiseteam kan maken.', 'zwaar', 'regelmatig', 'bekend risico', { naar: 'team-tet', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'team_overstijgend', oud: 19 }],
    ['Data-afhankelijkheid', 'Aangiftes komen in wisselende kwaliteit binnen', 'Werkgevers leveren aan in uiteenlopende vormen; afwijkingen vragen handmatige nabewerking.', 'zwaar', 'structureel', 'bekend risico', { naar: 'party-aanleveraar', app: 'upa-app-portaal', effect: 'herwerk', oud: 300 }],
    ['Wetgevingsafhankelijkheid', 'Jaarlijkse wijziging van de aangiftespecificatie', 'De specificatie verandert elk jaar; de doorlooptijd om die in te bouwen is krap.', 'zwaar', 'soms', 'actief blokkerend', { naar: 'party-wetgeving', stap: 'ontwikkeling_configuratie', effect: 'niet_startklaar', dl: 'harde_deadline', dlt: '1 januari, nieuwe specificatie', oud: 65 }],
    ['Omgevingsafhankelijkheid', 'Acceptatieomgeving gedeeld met Polis', 'Ketentests kunnen alleen op afgesproken momenten; buiten die momenten is de omgeving bezet.', 'duidelijk', 'regelmatig', 'actief blokkerend', { naar: 'party-omgevingen', stap: 'acceptatie', effect: 'wachten', oud: 105 }],
    ['Kennis-concentratie', 'Overzicht van de aangifteketen zit bij één rol', 'Eén analist overziet de keten van werkgever tot verwerking; bij afwezigheid blijven vragen liggen.', 'zwaar', 'regelmatig', 'bekend risico', { stap: 'analyse_refinement', effect: 'wachten', opl: 'organisatorisch', oud: 275 }],
    ['Governance/proces-afhankelijkheid', 'Oplevering kan pas na externe SSD-toetsing', 'De beveiligingstoets ligt buiten de afdeling en bepaalt mede de opleverdatum.', 'duidelijk', 'structureel', 'actief blokkerend', { naar: 'party-ssd', stap: 'release_overdracht', effect: 'vertraging', wacht: 'sprint_of_meer', oud: 215 }],
    ['Technische afhankelijkheid', 'Portaal en verwerking delen een verouderde koppeling', 'De koppeling tussen de twee applicaties is nooit vernieuwd en is lastig te wijzigen.', 'duidelijk', 'regelmatig', 'bekend risico', { app: 'upa-app-portaal', effect: 'herwerk', oud: 195 }],
    ['Proces-/workflow-afhankelijkheid', 'Piekbelasting rond de aanleverdeadline', 'In de week van de deadline verdringt het reguliere werk alles wat gepland stond.', 'duidelijk', 'regelmatig', 'bekend risico', { stap: 'procesoverstijgend', effect: 'contextswitch', oud: 160 }],
    ['Data-afhankelijkheid', 'Kwaliteitssignalen van CWS komen laat terug', 'Signalen over onjuiste verwerking bereiken ons pas na het rapportagemoment.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'team-cws', effect: 'herwerk', oud: 75 }],
    ['Toegang/rechten-blokkade', 'Inzien van aangeleverde bestanden vraagt aparte rechten', 'Niet iedereen in het team kan bij de aangeleverde bestanden om een melding te onderzoeken.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-autorisatie', effect: 'wachten', oud: 140 }],
    ['Technische afhankelijkheid', 'Verwerking is niet opnieuw startbaar na een fout', 'Een afgebroken verwerking moet in zijn geheel opnieuw, ook als het grootste deel goed ging.', 'duidelijk', 'soms', 'bekend risico', { app: 'upa-app-verwerking', effect: 'herwerk', oud: 225 }],
    ['Besluitvormingsafhankelijkheid', 'Besluit over strengere ingangscontrole blijft uit', 'Zonder besluit blijven afwijkende aanleveringen binnenkomen en handwerk opleveren.', 'duidelijk', 'structureel', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 170 }],
    ['Overig intern', 'Testdata voor de aangifteketen is verouderd', 'De testset weerspiegelt de huidige specificatie niet meer.', 'beperkt', 'regelmatig', 'bekend risico', { stap: 'testen', effect: 'herwerk', oud: 130 }],
    ['Stakeholderafhankelijkheid', 'Communicatie naar werkgevers loopt via een andere afdeling', 'Een wijziging in de aanlevering kan pas ingaan als die afdeling erover gecommuniceerd heeft.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-wetgeving', effect: 'wachten', wacht: 'sprint_of_meer', oud: 110 }],
    ['Technische afhankelijkheid', 'Koppelservice is gedeeld en kent geen eigen testmoment', 'Wijzigingen moeten met TET worden ingepland.', 'beperkt', 'soms', 'bekend risico', { app: 'upa-app-koppel', effect: 'vertraging', oud: 190 }],
    ['Omgevingsafhankelijkheid', 'Performancetesten kan alleen buiten kantoortijd', 'De omgeving is overdag in gebruik voor functionele tests.', 'beperkt', 'soms', 'bekend risico', { naar: 'party-omgevingen', stap: 'testen', effect: 'vertraging', oud: 205 }],
    ['Overig intern', 'Handmatige nabewerking van afgekeurde aangiftes', 'Afgekeurde aangiftes worden met de hand hersteld; dat kost elke maand dagen.', 'duidelijk', 'structureel', 'gemitigeerd', { stap: 'beheer_nazorg', effect: 'vertraging', mit: 'Vaste bezetting van twee dagdelen per week ingeruimd.', oud: 235 }],
    ['Governance/proces-afhankelijkheid', 'CAB-goedkeuring voor elke aanpassing aan het portaal', 'Ook kleine aanpassingen doorlopen de volledige procedure.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-cab', stap: 'release_overdracht', effect: 'vertraging', oud: 150 }],
    ['Contract-/inkoopafhankelijkheid', 'Ondersteuning op het aanleverportaal is afgekocht per jaar', 'Extra ondersteuning buiten het contract vraagt een nieuw inkooptraject.', 'beperkt', 'eenmalig', 'bekend risico', { naar: 'party-inkoop', effect: 'vertraging', oud: 255 }],
  ],

  'team-plm': [
    ['Capaciteit specialistisch team', 'Databasewijziging productdossier kan alleen door TET', 'Structuurwijzigingen aan het dossier worden door het expertiseteam uitgevoerd; wij kunnen ze niet zelf doorvoeren.', 'zwaar', 'regelmatig', 'actief blokkerend', { naar: 'team-tet', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'team_overstijgend', oud: 11 }],
    ['Governance/proces-afhankelijkheid', 'Oplevering ligt stil tot de externe SSD-toetsing rond is',
      'Elke release moet langs een externe partij voor de beveiligingstoets. Die partij valt buiten onze planning en de doorlooptijd is per keer verschillend; het team kan in die periode niet opleveren.',
      'zwaar', 'structureel', 'actief blokkerend', { naar: 'party-ssd', stap: 'release_overdracht', effect: 'blokkade', wacht: 'sprint_of_meer', opl: 'organisatorisch', oud: 14 }],
    ['Data-afhankelijkheid', 'Dossier kan pas worden opgebouwd als beide bronnen geleverd hebben', 'Ontbreekt één van de twee leveringen, dan blijft het dossier onvolledig en moet het later opnieuw.', 'zwaar', 'regelmatig', 'bekend risico', { naar: 'team-polis', app: 'plm-app-dossier', effect: 'wachten', oud: 95 }],
    ['Technische afhankelijkheid', 'Mutatieverwerking en dossierbeheer zijn sterk verweven', 'Een wijziging in de mutatieverwerking heeft vaak gevolgen voor het dossier die vooraf niet te overzien zijn.', 'duidelijk', 'structureel', 'bekend risico', { app: 'plm-app-mutatie', effect: 'herwerk', oud: 285 }],
    ['Kennis-concentratie', 'Inrichting van het productdossier zit bij één rol', 'De keuzes achter de inrichting staan niet beschreven; bij vragen is er één aanspreekpunt.', 'zwaar', 'regelmatig', 'bekend risico', { stap: 'procesoverstijgend', effect: 'wachten', opl: 'organisatorisch', oud: 265 }],
    ['Omgevingsafhankelijkheid', 'Ketentest vraagt alle drie de omgevingen tegelijk', 'Een volledige ketentest kan alleen als Polis, UPA en wij tegelijk beschikbaar zijn.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-omgevingen', stap: 'acceptatie', effect: 'extra_afstemming', oud: 120 }],
    ['Toegang/rechten-blokkade', 'Tester kan dossiergegevens in acceptatie niet inzien', 'Het vergelijken van gedrag tussen acceptatie en productie vraagt rechten die de tester niet heeft.', 'duidelijk', 'regelmatig', 'actief blokkerend', { naar: 'party-autorisatie', stap: 'testen', effect: 'wachten', oud: 88 }],
    ['Data-afhankelijkheid', 'Levering van UPA loopt achter bij piekdrukte', 'Rond de aanleverdeadline komt de levering later binnen dan afgesproken.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'team-upa', effect: 'wachten', oud: 100 }],
    ['Proces-/workflow-afhankelijkheid', 'Definitie van een volledig dossier verschilt per afnemer', 'Wat als compleet geldt, wordt door CWS anders uitgelegd dan door ons.', 'duidelijk', 'regelmatig', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 165 }],
    ['Technische afhankelijkheid', 'Dossierbeheer schrijft rechtstreeks in het datawarehouse', 'Een structuurwijziging daar raakt ons direct, zonder tussenlaag die dat opvangt.', 'duidelijk', 'soms', 'bekend risico', { app: 'plm-app-dwh', effect: 'herwerk', oud: 180 }],
    ['Besluitvormingsafhankelijkheid', 'Besluit over het samenvoegen van de twee applicaties blijft uit', 'Zolang dat besluit uitblijft, wordt dubbel onderhoud gepleegd.', 'duidelijk', 'structureel', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 245 }],
    ['Governance/proces-afhankelijkheid', 'CAB vraagt een impactanalyse bij elke dossierwijziging', 'Het opstellen van die analyse kost per wijziging een dag.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-cab', stap: 'release_overdracht', effect: 'vertraging', oud: 135 }],
    ['Overig intern', 'Geen geautomatiseerde regressietest op het dossier', 'Fouten in bestaande functionaliteit komen pas bij de handmatige test naar boven.', 'duidelijk', 'regelmatig', 'bekend risico', { stap: 'testen', effect: 'herwerk', oud: 200 }],
    ['Rol-afhankelijkheid', 'Vrijgave naar productie vraagt een beheerder van buiten het team', 'Het team mag niet zelf naar productie; dat loopt via een beheerrol elders.', 'duidelijk', 'structureel', 'bekend risico', { stap: 'release_overdracht', effect: 'wachten', wacht: 'dagen', opl: 'organisatorisch', oud: 155 }],
    ['Omgevingsafhankelijkheid', 'Testdata wordt maar eens per maand ververst', 'Tussen twee verversingen in werkt het team met verouderde gegevens.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-omgevingen', stap: 'testen', effect: 'herwerk', oud: 145 }],
    ['Stakeholderafhankelijkheid', 'Afstemming met CWS over de rapportagebehoefte', 'Wat er in de rapportage moet, wordt pas duidelijk als het dossier al gebouwd is.', 'beperkt', 'soms', 'bekend risico', { naar: 'team-cws', stap: 'analyse_refinement', effect: 'extra_afstemming', oud: 115 }],
    ['Technische afhankelijkheid', 'Koppelservice kent geen terugmelding bij mislukte levering', 'Een mislukte levering wordt pas opgemerkt als de afnemer zich meldt.', 'duidelijk', 'soms', 'bekend risico', { app: 'plm-app-koppel', effect: 'vertraging', oud: 210 }],
    ['Overig intern', 'Documentatie loopt achter op de inrichting', 'De beschrijving van het dossier is al een jaar niet bijgewerkt.', 'beperkt', 'structureel', 'bekend risico', { stap: 'procesoverstijgend', effect: 'onduidelijkheid', oud: 295 }],
    ['Contract-/inkoopafhankelijkheid', 'Verlenging van de onderhoudsafspraak loopt via inkoop', 'Zonder tijdige verlenging vervalt de ondersteuning op de mutatieverwerking.', 'duidelijk', 'eenmalig', 'bekend risico', { naar: 'party-inkoop', effect: 'vertraging', dl: 'vaste_datum', dlt: 'Einde contractjaar', oud: 220 }],
    ['Data-afhankelijkheid', 'Herstel van een foutieve levering vraagt handwerk', 'Een onjuiste levering moet handmatig worden teruggedraaid voordat opnieuw kan worden ingelezen.', 'duidelijk', 'soms', 'gemitigeerd', { app: 'plm-app-dossier', effect: 'herwerk', mit: 'Herstelscript beschikbaar, maar alleen uit te voeren door TET.', oud: 175 }],
  ],

  'team-wga': [
    ['Capaciteit specialistisch team', 'Herberekening van uitkeringen vraagt een query van TET',
      'Een herberekening over een langere periode vraagt een complexe query. Die kan alleen door het technisch expertiseteam worden gemaakt; het team kan dit niet zelf.',
      'zwaar', 'regelmatig', 'actief blokkerend', { naar: 'team-tet', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'team_overstijgend', oud: 16 }],
    ['Toegang/rechten-blokkade', 'Tester kan acceptatie niet vergelijken met productie',
      'Om te onderzoeken waarom een bevinding zich voordoet, moet gedrag in acceptatie naast productie gelegd worden. De tester heeft die rechten niet; een functioneel beheerder wel. Het onderzoek wacht dus op diens beschikbaarheid, ook bij een productieverstoring.',
      'zwaar', 'regelmatig', 'actief blokkerend', { naar: 'party-autorisatie', stap: 'testen', effect: 'wachten', opl: 'organisatorisch', oud: 9 }],
    ['Data-afhankelijkheid', 'Correctie van polisgegevens blijft uit',
      'Bij de berekening geconstateerde onjuistheden worden teruggemeld aan Polis. Zolang de correctie uitblijft, wordt doorgerekend op gegevens waarvan bekend is dat ze niet kloppen.',
      'zwaar', 'structureel', 'actief blokkerend', { naar: 'team-polis', app: 'wga-app-berekening', effect: 'herwerk', oud: 21 }],
    ['Kennis-concentratie', 'Beslisregels zijn maar bij één rol volledig bekend', 'De regels achter de uitkeringsberekening zijn deels niet vastgelegd; bij twijfel is er één aanspreekpunt.', 'zwaar', 'structureel', 'bekend risico', { stap: 'procesoverstijgend', effect: 'wachten', opl: 'organisatorisch', oud: 310 }],
    ['Wetgevingsafhankelijkheid', 'Wijziging in de regeling raakt de berekening met terugwerkende kracht', 'Een aanpassing met terugwerkende kracht betekent herberekenen van lopende gevallen.', 'zwaar', 'soms', 'actief blokkerend', { naar: 'party-wetgeving', stap: 'ontwikkeling_configuratie', effect: 'herwerk', dl: 'harde_deadline', dlt: 'Ingangsdatum van de regelingswijziging', oud: 62 }],
    ['Technische afhankelijkheid', 'Berekening en beslisondersteuning delen dezelfde regelset', 'Een wijziging aan één kant werkt ongemerkt door naar de andere.', 'duidelijk', 'structureel', 'bekend risico', { app: 'wga-app-berekening', effect: 'herwerk', oud: 230 }],
    ['Governance/proces-afhankelijkheid', 'Oplevering kan pas na externe SSD-toetsing', 'De beveiligingstoets buiten de afdeling bepaalt mede wanneer er opgeleverd kan worden.', 'duidelijk', 'structureel', 'actief blokkerend', { naar: 'party-ssd', stap: 'release_overdracht', effect: 'vertraging', wacht: 'sprint_of_meer', oud: 190 }],
    ['Data-afhankelijkheid', 'Aangiftegegevens komen in een ander ritme dan polisgegevens', 'De twee leveringen lopen niet gelijk; dat vraagt elke keer afstemming over welk moment leidend is.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'team-upa', effect: 'extra_afstemming', oud: 125 }],
    ['Rol-afhankelijkheid', 'Beoordeling van een uitzonderingsgeval vraagt een senior', 'Juniors kunnen uitzonderingen niet zelfstandig afhandelen; die blijven liggen tot er een senior tijd heeft.', 'duidelijk', 'structureel', 'bekend risico', { stap: 'beheer_nazorg', effect: 'wachten', oud: 150 }],
    ['Omgevingsafhankelijkheid', 'Herberekeningen kunnen alleen buiten kantoortijd worden getest', 'Een testrun legt beslag op de omgeving die overdag nodig is.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-omgevingen', stap: 'testen', effect: 'vertraging', oud: 140 }],
    ['Technische afhankelijkheid', 'Berekening schrijft rechtstreeks naar het datawarehouse', 'Een structuurwijziging daar raakt de berekening meteen.', 'duidelijk', 'soms', 'bekend risico', { app: 'wga-app-dwh', effect: 'herwerk', oud: 205 }],
    ['Besluitvormingsafhankelijkheid', 'Besluit over vastleggen van de beslisregels blijft uit', 'Het voorstel om de regels formeel vast te leggen ligt al maanden bij het management.', 'zwaar', 'soms', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', opl: 'organisatorisch', oud: 240 }],
    ['Proces-/workflow-afhankelijkheid', 'Bevindingen uit de keten komen via drie kanalen binnen', 'Meldingen komen per mail, via de servicedesk en rechtstreeks; dubbele meldingen zijn gewoon.', 'beperkt', 'structureel', 'bekend risico', { stap: 'beheer_nazorg', effect: 'contextswitch', oud: 160 }],
    ['Overig intern', 'Geen geautomatiseerde controle op de rekenuitkomsten', 'Een afwijking in de uitkomst wordt pas bij steekproef opgemerkt.', 'zwaar', 'soms', 'bekend risico', { stap: 'testen', effect: 'herwerk', oud: 215 }],
    ['Toegang/rechten-blokkade', 'Inzage in historische berekeningen vraagt aparte rechten', 'Bij een bezwaar moet een eerdere berekening worden opgezocht; niet iedereen kan daarbij.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-autorisatie', effect: 'wachten', oud: 118 }],
    ['Governance/proces-afhankelijkheid', 'CAB-goedkeuring nodig bij elke wijziging aan de berekening', 'De procedure is dezelfde, ongeacht de omvang van de wijziging.', 'beperkt', 'regelmatig', 'bekend risico', { naar: 'party-cab', stap: 'release_overdracht', effect: 'vertraging', oud: 170 }],
    ['Stakeholderafhankelijkheid', 'Toezichthouder vraagt verantwoording over de rekenwijze', 'Bij een vraag van de toezichthouder moet de rekenwijze herleidbaar worden onderbouwd.', 'duidelijk', 'eenmalig', 'bekend risico', { naar: 'party-toezicht', effect: 'extra_afstemming', oud: 185 }],
    ['Overig intern', 'Onboarding van juniors kost veel seniortijd', 'Twee juniors vragen structureel begeleiding van de seniors in het team.', 'beperkt', 'structureel', 'bekend risico', { stap: 'procesoverstijgend', effect: 'contextswitch', oud: 195 }],
    ['Data-afhankelijkheid', 'Terugmelding kent geen bevestiging van ontvangst', 'Na een terugmelding is onbekend of en wanneer die wordt opgepakt.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'team-polis', effect: 'onduidelijkheid', oud: 72 }],
    ['Technische afhankelijkheid', 'Beslisondersteuning draait op een verouderde regelmotor', 'Nieuwe regels vragen omwegen omdat de motor ze niet rechtstreeks ondersteunt.', 'duidelijk', 'regelmatig', 'bekend risico', { app: 'wga-app-beslis', effect: 'herwerk', oud: 260 }],
    ['Omgevingsafhankelijkheid', 'Geen omgeving om een volledige jaarovergang te beproeven', 'De jaarovergang kan alleen in productie worden vastgesteld.', 'zwaar', 'eenmalig', 'bekend risico', { naar: 'party-omgevingen', stap: 'acceptatie', effect: 'niet_startklaar', oud: 225 }],
    ['Contract-/inkoopafhankelijkheid', 'Ondersteuning op de regelmotor loopt af', 'Na afloop van het contract is er geen leveranciersondersteuning meer.', 'duidelijk', 'eenmalig', 'bekend risico', { naar: 'party-inkoop', effect: 'onduidelijkheid', dl: 'vaste_datum', dlt: 'Einde contractperiode', oud: 250 }],
  ],

  'team-cws': [
    ['Capaciteit specialistisch team', 'Rapportagequery’s over meerdere bronnen lopen via TET', 'Een rapportage die bronnen combineert, vraagt een query die alleen het expertiseteam kan maken.', 'zwaar', 'structureel', 'bekend risico', { naar: 'team-tet', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'team_overstijgend', oud: 27 }],
    ['Contract-/inkoopafhankelijkheid', 'Broncode van de rapportagegenerator ligt bij de ontwikkelpartner',
      'De broncode is geen eigendom van de organisatie zelf. Elke aanpassing, ook een kleine, moet bij de externe partij worden belegd en afgewacht; zelf iets wijzigen kan niet.',
      'zwaar', 'structureel', 'bekend risico', { naar: 'party-ontwikkelpartner', app: 'cws-app-rapportage', effect: 'wachten', wacht: 'sprint_of_meer', opl: 'organisatorisch', oud: 340 }],
    ['Data-afhankelijkheid', 'Rapportage kan pas als alle drie de leveringen binnen zijn', 'Ontbreekt één levering, dan is de rapportage onvolledig en moet hij later opnieuw.', 'zwaar', 'regelmatig', 'bekend risico', { naar: 'team-plm', app: 'cws-app-rapportage', effect: 'wachten', oud: 92 }],
    ['Kennis-concentratie', 'Rapportagedefinities zijn bij één rol bekend', 'Wat een cijfer precies betekent, is niet vastgelegd; bij twijfel is er één aanspreekpunt.', 'zwaar', 'regelmatig', 'bekend risico', { stap: 'procesoverstijgend', effect: 'onduidelijkheid', opl: 'organisatorisch', oud: 280 }],
    ['Stakeholderafhankelijkheid', 'Toezichthouder vraagt de verantwoording op een vast moment', 'De aanlevering kent een vaste datum; vertraging eerder in de keten komt hier samen.', 'zwaar', 'soms', 'actief blokkerend', { naar: 'party-toezicht', effect: 'niet_startklaar', dl: 'harde_deadline', dlt: 'Kwartaalaanlevering toezichthouder', oud: 35 }],
    ['Governance/proces-afhankelijkheid', 'Oplevering kan pas na externe SSD-toetsing', 'De beveiligingstoets ligt buiten de afdeling en bepaalt mede de opleverdatum.', 'duidelijk', 'structureel', 'actief blokkerend', { naar: 'party-ssd', stap: 'release_overdracht', effect: 'vertraging', wacht: 'sprint_of_meer', oud: 198 }],
    ['Technische afhankelijkheid', 'Signalering draait op een nachtelijke kopie van het datawarehouse', 'Signalen lopen daardoor altijd een dag achter op de werkelijkheid.', 'duidelijk', 'structureel', 'bekend risico', { app: 'cws-app-dwh', effect: 'vertraging', oud: 165 }],
    ['Data-afhankelijkheid', 'Kwaliteitssignalen worden niet altijd opgepakt', 'Teruggemelde signalen leiden niet altijd tot een correctie; dezelfde afwijking komt maanden later terug.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'team-upa', effect: 'herwerk', oud: 78 }],
    ['Toegang/rechten-blokkade', 'Inzage in brongegevens is beperkt tot enkele rollen', 'Onderzoek naar een afwijkend signaal kan niet door iedereen worden gedaan.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'party-autorisatie', effect: 'wachten', oud: 128 }],
    ['Kennis-afhankelijkheid extern', 'Kennis van de rapportagegenerator zit bij de ontwikkelpartner', 'Hoe de generator intern werkt, is binnen de organisatie niet bekend.', 'zwaar', 'regelmatig', 'bekend risico', { naar: 'party-ontwikkelpartner', effect: 'wachten', wacht: 'sprint_of_meer', oud: 300 }],
    ['Besluitvormingsafhankelijkheid', 'Besluit over het terughalen van de broncode blijft uit', 'Het voorstel om de broncode in eigen beheer te nemen ligt al langere tijd stil.', 'zwaar', 'soms', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', opl: 'organisatorisch', oud: 255 }],
    ['Proces-/workflow-afhankelijkheid', 'Definitie van een signaal verschilt per afnemer', 'Wat als afwijking geldt, wordt per team anders uitgelegd.', 'beperkt', 'regelmatig', 'bekend risico', { stap: 'analyse_refinement', effect: 'onduidelijkheid', oud: 148 }],
    ['Omgevingsafhankelijkheid', 'Rapportages kunnen niet met echte volumes getest worden', 'De testomgeving bevat te weinig gegevens om de doorlooptijd te beoordelen.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-omgevingen', stap: 'testen', effect: 'onduidelijkheid', oud: 212 }],
    ['Technische afhankelijkheid', 'Signalering en rapportage delen dezelfde definities', 'Een wijziging aan een definitie werkt ongemerkt door in beide.', 'duidelijk', 'soms', 'bekend risico', { app: 'cws-app-signalering', effect: 'herwerk', oud: 188 }],
    ['Overig intern', 'Handmatige controle voor elke verzending aan de toezichthouder', 'Voor de verzending wordt de rapportage met de hand nagelopen; dat kost elke keer een dag.', 'duidelijk', 'regelmatig', 'gemitigeerd', { stap: 'beheer_nazorg', effect: 'vertraging', mit: 'Vaste checklist en twee personen ingeroosterd.', oud: 158 }],
    ['Governance/proces-afhankelijkheid', 'Wijziging in de rapportage vraagt akkoord van drie partijen', 'Beleid, toezicht en de afdeling moeten alle drie instemmen.', 'duidelijk', 'soms', 'bekend risico', { naar: 'party-cab', effect: 'extra_afstemming', wacht: 'sprint_of_meer', oud: 178 }],
    ['Overig intern', 'Geen versiebeheer op de rapportagedefinities', 'Welke definitie bij een eerdere rapportage hoorde, is achteraf niet vast te stellen.', 'duidelijk', 'soms', 'bekend risico', { stap: 'procesoverstijgend', effect: 'onduidelijkheid', oud: 268 }],
    ['Contract-/inkoopafhankelijkheid', 'Elke wijziging bij de ontwikkelpartner vraagt een opdracht', 'Ook een kleine aanpassing doorloopt het volledige opdrachttraject.', 'duidelijk', 'regelmatig', 'bekend risico', { naar: 'party-inkoop', effect: 'vertraging', wacht: 'sprint_of_meer', oud: 232 }],
  ],
}

// ---------------------------------------------------------------------------
// Opbouw
// ---------------------------------------------------------------------------
const PARTIJ_IDS = new Set(PARTIJEN.map((p) => p[0]))

function bouwDependencies() {
  const uit = []
  for (const [teamId, rijen] of Object.entries(DEPS)) {
    const prefix = teamId.replace('team-', '')
    rijen.forEach((rij, i) => {
      const [categorie, titel, toelichting, impact, frequentie, status, extra = {}] = rij
      const naarPartij = extra.naar && PARTIJ_IDS.has(extra.naar)
      const naarTeam = extra.naar && !naarPartij
      const scope = extra.naar ? 'extern' : 'intern'
      const flowtype = extra.app ? 'applicatieflow' : 'ontwikkelflow'
      const ouderdom = extra.oud ?? 120
      // Ongeveer een derde is langer dan 90 dagen niet aangeraakt -- dat cijfer
      // staat in de analyse en moet een eerlijk beeld geven van een kaart die
      // niet door iedereen wordt bijgehouden.
      const bijgewerkt = i % 3 === 0 ? Math.min(ouderdom, 95 + (i % 7) * 20) : Math.max(2, Math.floor(ouderdom / 4))
      uit.push({
        id: `${prefix}-dep-${String(i + 1).padStart(2, '0')}`,
        teamId,
        scope,
        flowtype,
        workflowStap: flowtype === 'ontwikkelflow' ? (extra.stap ?? 'procesoverstijgend') : null,
        applicatieIds: extra.app ? [extra.app] : [],
        categorie,
        titel,
        toelichting,
        impact,
        frequentie,
        status,
        geraaktTeamId: naarTeam ? extra.naar : null,
        geraaktPartijId: naarPartij ? extra.naar : null,
        geraakte_team_extern: naarPartij ? (PARTIJEN.find((p) => p[0] === extra.naar)?.[1] ?? '') : '',
        effectOpFlow: extra.effect ?? 'wachten',
        wachttijd: extra.wacht ?? 'kort',
        deadline: extra.dl ?? 'geen_datum',
        deadlineTekst: extra.dlt ?? '',
        oplosbaarheid: extra.opl ?? 'meerdere_teams',
        actieAfspraak: extra.actie ?? '',
        mitigatie: extra.mit ?? '',
        geaccepteerd: false,
        aangemaakt_op: dag(ouderdom),
        laatst_bijgewerkt: dag(bijgewerkt),
        gesloten_op: extra.dicht ? dag(extra.dicht) : null,
        historie: [],
      })
    })
  }
  // Een kaart waarop nooit iets wordt afgesloten is niet geloofwaardig, en de
  // analyse rekent met "gesloten in de laatste 90 dagen". Daarom sluiten we de
  // lichtste records af -- nooit de eerste drie van een team, want dat zijn de
  // records die in de demo opengeklikt worden.
  const kandidaten = uit.filter((d, i) => {
    const eigenIndex = Number(d.id.slice(-2))
    return eigenIndex > 3 && (d.impact === 'beperkt' || d.impact === 'klein') && d.status !== 'actief blokkerend'
  })
  kandidaten.filter((_, i) => i % 2 === 0).slice(0, 14).forEach((d, i) => {
    d.gesloten_op = dag(8 + i * 6)
    d.laatst_bijgewerkt = d.gesloten_op
  })

  return uit
}

function bouwTeamWorkflows() {
  const wf = {}
  for (const [teamId] of TEAMS) {
    const apps = (APPS[teamId] ?? []).map(([id, naam]) => ({ id, naam }))
    const details = {}
    for (const [id, , risico, toelichting] of APPS[teamId] ?? []) {
      details[id] = { toelichting, risico_bij_uitval: risico, risico_toelichting: risico === 'ja' ? toelichting : '' }
    }
    const connecties = (CONNECTIES[teamId] ?? []).map(([van, naar, punten], i) => ({ id: `${teamId}-conn-${i + 1}`, van, naar, punten: punten ?? [] }))

    const outputs = (OUTPUTS[teamId] ?? []).map(([id, label, applicatieId]) => ({
      id,
      label,
      flowtype: applicatieId ? 'applicatieflow' : 'ontwikkelflow',
      bron_type: 'team',
      applicatieId: applicatieId ?? '',
      linkedTeam: '',
      linkedOutputId: '',
      linkedInputId: '',
      externalTeam: '',
      externalPartyId: '',
      punten: [],
      linkStatus: '',
      linkNieuw: false,
      linkVoorgesteldOp: '',
      linkBesluitOp: '',
    }))

    const inputs = (INPUTS[teamId] ?? []).map(([id, label, bron, bronOutputId, applicatieId]) => {
      const isPartij = typeof bron === 'string' && bron.startsWith('partij:')
      return {
        id,
        label,
        flowtype: applicatieId ? 'applicatieflow' : 'ontwikkelflow',
        bron_type: isPartij ? 'systeem' : 'team',
        applicatieId: applicatieId ?? '',
        linkedTeam: isPartij || !bron ? '' : bron,
        linkedOutputId: bronOutputId ?? '',
        linkedInputId: '',
        externalTeam: '',
        externalPartyId: isPartij ? bron.slice('partij:'.length) : '',
        punten: [],
        // Bestaande ketenkoppelingen gelden als geaccepteerd; de twee open
        // verzoeken staan verderop apart.
        linkStatus: !isPartij && bron ? 'geaccepteerd' : '',
        linkNieuw: false,
        linkVoorgesteldOp: !isPartij && bron ? dag(200) : '',
        linkBesluitOp: !isPartij && bron ? dag(193) : '',
      }
    })

    wf[teamId] = {
      applications: apps,
      capacity: (CAPACITEIT[teamId] ?? []).map(([rol, seniority, aantal, fase, risico, toel], i) => ({
        id: `${teamId}-cap-${i + 1}`,
        rol,
        seniority,
        aantal,
        fase,
        risico_bij_uitval: risico,
        risico_toelichting: toel,
      })),
      inputs,
      outputs,
      layout: {},
      annotations: [],
      annotationEdges: [],
      applicatieflow: { connecties, details, layout: {} },
      stageNotes: {},
    }
  }

  // De twee koppelingen die nog op akkoord wachten.
  for (const [vanTeam, outputId, naarTeam, naarInputId, label, dagenGeleden] of VOORSTELLEN) {
    const output = wf[vanTeam].outputs.find((o) => o.id === outputId)
    if (!output) continue
    output.linkedTeam = naarTeam
    output.linkedInputId = naarInputId
    output.linkNieuw = !naarInputId
    output.linkStatus = 'voorgesteld'
    output.linkVoorgesteldOp = dag(dagenGeleden)
    output.punten = [`Voorgesteld als nieuwe levering: ${label}`]
  }

  return wf
}

function bouwChangeLog(dependencies) {
  const log = []
  dependencies.forEach((dep, i) => {
    const dagenGeleden = Math.round((PEILDATUM - new Date(dep.aangemaakt_op)) / 86400000)
    log.push({
      id: `log-dep-${i + 1}`,
      timestamp: stempel(dagenGeleden, 8 + (i % 8)),
      teamId: dep.teamId,
      type: 'dependency_created',
      dependencyId: dep.id,
      duplicateOfId: null,
      titel: dep.titel,
      details: null,
      // Vrijwel alles is al beoordeeld; twee blijven open zodat de wachtrij
      // tijdens de demo niet leeg is.
      status: i < 2 ? 'pending' : 'approved',
    })
  })

  // Wat bijwerkingen en afsluitingen, zodat de trendgrafieken niet vlak zijn.
  const bijgewerkt = dependencies.filter((_, i) => i % 5 === 0).slice(0, 24)
  bijgewerkt.forEach((dep, i) => {
    log.push({
      id: `log-upd-${i + 1}`,
      timestamp: stempel(10 + i * 3, 10),
      teamId: dep.teamId,
      type: 'dependency_updated',
      dependencyId: dep.id,
      duplicateOfId: null,
      titel: dep.titel,
      details: { veld: 'status' },
      status: null,
    })
  })

  for (const [vanTeam, outputId, naarTeam, , label, dagenGeleden] of VOORSTELLEN) {
    log.push({
      id: `log-link-${outputId}`,
      timestamp: stempel(dagenGeleden, 11),
      teamId: vanTeam,
      type: 'link_proposed',
      dependencyId: null,
      duplicateOfId: null,
      titel: `${label} → ${TEAMS.find((t) => t[0] === naarTeam)?.[1] ?? naarTeam}`,
      details: null,
      status: null,
    })
  }

  return log.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

// ---------------------------------------------------------------------------
// Samenstellen en wegschrijven
// ---------------------------------------------------------------------------
const dependencies = bouwDependencies()

const ruw = {
  teams: TEAMS.map(([id, naam]) => ({ id, naam, actief: true })),
  dependencies,
  teamWorkflows: bouwTeamWorkflows(),
  externalParties: PARTIJEN.map(([id, naam, type, status, door = null]) => ({
    id,
    naam,
    type,
    status,
    createdAt: dag(360),
    updatedAt: dag(status === 'in_afwachting' ? 6 : 360),
    voorgesteldDoorTeamId: door,
  })),
  changeLog: bouwChangeLog(dependencies),
  adminSettings: { uitgebreideAnalyse: true },
  // Bewust false: dit is geen voorbeelddata meer maar een ingeladen kaart, en
  // de blauwe demobalk hoort tijdens een presentatie niet in beeld te staan.
  usingMockData: false,
}

const gemigreerd = migrateState(ruw)

// De eenmalige omzetting naar het centrale applicatieregister meteen
// meedraaien. Zonder deze stap is het register leeg en toont de analysekaart
// "Applicaties gebruikt door meerdere teams" een nul -- precies het moment
// waarop een demo stilvalt.
const { state, rapport } = voerUit(gemigreerd, PEILDATUM)

fs.mkdirSync(path.dirname(UIT), { recursive: true })
fs.writeFileSync(UIT, `${JSON.stringify(state, null, 2)}\n`, 'utf8')

// ---------------------------------------------------------------------------
// Verantwoording: wat zit erin, en kloppen de conclusies waar de demo op leunt?
// ---------------------------------------------------------------------------
const open = state.dependencies.filter((d) => !d.gesloten_op && !d.geaccepteerd)
const perNiveau = {}
for (const d of open) {
  const n = calculateRisk(d).level
  perNiveau[n] = (perNiveau[n] ?? 0) + 1
}
const naarTet = open.filter((d) => d.geraaktTeamId === 'team-tet')
const gedeeld = {}
for (const [teamId, wf] of Object.entries(state.teamWorkflows)) {
  for (const a of wf.applications ?? []) (gedeeld[a.id] ??= { naam: a.naam, teams: new Set() }).teams.add(teamId)
}
const gedeeldeApps = Object.values(gedeeld).filter((g) => g.teams.size > 1)
const rollenMetRisico = Object.entries(state.teamWorkflows).flatMap(([teamId, wf]) =>
  (wf.capacity ?? []).filter((c) => c.risico_bij_uitval === 'ja').map((c) => `${teamId}: ${c.rol}`),
)

console.log(`Geschreven: ${path.relative(process.cwd(), UIT)}`)
console.log(`Peildatum:  ${dag(0)}`)
console.log('')
console.log(`Teams:            ${state.teams.length}`)
console.log(`Afhankelijkheden: ${state.dependencies.length} (${open.length} open)`)
console.log(`Verdeling:        ${Object.entries(perNiveau).map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`Externe partijen: ${state.externalParties.length} (${state.externalParties.filter((p) => p.status === 'in_afwachting').length} wachten op goedkeuring)`)
console.log(`Applicatieregister: ${state.applicatieregister.length} records, ${rapport.samenvoegingen.length} groep(en) samengevoegd`)
console.log('')
console.log('Controle op de punten waar de demo op leunt:')
console.log(`  teams die op TET wachten:      ${new Set(naarTet.map((d) => d.teamId)).size} van de 5`)
console.log(`  gedeelde applicaties:          ${gedeeldeApps.map((g) => `${g.naam} (${g.teams.size} teams)`).join(', ') || 'GEEN — dit moet gevuld zijn'}`)
console.log(`  rollen met uitvalrisico:       ${rollenMetRisico.length}`)
console.log(`  waarvan bij TET:               ${rollenMetRisico.filter((r) => r.startsWith('team-tet')).join(', ') || 'GEEN'}`)
