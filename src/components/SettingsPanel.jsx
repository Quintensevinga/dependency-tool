import { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLanguage } from '../context/LanguageContext'
import { exportDataAsJson, readJsonFile } from '../lib/export'

export default function SettingsPanel({ onClose, onExportPng }) {
  const { dependencies, teams, usingMockData, loadMockData, clearAllData, importState } = useAppContext()
  const { t } = useLanguage()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const fileInputRef = useRef(null)

  function handleExportJson() {
    exportDataAsJson({ teams, dependencies, usingMockData }, `dependency-insight-export-${Date.now()}.json`)
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await readJsonFile(file)
      importState(parsed)
    } catch {
      // stil negeren; bestand was geen geldige export
    }
    e.target.value = ''
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-stone-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-800">{t('settings.title')}</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
          ✕
        </button>
      </div>

      <div className="space-y-4 px-4 py-3.5">
        <p className="text-xs leading-relaxed text-stone-500">{t('settings.localData')}</p>

        <div className="rounded-md border border-stone-200 px-3 py-2.5">
          <div className="text-xs font-medium text-stone-600">
            {usingMockData ? t('settings.mockActive') : t('settings.ownActive')}
          </div>
          <p className="mt-0.5 text-xs text-stone-400">
            {usingMockData ? t('settings.mockActiveDesc') : t('settings.ownActiveDesc')}
          </p>
          {!usingMockData && (
            <button onClick={loadMockData} className="mt-2 text-xs font-medium text-[#33493c] hover:underline">
              {t('settings.backToMock')}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={onExportPng}
            className="rounded-md border border-stone-300 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            {t('settings.exportPng')}
          </button>
          <button
            onClick={handleExportJson}
            className="rounded-md border border-stone-300 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            {t('settings.exportJson')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-stone-300 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            {t('settings.importJson')}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
        </div>

        <div className="border-t border-stone-100 pt-3">
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="w-full rounded-md border border-[#6e2a1e]/30 px-3 py-2 text-xs font-medium text-[#6e2a1e] hover:bg-[#6e2a1e]/5"
            >
              {t('settings.reset')}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">{t('settings.resetConfirm')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearAllData()
                    setConfirmingReset(false)
                  }}
                  className="flex-1 rounded-md bg-[#6e2a1e] px-3 py-2 text-xs font-medium text-white hover:bg-[#5c2015]"
                >
                  {t('settings.resetConfirmButton')}
                </button>
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
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
