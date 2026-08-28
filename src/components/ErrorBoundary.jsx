import { Component } from 'react'
import { STORAGE_KEY, resetToEmpty } from '../lib/storage'
import { exportDataAsJson } from '../lib/export'
import { translate } from '../i18n/strings'

const LANG_STORAGE_KEY = 'dependency-insight:lang'

function currentLanguage() {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) || 'nl'
  } catch {
    return 'nl'
  }
}

// Klassencomponent (verplicht voor React error boundaries — hooks werken hier
// niet). Vangt renderfouten in AppContent op i.p.v. een wit scherm te tonen;
// omdat de state in localStorage staat zou zo'n fout na herladen anders
// gewoon terugkomen. Leest taal/data rechtstreeks uit localStorage i.p.v. via
// context, want die context is precies wat mogelijk net gecrasht is.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Onverwachte renderfout opgevangen door ErrorBoundary:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  handleExportAndReset = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed) exportDataAsJson(parsed, `dependency-insight-noodback-up-${Date.now()}.json`)
    } catch (err) {
      console.error('Export vóór reset is mislukt:', err)
    }
    resetToEmpty()
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const lang = currentLanguage()
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f6f9] px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-700">{translate(lang, 'errorBoundary.message')}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
            >
              {translate(lang, 'errorBoundary.retry')}
            </button>
            <button
              type="button"
              onClick={this.handleExportAndReset}
              className="rounded-md border border-[#9a3b2e]/30 px-3.5 py-2 text-sm font-medium text-[#9a3b2e] hover:bg-[#9a3b2e]/5"
            >
              {translate(lang, 'errorBoundary.exportAndReset')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
