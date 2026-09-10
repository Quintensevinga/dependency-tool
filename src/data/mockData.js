// Demo-/seeddata voor Dependency Insight.
//
// Doel van deze dataset (niet alleen "iets tonen"): één samenhangende,
// realistische keten van acht teams waarmee élk scherm met échte variatie te
// beoordelen is, en die groot genoeg is om te zien hoe de tool zich houdt met
// een echte organisatie erin. Zie de teamprofielen hieronder voor de bewuste
// keuzes per team.
//
// De keten (intake tot uitbetaling): Fantastic Four (klantcontact & intake)
// → Wakanda (polisadministratie) → Avengers (aanvraag- en claimbeoordeling)
// → Stark Industries (betaalverwerking & uitkeringen) → Daily Bugle
// (rapportage & BI), ondersteund door Asgard (platform & releasekalender),
// S.H.I.E.L.D. (IAM, platform, integraties) en Nova Corps (test &
// kwaliteit). Daarin zit bewust:
// - een cyclus én wederzijds paar aan het eind (Stark Industries ↔ Daily
//   Bugle: betaalstatus heen, correctiesignalen terug) — aan het eind,
//   zodat de gelaagde ketenweergave links-naar-rechts leesbaar blijft;
// - een output die drie teams afnemen (releasekalender van Asgard, API-
//   toegang van S.H.I.E.L.D.);
// - meerdere koppelingen op hetzelfde teampaar (Wakanda → Stark Industries,
//   S.H.I.E.L.D. → Wakanda);
// - een koppeling die lagen overslaat (Fantastic Four → Stark Industries,
//   klantmelding bij spoed, langs Wakanda én Avengers heen);
// - externe input aan het begin (DigiD, BRP), externe partijen midden in de
//   keten (Belastingdienst, SSD-loket, Security Office) en externe output aan
//   het eind (bankpartner, toezichthouder, directie);
// - koppelingsverzoeken in alle statussen: in afwachting op een bestaand item
//   (Nova Corps → Asgard), in afwachting om een nieuw item (Stark Industries
//   → Daily Bugle) en afgewezen (Nova Corps → Fantastic Four).
//
// Teamprofielen:
// - Fantastic Four: intake, veel Ontwikkelflow, gemengd risicoprofiel.
// - Wakanda: groot en applicatierijk (7 applicaties, extra zoekveld), rijke
//   mix, het kennisrisico-zwaartepunt van de organisatie.
// - Avengers: aanvraag- en claimbeoordeling, veel besluitvormings- en
//   stakeholderafhankelijkheden, één goedgekeurd duplicaat met Stark
//   Industries.
// - Stark Industries: betaalketen, zwaarste risico's, meeste actief
//   blokkerend.
// - Daily Bugle: data en rapportage, veel externe bestemmingen.
// - Asgard: klein, platform; heeft de uitgebreide analyse (wachttijd,
//   deadline, oplosbaarheid) nog NIET gedaan — "profiel onvolledig" zit hier
//   geclusterd, niet mechanisch verspreid.
// - S.H.I.E.L.D.: technisch, meeste applicatiekoppelingen, hub voor toegang.
// - Nova Corps: test en kwaliteit, refinement/test/acceptatie-zwaartepunt.
//
// Bewuste uitzonderingen (geen fouten, wel gedocumenteerd):
// - Fantastic Four 'Kennisbank klantcontact' en Asgard 'Beheerconsole'
//   hebben geen enkele relatie — test "applicatie bestaat, doet verder
//   niets".
// - Stark Industries 'Fraudecheck-service' heeft een applicatiekoppeling
//   maar geen Applicatieflow-dependency: geen lane, dus de lijn is op het
//   canvas onzichtbaar (wel in Teamgegevens) — bekend gedrag.
// - Drie dependencies zonder flowtype ("Flowtype nog te bepalen") en een
//   handvol Ontwikkelflow-dependencies zonder werkstap ("Proces-overstijgend")
//   als hygiënegevallen.
// - Enkele outputs blijven onbenut (Asgard 'Signalen naar ketenoverzicht',
//   Fantastic Four 'Releasekandidaat intakeproces', Wakanda
//   'Polisstatus-terugkoppeling', Daily Bugle 'Rapportagebundel' en
//   'Kwaliteitsrapportage testdekking'): normaal, geen foutstatus.
// - 'Leverancier legacy polissysteem' is een geweigerde partij die nog wél
//   door twee dependencies genoemd wordt (rode waarschuwing in het detail).
// - Eén goedgekeurd duplicaat (Avengers + Stark Industries op de leverancier
//   regelmotor) bestaat als gekoppeld paar met een gedeelde dedupGroupId.
//
// Historie: elke dependency draagt een wijzigingshistorie (status, impact,
// frequentie, sluiting) met datum, afgeleid uit wat het record nu is (zie
// historieVoor), plus 27 afgesloten dependencies verspreid over het afgelopen
// jaar (zie DEPS_GESLOTEN). Koppelingsverzoeken hebben voorstel- en
// besluitdatums, en de wijzigingenlog bevat naast de review-entries de
// gebeurtenissen van de afgelopen maanden. Samen maken ze doorlooptijden en
// trendlijnen op de analysepagina mogelijk.
//
// Formaat: leesbare brondata; lib/storage.js (migrateState /
// applyMockTeamWorkflows) zet dit om naar het echte schema via hetzelfde pad
// als een JSON-import. Datums staan als "dagen geleden" en worden bij het
// laden omgerekend, zodat "verouderd" (>90 dagen niet bijgewerkt) en
// "acuut/chronisch" betekenis houden i.p.v. mettertijd te verlopen.
// Geen persoonsnamen, geen lorem ipsum.

const DAG_MS = 24 * 60 * 60 * 1000

function dagenGeleden(dagen) {
  return new Date(Date.now() - dagen * DAG_MS).toISOString().slice(0, 10)
}

