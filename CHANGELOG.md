# Changelog

Automatisch bijgehouden overzicht van wijzigingen op main. Nieuwste bovenaan.

## 2026-08-28
- **Ketenoverzicht: tooltip weg, kaarten kunnen nooit meer overlappen, rustigere lijnen** (Lars Hoogland)

  De zwevende hover-tooltip op ketenlijnen was buggy en zat de leesbaarheid in de
  weg — vervangen door lichte oplicht/dim-feedback op de lijn zelf; het
  klik-paneel blijft de plek voor detail. Kaarthoogte bij uitklappen hield geen
  rekening met tekst die in de smalle kolom terugloopt naar meerdere regels,
  met overlap tot gevolg bij meerdere gelijktijdig uitgeklapte kaarten —
  verificatie bevestigt nu 0 overlap, ook met alle teams tegelijk open.
  Overgeslagen-laag-lijnen krijgen iets meer aanloopruimte zodat ze niet vlak
  langs een tussenliggende kaart scheren.

- **Ketenoverzicht: gelaagde 2D-plaatsing i.p.v. één vaste rij** (Lars Hoogland)

  Alle teams op één horizontale lijn dwong elke niet-opeenvolgende koppeling in
  dezelfde smalle strook boven de rij, met een lijn dwars door een kaart en een
  overlappende uitklap-kaart tot gevolg. Kolom = ketenstap (zoals nu), rij =
  positie binnen die stap: de meeste koppelingen worden zo vanzelf kort en
  naburig, kaartgrootte/positie zijn dynamisch (buren schuiven op bij uitklappen).

- **Merge remote-tracking branch 'origin/main'** (Lars Hoogland)

- **Ketenoverzicht: hover-uitklap met twee kolommen en meebewegende ketenlijnen** (Lars Hoogland)

  Klikken op een teamkaart schakelde nog automatisch naar Focusmodus i.p.v. de
  gevraagde inline uitklap; klik-om-te-sluiten werkte niet zichtbaar zolang de
  muis op de kaart bleef staan. Nu klapt een team bij hover/klik uit in eigen
  input/output-kolommen, en springen de ketenlijnen naar de specifieke rij.

- **Haal de live uitkomst uit het formulier en corrigeer veldplaatsing** (Quinten)

  De uitkomstbalk toonde risico, flowverlies en urgentie tijdens het
  invullen. Dat stuurt het invulgedrag: wie ziet wat zijn antwoorden
  opleveren, vult richting de gewenste uitkomst in. Dat is precies de
  score-inflatie die als grootste valkuil was benoemd, en het detailpaneel
  toont die drie na opslaan toch al — daar informeren ze zonder te sturen.
  OutcomeBar en de bijbehorende teksten zijn verwijderd.

  Veldplaatsing gelijkgetrokken met het ontwerp:
  - Scope en Flowtype staan naast elkaar in plaats van onder elkaar.
  - Effect op flow is verhuisd van blok 2 naar direct onder Wachttijd, en
    verschijnt alleen als er wachttijd is. Wat voor soort verlies het is
    heeft geen betekenis zolang er geen verlies is.
  - Actie/afspraak staat voor Mitigatie: eerst wat er gaat gebeuren, dan
    wat er al gebeurt.
  - Onder de gekozen workflowstap staat wat die stap betekent, net als bij
    categorie.

  De ankerregel onder een knoppenrij houdt nu altijd zijn ruimte vast. Hij
  verscheen pas bij een keuze, waardoor alles eronder omlaag sprong zodra
  je een optie aanwees.

- **Maak de blokindeling af en toon wat oplosbaarheid betekent** (Quinten)

  Het formulier stond nog in de oude volgorde: eerst de inschattingen, dan
  pas de workflowstap, en de titel ergens halverwege. Nu vier blokken met
  een verhaallijn — wat is het, waar in de flow, hoe erg en wat kost het,
  wat doen we ermee — en de titel direct onder Team, want je hebt iets in
  je hoofd en wilt dat kwijt voordat je gaat classificeren.

  Onder oplosbaarheid staat nu wat de combinatie met flowverlies betekent
  voor de vervolgstap: quick win, opschalen, opruimen of accepteren. Die
  laatste hoek wordt zelden expliciet gemaakt, terwijl "dit is het
  escaleren niet waard" een legitieme en bevrijdende uitkomst is.
  bepaalKwadrant staat in analysis.js, naast het bestaande isQuickWin.

  De blokkoppen verschijnen alleen bij uitgebreide analyse; zonder de
  toggle blijft het formulier een platte lijst met dropdowns. De nieuwe
  volgorde geldt wel in beide paden, want die is los van de toggle een
  verbetering.

- **Herontwerp het formulier bij uitgebreide analyse: knoppenrijen met ankers** (Quinten)

  Met de toggle aan stonden er zestien velden onder elkaar, waarvan de
  inschattingen als dropdowns tussen de tekstvelden verdwenen. Het aantal
  velden was niet het probleem — dat alles er hetzelfde uitzag wel.

  De zes inschattingen (impact, frequentie, wachttijd, urgentie, status,
  oplosbaarheid) zijn nu knoppenrijen in plaats van dropdowns. Bij een
  inschatting wil je de hele schaal zien om je antwoord te kunnen plaatsen;
  in een dropdown moet je eerst klikken om te ontdekken wat de opties zijn.

  Onder elke rij staat wat de gekozen optie betekent, met een concreet
  voorbeeld erbij. Hoveren of tabben langs een optie toont diens uitleg
  zonder je keuze te wijzigen, want juist als je twijfelt wil je kunnen
  vergelijken. Waar meerdere voorbeelden bestaan kun je doorklikken: een
  enkel voorbeeld past nooit op elke dependency, en van twee of drie leer je
  beter waar de grens van een niveau ligt.

  Onderaan het blok lopen risico, flowverlies en urgentie live mee, met de
  opbouw van de risicoscore eronder. Dat maakt van het blok iets dat
  resultaat oplevert in plaats van invulwerk, en laat de invuller zijn eigen
  inschatting toetsen.

  De modal is 512 -> 672px bij uitgebreide analyse, anders passen de labels
  niet. Zonder de toggle verandert er niets: dezelfde dropdowns, dezelfde
  breedte.

- **Leid de demo-verrijking af uit de inhoud i.p.v. mechanisch te roteren** (Quinten)

  De demo-dependencies kregen wachttijd, deadline en oplosbaarheid via een
  index-rotatie (wachttijdCycle[i % 4] enzovoort). Daardoor hadden die
  waarden geen enkele relatie met de dependency zelf: "kennis zit bij een
  persoon" kon 'geen wachttijd' en 'organisatorisch' krijgen, en drie van
  de vier dependencies had een deadline.

  Dat maakt de uitgebreide analyse onbruikbaar als demo, want juist de
  verbanden zijn wat je wilt laten zien — en die waren er niet.

  Nu afgeleid uit wat er al in de dependency staat: wachttijd volgt uit
  effectOpFlow (blokkade kost een sprint, wachten kost dagen, herwerk kost
  uren) met impact als terugval; oplosbaarheid uit scope plus categorie; en
  deadlines zijn schaars, alleen waar een datum voor de hand ligt, en dan
  altijd met bijbehorende tekst.

  Resultaat op de 79 demo-dependencies: alle vier de niveaus komen voor bij
  zowel flowverlies als urgentie, 46 dependencies hebben terecht geen
  datum, en de tien met een vaste of harde deadline hebben allemaal een
  ingevulde deadlinetekst. Elke vijfde blijft leeg zodat de
  profiel-onvolledig-staat ook zichtbaar blijft.

- **Verbreed impact naar vier en frequentie naar vier niveaus** (Quinten)

  Impact kende drie niveaus (laag/midden/hoog) en frequentie er twee
  (incidenteel/structureel). Dat was te grof: 'incidenteel' dekte zowel
  eenmalig als elke-paar-sprints, terwijl dat voor flowverlies veel
  uitmaakt, en aan de onderkant van impact viel niets te onderscheiden.

  Nieuw: impact klein/beperkt/duidelijk/zwaar, frequentie
  eenmalig/soms/regelmatig/structureel. Punten lopen nu 1..4 per as, dus
  de basisscore loopt 1..16 in plaats van 1..6.

  De drempels zijn opnieuw gekozen (<=6 / <=12 / <=16) door ze te toetsen
  op de bestaande dataset: 85% van de dependencies houdt daarmee hetzelfde
  risiconiveau en het aantal Kritieke blijft gelijk. De flowverlies-
  drempels in analysis.js zijn meegeschaald met de bredere frequentieas.

  Bestaande data migreert automatisch bij het laden: laag->beperkt,
  midden->duidelijk, hoog->zwaar, incidenteel->soms. De mapping houdt de
  relatieve positie aan, want 'laag' was niet het laagst denkbare — 'klein'
  is een nieuw niveau eronder.

  Voegt ook DIMENSION_ANCHORS toe aan labels.js: betekenis plus meerdere
  voorbeelden per keuzeoptie, NL en EN, voor gebruik in het formulier.

- **Merge remote-tracking branch 'origin/main'** (Lars Hoogland)

- **Ketenoverzicht: geaggregeerde teamstroom-weergave i.p.v. lijnen per item** (Lars Hoogland)

  Vervangt de per-item IN/OUT-lijnen in de overview-modus door één kaart per
  team en één pijl per teampaar (dikte = aantal koppelingen, kleur = hoogste
  risiconiveau van de twee teams), met detail op klik. Lost structureel op dat
  lijnen door niet-gerelateerde tussenkolommen liepen. Focusmodus ongewijzigd.

