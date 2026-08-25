import { useRef, useState } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ExecutiveSummary from './components/ExecutiveSummary'
import InsightPanel from './components/InsightPanel'
import MatrixView from './components/MatrixView'
import GraphView from './components/GraphView'
import ChainOverview from './components/ChainOverview'
import TeamPage from './components/TeamPage'
import DependencyDetail from './components/DependencyDetail'
import DependencyForm from './components/DependencyForm'
import { exportElementAsPng } from './lib/export'
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
  const { setCurrentTeamId, addDependency, updateDependency, deleteDependency, adminSettings } = useAppContext()
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

  function handleExportPng() {
    const filename = `dependency-insight-${activeTab}-${Date.now()}.png`
    exportElementAsPng(viewRef.current, filename)
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f3f6f9]">
      {/* Geen voorgeselecteerd team meer vanaf de globale knop — de gebruiker
          kiest expliciet in het formulier zelf i.p.v. een stil geraden
          standaardteam (zie currentTeamId hierboven, nog wel gebruikt om
          bij teampagina-navigatie het team te onthouden). */}
      <Header onNewDependency={() => setFormState({ editing: null })} />
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
        {teamPageTeamId ? (
          adminSettings.pages.team ? (
            <TeamPage
              key={teamPageTeamId}
              teamId={teamPageTeamId}
              onBack={() => setTeamPageTeamId(null)}
              adminSections={adminSettings.sections.team}
              sidebarCollapsed={sidebarMode !== 'open'}
              sidebarMode={sidebarMode}
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
        <AppContent />
      </AppProvider>
    </LanguageProvider>
  )
}