function tijdstipGeleden(dagen, uur = 10) {
  const d = new Date(Date.now() - dagen * DAG_MS)
  d.setHours(uur, 15, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export const MOCK_TEAMS = [
  { id: 'team-tiem', naam: 'Team Fantastic Four', actief: true },
  { id: 'team-polis', naam: 'Team Wakanda', actief: true },
  { id: 'team-superheroes', naam: 'Team Avengers', actief: true },
  { id: 'team-casio', naam: 'Team Stark Industries', actief: true },
  { id: 'team-sterke-verhalen', naam: 'Team Daily Bugle', actief: true },
  { id: 'team-equinox', naam: 'Team Asgard', actief: true },
  { id: 'team-smurfen', naam: 'Team S.H.I.E.L.D.', actief: true },
  { id: 'team-freggels', naam: 'Team Nova Corps', actief: true },
]

const T = {
  tiem: 'team-tiem',
  polis: 'team-polis',
  superheroes: 'team-superheroes',
  casio: 'team-casio',
  sv: 'team-sterke-verhalen',
  equinox: 'team-equinox',
  smurfen: 'team-smurfen',
  freggels: 'team-freggels',
}

// ---------------------------------------------------------------------------
// Externe partijen (centrale, admin-beheerde lijst)
// ---------------------------------------------------------------------------
// Generieke partijen (CAB, IAM, technisch beheer, omgevingen, security, SSD)
// raken het merendeel van de teams en verschijnen daardoor als hub in het
// Ketenoverzicht; de overige partijen raken één tot drie teams.

export const MOCK_EXTERNAL_PARTIES = [
  { id: 'party-cab', naam: 'Change Advisory Board', type: 'stakeholder', status: 'actief' },
  { id: 'party-iam', naam: 'IAM- en autorisatiebeheer', type: 'team', status: 'actief' },
  { id: 'party-techbeheer', naam: 'Technisch applicatiebeheer (TAB)', type: 'team', status: 'actief' },
  { id: 'party-omgevingen', naam: 'Omgevingenbeheer (OTAP)', type: 'team', status: 'actief' },
  { id: 'party-security', naam: 'Security Office', type: 'team', status: 'actief' },
  { id: 'party-ssd', naam: 'SSD-aanvraagloket (server, storage, database)', type: 'team', status: 'actief' },
  { id: 'party-brp', naam: 'Basisregistratie Personen (BRP)', type: 'systeem', status: 'actief' },
  { id: 'party-digid', naam: 'DigiD', type: 'systeem', status: 'actief' },
  { id: 'party-bank', naam: 'Bankpartner (betaalverkeer)', type: 'systeem', status: 'actief' },
  { id: 'party-belastingdienst', naam: 'Belastingdienst (loonaangifte)', type: 'systeem', status: 'actief' },
  { id: 'party-toezicht', naam: 'Toezichthouder (rapportageplicht)', type: 'stakeholder', status: 'actief' },
  { id: 'party-directie', naam: 'Directie en MT', type: 'stakeholder', status: 'actief' },
  { id: 'party-regelmotor', naam: 'Leverancier regelmotor', type: 'team', status: 'actief' },
  { id: 'party-privacy', naam: 'Privacy- en complianceteam', type: 'team', status: 'actief' },
  { id: 'party-inkoop', naam: 'Inkoop & Contractmanagement', type: 'team', status: 'actief' },
  { id: 'party-business-klantcontact', naam: 'Business opdrachtgever Klantcontact', type: 'stakeholder', status: 'actief' },
  { id: 'party-business-verzekeringen', naam: 'Business opdrachtgever Verzekeringen', type: 'stakeholder', status: 'actief' },
  { id: 'party-datateam', naam: 'Extern data- en rapportageteam', type: 'team', status: 'actief' },
  { id: 'party-infra', naam: 'Extern specialistenteam Infra', type: 'team', status: 'actief' },
  { id: 'party-accountant', naam: 'Externe accountant', type: 'stakeholder', status: 'actief' },
  { id: 'party-testteam', naam: 'Extern testteam', type: 'team', status: 'in_afwachting', voorgesteldDoorTeamId: 'team-freggels' },
  { id: 'party-datacenter', naam: 'Extern datacenter', type: 'omgeving', status: 'in_afwachting', voorgesteldDoorTeamId: 'team-smurfen' },
  { id: 'party-legacyleverancier', naam: 'Leverancier legacy polissysteem', type: 'team', status: 'geweigerd' },
]

const P = Object.fromEntries(MOCK_EXTERNAL_PARTIES.map((p) => [p.id, p.naam]))

// Dependency op een externe partij uit het register (id + naam; de naam is
// wat de observaties en het detailpaneel tonen).
function partij(id) {
  return { geraaktPartijId: id, geraakte_team_extern: P[id] }
}

const TEAM_ID_BY_NAAM = Object.fromEntries(MOCK_TEAMS.map((t) => [t.naam, t.id]))

// Dependency op een ander team in deze tool (geen externe partij): de naam
// moet exact de teamnaam zijn — zo herkent het Ketenoverzicht 'm als team en
// niet als externe partij. Het id staat er expliciet naast (geraaktTeamId),
// zodat analyses nooit op naam hoeven te matchen.
function team(naam) {
  return { geraakte_team_extern: naam, geraaktTeamId: TEAM_ID_BY_NAAM[naam] ?? null }
}

// Input-/output-item dat van/naar een externe partij uit het register gaat.
function extern(id) {
  return { externalPartyId: id, externalTeam: P[id] }
}

// Deterministische "toevalsbron" per id (FNV-1a): dezelfde variatie bij elke
// herlaad, geen echte randomness in demodata.
function hashVan(str) {
  let h = 2166136261
  for (const ch of str) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function io(fields) {
  // Datums van koppelingsverzoeken: een lopend verzoek is recent, een
  // afgewezen verzoek ligt een maand terug, een geaccepteerde koppeling is
  // ooit (2 tot 14 dagen na het voorstel) goedgekeurd.
  const linked = Boolean(fields.linkedTeam && (fields.linkedOutputId || fields.linkedInputId || fields.linkNieuw))
  const h = hashVan(fields.id)
  let linkVoorgesteldOp = ''
  let linkBesluitOp = ''
  if (linked && fields.linkStatus === 'voorgesteld') {
    linkVoorgesteldOp = dagenGeleden(3 + (h % 9))
  } else if (linked && fields.linkStatus === 'afgewezen') {
    linkVoorgesteldOp = dagenGeleden(31)
    linkBesluitOp = dagenGeleden(26)
  } else if (linked) {
    const voorgesteld = 60 + (h % 340)
    linkVoorgesteldOp = dagenGeleden(voorgesteld)
    linkBesluitOp = dagenGeleden(Math.max(0, voorgesteld - 2 - (h % 12)))
  }
  return {
    flowtype: 'applicatieflow',
    bron_type: '',
    linkedTeam: '',
    linkedOutputId: '',
    linkedInputId: '',
    applicatieId: '',
    externalTeam: '',
    externalPartyId: '',
    punten: [],
    linkVoorgesteldOp,
    linkBesluitOp,
    ...fields,
  }
}

function cap(id, rol, seniority, aantal, fase = '', risico_bij_uitval = '', risico_toelichting = '') {
  return { id, rol, seniority, aantal, fase, risico_bij_uitval, risico_toelichting }
}

// ---------------------------------------------------------------------------
// Teamworkflows: applicaties, koppelingen, capaciteit, input/output,
// fasenotities, aantekeningen
// ---------------------------------------------------------------------------

export const MOCK_TEAM_WORKFLOWS = {
  [T.tiem]: {
    applications: [
      { id: 'ti-app-klant', naam: 'Klantcontactmodule' },
      { id: 'ti-app-zaak', naam: 'Zaakregistratie' },
      { id: 'ti-app-bericht', naam: 'Berichtendienst' },
      // Bewust zonder enige relatie (geen koppeling, geen dependency-label).
      { id: 'ti-app-kennisbank', naam: 'Kennisbank klantcontact' },
    ],
    applicatieflowConnecties: [
      { id: 'ti-conn-1', van: 'ti-app-klant', naar: 'ti-app-zaak', punten: ['Realtime via REST, geen batch', 'Bij storing: handmatige zaakaanmaak via beheerscherm'] },
      { id: 'ti-conn-2', van: 'ti-app-zaak', naar: 'ti-app-bericht', punten: ['Statuswijziging triggert klantbericht'] },
      { id: 'ti-conn-3', van: 'ti-app-klant', naar: 'ti-app-bericht' },
    ],
    applicatieflowDetails: {
      'ti-app-zaak': {
        toelichting: 'Kern van de intake: elke klantvraag krijgt hier een zaaknummer en een eigenaar.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Zonder zaakregistratie kan geen enkele klantvraag de keten in.',
      },
      'ti-app-kennisbank': {
        toelichting: 'Statische kennisbank voor medewerkers; wordt uitgefaseerd naar het intranet.',
        risico_bij_uitval: 'nee',
        risico_toelichting: '',
      },
    },
    capacity: [
      cap('ti-cap1', 'Product Owner', 'senior', 1),
      cap('ti-cap2', 'Business analist', 'medior', 1, 'analyse_refinement', 'nee'),
      cap('ti-cap3', 'Developer', 'junior', 2, 'ontwikkeling_configuratie', 'nee'),
      cap('ti-cap4', 'Stakeholder / business', 'senior', 1, 'acceptatie', 'ja', 'Enige businessvertegenwoordiger die acceptatiecriteria mag goedkeuren.'),
      cap('ti-cap5', 'Functioneel beheerder', 'medior', 1, 'beheer_nazorg', 'nee'),
    ],
    inputs: [
      io({ id: 'ti-in-digid', label: 'Ingelogde klant via DigiD', bron_type: 'systeem', applicatieId: 'ti-app-klant', ...extern('party-digid') }),
      io({ id: 'ti-in-telefoon', label: 'Klantvraag via telefoon of chat', bron_type: 'persoon', applicatieId: 'ti-app-klant', punten: ['Piek op maandagochtend', 'Gemiddeld 900 contacten per dag'] }),
      io({ id: 'ti-in-platform', label: 'Platform- en releasekalender', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.equinox, linkedOutputId: 'eq-out-release' }),
      // Bewust NIET gekoppeld aan de output van Wakanda: Fantastic Four → Wakanda → Fantastic Four zou
      // een tweede cyclus zijn, en alles stroomafwaarts van een cyclus belandt
      // in de gelaagde ketenweergave in de "cyclus-laag" (Kahn). De enige
      // cyclus zit bewust aan het eind: Stark Industries ↔ Daily Bugle.
      io({ id: 'ti-in-polisstatus', label: 'Polisstatus-terugkoppeling', bron_type: 'team', applicatieId: 'ti-app-zaak', punten: ['Elke statuswijziging binnen 5 minuten zichtbaar in de zaak'] }),
      io({ id: 'ti-in-api', label: 'Technische API-toegang klantdata', bron_type: 'team', linkedTeam: T.smurfen, linkedOutputId: 'sm-out-api', applicatieId: 'ti-app-klant' }),
      io({ id: 'ti-in-refinement', label: 'Refinementvraag vanuit PO', flowtype: 'ontwikkelflow', bron_type: 'rol' }),
    ],
    outputs: [
      io({ id: 'ti-out-klantvraag', label: 'Klantvraagbundel doorgezet', bron_type: 'team', applicatieId: 'ti-app-klant', punten: ['Dagelijkse batch om 06:00', 'Spoedgevallen direct via bericht'] }),
      io({ id: 'ti-out-melding', label: 'Klantmelding uitkering (intake)', bron_type: 'team', applicatieId: 'ti-app-zaak' }),
      // Bewust onbenut: niemand neemt dit af.
      io({ id: 'ti-out-releasekandidaat', label: 'Releasekandidaat intakeproces', flowtype: 'ontwikkelflow', bron_type: 'team' }),
    ],
    stageNotes: {
      analyse_refinement: 'Refinement elke dinsdag; business analist bereidt de klantvragen van de week voor.',
    },
    annotations: [],
    layout: {},
  },

  [T.polis]: {
    applications: [
      { id: 'po-app-klantportaal', naam: 'Klantportaal' },
      { id: 'po-app-polis', naam: 'Polisadministratiesysteem' },
      { id: 'po-app-premie', naam: 'Premieberekeningsengine' },
      { id: 'po-app-document', naam: 'Documentservice' },
      { id: 'po-app-archief', naam: 'Archiefservice' },
      { id: 'po-app-gateway', naam: 'Integratie Gateway' },
      { id: 'po-app-mutatie', naam: 'Mutatieverwerker' },
    ],
    applicatieflowConnecties: [
      { id: 'po-conn-1', van: 'po-app-gateway', naar: 'po-app-klantportaal', punten: ['Alle externe koppelingen lopen via de gateway', 'Rate limit 50 requests per seconde'] },
      { id: 'po-conn-2', van: 'po-app-klantportaal', naar: 'po-app-polis' },
      { id: 'po-conn-3', van: 'po-app-polis', naar: 'po-app-premie', punten: ['Premieherberekening bij elke mutatie', 'Nachtelijke herberekening voor de hele portefeuille'] },
      { id: 'po-conn-4', van: 'po-app-polis', naar: 'po-app-mutatie' },
      { id: 'po-conn-5', van: 'po-app-mutatie', naar: 'po-app-document' },
      { id: 'po-conn-6', van: 'po-app-document', naar: 'po-app-archief', punten: ['Archivering na 30 dagen', 'Bewaartermijn 7 jaar'] },
    ],
    applicatieflowDetails: {
      'po-app-polis': {
        toelichting: 'Bron van de waarheid voor alle polissen; legacy-kern met een moderne schil.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Zonder polisadministratie stopt de hele keten van premie tot uitkering.',
      },
      'po-app-gateway': {
        toelichting: 'Alle in- en uitgaande koppelingen van het team lopen hier doorheen.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Uitval betekent geen klantportaal én geen koppeling met BRP en Belastingdienst.',
      },
      'po-app-archief': {
        toelichting: 'Alleen-lezen archief van definitieve documenten.',
        risico_bij_uitval: 'nee',
        risico_toelichting: '',
      },
    },
    capacity: [
      cap('po-cap1', 'Architect', 'senior', 1, 'analyse_refinement', 'ja', 'Enige die het volledige koppelingenlandschap overziet.'),
      cap('po-cap2', 'Developer', 'senior', 2, 'ontwikkeling_configuratie', 'ja', 'Enige kennishouders van de polisadministratiekern.'),
      cap('po-cap3', 'Developer', 'junior', 1, 'ontwikkeling_configuratie', 'nee'),
      cap('po-cap4', 'Tester', 'medior', 1, 'testen', 'nee'),
      cap('po-cap5', 'Release-coördinator', 'medior', 1, 'release_overdracht', 'nee'),
      cap('po-cap6', 'Functioneel beheerder', 'medior', 1, 'beheer_nazorg', 'nee'),
    ],
    inputs: [
      io({ id: 'po-in-platform', label: 'Platform- en releasekalender', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.equinox, linkedOutputId: 'eq-out-release' }),
      io({ id: 'po-in-klantvraag', label: 'Klantvraag vanuit Team Fantastic Four', bron_type: 'team', linkedTeam: T.tiem, linkedOutputId: 'ti-out-klantvraag', applicatieId: 'po-app-klantportaal', punten: ['Bundel bevat zaaknummer en klant-id', 'Onvolledige bundels gaan terug naar Fantastic Four'] }),
      io({ id: 'po-in-api', label: 'Technische API-toegang (S.H.I.E.L.D.)', bron_type: 'team', linkedTeam: T.smurfen, linkedOutputId: 'sm-out-api', applicatieId: 'po-app-gateway' }),
      io({ id: 'po-in-iam', label: 'IAM-rollenset polisbeheer', bron_type: 'team', linkedTeam: T.smurfen, linkedOutputId: 'sm-out-iamrollen', applicatieId: 'po-app-polis' }),
      io({ id: 'po-in-testbevindingen', label: 'Testbevindingen Nova Corps', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.freggels, linkedOutputId: 'fr-out-testbevindingen' }),
      io({ id: 'po-in-brp', label: 'Klantgegevens uit BRP', bron_type: 'systeem', applicatieId: 'po-app-klantportaal', ...extern('party-brp'), punten: ['Dagelijkse synchronisatie 04:00', 'Bij afwijking: handmatige controle door beheer'] }),
      io({ id: 'po-in-inkomen', label: 'Inkomensgegevens Belastingdienst', bron_type: 'systeem', applicatieId: 'po-app-polis', ...extern('party-belastingdienst') }),
      io({ id: 'po-in-wijziging', label: 'Wijzigingsverzoek polisvoorwaarden', flowtype: 'ontwikkelflow', bron_type: 'stakeholder', ...extern('party-business-verzekeringen') }),
    ],
    outputs: [
      // Bewust onbenut (zie de toelichting bij Fantastic Four 'ti-in-polisstatus').
      io({ id: 'po-out-polisstatus', label: 'Polisstatus-terugkoppeling', bron_type: 'team', applicatieId: 'po-app-polis' }),
      io({ id: 'po-out-betaalopdracht', label: 'Betaalopdracht polis', bron_type: 'team', applicatieId: 'po-app-premie', punten: ['Alleen op werkdagen', 'Maximaal 2 uur vertraging toegestaan'] }),
      io({ id: 'po-out-mutaties', label: 'Polismutaties voor incasso', bron_type: 'team', applicatieId: 'po-app-mutatie' }),
      io({ id: 'po-out-aanvraag', label: 'Aanvraagdossier compleet', bron_type: 'team', applicatieId: 'po-app-document', punten: ['Compleet = polis, inkomen en identiteit gecontroleerd', 'Incomplete dossiers blijven bij Wakanda'] }),
      // Bewust onbenut.
      io({ id: 'po-out-premiemodel', label: 'Nieuw premiemodel gepubliceerd', bron_type: 'stakeholder', applicatieId: 'po-app-premie' }),
      io({ id: 'po-out-releasekandidaat', label: 'Releasekandidaat polismodule', flowtype: 'ontwikkelflow', bron_type: 'team' }),
      io({ id: 'po-out-nazorg', label: 'Nazorgactie beheer', flowtype: 'ontwikkelflow', bron_type: 'rol' }),
    ],
    stageNotes: {
      ontwikkeling_configuratie: 'Wijzigingen aan de polisadministratiekern altijd in pair met een senior developer.',
      release_overdracht: 'Release alleen in het maandelijkse venster van de releasekalender; CAB-stuk uiterlijk een week vooraf.',
    },
    annotations: [
      { id: 'po-ann-1', kind: 'note', text: 'Q4: premiemodel-wijziging is de grootste release van het jaar', color: '#d97706', position: { x: 60, y: 900 } },
      { id: 'po-ann-2', kind: 'shape', shape: 'circle', text: 'Kern', color: '#4338ca', position: { x: 300, y: 900 } },
    ],
    layout: {},
  },

  [T.superheroes]: {
    applications: [
      { id: 'sh-app-beoordeel', naam: 'Beoordelingsapplicatie' },
      { id: 'sh-app-regels', naam: 'Regelmotor beoordeling' },
      { id: 'sh-app-dossier', naam: 'Dossierviewer' },
    ],
    applicatieflowConnecties: [
      { id: 'sh-conn-1', van: 'sh-app-dossier', naar: 'sh-app-beoordeel', punten: ['Dossier wordt alleen-lezen geopend in de beoordeling'] },
      { id: 'sh-conn-2', van: 'sh-app-regels', naar: 'sh-app-beoordeel', punten: ['Regelmotor adviseert, beoordelaar besluit', 'Afwijken van het advies vereist een motivering'] },
    ],
    applicatieflowDetails: {
      'sh-app-regels': {
        toelichting: 'Ingekochte regelmotor; regels worden door de leverancier gereleased.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Zonder regelmotor moet elke aanvraag volledig handmatig beoordeeld worden.',
      },
    },
    capacity: [
      cap('sh-cap1', 'Product Owner', 'senior', 1, 'analyse_refinement', 'nee'),
      cap('sh-cap2', 'Beoordelaar (business)', 'senior', 3, 'acceptatie', 'ja', 'De drie senior beoordelaars zijn de enigen met tekenbevoegdheid.'),
      cap('sh-cap3', 'Developer', 'medior', 2, 'ontwikkeling_configuratie', 'nee'),
      cap('sh-cap4', 'Tester', 'junior', 1, 'testen', 'nee'),
      cap('sh-cap5', 'Release-coördinator', 'medior', 1, 'release_overdracht', 'nee'),
    ],
    inputs: [
      io({ id: 'sh-in-aanvraag', label: 'Aanvraagdossier vanuit Wakanda', bron_type: 'team', linkedTeam: T.polis, linkedOutputId: 'po-out-aanvraag', applicatieId: 'sh-app-dossier', punten: ['Doorlooptijdnorm: besluit binnen 8 weken na compleet dossier'] }),
      io({ id: 'sh-in-api', label: 'Technische API-toegang (S.H.I.E.L.D.)', bron_type: 'team', linkedTeam: T.smurfen, linkedOutputId: 'sm-out-api', applicatieId: 'sh-app-beoordeel' }),
      io({ id: 'sh-in-test', label: 'Testbevindingen beoordelingsketen', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.freggels, linkedOutputId: 'fr-out-testbevindingen' }),
      io({ id: 'sh-in-regels', label: 'Regelrelease van de leverancier', bron_type: 'team', applicatieId: 'sh-app-regels', ...extern('party-regelmotor') }),
      io({ id: 'sh-in-beleid', label: 'Beleidswijziging beoordelingskader', flowtype: 'ontwikkelflow', bron_type: 'stakeholder', ...extern('party-business-verzekeringen') }),
    ],
    outputs: [
      io({ id: 'sh-out-beschikking', label: 'Beschikking (toekenning of afwijzing)', bron_type: 'team', applicatieId: 'sh-app-beoordeel', punten: ['Toekenningen dezelfde dag naar Stark Industries', 'Afwijzingen met motivering naar de klant'] }),
      io({ id: 'sh-out-releasekandidaat', label: 'Releasekandidaat beoordelingsmodule', flowtype: 'ontwikkelflow', bron_type: 'team' }),
    ],
    stageNotes: {
      acceptatie: 'Acceptatie altijd met minimaal twee beoordelaars; regelwijzigingen ook door de leverancier laten bevestigen.',
    },
    annotations: [{ id: 'sh-ann-1', kind: 'note', text: 'Doorlooptijdnorm 8 weken staat onder druk in Q4', color: '#d97706', position: { x: 60, y: 900 } }],
    layout: {},
  },

  [T.casio]: {
    applications: [
      { id: 'ca-app-betaal', naam: 'Betaalengine' },
      { id: 'ca-app-uitkering', naam: 'Uitkeringsservice' },
      { id: 'ca-app-batch', naam: 'Batchverwerker' },
      { id: 'ca-app-regel', naam: 'Regelservice' },
      { id: 'ca-app-loon', naam: 'Loonaangiftekoppeling' },
      // Heeft een koppeling maar geen Applicatieflow-dependency: geen lane,
      // dus de lijn Regelservice → Fraudecheck is op het canvas onzichtbaar.
      { id: 'ca-app-fraude', naam: 'Fraudecheck-service' },
    ],
    applicatieflowConnecties: [
      { id: 'ca-conn-1', van: 'ca-app-uitkering', naar: 'ca-app-regel', punten: ['Elke uitkering langs de regelservice vóór betaling'] },
      { id: 'ca-conn-2', van: 'ca-app-regel', naar: 'ca-app-betaal' },
      { id: 'ca-conn-3', van: 'ca-app-betaal', naar: 'ca-app-batch', punten: ['Nachtelijke batch 23:00', 'Herstart alleen door technisch beheer'] },
      { id: 'ca-conn-4', van: 'ca-app-betaal', naar: 'ca-app-loon' },
      { id: 'ca-conn-5', van: 'ca-app-regel', naar: 'ca-app-fraude' },
    ],
    applicatieflowDetails: {
      'ca-app-betaal': {
        toelichting: 'Maakt de betaalbestanden voor de bank; verwerkt dagelijks tienduizenden betalingen.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Uitval betekent dat uitkeringen niet op tijd op de rekening staan.',
      },
      'ca-app-fraude': {
        toelichting: 'Nieuwe service in pilot; nog niet in de dagelijkse stroom.',
        risico_bij_uitval: 'nee',
        risico_toelichting: '',
      },
    },
    capacity: [
      cap('ca-cap1', 'Product Owner', 'senior', 1, 'analyse_refinement', 'nee'),
      cap('ca-cap2', 'Developer', 'senior', 2, 'ontwikkeling_configuratie', 'ja', 'Alleen zij kennen de betaalengine van binnen.'),
      cap('ca-cap3', 'Tester', 'junior', 1, 'testen', 'nee'),
      cap('ca-cap4', 'Security officer', 'medior', 1, 'hardening', 'ja', 'Enige die de hardening-checks mag aftekenen.'),
      cap('ca-cap5', 'Beheerder', 'medior', 1, 'beheer_nazorg', 'nee'),
    ],
    inputs: [
      io({ id: 'ca-in-platform', label: 'Platform- en releasekalender', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.equinox, linkedOutputId: 'eq-out-release' }),
      io({ id: 'ca-in-betaalopdracht', label: 'Betaalopdracht vanuit Wakanda', bron_type: 'team', linkedTeam: T.polis, linkedOutputId: 'po-out-betaalopdracht', applicatieId: 'ca-app-betaal', punten: ['Controle op dubbele opdrachten vóór verwerking'] }),
      io({ id: 'ca-in-mutaties', label: 'Polismutaties voor incasso', bron_type: 'team', linkedTeam: T.polis, linkedOutputId: 'po-out-mutaties', applicatieId: 'ca-app-batch' }),
      io({ id: 'ca-in-beschikking', label: 'Beschikking vanuit beoordeling', bron_type: 'team', linkedTeam: T.superheroes, linkedOutputId: 'sh-out-beschikking', applicatieId: 'ca-app-uitkering', punten: ['Alleen toegekende beschikkingen leiden tot betaling', 'Afwijzingen gaan naar klantcommunicatie'] }),
      io({ id: 'ca-in-melding', label: 'Klantmelding uitkering vanuit intake', bron_type: 'team', linkedTeam: T.tiem, linkedOutputId: 'ti-out-melding', applicatieId: 'ca-app-uitkering', punten: ['Slaat Wakanda en beoordeling bewust over: directe melding bij spoed'] }),
      io({ id: 'ca-in-api', label: 'Technische API-toegang (S.H.I.E.L.D.)', bron_type: 'team', linkedTeam: T.smurfen, linkedOutputId: 'sm-out-api', applicatieId: 'ca-app-regel' }),
      io({ id: 'ca-in-test', label: 'Testbevindingen betaalketen', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.freggels, linkedOutputId: 'fr-out-testbevindingen' }),
      io({ id: 'ca-in-correctie', label: 'Correctiesignalen uit rapportage', bron_type: 'team', linkedTeam: T.sv, linkedOutputId: 'sv-out-correctie', applicatieId: 'ca-app-uitkering' }),
      io({ id: 'ca-in-bank', label: 'Betaalinstructies en retourberichten bank', bron_type: 'systeem', applicatieId: 'ca-app-betaal', ...extern('party-bank') }),
    ],
    outputs: [
      io({ id: 'ca-out-betaalstatus', label: 'Betaalstatusbericht', bron_type: 'team', applicatieId: 'ca-app-betaal', punten: ['Per betaling één statusbericht', 'Retourboekingen apart gemarkeerd'] }),
      io({ id: 'ca-out-sepa', label: 'Betaalbestand (SEPA) naar bank', bron_type: 'systeem', applicatieId: 'ca-app-betaal', ...extern('party-bank') }),
      io({ id: 'ca-out-loonaangifte', label: 'Loonaangifte uitkeringen', bron_type: 'systeem', applicatieId: 'ca-app-loon', ...extern('party-belastingdienst') }),
      io({ id: 'ca-out-beschikking', label: 'Uitkeringsbeschikking', bron_type: 'persoon', applicatieId: 'ca-app-uitkering' }),
      // Koppelingsverzoek om een nieuw item bij Daily Bugle — wacht op akkoord.
      io({ id: 'ca-out-statistiek', label: 'Uitkeringsstatistiek per maand', bron_type: 'team', applicatieId: 'ca-app-uitkering', linkedTeam: T.sv, linkNieuw: true, linkStatus: 'voorgesteld' }),
    ],
    stageNotes: {
      hardening: 'Betaalengine: penetratietest en hardening-checklist verplicht vóór elke release.',
    },
    annotations: [],
    layout: {},
  },

  [T.sv]: {
    applications: [
      { id: 'sv-app-dwh', naam: 'Datawarehouse' },
      { id: 'sv-app-dashboard', naam: 'Dashboardservice' },
      { id: 'sv-app-rapport', naam: 'Rapportagegenerator' },
      { id: 'sv-app-kwaliteit', naam: 'Datakwaliteitsmonitor' },
    ],
    applicatieflowConnecties: [
      { id: 'sv-conn-1', van: 'sv-app-dwh', naar: 'sv-app-dashboard', punten: ['Verversing elk uur', 'Dashboard toont laatste laadtijd'] },
      { id: 'sv-conn-2', van: 'sv-app-dwh', naar: 'sv-app-rapport' },
      { id: 'sv-conn-3', van: 'sv-app-kwaliteit', naar: 'sv-app-dwh' },
    ],
    applicatieflowDetails: {
      'sv-app-dwh': {
        toelichting: 'Centrale datalaag; alle rapportages en dashboards lezen hieruit.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Geen datawarehouse betekent geen managementinformatie en geen toezichtrapportage.',
      },
    },
    capacity: [
      cap('sv-cap1', 'Data-engineer', 'senior', 1, 'ontwikkeling_configuratie', 'ja', 'Enige kennishouder van de laadprocessen.'),
      cap('sv-cap2', 'BI-specialist', 'medior', 2, 'ontwikkeling_configuratie', 'nee'),
      cap('sv-cap3', 'Tester', 'junior', 1, 'testen', 'nee'),
      cap('sv-cap4', 'Product Owner', 'medior', 1, 'analyse_refinement', 'nee'),
    ],
    inputs: [
      io({ id: 'sv-in-betaalstatus', label: 'Betaalstatus vanuit Stark Industries', bron_type: 'team', linkedTeam: T.casio, linkedOutputId: 'ca-out-betaalstatus', applicatieId: 'sv-app-dwh', punten: ['Bron voor het uitkeringsdashboard'] }),
      io({ id: 'sv-in-brondata', label: 'Brondata nachtelijke batch', bron_type: 'systeem', applicatieId: 'sv-app-dwh' }),
      io({ id: 'sv-in-vraag', label: 'Rapportagevraag vanuit directie', flowtype: 'ontwikkelflow', bron_type: 'stakeholder', ...extern('party-directie') }),
    ],
    outputs: [
      io({ id: 'sv-out-correctie', label: 'Correctiesignalen betalingen', bron_type: 'team', applicatieId: 'sv-app-kwaliteit', punten: ['Wekelijks overzicht van afwijkende betalingen'] }),
      // Bewust onbenut (zie de toelichting bij Nova Corps 'fr-in-kwaliteit').
      io({ id: 'sv-out-kwaliteit', label: 'Kwaliteitsrapportage testdekking', flowtype: 'ontwikkelflow', bron_type: 'team', applicatieId: 'sv-app-rapport' }),
      io({ id: 'sv-out-toezicht', label: 'Toezichtrapportage (kwartaal)', bron_type: 'stakeholder', applicatieId: 'sv-app-rapport', ...extern('party-toezicht') }),
      io({ id: 'sv-out-dashboard', label: 'Managementdashboard update', bron_type: 'stakeholder', applicatieId: 'sv-app-dashboard', ...extern('party-directie') }),
      // Bewust onbenut.
      io({ id: 'sv-out-rapportage', label: 'Rapportagebundel managementinfo', bron_type: 'team', applicatieId: 'sv-app-rapport' }),
    ],
    stageNotes: {},
    annotations: [{ id: 'sv-ann-1', kind: 'note', text: 'Toezichtrapportage: deadline elke 15e van de maand na kwartaaleinde', color: '#e11d48', position: { x: 60, y: 900 } }],
    layout: {},
  },

  [T.equinox]: {
    applications: [
      { id: 'eq-app-notif', naam: 'Notificatieservice' },
      // Bewust zonder enige relatie.
      { id: 'eq-app-beheer', naam: 'Beheerconsole' },
      { id: 'eq-app-kalender', naam: 'Releasekalender-app' },
    ],
    applicatieflowConnecties: [{ id: 'eq-conn-1', van: 'eq-app-kalender', naar: 'eq-app-notif', punten: ['Kalenderwijziging stuurt notificatie naar alle teams'] }],
    applicatieflowDetails: {
      'eq-app-kalender': {
        toelichting: 'Eén bron voor alle releasevensters en platformonderhoud.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Teams plannen releases blind zonder de kalender.',
      },
    },
    capacity: [
      cap('eq-cap1', 'Product Owner', 'senior', 1, '', 'ja', 'Enige die de samenhang tussen release- en platformmomenten kent.'),
      cap('eq-cap2', 'Developer', 'medior', 1, 'ontwikkeling_configuratie', 'nee'),
      cap('eq-cap3', 'Platformbeheerder', 'junior', 1, 'beheer_nazorg', 'nee'),
    ],
    inputs: [
      io({ id: 'eq-in-wetupdate', label: 'Wet- en regelgevingsupdate', bron_type: 'omgeving' }),
      io({ id: 'eq-in-cab', label: 'CAB-besluiten releasevensters', flowtype: 'ontwikkelflow', bron_type: 'stakeholder', ...extern('party-cab') }),
    ],
    outputs: [
      io({ id: 'eq-out-release', label: 'Release- en platformkalender', flowtype: 'ontwikkelflow', bron_type: 'team', applicatieId: 'eq-app-kalender', punten: ['Maandelijks releasevenster, tweede dinsdag', 'Freeze in de laatste twee weken van het jaar'] }),
      // Bewust onbenut.
      io({ id: 'eq-out-signalen', label: 'Signalen naar ketenoverzicht', bron_type: 'team', applicatieId: 'eq-app-notif' }),
    ],
    stageNotes: {},
    annotations: [],
    layout: {},
  },

  [T.smurfen]: {
    applications: [
      { id: 'sm-app-iam', naam: 'IAM-platform' },
      { id: 'sm-app-api', naam: 'API-gateway' },
      { id: 'sm-app-log', naam: 'Logservice' },
      { id: 'sm-app-monitoring', naam: 'Monitoringservice' },
      { id: 'sm-app-ci', naam: 'CI/CD-pipeline' },
      { id: 'sm-app-secrets', naam: 'Secrets-vault' },
    ],
    applicatieflowConnecties: [
      { id: 'sm-conn-1', van: 'sm-app-iam', naar: 'sm-app-api', punten: ['Elke API-call gevalideerd tegen IAM-token'] },
      { id: 'sm-conn-2', van: 'sm-app-api', naar: 'sm-app-log' },
      { id: 'sm-conn-3', van: 'sm-app-monitoring', naar: 'sm-app-log' },
      { id: 'sm-conn-4', van: 'sm-app-ci', naar: 'sm-app-monitoring' },
      { id: 'sm-conn-5', van: 'sm-app-secrets', naar: 'sm-app-iam', punten: ['Sleutelrotatie elke 90 dagen'] },
    ],
    applicatieflowDetails: {
      'sm-app-iam': {
        toelichting: 'Centrale identiteits- en toegangslaag voor alle teams.',
        risico_bij_uitval: 'ja',
        risico_toelichting: 'Zonder IAM kan niemand inloggen: organisatiebrede uitval.',
      },
    },
    capacity: [
      cap('sm-cap1', 'Architect', 'senior', 1, 'analyse_refinement', 'ja', 'Enige die het IAM-landschap volledig overziet.'),
      cap('sm-cap2', 'Developer', 'senior', 2, 'ontwikkeling_configuratie', 'nee'),
      cap('sm-cap3', 'Developer', 'junior', 1, 'ontwikkeling_configuratie', 'nee'),
      cap('sm-cap4', 'Security officer', 'medior', 1, 'hardening', 'nee'),
      cap('sm-cap5', 'Technisch beheerder', 'medior', 1, 'beheer_nazorg', 'ja', 'Enige met productie-rechten op het IAM-platform.'),
    ],
    inputs: [
      io({ id: 'sm-in-ssd', label: 'Afgehandelde SSD-aanvragen (servers, opslag)', bron_type: 'team', applicatieId: 'sm-app-ci', ...extern('party-ssd') }),
      io({ id: 'sm-in-security', label: 'Security-eisen en beleidsupdates', flowtype: 'ontwikkelflow', bron_type: 'stakeholder', ...extern('party-security') }),
    ],
    outputs: [
      io({ id: 'sm-out-api', label: 'Technische API-toegang', bron_type: 'team', applicatieId: 'sm-app-api', punten: ['Toegang per team via eigen client-id', 'Sleutels verlopen na 90 dagen'] }),
      io({ id: 'sm-out-iamrollen', label: 'IAM-rollenset per team', bron_type: 'team', applicatieId: 'sm-app-iam' }),
      io({ id: 'sm-out-monitoring', label: 'Monitoringsignalen platform', bron_type: 'team', applicatieId: 'sm-app-monitoring' }),
    ],
    stageNotes: {
      hardening: 'Alle platformwijzigingen langs de security officer; sleutelrotatie meenemen.',
    },
    annotations: [],
    layout: {},
  },

  [T.freggels]: {
    applications: [
      { id: 'fr-app-testdata', naam: 'Testdata Generator' },
      { id: 'fr-app-signalering', naam: 'Signaleringsservice' },
      { id: 'fr-app-testauto', naam: 'Testautomatiseringsframework' },
      { id: 'fr-app-perf', naam: 'Performancetestsuite' },
    ],
    applicatieflowConnecties: [
      { id: 'fr-conn-1', van: 'fr-app-testdata', naar: 'fr-app-testauto', punten: ['Geanonimiseerde dataset per testrun'] },
      { id: 'fr-conn-2', van: 'fr-app-testauto', naar: 'fr-app-signalering' },
      { id: 'fr-conn-3', van: 'fr-app-perf', naar: 'fr-app-signalering' },
    ],
    applicatieflowDetails: {
      'fr-app-testdata': {
        toelichting: 'Genereert geanonimiseerde testsets voor alle ketenteams.',
        risico_bij_uitval: 'nee',
        risico_toelichting: '',
      },
    },
    capacity: [
      cap('fr-cap1', 'Testcoördinator', 'senior', 1, 'testen', 'ja', 'Enige die de ketentest van begin tot eind kan plannen.'),
      cap('fr-cap2', 'Testautomatiseerder', 'medior', 2, 'testen', 'nee'),
      cap('fr-cap3', 'Tester', 'junior', 1, 'acceptatie', 'nee'),
      cap('fr-cap4', 'Business analist', 'medior', 1, 'analyse_refinement', 'nee'),
    ],
    inputs: [
      // Bewust NIET gekoppeld aan de output van Daily Bugle: die zit in de
      // cyclus met Stark Industries, en een koppeling vanuit die cyclus naar Nova Corps zou
      // via Nova Corps → Wakanda → Avengers → Stark Industries de hele keten in de
      // "cyclus-laag" van de gelaagde weergave trekken (Kahn: alles stroom-
      // afwaarts van een cyclus blijft onverwerkt). Losse input = normaal.
      io({ id: 'fr-in-kwaliteit', label: 'Kwaliteitsrapportage testdekking', flowtype: 'ontwikkelflow', bron_type: 'team' }),
      io({ id: 'fr-in-testverzoek', label: 'Testverzoek vanuit ketenteam', flowtype: 'ontwikkelflow', bron_type: 'team' }),
      // Koppelingsverzoek op een bestaand item van Asgard — wacht op akkoord.
      io({ id: 'fr-in-releasekalender', label: 'Releasekalender voor testplanning', flowtype: 'ontwikkelflow', bron_type: 'team', linkedTeam: T.equinox, linkedOutputId: 'eq-out-release', linkStatus: 'voorgesteld' }),
      io({ id: 'fr-in-externtest', label: 'Externe testcapaciteit (piekperiodes)', flowtype: 'ontwikkelflow', bron_type: 'team', ...extern('party-testteam') }),
    ],
    outputs: [
      io({ id: 'fr-out-testbevindingen', label: 'Testbevindingen acceptatie', flowtype: 'ontwikkelflow', bron_type: 'team', applicatieId: 'fr-app-signalering', punten: ['Bevindingen binnen 24 uur na testrun', 'Blokkerende bevindingen direct telefonisch'] }),
      // Koppelingsverzoek om een nieuw item bij Fantastic Four — afgewezen.
      io({ id: 'fr-out-testrapport', label: 'Testrapport per release', flowtype: 'ontwikkelflow', bron_type: 'team', applicatieId: 'fr-app-signalering', linkedTeam: T.tiem, linkNieuw: true, linkStatus: 'afgewezen' }),
      io({ id: 'fr-out-signalering', label: 'Signaleringsdrempels ketentest', bron_type: 'team', applicatieId: 'fr-app-signalering' }),
    ],
    stageNotes: {
      testen: 'Ketentest elke sprint op donderdag; testdata de dag ervoor ververst.',
    },
    annotations: [],
    layout: {},
  },
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------
// Elk record staat volledig uitgeschreven (flowtype, werkstap of applicaties,
// effect op flow, wachttijd, deadline, oplosbaarheid) — geen half ingevulde
// profielen, behalve bij Asgard (bewust, zie teamprofielen). `aangemaakt` en
// `bijgewerkt` zijn dagen geleden; bijgewerkt ligt nooit vóór aangemaakt.
// Risiconiveaus (lib/risk.js: impact × frequentie + statuscorrectie): Laag komt
// het vaakst voor, dan Gemiddeld, dan Hoog; Kritiek is schaars en ontstaat
// alleen bij zwaar × structureel × actief blokkerend. Observaties zijn bewust
// getriggerd: Wakanda én Stark Industries hebben elk drie externe dependencies op het CAB
// (gelijkspel), Wakanda heeft het kennisrisico-zwaartepunt, en 'actief
// blokkerend' is over alle acht teams verspreid.

const DEP_DEFAULTS = {
  scope: 'intern',
  flowtype: 'ontwikkelflow',
  workflowStap: '',
  applicatieIds: [],
  effectOpFlow: '',
  actieAfspraak: '',
  mitigatie: '',
  geaccepteerd: false,
  wachttijd: '',
  deadline: '',
  deadlineTekst: '',
  oplosbaarheid: '',
}

const IMPACT_VOLGORDE = ['klein', 'beperkt', 'duidelijk', 'zwaar']
const FREQ_VOLGORDE = ['eenmalig', 'soms', 'regelmatig', 'structureel']
function lager(lijst, waarde) {
  const i = lijst.indexOf(waarde)
  return i > 0 ? lijst[i - 1] : null
}
function hoger(lijst, waarde) {
  const i = lijst.indexOf(waarde)
  return i >= 0 && i < lijst.length - 1 ? lijst[i + 1] : null
}

// Geloofwaardige wijzigingshistorie per dependency, afgeleid uit wat het
// record nú is (in dagen geleden; finalize zet ze om naar datums):
// - een gemitigeerde dependency is ooit als bekend risico begonnen en is bij
//   een deel tussendoor blokkerend geweest, soms met een lagere impact na de
//   mitigatie;
// - een blokkerende dependency is ge-escaleerd vanuit bekend risico, soms
//   met een hogere impact op hetzelfde moment;
// - een deel van de bekende risico's is eerder al eens blokkerend geweest en
//   weer afgeschaald, of is in frequentie toegenomen.
// Het laatste moment valt samen met 'laatst bijgewerkt'. Deterministisch via
// hashVan(id), dus bij elke herlaad dezelfde historie. Een record zonder
// tussentijdse wijziging (bijgewerkt = aangemaakt) heeft geen historie —
// onvolledig is niet verzonnen.
function historieVoor(raw) {
  const { aangemaakt = 180, bijgewerkt = 30, status, impact, frequentie, id } = raw
  const h = hashVan(id)
  const span = Math.max(0, aangemaakt - Math.min(bijgewerkt, aangemaakt))
  const laatste = Math.min(bijgewerkt, aangemaakt)
  const events = []
  if (span === 0) return events
  const tussen = (f) => Math.round(aangemaakt - span * f)
  if (status === 'gemitigeerd') {
    if (span > 60 && h % 3 === 0) {
      events.push({ dagen: tussen(0.35), veld: 'status', van: 'bekend risico', naar: 'actief blokkerend' })
      events.push({ dagen: laatste, veld: 'status', van: 'actief blokkerend', naar: 'gemitigeerd' })
    } else {
      events.push({ dagen: laatste, veld: 'status', van: 'bekend risico', naar: 'gemitigeerd' })
    }
    const hogerImpact = hoger(IMPACT_VOLGORDE, impact)
    if (hogerImpact && h % 4 === 0) events.push({ dagen: laatste, veld: 'impact', van: hogerImpact, naar: impact })
  } else if (status === 'actief blokkerend' && span > 90 && h % 7 === 0) {
    // Mitigatie die geen stand hield: eerst gemitigeerd, daarna toch blokkerend.
    events.push({ dagen: tussen(0.3), veld: 'status', van: 'bekend risico', naar: 'gemitigeerd' })
    events.push({ dagen: laatste, veld: 'status', van: 'gemitigeerd', naar: 'actief blokkerend' })
  } else if (status === 'actief blokkerend') {
    events.push({ dagen: laatste, veld: 'status', van: 'bekend risico', naar: 'actief blokkerend' })
    const lagerImpact = lager(IMPACT_VOLGORDE, impact)
    if (lagerImpact && h % 3 === 0) events.push({ dagen: laatste, veld: 'impact', van: lagerImpact, naar: impact })
  } else if (span > 30 && h % 4 === 0) {
    events.push({ dagen: tussen(0.5), veld: 'status', van: 'bekend risico', naar: 'actief blokkerend' })
    events.push({ dagen: laatste, veld: 'status', van: 'actief blokkerend', naar: 'bekend risico' })
  } else if (h % 5 === 0) {
    const lagerFreq = lager(FREQ_VOLGORDE, frequentie)
    if (lagerFreq) events.push({ dagen: laatste, veld: 'frequentie', van: lagerFreq, naar: frequentie })
  }
  return events
}

// Afgehandelde (gesloten) dependency: gemitigeerd en daarna afgesloten, soms
// met een escalatie ervoor. Blijft bewaard mét historie — de basis voor
// oplostempo en trends — maar telt niet mee in de operationele weergaven.
function afgehandeld(fields) {
  const { aangemaakt, gemitigeerd, gesloten, escalatie = null, ...rest } = fields
  const historie = []
  if (escalatie != null) historie.push({ dagen: escalatie, veld: 'status', van: 'bekend risico', naar: 'actief blokkerend' })
  historie.push({ dagen: gemitigeerd, veld: 'status', van: escalatie != null ? 'actief blokkerend' : 'bekend risico', naar: 'gemitigeerd' })
  historie.push({ dagen: gesloten, veld: 'gesloten', van: null, naar: true })
  return { ...rest, status: 'gemitigeerd', aangemaakt, bijgewerkt: gesloten, gesloten, historie }
}

function finalize(raw) {
  const { aangemaakt = 180, bijgewerkt = 30, gesloten = null, heropend = null, historie, ...rest } = raw
  const events = (historie ?? historieVoor(raw)).map((e) => ({
    datum: dagenGeleden(e.dagen),
    veld: e.veld,
    van: e.van ?? null,
    naar: e.veld === 'gesloten' && e.naar === true ? dagenGeleden(e.dagen) : (e.naar ?? null),
  }))
  // Eerder afgesloten en later heropend: twee 'gesloten'-events, zoals de
  // app ze zelf schrijft (naar = sluitdatum, daarna van = sluitdatum, naar = null).
  if (heropend) {
    const sluitDatum = dagenGeleden(heropend.gesloten)
    events.push({ datum: sluitDatum, veld: 'gesloten', van: null, naar: sluitDatum })
    events.push({ datum: dagenGeleden(heropend.heropend), veld: 'gesloten', van: sluitDatum, naar: null })
  }
  events.sort((a, b) => a.datum.localeCompare(b.datum))
  return {
    ...DEP_DEFAULTS,
    ...rest,
    aangemaakt_op: dagenGeleden(aangemaakt),
    laatst_bijgewerkt: dagenGeleden(Math.min(bijgewerkt, aangemaakt)),
    historie: events,
    gesloten_op: gesloten != null ? dagenGeleden(gesloten) : null,
  }
}

// ============================================================
// Team Fantastic Four — klantcontact & intake: veel Ontwikkelflow, gemengd profiel
// ============================================================
const DEPS_TIEM = [
  {
    id: 'ti-dep-01', teamId: T.tiem, categorie: 'Kennis-concentratie',
    titel: 'Kennis zaakregistratie-koppelingen zit bij één developer',
    toelichting: 'Alleen één developer kent de koppelingen tussen zaakregistratie en de berichtendienst; bij afwezigheid stokt elke wijziging.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'ontwikkeling_configuratie', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Pair programming op alle koppelingswijzigingen; kennisdocument in Q4.',
    aangemaakt: 380, bijgewerkt: 25, heropend: { gesloten: 150, heropend: 40 },
  },
  {
    id: 'ti-dep-02', teamId: T.tiem, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Handmatige controle-stap vertraagt doorlooptijd intake',
    toelichting: 'Elke zaak wordt handmatig gecontroleerd voordat hij de keten in mag; bij drukte loopt de wachtrij op tot twee dagen.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-zaak'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 210, bijgewerkt: 12,
  },
  {
    id: 'ti-dep-03', teamId: T.tiem, categorie: 'Rol-afhankelijkheid',
    titel: 'PO-beschikbaarheid vertraagt refinement',
    toelichting: 'De product owner is twee dagen per week beschikbaar; refinementvragen wachten daardoor tot de volgende week.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'gemitigeerd',
    workflowStap: 'analyse_refinement', effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Vast wekelijks refinementmoment ingepland.',
    aangemaakt: 500, bijgewerkt: 150,
  },
  {
    id: 'ti-dep-04', teamId: T.tiem, categorie: 'Data-afhankelijkheid',
    titel: 'Contactgeschiedenis niet centraal doorzoekbaar',
    toelichting: 'Klantcontactmodule en zaakregistratie hielden elk hun eigen contacthistorie bij.',
    impact: 'beperkt', frequentie: 'soms', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-klant', 'ti-app-zaak'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Zoekindex over beide modules opgeleverd.', geaccepteerd: true,
    aangemaakt: 600, bijgewerkt: 200,
  },
  {
    id: 'ti-dep-05', teamId: T.tiem, categorie: 'Technische afhankelijkheid',
    titel: 'Berichtendienst valt terug op polling bij piekdrukte',
    toelichting: 'Bij meer dan duizend berichten per uur schakelt de dienst over op polling en lopen klantberichten minuten achter.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-bericht'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 90, bijgewerkt: 30,
  },
  {
    id: 'ti-dep-06', teamId: T.tiem, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Prioritering tussen telefonie en chat niet belegd',
    toelichting: 'Niemand beslist welke ingang voorrang krijgt bij schaarse ontwikkelcapaciteit; elke sprint wordt dat opnieuw bediscussieerd.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'extra_afstemming',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 120, bijgewerkt: 100,
  },
  {
    id: 'ti-dep-07', teamId: T.tiem, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Acceptatieomgeving intake wordt gedeeld met Wakanda',
    toelichting: 'Beide teams testen in dezelfde acceptatieomgeving; een deploy van de één zet de test van de ander stil.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'acceptatie', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 260, bijgewerkt: 40,
  },
  {
    id: 'ti-dep-08', teamId: T.tiem, categorie: 'Overig intern',
    titel: 'Ad hoc onboarding nieuwe teamleden',
    toelichting: 'Er is geen inwerkprogramma; nieuwe collega’s leren de intake via meelopen.',
    impact: 'klein', frequentie: 'soms', status: 'bekend risico',
    effectOpFlow: 'contextswitch',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 45, bijgewerkt: 10,
  },
  {
    id: 'ti-dep-09', teamId: T.tiem, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring nodig voor elke berichtendienst-wijziging',
    toelichting: 'Ook kleine tekstwijzigingen in klantberichten gaan langs het CAB, dat eens per twee weken vergadert.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'CAB vergadert elke tweede dinsdag', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 420, bijgewerkt: 60,
  },
  {
    id: 'ti-dep-10', teamId: T.tiem, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Autorisatieaanvraag nieuwe medewerker duurt gemiddeld drie weken',
    toelichting: 'Nieuwe klantcontactmedewerkers kunnen pas na drie weken in de zaakregistratie; tot die tijd werken ze op een collega-account.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'beheer_nazorg', effectOpFlow: 'niet_startklaar',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    actieAfspraak: 'Standaard rollenprofiel klantcontact aangevraagd bij IAM-beheer.',
    ...partij('party-iam'), aangemaakt: 300, bijgewerkt: 15,
  },
  {
    id: 'ti-dep-11', teamId: T.tiem, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Technisch applicatiebeheer plant wijzigingen pas na twee sprints in',
    toelichting: 'Databasewijzigingen voor de zaakregistratie worden door TAB uitgevoerd, met een vaste doorlooptijd van twee sprints.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-zaak'], effectOpFlow: 'wachten',
    wachttijd: 'sprint_of_meer', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    ...partij('party-techbeheer'), aangemaakt: 150, bijgewerkt: 20,
  },
  {
    id: 'ti-dep-12', teamId: T.tiem, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Acceptatie afhankelijk van één businessvertegenwoordiger',
    toelichting: 'De business opdrachtgever keurt persoonlijk elke wijziging in het klantcontactproces goed.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'acceptatie', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    ...partij('party-business-klantcontact'), aangemaakt: 200, bijgewerkt: 8,
  },
  {
    id: 'ti-dep-13', teamId: T.tiem, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'API-toegang klantdata loopt via de gateway van S.H.I.E.L.D.',
    toelichting: 'Elke nieuwe klantdata-koppeling vraagt een client-id en configuratie op de API-gateway van Team S.H.I.E.L.D..',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-klant'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 330, bijgewerkt: 33,
  },
  {
    id: 'ti-dep-14', teamId: T.tiem, scope: 'extern', categorie: 'Data-afhankelijkheid',
    titel: 'Klantgegevens uit DigiD-koppeling onvolledig bij nieuwe klanten',
    toelichting: 'Bij eerste inlog ontbreken adresgegevens; medewerkers vullen die handmatig aan.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-klant'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    ...partij('party-digid'), aangemaakt: 75, bijgewerkt: 70,
  },
  {
    id: 'ti-dep-15', teamId: T.tiem, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Nieuwe bewaartermijn contactgegevens vraagt aanpassing zaakregistratie',
    toelichting: 'De bewaartermijn van contactgegevens gaat van zeven naar vijf jaar; de zaakregistratie kent nog geen automatische opschoning.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'niet_startklaar',
    wachttijd: 'geen', deadline: 'harde_deadline', deadlineTekst: 'Wettelijke ingangsdatum 1 januari', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 60, bijgewerkt: 5,
  },
  {
    id: 'ti-dep-16', teamId: T.tiem, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Testomgeving telefonie-integratie niet beschikbaar buiten kantooruren',
    toelichting: 'Omgevingenbeheer zet de telefonie-testomgeving om 18:00 uit; avondtests zijn onmogelijk.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend', geaccepteerd: true,
    ...partij('party-omgevingen'), aangemaakt: 250, bijgewerkt: 95,
  },
  {
    id: 'ti-dep-17', teamId: T.tiem, scope: 'extern', categorie: 'Contract-/inkoopafhankelijkheid',
    titel: 'Contractverlenging telefonieplatform loopt via Inkoop',
    toelichting: 'Het contract met de telefonieleverancier loopt af; verlenging moet via Inkoop & Contractmanagement en de aanbestedingsregels.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: [], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'vaste_datum', deadlineTekst: 'Contract loopt af per 1 maart', oplosbaarheid: 'organisatorisch',
    ...partij('party-inkoop'), aangemaakt: 40, bijgewerkt: 3,
  },
  {
    id: 'ti-dep-18', teamId: T.tiem, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-review verplicht vóór elke release van de klantcontactmodule',
    toelichting: 'De klantcontactmodule verwerkt persoonsgegevens; Security Office reviewt elke release, met een doorlooptijd van een week.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-security'), aangemaakt: 190, bijgewerkt: 45,
  },
  {
    id: 'ti-dep-19', teamId: T.tiem, categorie: 'Kennis-concentratie',
    titel: 'Enige beheerder van berichtsjablonen',
    toelichting: 'Sjablonen voor klantberichten werden door één functioneel beheerder onderhouden.',
    impact: 'beperkt', frequentie: 'soms', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-bericht'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Tweede beheerder opgeleid.', geaccepteerd: true,
    aangemaakt: 700, bijgewerkt: 300,
  },
  {
    id: 'ti-dep-20', teamId: T.tiem, categorie: 'Rol-afhankelijkheid',
    titel: 'Tester is ook functioneel beheerder: testen schuift bij incidenten',
    toelichting: 'Bij productie-incidenten stopt het testwerk, omdat dezelfde persoon beide rollen vervult.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 130, bijgewerkt: 28,
  },
  {
    id: 'ti-dep-21', teamId: T.tiem, categorie: 'Technische afhankelijkheid',
    titel: 'Berichtendienst gebruikt niet-onderhouden PDF-bibliotheek',
    toelichting: 'De bibliotheek voor bijlagen krijgt geen beveiligingsupdates meer.',
    impact: 'klein', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-bericht'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 400, bijgewerkt: 120,
  },
  {
    id: 'ti-dep-22', teamId: T.tiem, categorie: 'Overig intern',
    titel: 'Nog te beoordelen: chatbot-integratie leverancier',
    toelichting: 'Voorstel van de leverancier om een chatbot voor te schakelen; nog niet beoordeeld op impact.',
    impact: 'klein', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: null, effectOpFlow: '',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 7, bijgewerkt: 7,
  },
  {
    id: 'ti-dep-23', teamId: T.tiem, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'SSD-aanvraag extra opslag gespreksopnames wacht al een maand',
    toelichting: 'De opslag voor gespreksopnames zit vol; de SSD-aanvraag staat al vier weken in de wachtrij.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-klant'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'interne_afspraak', oplosbaarheid: 'organisatorisch',
    ...partij('party-ssd'), aangemaakt: 35, bijgewerkt: 2,
  },
  {
    id: 'ti-dep-24', teamId: T.tiem, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Releasecheck intake wordt handmatig in een spreadsheet bijgehouden',
    toelichting: 'De checklist vóór release staat in een gedeelde spreadsheet; stappen worden regelmatig overgeslagen.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 220, bijgewerkt: 110,
  },
]

// ============================================================
// Team Wakanda — groot, applicatierijk, kennisrisico-zwaartepunt, 3× CAB
// ============================================================
const DEPS_POLIS = [
  {
    id: 'po-dep-01', teamId: T.polis, categorie: 'Kennis-concentratie',
    titel: 'Kennis polisverwerkingsproces zit bij één architect',
    toelichting: 'De volledige samenhang van polisadministratie, premie en mutaties zit in het hoofd van de architect; zonder haar staat elk ontwerpbesluit stil.',
    impact: 'zwaar', frequentie: 'structureel', status: 'actief blokkerend',
    workflowStap: 'analyse_refinement', effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Kennissessies elke twee weken; kernprocessen worden in de wiki vastgelegd.',
    aangemaakt: 540, bijgewerkt: 6,
  },
  {
    id: 'po-dep-02', teamId: T.polis, categorie: 'Kennis-concentratie',
    titel: 'Enige senior developer met kennis van het releaseproces',
    toelichting: 'Het releasedraaiboek van de polismodule staat nergens beschreven; één senior developer voert het uit zijn hoofd uit.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 400, bijgewerkt: 60,
  },
  {
    id: 'po-dep-03', teamId: T.polis, categorie: 'Kennis-concentratie',
    titel: 'Configuratiekennis integratie gateway beperkt gedeeld',
    toelichting: 'Routeringsregels en certificaten van de gateway werden door één beheerder bijgehouden.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-gateway'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Configuratie gedocumenteerd en tweede beheerder ingewerkt.',
    aangemaakt: 700, bijgewerkt: 250,
  },
  {
    id: 'po-dep-04', teamId: T.polis, categorie: 'Kennis-concentratie',
    titel: 'Premieberekeningsregels alleen begrepen door twee developers',
    toelichting: 'De rekenregels in de premieberekeningsengine zijn historisch gegroeid; twee developers kunnen ze nog verklaren.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-premie'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Premiemodel-release in het novembervenster', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Derde developer draait mee op alle premiewijzigingen.',
    aangemaakt: 320, bijgewerkt: 4,
  },
  {
    id: 'po-dep-05', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'Technische schuld legacy-validatiemodule',
    toelichting: 'De validatiemodule van de polisadministratie is niet te testen zonder de hele kern op te starten.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'ontwikkeling_configuratie', effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Product Owner neemt dit mee in de eerstvolgende refinement.',
    aangemaakt: 800, bijgewerkt: 200,
  },
  {
    id: 'po-dep-06', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'Gedeelde caching-laag premie- en klantportaal',
    toelichting: 'Een cache-flush voor het klantportaal maakt ook de premiecache leeg, met trage berekeningen tot gevolg.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-premie', 'po-app-klantportaal'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 260, bijgewerkt: 45,
  },
  {
    id: 'po-dep-07', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'IAM-token vernieuwing raakt drie applicaties',
    toelichting: 'Klantportaal, documentservice en de integratie gateway zijn alle drie afhankelijk van dezelfde tokenvernieuwing.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-klantportaal', 'po-app-document', 'po-app-gateway'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 380, bijgewerkt: 30,
  },
  {
    id: 'po-dep-08', teamId: T.polis, scope: 'extern', categorie: 'Data-afhankelijkheid',
    titel: 'Testdata voor premieberekeningsengine ontbreekt',
    toelichting: 'Team Nova Corps levert de geanonimiseerde testsets; voor premieberekening bestaat nog geen set met randgevallen.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teams',
    ...team('Team Nova Corps'), aangemaakt: 150, bijgewerkt: 9,
  },
  {
    id: 'po-dep-09', teamId: T.polis, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Onvolledige testdekking randgevallen premieberekening',
    toelichting: 'Randgevallen zoals premievrijstelling worden niet geautomatiseerd getest; fouten komen in acceptatie naar boven.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 230, bijgewerkt: 100,
  },
  {
    id: 'po-dep-10', teamId: T.polis, categorie: 'Rol-afhankelijkheid',
    titel: 'Testcoördinator gedeeld met Nova Corps',
    toelichting: 'De testcoördinator werkt voor beide teams; de ketentest van Nova Corps krijgt in de praktijk voorrang.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 300, bijgewerkt: 120,
  },
  {
    id: 'po-dep-11', teamId: T.polis, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Enige mandaathouder acceptatiecriteria',
    toelichting: 'Alleen de functioneel beheerder mag acceptatiecriteria vaststellen; bij vakantie stokt de acceptatie.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 190, bijgewerkt: 50,
  },
  {
    id: 'po-dep-12', teamId: T.polis, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Acceptatieomgeving polis wordt gedeeld met Fantastic Four',
    toelichting: 'Dezelfde acceptatieomgeving als het intake-team; deploys van Fantastic Four zetten de polis-acceptatietest stil.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 260, bijgewerkt: 40,
  },
  {
    id: 'po-dep-13', teamId: T.polis, categorie: 'Overig intern',
    titel: 'Onduidelijk wie eigenaar is van batchverwerking',
    toelichting: 'Het is niet formeel belegd wie verantwoordelijk is voor de nachtelijke mutatiebatch richting Stark Industries.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-mutatie'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 170, bijgewerkt: 95,
  },
  {
    id: 'po-dep-14', teamId: T.polis, categorie: 'Overig intern',
    titel: 'Nog te beoordelen: nieuwe fraudecheck-koppeling',
    toelichting: 'Stark Industries wil de fraudecheck-service ook op polismutaties laten draaien; impact nog niet beoordeeld.',
    impact: 'klein', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: null, effectOpFlow: '',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 12, bijgewerkt: 12,
  },
  {
    id: 'po-dep-15', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'Archiefservice zonder actief onderhoudsplan',
    toelichting: 'De archiefservice draait stabiel maar heeft geen eigenaar meer voor structureel onderhoud.',
    impact: 'klein', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-archief'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid', geaccepteerd: true,
    aangemaakt: 450, bijgewerkt: 130,
  },
  {
    id: 'po-dep-16', teamId: T.polis, categorie: 'Data-afhankelijkheid',
    titel: 'Klantgegevens in portaal liepen achter op BRP-synchronisatie',
    toelichting: 'Adreswijzigingen uit de BRP waren pas de volgende dag zichtbaar in het klantportaal.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-klantportaal'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Synchronisatie van dagelijks naar elk uur gezet.',
    aangemaakt: 330, bijgewerkt: 60, heropend: { gesloten: 200, heropend: 70 },
  },
  {
    id: 'po-dep-17', teamId: T.polis, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Handmatige controle documentservice bij elke mutatie',
    toelichting: 'Elk gegenereerd document wordt door beheer gecontroleerd voordat het naar het archief mag.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-document', 'po-app-mutatie'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 210, bijgewerkt: 15,
  },
  {
    id: 'po-dep-18', teamId: T.polis, categorie: 'Rol-afhankelijkheid',
    titel: 'Release-coördinator ook verantwoordelijk voor nazorg',
    toelichting: 'In de week na een release is de release-coördinator niet beschikbaar voor de volgende releasevoorbereiding.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'beheer_nazorg', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 100, bijgewerkt: 20,
  },
  {
    id: 'po-dep-19', teamId: T.polis, categorie: 'Kennis-concentratie',
    titel: 'Alleen de architect kent de gateway-routeringsregels',
    toelichting: 'Nieuwe routes op de integratie gateway worden altijd door de architect zelf ingericht.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-gateway'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid', geaccepteerd: true,
    aangemaakt: 500, bijgewerkt: 300,
  },
  {
    id: 'po-dep-20', teamId: T.polis, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring premiemodel-wijziging',
    toelichting: 'Het nieuwe premiemodel moet als hoog-risico-change door het CAB; de behandeling bepaalt of het novembervenster haalbaar is.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'CAB-behandeling in de vergadering vóór het novembervenster', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 120, bijgewerkt: 7,
  },
  {
    id: 'po-dep-21', teamId: T.polis, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB vraagt een impactanalyse bij elke gateway-wijziging',
    toelichting: 'Ook een nieuwe route op de gateway vraagt een schriftelijke impactanalyse voor het CAB.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-gateway'], effectOpFlow: 'extra_afstemming',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 280, bijgewerkt: 80,
  },
  {
    id: 'po-dep-22', teamId: T.polis, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-vensters vallen samen met de drukste polisperiode',
    toelichting: 'Het CAB plant zijn vensters zonder rekening te houden met de jaarovergang van premies.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'release_overdracht', effectOpFlow: 'vertraging',
    wachttijd: 'sprint_of_meer', deadline: 'harde_deadline', deadlineTekst: 'Jaarovergang premies: 31 december', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 90, bijgewerkt: 3,
  },
  {
    id: 'po-dep-23', teamId: T.polis, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'IAM-autorisatie voor beheerrechten polisadministratie',
    toelichting: 'Beheerrechten op de polisadministratie worden per persoon door IAM-beheer toegekend, met weken doorlooptijd.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-polis'], effectOpFlow: 'wachten',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    actieAfspraak: 'Rollenprofiel polisbeheer vastgelegd; aanvraag via het standaardformulier.',
    ...partij('party-iam'), aangemaakt: 360, bijgewerkt: 22,
  },
  {
    id: 'po-dep-24', teamId: T.polis, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Technisch applicatiebeheer voert databasewijzigingen alleen in het weekend uit',
    toelichting: 'Schemawijzigingen op de polisdatabase worden door TAB uitsluitend in het weekendvenster uitgevoerd.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-polis'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    ...partij('party-techbeheer'), aangemaakt: 240, bijgewerkt: 35,
  },
  {
    id: 'po-dep-25', teamId: T.polis, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Ketentestomgeving wordt maar eens per maand ververst',
    toelichting: 'Omgevingenbeheer ververst de ketentestomgeving maandelijks; tussentijdse polisreleases zijn dan niet te testen.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    ...partij('party-omgevingen'), aangemaakt: 200, bijgewerkt: 70,
  },
  {
    id: 'po-dep-26', teamId: T.polis, scope: 'extern', categorie: 'Data-afhankelijkheid',
    titel: 'Inkomensgegevens Belastingdienst komen met twee weken vertraging',
    toelichting: 'De maandelijkse inkomenslevering loopt structureel twee weken achter; premievaststellingen wachten daarop.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-polis'], effectOpFlow: 'wachten',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-belastingdienst'), aangemaakt: 430, bijgewerkt: 140,
  },
  {
    id: 'po-dep-27', teamId: T.polis, scope: 'extern', categorie: 'Contract-/inkoopafhankelijkheid',
    titel: 'Leverancier legacy polissysteem levert geen patches meer',
    toelichting: 'De oorspronkelijke leverancier van de poliskern ondersteunt de versie niet meer; beveiligingsissues blijven open.',
    impact: 'zwaar', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-polis'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'vaste_datum', deadlineTekst: 'Ondersteuning stopt definitief per 30 juni', oplosbaarheid: 'organisatorisch',
    ...partij('party-legacyleverancier'), aangemaakt: 160, bijgewerkt: 10,
  },
  {
    id: 'po-dep-28', teamId: T.polis, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Stakeholder-akkoord nieuwe polisvoorwaarden',
    toelichting: 'De business opdrachtgever moet de nieuwe voorwaarden formeel goedkeuren voordat het team mag bouwen.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    ...partij('party-business-verzekeringen'), aangemaakt: 50, bijgewerkt: 14,
  },
  {
    id: 'po-dep-29', teamId: T.polis, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'API-toegang klantdata afhankelijk van Team S.H.I.E.L.D.',
    toelichting: 'Elke nieuwe koppeling van klantportaal of gateway vraagt configuratie op het platform van S.H.I.E.L.D..',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-gateway', 'po-app-klantportaal'], effectOpFlow: 'blokkade',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 330, bijgewerkt: 33,
  },
  {
    id: 'po-dep-30', teamId: T.polis, scope: 'extern', categorie: 'Kennis-afhankelijkheid extern',
    titel: 'Rapportagevalidatie afhankelijk van kennis bij Daily Bugle',
    toelichting: 'Alleen Daily Bugle kan controleren of polisrapportages kloppen; Wakanda kan de acceptatie niet zelf afronden.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'extra_afstemming',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Daily Bugle'), aangemaakt: 140, bijgewerkt: 28,
  },
  {
    id: 'po-dep-31', teamId: T.polis, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-review verplicht bij wijziging klantportaal',
    toelichting: 'Het klantportaal is internetgericht; Security Office reviewt elke release.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-klantportaal'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-security'), aangemaakt: 220, bijgewerkt: 61,
  },
  {
    id: 'po-dep-32', teamId: T.polis, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Wijziging pensioenwetgeving raakt premieberekening',
    toelichting: 'Nieuwe wetgeving verandert de grondslag van de premieberekening; de definitieve regeling is nog niet gepubliceerd.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-premie'], effectOpFlow: 'niet_startklaar',
    wachttijd: 'geen', deadline: 'harde_deadline', deadlineTekst: 'Wettelijke ingangsdatum 1 juli', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 70, bijgewerkt: 2,
  },
  {
    id: 'po-dep-33', teamId: T.polis, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'SSD-aanvraag database-uitbreiding polisadministratie wacht op capaciteit',
    toelichting: 'De polisdatabase loopt tegen de opslaggrens; de SSD-aanvraag is ingediend maar nog niet ingepland.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-polis'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'interne_afspraak', oplosbaarheid: 'organisatorisch',
    ...partij('party-ssd'), aangemaakt: 40, bijgewerkt: 1,
  },
  {
    id: 'po-dep-34', teamId: T.polis, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Leesrechten archiefservice voor Daily Bugle liepen via IAM',
    toelichting: 'Elke BI-medewerker moest apart leesrechten op het archief aanvragen.',
    impact: 'klein', frequentie: 'soms', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-archief'], effectOpFlow: 'wachten',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Standaard leesrol aangemaakt.', geaccepteerd: true,
    ...partij('party-iam'), aangemaakt: 600, bijgewerkt: 400,
  },
]

