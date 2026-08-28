// Vertaal-mappings voor de vaste (Nederlandse) datamodel-waarden.
// De opgeslagen data blijft altijd Nederlands (canoniek); dit is puur een weergavelaag.

export const CATEGORIE_LABELS = {
  'Kennis-concentratie': { nl: 'Kennis-concentratie', en: 'Knowledge concentration' },
  'Proces-/workflow-afhankelijkheid': { nl: 'Proces-/workflow-afhankelijkheid', en: 'Process/workflow dependency' },
  'Rol-afhankelijkheid': { nl: 'Rol-afhankelijkheid', en: 'Role dependency' },
  'Besluitvormingsafhankelijkheid': { nl: 'Besluitvormingsafhankelijkheid', en: 'Decision-making dependency' },
  'Technische afhankelijkheid': { nl: 'Technische afhankelijkheid', en: 'Technical dependency' },
  'Data-afhankelijkheid': { nl: 'Data-afhankelijkheid', en: 'Data dependency' },
  'Omgevingsafhankelijkheid': { nl: 'Omgevingsafhankelijkheid', en: 'Environment dependency' },
  'Overig intern': { nl: 'Overig intern', en: 'Other internal' },
  'Capaciteit specialistisch team': { nl: 'Capaciteit specialistisch team', en: 'Specialist team/vendor capacity' },
  'Kennis-afhankelijkheid extern': { nl: 'Kennis-afhankelijkheid extern', en: 'External knowledge dependency' },
  'Toegang/rechten-blokkade': { nl: 'Toegang/rechten-blokkade', en: 'Access/permissions blockage' },
  'Governance/proces-afhankelijkheid': { nl: 'Governance/proces-afhankelijkheid', en: 'Governance/process dependency' },
  'Stakeholderafhankelijkheid': { nl: 'Stakeholderafhankelijkheid', en: 'Stakeholder dependency' },
  'Wetgevingsafhankelijkheid': { nl: 'Wetgevingsafhankelijkheid', en: 'Legislative dependency' },
  'Contract-/inkoopafhankelijkheid': { nl: 'Contract-/inkoopafhankelijkheid', en: 'Contract/procurement dependency' },
  'Overig extern': { nl: 'Overig extern', en: 'Other external' },
}

