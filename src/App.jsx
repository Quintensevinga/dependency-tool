import { useRef, useState } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import Header from './components/Header'
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
  const { currentTeamId, teamName, addDependency, updateDependency, deleteDependency } = useAppContext()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('graph')
  const [teamPageTeamId, setTeamPageTeamId] = useState(null)
  const [selectedDependency, setSelectedDependency] = useState(null)
  const [formState, setFormState] = useState(null) // null | { editing, teamId, prefill? }
  const viewRef = useRef(null)

  function handleTabChange(tab) {
    setTeamPageTeamId(null)
    setActiveTab(tab)
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
    <div className="min-h-screen bg-[#f3f6f9]">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onNewDependency={() => setFormState({ editing: null, teamId: currentTeamId })}
        onExportPng={handleExportPng}
        onNavigateToTeam={setTeamPageTeamId}
      />

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6 md:pl-[4.75rem]">
        {teamPageTeamId ? (
          <TeamPage key={teamPageTeamId} teamId={teamPageTeamId} onBack={() => setTeamPageTeamId(null)} />
        ) : (
          <>
            <div ref={viewRef} className="bg-[#f3f6f9]">
              {activeTab === 'matrix' && <MatrixView onSelect={setSelectedDependency} />}
              {activeTab === 'graph' && <GraphView onSelect={setSelectedDependency} onQuickCreate={handleQuickCreate} />}
              {activeTab === 'chain' && <ChainOverview />}
            </div>

            {activeTab === 'matrix' && (
              <>
                <ExecutiveSummary />
                <InsightPanel />
              </>
            )}
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
