import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import {
  WORKFLOW_STAGES,
  BRON_TYPES,
  SENIORITY_LEVELS,
  RISICO_BIJ_UITVAL,
  WORKFLOW_STAP_TO_STAGE,
  FLOWTYPE_LEVELS,
  WORKFLOW_STAP_LEVELS,
  STATUS_LEVELS,
  RISK_LEVELS,
} from '../data/constants'
import {
  translateWorkflowStage,
  translateWorkflowStap,
  translateRiskLevel,
  translateBronType,
  translateSeniority,
  translateRisicoBijUitval,
  translateFlowtype,
  translateLinkStatus,
} from '../i18n/labels'
import { bronTypeColor, ANNOTATION_PALETTE } from '../lib/workflowStyles'
import { calculateRisk, sortByRiskDesc } from '../lib/risk'
import { riskStyle } from '../lib/riskStyles'
import { generateId, emptyTeamWorkflow, emptyApplicatieflow } from '../lib/storage'
import { buildDuplicatePrefill } from '../lib/duplicateDependency'
import { CategoryIcon } from '../data/categoryIcons'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useMergedLayout } from './flow/useMergedLayout'
import { useBufferedText } from '../lib/useBufferedText'
import DependencyForm from './DependencyForm'
import DependencyDetail from './DependencyDetail'
import SpotlightTour from './SpotlightTour'
import FloatingTooltip from './FloatingTooltip'
import PartyPicker from './PartyPicker'
import { openKoppelverzoeken } from '../lib/koppelverzoeken'
import { computeWorkflowLayout } from '../lib/teamCanvasLayout'
import { nodeTypes, edgeTypes, ColorSwatchRow, LINK_STATUS_CHIP } from './team/CanvasNodes'
import { PuntenEditor, IoListRow, LinkRequestsPanel, DependencyRow, StageGroupedDeps, FlatDeps, TeamDataBlock } from './team/TeamDataBlocks'
import { TeamCanvasToolbar, DepFiltersDropdown } from './team/CanvasToolbar'
import { useClickOutside } from '../lib/useClickOutside'
import { useBewaardeStand } from '../lib/weergave'

const TOUR_SEEN_KEY = 'dependency-insight:team-tour-seen'

const STANDAARD_CANVASFILTERS = {
  showIO: true,
  showOverstijgend: true,
  showGeaccepteerd: true,
  riskFilterOn: false,
  showExternalTeams: false,
  showDependencies: true,
  showApplicaties: true,
  showCapaciteit: true,
  showWorkflowfasen: true,
  // Wat er met niet-gerelateerde kaarten gebeurt zodra je iets aanklikt.
  // Verbergen is de standaard: alleen vervagen laat ze even groot en op
  // dezelfde plek staan, dus de tekening wordt er niet kleiner van en je moet
  // nog steeds zelf rondslepen om de opgelichte kaarten bij elkaar te krijgen.
  focusVerbergt: true,
}

// Een bewaarde stand uit een oudere versie kan velden missen of onzin bevatten.
// Per veld terugvallen en niet in één keer het hele object weggooien: dan
// overleeft de rest van iemands instelling een toevoeging van een nieuw filter.
function saneerCanvasFilters(opgeslagen) {
  if (!opgeslagen || typeof opgeslagen !== 'object') return STANDAARD_CANVASFILTERS
  const uit = {}
  for (const [naam, standaard] of Object.entries(STANDAARD_CANVASFILTERS)) {
    uit[naam] = typeof opgeslagen[naam] === 'boolean' ? opgeslagen[naam] : standaard
  }
  return uit
}


// displayNodes in TeamPage) — structurele elementen (zones, lane-
// achtergronden, workflowstappen) staan hier bewust niet bij.
const DIMMABLE_NODE_TYPES = new Set(['dependencyMarker', 'ioItem', 'applicatieflowBanner', 'externalTeam', 'capacityBadge'])
// Node-types die op klik het compacte focuspaneel openen i.p.v. meteen een
// volledige modal (zie handleNodeClick in TeamPage). dependencyMarker zit
// hier bewust niet meer bij — die opent nu meteen de volledige modal.
const FOCUSABLE_NODE_TYPES = new Set(['applicatieflowBanner', 'ioItem', 'externalTeam', 'capacityBadge'])




// Input en output delen nu hetzelfde veldenschema en dezelfde modal-opzet —
// alleen de betekenis van 'bron'/'link' spiegelt om: input komt ergens
// vandaan (bron_type, linkedTeam+linkedOutputId), output gaat ergens naartoe
// (zelfde bron_type-schaal als 'bestemmingstype', linkedTeam+linkedInputId).
function emptyIoItem(_kind) {
  return {
    id: generateId(),
    label: '',
    flowtype: '',
    bron_type: '',
    linkedTeam: '',
    linkedOutputId: '',
    linkedInputId: '',
    applicatieId: '',
    externalTeam: '',
    externalPartyId: '',
    // Cross-team koppeling: goedkeuringsstatus van het verzoek, en of om een
    // nieuw tegenhanger-item bij het andere team is gevraagd (zie LINK_STATUS
    // in constants.js en acceptLinkRequest in AppContext).
    linkStatus: '',
    linkNieuw: false,
    // Vrije opsomming (korte punten) bij de lijn van dit item op het canvas.
    punten: [],
  }
}

// Sentinel-waarde in de item-keuzelijst van de IO-modal: "vraag het andere
// team om een nieuw tegenhanger-item" i.p.v. een bestaand item kiezen.
const NEW_LINK_ITEM = '__nieuw_item__'

const LINK_STATUS_STRING_KEY = {
  voorgesteld: 'teampage.ioLinkStatusVoorgesteld',
  geaccepteerd: 'teampage.ioLinkStatusGeaccepteerd',
  afgewezen: 'teampage.ioLinkStatusAfgewezen',
}

// Statuschips: geen stoplichtkleuren (CLAUDE.md) — amber voor "wacht", de
// huisstijlblauw voor "akkoord", het bestaande bordeaux voor "afgewezen".

// Bepaalt de goedkeuringsstatus van een cross-team koppeling bij opslaan:
// een nieuwe of gewijzigde koppeling naar een ander team start altijd als
// verzoek ('voorgesteld'); een ongewijzigde koppeling houdt zijn status;
// geen koppeling (meer) = geen status. Een koppeling zonder gekozen item én
// zonder 'nieuw item'-verzoek is nog geen verzoek — die blijft, zoals
// voorheen, een losse teamverwijzing zonder ketenlijn.
function withLinkStatus(draft, original) {
  if (!draft.linkedTeam) return { ...draft, linkStatus: '', linkNieuw: false }
  const hasTarget = Boolean(draft.linkedOutputId || draft.linkedInputId || draft.linkNieuw)
  if (!hasTarget) return { ...draft, linkStatus: '' }
  const unchanged =
    original &&
    original.linkedTeam === draft.linkedTeam &&
    (original.linkedOutputId ?? '') === (draft.linkedOutputId ?? '') &&
    (original.linkedInputId ?? '') === (draft.linkedInputId ?? '') &&
    Boolean(original.linkNieuw) === Boolean(draft.linkNieuw)
  if (unchanged && original.linkStatus) return draft
  return { ...draft, linkStatus: 'voorgesteld', linkVoorgesteldOp: new Date().toISOString().slice(0, 10), linkBesluitOp: '' }
}

// Compacte beschrijving van een input/output-item voor de Teamgegevens-lijst
// — maakt in het bijzonder zichtbaar of een item aan een team/output of een
// applicatie gekoppeld is, zonder dat daarvoor de bewerk-modal open hoeft.
function ioItemSummary(item, kind, teams, teamWorkflows, applications, teamName, language, t) {
  const parts = []
  if (item.flowtype) parts.push(translateFlowtype(item.flowtype, language))
  if (item.bron_type) parts.push(translateBronType(item.bron_type, language))
  if (item.linkedTeam) {
    const lijst = kind === 'input' ? (teamWorkflows[item.linkedTeam]?.outputs ?? []) : (teamWorkflows[item.linkedTeam]?.inputs ?? [])
    const linkedId = kind === 'input' ? item.linkedOutputId : item.linkedInputId
    const linked = lijst.find((x) => x.id === linkedId)
    let linkPart = teamName(item.linkedTeam)
    if (linked) linkPart += ` → ${linked.label || '—'}`
    else if (item.linkNieuw && t) linkPart += ` → ${t('teampage.ioLinkNewShort')}`
    // Alleen de niet-definitieve statussen benoemen — 'geaccepteerd' is de
    // normale toestand en zou de lijst alleen maar drukker maken.
    if (item.linkStatus === 'voorgesteld' || item.linkStatus === 'afgewezen') {
      linkPart += ` (${translateLinkStatus(item.linkStatus, language).toLowerCase()})`
    }
    parts.push(linkPart)
  }
  if (item.applicatieId) {
    const app = applications.find((a) => a.id === item.applicatieId)
    if (app) parts.push(app.naam || '—')
  }
  if (item.externalTeam) parts.push(`↔ ${item.externalTeam}`)
  const punten = item.punten ?? []
  if (punten.length > 0 && t) parts.push(punten.length === 1 ? t('teampage.puntenCountOne') : t('teampage.puntenCount', { count: punten.length }))
  return parts.join(' · ')
}

// Klein modal-formulier voor één input-/output-item — vervangt de eerder
// altijd-open inline velden per rij, zodat de lijst daarboven een rustig,
// leesbaar overzicht blijft en je alleen bij bewerken de details ziet.
// Afgeleide beginstand van het formulier voor een bestaand item: een
// teamkoppeling betekent altijd "team in deze tool"; een partij zonder
// koppeling betekent het brontype van het item (of van de partij zelf), en
// bij type 'team' dan "team buiten deze tool".
function ioItemModeOf(item, externalParties) {
  if (!item) return { type: '', teamMode: 'intern' }
  if (item.linkedTeam) return { type: 'team', teamMode: 'intern' }
  const hasParty = Boolean(item.externalPartyId || item.externalTeam)
  const partyType = item.externalPartyId ? (externalParties.find((p) => p.id === item.externalPartyId)?.type ?? '') : ''
  const type = item.bron_type || (hasParty ? partyType || 'stakeholder' : '')
  return { type, teamMode: type === 'team' && hasParty ? 'extern' : 'intern' }
}

const FIELD_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none'