// Voorbeeldtekst per categorie, per scope (dezelfde categorienaam kan op
// teamniveau en ketenniveau een ander voorbeeld hebben). Getoond op hover.
export const CATEGORY_DESCRIPTIONS = {
  intern: {
    'Kennis-concentratie': {
      nl: 'Kennis is geconcentreerd bij één persoon binnen het team, bijvoorbeeld een senior developer of functioneel beheerder.',
      en: 'Knowledge is concentrated with a single person within the team, e.g. a senior developer or functional administrator.',
    },
    'Proces-/workflow-afhankelijkheid': {
      nl: 'Een interne werkstap of overdracht binnen het team hangt af van één specifieke aanpak of persoon.',
      en: 'An internal work step or handover within the team depends on one specific approach or person.',
    },
    'Rol-afhankelijkheid': {
      nl: 'Besluitvorming of goedkeuring binnen het team ligt bij één rol met de enige bevoegdheid of het enige mandaat.',
      en: 'Decision-making or approval within the team rests with a single role holding sole authority or mandate.',
    },
    'Besluitvormingsafhankelijkheid': {
      nl: 'Voortgang hangt af van akkoord van een specifieke rol binnen het team, bijvoorbeeld de product owner.',
      en: 'Progress depends on sign-off from a specific role within the team, e.g. the product owner.',
    },
    'Technische afhankelijkheid': {
      nl: 'Eigen tooling, scripts of koppelvlakken die slechts door één persoon worden begrepen of onderhouden.',
      en: 'In-house tooling, scripts or interfaces that only one person understands or maintains.',
    },
    'Data-afhankelijkheid': {
      nl: 'Eigen testdata, rapportagedata of autorisatiebeheer is kwetsbaar of onvoldoende geborgd.',
      en: "The team's own test data, reporting data or authorization management is fragile or insufficiently safeguarded.",
    },
    'Omgevingsafhankelijkheid': {
      nl: 'De eigen ontwikkel- of testomgeving is instabiel of onvoldoende beschikbaar.',
      en: "The team's own development or test environment is unstable or insufficiently available.",
    },
    'Overig intern': {
      nl: 'Andere interne afhankelijkheid die niet in de bovenstaande categorieën past.',
      en: "Another internal dependency that doesn't fit the categories above.",
    },
  },
  extern: {
    'Capaciteit specialistisch team': {
      nl: 'Beperkte capaciteit bij een extern team of leverancier leidt tot wachttijd, bijvoorbeeld bij infra- of platformteams.',
      en: 'Limited capacity at an external team or vendor causes waiting time, e.g. infra or platform teams.',
    },
    'Kennis-afhankelijkheid extern': {
      nl: 'Domeinkennis of expertise ligt bij een ander team of externe partij.',
      en: 'Domain knowledge or expertise sits with another team or external party.',
    },
    'Toegang/rechten-blokkade': {
      nl: 'Toegang of autorisatie wordt traag, gedeeltelijk of soms helemaal niet toegekend door een ander team, waardoor processen stagneren of volledig stilvallen.',
      en: 'Access or authorization is granted slowly, partially, or sometimes not at all by another team, causing processes to stagnate or grind to a complete halt.',
    },
    'Governance/proces-afhankelijkheid': {
      nl: 'Een formeel change- of CAB-proces, of overdracht-/intake-/releaseprocessen met andere teams, bepaalt het tempo of de doorlooptijd.',
      en: 'A formal change or CAB process, or handover/intake/release processes with other teams, dictates the pace or lead time.',
    },
    'Besluitvormingsafhankelijkheid': {
      nl: 'Goedkeuring is vereist van een extern orgaan, bijvoorbeeld een architectuurboard, security-afdeling of management.',
      en: 'Approval is required from an external body, e.g. an architecture board, security department or management.',
    },
    'Technische afhankelijkheid': {
      nl: 'Een API, database, koppelvlak of tool van een ander team of externe partij is randvoorwaardelijk.',
      en: 'An API, database, interface or tool owned by another team or external party is a hard prerequisite.',
    },
    'Data-afhankelijkheid': {
      nl: 'Productie-, rapportage- of testdata en autorisaties worden extern beheerd.',
      en: 'Production, reporting or test data and authorizations are managed externally.',
    },
    'Omgevingsafhankelijkheid': {
      nl: 'Een gedeelde test-, acceptatie- of productieomgeving wordt door een ander team beheerd.',
      en: 'A shared test, acceptance or production environment is managed by another team.',
    },
    'Stakeholderafhankelijkheid': {
      nl: 'Afhankelijk van input, akkoord of beschikbaarheid van een gebruikersgroep, opdrachtgever of externe partij.',
      en: 'Depends on input, sign-off or availability of a user group, client or external party.',
    },
    'Wetgevingsafhankelijkheid': {
      nl: 'Een wetswijziging koppelt het werkproces dwingend aan externe instanties of specifieke technologie.',
      en: 'A change in legislation forces the work process to couple to external bodies or specific technology.',
    },
    'Contract-/inkoopafhankelijkheid': {
      nl: 'Leverancierscontract, aanbesteding of SLA bepaalt wat mogelijk is en op welke termijn.',
      en: "A vendor contract, procurement process or SLA determines what's possible and on what timeline.",
    },
    'Overig extern': {
      nl: 'Andere externe afhankelijkheid die niet in de bovenstaande categorieën past.',
      en: "Another external dependency that doesn't fit the categories above.",
    },
  },
}