// ============================================================
// Team Avengers — aanvraag- en claimbeoordeling: besluitvorming, stakeholders
// ============================================================
const DEPS_SUPERHEROES = [
  {
    id: 'sh-dep-01', teamId: T.superheroes, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Beslissing over grensgevallen wacht op het wekelijkse beoordelaarsoverleg',
    toelichting: 'Aanvragen die buiten het regelkader vallen worden pas in het wekelijkse overleg besloten.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-beoordeel'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 200, bijgewerkt: 18,
  },
  {
    id: 'sh-dep-02', teamId: T.superheroes, categorie: 'Kennis-concentratie',
    titel: 'Regelconfiguratie van de regelmotor kent maar één developer',
    toelichting: 'De vertaling van beleid naar regels in de regelmotor wordt door één developer gedaan.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-regels'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Tweede developer ingewerkt op regelconfiguratie vóór eind Q4.',
    aangemaakt: 350, bijgewerkt: 21,
  },
  {
    id: 'sh-dep-03', teamId: T.superheroes, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Dossierviewer toont oude versie bij gelijktijdige mutatie',
    toelichting: 'Als Wakanda het dossier muteert tijdens de beoordeling, ziet de beoordelaar de oude versie.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-dossier'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 95, bijgewerkt: 30,
  },
  {
    id: 'sh-dep-04', teamId: T.superheroes, categorie: 'Rol-afhankelijkheid',
    titel: 'Tekenbevoegdheid ligt bij drie senior beoordelaars',
    toelichting: 'Alleen de drie senior beoordelaars mogen beschikkingen tekenen; bij vakanties loopt de doorlooptijd op.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 480, bijgewerkt: 160,
  },
  {
    id: 'sh-dep-05', teamId: T.superheroes, categorie: 'Technische afhankelijkheid',
    titel: 'Beoordelingsapplicatie en dossierviewer delen één database',
    toelichting: 'Een zware dossierquery vertraagt de beoordelingsapplicatie voor alle gebruikers.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-beoordeel', 'sh-app-dossier'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 260, bijgewerkt: 110,
  },
  {
    id: 'sh-dep-06', teamId: T.superheroes, scope: 'extern', categorie: 'Data-afhankelijkheid',
    titel: 'Incomplete aanvraagdossiers uit Wakanda kosten dubbele beoordelingstijd',
    toelichting: 'Een op de vijf dossiers komt zonder inkomensgegevens binnen en gaat terug naar Wakanda.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-dossier'], effectOpFlow: 'herwerk',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teams',
    actieAfspraak: 'Definitie van een compleet dossier is met Wakanda vastgelegd.',
    ...team('Team Wakanda'), aangemaakt: 130, bijgewerkt: 6,
  },
  {
    id: 'sh-dep-07', teamId: T.superheroes, categorie: 'Overig intern',
    titel: 'Beoordelingskader stond in drie verschillende documenten',
    toelichting: 'Beoordelaars gebruikten verschillende versies van het kader.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'gemitigeerd',
    workflowStap: 'analyse_refinement', effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Eén beoordelingskader op de wiki; oude documenten gearchiveerd.',
    aangemaakt: 300, bijgewerkt: 90,
  },
  {
    id: 'sh-dep-08', teamId: T.superheroes, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Regelmotor-testomgeving loopt twee releases achter',
    toelichting: 'Nieuwe regels kunnen niet tegen de actuele regelset getest worden.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 110, bijgewerkt: 40,
  },
  {
    id: 'sh-dep-09', teamId: T.superheroes, scope: 'extern', categorie: 'Contract-/inkoopafhankelijkheid',
    titel: 'Leverancier regelmotor levert regelreleases later dan afgesproken',
    toelichting: 'De contractuele leverdatum van regelreleases wordt structureel overschreden; beleidswijzigingen wachten daarop.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-regels'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Regelrelease Q4 uiterlijk 15 november', oplosbaarheid: 'organisatorisch',
    actieAfspraak: 'Escalatie via Inkoop; de boeteclausule wordt toegepast.', dedupGroupId: 'dedup-regelmotor',
    ...partij('party-regelmotor'), aangemaakt: 180, bijgewerkt: 5,
  },
  {
    id: 'sh-dep-10', teamId: T.superheroes, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring vereist voor elke wijziging in het beoordelingskader',
    toelichting: 'Ook beleidsmatige regelwijzigingen zonder technische impact gaan langs het CAB.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 240, bijgewerkt: 75,
  },
  {
    id: 'sh-dep-11', teamId: T.superheroes, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Autorisatie beoordelaarsrol via IAM duurt bij elke nieuwe collega weken',
    toelichting: 'Nieuwe beoordelaars kunnen weken niet zelfstandig werken omdat de rol via IAM-beheer loopt.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-beoordeel'], effectOpFlow: 'niet_startklaar',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-iam'), aangemaakt: 270, bijgewerkt: 12,
  },
  {
    id: 'sh-dep-12', teamId: T.superheroes, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Beleidswijzigingen komen zonder overgangstermijn binnen',
    toelichting: 'De business opdrachtgever kondigt nieuw beleid aan met ingang van dezelfde week.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-business-verzekeringen'), aangemaakt: 150, bijgewerkt: 50,
  },
  {
    id: 'sh-dep-13', teamId: T.superheroes, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'API-toegang tot klantdata loopt via S.H.I.E.L.D.',
    toelichting: 'De beoordelingsapplicatie haalt klantdata via de API-gateway van S.H.I.E.L.D.; nieuwe velden vragen daar configuratie.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-beoordeel'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 200, bijgewerkt: 60,
  },
  {
    id: 'sh-dep-14', teamId: T.superheroes, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Nieuwe motiveringsplicht bij afwijzingen',
    toelichting: 'Elke afwijzing moet vanaf de ingangsdatum een uitgebreide motivering bevatten; de applicatie kent dat veld nog niet.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-beoordeel'], effectOpFlow: 'niet_startklaar',
    wachttijd: 'geen', deadline: 'harde_deadline', deadlineTekst: 'Ingangsdatum 1 januari', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 55, bijgewerkt: 3,
  },
  {
    id: 'sh-dep-15', teamId: T.superheroes, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Technisch applicatiebeheer beheert de regelmotor-server buiten het team',
    toelichting: 'Herstarts en patches van de regelmotor-server lopen via TAB.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-regels'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend', geaccepteerd: true,
    ...partij('party-techbeheer'), aangemaakt: 320, bijgewerkt: 150,
  },
  {
    id: 'sh-dep-16', teamId: T.superheroes, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-review regelmotorkoppeling vóór productie',
    toelichting: 'De nieuwe koppeling met de regelmotor moet eenmalig door Security Office worden gereviewd.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'organisatorisch',
    ...partij('party-security'), aangemaakt: 30, bijgewerkt: 4,
  },
  {
    id: 'sh-dep-17', teamId: T.superheroes, categorie: 'Kennis-concentratie',
    titel: 'Alleen de PO kent de historie van uitzonderingsregels',
    toelichting: 'Waarom bepaalde uitzonderingen ooit zijn ingevoerd, weet alleen de product owner.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 410, bijgewerkt: 200,
  },
  {
    id: 'sh-dep-18', teamId: T.superheroes, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Doorlooptijdnorm van acht weken wordt niet gemonitord in de applicatie',
    toelichting: 'De norm wordt handmatig in een spreadsheet bijgehouden; overschrijdingen vallen pas achteraf op.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-beoordeel'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'interne_afspraak', oplosbaarheid: 'teamlid',
    actieAfspraak: 'Dashboard doorlooptijd wordt door Daily Bugle opgeleverd.',
    aangemaakt: 60, bijgewerkt: 9,
  },
]

