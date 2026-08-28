import { lazy, Suspense, useRef, useState } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ExecutiveSummary from './components/ExecutiveSummary'
import InsightPanel from './components/InsightPanel'
import MatrixView from './components/MatrixView'
import DependencyDetail from './components/DependencyDetail'
import DependencyForm from './components/DependencyForm'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy: dit zijn de enige schermen die reactflow gebruiken (het grootste
// aandeel van de bundel, zie B-18) — MatrixView is een tabel en blijft
// gewoon eager. Elk scherm downloadt zijn eigen chunk pas op het moment dat
// het echt geopend wordt, i.p.v. dat reactflow altijd meekomt in de
// hoofdbundel ongeacht welk tabblad je als eerste opent.
const GraphView = lazy(() => import('./components/GraphView'))
const ChainOverview = lazy(() => import('./components/ChainOverview'))
const TeamPage = lazy(() => import('./components/TeamPage'))
import { exportElementAsPng } from './lib/export'
import { getCorruptRawData, clearCorruptRawData } from './lib/storage'
import { buildDuplicatePrefill } from './lib/duplicateDependency'

// Bewust géén silent no-op als een pagina via Admin uitgezet is (bv. een
// verweesde teampagina-navigatie of een handmatige URL/state-restore): een
// duidelijk bericht i.p.v. een leeg scherm, met een weg terug als die er is.
function PageDisabledNotice({ onBack }) {
  const { t } = useLanguage()
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-sm text-slate-600">{t('admin.pageDisabled')}</p>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {t('teampage.back')}
        </button>
      )}
    </div>
  )
}

