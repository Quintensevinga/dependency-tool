import { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { useModalA11y } from '../lib/a11y'

// Navigatie-drawer voor teamselectie. Vormt de basis voor toekomstige
// team-specifieke pagina's (elke listitem kan later doorverwijzen naar een
// eigen teamdashboard i.p.v. alleen `currentTeamId` te zetten). Beheer
// (hernoemen/archiveren/verwijderen) staat in Instellingen, niet hier.
export default function TeamNavDrawer({ open, onClose }) {
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
    <div className="fixed inset-0 z-50 bg-stone-900/30" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.teams')}
        className="flex h-full w-72 flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-stone-800">{t('nav.teams')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.close')}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-2">
          {activeTeams.length === 0 && <li className="px-4 py-3 text-sm text-stone-400">{t('team.noTeams')}</li>}
          {activeTeams.map((team) => (
            <li key={team.id}>
              <button
                type="button"
                onClick={() => handleSelect(team.id)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  team.id === currentTeamId
                    ? 'bg-[#33493c]/10 font-medium text-[#33493c]'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {team.naam}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-stone-100 p-3">
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
                className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-[#33493c] focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-[#33493c] px-2.5 py-1.5 text-sm text-white hover:bg-[#263a2f]"
              >
                {t('team.confirmAdd')}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              {t('team.add')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
