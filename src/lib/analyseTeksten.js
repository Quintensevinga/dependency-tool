// Tekstlaag van de analysepagina: signalen (waarschuwingen per record),
// constateringen (per regel een samenvattende zin) en het rapport (lopende
// tekst over het geheel of één team). Alle zinnen zijn sjablonen per taal;
// de feiten komen uit lib/analytics.js. Getallen worden hier alleen in
// woorden gezet, nooit berekend.

import { translateStatus, translateRiskLevel, translateCategorie, translateWorkflowStage, translateDeadline } from '../i18n/labels'
import { calculateRisk, riskLevelRank } from './risk'
import { dagenTussen, isoDag } from './analytics'

export function vul(sjabloon, vars) {
  if (!vars) return sjabloon
  return sjabloon.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])))
}

const Z = {
  nl: {
    // --- signalen (per record) ---
    kritiekZonderAfspraak: '‘{{titel}}’ ({{team}}) is kritiek (score {{score}}), staat op ‘{{status}}’ en heeft geen actie-afspraak.',
    hardeDeadlineZonderAfspraak: '‘{{titel}}’ ({{team}}) heeft een harde deadline ({{deadlineTekst}}) maar geen actie-afspraak.',
    langBlokkerend: '‘{{titel}}’ ({{team}}) blokkeert al {{dagen}} dagen onafgebroken.',
    blokkerendVerouderd: '‘{{titel}}’ ({{team}}) is actief blokkerend maar al {{dagen}} dagen niet bijgewerkt.',
    hoogVerouderd: '‘{{titel}}’ ({{team}}) scoort {{niveau}}, heeft geen actie-afspraak en is {{dagen}} dagen niet bijgewerkt.',
    sluimerend: '‘{{titel}}’ ({{team}}) staat al {{dagen}} dagen als bekend risico op niveau {{niveau}}, zonder actie-afspraak.',
    stilRisico: '‘{{titel}}’ ({{team}}) scoort {{niveau}}, maar het flowverlies is {{flowverlies}}: dit staat nergens bovenaan.',
    geaccepteerdHoog: '‘{{titel}}’ ({{team}}) is geparkeerd als geaccepteerd, maar scoort {{niveau}}.',
    partijGeweigerd: '‘{{titel}}’ ({{team}}) verwijst naar {{partij}}, een geweigerde partij.',
    verslechterd: '‘{{titel}}’ ({{team}}) ging in 30 dagen van {{vanNiveau}} ({{van}}) naar {{naarNiveau}} ({{naar}}).',
    teruggevallen: '‘{{titel}}’ ({{team}}) was gemitigeerd, maar staat sinds {{datum}} weer op ‘{{status}}’.',
    heropend: '‘{{titel}}’ ({{team}}) is op {{datum}} heropend na sluiting.',
    gemitigeerdNietGesloten: '‘{{titel}}’ ({{team}}) is al {{dagen}} dagen gemitigeerd maar nog niet afgesloten.',
    verzoekOud: 'Het koppelingsverzoek ‘{{label}}’ van {{team}} aan {{doel}} wacht al {{dagen}} dagen op een besluit.',
    reviewOud: 'De aanmelding ‘{{titel}}’ ({{team}}) wacht al {{dagen}} dagen op review.',
    spofZonderDetail: '{{app}} ({{team}}) draagt {{last}} relaties, maar het risico bij uitval is niet ingevuld.',
    gedeeldeApp: '{{app}} ({{team}}) is via de keten gekoppeld aan {{aantal}} andere teams ({{teamNamen}}) en draagt {{deps}} eigen dependencies.',
    kennisBusFactor: '{{team}} heeft {{kennisHoog}} kennisdependencies op Hoog of Kritiek en {{risicoRijen}} rollen met risico bij uitval (score {{score}}).',
    ketenRisico: '{{team}} ontvangt input van {{n}} teams die samen {{blokkerend}} blokkerende en {{hoog}} hoge of kritieke dependencies open hebben.',
    partijHub: '{{partij}} raakt {{teams}} van de {{totaal}} teams met {{deps}} dependencies, waarvan {{blokkerend}} blokkerend.',
    wederzijds: '{{a}} en {{b}} hebben dependencies op elkaar: {{aNaarB}} en {{bNaarA}}.',
    slapendTeam: '{{team}} heeft al {{dagen}} dagen niets geregistreerd of bijgewerkt.',
    slapendTeamNooit: '{{team}} heeft nog nooit iets geregistreerd.',
    dubbeleRegistratie: '‘{{titel}}’ is apart geregistreerd door {{aantal}} teams: {{teamNamen}}.',
    teamVerouderd: 'Bij {{team}} is {{pct}}% van de open dependencies ({{verouderd}} van {{totaal}}) meer dan 90 dagen niet bijgewerkt.',
    // --- constatering (regelniveau) ---
    cDeps: '{{deps}} bij {{teams}}, vooral bij {{top}} ({{topN}}); hoogste risico {{hoogste}}, {{blokkerend}} blokkerend, oudste {{oudste}} dagen open.',
    cDepsEen: '{{deps}} bij {{top}}; hoogste risico {{hoogste}}, {{blokkerend}} blokkerend, oudste {{oudste}} dagen open.',
    cBacklog: 'Gemiddeld {{nieuw}} nieuwe en {{gesloten}} gesloten per week over de laatste {{weken}} weken: netto {{netto}} erbij per week, over {{horizon}} weken ongeveer {{proj}} open.',
    // --- rapport ---
    rKopSamenvatting: 'Samenvatting',
    rKopOntwikkeling: 'Ontwikkeling',
    rKopRisico: 'Risico en urgentie',
    rKopTeams: 'Teams',
    rKopKeten: 'Keten en partijen',
    rKopApps: 'Applicaties en proces',
    rKopKwaliteit: 'Datakwaliteit en beheer',
    rKopAanbevelingen: 'Aanbevelingen',
    r1: 'Op {{datum}} {{ww1}} er {{open}} open bij {{scope}}: {{kritiek}} kritiek, {{hoog}} hoog, {{gemiddeld}} gemiddeld en {{laag}} laag.',
    r2: '{{blokkerend}} daarvan {{ww1}} actief, {{gemitigeerd}} {{ww2}} gemitigeerd en {{geaccepteerd}} {{ww3}} bewust geparkeerd; de gemiddelde risicoscore is {{score}}.',
    r3: 'In de afgelopen 30 dagen {{ww1}} er {{nieuw}} bij en {{ww2}} er {{gesloten}} afgesloten; het aantal open dependencies {{richting}}.',
    rSteeg: 'steeg van {{van}} naar {{naar}}',
    rDaalde: 'daalde van {{van}} naar {{naar}}',
    rGelijk: 'bleef {{naar}}',
    r4: 'Het aantal actief blokkerende dependencies ging van {{van}} naar {{naar}}, het aantal hoge of kritieke van {{hvan}} naar {{hnaar}}.',
    r5: 'Over de laatste {{weken}} weken kwamen er gemiddeld {{nieuwPerWeek}} dependencies per week bij en werden er {{geslotenPerWeek}} afgesloten; bij dit tempo staan er over {{horizon}} weken ongeveer {{proj}} open{{leeg}}.',
    r5leeg: ' en is de huidige voorraad zonder nieuwe aanwas in {{weken}} weken weggewerkt',
    r6: '{{verslechterd}} {{ww1}} in 30 dagen in score en {{verbeterd}} {{ww2}}; de grootste stijger is ‘{{titel}}’ ({{team}}, van {{van}} naar {{naar}}).',
    r6b: 'In de afgelopen 30 dagen veranderde geen enkele risicoscore.',
    r7: '{{teruggevallen}} {{ww1}} geen stand en {{heropend}} {{ww2}} heropend na sluiting.',
    r8: 'Mitigeren duurt gemiddeld {{gem}} dagen (mediaan {{med}}, n = {{n}}) en afsluiten gemiddeld {{gemS}} dagen (n = {{nS}}); {{ooit}} {{ww1}} ooit blokkerend geweest, gemiddeld {{blok}} dagen.',
    r9: 'De hoogste scores: {{top}}.',
    r10: '{{quick}} {{ww1}} quick wins (zelf oplosbaar, veel flowverlies), {{opschalen}} {{ww2}} opschaling buiten het team en {{stil}} {{ww3}} stille risico’s: laag of gemiddeld risico, maar hoog flowverlies.',
    r11: '{{deadlines}} {{ww1}} een vaste of harde deadline, waarvan {{zonder}} zonder actie-afspraak; in totaal heeft {{pct}}% van de open, niet-gemitigeerde dependencies een actie-afspraak.',
    r12: '{{verouderd}} ({{pct}}%) {{ww1}} meer dan 90 dagen niet bijgewerkt, {{chronisch}} {{ww2}} langer dan een jaar open en {{sluimerend}} {{ww3}}: hoog of kritiek, ouder dan een half jaar, zonder afspraak.',
    r13: '{{meeste}} heeft de meeste open dependencies ({{n1}}), {{hoogste}} de meeste hoge of kritieke ({{n2}}) en {{flow}} het hoogste flowverlies ({{n3}} punten).',
    r13zelfde: '{{team}} voert alle lijsten aan: de meeste open dependencies ({{n1}}), de meeste hoge of kritieke ({{n2}}) en het hoogste flowverlies ({{n3}} punten).',
    r14: 'Netto veroorzaker is {{team}} ({{netto}}): {{veroorzaakt}} dependencies bij andere teams tegenover {{ondervonden}} zelf ondervonden; {{wederzijds}} teamparen zijn wederzijds van elkaar afhankelijk.',
    r14b: 'Geen enkel team is netto veroorzaker bij andere teams.',
    r15: 'Kennisconcentratie is het hoogst bij {{team}} (score {{score}}: {{kennisHoog}} kennisdependencies op Hoog of Kritiek, {{risicoRijen}} rollen met uitvalrisico).',
    r16: '{{team}} staat op {{open}} open dependencies tegenover gemiddeld {{gemOpen}} per team, {{hoogPlus}} hoog of kritiek tegenover {{gemHoog}}, en een flowverlies van {{flow}} tegenover {{gemFlow}}.',
    r17: 'De keten telt {{edges}} geaccepteerde koppelingen en {{cycli}}; {{verzoeken}} {{ww1}} open{{oudste}} en een besluit duurt gemiddeld {{gem}} dagen.',
    r17geenCycli: 'geen cycli',
    r17cyclus: '1 cyclus',
    r17cycli: '{{n}} cycli',
    r17oudste: ' (oudste {{d}} dagen)',
    r18: '{{losIn}} {{ww1}} nog niet verklaard (geen koppeling of partij) en {{losUit}} {{ww2}} door niemand afgenomen; de kaart is gemiddeld {{volledigheid}}% compleet.',
    r19: '{{depZonder}} {{ww1}} op een team zonder ketenkoppeling en {{koppelingZonder}} {{ww2}} geen dependency in welke richting ook.',
    r20: '{{team}} ontvangt input van {{n}} teams en draagt daarmee het meeste stroomopwaartse risico: bij de directe toeleveranciers staan {{blokkerend}} blokkerende en {{hoog}} hoge of kritieke dependencies open.',
    r21: 'Grootste externe hub is {{partij}} ({{teams}}, {{deps}}); de drie grootste partijen dekken {{aandeel}}% van alle partij-dependencies.',
    r22: '{{geweigerd}} {{ww1}} naar een geweigerde partij en {{inAfwachting}} naar een partij die nog niet is goedgekeurd.',
    r23: '{{risico}} {{ww1}} gemarkeerd met risico bij uitval; zwaarst belast is {{app}} ({{team}}: {{deps}} dependencies, {{io}} in- en outputitems, {{conns}} koppelingen) en {{gedeeld}} {{ww2}} via de keten aan andere teams gekoppeld.',
    r24: 'De werkstap {{stap}} draagt de meeste ontwikkelflow-dependencies ({{n}}, {{blokkerend}} blokkerend); {{zonder}} {{ww1}} wel dependencies maar geen capaciteit.',
    r25: 'Het totale flowverlies is {{som}} punten; {{categorie}} is de duurste categorie ({{c}}){{partijDeel}}.',
    r25partij: ' en {{partij}} de duurste partij ({{p}})',
    r26: '{{meldingen}} uit de hygiënecontroles, vooral {{top}}.',
    r27: 'In de laatste 90 dagen was {{team}} het actiefst ({{n}} logregels); {{slapend}}.',
    r27geen: 'geen enkel team is 60 dagen stil',
    r27wel: '{{teams}} {{ww}} al 60 dagen stil',
    r28: '{{review}} {{ww1}} op review, er zijn {{dup}} duplicaatmeldingen geregistreerd en {{groepen}} {{ww2}} door meer dan één team apart vastgelegd.',
    a1: 'Leg actie-afspraken vast voor de {{n}} kritieke dependencies en de {{m}} met een harde deadline die er nog geen hebben.',
    a2: 'Werk de {{n}} blokkerende dependencies bij die al meer dan 90 dagen niet zijn aangeraakt, of sluit ze af.',
    a3: 'Pak de {{n}} quick wins op: zelf oplosbaar en de moeite waard.',
    a4: 'Bespreek de {{n}} stille risico’s; de risicoscore zet ze niet bovenaan, het flowverlies wel.',
    a5: 'Neem een besluit over de {{n}} koppelingsverzoeken die langer dan twee weken openstaan.',
    a6: 'Vul het risico bij uitval in voor {{n}} zwaar belaste applicaties.',
    a7: 'Bespreek de kennisconcentratie bij {{teams}}.',
    a8: 'Maak {{n}} profielen compleet (wachttijd, deadline, oplosbaarheid), zodat de kwadrantanalyse ze meeneemt.',
    a9: 'De voorraad groeit met {{netto}} per week; plan sluitcapaciteit in of accepteer dat bewust.',
    a10: 'Sluit de {{n}} dependencies af die al meer dan 90 dagen gemitigeerd zijn.',
    a11: 'Vraag {{teams}} de eigen dependencies te herzien; daar is al 60 dagen niets geregistreerd.',
    a12: 'Bespreek de wederzijdse afhankelijkheid tussen {{paren}}.',
    a13: 'Bekijk de {{n}} dependencies die in 30 dagen naar Hoog of Kritiek stegen.',
    a14: 'Herbeoordeel de {{n}} mitigaties die geen stand hielden.',
    aGeen: 'Geen aanbevelingen: alle regels zijn schoon.',
    // --- woorden ---
    dependency: 'dependency',
    dependencies: 'dependencies',
    team: 'team',
    teams: 'teams',
    input: 'input',
    inputs: 'inputs',
    output: 'output',
    outputs: 'outputs',
    koppeling: 'koppeling',
    koppelingen: 'koppelingen',
    verzoek: 'koppelingsverzoek',
    verzoeken: 'koppelingsverzoeken',
    applicatie: 'applicatie',
    applicaties: 'applicaties',
    werkstap: 'werkstap',
    werkstappen: 'werkstappen',
    aanmelding: 'aanmelding',
    aanmeldingen: 'aanmeldingen',
    melding: 'melding',
    meldingen: 'meldingen',
    mitigatie: 'mitigatie',
    mitigaties: 'mitigaties',
    is: 'is',
    zijn: 'zijn',
    en: 'en',
    // werkwoorden: [enkelvoud, meervoud]
    wwZijn: ['is', 'zijn'],
    wwHebben: ['heeft', 'hebben'],
    wwStaan: ['staat', 'staan'],
    wwBlokkeren: ['blokkeert', 'blokkeren'],
    wwKwam: ['kwam', 'kwamen'],
    wwWerd: ['werd', 'werden'],
    wwSteeg: ['steeg', 'stegen'],
    wwDaalde: ['daalde', 'daalden'],
    wwHield: ['hield', 'hielden'],
    wwVragen: ['vraagt', 'vragen'],
    wwSluimeren: ['sluimert', 'sluimeren'],
    wwWorden: ['wordt', 'worden'],
    wwWijzen: ['wijst', 'wijzen'],
    wwVerwijzen: ['verwijst', 'verwijzen'],
    wwDragen: ['is', 'zijn'],
    wwWachten: ['wacht', 'wachten'],
    // hygiënelabels voor het rapport
    hFlowtype: 'zonder flowtype',
    hProfiel: 'profiel onvolledig',
    hDeadlineTekst: 'deadline zonder tekst',
    hCategorieScope: 'categorie past niet bij scope',
    hExternZonderPartij: 'ketenniveau zonder partij',
    hPartijOnbekend: 'partij niet in register',
    hPartijGeweigerd: 'geweigerde partij genoemd',
    hEffectLeeg: 'effect op flow leeg',
    hGeenToelichting: 'zonder toelichting',
    hDubbeleTitels: 'dubbele titels',
    hVerouderd: 'verouderd',
    hZonderAanmaak: 'zonder aanmaakdatum',
  },
  en: {
    kritiekZonderAfspraak: '‘{{titel}}’ ({{team}}) is critical (score {{score}}), sits at ‘{{status}}’ and has no action agreement.',
    hardeDeadlineZonderAfspraak: '‘{{titel}}’ ({{team}}) has a hard deadline ({{deadlineTekst}}) but no action agreement.',
    langBlokkerend: '‘{{titel}}’ ({{team}}) has been blocking for {{dagen}} days without interruption.',
    blokkerendVerouderd: '‘{{titel}}’ ({{team}}) is actively blocking but has not been updated for {{dagen}} days.',
    hoogVerouderd: '‘{{titel}}’ ({{team}}) scores {{niveau}}, has no action agreement and has not been updated for {{dagen}} days.',
    sluimerend: '‘{{titel}}’ ({{team}}) has been a known risk at level {{niveau}} for {{dagen}} days, without an action agreement.',
    stilRisico: '‘{{titel}}’ ({{team}}) scores {{niveau}}, but the flow loss is {{flowverlies}}: it never reaches the top of any list.',
    geaccepteerdHoog: '‘{{titel}}’ ({{team}}) is parked as accepted, but scores {{niveau}}.',
    partijGeweigerd: '‘{{titel}}’ ({{team}}) refers to {{partij}}, a rejected party.',
    verslechterd: '‘{{titel}}’ ({{team}}) went from {{vanNiveau}} ({{van}}) to {{naarNiveau}} ({{naar}}) in 30 days.',
    teruggevallen: '‘{{titel}}’ ({{team}}) was mitigated, but has been back at ‘{{status}}’ since {{datum}}.',
    heropend: '‘{{titel}}’ ({{team}}) was reopened on {{datum}} after closure.',
    gemitigeerdNietGesloten: '‘{{titel}}’ ({{team}}) has been mitigated for {{dagen}} days but is not closed yet.',
    verzoekOud: 'The link request ‘{{label}}’ from {{team}} to {{doel}} has been waiting {{dagen}} days for a decision.',
    reviewOud: 'The registration ‘{{titel}}’ ({{team}}) has been waiting {{dagen}} days for review.',
    spofZonderDetail: '{{app}} ({{team}}) carries {{last}} relations, but its outage risk is not filled in.',
    gedeeldeApp: '{{app}} ({{team}}) is linked to {{aantal}} other teams via the chain ({{teamNamen}}) and carries {{deps}} own dependencies.',
    kennisBusFactor: '{{team}} has {{kennisHoog}} knowledge dependencies at High or Critical and {{risicoRijen}} roles with outage risk (score {{score}}).',
    ketenRisico: '{{team}} receives input from {{n}} teams that together have {{blokkerend}} blocking and {{hoog}} high or critical dependencies open.',
    partijHub: '{{partij}} touches {{teams}} of the {{totaal}} teams with {{deps}} dependencies, {{blokkerend}} of them blocking.',
    wederzijds: '{{a}} and {{b}} have dependencies on each other: {{aNaarB}} and {{bNaarA}}.',
    slapendTeam: '{{team}} has not registered or updated anything for {{dagen}} days.',
    slapendTeamNooit: '{{team}} has never registered anything.',
    dubbeleRegistratie: '‘{{titel}}’ was registered separately by {{aantal}} teams: {{teamNamen}}.',
    teamVerouderd: 'At {{team}}, {{pct}}% of the open dependencies ({{verouderd}} of {{totaal}}) have not been updated for more than 90 days.',
    cDeps: '{{deps}} at {{teams}}, mostly at {{top}} ({{topN}}); highest risk {{hoogste}}, {{blokkerend}} blocking, oldest open for {{oudste}} days.',
    cDepsEen: '{{deps}} at {{top}}; highest risk {{hoogste}}, {{blokkerend}} blocking, oldest open for {{oudste}} days.',
    cBacklog: 'On average {{nieuw}} new and {{gesloten}} closed per week over the last {{weken}} weeks: net {{netto}} added per week, about {{proj}} open in {{horizon}} weeks.',
    rKopSamenvatting: 'Summary',
    rKopOntwikkeling: 'Development',
    rKopRisico: 'Risk and urgency',
    rKopTeams: 'Teams',
    rKopKeten: 'Chain and parties',
    rKopApps: 'Applications and process',
    rKopKwaliteit: 'Data quality and administration',
    rKopAanbevelingen: 'Recommendations',
    r1: 'On {{datum}} there {{ww1}} {{open}} open at {{scope}}: {{kritiek}} critical, {{hoog}} high, {{gemiddeld}} medium and {{laag}} low.',
    r2: '{{blokkerend}} of them {{ww1}}, {{gemitigeerd}} {{ww2}} mitigated and {{geaccepteerd}} {{ww3}} deliberately parked; the average risk score is {{score}}.',
    r3: 'In the last 30 days {{nieuw}} {{ww1}} added and {{gesloten}} {{ww2}} closed; the number of open dependencies {{richting}}.',
    rSteeg: 'rose from {{van}} to {{naar}}',
    rDaalde: 'fell from {{van}} to {{naar}}',
    rGelijk: 'stayed at {{naar}}',
    r4: 'The number of actively blocking dependencies went from {{van}} to {{naar}}, the number of high or critical ones from {{hvan}} to {{hnaar}}.',
    r5: 'Over the last {{weken}} weeks an average of {{nieuwPerWeek}} dependencies per week were added and {{geslotenPerWeek}} were closed; at this pace about {{proj}} will be open in {{horizon}} weeks{{leeg}}.',
    r5leeg: ', and without new intake the current backlog would be cleared in {{weken}} weeks',
    r6: '{{verslechterd}} {{ww1}} in score over 30 days and {{verbeterd}} {{ww2}}; the biggest riser is ‘{{titel}}’ ({{team}}, from {{van}} to {{naar}}).',
    r6b: 'No risk score changed in the last 30 days.',
    r7: '{{teruggevallen}} {{ww1}} and {{heropend}} {{ww2}} reopened after closure.',
    r8: 'Mitigation takes {{gem}} days on average (median {{med}}, n = {{n}}) and closure {{gemS}} days (n = {{nS}}); {{ooit}} {{ww1}} blocking at some point, for {{blok}} days on average.',
    r9: 'The highest scores: {{top}}.',
    r10: '{{quick}} {{ww1}} quick wins (solvable by the team, much flow loss), {{opschalen}} {{ww2}} escalation outside the team and {{stil}} {{ww3}} silent risks: low or medium risk, but high flow loss.',
    r11: '{{deadlines}} {{ww1}} a fixed or hard deadline, {{zonder}} of them without an action agreement; in total {{pct}}% of the open, unmitigated dependencies have an action agreement.',
    r12: '{{verouderd}} ({{pct}}%) {{ww1}} not been updated for more than 90 days, {{chronisch}} {{ww2}} open for more than a year and {{sluimerend}} {{ww3}}: high or critical, older than six months, without an agreement.',
    r13: '{{meeste}} has the most open dependencies ({{n1}}), {{hoogste}} the most high or critical ones ({{n2}}) and {{flow}} the highest flow loss ({{n3}} points).',
    r13zelfde: '{{team}} leads every list: the most open dependencies ({{n1}}), the most high or critical ones ({{n2}}) and the highest flow loss ({{n3}} points).',
    r14: 'The net cause is {{team}} ({{netto}}): {{veroorzaakt}} dependencies at other teams against {{ondervonden}} experienced; {{wederzijds}} team pairs depend on each other.',
    r14b: 'No team is a net cause at other teams.',
    r15: 'Knowledge concentration is highest at {{team}} (score {{score}}: {{kennisHoog}} knowledge dependencies at High or Critical, {{risicoRijen}} roles with outage risk).',
    r16: '{{team}} has {{open}} open dependencies against an average of {{gemOpen}} per team, {{hoogPlus}} high or critical against {{gemHoog}}, and a flow loss of {{flow}} against {{gemFlow}}.',
    r17: 'The chain has {{edges}} accepted links and {{cycli}}; {{verzoeken}} {{ww1}} open{{oudste}} and a decision takes {{gem}} days on average.',
    r17geenCycli: 'no cycles',
    r17cyclus: '1 cycle',
    r17cycli: '{{n}} cycles',
    r17oudste: ' (oldest {{d}} days)',
    r18: '{{losIn}} {{ww1}} not explained yet (no link or party) and {{losUit}} {{ww2}} consumed by nobody; the map is {{volledigheid}}% complete on average.',
    r19: '{{depZonder}} {{ww1}} at a team without a chain link and {{koppelingZonder}} {{ww2}} no dependency in either direction.',
    r20: '{{team}} receives input from {{n}} teams and therefore carries the most upstream risk: its direct suppliers have {{blokkerend}} blocking and {{hoog}} high or critical dependencies open.',
    r21: 'The largest external hub is {{partij}} ({{teams}}, {{deps}}); the three largest parties cover {{aandeel}}% of all party dependencies.',
    r22: '{{geweigerd}} {{ww1}} to a rejected party and {{inAfwachting}} to a party that has not been approved yet.',
    r23: '{{risico}} {{ww1}} marked with outage risk; the most loaded is {{app}} ({{team}}: {{deps}} dependencies, {{io}} input and output items, {{conns}} links) and {{gedeeld}} {{ww2}} linked to other teams via the chain.',
    r24: 'The step {{stap}} carries the most development-flow dependencies ({{n}}, {{blokkerend}} blocking); {{zonder}} {{ww1}} dependencies but no capacity.',
    r25: 'The total flow loss is {{som}} points; {{categorie}} is the most expensive category ({{c}}){{partijDeel}}.',
    r25partij: ' and {{partij}} the most expensive party ({{p}})',
    r26: '{{meldingen}} from the hygiene checks, mostly {{top}}.',
    r27: 'In the last 90 days {{team}} was the most active ({{n}} log entries); {{slapend}}.',
    r27geen: 'no team has been quiet for 60 days',
    r27wel: '{{teams}} {{ww}} been quiet for 60 days',
    r28: '{{review}} {{ww1}} for review, {{dup}} duplicate warnings were recorded and {{groepen}} {{ww2}} registered separately by more than one team.',
    a1: 'Record action agreements for the {{n}} critical dependencies and the {{m}} with a hard deadline that do not have one yet.',
    a2: 'Update the {{n}} blocking dependencies that have not been touched for more than 90 days, or close them.',
    a3: 'Pick up the {{n}} quick wins: solvable by the team and worth it.',
    a4: 'Discuss the {{n}} silent risks; the risk score does not put them on top, the flow loss does.',
    a5: 'Decide on the {{n}} link requests that have been open for more than two weeks.',
    a6: 'Fill in the outage risk for {{n}} heavily loaded applications.',
    a7: 'Discuss the knowledge concentration at {{teams}}.',
    a8: 'Complete {{n}} profiles (waiting time, deadline, solvability) so the quadrant analysis includes them.',
    a9: 'The backlog grows by {{netto}} per week; plan closing capacity or accept that deliberately.',
    a10: 'Close the {{n}} dependencies that have been mitigated for more than 90 days.',
    a11: 'Ask {{teams}} to review their dependencies; nothing has been registered there for 60 days.',
    a12: 'Discuss the mutual dependency between {{paren}}.',
    a13: 'Look at the {{n}} dependencies that rose to High or Critical in 30 days.',
    a14: 'Reassess the {{n}} mitigations that did not hold.',
    aGeen: 'No recommendations: all rules are clean.',
    dependency: 'dependency',
    dependencies: 'dependencies',
    team: 'team',
    teams: 'teams',
    input: 'input',
    inputs: 'inputs',
    output: 'output',
    outputs: 'outputs',
    koppeling: 'link',
    koppelingen: 'links',
    verzoek: 'link request',
    verzoeken: 'link requests',
    applicatie: 'application',
    applicaties: 'applications',
    werkstap: 'step',
    werkstappen: 'steps',
    aanmelding: 'registration',
    aanmeldingen: 'registrations',
    melding: 'finding',
    meldingen: 'findings',
    mitigatie: 'mitigation',
    mitigaties: 'mitigations',
    is: 'has',
    zijn: 'have',
    en: 'and',
    wwZijn: ['is', 'are'],
    wwHebben: ['has', 'have'],
    wwStaan: ['has been', 'have been'],
    wwBlokkeren: ['is actively blocking', 'are actively blocking'],
    wwKwam: ['was', 'were'],
    wwWerd: ['was', 'were'],
    wwSteeg: ['rose', 'rose'],
    wwDaalde: ['fell', 'fell'],
    wwHield: ['did not hold', 'did not hold'],
    wwVragen: ['needs', 'need'],
    wwSluimeren: ['is dormant', 'are dormant'],
    wwWorden: ['is', 'are'],
    wwWijzen: ['points', 'point'],
    wwVerwijzen: ['refers', 'refer'],
    wwDragen: ['is', 'are'],
    wwWachten: ['is waiting', 'are waiting'],
    hFlowtype: 'without flow type',
    hProfiel: 'profile incomplete',
    hDeadlineTekst: 'deadline without text',
    hCategorieScope: 'category does not match scope',
    hExternZonderPartij: 'chain level without party',
    hPartijOnbekend: 'party not in register',
    hPartijGeweigerd: 'rejected party referenced',
    hEffectLeeg: 'effect on flow empty',
    hGeenToelichting: 'without explanation',
    hDubbeleTitels: 'duplicate titles',
    hVerouderd: 'stale',
    hZonderAanmaak: 'without creation date',
  },
}