export const IMPACT_LABELS = {
  klein: { nl: 'Klein', en: 'Minor' },
  beperkt: { nl: 'Beperkt', en: 'Limited' },
  duidelijk: { nl: 'Duidelijk', en: 'Clear' },
  zwaar: { nl: 'Zwaar', en: 'Severe' },
}

export const FREQUENTIE_LABELS = {
  eenmalig: { nl: 'Eenmalig', en: 'One-off' },
  soms: { nl: 'Soms', en: 'Sometimes' },
  regelmatig: { nl: 'Regelmatig', en: 'Regularly' },
  structureel: { nl: 'Structureel', en: 'Structural' },
}

export const STATUS_LABELS = {
  'bekend risico': { nl: 'bekend risico', en: 'known risk' },
  'actief blokkerend': { nl: 'actief blokkerend', en: 'actively blocking' },
  gemitigeerd: { nl: 'gemitigeerd', en: 'mitigated' },
}

export const RISK_LEVEL_LABELS = {
  Laag: { nl: 'Laag', en: 'Low' },
  Gemiddeld: { nl: 'Gemiddeld', en: 'Medium' },
  Hoog: { nl: 'Hoog', en: 'High' },
  Kritiek: { nl: 'Kritiek', en: 'Critical' },
}

export const SCOPE_LABELS = {
  intern: { nl: 'teamniveau', en: 'team level' },
  extern: { nl: 'ketenniveau', en: 'chain level' },
}

export const FLOWTYPE_LABELS = {
  ontwikkelflow: { nl: 'Ontwikkelflow', en: 'Development flow' },
  applicatieflow: { nl: 'Applicatieflow', en: 'Application flow' },
}

// Gelijk aan WORKFLOW_STAGE_LABELS (min 'hardening'): zie WORKFLOW_STAP_LEVELS
// in constants.js voor waarom stap en stage nu dezelfde sleutels delen.
export const WORKFLOW_STAP_LABELS = {
  analyse_refinement: { nl: 'Analyse/refinement', en: 'Analysis/refinement' },
  ontwikkeling_configuratie: { nl: 'Ontwikkeling/configuratie', en: 'Development/configuration' },
  testen: { nl: 'Testen', en: 'Testing' },
  acceptatie: { nl: 'Acceptatie', en: 'Acceptance' },
  release_overdracht: { nl: 'Release/overdracht', en: 'Release/handover' },
  beheer_nazorg: { nl: 'Beheer/nazorg', en: 'Operations/aftercare' },
}

export const EFFECT_OP_FLOW_LABELS = {
  wachten: { nl: 'Wachten', en: 'Waiting' },
  herwerk: { nl: 'Herwerk', en: 'Rework' },
  contextswitch: { nl: 'Contextswitch', en: 'Context switch' },
  vertraging: { nl: 'Vertraging', en: 'Delay' },
  onduidelijkheid: { nl: 'Onduidelijkheid', en: 'Ambiguity' },
  blokkade: { nl: 'Blokkade', en: 'Blockage' },
  extra_afstemming: { nl: 'Extra afstemming nodig', en: 'Extra alignment needed' },
  niet_startklaar: { nl: 'Niet startklaar', en: 'Not ready to start' },
  anders: { nl: 'Anders', en: 'Other' },
}

export const WORKFLOW_STAGE_LABELS = {
  analyse_refinement: { nl: 'Analyse/refinement', en: 'Analysis/refinement' },
  ontwikkeling_configuratie: { nl: 'Ontwikkeling/configuratie', en: 'Development/configuration' },
  testen: { nl: 'Testen', en: 'Testing' },
  acceptatie: { nl: 'Acceptatie', en: 'Acceptance' },
  hardening: { nl: 'Hardening', en: 'Hardening' },
  release_overdracht: { nl: 'Release/overdracht', en: 'Release/handover' },
  beheer_nazorg: { nl: 'Beheer/nazorg', en: 'Operations/aftercare' },
}

