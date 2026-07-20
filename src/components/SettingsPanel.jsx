import { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { exportDataAsJson, readJsonFile } from '../lib/export'
import { useModalA11y } from '../lib/a11y'

function IconButton({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded p-1.5 hover:bg-slate-100 ${danger ? 'text-[#9a3b2e] hover:bg-[#9a3b2e]/10' : 'text-slate-500'}`}
    >
      {children}
    </button>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function UnarchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M9 13l3-2 3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ManageRow({ item, onRename, onArchive, onUnarchive, onDelete, blockedMessage }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.naam)
  const [blocked, setBlocked] = useState(false)

  function submitRename(e) {
    e.preventDefault()
    if (value.trim()) onRename(item.id, value.trim())
    setEditing(false)
  }

  function handleDelete() {
    const ok = onDelete(item.id)
    if (!ok) {
      setBlocked(true)
      window.setTimeout(() => setBlocked(false), 4000)
    }
  }

  if (editing) {
    return (
      <form onSubmit={submitRename} className="flex items-center gap-1.5 py-1">
        <label htmlFor={`rename-${item.id}`} className="sr-only">
          {t('settings.rename')}
        </label>
        <input
          id={`rename-${item.id}`}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submitRename}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
        />
        <button type="submit" className="shrink-0 text-xs font-medium text-[#2a5f8a] hover:underline">
          {t('settings.save')}
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className={`truncate text-xs ${item.actief ? 'text-slate-700' : 'text-slate-400 line-through'}`} title={item.naam}>
        {item.naam}
        {!item.actief && <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium normal-case text-slate-500 no-underline">{t('settings.archived')}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <IconButton label={t('settings.rename')} onClick={() => setEditing(true)}>
          <EditIcon />
        </IconButton>
        {item.actief ? (
          <IconButton label={t('settings.archive')} onClick={() => onArchive(item.id)}>
            <ArchiveIcon />
          </IconButton>
        ) : (
          <IconButton label={t('settings.unarchive')} onClick={() => onUnarchive(item.id)}>
            <UnarchiveIcon />
          </IconButton>
        )}
        <IconButton label={t('settings.delete')} onClick={handleDelete} danger>
          <DeleteIcon />
        </IconButton>
      </span>
      {blocked && <p className="w-full text-[11px] text-[#9a3b2e]">{blockedMessage}</p>}
    </div>
  )
}

function ManageSection({ title, items, addPlaceholder, onAdd, onRename, onArchive, onUnarchive, onDelete, blockedMessage, helper, defaultOpen }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [newName, setNewName] = useState('')

  function submitAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    onAdd(newName)
    setNewName('')
  }

  const sorted = [...items].sort((a, b) => Number(b.actief) - Number(a.actief) || a.naam.localeCompare(b.naam))

  return (
    <div className="rounded-md border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2">
          {helper && <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{helper}</p>}
          <div className="max-h-48 divide-y divide-slate-50 overflow-y-auto">
            {sorted.length === 0 && <p className="py-1.5 text-xs text-slate-400">{t('settings.empty')}</p>}
            {sorted.map((item) => (
              <ManageRow
                key={item.id}
                item={item}
                onRename={onRename}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                blockedMessage={blockedMessage}
              />
            ))}
          </div>
          <form onSubmit={submitAdd} className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
            <label htmlFor={`add-${title}`} className="sr-only">
              {addPlaceholder}
            </label>
            <input
              id={`add-${title}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={addPlaceholder}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2a5f8a] focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded-md bg-[#2a5f8a] px-2.5 py-1.5 text-xs text-white hover:bg-[#1f4a6c]">
              {t('settings.add')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function SettingsPanel({ onClose, onExportPng }) {
  const {
    dependencies,
    teams,
    functies,
    schemaVersion,
    usingMockData,
    loadMockData,
    clearAllData,
    importState,
    addTeam,
    renameTeam,
    archiveTeam,
    unarchiveTeam,
    deleteTeam,
    addFunctie,
    renameFunctie,
    archiveFunctie,
    unarchiveFunctie,
    deleteFunctie,
  } = useAppContext()
  const { t } = useLanguage()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)
  const panelRef = useRef(null)

  useModalA11y({ open: true, onClose, containerRef: panelRef })

  function handleExportJson() {
    exportDataAsJson({ teams, dependencies, functies, usingMockData, schemaVersion }, `dependency-insight-export-${Date.now()}.json`)
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    try {
      const parsed = await readJsonFile(file)
      importState(parsed)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('settings.importGenericError'))
    }
    e.target.value = ''
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t('header.settings')}
      className="z-50 w-96 rounded-xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{t('settings.title')}</h3>
        <button type="button" onClick={onClose} aria-label={t('nav.close')} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3.5">
        <p className="text-xs leading-relaxed text-slate-500">{t('settings.localData')}</p>

        <div className="rounded-md border border-slate-200 px-3 py-2.5">
          <div className="text-xs font-medium text-slate-600">
            {usingMockData ? t('settings.mockActive') : t('settings.ownActive')}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {usingMockData ? t('settings.mockActiveDesc') : t('settings.ownActiveDesc')}
          </p>
          {!usingMockData && (
            <button type="button" onClick={loadMockData} className="mt-2 text-xs font-medium text-[#2a5f8a] hover:underline">
              {t('settings.backToMock')}
            </button>
          )}
        </div>

        <ManageSection
          title={t('settings.teams.title')}
          items={teams}
          addPlaceholder={t('settings.teams.addPlaceholder')}
          onAdd={addTeam}
          onRename={renameTeam}
          onArchive={archiveTeam}
          onUnarchive={unarchiveTeam}
          onDelete={deleteTeam}
          blockedMessage={t('settings.teams.deleteBlocked')}
        />

        <ManageSection
          title={t('settings.functies.title')}
          items={functies}
          addPlaceholder={t('settings.functies.addPlaceholder')}
          onAdd={addFunctie}
          onRename={renameFunctie}
          onArchive={archiveFunctie}
          onUnarchive={unarchiveFunctie}
          onDelete={deleteFunctie}
          blockedMessage={t('settings.functies.deleteBlocked')}
          helper={t('settings.functies.helper')}
        />

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onExportPng}
            className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('settings.exportPng')}
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('settings.exportJson')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('settings.importJson')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
            aria-label={t('settings.importJson')}
          />
          {importError && (
            <p role="alert" className="rounded-md bg-[#9a3b2e]/5 px-2.5 py-2 text-xs text-[#9a3b2e]">
              {importError}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3">
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="w-full rounded-md border border-[#9a3b2e]/30 px-3 py-2 text-xs font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
            >
              {t('settings.reset')}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('settings.resetConfirm')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearAllData()
                    setConfirmingReset(false)
                  }}
                  className="flex-1 rounded-md bg-[#9a3b2e] px-3 py-2 text-xs font-medium text-white hover:bg-[#7f2f24]"
                >
                  {t('settings.resetConfirmButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t('settings.resetCancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
