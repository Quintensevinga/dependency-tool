import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { APP_VERSION, BUILD_TIME, wisAlleLokaleOpslag } from '../lib/appVersion'
import { useLanguage } from '../context/LanguageContext'
import { splitsArchief } from '../lib/changeLog'
import { openKoppelverzoeken } from '../lib/koppelverzoeken'
import { applicatiesMetMeerdereTeams } from '../lib/applicatieregister'
import { STORAGE_KEY } from '../lib/storage'
import { exportDataAsJson, readJsonFile } from '../lib/export'
import { emptyTeamWorkflow, validateImportShape, telOnvolledigeNamen } from '../lib/storage'
import { useModalA11y } from '../lib/a11y'
import { BRON_TYPES } from '../data/constants'
import { translateBronType } from '../i18n/labels'
import AdminLogPage from './AdminLogPage'

// Het buildmoment is nuttiger als datum + tijd dan als kale ISO-tekst: er
// gaan er op een drukke dag meerdere versies live. Een leeg of onparseerbaar
// buildmoment (buiten een Vite-build) levert een streepje, geen 'Invalid
// Date'.
function formatBuildTime(iso, language) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(language === 'en' ? 'en-GB' : 'nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}

// Nog altijd geen echte beveiliging (client-side, dus zichtbaar in de
// gepubliceerde bundel voor wie er echt naar zoekt) — maar zo staat de waarde
// zelf tenminste niet als kale tekst in de broncode/repository. Zie
// .env.example en de README voor uitleg. 'ww' blijft de terugval zodat dit
// blijft werken zonder dat iedereen een .env-bestand hoeft aan te maken.
// || i.p.v. ??: een leeg gelaten VITE_ADMIN_PASSWORD= in .env zou anders een
// leeg wachtwoord opleveren, waarmee Admin zonder invoer ontgrendelt.
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'ww'

// Structuur voor de Admin-toggles: welke pagina's en secties zijn er, en hoe
// heten ze. Bewust hier als platte config i.p.v. door het volledige i18n-
// systeem (tientallen nieuwe sleutels voor wat een tijdelijk prototype-
// paneel is) — wel gewoon NL/EN, alleen niet via strings.js.
const ADMIN_PAGE_CONFIG = [
  {
    key: 'heatmap',
    labelNl: 'Heatmap',
    labelEn: 'Heatmap',
    sections: [
      { key: 'categorieUitleg', labelNl: 'Categorie-uitleg', labelEn: 'Category legend' },
      { key: 'selectiepaneel', labelNl: 'Selectiepaneel', labelEn: 'Selection panel' },
      { key: 'filters', labelNl: 'Filters', labelEn: 'Filters' },
    ],
  },
  {
    key: 'keten',
    labelNl: 'Ketenoverzicht',
    labelEn: 'Chain overview',
    sections: [
      { key: 'filters', labelNl: 'Filters', labelEn: 'Filters' },
      { key: 'legenda', labelNl: 'Legenda', labelEn: 'Legend' },
    ],
  },
  {
    key: 'dependencies',
    labelNl: 'Alle dependencies',
    labelEn: 'All dependencies',
    sections: [{ key: 'filters', labelNl: 'Filters', labelEn: 'Filters' }],
  },
  {
    key: 'analyse',
    labelNl: 'Analyse',
    labelEn: 'Analysis',
    sections: [],
  },
  {
    key: 'team',
    labelNl: 'Teampagina',
    labelEn: 'Team page',
    sections: [
      { key: 'applicatieflow', labelNl: 'Applicatieflow', labelEn: 'Application flow' },
      { key: 'ontwikkelflow', labelNl: 'Ontwikkelflow', labelEn: 'Development flow' },
      { key: 'applicaties', labelNl: 'Applicaties', labelEn: 'Applications' },
      { key: 'input', labelNl: 'Input', labelEn: 'Input' },
      { key: 'output', labelNl: 'Output', labelEn: 'Output' },
      { key: 'capaciteit', labelNl: 'Capaciteit', labelEn: 'Capacity' },
      { key: 'dependencies', labelNl: 'Dependencies van dit team', labelEn: "This team's dependencies" },
      { key: 'aantekeningen', labelNl: 'Aantekeningen', labelEn: 'Notes' },
      { key: 'filters', labelNl: 'Filters', labelEn: 'Filters' },
    ],
  },
]

// Wat er in een browser aan localStorage past. Vijf MB is de gangbare waarde
// in Chrome, Firefox en Safari, maar het is geen harde belofte: de browser mag
// het per profiel of per herkomst anders instellen. Daarom een zichtbare
// constante met deze kanttekening, en geen getal dat ergens verstopt zit.
const OPSLAG_BUDGET_BYTES = 5 * 1024 * 1024

// Boven deze vulling kleurt de regel en komt er een advies bij. Meten gebeurt
// op de lengte van de opgeslagen tekst maal twee, want browsers bewaren
// localStorage als UTF-16.
const OPSLAG_WAARSCHUWING = 0.6

function meetOpslag(changeLog) {
  let ruw = ''
  try {
    ruw = localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // Opslag geblokkeerd (privacymodus, site-data uit): dan valt er niets te
    // meten en tonen we de regel gewoon niet.
    return null
  }
  const totaal = ruw.length * 2
  if (totaal === 0) return null
  let log = 0
  try {
    log = JSON.stringify(changeLog ?? []).length * 2
  } catch {
    log = 0
  }
  return {
    totaal,
    log: Math.min(log, totaal),
    rest: Math.max(0, totaal - Math.min(log, totaal)),
    budget: OPSLAG_BUDGET_BYTES,
    deel: totaal / OPSLAG_BUDGET_BYTES,
  }
}

// Onder 1 MB in kB: met een decimaal in MB telt '0,1 + 0,5' zichtbaar niet op
// tot '0,5', en dan lijkt de uitsplitsing fout terwijl alleen de afronding
// grof was.
function toonOmvang(bytes, language) {
  const locale = language === 'en' ? 'en-GB' : 'nl-NL'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString(locale)} kB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`
}

// De subtabs van de Instellingenpagina. Vier ervan zitten achter de bestaande
// wachtwoordgrens; die grens verhuist ongewijzigd mee.
const SETTINGS_TABS = [
  { key: 'algemeen', labelKey: 'settings.tab.algemeen' },
  { key: 'teams', labelKey: 'settings.tab.teams' },
  { key: 'wachtrij', labelKey: 'settings.tab.wachtrij' },
  { key: 'data', labelKey: 'settings.tab.data' },
  { key: 'partijen', labelKey: 'settings.tab.partijen' },
  { key: 'applicaties', labelKey: 'settings.tab.applicaties' },
  { key: 'zichtbaarheid', labelKey: 'settings.tab.zichtbaarheid' },
  { key: 'log', labelKey: 'settings.tab.log' },
]
const ADMIN_TABS = ['partijen', 'applicaties', 'zichtbaarheid', 'log']

// Hoeveel regels de wachtrij toont voordat 'toon meer' het overneemt.
const WACHTRIJ_MAX = 50

// Moment van de laatste geslaagde JSON-export. Bewust een eigen, kleine
// localStorage-sleutel en NIET onderdeel van de hoofdstate: dit is geen
// inhoudelijke data en hoort niet mee in een export, een import of de
// schema-migratie daarvan. Zelfde patroon (en zelfde motivering) als
// NAV_STORAGE_KEY in App.jsx; lezen en schrijven binnen try/catch, want een
// browser met geblokkeerde opslag mag hier niet op klappen.
const LAST_EXPORT_KEY = 'dependency-insight:last-export'

function readLastExport() {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY)
    if (!raw) return null
    const datum = new Date(raw)
    return Number.isNaN(datum.getTime()) ? null : datum
  } catch {
    return null
  }
}

function writeLastExport() {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
  } catch {
    // Opslag vol of geblokkeerd — dan blijft de regel staan op de vorige
    // datum. Geen reden om de export zelf te laten mislukken.
  }
}

// Vanaf deze leeftijd, en ook bij 'nog nooit', wordt de regel gekleurd: alle
// data staat uitsluitend in deze ene browser en verdwijnt zonder waarschuwing
// bij het leegmaken van de browseropslag.
const EXPORT_WAARSCHUWING_DAGEN = 14

function dagenGeleden(datum) {
  return Math.floor((Date.now() - datum.getTime()) / 86400000)
}

function IconButton({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded p-1.5 hover:bg-slate-100 ${danger ? 'text-[#9a3b2e] hover:bg-[#9a3b2e]/10' : 'text-slate-500'}`}
    >
      {children}
    </button>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function UnarchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M9 13l3-2 3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ManageRow({ item, onRename, onArchive, onUnarchive, onDelete, blockedMessage }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.naam)
  const [blocked, setBlocked] = useState(false)

  function submitRename(e) {
    e.preventDefault()
    if (value.trim()) onRename(item.id, value.trim())
    setEditing(false)
  }

  function handleDelete() {
    const ok = onDelete(item.id)
    if (!ok) {
      setBlocked(true)
      window.setTimeout(() => setBlocked(false), 4000)
    }
  }

  if (editing) {
    return (
      <form onSubmit={submitRename} className="flex items-center gap-1.5 py-1">
        <label htmlFor={`rename-${item.id}`} className="sr-only">
          {t('settings.rename')}
        </label>
        <input
          id={`rename-${item.id}`}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submitRename}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
        />
        <button type="submit" className="shrink-0 text-xs font-medium text-[#2a5f8a] hover:underline">
          {t('settings.save')}
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className={`truncate text-xs ${item.actief ? 'text-slate-700' : 'text-slate-400 line-through'}`} title={item.naam}>
        {item.naam}
        {!item.actief && <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium normal-case text-slate-500 no-underline">{t('settings.archived')}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <IconButton
          label={t('settings.rename')}
          onClick={() => {
            // Altijd vanuit de actuele naam starten: deze rij blijft gemount
            // (key = id), dus een eerdere useState-startwaarde kan verouderd
            // zijn na een hernoeming elders — en zou bij blur die oude naam
            // weer terugzetten.
            setValue(item.naam)
            setEditing(true)
          }}
        >
          <EditIcon />
        </IconButton>
        {item.actief ? (
          <IconButton label={t('settings.archive')} onClick={() => onArchive(item.id)}>
            <ArchiveIcon />
          </IconButton>
        ) : (
          <IconButton label={t('settings.unarchive')} onClick={() => onUnarchive(item.id)}>
            <UnarchiveIcon />
          </IconButton>
        )}
        <IconButton label={t('settings.delete')} onClick={handleDelete} danger>
          <DeleteIcon />
        </IconButton>
      </span>
      {blocked && <p className="w-full text-[11px] text-[#9a3b2e]">{blockedMessage}</p>}
    </div>
  )
}