function AppContent() {
  const {
    setCurrentTeamId,
    addDependency,
    updateDependency,
    deleteDependency,
    adminSettings,
    saveError,
    dismissSaveError,
    corruptedOnLoad,
    dismissCorruptedNotice,
  } = useAppContext()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('graph')
  // Weergavemodus van Netwerkweergave (Heatmap/Relatiekaart) leeft hier i.p.v.
  // lokaal in GraphView, zodat de Sidebar 'm ook kan tonen/wijzigen. Heatmap
  // is het startpunt (overzicht eerst); Relatiekaart is de verdiepende
  // doorklik-view, al blijft hij ook los kiesbaar via de sidebar-subtab.
  const [graphViewMode, setGraphViewMode] = useState('heatmap')
  // Doorklikstatus vanuit een Heatmap-cel: pint een team+categorie-paar op de
  // Relatiekaart totdat de gebruiker 'm zelf wist (niet enkel hover-gedreven).
  const [graphHighlight, setGraphHighlight] = useState(null)

  // team of categorie mag null zijn: een Heatmap-rijklik pint enkel het team
  // (hele rij), een kolomklik enkel de categorie (hele kolom), een celklik
  // pint beide (exacte combinatie).
  function handleDrillToRelatie(team, categorie) {
    setGraphViewMode('bipartite')
    setGraphHighlight({ teamId: team ? team.id : null, categorie: categorie ?? null })
  }

  // Handmatig van weergavemodus wisselen (sidebar-subtab) wist een eventuele
  // doorklik-highlight — die hoort alleen bij de Heatmap-cel die 'm zette.
  function handleGraphViewModeChange(mode) {
    setGraphViewMode(mode)
    setGraphHighlight(null)
  }
  // Drie standen i.p.v. alleen open/smal: 'open' (breed, vast), 'icons'
  // (smal, vast) en 'auto' (bijna volledig verborgen, schuift tijdelijk open
  // bij hover/focus op de handle — zie Sidebar.jsx). Niet gepersisteerd,
  // zelfde gedrag als de vorige boolean.
  const [sidebarMode, setSidebarMode] = useState('open')
  const [teamPageTeamId, setTeamPageTeamId] = useState(null)
  const [selectedDependency, setSelectedDependency] = useState(null)
  const [formState, setFormState] = useState(null) // null | { editing, teamId, prefill? }
  const viewRef = useRef(null)
  // Losse ref voor de teampagina: viewRef hierboven zit op een div die alleen
  // bestaat als er géén teampagina open is, dus PNG-export op de teampagina
  // exportte voorheen stilzwijgend niets (zie handleExportPng) — B-07.
  const teamPageRef = useRef(null)

  function handleTabChange(tab) {
    setTeamPageTeamId(null)
    setActiveTab(tab)
  }

  // Sidebar-navigatie is puur navigatie (naar de teampagina), maar we
  // onthouden het team ook stilzwijgend als 'laatst bezocht' zodat
  // "+ Nieuwe dependency" in de topbar een zinnig standaardteam heeft —
  // geen zichtbare teamkeuze-UI meer, enkel deze achtergrondstate.
  function handleNavigateToTeam(teamId) {
    setTeamPageTeamId(teamId)
    setCurrentTeamId(teamId)
  }

  function handleQuickCreate(sourceTeamId, categorie, scope) {
    setFormState({
      editing: null,
      defaultTeamId: sourceTeamId,
      prefill: { scope, categorie },
    })
  }

  function handleSave(payload) {
    if (formState?.editing) {
      updateDependency(formState.editing.id, payload)
    } else {
      addDependency(payload)
    }
    setFormState(null)
  }

  function handleDelete(dependency) {
    if (window.confirm(t('detail.confirmDelete', { titel: dependency.titel }))) {
      deleteDependency(dependency.id)
      setSelectedDependency(null)
    }
  }

  // Opent het formulier voorgevuld met een kopie van de gekozen dependency —
  // nog niets wordt aangemaakt totdat de gebruiker zelf opslaat (zie
  // buildDuplicatePrefill: geen id/laatst_bijgewerkt/geaccepteerd
  // overgenomen, team blijft een wijzigbaar veld).
  function handleDuplicate(dependency) {
    setSelectedDependency(null)
    setFormState({ editing: null, prefill: buildDuplicatePrefill(dependency, t('form.duplicateTitlePrefix')) })
  }

  async function handleExportPng() {
    const filename = `dependency-insight-${activeTab}-${Date.now()}.png`
    const element = teamPageTeamId ? teamPageRef.current : viewRef.current
    const ok = await exportElementAsPng(element, filename)
    if (!ok) window.alert(t('settings.exportPngFailed'))
  }

  function handleDownloadCorruptData() {
    const raw = getCorruptRawData()
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `dependency-insight-onleesbare-data-${Date.now()}.json`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleDismissCorrupted() {
    clearCorruptRawData()
    dismissCorruptedNotice()
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f3f6f9]">
      {/* Geen voorgeselecteerd team meer vanaf de globale knop — de gebruiker
          kiest expliciet in het formulier zelf i.p.v. een stil geraden
          standaardteam (zie currentTeamId hierboven, nog wel gebruikt om
          bij teampagina-navigatie het team te onthouden). */}
      <Header onNewDependency={() => setFormState({ editing: null })} />

      {/* Boven de sidebar (z-30 tegenover Header/Sidebar's eigen z-lagen),
          onder de 57px-hoge header — zichtbaar ongeacht welke pagina open
          staat, want beide gaan over de opslag zelf, niet over één scherm. */}
      {corruptedOnLoad && (
        <div className="fixed left-0 right-0 top-[57px] z-30 flex flex-wrap items-center justify-between gap-2 bg-[#9a3b2e] px-4 py-2 text-xs text-white">
          <span>{t('corrupted.message')}</span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleDownloadCorruptData}
              className="rounded-md border border-white/40 px-2.5 py-1 font-medium hover:bg-white/10"
            >
              {t('corrupted.download')}
            </button>
            <button
              type="button"
              onClick={handleDismissCorrupted}
              className="rounded-md border border-white/40 px-2.5 py-1 font-medium hover:bg-white/10"
            >
              {t('corrupted.dismiss')}
            </button>
          </span>
        </div>
      )}
      {!corruptedOnLoad && saveError && (
        <div className="fixed left-0 right-0 top-[57px] z-30 flex flex-wrap items-center justify-between gap-2 bg-[#9a3b2e] px-4 py-2 text-xs text-white">
          <span>{t('saveError.message')}</span>
          <button
            type="button"
            onClick={dismissSaveError}
            className="shrink-0 rounded-md border border-white/40 px-2.5 py-1 font-medium hover:bg-white/10"
          >
            {t('saveError.dismiss')}
          </button>
        </div>
      )}

      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onExportPng={handleExportPng}
        onNavigateToTeam={handleNavigateToTeam}
        activeTeamId={teamPageTeamId}
        graphViewMode={graphViewMode}
        onGraphViewModeChange={handleGraphViewModeChange}
        mode={sidebarMode}
        onModeChange={setSidebarMode}
      />

      {/* Topbar en sidebar staan vast (position:fixed); alleen <main> scrolt,
          met pt-[73px] om onder de 57px-hoge fixed header uit te komen.
          Matrix blijft op de vertrouwde leesbreedte (tabel/kaarten lezen niet
          prettiger op ultra-brede schermen); de canvasgerichte schermen
          (netwerk/keten/teampagina) mogen de volledige beschikbare breedte
          benutten — daar was juist de klacht dat ze te smal/gecentreerd stonden. */}
      <main
        className={`mx-auto h-full space-y-4 overflow-y-auto px-6 pb-6 pt-[73px] transition-[padding] ${
          sidebarMode === 'open' ? 'md:pl-60' : sidebarMode === 'icons' ? 'md:pl-16' : 'md:pl-8'
        } ${teamPageTeamId || activeTab !== 'matrix' ? 'max-w-none' : 'max-w-7xl'}`}
      >
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-400">{t('app.loading')}</div>}>
        {teamPageTeamId ? (
          adminSettings.pages.team ? (
            <TeamPage
              key={teamPageTeamId}
              teamId={teamPageTeamId}
              onBack={() => setTeamPageTeamId(null)}
              adminSections={adminSettings.sections.team}
              sidebarCollapsed={sidebarMode !== 'open'}
              sidebarMode={sidebarMode}
              containerRef={teamPageRef}
            />
          ) : (
            <PageDisabledNotice onBack={() => setTeamPageTeamId(null)} />
          )
        ) : (
          <>
            {activeTab === 'matrix' && adminSettings.pages.matrix && (
              <>
                {adminSettings.sections.matrix.samenvattingskaarten && <ExecutiveSummary />}
                {adminSettings.sections.matrix.keyObservations && <InsightPanel />}
              </>
            )}

            <div ref={viewRef} className="bg-[#f3f6f9]">
              {activeTab === 'matrix' &&
                (adminSettings.pages.matrix ? (
                  <MatrixView onSelect={setSelectedDependency} adminSections={adminSettings.sections.matrix} />
                ) : (
                  <PageDisabledNotice />
                ))}
              {activeTab === 'graph' &&
                (adminSettings.pages.netwerk ? (
                  <GraphView
                    onSelect={setSelectedDependency}
                    onQuickCreate={handleQuickCreate}
                    viewMode={graphViewMode}
                    highlight={graphHighlight}
                    onClearHighlight={() => setGraphHighlight(null)}
                    onDrillToRelatie={handleDrillToRelatie}
                    adminSections={adminSettings.sections.netwerk}
                    onNavigateToTeam={handleNavigateToTeam}
                    sidebarMode={sidebarMode}
                  />
                ) : (
                  <PageDisabledNotice />
                ))}
              {activeTab === 'chain' &&
                (adminSettings.pages.keten ? (
                  <ChainOverview adminSections={adminSettings.sections.keten} sidebarMode={sidebarMode} />
                ) : (
                  <PageDisabledNotice />
                ))}
            </div>
          </>
        )}
        </Suspense>
      </main>

      {selectedDependency && (
        <DependencyDetail
          dependency={selectedDependency}
          onClose={() => setSelectedDependency(null)}
          onEdit={(dep) => {
            setSelectedDependency(null)
            setFormState({ editing: dep })
          }}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {formState && (
        <DependencyForm
          defaultTeamId={formState.defaultTeamId}
          initialData={formState.editing}
          prefill={formState.prefill}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AppProvider>
    </LanguageProvider>
  )
}
