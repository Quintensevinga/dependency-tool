import { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { useModalA11y } from '../lib/a11y'

// Navigatie-drawer voor teamselectie. Elk listitem stuurt door naar de eigen
// teampagina van dat team (via onNavigateToTeam), naast het zetten van de
// actieve teamcontext. Beheer (hernoemen/archiveren/verwijderen) staat in
// Instellingen, niet hier.
export default function TeamNavDrawer({ open, onClose, onNavigateToTeam }) {
  const { activeTeams, currentTeamId, setCurrentTeamId, addTeam } = useAppContext()
  const { t } = useLanguage()
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const panelRef = useRef(null)

  useModalA11y({ open, onClose, containerRef: panelRef })

  useEffect(() => {
    if (!open) setCreating(false)
  }, [open])

  if (!open) return null

  function handleSelect(teamId) {
    setCurrentTeamId(teamId)
    onNavigateToTeam?.(teamId)
    onClose()
  }

  function handleSubmitNewTeam(e) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    addTeam(newTeamName)
    setNewTeamName('')
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.teams')}
        className="flex h-full w-72 flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">{t('nav.teams')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-2">
          {activeTeams.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">{t('team.noTeams')}</li>}
          {activeTeams.map((team) => (
            <li key={team.id}>
              <button
                type="button"
                onClick={() => handleSelect(team.id)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  team.id === currentTeamId
                    ? 'bg-[#2a5f8a]/10 font-medium text-[#2a5f8a]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {team.naam}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-slate-100 p-3">
          {creating ? (
            <form onSubmit={handleSubmitNewTeam} className="flex items-center gap-1.5">
              <label htmlFor="new-team-name" className="sr-only">
                {t('team.newPlaceholder')}
              </label>
              <input
                id="new-team-name"
                autoFocus
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder={t('team.newPlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-sm text-white hover:bg-[#1f4a6c]"
              >
                {t('team.confirmAdd')}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('team.add')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