- **Maak de formulier-mockup daadwerkelijk interactief** (Quinten)

  De categorie-dropdown deed niets terwijl de twee andere dropdowns wel
  reageerden, waardoor de mockup half kapot oogde. Categorie vult nu zijn
  eigen beschrijving (teksten uit labels.js) en de lijst wisselt mee met
  Scope: acht interne categorieen op teamniveau, dertien externe op
  ketenniveau — zoals de app het ook doet.

  Opslaan, Annuleren en sluiten tonen nu een korte melding dat er niets
  wordt opgeslagen, in plaats van stil niets te doen.

- **Voeg klikbare mockup toe van het heringedeelde dependency-formulier** (Quinten)

  Statische mockup (public/form-mockup.html, bereikbaar op /form-mockup.html)
  van hoe het dependency-formulier eruitziet met de toggle "Uitgebreide
  analyse" aan. Nog geen implementatie — bedoeld om af te stemmen.

  Vier blokken met een verhaallijn: wat is het, waar in de flow, hoe erg en
  wat kost het, wat doen we ermee. Inschattingen zijn knoppenrijen in plaats
  van dropdowns, met per optie meerdere voorbeelden die je kunt doorklikken
  en die ook bij hover te lezen zijn zonder je keuze te wijzigen. Onderaan
  blok 3 een live uitkomst met de opbouw van de risicoscore erbij.

  Gebruikt de canonieke waarden uit de codebase: workflowstap en effect op
  flow uit labels.js, oplosbaarheid met de vier waarden van het eerder
  verwijderde oplossingsniveau (team, samenwerking, opschaling, monitoren).

- **Ketenoverzicht: kolom- en itemvolgorde op ketenlogica baseren** (Lars Hoogland)

  Teams stonden in een vaste, willekeurige volgorde (context-aanmaakvolgorde),
  los van hun daadwerkelijke ketenrelaties — verbindingslijnen tussen een
  OUT-kaartje en een ver weg gelegen IN-kaartje liepen daardoor dwars over
  tussenliggende, ongerelateerde teamkolommen heen.

  Nieuwe orderTeamsByChain in lib/teamWorkflow.js berekent een topologische
  laagindeling + barycenter-heuristiek uit de bestaande ketenkoppelingen
  (zelfde principe als tools als dagre, hier zonder externe dependency zelf
  geïmplementeerd) — direct-verbonden teams komen zo naast/dicht bij elkaar
  te staan. Teams zonder enige koppeling vallen los, achteraan; een cyclus
  tussen twee teams kan niet vasthangen (valt terug op de volgende laag).
  Binnen een kolom zijn IN/OUT-kaartjes ook herordend op de kolom van hun
  gekoppelde tegenhanger, voor rechtere lijnen tussen naburige kolommen.

  Focusmodus (eigen, gerichte inkomend/uitgaand-groepering) blijft
  ongewijzigd. Lost kolom- en itemvolgorde op; garandeert nog geen 100%
  crossing-vrije lay-out bij een niet-lineaire keten — dat vereist een eigen
  lijnroutering, bewust nog niet gebouwd zolang het uiteindelijke ontwerp
  niet vaststaat.

