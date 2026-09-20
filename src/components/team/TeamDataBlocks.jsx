import { memo, useState } from 'react'
import { WORKFLOW_STAGES, WORKFLOW_STAP_TO_STAGE } from '../../data/constants'
import { CategoryIcon } from '../../data/categoryIcons'
import { calculateRisk } from '../../lib/risk'
import { riskStyle } from '../../lib/riskStyles'
import { berekenFlowverlies } from '../../lib/analysis'
import { translateCategorie, translateRiskLevel, translateStatus, translateWorkflowStage } from '../../i18n/labels'

// De blokken onder het canvas: de lijsten met dependencies, de in-/uitklapbare
// teamgegevens-secties, het vak met koppelingsverzoeken en de kleine editors die
// daarbij horen.
//
// Stonden in TeamPage.jsx. Verplaatst, niet verbouwd -- regel voor regel
// dezelfde inhoud; alleen de imports zijn naar dit bestand meegekomen.

export function PuntenEditor({ items, onChange, t }) {
  const [draft, setDraft] = useState('')
  function add() {
    const text = draft.trim()
    if (!text) return
    onChange([...items, text])
    setDraft('')
  }
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('teampage.puntenTitle')}</div>
      <p className="mt-0.5 text-[11px] text-slate-400">{t('teampage.puntenHint')}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs italic text-slate-400">{t('teampage.puntenEmpty')}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((p, i) => (
            <li key={`${i}:${p}`} className="flex items-start gap-1.5 text-xs text-slate-700">
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span className="min-w-0 flex-1">{p}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={t('teampage.puntenRemove')}
                className="shrink-0 text-slate-300 hover:text-[#9a3b2e]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="mt-2 flex gap-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('teampage.puntenPlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('teampage.puntenAdd')}
        </button>
      </form>
    </div>
  )
}

export function RequestActions({ onAccept, onReject, t }) {
  return (
    <span className="flex shrink-0 gap-1.5">
      <button type="button" onClick={onAccept} className="rounded-md bg-[#2a5f8a] px-2 py-0.5 text-[11px] font-medium text-white hover:bg-[#1f4a6c]">
        {t('teampage.linkRequestAccept')}
      </button>
      <button type="button" onClick={onReject} className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
        {t('teampage.linkRequestReject')}
      </button>
    </span>
  )
}

// Eén rij in de Input-/Output-lijst. Een koppelingsverzoek van een ander team
// staat er ook tussen: als schaduwrij (nieuw item, nog niet van ons) of als
// badge op het bestaande item waaraan gekoppeld wil worden — met accepteren/
// afwijzen ter plekke, zodat je niet naar een apart vak hoeft te zoeken.
export function IoListRow({ item, summary, onOpen, onAccept, onReject, t }) {
  const ghost = item._ghostRequest
  const pending = item._pendingRequest
  if (ghost) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate italic text-slate-600">{item.label || '—'}</span>
        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
          {t('teampage.requestProposedBy', { team: ghost.proposerNaam })}
        </span>
        <RequestActions onAccept={() => onAccept(ghost)} onReject={() => onReject(ghost)} t={t} />
      </li>
    )
  }
  return (
    <li className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm hover:bg-slate-50">
        <span className="min-w-0 flex-1 truncate text-slate-700">{item.label || '—'}</span>
        {summary && <span className="max-w-[55%] shrink-0 truncate text-xs text-slate-400">{summary}</span>}
      </button>
      {pending && (
        <>
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            {t('teampage.requestForItem', { team: pending.proposerNaam })}
          </span>
          <RequestActions onAccept={() => onAccept(pending)} onReject={() => onReject(pending)} t={t} />
        </>
      )}
    </li>
  )
}