function maakHelpers(ctx) {
  const { language, teamName } = ctx
  const w = (key) => Z[language]?.[key] ?? Z.nl[key] ?? key
  const zin = (key, vars) => vul(w(key), vars)
  // "1 dependency" / "3 dependencies"
  const n = (aantal, enkel, meer) => `${aantal} ${aantal === 1 ? w(enkel) : w(meer)}`
  const lijst = (items) => {
    const l = items.filter(Boolean)
    if (l.length <= 1) return l.join('')
    return `${l.slice(0, -1).join(', ')} ${w('en')} ${l[l.length - 1]}`
  }
  const datum = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString(language === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const ww = (aantal, key) => (Z[language]?.[key] ?? Z.nl[key])[aantal === 1 ? 0 : 1]
  const niveau = (lvl) => (lvl ? translateRiskLevel(lvl, language) : '')
  const status = (st) => (st ? translateStatus(st, language) : '')
  const team = (id) => (id ? teamName(id) : '')
  return { w, zin, n, lijst, datum, niveau, status, team, ww }
}

// --- signalen ----------------------------------------------------------------

export function signaalZin(sig, ctx) {
  const h = maakHelpers(ctx)
  const p = sig.params ?? {}
  const dep = p.dep
  const vars = {
    ...p,
    titel: dep?.titel ?? p.titel ?? '',
    team: h.team(dep?.teamId ?? p.teamId),
    status: h.status(p.status),
    niveau: h.niveau(p.niveau),
    vanNiveau: h.niveau(p.vanNiveau),
    naarNiveau: h.niveau(p.naarNiveau),
    flowverlies: h.niveau(p.flowverlies),
    datum: h.datum(p.datum),
    doel: h.team(p.doelTeamId),
    a: h.team(p.teamIdA),
    b: h.team(p.teamIdB),
    teamNamen: h.lijst((p.teamIds ?? []).map((id) => h.team(id))),
    aantal: (p.teamIds ?? []).length,
  }
  if (sig.key === 'slapendTeam' && (p.dagen === null || p.dagen === undefined)) return h.zin('slapendTeamNooit', vars)
  return h.zin(sig.key, vars)
}

// --- constateringen (regelniveau) ------------------------------------------

// Samenvattende zin onder een constatering: alleen als de records
// dependencies zijn (dan valt er over verdeling en leeftijd iets te zeggen).
export function constateringZin(c, ctx) {
  const h = maakHelpers(ctx)
  if (c.key === 'backlogGroei' && c.proj) {
    return h.zin('cBacklog', { nieuw: c.proj.nieuwPerWeek, gesloten: c.proj.geslotenPerWeek, weken: c.proj.weken, netto: c.proj.nettoPerWeek, horizon: c.proj.horizon, proj: c.proj.openOverHorizon })
  }
  // Alleen echte dependencies (met een impact-veld): de records van
  // 'reviewOud' zijn logregels die ook een titel en teamId dragen, maar
  // waarover niets zinnigs te zeggen valt qua risico of leeftijd.
  const deps = (c.records ?? []).filter((r) => r && typeof r.titel === 'string' && r.teamId && typeof r.impact === 'string')
  if (deps.length === 0) return null
  const perTeam = new Map()
  for (const d of deps) perTeam.set(d.teamId, (perTeam.get(d.teamId) ?? 0) + 1)
  const [topTeam, topN] = [...perTeam].sort((a, b) => b[1] - a[1])[0]
  const risks = deps.map((d) => calculateRisk(d))
  const hoogste = risks.sort((a, b) => riskLevelRank(b.level) - riskLevelRank(a.level))[0]?.level
  const nu = isoDag(ctx.vandaag ?? new Date())
  const oudste = Math.max(0, ...deps.map((d) => (d.aangemaakt_op ? dagenTussen(d.aangemaakt_op, nu) : 0)))
  const vars = {
    deps: h.n(deps.length, 'dependency', 'dependencies'),
    teams: h.n(perTeam.size, 'team', 'teams'),
    top: h.team(topTeam),
    topN,
    hoogste: h.niveau(hoogste),
    blokkerend: deps.filter((d) => d.status === 'actief blokkerend').length,
    oudste,
  }
  return h.zin(perTeam.size > 1 ? 'cDeps' : 'cDepsEen', vars)
}

// --- rapport -----------------------------------------------------------------

function dagenGeledenIso(n, vandaag) {
  return isoDag(new Date(vandaag.getTime() - n * 24 * 60 * 60 * 1000))
}

// Rapport in lopende tekst: alinea's met een kop en zinnen. Zinnen die
// over lege verzamelingen zouden gaan, blijven weg.
export function bouwRapport(a, ctx) {
  const h = maakHelpers(ctx)
  const { language } = ctx
  const vandaag = ctx.vandaag ?? new Date()
  const nu = isoDag(vandaag)
  const d30 = dagenGeledenIso(30, vandaag)
  const open = a.open
  const port = a.port
  const v = a.vergelijking
  const deps = (x) => h.n(x, 'dependency', 'dependencies')
  const enkelTeam = a.teamsInScope.length === 1
  const scope = enkelTeam ? h.team(a.teamsInScope[0].id) : h.n(a.teamsInScope.length, 'team', 'teams')
  const secties = []
  const push = (kop, zinnen) => {
    const l = zinnen.filter(Boolean)
    if (l.length > 0) secties.push({ kop: h.w(kop), zinnen: l })
  }

  // 1. Samenvatting
  const gemScore = open.length > 0 ? Math.round((open.reduce((s, d) => s + calculateRisk(d).score, 0) / open.length) * 10) / 10 : 0
  const nieuw30 = a.alle.filter((d) => d.aangemaakt_op && d.aangemaakt_op >= d30).length
  const gesloten30 = a.alle.filter((d) => d.gesloten_op && d.gesloten_op >= d30).length
  const richting = v.nu.open > v.toen.open ? 'rSteeg' : v.nu.open < v.toen.open ? 'rDaalde' : 'rGelijk'
  push('rKopSamenvatting', [
    h.zin('r1', { datum: h.datum(nu), open: deps(open.length), ww1: h.ww(open.length, language === 'en' ? 'wwZijn' : 'wwStaan'), scope, kritiek: port.perNiveau.Kritiek, hoog: port.perNiveau.Hoog, gemiddeld: port.perNiveau.Gemiddeld, laag: port.perNiveau.Laag }),
    open.length > 0 &&
      h.zin('r2', {
        blokkerend: port.perStatus['actief blokkerend'] ?? 0,
        ww1: h.ww(port.perStatus['actief blokkerend'] ?? 0, 'wwBlokkeren'),
        gemitigeerd: port.perStatus.gemitigeerd ?? 0,
        ww2: h.ww(port.perStatus.gemitigeerd ?? 0, 'wwZijn'),
        geaccepteerd: port.geaccepteerd.length,
        ww3: h.ww(port.geaccepteerd.length, 'wwZijn'),
        score: gemScore,
      }),
    h.zin('r3', { nieuw: nieuw30, ww1: h.ww(nieuw30, 'wwKwam'), gesloten: gesloten30, ww2: h.ww(gesloten30, 'wwWerd'), richting: h.zin(richting, { van: v.toen.open, naar: v.nu.open }) }),
    h.zin('r4', { van: v.toen.blokkerend, naar: v.nu.blokkerend, hvan: v.toen.hoogOfKritiek, hnaar: v.nu.hoogOfKritiek }),
  ])

  // 2. Ontwikkeling
  const p = a.proj
  const ver = a.verandering
  const grootste = ver.verslechterd[0]
  const ds = a.doorloopSamenvatting
  push('rKopOntwikkeling', [
    p &&
      h.zin('r5', {
        weken: p.weken,
        nieuwPerWeek: p.nieuwPerWeek,
        geslotenPerWeek: p.geslotenPerWeek,
        horizon: p.horizon,
        proj: p.openOverHorizon,
        leeg: p.wekenTotLeeg ? h.zin('r5leeg', { weken: p.wekenTotLeeg }) : '',
      }),
    grootste
      ? h.zin('r6', { verslechterd: deps(ver.verslechterd.length), ww1: h.ww(ver.verslechterd.length, 'wwSteeg'), verbeterd: ver.verbeterd.length, ww2: h.ww(ver.verbeterd.length, 'wwDaalde'), titel: grootste.dep.titel, team: h.team(grootste.dep.teamId), van: grootste.van, naar: grootste.naar })
      : ver.verbeterd.length === 0
        ? h.zin('r6b')
        : null,
    (a.overgangen.teruggevallen.length > 0 || a.overgangen.heropend.length > 0) &&
      h.zin('r7', { teruggevallen: h.n(a.overgangen.teruggevallen.length, 'mitigatie', 'mitigaties'), ww1: h.ww(a.overgangen.teruggevallen.length, 'wwHield'), heropend: deps(a.overgangen.heropend.length), ww2: h.ww(a.overgangen.heropend.length, 'wwWerd') }),
    ds.aantalGemitigeerd > 0 &&
      h.zin('r8', { gem: ds.gemiddeldTotMitigatie, med: ds.mediaanTotMitigatie, n: ds.aantalGemitigeerd, gemS: ds.gemiddeldTotSluiting ?? '—', nS: ds.aantalGesloten, ooit: deps(ds.aantalOoitBlokkerend), ww1: h.ww(ds.aantalOoitBlokkerend, language === 'en' ? 'wwStaan' : 'wwZijn'), blok: ds.gemiddeldBlokkerend ?? 0 }),
  ])

  // 3. Risico en urgentie
  const nietGemitigeerd = open.filter((d) => d.status !== 'gemitigeerd')
  const metAfspraak = nietGemitigeerd.filter((d) => d.actieAfspraak?.trim()).length
  const deadlinesZonder = port.deadlines.filter((d) => !d.actieAfspraak?.trim() && d.status !== 'gemitigeerd').length
  push('rKopRisico', [
    port.top.length > 0 && h.zin('r9', { top: h.lijst(port.top.slice(0, 3).map((d) => `‘${d.titel}’ (${h.team(d.teamId)}, ${calculateRisk(d).score})`)) }),
    open.length > 0 && h.zin('r10', { quick: deps(port.kwadranten.quick_win.length), ww1: h.ww(port.kwadranten.quick_win.length, 'wwZijn'), opschalen: port.kwadranten.opschalen.length, ww2: h.ww(port.kwadranten.opschalen.length, 'wwVragen'), stil: port.stilRisico.length, ww3: h.ww(port.stilRisico.length, 'wwZijn') }),
    open.length > 0 && h.zin('r11', { deadlines: deps(port.deadlines.length), ww1: h.ww(port.deadlines.length, 'wwHebben'), zonder: deadlinesZonder, pct: nietGemitigeerd.length > 0 ? Math.round((metAfspraak / nietGemitigeerd.length) * 100) : 0 }),
    open.length > 0 && h.zin('r12', { verouderd: deps(port.verouderd.length), ww1: h.ww(port.verouderd.length, language === 'en' ? 'wwHebben' : 'wwZijn'), pct: Math.round((port.verouderd.length / open.length) * 100), chronisch: port.chronisch.length, ww2: h.ww(port.chronisch.length, 'wwStaan'), sluimerend: port.sluimerend.length, ww3: h.ww(port.sluimerend.length, 'wwSluimeren') }),
  ])

  // 4. Teams
  const rijen = a.scorekaart.rijen
  const teamsZinnen = []
  if (!enkelTeam && rijen.length > 1) {
    const meeste = [...rijen].sort((x, y) => y.open - x.open)[0]
    const hoogste = [...rijen].sort((x, y) => y.hoogPlus - x.hoogPlus)[0]
    const flow = [...rijen].sort((x, y) => y.flowverlies - x.flowverlies)[0]
    teamsZinnen.push(
      meeste.teamId === hoogste.teamId && hoogste.teamId === flow.teamId
        ? h.zin('r13zelfde', { team: h.team(meeste.teamId), n1: meeste.open, n2: hoogste.hoogPlus, n3: flow.flowverlies })
        : h.zin('r13', { meeste: h.team(meeste.teamId), n1: meeste.open, hoogste: h.team(hoogste.teamId), n2: hoogste.hoogPlus, flow: h.team(flow.teamId), n3: flow.flowverlies }),
    )
    const balans = [...a.teamOpTeam.balans].sort((x, y) => y.netto - x.netto)[0]
    teamsZinnen.push(
      balans && balans.netto > 0
        ? h.zin('r14', { team: h.team(balans.teamId), netto: `+${balans.netto}`, veroorzaakt: balans.veroorzaakt, ondervonden: balans.ondervonden, wederzijds: a.wederzijds.length })
        : h.zin('r14b'),
    )
    const kennis = a.kennis[0]
    if (kennis && kennis.score > 0) teamsZinnen.push(h.zin('r15', { team: h.team(kennis.teamId), score: kennis.score, kennisHoog: kennis.kennisHoog, risicoRijen: kennis.risicoRijen }))
  } else if (enkelTeam) {
    const eigen = rijen.find((r) => r.teamId === a.teamsInScope[0].id)
    const g = a.scorekaart.gemiddeld
    if (eigen) teamsZinnen.push(h.zin('r16', { team: h.team(eigen.teamId), open: eigen.open, gemOpen: g.open ?? 0, hoogPlus: eigen.hoogPlus, gemHoog: g.hoogPlus ?? 0, flow: eigen.flowverlies, gemFlow: g.flowverlies ?? 0 }))
    const kennis = a.kennis[0]
    if (kennis && kennis.score > 0) teamsZinnen.push(h.zin('r15', { team: h.team(kennis.teamId), score: kennis.score, kennisHoog: kennis.kennisHoog, risicoRijen: kennis.risicoRijen }))
  }
  push('rKopTeams', teamsZinnen)

  // 5. Keten en partijen
  const k = a.keten
  const edges = k.edges.filter((e) => e.status !== 'voorgesteld' && e.sourceTeam !== e.targetTeam && (!a.teamFilter || e.sourceTeam === a.teamFilter || e.targetTeam === a.teamFilter))
  const cycliTekst = k.cycli.length === 0 ? h.w('r17geenCycli') : k.cycli.length === 1 ? h.w('r17cyclus') : h.zin('r17cycli', { n: k.cycli.length })
  const oudsteVerzoek = k.verzoeken[0]?.leeftijd
  const volledigheden = a.kaart.map((r) => r.volledigheid).filter((n) => n !== null)
  const zwaarste = a.ketenrisico[0]
  const hub = a.partijen[0]
  const geweigerd = a.constateringen.find((c) => c.key === 'partijGeweigerd')?.aantal ?? 0
  const inAfwachting = a.constateringen.find((c) => c.key === 'partijInAfwachting')?.aantal ?? 0
  push('rKopKeten', [
    h.zin('r17', {
      edges: edges.length,
      cycli: cycliTekst,
      verzoeken: h.n(k.verzoeken.length, 'verzoek', 'verzoeken'),
      ww1: h.ww(k.verzoeken.length, language === 'en' ? 'wwZijn' : 'wwStaan'),
      oudste: oudsteVerzoek ? h.zin('r17oudste', { d: oudsteVerzoek }) : '',
      gem: k.goedkeuring.gemiddeld ?? '—',
    }),
    h.zin('r18', {
      losIn: h.n(k.losseInputs.length, 'input', 'inputs'),
      ww1: h.ww(k.losseInputs.length, 'wwZijn'),
      losUit: h.n(k.losseOutputs.length, 'output', 'outputs'),
      ww2: h.ww(k.losseOutputs.length, 'wwWorden'),
      volledigheid: volledigheden.length > 0 ? Math.round(volledigheden.reduce((s, n) => s + n, 0) / volledigheden.length) : 0,
    }),
    h.zin('r19', { depZonder: deps(k.depZonderKoppeling.length), ww1: h.ww(k.depZonderKoppeling.length, 'wwWijzen'), koppelingZonder: h.n(k.koppelingZonderDep.length, 'koppeling', 'koppelingen'), ww2: h.ww(k.koppelingZonderDep.length, 'wwHebben') }),
    zwaarste && zwaarste.direct > 0 && h.zin('r20', { team: h.team(zwaarste.teamId), n: zwaarste.direct, blokkerend: zwaarste.directBlokkerend, hoog: zwaarste.directHoog }),
    hub && hub.deps.length > 0 && h.zin('r21', { partij: hub.naam, teams: h.n(hub.aantalTeams, 'team', 'teams'), deps: deps(hub.deps.length), aandeel: a.concentratie.partijen.aandeel }),
    (geweigerd > 0 || inAfwachting > 0) && h.zin('r22', { geweigerd: deps(geweigerd), ww1: h.ww(geweigerd, 'wwVerwijzen'), inAfwachting }),
  ])

  // 6. Applicaties en proces
  const spof = k.spof
  const zwaarsteApp = [...spof].sort((x, y) => y.last - x.last)[0]
  const stap = [...a.werkstappen].sort((x, y) => y.deps - x.deps)[0]
  const zonderCap = a.werkstappen.filter((w) => w.deps >= 3 && w.personen === 0).length
  const flowSom = a.flowverlies.perTeam.reduce((s, r) => s + r.som, 0)
  const duursteCat = a.flowverlies.perCategorie[0]
  const duurstePartij = a.flowverlies.perPartij.find((r) => r.som > 0)
  push('rKopApps', [
    zwaarsteApp &&
      h.zin('r23', {
        risico: h.n(spof.filter((s) => s.risico).length, 'applicatie', 'applicaties'),
        ww1: h.ww(spof.filter((s) => s.risico).length, 'wwZijn'),
        app: zwaarsteApp.app.naam,
        team: h.team(zwaarsteApp.teamId),
        deps: zwaarsteApp.deps,
        io: zwaarsteApp.io,
        conns: zwaarsteApp.conns,
        gedeeld: h.n(a.gedeeld.length, 'applicatie', 'applicaties'),
        ww2: h.ww(a.gedeeld.length, 'wwDragen'),
      }),
    stap && stap.deps > 0 && h.zin('r24', { stap: translateWorkflowStage(stap.stage, language), n: stap.deps, blokkerend: stap.blokkerend, zonder: h.n(zonderCap, 'werkstap', 'werkstappen'), ww1: h.ww(zonderCap, 'wwHebben') }),
    duursteCat &&
      h.zin('r25', {
        som: flowSom,
        categorie: translateCategorie(duursteCat.categorie, language),
        c: duursteCat.som,
        partijDeel: duurstePartij ? h.zin('r25partij', { partij: duurstePartij.naam, p: duurstePartij.som }) : '',
      }),
  ])

  // 7. Datakwaliteit en beheer
  const checks = a.hygiene.checks.filter((c) => c.records.length > 0).sort((x, y) => y.records.length - x.records.length)
  const meldingen = checks.reduce((s, c) => s + c.records.length, 0) + a.hygiene.ioChecks.length + a.hygiene.appsZonderRelatie.length
  const actief = a.registratie.perTeam[0]
  const stil = a.slapend.filter((s) => s.slapend)
  push('rKopKwaliteit', [
    meldingen > 0 && h.zin('r26', { meldingen: h.n(meldingen, 'melding', 'meldingen'), top: h.lijst(checks.slice(0, 3).map((c) => `${h.w(`h${c.key.charAt(0).toUpperCase()}${c.key.slice(1)}`)} (${c.records.length})`)) }),
    actief &&
      h.zin('r27', {
        team: h.team(actief.teamId),
        n: actief.totaal,
        slapend: stil.length === 0 ? h.w('r27geen') : h.zin('r27wel', { teams: h.lijst(stil.map((s) => h.team(s.teamId))), ww: stil.length === 1 ? h.w('is') : h.w('zijn') }),
      }),
    h.zin('r28', {
      review: h.n(a.registratie.openReview.length, 'aanmelding', 'aanmeldingen'),
      ww1: h.ww(a.registratie.openReview.length, 'wwWachten'),
      dup: a.registratie.duplicaten.length,
      groepen: deps(a.duplicaten.reduce((s, g) => s + g.deps.length, 0)),
      ww2: h.ww(a.duplicaten.reduce((s, g) => s + g.deps.length, 0), language === 'en' ? 'wwWerd' : 'wwZijn'),
    }),
  ])

  // 8. Aanbevelingen (alleen wat de regels aanwijzen)
  const c = (key) => a.constateringen.find((x) => x.key === key)
  const aanb = []
  const kritiek = c('kritiekZonderAfspraak')?.aantal ?? 0
  const harde = c('hardeDeadlineZonderAfspraak')?.aantal ?? 0
  if (kritiek + harde > 0) aanb.push(h.zin('a1', { n: kritiek, m: harde }))
  const blokOud = c('blokkerendVerouderd')?.aantal ?? 0
  if (blokOud > 0) aanb.push(h.zin('a2', { n: blokOud }))
  if (ver.verslechterd.some((r) => riskLevelRank(r.naarNiveau) >= riskLevelRank('Hoog'))) aanb.push(h.zin('a13', { n: ver.verslechterd.filter((r) => riskLevelRank(r.naarNiveau) >= riskLevelRank('Hoog')).length }))
  if (a.overgangen.teruggevallen.length > 0) aanb.push(h.zin('a14', { n: a.overgangen.teruggevallen.length }))
  if (port.kwadranten.quick_win.length > 0) aanb.push(h.zin('a3', { n: port.kwadranten.quick_win.length }))
  if (port.stilRisico.length > 0) aanb.push(h.zin('a4', { n: port.stilRisico.length }))
  const verzoekOud = c('verzoekOud')?.aantal ?? 0
  if (verzoekOud > 0) aanb.push(h.zin('a5', { n: verzoekOud }))
  const spofZonder = c('spofZonderDetail')?.aantal ?? 0
  if (spofZonder > 0) aanb.push(h.zin('a6', { n: spofZonder }))
  const kennisTeams = c('kennisBusFactor')?.teams ?? []
  if (kennisTeams.length > 0) aanb.push(h.zin('a7', { teams: h.lijst(kennisTeams.map((id) => h.team(id))) }))
  if (a.uitgebreideAnalyse !== false && port.kwadranten.onvolledig.length > 0) aanb.push(h.zin('a8', { n: port.kwadranten.onvolledig.length }))
  if (p && p.nettoPerWeek >= 0.5) aanb.push(h.zin('a9', { netto: p.nettoPerWeek }))
  if (port.gemitigeerdNietGesloten.length > 0) aanb.push(h.zin('a10', { n: port.gemitigeerdNietGesloten.length }))
  if (stil.length > 0) aanb.push(h.zin('a11', { teams: h.lijst(stil.map((s) => h.team(s.teamId))) }))
  if (a.wederzijds.length > 0) aanb.push(h.zin('a12', { paren: h.lijst(a.wederzijds.map((w) => `${h.team(w.a)} ${h.w('en')} ${h.team(w.b)}`)) }))
  push('rKopAanbevelingen', aanb.length > 0 ? aanb : [h.w('aGeen')])

  return secties
}

export function rapportAlsTekst(rapport, titel) {
  const regels = [titel, '']
  for (const s of rapport) {
    regels.push(s.kop.toUpperCase())
    for (const z of s.zinnen) regels.push(s.kop === rapport[rapport.length - 1].kop ? `- ${z}` : z)
    regels.push('')
  }
  return regels.join('\n').trim()
}

// Zonder deze export zou de deadline-vertaler ongebruikt zijn; de pagina
// gebruikt hem voor de deadlinezin in de waarschuwingenlijst.
export { translateDeadline }
