import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { analyseer, trendReeks, NIVEAUS, LEEFTIJD_KLASSEN } from '../lib/analytics'
import { signaalZin, constateringZin, bouwRapport, rapportAlsTekst, rapportAlsMarkdown } from '../lib/analyseTeksten'
import { exportTextAsFile } from '../lib/export'
import { slugify } from '../lib/slug'
import { calculateRisk } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import {
  translateCategorie,
  translateStatus,
  translateEffectOpFlow,
  translateWorkflowStage,
  translateBronType,
  translateExternalPartyStatus,
  translateDeadline,
  translateRiskLevel,
  translateScope,
  translateFlowtype,
} from '../i18n/labels'

// Analysepagina: alles wat de tool over ALLE data kan zeggen — metrieken,
// trends, constateringen, rapporten — bewust zo volledig mogelijk, zodat het
// team kan kiezen wat weg mag i.p.v. wat erbij moet. Elke kaart draagt zijn
// eigen uitleg (regel of formule in gewone taal): geen black box.
// Teksten staan hier lokaal (zelfde afweging als ADMIN_PAGE_CONFIG in
// SettingsPanel): ruim honderd sleutels voor één pagina zouden strings.js
// onleesbaar maken.
const TEKST = {
  nl: {
    titel: 'Analyse',
    intro: 'Alles hieronder komt rechtstreeks uit de data in deze tool en is per kaart uitlegbaar. Trends en doorlooptijden komen uit de wijzigingshistorie van de dependencies.',
    alleTeams: 'Alle teams',
    teamFilter: 'Team',
    periode: 'Periode',
    weken: '{{n}} weken',
    vsToen: 't.o.v. 30 dagen geleden',
    geenData: 'Geen gegevens.',
    toon: 'Toon {{n}} records',
    verberg: 'Verberg',
    dagen: '{{n}} dagen',
    dag: 'dagen',
    team: 'Team',
    titelKol: 'Titel',
    risico: 'Risico',
    aantal: 'Aantal',
    gesloten: 'gesloten',
    geslotenKop: 'Gesloten',
    categorie: 'Categorie',
    escalatie: '{{n}} escalatie',
    escalatiesN: '{{n}} escalaties',
    kindInput: 'Input',
    kindOutput: 'Output',
    sRapport: 'Rapport',
    sWaarschuwingen: 'Waarschuwingen',
    rapportUitleg: 'Lopende tekst uit dezelfde cijfers: samenvatting, ontwikkeling, risico, teams, keten, applicaties, datakwaliteit en aanbevelingen. Volgt het teamfilter.',
    rapportKopieer: 'Kopieer rapport',
    rapportDownload: 'Download',
    rapportDownloadTitel: 'Download het rapport als markdown-bestand',
    rapportGekopieerd: 'Gekopieerd',
    rapportTitel: 'Rapport dependencies',
    waarschuwingenUitleg: 'Eén zin per geval, gesorteerd op ernst en zwaarte. Klik om het detail of de teampagina te openen.',
    waarschuwingenGeen: 'Geen waarschuwingen.',
    toonAlle: 'Toon alle {{n}}',
    toonMinder: 'Toon minder',
    navSpring: 'Spring naar',
    cVerslechterd: 'In 30 dagen gestegen naar Hoog of Kritiek',
    cTeruggevallen: 'Mitigatie hield geen stand',
    cSluimerend: 'Sluimerend: hoog of kritiek, ouder dan een half jaar, zonder afspraak',
    cGeaccepteerdHoog: 'Geparkeerd (geaccepteerd) maar Hoog of Kritiek',
    cGemitigeerdNietGesloten: 'Al meer dan 90 dagen gemitigeerd maar niet afgesloten',
    cHeropend: 'Heropend na sluiting',
    cBacklogGroei: 'De voorraad groeit: meer nieuw dan gesloten',
    cKetenRisicoHoog: 'Veel blokkerend of hoog risico bij directe toeleveranciers: {{teams}}',
    cWederzijds: 'Wederzijdse afhankelijkheid tussen teams: {{paren}}',
    cGedeeldeApp: 'Applicatie via de keten gekoppeld aan meerdere andere teams: {{apps}}',
    cSlapendTeam: 'Al 60 dagen niets geregistreerd: {{teams}}',
    cDubbeleRegistratie: 'Zelfde dependency door meer teams apart vastgelegd',
    kVerandering: 'Verslechterd en verbeterd (30 dagen)',
    uVerandering: 'Score van 30 dagen geleden (replay) tegenover nu; alleen dependencies die toen al bestonden.',
    verslechterd: 'Verslechterd',
    verbeterd: 'Verbeterd',
    kProjectie: 'Projectie',
    uProjectie: 'Lineaire doortrekking van de laatste 13 weken: gemiddeld nieuw en gesloten per week. Geen model, alleen tempo.',
    pNieuwPerWeek: 'Nieuw per week',
    pGeslotenPerWeek: 'Gesloten per week',
    pNetto: 'Netto per week',
    pOverHorizon: 'Open over 13 weken',
    pWekenTotLeeg: 'Weken tot voorraad leeg',
    kOvergangen: 'Statusovergangen',
    uOvergangen: 'Alle statuswijzigingen uit de historie, van en naar. Daaronder: mitigaties die niet standhielden en heropeningen.',
    van: 'Van',
    naar: 'Naar',
    teruggevallen: 'Mitigatie hield geen stand',
    heropend: 'Heropend',
    kLeeftijd: 'Leeftijdsverdeling',
    uLeeftijd: 'Dagen sinds aanmaak van de open dependencies, in klassen; gemiddelde en mediaan per team.',
    gemiddeld: 'Gem.',
    mediaan: 'Mediaan',
    totaal: 'Totaal',
    kLevensloop: 'Sluimerend, geparkeerd en niet afgesloten',
    uLevensloop: 'Sluimerend: bekend risico op Hoog of Kritiek, ouder dan 180 dagen, zonder afspraak. Geparkeerd: geaccepteerd maar Hoog of Kritiek. Niet afgesloten: langer dan 90 dagen gemitigeerd.',
    sluimerend: 'Sluimerend',
    geparkeerdHoog: 'Geparkeerd maar hoog',
    nietAfgesloten: 'Gemitigeerd, niet afgesloten',
    kScorekaart: 'Teamscorekaart',
    uScorekaart: 'Alle teams naast elkaar, ongeacht het teamfilter; de onderste rij is het gemiddelde per team. Δ30 = verandering in open dependencies t.o.v. 30 dagen geleden.',
    open: 'Open',
    hoogPlus: 'Hoog+',
    kritiekKort: 'Kritiek',
    gemScoreKort: 'Gem. score',
    verouderdPct: 'Verouderd',
    afspraakPct: 'Met afspraak',
    delta30: 'Δ30',
    gesloten90: 'Gesloten 90d',
    kennisScore: 'Kennis',
    gemiddeldPerTeam: 'Gemiddeld per team',
    kPareto: 'Concentratie (top 3)',
    uPareto: 'Welk aandeel de drie grootste voor hun rekening nemen, en per team de grootste categorie.',
    top3Partijen: 'Partijen',
    top3Categorieen: 'Categorieën',
    top3Teams: 'Teams',
    topCategoriePerTeam: 'Grootste categorie per team',
    vanTotaal: 'van {{n}}',
    kKetenRisico: 'Ketenrisico stroomopwaarts en -afwaarts',
    uKetenRisico: 'Via geaccepteerde koppelingen: van hoeveel teams een team input krijgt (direct en verder), hoeveel blokkerende en hoge dependencies die directe toeleveranciers (TL) open hebben, en hoeveel teams het zelf stroomafwaarts raakt. Bevestigd = eigen dependencies die zo’n toeleverancier als veroorzaker noemen.',
    direct: 'Direct',
    stroomop: 'Stroomop',
    stroomaf: 'Stroomaf',
    blokTL: 'Blokkerend bij TL',
    hoogTL: 'Hoog+ bij TL',
    bevestigd: 'Bevestigd',
    kWederzijds: 'Wederzijdse afhankelijkheden',
    uWederzijds: 'Teamparen die dependencies op elkaar hebben geregistreerd.',
    geenWederzijds: 'Geen wederzijdse afhankelijkheden.',
    kKaart: 'Kaartvolledigheid per team',
    uKaart: 'Inputs verklaard (koppeling of partij), outputs afgenomen of extern, applicaties met ingevuld uitvalrisico, koppelingen met punten. Volledigheid = gemiddelde van die percentages.',
    inputsVerklaard: 'Inputs verklaard',
    outputsVerklaard: 'Outputs verklaard',
    appsDetail: 'Apps met detail',
    koppelingenPunten: 'Koppelingen met punten',
    notities: 'Notities',
    volledigheid: 'Volledigheid',
    kGedeeld: 'Gedeelde applicaties',
    uGedeeld: 'Applicaties die via een geaccepteerde ketenkoppeling (output met applicatie naar input met applicatie) aan andere teams hangen, met de eigen dependencies erop.',
    andereTeams: 'Andere teams',
    geenGedeeld: 'Geen applicaties met ketenkoppelingen naar andere teams.',
    kSlapend: 'Laatste activiteit per team',
    uSlapend: 'Laatste logregel per team; meer dan 60 dagen stil geldt als slapend.',
    laatsteActiviteit: 'Laatste activiteit',
    dagenStil: 'Dagen stil',
    slapend: 'Slapend',
    kDuplicaten: 'Dubbele registraties',
    uDuplicaten: 'Groepen dependencies die door meer dan één team apart zijn vastgelegd (dedup-groep).',
    geenDuplicaten: 'Geen dubbele registraties.',
    nooit: 'nooit',
    // secties
    sOverzicht: 'Overzicht',
    sConstateringen: 'Constateringen',
    sTrends: 'Trends',
    sRisico: 'Risico en urgentie',
    sVerdeling: 'Verdelingen en hotspots',
    sConcentratie: 'Concentratie en hubs',
    sKeten: 'Keten',
    sProces: 'Applicaties en ontwikkelproces',
    sFlowverlies: 'Flowverlies',
    sDoorloop: 'Doorlooptijden',
    sKwaliteit: 'Datakwaliteit',
    sBeheer: 'Beheer en registratie',
    // tegels
    tOpen: 'Open dependencies',
    tKritiek: 'Kritiek',
    tHoog: 'Hoog of kritiek',
    tBlokkerend: 'Actief blokkerend',
    tVerouderd: 'Verouderd (>90 dagen niet bijgewerkt)',
    tAfspraak: 'Open zonder actie-afspraak',
    tGeaccepteerd: 'Geaccepteerd (geparkeerd)',
    tGesloten90: 'Gesloten in de laatste 90 dagen',
    tNieuw30: 'Nieuw in de laatste 30 dagen',
    tMitigatie: 'Gem. dagen tot mitigatie',
    tScore: 'Gemiddelde risicoscore',
    tVerzoeken: 'Koppelingsverzoeken open',
    // constateringen
    ernstHoog: 'hoog',
    ernstMidden: 'midden',
    ernstLaag: 'laag',
    cKritiekZonderAfspraak: 'Kritieke dependencies zonder actie-afspraak',
    cHardeDeadlineZonderAfspraak: 'Harde deadline zonder actie-afspraak',
    cBlokkerendVerouderd: 'Actief blokkerend maar al meer dan 90 dagen niet bijgewerkt',
    cLangBlokkerend: 'Al meer dan 60 dagen onafgebroken blokkerend',
    cHoogVerouderd: 'Hoog risico, geen actie-afspraak én verouderd',
    cStilRisico: 'Stille risico’s: laag of gemiddeld risico, maar hoog flowverlies',
    cPartijGeweigerd: 'Verwijzing naar een geweigerde partij',
    cPartijInAfwachting: 'Verwijzing naar een partij die nog niet is goedgekeurd',
    cPartijHub: 'Partij raakt de helft of meer van de teams: {{partijen}}',
    cVerzoekOud: 'Koppelingsverzoeken die langer dan twee weken openstaan',
    cDepZonderKoppeling: 'Dependency op een team zonder ketenkoppeling met dat team',
    cSpofZonderDetail: 'Zwaar belaste applicatie zonder ingevuld risico bij uitval: {{apps}}',
    cTeamVerouderd: 'Meer dan 40% van de dependencies verouderd bij: {{teams}}',
    cKennisBusFactor: 'Kennisconcentratie met hoog risico bij: {{teams}}',
    cFaseZonderCapaciteit: 'Werkstap met dependencies maar zonder capaciteit: {{fasen}}',
    cReviewOud: 'Aanmeldingen die langer dan een week op review wachten',
    cGemitigeerdZonderTekst: 'Gemitigeerd zonder beschreven mitigatie',
    cProfielOnvolledig: 'Profiel onvolledig (wachttijd, deadline of oplosbaarheid leeg)',
    cGeen: 'Geen constateringen. Alle regels zijn schoon.',
    // trends
    kOpenStatus: 'Open dependencies per status',
    uOpenStatus: 'Toestand per week, teruggerekend uit de historie: een dependency telt mee vanaf aanmaak tot sluiting, met de status van dat moment.',
    kOpenNiveau: 'Open dependencies per risiconiveau',
    uOpenNiveau: 'Zelfde replay, maar de risicoscore van dat moment (impact × frequentie + statuscorrectie).',
    kNieuwGesloten: 'Nieuw en gesloten per week',
    uNieuwGesloten: 'Aanmaakdatum en sluitdatum per week. Meer nieuw dan gesloten betekent een groeiende voorraad.',
    kScore: 'Som van de risicoscores',
    uScore: 'Alle open scores opgeteld: één getal voor de totale risicodruk.',
    // risico
    kKwadranten: 'Kwadranten: flowverlies tegen oplosbaarheid',
    uKwadranten: 'Quick win = veel verlies, zelf oplosbaar. Opschalen = veel verlies, buiten het team. Opruimen = weinig verlies, zelf oplosbaar. Accepteren = weinig verlies, buiten het team.',
    qQuickWin: 'Quick wins',
    qOpschalen: 'Opschalen',
    qOpruimen: 'Opruimen',
    qAccepteren: 'Accepteren',
    qOnvolledig: 'Profiel onvolledig',
    kStil: 'Stille risico’s',
    uStil: 'Risico Laag of Gemiddeld, flowverlies Hoog of Kritiek. Precies de lijst die de risicoscore niet bovenaan zet.',
    kQuick: 'Quick wins',
    uQuick: 'Oplosbaar door één of meer teamleden én flowverlies minstens Gemiddeld.',
    kDeadlines: 'Deadlines',
    uDeadlines: 'Vaste en harde deadlines, harde eerst. Een rode markering: zonder actie-afspraak.',
    kGemitigeerdHoog: 'Gemitigeerd maar nog steeds Hoog',
    uGemitigeerdHoog: 'De basis (impact × frequentie) blijft zwaar, ook met de correctie van min 2.',
    kAcuut: 'Acuut en chronisch',
    uAcuut: 'Acuut: aangemaakt in de laatste 30 dagen. Chronisch: ouder dan een jaar en nog open.',
    acuut: 'Acuut',
    chronisch: 'Chronisch',
    kTop: 'Top 15 op risicoscore',
    uTop: 'Hoogste scores eerst; klik voor het detail.',
    kAfspraak: 'Dekking van actie-afspraken',
    uAfspraak: 'Open dependencies (niet gemitigeerd) met en zonder actie-afspraak, en gemitigeerde zonder beschreven mitigatie.',
    metAfspraak: 'Met actie-afspraak',
    zonderAfspraak: 'Zonder actie-afspraak',
    gemitigeerdZonder: 'Gemitigeerd zonder tekst',
    mitigatieZonderStatus: 'Mitigatietekst maar niet gemitigeerd',
    // verdelingen
    kNiveau: 'Per risiconiveau',
    kStatus: 'Per status',
    kScope: 'Per scope',
    kFlowtype: 'Per flowtype',
    kCategorie: 'Per categorie',
    kEffect: 'Per effect op de flow',
    uVerdeling: 'Aantal open dependencies.',
    kHotspots: 'Hotspots team × categorie',
    uHotspots: 'Cellen met de meeste dependencies; factor = aantal gedeeld door het gemiddelde van alle gevulde cellen.',
    factor: 'factor',
    hoogste: 'hoogste',
    // concentratie
    kPartijen: 'Externe partijen als hub',
    uPartijen: 'Per partij uit het register of vrije naam: hoeveel teams en dependencies eraan hangen, plus input- en outputitems. Flowverlies = som van wachttijd × frequentie van die dependencies.',
    partij: 'Partij',
    type: 'Type',
    status: 'Status',
    teams: 'Teams',
    deps: 'Dependencies',
    blokkerend: 'Blokkerend',
    io: 'In/uit',
    flowverlies: 'Flowverlies',
    nietInRegister: 'niet in register',
    kTeamOpTeam: 'Wie blokkeert wie',
    uTeamOpTeam: 'Dependencies met een ander team als veroorzaker. Netto = veroorzaakt bij anderen min zelf ondervonden.',
    veroorzaker: 'Veroorzaker',
    getroffen: 'Getroffen',
    veroorzaakt: 'Veroorzaakt',
    ondervonden: 'Ondervonden',
    netto: 'Netto',
    kKennis: 'Kennisconcentratie en bus-factor',
    uKennis: 'Score = 2 × kennisdependencies met Hoog of Kritiek + overige kennisdependencies + capaciteitsrijen met risico bij uitval + applicaties met risico bij uitval.',
    kennisDeps: 'Kennis-deps',
    kennisHoog: 'waarvan Hoog+',
    risicoRijen: 'Rollen met uitvalrisico',
    appsRisico: 'Apps met uitvalrisico',
    senior: 'Senior',
    junior: 'Junior',
    score: 'Score',
    // keten
    kKetenTeams: 'Koppelingen per team',
    uKetenTeams: 'Geaccepteerde ketenkoppelingen: inkomend en uitgaand, en met hoeveel verschillende partners.',
    inkomend: 'Inkomend',
    uitgaand: 'Uitgaand',
    partners: 'Partners',
    kCycli: 'Cycli in de keten',
    uCycli: 'Teams die via koppelingen bij zichzelf terugkomen. Eén cyclus aan het eind is normaal; meer cycli maken de keten onleesbaar.',
    geenCycli: 'Geen cycli.',
    kLos: 'Losse inputs en onbenutte outputs',
    uLos: 'Inputs zonder koppeling of partij, en outputs die niemand afneemt. Niet fout, wel een teken van een onvolledige kaart.',
    losseInputs: 'Losse inputs',
    losseOutputs: 'Onbenutte outputs',
    kVerzoeken: 'Koppelingsverzoeken',
    uVerzoeken: 'Open verzoeken met hun leeftijd, afgewezen verzoeken, en de gemiddelde doorlooptijd van voorstel tot besluit.',
    afgewezen: 'Afgewezen',
    gemDoorlooptijd: 'Gemiddelde doorlooptijd van besluit',
    kMismatch: 'Kaart tegenover praktijk',
    uMismatch: 'Links: dependency op een team waarmee geen ketenkoppeling bestaat. Rechts: koppeling tussen teams zonder dependency in welke richting ook.',
    depZonderKoppeling: 'Dependency zonder koppeling',
    koppelingZonderDep: 'Koppeling zonder dependency',
    kSpof: 'Applicaties als single point of failure',
    uSpof: 'Risico bij uitval uit de applicatiedetails, en de last: dependencies + input/output-items + applicatiekoppelingen.',
    applicatie: 'Applicatie',
    uitval: 'Uitval',
    last: 'Last',
    // proces
    kWerkstappen: 'Belasting per werkstap',
    uWerkstappen: 'Ontwikkelflow-dependencies per stap, de top-effecten, en de capaciteit die teams op die stap hebben ingevuld.',
    stap: 'Werkstap',
    effecten: 'Top-effecten',
    personen: 'Personen',
    teamsMetCap: 'Teams met capaciteit',
    kProces: 'Hygiënegevallen in de flow',
    uProces: 'Ontwikkelflow zonder werkstap, applicatieflow zonder applicatie, dependencies over meerdere applicaties, en zonder flowtype.',
    zonderStap: 'Proces-overstijgend',
    appOverstijgend: 'Applicatie-overstijgend',
    multiApp: 'Meerdere applicaties',
    zonderFlowtype: 'Flowtype nog te bepalen',
    // flowverlies
    kFlowTeam: 'Flowverlies per team',
    kFlowCategorie: 'Flowverlies per categorie',
    kFlowPartij: 'Flowverlies per partij',
    uFlow: 'Som van wachttijd-punten × frequentie-punten van de open dependencies: een maat voor wat niets doen kost.',
    onvolledig: 'onvolledig',
    // doorloop
    kDoorloop: 'Oplostempo',
    uDoorloop: 'Dagen van aanmaak tot de eerste mitigatie en tot sluiting, uit de historie. Blokkerend = totale dagen in status actief blokkerend.',
    gemTotMitigatie: 'Gem. tot mitigatie',
    medTotMitigatie: 'Mediaan tot mitigatie',
    gemTotSluiting: 'Gem. tot sluiting',
    medTotSluiting: 'Mediaan tot sluiting',
    ooitBlokkerend: 'Ooit blokkerend',
    gemBlokkerend: 'Gem. dagen blokkerend',
    kDoorloopTeam: 'Oplostempo per team',
    gemitigeerd: 'Gemitigeerd',
    kLangstBlokkerend: 'Langst blokkerend (open)',
    uLangstBlokkerend: 'Open dependencies met de meeste dagen in status actief blokkerend.',
    kOoitBlokkerend: 'Escalatiegeschiedenis',
    uOoitBlokkerend: 'Dependencies die in hun historie een of meer keer naar actief blokkerend zijn gegaan.',
    // kwaliteit
    kChecks: 'Hygiënecontroles op dependencies',
    uChecks: 'Elke regel is een simpele check op velden; klik om de records te zien.',
    hFlowtype: 'Zonder flowtype',
    hProfiel: 'Profiel onvolledig (uitgebreide analyse)',
    hDeadlineTekst: 'Deadline zonder tekst',
    hCategorieScope: 'Categorie past niet bij scope',
    hExternZonderPartij: 'Ketenniveau zonder partij of team',
    hPartijOnbekend: 'Partij niet (meer) in register',
    hPartijGeweigerd: 'Partij geweigerd maar nog genoemd',
    hEffectLeeg: 'Effect op flow leeg',
    hGeenToelichting: 'Zonder toelichting',
    hDubbeleTitels: 'Zelfde titel bij meerdere teams',
    hVerouderd: 'Verouderd',
    hZonderAanmaak: 'Zonder aanmaakdatum',
    kIoChecks: 'Hygiënecontroles op input/output en applicaties',
    uIoChecks: 'Items met een onbekende applicatie of partij, items zonder flowtype, en applicaties zonder enige relatie.',
    ioAppOnbekend: 'Item verwijst naar onbekende applicatie',
    ioPartijOnbekend: 'Item verwijst naar onbekende partij',
    ioZonderFlowtype: 'Item zonder flowtype',
    appsZonderRelatie: 'Applicaties zonder relatie',
    // beheer
    kRegistratie: 'Registratie per week',
    uRegistratie: 'Gebeurtenissen uit de wijzigingenlog: aangemaakt, gewijzigd, gesloten en koppelingsverzoeken.',
    aangemaakt: 'Aangemaakt',
    gewijzigd: 'Gewijzigd',
    koppelingen: 'Koppelingen',
    kRegistratieTeam: 'Activiteit per team (90 dagen)',
    uRegistratieTeam: 'Wie registreert en onderhoudt zijn dependencies, en wie niet.',
    kReview: 'Review-wachtrij',
    uReview: 'Aanmeldingen die op goedkeuring wachten in de admin-log, met leeftijd. Plus het aantal duplicaatmeldingen ooit.',
    duplicaten: 'Duplicaatmeldingen',
    logTotaal: 'Logregels totaal',
  },
  en: {
    titel: 'Analysis',
    intro: 'Everything below comes straight from the data in this tool and every card explains its own rule. Trends and lead times come from the change history of the dependencies.',
    alleTeams: 'All teams',
    teamFilter: 'Team',
    periode: 'Period',
    weken: '{{n}} weeks',
    vsToen: 'vs. 30 days ago',
    geenData: 'No data.',
    toon: 'Show {{n}} records',
    verberg: 'Hide',
    dagen: '{{n}} days',
    dag: 'days',
    team: 'Team',
    titelKol: 'Title',
    risico: 'Risk',
    aantal: 'Count',
    gesloten: 'closed',
    geslotenKop: 'Closed',
    categorie: 'Category',
    escalatie: '{{n}} escalation',
    escalatiesN: '{{n}} escalations',
    kindInput: 'Input',
    kindOutput: 'Output',
    sRapport: 'Report',
    sWaarschuwingen: 'Warnings',
    rapportUitleg: 'Running text from the same numbers: summary, development, risk, teams, chain, applications, data quality and recommendations. Follows the team filter.',
    rapportKopieer: 'Copy report',
    rapportDownload: 'Download',
    rapportDownloadTitel: 'Download the report as a markdown file',
    rapportGekopieerd: 'Copied',
    rapportTitel: 'Dependency report',
    waarschuwingenUitleg: 'One sentence per case, sorted by severity and weight. Click to open the detail or the team page.',
    waarschuwingenGeen: 'No warnings.',
    toonAlle: 'Show all {{n}}',
    toonMinder: 'Show fewer',
    navSpring: 'Jump to',
    cVerslechterd: 'Rose to High or Critical in 30 days',
    cTeruggevallen: 'Mitigation did not hold',
    cSluimerend: 'Dormant: high or critical, older than six months, without agreement',
    cGeaccepteerdHoog: 'Parked (accepted) but High or Critical',
    cGemitigeerdNietGesloten: 'Mitigated for more than 90 days but not closed',
    cHeropend: 'Reopened after closure',
    cBacklogGroei: 'The backlog is growing: more new than closed',
    cKetenRisicoHoog: 'Much blocking or high risk at direct suppliers: {{teams}}',
    cWederzijds: 'Mutual dependency between teams: {{paren}}',
    cGedeeldeApp: 'Application linked to several other teams via the chain: {{apps}}',
    cSlapendTeam: 'Nothing registered for 60 days: {{teams}}',
    cDubbeleRegistratie: 'Same dependency registered separately by several teams',
    kVerandering: 'Worsened and improved (30 days)',
    uVerandering: 'Score of 30 days ago (replay) against now; only dependencies that existed then.',
    verslechterd: 'Worsened',
    verbeterd: 'Improved',
    kProjectie: 'Projection',
    uProjectie: 'Linear extrapolation of the last 13 weeks: average new and closed per week. No model, only pace.',
    pNieuwPerWeek: 'New per week',
    pGeslotenPerWeek: 'Closed per week',
    pNetto: 'Net per week',
    pOverHorizon: 'Open in 13 weeks',
    pWekenTotLeeg: 'Weeks until backlog empty',
    kOvergangen: 'Status transitions',
    uOvergangen: 'All status changes from the history, from and to. Below: mitigations that did not hold and reopenings.',
    van: 'From',
    naar: 'To',
    teruggevallen: 'Mitigation did not hold',
    heropend: 'Reopened',
    kLeeftijd: 'Age distribution',
    uLeeftijd: 'Days since creation of the open dependencies, in classes; average and median per team.',
    gemiddeld: 'Avg.',
    mediaan: 'Median',
    totaal: 'Total',
    kLevensloop: 'Dormant, parked and not closed',
    uLevensloop: 'Dormant: known risk at High or Critical, older than 180 days, without agreement. Parked: accepted but High or Critical. Not closed: mitigated for more than 90 days.',
    sluimerend: 'Dormant',
    geparkeerdHoog: 'Parked but high',
    nietAfgesloten: 'Mitigated, not closed',
    kScorekaart: 'Team scorecard',
    uScorekaart: 'All teams side by side, regardless of the team filter; the bottom row is the average per team. Δ30 = change in open dependencies vs. 30 days ago.',
    open: 'Open',
    hoogPlus: 'High+',
    kritiekKort: 'Critical',
    gemScoreKort: 'Avg. score',
    verouderdPct: 'Stale',
    afspraakPct: 'With agreement',
    delta30: 'Δ30',
    gesloten90: 'Closed 90d',
    kennisScore: 'Knowledge',
    gemiddeldPerTeam: 'Average per team',
    kPareto: 'Concentration (top 3)',
    uPareto: 'The share the three largest account for, and the largest category per team.',
    top3Partijen: 'Parties',
    top3Categorieen: 'Categories',
    top3Teams: 'Teams',
    topCategoriePerTeam: 'Largest category per team',
    vanTotaal: 'of {{n}}',
    kKetenRisico: 'Chain risk upstream and downstream',
    uKetenRisico: 'Via accepted links: from how many teams a team receives input (direct and beyond), how many blocking and high dependencies those direct suppliers (S) have open, and how many teams it affects downstream itself. Confirmed = own dependencies naming such a supplier as the cause.',
    direct: 'Direct',
    stroomop: 'Upstream',
    stroomaf: 'Downstream',
    blokTL: 'Blocking at S',
    hoogTL: 'High+ at S',
    bevestigd: 'Confirmed',
    kWederzijds: 'Mutual dependencies',
    uWederzijds: 'Team pairs that registered dependencies on each other.',
    geenWederzijds: 'No mutual dependencies.',
    kKaart: 'Map completeness per team',
    uKaart: 'Inputs explained (link or party), outputs consumed or external, applications with outage risk filled in, links with points. Completeness = average of those percentages.',
    inputsVerklaard: 'Inputs explained',
    outputsVerklaard: 'Outputs explained',
    appsDetail: 'Apps with detail',
    koppelingenPunten: 'Links with points',
    notities: 'Notes',
    volledigheid: 'Completeness',
    kGedeeld: 'Shared applications',
    uGedeeld: 'Applications that hang on other teams through an accepted chain link (output with application to input with application), with their own dependencies.',
    andereTeams: 'Other teams',
    geenGedeeld: 'No applications with chain links to other teams.',
    kSlapend: 'Last activity per team',
    uSlapend: 'Last log entry per team; more than 60 days quiet counts as dormant.',
    laatsteActiviteit: 'Last activity',
    dagenStil: 'Days quiet',
    slapend: 'Dormant',
    kDuplicaten: 'Duplicate registrations',
    uDuplicaten: 'Groups of dependencies registered separately by more than one team (dedup group).',
    geenDuplicaten: 'No duplicate registrations.',
    nooit: 'never',
    sOverzicht: 'Overview',
    sConstateringen: 'Findings',
    sTrends: 'Trends',
    sRisico: 'Risk and urgency',
    sVerdeling: 'Distributions and hotspots',
    sConcentratie: 'Concentration and hubs',
    sKeten: 'Chain',
    sProces: 'Applications and development process',
    sFlowverlies: 'Flow loss',
    sDoorloop: 'Lead times',
    sKwaliteit: 'Data quality',
    sBeheer: 'Administration and registration',
    tOpen: 'Open dependencies',
    tKritiek: 'Critical',
    tHoog: 'High or critical',
    tBlokkerend: 'Actively blocking',
    tVerouderd: 'Stale (>90 days without update)',
    tAfspraak: 'Open without action agreement',
    tGeaccepteerd: 'Accepted (parked)',
    tGesloten90: 'Closed in the last 90 days',
    tNieuw30: 'New in the last 30 days',
    tMitigatie: 'Avg. days to mitigation',
    tScore: 'Average risk score',
    tVerzoeken: 'Open link requests',
    ernstHoog: 'high',
    ernstMidden: 'medium',
    ernstLaag: 'low',
    cKritiekZonderAfspraak: 'Critical dependencies without an action agreement',
    cHardeDeadlineZonderAfspraak: 'Hard deadline without an action agreement',
    cBlokkerendVerouderd: 'Actively blocking but not updated for more than 90 days',
    cLangBlokkerend: 'Blocking for more than 60 days without interruption',
    cHoogVerouderd: 'High risk, no action agreement and stale',
    cStilRisico: 'Silent risks: low or medium risk but high flow loss',
    cPartijGeweigerd: 'Reference to a rejected party',
    cPartijInAfwachting: 'Reference to a party that has not been approved yet',
    cPartijHub: 'Party touches half of the teams or more: {{partijen}}',
    cVerzoekOud: 'Link requests open for more than two weeks',
    cDepZonderKoppeling: 'Dependency on a team without a chain link to that team',
    cSpofZonderDetail: 'Heavily loaded application without a filled-in outage risk: {{apps}}',
    cTeamVerouderd: 'More than 40% of dependencies stale at: {{teams}}',
    cKennisBusFactor: 'High-risk knowledge concentration at: {{teams}}',
    cFaseZonderCapaciteit: 'Workflow step with dependencies but no capacity: {{fasen}}',
    cReviewOud: 'Registrations waiting for review for more than a week',
    cGemitigeerdZonderTekst: 'Mitigated without a described mitigation',
    cProfielOnvolledig: 'Profile incomplete (waiting time, deadline or solvability empty)',
    cGeen: 'No findings. All rules are clean.',
    kOpenStatus: 'Open dependencies per status',
    uOpenStatus: 'State per week, replayed from the history: a dependency counts from creation to closure, with the status of that moment.',
    kOpenNiveau: 'Open dependencies per risk level',
    uOpenNiveau: 'Same replay, but with the risk score of that moment (impact × frequency + status correction).',
    kNieuwGesloten: 'New and closed per week',
    uNieuwGesloten: 'Creation and closure dates per week. More new than closed means a growing backlog.',
    kScore: 'Sum of risk scores',
    uScore: 'All open scores added up: one number for the total risk pressure.',
    kKwadranten: 'Quadrants: flow loss against solvability',
    uKwadranten: 'Quick win = much loss, solvable by the team. Escalate = much loss, outside the team. Clean up = little loss, solvable by the team. Accept = little loss, outside the team.',
    qQuickWin: 'Quick wins',
    qOpschalen: 'Escalate',
    qOpruimen: 'Clean up',
    qAccepteren: 'Accept',
    qOnvolledig: 'Profile incomplete',
    kStil: 'Silent risks',
    uStil: 'Risk Low or Medium, flow loss High or Critical. Exactly the list the risk score does not put on top.',
    kQuick: 'Quick wins',
    uQuick: 'Solvable by one or more team members and flow loss at least Medium.',
    kDeadlines: 'Deadlines',
    uDeadlines: 'Fixed and hard deadlines, hard first. Red marker: no action agreement.',
    kGemitigeerdHoog: 'Mitigated but still High',
    uGemitigeerdHoog: 'The base (impact × frequency) stays heavy, even with the minus 2 correction.',
    kAcuut: 'Acute and chronic',
    uAcuut: 'Acute: created in the last 30 days. Chronic: older than a year and still open.',
    acuut: 'Acute',
    chronisch: 'Chronic',
    kTop: 'Top 15 by risk score',
    uTop: 'Highest scores first; click for the detail.',
    kAfspraak: 'Coverage of action agreements',
    uAfspraak: 'Open dependencies (not mitigated) with and without an action agreement, and mitigated ones without a described mitigation.',
    metAfspraak: 'With action agreement',
    zonderAfspraak: 'Without action agreement',
    gemitigeerdZonder: 'Mitigated without text',
    mitigatieZonderStatus: 'Mitigation text but not mitigated',
    kNiveau: 'Per risk level',
    kStatus: 'Per status',
    kScope: 'Per scope',
    kFlowtype: 'Per flow type',
    kCategorie: 'Per category',
    kEffect: 'Per effect on the flow',
    uVerdeling: 'Number of open dependencies.',
    kHotspots: 'Hotspots team × category',
    uHotspots: 'Cells with the most dependencies; factor = count divided by the average of all filled cells.',
    factor: 'factor',
    hoogste: 'highest',
    kPartijen: 'External parties as hubs',
    uPartijen: 'Per party from the register or free text: how many teams and dependencies hang on it, plus input and output items. Flow loss = sum of waiting time × frequency of those dependencies.',
    partij: 'Party',
    type: 'Type',
    status: 'Status',
    teams: 'Teams',
    deps: 'Dependencies',
    blokkerend: 'Blocking',
    io: 'In/out',
    flowverlies: 'Flow loss',
    nietInRegister: 'not in register',
    kTeamOpTeam: 'Who blocks whom',
    uTeamOpTeam: 'Dependencies with another team as the cause. Net = caused at others minus experienced.',
    veroorzaker: 'Cause',
    getroffen: 'Affected',
    veroorzaakt: 'Caused',
    ondervonden: 'Experienced',
    netto: 'Net',
    kKennis: 'Knowledge concentration and bus factor',
    uKennis: 'Score = 2 × knowledge dependencies at High or Critical + other knowledge dependencies + capacity rows with outage risk + applications with outage risk.',
    kennisDeps: 'Knowledge deps',
    kennisHoog: 'of which High+',
    risicoRijen: 'Roles with outage risk',
    appsRisico: 'Apps with outage risk',
    senior: 'Senior',
    junior: 'Junior',
    score: 'Score',
    kKetenTeams: 'Links per team',
    uKetenTeams: 'Accepted chain links: incoming and outgoing, and with how many different partners.',
    inkomend: 'Incoming',
    uitgaand: 'Outgoing',
    partners: 'Partners',
    kCycli: 'Cycles in the chain',
    uCycli: 'Teams that come back to themselves via links. One cycle at the end is normal; more cycles make the chain unreadable.',
    geenCycli: 'No cycles.',
    kLos: 'Loose inputs and unused outputs',
    uLos: 'Inputs without link or party, and outputs nobody consumes. Not wrong, but a sign of an incomplete map.',
    losseInputs: 'Loose inputs',
    losseOutputs: 'Unused outputs',
    kVerzoeken: 'Link requests',
    uVerzoeken: 'Open requests with their age, rejected requests, and the average lead time from proposal to decision.',
    afgewezen: 'Rejected',
    gemDoorlooptijd: 'Average decision lead time',
    kMismatch: 'Map versus practice',
    uMismatch: 'Left: dependency on a team without a chain link to it. Right: link between teams without a dependency in either direction.',
    depZonderKoppeling: 'Dependency without link',
    koppelingZonderDep: 'Link without dependency',
    kSpof: 'Applications as single point of failure',
    uSpof: 'Outage risk from the application details, and the load: dependencies + input/output items + application links.',
    applicatie: 'Application',
    uitval: 'Outage',
    last: 'Load',
    kWerkstappen: 'Load per workflow step',
    uWerkstappen: 'Development-flow dependencies per step, the top effects, and the capacity teams have filled in for that step.',
    stap: 'Step',
    effecten: 'Top effects',
    personen: 'People',
    teamsMetCap: 'Teams with capacity',
    kProces: 'Hygiene cases in the flow',
    uProces: 'Development flow without step, application flow without application, dependencies across several applications, and without flow type.',
    zonderStap: 'Process-wide',
    appOverstijgend: 'Application-wide',
    multiApp: 'Multiple applications',
    zonderFlowtype: 'Flow type to be determined',
    kFlowTeam: 'Flow loss per team',
    kFlowCategorie: 'Flow loss per category',
    kFlowPartij: 'Flow loss per party',
    uFlow: 'Sum of waiting-time points × frequency points of the open dependencies: a measure of what doing nothing costs.',
    onvolledig: 'incomplete',
    kDoorloop: 'Resolution pace',
    uDoorloop: 'Days from creation to the first mitigation and to closure, from the history. Blocking = total days in status actively blocking.',
    gemTotMitigatie: 'Avg. to mitigation',
    medTotMitigatie: 'Median to mitigation',
    gemTotSluiting: 'Avg. to closure',
    medTotSluiting: 'Median to closure',
    ooitBlokkerend: 'Ever blocking',
    gemBlokkerend: 'Avg. days blocking',
    kDoorloopTeam: 'Resolution pace per team',
    gemitigeerd: 'Mitigated',
    kLangstBlokkerend: 'Longest blocking (open)',
    uLangstBlokkerend: 'Open dependencies with the most days in status actively blocking.',
    kOoitBlokkerend: 'Escalation history',
    uOoitBlokkerend: 'Dependencies that went to actively blocking one or more times in their history.',
    kChecks: 'Hygiene checks on dependencies',
    uChecks: 'Each rule is a simple field check; click to see the records.',
    hFlowtype: 'Without flow type',
    hProfiel: 'Profile incomplete (extended analysis)',
    hDeadlineTekst: 'Deadline without text',
    hCategorieScope: 'Category does not match scope',
    hExternZonderPartij: 'Chain level without party or team',
    hPartijOnbekend: 'Party no longer in register',
    hPartijGeweigerd: 'Party rejected but still referenced',
    hEffectLeeg: 'Effect on flow empty',
    hGeenToelichting: 'Without explanation',
    hDubbeleTitels: 'Same title at several teams',
    hVerouderd: 'Stale',
    hZonderAanmaak: 'Without creation date',
    kIoChecks: 'Hygiene checks on input/output and applications',
    uIoChecks: 'Items with an unknown application or party, items without flow type, and applications without any relation.',
    ioAppOnbekend: 'Item refers to unknown application',
    ioPartijOnbekend: 'Item refers to unknown party',
    ioZonderFlowtype: 'Item without flow type',
    appsZonderRelatie: 'Applications without relation',
    kRegistratie: 'Registration per week',
    uRegistratie: 'Events from the change log: created, updated, closed and link requests.',
    aangemaakt: 'Created',
    gewijzigd: 'Updated',
    koppelingen: 'Links',
    kRegistratieTeam: 'Activity per team (90 days)',
    uRegistratieTeam: 'Who registers and maintains their dependencies, and who does not.',
    kReview: 'Review queue',
    uReview: 'Registrations waiting for approval in the admin log, with age. Plus the number of duplicate warnings ever.',
    duplicaten: 'Duplicate warnings',
    logTotaal: 'Log entries total',
  },
}

