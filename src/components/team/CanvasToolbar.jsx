import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow, useNodesInitialized } from 'reactflow'
import { RISK_LEVELS, STATUS_LEVELS, WORKFLOW_STAP_LEVELS } from '../../data/constants'
import { translateRiskLevel, translateStatus, translateWorkflowStap } from '../../i18n/labels'
import { fitViewAvoidingCorner } from '../../lib/flowFit'
import { useClickOutside } from '../../lib/useClickOutside'

// De zwevende knoppenbalk op het teamcanvas (zoomen, passend maken, ordenen,
// volledig scherm) en het filtermenu dat ernaast hangt.
//
// Stonden in TeamPage.jsx. Verplaatst, niet verbouwd.

export function TeamCanvasToolbar({ onSmartOrder, onFullscreen, isFullscreen, t, paneRef, sidebarMode, fitKey }) {
  const instance = useReactFlow()
  const { zoomIn, zoomOut } = instance
  const toolbarRef = useRef(null)
  const isFirstRender = useRef(true)
  const nodesInitialized = useNodesInitialized()

  // Fit die rekening houdt met de eigen footprint van deze toolbar (linksonder
  // in het canvas) als een kléíne 'safe area', niet als marge over de hele
  // breedte/hoogte — zie src/lib/flowFit.js voor waarom dat verschil
  // uitmaakt. Live gemeten i.p.v. hardcoded, zodat dit vanzelf klopt blijft
  // als de toolbar ooit verandert.
  const fitAvoidingToolbar = useCallback(
    (opts) => {
      const el = toolbarRef.current
      const safeAreaWidth = el ? el.getBoundingClientRect().width + 24 : 0
      const safeAreaHeight = el ? el.getBoundingClientRect().height + 24 : 0
      fitViewAvoidingCorner(instance, paneRef?.current, {
        safeAreaWidth,
        safeAreaHeight,
        padding: 0.08,
        minZoom: 0.4,
        maxZoom: 1.5,
        duration: 200,
        ...opts,
      })
    },
    [instance, paneRef],
  )

  // Eerste fit zodra React Flow de node-afmetingen echt heeft gemeten
  // (useNodesInitialized), i.p.v. een gegokte timeout — bij veel/complexe
  // nodes kan meten langer duren dan een vaste delay, met een fit tegen
  // ongemeten (0-brede) bounds tot gevolg die de viewport ongewijzigd laat.
  useEffect(() => {
    if (!nodesInitialized || !isFirstRender.current) return
    isFirstRender.current = false
    fitAvoidingToolbar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesInitialized])

  // Opnieuw fitten wanneer de zichtbare canvas-inhoud verandert: toevoegen/
  // verwijderen van dependencies/applicaties/IO/notities, Split per
  // applicatie ↔ Samengevoegd, of een Weergeven-toggle die nodes toont/
  // verbergt (zie canvasFitKey hierboven, bij de aanroeper). Geen vertraging
  // nodig — dit is geen CSS-transitie, de nieuwe layout staat er al.
  useEffect(() => {
    if (isFirstRender.current) return
    fitAvoidingToolbar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  // Opnieuw fitten wanneer de zijbalk *definitief* wisselt (open/iconen/
  // auto, niet het tijdelijk uitklappen op hover) of volledig
  // scherm/presentatiemodus aan/uit gaat — de vertraging wacht de
  // CSS-transitie van <main>'s padding-left resp. de fullscreen-overlay af
  // zodat het canvas al zijn uiteindelijke afmeting heeft.
  useEffect(() => {
    if (isFirstRender.current) return
    const id = window.setTimeout(() => fitAvoidingToolbar(), 220)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarMode, isFullscreen])

  // En bij het resizen van het browservenster zelf — gedebouncet, want
  // 'resize' kan tientallen keren per seconde vuren.
  useEffect(() => {
    let id
    function handleResize() {
      window.clearTimeout(id)
      id = window.setTimeout(() => fitAvoidingToolbar(), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', handleResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const btnClass = 'flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700'
  return (
    <div
      ref={toolbarRef}
      data-tour="canvas-toolbar"
      className="absolute bottom-3 left-3 z-10 flex flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-sm"
    >
      <button type="button" onClick={() => zoomOut()} title={t('teampage.canvasZoomOut')} aria-label={t('teampage.canvasZoomOut')} className={btnClass}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 11h6M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" onClick={() => zoomIn()} title={t('teampage.canvasZoomIn')} aria-label={t('teampage.canvasZoomIn')} className={btnClass}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 8v6M8 11h6M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <div className="my-0.5 h-px w-4 bg-slate-200" />
      <button
        type="button"
        onClick={() => fitAvoidingToolbar()}
        title={t('teampage.canvasFitView')}
        aria-label={t('teampage.canvasFitView')}
        className={btnClass}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      <button type="button" onClick={onSmartOrder} title={t('teampage.smartOrderHint')} aria-label={t('teampage.smartOrder')} className={btnClass}>
        {/* Toverstaf met sparkles, zoals "Automatisch verbeteren" in Apple
            Foto's — grote ster aan de punt van de staf, kleintje los ernaast. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4.5 19.5 14 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M17 3.5 18 6l2.5 1-2.5 1-1 2.5-1-2.5L13.5 7l2.5-1 1-2.5Z"
            fill="currentColor"
          />
          <path d="M6.5 14 7 15.3 8.3 15.8 7 16.3 6.5 17.6 6 16.3 4.7 15.8 6 15.3 6.5 14Z" fill="currentColor" />
        </svg>
      </button>
      <div className="my-0.5 h-px w-4 bg-slate-200" />
      <button
        type="button"
        onClick={onFullscreen}
        title={isFullscreen ? t('teampage.fullscreenClose') : t('teampage.fullscreenOpen')}
        aria-label={isFullscreen ? t('teampage.fullscreenClose') : t('teampage.fullscreenOpen')}
        className={btnClass}
      >
        {isFullscreen ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="m7 7 3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

// Herbruikbare filterknop + dropdown voor dependencies — staat zowel in de
// canvas-toolbar als bij de dependency-lijst, beide keren op dezelfde
// filterstate (alleen de open/dicht-stand van de dropdown is per plek eigen).
export function DepFiltersDropdown({
  open,
  onToggle,
  active,
  align = 'right',
  label,
  viewToggles,
  flowtypeFilter,
  setFlowtypeFilter,
  scopeFilter,
  setScopeFilter,
  appLabelFilter,
  setAppLabelFilter,
  applications,
  riskLevelFilter,
  setRiskLevelFilter,
  statusFilter,
  setStatusFilter,
  workflowStapFilter,
  setWorkflowStapFilter,
  onClear,
  t,
  language,
}) {
  const containerRef = useRef(null)
  useClickOutside(containerRef, open, onToggle)
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          active ? 'border-[#2a5f8a]/40 bg-[#2a5f8a]/10 text-[#2a5f8a]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {label ?? t('teampage.depFiltersButton')}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-[#2a5f8a]" aria-hidden="true" />}▾
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-9 z-20 ${viewToggles ? 'w-96' : 'w-80'} rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10`}
        >
          {viewToggles && (
            <div className="mb-3.5 border-b border-slate-100 pb-3.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.viewToggleSectionTitle')}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {viewToggles.map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    onClick={() => toggle.onChange((v) => !v)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        toggle.value ? 'border-[#2a5f8a] bg-[#2a5f8a]' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {toggle.value && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {toggle.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {viewToggles && (
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.filterSectionTitle')}</div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('form.flowtype')}</div>
              <select
                value={flowtypeFilter}
                onChange={(e) => setFlowtypeFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="alle">{t('teampage.filterAll')}</option>
                <option value="ontwikkelflow">{t('form.flowtypeOntwikkelflow')}</option>
                <option value="applicatieflow">{t('form.flowtypeApplicatieflow')}</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('form.scope')}</div>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
              >
                <option value="alle">{t('scope.alle')}</option>
                <option value="intern">{t('scope.intern')}</option>
                <option value="extern">{t('scope.extern')}</option>
              </select>
            </div>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('teampage.filterAppLabel')}</div>
            <select
              value={appLabelFilter}
              onChange={(e) => setAppLabelFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
            >
              <option value="alle">{t('teampage.filterAll')}</option>
              <option value="overstijgend">{t('teampage.appOverstijgend')}</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.naam || '—'}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('filter.riskLevel')}</span>
              <button type="button" onClick={() => setRiskLevelFilter(new Set(RISK_LEVELS))} className="text-[10px] text-[#2a5f8a] hover:underline">
                {t('filter.selectAll')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {RISK_LEVELS.map((lvl) => {
                const isActive = riskLevelFilter.has(lvl)
                return (
                  <button
                    key={lvl}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setRiskLevelFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(lvl)) next.delete(lvl)
                        else next.add(lvl)
                        return next
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      isActive ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {translateRiskLevel(lvl, language)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('tabel.col.status')}</span>
              <button type="button" onClick={() => setStatusFilter(new Set(STATUS_LEVELS))} className="text-[10px] text-[#2a5f8a] hover:underline">
                {t('filter.selectAll')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_LEVELS.map((s) => {
                const isActive = statusFilter.has(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setStatusFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(s)) next.delete(s)
                        else next.add(s)
                        return next
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      isActive ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {translateStatus(s, language)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('form.workflowStap')}</span>
              <button
                type="button"
                onClick={() => setWorkflowStapFilter(new Set(WORKFLOW_STAP_LEVELS))}
                className="text-[10px] text-[#2a5f8a] hover:underline"
              >
                {t('filter.selectAll')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {WORKFLOW_STAP_LEVELS.map((stap) => {
                const isActive = workflowStapFilter.has(stap)
                return (
                  <button
                    key={stap}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setWorkflowStapFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(stap)) next.delete(stap)
                        else next.add(stap)
                        return next
                      })
                    }
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      isActive ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {translateWorkflowStap(stap, language)}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            disabled={!active}
            className="mt-3 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('teampage.depFiltersClear')}
          </button>
        </div>
      )}
    </div>
  )
}