- **Verwerk audit: 21 bevindingen (correctheid, robuustheid, performance)** (Lars Hoogland)

  Correctheid: Matrix-overzicht bleef niet meer leeg na een teamwijziging of
  import (excluded-set patroon, zoals GraphView al deed); sorteren op
  'laatst bijgewerkt' crasht niet meer op data zonder dat veld; risicobalk
  schaalt nu op een afgeleide MAX_RISK_SCORE i.p.v. een hardcoded 11; twee
  overlappende externe categorieën samengevoegd met migratie voor bestaande
  data; risicoberekening gebruikt nu veilige lookup-tabellen (Object.create
  (null)) met een fallback, i.p.v. te kunnen crashen op een waarde als
  'constructor'.

  Robuustheid: een React ErrorBoundary rond de hoofd-app i.p.v. een wit
  scherm bij een renderfout; mislukt wegschrijven naar localStorage (bv. vol
  quotum) geeft nu een duidelijke melding i.p.v. stil te falen; onleesbare
  opgeslagen data wordt bewaard en aangeboden om te downloaden i.p.v.
  stilzwijgend vervangen door demodata; PNG-export op de teampagina werkt nu
  echt (had voorheen een lege ref); state wordt nog maar één keer geladen bij
  opstarten; een team verwijderen wordt nu ook geblokkeerd als een ander team
  er via een input/output-koppeling nog naar verwijst; alle acties in
  AppContext.jsx (en TeamPage's patch()) zijn omgezet naar functionele
  state-updates, wat het risico wegneemt dat twee wijzigingen binnen
  dezelfde gebeurtenis elkaar overschrijven; momentopname-namen botsen niet
  meer zodra de limiet van tien bereikt is, en een moment terugzetten
  bewaart eerst automatisch de huidige stand; Escape sluit niet meer alle
  openstaande vensters tegelijk, en modals hebben nu een echte focus-trap.

  Overig: het adminwachtwoord komt uit een omgevingsvariabele i.p.v.
  hardcoded in de broncode; alle lint-waarschuwingen zijn opgelost; de
  productiebundel is met code-splitting (reactflow/html2canvas-pro/
  teampagina-schermen) van ~940 kB naar ~236 kB initieel bundel gebracht;
  twee "high"-kwetsbaarheden in de afhankelijkheden verholpen; de
  ketenberekening in Ketenoverzicht en de risicoberekening tijdens sorteren
  lopen niet meer onnodig dubbel.

  Build, lint en npm audit zijn schoon; een brede browsertest (alle
  hoofdschermen, dependency aanmaken, PNG-export, admin-toegang) bevestigt
  geen regressies.

- **Canvas-verbeteringen: lijnrouting, hover-tooltips, filters, input/output-uniformering** (Lars Hoogland)

  Relatielijnen in Netwerkweergave, Ketenoverzicht en de teampagina gebruiken
  nu smoothstep-routering i.p.v. de standaard bezier-lijn, minder kriskras op
  drukke schermen. De subtiele input/output-verbindingslijnen op de teampagina
  tonen nu bij hover welk element ermee verbonden is, zelfde patroon als
  Netwerkweergave/Ketenoverzicht al hadden.

  Output-items op de teampagina hebben nu dezelfde velden als input
  (Bestemming i.p.v. Bron, koppeling naar een input-item bij een ander team),
  inclusief kleurcodering en labels op de canvaskaart zelf — voorheen toonde
  de output-kaart nooit een koppel-label, ook niet wanneer gekoppeld.

  Nieuwe canvas-filters in de bestaande "Weergeven"-dropdown: Dependencies,
  Applicaties, Capaciteit en Workflowfasen los aan/uit te zetten, puur
  zichtbaarheid ná de layoutberekening zodat de rest niet herpositioneert.

  Nieuw scripts/audit-relations.mjs: eenmalige controle van een JSON-export op
  wees-referenties (verwijzingen naar verwijderde teams/applicaties/partijen/
  input-output-items) — rapporteert alleen, repareert niets automatisch.

- **Merge origin/main (bot-changelogcommit overbodig door regeneratie)** (Lars Hoogland)

  # Conflicts:
  #	CHANGELOG.md

- **Vorm changelog om: subject + leesbare subtekst per entry** (Lars Hoogland)

  Elke changelog-regel toonde tot nu toe alleen de kale commit-subject. Nieuwe
  opzet in scripts/update-changelog.mjs: subject vetgedrukt, met de volledige
  commit-body (het 'waarom'/de details, Co-Authored-By eruit gefilterd) als
  ingesprongen subtekst eronder — de daadwerkelijke inhoud van een wijziging
  wordt zo in één oogopslag leesbaar. CHANGELOG.md volledig geregenereerd
  vanuit de bestaande geschiedenis in deze nieuwe structuur.

- **Voeg admin-wijzigingenlog toe met cross-team dependency-deduplicatie** (Lars Hoogland)

  Elke nieuwe dependency komt terecht in een wijzigingenlog (nieuwe admin-
  sectie "Wijzigingenlog" in Instellingen). Aanmaken blijft niet-blokkerend
  voor het team zelf; de admin krijgt alleen overzicht en, bij een
  waarschijnlijk duplicaat op een ander team (zelfde categorie + zelfde
  externe partij of gedeelde applicatie), een expliciete waarschuwing met
  drie acties: goedkeuren, bewerken of afwijzen.

  Goedkeuren van een duplicaat koppelt beide teams eraan door voor elk team
  een eigen kopie van de ander te materialiseren — zelfde patroon als de
  bestaande 'meerdere teams'-aanmaakflow (onafhankelijke records per team,
  geen gedeeld record), herkenbaar gekoppeld via een nieuw dedupGroupId-veld.
  Bewerken opent het bestaande dependency-formulier; afwijzen verandert geen
  data, alleen de logstatus.

- **Voeg uitgebreide analyse toe: flowverlies en urgentie naast risicoscore** (Lars Hoogland)

  Nieuwe, losstaande berekening in src/lib/analysis.js (risk.js blijft
  ongewijzigd): flowverlies = wachttijd x frequentie, urgentie = afgeleid uit
  deadline. Beide naast (niet in) de bestaande risicoscore, met dezelfde
  warme, uitlegbare kleurentaal. Afgeleide labels stil risico/verouderd/
  quick win.

  Nieuwe formuliervelden wachttijd/deadline/deadlineTekst, met verplichte
  toelichting bij een vaste of harde deadline ("anti-inflatie"). Alles achter
  een adminSettings.uitgebreideAnalyse-toggle, standaard uit — de app gedraagt
  zich dan exact als voorheen. Mockdata aangevuld, met elke vijfde dependency
  bewust onvolledig gelaten zodat die staat ook in de demo zichtbaar is.

- **Voeg automatisch bijgehouden CHANGELOG.md toe** (Lars Hoogland)

  Nieuwe GitHub Action (.github/workflows/changelog.yml) die na elke push naar
  main de commits van die push toevoegt aan CHANGELOG.md, gegroepeerd per datum
  en nieuwste bovenaan — zodat Lars en Quinten altijd een actueel, makkelijk
  leesbaar overzicht hebben zonder git-kennis nodig te hebben. Terugwerkend
  gevuld met de volledige bestaande geschiedenis. CLAUDE.md beschrijft ook hoe
  je optioneel een GitHub Release maakt voor een groter mijlpaal.

- **Voeg externe-partijenlijst, aanmaakdatum en oplosbaarheid toe aan dependencies** (Lars Hoogland)

  Centrale, admin-beheerde lijst van externe partijen (team/rol/persoon/systeem/
  omgeving/stakeholder) met goedkeuring/weigering-workflow: teams kunnen zelf
  een partij aanmaken vanuit het dependency-formulier of input/output-items,
  die komt dan in afwachting bij de admin terecht. Weigeren verwijdert de
  koppeling niet — bestaande referenties blijven zichtbaar met een waarschuwing
  en een snelkoppeling om te vervangen.

  Daarnaast: aangemaakt_op-timestamp op nieuwe dependencies (bestaande records
  tonen expliciet "onbekend" i.p.v. een verzonnen datum), en een nieuw
  oplosbaarheid-veld (teamlid/meerdere teamleden/meerdere teams/
  team-overstijgend/organisatorisch).

## 2026-08-27
- **Verwijder permanente e2e-regressietestset en CI-workflow** (Lars Hoogland)

  Twee ontwikkelaars wisselen elkaar af op dezelfde branch; bij elke
  beurtwisseling veranderde de UI genoeg om de vaste Playwright-set constant
  te laten falen zonder dat er iets kapot was. Ad-hoc verificatie met echte
  browserinteracties tijdens het bouwen blijft de afspraak, alleen niet meer
  als vaste, altijd-groene set. CLAUDE.md bijgewerkt.

- **Voeg regressietestset, gebruikshandleiding en CI-workflow toe** (Lars Hoogland)

  Bovenop de doorontwikkelde versie van de collega: Playwright e2e-testset,
  PDF-gebruikshandleiding met screenshots, en een dormant GitHub Actions-
  workflow die de testset bij elke push/PR draait.

## 2026-08-26
- **Toolbar-sectie op teampagina wit i.p.v. grijs** (Quinten)

  De rij met +Toevoegen/+Notitie/kleurenswatches/Split-Samengevoegd/zoeken/
  Weergeven had een eigen grijstint (bg-slate-50/70) die niet aansloot bij de
  verder witte kaart eromheen.

- **Canvas default fit veel groter, corner-safe-area i.p.v. volle marge, meer interne ademruimte** (Quinten)

  De default fit van de teampagina-canvas was te voorzichtig: fitViewAvoidingCorner
  trok de volledige breedte/hoogte van de toolbar-footprint af van het hele
  canvasvlak (reserveLeft/reserveBottom), alsof de toolbar de volle breedte of
  hoogte besloeg — terwijl die maar een klein hoekje linksonder is. Voor een
  breed/kort canvas (precies de vorm van dit teamoverzicht) betekende dat een
  flink kleinere zoom dan nodig.

  Nieuwe aanpak in lib/flowFit.js: eerst een gewone, volledige fit (zo groot
  mogelijk); alleen als de content daarna echt in de kleine safe area
  linksonder terechtkomt, verschuiven (pannen) we 'm net genoeg om vrij te
  komen; pas als verschuiven niet zou passen wijkt dit uit naar iets minder
  zoom. "Zo groot mogelijk" is nu de regel, de hoek-correctie de uitzondering.

  De fit herberekent nu ook automatisch bij wijzigingen in de zichtbare
  canvas-inhoud (nieuwe canvasFitKey op basis van node-aantal/-afmetingen en
  Split-per-applicatie ↔ Samengevoegd), bij fullscreen aan/uit, en bij het
  resizen van het browservenster — niet meer alleen bij de eerste load en
  zijbalkwissel.

  Losstaand: de Applicatieflow-lanes (incl. Applicatie-overstijgend) stonden
  met maar 14px ruimte praktisch tegen de rand van het grote flowvlak. Nieuwe
  ZONE_INNER_PAD_X (32px, los van de bestaande LANE_PAD_X die de padding
  binnen een lane zelf blijft regelen) geeft de buitenste achtergrond meer
  lucht. Ontwikkelflow en Applicatieflow delen dezelfde ZONE_X/ZONE_WIDTH en
  STAGE_START_X, dus schuiven automatisch evenveel op — geen scheve
  uitlijning.

- **Conceptuele fixes: Applicatieflow zonder workflowstap, multi-app labels, workflowstap-toelichting** (Quinten)

  - Applicatieflow kent nu écht geen workflowstap meer: formulier verbergt
    het veld bij dat flowtype, en storage.js's migratie zet een eventuele
    legacy/vervuilde waarde bij de bron op null — canvas, lijst, filters en
    detailpaneel kunnen elkaar daardoor niet meer tegenspreken.
  - Dependencylijst gebruikte voor Applicatieflow-groepen nog dezelfde
    stage-gebaseerde groepering als Ontwikkelflow (StageGroupedDeps); nieuwe
    FlatDeps toont Applicatieflow nu vlak, zonder workflowstap-subgroepen.
  - Applicatieflow-dependencies zijn nu aan meerdere applicaties te koppelen
    via verwijderbare chips + een "+ Applicatie"-toevoegvak, i.p.v. de oude
    single-select die het label bij een tweede keuze overschreef.
  - "Teambreed"/"Niet gelabeld"/"Geen workflowstap" vervangen door de
    consistente termen "Applicatie-overstijgend"/"Proces-overstijgend" op elke
    plek waar ze nog opdoken (IO-canvaslabel, legenda, detailpaneel, lijst).
  - Nieuw: optionele, team-specifieke toelichting per ontwikkelflowstap — klik
    op een stagekop op het canvas, zichtbaar via een klein icoon + tooltip,
    opgeslagen in workflow.stageNotes.
  - Opgeruimde dode code: het focuspaneel had nog een onbereikbare
    dependencyMarker-tak (dependencies openen altijd al direct de volledige
    DependencyDetail, zowel vanaf canvas als lijst).
  - Interne identifiers/comments die nog "Teambreed"/"Run flow" heetten
    (variabelen, node-ids, i18n-sleutelnamen) hernoemd naar "Overstijgend"/
    "Applicatieflow", zodat de code dezelfde taal spreekt als de UI.

- **Zet één zoekveld terug in 'Dependencies van dit team'** (Quinten)

  Handig om niet terug te hoeven scrollen naar de canvas-toolbar; deelt
  dezelfde depSearchQuery-state dus blijft vanzelf gesynchroniseerd. De
  tweede, geneste applicatie-naam-zoekbalk blijft weg — dat was de
  overbodige van de twee.

## 2026-08-25
- **Verwijder dubbele zoekvelden onder canvas, fix race in initiele canvas-fit** (Quinten)

  De 'Dependencies van dit team'-sectie had een eigen dependency- en
  applicatie-zoekveld die exact dezelfde state deelden als de al
  zichtbare zoekvelden in de canvas-toolbar erboven — puur visuele
  duplicatie. Verwijderd, de gedeelde Filters-knop blijft staan.

  Daarnaast bleek de allereerste fit van de teampagina-canvas soms
  zonder toolbar-marge te winnen van een race tegen de toolbar-bewuste
  fit (PannableFlowCanvas deed zelf ook nog een generieke fit-op-mount),
  met content onder de zwevende canvas-toolbar tot gevolg. De generieke
  fit is nu uitschakelbaar (disableAutoFit) en de teampagina-canvas
  triggert zijn eigen eerste fit pas zodra React Flow de node-afmetingen
  daadwerkelijk heeft gemeten (useNodesInitialized) i.p.v. op een
  gegokte timeout.

- **Canvas re-fit bij zijbalkwissel, klikbare teamnaam, en toolbar-vrije fit** (Quinten)

  Relatiekaart, Ketenoverzicht en de teampagina-canvas passen zichzelf nu
  opnieuw in beeld wanneer de zijbalk permanent van modus wisselt (open/
  iconen/auto-hide) — niet bij het tijdelijke uitklappen op hover, enkel
  bij een echte breedtewijziging. De teampagina-canvas houdt daarbij ook
  rekening met de zwevende canvas-toolbar linksonder (nieuwe
  fitViewAvoidingCorner in src/lib/flowFit.js), zodat content er nooit
  onder verdwijnt terwijl er zoveel mogelijk wordt ingezoomd.

  Daarnaast is de teamnaam in de dependency-lijst op Heatmap en
  Relatiekaart nu klikbaar en navigeert direct naar de teampagina.

- **Add 3-mode sidebar: vast open, iconen, en auto-hide** (Quinten)

  Auto-hide toont enkel een smalle handle die op hover/focus tijdelijk
  uitklapt als overlay (geen layout-shift van de canvas), met pin/unpin
  om 'm permanent open te zetten. Klikken op een navigatie-item klapt
  de auto-hide sidebar weer in, tenzij vastgezet.

- **Fix the workflow card overflowing the viewport on load** (Quinten)

  The canvas row had its own height (clamp(640px, 78vh, 920px)), independent
  of the header/toolbar chrome rendered above it in the same card. That budget
  was tuned before this session's toolbar rework added a header row and a
  second toolbar row — the extra chrome height was never a factor in the
  78vh guess, so the card's total height quietly grew past the visible area
  between the fixed topbar and the viewport bottom. Result: the card's bottom
  edge (and its breathing room) sat just below the fold on load.

  Fixes it structurally instead of re-guessing a new percentage: the card
  itself now gets an explicit height — clamp(760px, calc(100vh - 97px), 960px),
  where 97px is the fixed topbar (73px) plus the page's own bottom padding
  (main's pb-6, 24px) — and becomes a flex column with the canvas row set to
  flex-1. The canvas row no longer needs to know the chrome's height at all;
  it just absorbs whatever's left after the header and toolbar rows size
  themselves, so this stays correct regardless of future toolbar changes.

  Verified at 900px, 700px (clamps to the 760px floor and scrolls, no hard
  clipping) and 1300px (clamps to the 960px ceiling) viewport heights, with
  the sidebar both open and collapsed, and in fullscreen — the card's bottom
  edge now lands with the same 24px breathing room main already uses at the
  page edges, matching the horizontal padding.

- **Remove the minimap from the teampagina canvas** (Quinten)

- **Add a floating canvas toolbar, decongesting the top toolbar further** (Quinten)

  Zoom in/out, fit-to-screen and auto-arrange move out of the top toolbar into
  a compact vertical toolbar docked bottom-left on the canvas itself — the
  same corner React Flow's own default controls used to occupy (now hidden
  for this canvas via a new hideControls prop on PannableFlowCanvas, kept for
  other views). Full screen joins it at the bottom, below a divider. Requires
  wrapping the canvas in a ReactFlowProvider to reach useReactFlow() from a
  sibling toolbar instead of only from inside <ReactFlow>.

  Also reshuffles the top toolbar per feedback: Help/legend moves up onto the
  Workflow header row (where the old maximize button's spacer sat, and now
  keeps the team name genuinely centered), Split/Samengevoegd moves up to the
  toolbar's first row, and Weergeven takes its old spot on the second row.

  Redraws the auto-arrange icon as a wand with sparkle bursts (in the style of
  Apple Photos' auto-enhance icon) instead of the previous plain star-and-line.

  Updated the tour's canvas-toolbar step to match the new target and content.

- **Center team name, open a modal for new applications, fix fullscreen height gap, rewrite the tour** (Quinten)

  Team name now centers on the Workflow header row (grid layout instead of a
  left-aligned flex group) while the back button stays put on the left.

  "+ Applicatie toevoegen" — both from the toolbar menu and the Teamgegevens
  block — now opens ApplicationDetailModal immediately after creating the
  blank record, matching how Input/Output/Capacity/Verbind-applicaties already
  work. addApplication() now returns the new id so the caller can open the
  modal for it. Also moved "Verbind applicaties" to the top of the add menu.

  Fixes a real bug in the fullscreen/presentation overlay: the fixed
  inset-0 container measured 16px short of the actual viewport height,
  letting a sliver of the page underneath show through at the bottom. Root
  cause unclear, but forcing explicit h-screen/w-screen alongside inset-0
  resolves it reliably — verified the overlay now measures exactly against
  window.innerHeight.

  Rewrites the team page tour end to end: the old steps described features
  that no longer exist in their described form (a separate Applicatieflow
  tab, toolbar copy that predated the two-row layout) after several rounds of
  UI changes this session. New 7-step sequence follows the page top-to-bottom:
  canvas, add menu, annotations, search & filter, help & legend, fullscreen,
  and the Dependencies/Teamgegevens tabs — each describing what's actually
  there now. startTour() also resets to the Dependencies tab first, so the
  last step's data-tour target is guaranteed to exist even if the tour is
  replayed while Teamgegevens is open.

- **Drop "Workflow" from the teampagina title, keep just the team name** (Quinten)

- **Drop the redundant outer frame on the teampagina, restyle team name and back button** (Quinten)

  Removes the outer bordered/tinted wrapper that used to hold the whole
  teampagina together visually — it stopped earning its place once the header
  row inside it was already gone; each card already has its own border. Team
  name now reads in the same weight/size as "Workflow" (joined by a middle
  dot) instead of a separate pill chip, and the back button got a visible
  border and a bigger icon so it reads as an actual control, not a faint mark.

- **Drop the Heatmap mini-Relatiekaart preview, move team chip/back button onto the Workflow row** (Quinten)

  The Heatmap selection panel showed a small fixed-size ReactFlow preview next
  to the dependency list — a scaled-down slice of the Relatiekaart that didn't
  add anything the list itself, plus the existing "Open in Relatiekaart"
  button, didn't already cover. Removed it; the dependency list now gets the
  full width of the panel, and the button moved into the panel header next to
  the title.

  On the teampagina, the back button and team-name chip move from the toolbar
  onto the "Workflow" header row itself, in front of the title, instead of
  sitting in the toolbar's first row.

- **Remove the teampagina header row, compact back/team-chip, help menu, and fullscreen mode** (Quinten)

  Drops the standalone "← Terug naar overzicht / Team Polis / Rondleiding" row
  above the workflow card — it cost real vertical space for little payoff now
  that the active team is already visible in the sidebar. The workflow card
  now starts right at the top of the page.

  Back navigation and the team name move into the toolbar's first row as a
  compact icon button + chip: just the arrow icon when the sidebar is open
  (sidebar navigation already covers it), arrow plus "Overzicht" label when
  the sidebar is collapsed. Requires threading sidebarCollapsed down from
  App.jsx, which didn't pass it to TeamPage before.

  The "Legenda" button becomes a compact "?" help/legend icon. Its dropdown
  keeps the existing risk/display legend and adds "Rondleiding starten" (moved
  out of the removed header) plus short static explainers for Applicatieflow
  and Ontwikkelflow. Along the way, fixed a dangling tour step target
  ('applicatieflow-section') left over from when that section was folded into
  Teamgegevens a few rounds back — it now points at the toolbar like the
  adjacent step already does.

  Adds a fullscreen/presentation toggle in the workflow card's header. Built
  as an in-component fixed-overlay (not the browser Fullscreen API, which
  needs a user-gesture context that isn't guaranteed in an embedded preview)
  that covers the sidebar/topbar visually. Because it's the same component
  instance just repositioned via CSS, team, search, filters, view mode and
  selection carry over automatically with no extra state plumbing — verified
  live with an active search query surviving a fullscreen round-trip. Escape
  and the toggle button both close it.

- **Move the Dependencies/Teamgegevens tabs inside the white card** (Quinten)

  The tab selector sat as its own small pill above the card, floating
  separately from the "+ Nieuwe dependency" button it was functionally next
  to. Moved it into the card's own header row, opposite the button (and alone
  on Teamgegevens, which has no such button) — one card header instead of a
  tab bar plus a card.

- **Add a Focusmodus to Ketenoverzicht for reading one team's direct chain** (Quinten)

  The full Ketenflow view gets unreadable with many teams — crossing lines,
  teams that everything routes through, hub teams that don't stand out. Adds
  a second mode that narrows the view to one team plus its direct chain
  partners.

  - Explicit "Ketenflow"/"Focusmodus" toggle instead of an unlabeled dropdown;
    focus target survives switching back to Ketenflow and forth again.
  - Clicking any team card focuses on it directly, in either mode — not just
    the dropdown.
  - Columns render as Inkomend → Geselecteerd team → Uitgaand, each group
    labeled above its columns, so direction reads from position.
  - A stat row on the focus team (incoming/outgoing/total link counts,
    highest risk) surfaces hub teams without hunting through the graph.
  - Non-connected teams are hidden by default; "Toon context" reveals them
    dimmed instead of cutting them out of the picture entirely.
  - A team with no direct chain links gets an explicit empty state instead of
    a near-blank canvas.
  - Existing team/risk/scope filters, edge hover/click detail, and the plain
    Ketenflow view are unchanged and keep working inside Focusmodus.

  Deliberately skipped: showing a linked dependency on an edge's detail panel
  — there's no dependency-to-input/output relation in the data model, and
  earlier guidance in this project was explicit about not adding one.

- **Drop redundant in-section titles now that the tabs carry them** (Quinten)

  The Dependencies/Teamgegevens tab labels already say what each section is;
  repeating it as an <h3> right below was a duplicate title. Kept the "+
  Nieuwe dependency" button, just dropped its now-title-less flex row down to
  a right-aligned single button.

- **Turn Dependencies and Teamgegevens into tabs instead of stacked sections** (Quinten)

  Both sections sat one below the other under the canvas, so reaching
  Teamgegevens on a team with many dependencies meant scrolling past the
  whole list first. They're now two tabs sharing the same spot right under
  the canvas, Dependencies active by default. Jumping to Applicatieverbindingen
  from a canvas node click now also switches to the Teamgegevens tab before
  scrolling to it, and adding an application from the toolbar menu does the
  same — otherwise the section would expand invisibly on the tab you weren't
  looking at.

- **Close toolbar dropdowns (Toevoegen, Weergeven/Filters, Legenda) on outside click** (Quinten)

  These floating popovers previously only closed by clicking their own toggle
  button again — clicking anywhere else on the page left them stuck open.
  Adds a small useClickOutside hook and wires it into the three toolbar
  dropdowns plus the shared DepFiltersDropdown component, so they behave like
  users expect. Checked the rest of the app for the same pattern: the other
  expand/collapse toggles (GraphView's category legend, Sidebar's teams
  section, TeamFilterPanel, SettingsPanel sections) are inline accordions, not
  floating overlays, so outside-click-to-close doesn't apply there.

- **Fix invisible new applications, revert Team(s) to dropdown+toggle, rework teampagina toolbar/applicatiekoppelingen/teamgegevens** (Quinten)

  Fixes a real bug: "+ Applicatie toevoegen" added the application to data but
  it never appeared anywhere — the canvas only renders an app lane once it has
  a dependency, and the list that used to show every application regardless
  was removed in an earlier round without a replacement. New applications were
  silently unreachable.

  Team(s) in the dependency form is reverted per feedback: a plain single-team
  dropdown by default, with a "Selecteer meerdere teams" link that swaps in the
  full always-visible checklist (not a nested dropdown) only when needed.

  Reorganizes the canvas toolbar into two rows — actions/tools (add menu,
  notitie, slim ordenen, legenda) on one row, search/filter/view-mode on the
  other — instead of one crowded flex-wrap line.

  Replaces the loose Van/Naar input at the bottom of the applicatieflow
  connection list with a modal (ConnectApplicationsModal), reachable from
  "+ Toevoegen" and from an inline "Verbind applicaties" button. Adds
  validation: required fields, no self-connections, no duplicate pairs, and an
  empty state when fewer than two applications exist.

  Adds a "Teamgegevens" section (Applicaties, Applicatieverbindingen, Input,
  Output, Capaciteit) as five independently-collapsible, closed-by-default
  blocks below "Dependencies van dit team". This is also the actual fix for
  the invisible-application bug: application rows use the same editable-inline
  pattern the old always-visible list used, so a freshly added blank
  application is immediately visible and nameable regardless of whether it has
  any dependencies or canvas presence yet. Restores an ioItemSummary helper for
  compact input/output rows showing what they're linked to. Removes the
  now-fully-superseded ApplicatieflowTab.jsx.

- **Separate "Team(s)" (who this is for) from "geraakt team/afdeling" (who causes it)** (Quinten)

  Replaces the single Team dropdown with a Team(s) multi-select when creating a
  new dependency: pick one team for one record, or several teams to get one
  independently-managed copy per team. This replaces the old "Geldt deze
  afhankelijkheid voor meerdere teams?" checkbox entirely — the same
  addDependencies fan-out now runs off the top-level selection instead of a
  separate opt-in. Editing an existing dependency still shows a plain single
  Team select, since an edit always touches exactly one record.

  "Afhankelijk van / geraakt team of afdeling" (shown for Ketenniveau) now
  makes the distinction from Team(s) explicit with inline help text, and gets
  a real team picker as an alternative to free text — picking an existing team
  just writes its name into the same string field, so no data migration is
  needed and every existing consumer (GraphView legend, insights grouping,
  canvas external-team nodes) keeps working unchanged.

- **Replace always-visible helper text with info icons on Flowtype, Workflowstap and Effect op flow** (Quinten)

  Extracts the hover-tooltip pattern already used for Categorie into a shared
  InfoIcon component and applies it to three more fields, dropping their
  permanent helper paragraphs. Shortens the form without losing the
  explanations — they're one hover away instead of always on screen.

- **Merge canvas view toggles and dependency filters into one Weergeven dropdown** (Quinten)

  The toolbar had two separate dropdowns (Filters, Weergeven) plus a search box
  and view-mode toggle crammed into one row. Merges the view toggles (show
  IO/teambreed/geaccepteerd/risk-only/external teams) into the same dropdown as
  the dependency filters, under one "Weergeven" button, organized into a
  "Tonen op canvas" section and a "Filteren op dependency" section. "Wis
  filters" now resets both. The dependency list keeps its own filters-only
  version of the same component, unchanged.

- **Add filters to the canvas toolbar, collapse the Applicatieflow connection-picker by default** (Quinten)

  Extracts the dependency filter dropdown (flowtype/scope/risk/status/
  workflowstap/applicatielabel) into a shared DepFiltersDropdown component and
  renders it in both the canvas toolbar and the dependency list, backed by the
  same filter state so both stay in sync.

  Also collapses the Applicatieflow "which app talks to which" section by
  default — it stayed open and took up space even when nobody was actively
  building connections. Expanding it is one click, and clicking "Ga naar
  Applicatieflow" from the canvas now opens it automatically before scrolling
  there.

- **Consolidate canvas toolbar into a single add-menu, add dependency search to the view** (Quinten)

  Replaces the four separate "+ Applicatie/Input/Output/Rol toevoegen" buttons
  with one "+ Toevoegen" dropdown, and adds a dependency search field to the
  canvas toolbar (reusing the existing search state that already drives the
  dependency list, so results stay in sync between the two). Regrouped the
  toolbar into a clearer add-actions row and a search/view-controls row instead
  of one long, cluttered strip.

- **Move applications/input/output/capacity management fully into the canvas view** (Quinten)

  Removes the separate "Applicaties in beheer", "Input", "Output" and
  "Capaciteit" cards below the team canvas — everything they did (add, edit,
  rename, remove) now happens on the canvas itself: toolbar buttons for
  adding, and clicking an existing node for editing/removing. Application
  rename and delete, previously only available in the removed list, are now
  in the application detail modal (opened by clicking an app on canvas).
  Capacity badges were previously not clickable at all; they're now wired
  into the same focus-panel pattern used by IO and application nodes.

  Also swaps the "Split per applicatie" / "Samengevoegd" button order (split
  is the default view, so it now comes first), and moves the "Dependencies
  van dit team" list to render directly under the canvas instead of after
  the Applicatieflow connection-picker section.

  Known gap: capacity rows without a "Fase" never got a canvas node (by
  existing design — a fase-less row falls outside the stage columns) and are
  now fully unreachable in the UI, since their only other access point (the
  removed list) is gone. No data is lost, but such rows can't be viewed,
  edited or deleted until this gets a fix — flagged for a follow-up.

- **Move add-application/input/output into the canvas toolbar, unify workflowstap with canvas stages** (Quinten)

  Adds "+ Applicatie toevoegen", "+ Input toevoegen" and "+ Output toevoegen"
  to the team canvas's own toolbar (next to "+ Notitie"), reusing the existing
  canvas IO-edit modal in create mode instead of only offering these actions
  in the separate management cards further down the page.

  Also collapses the dependency form's workflowstap options from 8 fine-grained
  values down to the same 6 keys the canvas stage columns use, so what you pick
  in the form is exactly the column the dependency lands in — no more implicit
  bucketing (e.g. "Ready"/"Build" both landing under "Ontwikkeling/configuratie"
  without that being visible anywhere). Existing data with an old workflowstap
  value is migrated automatically to the matching new one.

- **Remove the functies/rollen (function/role) management feature entirely** (Quinten)

  Drops the managed functions/roles list (Settings section, add/rename/
  archive/delete flow, id-based lookup) per explicit request — it wasn't
  going to be used. Capacity rows now carry a plain free-text "rol" field
  instead of a functieId referencing the deleted list; old localStorage/
  import data with a functieId is migrated to readable text automatically
  so nothing crashes or silently loses its role label. Also finishes
  dropping the already-unused eigenaarFunctieIds/oplossingsniveau fields
  from mock data and dependency migration, and fixes one leftover
  "Teambrede" label on the teampagina's Applicatieflow dependency list to
  match the canvas's "Applicatie-overstijgend" terminology.

- **Rename Run flow to Applicatieflow, fix multi-team dependency loss, add admin section toggles** (Quinten)

  Renames "Run flow" to "Applicatieflow" across NL/EN strings and labels. Fixes a
  stale-closure bug in AppContext where creating dependencies for multiple teams
  at once silently dropped all but the last one; adds an atomic addDependencies
  batch method and wires it into the multi-team dependency form. Adds a
  password-gated Admin panel in Settings for toggling pages/sections on and off
  app-wide, with matching gating wired into MatrixView, GraphView, ChainOverview,
  Sidebar and (partially) TeamPage. Also fixes the floating tooltip going off
  viewport, collapses the category legend on Heatmap/Relatiekaart, hides the
  selection panel when nothing is selected, and adds search/filtering for
  dependencies on the teampagina.

## 2026-08-21
- **Make chain links inspectable, duplicate team names distinguishable, heatmap cells readable aloud** (Quinten)

  Three leftovers from the test pass.

  Chain links were plain strokes with no handlers at all: you could see that two
  teams were connected but not which output fed which input without hunting down
  both cards yourself. Edges now carry the team and item names on both ends.
  Hovering shows them, clicking pins the link and fades the rest to 15% so a
  single chain stays followable when dozens of lines cross, and a strip under the
  canvas spells the link out with a way to clear it.

  Two teams may carry the same name — nothing enforces uniqueness and existing
  data can already contain it — which left them indistinguishable in the sidebar,
  filters, dropdowns and the matrix. A shared helper now numbers only the names
  that actually collide, so unique names are untouched, and it runs through the
  context's teamName so every display path picks it up at once. The stored name
  is never changed; renaming still edits the real value.

  Heatmap cells are buttons whose only content is a number, so their accessible
  name was "3" with no indication of which team or category the cell belonged to.
  They now carry an aria-label naming the team, the category, the count and the
  highest risk.

- **Make application management, the matrix table and the chain risk filter usable at scale** (Quinten)

  Second batch from the test pass — the "should improve" items, all measured
  against the same stress datasets.

  The application management section listed every application as an always-open
  input with no way to search or fold it away, so a team with 22 applications
  turned into roughly one and a half screens of form fields — while the canvas
  directly above it did have a search box. It now offers search and collapse once
  a team passes eight applications, which takes that section from 1533px to 149px
  collapsed. Searching overrides the collapsed state, since a search that appears
  to return nothing would otherwise read as broken.

  The dependency table needed 1363px in a 732px column, so five of nine columns
  sat behind a horizontal scrollbar. Impact and frequency are the two inputs to
  the risk score that is already pinned to the right edge, and the hover tooltip
  spells out the whole calculation — they were pushing the columns that carry
  their own information off screen. They now drop out below 2xl, which brings
  workflow step into view and returns the full set on wide screens.

  The chain overview's risk filter only ever changed the number in the team
  header, which read as a filter that did nothing. Teams cannot simply be hidden
  there without cutting the chain they are part of, so teams with no dependencies
  at the selected level are dimmed instead and keep their place.

  Also aligns the teamcanvas view filter label with the badges it controls, which
  were renamed to Applicatie-/Proces-overstijgend earlier but left the filter
  still saying "Teambrede afhankelijkheden".

- **Fix dependencies vanishing, mis-placed workflow steps, and clipped canvas content** (Quinten)

  Findings from a full test pass across small/realistic/stress/edge-case datasets.
  Storage, import/export and filtering all held up; these are the correctness and
  visibility defects that did not.

  The teamcanvas routed Ontwikkelflow dependencies on whether they carried an
  application label, not on their workflow step. A dependency explicitly marked
  "Testen" but without an app label was pulled out of its stage column and shown
  as if it belonged to no phase at all — while the list directly below it grouped
  that same dependency correctly, so one page contradicted itself. Route on the
  workflow step instead; the phase-less band now holds only genuinely phase-less
  items. On the demo data this moves 4 of Team Polis' 13 dependencies back under
  their own phase.

  Deleting an application left every reference to it dangling. The dependency kept
  its now-dead label and matched neither the per-app groups nor the unlabelled
  group, so it disappeared from the team page entirely while still counting in the
  Matrix and the header total. Deleting now warns with a count of what is attached
  and unlinks it: dependencies fall back to Applicatie-overstijgend and stay
  visible, connections and IO references are cleared. This runs as one atomic
  context action because dependencies and teamWorkflows share a state tree, and
  two sequential updates each rebuild from the same snapshot.

  A minZoom inside fitViewOptions clamped the teamcanvas auto-fit above the zoom
  the content actually needed, so the outermost column — the input/output cards —
  sat outside the viewport on every team, however small. Input/output was switched
  on, rendered, and never visible.

  Also: the "+ Nieuwe dependency" button opened an unsubmittable form when no
  teams existed (a regression from adding the team dropdown), accepted
  dependencies now drop out of the Heatmap/Relatiekaart risk picture and can be
  hidden on the teamcanvas, the Ketenoverzicht gained a focus mode because it hit
  the zoom floor at nine teams with half the nodes off-screen, and long team names
  overflowed their heatmap row label onto the data cells.

- **Rework dependency form and canvas, fix a real focus-jump bug, drop unused fields** (Quinten)

  Teamcanvas: add a stage-agnostic "Proces-overstijgend" band for teambrede
  Ontwikkelflow dependencies, restyle Run flow's Teambreed lane to match it,
  make Split-per-applicatie lanes always stack one per row, let chip packing
  fill the available row width instead of capping at 2 columns, and default
  the team page to Split per applicatie.

  Dependency form: team is now a real, always-visible dropdown instead of a
  silently auto-selected value; found and fixed a real bug where the modal's
  focus-trap effect was keyed to an inline onClose callback, so it re-fired
  on every keystroke and yanked focus to the close button mid-typing; made
  required-field errors visibly red instead of blending into helper text;
  gave the categorie field a persistent description instead of hover-only.

  Added a dependency "Accepteer" workflow (badge, toggle, Actief/Geaccepteerd
  tab) and a "Dupliceren" action that opens the form pre-filled as a new
  record — while wiring it up, fixed a second bug where the form's prefill
  path silently dropped team/workflowstap/effect-op-flow/actie-afspraak.

  Removed the eigenaarfunctie (owner) and oplossingsniveau fields from the
  tool entirely — form, detail view, Matrix, filters, and the insights
  engine — per explicit request; Capaciteit and functiebeheer are untouched.

## 2026-08-19
- **Replace demo dataset with a varied, realistic 7-team dataset** (Quinten)

  Old mock data predated flowtype/eigenaarFunctieIds/applicatieIds and left
  every screen looking uniform. New dataset gives each team (same names,
  richer content) its own size/profile — small vs. app-rich, Run flow-heavy
  vs. Ontwikkelflow-heavy — with real cross-team input/output chains,
  application couplings, and a deliberate risk-level spread, so Heatmap,
  Relatiekaart, Matrix, Ketenoverzicht and the Teamcanvas can actually be
  judged on variety and edge cases instead of a handful of near-identical
  rows.

  Also wires applicatieflow.connecties into the mock-seed loader in
  storage.js, which previously had no path to populate it at all.

- **Keep Heatmap clicks on the Heatmap instead of jumping to Relatiekaart** (Quinten)

  Clicking a Heatmap cell/row/column now sets a local selection and shows an
  inline detail section below the grid: the same dependency list used on the
  Relatiekaart, plus a compact mini-preview (a filtered slice of the real
  bipartite layout) scoped to just that team/category/pair. An explicit "Open
  in Relatiekaart" button (placed directly under the mini-preview) is the only
  thing that still switches views and pins the highlight there; "Wis selectie"
  clears back to a plain Heatmap. Also dropped the Heatmap container's forced
  tall min-height so it sizes to its actual content instead of leaving a big
  empty gap above the new detail section.

- **Fix Teamcanvas label overlap, IO-line targeting, and zone padding; brighten colors** (Quinten)

  - RUN FLOW label pill no longer overlaps its 'N applicaties' subtitle
  - Ontwikkelflow stage colors (STAGE_COLORS) are now a vivid cyan-to-pink
    scale with a stronger left-border/top-bar treatment, replacing the
    previous muted palette that was hard to tell apart
  - Ontwikkelflow zone's right-edge padding now matches the left edge
    (BANNER_WIDTH accounted for the stage card's own width)
  - Run flow input/output connector lines no longer fall back to the
    Ontwikkelflow stage row when a team has no application/Teambreed lanes;
    they now target a dedicated anchor centered in the Run flow zone
  - Canvas toolbar: removed the Rechthoek/Cirkel/Ruit/Lijn drawing tools,
    keeping only Notitie; BRON_TYPE_COLORS (used by both IO-item accents and
    the annotation color swatches) is now a more vivid, saturated palette

## 2026-08-18
- **Fix Teamcanvas Run flow/Ontwikkelflow zone overlap via layout math, not z-index** (Quinten)

  The lane-stacking floor and the Run flow zone's own bottom edge were computed
  from two independent, STAGE_Y-anchored budgets, so the closest lane's content
  always spilled ~52px below its own zone into the Ontwikkelflow zone regardless
  of content height. Zone boundaries now compute before lane placement, and the
  lane floor is seeded from the real zone edge with a guaranteed 32px margin.

  Also lowers idle opacity further on crossflow/appconn/IO-connector edges
  (0.04-0.05) and tunes fitView padding/minZoom so the canvas opens larger.

- **Simplify the Teamcanvas to two views, hide relation lines until hover/focus, and drop empty application lanes** (Quinten)

  - Removed the Applicatienetwerk subview entirely (toolbar toggle, computeWorkflowLayout branch, and the now-dead groupDepsByApp/netwerkGridStats/pushApplicatieNetwerk helpers) — the canvas now only has Samengevoegd and Split per applicatie
  - An application with zero Run flow-dependencies no longer gets an empty lane on the canvas; it stays fully manageable in "Applicaties in beheer/ontwikkeling" below, just not drawn as a placeholder card
  - Long/cross-zone connector lines (IO-to-lane, Ontwikkelflow-dep-to-app crossflow links, app-to-app connections) now sit at near-zero idle opacity instead of always being faintly visible; the existing hover/focus dim layer already forces related edges to full opacity, so relations still surface immediately on interaction
  - App lanes show a compact "↔ N" badge for application-to-application connections, replacing the need to see the (now near-invisible) line at rest
  - The unlabeled Run flow group in "Dependencies van dit team" is now labeled "Teambreed", matching the canvas terminology

- **Compose the Teamcanvas: compact shelf-packed lanes, a docked focus panel, and quieter default line opacity** (Quinten)

  - Run flow lanes (per-app in Split, Teambreed/Applicatiegerelateerd in Samengevoegd) now size to their own content and pack side-by-side within the shared zone width instead of each always spanning the full 7-column Ontwikkelflow width regardless of how few items they hold. Teambreed always keeps its own row so it never blends into the application lanes.
  - Clicking an application, dependency, IO item, or external team now opens a compact docked focus panel (flex sibling of the canvas, same docking pattern as TeamFilterPanel) instead of jumping straight to a full modal; the panel's action button still opens the existing DependencyDetail/IoItemModal/ApplicationDetailModal. The same click also drives strong opacity dimming of unrelated nodes/edges, layered above the existing hover-dim.
  - Several edges (notably the Run flow/Ontwikkelflow IN/OUT connectors) rendered fully opaque with no idle opacity set; all edge styles now carry an explicit subtle idle opacity so no single line dominates the canvas at rest.

## 2026-08-11
- **Fix Run flow / Ontwikkelflow label pills overlapping their zone content** (Quinten)

  ZONE_PAD (30px) was reused for both the top padding above each zone's
  label pill and the bottom padding below its content, but the label pill
  itself needs ~52-55px of clearance (offset + padding + text/dot). The
  topmost lane's background and the first Ontwikkelflow stage box both
  started well inside that pill's actual footprint, visually cutting through
  the "RUN FLOW"/"ONTWIKKELFLOW" label.

  Split into ZONE_TOP_PAD (58px, sized for the label) and ZONE_BOTTOM_PAD
  (30px, unchanged) so the label has its own clear space above the content
  on both zones.

- **Compact Samengevoegd, seamless Run flow/Ontwikkelflow join, and a new Applicatienetwerk subview** (Quinten)

  - Samengevoegd's Teambreed/Applicatiegerelateerd lanes now center their
    dependency chips within the lane's available width instead of always
    packing left against a background that's forced wide by the shared axis
    with Ontwikkelflow's 7 stage columns — this was the actual source of the
    "huge empty area" complaint. Within Applicatiegerelateerd, chips are also
    soft-clustered by application (extra spacing at app boundaries, no
    borders/cards) so same-app dependencies read as a loose group instead of
    one undifferentiated row.
  - Added a small gradient seam zone between the Run flow and Ontwikkelflow
    backgrounds so the two rounded blocks read as one continuous canvas
    instead of two separate rectangles with a gap between them.
  - New Applicatienetwerk subview inside Split per applicatie (toggle next to
    the existing Samengevoegd/Split control, shown only when split): apps lay
    out in a generalized grid (ceil(sqrt(n)) columns, works for any app
    count, unlike the reference mockup's hardcoded per-app coordinates), each
    with its own dependency cluster and app-to-app connections drawn as
    edges. Deliberately not named "Relatiekaart" — that's the existing
    org-wide page. Applicatielanes remains the default.
  - IoNode now shows its flow/scope context ("Run flow · Teambreed",
    "Ontwikkelflow · Klantportaal") directly on the card instead of only on
    hover.

  ReactFlow, the data model, forms, modals, localStorage, import/export and
  Matrix/Heatmap/Relatiekaart/Ketenoverzicht are all unchanged.

- **Make Samengevoegd and Split per applicatie genuinely different views** (Quinten)

  Samengevoegd previously showed applications as a horizontal row of cards
  with their own dependencies grouped underneath — structurally almost
  identical to Split per applicatie's stacked per-app lanes, just rotated.
  Applications are no longer canvas nodes in Samengevoegd at all:

  - All labeled Run flow dependencies now live in one 'Applicatiegerelateerd'
    group (neutral slate accent, distinct from both app-blue and
    Teambreed-green) as a flat wrapping grid, lightly sorted by app so
    dependencies for the same app tend to land near each other without a
    hard per-app boundary.
  - Each dependency chip in that group carries a small application-name tag
    instead of relying on a dedicated app card/lane for context.
  - The Run flow zone label gets a short "N applicaties in deze Run flow"
    subtitle so the application count is still visible at a glance.
  - Split per applicatie is unchanged: applications remain the primary
    structure there, one lane each.

  Also added hover-based edge dimming (same pattern as GraphView.jsx's
  hoverNodeId): edges connected to the hovered node stay at full opacity,
  everything else dims, and app-to-app Run flow koppelingen only animate
  when one of their two applications is hovered instead of always.

  ReactFlow, the data model, forms, modals, localStorage and import/export
  are unchanged; only computeWorkflowLayout's node placement and a new
  display-only edge-styling memo changed.

- **Decouple Run flow dependency positions from the Ontwikkelflow stage columns** (Quinten)

  Three rounds of styling passes on the Teamcanvas kept landing back on "the
  old workflow viewer with extra zones" because the skeleton never changed:
  every Run flow dependency was positioned on the same 7-column x-lattice as
  the Ontwikkelflow stage row, just repeated once per lane. Compared the
  delivered redesign mockup's own positioning logic against
  computeWorkflowLayout and rebuilt the Run flow side to match its actual
  model instead of just its colors:

  - Split applicaties: a lane is now a compact, fixed-height row (banner +
    dependency chips flowing left-to-right beside it) instead of a banner
    plus a 7-column dependency grid. Removed the now-meaningless shared
    "workflowstap" header row above the lane stack.
  - Samengevoegd: applications render as a horizontal row of cards with their
    own labeled dependencies grouped directly beneath them, instead of one
    combined banner+grid that mixed every app's dependencies together.
  - Teambreed (unlabeled) gets its own green accent instead of the blue used
    for real application lanes/cards, so it reads as a normal category
    rather than a technical clone of an app lane.
  - Widened STAGE_GAP for more breathing room in the Ontwikkelflow row.
  - This also shrinks total canvas height significantly, which is the direct
    fix for the canvas opening too zoomed out by default.

  ReactFlow, the data model, forms, modals, localStorage and import/export
  are all unchanged — only the default node positions inside
  computeWorkflowLayout moved; useMergedLayout still preserves any
  user-dragged positions exactly as before.

- **Bring the Teamcanvas visual much closer to the redesign mockup: bigger canvas, mockup-exact colors/sizing, restyled toolbar/minimap** (Quinten)

  - Canvas now sizes to clamp(640px, 78vh, 920px) instead of a small ~520-760px fixed cap, so it reads as a genuinely large analysis surface instead of a small embedded card (fit-view zoom went from ~0.55-0.58 to ~0.64 with a much bigger container on top of that)
  - Card sizing/typography bumped toward the mockup's scale: dependency/stage/capacity/lane-header cards widened (160px -> 176px) and their title text sized up, still within the 190px stage-column pitch so nothing overlaps
  - Canvas background and zone gradients now use the mockup's exact values (#e8edf2 page bg, #d3dbe3 dot grid at 24px gap, linear-gradient(180deg, #eef5fa 0%, #eaf1f7 100%) for the Run flow zone)
  - MiniMap resized to the mockup's exact 168x104 footprint with matching border/shadow/mask styling (previously used ReactFlow's larger default size)
  - Toolbar restructured into its own bordered header strip (min-height 56px, tinted background, bleeds to the card edges) instead of sitting flush inside the card padding, closer to the mockup's dedicated toolbar bar
  - Added an onInit + requestAnimationFrame re-fit in PannableFlowCanvas so the initial fitView reliably captures the full (now much bigger) canvas instead of occasionally clipping wide layouts on first paint

- **Visual polish pass on the Teamcanvas: readable default zoom, richer zones, unified card language, quieter toolbar** (Quinten)

  - Canvas now opens fully readable: taller viewport (up to 760px), tighter fitView padding, a sane minZoom floor, and a post-mount re-fit (via onInit + rAF) so wide layouts aren't clipped on first paint
  - Run flow / Ontwikkelflow zones get a richer gradient/shadow treatment and a nicer label pill instead of a flat tinted rectangle
  - Reworked node styling into one consistent card language: dependency markers and the Applicatieflow banner move from tinted/colored-border pills to white cards with a colored left accent bar and a proper risk badge (reusing riskStyle().badge); IO items get IN/OUT pill badges; stage/lane-header/external-team/lane-background nodes get matching soft shadows and borders
  - Toolbar regrouped into a quiet drawing-tools cluster (ghost buttons, no borders) and a right-aligned view-controls cluster with a track-style Samengevoegd/Split toggle and de-emphasized secondary buttons (Weergeven/Slim ordenen/Legenda)
  - ReactFlow's default Controls/MiniMap chrome reskinned via new scoped .teamcanvas-flow CSS (index.css) so they read as part of the app instead of library defaults; other ReactFlow canvases (Relatiekaart, Ketenoverzicht) are unaffected since the rules are scoped
  - PannableFlowCanvas gains overridable fitViewOptions/minZoom/maxZoom/className props (all default to prior behavior) so this tuning is opt-in per canvas

- **Integrate the Teamcanvas redesign: shared Run flow/Ontwikkelflow axis, Teambreed framing, external-team context, and a fuller canvas toolbar** (Quinten)

  - Wrap the Applicatieflow lane stack and the Ontwikkelflow stage row in two aligned background zones (same x-origin/width) with RUN FLOW / ONTWIKKELFLOW label pills, so they read as one canvas instead of a floating blue block over a loose white one
  - Split input/output items by flowtype: Ontwikkelflow-flagged items now flank the Ontwikkelflow zone specifically and stay within its vertical bounds, instead of spanning the whole canvas height
  - Renamed the canvas-only "unlabeled" Applicatieflow lane to "Teambreed" (the flat dependency list keeps "Niet gelabeld" for data-quality visibility)
  - Ontwikkelflow dependencies that also carry an app label now draw a subtle dashed cross-link to that app's lane banner
  - External teams (from geraakte_team_extern and the new optional IO externalTeam field) show as a small tag on the relevant chip, plus optional toggle-gated context pill nodes with connector lines
  - New toolbar: Weergeven filter dropdown (IO/Teambreed/risk-only/external-teams), Slim ordenen (resets manually dragged positions), Legenda popover, and a minimap via a new PannableFlowCanvas showMinimap prop
  - Hover on canvas nodes now shows a compact preview tooltip; clicking an app lane banner or an IO chip opens the existing ApplicationDetailModal/IoItemModal instead of a new detail panel

## 2026-08-07
- **Rename Applicatieflow to Run flow, show status/actie in the dependency list, and make split-view canvas lanes scale to many applications** (Quinten)

  - Terminology: all user-facing "Applicatieflow"/"Application flow" copy (NL+EN) now reads "Run flow" — internal flowtype value and component/variable names are untouched, so this is display-only and carries no migration risk
  - "Nog niet gelabeld" -> "Niet gelabeld" for the neutral unlabeled-app status
  - DependencyRow in "Dependencies van dit team" now also shows Status and, if present, Actie/afspraak inline, alongside the existing risk badge and app-label dropdown
  - Split-view toggle is now a proper two-state segmented control ("Samengevoegd" / "Split per applicatie") instead of a single action-toggle button
  - Canvas Run flow lanes can be collapsed individually (banner-only, no stage columns/markers) to stay compact with many applications, and a name filter (shared with the existing list-section filter) appears in the toolbar once a team has more than 4 applications

- **Treat unlabeled Applicatieflow deps as the base flow instead of a separate 'unlabeled' lane in split view** (Quinten)

  Deps without an application label aren't tied to one app, so they now render as the general 'Applicatieflow' lane (same name/style as the merged view) sitting directly against the main stage row, with per-application lanes stacking above it — instead of a distinct 'Nog niet gelabeld' bucket floating at the top.

- **Fix Matrix table column clipping, add a Matrix-style selection table to Relatiekaart, and make panel collapse controls more discoverable** (Quinten)

  - MatrixView's table used w-full inside its overflow-x-auto wrapper, which squeezed columns to fit instead of triggering horizontal scroll; switched to min-w-full so all columns stay readable via scroll
  - Extracted the table into a shared DependencyTable component; Relatiekaart now shows the same table at the bottom of the page for whatever's selected (team, category, edge, heatmap drill-through), replacing the small floating popup
  - Sidebar and Filters-panel collapse buttons now carry a persistent bordered/tinted background (and a text label on the sidebar one) so they read as buttons at rest, and the Filters master toggle is visually distinct from the individual filter-group accordions

- **Simplify app labeling to a single dropdown and remove per-lane header duplication on the canvas** (Quinten)

  - DependencyRow's app-chip picker becomes one compact select (label if chosen, otherwise a small unobtrusive "Nog niet gelabeld") instead of always listing every application
  - Applicatieflow lanes no longer repeat the 7 stage-column labels per lane (they duplicated once per application under Split applicaties); one shared header row now sits above the whole lane stack
  - Fixed lane background padding not being accounted for in the vertical stacking math, which caused adjacent lane cards to overlap by a couple pixels

## 2026-08-06
- **Merge Applicatie-details into the applications list, give each Applicatieflow lane a shared background so it reads as one unit** (Quinten)

  - Drop ApplicatieflowTab's separate detail list/modal; app toelichting/risico now edits inline from the "Applicaties in beheer/ontwikkeling" row via a new ApplicationDetailModal in TeamPage
  - Applicatieflow lanes (banner + per-stage column labels + dependency markers) now sit inside one bounded, color-matched container instead of floating as disconnected elements, and the mini stage labels reuse the same per-stage accent color as the main Ontwikkelflow row

- **Let Ontwikkelflow deps carry an app label, replace the app-link canvas with connection lines in split view, and turn Input/Output/Capacity into edit-modal lists** (Quinten)

  Application labeling is no longer exclusive to Applicatieflow — every application has both a development flow and a run flow, so Ontwikkelflow dependencies can now be labeled too, with a tighter chip style to keep the list scannable. Removes ApplicatieflowTab's own network canvas (it duplicated what the main workflow canvas already shows); the app-to-app connection picker stays, and those connections now render as lines directly between the application lanes on the main canvas when "Split applicaties" is on. Input, output, and capacity rows move from always-open inline fields to a compact list with a small edit modal per item, and input/output items gain the same optional Ontwikkelflow/Applicatieflow choice dependencies have.

- **Merge Applicatieflow into main team-page view, pair it with workflowstap, and fix dependency-form footer/list layout** (Quinten)

  Removes the Workflow/Applicatieflow tab switch — the applicatieflow editor now lives inline on the same page. Workflowstap becomes optional (not hidden) for Applicatieflow dependencies, since the two are treated as one connected concept: the Applicatieflow canvas lane now mirrors the Ontwikkelflow stage row (same 7 columns, repeated per application when "Split applicaties" is on, plus a "Geen workflowstap" bucket), and the "Dependencies van dit team" list sub-groups each application's deps by stage the same way. Also makes the dependency edit modal's Save/Cancel buttons a sticky footer instead of scrolling away with the field list, and cleans up the input/output/applications editors into a consistent, less cluttered list style.

- **Flatten sidebar nav to Heatmap/Relatiekaart/Matrix/Keten, make Heatmap fully clickable, add Applicatieflow lanes to team canvas** (Quinten)

  Sidebar: replace the Netwerkweergave parent + nested sub-tabs with four flat top-level items in the requested order. Heatmap: row labels and column headers are now clickable (pin by team or by category alone, dimming the whole row/column), and per-cell hover no longer bleeds into whole-column dimming. Team page: fixes the empty Applicatieflow section (now always visible with an empty state), adds a wide Applicatieflow banner above the workflow-stage row with a "Split applicaties" toggle that turns it into one lane per application filled with that app's labeled dependencies, and adds an optional application label to input/output items.

- **Split dependencies into Ontwikkelflow/Applicatieflow, fix dead workflow-canvas grouping, make Heatmap default with click-through highlight** (Quinten)

  Adds a required Flowtype field (schema v4, safe migration for legacy data), fixes a bug where dependency markers never rendered on the team workflow canvas (wrong field name), splits the team page's dependency list by flow type with inline application labeling, and turns Heatmap into the default network view with a pinned team+category highlight when drilling in from a cell.

- **Make sidebar and filter panel collapsible, drop Cluster network mode** (Quinten)

  Both the left sidebar and the right TeamFilterPanel (used across
  Matrix/Network/Chain) can now be collapsed to a slim icon rail via a
  toggle button, reclaiming canvas width on demand — the collapsed
  state lives in each component itself (filter panel) or in App.jsx
  (sidebar, since main's padding needs to react to it too).

  Also removes the Cluster mode from Network view per feedback that it
  wasn't adding value alongside Bipartite and Heatmap — removed from
  the segmented control, the sidebar's view sub-tabs, and the now-dead
  render branch and i18n key.

## 2026-07-21
- **Fix node-stacking bug, overhaul sidebar/heatmap, add scope+all-none filters** (Quinten)

  Fixes a real bug where re-showing a previously hidden team in Network
  view could land its node on a stale position and visually overlap
  another node — GraphView now uses the same useMergedLayout hook as
  Chain overview/Team page, which only preserves position for nodes the
  user actually dragged instead of blindly keeping any previously-seen
  node's old coordinates.

  Sidebar: team rows get inline rename/archive/delete, adding a team
  moves fully into Settings (no longer duplicated in the sidebar), and
  Network view's Bipartite/Cluster/Heatmap modes are also selectable as
  sidebar sub-tabs. Topbar becomes fixed (was scrolling out of view)
  and gets its KPIs back alongside the title/subtitle.

  Heatmap mode gets a real usability pass: short label + icon per
  column header, sticky headers, hover tooltip with a full risk
  breakdown, column highlight/dim on hover, and a legend.

  Adds a Teamniveau/Ketenniveau/Alles scope filter to Network and Chain
  views (previously only Matrix had this), and adds the same All/None
  quick-toggle already on Teams/Risk level to every other filter group
  (Workflow step, Effect on flow, Resolution level, Owner function).

- **Widen canvas views, move Matrix summary cards up, add safe modal close** (Quinten)

  Layout/UX pass, no data model or business logic changes. Netwerkweer-
  gave and Ketenoverzicht now size their canvas to available viewport
  height (max(Npx, calc(100vh - offset))) instead of a fixed/content-
  driven cap, so they read as full analysis canvases instead of small,
  centered boxes; Ketenoverzicht also gets a visible zoom toolbar
  (-/fit/+) above the canvas. Matrix's four summary/insight cards move
  above the table so they're visible without scrolling. The dependency
  form gets a close (X) button that shares Cancel's logic, prompting
  for confirmation only when the form has unsaved input. Team page and
  Applicatieflow gain more breathing room now that the app shell lets
  canvas-heavy views use the full page width instead of a fixed
  max-width.

## 2026-07-20
- **Decouple team navigation from view filtering, polish network/chain views** (Quinten)

  The topbar's team dropdown conflated two things: filtering a view and
  navigating to a team's page. Splits them apart — a new persistent
  Sidebar (replacing the old rail plus the modal team drawer) gets a
  dedicated, scrollable Teams section that navigates straight to a
  team's page, while the topbar shrinks to just global KPIs and
  actions. Matrix/Netwerk/Ketenoverzicht now always start at all teams
  regardless of navigation state, and the Matrix filter panel's "Teams"
  group is relabeled to "Teams tonen" so it reads as a filter, not nav.

  Also polishes the network view (symmetric hover-dim for categories,
  linked-team counts, a risk-level legend) and the chain view (shaded
  per-team swimlane backgrounds, fixing a fitView zoom bug caused by an
  oversized background node), and groups the team page's sections into
  one visually cohesive card.

- **Add team workflow boards, chain overview, and streamlined nav** (Quinten)

  Adds three new views built on the existing teamId-based data model:
  a per-team workflow board (drag/drop stages, capacity planning against
  the existing functies list, cross-team input/output linking,
  snapshots) with an Applicatieflow sub-tab and first-run guided tour,
  plus a cross-team Ketenoverzicht chain view. Storage schema bumped to
  v3 with a migration path for existing data.

  Also reworks primary navigation: the header's team hamburger is
  replaced by a quick-switch dropdown ("Alle teams" included), the
  Teamniveau/Ketenniveau toggle moves into Matrix where it's actually
  used, and the team/risk/etc. filter panel becomes collapsible so it
  doesn't dominate the page.

- **Restyle UI to UWV blue/slate visual identity** (Quinten)

  Rebrands colors app-wide (stone/warm-green -> slate/blue), decouples
  destructive-action styling from risk colors, and reworks Header into a
  fixed icon rail with dark status bar. Also updates GraphView to a
  teams-left/categories-right layout with hover-dim focus, and adds a
  risk intensity bar to MatrixView. No functional or data-model changes.

- **first commit** (Quinten)

## 2026-07-10
- **Initial commit: Dependency Insight v1** (Quinten)