// ============================================================
// Team Stark Industries — betaalverwerking & uitkeringen: zwaarste risico's, 3× CAB
// ============================================================
const DEPS_CASIO = [
  {
    id: 'ca-dep-01', teamId: T.casio, categorie: 'Kennis-concentratie',
    titel: 'Betaalengine-kern begrepen door twee developers',
    toelichting: 'De betaalengine is in tien jaar gegroeid; alleen twee senior developers durven de kern aan te passen.',
    impact: 'zwaar', frequentie: 'structureel', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Kennisoverdracht ingepland; derde developer start in Q4.',
    aangemaakt: 600, bijgewerkt: 8,
  },
  {
    id: 'ca-dep-02', teamId: T.casio, categorie: 'Technische afhankelijkheid',
    titel: 'Nachtelijke batch heeft geen automatische herstart',
    toelichting: 'Als de batch om 23:00 uur faalt, ontdekt het team dat pas de volgende ochtend en zijn uitkeringen een dag te laat.',
    impact: 'zwaar', frequentie: 'structureel', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-batch'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Herstartmechanisme in het decembervenster', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 250, bijgewerkt: 2,
  },
  {
    id: 'ca-dep-03', teamId: T.casio, categorie: 'Kennis-concentratie',
    titel: 'Legacy kennis nodig voor regelservice',
    toelichting: 'De regellogica van de uitkeringsservice stamt uit het oude systeem en is nauwelijks gedocumenteerd.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-regel'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Architect legt regellogica stapsgewijs vast in documentatie.',
    aangemaakt: 500, bijgewerkt: 120,
  },
  {
    id: 'ca-dep-04', teamId: T.casio, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Handmatige vrijgave van betaalbestanden buiten kantooruren',
    toelichting: 'Betaalbestanden na 17:00 uur worden pas de volgende ochtend handmatig vrijgegeven.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 180, bijgewerkt: 25,
  },
  {
    id: 'ca-dep-05', teamId: T.casio, categorie: 'Rol-afhankelijkheid',
    titel: 'Security officer moet elke hardening-check aftekenen',
    toelichting: 'Zonder handtekening van de security officer mag geen release van de betaalketen door.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 230, bijgewerkt: 50,
  },
  {
    id: 'ca-dep-06', teamId: T.casio, categorie: 'Technische afhankelijkheid',
    titel: 'Uitkeringsservice gebruikt verouderde bibliotheek voor PDF-beschikkingen',
    toelichting: 'De PDF-bibliotheek krijgt geen updates meer; vervanging is niet ingepland.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-uitkering'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 420, bijgewerkt: 200,
  },
  {
    id: 'ca-dep-07', teamId: T.casio, categorie: 'Data-afhankelijkheid',
    titel: 'Retourboekingen van de bank worden handmatig gematcht',
    toelichting: 'Retourberichten van de bank hebben geen betalingskenmerk; beheer matcht ze met de hand in de batchverwerker.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal', 'ca-app-batch'], effectOpFlow: 'herwerk',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 140, bijgewerkt: 14,
  },
  {
    id: 'ca-dep-08', teamId: T.casio, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Geen representatieve bankomgeving voor ketentest',
    toelichting: 'De banksimulator in de testomgeving kent geen retourboekingen; die scenario’s zijn alleen in productie te zien.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 330, bijgewerkt: 100,
  },
  {
    id: 'ca-dep-09', teamId: T.casio, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Prioritering tussen fraudecheck-pilot en batchstabiliteit niet belegd',
    toelichting: 'De pilot en het stabiliteitswerk trekken aan dezelfde developers; niemand beslist wat voorgaat.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'extra_afstemming',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 70, bijgewerkt: 20,
  },
  {
    id: 'ca-dep-10', teamId: T.casio, categorie: 'Overig intern',
    titel: 'Onboarding op de betaalketen duurt drie maanden',
    toelichting: 'Nieuwe developers zijn pas na een kwartaal zelfstandig inzetbaar op de betaalketen.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    effectOpFlow: 'contextswitch',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden', geaccepteerd: true,
    aangemaakt: 380, bijgewerkt: 150,
  },
  {
    id: 'ca-dep-11', teamId: T.casio, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Loonaangifte vroeg handmatige controle vóór verzending',
    toelichting: 'Elke maandelijkse loonaangifte werd regel voor regel nagelopen.',
    impact: 'beperkt', frequentie: 'structureel', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-loon'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Geautomatiseerde plausibiliteitscheck toegevoegd.',
    aangemaakt: 290, bijgewerkt: 45,
  },
  {
    id: 'ca-dep-12', teamId: T.casio, categorie: 'Technische afhankelijkheid',
    titel: 'Regelservice en fraudecheck delen dezelfde regelset zonder versiebeheer',
    toelichting: 'Een regelwijziging voor de fraudecheck-pilot kan onbedoeld de uitkeringsregels raken.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-regel'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 45, bijgewerkt: 11,
  },
  {
    id: 'ca-dep-13', teamId: T.casio, categorie: 'Kennis-concentratie',
    titel: 'Alleen de beheerder kent de batchplanning van het jaareinde',
    toelichting: 'De speciale batchvolgorde rond de jaarovergang staat nergens beschreven.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-batch'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'harde_deadline', deadlineTekst: 'Jaareindebatch 31 december', oplosbaarheid: 'teamlid',
    aangemaakt: 100, bijgewerkt: 30,
  },
  {
    id: 'ca-dep-14', teamId: T.casio, scope: 'extern', categorie: 'Contract-/inkoopafhankelijkheid',
    titel: 'Leverancier regelmotor levert regelreleases later dan afgesproken',
    toelichting: 'De regelservice gebruikt dezelfde ingekochte regelmotor als de beoordeling; late releases raken ook de uitkeringsregels.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-regel'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Regelrelease Q4 uiterlijk 15 november', oplosbaarheid: 'organisatorisch',
    dedupGroupId: 'dedup-regelmotor',
    ...partij('party-regelmotor'), aangemaakt: 180, bijgewerkt: 5,
  },
  {
    id: 'ca-dep-15', teamId: T.casio, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring uitkeringsregels',
    toelichting: 'Elke wijziging in uitkeringsregels is een hoog-risico-change voor het CAB.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 300, bijgewerkt: 66,
  },
  {
    id: 'ca-dep-16', teamId: T.casio, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB eist rollback-plan bij elke batchwijziging',
    toelichting: 'Voor batchwijzigingen moet een uitgewerkt rollback-plan worden aangeleverd, ook bij kleine aanpassingen.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-batch'], effectOpFlow: 'extra_afstemming',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 210, bijgewerkt: 88,
  },
  {
    id: 'ca-dep-17', teamId: T.casio, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-venster valt in de uitbetaalweek',
    toelichting: 'Het maandelijkse CAB-venster valt precies in de week waarin uitkeringen worden uitbetaald; releases schuiven daardoor een maand.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'release_overdracht', effectOpFlow: 'vertraging',
    wachttijd: 'sprint_of_meer', deadline: 'harde_deadline', deadlineTekst: 'Uitbetaling altijd op de 23e van de maand', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 150, bijgewerkt: 1,
  },
  {
    id: 'ca-dep-18', teamId: T.casio, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Productierechten betaalengine alleen via IAM-noodprocedure',
    toelichting: 'Bij een productie-incident moet eerst een noodaccount via IAM-beheer worden aangevraagd.',
    impact: 'zwaar', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-iam'), aangemaakt: 260, bijgewerkt: 40,
  },
  {
    id: 'ca-dep-19', teamId: T.casio, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'Bankkoppeling wisselt jaarlijks van certificaat zonder vaste aankondiging',
    toelichting: 'De bank vernieuwt het koppelingscertificaat jaarlijks; de aankondiging komt soms pas een week vooraf.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Certificaat verloopt 30 september', oplosbaarheid: 'organisatorisch',
    ...partij('party-bank'), aangemaakt: 320, bijgewerkt: 15,
  },
  {
    id: 'ca-dep-20', teamId: T.casio, scope: 'extern', categorie: 'Data-afhankelijkheid',
    titel: 'Loonaangiftespecificaties Belastingdienst wijzigen jaarlijks',
    toelichting: 'De specificatie van de loonaangifte verandert elk jaar; de koppeling moet mee.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-loon'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'harde_deadline', deadlineTekst: 'Nieuwe specificatie geldt vanaf 1 januari', oplosbaarheid: 'organisatorisch',
    ...partij('party-belastingdienst'), aangemaakt: 200, bijgewerkt: 60,
  },
  {
    id: 'ca-dep-21', teamId: T.casio, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'Toegang tot claimdata via de gateway van S.H.I.E.L.D.',
    toelichting: 'Uitkeringsservice en regelservice halen claimdata via de API-gateway; nieuwe velden vragen configuratie bij S.H.I.E.L.D..',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-uitkering', 'ca-app-regel'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 340, bijgewerkt: 34,
  },
  {
    id: 'ca-dep-22', teamId: T.casio, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Correctiesignalen van Daily Bugle komen zonder prioriteit binnen',
    toelichting: 'De wekelijkse correctielijst maakt geen onderscheid tussen spoed en regulier.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-uitkering'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Daily Bugle'), aangemaakt: 80, bijgewerkt: 16,
  },
  {
    id: 'ca-dep-23', teamId: T.casio, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Technisch applicatiebeheer is de enige die de batch mag herstarten',
    toelichting: 'Een herstart van de batchverwerker mag alleen door TAB worden uitgevoerd, ook in de uitbetaalweek.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-batch'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    ...partij('party-techbeheer'), aangemaakt: 270, bijgewerkt: 24,
  },
  {
    id: 'ca-dep-24', teamId: T.casio, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Acceptatieomgeving betaalketen wordt maandelijks overschreven',
    toelichting: 'Omgevingenbeheer ververst de acceptatieomgeving elke maand; lopende acceptatietests gaan verloren.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    ...partij('party-omgevingen'), aangemaakt: 190, bijgewerkt: 95,
  },
  {
    id: 'ca-dep-25', teamId: T.casio, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security Office eist penetratietest vóór elke betaalengine-release',
    toelichting: 'Een externe penetratietest kost drie tot vier weken doorlooptijd per release.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-security'), aangemaakt: 230, bijgewerkt: 130,
  },
  {
    id: 'ca-dep-26', teamId: T.casio, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'SSD-aanvraag extra rekencapaciteit jaareindebatch',
    toelichting: 'De jaareindebatch heeft tijdelijk extra servers nodig; de aanvraag ligt bij het SSD-loket.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-batch'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'harde_deadline', deadlineTekst: 'Jaareindebatch 31 december', oplosbaarheid: 'organisatorisch',
    ...partij('party-ssd'), aangemaakt: 25, bijgewerkt: 1,
  },
  {
    id: 'ca-dep-27', teamId: T.casio, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Nieuwe beslagvrije-voet-regels raken de uitkeringsberekening',
    toelichting: 'De berekening van de beslagvrije voet verandert; uitkeringsservice en regelservice moeten beide worden aangepast.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-uitkering', 'ca-app-regel'], effectOpFlow: 'niet_startklaar',
    wachttijd: 'geen', deadline: 'harde_deadline', deadlineTekst: 'Ingangsdatum 1 januari', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 60, bijgewerkt: 3,
  },
  {
    id: 'ca-dep-28', teamId: T.casio, categorie: 'Technische afhankelijkheid',
    titel: 'Fraudecheck-pilot leest productiedata zonder anonimisering',
    toelichting: 'De pilot draait op een kopie van productiedata; privacy-toets is nog niet gedaan.',
    impact: 'duidelijk', frequentie: 'soms', status: 'actief blokkerend',
    workflowStap: 'ontwikkeling_configuratie', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teams',
    actieAfspraak: 'Privacy-team beoordeelt de pilotopzet; tot die tijd geen productiedata.',
    aangemaakt: 20, bijgewerkt: 2,
  },
  {
    id: 'ca-dep-29', teamId: T.casio, categorie: 'Overig intern',
    titel: 'Nog te beoordelen: real-time betalen (instant payments)',
    toelichting: 'De bank biedt instant payments aan; impact op batch en betaalengine nog niet beoordeeld.',
    impact: 'klein', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: null, effectOpFlow: '',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 9, bijgewerkt: 9,
  },
  {
    id: 'ca-dep-30', teamId: T.casio, categorie: 'Rol-afhankelijkheid',
    titel: 'Tester is ook release-coördinator in de uitbetaalweek',
    toelichting: 'In de uitbetaalweek coördineert de tester de release en blijft het testwerk liggen.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden', geaccepteerd: true,
    aangemaakt: 160, bijgewerkt: 100,
  },
  {
    id: 'ca-dep-31', teamId: T.casio, categorie: 'Technische afhankelijkheid',
    titel: 'Betaalengine draait op één server zonder failover',
    toelichting: 'Bij uitval van de server staat de hele uitbetaling stil tot technisch beheer een nieuwe server heeft ingericht.',
    impact: 'zwaar', frequentie: 'structureel', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Failover in het decembervenster', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 400, bijgewerkt: 12,
  },
]