const STATUS_KLEUR = { 'bekend risico': '#5c6b8a', 'actief blokkerend': '#9a3b2e', gemitigeerd: '#5c8a72' }
// Ernst volgt de warme ordinale risicoreeks (geen stoplichtkleuren).
const ERNST_STIJL = {
  hoog: 'bg-[#c1552c]/[0.12] text-[#8a3b1c] border-[#c1552c]/40',
  midden: 'bg-[#b8842c]/[0.14] text-[#7a5a1a] border-[#b8842c]/40',
  laag: 'bg-slate-100 text-slate-600 border-slate-300',
}
const WARM = '#b8842c'

function vul(sjabloon, vars) {
  if (!vars) return sjabloon
  return sjabloon.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''))
}

// --- bouwstenen ---------------------------------------------------------

function Sectie({ id, titel, children }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titel}</h2>
      {children}
    </section>
  )
}

function Kaart({ titel, uitleg, children, breed = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${breed ? 'lg:col-span-2' : ''}`}>
      <h3 className="text-sm font-semibold text-slate-800">{titel}</h3>
      {uitleg && <p className="mt-0.5 mb-3 text-[11px] leading-relaxed text-slate-400">{uitleg}</p>}
      {children}
    </div>
  )
}

function Tegel({ label, waarde, sub, delta, kleur }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-800" style={kleur ? { color: kleur } : undefined}>
          {waarde ?? '—'}
        </span>
        {delta !== undefined && delta !== null && (
          <span className={`text-xs font-medium ${delta > 0 ? 'text-[#c1552c]' : delta < 0 ? 'text-[#6b8f76]' : 'text-slate-400'}`}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

function Balken({ rijen, kleur = '#2a5f8a' }) {
  const max = Math.max(1, ...rijen.map((r) => r.waarde))
  if (rijen.length === 0) return <p className="text-xs text-slate-400">—</p>
  return (
    <div className="space-y-1.5">
      {rijen.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-700">{r.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{r.tekst ?? r.waarde}</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded" style={{ width: `${(r.waarde / max) * 100}%`, backgroundColor: r.kleur ?? kleur }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Compacte SVG-lijngrafiek: één of meer reeksen over dezelfde x-as.
function Lijnen({ punten, reeksen, hoogte = 140 }) {
  const w = 600
  const h = hoogte
  const pad = { l: 28, r: 8, t: 8, b: 20 }
  const max = Math.max(1, ...reeksen.flatMap((r) => r.waarden))
  const n = punten.length
  const x = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.l - pad.r))
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b)
  const stappen = 3
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        {Array.from({ length: stappen + 1 }, (_, i) => {
          const v = Math.round((max / stappen) * i)
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={pad.l - 4} y={y(v) + 3} fontSize="9" textAnchor="end" fill="#94a3b8">
                {v}
              </text>
            </g>
          )
        })}
        {reeksen.map((r) => (
          <path
            key={r.label}
            d={r.waarden.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={r.kleur}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {punten.length > 0 && (
          <>
            <text x={pad.l} y={h - 6} fontSize="9" fill="#94a3b8">
              {punten[0].datum}
            </text>
            <text x={w - pad.r} y={h - 6} fontSize="9" textAnchor="end" fill="#94a3b8">
              {punten[punten.length - 1].datum}
            </text>
          </>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {reeksen.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.kleur }} />
            {r.label} · {r.waarden[r.waarden.length - 1] ?? 0}
          </span>
        ))}
      </div>
    </div>
  )
}

function Staven({ punten, reeksen, hoogte = 140 }) {
  const w = 600
  const h = hoogte
  const pad = { l: 24, r: 8, t: 8, b: 20 }
  const max = Math.max(1, ...reeksen.flatMap((r) => r.waarden))
  const n = Math.max(1, punten.length)
  const groep = (w - pad.l - pad.r) / n
  const breedte = Math.max(1, (groep - 4) / reeksen.length)
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b)
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke="#e2e8f0" />
        {punten.map((p, i) =>
          reeksen.map((r, j) => (
            <rect
              key={`${i}:${r.label}`}
              x={pad.l + i * groep + 2 + j * breedte}
              y={y(r.waarden[i])}
              width={breedte}
              height={Math.max(0, y(0) - y(r.waarden[i]))}
              fill={r.kleur}
              rx="1"
            />
          )),
        )}
        {punten.length > 0 && (
          <>
            <text x={pad.l} y={h - 6} fontSize="9" fill="#94a3b8">
              {punten[0].datum}
            </text>
            <text x={w - pad.r} y={h - 6} fontSize="9" textAnchor="end" fill="#94a3b8">
              {punten[punten.length - 1].datum}
            </text>
          </>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {reeksen.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: r.kleur }} />
            {r.label} · {r.waarden.reduce((a, b) => a + b, 0)}
          </span>
        ))}
      </div>
    </div>
  )
}

function Tabel({ kolommen, rijen, leeg }) {
  if (rijen.length === 0) return <p className="text-xs text-slate-400">{leeg ?? '—'}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
            {kolommen.map((k) => (
              <th key={k.key} className={`pb-1.5 pr-3 font-medium ${k.rechts ? 'text-right' : ''}`}>
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rijen.map((rij, i) => (
            <tr key={rij.key ?? i} className={rij.onClick ? 'cursor-pointer hover:bg-slate-50' : ''} onClick={rij.onClick}>
              {kolommen.map((k) => (
                <td key={k.key} className={`py-1.5 pr-3 text-slate-700 ${k.rechts ? 'text-right tabular-nums' : ''}`}>
                  {rij[k.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RisicoBadge({ dep, language }) {
  const risk = calculateRisk(dep)
  const style = riskStyle(risk.level)
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>{translateRiskLevel(risk.level, language)}</span>
}

// Lijst van dependencies, ingeklapt vanaf een drempel; klik opent het detail.
function DepLijst({ deps, onSelect, teamName, language, tx, extra, max = 8, markeer }) {
  const [open, setOpen] = useState(false)
  if (deps.length === 0) return <p className="text-xs text-slate-400">{tx('geenData')}</p>
  const zichtbaar = open ? deps : deps.slice(0, max)
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {zichtbaar.map((dep) => (
          <li key={dep.id}>
            <button type="button" onClick={() => onSelect(dep)} className="flex w-full items-center gap-2 py-1.5 text-left text-xs hover:bg-slate-50">
              <span className="w-28 shrink-0 truncate text-slate-400">{teamName(dep.teamId)}</span>
              <span className={`min-w-0 flex-1 truncate ${markeer?.(dep) ? 'text-[#9a3b2e]' : 'text-slate-700'}`}>{dep.titel}</span>
              {extra && <span className="shrink-0 text-slate-400">{extra(dep)}</span>}
              {dep.gesloten_op && <span className="shrink-0 rounded bg-slate-200 px-1 text-[10px] text-slate-600">{tx('gesloten')}</span>}
              <RisicoBadge dep={dep} language={language} />
            </button>
          </li>
        ))}
      </ul>
      {deps.length > max && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-[11px] font-medium text-[#2a5f8a] hover:underline">
          {open ? tx('verberg') : tx('toon', { n: deps.length })}
        </button>
      )}
    </div>
  )
}

function Uitklap({ label, aantal, children }) {
  return (
    <details className="group rounded-md border border-slate-100">
      <summary className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-xs text-slate-700">
        <span>{label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">{aantal}</span>
      </summary>
      <div className="border-t border-slate-100 px-2.5 py-2">{children}</div>
    </details>
  )
}

const ERNST_LABEL = { hoog: 'ernstHoog', midden: 'ernstMidden', laag: 'ernstLaag' }

function Waarschuwingen({ signalen, ctx, onSelect, onNavigateToTeam, tx }) {
  const [alle, setAlle] = useState(false)
  if (signalen.length === 0) return <p className="text-xs text-slate-400">{tx('waarschuwingenGeen')}</p>
  const zichtbaar = alle ? signalen : signalen.slice(0, 25)
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {zichtbaar.map((s, i) => {
          const dep = s.params?.dep
          const teamId = s.params?.teamId ?? s.params?.teamIdA
          const klik = dep ? () => onSelect(dep) : teamId ? () => onNavigateToTeam(teamId) : null
          return (
            <li key={`${s.key}:${dep?.id ?? teamId ?? ''}:${i}`}>
              <button type="button" disabled={!klik} onClick={klik ?? undefined} className="flex w-full items-start gap-2 py-1.5 text-left text-xs hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent">
                <span className={`mt-px shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ERNST_STIJL[s.ernst]}`}>{tx(ERNST_LABEL[s.ernst])}</span>
                <span className="text-slate-700">{signaalZin(s, ctx)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {signalen.length > 25 && (
        <button type="button" onClick={() => setAlle((v) => !v)} className="mt-1.5 text-[11px] font-medium text-[#2a5f8a] hover:underline">
          {alle ? tx('toonMinder') : tx('toonAlle', { n: signalen.length })}
        </button>
      )}
    </div>
  )
}

function Rapport({ rapport, titel, bestandsnaam, tx }) {
  const [gekopieerd, setGekopieerd] = useState(false)
  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(rapportAlsTekst(rapport, titel))
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2000)
    } catch {
      // Klembord niet beschikbaar (bv. zonder https): dan blijft de knop gewoon staan.
    }
  }
  const download = () => exportTextAsFile(rapportAlsMarkdown(rapport, titel), bestandsnaam)
  const laatste = rapport[rapport.length - 1]?.kop
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-slate-400">{tx('rapportUitleg')}</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={kopieer} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            {gekopieerd ? tx('rapportGekopieerd') : tx('rapportKopieer')}
          </button>
          <button type="button" onClick={download} title={tx('rapportDownloadTitel')} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            {tx('rapportDownload')}
          </button>
        </div>
      </div>
      <div className="mt-3 gap-8 lg:columns-2">
        {rapport.map((s) => (
          <div key={s.kop} className="mb-4 break-inside-avoid">
            <h3 className="text-sm font-semibold text-slate-800">{s.kop}</h3>
            {s.kop === laatste ? (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-slate-700">
                {s.zinnen.map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{s.zinnen.join(' ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const SECTIES = [
  ['an-overzicht', 'sOverzicht'],
  ['an-rapport', 'sRapport'],
  ['an-waarschuwingen', 'sWaarschuwingen'],
  ['an-constateringen', 'sConstateringen'],
  ['an-trends', 'sTrends'],
  ['an-risico', 'sRisico'],
  ['an-verdeling', 'sVerdeling'],
  ['an-concentratie', 'sConcentratie'],
  ['an-keten', 'sKeten'],
  ['an-proces', 'sProces'],
  ['an-flowverlies', 'sFlowverlies'],
  ['an-doorloop', 'sDoorloop'],
  ['an-kwaliteit', 'sKwaliteit'],
  ['an-beheer', 'sBeheer'],
]

function SectieNav({ tx, verborgen = [] }) {
  const spring = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label={tx('navSpring')}>
      <span className="mr-1 text-slate-400">{tx('navSpring')}</span>
      {SECTIES.filter(([id]) => !verborgen.includes(id)).map(([id, key]) => (
        <button key={id} type="button" onClick={() => spring(id)} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 hover:border-slate-400 hover:text-slate-800">
          {tx(key)}
        </button>
      ))}
    </nav>
  )
}

// --- de pagina ------------------------------------------------------------

export default function AnalysePage({ onSelect, onNavigateToTeam }) {
  // activeTeams i.p.v. teams: een gearchiveerd team hoort niet als 'slapend'
  // of in de scorekaart op te duiken; zijn dependencies blijven wel meetellen
  // in de totalen (ze bestaan nog).
  const { activeTeams: teams, alleDependencies, teamWorkflows, externalParties, changeLog, teamName, adminSettings } = useAppContext()
  const { language } = useLanguage()
  const [teamFilter, setTeamFilter] = useState('')
  const [weken, setWeken] = useState(26)
  const tx = (key, vars) => vul(TEKST[language]?.[key] ?? TEKST.nl[key] ?? key, vars)

  const a = useMemo(
    () => analyseer({ teams, alleDependencies, teamWorkflows, externalParties, changeLog, teamFilter: teamFilter || null, uitgebreideAnalyse: adminSettings.uitgebreideAnalyse }),
    [teams, alleDependencies, teamWorkflows, externalParties, changeLog, teamFilter, adminSettings.uitgebreideAnalyse],
  )
  const trend = useMemo(() => trendReeks(a.alle, { weken }), [a.alle, weken])

  const dagenGeleden = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  const gesloten90 = a.alle.filter((d) => d.gesloten_op && d.gesloten_op >= dagenGeleden(90)).length
  const nieuw30 = a.alle.filter((d) => d.aangemaakt_op && d.aangemaakt_op >= dagenGeleden(30)).length
  const openNietGemitigeerd = a.open.filter((d) => d.status !== 'gemitigeerd')
  const metAfspraak = openNietGemitigeerd.filter((d) => d.actieAfspraak?.trim()).length
  const pct = (n, tot) => (tot > 0 ? `${Math.round((n / tot) * 100)}%` : '—')
  const v = a.vergelijking
  const delta = (k) => (v.nu[k] !== null && v.toen[k] !== null ? Math.round((v.nu[k] - v.toen[k]) * 10) / 10 : null)
  const gemScore = a.open.length > 0 ? Math.round((a.open.reduce((s, d) => s + calculateRisk(d).score, 0) / a.open.length) * 10) / 10 : null
  const constateringTekst = (c) => {
    const key = `c${c.key.charAt(0).toUpperCase()}${c.key.slice(1)}`
    const vars = {
      partijen: (c.partijen ?? []).join(', '),
      apps: (c.apps ?? []).map((s) => `${s.app.naam} (${teamName(s.teamId)})`).join(', '),
      teams: (c.teams ?? []).map((id) => teamName(id)).join(', '),
      fasen: (c.fasen ?? []).map((s) => translateWorkflowStage(s, language)).join(', '),
      paren: (c.paren ?? []).map((w) => `${teamName(w.a)} ↔ ${teamName(w.b)}`).join(', '),
    }
    return tx(key, vars)
  }
  const stageLabel = (s) => translateWorkflowStage(s, language)
  const ctx = useMemo(() => ({ language, teamName }), [language, teamName])
  const rapport = useMemo(() => bouwRapport(a, ctx), [a, ctx])
  const constateringZinnen = useMemo(() => Object.fromEntries(a.constateringen.map((c) => [c.key, constateringZin(c, ctx)])), [a, ctx])
  const rapportTitel = `${tx('rapportTitel')} · ${teamFilter ? teamName(teamFilter) : tx('alleTeams')}`
  // Bestandsnaam draagt het bereik en de dag, zodat twee downloads naast elkaar te leggen zijn.
  const rapportBestand = `dependency-insight-rapport-${slugify(teamFilter ? teamName(teamFilter) : tx('alleTeams'))}-${dagenGeleden(0)}.md`

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-800">{tx('titel')}</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-400">{tx('intro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-slate-500">
            {tx('teamFilter')}
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
              <option value="">{tx('alleTeams')}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {teamName(tm.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">
            {tx('periode')}
            <select value={weken} onChange={(e) => setWeken(Number(e.target.value))} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
              {[13, 26, 52].map((n) => (
                <option key={n} value={n}>
                  {tx('weken', { n })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <SectieNav tx={tx} verborgen={a.uitgebreideAnalyse ? [] : ['an-flowverlies']} />

      <Sectie id="an-overzicht" titel={tx('sOverzicht')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tegel label={tx('tOpen')} waarde={a.open.length} delta={delta('open')} sub={tx('vsToen')} />
          <Tegel label={tx('tKritiek')} waarde={a.port.perNiveau.Kritiek} delta={delta('kritiek')} sub={tx('vsToen')} kleur={riskStyle('Kritiek').hex} />
          <Tegel label={tx('tHoog')} waarde={a.port.perNiveau.Hoog + a.port.perNiveau.Kritiek} delta={delta('hoogOfKritiek')} sub={tx('vsToen')} kleur={riskStyle('Hoog').hex} />
          <Tegel label={tx('tBlokkerend')} waarde={a.port.perStatus['actief blokkerend'] ?? 0} delta={delta('blokkerend')} sub={tx('vsToen')} kleur={STATUS_KLEUR['actief blokkerend']} />
          <Tegel label={tx('tScore')} waarde={gemScore} delta={delta('gemiddeldeScore')} sub={tx('vsToen')} />
          <Tegel label={tx('tVerouderd')} waarde={pct(a.port.verouderd.length, a.open.length)} sub={`${a.port.verouderd.length}`} />
          <Tegel label={tx('tAfspraak')} waarde={pct(openNietGemitigeerd.length - metAfspraak, openNietGemitigeerd.length)} sub={`${openNietGemitigeerd.length - metAfspraak}`} />
          <Tegel label={tx('tGeaccepteerd')} waarde={a.port.geaccepteerd.length} />
          <Tegel label={tx('tGesloten90')} waarde={gesloten90} />
          <Tegel label={tx('tNieuw30')} waarde={nieuw30} />
          <Tegel label={tx('tMitigatie')} waarde={a.doorloopSamenvatting.gemiddeldTotMitigatie} sub={`n = ${a.doorloopSamenvatting.aantalGemitigeerd}`} />
          <Tegel label={tx('tVerzoeken')} waarde={a.keten.verzoeken.length} />
        </div>
      </Sectie>

      <Sectie id="an-rapport" titel={tx('sRapport')}>
        <Rapport rapport={rapport} titel={rapportTitel} bestandsnaam={rapportBestand} tx={tx} />
      </Sectie>

      <Sectie id="an-waarschuwingen" titel={tx('sWaarschuwingen')}>
        <Kaart titel={`${tx('sWaarschuwingen')} · ${a.signalen.length}`} uitleg={tx('waarschuwingenUitleg')}>
          <Waarschuwingen signalen={a.signalen} ctx={ctx} onSelect={onSelect} onNavigateToTeam={onNavigateToTeam} tx={tx} />
        </Kaart>
      </Sectie>

      <Sectie id="an-constateringen" titel={tx('sConstateringen')}>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {a.constateringen.length === 0 ? (
            <p className="text-xs text-slate-400">{tx('cGeen')}</p>
          ) : (
            <ul className="space-y-2">
              {a.constateringen.map((c) => (
                <li key={c.key} className={`rounded-lg border px-3 py-2 ${ERNST_STIJL[c.ernst]}`}>
                  <details>
                    <summary className="flex cursor-pointer items-center gap-2 text-xs">
                      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{tx(`ernst${c.ernst.charAt(0).toUpperCase()}${c.ernst.slice(1)}`)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{constateringTekst(c)}</span>
                        {constateringZinnen[c.key] && <span className="mt-0.5 block text-[11px] font-normal leading-relaxed opacity-80">{constateringZinnen[c.key]}</span>}
                      </span>
                      <span className="shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{c.aantal}</span>
                    </summary>
                    {c.key !== 'backlogGroei' && (
                    <div className="mt-2 rounded-md bg-white p-2">
                      {/* Logregels (reviewOud) éérst: die dragen ook een titel en
                          teamId, en werden anders als dependency gerenderd —
                          met een nep-risicobadge en een detailpaneel op een
                          logregel. */}
                      {c.records[0]?.timestamp ? (
                        <ul className="text-xs text-slate-700">
                          {c.records.map((r) => (
                            <li key={r.id}>
                              {teamName(r.teamId)} · {r.titel} · {tx('dagen', { n: r.leeftijd })}
                            </li>
                          ))}
                        </ul>
                      ) : c.records[0]?.titel !== undefined ? (
                        <DepLijst deps={c.records} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
                      ) : c.verzoeken ? (
                        <ul className="text-xs text-slate-700">
                          {c.verzoeken.map((vz) => (
                            <li key={vz.item.id}>
                              {teamName(vz.teamId)} · {vz.item.label} · {tx('dagen', { n: vz.leeftijd ?? '?' })}
                            </li>
                          ))}
                        </ul>
                      ) : c.records[0]?.naam !== undefined ? (
                        <ul className="text-xs text-slate-700">
                          {c.records.map((r) => (
                            <li key={r.id}>{r.naam}</li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="text-xs text-slate-700">
                          {c.records.map((r, i) => (
                            <li key={r.id ?? r.teamId ?? r.stage ?? i}>{r.naam ?? (r.teamId ? teamName(r.teamId) : r.stage ? stageLabel(r.stage) : '—')}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sectie>

      <Sectie id="an-trends" titel={tx('sTrends')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kOpenStatus')} uitleg={tx('uOpenStatus')}>
            <Lijnen
              punten={trend}
              reeksen={['bekend risico', 'actief blokkerend', 'gemitigeerd'].map((s) => ({ label: translateStatus(s, language), kleur: STATUS_KLEUR[s], waarden: trend.map((p) => p.perStatus[s] ?? 0) }))}
            />
          </Kaart>
          <Kaart titel={tx('kOpenNiveau')} uitleg={tx('uOpenNiveau')}>
            <Lijnen punten={trend} reeksen={NIVEAUS.map((n) => ({ label: translateRiskLevel(n, language), kleur: riskStyle(n).hex, waarden: trend.map((p) => p.perNiveau[n]) }))} />
          </Kaart>
          <Kaart titel={tx('kNieuwGesloten')} uitleg={tx('uNieuwGesloten')}>
            <Staven
              punten={trend}
              reeksen={[
                { label: tx('aangemaakt'), kleur: '#2a5f8a', waarden: trend.map((p) => p.nieuw) },
                { label: tx('geslotenKop'), kleur: '#5c8a72', waarden: trend.map((p) => p.gesloten) },
              ]}
            />
          </Kaart>
          <Kaart titel={tx('kScore')} uitleg={tx('uScore')}>
            <Lijnen punten={trend} reeksen={[{ label: tx('kScore'), kleur: '#7a5c8a', waarden: trend.map((p) => p.scoreSom) }]} />
          </Kaart>
          <Kaart titel={tx('kVerandering')} uitleg={tx('uVerandering')}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('verslechterd')} · {a.verandering.verslechterd.length}
                </div>
                <DepLijst deps={a.verandering.verslechterd.map((r) => r.dep)} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} extra={(d) => { const r = a.verandering.verslechterd.find((x) => x.dep.id === d.id); return `${r.van} → ${r.naar}` }} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('verbeterd')} · {a.verandering.verbeterd.length}
                </div>
                <DepLijst deps={a.verandering.verbeterd.map((r) => r.dep)} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} extra={(d) => { const r = a.verandering.verbeterd.find((x) => x.dep.id === d.id); return `${r.van} → ${r.naar}` }} />
              </div>
            </div>
          </Kaart>
          <Kaart titel={tx('kProjectie')} uitleg={tx('uProjectie')}>
            {a.proj ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Tegel label={tx('pNieuwPerWeek')} waarde={a.proj.nieuwPerWeek} />
                <Tegel label={tx('pGeslotenPerWeek')} waarde={a.proj.geslotenPerWeek} />
                <Tegel label={tx('pNetto')} waarde={a.proj.nettoPerWeek > 0 ? `+${a.proj.nettoPerWeek}` : a.proj.nettoPerWeek} kleur={a.proj.nettoPerWeek > 0 ? '#c1552c' : undefined} />
                <Tegel label={tx('pOverHorizon')} waarde={a.proj.openOverHorizon} sub={`${tx('open')}: ${a.proj.openNu}`} />
                <Tegel label={tx('pWekenTotLeeg')} waarde={a.proj.wekenTotLeeg ?? '—'} />
              </div>
            ) : (
              <p className="text-xs text-slate-400">{tx('geenData')}</p>
            )}
          </Kaart>
          <Kaart titel={tx('kOvergangen')} uitleg={tx('uOvergangen')} breed>
            <div className="grid gap-3 md:grid-cols-3">
              <Tabel
                kolommen={[
                  { key: 'van', label: tx('van') },
                  { key: 'naar', label: tx('naar') },
                  { key: 'aantal', label: tx('aantal'), rechts: true },
                ]}
                rijen={a.overgangen.matrix.map((r) => ({ key: `${r.van}>${r.naar}`, van: translateStatus(r.van, language), naar: translateStatus(r.naar, language), aantal: r.aantal }))}
              />
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('teruggevallen')} · {a.overgangen.teruggevallen.length}
                </div>
                <DepLijst deps={a.overgangen.teruggevallen.map((r) => r.dep)} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={5} extra={(d) => a.overgangen.teruggevallen.find((r) => r.dep.id === d.id)?.datum} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('heropend')} · {a.overgangen.heropend.length}
                </div>
                <DepLijst deps={a.overgangen.heropend.map((r) => r.dep)} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={5} extra={(d) => a.overgangen.heropend.find((r) => r.dep.id === d.id)?.datum} />
              </div>
            </div>
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-risico" titel={tx('sRisico')}>
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Kwadranten bestaan bij gratie van de profielvelden (uitgebreide
              analyse); zonder die toggle zou alles in 'onvolledig' belanden. */}
          {a.uitgebreideAnalyse && (
          <Kaart titel={tx('kKwadranten')} uitleg={tx('uKwadranten')} breed>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {[
                ['quick_win', 'qQuickWin'],
                ['opschalen', 'qOpschalen'],
                ['opruimen', 'qOpruimen'],
                ['accepteren', 'qAccepteren'],
                ['onvolledig', 'qOnvolledig'],
              ].map(([key, label]) => (
                <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-700">{tx(label)}</span>
                    <span className="text-lg font-semibold tabular-nums text-slate-800">{a.port.kwadranten[key].length}</span>
                  </div>
                  <DepLijst deps={a.port.kwadranten[key]} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={4} />
                </div>
              ))}
            </div>
          </Kaart>
          )}
          <Kaart titel={tx('kStil')} uitleg={tx('uStil')}>
            <DepLijst deps={a.port.stilRisico} onSelect={onSelect} teamName={teamName} language={language} tx={tx} />
          </Kaart>
          <Kaart titel={tx('kQuick')} uitleg={tx('uQuick')}>
            <DepLijst deps={a.port.quickWins} onSelect={onSelect} teamName={teamName} language={language} tx={tx} />
          </Kaart>
          <Kaart titel={tx('kDeadlines')} uitleg={tx('uDeadlines')}>
            <DepLijst
              deps={a.port.deadlines}
              onSelect={onSelect}
              teamName={teamName}
              language={language}
              tx={tx}
              max={10}
              extra={(d) => `${translateDeadline(d.deadline, language)} · ${d.deadlineTekst}`}
              markeer={(d) => !d.actieAfspraak?.trim()}
            />
          </Kaart>
          <Kaart titel={tx('kGemitigeerdHoog')} uitleg={tx('uGemitigeerdHoog')}>
            <DepLijst deps={a.port.gemitigeerdMaarHoog} onSelect={onSelect} teamName={teamName} language={language} tx={tx} />
          </Kaart>
          <Kaart titel={tx('kAcuut')} uitleg={tx('uAcuut')}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('acuut')} · {a.port.acuut.length}
                </div>
                <DepLijst deps={a.port.acuut} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={5} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('chronisch')} · {a.port.chronisch.length}
                </div>
                <DepLijst deps={a.port.chronisch} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={5} />
              </div>
            </div>
          </Kaart>
          <Kaart titel={tx('kAfspraak')} uitleg={tx('uAfspraak')}>
            <Balken
              rijen={[
                { label: tx('metAfspraak'), waarde: metAfspraak, kleur: '#5c8a72' },
                { label: tx('zonderAfspraak'), waarde: openNietGemitigeerd.length - metAfspraak, kleur: '#9a3b2e' },
                { label: tx('gemitigeerdZonder'), waarde: a.port.gemitigeerdZonderTekst.length, kleur: WARM },
                { label: tx('mitigatieZonderStatus'), waarde: a.port.mitigatieZonderStatus.length, kleur: '#7a5c8a' },
              ]}
            />
          </Kaart>
          <Kaart titel={tx('kTop')} uitleg={tx('uTop')}>
            <DepLijst deps={a.port.top} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={15} extra={(d) => calculateRisk(d).score} />
          </Kaart>
          <Kaart titel={tx('kLeeftijd')} uitleg={tx('uLeeftijd')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                ...LEEFTIJD_KLASSEN.map((k) => ({ key: k.key, label: k.key, rechts: true })),
                { key: 'gem', label: tx('gemiddeld'), rechts: true },
                { key: 'med', label: tx('mediaan'), rechts: true },
              ]}
              rijen={[
                ...a.leeftijd.perTeam.filter((r) => r.aantal > 0).map((r) => ({ key: r.teamId, team: teamName(r.teamId), ...r.klassen, gem: r.gemiddeld ?? '—', med: r.mediaan ?? '—', onClick: () => onNavigateToTeam(r.teamId) })),
                { key: 'totaal', team: <b>{tx('totaal')}</b>, ...a.leeftijd.totaal.klassen, gem: a.leeftijd.totaal.gemiddeld ?? '—', med: a.leeftijd.totaal.mediaan ?? '—' },
              ]}
            />
          </Kaart>
          <Kaart titel={tx('kLevensloop')} uitleg={tx('uLevensloop')}>
            <div className="space-y-2">
              <Uitklap label={tx('sluimerend')} aantal={a.port.sluimerend.length}>
                <DepLijst deps={a.port.sluimerend} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
              </Uitklap>
              <Uitklap label={tx('geparkeerdHoog')} aantal={a.port.geaccepteerdHoog.length}>
                <DepLijst deps={a.port.geaccepteerdHoog} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
              </Uitklap>
              <Uitklap label={tx('nietAfgesloten')} aantal={a.port.gemitigeerdNietGesloten.length}>
                <DepLijst deps={a.port.gemitigeerdNietGesloten.map((r) => r.dep)} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} extra={(d) => tx('dagen', { n: a.port.gemitigeerdNietGesloten.find((r) => r.dep.id === d.id)?.dagen ?? 0 })} />
              </Uitklap>
            </div>
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-verdeling" titel={tx('sVerdeling')}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Kaart titel={tx('kNiveau')} uitleg={tx('uVerdeling')}>
            <Balken rijen={NIVEAUS.map((n) => ({ label: translateRiskLevel(n, language), waarde: a.port.perNiveau[n], kleur: riskStyle(n).hex }))} />
          </Kaart>
          <Kaart titel={tx('kStatus')} uitleg={tx('uVerdeling')}>
            <Balken rijen={Object.entries(a.port.perStatus).map(([s, n]) => ({ label: translateStatus(s, language), waarde: n, kleur: STATUS_KLEUR[s] }))} />
          </Kaart>
          <Kaart titel={`${tx('kScope')} · ${tx('kFlowtype')}`} uitleg={tx('uVerdeling')}>
            <Balken
              rijen={[
                ...Object.entries(a.port.perScope).map(([s, n]) => ({ label: translateScope(s, language), waarde: n })),
                ...Object.entries(a.port.perFlowtype).map(([f, n]) => ({ label: f === 'onbepaald' ? tx('zonderFlowtype') : translateFlowtype(f, language), waarde: n, kleur: '#7a5c8a' })),
              ]}
            />
          </Kaart>
          <Kaart titel={tx('kCategorie')} uitleg={tx('uVerdeling')}>
            <Balken rijen={a.port.perCategorie.map(([c, n]) => ({ label: translateCategorie(c, language), waarde: n }))} />
          </Kaart>
          <Kaart titel={tx('kEffect')} uitleg={tx('uVerdeling')}>
            <Balken rijen={a.port.perEffect.map(([e, n]) => ({ label: translateEffectOpFlow(e, language), waarde: n, kleur: WARM }))} />
          </Kaart>
          <Kaart titel={tx('kHotspots')} uitleg={tx('uHotspots')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'categorie', label: tx('categorie') },
                { key: 'aantal', label: tx('aantal'), rechts: true },
                { key: 'factor', label: tx('factor'), rechts: true },
                { key: 'hoogste', label: tx('hoogste') },
              ]}
              rijen={a.hotspots.slice(0, 12).map((c) => ({
                key: `${c.teamId}:${c.categorie}`,
                team: teamName(c.teamId),
                categorie: translateCategorie(c.categorie, language),
                aantal: c.aantal,
                factor: `${c.factor}×`,
                hoogste: translateRiskLevel(c.hoogste, language),
                onClick: () => onSelect(c.deps[0]),
              }))}
            />
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-concentratie" titel={tx('sConcentratie')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kPartijen')} uitleg={tx('uPartijen')} breed>
            <Tabel
              kolommen={[
                { key: 'naam', label: tx('partij') },
                { key: 'type', label: tx('type') },
                { key: 'status', label: tx('status') },
                { key: 'teams', label: tx('teams'), rechts: true },
                { key: 'deps', label: tx('deps'), rechts: true },
                { key: 'blokkerend', label: tx('blokkerend'), rechts: true },
                { key: 'io', label: tx('io'), rechts: true },
                { key: 'hoogste', label: tx('hoogste') },
                { key: 'flowverlies', label: tx('flowverlies'), rechts: true },
              ]}
              rijen={a.partijen.map((p) => ({
                key: p.key,
                naam: p.naam,
                type: translateBronType(p.type, language) || '—',
                status: p.status === 'niet_in_register' ? tx('nietInRegister') : translateExternalPartyStatus(p.status, language),
                teams: p.aantalTeams,
                deps: p.deps.length,
                blokkerend: p.blokkerend,
                io: `${p.inputs}/${p.outputs}`,
                hoogste: p.hoogste ? translateRiskLevel(p.hoogste, language) : '—',
                flowverlies: p.flowverlies,
                onClick: p.deps[0] ? () => onSelect(p.deps[0]) : undefined,
              }))}
            />
          </Kaart>
          <Kaart titel={tx('kTeamOpTeam')} uitleg={tx('uTeamOpTeam')}>
            <Tabel
              kolommen={[
                { key: 'veroorzaker', label: tx('veroorzaker') },
                { key: 'getroffen', label: tx('getroffen') },
                { key: 'aantal', label: tx('aantal'), rechts: true },
                { key: 'hoogste', label: tx('hoogste') },
              ]}
              rijen={a.teamOpTeam.rijen.map((r) => ({
                key: `${r.veroorzaker}->${r.getroffen}`,
                veroorzaker: teamName(r.veroorzaker),
                getroffen: teamName(r.getroffen),
                aantal: r.aantal,
                hoogste: translateRiskLevel(r.hoogste, language),
                onClick: () => onSelect(r.deps[0]),
              }))}
            />
            <div className="mt-3">
              <Tabel
                kolommen={[
                  { key: 'team', label: tx('team') },
                  { key: 'veroorzaakt', label: tx('veroorzaakt'), rechts: true },
                  { key: 'ondervonden', label: tx('ondervonden'), rechts: true },
                  { key: 'netto', label: tx('netto'), rechts: true },
                ]}
                rijen={a.teamOpTeam.balans
                  .filter((b) => b.veroorzaakt + b.ondervonden > 0)
                  .sort((x, y) => y.netto - x.netto)
                  .map((b) => ({ key: b.teamId, team: teamName(b.teamId), veroorzaakt: b.veroorzaakt, ondervonden: b.ondervonden, netto: b.netto > 0 ? `+${b.netto}` : b.netto, onClick: () => onNavigateToTeam(b.teamId) }))}
              />
            </div>
          </Kaart>
          <Kaart titel={tx('kKennis')} uitleg={tx('uKennis')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'score', label: tx('score'), rechts: true },
                { key: 'kennis', label: tx('kennisDeps'), rechts: true },
                { key: 'kennisHoog', label: tx('kennisHoog'), rechts: true },
                { key: 'risicoRijen', label: tx('risicoRijen'), rechts: true },
                { key: 'appsRisico', label: tx('appsRisico'), rechts: true },
                { key: 'senior', label: `${tx('senior')}/${tx('junior')}` },
              ]}
              rijen={a.kennis.map((k) => ({
                key: k.teamId,
                team: teamName(k.teamId),
                score: k.score,
                kennis: k.kennis,
                kennisHoog: k.kennisHoog,
                risicoRijen: k.risicoRijen,
                appsRisico: k.appsRisico,
                senior: `${k.senior}/${k.junior}`,
                onClick: () => onNavigateToTeam(k.teamId),
              }))}
            />
          </Kaart>
          <Kaart titel={tx('kScorekaart')} uitleg={tx('uScorekaart')} breed>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'open', label: tx('open'), rechts: true },
                { key: 'delta30', label: tx('delta30'), rechts: true },
                { key: 'hoogPlus', label: tx('hoogPlus'), rechts: true },
                { key: 'kritiek', label: tx('kritiekKort'), rechts: true },
                { key: 'blokkerend', label: tx('blokkerend'), rechts: true },
                { key: 'gemScore', label: tx('gemScoreKort'), rechts: true },
                { key: 'verouderdPct', label: tx('verouderdPct'), rechts: true },
                { key: 'afspraakPct', label: tx('afspraakPct'), rechts: true },
                { key: 'flowverlies', label: tx('flowverlies'), rechts: true },
                { key: 'gesloten90', label: tx('gesloten90'), rechts: true },
                { key: 'kennisScore', label: tx('kennisScore'), rechts: true },
              ]}
              rijen={[
                ...a.scorekaart.rijen.map((r) => ({
                  key: r.teamId,
                  team: r.teamId === teamFilter ? <b>{teamName(r.teamId)}</b> : teamName(r.teamId),
                  open: r.open,
                  delta30: r.delta30 > 0 ? `+${r.delta30}` : r.delta30,
                  hoogPlus: r.hoogPlus,
                  kritiek: r.kritiek,
                  blokkerend: r.blokkerend,
                  gemScore: r.gemScore ?? '—',
                  verouderdPct: r.verouderdPct === null ? '—' : `${r.verouderdPct}%`,
                  afspraakPct: r.afspraakPct === null ? '—' : `${r.afspraakPct}%`,
                  flowverlies: r.flowverlies,
                  gesloten90: r.gesloten90,
                  kennisScore: r.kennisScore,
                  onClick: () => onNavigateToTeam(r.teamId),
                })),
                {
                  key: 'gemiddeld',
                  team: <span className="text-slate-400">{tx('gemiddeldPerTeam')}</span>,
                  open: a.scorekaart.gemiddeld.open ?? '—',
                  delta30: a.scorekaart.gemiddeld.delta30 ?? '—',
                  hoogPlus: a.scorekaart.gemiddeld.hoogPlus ?? '—',
                  kritiek: a.scorekaart.gemiddeld.kritiek ?? '—',
                  blokkerend: a.scorekaart.gemiddeld.blokkerend ?? '—',
                  gemScore: a.scorekaart.gemiddeld.gemScore ?? '—',
                  verouderdPct: a.scorekaart.gemiddeld.verouderdPct === null ? '—' : `${a.scorekaart.gemiddeld.verouderdPct}%`,
                  afspraakPct: a.scorekaart.gemiddeld.afspraakPct === null ? '—' : `${a.scorekaart.gemiddeld.afspraakPct}%`,
                  flowverlies: a.scorekaart.gemiddeld.flowverlies ?? '—',
                  gesloten90: a.scorekaart.gemiddeld.gesloten90 ?? '—',
                  kennisScore: a.scorekaart.gemiddeld.kennisScore ?? '—',
                },
              ]}
            />
          </Kaart>
          <Kaart titel={tx('kPareto')} uitleg={tx('uPareto')} breed>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ['top3Partijen', a.concentratie.partijen, (naam) => naam],
                ['top3Categorieen', a.concentratie.categorieen, (naam) => translateCategorie(naam, language)],
                ['top3Teams', a.concentratie.teams, (naam) => teamName(naam)],
              ].map(([label, c, naam]) => (
                <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-700">{tx(label)}</span>
                    <span className="text-lg font-semibold tabular-nums text-slate-800">{c.aandeel}%</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {c.top.map((r) => (
                      <li key={r.naam} className="flex justify-between gap-2">
                        <span className="truncate">{naam(r.naam)}</span>
                        <span className="tabular-nums">{r.aantal}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 text-[10px] text-slate-400">{tx('vanTotaal', { n: c.totaal })}</div>
                </div>
              ))}
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="text-xs font-semibold text-slate-700">{tx('topCategoriePerTeam')}</div>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {a.concentratie.perTeamTopCategorie.filter((r) => r.categorie).map((r) => (
                    <li key={r.teamId} className="flex justify-between gap-2">
                      <span className="truncate">{teamName(r.teamId)} · {translateCategorie(r.categorie, language)}</span>
                      <span className="shrink-0 tabular-nums">{r.aandeel}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-keten" titel={tx('sKeten')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kKetenTeams')} uitleg={tx('uKetenTeams')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'inkomend', label: tx('inkomend'), rechts: true },
                { key: 'uitgaand', label: tx('uitgaand'), rechts: true },
                { key: 'partners', label: tx('partners'), rechts: true },
              ]}
              rijen={a.keten.perTeam.map((r) => ({ key: r.teamId, team: teamName(r.teamId), inkomend: r.inkomend, uitgaand: r.uitgaand, partners: `${r.partnersIn}/${r.partnersUit}`, onClick: () => onNavigateToTeam(r.teamId) }))}
            />
          </Kaart>
          <Kaart titel={tx('kCycli')} uitleg={tx('uCycli')}>
            {a.keten.cycli.length === 0 ? (
              <p className="text-xs text-slate-400">{tx('geenCycli')}</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-700">
                {a.keten.cycli.map((c) => (
                  <li key={c.join('|')}>{[...c, c[0]].map((id) => teamName(id)).join(' → ')}</li>
                ))}
              </ul>
            )}
          </Kaart>
          <Kaart titel={tx('kLos')} uitleg={tx('uLos')}>
            <div className="space-y-2">
              <Uitklap label={tx('losseInputs')} aantal={a.keten.losseInputs.length}>
                <ul className="text-xs text-slate-700">
                  {a.keten.losseInputs.map((x) => (
                    <li key={x.item.id}>
                      {teamName(x.teamId)} · {x.item.label}
                    </li>
                  ))}
                </ul>
              </Uitklap>
              <Uitklap label={tx('losseOutputs')} aantal={a.keten.losseOutputs.length}>
                <ul className="text-xs text-slate-700">
                  {a.keten.losseOutputs.map((x) => (
                    <li key={x.item.id}>
                      {teamName(x.teamId)} · {x.item.label}
                    </li>
                  ))}
                </ul>
              </Uitklap>
            </div>
          </Kaart>
          <Kaart titel={tx('kVerzoeken')} uitleg={tx('uVerzoeken')}>
            <div className="mb-2 text-xs text-slate-600">
              {tx('gemDoorlooptijd')}: <b>{a.keten.goedkeuring.gemiddeld ?? '—'}</b> {tx('dag')} (n = {a.keten.goedkeuring.aantal})
            </div>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'label', label: tx('titelKol') },
                { key: 'kind', label: tx('type') },
                { key: 'leeftijd', label: tx('dag'), rechts: true },
              ]}
              rijen={a.keten.verzoeken.map((vz) => ({ key: vz.item.id, team: teamName(vz.teamId), label: vz.item.label, kind: tx(vz.kind === 'input' ? 'kindInput' : 'kindOutput'), leeftijd: vz.leeftijd ?? '—', onClick: () => onNavigateToTeam(vz.item.linkedTeam) }))}
              leeg={tx('geenData')}
            />
            {a.keten.afgewezen.length > 0 && (
              <div className="mt-2 text-xs text-slate-500">
                {tx('afgewezen')}: {a.keten.afgewezen.map((x) => `${teamName(x.teamId)} · ${x.item.label}`).join('; ')}
              </div>
            )}
          </Kaart>
          <Kaart titel={tx('kMismatch')} uitleg={tx('uMismatch')} breed>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('depZonderKoppeling')} · {a.keten.depZonderKoppeling.length}
                </div>
                <DepLijst deps={a.keten.depZonderKoppeling.map((x) => x.dep)} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} extra={(d) => `→ ${teamName(a.keten.depZonderKoppeling.find((x) => x.dep.id === d.id)?.cause)}`} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {tx('koppelingZonderDep')} · {a.keten.koppelingZonderDep.length}
                </div>
                <ul className="text-xs text-slate-700">
                  {a.keten.koppelingZonderDep.map((e) => (
                    <li key={e.id}>
                      {teamName(e.sourceTeam)} → {teamName(e.targetTeam)} · {e.sourceLabel}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Kaart>
          <Kaart titel={tx('kSpof')} uitleg={tx('uSpof')} breed>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'app', label: tx('applicatie') },
                { key: 'uitval', label: tx('uitval') },
                { key: 'deps', label: tx('deps'), rechts: true },
                { key: 'io', label: tx('io'), rechts: true },
                { key: 'conns', label: tx('koppelingen'), rechts: true },
                { key: 'hoogste', label: tx('hoogste') },
              ]}
              rijen={a.keten.spof.slice(0, 15).map((s) => ({
                key: `${s.teamId}:${s.app.id}`,
                team: teamName(s.teamId),
                app: s.app.naam || '—',
                uitval: s.risico ? '●' : '○',
                deps: s.deps,
                io: s.io,
                conns: s.conns,
                hoogste: s.hoogste ? translateRiskLevel(s.hoogste, language) : '—',
                onClick: () => onNavigateToTeam(s.teamId),
              }))}
            />
          </Kaart>
          <Kaart titel={tx('kKetenRisico')} uitleg={tx('uKetenRisico')} breed>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'direct', label: tx('direct'), rechts: true },
                { key: 'stroomop', label: tx('stroomop'), rechts: true },
                { key: 'stroomaf', label: tx('stroomaf'), rechts: true },
                { key: 'blok', label: tx('blokTL'), rechts: true },
                { key: 'hoog', label: tx('hoogTL'), rechts: true },
                { key: 'bevestigd', label: tx('bevestigd'), rechts: true },
              ]}
              rijen={a.ketenrisico.map((r) => ({ key: r.teamId, team: teamName(r.teamId), direct: r.direct, stroomop: r.stroomopwaarts, stroomaf: r.stroomafwaarts, blok: r.directBlokkerend, hoog: r.directHoog, bevestigd: r.bevestigd, onClick: () => onNavigateToTeam(r.teamId) }))}
            />
          </Kaart>
          <Kaart titel={tx('kWederzijds')} uitleg={tx('uWederzijds')}>
            {a.wederzijds.length === 0 ? (
              <p className="text-xs text-slate-400">{tx('geenWederzijds')}</p>
            ) : (
              <div className="space-y-2">
                {a.wederzijds.map((w) => (
                  <Uitklap key={`${w.a}|${w.b}`} label={`${teamName(w.a)} ↔ ${teamName(w.b)} · ${w.aNaarB} / ${w.bNaarA}`} aantal={w.deps.length}>
                    <DepLijst deps={w.deps} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
                  </Uitklap>
                ))}
              </div>
            )}
          </Kaart>
          <Kaart titel={tx('kKaart')} uitleg={tx('uKaart')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'inputs', label: tx('inputsVerklaard'), rechts: true },
                { key: 'outputs', label: tx('outputsVerklaard'), rechts: true },
                { key: 'apps', label: tx('appsDetail'), rechts: true },
                { key: 'punten', label: tx('koppelingenPunten'), rechts: true },
                { key: 'notities', label: tx('notities'), rechts: true },
                { key: 'volledigheid', label: tx('volledigheid'), rechts: true },
              ]}
              rijen={a.kaart.map((r) => ({
                key: r.teamId,
                team: teamName(r.teamId),
                inputs: `${r.inGekoppeld + r.inExtern}/${r.inputs}`,
                outputs: `${r.uitAfgenomen + r.uitExtern}/${r.outputs}`,
                apps: `${r.appsMetDetail}/${r.apps}`,
                punten: `${r.metPunten}/${r.koppelingen}`,
                notities: r.notities,
                volledigheid: r.volledigheid === null ? '—' : `${r.volledigheid}%`,
                onClick: () => onNavigateToTeam(r.teamId),
              }))}
            />
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-proces" titel={tx('sProces')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kWerkstappen')} uitleg={tx('uWerkstappen')}>
            <Tabel
              kolommen={[
                { key: 'stap', label: tx('stap') },
                { key: 'deps', label: tx('deps'), rechts: true },
                { key: 'blokkerend', label: tx('blokkerend'), rechts: true },
                { key: 'effecten', label: tx('effecten') },
                { key: 'personen', label: tx('personen'), rechts: true },
                { key: 'teams', label: tx('teamsMetCap'), rechts: true },
              ]}
              rijen={a.werkstappen.map((w) => ({
                key: w.stage,
                stap: stageLabel(w.stage),
                deps: w.deps,
                blokkerend: w.blokkerend,
                effecten: w.effecten.map(([e, n]) => `${translateEffectOpFlow(e, language)} ${n}`).join(', ') || '—',
                personen: w.personen,
                teams: w.teamsMetCapaciteit,
              }))}
            />
          </Kaart>
          <Kaart titel={tx('kProces')} uitleg={tx('uProces')}>
            <div className="space-y-2">
              {[
                ['zonderStap', a.proces.ontwikkelflowZonderStap],
                ['appOverstijgend', a.proces.applicatieOverstijgend],
                ['multiApp', a.proces.multiApp],
                ['zonderFlowtype', a.proces.zonderFlowtype],
              ].map(([label, deps]) => (
                <Uitklap key={label} label={tx(label)} aantal={deps.length}>
                  <DepLijst deps={deps} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
                </Uitklap>
              ))}
            </div>
          </Kaart>
          <Kaart titel={tx('kGedeeld')} uitleg={tx('uGedeeld')} breed>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'app', label: tx('applicatie') },
                { key: 'uitval', label: tx('uitval') },
                { key: 'deps', label: tx('deps'), rechts: true },
                { key: 'teams', label: tx('andereTeams') },
              ]}
              rijen={a.gedeeld.map((g) => ({ key: `${g.teamId}:${g.app.id}`, team: teamName(g.teamId), app: g.app.naam || '—', uitval: g.risico ? '●' : '○', deps: g.deps.length, teams: g.andereTeams.map((id) => teamName(id)).join(', '), onClick: () => (g.deps[0] ? onSelect(g.deps[0]) : onNavigateToTeam(g.teamId)) }))}
              leeg={tx('geenGedeeld')}
            />
          </Kaart>
        </div>
      </Sectie>

      {a.uitgebreideAnalyse && (
      <Sectie id="an-flowverlies" titel={tx('sFlowverlies')}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Kaart titel={tx('kFlowTeam')} uitleg={tx('uFlow')}>
            <Balken rijen={a.flowverlies.perTeam.map((r) => ({ label: teamName(r.teamId), waarde: r.som, tekst: `${r.som}${r.onvolledig ? ` (${r.onvolledig} ${tx('onvolledig')})` : ''}`, kleur: WARM }))} />
          </Kaart>
          <Kaart titel={tx('kFlowCategorie')} uitleg={tx('uFlow')}>
            <Balken rijen={a.flowverlies.perCategorie.slice(0, 10).map((r) => ({ label: translateCategorie(r.categorie, language), waarde: r.som, kleur: WARM }))} />
          </Kaart>
          <Kaart titel={tx('kFlowPartij')} uitleg={tx('uFlow')}>
            <Balken rijen={a.flowverlies.perPartij.filter((r) => r.som > 0).slice(0, 10).map((r) => ({ label: r.naam, waarde: r.som, kleur: WARM }))} />
          </Kaart>
        </div>
      </Sectie>
      )}

      <Sectie id="an-doorloop" titel={tx('sDoorloop')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kDoorloop')} uitleg={tx('uDoorloop')} breed>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Tegel label={tx('gemTotMitigatie')} waarde={a.doorloopSamenvatting.gemiddeldTotMitigatie} sub={`n = ${a.doorloopSamenvatting.aantalGemitigeerd}`} />
              <Tegel label={tx('medTotMitigatie')} waarde={a.doorloopSamenvatting.mediaanTotMitigatie} />
              <Tegel label={tx('gemTotSluiting')} waarde={a.doorloopSamenvatting.gemiddeldTotSluiting} sub={`n = ${a.doorloopSamenvatting.aantalGesloten}`} />
              <Tegel label={tx('medTotSluiting')} waarde={a.doorloopSamenvatting.mediaanTotSluiting} />
              <Tegel label={tx('ooitBlokkerend')} waarde={a.doorloopSamenvatting.aantalOoitBlokkerend} />
              <Tegel label={tx('gemBlokkerend')} waarde={a.doorloopSamenvatting.gemiddeldBlokkerend} />
            </div>
          </Kaart>
          <Kaart titel={tx('kDoorloopTeam')} uitleg={tx('uDoorloop')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'gemitigeerd', label: tx('gemitigeerd'), rechts: true },
                { key: 'gem', label: tx('gemTotMitigatie'), rechts: true },
                { key: 'gesloten', label: tx('geslotenKop'), rechts: true },
                { key: 'gemS', label: tx('gemTotSluiting'), rechts: true },
                { key: 'blok', label: tx('gemBlokkerend'), rechts: true },
              ]}
              rijen={a.doorloopPerTeam.map((r) => ({
                key: r.teamId,
                team: teamName(r.teamId),
                gemitigeerd: r.aantalGemitigeerd,
                gem: r.gemiddeldTotMitigatie ?? '—',
                gesloten: r.aantalGesloten,
                gemS: r.gemiddeldTotSluiting ?? '—',
                blok: r.gemiddeldBlokkerend ?? '—',
                onClick: () => onNavigateToTeam(r.teamId),
              }))}
            />
          </Kaart>
          <Kaart titel={tx('kLangstBlokkerend')} uitleg={tx('uLangstBlokkerend')}>
            <DepLijst
              deps={a.doorloop.filter((r) => !r.dep.gesloten_op && r.dep.status === 'actief blokkerend' && r.blokkerendDagen > 0).sort((x, y) => y.blokkerendDagen - x.blokkerendDagen).map((r) => r.dep)}
              onSelect={onSelect}
              teamName={teamName}
              language={language}
              tx={tx}
              extra={(d) => tx('dagen', { n: a.doorloop.find((r) => r.dep.id === d.id)?.blokkerendDagen ?? 0 })}
            />
          </Kaart>
          <Kaart titel={tx('kOoitBlokkerend')} uitleg={tx('uOoitBlokkerend')}>
            <DepLijst
              deps={a.doorloop.filter((r) => r.escalaties > 0).sort((x, y) => y.escalaties - x.escalaties || y.blokkerendDagen - x.blokkerendDagen).map((r) => r.dep)}
              onSelect={onSelect}
              teamName={teamName}
              language={language}
              tx={tx}
              extra={(d) => {
                const n = a.doorloop.find((r) => r.dep.id === d.id)?.escalaties ?? 0
                return tx(n === 1 ? 'escalatie' : 'escalatiesN', { n })
              }}
            />
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-kwaliteit" titel={tx('sKwaliteit')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kChecks')} uitleg={tx('uChecks')}>
            <div className="space-y-2">
              {a.hygiene.checks.map((c) => (
                <Uitklap key={c.key} label={tx(`h${c.key.charAt(0).toUpperCase()}${c.key.slice(1)}`)} aantal={c.records.length}>
                  <DepLijst deps={c.records} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
                </Uitklap>
              ))}
            </div>
          </Kaart>
          <Kaart titel={tx('kIoChecks')} uitleg={tx('uIoChecks')}>
            <div className="space-y-2">
              {['ioAppOnbekend', 'ioPartijOnbekend', 'ioZonderFlowtype'].map((key) => {
                const rijen = a.hygiene.ioChecks.filter((c) => c.key === key)
                return (
                  <Uitklap key={key} label={tx(key)} aantal={rijen.length}>
                    <ul className="text-xs text-slate-700">
                      {rijen.map((r) => (
                        <li key={r.item.id}>
                          {teamName(r.teamId)} · {r.item.label}
                        </li>
                      ))}
                    </ul>
                  </Uitklap>
                )
              })}
              <Uitklap label={tx('appsZonderRelatie')} aantal={a.hygiene.appsZonderRelatie.length}>
                <ul className="text-xs text-slate-700">
                  {a.hygiene.appsZonderRelatie.map((r) => (
                    <li key={r.app.id}>
                      {teamName(r.teamId)} · {r.app.naam || '—'}
                    </li>
                  ))}
                </ul>
              </Uitklap>
            </div>
          </Kaart>
        </div>
      </Sectie>

      <Sectie id="an-beheer" titel={tx('sBeheer')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Kaart titel={tx('kRegistratie')} uitleg={tx('uRegistratie')}>
            <Staven
              punten={a.registratie.perWeek}
              reeksen={[
                { label: tx('aangemaakt'), kleur: '#2a5f8a', waarden: a.registratie.perWeek.map((p) => p.aangemaakt) },
                { label: tx('gewijzigd'), kleur: '#7a5c8a', waarden: a.registratie.perWeek.map((p) => p.gewijzigd) },
                { label: tx('geslotenKop'), kleur: '#5c8a72', waarden: a.registratie.perWeek.map((p) => p.gesloten) },
                { label: tx('koppelingen'), kleur: WARM, waarden: a.registratie.perWeek.map((p) => p.koppelingen) },
              ]}
            />
          </Kaart>
          <Kaart titel={tx('kRegistratieTeam')} uitleg={tx('uRegistratieTeam')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'aangemaakt', label: tx('aangemaakt'), rechts: true },
                { key: 'gewijzigd', label: tx('gewijzigd'), rechts: true },
                { key: 'gesloten', label: tx('geslotenKop'), rechts: true },
                { key: 'totaal', label: tx('aantal'), rechts: true },
              ]}
              rijen={a.registratie.perTeam.map((r) => ({ key: r.teamId, team: teamName(r.teamId), aangemaakt: r.aangemaakt, gewijzigd: r.gewijzigd, gesloten: r.gesloten, totaal: r.totaal, onClick: () => onNavigateToTeam(r.teamId) }))}
            />
          </Kaart>
          <Kaart titel={tx('kReview')} uitleg={tx('uReview')} breed>
            <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
              <span>
                {tx('duplicaten')}: <b>{a.registratie.duplicaten.length}</b>
              </span>
              <span>
                {tx('logTotaal')}: <b>{a.registratie.totaal}</b>
              </span>
            </div>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'titel', label: tx('titelKol') },
                { key: 'leeftijd', label: tx('dag'), rechts: true },
              ]}
              rijen={a.registratie.openReview.map((c) => ({ key: c.id, team: teamName(c.teamId), titel: c.titel, leeftijd: c.leeftijd }))}
              leeg={tx('geenData')}
            />
          </Kaart>
          <Kaart titel={tx('kSlapend')} uitleg={tx('uSlapend')}>
            <Tabel
              kolommen={[
                { key: 'team', label: tx('team') },
                { key: 'laatste', label: tx('laatsteActiviteit') },
                { key: 'dagen', label: tx('dagenStil'), rechts: true },
                { key: 'slapend', label: tx('slapend') },
              ]}
              rijen={a.slapend.map((r) => ({ key: r.teamId, team: teamName(r.teamId), laatste: r.laatste ?? tx('nooit'), dagen: r.dagenStil ?? '—', slapend: r.slapend ? '●' : '○', onClick: () => onNavigateToTeam(r.teamId) }))}
            />
          </Kaart>
          <Kaart titel={tx('kDuplicaten')} uitleg={tx('uDuplicaten')}>
            {a.duplicaten.length === 0 ? (
              <p className="text-xs text-slate-400">{tx('geenDuplicaten')}</p>
            ) : (
              <div className="space-y-2">
                {a.duplicaten.map((g) => (
                  <Uitklap key={g.groep} label={g.deps[0].titel} aantal={g.deps.length}>
                    <DepLijst deps={g.deps} onSelect={onSelect} teamName={teamName} language={language} tx={tx} max={6} />
                  </Uitklap>
                ))}
              </div>
            )}
          </Kaart>
        </div>
      </Sectie>
    </div>
  )
}