// Formulier voor één input-/output-item. Eén leidende vraag — "van wie of
// wat komt dit?" (input) of "naar wie of wat gaat dit?" (output) — en de
// vervolgvelden hangen van dat antwoord af: bij een team in deze tool kies je
// het item van dat team (of stelt een nieuw item voor, wat een
// koppelingsverzoek wordt); bij een team buiten de tool, systeem, omgeving,
// stakeholder, rol of persoon kies je optioneel een partij uit het register.
// Voorheen stonden bron/bestemming, teamkoppeling en externe partij als drie
// losse, elkaar overlappende velden naast elkaar — dat was niet te volgen.
function IoItemModal({ kind, item, onSave, onRemove, onClose, teams, currentTeamId, teamWorkflows, applications, externalParties, addExternalParty, t, language }) {
  const isInput = kind === 'input'
  const isEditing = Boolean(item)
  const [draft, setDraft] = useState(() => {
    const mode = ioItemModeOf(item, externalParties)
    // Nieuwe items starten expliciet als Applicatieflow (dat was de stille
    // aanname op het canvas voor een leeg flowtype).
    return { ...emptyIoItem(kind), flowtype: 'applicatieflow', ...item, bron_type: item?.bron_type || mode.type }
  })
  const [teamMode, setTeamMode] = useState(() => ioItemModeOf(item, externalParties).teamMode)
  const type = draft.bron_type ?? ''
  const linkedIdField = isInput ? 'linkedOutputId' : 'linkedInputId'
  const linkedItems = isInput ? (teamWorkflows[draft.linkedTeam]?.outputs ?? []) : (teamWorkflows[draft.linkedTeam]?.inputs ?? [])
  const linkedTeamNaam = teams.find((tm) => tm.id === draft.linkedTeam)?.naam ?? '—'
  // Status alleen tonen zolang de koppeling nog dezelfde is als opgeslagen —
  // zodra het team wisselt, gaat de status bij opslaan toch opnieuw beginnen.
  const savedLinkStatus = item?.linkStatus && item.linkedTeam === draft.linkedTeam ? item.linkStatus : ''
  const showTeamBlock = type === 'team'
  const showPartyBlock = Boolean(type) && (type !== 'team' || teamMode === 'extern')

  function update(fields) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  const clearLink = { linkedTeam: '', linkedOutputId: '', linkedInputId: '', linkNieuw: false, linkStatus: '' }
  const clearParty = { externalPartyId: '', externalTeam: '' }

  // Wisselen van type ruimt de velden op die bij het vorige antwoord hoorden:
  // een teamkoppeling bestaat alleen bij 'team', een partij niet bij 'team in
  // deze tool'.
  function chooseType(next) {
    if (next === 'team') {
      update({ bron_type: 'team', ...(teamMode === 'intern' ? clearParty : clearLink) })
      return
    }
    // 'Nog niet bepaald' (leeg) laat ook een eventuele partij los — anders
    // bleef die onzichtbaar aan het item hangen (lijstsamenvatting,
    // ketenoverzicht) en kwam bij de volgende bewerking het type weer terug.
    update({ bron_type: next, ...clearLink, ...(next === '' ? clearParty : {}) })
  }
  function chooseTeamMode(mode) {
    setTeamMode(mode)
    update(mode === 'intern' ? clearParty : clearLink)
  }

  // Alleen de NAAM is verplicht, bewust niet de bron: meer verplichte velden
  // verleiden mensen tot 'xx' invullen. Spaties tellen niet mee — een naam van
  // alleen spaties ontsnapte zelfs aan het streepje op het canvas en zag eruit
  // als een weergavefout.
  const naamOntbreekt = !draft.label?.trim()
  const [naamAangeraakt, setNaamAangeraakt] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (naamOntbreekt) {
      setNaamAangeraakt(true)
      document.getElementById('io-item-naam')?.focus()
      return
    }
    onSave(draft)
  }

  const title = isEditing
    ? isInput
      ? t('teampage.ioEditTitleInput')
      : t('teampage.ioEditTitleOutput')
    : isInput
      ? t('teampage.ioAddTitleInput')
      : t('teampage.ioAddTitleOutput')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{isInput ? t('teampage.ioNameInput') : t('teampage.ioNameOutput')}</label>
            <input
              id="io-item-naam"
              autoFocus
              value={draft.label}
              onChange={(e) => update({ label: e.target.value })}
              onBlur={() => setNaamAangeraakt(true)}
              aria-describedby={naamAangeraakt && naamOntbreekt ? 'io-item-naam-fout' : undefined}
              placeholder={isInput ? t('teampage.ioNamePlaceholderInput') : t('teampage.ioNamePlaceholderOutput')}
              className={`${FIELD_CLASS} text-slate-800 placeholder:text-slate-400 ${
                naamAangeraakt && naamOntbreekt ? 'border-[#9a3b2e]' : ''
              }`}
            />
            {naamAangeraakt && naamOntbreekt && (
              <p id="io-item-naam-fout" role="alert" className="mt-1 text-xs font-medium text-[#9a3b2e]">
                {t('form.required')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.ioFlowtypeLabel')}</label>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label={t('teampage.ioFlowtypeLabel')}>
              {FLOWTYPE_LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ flowtype: value })}
                  aria-pressed={draft.flowtype === value}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    draft.flowtype === value ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {translateFlowtype(value, language)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{t('teampage.ioFlowtypeHint')}</p>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <label className="block text-xs font-medium text-slate-600">{isInput ? t('teampage.ioSourceLabel') : t('teampage.ioDestinationLabel')}</label>
            <div className="flex items-center gap-1.5">
              <select value={type} onChange={(e) => chooseType(e.target.value)} className={FIELD_CLASS}>
                <option value="">{t('teampage.ioSourceNone')}</option>
                {BRON_TYPES.map((bron) => (
                  <option key={bron} value={bron}>
                    {translateBronType(bron, language)}
                  </option>
                ))}
              </select>
              {type && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bronTypeColor(type) }} />}
            </div>

            {showTeamBlock && (
              <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label={t('teampage.ioTeamWhich')}>
                {['intern', 'extern'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => chooseTeamMode(mode)}
                    aria-pressed={teamMode === mode}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      teamMode === mode ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'intern' ? t('teampage.ioTeamInTool') : t('teampage.ioTeamOutsideTool')}
                  </button>
                ))}
              </div>
            )}

            {showTeamBlock && teamMode === 'intern' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-500">{t('teampage.ioTeamWhich')}</label>
                <select
                  value={draft.linkedTeam ?? ''}
                  onChange={(e) => update({ linkedTeam: e.target.value, linkedOutputId: '', linkedInputId: '', linkNieuw: false })}
                  className={FIELD_CLASS}
                >
                  <option value="">{t('teampage.ioLinkTeamPlaceholder')}</option>
                  {teams
                    .filter((tm) => tm.id !== currentTeamId)
                    .map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.naam}
                      </option>
                    ))}
                </select>
                {draft.linkedTeam && (
                  <>
                    <label className="block text-[11px] font-medium text-slate-500">
                      {isInput ? t('teampage.ioTeamItemInput', { team: linkedTeamNaam }) : t('teampage.ioTeamItemOutput', { team: linkedTeamNaam })}
                    </label>
                    <select
                      value={draft.linkNieuw ? NEW_LINK_ITEM : (draft[linkedIdField] ?? '')}
                      onChange={(e) =>
                        e.target.value === NEW_LINK_ITEM
                          ? update({ [linkedIdField]: '', linkNieuw: true })
                          : update({
                              [linkedIdField]: e.target.value,
                              linkNieuw: false,
                              // Naam van het gekozen item overnemen zolang er
                              // nog geen eigen naam staat: dan kost de
                              // naamplicht geen extra denkstap. Een al
                              // ingevulde naam blijft staan.
                              ...(draft.label?.trim()
                                ? {}
                                : { label: linkedItems.find((x) => x.id === e.target.value)?.label ?? '' }),
                            })
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="">{isInput ? t('teampage.ioLinkItemPlaceholder') : t('teampage.ioLinkInputPlaceholder')}</option>
                      {linkedItems.map((linkedItem) => (
                        <option key={linkedItem.id} value={linkedItem.id}>
                          {linkedItem.label || '—'}
                        </option>
                      ))}
                      <option value={NEW_LINK_ITEM}>{t('teampage.ioLinkNewItem', { team: linkedTeamNaam })}</option>
                    </select>
                  </>
                )}
                {savedLinkStatus && (
                  <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${LINK_STATUS_CHIP[savedLinkStatus]}`}>
                    {t(LINK_STATUS_STRING_KEY[savedLinkStatus], { team: linkedTeamNaam })}
                  </span>
                )}
                <p className="text-[11px] text-slate-400">{t('teampage.ioLinkStatusHint')}</p>
              </div>
            )}

            {showPartyBlock && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-500">{t('teampage.ioPartyLabel')}</label>
                <PartyPicker
                  value={draft.externalPartyId}
                  onChange={(id, naam) => update({ externalPartyId: id, externalTeam: naam })}
                  externalParties={externalParties}
                  addExternalParty={addExternalParty}
                  currentTeamId={currentTeamId}
                  teams={teams}
                  // Het soort is hierboven al gekozen (de bron/bestemming van
                  // dit item); die vraag hoeft het aanmaakvenster niet opnieuw
                  // te stellen.
                  defaultType={type}
                  t={t}
                  language={language}
                />
                <p className="text-[11px] text-slate-400">{t('teampage.ioPartyHint')}</p>
              </div>
            )}
          </div>

          {applications.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.ioApplicatieLabel')}</label>
              <select value={draft.applicatieId ?? ''} onChange={(e) => update({ applicatieId: e.target.value })} className={FIELD_CLASS}>
                <option value="">{t('teampage.ioApplicatieNone')}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.naam || '—'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            {isEditing ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-[#9a3b2e]/30 px-2.5 py-1.5 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
              >
                {t('teampage.remove')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('form.cancel')}
              </button>
              <button type="submit" className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]">
                {t('form.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Klein modal voor de toelichting/risico-bij-uitval van één applicatie —
// getriggerd vanuit 'Applicaties in beheer/ontwikkeling' zelf. Stond eerder
// in een eigen 'Applicatie-details'-blok naast de koppel-vragenlijst, wat
// samen met die lijst als dubbelop aanvoelde.
// Eigen component met een key op de applicatie-id (zie de aanroep): zo bouwt
// React het veld vers op zodra de rij een andere applicatie toont, in plaats
// van de naam van de vorige applicatie in beeld te laten staan.
function ApplicationNameInput({ naam, onCommit, placeholder, ariaLabel }) {
  const { value, onChange, flush } = useBufferedText(naam, onCommit)
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={flush}
      placeholder={placeholder}
      // Geen zichtbaar opschrift per rij: elke rij is de applicatie zelf, dus
      // een label erboven zou bij tien applicaties tien keer hetzelfde woord
      // opleveren. Wel een toegankelijk opschrift, zodat het veld ook zonder
      // de visuele context te benoemen is.
      aria-label={ariaLabel}
      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
    />
  )
}

function ApplicationDetailModal({ app, data, onSave, onRename, onRequestRemove, onClose, t, language }) {
  const [draft, setDraft] = useState(() => ({ toelichting: '', risico_bij_uitval: '', risico_toelichting: '', ...data }))

  // De keuzelijst en de risicotoelichting schrijven direct weg: dat zijn losse
  // keuzes, geen doorlopend getypte tekst. De twee vrije tekstvelden (naam
  // bovenin en toelichting) lopen via useBufferedText — daar kostte elke
  // letter anders een volledige serialisatie van de state. De lokale draft
  // hier hielp daar niets tegen: die riep onSave meteen weer aan.
  function update(fields) {
    const next = { ...draft, ...fields }
    setDraft(next)
    onSave(next)
  }

  // Bewust de draft-waarde meegeven en niet data.toelichting: de draft is hier
  // de bron tijdens het openstaan van de modal.
  const naamVeld = useBufferedText(app.naam, onRename)
  const toelichtingVeld = useBufferedText(draft.toelichting ?? '', (toelichting) => update({ toelichting }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <input
            value={naamVeld.value}
            onChange={(e) => naamVeld.onChange(e.target.value)}
            onBlur={naamVeld.flush}
            placeholder={t('teampage.applicationsPlaceholder')}
            aria-label={t('teampage.applicationNameLabel')}
            className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-base font-semibold text-slate-900 hover:border-slate-200 focus:border-[#2a5f8a] focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('form.close')}
            className="ml-2 shrink-0 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailToelichting')}</label>
            <textarea
              value={toelichtingVeld.value}
              onChange={(e) => toelichtingVeld.onChange(e.target.value)}
              onBlur={toelichtingVeld.flush}
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">{t('appflow.detailRisico')}</label>
            <select
              value={draft.risico_bij_uitval ?? ''}
              onChange={(e) => update({ risico_bij_uitval: e.target.value })}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {RISICO_BIJ_UITVAL.map((val) => (
                <option key={val} value={val}>
                  {translateRisicoBijUitval(val, language)}
                </option>
              ))}
            </select>
          </div>
          {draft.risico_bij_uitval === 'ja' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailRisicoToelichting')}</label>
              <input
                value={draft.risico_toelichting ?? ''}
                onChange={(e) => update({ risico_toelichting: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onRequestRemove}
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/10"
          >
            {t('teampage.remove')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
          >
            {t('appflow.detailClose')}
          </button>
        </div>
      </div>
    </div>
  )
}

function emptyCapacityRow() {
  return { id: generateId(), rol: '', seniority: '', risico_bij_uitval: '', risico_toelichting: '', aantal: 1, fase: '' }
}

// Klein modal-formulier voor één capaciteitsrij.
// Vraagt eerst om een naam en maakt de applicatie pas daarna aan. Eerder werd
// het record al weggeschreven op het moment dat je op de knop klikte — dus
// vóórdat het venster überhaupt open was, en een keer wegklikken liet een
// naamloze applicatie achter.
function ApplicationNameModal({ onCreate, onClose, t }) {
  const [naam, setNaam] = useState('')
  const [aangeraakt, setAangeraakt] = useState(false)
  const ontbreekt = !naam.trim()

  function handleSubmit(e) {
    e.preventDefault()
    if (ontbreekt) {
      setAangeraakt(true)
      return
    }
    onCreate(naam.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{t('teampage.applicationsAdd')}</h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label htmlFor="nieuwe-applicatie-naam" className="mb-1 block text-xs font-medium text-slate-600">
              {t('teampage.applicationNameLabel')}
            </label>
            <input
              id="nieuwe-applicatie-naam"
              autoFocus
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              onBlur={() => setAangeraakt(true)}
              aria-describedby={aangeraakt && ontbreekt ? 'nieuwe-applicatie-fout' : undefined}
              placeholder={t('teampage.applicationsPlaceholder')}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none ${
                aangeraakt && ontbreekt ? 'border-[#9a3b2e]' : 'border-slate-300 focus:border-[#2a5f8a]'
              }`}
            />
            {aangeraakt && ontbreekt && (
              <p id="nieuwe-applicatie-fout" role="alert" className="mt-1 text-xs font-medium text-[#9a3b2e]">
                {t('form.required')}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              {t('form.cancel')}
            </button>
            <button type="submit" className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]">
              {t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CapacityRowModal({ row, onSave, onRemove, onClose, t, language }) {
  const [draft, setDraft] = useState(() => ({ ...emptyCapacityRow(), ...row }))
  const isEditing = Boolean(row)
  // Zelfde regel als bij een input/output-item: zonder rol is de regel op het
  // canvas en in de lijst niet te herkennen. Spaties tellen niet mee.
  const rolOntbreekt = !draft.rol?.trim()
  const [rolAangeraakt, setRolAangeraakt] = useState(false)

  function update(fields) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (rolOntbreekt) {
      setRolAangeraakt(true)
      document.getElementById('capaciteit-rol')?.focus()
      return
    }
    onSave(draft)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            {isEditing ? t('teampage.capacityEditTitle') : t('teampage.capacityAddTitle')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityRolPlaceholder')}</label>
            <input
              id="capaciteit-rol"
              autoFocus
              value={draft.rol ?? ''}
              onChange={(e) => update({ rol: e.target.value })}
              onBlur={() => setRolAangeraakt(true)}
              aria-describedby={rolAangeraakt && rolOntbreekt ? 'capaciteit-rol-fout' : undefined}
              placeholder={t('teampage.capacityRolPlaceholder')}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none ${
                rolAangeraakt && rolOntbreekt ? 'border-[#9a3b2e]' : 'border-slate-300 focus:border-[#2a5f8a]'
              }`}
            />
            {rolAangeraakt && rolOntbreekt && (
              <p id="capaciteit-rol-fout" role="alert" className="mt-1 text-xs font-medium text-[#9a3b2e]">
                {t('form.required')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityAantal')}</label>
              <input
                type="number"
                min={0}
                value={draft.aantal}
                onChange={(e) => update({ aantal: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacitySeniority')}</label>
              <select
                value={draft.seniority ?? ''}
                onChange={(e) => update({ seniority: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="">—</option>
                {SENIORITY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {translateSeniority(lvl, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityFase')}</label>
            <select
              value={draft.fase ?? ''}
              onChange={(e) => update({ fase: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {WORKFLOW_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {translateWorkflowStage(stage, language)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('teampage.capacityRisicoLabel')}</label>
            <select
              value={draft.risico_bij_uitval ?? ''}
              onChange={(e) => update({ risico_bij_uitval: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {RISICO_BIJ_UITVAL.map((val) => (
                <option key={val} value={val}>
                  {translateRisicoBijUitval(val, language)}
                </option>
              ))}
            </select>
          </div>
          {draft.risico_bij_uitval === 'ja' && (
            <div>
              <input
                value={draft.risico_toelichting ?? ''}
                onChange={(e) => update({ risico_toelichting: e.target.value })}
                placeholder={t('teampage.capacityRisicoToelichtingPlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            {isEditing ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-[#9a3b2e]/30 px-2.5 py-1.5 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
              >
                {t('teampage.remove')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('form.cancel')}
              </button>
              <button type="submit" className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]">
                {t('form.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Vervangt het vroegere losse Van/Naar-invoervak onderaan de
// applicatieflow-sectie: koppelen gaat nu via deze modal, bereikbaar vanaf
// zowel "+ Toevoegen" in de toolbar als de inline knop bij Applicatieverbindingen.
function ConnectApplicationsModal({ applications, existingConnections, onSave, onClose, t }) {
  const [van, setVan] = useState('')
  const [naar, setNaar] = useState('')
  const [touched, setTouched] = useState(false)

  const errors = {}
  if (!van) errors.van = t('form.required')
  if (!naar) errors.naar = t('form.required')
  else if (van === naar) errors.naar = t('appflow.sameAppError')
  else if (existingConnections.some((c) => c.van === van && c.naar === naar)) errors.naar = t('appflow.duplicateConnectionError')

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length > 0) return
    onSave(van, naar)
  }

  if (applications.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
        <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">{t('appflow.connectModalTitle')}</h3>
            <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-500">{t('appflow.needTwoApps')}</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('form.close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{t('appflow.connectModalTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.vanLabel')}</label>
            <select
              value={van}
              onChange={(e) => setVan(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.naam || '—'}
                </option>
              ))}
            </select>
            {touched && errors.van && <p className="mt-1 text-xs font-medium text-[#9a3b2e]">{errors.van}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.naarLabel')}</label>
            <select
              value={naar}
              onChange={(e) => setNaar(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="">—</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.naam || '—'}
                </option>
              ))}
            </select>
            {touched && errors.naar && <p className="mt-1 text-xs font-medium text-[#9a3b2e]">{errors.naar}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('form.cancel')}
            </button>
            <button type="submit" className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]">
              {t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Lichte, optionele team-toelichting per workflowstap — bewust géén vaste
// systeem-uitleg, maar vrije tekst die een team zelf vastlegt (bv. "testdata
// komt via Team X"). Leeg opslaan verwijdert de toelichting weer (zie
// updateStageNote), zodat "heeft dit team hier iets bij gezet?" een simpele
// aan/uit-vraag blijft.
function StageNoteModal({ stage, initialText, onSave, onRemove, onClose, t, language }) {
  const [text, setText] = useState(initialText)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="stage-note-title" className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 id="stage-note-title" className="text-base font-semibold text-slate-900">
            {t('teampage.stageNoteTitle', { stage: translateWorkflowStage(stage, language) })}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('form.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-2 text-xs text-slate-400">{t('teampage.stageNoteHint')}</p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={t('teampage.stageNotePlaceholder')}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {initialText ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
            >
              {t('teampage.stageNoteRemove')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('form.cancel')}
            </button>
            <button
              type="button"
              onClick={() => onSave(text)}
              className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f4a6c]"
            >
              {t('form.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TeamPage({ teamId, onBack, adminSections, sidebarCollapsed, sidebarMode, containerRef }) {
  const {
    teams,
    dependencies,
    teamWorkflows,
    updateTeamWorkflow,
    removeApplicationEverywhere,
    unlinkCounterparts,
    addDependency,
    addDependencies,
    updateDependency,
    deleteDependency,
    teamName,
    externalParties,
    addExternalParty,
    adminSettings,
    acceptLinkRequest,
    rejectLinkRequest,
    alleDependencies,
    logEvent,
  } = useAppContext()
  const { t, language } = useLanguage()
  const teamNaam = teamName(teamId)
  const [selectedDependency, setSelectedDependency] = useState(null)
  const [formState, setFormState] = useState(null)
  const [activeColor, setActiveColor] = useState(ANNOTATION_PALETTE[1].value)
  const [capacityModalRow, setCapacityModalRow] = useState(undefined)
  const [appDetailId, setAppDetailId] = useState(null)
  // Staat het 'nieuwe applicatie'-venster open? Het record ontstaat pas bij
  // opslaan daarin, niet bij het klikken op de knop.
  const [nieuweAppOpen, setNieuweAppOpen] = useState(false)
  // Applicatie die op verwijderen wacht, mét telling van wat eraan hangt.
  const [appToDelete, setAppToDelete] = useState(null)
  // IO-item aangeklikt op het canvas: opent dezelfde IoItemModal als de
  // Input/Output-lijst, zonder de lijst-lokale modalItem-state aan te raken.
  const [canvasIoTarget, setCanvasIoTarget] = useState(null)
  // Workflowstap waarvoor de team-toelichting wordt bewerkt (of null) — een
  // simpele stage-sleutel volstaat, de tekst zelf leeft in workflow.stageNotes.
  const [stageNoteTarget, setStageNoteTarget] = useState(null)
  const [canvasHover, setCanvasHover] = useState(null)
  // Klik op een applicatie/dependency/IO-item/extern team opent eerst een
  // compact focuspaneel naast het canvas i.p.v. meteen de volledige modal —
  // dat paneel heeft zelf een actieknop die de bestaande modal opent. Bevat
  // de aangeklikte ReactFlow-node zelf, zodat het paneel en de dim-laag
  // (displayNodes/displayEdges) er allebei content/id uit kunnen halen.
  const [canvasFocus, setCanvasFocus] = useState(null)
  const [tourActive, setTourActive] = useState(false)
  const [appFilterQuery, setAppFilterQuery] = useState('')
  const [splitApplicaties, setSplitApplicaties] = useState(true)
  // Het zoekveld voor applicaties bestaat alleen bij 'Split per applicatie'
  // met meer dan vier applicaties; verdwijnt het veld, dan mag zijn tekst
  // niet stilzwijgend blijven filteren.
  // (teamWorkflows uit de context i.p.v. `workflow`: die const staat verderop
  // en is hier nog niet geïnitialiseerd.)
  const appFilterVisible = splitApplicaties && (teamWorkflows[teamId]?.applications ?? []).length > 4
  useEffect(() => {
    if (!appFilterVisible) setAppFilterQuery('')
  }, [appFilterVisible])
  // Welke Applicatieflow-lanes op het canvas zijn ingeklapt — puur presentatie,
  // niet bewaard, zodat teams met veel applicaties de stapel compact kunnen
  // houden zonder een onleesbare muur aan lanes.
  const [collapsedLaneIds, setCollapsedLaneIds] = useState(() => new Set())
  // Weergave-filters voor het Teamcanvas. Per team apart bewaard: team A en
  // team B hebben verschillende canvassen en dus verschillende redenen om iets
  // te verbergen. Als één object onder één sleutel, niet als negen losse
  // sleutels -- dat scheelt bij dertig teams 270 regels in de opslag.
  //
  // Standaard aan voor showGeaccepteerd: geaccepteerde afhankelijkheden blijven
  // op het teamcanvas staan (ze zijn wel uit de organisatiebrede Heatmap
  // gefilterd). De laatste vier verbergen alleen ná de layoutberekening welke
  // canvas-elementtypes zichtbaar zijn, zodat je gericht op een deelverzameling
  // kunt focussen zonder dat de rest van het canvas herpositioneert.
  const [canvasFilters, setCanvasFilters] = useBewaardeStand(`teampagina.${teamId}`, STANDAARD_CANVASFILTERS, saneerCanvasFilters)
  // Setters met dezelfde vorm als useState, zodat elke aanroeper hieronder
  // onveranderd blijft werken -- inclusief de functionele variant (v => !v).
  const zetFilter = useCallback(
    (naam) => (waarde) =>
      setCanvasFilters((vorige) => ({ ...vorige, [naam]: typeof waarde === 'function' ? waarde(vorige[naam]) : waarde })),
    [setCanvasFilters],
  )
  const { showIO, showOverstijgend, showGeaccepteerd, riskFilterOn, showExternalTeams, showDependencies, showApplicaties, showCapaciteit, showWorkflowfasen, focusVerbergt } =
    canvasFilters
  const setShowIO = useMemo(() => zetFilter('showIO'), [zetFilter])
  const setShowOverstijgend = useMemo(() => zetFilter('showOverstijgend'), [zetFilter])
  const setShowGeaccepteerd = useMemo(() => zetFilter('showGeaccepteerd'), [zetFilter])
  const setRiskFilterOn = useMemo(() => zetFilter('riskFilterOn'), [zetFilter])
  const setShowExternalTeams = useMemo(() => zetFilter('showExternalTeams'), [zetFilter])
  const setShowDependencies = useMemo(() => zetFilter('showDependencies'), [zetFilter])
  const setShowApplicaties = useMemo(() => zetFilter('showApplicaties'), [zetFilter])
  const setShowCapaciteit = useMemo(() => zetFilter('showCapaciteit'), [zetFilter])
  const setShowWorkflowfasen = useMemo(() => zetFilter('showWorkflowfasen'), [zetFilter])
  const setFocusVerbergt = useMemo(() => zetFilter('focusVerbergt'), [zetFilter])
  const [legendOpen, setLegendOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const legendRef = useRef(null)
  const addMenuRef = useRef(null)
  const canvasPaneRef = useRef(null)
  useClickOutside(legendRef, legendOpen, () => setLegendOpen(false))
  useClickOutside(addMenuRef, addMenuOpen, () => setAddMenuOpen(false))

  // Presentatiemodus: een fixed overlay binnen dezelfde component-instantie
  // i.p.v. de browser Fullscreen API — die vereist een gebruikersgebaar-
  // context die in een ingesloten preview niet altijd beschikbaar is, en een
  // overlay heeft toch al hetzelfde effect (sidebar/topbar visueel weg) zonder
  // dat team, filters, zoekopdracht of selectie ooit hoeven te resetten: het
  // is dezelfde render, alleen anders gepositioneerd.
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    if (!isFullscreen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  const toggleLaneCollapsed = useCallback((id) => {
    setCollapsedLaneIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (!localStorage.getItem(TOUR_SEEN_KEY)) {
      startTour()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startTour() {
    // Vaste startstand zodat de laatste stap (Dependencies/Teamgegevens-
    // tabs) altijd zijn data-tour-target vindt, ook als de rondleiding
    // wordt herstart terwijl de gebruiker toevallig op het Teamgegevens-tab
    // stond.
    setBottomSectionTab('dependencies')
    setTourActive(true)
  }

  function handleTourClose() {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
    setTourActive(false)
  }

  // Volgorde volgt het scherm van boven naar beneden, links naar rechts:
  // eerst het canvas zelf, dan de toolbar-rijen erboven in de volgorde
  // waarin ze staan (toevoegen/notitie → zoeken/weergave → help), dan
  // fullscreen, en tot slot de tabs onder het canvas. Elke stap beschrijft
  // alleen wat er nu daadwerkelijk staat — geen stappen voor functies die
  // niet (meer) bestaan.
  const tourSteps = [
    { target: 'workflow-canvas', title: t('tour.step.canvas.title'), body: t('tour.step.canvas.body') },
    (adminSections.applicaties || adminSections.input || adminSections.output || adminSections.capaciteit || adminSections.applicatieflow) && {
      target: 'toolbar',
      title: t('tour.step.addMenu.title'),
      body: t('tour.step.addMenu.body'),
    },
    adminSections.aantekeningen && {
      target: 'toolbar',
      title: t('tour.step.annotations.title'),
      body: t('tour.step.annotations.body'),
    },
    { target: 'toolbar', title: t('tour.step.searchFilter.title'), body: t('tour.step.searchFilter.body') },
    { target: 'toolbar', title: t('tour.step.help.title'), body: t('tour.step.help.body') },
    { target: 'canvas-toolbar', title: t('tour.step.canvasToolbar.title'), body: t('tour.step.canvasToolbar.body') },
    (adminSections.dependencies ||
      adminSections.applicaties ||
      adminSections.applicatieflow ||
      adminSections.input ||
      adminSections.output ||
      adminSections.capaciteit) && {
      target: 'dependencies',
      title: t('tour.step.tabs.title'),
      body: t('tour.step.tabs.body'),
    },
  ].filter(Boolean)

  const workflow = teamWorkflows[teamId] ?? emptyTeamWorkflow()

  // Geeft alleen de partial door — updateTeamWorkflow in AppContext.jsx doet
  // de merge zelf, tegen de op dát moment actuele workflow (via prev), niet
  // tegen de workflow-variabele hierboven uit déze render. Die stond hier
  // eerder al vooraf gespreid (`{ ...workflow, ...partial }`), waardoor twee
  // patch()-aanroepen binnen dezelfde gebeurtenis elkaars niet-genoemde
  // velden alsnog met een verouderde snapshot konden overschrijven — zie B-10.
  function patch(partial) {
    updateTeamWorkflow(teamId, partial)
  }

  const resolveLinkLabel = useCallback(
    (item, kind = 'input') => {
      if (!item.linkedTeam) return null
      const lijst = kind === 'input' ? (teamWorkflows[item.linkedTeam]?.outputs ?? []) : (teamWorkflows[item.linkedTeam]?.inputs ?? [])
      const linkedId = kind === 'input' ? item.linkedOutputId : item.linkedInputId
      const linked = lijst.find((x) => x.id === linkedId)
      if (!linkedId) return null
      return linked ? `${teamName(item.linkedTeam)} → ${linked.label || '—'}` : null
    },
    [teamWorkflows, teamName],
  )

  const annotationHandlers = useMemo(
    () => ({
      onText: (id, text) => {
        updateTeamWorkflow(teamId, { ...workflow, annotations: workflow.annotations.map((a) => (a.id === id ? { ...a, text } : a)) })
      },
      onColor: (id, color) => {
        updateTeamWorkflow(teamId, { ...workflow, annotations: workflow.annotations.map((a) => (a.id === id ? { ...a, color } : a)) })
      },
      onRemove: (id) => {
        updateTeamWorkflow(teamId, { ...workflow, annotations: workflow.annotations.filter((a) => a.id !== id) })
      },
    }),
    [teamId, workflow, updateTeamWorkflow],
  )

  const teamDependencies = useMemo(
    () => sortByRiskDesc(dependencies.filter((d) => d.teamId === teamId)),
    [dependencies, teamId],
  )

  // --- Dependency-filters: beïnvloeden canvas én lijst tegelijk ---
  // Bewust ruim opgezet (zoeken + 6 aparte filters) i.p.v. één simpele
  // schakelaar, zodat een team met veel dependencies zelf kan bepalen hoeveel
  // hij tegelijk ziet. 'Alle' / een lege Set-selectie betekent hier steeds
  // "geen filter actief" — dat is ook de startstand.
  const [depSearchQuery, setDepSearchQuery] = useState('')
  const [flowtypeFilter, setFlowtypeFilter] = useState('alle')
  const [scopeFilter, setScopeFilter] = useState('alle')
  const [riskLevelFilter, setRiskLevelFilter] = useState(() => new Set(RISK_LEVELS))
  const [statusFilter, setStatusFilter] = useState(() => new Set(STATUS_LEVELS))
  const [workflowStapFilter, setWorkflowStapFilter] = useState(() => new Set(WORKFLOW_STAP_LEVELS))
  const [appLabelFilter, setAppLabelFilter] = useState('alle')
  const [depFiltersOpen, setDepFiltersOpen] = useState(false)
  const [canvasDepFiltersOpen, setCanvasDepFiltersOpen] = useState(false)

  const depFiltersActive =
    depSearchQuery.trim() !== '' ||
    flowtypeFilter !== 'alle' ||
    scopeFilter !== 'alle' ||
    riskLevelFilter.size !== RISK_LEVELS.length ||
    statusFilter.size !== STATUS_LEVELS.length ||
    workflowStapFilter.size !== WORKFLOW_STAP_LEVELS.length ||
    appLabelFilter !== 'alle'

  function clearDepFilters() {
    setDepSearchQuery('')
    setFlowtypeFilter('alle')
    setScopeFilter('alle')
    setRiskLevelFilter(new Set(RISK_LEVELS))
    setStatusFilter(new Set(STATUS_LEVELS))
    setWorkflowStapFilter(new Set(WORKFLOW_STAP_LEVELS))
    setAppLabelFilter('alle')
  }

  // De canvas-toolbar combineert dependency-filters met de losse
  // canvas-weergaveschakelaars (showIO e.d.) onder één "Weergave"-knop —
  // "actief" en "wissen" tellen daarom ook die schakelaars mee.
  const viewTogglesActive =
    !showIO ||
    !showOverstijgend ||
    !showGeaccepteerd ||
    riskFilterOn ||
    showExternalTeams ||
    !showDependencies ||
    !showApplicaties ||
    !showCapaciteit ||
    !showWorkflowfasen
  const weergaveActive = depFiltersActive || viewTogglesActive || appFilterQuery.trim() !== ''
  function clearWeergave() {
    clearDepFilters()
    setAppFilterQuery('')
    setShowIO(true)
    setShowOverstijgend(true)
    setShowGeaccepteerd(true)
    setRiskFilterOn(false)
    setShowExternalTeams(false)
    setShowDependencies(true)
    setShowApplicaties(true)
    setShowCapaciteit(true)
    setShowWorkflowfasen(true)
  }

  function depMatchesSearch(dep, query) {
    if (!query) return true
    const appNamen = (dep.applicatieIds ?? [])
      .map((id) => workflow.applications.find((a) => a.id === id)?.naam)
      .filter(Boolean)
      .join(' ')
    const haystack = [
      dep.titel,
      dep.toelichting,
      dep.categorie,
      dep.workflowStap ? translateWorkflowStap(dep.workflowStap, language) : '',
      appNamen,
      dep.actieAfspraak,
      dep.mitigatie,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  }

  const filteredTeamDependencies = useMemo(() => {
    const query = depSearchQuery.trim().toLowerCase()
    return teamDependencies.filter((dep) => {
      if (flowtypeFilter !== 'alle' && dep.flowtype !== flowtypeFilter) return false
      if (scopeFilter !== 'alle' && dep.scope !== scopeFilter) return false
      if (!riskLevelFilter.has(calculateRisk(dep).level)) return false
      if (dep.status && !statusFilter.has(dep.status)) return false
      if (dep.workflowStap && !workflowStapFilter.has(dep.workflowStap)) return false
      if (appLabelFilter === 'overstijgend' && (dep.applicatieIds ?? []).length > 0) return false
      if (appLabelFilter !== 'alle' && appLabelFilter !== 'overstijgend' && !(dep.applicatieIds ?? []).includes(appLabelFilter))
        return false
      if (!depMatchesSearch(dep, query)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teamDependencies,
    depSearchQuery,
    flowtypeFilter,
    scopeFilter,
    riskLevelFilter,
    statusFilter,
    workflowStapFilter,
    appLabelFilter,
    workflow.applications,
    language,
  ])

  // 'Dependencies van dit team' toont standaard alleen actieve (niet-
  // geaccepteerde) dependencies; geaccepteerde staan achter een eigen tabje
  // — bovenop dezelfde filters/zoekopdracht als de rest van de pagina.
  const [depTab, setDepTab] = useState('actief')
  // Dependencies en Teamgegevens stonden onder elkaar — bij een team met veel
  // input/output/capaciteit moest je helemaal naar beneden scrollen om bij
  // Teamgegevens te komen. Nu twee tabs op dezelfde plek, Dependencies default.
  // Zonder Dependencies-sectie (Admin) is Teamgegevens het enige tabblad —
  // de tabkeuze zit ín de kaarten, dus zonder deze terugval was er dan
  // helemaal geen kaart (en geen tab om naar Teamgegevens te komen).
  const [bottomSectionTab, setBottomSectionTab] = useState(adminSections.dependencies ? 'dependencies' : 'teamgegevens')
  useEffect(() => {
    if (!adminSections.dependencies) setBottomSectionTab('teamgegevens')
  }, [adminSections.dependencies])
  const acceptedDeps = useMemo(() => filteredTeamDependencies.filter((d) => d.geaccepteerd), [filteredTeamDependencies])
  const visibleTeamDependencies = useMemo(
    () => (depTab === 'gesloten' ? [] : filteredTeamDependencies.filter((d) => Boolean(d.geaccepteerd) === (depTab === 'geaccepteerd'))),
    [filteredTeamDependencies, depTab],
  )
  // Gesloten dependencies staan niet in de operationele lijst (context levert
  // alleen open records) — eigen tabblad, nieuwste sluiting bovenaan.
  const closedTeamDeps = useMemo(
    () => alleDependencies.filter((d) => d.teamId === teamId && d.gesloten_op).sort((a, b) => b.gesloten_op.localeCompare(a.gesloten_op)),
    [alleDependencies, teamId],
  )

  // Drieledige splitsing per de Ontwikkelflow/Applicatieflow-scheiding:
  // legacy-data zonder flowtype blijft expliciet zichtbaar i.p.v. geraden.
  const legacyFlowDeps = useMemo(() => visibleTeamDependencies.filter((d) => !d.flowtype), [visibleTeamDependencies])
  // Records die op het canvas niet getekend worden. Ze verdwenen alle drie
  // stilzwijgend, waardoor het canvas compleet leek terwijl het dat niet was.
  //
  // 1. Dependencies zonder flowtype: die staan al apart in de lijst onder het
  //    canvas, maar op het canvas zelf ontbraken ze zonder een woord.
  // 2. Applicatieverbindingen die naar een inmiddels verwijderde applicatie
  //    wijzen: de lay-out slaat zo'n verbinding over zodra de bijbehorende
  //    bannernode ontbreekt (zie applicatieflowConnecties in
  //    computeWorkflowLayout), zonder melding.
  const verweesdeAppConnecties = useMemo(() => {
    const bestaandeAppIds = new Set((workflow.applications ?? []).map((a) => a.id))
    return (workflow.applicatieflow?.connecties ?? []).filter((c) => !bestaandeAppIds.has(c.van) || !bestaandeAppIds.has(c.naar))
  }, [workflow.applications, workflow.applicatieflow])

  // Capaciteitsregels zonder fase werden bij het opbouwen van het canvas
  // overgeslagen (`if (!row.fase) continue`), terwijl het veld in het
  // formulier 'Fase (optioneel)' heet — mensen laten het met recht leeg en
  // vonden hun regel daarna nergens terug. Het veld blijft optioneel heten;
  // deze regels krijgen een eigen strook onder het canvas.
  const capaciteitZonderFase = useMemo(() => (workflow.capacity ?? []).filter((row) => !row.fase), [workflow.capacity])

  const ontwikkelflowDeps = useMemo(
    () => visibleTeamDependencies.filter((d) => d.flowtype === 'ontwikkelflow'),
    [visibleTeamDependencies],
  )
  const applicatieflowDeps = useMemo(
    () => visibleTeamDependencies.filter((d) => d.flowtype === 'applicatieflow'),
    [visibleTeamDependencies],
  )

  // useCallback i.p.v. gewone functiedeclaraties: deze twee zitten in
  // rowContext hieronder, dat stabiel moet blijven wil de memo op
  // DependencyRow effect hebben.
  const addApplicatieId = useCallback(
    (dep, appId) => {
      if (!appId) return
      const current = dep.applicatieIds ?? []
      if (current.includes(appId)) return
      updateDependency(dep.id, { applicatieIds: [...current, appId] })
    },
    [updateDependency],
  )
  const removeApplicatieId = useCallback(
    (dep, appId) => {
      updateDependency(dep.id, { applicatieIds: (dep.applicatieIds ?? []).filter((id) => id !== appId) })
    },
    [updateDependency],
  )

  const rowContext = useMemo(
    () => ({
      t,
      language,
      uitgebreideAnalyse: adminSettings.uitgebreideAnalyse,
      applications: workflow.applications,
      onSelect: setSelectedDependency,
      onAddApplicatie: addApplicatieId,
      onRemoveApplicatie: removeApplicatieId,
    }),
    [t, language, adminSettings.uitgebreideAnalyse, workflow.applications, addApplicatieId, removeApplicatieId],
  )


  // "Teamgegevens" bundelt Applicaties/Applicatieverbindingen/Input/Output/
  // Capaciteit in losse, standaard dichte blokjes — elk blok houdt zijn eigen
  // open/dicht-stand bij zodat openklappen er één niet de rest verstoort.
  const [teamDataOpenBlocks, setTeamDataOpenBlocks] = useState({
    applicaties: false,
    verbindingen: false,
    input: false,
    output: false,
    capaciteit: false,
  })
  function toggleTeamDataBlock(key) {
    setTeamDataOpenBlocks((prev) => ({ ...prev, [key]: !prev[key] }))
  }
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [connectionsExpanded, setConnectionsExpanded] = useState(false)
  function addAppConnection(van, naar) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    patch({ applicatieflow: { ...applicatieflow, connecties: [...(applicatieflow.connecties ?? []), { id: generateId(), van, naar }] } })
    setConnectModalOpen(false)
  }
  function removeAppConnection(id) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    patch({ applicatieflow: { ...applicatieflow, connecties: (applicatieflow.connecties ?? []).filter((c) => c.id !== id) } })
  }
  function updateAppConnection(id, fields) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    patch({
      applicatieflow: { ...applicatieflow, connecties: (applicatieflow.connecties ?? []).map((c) => (c.id === id ? { ...c, ...fields } : c)) },
    })
  }

  // Koppelingsverzoeken van andere teams aan dít team: elk input-/output-item
  // elders dat naar dit team wijst en nog op akkoord wacht (zie
  // acceptLinkRequest/rejectLinkRequest in AppContext).
  // Zelfde bron als de reviewwachtrij in Instellingen (zie lib/koppelverzoeken).
  const incomingLinkRequests = useMemo(() => openKoppelverzoeken(teamWorkflows, teamId), [teamWorkflows, teamId])

  function handleAcceptRequest(req) {
    acceptLinkRequest(teamId, req.teamId, req.kind, req.item.id)
  }
  function handleRejectRequest(req) {
    rejectLinkRequest(teamId, req.teamId, req.kind, req.item.id)
  }

  // Verzoeken zichtbaar op de plek waar je kijkt, niet alleen in een apart
  // vak: een verzoek om een nieuw item wordt een schaduwkaart in de
  // betreffende kolom (canvas én lijst); een verzoek op een bestaand item
  // markeert dat item zelf. Een output-verzoek van team A wordt bij ons een
  // input, en andersom.
  const { canvasInputs, canvasOutputs } = useMemo(() => {
    const byTarget = new Map()
    const ghostInputs = []
    const ghostOutputs = []
    for (const req of incomingLinkRequests) {
      const proposerNaam = teamName(req.teamId)
      const ourKind = req.kind === 'output' ? 'input' : 'output'
      const targetId = req.kind === 'output' ? req.item.linkedInputId : req.item.linkedOutputId
      const targetList = ourKind === 'input' ? workflow.inputs : workflow.outputs
      const target = targetId ? targetList.find((i) => i.id === targetId) : null
      if (target) {
        byTarget.set(target.id, { ...req, proposerNaam })
        continue
      }
      const ghost = {
        ...emptyIoItem(ourKind),
        id: `verzoek:${req.teamId}:${req.item.id}`,
        label: req.item.label,
        flowtype: req.item.flowtype,
        bron_type: 'team',
        linkedTeam: req.teamId,
        _ghostRequest: { ...req, proposerNaam },
      }
      if (ourKind === 'input') ghostInputs.push(ghost)
      else ghostOutputs.push(ghost)
    }
    const decorate = (list) => list.map((i) => (byTarget.has(i.id) ? { ...i, _pendingRequest: byTarget.get(i.id) } : i))
    return {
      canvasInputs: [...decorate(workflow.inputs), ...ghostInputs],
      canvasOutputs: [...decorate(workflow.outputs), ...ghostOutputs],
    }
  }, [incomingLinkRequests, workflow.inputs, workflow.outputs, teamName])

  const applicatieflowSectionRef = useRef(null)
  const onOpenApplicatieflow = useCallback(() => {
    setBottomSectionTab('teamgegevens')
    setTeamDataOpenBlocks((prev) => ({ ...prev, verbindingen: true }))
    requestAnimationFrame(() => applicatieflowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])

  const viewFilters = useMemo(
    () => ({ showIO, showOverstijgend, riskFilterOn, showExternalTeams }),
    [showIO, showOverstijgend, riskFilterOn, showExternalTeams],
  )

  // Wat het canvas te zien krijgt: dezelfde dependency-filters/zoekopdracht
  // als de lijst eronder (zie filteredTeamDependencies), plus de losse
  // Weergeven-toggle voor geaccepteerd — zo blijven canvas en lijst altijd
  // consistent, ook al heeft de lijst daarbovenop nog het Actief/Geaccepteerd-
  // tabje.
  const canvasDependencies = useMemo(
    () => (showGeaccepteerd ? filteredTeamDependencies : filteredTeamDependencies.filter((d) => !d.geaccepteerd)),
    [filteredTeamDependencies, showGeaccepteerd],
  )

  // Zie handleSmartOrder: telt op bij 'Slim ordenen' en laat useMergedLayout
  // alle handmatig versleepte posities vergeten.
  const [layoutResetKey, setLayoutResetKey] = useState(0)
  const [{ nodes, edges, canvasWidth, canvasHeight }, onNodesChange] = useMergedLayout(computeWorkflowLayout, [
    canvasInputs,
    canvasOutputs,
    resolveLinkLabel,
    workflow.layout,
    workflow.annotations,
    workflow.annotationEdges,
    annotationHandlers,
    workflow.capacity,
    canvasDependencies,
    workflow.applications,
    splitApplicaties,
    workflow.applicatieflow?.connecties ?? [],
    t,
    language,
    onOpenApplicatieflow,
    appFilterQuery,
    collapsedLaneIds,
    toggleLaneCollapsed,
    viewFilters,
    setAppDetailId,
    workflow.stageNotes,
    layoutResetKey,
  ], { resetKey: layoutResetKey })

  // Signaal voor 'de zichtbare canvas-inhoud is veranderd, fit opnieuw' —
  // canvasWidth/-Height zijn de eigen, berekende afmetingen van de layout
  // (veranderen bij toevoegen/verwijderen van vrijwel alles: dependencies,
  // applicaties, IO, notities, Weergeven-toggles), nodes.length vangt de
  // rest. Bewust geen dependency op de nodes-array zelf: die verandert ook
  // tijdens slepen, wat dan bij elke muisbeweging opnieuw zou fitten.
  // De focuskeuze hoort in dit signaal: verbergen verandert het aantal
  // berekende kaarten niet, dus zonder deze toevoeging gaat het automatisch
  // passend maken niet af en blijft het beeld staan waar het stond.
  const canvasFitKey = `${nodes.length}:${canvasWidth}:${canvasHeight}:${splitApplicaties}:${canvasFocus?.id ?? ''}:${focusVerbergt}`

  // Lijnen worden pas duidelijk als niet-gerelateerde relaties wegvallen
  // zodra je iets aanwijst — zelfde hover-dim-patroon als HeatmapView.jsx
  // (hoverNodeId + een lichte stijl-laag over de edges, los van de layout-
  // berekening zelf zodat hoveren geen herberekening van nodes triggert).
  const [hoverNodeId, setHoverNodeId] = useState(null)
  // Focus (klik) wint van hover: zodra iets is aangeklikt blijft de
  // relatie-highlight staan zonder dat de muis erboven hoeft te blijven, en
  // dimt niet-gerelateerde content veel verder weg dan een losse hover.
  const focusNodeId = canvasFocus?.id ?? null
  // Focus kan ook een lijn zijn (klik op een edge, zie onEdgeClick): dan is
  // alleen die lijn zelf 'gerelateerd', plus de twee elementen die hij verbindt.
  const focusIsEdge = canvasFocus?.type === 'edge'
  const activeRelationId = focusNodeId ?? hoverNodeId
  const displayEdges = useMemo(() => {
    if (!activeRelationId) return edges
    return edges.map((edge) => {
      const related = focusIsEdge ? edge.id === activeRelationId : edge.source === activeRelationId || edge.target === activeRelationId
      const isAppConn = edge.id.startsWith('appconn:')
      return {
        ...edge,
        animated: isAppConn ? related : edge.animated,
        style: {
          ...edge.style,
          opacity: related ? 1 : (edge.style?.opacity ?? 1) * (focusNodeId ? 0.1 : 0.15),
          strokeWidth: related && focusNodeId ? (edge.style?.strokeWidth ?? 1) + 0.5 : edge.style?.strokeWidth,
        },
      }
    })
  }, [edges, activeRelationId, focusNodeId, focusIsEdge])
  // Niet-gerelateerde content-nodes (dependencies/IO/lanes/externe teams)
  // dimmen mee zodra er een focus actief is — structurele elementen (zones,
  // lane-achtergronden, workflowstappen) blijven altijd op volle sterkte,
  // die zijn de vaste oriëntatiepunten van het canvas.
  const displayNodes = useMemo(() => {
    if (!focusNodeId) return nodes
    const relatedIds = new Set([focusNodeId])
    edges.forEach((edge) => {
      if (focusIsEdge) {
        if (edge.id === focusNodeId) {
          relatedIds.add(edge.source)
          relatedIds.add(edge.target)
        }
        return
      }
      if (edge.source === focusNodeId) relatedIds.add(edge.target)
      if (edge.target === focusNodeId) relatedIds.add(edge.source)
    })
    return nodes.map((n) => {
      if (!DIMMABLE_NODE_TYPES.has(n.type)) return n
      if (relatedIds.has(n.id)) return n
      // `hidden` en niet uit de lijst filteren: fitViewAvoidingCorner slaat
      // verborgen kaarten over (lib/flowFit.js), dus het beeld wordt daarna
      // passend gemaakt op alleen wat je overhoudt. Eruit filteren zou React
      // Flow de node laten vergeten, inclusief zijn gemeten maat.
      if (focusVerbergt) return { ...n, hidden: true }
      return { ...n, style: { ...n.style, opacity: 0.3 } }
    })
  }, [nodes, edges, focusNodeId, focusIsEdge, focusVerbergt])

  // Canvas-filters: verbergt hele elementtypes ná de layoutberekening, zodat
  // je gericht op een deelverzameling kunt focussen (bv. voor een gesprek)
  // zonder dat de rest van het canvas herpositioneert — puur zichtbaarheid,
  // geen nieuwe layout.
  const canvasTypeFilters = useMemo(
    () => ({
      dependencyMarker: showDependencies,
      applicatieflowBanner: showApplicaties,
      capacityBadge: showCapaciteit,
      // Admin-sectie 'Ontwikkelflow' uit = de fasereeks van het canvas af,
      // net als de andere sectietoggles; de gebruikerstoggle komt daar bovenop.
      stage: showWorkflowfasen && adminSections.ontwikkelflow,
    }),
    [showDependencies, showApplicaties, showCapaciteit, showWorkflowfasen, adminSections.ontwikkelflow],
  )
  const filteredNodes = useMemo(() => {
    if (Object.values(canvasTypeFilters).every(Boolean)) return displayNodes
    return displayNodes.filter((n) => canvasTypeFilters[n.type] !== false)
  }, [displayNodes, canvasTypeFilters])
  const filteredEdges = useMemo(() => {
    // Zelfde controle als voorheen, maar nu ook op `hidden`: een lijn naar een
    // verborgen kaart zou anders in beeld blijven hangen en naar niets meer
    // lopen.
    const visibleIds = new Set(filteredNodes.filter((n) => !n.hidden).map((n) => n.id))
    if (visibleIds.size === filteredNodes.length && filteredNodes === displayNodes) return displayEdges
    return displayEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
  }, [displayEdges, filteredNodes, displayNodes])

  // Laatst bekende sleeppositie per node: reactflow stuurt tijdens het slepen
  // position-changes mét positie (dragging: true), maar de afsluitende change
  // (dragging: false) komt zónder positie — de vroegere check op 'positie én
  // dragging false' ging daardoor nooit af, en een versleepte node stond na
  // herladen weer op zijn berekende plek.
  const dragPositionsRef = useRef(new Map())
  function handleNodesChange(changes) {
    onNodesChange(changes)
    const nextLayout = { ...workflow.layout }
    let changed = false
    for (const c of changes) {
      if (c.type !== 'position') continue
      if (c.dragging && c.position) {
        dragPositionsRef.current.set(c.id, c.position)
        continue
      }
      if (c.dragging === false) {
        const position = c.position ?? dragPositionsRef.current.get(c.id)
        dragPositionsRef.current.delete(c.id)
        if (position) {
          nextLayout[c.id] = position
          changed = true
        }
      }
    }
    if (changed) patch({ layout: nextLayout })
  }

  function addAnnotation(kind, extra = {}) {
    patch({
      annotations: [...workflow.annotations, { id: generateId(), kind, text: '', color: activeColor, position: null, ...extra }],
    })
  }

  // Klik op een applicatie/IO-item/extern team opent eerst het compacte
  // focuspaneel i.p.v. meteen de volledige modal — die blijven bereikbaar
  // via de actieknop van dat paneel (zie buildFocusPanelContent). Een
  // dependency-marker is een uitzondering: die opent meteen de volledige
  // DependencyDetail, net als een klik in de Heatmap-lijst al deed.
  function handleNodeClick(_, node) {
    if (node.type === 'dependencyMarker') {
      setSelectedDependency(node.data.dependency)
      return
    }
    if (node.type === 'stage') {
      setStageNoteTarget(node.data.stage)
      return
    }
    if (FOCUSABLE_NODE_TYPES.has(node.type)) setCanvasFocus(node)
  }

  // Compacte hover-preview-inhoud per node-type — hergebruikt door alle
  // canvas-elementen (applicatie-lanes, dependencies, IO, workflowstappen,
  // externe teams) i.p.v. per type een eigen tooltip te bouwen.
  function buildCanvasTooltipContent(node) {
    if (node.type === 'dependencyMarker') {
      const dep = node.data.dependency
      const isApplicatieflow = dep.flowtype === 'applicatieflow'
      const flowLabel = dep.flowtype ? translateFlowtype(dep.flowtype, language) : t('teampage.flowtypeUndetermined')
      // Applicatieflow groepeert op applicatie(s), nooit op workflowstap;
      // Ontwikkelflow andersom — de twee assen mogen elkaar hier niet
      // beïnvloeden (zie ook computeWorkflowLayout hierboven).
      const scopeLabel = isApplicatieflow
        ? workflow.applications
            .filter((a) => (dep.applicatieIds ?? []).includes(a.id))
            .map((a) => a.naam || '—')
            .join(', ') || t('teampage.appOverstijgend')
        : WORKFLOW_STAP_TO_STAGE[dep.workflowStap]
          ? translateWorkflowStap(dep.workflowStap, language)
          : t('teampage.procesOverstijgend')
      return { title: dep.titel, sub: [flowLabel, scopeLabel, translateRiskLevel(node.data.risk.level, language)].filter(Boolean).join(' · ') }
    }
    if (node.type === 'applicatieflowBanner') {
      return { title: node.data.label, sub: `${t('teampage.zoneApplicatieflow')} · ${node.data.count} ${t('tooltip.dependencies')}` }
    }
    if (node.type === 'ioItem') {
      const parts = [node.data.kind === 'input' ? '→ IN' : 'OUT →', node.data.linkLabel, node.data.externalTeam ? `↔ ${node.data.externalTeam}` : null]
      return { title: node.data.label || '—', sub: parts.filter(Boolean).join(' · ') }
    }
    if (node.type === 'stage') {
      return {
        title: translateWorkflowStage(node.data.stage, language),
        sub: [t('teampage.zoneOntwikkelflow'), node.data.note || null].filter(Boolean).join(' · '),
      }
    }
    if (node.type === 'externalTeam') {
      return { title: node.data.naam, sub: t('teampage.legendExternalTeam') }
    }
    return null
  }

  // Rijkere inhoud voor het focuspaneel (klik) — zelfde per-type opbouw als
  // buildCanvasTooltipContent hierboven, maar met een meta-rijenlijst en een
  // actieknop die de bestaande volledige modal opent. Zo blijft canvas-klik
  // licht (paneel) terwijl de bestaande modals bereikbaar blijven.
  function buildFocusPanelContent(node) {
    // Een aangeklikte lijn (zie onEdgeClick): applicatiekoppeling of de lijn
    // van een input-/output-item. De opsomming wordt live uit de workflow
    // gelezen (niet uit de klik-snapshot), zodat een net toegevoegd punt
    // meteen in het paneel staat.
    if (node.type === 'edge') {
      const d = node.data ?? {}
      if (d.kind === 'appconn') {
        const conn = (workflow.applicatieflow?.connecties ?? []).find((c) => c.id === d.connId)
        return {
          typeLabel: t('teampage.edgeFocusTypeAppConn'),
          title: d.tooltipTitle,
          meta: [],
          punten: { items: conn?.punten ?? [], onChange: (next) => updateAppConnection(d.connId, { punten: next }) },
        }
      }
      if (d.kind === 'io') {
        // De lijn van een input vertrekt bij de input-node, die van een output
        // komt bij de output-node aan — daaruit volgt om welke lijst het gaat.
        const ioKind = node.source?.startsWith('input:') ? 'input' : 'output'
        const items = ioKind === 'input' ? workflow.inputs : workflow.outputs
        const item = items.find((i) => i.id === d.itemId)
        const save = ioKind === 'input' ? updateInput : updateOutput
        return {
          typeLabel: t('teampage.edgeFocusTypeIo'),
          title: item?.label || d.tooltipTitle || '—',
          meta: [{ label: t('teampage.focusFlowcontext'), value: d.tooltipSub }],
          punten: { items: item?.punten ?? [], onChange: (next) => save(d.itemId, { punten: next }) },
        }
      }
      return null
    }
    // Geen 'dependencyMarker'-tak hier: die node-type slaat het focuspaneel
    // altijd over en opent al direct de volledige DependencyDetail (zie
    // handleNodeClick) — dit paneel is dus uitsluitend voor de overige,
    // lichtere node-types hieronder.
    if (node.type === 'applicatieflowBanner') {
      const deps = node.data.deps ?? []
      const risks = deps.map((d) => calculateRisk(d))
      const highest = risks.reduce((best, r) => (!best || r.score > best.score ? r : best), null)
      const meta = [{ label: t('tooltip.dependencies'), value: String(deps.length) }]
      if (highest) meta.push({ label: t('tooltip.highestRisk'), value: translateRiskLevel(highest.level, language) })
      // 'overstijgend' rendert geen applicatieflowBanner meer (geen banner, geen
      // focus/klik) — hier blijven dus alleen 'app' en 'group' over.
      const typeLabel = node.data.accent === 'app' ? t('teampage.focusTypeApp') : t('teampage.applicatiegerelateerd')
      return {
        typeLabel,
        title: node.data.label,
        risk: highest,
        meta,
        actionLabel: node.data.accent === 'app' ? t('appflow.detailEdit') : t('teampage.focusGotoApplicatieflow'),
        onAction: node.data.onClick,
      }
    }
    if (node.type === 'ioItem') {
      // Koppelingsverzoek van een ander team (schaduwkaart of gemarkeerd
      // item): accepteren/afwijzen rechtstreeks vanuit het paneel.
      const request = node.data.request
      if (request) {
        const becomes = node.data.ghost
          ? node.data.kind === 'input'
            ? t('teampage.requestBecomesInput')
            : t('teampage.requestBecomesOutput')
          : t('teampage.requestLinksToItem', { target: node.data.label || '—' })
        return {
          typeLabel: t('teampage.focusTypeRequest'),
          title: request.item.label || '—',
          meta: [
            { label: t('teampage.requestFromTeam'), value: request.proposerNaam },
            { label: t('teampage.requestBecomes'), value: becomes },
            { label: t('teampage.focusFlowcontext'), value: node.data.meta },
          ],
          actions: [
            {
              label: t('teampage.linkRequestAccept'),
              primary: true,
              onClick: () => {
                handleAcceptRequest(request)
                setCanvasFocus(null)
              },
            },
            {
              label: t('teampage.linkRequestReject'),
              onClick: () => {
                handleRejectRequest(request)
                setCanvasFocus(null)
              },
            },
          ],
        }
      }
      const items = node.data.kind === 'input' ? workflow.inputs : workflow.outputs
      const item = items.find((i) => i.id === node.data.itemId)
      const save = node.data.kind === 'input' ? updateInput : updateOutput
      const meta = [{ label: t('teampage.focusFlowcontext'), value: node.data.meta }]
      if (node.data.linkLabel) meta.push({ label: t('teampage.focusLinkedFrom'), value: node.data.linkLabel })
      if (node.data.externalTeam) meta.push({ label: t('teampage.legendExternalTeam'), value: node.data.externalTeam })
      return {
        typeLabel: node.data.kind === 'input' ? t('teampage.focusTypeInput') : t('teampage.focusTypeOutput'),
        title: node.data.label || '—',
        meta,
        // Zelfde opsomming als op de lijn van dit item: kaart en lijn zijn
        // één relatie, dus één lijstje.
        punten: { items: item?.punten ?? [], onChange: (next) => save(node.data.itemId, { punten: next }) },
        actionLabel: t('appflow.detailEdit'),
        onAction: () => {
          if (item) setCanvasIoTarget({ kind: node.data.kind, item })
        },
      }
    }
    if (node.type === 'externalTeam') {
      return { typeLabel: t('teampage.legendExternalTeam'), title: node.data.naam, meta: [] }
    }
    if (node.type === 'capacityBadge') {
      const meta = []
      if (node.data.seniority) meta.push({ label: t('teampage.capacitySeniority'), value: translateSeniority(node.data.seniority, language) })
      return {
        typeLabel: t('teampage.capacityTitle'),
        title: node.data.functieNaam || '—',
        meta,
        actionLabel: t('appflow.detailEdit'),
        onAction: () => {
          const row = workflow.capacity.find((c) => c.id === node.data.rowId)
          if (row) setCapacityModalRow(row)
        },
      }
    }
    return null
  }

  // Lege tekst verwijdert de sleutel i.p.v. een lege string te bewaren — zo
  // blijft 'heeft dit team een toelichting?' een simpele key-aanwezigheid-
  // check, ook na export/import.
  function updateStageNote(stage, text) {
    const next = { ...(workflow.stageNotes ?? {}) }
    if (text.trim()) next[stage] = text
    else delete next[stage]
    patch({ stageNotes: next })
  }

  function addCapacityRow(row) {
    patch({ capacity: [...workflow.capacity, row] })
  }
  function updateCapacityRow(id, fields) {
    patch({ capacity: workflow.capacity.map((c) => (c.id === id ? { ...c, ...fields } : c)) })
  }
  function removeCapacityRow(id) {
    patch({ capacity: workflow.capacity.filter((c) => c.id !== id) })
  }

  // Neemt de naam mee: het record wordt pas aangelegd zodra die er is (zie
  // ApplicationNameModal). Zonder naam komt er niets bij.
  function addApplication(naam) {
    const schoon = (naam ?? '').trim()
    if (!schoon) return null
    const id = generateId()
    patch({ applications: [...workflow.applications, { id, naam: schoon }] })
    return id
  }
  function updateApplication(id, fields) {
    patch({ applications: workflow.applications.map((a) => (a.id === id ? { ...a, ...fields } : a)) })
  }
  // Wat hangt er nog aan deze applicatie? Wordt gebruikt om te bepalen of er
  // gewaarschuwd moet worden, en om na bevestiging alles op te ruimen.
  function applicationUsage(id) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    return {
      deps: teamDependencies.filter((d) => (d.applicatieIds ?? []).includes(id)),
      connecties: (applicatieflow.connecties ?? []).filter((c) => c.van === id || c.naar === id),
      ioItems: [...workflow.inputs, ...workflow.outputs].filter((i) => i.applicatieId === id),
    }
  }

  // Eén atomaire actie in de context: dependencies en teamWorkflows zitten in
  // dezelfde state-boom, dus twee losse updates zouden elkaar overschrijven.
  function removeApplication(id) {
    removeApplicationEverywhere(teamId, id)
    setAppToDelete(null)
  }

  // Alleen waarschuwen als er echt iets aan hangt — anders is een dialoog
  // onnodige wrijving bij het opruimen van een lege regel.
  function requestRemoveApplication(app) {
    const usage = applicationUsage(app.id)
    const total = usage.deps.length + usage.connecties.length + usage.ioItems.length
    if (total === 0) {
      removeApplication(app.id)
      return
    }
    setAppToDelete({ app, ...usage })
  }

  function saveAppDetail(appId, fields) {
    const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()
    patch({ applicatieflow: { ...applicatieflow, details: { ...applicatieflow.details, [appId]: { ...applicatieflow.details[appId], ...fields } } } })
  }

  function addInput(item) {
    patch({ inputs: [...workflow.inputs, item] })
  }
  function updateInput(id, fields) {
    patch({ inputs: workflow.inputs.map((i) => (i.id === id ? { ...i, ...fields } : i)) })
  }
  function removeInput(id) {
    unlinkCounterparts(teamId, 'input', id)
    patch({ inputs: workflow.inputs.filter((i) => i.id !== id) })
  }

  function addOutput(item) {
    patch({ outputs: [...workflow.outputs, item] })
  }
  function updateOutput(id, fields) {
    patch({ outputs: workflow.outputs.map((o) => (o.id === id ? { ...o, ...fields } : o)) })
  }
  function removeOutput(id) {
    unlinkCounterparts(teamId, 'output', id)
    patch({ outputs: workflow.outputs.filter((o) => o.id !== id) })
  }

  // Ketenniveau + meerdere teams: het datamodel kent maar één team per
  // dependency, dus 'meerdere teams' wordt hier veilig vertaald naar één
  // echte dependency per gekozen team (zelfde inhoud, eigen id, eigen
  // teamId). extraTeamIds is puur formulierstate en hoort niet in het
  // opgeslagen record.
  function handleSaveDependency(payload) {
    const { extraTeamIds, ...rest } = payload
    if (formState?.editing) {
      updateDependency(formState.editing.id, rest)
    } else if (extraTeamIds?.length) {
      // Eén enkele batch-aanroep i.p.v. addDependency N keer ná elkaar: die
      // zouden allemaal vanuit dezelfde state-snapshot bouwen en elkaar dus
      // overschrijven in plaats van optellen (zie addDependencies).
      addDependencies([rest, ...extraTeamIds.map((teamId) => ({ ...rest, teamId }))])
    } else {
      addDependency(rest)
    }
    setFormState(null)
  }

  function handleDeleteDependency(dep) {
    if (window.confirm(t('detail.confirmDelete', { titel: dep.titel }))) {
      deleteDependency(dep.id)
      setSelectedDependency(null)
    }
  }

  // Opent het formulier voorgevuld met een kopie van de gekozen dependency
  // (zelfde team als origineel, maar wijzigbaar) — pas bij opslaan ontstaat
  // er echt een nieuwe dependency.
  function handleDuplicateDependency(dep) {
    setSelectedDependency(null)
    setFormState({ editing: null, prefill: buildDuplicatePrefill(dep, t('form.duplicateTitlePrefix')) })
  }

  // Reset alleen de handmatig versleepte posities (niet de data zelf) zodat
  // useMergedLayout weer de vers berekende, uitgelijnde posities gebruikt —
  // een gebruiker-gestuurde actie, geen automatische herordening.
  function handleSmartOrder() {
    patch({ layout: {} })
    // Ook de niet-bewaarde, alleen in de canvas-state onthouden sleepposities
    // loslaten (useMergedLayout houdt die anders vast) — zonder dit deed de
    // knop niets voor nodes die in deze sessie versleept waren.
    setLayoutResetKey((k) => k + 1)
  }

  // Eén keer opgebouwd, tweemaal hergebruikt: dezelfde tab-knoppen staan nu
  // in de kop van zowel de Dependencies- als de Teamgegevens-kaart, zodat je
  // altijd kunt wisselen zonder dat het een los blokje boven de kaart is.
  const hasDependenciesTab = adminSections.dependencies
  const hasTeamDataTab =
    adminSections.applicaties || adminSections.applicatieflow || adminSections.input || adminSections.output || adminSections.capaciteit
  const tabSelector = (hasDependenciesTab || hasTeamDataTab) && (
    <div role="group" aria-label={t('teampage.bottomTabsLabel')} className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
      {hasDependenciesTab && (
        <button
          type="button"
          onClick={() => setBottomSectionTab('dependencies')}
          aria-pressed={bottomSectionTab === 'dependencies'}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            bottomSectionTab === 'dependencies' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('teampage.dependenciesTitle')}
        </button>
      )}
      {hasTeamDataTab && (
        <button
          type="button"
          onClick={() => setBottomSectionTab('teamgegevens')}
          aria-pressed={bottomSectionTab === 'teamgegevens'}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            bottomSectionTab === 'teamgegevens' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('teampage.teamDataTitle')}
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-4" ref={containerRef}>
      {(
        <>
          {/* Bovenaan de pagina, vóór het canvas: wie hier binnenkomt moet
              meteen zien dat er een koppelingsverzoek op akkoord wacht. De
              verzoeken staan daarnaast ook op het canvas en in de lijst. */}
          {incomingLinkRequests.length > 0 && !isFullscreen && (
            <LinkRequestsPanel
              requests={incomingLinkRequests}
              workflow={workflow}
              teamName={teamName}
              onAccept={handleAcceptRequest}
              onReject={handleRejectRequest}
              t={t}
            />
          )}
          <div
            className={
              isFullscreen
                // z-[45]: boven de vaste topbar (z-40) en zijbalk (z-30), maar
                // ónder de dialogen (z-50 en hoger: detailpaneel, formulieren,
                // item-modals) — met een hogere laag openden die in volledig-
                // schermmodus onzichtbaar achter dit vlak.
                ? 'fixed inset-0 top-0 left-0 z-[45] h-screen w-screen flex flex-col overflow-hidden bg-white p-4'
                : 'flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
            }
            // Vast berekend i.p.v. een losse vh-percentage op alleen het canvas:
            // deze hoogte geldt voor de hele kaart (kop + toolbar + canvas
            // samen), zodat de kaart nooit meer buiten de zichtbare hoofdvenster-
            // hoogte kan uitsteken. 97px = vaste topbar (73px) + onderste
            // pagina-marge (main's pb-6, 24px) — dezelfde ademruimte die
            // boven/opzij al gebruikt wordt. De canvas-rij eronder is flex-1 en
            // vult wat er, ná de eigen hoogte van kop/toolbar, overblijft: die
            // hoeft dus niet los te worden bijgehouden als de toolbar ooit
            // opnieuw van hoogte verandert.
            style={isFullscreen ? undefined : { height: 'clamp(760px, calc(100vh - 97px), 960px)' }}
          >
            <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                title={t('teampage.back')}
                className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 p-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {sidebarCollapsed && t('teampage.backCompact')}
              </button>
              <h3 className="truncate text-center text-sm font-semibold text-slate-800" title={teamNaam}>
                {teamNaam}
              </h3>
              {/* Help/legenda staat hier i.p.v. in de toolbar eronder — houdt de
                  teamnaam in het grid ook meteen echt gecentreerd t.o.v. de
                  hele rij, symmetrisch met de terugknop links. */}
              <div className="flex items-center gap-1">
                <div ref={legendRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setLegendOpen((v) => !v)}
                    aria-expanded={legendOpen}
                    title={t('teampage.helpAndLegend')}
                    aria-label={t('teampage.helpAndLegend')}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                      legendOpen
                        ? 'border-[#2a5f8a]/40 bg-[#2a5f8a]/10 text-[#2a5f8a]'
                        : 'border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    ?
                  </button>
                  {legendOpen && (
                    <div className="absolute right-0 top-9 z-20 w-60 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.legendRiskTitle')}</div>
                      <div className="mb-3 space-y-1">
                        {['Kritiek', 'Hoog', 'Gemiddeld', 'Laag'].map((level) => (
                          <div key={level} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${riskStyle(level).dot}`} />
                            {translateRiskLevel(level, language)}
                          </div>
                        ))}
                      </div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.legendDisplayTitle')}</div>
                      <div className="mb-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-0.5 w-4 shrink-0 bg-[#2a5f8a]" />
                          {t('teampage.legendConnection')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 shrink-0 rounded border border-[#2a5f8a] bg-[#eef4f9]" />
                          {t('teampage.legendInput')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 shrink-0 rounded border border-[#5c8a72] bg-[#eef6f1]" />
                          {t('teampage.legendOutput')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-[#5c8a72]/50 bg-[#5c8a72]/10" />
                          {t('teampage.legendOverstijgend')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-[#5c6b8a55] bg-white" />
                          {t('teampage.legendExternalTeam')}
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setLegendOpen(false)
                            startTour()
                          }}
                          className="mb-2 flex w-full items-center rounded-md px-1.5 py-1 text-left text-xs font-medium text-[#2a5f8a] hover:bg-[#2a5f8a]/5"
                        >
                          {t('teampage.helpTourStart')}
                        </button>
                        <div className="space-y-2">
                          <div>
                            <div className="text-[11px] font-semibold text-slate-600">{t('teampage.helpApplicatieflowTitle')}</div>
                            <p className="text-[11px] leading-relaxed text-slate-500">{t('teampage.helpApplicatieflowText')}</p>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-slate-600">{t('teampage.helpOntwikkelflowTitle')}</div>
                            <p className="text-[11px] leading-relaxed text-slate-500">{t('teampage.helpOntwikkelflowText')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              data-tour="toolbar"
              className="-mx-4 -mt-4 mb-3 space-y-2 rounded-t-xl border-b border-slate-200 bg-white px-4 py-2.5"
            >
              {/* Rij 1 — acties links (toevoegen/notitie), weergavetoggle rechts. */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(adminSections.applicaties || adminSections.input || adminSections.output || adminSections.capaciteit || adminSections.applicatieflow) && (
                    <div ref={addMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setAddMenuOpen((v) => !v)}
                        aria-expanded={addMenuOpen}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          addMenuOpen
                            ? 'border-[#2a5f8a]/40 bg-[#2a5f8a]/10 text-[#2a5f8a]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t('teampage.addMenuButton')} ▾
                      </button>
                      {addMenuOpen && (
                        <div className="absolute left-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
                          {adminSections.applicatieflow && (
                            <button
                              type="button"
                              onClick={() => {
                                setConnectModalOpen(true)
                                setAddMenuOpen(false)
                              }}
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {t('appflow.connectInline')}
                            </button>
                          )}
                          {adminSections.applicaties && (
                            <button
                              type="button"
                              onClick={() => {
                                setNieuweAppOpen(true)
                                setAddMenuOpen(false)
                              }}
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {t('teampage.applicationsAdd')}
                            </button>
                          )}
                          {adminSections.input && (
                            <button
                              type="button"
                              onClick={() => {
                                setCanvasIoTarget({ kind: 'input', item: null })
                                setAddMenuOpen(false)
                              }}
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {t('teampage.inputAdd')}
                            </button>
                          )}
                          {adminSections.output && (
                            <button
                              type="button"
                              onClick={() => {
                                setCanvasIoTarget({ kind: 'output', item: null })
                                setAddMenuOpen(false)
                              }}
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {t('teampage.outputAdd')}
                            </button>
                          )}
                          {adminSections.capaciteit && (
                            <button
                              type="button"
                              onClick={() => {
                                setCapacityModalRow(null)
                                setAddMenuOpen(false)
                              }}
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {t('teampage.capacityAdd')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {adminSections.aantekeningen && (
                    <>
                      <div className="h-5 w-px bg-slate-200" />
                      <button
                        type="button"
                        onClick={() => addAnnotation('note')}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        {t('teampage.toolbarNote')}
                      </button>
                      <ColorSwatchRow value={activeColor} onChange={setActiveColor} />
                    </>
                  )}
                </div>

                <div
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs shadow-inner"
                  role="group"
                  aria-label={t('teampage.viewModeLabel')}
                >
                  <button
                    type="button"
                    onClick={() => setSplitApplicaties(true)}
                    aria-pressed={splitApplicaties}
                    className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                      splitApplicaties ? 'bg-white text-[#2a5f8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('teampage.splitApplicaties')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitApplicaties(false)}
                    aria-pressed={!splitApplicaties}
                    className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                      !splitApplicaties ? 'bg-white text-[#2a5f8a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('teampage.viewMerged')}
                  </button>
                </div>
              </div>

              {/* Rij 2 — zoeken en filteren: zoekvelden links, Weergeven rechts. */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {adminSections.dependencies && (
                    <input
                      value={depSearchQuery}
                      onChange={(e) => setDepSearchQuery(e.target.value)}
                      placeholder={t('teampage.canvasDepSearchPlaceholder')}
                      className="h-8 w-48 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                    />
                  )}
                  {appFilterVisible && (
                    <input
                      value={appFilterQuery}
                      onChange={(e) => setAppFilterQuery(e.target.value)}
                      placeholder={t('teampage.appFilterPlaceholder')}
                      className="h-8 w-40 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {adminSections.dependencies && (
                    <DepFiltersDropdown
                      open={canvasDepFiltersOpen}
                      onToggle={() => setCanvasDepFiltersOpen((v) => !v)}
                      active={weergaveActive}
                      label={t('teampage.viewFiltersButton')}
                      viewToggles={[
                        { key: 'showIO', label: t('teampage.viewFilterShowIO'), value: showIO, onChange: setShowIO },
                        { key: 'showOverstijgend', label: t('teampage.viewFilterShowOverstijgend'), value: showOverstijgend, onChange: setShowOverstijgend },
                        { key: 'showGeaccepteerd', label: t('teampage.viewFilterShowGeaccepteerd'), value: showGeaccepteerd, onChange: setShowGeaccepteerd },
                        { key: 'riskFilterOn', label: t('teampage.viewFilterRiskOnly'), value: riskFilterOn, onChange: setRiskFilterOn },
                        { key: 'showExternalTeams', label: t('teampage.viewFilterShowExternalTeams'), value: showExternalTeams, onChange: setShowExternalTeams },
                        { key: 'showDependencies', label: t('teampage.viewFilterShowDependencies'), value: showDependencies, onChange: setShowDependencies },
                        { key: 'showApplicaties', label: t('teampage.viewFilterShowApplicaties'), value: showApplicaties, onChange: setShowApplicaties },
                        { key: 'showCapaciteit', label: t('teampage.viewFilterShowCapaciteit'), value: showCapaciteit, onChange: setShowCapaciteit },
                        ...(adminSections.ontwikkelflow
                          ? [{ key: 'showWorkflowfasen', label: t('teampage.viewFilterShowWorkflowfasen'), value: showWorkflowfasen, onChange: setShowWorkflowfasen }]
                          : []),
                        { key: 'focusVerbergt', label: t('teampage.viewFilterFocusVerbergt'), value: focusVerbergt, onChange: setFocusVerbergt },
                      ]}
                      flowtypeFilter={flowtypeFilter}
                      setFlowtypeFilter={setFlowtypeFilter}
                      scopeFilter={scopeFilter}
                      setScopeFilter={setScopeFilter}
                      appLabelFilter={appLabelFilter}
                      setAppLabelFilter={setAppLabelFilter}
                      applications={workflow.applications}
                      riskLevelFilter={riskLevelFilter}
                      setRiskLevelFilter={setRiskLevelFilter}
                      statusFilter={statusFilter}
                      setStatusFilter={setStatusFilter}
                      workflowStapFilter={workflowStapFilter}
                      setWorkflowStapFilter={setWorkflowStapFilter}
                      onClear={clearWeergave}
                      t={t}
                      language={language}
                    />
                  )}
                </div>

              </div>
            </div>

            {/* Canvas + focuspaneel als flex-rij (zelfde dockingpatroon als
                TeamFilterPanel naast HeatmapView) — het paneel is een vaste-
                breedte zijkolom die alleen verschijnt zodra canvasFocus
                gezet is, i.p.v. een overlay bovenop het canvas. flex-1 laat
                deze rij precies de ruimte vullen die de omsluitende kaart nog
                over heeft ná de kop- en toolbar-rijen erboven — vast bepaald
                door de kaarthoogte hierboven, niet los geschat. */}
            {/* Wat er niet op het canvas staat, en waarom — met een verwijzing
                naar de sectie in de lijst eronder. Zonder deze regel leek het
                canvas compleet terwijl er records ontbraken. */}
            {(legacyFlowDeps.length > 0 || verweesdeAppConnecties.length > 0) && (
              <p className="mb-2 rounded-md border border-[#9a3b2e]/20 bg-[#9a3b2e]/5 px-3 py-2 text-[11px] text-[#9a3b2e]">
                {t('teampage.nietOpCanvas', { count: legacyFlowDeps.length + verweesdeAppConnecties.length })}
                {legacyFlowDeps.length > 0 && ' ' + t('teampage.nietOpCanvasFlowtype', { count: legacyFlowDeps.length })}
                {verweesdeAppConnecties.length > 0 && ' ' + t('teampage.nietOpCanvasVerbinding', { count: verweesdeAppConnecties.length })}
              </p>
            )}

            <div className="flex min-h-0 flex-1 items-stretch gap-3">
              <div
                ref={canvasPaneRef}
                data-tour="workflow-canvas"
                className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
              >
                <ReactFlowProvider>
                  <PannableFlowCanvas
                    className="teamcanvas-flow"
                    nodes={filteredNodes}
                    edges={filteredEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    // Geen onConnect op dit canvas: lijnen leg je via de
                    // item-/applicatieformulieren, niet door te slepen — zonder
                    // deze prop kon je een verbindingslijn trekken die bij
                    // loslaten gewoon verdween.
                    nodesConnectable={false}
                    onNodesChange={handleNodesChange}
                    onNodeClick={handleNodeClick}
                    onPaneClick={() => setCanvasFocus(null)}
                    onNodeMouseEnter={(event, node) => {
                      setHoverNodeId(node.id)
                      const content = buildCanvasTooltipContent(node)
                      if (content) setCanvasHover({ x: event.clientX, y: event.clientY, ...content })
                    }}
                    onNodeMouseMove={(event) => setCanvasHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                    onNodeMouseLeave={() => {
                      setHoverNodeId(null)
                      setCanvasHover(null)
                    }}
                    // Relatielijnen zelf blijven bewust bijna onzichtbaar
                    // (lage opacity) totdat je erover hovert — dan pas zie je
                    // welk input/output-item bij welke fase/zone hoort.
                    // Klik op een lijn opent het focuspaneel met de
                    // bewerkbare opsomming van die koppeling (applicatie-
                    // koppeling of input-/outputlijn); structurele lijnen
                    // (fase→fase, capaciteit) hebben geen data.kind en doen
                    // niets.
                    onEdgeClick={(_, edge) => {
                      if (!edge.data?.kind) return
                      setCanvasFocus({ id: edge.id, type: 'edge', data: edge.data, source: edge.source, target: edge.target })
                    }}
                    onEdgeMouseEnter={(event, edge) => {
                      if (!edge.data?.tooltipTitle) return
                      setCanvasHover({
                        x: event.clientX,
                        y: event.clientY,
                        title: edge.data.tooltipTitle,
                        sub: edge.data.tooltipSub,
                        items: edge.data.punten ?? [],
                      })
                    }}
                    onEdgeMouseMove={(event) => setCanvasHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev))}
                    onEdgeMouseLeave={() => setCanvasHover(null)}
                    // Bewust géén minZoom in fitViewOptions: die klemde de
                    // automatische fit af terwijl de volledige inhoud verder moet
                    // uitzoomen, waardoor precies de buitenste kolommen — de
                    // input/output-kaarten — bij openen buiten beeld vielen. De
                    // minZoom-prop hieronder blijft de ondergrens voor handmatig
                    // uitzoomen.
                    fitViewOptions={{ padding: 0.06 }}
                    minZoom={0.4}
                    maxZoom={1.5}
                    backgroundColor="#d3dbe3"
                    hideControls
                    disableAutoFit
                  />
                  <TeamCanvasToolbar
                    onSmartOrder={handleSmartOrder}
                    onFullscreen={() => setIsFullscreen((v) => !v)}
                    isFullscreen={isFullscreen}
                    t={t}
                    paneRef={canvasPaneRef}
                    sidebarMode={sidebarMode}
                    fitKey={canvasFitKey}
                  />
                </ReactFlowProvider>
                {canvasHover && (
                  <FloatingTooltip x={canvasHover.x} y={canvasHover.y}>
                    <div className="font-semibold text-slate-50">{canvasHover.title}</div>
                    {canvasHover.sub && <div className="mt-0.5 text-[11px] text-slate-300">{canvasHover.sub}</div>}
                    {canvasHover.items?.length > 0 && (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-slate-200">
                        {canvasHover.items.map((p, i) => (
                          <li key={`${i}:${p}`}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </FloatingTooltip>
                )}
              </div>

              {canvasFocus &&
                (() => {
                  const content = buildFocusPanelContent(canvasFocus)
                  if (!content) return null
                  const style = content.risk ? riskStyle(content.risk.level) : null
                  return (
                    <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{content.typeLabel}</div>
                          <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">{content.title}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCanvasFocus(null)}
                          aria-label={t('teampage.focusPanelClose')}
                          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {style && (
                          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {translateRiskLevel(content.risk.level, language)}
                          </span>
                        )}
                        {content.meta?.length > 0 && (
                          <dl className="space-y-2">
                            {content.meta.map((row) => (
                              <div key={row.label}>
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{row.label}</dt>
                                <dd className="mt-0.5 text-xs text-slate-700">{row.value || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {content.punten && <PuntenEditor items={content.punten.items} onChange={content.punten.onChange} t={t} />}
                      </div>
                      {(content.onAction || content.actions?.length > 0) && (
                        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3">
                          {content.actions?.map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={action.onClick}
                              className={
                                action.primary
                                  ? 'w-full rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]'
                                  : 'w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'
                              }
                            >
                              {action.label}
                            </button>
                          ))}
                          {content.onAction && (
                            <button
                              type="button"
                              onClick={content.onAction}
                              className="w-full rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]"
                            >
                              {content.actionLabel}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>

            {/* (6) Capaciteitsregels zonder fase: eerder werden die bij het
                opbouwen van het canvas overgeslagen en waren ze nergens te
                vinden. Ze krijgen hier een eigen strook; het veld blijft in het
                formulier gewoon 'Fase (optioneel)' heten. */}
            {capaciteitZonderFase.length > 0 && (
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500">
                  {t('teampage.capaciteitZonderFase', { count: capaciteitZonderFase.length })}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {capaciteitZonderFase.map((row) => (
                    <li key={row.id} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                      {row.rol || '—'}
                      {row.aantal ? ` · ${row.aantal}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {nieuweAppOpen && (
            <ApplicationNameModal
              t={t}
              onClose={() => setNieuweAppOpen(false)}
              onCreate={(naam) => {
                setNieuweAppOpen(false)
                const id = addApplication(naam)
                if (id) setAppDetailId(id)
              }}
            />
          )}

          {appDetailId &&
            (() => {
              const app = workflow.applications.find((a) => a.id === appDetailId)
              if (!app) return null
              return (
                <ApplicationDetailModal
                  app={app}
                  data={workflow.applicatieflow?.details?.[appDetailId] ?? {}}
                  onSave={(fields) => saveAppDetail(appDetailId, fields)}
                  onRename={(naam) => updateApplication(appDetailId, { naam })}
                  onRequestRemove={() => {
                    setAppDetailId(null)
                    requestRemoveApplication(app)
                  }}
                  onClose={() => setAppDetailId(null)}
                  t={t}
                  language={language}
                />
              )
            })()}

          {appToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
              <div role="alertdialog" aria-modal="true" aria-labelledby="app-delete-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
                <h3 id="app-delete-title" className="text-sm font-semibold text-slate-900">
                  {t('teampage.appDeleteTitle', { naam: appToDelete.app.naam || '—' })}
                </h3>
                <p className="mt-2 text-xs text-slate-500">{t('teampage.appDeleteIntro')}</p>
                <ul className="mt-2.5 space-y-1 text-xs text-slate-700">
                  {appToDelete.deps.length > 0 && <li>• {t('teampage.appDeleteDeps', { count: appToDelete.deps.length })}</li>}
                  {appToDelete.connecties.length > 0 && <li>• {t('teampage.appDeleteConns', { count: appToDelete.connecties.length })}</li>}
                  {appToDelete.ioItems.length > 0 && <li>• {t('teampage.appDeleteIo', { count: appToDelete.ioItems.length })}</li>}
                </ul>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAppToDelete(null)}
                    className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t('form.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeApplication(appToDelete.app.id)}
                    className="rounded-md bg-[#9a3b2e] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#7f3125]"
                  >
                    {t('teampage.appDeleteConfirm')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {canvasIoTarget && (
            <IoItemModal
              kind={canvasIoTarget.kind}
              item={canvasIoTarget.item}
              onSave={(rawDraft) => {
                const isNew = !canvasIoTarget.item
                // Nieuwe/gewijzigde koppeling naar een ander team wordt een
                // verzoek aan dat team — zie withLinkStatus.
                // De canvas-/lijstitems dragen presentatievelden (_pendingRequest,
                // _ghostRequest) die nooit in het record thuishoren — anders bleef
                // een verzoek na akkoord 'voor altijd' in beeld staan.
                const { _pendingRequest: _pending, _ghostRequest: _ghost, ...cleanDraft } = rawDraft
                const draft = withLinkStatus(cleanDraft, canvasIoTarget.item)
                // Koppeling gewijzigd of losgelaten: ook de terugverwijzing bij het
                // andere team opruimen, anders bleef de ketenlijn vanuit dat team
                // staan (resolveChainEdges leest de input-kant).
                const original = canvasIoTarget.item
                if (
                  original?.linkedTeam &&
                  (original.linkedTeam !== draft.linkedTeam ||
                    (original.linkedOutputId ?? '') !== (draft.linkedOutputId ?? '') ||
                    (original.linkedInputId ?? '') !== (draft.linkedInputId ?? ''))
                ) {
                  unlinkCounterparts(teamId, canvasIoTarget.kind, original.id)
                }
                // Nieuw verzoek (of opnieuw ingediend na wijziging): als
                // gebeurtenis in de wijzigingenlog voor de analyse.
                if (draft.linkStatus === 'voorgesteld' && draft.linkVoorgesteldOp && draft.linkVoorgesteldOp !== (canvasIoTarget.item?.linkVoorgesteldOp ?? '')) {
                  logEvent({ teamId, type: 'link_proposed', titel: draft.label, details: { targetTeamId: draft.linkedTeam, kind: canvasIoTarget.kind } })
                }
                if (canvasIoTarget.kind === 'input') {
                  if (isNew) addInput(draft)
                  else updateInput(draft.id, draft)
                } else {
                  if (isNew) addOutput(draft)
                  else updateOutput(draft.id, draft)
                }
                setCanvasIoTarget(null)
              }}
              onRemove={
                canvasIoTarget.item
                  ? () => {
                      if (canvasIoTarget.kind === 'input') removeInput(canvasIoTarget.item.id)
                      else removeOutput(canvasIoTarget.item.id)
                      setCanvasIoTarget(null)
                    }
                  : undefined
              }
              onClose={() => setCanvasIoTarget(null)}
              teams={teams}
              currentTeamId={teamId}
              teamWorkflows={teamWorkflows}
              applications={workflow.applications}
              externalParties={externalParties}
              addExternalParty={addExternalParty}
              t={t}
              language={language}
            />
          )}

          {stageNoteTarget && (
            <StageNoteModal
              stage={stageNoteTarget}
              initialText={workflow.stageNotes?.[stageNoteTarget] ?? ''}
              onSave={(text) => {
                updateStageNote(stageNoteTarget, text)
                setStageNoteTarget(null)
              }}
              onRemove={() => {
                updateStageNote(stageNoteTarget, '')
                setStageNoteTarget(null)
              }}
              onClose={() => setStageNoteTarget(null)}
              t={t}
              language={language}
            />
          )}

          {adminSections.dependencies && bottomSectionTab === 'dependencies' && (
          <div data-tour="dependencies" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              {tabSelector}
              <button
                type="button"
                onClick={() => setFormState({ editing: null, defaultTeamId: teamId })}
                className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]"
              >
                {t('header.newDependency')}
              </button>
            </div>

            {adminSections.filters && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={depSearchQuery}
                onChange={(e) => setDepSearchQuery(e.target.value)}
                placeholder={t('teampage.canvasDepSearchPlaceholder')}
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
              />
              <DepFiltersDropdown
                open={depFiltersOpen}
                onToggle={() => setDepFiltersOpen((v) => !v)}
                active={depFiltersActive}
                flowtypeFilter={flowtypeFilter}
                setFlowtypeFilter={setFlowtypeFilter}
                scopeFilter={scopeFilter}
                setScopeFilter={setScopeFilter}
                appLabelFilter={appLabelFilter}
                setAppLabelFilter={setAppLabelFilter}
                applications={workflow.applications}
                riskLevelFilter={riskLevelFilter}
                setRiskLevelFilter={setRiskLevelFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                workflowStapFilter={workflowStapFilter}
                setWorkflowStapFilter={setWorkflowStapFilter}
                onClear={clearDepFilters}
                t={t}
                language={language}
              />
            </div>
            )}

            <div role="group" aria-label={t('teampage.depTabLabel')} className="mb-3 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDepTab('actief')}
                aria-pressed={depTab === 'actief'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${depTab === 'actief' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('teampage.depTabActief')} · {filteredTeamDependencies.length - acceptedDeps.length}
              </button>
              <button
                type="button"
                onClick={() => setDepTab('geaccepteerd')}
                aria-pressed={depTab === 'geaccepteerd'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${depTab === 'geaccepteerd' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('teampage.depTabGeaccepteerd')} · {acceptedDeps.length}
              </button>
              <button
                type="button"
                onClick={() => setDepTab('gesloten')}
                aria-pressed={depTab === 'gesloten'}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${depTab === 'gesloten' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('teampage.depTabGesloten')} · {closedTeamDeps.length}
              </button>
            </div>
            {depTab === 'gesloten' &&
              (closedTeamDeps.length === 0 ? (
                <p className="text-xs text-slate-400">{t('teampage.dependenciesEmptyClosed')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {closedTeamDeps.map((dep) => {
                    const risk = calculateRisk(dep)
                    const style = riskStyle(risk.level)
                    return (
                      <li key={dep.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedDependency(dep)}
                          className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <CategoryIcon categorie={dep.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-slate-700">{dep.titel}</span>
                          <span className="shrink-0 text-xs text-slate-400">{t('teampage.closedOnShort', { datum: dep.gesloten_op })}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>{translateRiskLevel(risk.level, language)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ))}
            {depTab !== 'gesloten' && visibleTeamDependencies.length === 0 && (
              <p className="text-xs text-slate-400">
                {depFiltersActive
                  ? t('teampage.dependenciesEmptyFiltered')
                  : depTab === 'geaccepteerd'
                    ? t('teampage.dependenciesEmptyAccepted')
                    : t('teampage.dependenciesEmpty')}
              </p>
            )}

            {legacyFlowDeps.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9a3b2e]">
                  {t('teampage.flowtypeUndetermined')} · {legacyFlowDeps.length}
                </h4>
                <p className="mb-1.5 mt-0.5 text-[11px] text-slate-400">{t('teampage.flowtypeUndeterminedHint')}</p>
                <ul className="divide-y divide-slate-100">
                  {legacyFlowDeps.map((dep) => (
                    <DependencyRow key={dep.id} dep={dep} showAppPicker={false} ctx={rowContext} />
                  ))}
                </ul>
              </div>
            )}

            {ontwikkelflowDeps.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('teampage.flowtypeOntwikkelflow')} · {ontwikkelflowDeps.length}
                </h4>
                <StageGroupedDeps deps={ontwikkelflowDeps} showAppPicker ctx={rowContext} />
              </div>
            )}

            {depTab !== 'gesloten' && (
              <div>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('teampage.flowtypeApplicatieflow')} · {applicatieflowDeps.length}
                </h4>
                {applicatieflowDeps.length === 0 && (
                  <p className="mb-2 text-xs text-slate-400">{t('teampage.applicatieflowEmpty')}</p>
                )}
                {workflow.applications
                  .filter((app) => !appFilterQuery.trim() || (app.naam || '').toLowerCase().includes(appFilterQuery.trim().toLowerCase()))
                  .map((app) => {
                    const appDeps = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).includes(app.id))
                    if (appDeps.length === 0) return null
                    return (
                      <div key={app.id} className="mb-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                        <div className="mb-1.5 text-xs font-semibold text-slate-600">{app.naam || '—'}</div>
                        <FlatDeps deps={appDeps} showAppPicker ctx={rowContext} />
                      </div>
                    )
                  })}
                {(() => {
                  const unlabeled = applicatieflowDeps.filter((d) => (d.applicatieIds ?? []).length === 0)
                  if (unlabeled.length === 0) return null
                  return (
                    <div className="mb-3 rounded-lg border border-dashed border-slate-200 p-2.5">
                      <div className="mb-1.5 text-xs font-semibold text-slate-500">{t('teampage.appOverstijgend')}</div>
                      <FlatDeps deps={unlabeled} showAppPicker ctx={rowContext} />
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
          )}

          {(adminSections.applicaties || adminSections.applicatieflow || adminSections.input || adminSections.output || adminSections.capaciteit) &&
            bottomSectionTab === 'teamgegevens' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">{tabSelector}</div>
            <div className="divide-y divide-slate-100">
              {adminSections.applicaties && (
                <TeamDataBlock
                  title={t('teampage.applicationsShort')}
                  count={t('teampage.itemsAddedCount', { count: workflow.applications.length })}
                  open={teamDataOpenBlocks.applicaties}
                  onToggle={() => toggleTeamDataBlock('applicaties')}
                  action={
                    <button
                      type="button"
                      onClick={() => setNieuweAppOpen(true)}
                      className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t('teampage.applicationsAdd')}
                    </button>
                  }
                >
                  {workflow.applications.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('teampage.applicationsEmpty')}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {workflow.applications.map((app) => {
                        const detail = workflow.applicatieflow?.details?.[app.id]
                        const hasDetail = Boolean(detail?.toelichting || detail?.risico_bij_uitval)
                        return (
                          <li key={app.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                            <ApplicationNameInput
                              key={app.id}
                              naam={app.naam}
                              onCommit={(naam) => updateApplication(app.id, { naam })}
                              placeholder={t('teampage.applicationsPlaceholder')}
                              ariaLabel={t('teampage.applicationNameLabel')}
                            />
                            {detail?.risico_bij_uitval === 'ja' && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a3b2e]" title={t('appflow.detailRisico')} />
                            )}
                            <button
                              type="button"
                              onClick={() => setAppDetailId(app.id)}
                              className={`shrink-0 text-xs font-medium ${hasDetail ? 'text-[#2a5f8a]' : 'text-slate-400 hover:text-[#2a5f8a]'}`}
                            >
                              {hasDetail ? t('appflow.detailEdit') : t('appflow.detailAdd')}
                            </button>
                            <button
                              type="button"
                              onClick={() => requestRemoveApplication(app)}
                              aria-label={t('teampage.remove')}
                              title={t('teampage.remove')}
                              className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-[#9a3b2e]/10 hover:text-[#9a3b2e]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </TeamDataBlock>
              )}

              {adminSections.applicatieflow && (
                <TeamDataBlock
                  title={t('teampage.connectionsShort')}
                  count={t('teampage.itemsAddedCount', { count: (workflow.applicatieflow?.connecties ?? []).length })}
                  open={teamDataOpenBlocks.verbindingen}
                  onToggle={() => toggleTeamDataBlock('verbindingen')}
                  blockRef={applicatieflowSectionRef}
                  action={
                    <button
                      type="button"
                      onClick={() => setConnectModalOpen(true)}
                      className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t('appflow.connectInline')}
                    </button>
                  }
                >
                  <p className="mb-2 text-xs text-slate-400">{t('appflow.questionTitle')}</p>
                  {(() => {
                    const connections = workflow.applicatieflow?.connecties ?? []
                    if (connections.length === 0) return <p className="text-xs text-slate-400">{t('appflow.connectionsEmpty')}</p>
                    const visible = connectionsExpanded ? connections : connections.slice(0, 5)
                    return (
                      <>
                        <ul className="space-y-1.5">
                          {visible.map((c) => {
                            const van = workflow.applications.find((a) => a.id === c.van)
                            const naar = workflow.applications.find((a) => a.id === c.naar)
                            return (
                              <li key={c.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                                <span className="font-medium text-slate-700">{van?.naam || '—'}</span>
                                <span className="text-slate-400">→</span>
                                <span className="font-medium text-slate-700">{naar?.naam || '—'}</span>
                                {(c.punten?.length ?? 0) > 0 && (
                                  <span className="text-xs text-slate-400">
                                    · {c.punten.length === 1 ? t('teampage.puntenCountOne') : t('teampage.puntenCount', { count: c.punten.length })}
                                  </span>
                                )}
                                <button type="button" onClick={() => removeAppConnection(c.id)} className="ml-auto text-xs text-[#9a3b2e] hover:underline">
                                  {t('teampage.remove')}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                        {connections.length > 5 && (
                          <button
                            type="button"
                            onClick={() => setConnectionsExpanded((v) => !v)}
                            className="mt-2 text-xs font-medium text-[#2a5f8a] hover:underline"
                          >
                            {connectionsExpanded ? t('appflow.showFewerConnections') : t('appflow.showAllConnections', { count: connections.length })}
                          </button>
                        )}
                      </>
                    )
                  })()}
                </TeamDataBlock>
              )}

              {adminSections.input && (
                <TeamDataBlock
                  title={t('teampage.inputShort')}
                  count={t('teampage.itemsAddedCount', { count: workflow.inputs.length })}
                  open={teamDataOpenBlocks.input}
                  onToggle={() => toggleTeamDataBlock('input')}
                  action={
                    <button
                      type="button"
                      onClick={() => setCanvasIoTarget({ kind: 'input', item: null })}
                      className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t('teampage.inputAdd')}
                    </button>
                  }
                >
                  <p className="mb-2 text-xs text-slate-400">{t('teampage.inputsTitle')}</p>
                  {canvasInputs.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('teampage.ioEmpty')}</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {canvasInputs.map((item) => (
                        <IoListRow
                          key={item.id}
                          item={item}
                          summary={item._ghostRequest ? '' : ioItemSummary(item, 'input', teams, teamWorkflows, workflow.applications, teamName, language, t)}
                          onOpen={() => setCanvasIoTarget({ kind: 'input', item })}
                          onAccept={handleAcceptRequest}
                          onReject={handleRejectRequest}
                          t={t}
                        />
                      ))}
                    </ul>
                  )}
                </TeamDataBlock>
              )}

              {adminSections.output && (
                <TeamDataBlock
                  title={t('teampage.outputShort')}
                  count={t('teampage.itemsAddedCount', { count: workflow.outputs.length })}
                  open={teamDataOpenBlocks.output}
                  onToggle={() => toggleTeamDataBlock('output')}
                  action={
                    <button
                      type="button"
                      onClick={() => setCanvasIoTarget({ kind: 'output', item: null })}
                      className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t('teampage.outputAdd')}
                    </button>
                  }
                >
                  <p className="mb-2 text-xs text-slate-400">{t('teampage.outputsTitle')}</p>
                  {canvasOutputs.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('teampage.ioEmpty')}</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {canvasOutputs.map((item) => (
                        <IoListRow
                          key={item.id}
                          item={item}
                          summary={item._ghostRequest ? '' : ioItemSummary(item, 'output', teams, teamWorkflows, workflow.applications, teamName, language, t)}
                          onOpen={() => setCanvasIoTarget({ kind: 'output', item })}
                          onAccept={handleAcceptRequest}
                          onReject={handleRejectRequest}
                          t={t}
                        />
                      ))}
                    </ul>
                  )}
                </TeamDataBlock>
              )}

              {adminSections.capaciteit && (
                <TeamDataBlock
                  title={t('teampage.capacityTitle')}
                  count={t('teampage.itemsAddedCount', { count: workflow.capacity.length })}
                  open={teamDataOpenBlocks.capaciteit}
                  onToggle={() => toggleTeamDataBlock('capaciteit')}
                  action={
                    <button
                      type="button"
                      onClick={() => setCapacityModalRow(null)}
                      className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t('teampage.capacityAdd')}
                    </button>
                  }
                >
                  {workflow.capacity.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('teampage.capacityEmpty')}</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {workflow.capacity.map((row) => {
                        const summary = [
                          row.seniority && translateSeniority(row.seniority, language),
                          row.fase && translateWorkflowStage(row.fase, language),
                        ]
                          .filter(Boolean)
                          .join(' · ')
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => setCapacityModalRow(row)}
                              className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              {row.risico_bij_uitval === 'ja' && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a3b2e]" title={t('teampage.capacityRisicoLabel')} />
                              )}
                              <span className="min-w-0 flex-1 truncate text-slate-700">{row.rol || '—'}</span>
                              {summary && <span className="shrink-0 text-xs text-slate-400">{summary}</span>}
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{row.aantal}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </TeamDataBlock>
              )}
            </div>
          </div>
          )}

          {capacityModalRow !== undefined && (
            <CapacityRowModal
              row={capacityModalRow}
              t={t}
              language={language}
              onClose={() => setCapacityModalRow(undefined)}
              onSave={(draft) => {
                if (capacityModalRow) updateCapacityRow(draft.id, draft)
                else addCapacityRow(draft)
                setCapacityModalRow(undefined)
              }}
              onRemove={
                capacityModalRow
                  ? () => {
                      removeCapacityRow(capacityModalRow.id)
                      setCapacityModalRow(undefined)
                    }
                  : undefined
              }
            />
          )}

          {connectModalOpen && (
            <ConnectApplicationsModal
              applications={workflow.applications}
              existingConnections={workflow.applicatieflow?.connecties ?? []}
              onSave={addAppConnection}
              onClose={() => setConnectModalOpen(false)}
              t={t}
            />
          )}
        </>
      )}

      {selectedDependency && (
        <DependencyDetail
          // Live opzoeken i.p.v. de gevangen state direct doorgeven: anders
          // toont het paneel na bv. Accepteren nog de oude (niet-
          // geaccepteerde) versie totdat het opnieuw geopend wordt.
          dependency={teamDependencies.find((d) => d.id === selectedDependency.id) ?? selectedDependency}
          onClose={() => setSelectedDependency(null)}
          onEdit={(dep) => {
            setSelectedDependency(null)
            setFormState({ editing: dep })
          }}
          onDelete={handleDeleteDependency}
          onDuplicate={handleDuplicateDependency}
        />
      )}

      {formState && (
        <DependencyForm
          defaultTeamId={formState.defaultTeamId}
          initialData={formState.editing}
          prefill={formState.prefill}
          onSave={handleSaveDependency}
          onCancel={() => setFormState(null)}
        />
      )}

      {tourActive && <SpotlightTour steps={tourSteps} onClose={handleTourClose} />}
    </div>
  )
}
