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

function AppContent() {
  const { currentTeamId, setCurrentTeamId, teamName, addDependency, updateDependency, deleteDependency } = useAppContext()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('graph')
  // Weergavemodus van Netwerkweergave (bipartite/cluster/heatmap) leeft hier
  // i.p.v. lokaal in GraphView, zodat de Sidebar 'm ook kan tonen/wijzigen.
  const [graphViewMode, setGraphViewMode] = useState('bipartite')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
      teamId: sourceTeamId,
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

  function handleExportPng() {
    const filename = `dependency-insight-${activeTab}-${Date.now()}.png`
    exportElementAsPng(viewRef.current, filename)
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f3f6f9]">
      <Header onNewDependency={() => setFormState({ editing: null, teamId: currentTeamId })} />
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onExportPng={handleExportPng}
        onNavigateToTeam={handleNavigateToTeam}
        activeTeamId={teamPageTeamId}
        graphViewMode={graphViewMode}
        onGraphViewModeChange={setGraphViewMode}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Topbar en sidebar staan vast (position:fixed); alleen <main> scrolt,
          met pt-[73px] om onder de 57px-hoge fixed header uit te komen.
          Matrix blijft op de vertrouwde leesbreedte (tabel/kaarten lezen niet
          prettiger op ultra-brede schermen); de canvasgerichte schermen
          (netwerk/keten/teampagina) mogen de volledige beschikbare breedte
          benutten — daar was juist de klacht dat ze te smal/gecentreerd stonden. */}
      <main
        className={`mx-auto h-full space-y-4 overflow-y-auto px-6 pb-6 pt-[73px] transition-[padding] ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-60'} ${teamPageTeamId || activeTab !== 'matrix' ? 'max-w-none' : 'max-w-7xl'}`}
      >
        {teamPageTeamId ? (
          <TeamPage key={teamPageTeamId} teamId={teamPageTeamId} onBack={() => setTeamPageTeamId(null)} />
        ) : (
          <>
            {activeTab === 'matrix' && (
              <>
                <ExecutiveSummary />
                <InsightPanel />
              </>
            )}

            <div ref={viewRef} className="bg-[#f3f6f9]">
              {activeTab === 'matrix' && <MatrixView onSelect={setSelectedDependency} />}
              {activeTab === 'graph' && (
                <GraphView onSelect={setSelectedDependency} onQuickCreate={handleQuickCreate} viewMode={graphViewMode} />
              )}
              {activeTab === 'chain' && <ChainOverview />}
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
            setFormState({ editing: dep, teamId: dep.teamId })
          }}
          onDelete={handleDelete}
        />
      )}

      {formState && (
        <DependencyForm
          teamId={formState.teamId}
          teamName={teamName(formState.teamId)}
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