// ============================================================
// Team Daily Bugle — rapportage & BI: veel externe bestemmingen
// ============================================================
const DEPS_SV = [
  {
    id: 'sv-dep-01', teamId: T.sv, categorie: 'Kennis-concentratie',
    titel: 'Laadprocessen datawarehouse kent maar één data-engineer',
    toelichting: 'Alle laadprocessen zijn door dezelfde data-engineer gebouwd; niemand anders kan ze herstellen.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'BI-specialist draait mee met alle laadwijzigingen.',
    aangemaakt: 450, bijgewerkt: 19,
  },
  {
    id: 'sv-dep-02', teamId: T.sv, categorie: 'Data-afhankelijkheid',
    titel: 'Brondata nachtelijke batch komt onregelmatig binnen',
    toelichting: 'De bronbestanden zijn soms pas na 07:00 uur beschikbaar, waardoor dashboards de eerste uren leeg zijn.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 200, bijgewerkt: 15,
  },
  {
    id: 'sv-dep-03', teamId: T.sv, categorie: 'Technische afhankelijkheid',
    titel: 'Dashboardservice valt uit bij meer dan tweehonderd gelijktijdige gebruikers',
    toelichting: 'Op de eerste werkdag van de maand raakt de dashboardservice overbelast.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dashboard'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 130, bijgewerkt: 40,
  },
  {
    id: 'sv-dep-04', teamId: T.sv, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Rapportagedefinities wijzigen zonder versiebeheer',
    toelichting: 'Definities van kengetallen worden direct in de rapportagegenerator aangepast, zonder spoor van wie wat wijzigde.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-rapport'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 260, bijgewerkt: 80,
  },
  {
    id: 'sv-dep-05', teamId: T.sv, categorie: 'Rol-afhankelijkheid',
    titel: 'Product Owner keurde elk dashboard persoonlijk goed',
    toelichting: 'Zonder persoonlijke goedkeuring van de PO ging geen dashboard live.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'gemitigeerd',
    workflowStap: 'acceptatie', effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Acceptatiecriteria per dashboardtype vastgelegd.',
    aangemaakt: 300, bijgewerkt: 60,
  },
  {
    id: 'sv-dep-06', teamId: T.sv, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Testomgeving datawarehouse bevat geen recente data',
    toelichting: 'De testomgeving is voor het laatst een half jaar geleden gevuld.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 170, bijgewerkt: 55,
  },
  {
    id: 'sv-dep-07', teamId: T.sv, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Definitie van een afgehandelde uitkering verschilt per rapport',
    toelichting: 'Drie rapportages hanteren drie definities; niemand heeft het mandaat er één te kiezen.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 90, bijgewerkt: 12,
  },
  {
    id: 'sv-dep-08', teamId: T.sv, categorie: 'Overig intern',
    titel: 'Kennisoverdracht BI-tooling gebeurt ad hoc',
    toelichting: 'Nieuwe BI-specialisten leren de tooling van collega’s, zonder vast programma.',
    impact: 'klein', frequentie: 'soms', status: 'bekend risico',
    effectOpFlow: 'contextswitch',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid', geaccepteerd: true,
    aangemaakt: 500, bijgewerkt: 300,
  },
  {
    id: 'sv-dep-09', teamId: T.sv, categorie: 'Technische afhankelijkheid',
    titel: 'Datakwaliteitsmonitor draait op een niet-onderhouden script',
    toelichting: 'De monitor is een script van een vertrokken collega; het werkt, maar niemand durft het aan te passen.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-kwaliteit'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 350, bijgewerkt: 210,
  },
  {
    id: 'sv-dep-10', teamId: T.sv, scope: 'extern', categorie: 'Kennis-afhankelijkheid extern',
    titel: 'Betaalstatusdefinities alleen bekend bij Stark Industries',
    toelichting: 'Wat een statuscode in het betaalstatusbericht precies betekent, weet alleen Stark Industries; rapportages worden daarop nagevraagd.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'extra_afstemming',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Stark Industries'), aangemaakt: 220, bijgewerkt: 30,
  },
  {
    id: 'sv-dep-11', teamId: T.sv, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Extern data- en rapportageteam levert bronaansluitingen op',
    toelichting: 'Nieuwe bronaansluitingen op het datawarehouse worden door een extern team gebouwd; de polisdata-aansluiting is al twee sprints over tijd.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'wachten',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Bronaansluiting polisdata vóór de kwartaalrapportage', oplosbaarheid: 'organisatorisch',
    ...partij('party-datateam'), aangemaakt: 120, bijgewerkt: 4,
  },
  {
    id: 'sv-dep-12', teamId: T.sv, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Datamodelwijzigingen wachten op het externe datateam',
    toelichting: 'Elke wijziging in het datamodel wordt door het externe team beoordeeld en doorgevoerd.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh', 'sv-app-rapport'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-datateam'), aangemaakt: 240, bijgewerkt: 70,
  },
  {
    id: 'sv-dep-13', teamId: T.sv, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring dashboardmigratie',
    toelichting: 'De migratie naar de nieuwe dashboardservice is als change bij het CAB ingediend.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Migratie in het oktobervenster', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 60, bijgewerkt: 10,
  },
  {
    id: 'sv-dep-14', teamId: T.sv, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Leesrechten op polis- en betaaldata via IAM per bron apart',
    toelichting: 'Voor elke nieuwe bron moet per BI-medewerker apart een leesrol via IAM-beheer worden aangevraagd.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'wachten',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-iam'), aangemaakt: 310, bijgewerkt: 44,
  },
  {
    id: 'sv-dep-15', teamId: T.sv, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Toezichtrapportage-eisen wijzigen per kwartaal',
    toelichting: 'De toezichthouder past het rapportageformat bijna elk kwartaal aan; de generator moet steeds mee.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-rapport'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'harde_deadline', deadlineTekst: 'Kwartaalrapportage uiterlijk de 15e na kwartaaleinde', oplosbaarheid: 'organisatorisch',
    ...partij('party-toezicht'), aangemaakt: 400, bijgewerkt: 20,
  },
  {
    id: 'sv-dep-16', teamId: T.sv, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Directie vraagt ad-hoc dashboards buiten de planning',
    toelichting: 'Ad-hoc verzoeken van de directie gaan altijd voor en verstoren de sprintplanning.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-directie'), aangemaakt: 150, bijgewerkt: 35,
  },
  {
    id: 'sv-dep-17', teamId: T.sv, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Rapportageomgeving deelt rekencapaciteit met de ketentest',
    toelichting: 'Tijdens de ketentest van Nova Corps vertragen de rapportages merkbaar.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-rapport'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend', geaccepteerd: true,
    ...partij('party-omgevingen'), aangemaakt: 280, bijgewerkt: 140,
  },
  {
    id: 'sv-dep-18', teamId: T.sv, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'API-toegang bronsystemen via de gateway van S.H.I.E.L.D.',
    toelichting: 'Alle bronsystemen worden via de API-gateway ontsloten; een nieuwe bron vraagt eerst een client-id bij S.H.I.E.L.D..',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 330, bijgewerkt: 90,
  },
  {
    id: 'sv-dep-19', teamId: T.sv, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Bewaartermijn rapportagedata wordt verkort',
    toelichting: 'Historische rapportagedata mag straks maximaal vijf jaar bewaard worden; het datawarehouse kent geen opschoning.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'vaste_datum', deadlineTekst: 'Opschoning gereed vóór 1 april', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 40, bijgewerkt: 6,
  },
  {
    id: 'sv-dep-20', teamId: T.sv, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-review datawarehouse-koppelingen',
    toelichting: 'Elke nieuwe bronkoppeling werd apart door Security Office gereviewd, met drie weken doorlooptijd.',
    impact: 'duidelijk', frequentie: 'soms', status: 'gemitigeerd',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Standaard reviewsjabloon afgestemd; doorlooptijd van drie naar één week.',
    ...partij('party-security'), aangemaakt: 260, bijgewerkt: 80,
  },
  {
    id: 'sv-dep-21', teamId: T.sv, categorie: 'Data-afhankelijkheid',
    titel: 'Correctiesignalen naar Stark Industries worden niet teruggekoppeld',
    toelichting: 'Het team hoort niet of Stark Industries de gesignaleerde afwijkingen heeft opgepakt; dezelfde signalen komen elke week terug.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-kwaliteit'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 50, bijgewerkt: 5,
  },
  {
    id: 'sv-dep-22', teamId: T.sv, categorie: 'Kennis-concentratie',
    titel: 'Alleen de BI-specialist kent de dashboardarchitectuur',
    toelichting: 'De opbouw van de dashboardservice is nergens beschreven.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dashboard'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 140, bijgewerkt: 100,
  },
  {
    id: 'sv-dep-23', teamId: T.sv, scope: 'extern', categorie: 'Overig extern',
    titel: 'Externe accountant vraagt jaarlijks een aparte controle-dataset',
    toelichting: 'De accountant wil elk jaar een eigen extract in een afwijkend formaat; dat kost het team een sprint.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-rapport'], effectOpFlow: 'anders',
    wachttijd: 'kort', deadline: 'vaste_datum', deadlineTekst: 'Controle-dataset gereed vóór 1 maart', oplosbaarheid: 'organisatorisch',
    ...partij('party-accountant'), aangemaakt: 330, bijgewerkt: 45,
  },
]