export const BRON_TYPE_LABELS = {
  team: { nl: 'Team', en: 'Team' },
  rol: { nl: 'Rol', en: 'Role' },
  persoon: { nl: 'Persoon', en: 'Person' },
  systeem: { nl: 'Systeem', en: 'System' },
  omgeving: { nl: 'Omgeving', en: 'Environment' },
  stakeholder: { nl: 'Stakeholder', en: 'Stakeholder' },
}

export const SENIORITY_LABELS = {
  junior: { nl: 'Junior', en: 'Junior' },
  medior: { nl: 'Medior', en: 'Medior' },
  senior: { nl: 'Senior', en: 'Senior' },
}

export const RISICO_BIJ_UITVAL_LABELS = {
  ja: { nl: 'Ja', en: 'Yes' },
  nee: { nl: 'Nee', en: 'No' },
}

export const OPLOSBAARHEID_LABELS = {
  teamlid: { nl: 'Eén teamlid', en: 'One team member' },
  meerdere_teamleden: { nl: 'Teamleden', en: 'Team members' },
  meerdere_teams: { nl: 'Meerdere teams', en: 'Multiple teams' },
  team_overstijgend: { nl: 'Team-overstijgend', en: 'Cross-team' },
  organisatorisch: { nl: 'Organisatorisch', en: 'Organizational' },
}

export const EXTERNAL_PARTY_STATUS_LABELS = {
  actief: { nl: 'Actief', en: 'Active' },
  in_afwachting: { nl: 'In afwachting', en: 'Pending' },
  geweigerd: { nl: 'Geweigerd', en: 'Rejected' },
}

export const WACHTTIJD_LABELS = {
  geen: { nl: 'Geen', en: 'None' },
  kort: { nl: 'Kort (uren, zelfde dag)', en: 'Short (hours, same day)' },
  dagen: { nl: 'Dagen (1-3 dagen)', en: 'Days (1-3 days)' },
  sprint_of_meer: { nl: 'Sprint of meer', en: 'Sprint or more' },
}

export const DEADLINE_LABELS = {
  geen_datum: { nl: 'Geen datum', en: 'No date' },
  interne_afspraak: { nl: 'Interne afspraak', en: 'Internal agreement' },
  vaste_datum: { nl: 'Vaste datum', en: 'Fixed date' },
  harde_deadline: { nl: 'Harde deadline', en: 'Hard deadline' },
}

export const ANALYSE_LABEL_LABELS = {
  stil_risico: { nl: 'Stil risico', en: 'Silent risk' },
  verouderd: { nl: 'Verouderd', en: 'Stale' },
  quick_win: { nl: 'Quick win', en: 'Quick win' },
}

function lookup(map, key, lang) {
  return map[key]?.[lang] ?? key
}

export const translateCategorie = (key, lang) => lookup(CATEGORIE_LABELS, key, lang)
export const translateImpact = (key, lang) => lookup(IMPACT_LABELS, key, lang)
export const translateFrequentie = (key, lang) => lookup(FREQUENTIE_LABELS, key, lang)
export const translateStatus = (key, lang) => lookup(STATUS_LABELS, key, lang)
export const translateRiskLevel = (key, lang) => lookup(RISK_LEVEL_LABELS, key, lang)
export const translateScope = (key, lang) => lookup(SCOPE_LABELS, key, lang)
export const translateFlowtype = (key, lang) => (key ? lookup(FLOWTYPE_LABELS, key, lang) : '')
export const translateWorkflowStap = (key, lang) => (key ? lookup(WORKFLOW_STAP_LABELS, key, lang) : '')
export const translateEffectOpFlow = (key, lang) => (key ? lookup(EFFECT_OP_FLOW_LABELS, key, lang) : '')
export const translateWorkflowStage = (key, lang) => (key ? lookup(WORKFLOW_STAGE_LABELS, key, lang) : '')
export const translateBronType = (key, lang) => (key ? lookup(BRON_TYPE_LABELS, key, lang) : '')
export const translateSeniority = (key, lang) => (key ? lookup(SENIORITY_LABELS, key, lang) : '')
export const translateRisicoBijUitval = (key, lang) => (key ? lookup(RISICO_BIJ_UITVAL_LABELS, key, lang) : '')
export const translateOplosbaarheid = (key, lang) => (key ? lookup(OPLOSBAARHEID_LABELS, key, lang) : '')
export const translateExternalPartyStatus = (key, lang) => (key ? lookup(EXTERNAL_PARTY_STATUS_LABELS, key, lang) : '')
export const translateWachttijd = (key, lang) => (key ? lookup(WACHTTIJD_LABELS, key, lang) : '')
export const translateDeadline = (key, lang) => (key ? lookup(DEADLINE_LABELS, key, lang) : '')
export const translateAnalyseLabel = (key, lang) => (key ? lookup(ANALYSE_LABEL_LABELS, key, lang) : '')