// Verzoeken van andere teams om een input/output aan dit team te koppelen —
// bewust een opvallende kaart bovenaan de pagina i.p.v. verstopt in een
// lijst: wie op deze teampagina komt moet meteen zien dat er iets op akkoord
// wacht. Accepteren/afwijzen loopt via AppContext (acceptLinkRequest).
export function LinkRequestsPanel({ requests, workflow, teamName, onAccept, onReject, t }) {
  function describe(req) {
    const team = teamName(req.teamId)
    const label = req.item.label || '—'
    if (req.kind === 'input') {
      const target = req.item.linkedOutputId ? workflow.outputs.find((o) => o.id === req.item.linkedOutputId) : null
      return target
        ? t('teampage.linkRequestInputExisting', { team, label, target: target.label || '—' })
        : t('teampage.linkRequestInputNew', { team, label })
    }
    const target = req.item.linkedInputId ? workflow.inputs.find((i) => i.id === req.item.linkedInputId) : null
    return target
      ? t('teampage.linkRequestOutputExisting', { team, label, target: target.label || '—' })
      : t('teampage.linkRequestOutputNew', { team, label })
  }
  return (
    <div data-testid="link-requests" className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
          {requests.length}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{t('teampage.linkRequestsTitle')}</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">{t('teampage.linkRequestsHint')}</p>
      <ul className="mt-3 space-y-2">
        {requests.map((req) => (
          <li
            key={`${req.teamId}:${req.kind}:${req.item.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <span className="min-w-0 flex-1">
              {describe(req)}
              {/* Nieuwe naamloze verzoeken kunnen niet meer ontstaan (de naam
                  is verplicht bij de verzender), maar bestaande data kan er nog
                  hebben. De controle hoort bij de bron, dus hier alleen
                  uitleggen waarom er niets te accepteren valt — anders klikt
                  dit team op Accepteren en gebeurt er zichtbaar niets. */}
              {!req.item.label?.trim() && (
                <span className="mt-0.5 block text-[11px] font-medium text-[#9a3b2e]">{t('teampage.linkRequestNoName')}</span>
              )}
            </span>
            <span className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onAccept(req)}
                disabled={!req.item.label?.trim()}
                title={!req.item.label?.trim() ? t('teampage.linkRequestNoName') : undefined}
                className="rounded-md bg-[#2a5f8a] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1f4a6c] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
              >
                {t('teampage.linkRequestAccept')}
              </button>
              <button
                type="button"
                onClick={() => onReject(req)}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('teampage.linkRequestReject')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// DependencyRow/StageGroupedDeps/FlatDeps staan bewust op moduleniveau: als
// geneste functiecomponenten binnen TeamPage kregen ze bij elke state-wijziging
// een nieuwe identiteit, waardoor React elke rij unmountte en opnieuw aanmaakte
// — merkbaar als focusverlies in de applicatie-select en als onnodige
// rendercycli in lijsten van tientallen dependencies. Alles wat ze uit de
// pagina nodig hebben komt via één stabiel ctx-object (rowContext in TeamPage),
// zodat de memo hieronder daadwerkelijk iets oplevert.
export const DependencyRow = memo(function DependencyRow({ dep, showAppPicker, ctx }) {
  const { t, language, uitgebreideAnalyse, applications, onSelect, onAddApplicatie, onRemoveApplicatie } = ctx
  const risk = calculateRisk(dep)
  const style = riskStyle(risk.level)
  const flowverlies = uitgebreideAnalyse ? berekenFlowverlies(dep) : null
  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => onSelect(dep)}
        className="flex w-full items-center gap-2 text-left text-sm hover:bg-slate-50"
      >
        <CategoryIcon categorie={dep.categorie} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1 truncate text-slate-700">{dep.titel}</span>
        <span className="shrink-0 text-xs text-slate-400">{translateCategorie(dep.categorie, language)}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>{translateRiskLevel(risk.level, language)}</span>
        {flowverlies && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${riskStyle(flowverlies.level).badge}`}
            title={t('teampage.flowverliesHint')}
          >
            {t('teampage.flowverliesShort')}: {translateRiskLevel(flowverlies.level, language)}
          </span>
        )}
      </button>
      {(dep.status || dep.actieAfspraak) && (
        <div className="mt-0.5 flex items-center gap-1.5 pl-5 text-[11px] text-slate-400">
          {dep.status && <span className="shrink-0">{translateStatus(dep.status, language)}</span>}
          {dep.status && dep.actieAfspraak && <span aria-hidden="true">·</span>}
          {dep.actieAfspraak && <span className="truncate">{dep.actieAfspraak}</span>}
        </div>
      )}
      {showAppPicker && applications.length > 0 && (() => {
        const linkedIds = dep.applicatieIds ?? []
        const linkedApps = linkedIds.map((id) => applications.find((a) => a.id === id)).filter(Boolean)
        const unlinkedApps = applications.filter((a) => !linkedIds.includes(a.id))
        return (
          <div className="mt-1 flex flex-wrap items-center gap-1 pl-5" title={t('teampage.appLabelHint')}>
            {linkedApps.length === 0 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">{t('teampage.appOverstijgend')}</span>
            ) : (
              linkedApps.map((app) => (
                <span
                  key={app.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#2a5f8a]/10 px-2 py-0.5 text-[11px] font-medium text-[#2a5f8a]"
                >
                  {app.naam || '—'}
                  <button
                    type="button"
                    onClick={() => onRemoveApplicatie(dep, app.id)}
                    aria-label={t('teampage.appChipRemove', { naam: app.naam || '—' })}
                    className="leading-none text-[#2a5f8a]/60 hover:text-[#2a5f8a]"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
            {unlinkedApps.length > 0 && (
              <select
                value=""
                onChange={(e) => onAddApplicatie(dep, e.target.value)}
                aria-label={t('teampage.appChipAdd')}
                className="rounded border-none bg-transparent py-0 pl-0 pr-3 text-[11px] text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2a5f8a]"
              >
                <option value="">{t('teampage.appChipAdd')}</option>
                {unlinkedApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.naam || '—'}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })()}
    </li>
  )
})
// Weergave voor de Ontwikkelflow-lijst, gegroepeerd per workflowstap (+ een
// 'Proces-overstijgend'-restgroep voor legacy/incomplete data zonder
// herleidbare stap — zelfde term als het canvas gebruikt voor diezelfde
// groep). Uitsluitend voor Ontwikkelflow: Applicatieflow-dependencies
// groeperen op applicatie, niet op workflowstap (zie FlatDeps hieronder).
export function StageGroupedDeps({ deps, showAppPicker, ctx }) {
  const { t, language } = ctx
  return (
    <>
      {WORKFLOW_STAGES.map((stage) => {
        const stageDeps = deps.filter((d) => WORKFLOW_STAP_TO_STAGE[d.workflowStap] === stage)
        if (stageDeps.length === 0) return null
        return (
          <div key={stage} className="mb-2">
            <div className="mb-1 text-[11px] font-medium text-slate-400">{translateWorkflowStage(stage, language)}</div>
            <ul className="divide-y divide-slate-100">
              {stageDeps.map((dep) => (
                <DependencyRow key={dep.id} dep={dep} showAppPicker={showAppPicker} ctx={ctx} />
              ))}
            </ul>
          </div>
        )
      })}
      {(() => {
        const noStage = deps.filter((d) => !WORKFLOW_STAP_TO_STAGE[d.workflowStap])
        if (noStage.length === 0) return null
        return (
          <div className="mb-2">
            <div className="mb-1 text-[11px] font-medium text-slate-400">{t('teampage.procesOverstijgend')}</div>
            <ul className="divide-y divide-slate-100">
              {noStage.map((dep) => (
                <DependencyRow key={dep.id} dep={dep} showAppPicker={showAppPicker} ctx={ctx} />
              ))}
            </ul>
          </div>
        )
      })()}
    </>
  )
}

// Vlakke lijst zonder subgroepering — voor Applicatieflow-dependencies
// (al gegroepeerd op applicatie door de aanroeper zelf): een tweede,
// workflowstap-gebaseerde onderverdeling zou daar geen betekenis hebben en
// 'Applicatieflow heeft geen workflowstap' weer ondermijnen.
export function FlatDeps({ deps, showAppPicker, ctx }) {
  return (
    <ul className="divide-y divide-slate-100">
      {deps.map((dep) => (
        <DependencyRow key={dep.id} dep={dep} showAppPicker={showAppPicker} ctx={ctx} />
      ))}
    </ul>
  )
}

export function TeamDataBlock({ title, count, open, onToggle, action, children, blockRef }) {
  return (
    <div ref={blockRef} className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 text-left text-sm font-medium text-slate-700"
        >
          <span className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">
            ›
          </span>
          {title}
          <span className="text-xs font-normal text-slate-400">— {count}</span>
        </button>
        {action}
      </div>
      {open && <div className="mt-2.5 pl-5">{children}</div>}
    </div>
  )
}

// Compacte zwevende toolbar linksonder in het canvas zelf (dezelfde hoek als
// React Flow's eigen — nu verborgen — standaardknoppen): zoom, passend maken
// en slim ordenen boven een streepje, volledig scherm apart eronder. Moet
// binnen een ReactFlowProvider staan voor useReactFlow().