// ============================================================
// Team Asgard — platform & releasekalender: klein; uitgebreide analyse
// (wachttijd/deadline/oplosbaarheid) bewust nog NIET ingevuld
// ============================================================
const DEPS_EQUINOX = [
  {
    id: 'eq-dep-01', teamId: T.equinox, categorie: 'Kennis-concentratie',
    titel: 'Kennis platformkalender zit bij één persoon',
    toelichting: 'Alleen de product owner kent de volledige samenhang tussen release- en platformmomenten.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'vertraging',
    actieAfspraak: 'Product Owner deelt planningsoverzicht met de scrum master als achtervang.',
    aangemaakt: 420, bijgewerkt: 100,
  },
  {
    id: 'eq-dep-02', teamId: T.equinox, categorie: 'Technische afhankelijkheid',
    titel: 'Notificatieservice leunt op verouderde bibliotheek',
    toelichting: 'Een kernonderdeel van de notificatieservice gebruikt een niet meer onderhouden bibliotheek.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-notif'], effectOpFlow: 'anders',
    aangemaakt: 380, bijgewerkt: 160,
  },
  {
    id: 'eq-dep-03', teamId: T.equinox, categorie: 'Overig intern',
    titel: 'Onduidelijke backlogprioritering',
    toelichting: 'Prioritering verliep informeel, zonder vastgelegd afwegingskader.',
    impact: 'beperkt', frequentie: 'soms', status: 'gemitigeerd',
    workflowStap: 'analyse_refinement', effectOpFlow: 'onduidelijkheid',
    mitigatie: 'Vast backlogrefinement-ritme ingevoerd.',
    aangemaakt: 500, bijgewerkt: 200,
  },
  {
    id: 'eq-dep-04', teamId: T.equinox, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring releasekalender',
    toelichting: 'De kwartaalkalender wordt pas definitief na goedkeuring door het CAB; tot die tijd plannen teams onder voorbehoud.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    actieAfspraak: 'Kalender wordt een sprint eerder bij het CAB aangeleverd.',
    ...partij('party-cab'), aangemaakt: 300, bijgewerkt: 40,
  },
  {
    id: 'eq-dep-05', teamId: T.equinox, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Provisioning nieuwe omgevingen via extern infrateam',
    toelichting: 'Elke nieuwe omgeving wordt door het externe infrateam ingericht, met een doorlooptijd van weken.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: [], effectOpFlow: 'wachten',
    ...partij('party-infra'), aangemaakt: 260, bijgewerkt: 30,
  },
  {
    id: 'eq-dep-06', teamId: T.equinox, categorie: 'Kennis-concentratie',
    titel: 'Enige beheerder van de notificatiesjablonen',
    toelichting: 'De sjablonen voor platformnotificaties worden door één persoon onderhouden.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-notif'], effectOpFlow: 'wachten',
    aangemaakt: 200, bijgewerkt: 90,
  },
  {
    id: 'eq-dep-07', teamId: T.equinox, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Kalenderwijzigingen worden per e-mail rondgestuurd',
    toelichting: 'Naast de kalender-app gaan wijzigingen ook per e-mail rond; teams weten niet welke bron leidend is.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-kalender'], effectOpFlow: 'onduidelijkheid',
    aangemaakt: 150, bijgewerkt: 30,
  },
  {
    id: 'eq-dep-08', teamId: T.equinox, categorie: 'Rol-afhankelijkheid',
    titel: 'Platformbeheerder is junior en werkt alleen',
    toelichting: 'Het beheer van het platform ligt bij één junior beheerder zonder achtervang.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'beheer_nazorg', effectOpFlow: 'vertraging',
    aangemaakt: 120, bijgewerkt: 20,
  },
  {
    id: 'eq-dep-09', teamId: T.equinox, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Beheerrechten notificatieservice via IAM',
    toelichting: 'Beheerrechten op de notificatieservice worden per persoon door IAM-beheer toegekend.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-notif'], effectOpFlow: 'wachten',
    ...partij('party-iam'), aangemaakt: 220, bijgewerkt: 110,
  },
  {
    id: 'eq-dep-10', teamId: T.equinox, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Platformonderhoud omgevingenbeheer valt samen met releasevensters',
    toelichting: 'Omgevingenbeheer plant onderhoud zonder de releasekalender te raadplegen; twee vensters vielen dit jaar uit.',
    impact: 'zwaar', frequentie: 'soms', status: 'actief blokkerend',
    workflowStap: 'release_overdracht', effectOpFlow: 'blokkade',
    actieAfspraak: 'Onderhoudskalender en releasekalender worden samengevoegd.',
    ...partij('party-omgevingen'), aangemaakt: 90, bijgewerkt: 7,
  },
  {
    id: 'eq-dep-11', teamId: T.equinox, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'Monitoringsignalen van S.H.I.E.L.D. komen zonder context binnen',
    toelichting: 'De notificatieservice ontvangt platformalerts zonder aanduiding van het getroffen team.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-notif'], effectOpFlow: 'onduidelijkheid',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 110, bijgewerkt: 22,
  },
  {
    id: 'eq-dep-12', teamId: T.equinox, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Releasewensen van teams komen te laat voor de kalender',
    toelichting: 'Teams melden hun releasewensen vaak pas na het sluiten van de kwartaalplanning.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-kalender'], effectOpFlow: 'herwerk',
    aangemaakt: 200, bijgewerkt: 50,
  },
  {
    id: 'eq-dep-13', teamId: T.equinox, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Wet- en regelgevingsupdates komen zonder vaste cadans',
    toelichting: 'Updates vanuit het privacy- en complianceteam komen onaangekondigd en vragen soms een extra releasevenster.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'niet_startklaar',
    ...partij('party-privacy'), aangemaakt: 170, bijgewerkt: 60,
  },
  {
    id: 'eq-dep-14', teamId: T.equinox, categorie: 'Data-afhankelijkheid',
    titel: 'Kalenderdata en notificatiedata lopen uit elkaar',
    toelichting: 'Een kalenderwijziging leidt niet altijd tot een bijgewerkte notificatie.',
    impact: 'klein', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-kalender', 'eq-app-notif'], effectOpFlow: 'herwerk',
    aangemaakt: 80, bijgewerkt: 25,
  },
  {
    id: 'eq-dep-15', teamId: T.equinox, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-review bij elke wijziging aan de notificatieservice',
    toelichting: 'De notificatieservice verstuurt naar externe adressen; Security Office reviewt elke wijziging.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten', geaccepteerd: true,
    ...partij('party-security'), aangemaakt: 250, bijgewerkt: 120,
  },
  {
    id: 'eq-dep-16', teamId: T.equinox, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'SSD-aanvraag uitbreiding kalender-database',
    toelichting: 'De kalender-database heeft meer opslag nodig voor de historie; aanvraag ligt bij het SSD-loket.',
    impact: 'klein', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-kalender'], effectOpFlow: 'wachten',
    ...partij('party-ssd'), aangemaakt: 30, bijgewerkt: 5,
  },
  {
    id: 'eq-dep-17', teamId: T.equinox, categorie: 'Technische afhankelijkheid',
    titel: 'Geen automatische tests op de kalender-app',
    toelichting: 'Elke wijziging aan de kalender-app wordt handmatig getest.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'herwerk',
    aangemaakt: 140, bijgewerkt: 14,
  },
  {
    id: 'eq-dep-18', teamId: T.equinox, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Freeze-periode jaareinde wordt elk jaar opnieuw bediscussieerd',
    toelichting: 'Er is geen vast besluit over de releasefreeze rond de jaarovergang.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    effectOpFlow: 'extra_afstemming',
    aangemaakt: 60, bijgewerkt: 8,
  },
]