// Betekenis + voorbeelden per keuzeoptie, getoond onder de knoppenrij in het
// dependency-formulier (alleen bij uitgebreide analyse). Dit is de
// belangrijkste rem op subjectief invullen: mensen kiezen betrouwbaarder
// tussen situaties die ze herkennen dan tussen abstracte woorden. Meerdere
// voorbeelden per optie omdat er altijd wel eentje niet past, en omdat je van
// twee of drie beter leert waar de grens van een niveau ligt.
// Zelfde vorm als CATEGORY_DESCRIPTIONS hierboven.
export const DIMENSION_ANCHORS = {
  impact: {
    klein: {
      nl: { betekenis: 'Nauwelijks effect; je merkt het amper.', voorbeelden: ['Een kleine omweg die niemand opvalt.', 'Iets is onhandig, maar kost geen tijd.'] },
      en: { betekenis: 'Barely any effect; hardly noticeable.', voorbeelden: ['A small detour nobody notices.', 'Something is awkward but costs no time.'] },
    },
    beperkt: {
      nl: { betekenis: 'Merkbaar, maar het werk gaat door.', voorbeelden: ['Iemand zoekt iets uit; niemand wacht erop.', 'Je neemt even een andere route.', 'Irritant, maar niet zichtbaar in de planning.'] },
      en: { betekenis: 'Noticeable, but work continues.', voorbeelden: ['Someone looks something up; nobody is waiting.', 'You take a detour for a moment.', 'Annoying, but invisible in the planning.'] },
    },
    duidelijk: {
      nl: { betekenis: 'Zichtbaar effect op planning of kwaliteit.', voorbeelden: ['Meerdere items schuiven naar de volgende sprint.', 'Je levert op met minder kwaliteit dan afgesproken.', 'De demo moet worden aangepast omdat een deel niet af is.'] },
      en: { betekenis: 'Visible effect on planning or quality.', voorbeelden: ['Several items slip to the next sprint.', 'You deliver with less quality than agreed.', 'The demo has to be adjusted because part is unfinished.'] },
    },
    zwaar: {
      nl: { betekenis: 'Blokkeert belangrijk werk of raakt de keten.', voorbeelden: ['Het sprintdoel wordt niet gehaald.', 'Een keten-oplevering komt in gevaar.', 'Er kan niet naar productie tot dit is opgelost.'] },
      en: { betekenis: 'Blocks important work or affects the chain.', voorbeelden: ['The sprint goal is missed.', 'A chain delivery is at risk.', 'Nothing can go to production until this is resolved.'] },
    },
  },
  frequentie: {
    eenmalig: {
      nl: { betekenis: 'Losse situatie, komt waarschijnlijk niet terug.', voorbeelden: ['Een eenmalige migratie of verhuizing.', 'Hoorde bij dit specifieke project.'] },
      en: { betekenis: 'One-off situation, unlikely to return.', voorbeelden: ['A one-off migration or move.', 'Belonged to this specific project.'] },
    },
    soms: {
      nl: { betekenis: 'Af en toe, zonder duidelijk patroon.', voorbeelden: ['Een paar keer per jaar bij een bepaald type wijziging.', 'Alleen als we aan dat ene systeem werken.'] },
      en: { betekenis: 'Now and then, without a clear pattern.', voorbeelden: ['A few times a year with a certain type of change.', 'Only when we work on that one system.'] },
    },
    regelmatig: {
      nl: { betekenis: 'Komt elke paar sprints terug.', voorbeelden: ['Bij elke release opnieuw afstemmen.', 'Steeds als er een nieuwe koppeling bijkomt.'] },
      en: { betekenis: 'Returns every few sprints.', voorbeelden: ['Realigning with every release.', 'Every time a new integration is added.'] },
    },
    structureel: {
      nl: { betekenis: 'Hoort bij hoe het werk loopt.', voorbeelden: ['Bij elke release opnieuw afstemmen.', 'Testdata moet standaard bij een ander team worden opgehaald.', 'Vrijwel elke sprint lopen we hier tegenaan.'] },
      en: { betekenis: 'Part of how the work runs.', voorbeelden: ['Realigning with every release.', 'Test data must routinely be fetched from another team.', 'We run into this almost every sprint.'] },
    },
  },
  status: {
    'bekend risico': {
      nl: { betekenis: 'Bekend, nog niet opgelost.', voorbeelden: ['We weten ervan, er ligt nog geen aanpak.', 'Besproken in de retro, nog geen actie.'] },
      en: { betekenis: 'Known, not yet resolved.', voorbeelden: ['We know about it, no approach yet.', 'Discussed in the retro, no action yet.'] },
    },
    'actief blokkerend': {
      nl: { betekenis: 'Houdt op dit moment werk tegen.', voorbeelden: ['Er staat nu iets stil door deze afhankelijkheid.', 'Het werk kan pas verder als dit is opgelost.'] },
      en: { betekenis: 'Currently holding up work.', voorbeelden: ['Something is stalled right now because of this.', 'Work can only continue once this is resolved.'] },
    },
    gemitigeerd: {
      nl: { betekenis: 'Er is een werkende oplossing of omweg.', voorbeelden: ['Vast refinement-ritme ingevoerd.', 'Er is een werkende workaround afgesproken.'] },
      en: { betekenis: 'A working solution or workaround exists.', voorbeelden: ['A fixed refinement rhythm was introduced.', 'A working workaround has been agreed.'] },
    },
  },
  wachttijd: {
    geen: {
      nl: { betekenis: 'Niet merkbaar in de planning.', voorbeelden: ['Er is een omweg die niemand tijd kost.', 'We plannen eromheen, verder geen effect.'] },
      en: { betekenis: 'Not noticeable in the planning.', voorbeelden: ['There is a workaround that costs nobody time.', 'We plan around it, no further effect.'] },
    },
    kort: {
      nl: { betekenis: 'Uren, binnen dezelfde dag opgelost.', voorbeelden: ['Wachten op een collega die dezelfde dag reageert.', 'Een paar uur stil, daarna weer door.'] },
      en: { betekenis: 'Hours, resolved the same day.', voorbeelden: ['Waiting for a colleague who replies the same day.', 'Stalled a few hours, then moving again.'] },
    },
    dagen: {
      nl: { betekenis: '1-3 dagen, past nog binnen de sprint.', voorbeelden: ['Wachten tot een testomgeving vrijkomt.', 'Een aanvraag die twee dagen door de lijn gaat.'] },
      en: { betekenis: '1-3 days, still fits within the sprint.', voorbeelden: ['Waiting for a test environment to free up.', 'A request that takes two days through the line.'] },
    },
    sprint_of_meer: {
      nl: { betekenis: 'Werk schuift door naar een volgende sprint.', voorbeelden: ['Wachten op een oplevering van een ander team.', 'Staat al meerdere sprints op de plank.'] },
      en: { betekenis: 'Work slips to a following sprint.', voorbeelden: ['Waiting for a delivery from another team.', 'Has been on the shelf for several sprints.'] },
    },
  },
  deadline: {
    geen_datum: {
      nl: { betekenis: 'Geen concreet moment dat in gevaar komt.', voorbeelden: ['Vervelend, maar er staat niets op de kalender.'] },
      en: { betekenis: 'No concrete moment at risk.', voorbeelden: ['Annoying, but nothing on the calendar.'] },
    },
    interne_afspraak: {
      nl: { betekenis: 'Raakt een sprintafspraak of intern moment.', voorbeelden: ['We wilden dit deze sprint afronden.', 'Beloofd binnen het team, geen externe druk.'] },
      en: { betekenis: 'Affects a sprint agreement or internal moment.', voorbeelden: ['We wanted to finish this sprint.', 'Promised within the team, no external pressure.'] },
    },
    vaste_datum: {
      nl: { betekenis: 'Raakt een release, PI-doel of toezegging.', voorbeelden: ['Release van 14 september.', 'Toegezegd voor het einde van deze PI.'] },
      en: { betekenis: 'Affects a release, PI goal or commitment.', voorbeelden: ['Release of 14 September.', 'Committed for the end of this PI.'] },
    },
    harde_deadline: {
      nl: { betekenis: 'Externe of wettelijke datum; uitstel is geen optie.', voorbeelden: ['Wettelijke ingangsdatum 1 januari.', 'Contractuele datum met een leverancier.'] },
      en: { betekenis: 'External or statutory date; delay is not an option.', voorbeelden: ['Statutory start date of 1 January.', 'Contractual date with a vendor.'] },
    },
  },
  oplosbaarheid: {
    teamlid: {
      nl: { betekenis: 'Een teamlid kan dit zelf oplossen.', voorbeelden: ['Iemand automatiseert een handmatige stap.', 'Een ontwikkelaar documenteert wat alleen zij weet.'] },
      en: { betekenis: 'A single team member can resolve this.', voorbeelden: ['Someone automates a manual step.', 'A developer documents what only they know.'] },
    },
    meerdere_teamleden: {
      nl: { betekenis: 'Vraagt meerdere mensen binnen het team.', voorbeelden: ['Het team spreekt samen een werkwijze af.', 'Twee mensen werken elkaar in op dezelfde kennis.'] },
      en: { betekenis: 'Requires several people within the team.', voorbeelden: ['The team agrees on a way of working together.', 'Two people cross-train on the same knowledge.'] },
    },
    meerdere_teams: {
      nl: { betekenis: 'Vraagt afstemming met een of meer andere teams.', voorbeelden: ['Een ander team moet iets opleveren.', 'Twee teams stemmen hun releasemoment af.'] },
      en: { betekenis: 'Requires alignment with one or more other teams.', voorbeelden: ['Another team has to deliver something.', 'Two teams align their release moment.'] },
    },
    team_overstijgend: {
      nl: { betekenis: 'Vraagt iets buiten de teams om.', voorbeelden: ['Afspraak met een leverancier over doorlooptijd.', 'Het change-proces zelf moet worden aangepast.'] },
      en: { betekenis: 'Requires something beyond the teams.', voorbeelden: ['An agreement with a vendor about lead time.', 'The change process itself must be adjusted.'] },
    },
    organisatorisch: {
      nl: { betekenis: 'Vraagt een organisatorische wijziging of besluit.', voorbeelden: ['Extra capaciteit vraagt een directiebesluit.', 'Er moet een rol of afdeling worden ingericht.'] },
      en: { betekenis: 'Requires an organisational change or decision.', voorbeelden: ['Extra capacity requires a management decision.', 'A role or department has to be set up.'] },
    },
  },
}

export function getDimensionAnchor(dimensie, waarde, lang) {
  return DIMENSION_ANCHORS[dimensie]?.[waarde]?.[lang] ?? null
}

export function getCategoryDescription(categorie, scope, lang) {
  return CATEGORY_DESCRIPTIONS[scope]?.[categorie]?.[lang] ?? ''
}
