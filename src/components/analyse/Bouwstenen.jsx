import { useMemo, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { calculateRisk } from '../../lib/risk'
import { riskStyle } from '../../lib/riskStyles'
import { translateRiskLevel } from '../../i18n/labels'
import { signaalZin, rapportAlsTekst, rapportAlsMarkdown } from '../../lib/analyseTeksten'
import { exportTextAsFile } from '../../lib/export'
import { TEKST, ERNST_STIJL, vul } from './teksten'

// De gedeelde bouwstenen van de Analysepagina: sectie, kaart, tegel, de twee
// grafieken, de tabel, de lijsten, de signalenlijst en de tabstrip.
//
// Stonden in AnalysePage.jsx. Verplaatst, niet verbouwd.

export function Sectie({ id, titel, children }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titel}</h2>
      {children}
    </section>
  )
}

export function Kaart({ titel, uitleg, children, breed = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${breed ? 'lg:col-span-2' : ''}`}>
      <h3 className="text-sm font-semibold text-slate-800">{titel}</h3>
      {uitleg && <p className="mt-0.5 mb-3 text-[11px] leading-relaxed text-slate-400">{uitleg}</p>}
      {children}
    </div>
  )
}

export function Tegel({ label, waarde, sub, delta, kleur }) {
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

export function Balken({ rijen, kleur = '#2a5f8a' }) {
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
export function Lijnen({ punten, reeksen, hoogte = 140 }) {
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

export function Staven({ punten, reeksen, hoogte = 140 }) {
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

// Hoeveel regels een analysetabel standaard toont. Eronder komt 'toon alle N';
// negentien tabellen op deze pagina delen dit component, en verschillende
// daarvan groeien met een regel per team of per record.
const TABEL_MAX = 15

// De sorteerwaarde van een cel. Bewust niet de weergegeven tekst: kolommen als
// de factor ('3x') en het partnerpaar ('2/5') zijn opgemaakte strings, en
// alfabetisch komt '10x' dan voor '2x'. Een kolom kan daarom een eigen
// `sorteer(rij)` meegeven; zonder dat wordt de ruwe celwaarde gebruikt.
function sorteerWaarde(kolom, rij) {
  if (typeof kolom.sorteer === 'function') return kolom.sorteer(rij)
  const waarde = rij[kolom.key]
  return waarde ?? ''
}

export function Tabel({ kolommen, rijen, leeg }) {
  const { language } = useLanguage()
  const tx = (key, vars) => vul(TEKST[language]?.[key] ?? TEKST.nl[key] ?? key, vars)
  const [sortering, setSortering] = useState({ key: null, aflopend: false })
  const [alle, setAlle] = useState(false)

  // Kolommen zonder zinnige ordening (een knop, een badge) zetten
  // sorteerbaar: false; de rest is sorteerbaar.
  const kanSorteren = (k) => k.sorteerbaar !== false

  const gesorteerd = useMemo(() => {
    const kolom = kolommen.find((k) => k.key === sortering.key)
    if (!kolom) return rijen
    const richting = sortering.aflopend ? -1 : 1
    return [...rijen].sort((a, b) => {
      const va = sorteerWaarde(kolom, a)
      const vb = sorteerWaarde(kolom, b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * richting
      return String(va).localeCompare(String(vb), language === 'en' ? 'en' : 'nl', { numeric: true }) * richting
    })
  }, [rijen, kolommen, sortering, language])

  if (rijen.length === 0) return <p className="text-xs text-slate-400">{leeg ?? '—'}</p>

  const zichtbaar = alle ? gesorteerd : gesorteerd.slice(0, TABEL_MAX)

  function klikKop(k) {
    if (!kanSorteren(k)) return
    setSortering((vorig) => (vorig.key === k.key ? { key: k.key, aflopend: !vorig.aflopend } : { key: k.key, aflopend: false }))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
            {kolommen.map((k) => {
              const actief = sortering.key === k.key
              return (
                <th
                  key={k.key}
                  className={`pb-1.5 pr-3 font-medium ${k.rechts ? 'text-right' : ''}`}
                  aria-sort={actief ? (sortering.aflopend ? 'descending' : 'ascending') : 'none'}
                >
                  {kanSorteren(k) ? (
                    <button
                      type="button"
                      onClick={() => klikKop(k)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide ${actief ? 'text-[#2a5f8a]' : 'hover:text-slate-600'}`}
                    >
                      {k.label}
                      <span aria-hidden="true" className={actief ? '' : 'text-slate-300'}>
                        {actief && sortering.aflopend ? '▾' : '▴'}
                      </span>
                    </button>
                  ) : (
                    k.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {zichtbaar.map((rij, i) => (
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
      {rijen.length > TABEL_MAX && (
        <button type="button" onClick={() => setAlle((v) => !v)} className="mt-1.5 text-[11px] font-medium text-[#2a5f8a] hover:underline">
          {alle ? tx('toonMinder') : tx('toonAlle', { n: rijen.length })}
        </button>
      )}
    </div>
  )
}

export function RisicoBadge({ dep, language }) {
  const risk = calculateRisk(dep)
  const style = riskStyle(risk.level)
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>{translateRiskLevel(risk.level, language)}</span>
}

// Lijst van dependencies, ingeklapt vanaf een drempel; klik opent het detail.
export function DepLijst({ deps, onSelect, teamName, language, tx, extra, max = 8, markeer }) {
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

export function Uitklap({ label, aantal, children }) {
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
// Korte naam per signaalsoort staat in het TEKST-blok als sig_<key>; ontbreekt
// die, dan valt tx() terug op de kale sleutel en blijft de knop leesbaar.
const SOORT_LABEL_KEY = (key) => `sig_${key}`

// Standaard staan alleen hoog en midden aan: de lage signalen zijn hygiene-
// meldingen die de belangrijkste tussen zich in laten verdwijnen zodra er
// tientallen teams zijn. Ze zijn met een klik terug te halen.
const ERNST_STANDAARD = ['hoog', 'midden']

export function Waarschuwingen({ signalen, ctx, onSelect, onNavigateToTeam, tx }) {
  const [alle, setAlle] = useState(false)
  const [ernsten, setErnsten] = useState(ERNST_STANDAARD)
  const [soort, setSoort] = useState('')
  const [zoek, setZoek] = useState('')

  // De zin wordt pas bij het renderen samengesteld, dus zoeken gebeurt op de
  // uitkomst van signaalZin en niet op de ruwe parameters.
  const metZin = useMemo(() => signalen.map((sig) => ({ sig, zin: signaalZin(sig, ctx) })), [signalen, ctx])

  const perErnst = useMemo(() => {
    const telling = { hoog: 0, midden: 0, laag: 0 }
    for (const { sig } of metZin) telling[sig.ernst] = (telling[sig.ernst] ?? 0) + 1
    return telling
  }, [metZin])

  // Alleen soorten die er echt zijn, met hun aantal erachter: een keuzelijst
  // met dertig soorten waarvan er drie voorkomen helpt niemand.
  const soorten = useMemo(() => {
    const telling = new Map()
    for (const { sig } of metZin) telling.set(sig.key, (telling.get(sig.key) ?? 0) + 1)
    return [...telling.entries()]
      .map(([key, n]) => ({ key, n, label: tx(SOORT_LABEL_KEY(key)) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metZin])

  const naald = zoek.trim().toLowerCase()
  const gefilterd = useMemo(
    () =>
      metZin.filter(({ sig, zin }) => {
        if (!ernsten.includes(sig.ernst)) return false
        if (soort && sig.key !== soort) return false
        if (naald && !zin.toLowerCase().includes(naald)) return false
        return true
      }),
    [metZin, ernsten, soort, naald],
  )

  function wisselErnst(e) {
    setErnsten((vorig) => (vorig.includes(e) ? vorig.filter((x) => x !== e) : [...vorig, e]))
  }

  if (signalen.length === 0) return <p className="text-xs text-slate-400">{tx('waarschuwingenGeen')}</p>

  const zichtbaar = alle ? gefilterd : gefilterd.slice(0, 25)
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 pb-2.5">
        <span className="text-xs font-medium text-slate-600">{tx('sigAantal', { n: gefilterd.length, total: signalen.length })}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tx('sigFilterErnst')}</span>
          {['hoog', 'midden', 'laag'].map((e) => {
            const aan = ernsten.includes(e)
            return (
              <button
                key={e}
                type="button"
                onClick={() => wisselErnst(e)}
                aria-pressed={aan}
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase transition-colors ${
                  aan ? ERNST_STIJL[e] : 'border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
              >
                {tx(ERNST_LABEL[e])} {perErnst[e] ?? 0}
              </button>
            )
          })}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tx('sigFilterSoort')}</span>
          <select
            value={soort}
            onChange={(e) => setSoort(e.target.value)}
            className="max-w-[220px] truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#2a5f8a] focus:outline-none"
          >
            <option value="">{tx('sigFilterAlleSoorten')}</option>
            {soorten.map((so) => (
              <option key={so.key} value={so.key}>
                {so.label} ({so.n})
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={tx('sigFilterZoek')}
          aria-label={tx('sigFilterZoek')}
          className="min-w-[160px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
        />
      </div>
      {gefilterd.length === 0 && <p className="text-xs text-slate-400">{tx('sigGeenNaFilter')}</p>}
      <ul className="divide-y divide-slate-100">
        {zichtbaar.map(({ sig, zin }, i) => {
          const dep = sig.params?.dep
          const teamId = sig.params?.teamId ?? sig.params?.teamIdA
          const klik = dep ? () => onSelect(dep) : teamId ? () => onNavigateToTeam(teamId) : null
          return (
            <li key={`${sig.key}:${dep?.id ?? teamId ?? ''}:${i}`}>
              <button type="button" disabled={!klik} onClick={klik ?? undefined} className="flex w-full items-start gap-2 py-1.5 text-left text-xs hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent">
                <span className={`mt-px shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ERNST_STIJL[sig.ernst]}`}>{tx(ERNST_LABEL[sig.ernst])}</span>
                <span className="text-slate-700">{zin}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {/* Het aantal na filteren, niet het totaal: anders belooft de knop meer
          dan er onder dit filter te zien is. */}
      {gefilterd.length > 25 && (
        <button type="button" onClick={() => setAlle((v) => !v)} className="mt-1.5 text-[11px] font-medium text-[#2a5f8a] hover:underline">
          {alle ? tx('toonMinder') : tx('toonAlle', { n: gefilterd.length })}
        </button>
      )}
    </div>
  )
}

// Cycli in de keten. Twee afkappingen die allebei benoemd worden: de zoektocht
// zelf stopt bij 200 gevonden cycli (zie MAX_CYCLI in analytics.js) en deze
// lijst toont er 25 met een knop eronder. Stil afkappen zou hier het ergst
// zijn: dan lijkt een keten met honderden cycli net zo rustig als een met drie.
export function CycliLijst({ cycli, afgekapt, maxCycli, teamName, tx }) {
  const [alle, setAlle] = useState(false)
  if (cycli.length === 0) return <p className="text-xs text-slate-400">{tx('geenCycli')}</p>
  const zichtbaar = alle ? cycli : cycli.slice(0, 25)
  return (
    <div>
      {afgekapt && <p className="mb-1.5 text-[11px] font-medium text-[#8a5a12]">{tx('cycliAfgekapt', { n: maxCycli })}</p>}
      <ul className="space-y-1 text-xs text-slate-700">
        {zichtbaar.map((c) => (
          <li key={c.join('|')}>{[...c, c[0]].map((id) => teamName(id)).join(' → ')}</li>
        ))}
      </ul>
      {cycli.length > 25 && (
        <button type="button" onClick={() => setAlle((v) => !v)} className="mt-1.5 text-[11px] font-medium text-[#2a5f8a] hover:underline">
          {alle ? tx('toonMinder') : tx('toonAlle', { n: cycli.length })}
        </button>
      )}
    </div>
  )
}

export function Rapport({ rapport, titel, bestandsnaam, tx }) {
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

// Zes tabbladen i.p.v. veertien secties onder elkaar met een 'spring naar'-
// rij erboven: die pagina was in de praktijk te lang om te overzien, en het
// springen bracht je telkens midden in een scherm vol kaarten. Bewust
// gegroepeerd i.p.v. één tab per sectie — veertien tabnamen passen niet op
// één regel, en dan lees je de strip niet meer als tabs. Elke tab houdt zijn
// twee of drie secties gewoon onder elkaar, met dezelfde sectiekop als
// voorheen, dus er verdwijnt geen inhoud.
export const TABS = [
  ['overzicht', 'tabOverzicht'],
  ['signalen', 'tabSignalen'],
  ['trends', 'tabTrends'],
  ['risico', 'tabRisico'],
  ['keten', 'tabKeten'],
  ['data', 'tabData'],
]

export function TabStrip({ tx, actief, onKies }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-2 shadow-sm">
      <div role="tablist" aria-label={tx('navTabs')} className="flex flex-wrap">
        {TABS.map(([key, labelKey]) => {
          const aan = key === actief
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={aan}
              onClick={() => onKies(key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs transition-colors ${
                aan
                  ? 'border-[#2a5f8a] font-semibold text-[#2a5f8a]'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {tx(labelKey)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- de pagina ------------------------------------------------------------