// ============================================================
// Team S.H.I.E.L.D. — IAM, platform, integraties: technisch, hub voor toegang
// ============================================================
const DEPS_SMURFEN = [
  {
    id: 'sm-dep-01', teamId: T.smurfen, categorie: 'Kennis-concentratie',
    titel: 'IAM-platform: enige architect met volledig overzicht',
    toelichting: 'Het rollenmodel, de koppelingen en de sleutelrotatie overziet alleen de architect.',
    impact: 'zwaar', frequentie: 'structureel', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-iam'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Architectuurdocumentatie in Q4; tweede architect gevraagd.',
    aangemaakt: 650, bijgewerkt: 10,
  },
  {
    id: 'sm-dep-02', teamId: T.smurfen, categorie: 'Technische afhankelijkheid',
    titel: 'Monitoringservice signaleert uitval logservice niet automatisch',
    toelichting: 'Als de logservice uitvalt, merkt de monitoring dat pas bij de volgende handmatige controle.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-monitoring', 'sm-app-log'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 150, bijgewerkt: 40,
  },
  {
    id: 'sm-dep-03', teamId: T.smurfen, categorie: 'Technische afhankelijkheid',
    titel: 'Secrets-vault sleutelrotatie is handmatig',
    toelichting: 'De sleutelrotatie elke negentig dagen wordt met de hand uitgevoerd en raakt alle IAM-koppelingen.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-secrets', 'sm-app-iam'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Eerstvolgende rotatie 1 december', oplosbaarheid: 'teamlid',
    aangemaakt: 200, bijgewerkt: 30,
  },
  {
    id: 'sm-dep-04', teamId: T.smurfen, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'CI/CD-pipeline had geen goedkeuringsstap voor productie',
    toelichting: 'Elke geslaagde build kon zonder tussenkomst naar productie.',
    impact: 'zwaar', frequentie: 'structureel', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-ci'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Handmatige goedkeuringsstap toegevoegd; automatisering volgt.',
    aangemaakt: 320, bijgewerkt: 25,
  },
  {
    id: 'sm-dep-05', teamId: T.smurfen, categorie: 'Rol-afhankelijkheid',
    titel: 'Enige technisch beheerder met productierechten',
    toelichting: 'Alleen de technisch beheerder mag wijzigingen op het productie-IAM doorvoeren.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'beheer_nazorg', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 480, bijgewerkt: 160,
  },
  {
    id: 'sm-dep-06', teamId: T.smurfen, categorie: 'Data-afhankelijkheid',
    titel: 'Logservice bewaart geen correlatie-id over ketens heen',
    toelichting: 'Een fout in de keten is niet van begin tot eind te volgen in de logs.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-log'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 260, bijgewerkt: 120,
  },
  {
    id: 'sm-dep-07', teamId: T.smurfen, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Geen aparte testomgeving voor het IAM-platform',
    toelichting: 'Wijzigingen aan het rollenmodel worden direct in acceptatie getest, met risico voor alle teams.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 370, bijgewerkt: 200,
  },
  {
    id: 'sm-dep-08', teamId: T.smurfen, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Prioriteit tussen platformwerk en teamverzoeken niet belegd',
    toelichting: 'Verzoeken van ketenteams en eigen platformwerk concurreren zonder afwegingskader.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 190, bijgewerkt: 15,
  },
  {
    id: 'sm-dep-09', teamId: T.smurfen, categorie: 'Overig intern',
    titel: 'Onboarding op het platform kost een kwartaal',
    toelichting: 'Nieuwe teamleden hebben een kwartaal nodig om zelfstandig op het platform te werken.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    effectOpFlow: 'contextswitch',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden', geaccepteerd: true,
    aangemaakt: 400, bijgewerkt: 180,
  },
  {
    id: 'sm-dep-10', teamId: T.smurfen, categorie: 'Technische afhankelijkheid',
    titel: 'API-gateway heeft geen rate limiting per team',
    toelichting: 'Eén team dat de gateway zwaar belast, vertraagt alle andere teams.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-api'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 100, bijgewerkt: 33,
  },
  {
    id: 'sm-dep-11', teamId: T.smurfen, categorie: 'Kennis-concentratie',
    titel: 'Pipelineconfiguratie kent maar één developer',
    toelichting: 'De CI/CD-configuratie voor alle teams wordt door één developer onderhouden.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-ci'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 300, bijgewerkt: 70,
  },
  {
    id: 'sm-dep-12', teamId: T.smurfen, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Configuratiewijzigingen gingen zonder review naar productie',
    toelichting: 'Configuratie werd direct in de productierepository aangepast.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'gemitigeerd',
    workflowStap: 'ontwikkeling_configuratie', effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Verplichte review op alle configuratierepositories.',
    aangemaakt: 350, bijgewerkt: 90,
  },
  {
    id: 'sm-dep-13', teamId: T.smurfen, categorie: 'Technische afhankelijkheid',
    titel: 'Single sign-on ontbreekt voor de beheerportalen',
    toelichting: 'Beheerders loggen apart in op elk beheerportaal.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-iam'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden', geaccepteerd: true,
    aangemaakt: 500, bijgewerkt: 250,
  },
  {
    id: 'sm-dep-14', teamId: T.smurfen, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB-goedkeuring configuratiewijziging platform',
    toelichting: 'Platformbrede configuratiewijzigingen zijn per definitie hoog-risico-changes voor het CAB.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-cab'), aangemaakt: 280, bijgewerkt: 60,
  },
  {
    id: 'sm-dep-15', teamId: T.smurfen, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Extern infrateam levert netwerksegmentatie op',
    toelichting: 'De segmentatie tussen API-gateway en IAM-platform wordt door het externe infrateam gebouwd en is over tijd.',
    impact: 'zwaar', frequentie: 'soms', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-api', 'sm-app-iam'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Segmentatie gereed vóór de security-audit in november', oplosbaarheid: 'organisatorisch',
    ...partij('party-infra'), aangemaakt: 130, bijgewerkt: 3,
  },
  {
    id: 'sm-dep-16', teamId: T.smurfen, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Migratie naar extern datacenter zonder vaste planning',
    toelichting: 'De verhuizing van het platform naar het externe datacenter heeft nog geen datum; voorbereidend werk staat stil.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: [], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-datacenter'), aangemaakt: 45, bijgewerkt: 5,
  },
  {
    id: 'sm-dep-17', teamId: T.smurfen, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security Office keurt elke IAM-wijziging',
    toelichting: 'Elke wijziging in het rollenmodel wordt vooraf door Security Office beoordeeld.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-iam'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-security'), aangemaakt: 360, bijgewerkt: 45,
  },
  {
    id: 'sm-dep-18', teamId: T.smurfen, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'SSD-aanvraag nieuwe servers voor pipeline-runners',
    toelichting: 'De pipeline-runners zijn overbelast; de aanvraag voor extra servers ligt bij het SSD-loket.',
    impact: 'duidelijk', frequentie: 'soms', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-ci'], effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'interne_afspraak', oplosbaarheid: 'organisatorisch',
    ...partij('party-ssd'), aangemaakt: 35, bijgewerkt: 2,
  },
  {
    id: 'sm-dep-19', teamId: T.smurfen, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'IAM-beheer buiten het team beslist over het rollenmodel',
    toelichting: 'Het team bouwt het platform, maar de organisatie-eenheid IAM-beheer bepaalt welke rollen bestaan.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-iam'], effectOpFlow: 'extra_afstemming',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-iam'), aangemaakt: 240, bijgewerkt: 50,
  },
  {
    id: 'sm-dep-20', teamId: T.smurfen, scope: 'extern', categorie: 'Contract-/inkoopafhankelijkheid',
    titel: 'Licentie API-gateway loopt af',
    toelichting: 'De verlenging van de gateway-licentie loopt via Inkoop en de aanbestedingsregels.',
    impact: 'duidelijk', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-api'], effectOpFlow: 'anders',
    wachttijd: 'geen', deadline: 'vaste_datum', deadlineTekst: 'Licentie verloopt 31 maart', oplosbaarheid: 'organisatorisch',
    ...partij('party-inkoop'), aangemaakt: 70, bijgewerkt: 9,
  },
  {
    id: 'sm-dep-21', teamId: T.smurfen, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Wakanda vraagt API-toegang zonder vaste intake',
    toelichting: 'Verzoeken om nieuwe API-routes komen via chat en e-mail binnen, zonder prioriteit of context.',
    impact: 'beperkt', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-api'], effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Wakanda'), aangemaakt: 160, bijgewerkt: 20,
  },
  {
    id: 'sm-dep-22', teamId: T.smurfen, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'Testautomatisering van Nova Corps draait op de productiepipeline',
    toelichting: 'De testruns van Nova Corps delen de runners met productie-deploys en vertragen die.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-ci'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Nova Corps'), aangemaakt: 120, bijgewerkt: 28,
  },
  {
    id: 'sm-dep-23', teamId: T.smurfen, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Logbewaartermijn moet omlaag naar zes maanden',
    toelichting: 'De logservice bewaart nu twee jaar; de nieuwe termijn vraagt automatische opschoning.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-log'], effectOpFlow: 'herwerk',
    wachttijd: 'geen', deadline: 'harde_deadline', deadlineTekst: 'Gereed vóór 1 mei', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 50, bijgewerkt: 4,
  },
  {
    id: 'sm-dep-24', teamId: T.smurfen, scope: 'extern', categorie: 'Kennis-afhankelijkheid extern',
    titel: 'Kennis van het netwerk zit bij het externe infrateam',
    toelichting: 'Netwerkregels en firewallconfiguratie zijn alleen bij het externe infrateam bekend.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'ontwikkeling_configuratie', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    ...partij('party-infra'), aangemaakt: 290, bijgewerkt: 130,
  },
  {
    id: 'sm-dep-25', teamId: T.smurfen, categorie: 'Technische afhankelijkheid',
    titel: 'Monitoringservice heeft geen alerting buiten kantooruren',
    toelichting: 'Platformstoringen in de nacht worden pas de volgende ochtend opgemerkt.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'actief blokkerend',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-monitoring'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Piketregeling en alerting via de monitoringservice per 1 november.',
    aangemaakt: 80, bijgewerkt: 6,
  },
  {
    id: 'sm-dep-26', teamId: T.smurfen, categorie: 'Rol-afhankelijkheid',
    titel: 'Security officer deelt tijd met Stark Industries',
    toelichting: 'De security officer werkt voor beide teams; hardening-checks van Stark Industries gaan voor.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'release_overdracht', effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 210, bijgewerkt: 100,
  },
  {
    id: 'sm-dep-27', teamId: T.smurfen, categorie: 'Overig intern',
    titel: 'Nog te beoordelen: zero-trust netwerkmodel',
    toelichting: 'Voorstel van Security Office om naar een zero-trust model te gaan; impact op het platform nog niet beoordeeld.',
    impact: 'klein', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: null, effectOpFlow: '',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 15, bijgewerkt: 15,
  },
  {
    id: 'sm-dep-28', teamId: T.smurfen, categorie: 'Data-afhankelijkheid',
    titel: 'Rollen in IAM en in de applicaties lopen uit elkaar',
    toelichting: 'Applicaties kennen eigen rollen die niet één-op-één op de IAM-rollen passen.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-iam'], effectOpFlow: 'herwerk',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 230, bijgewerkt: 18,
  },
]

// ============================================================
// Team Nova Corps — test & kwaliteit: refinement/test/acceptatie-zwaartepunt
// ============================================================
const DEPS_FREGGELS = [
  {
    id: 'fr-dep-01', teamId: T.freggels, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Ketentest kan pas starten als alle teams hun release hebben opgeleverd',
    toelichting: 'Eén laat team houdt de hele ketentest tegen; gemiddeld schuift de start een week.',
    impact: 'zwaar', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'meerdere_teams',
    actieAfspraak: 'Ketentest in twee delen gesplitst zodat de eerste helft eerder kan starten.',
    aangemaakt: 200, bijgewerkt: 7,
  },
  {
    id: 'fr-dep-02', teamId: T.freggels, categorie: 'Kennis-concentratie',
    titel: 'Testcoördinator is de enige die de ketentest van begin tot eind kent',
    toelichting: 'De volgorde, de testdata en de afhankelijkheden van de ketentest zitten in het hoofd van de testcoördinator.',
    impact: 'zwaar', frequentie: 'structureel', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    actieAfspraak: 'Ketentestdraaiboek wordt geschreven; testautomatiseerder draait mee.',
    aangemaakt: 380, bijgewerkt: 20,
  },
  {
    id: 'fr-dep-03', teamId: T.freggels, categorie: 'Rol-afhankelijkheid',
    titel: 'Acceptatie afhankelijk van de businessvertegenwoordiger van het ketenteam',
    toelichting: 'Ketentestresultaten moeten door de business van het betreffende team worden geaccepteerd.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'actief blokkerend',
    workflowStap: 'acceptatie', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 240, bijgewerkt: 10,
  },
  {
    id: 'fr-dep-04', teamId: T.freggels, categorie: 'Technische afhankelijkheid',
    titel: 'Testdata Generator maakt geen data voor uitkeringsscenario’s',
    toelichting: 'Uitkeringsscenario’s worden nog met handmatig samengestelde datasets getest.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-testdata'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 150, bijgewerkt: 30,
  },
  {
    id: 'fr-dep-05', teamId: T.freggels, categorie: 'Data-afhankelijkheid',
    titel: 'Anonimisering testdata mist randgevallen',
    toelichting: 'Bijzondere tekens en buitenlandse adressen worden niet correct geanonimiseerd.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-testdata'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    aangemaakt: 110, bijgewerkt: 40,
  },
  {
    id: 'fr-dep-06', teamId: T.freggels, categorie: 'Technische afhankelijkheid',
    titel: 'Testautomatiseringsframework breekt bij elke UI-wijziging van Wakanda',
    toelichting: 'De geautomatiseerde tests hangen aan schermelementen die Wakanda regelmatig verandert.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-testauto'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 260, bijgewerkt: 60,
  },
  {
    id: 'fr-dep-07', teamId: T.freggels, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Performancetests kunnen alleen in het weekend draaien',
    toelichting: 'Door de gedeelde rekencapaciteit zijn performancetests op werkdagen niet representatief.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-perf'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 180, bijgewerkt: 95,
  },
  {
    id: 'fr-dep-08', teamId: T.freggels, categorie: 'Besluitvormingsafhankelijkheid',
    titel: 'Geen afspraak over wie een release mag blokkeren op testbevindingen',
    toelichting: 'Bij een blokkerende bevinding is onduidelijk of het testteam of het ketenteam beslist.',
    impact: 'duidelijk', frequentie: 'soms', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'team_overstijgend',
    aangemaakt: 90, bijgewerkt: 12,
  },
  {
    id: 'fr-dep-09', teamId: T.freggels, categorie: 'Overig intern',
    titel: 'Testbevindingen werden in drie tools bijgehouden',
    toelichting: 'Bevindingen stonden verspreid over de signaleringsservice, e-mail en een spreadsheet.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'gemitigeerd',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-signalering'], effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Alle bevindingen in de signaleringsservice; andere kanalen uitgezet.',
    aangemaakt: 320, bijgewerkt: 130,
  },
  {
    id: 'fr-dep-10', teamId: T.freggels, categorie: 'Kennis-concentratie',
    titel: 'Alleen de senior testautomatiseerder kent de performancetestsuite',
    toelichting: 'De performancetestsuite is door één persoon opgezet.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-perf'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden', geaccepteerd: true,
    aangemaakt: 400, bijgewerkt: 220,
  },
  {
    id: 'fr-dep-11', teamId: T.freggels, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Refinement van testscenario’s gebeurt pas na de bouw',
    toelichting: 'Testscenario’s worden pas uitgewerkt als de functionaliteit al gebouwd is.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 130, bijgewerkt: 45,
  },
  {
    id: 'fr-dep-12', teamId: T.freggels, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Extern testteam voor piekperiodes nog niet gecontracteerd',
    toelichting: 'Voor de jaarovergang is externe testcapaciteit nodig; de partij is voorgesteld maar nog niet goedgekeurd.',
    impact: 'duidelijk', frequentie: 'soms', status: 'actief blokkerend',
    workflowStap: 'testen', effectOpFlow: 'blokkade',
    wachttijd: 'sprint_of_meer', deadline: 'vaste_datum', deadlineTekst: 'Contract gereed vóór de jaarovergang', oplosbaarheid: 'organisatorisch',
    ...partij('party-testteam'), aangemaakt: 40, bijgewerkt: 3,
  },
  {
    id: 'fr-dep-13', teamId: T.freggels, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Testaccounts via IAM-beheer duren twee weken',
    toelichting: 'Elke ketentest heeft nieuwe testaccounts nodig; IAM-beheer levert die pas na twee weken.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-iam'), aangemaakt: 200, bijgewerkt: 24,
  },
  {
    id: 'fr-dep-14', teamId: T.freggels, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Ketentestomgeving wordt door omgevingenbeheer zonder aankondiging ververst',
    toelichting: 'Een verversing midden in een ketentest maakt alle resultaten waardeloos.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    ...partij('party-omgevingen'), aangemaakt: 220, bijgewerkt: 35,
  },
  {
    id: 'fr-dep-15', teamId: T.freggels, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'Testautomatisering draait op de pipeline van S.H.I.E.L.D.',
    toelichting: 'Elke wijziging in de pipeline van S.H.I.E.L.D. kan de geautomatiseerde tests breken.',
    impact: 'duidelijk', frequentie: 'structureel', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-testauto'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team S.H.I.E.L.D.'), aangemaakt: 250, bijgewerkt: 55,
  },
  {
    id: 'fr-dep-16', teamId: T.freggels, scope: 'extern', categorie: 'Kennis-afhankelijkheid extern',
    titel: 'Betaalregels alleen te toetsen met kennis van Stark Industries',
    toelichting: 'Of een betaaluitkomst klopt, kan alleen een developer van Stark Industries beoordelen.',
    impact: 'duidelijk', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'extra_afstemming',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Stark Industries'), aangemaakt: 170, bijgewerkt: 26,
  },
  {
    id: 'fr-dep-17', teamId: T.freggels, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Wakanda levert testscenario’s te laat aan',
    toelichting: 'Scenario’s voor de polismodule komen vaak pas op de dag van de ketentest.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'analyse_refinement', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    ...team('Team Wakanda'), aangemaakt: 140, bijgewerkt: 18,
  },
  {
    id: 'fr-dep-18', teamId: T.freggels, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-review op de testdata-anonimisering',
    toelichting: 'Security Office wil de anonimisering eenmalig beoordelen voordat testdata naar het externe testteam mag.',
    impact: 'beperkt', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-testdata'], effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'interne_afspraak', oplosbaarheid: 'organisatorisch',
    ...partij('party-security'), aangemaakt: 60, bijgewerkt: 8,
  },
  {
    id: 'fr-dep-19', teamId: T.freggels, scope: 'extern', categorie: 'Wetgevingsafhankelijkheid',
    titel: 'Testdata met echte klantgegevens niet meer toegestaan',
    toelichting: 'Vanaf de ingangsdatum mag geen enkele testset nog herleidbare klantgegevens bevatten.',
    impact: 'zwaar', frequentie: 'eenmalig', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-testdata'], effectOpFlow: 'niet_startklaar',
    wachttijd: 'geen', deadline: 'harde_deadline', deadlineTekst: 'Volledig geanonimiseerd vóór 1 januari', oplosbaarheid: 'organisatorisch',
    ...partij('party-privacy'), aangemaakt: 75, bijgewerkt: 5,
  },
  {
    id: 'fr-dep-20', teamId: T.freggels, scope: 'extern', categorie: 'Capaciteit specialistisch team',
    titel: 'Technisch applicatiebeheer zet testomgevingen alleen op aanvraag terug',
    toelichting: 'Een reset van de testomgeving loopt via een ticket bij TAB, met dagen doorlooptijd.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'testen', effectOpFlow: 'wachten',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'team_overstijgend', geaccepteerd: true,
    ...partij('party-techbeheer'), aangemaakt: 300, bijgewerkt: 150,
  },
  {
    id: 'fr-dep-21', teamId: T.freggels, categorie: 'Technische afhankelijkheid',
    titel: 'Signaleringsservice mist koppeling met de releasekalender',
    toelichting: 'Bevindingen kunnen niet automatisch aan een releasevenster worden gekoppeld.',
    impact: 'beperkt', frequentie: 'soms', status: 'bekend risico',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-signalering'], effectOpFlow: 'onduidelijkheid',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    aangemaakt: 50, bijgewerkt: 6,
  },
  {
    id: 'fr-dep-22', teamId: T.freggels, categorie: 'Rol-afhankelijkheid',
    titel: 'Junior tester kan acceptatietests niet zelfstandig afronden',
    toelichting: 'Elke acceptatietest van de junior tester moet door een senior worden nagekeken.',
    impact: 'beperkt', frequentie: 'regelmatig', status: 'bekend risico',
    workflowStap: 'acceptatie', effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    aangemaakt: 85, bijgewerkt: 14,
  },
]