function ManageSection({ title, items, addPlaceholder, onAdd, onRename, onArchive, onUnarchive, onDelete, blockedMessage, helper, defaultOpen }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [newName, setNewName] = useState('')

  function submitAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    onAdd(newName)
    setNewName('')
  }

  const sorted = [...items].sort((a, b) => Number(b.actief) - Number(a.actief) || a.naam.localeCompare(b.naam))

  return (
    <div className="rounded-md border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2">
          {helper && <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{helper}</p>}
          <div className="max-h-48 divide-y divide-slate-50 overflow-y-auto">
            {sorted.length === 0 && <p className="py-1.5 text-xs text-slate-400">{t('settings.empty')}</p>}
            {sorted.map((item) => (
              <ManageRow
                key={item.id}
                item={item}
                onRename={onRename}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                blockedMessage={blockedMessage}
              />
            ))}
          </div>
          <form onSubmit={submitAdd} className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
            <label htmlFor={`add-${title}`} className="sr-only">
              {addPlaceholder}
            </label>
            <input
              id={`add-${title}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={addPlaceholder}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-xs text-white hover:bg-[#1f4a6c]">
              {t('settings.add')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// Rij voor één externe partij — zelfde iconen/opmaak als ManageRow, maar met
// een derde status (in_afwachting) en accepteren/weigeren i.p.v. alleen
// archiveren. Weigeren verwijdert het record bewust niet (zie
// rejectExternalParty in AppContext.jsx) — referenties elders in de app
// blijven zo zichtbaar met een waarschuwing i.p.v. spoorloos te verdwijnen.
function PartyRow({ item, onRename, onApprove, onReject, onDelete, blockedMessage }) {
  const { t, language } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.naam)
  const [blocked, setBlocked] = useState(false)

  function submitRename(e) {
    e.preventDefault()
    if (value.trim()) onRename(item.id, value.trim())
    setEditing(false)
  }

  function handleDelete() {
    const ok = onDelete(item.id)
    if (!ok) {
      setBlocked(true)
      window.setTimeout(() => setBlocked(false), 4000)
    }
  }

  if (editing) {
    return (
      <form onSubmit={submitRename} className="flex items-center gap-1.5 py-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submitRename}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
        />
        <button type="submit" className="shrink-0 text-xs font-medium text-[#2a5f8a] hover:underline">
          {t('settings.save')}
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className={`truncate text-xs ${item.status === 'geweigerd' ? 'text-slate-400 line-through' : 'text-slate-700'}`} title={item.naam}>
        {item.naam}
        <span className="ml-1.5 text-[10px] font-medium normal-case text-slate-400">({translateBronType(item.type, language)})</span>
        {item.status === 'in_afwachting' && (
          <span className="ml-1.5 rounded bg-[#2a5f8a]/10 px-1 py-0.5 text-[10px] font-medium normal-case text-[#2a5f8a] no-underline">
            {t('party.pending')}
          </span>
        )}
        {item.status === 'geweigerd' && (
          <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium normal-case text-slate-500 no-underline">
            {t('party.rejected')}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {item.status === 'in_afwachting' && (
          <>
            <button
              type="button"
              onClick={() => onApprove(item.id)}
              className="rounded p-1.5 text-[#2a5f8a] hover:bg-[#2a5f8a]/10"
              aria-label={t('party.approve')}
              title={t('party.approve')}
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => onReject(item.id)}
              className="rounded p-1.5 text-[#9a3b2e] hover:bg-[#9a3b2e]/10"
              aria-label={t('party.reject')}
              title={t('party.reject')}
            >
              ✕
            </button>
          </>
        )}
        <IconButton
          label={t('settings.rename')}
          onClick={() => {
            setValue(item.naam)
            setEditing(true)
          }}
        >
          <EditIcon />
        </IconButton>
        <IconButton label={t('settings.delete')} onClick={handleDelete} danger>
          <DeleteIcon />
        </IconButton>
      </span>
      {blocked && <p className="w-full text-[11px] text-[#9a3b2e]">{blockedMessage}</p>}
    </div>
  )
}

function PartySection({ items, onAdd, onRename, onApprove, onReject, onDelete }) {
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('stakeholder')

  function submitAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    onAdd(newName, newType)
    setNewName('')
  }

  // In afwachting eerst — dat is precies waar een admin actie op moet nemen.
  const sorted = [...items].sort((a, b) => {
    const rank = { in_afwachting: 0, actief: 1, geweigerd: 2 }
    return rank[a.status] - rank[b.status] || a.naam.localeCompare(b.naam)
  })

  return (
    <div className="rounded-md border border-slate-200">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="text-xs font-semibold text-slate-700">{t('settings.parties.title')}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2">
          <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{t('settings.parties.helper')}</p>
          <div className="max-h-48 divide-y divide-slate-50 overflow-y-auto">
            {sorted.length === 0 && <p className="py-1.5 text-xs text-slate-400">{t('settings.empty')}</p>}
            {sorted.map((item) => (
              <PartyRow
                key={item.id}
                item={item}
                onRename={onRename}
                onApprove={onApprove}
                onReject={onReject}
                onDelete={onDelete}
                blockedMessage={t('settings.parties.deleteBlocked')}
              />
            ))}
          </div>
          <form onSubmit={submitAdd} className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('settings.parties.addPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
            >
              {BRON_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {translateBronType(bt, language)}
                </option>
              ))}
            </select>
            <button type="submit" className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-xs text-white hover:bg-[#1f4a6c]">
              {t('settings.add')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// De twee wachtrijen die de app kent, op een hoop. Ze stonden op plekken die
// niets met elkaar te maken hadden: partijen in een sectie die standaard dicht
// is (dus je moest 'm opendoen om te weten of er iets lag), en
// koppelingsverzoeken alleen op de teampagina van het ontvangende team -- er was
// organisatiebreed geen totaal.
//
// Eén bron voor twee plekken: deze hook voedt zowel de teller in de zijbalk als
// de subtab zelf. Een derde teller elders zou onvermijdelijk uit de pas lopen.
export function useReviewwachtrij() {
  const { externalParties, teamWorkflows } = useAppContext()
  return useMemo(() => {
    const partijen = (externalParties ?? [])
      .filter((party) => party.status === 'in_afwachting')
      .map((party) => ({ soort: 'partij', id: `partij:${party.id}`, party }))
    const verzoeken = openKoppelverzoeken(teamWorkflows).map((req) => ({
      soort: 'koppelverzoek',
      id: `verzoek:${req.teamId}:${req.kind}:${req.item.id}`,
      req,
    }))
    return [...partijen, ...verzoeken]
  }, [externalParties, teamWorkflows])
}

function Reviewwachtrij() {
  const { teamName, approveExternalParty, rejectExternalParty, acceptLinkRequest, rejectLinkRequest } = useAppContext()
  const { t } = useLanguage()
  const items = useReviewwachtrij()
  const [filter, setFilter] = useState('alles')
  const [alles, setAlles] = useState(false)

  const gefilterd = items.filter((x) => filter === 'alles' || x.soort === filter)
  const zichtbaar = alles ? gefilterd : gefilterd.slice(0, WACHTRIJ_MAX)

  const knop = (waarde, label, aantal) => (
    <button
      key={waarde}
      type="button"
      onClick={() => setFilter(waarde)}
      aria-pressed={filter === waarde}
      className={`rounded px-2 py-1 text-xs transition-colors ${filter === waarde ? 'bg-[#2a5f8a] text-white' : 'text-slate-600 hover:text-slate-900'}`}
    >
      {label} {aantal}
    </button>
  )

  if (items.length === 0) return <p className="text-xs text-slate-400">{t('settings.queue.empty')}</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-medium text-slate-600">{t('settings.queue.count', { count: gefilterd.length, total: items.length })}</span>
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label={t('settings.queue.filter')}>
          {knop('alles', t('settings.queue.filterAll'), items.length)}
          {knop('partij', t('settings.queue.filterParties'), items.filter((x) => x.soort === 'partij').length)}
          {knop('koppelverzoek', t('settings.queue.filterRequests'), items.filter((x) => x.soort === 'koppelverzoek').length)}
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {zichtbaar.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
            <span className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
              {x.soort === 'partij' ? t('settings.queue.kindParty') : t('settings.queue.kindRequest')}
            </span>
            {x.soort === 'partij' ? (
              <>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={x.party.naam}>
                  {x.party.naam}
                  {x.party.voorgesteldDoorTeamId && (
                    <span className="ml-1.5 text-slate-400">· {teamName(x.party.voorgesteldDoorTeamId)}</span>
                  )}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => approveExternalParty(x.party.id)} className="text-xs font-medium text-[#2a5f8a] hover:underline">
                    {t('party.approve')}
                  </button>
                  <button type="button" onClick={() => rejectExternalParty(x.party.id)} className="text-xs font-medium text-[#9a3b2e] hover:underline">
                    {t('party.reject')}
                  </button>
                </span>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={x.req.item.label}>
                  {x.req.item.label || '—'}
                  <span className="ml-1.5 text-slate-400">
                    · {teamName(x.req.teamId)} → {teamName(x.req.ontvangerId)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  {/* Dezelfde acties als op de teampagina, met dezelfde
                      argumenten: ontvangend team, verzendend team, soort, item. */}
                  <button
                    type="button"
                    onClick={() => acceptLinkRequest(x.req.ontvangerId, x.req.teamId, x.req.kind, x.req.item.id)}
                    className="text-xs font-medium text-[#2a5f8a] hover:underline"
                  >
                    {t('teampage.linkRequestAccept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectLinkRequest(x.req.ontvangerId, x.req.teamId, x.req.kind, x.req.item.id)}
                    className="text-xs font-medium text-[#9a3b2e] hover:underline"
                  >
                    {t('teampage.linkRequestReject')}
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      {gefilterd.length > WACHTRIJ_MAX && (
        <button type="button" onClick={() => setAlles((v) => !v)} className="text-[11px] font-medium text-[#2a5f8a] hover:underline">
          {alles ? t('lijst.toonMinder') : t('lijst.toonMeer', { count: gefilterd.length - WACHTRIJ_MAX })}
        </button>
      )}
    </div>
  )
}

// Het centrale applicatieregister, en de eenmalige omzetting ernaartoe.
//
// De omzetting is onomkeerbaar: applicaties worden samengevoegd en ids worden
// overal omgehangen. Daarom drie drempels, en alle drie met opzet:
//   1. een droogloop die alleen rapporteert en niets wegschrijft;
//   2. het rapport wordt getoond voordat er iets kan gebeuren;
//   3. pas daarna een aparte, expliciete bevestiging.
// Twijfelgevallen worden gemeld en nooit automatisch samengevoegd.
function Applicatieregister({ register, teamWorkflows, teams, planFn, voerUitFn, onRename, onStatus, t }) {
  const [rapport, setRapport] = useState(null)
  const [klaar, setKlaar] = useState(null)
  const [bewerkt, setBewerkt] = useState(null)
  const [naam, setNaam] = useState('')

  const gedeeld = applicatiesMetMeerdereTeams({ teamWorkflows, applicatieregister: register })
  const teamNaam = (id) => teams.find((tm) => tm.id === id)?.naam ?? id

  return (
    <div className="space-y-3">
      {register.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-slate-500">{t('settings.apps.leeg')}</p>
      ) : (
        <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {register.map((app) => {
            const teamsVanApp = gedeeld.find((g) => g.id === app.id)
            return (
              <div key={app.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                {bewerkt === app.id ? (
                  <form
                    className="flex flex-1 items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      onRename(app.id, naam)
                      setBewerkt(null)
                    }}
                  >
                    <input
                      autoFocus
                      value={naam}
                      onChange={(e) => setNaam(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                    />
                    <button type="submit" className="shrink-0 text-xs font-medium text-[#2a5f8a] hover:underline">
                      {t('settings.save')}
                    </button>
                  </form>
                ) : (
                  <>
                    <span className={`min-w-0 flex-1 truncate text-xs ${app.status === 'actief' ? 'text-slate-700' : 'text-slate-400 line-through'}`} title={app.naam}>
                      {app.naam}
                      {teamsVanApp && <span className="ml-1.5 text-[10px] text-[#2a5f8a]">{t('settings.apps.teams', { count: teamsVanApp.aantalTeams })}</span>}
                    </span>
                    <span className="flex shrink-0 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setNaam(app.naam)
                          setBewerkt(app.id)
                        }}
                        className="font-medium text-slate-500 hover:underline"
                      >
                        {t('settings.rename')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onStatus(app.id, app.status === 'actief' ? 'vervallen' : 'actief')}
                        className="font-medium text-slate-500 hover:underline"
                      >
                        {app.status === 'actief' ? t('settings.apps.vervallen') : t('settings.apps.actief')}
                      </button>
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-semibold text-slate-700">{t('settings.apps.omzettingTitel')}</p>
        <p className="text-[11px] leading-relaxed text-slate-500">{t('settings.apps.omzettingUitleg')}</p>
        <button
          type="button"
          onClick={() => {
            setKlaar(null)
            setRapport(planFn())
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('settings.apps.droogloop')}
        </button>

        {rapport && (
          <div className="space-y-2 rounded-md border border-[#c98a2e]/40 bg-[#c98a2e]/10 p-3">
            <p className="text-[11px] font-medium text-[#8a5a12]">
              {t('settings.apps.rapportKop', { totaal: rapport.totaalApplicaties, samen: rapport.samenvoegingen.length, weg: rapport.verdwijnendeRecords })}
            </p>
            {rapport.samenvoegingen.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-slate-700">
                {rapport.samenvoegingen.map((g) => (
                  <li key={g.sleutel}>
                    <b>{g.naam}</b> — {g.records.length} records bij {g.teams.map(teamNaam).join(', ')}
                  </li>
                ))}
              </ul>
            )}
            {rapport.twijfel.length > 0 && (
              <>
                <p className="text-[11px] font-medium text-[#8a5a12]">{t('settings.apps.twijfel')}</p>
                <ul className="space-y-0.5 text-[11px] text-slate-700">
                  {rapport.twijfel.map((tw) => (
                    <li key={tw.namen.join('|')}>{tw.namen.join('  ·  ')}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-[11px] leading-relaxed text-[#8a5a12]">{t('settings.apps.exportEerst')}</p>
            {rapport.samenvoegingen.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const uit = voerUitFn()
                    setKlaar(uit)
                    setRapport(null)
                  }}
                  className="rounded-md bg-[#9a3b2e] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#7e2f24]"
                >
                  {t('settings.apps.uitvoeren')}
                </button>
                <button type="button" onClick={() => setRapport(null)} className="text-xs font-medium text-slate-500 hover:underline">
                  {t('form.cancel')}
                </button>
              </div>
            )}
          </div>
        )}

        {klaar && (
          <p className="text-[11px] leading-relaxed text-slate-600">
            {t('settings.apps.gedaan', { samen: klaar.samenvoegingen.length, weg: klaar.verdwijnendeRecords })}
          </p>
        )}
      </div>
    </div>
  )
}

export default function SettingsPanel({ onClose, onExportPng, exportingPng }) {
  const {
    alleDependencies,
    teams,
    teamWorkflows,
    schemaVersion,
    usingMockData,
    loadMockData,
    clearAllData,
    updateTeamWorkflow,
    importState,
    addTeam,
    renameTeam,
    archiveTeam,
    unarchiveTeam,
    deleteTeam,
    adminSettings,
    updateAdminSettings,
    verwijderLogregels,
    applicatieregister,
    applicatieregisterPlan,
    voerApplicatieregisterOmzettingUit,
    hernoemApplicatie,
    zetApplicatieStatus,
    externalParties,
    changeLog,
    addExternalParty,
    renameExternalParty,
    approveExternalParty,
    rejectExternalParty,
    deleteExternalParty,
  } = useAppContext()
  const { t, language } = useLanguage()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const activeTeams = teams.filter((tm) => tm.actief)
  const [clearTeamId, setClearTeamId] = useState('')
  // De gekozen teampagina om te wissen moet een actief team zijn: is het
  // gekozen team intussen (hierboven, in 'Teams beheren') gearchiveerd, dan
  // toonde de keuzelijst het eerste actieve team terwijl de wisknop stil
  // nog op het gearchiveerde team stond.
  const effectiveClearTeamId = activeTeams.some((tm) => tm.id === clearTeamId) ? clearTeamId : (activeTeams[0]?.id ?? '')
  const [confirmingClearTeam, setConfirmingClearTeam] = useState(false)
  const [importError, setImportError] = useState('')
  // Ingelezen en goedgekeurd bestand dat op bevestiging wacht. Zolang dit
  // gevuld is, is er nog niets gewijzigd — annuleren gooit het gewoon weg.
  const [pendingImport, setPendingImport] = useState(null)
  // Uitkomst van de laatste import: hoeveel records er zonder naam binnenkwamen.
  const [importOnvolledig, setImportOnvolledig] = useState(null)
  const [lastExport, setLastExport] = useState(() => readLastExport())
  const lastExportWaarschuwt = !lastExport || dagenGeleden(lastExport) >= EXPORT_WAARSCHUWING_DAGEN
  const fileInputRef = useRef(null)
  const panelRef = useRef(null)
  // Sessie-only: geen 'echte' auth, gewoon een tijdelijke prototype-
  // afscherming. Ontgrendelt opnieuw bij elke page load/heropen — geen
  // localStorage-vlag, dat zou de suggestie van echte beveiliging wekken.
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminPasswordError, setAdminPasswordError] = useState(false)

  function handleAdminUnlock(e) {
    e.preventDefault()
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true)
      setAdminPasswordError(false)
      setAdminPasswordInput('')
    } else {
      setAdminPasswordError(true)
    }
  }

  function togglePage(pageKey) {
    updateAdminSettings({ ...adminSettings, pages: { ...adminSettings.pages, [pageKey]: !adminSettings.pages[pageKey] } })
  }

  function toggleSection(pageKey, sectionKey) {
    updateAdminSettings({
      ...adminSettings,
      sections: {
        ...adminSettings.sections,
        [pageKey]: { ...adminSettings.sections[pageKey], [sectionKey]: !adminSettings.sections[pageKey][sectionKey] },
      },
    })
  }

  useModalA11y({ open: true, onClose, containerRef: panelRef })

  // Eén plek die bepaalt wat er in een export gaat, zodat de automatische
  // veiligheidskopie vóór een import gegarandeerd dezelfde inhoud heeft als
  // een handmatige export. Twee losse payload-opbouwen zouden op termijn uit
  // elkaar lopen, en dan is de kopie stilzwijgend onvolledig.
  function exportPayload() {
    // Externe partijen en wijzigingenlog horen bij de export: zonder die
    // twee verloor een back-up/overdracht stilzwijgend de partij-
    // goedkeuringen en de admin-log (import las ze wél al).
    // alleDependencies (incl. gesloten) i.p.v. de operationele lijst: een
    // back-up die de gesloten records met hun historie weglaat, is geen
    // back-up — na terugzetten waren het tabblad 'Gesloten' en de
    // sluitingshistorie op de analysepagina leeg.
    return { teams, dependencies: alleDependencies, teamWorkflows, externalParties, changeLog, usingMockData, schemaVersion, adminSettings }
  }

  const [tab, setTab] = useState('algemeen')
  const wachtrijAan = adminSettings.pages.wachtrij !== false
  const wachtendeItems = useReviewwachtrij()
  // Staat de wachtrij uit, dan verdwijnt de subtab mee -- en daarmee ook de
  // teller, die uit dezelfde bron komt.
  const zichtbareTabs = SETTINGS_TABS.filter((x) => x.key !== 'wachtrij' || wachtrijAan).map((x) => ({
    ...x,
    badge: x.key === 'wachtrij' ? wachtendeItems.length : 0,
  }))
  // Een tab die verdwijnt mag je niet op een leeg scherm achterlaten.
  useEffect(() => {
    if (!zichtbareTabs.some((x) => x.key === tab)) setTab('algemeen')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wachtrijAan])

  // Bij elke render opnieuw meten: het paneel is klein en gaat na een import of
  // een archiveeractie meteen over de nieuwe stand.
  const opslag = meetOpslag(changeLog)

  // Archiveren gaat in twee stappen, en dat is geen omslachtigheid: de
  // downloadroute maakt een blob en klikt een link aan, maar geeft geen
  // bevestiging terug dat het bestand ook echt is opgeslagen. De app kan dus
  // niet zelf vaststellen dat de gebruiker het archief heeft. Daarom eerst
  // downloaden, dan pas -- na een expliciete 'ik heb het bestand' -- wissen.
  const [archief, setArchief] = useState(null)
  const [archiefKlaar, setArchiefKlaar] = useState(0)
  const teArchiveren = splitsArchief(changeLog, alleDependencies)

  function handleArchiveerDownload() {
    const { archief: regels, oudsteResterend } = splitsArchief(changeLog, alleDependencies)
    if (regels.length === 0) return
    exportDataAsJson(
      { gearchiveerdOp: new Date().toISOString(), aantal: regels.length, changeLog: regels },
      `dependency-insight-logarchief-${new Date().toISOString().slice(0, 10)}.json`,
    )
    setArchief({ ids: regels.map((r) => r.id), aantal: regels.length, oudsteResterend })
  }

  function handleArchiveerBevestig() {
    if (!archief) return
    verwijderLogregels(archief.ids)
    setArchiefKlaar(archief.aantal)
    setArchief(null)
  }

  function handleExportJson() {
    exportDataAsJson(exportPayload(), `dependency-insight-export-${Date.now()}.json`)
    writeLastExport()
    setLastExport(new Date())
  }

  // Importeren is in deze werkwijze dagelijks werk (het JSON-bestand gaat van
  // hand tot hand), en tegelijk het enige pad dat in één klik alles kan
  // wissen. Daarom in twee trappen: eerst tonen wat er in het bestand zit,
  // pas na bevestigen vervangen — en dan eerst automatisch een kopie van de
  // huidige data wegschrijven.
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setPendingImport(null)
    try {
      const parsed = await readJsonFile(file)
      // validateImportShape blijft de eerste horde: een structureel
      // onbruikbaar bestand komt zo nooit tot een bevestigingsscherm.
      validateImportShape(parsed)
      setPendingImport({
        data: parsed,
        naam: file.name,
        teams: Array.isArray(parsed.teams) ? parsed.teams.length : 0,
        dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies.length : 0,
        externalParties: Array.isArray(parsed.externalParties) ? parsed.externalParties.length : 0,
        changeLog: Array.isArray(parsed.changeLog) ? parsed.changeLog.length : 0,
        schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : null,
        // Records zonder naam worden geteld, niet geweigerd — zie
        // telOnvolledigeNamen in lib/storage.js.
        onvolledig: telOnvolledigeNamen(parsed),
      })
    } catch (err) {
      // Een JSON-parsefout (SyntaxError) is voor de gebruiker onleesbaar
      // ("Unexpected token…"); de eigen validatiefouten (validateImportShape)
      // zijn juist bewust in gewone taal geschreven en mogen wél door.
      setImportError(err instanceof Error && !(err instanceof SyntaxError) ? err.message : t('settings.importGenericError'))
    }
    e.target.value = ''
  }

  function handleConfirmImport() {
    if (!pendingImport) return
    setImportError('')
    try {
      // Eerst de veiligheidskopie van de HUIDIGE data, dan pas vervangen.
      // Deze volgorde is het hele punt: gaat de import mis of blijkt het
      // verkeerde bestand gekozen, dan staat de vorige toestand al op schijf.
      exportDataAsJson(exportPayload(), `voor-import-${new Date().toISOString().slice(0, 10)}.json`)
      importState(pendingImport.data)
      // Na afloop melden hoeveel er binnenkwamen zonder naam, en bij welke
      // teams ze staan. Zonder die verwijzing weet je wel dát er iets
      // onvolledig is, maar niet waar je het moet repareren.
      setImportOnvolledig(pendingImport.onvolledig?.totaal > 0 ? pendingImport.onvolledig : null)
      setPendingImport(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('settings.importGenericError'))
    }
  }

  return (
    <div ref={panelRef} className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">{t('settings.title')}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t('settings.localData')}</p>
      </div>

      {/* Subtabs i.p.v. één lange kolom in een paneel van 384px breed. Ze
          mogen wrappen: op telefoonbreedte vallen ze anders buiten beeld. */}
      <div className="rounded-xl border border-slate-200 bg-white px-2 shadow-sm">
        <div role="tablist" aria-label={t('settings.title')} className="flex flex-wrap">
          {zichtbareTabs.map(({ key, labelKey, badge }) => {
            const aan = key === tab
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={aan}
                onClick={() => setTab(key)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs transition-colors ${
                  aan ? 'border-[#2a5f8a] font-semibold text-[#2a5f8a]' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {t(labelKey)}
                {badge > 0 && (
                  <span className={`rounded px-1 text-[10px] font-semibold ${aan ? 'bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'bg-[#c98a2e]/20 text-[#8a5a12]'}`}>{badge}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
        {tab === 'algemeen' && (
        <>
        {/* Welke versie draait hier eigenlijk? Zonder dit is "heb jij de
            nieuwste?" onbeantwoordbaar — en juist dat is de vraag zodra
            twee mensen iets anders op hun scherm zien. */}
        <p className="text-xs leading-relaxed text-slate-400">
          {t('settings.version', { versie: APP_VERSION, datum: formatBuildTime(BUILD_TIME, language) })}
          <br />
          {t('settings.versionLatest')}
        </p>

        {/* Hoe vol zit de opslag? Zonder dit merk je het pas op het moment dat
            opslaan mislukt, en dan is die ene wijziging al weg. */}
        {opslag && (
          <div className="rounded-md border border-slate-200 px-3 py-2.5">
            <p className={`text-xs ${opslag.deel >= OPSLAG_WAARSCHUWING ? 'font-medium text-[#9a3b2e]' : 'text-slate-600'}`}>
              {t('settings.storageUsed', {
                gebruikt: toonOmvang(opslag.totaal, language),
                budget: toonOmvang(opslag.budget, language),
                pct: Math.round(opslag.deel * 100),
              })}
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round(opslag.deel * 100))}%`,
                  backgroundColor: opslag.deel >= OPSLAG_WAARSCHUWING ? '#9a3b2e' : '#2a5f8a',
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {t('settings.storageBreakdown', {
                log: toonOmvang(opslag.log, language),
                rest: toonOmvang(opslag.rest, language),
              })}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{t('settings.storageBudgetNote')}</p>
            {opslag.deel >= OPSLAG_WAARSCHUWING && (
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-[#9a3b2e]">{t('settings.storageWarning')}</p>
            )}
          </div>
        )}

        <div className="rounded-md border border-slate-200 px-3 py-2.5">
          <div className="text-xs font-medium text-slate-600">
            {usingMockData ? t('settings.mockActive') : t('settings.ownActive')}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {usingMockData ? t('settings.mockActiveDesc') : t('settings.ownActiveDesc')}
          </p>
          {!usingMockData && (
            <button type="button" onClick={loadMockData} className="mt-2 text-xs font-medium text-[#2a5f8a] hover:underline">
              {t('settings.backToMock')}
            </button>
          )}
        </div>

        </>
        )}

        {tab === 'teams' && (
        <ManageSection
          defaultOpen
          title={t('settings.teams.title')}
          items={teams}
          addPlaceholder={t('settings.teams.addPlaceholder')}
          onAdd={addTeam}
          onRename={renameTeam}
          onArchive={archiveTeam}
          onUnarchive={unarchiveTeam}
          onDelete={deleteTeam}
          blockedMessage={t('settings.teams.deleteBlocked')}
        />

        )}

        {tab === 'wachtrij' && <Reviewwachtrij />}

        {tab === 'data' && (
        <>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onExportPng}
            disabled={exportingPng}
            className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-slate-50"
          >
            {exportingPng ? t('settings.exportPngBusy') : t('settings.exportPng')}
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('settings.exportJson')}
          </button>
          {/* Archiveren van oude logregels: downloaden en pas na een
              expliciete bevestiging wissen. De knop staat bewust hier, naast
              de exportknoppen -- een volledige export is de enige echte
              vangnet, en die maak je op dezelfde plek. */}
          <button
            type="button"
            onClick={handleArchiveerDownload}
            disabled={teArchiveren.archief.length === 0 || Boolean(archief)}
            className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-slate-50"
          >
            {teArchiveren.archief.length === 0
              ? t('settings.archiveLogNothing')
              : t('settings.archiveLog', { count: teArchiveren.archief.length })}
          </button>
          {archief && (
            <div className="space-y-2 rounded-md border border-[#c98a2e]/40 bg-[#c98a2e]/10 p-3">
              <p className="text-[11px] leading-relaxed text-[#8a5a12]">
                {t('settings.archiveLogDownloaded', { count: archief.aantal })}
              </p>
              <p className="text-[11px] leading-relaxed text-[#8a5a12]">{t('settings.archiveLogExportFirst')}</p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                {archief.oudsteResterend
                  ? t('settings.archiveLogKeepsFrom', {
                      datum: archief.oudsteResterend.toLocaleDateString(language === 'en' ? 'en-GB' : 'nl-NL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }),
                    })
                  : t('settings.archiveLogKeepsNothing')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleArchiveerBevestig}
                  className="rounded-md bg-[#9a3b2e] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#7e2f24]"
                >
                  {t('settings.archiveLogConfirm')}
                </button>
                <button type="button" onClick={() => setArchief(null)} className="text-xs font-medium text-slate-500 hover:underline">
                  {t('form.cancel')}
                </button>
              </div>
            </div>
          )}
          {archiefKlaar > 0 && !archief && (
            <p className="px-0.5 text-[11px] text-slate-500">{t('settings.archiveLogDone', { count: archiefKlaar })}</p>
          )}
          {/* Ouderdom van de laatste back-up. Alle data staat uitsluitend in
              deze ene browser, dus dit is geen detail: bij 14 dagen of langer,
              en bij 'nog nooit', kleurt de regel in de waarschuwkleur. */}
          <p className={`px-0.5 text-[11px] ${lastExportWaarschuwt ? 'font-medium text-[#9a3b2e]' : 'text-slate-400'}`}>
            {lastExport
              ? t('settings.lastExport', {
                  dagen: dagenGeleden(lastExport),
                  datum: lastExport.toLocaleDateString(language === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long' }),
                })
              : t('settings.lastExportNever')}
          </p>
        </div>

        {/* Importeren staat vlak boven de gevarenzone en heeft dezelfde
            waarschuwstijl: het is de enige knop die in een paar klikken alle
            lokale data vervangt. Stond eerder onopvallend tussen de twee
            exportknoppen, buiten de gevarenzone. */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-md border border-[#9a3b2e]/40 px-3 py-2 text-left text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
          >
            {t('settings.importJson')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
            aria-label={t('settings.importJson')}
          />

          {/* Tweede trap: laat eerst zien wat er in het bestand zit. Zolang
              dit blok staat is er nog niets gewijzigd. */}
          {pendingImport && (
            <div className="space-y-2 rounded-md border border-[#9a3b2e]/30 bg-[#9a3b2e]/5 p-3">
              <div className="text-xs font-semibold text-[#9a3b2e]">{t('settings.importConfirmTitle')}</div>
              <p className="truncate text-[11px] text-slate-500" title={pendingImport.naam}>
                {pendingImport.naam}
              </p>
              <ul className="space-y-0.5 text-[11px] text-slate-700">
                <li>{t('settings.importCountTeams', { count: pendingImport.teams })}</li>
                <li>{t('settings.importCountDependencies', { count: pendingImport.dependencies })}</li>
                <li>{t('settings.importCountParties', { count: pendingImport.externalParties })}</li>
                <li>{t('settings.importCountLog', { count: pendingImport.changeLog })}</li>
                <li>{t('settings.importSchemaVersion', { version: pendingImport.schemaVersion ?? '—' })}</li>
                {pendingImport.onvolledig?.totaal > 0 && (
                  <li className="font-medium text-[#9a3b2e]">
                    {t('settings.importZonderNaam', { count: pendingImport.onvolledig.totaal })}
                  </li>
                )}
              </ul>
              <p className="text-[11px] text-slate-500">{t('settings.importBackupNote')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="rounded-md bg-[#9a3b2e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#82301f]"
                >
                  {t('settings.importConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t('settings.importCancel')}
                </button>
              </div>
            </div>
          )}

          {importError && (
            <p role="alert" className="rounded-md bg-[#9a3b2e]/5 px-2.5 py-2 text-xs text-[#9a3b2e]">
              {importError}
            </p>
          )}

          {importOnvolledig && (
            <div role="status" className="space-y-1 rounded-md border border-[#9a3b2e]/20 bg-[#9a3b2e]/5 px-2.5 py-2 text-xs text-[#9a3b2e]">
              <p className="font-medium">{t('settings.importZonderNaamNa', { count: importOnvolledig.totaal })}</p>
              <ul className="space-y-0.5 text-[11px]">
                {importOnvolledig.perTeam.map((rij) => (
                  <li key={rij.teamId}>
                    {rij.teamNaam}: {t('settings.importZonderNaamRegel', { io: rij.ioItems, cap: rij.capaciteitsregels })}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setImportOnvolledig(null)} className="font-medium underline">
                {t('settings.importZonderNaamSluiten')}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold text-[#9a3b2e]">{t('settings.dangerZoneTitle')}</h3>

          {activeTeams.length > 0 ? (
            <div className="space-y-2 rounded-md border border-[#9a3b2e]/20 p-3">
              <label htmlFor="clear-team-select" className="sr-only">
                {t('settings.clearTeamPickerLabel')}
              </label>
              <select
                id="clear-team-select"
                value={effectiveClearTeamId}
                onChange={(e) => {
                  setClearTeamId(e.target.value)
                  setConfirmingClearTeam(false)
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              >
                {activeTeams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.naam}
                  </option>
                ))}
              </select>
              {!confirmingClearTeam ? (
                <button
                  type="button"
                  onClick={() => setConfirmingClearTeam(true)}
                  className="w-full rounded-md border border-[#9a3b2e]/30 px-3 py-2 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
                >
                  {t('teampage.clear')}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    {t('teampage.clearConfirm', {
                      team: activeTeams.find((tm) => tm.id === effectiveClearTeamId)?.naam ?? '',
                    })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateTeamWorkflow(effectiveClearTeamId, emptyTeamWorkflow())
                        setConfirmingClearTeam(false)
                      }}
                      className="flex-1 rounded-md bg-[#9a3b2e] px-3 py-2 text-xs font-medium text-white hover:bg-[#7f2f24]"
                    >
                      {t('settings.resetConfirmButton')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingClearTeam(false)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t('settings.resetCancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t('settings.clearTeamNoTeams')}</p>
          )}

          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="w-full rounded-md border border-[#9a3b2e]/30 px-3 py-2 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
            >
              {t('settings.reset')}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('settings.resetConfirm')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Eerst alles met het voorvoegsel 'dependency-insight:'
                    // weg, dan pas de lege state wegschrijven. clearAllData
                    // raakt alleen de data-sleutel, dus zonder deze regel bleef
                    // onder meer het 'rondleiding al gezien'-vlaggetje staan en
                    // begon een verse tool zonder rondleiding. Dezelfde routine
                    // als de resetlink gebruikt.
                    wisAlleLokaleOpslag()
                    clearAllData()
                    setConfirmingReset(false)
                  }}
                  className="flex-1 rounded-md bg-[#9a3b2e] px-3 py-2 text-xs font-medium text-white hover:bg-[#7f2f24]"
                >
                  {t('settings.resetConfirmButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t('settings.resetCancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        </>
        )}

        {ADMIN_TABS.includes(tab) && (
        <div>
          {/* Geen uitklapper meer bovenop: de subtab zelf is al de onthulling.
              De wachtwoordgrens blijft ongewijzigd staan -- alleen de extra
              klik erboven is weg. */}
          <p className="px-1 text-xs font-semibold text-slate-700">{t('settings.admin.title')}</p>
          <div className="mt-2">
              {!adminUnlocked ? (
                <form onSubmit={handleAdminUnlock} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] leading-relaxed text-slate-500">{t('settings.admin.disclaimer')}</p>
                  <label htmlFor="admin-password" className="sr-only">
                    {t('settings.admin.passwordLabel')}
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value)
                      setAdminPasswordError(false)
                    }}
                    placeholder={t('settings.admin.passwordLabel')}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
                  />
                  {adminPasswordError && (
                    <p role="alert" className="text-[11px] font-medium text-[#9a3b2e]">
                      {t('settings.admin.passwordError')}
                    </p>
                  )}
                  <button type="submit" className="w-full rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]">
                    {t('settings.admin.unlock')}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  {tab === 'zichtbaarheid' && (
                    <>
                      <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={adminSettings.uitgebreideAnalyse}
                          onChange={() => updateAdminSettings({ ...adminSettings, uitgebreideAnalyse: !adminSettings.uitgebreideAnalyse })}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
                        />
                        {t('settings.admin.uitgebreideAnalyse')}
                      </label>
                      <p className="text-[11px] leading-relaxed text-slate-400">{t('settings.admin.uitgebreideAnalyseHint')}</p>
                      <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={adminSettings.pages.wachtrij !== false}
                          onChange={() => togglePage('wachtrij')}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
                        />
                        {t('settings.queue.toggle')}
                      </label>
                      <p className="text-[11px] leading-relaxed text-slate-400">{t('settings.queue.toggleHint')}</p>
                    </>
                  )}
                  {tab === 'applicaties' && (
                    <Applicatieregister
                      register={applicatieregister}
                      teamWorkflows={teamWorkflows}
                      teams={teams}
                      planFn={applicatieregisterPlan}
                      voerUitFn={voerApplicatieregisterOmzettingUit}
                      onRename={hernoemApplicatie}
                      onStatus={zetApplicatieStatus}
                      t={t}
                    />
                  )}
                  {tab === 'log' && <AdminLogPage />}
                  {tab === 'partijen' && <PartySection
                    items={externalParties}
                    onAdd={(naam, type) => addExternalParty(naam, type, { pending: false })}
                    onRename={renameExternalParty}
                    onApprove={approveExternalParty}
                    onReject={rejectExternalParty}
                    onDelete={deleteExternalParty}
                  />}
                  {tab === 'zichtbaarheid' && <p className="text-[11px] leading-relaxed text-slate-500">{t('settings.admin.toggleHint')}</p>}
                  {tab === 'zichtbaarheid' && ADMIN_PAGE_CONFIG.map((page) => (
                    <div key={page.key} className="rounded-md border border-slate-200 bg-white p-2.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={adminSettings.pages[page.key]}
                          onChange={() => togglePage(page.key)}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2a5f8a]"
                        />
                        {language === 'nl' ? page.labelNl : page.labelEn}
                      </label>
                      <div className="ml-5 mt-1.5 space-y-0.5">
                        {page.sections.map((section) => (
                          <label key={section.key} className="flex items-center gap-2 text-[11px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={adminSettings.sections[page.key][section.key]}
                              disabled={!adminSettings.pages[page.key]}
                              onChange={() => toggleSection(page.key, section.key)}
                              className="h-3 w-3 rounded border-slate-300 accent-[#2a5f8a] disabled:opacity-40"
                            />
                            <span className={adminSettings.pages[page.key] ? '' : 'opacity-40'}>
                              {language === 'nl' ? section.labelNl : section.labelEn}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
