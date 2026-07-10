import { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'

// Navigatie-drawer voor teamselectie. Vormt de basis voor toekomstige
// team-specifieke pagina's (elke listitem kan later doorverwijzen naar een
// eigen teamdashboard i.p.v. alleen `currentTeam` te zetten).
export default function TeamNavDrawer({ open, onClose }) {
  const { teams, currentTeam, setCurrentTeam, addTeam } = useAppContext()
  const { t } = useLanguage()
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  if (!open) return null

  function handleSelect(team) {
    setCurrentTeam(team)
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
        className="flex h-full w-72 flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-stone-800">{t('nav.teams')}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            ✕
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-2">
          {teams.length === 0 && <li className="px-4 py-3 text-sm text-stone-400">{t('team.noTeams')}</li>}
          {teams.map((team) => (
            <li key={team}>
              <button
                onClick={() => handleSelect(team)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  team === currentTeam
                    ? 'bg-[#33493c]/10 font-medium text-[#33493c]'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {team}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-stone-100 p-3">
          {creating ? (
            <form onSubmit={handleSubmitNewTeam} className="flex items-center gap-1.5">
              <input
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