// ============================================================
// Afgesloten dependencies (afgelopen jaar) — gemitigeerd en daarna
// afgesloten, verspreid over de teams; de basis voor oplostempo en trend.
// ============================================================
const DEPS_GESLOTEN = [
  afgehandeld({
    id: 'ti-gesl-01', teamId: T.tiem, categorie: 'Data-afhankelijkheid',
    titel: 'Dubbele klantregistratie bij gelijktijdige chat en telefoon',
    toelichting: 'Een klant die tegelijk belde en chatte kreeg twee klantrecords.',
    impact: 'beperkt', frequentie: 'regelmatig',
    flowtype: 'applicatieflow', applicatieIds: ['ti-app-klant', 'ti-app-zaak'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Ontdubbeling op klant-id ingebouwd.',
    aangemaakt: 320, escalatie: 250, gemitigeerd: 200, gesloten: 170,
  }),
  afgehandeld({
    id: 'ti-gesl-02', teamId: T.tiem, scope: 'extern', categorie: 'Omgevingsafhankelijkheid',
    titel: 'Telefonieplatform-upgrade zonder testvenster',
    toelichting: 'De leverancier plande de upgrade zonder testmoment voor het team.',
    impact: 'duidelijk', frequentie: 'eenmalig',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Upgrade in het maartvenster', oplosbaarheid: 'team_overstijgend',
    mitigatie: 'Apart testvenster afgesproken met omgevingenbeheer.',
    ...partij('party-omgevingen'), aangemaakt: 260, gemitigeerd: 150, gesloten: 120,
  }),
  afgehandeld({
    id: 'ti-gesl-03', teamId: T.tiem, categorie: 'Overig intern',
    titel: 'Kennisbank-migratie naar het intranet',
    toelichting: 'De migratie van de kennisbank vroeg tijdelijk aandacht van het hele team.',
    impact: 'klein', frequentie: 'eenmalig',
    effectOpFlow: 'contextswitch',
    wachttijd: 'geen', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Migratie afgerond.',
    aangemaakt: 120, gemitigeerd: 40, gesloten: 20,
  }),
  afgehandeld({
    id: 'po-gesl-01', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'Premieherberekening liep vast op schrikkeljaar',
    toelichting: 'De nachtelijke herberekening faalde op 29 februari.',
    impact: 'zwaar', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-premie'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'harde_deadline', deadlineTekst: 'Herberekening 1 maart', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Datumlogica gecorrigeerd en getest.',
    aangemaakt: 200, escalatie: 195, gemitigeerd: 190, gesloten: 175,
  }),
  afgehandeld({
    id: 'po-gesl-02', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'Certificaat integratie gateway verlopen',
    toelichting: 'Alle externe koppelingen vielen uit toen het gateway-certificaat verliep.',
    impact: 'zwaar', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-gateway'], effectOpFlow: 'blokkade',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Certificaat vernieuwd; verloopdatum in de monitoring.',
    aangemaakt: 95, escalatie: 94, gemitigeerd: 93, gesloten: 80,
  }),
  afgehandeld({
    id: 'po-gesl-03', teamId: T.polis, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Handmatige polisoverdracht bij fusie van een verzekeraar',
    toelichting: 'De overdracht van polissen vroeg wekenlang afstemming met de business.',
    impact: 'duidelijk', frequentie: 'eenmalig',
    workflowStap: 'analyse_refinement', effectOpFlow: 'extra_afstemming',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Overdracht vóór 1 oktober', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Overdracht afgerond in twee batches.',
    ...partij('party-business-verzekeringen'), aangemaakt: 340, gemitigeerd: 260, gesloten: 240,
  }),
  afgehandeld({
    id: 'po-gesl-04', teamId: T.polis, categorie: 'Technische afhankelijkheid',
    titel: 'Documentservice genereerde lege PDFs bij speciale tekens',
    toelichting: 'Namen met diakritische tekens leverden een leeg document op.',
    impact: 'beperkt', frequentie: 'regelmatig',
    flowtype: 'applicatieflow', applicatieIds: ['po-app-document'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Tekenset gecorrigeerd.',
    aangemaakt: 60, gemitigeerd: 30, gesloten: 12,
  }),
  afgehandeld({
    id: 'sh-gesl-01', teamId: T.superheroes, categorie: 'Technische afhankelijkheid',
    titel: 'Regelmotor accepteerde een verlopen beleidsversie',
    toelichting: 'Beoordelingen liepen een week op oude regels.',
    impact: 'zwaar', frequentie: 'soms',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-regels'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Versiecontrole op beleidsregels toegevoegd.',
    aangemaakt: 150, escalatie: 140, gemitigeerd: 110, gesloten: 90,
  }),
  afgehandeld({
    id: 'sh-gesl-02', teamId: T.superheroes, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Dossierviewer zonder leesrechten voor nieuwe beoordelaars',
    toelichting: 'Nieuwe beoordelaars konden weken geen dossiers openen.',
    impact: 'beperkt', frequentie: 'soms',
    flowtype: 'applicatieflow', applicatieIds: ['sh-app-dossier'], effectOpFlow: 'niet_startklaar',
    wachttijd: 'sprint_of_meer', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Standaardrol beoordelaar ingericht bij IAM-beheer.',
    ...partij('party-iam'), aangemaakt: 230, gemitigeerd: 180, gesloten: 160,
  }),
  afgehandeld({
    id: 'sh-gesl-03', teamId: T.superheroes, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Beoordelingskader Q2 kwam zonder wijzigingsoverzicht',
    toelichting: 'Het team moest zelf uitzoeken wat er in het kader veranderd was.',
    impact: 'beperkt', frequentie: 'eenmalig',
    workflowStap: 'analyse_refinement', effectOpFlow: 'onduidelijkheid',
    wachttijd: 'kort', deadline: 'interne_afspraak', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Wijzigingsoverzicht is nu vast onderdeel van elke beleidsupdate.',
    ...partij('party-business-verzekeringen'), aangemaakt: 110, gemitigeerd: 70, gesloten: 45,
  }),
  afgehandeld({
    id: 'ca-gesl-01', teamId: T.casio, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'SEPA-bestand afgekeurd door de bank na formaatwijziging',
    toelichting: 'De bank wijzigde de specificatie; het eerste bestand werd afgekeurd op de uitbetaaldag.',
    impact: 'zwaar', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-betaal'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'harde_deadline', deadlineTekst: 'Uitbetaling op de 23e', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Formaat aangepast; de bankspecificatie zit in de regressietest.',
    ...partij('party-bank'), aangemaakt: 275, escalatie: 274, gemitigeerd: 271, gesloten: 260,
  }),
  afgehandeld({
    id: 'ca-gesl-02', teamId: T.casio, categorie: 'Data-afhankelijkheid',
    titel: 'Batchverwerker liep vast op dubbele mutaties',
    toelichting: 'Dubbele polismutaties uit dezelfde nacht blokkeerden de batch.',
    impact: 'duidelijk', frequentie: 'soms',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-batch'], effectOpFlow: 'herwerk',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teamleden',
    mitigatie: 'Ontdubbeling vóór verwerking ingebouwd.',
    aangemaakt: 180, gemitigeerd: 130, gesloten: 100,
  }),
  afgehandeld({
    id: 'ca-gesl-03', teamId: T.casio, scope: 'extern', categorie: 'Data-afhankelijkheid',
    titel: 'Testcertificaat loonaangifte-koppeling verlopen',
    toelichting: 'De testkoppeling met de Belastingdienst werkte een maand niet.',
    impact: 'beperkt', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-loon'], effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Nieuw testcertificaat ontvangen.',
    ...partij('party-belastingdienst'), aangemaakt: 70, gemitigeerd: 50, gesloten: 35,
  }),
  afgehandeld({
    id: 'ca-gesl-04', teamId: T.casio, categorie: 'Proces-/workflow-afhankelijkheid',
    titel: 'Uitkeringsbeschikkingen zonder rekeningnummer',
    toelichting: 'Beschikkingen zonder rekeningnummer kwamen pas bij de betaling aan het licht.',
    impact: 'duidelijk', frequentie: 'soms',
    flowtype: 'applicatieflow', applicatieIds: ['ca-app-uitkering'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Verplichte validatie op rekeningnummer.',
    aangemaakt: 400, gemitigeerd: 350, gesloten: 330,
  }),
  afgehandeld({
    id: 'sv-gesl-01', teamId: T.sv, categorie: 'Technische afhankelijkheid',
    titel: 'Dashboard toonde de verkeerde maand na de jaarovergang',
    toelichting: 'Het maandfilter sprong in januari terug naar december.',
    impact: 'duidelijk', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dashboard'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Datumfilter gecorrigeerd.',
    aangemaakt: 250, gemitigeerd: 245, gesloten: 230,
  }),
  afgehandeld({
    id: 'sv-gesl-02', teamId: T.sv, scope: 'extern', categorie: 'Stakeholderafhankelijkheid',
    titel: 'Toezichtrapportage Q1 in het oude formaat aangeleverd',
    toelichting: 'De toezichthouder wees de rapportage af; opnieuw aanleveren kostte een week.',
    impact: 'zwaar', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-rapport'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'harde_deadline', deadlineTekst: 'Kwartaalrapportage 15 april', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Rapportage opnieuw aangeleverd in het nieuwe formaat.',
    ...partij('party-toezicht'), aangemaakt: 160, escalatie: 158, gemitigeerd: 150, gesloten: 140,
  }),
  afgehandeld({
    id: 'sv-gesl-03', teamId: T.sv, categorie: 'Data-afhankelijkheid',
    titel: 'Laadproces polisdata dubbel geregistreerd',
    toelichting: 'Polisdata werd twee keer per nacht geladen, met dubbele tellingen in de rapportages.',
    impact: 'beperkt', frequentie: 'soms',
    flowtype: 'applicatieflow', applicatieIds: ['sv-app-dwh'], effectOpFlow: 'herwerk',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Dubbele laadstap verwijderd.',
    aangemaakt: 45, gemitigeerd: 20, gesloten: 8,
  }),
  afgehandeld({
    id: 'eq-gesl-01', teamId: T.equinox, categorie: 'Technische afhankelijkheid',
    titel: 'Releasekalender op de verkeerde tijdzone',
    toelichting: 'Releasevensters stonden een uur verschoven in de kalender-app.',
    impact: 'beperkt', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-kalender'], effectOpFlow: 'herwerk',
    mitigatie: 'Tijdzone vastgezet.',
    aangemaakt: 300, gemitigeerd: 290, gesloten: 280,
  }),
  afgehandeld({
    id: 'eq-gesl-02', teamId: T.equinox, categorie: 'Technische afhankelijkheid',
    titel: 'Notificaties kwamen dubbel binnen bij teams',
    toelichting: 'Elke kalenderwijziging leverde twee notificaties op.',
    impact: 'beperkt', frequentie: 'regelmatig',
    flowtype: 'applicatieflow', applicatieIds: ['eq-app-notif'], effectOpFlow: 'vertraging',
    mitigatie: 'Ontdubbeling op berichtsleutel.',
    aangemaakt: 130, gemitigeerd: 100, gesloten: 85,
  }),
  afgehandeld({
    id: 'eq-gesl-03', teamId: T.equinox, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'CAB vroeg extra onderbouwing voor het zomervenster',
    toelichting: 'Het zomervenster werd pas na een tweede CAB-ronde goedgekeurd.',
    impact: 'beperkt', frequentie: 'eenmalig',
    workflowStap: 'release_overdracht', effectOpFlow: 'wachten',
    mitigatie: 'Onderbouwing aangeleverd en goedgekeurd.',
    ...partij('party-cab'), aangemaakt: 90, gemitigeerd: 75, gesloten: 60,
  }),
  afgehandeld({
    id: 'sm-gesl-01', teamId: T.smurfen, categorie: 'Technische afhankelijkheid',
    titel: 'Certificaatrotatie API-gateway brak koppelingen van drie teams',
    toelichting: 'Een onaangekondigde rotatie zette Wakanda, Stark Industries en Fantastic Four een ochtend stil.',
    impact: 'zwaar', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-api'], effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    mitigatie: 'Rotatie nu met aankondiging en overlapperiode.',
    aangemaakt: 210, escalatie: 209, gemitigeerd: 205, gesloten: 190,
  }),
  afgehandeld({
    id: 'sm-gesl-02', teamId: T.smurfen, scope: 'extern', categorie: 'Technische afhankelijkheid',
    titel: 'Logservice liep vol door debug-logging van Nova Corps',
    toelichting: 'Een testrun met debug-logging vulde de logopslag in één nacht.',
    impact: 'duidelijk', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-log'], effectOpFlow: 'vertraging',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'meerdere_teams',
    mitigatie: 'Logniveau per team begrensd.',
    ...team('Team Nova Corps'), aangemaakt: 140, gemitigeerd: 130, gesloten: 115,
  }),
  afgehandeld({
    id: 'sm-gesl-03', teamId: T.smurfen, categorie: 'Omgevingsafhankelijkheid',
    titel: 'Pipeline-runners zonder onderhoudsvenster',
    toelichting: 'Onderhoud aan de runners viel altijd midden in een sprint.',
    impact: 'beperkt', frequentie: 'regelmatig',
    workflowStap: 'beheer_nazorg', effectOpFlow: 'wachten',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Wekelijks onderhoudsvenster ingesteld.',
    aangemaakt: 380, gemitigeerd: 330, gesloten: 300,
  }),
  afgehandeld({
    id: 'sm-gesl-04', teamId: T.smurfen, scope: 'extern', categorie: 'Governance/proces-afhankelijkheid',
    titel: 'Security-auditbevindingen op IAM-rollen',
    toelichting: 'De jaarlijkse audit leverde vier bevindingen op het rollenmodel op.',
    impact: 'duidelijk', frequentie: 'eenmalig',
    flowtype: 'applicatieflow', applicatieIds: ['sm-app-iam'], effectOpFlow: 'herwerk',
    wachttijd: 'dagen', deadline: 'vaste_datum', deadlineTekst: 'Hersteltermijn 30 dagen na de audit', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Alle bevindingen binnen de termijn hersteld.',
    ...partij('party-security'), aangemaakt: 55, gemitigeerd: 28, gesloten: 15,
  }),
  afgehandeld({
    id: 'fr-gesl-01', teamId: T.freggels, categorie: 'Data-afhankelijkheid',
    titel: 'Ketentest jaarovergang zonder representatieve data',
    toelichting: 'De jaarovergang kon niet getest worden zonder data uit twee kalenderjaren.',
    impact: 'zwaar', frequentie: 'eenmalig',
    workflowStap: 'testen', effectOpFlow: 'niet_startklaar',
    wachttijd: 'dagen', deadline: 'harde_deadline', deadlineTekst: 'Ketentest vóór 15 december', oplosbaarheid: 'meerdere_teams',
    mitigatie: 'Jaarovergangsset toegevoegd aan de testdata generator.',
    aangemaakt: 290, escalatie: 280, gemitigeerd: 270, gesloten: 255,
  }),
  afgehandeld({
    id: 'fr-gesl-02', teamId: T.freggels, categorie: 'Technische afhankelijkheid',
    titel: 'Performancetestsuite meldde valse alarmen',
    toelichting: 'Te scherpe drempelwaarden gaven elke nacht een alarm.',
    impact: 'beperkt', frequentie: 'regelmatig',
    flowtype: 'applicatieflow', applicatieIds: ['fr-app-perf'], effectOpFlow: 'contextswitch',
    wachttijd: 'kort', deadline: 'geen_datum', oplosbaarheid: 'teamlid',
    mitigatie: 'Drempelwaarden herijkt.',
    aangemaakt: 170, gemitigeerd: 140, gesloten: 125,
  }),
  afgehandeld({
    id: 'fr-gesl-03', teamId: T.freggels, scope: 'extern', categorie: 'Toegang/rechten-blokkade',
    titel: 'Testaccounts verliepen midden in de ketentest',
    toelichting: 'Halverwege de ketentest verliepen de testaccounts van IAM-beheer.',
    impact: 'duidelijk', frequentie: 'soms',
    workflowStap: 'testen', effectOpFlow: 'blokkade',
    wachttijd: 'dagen', deadline: 'geen_datum', oplosbaarheid: 'organisatorisch',
    mitigatie: 'Testaccounts met verlengde geldigheid afgesproken met IAM-beheer.',
    ...partij('party-iam'), aangemaakt: 100, escalatie: 98, gemitigeerd: 90, gesloten: 70,
  }),
]

export const RAW_MOCK_DEPENDENCIES = [
  ...DEPS_TIEM,
  ...DEPS_POLIS,
  ...DEPS_SUPERHEROES,
  ...DEPS_CASIO,
  ...DEPS_SV,
  ...DEPS_EQUINOX,
  ...DEPS_SMURFEN,
  ...DEPS_FREGGELS,
  ...DEPS_GESLOTEN,
]

export const MOCK_DEPENDENCIES = RAW_MOCK_DEPENDENCIES.map(finalize)

// ---------------------------------------------------------------------------
// Admin-wijzigingenlog: alle vier statussen, inclusief een duplicaatmelding
// (Fantastic Four en Stark Industries registreerden elk een SSD-aanvraag op hetzelfde loket) en
// het goedgekeurde duplicaat Avengers/Stark Industries op de leverancier regelmotor.
// ---------------------------------------------------------------------------

// Handmatige review-entries (de admin-logpagina): alle vier statussen,
// inclusief een duplicaatmelding (Fantastic Four en Stark Industries registreerden elk een
// SSD-aanvraag op hetzelfde loket) en het goedgekeurde duplicaat
// Avengers/Stark Industries op de leverancier regelmotor.
const REVIEW_LOG = [
  { id: 'log-1', timestamp: tijdstipGeleden(1, 9), teamId: T.freggels, type: 'dependency_created', dependencyId: 'fr-dep-21', titel: 'Signaleringsservice mist koppeling met de releasekalender', duplicateOfId: null, status: 'pending' },
  { id: 'log-2', timestamp: tijdstipGeleden(2, 14), teamId: T.casio, type: 'dependency_created', dependencyId: 'ca-dep-28', titel: 'Fraudecheck-pilot leest productiedata zonder anonimisering', duplicateOfId: null, status: 'pending' },
  { id: 'log-3', timestamp: tijdstipGeleden(3, 11), teamId: T.tiem, type: 'dependency_created', dependencyId: 'ti-dep-23', titel: 'SSD-aanvraag extra opslag gespreksopnames wacht al een maand', duplicateOfId: 'ca-dep-26', status: 'pending' },
  { id: 'log-4', timestamp: tijdstipGeleden(6, 16), teamId: T.superheroes, type: 'dependency_created', dependencyId: 'sh-dep-09', titel: 'Leverancier regelmotor levert regelreleases later dan afgesproken', duplicateOfId: 'ca-dep-14', status: 'approved' },
  { id: 'log-5', timestamp: tijdstipGeleden(9, 10), teamId: T.polis, type: 'dependency_created', dependencyId: 'po-dep-33', titel: 'SSD-aanvraag database-uitbreiding polisadministratie wacht op capaciteit', duplicateOfId: null, status: 'edited' },
  { id: 'log-6', timestamp: tijdstipGeleden(12, 15), teamId: T.sv, type: 'dependency_created', dependencyId: 'sv-dep-21', titel: 'Correctiesignalen naar Stark Industries worden niet teruggekoppeld', duplicateOfId: null, status: 'rejected' },
  { id: 'log-7', timestamp: tijdstipGeleden(14, 9), teamId: T.smurfen, type: 'dependency_created', dependencyId: 'sm-dep-27', titel: 'Nog te beoordelen: zero-trust netwerkmodel', duplicateOfId: null, status: 'approved' },
]

// Koppelingsverzoeken als gebeurtenis, passend bij de items in de workflows.
const LINK_LOG = [
  { id: 'log-link-1', timestamp: tijdstipGeleden(5, 11), teamId: T.freggels, type: 'link_proposed', titel: 'Releasekalender voor testplanning', details: { targetTeamId: T.equinox, kind: 'input' } },
  { id: 'log-link-2', timestamp: tijdstipGeleden(8, 14), teamId: T.casio, type: 'link_proposed', titel: 'Uitkeringsstatistiek per maand', details: { targetTeamId: T.sv, kind: 'output' } },
  { id: 'log-link-3', timestamp: tijdstipGeleden(31, 10), teamId: T.freggels, type: 'link_proposed', titel: 'Testrapport per release', details: { targetTeamId: T.tiem, kind: 'output' } },
  { id: 'log-link-4', timestamp: tijdstipGeleden(26, 15), teamId: T.tiem, type: 'link_rejected', titel: 'Testrapport per release', details: { proposerTeamId: T.freggels, kind: 'output' } },
]

// Gebeurtenissen afgeleid uit de historie van de dependencies: aanmaak
// (afgelopen 60 dagen, tenzij er al een review-entry is), wijzigingen
// (afgelopen 90 dagen) en sluitingen (afgelopen 120 dagen). Zo klopt de log
// met wat het detailpaneel per dependency als historie toont.
function afgeleideLog(rawDeps, reviewIds) {
  const entries = []
  for (const raw of rawDeps) {
    const uur = 9 + (hashVan(raw.id) % 8)
    const events = raw.historie ?? historieVoor(raw)
    if ((raw.aangemaakt ?? 180) <= 60 && !reviewIds.has(raw.id)) {
      entries.push({ id: `log-${raw.id}-aangemaakt`, timestamp: tijdstipGeleden(raw.aangemaakt, uur), teamId: raw.teamId, type: 'dependency_created', dependencyId: raw.id, titel: raw.titel, duplicateOfId: null, status: 'approved' })
    }
    if (raw.heropend && raw.heropend.heropend <= 120) {
      entries.push({ id: `log-${raw.id}-heropend`, timestamp: tijdstipGeleden(raw.heropend.heropend, uur), teamId: raw.teamId, type: 'dependency_reopened', dependencyId: raw.id, titel: raw.titel })
    }
    for (const e of events) {
      if (e.dagen > 120) continue
      if (e.veld === 'gesloten') {
        entries.push({ id: `log-${raw.id}-gesloten`, timestamp: tijdstipGeleden(e.dagen, uur), teamId: raw.teamId, type: 'dependency_closed', dependencyId: raw.id, titel: raw.titel })
      } else if (e.dagen <= 90) {
        entries.push({ id: `log-${raw.id}-${e.veld}-${e.dagen}`, timestamp: tijdstipGeleden(e.dagen, uur), teamId: raw.teamId, type: 'dependency_updated', dependencyId: raw.id, titel: raw.titel, details: { velden: [e.veld] } })
      }
    }
  }
  return entries
}

export const MOCK_CHANGE_LOG = [...REVIEW_LOG, ...LINK_LOG, ...afgeleideLog(RAW_MOCK_DEPENDENCIES, new Set(REVIEW_LOG.map((e) => e.dependencyId)))]

// De uitgebreide analyse staat in de demo aan: de demo laat zo meteen
// flowverlies, urgentie, kwadranten en de labels 'stil risico', 'verouderd'
// en 'quick win' zien (en bij Asgard 'profiel onvolledig').
export const MOCK_ADMIN_SETTINGS = { uitgebreideAnalyse: true }
