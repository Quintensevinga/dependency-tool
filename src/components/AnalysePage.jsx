import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { analyseer, trendReeks, NIVEAUS, LEEFTIJD_KLASSEN } from '../lib/analytics'
import { constateringZin, bouwRapport } from '../lib/analyseTeksten'
import { slugify } from '../lib/slug'
import { calculateRisk } from '../lib/risk'
import { vindScheefstand } from '../lib/scheefstand'
import { applicatiesMetMeerdereTeams } from '../lib/applicatieregister'
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
import { TEKST, ERNST_STIJL, WARM, STATUS_KLEUR, vul } from './analyse/teksten'
import { Sectie, Kaart, Tegel, Balken, Lijnen, Staven, Tabel, DepLijst, Uitklap, Waarschuwingen, CycliLijst, Rapport, TabStrip } from './analyse/Bouwstenen'

export default function AnalysePage({ onSelect, onNavigateToTeam }) {
  // activeTeams i.p.v. teams: een gearchiveerd team hoort niet als 'slapend'
  // of in de scorekaart op te duiken; zijn dependencies blijven wel meetellen
  // in de totalen (ze bestaan nog).
  const { activeTeams: teams, alleDependencies, teamWorkflows, externalParties, changeLog, teamName, adminSettings, applicatieregister } = useAppContext()
  const { language } = useLanguage()
  const [teamFilter, setTeamFilter] = useState('')
  const [weken, setWeken] = useState(26)
  // Bewust niet gepersisteerd: de team- en periodefilters hierboven zijn dat
  // ook niet, en bij het openen van de Analyse wil je in de praktijk het
  // overzicht zien, niet de tab waar je de vorige keer geëindigd was.
  const [actieveTab, setActieveTab] = useState('overzicht')
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
  // Scheefstand kijkt naar de rauwe records en niet naar de analyse-uitkomst:
  // een naamloos item of een dubbele partij is geen risicosignaal maar een
  // slordigheid in de invoer. Zelfde functie als scripts/audit-relations.mjs
  // gebruikt, zodat het scherm en het controleprogramma niet uit elkaar lopen.
  // Applicaties die meerdere teams raken. Kon vóór het centrale register
  // (punt 30) niet: elke applicatie was een eigen record per team, dus deelde
  // niemand er ooit een.
  const gedeeldeApps = useMemo(
    () => applicatiesMetMeerdereTeams({ teamWorkflows, applicatieregister }),
    [teamWorkflows, applicatieregister],
  )

  const scheef = useMemo(
    () => vindScheefstand({ teams, dependencies: alleDependencies, teamWorkflows, externalParties }),
    [teams, alleDependencies, teamWorkflows, externalParties],
  )
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

      <TabStrip tx={tx} actief={actieveTab} onKies={setActieveTab} />

      {actieveTab === 'overzicht' && (
        <>
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
        </>
      )}

      {actieveTab === 'signalen' && (
        <>
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
        </>
      )}

      {actieveTab === 'trends' && (
        <>
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
        </>
      )}

      {actieveTab === 'risico' && (
        <>
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
            <Kaart titel={`${tx('kHotspots')} · ${tx('topVan', { n: 12, total: a.hotspots.length })}`} uitleg={tx('uHotspots')}>
              <Tabel
                kolommen={[
                  { key: 'team', label: tx('team') },
                  { key: 'categorie', label: tx('categorie') },
                  { key: 'aantal', label: tx('aantal'), rechts: true },
                  { key: 'factor', label: tx('factor'), rechts: true, sorteer: (r) => r.factorWaarde },
                  { key: 'hoogste', label: tx('hoogste') },
                ]}
                rijen={a.hotspots.slice(0, 12).map((c) => ({
                  key: `${c.teamId}:${c.categorie}`,
                  team: teamName(c.teamId),
                  categorie: translateCategorie(c.categorie, language),
                  aantal: c.aantal,
                  factor: `${c.factor}×`,
                  factorWaarde: c.factor,
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
        </>
      )}

      {actieveTab === 'keten' && (
        <>
        <Sectie id="an-keten" titel={tx('sKeten')}>
          <div className="grid gap-3 lg:grid-cols-2">
            <Kaart titel={tx('kKetenTeams')} uitleg={tx('uKetenTeams')}>
              <Tabel
                kolommen={[
                  { key: 'team', label: tx('team') },
                  { key: 'inkomend', label: tx('inkomend'), rechts: true },
                  { key: 'uitgaand', label: tx('uitgaand'), rechts: true },
                  { key: 'partners', label: tx('partners'), rechts: true, sorteer: (r) => r.partnersWaarde },
                ]}
                rijen={a.keten.perTeam.map((r) => ({ key: r.teamId, team: teamName(r.teamId), inkomend: r.inkomend, uitgaand: r.uitgaand, partners: `${r.partnersIn}/${r.partnersUit}`, partnersWaarde: r.partnersIn + r.partnersUit, onClick: () => onNavigateToTeam(r.teamId) }))}
              />
            </Kaart>
            <Kaart titel={tx('kCycli')} uitleg={tx('uCycli')}>
              <CycliLijst cycli={a.keten.cycli} afgekapt={a.keten.cycliAfgekapt} maxCycli={a.keten.maxCycli} teamName={teamName} tx={tx} />
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
            <Kaart titel={`${tx('kGedeeldeApps')} · ${gedeeldeApps.length}`} uitleg={tx('uGedeeldeApps')} breed>
              <Tabel
                kolommen={[
                  { key: 'app', label: tx('applicatie') },
                  { key: 'teams', label: tx('aantalTeams'), rechts: true, sorteer: (r) => r.teamsWaarde },
                  { key: 'hoogste', label: tx('hoogste') },
                  { key: 'namen', label: tx('team') },
                ]}
                rijen={gedeeldeApps.map((g) => {
                  const deps = a.open.filter((d) => (d.applicatieIds ?? []).includes(g.id))
                  // Hoogste risiconiveau van de dependencies die aan deze applicatie hangen.
                  const scores = deps.map((d) => calculateRisk(d)).sort((x, y) => y.score - x.score)
                  const hoogste = scores[0]?.level ?? null
                  return {
                    key: g.id,
                    app: g.naam,
                    teams: g.aantalTeams,
                    teamsWaarde: g.aantalTeams,
                    hoogste: hoogste ? translateRiskLevel(hoogste, language) : '—',
                    namen: g.teamIds.map(teamName).join(', '),
                  }
                })}
                leeg={tx('geenGedeeldeApps')}
              />
            </Kaart>
            <Kaart titel={`${tx('kSpof')} · ${tx('topVan', { n: 15, total: a.keten.spof.length })}`} uitleg={tx('uSpof')} breed>
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
            <Kaart titel={`${tx('kFlowCategorie')} · ${tx('topVan', { n: 10, total: a.flowverlies.perCategorie.length })}`} uitleg={tx('uFlow')}>
              <Balken rijen={a.flowverlies.perCategorie.slice(0, 10).map((r) => ({ label: translateCategorie(r.categorie, language), waarde: r.som, kleur: WARM }))} />
            </Kaart>
            <Kaart titel={`${tx('kFlowPartij')} · ${tx('topVan', { n: 10, total: a.flowverlies.perPartij.filter((r) => r.som > 0).length })}`} uitleg={tx('uFlow')}>
              <Balken rijen={a.flowverlies.perPartij.filter((r) => r.som > 0).slice(0, 10).map((r) => ({ label: r.naam, waarde: r.som, kleur: WARM }))} />
            </Kaart>
          </div>
        </Sectie>
        )}
        </>
      )}

      {actieveTab === 'data' && (
        <>
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
            <Kaart titel={`${tx('kScheef')}${scheef.totaal > 0 ? ` · ${scheef.totaal}` : ''}`} uitleg={tx('uScheef')}>
              {scheef.totaal === 0 ? (
                <p className="text-xs text-slate-400">{tx('scheefGeen')}</p>
              ) : (
                <div className="space-y-2">
                  {/* Zachter dan de controles ernaast, en dat staat er ook bij:
                      die gaan over kapotte verwijzingen, deze over slordigheid.
                      Zonder dat onderscheid gaat iemand met twintig historische
                      slordigheden er nooit meer naar kijken. */}
                  <p className="text-[11px] text-slate-400">{tx('scheefZacht')}</p>
                  <Uitklap label={tx('scheefNaamloos')} aantal={scheef.naamloos.length}>
                    <ul className="text-xs text-slate-700">
                      {scheef.naamloos.map((x) => (
                        <li key={`${x.soort}:${x.id}`}>
                          {tx(`scheefSoort${x.soort.charAt(0).toUpperCase()}${x.soort.slice(1)}`)} · {x.omschrijving}
                          {x.team ? ` · ${x.team}` : ''}
                        </li>
                      ))}
                    </ul>
                  </Uitklap>
                  <Uitklap label={tx('scheefDubbel')} aantal={scheef.dubbelePartijen.length}>
                    <ul className="text-xs text-slate-700">
                      {scheef.dubbelePartijen.map((g) => (
                        <li key={g.sleutel}>{g.namen.join(' / ')}</li>
                      ))}
                    </ul>
                  </Uitklap>
                </div>
              )}
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
        </>
      )}
    </div>
  )
}
