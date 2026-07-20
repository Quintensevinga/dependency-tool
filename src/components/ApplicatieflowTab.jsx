import { useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useLanguage } from '../context/LanguageContext'
import { RISICO_BIJ_UITVAL } from '../data/constants'
import { translateRisicoBijUitval } from '../i18n/labels'
import { generateId, emptyApplicatieflow } from '../lib/storage'
import PannableFlowCanvas from './flow/PannableFlowCanvas'
import { useMergedLayout } from './flow/useMergedLayout'

const LEVEL_GAP_X = 220
const LEVEL_Y = 60
const UNCONNECTED_Y = 280
const NODE_GAP_Y = 100

// Zuivere leveling-functie: applicaties die nooit doel ("naar") zijn, zijn
// startpunten (level 0); elke koppeling schuift het doel minstens één level
// verder naar rechts op. Applicaties zonder enige koppeling (in of uit)
// blijven expliciet buiten de levels — die worden apart, los getekend, nooit
// als foutstatus.
function computeLevels(applications, connecties) {
  const ids = applications.map((a) => a.id)
  const hasIncoming = new Set(connecties.map((c) => c.naar))
  const hasAnyEdge = new Set(connecties.flatMap((c) => [c.van, c.naar]))
  const levels = {}
  const queue = ids.filter((id) => hasAnyEdge.has(id) && !hasIncoming.has(id)).map((id) => ({ id, level: 0 }))
  const guard = new Set()

  while (queue.length) {
    const { id, level } = queue.shift()
    const key = `${id}:${level}`
    if (guard.has(key)) continue
    guard.add(key)
    levels[id] = Math.max(levels[id] ?? 0, level)
    connecties.filter((c) => c.van === id).forEach((c) => queue.push({ id: c.naar, level: level + 1 }))
  }

  const connected = ids.filter((id) => id in levels)
  const unconnected = ids.filter((id) => hasAnyEdge.has(id) && !(id in levels))
  const standalone = ids.filter((id) => !hasAnyEdge.has(id))
  return { levels, connected, unconnected: [...unconnected, ...standalone] }
}

function computeApplicatieflowLayout(applications, connecties, details, savedLayout) {
  const nodes = []
  const edges = []
  const byId = Object.fromEntries(applications.map((a) => [a.id, a]))

  function withSavedPosition(id, defaultPosition) {
    return savedLayout?.[id] ?? defaultPosition
  }

  const { levels, connected, unconnected } = computeLevels(applications, connecties)

  const byLevel = {}
  connected.forEach((id) => {
    const lvl = levels[id]
    if (!byLevel[lvl]) byLevel[lvl] = []
    byLevel[lvl].push(id)
  })

  Object.entries(byLevel).forEach(([lvl, idsInLevel]) => {
    idsInLevel.forEach((id, i) => {
      const nodeId = `app:${id}`
      nodes.push({
        id: nodeId,
        type: 'appNode',
        position: withSavedPosition(nodeId, { x: Number(lvl) * LEVEL_GAP_X + 40, y: LEVEL_Y + i * NODE_GAP_Y }),
        data: { naam: byId[id]?.naam, hasDetail: !!details[id], appId: id },
        draggable: true,
      })
    })
  })

  unconnected.forEach((id, i) => {
    const nodeId = `app:${id}`
    nodes.push({
      id: nodeId,
      type: 'appNode',
      position: withSavedPosition(nodeId, { x: 40 + i * LEVEL_GAP_X, y: UNCONNECTED_Y }),
      data: { naam: byId[id]?.naam, hasDetail: !!details[id], appId: id },
      draggable: true,
    })
  })

  connecties.forEach((c) => {
    if (!byId[c.van] || !byId[c.naar]) return
    edges.push({
      id: `appedge:${c.id}`,
      source: `app:${c.van}`,
      target: `app:${c.naar}`,
      style: { stroke: '#2a5f8a', strokeWidth: 2 },
      animated: true,
    })
  })

  const maxLevel = Math.max(0, ...Object.values(levels))
  const maxRows = Math.max(1, ...Object.values(byLevel).map((l) => l.length))
  const canvasWidth = Math.max(600, (maxLevel + 1) * LEVEL_GAP_X + 260)
  const canvasHeight = Math.max(420, LEVEL_Y + maxRows * NODE_GAP_Y + (unconnected.length > 0 ? 160 : 60))

  return { nodes, edges, canvasWidth, canvasHeight }
}

function AppNode({ data }) {
  const { t } = useLanguage()
  return (
    <div className="relative w-44 rounded-xl border-2 border-[#2a5f8a] bg-white px-3 py-2.5 shadow-md">
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <div className="text-sm font-semibold text-slate-800">{data.naam || '—'}</div>
      <button
        type="button"
        onClick={data.onOpenDetail}
        className={`mt-1.5 text-[11px] font-medium ${data.hasDetail ? 'text-[#2a5f8a]' : 'text-slate-400 hover:text-[#2a5f8a]'}`}
      >
        {data.hasDetail ? t('appflow.detailEdit') : t('appflow.detailAdd')}
      </button>
      <Handle type="source" position={Position.Right} style={{ opacity: 0.4 }} />
    </div>
  )
}

const nodeTypes = { appNode: AppNode }

export default function ApplicatieflowTab({ workflow, patch }) {
  const { t, language } = useLanguage()
  const [detailAppId, setDetailAppId] = useState(null)

  const applications = workflow.applications
  const applicatieflow = workflow.applicatieflow ?? emptyApplicatieflow()

  function patchApplicatieflow(partial) {
    patch({ applicatieflow: { ...applicatieflow, ...partial } })
  }

  function addConnection(van, naar) {
    if (!van || !naar || van === naar) return
    patchApplicatieflow({ connecties: [...applicatieflow.connecties, { id: generateId(), van, naar }] })
  }

  function removeConnection(id) {
    patchApplicatieflow({ connecties: applicatieflow.connecties.filter((c) => c.id !== id) })
  }

  function saveDetail(appId, fields) {
    patchApplicatieflow({ details: { ...applicatieflow.details, [appId]: { ...applicatieflow.details[appId], ...fields } } })
  }

  const [{ nodes, edges, canvasWidth, canvasHeight }, onNodesChange] = useMergedLayout(computeApplicatieflowLayout, [
    applications,
    applicatieflow.connecties,
    applicatieflow.details,
    applicatieflow.layout,
  ])

  function handleNodesChange(changes) {
    onNodesChange(changes)
    const finished = changes.filter((c) => c.type === 'position' && c.position && c.dragging === false)
    if (finished.length > 0) {
      const nextLayout = { ...applicatieflow.layout }
      for (const c of finished) nextLayout[c.id] = c.position
      patchApplicatieflow({ layout: nextLayout })
    }
  }

  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onOpenDetail: () => setDetailAppId(n.data.appId) },
  }))

  const detailApp = applications.find((a) => a.id === detailAppId)
  const detailData = detailAppId ? (applicatieflow.details[detailAppId] ?? {}) : {}

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
        {t('appflow.noApplications')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{t('appflow.questionTitle')}</h3>
        {applicatieflow.connecties.length === 0 && <p className="mb-2 text-xs text-slate-400">{t('appflow.connectionsEmpty')}</p>}
        <div className="space-y-2">
          {applicatieflow.connecties.map((c) => {
            const van = applications.find((a) => a.id === c.van)
            const naar = applications.find((a) => a.id === c.naar)
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-700">{van?.naam || '—'}</span>
                <span className="text-slate-400">→</span>
                <span className="font-medium text-slate-700">{naar?.naam || '—'}</span>
                <button type="button" onClick={() => removeConnection(c.id)} className="ml-auto text-xs text-[#9a3b2e] hover:underline">
                  {t('teampage.remove')}
                </button>
              </div>
            )
          })}
        </div>
        <ConnectionPicker applications={applications} onAdd={addConnection} t={t} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{t('appflow.canvasTitle')}</h3>
          <span className="text-[11px] text-slate-400">{t('appflow.canvasHint')}</span>
        </div>
        <div className="relative rounded-lg border border-slate-100" style={{ height: Math.min(canvasHeight, 520) }}>
          <PannableFlowCanvas
            // Remount bij een wijzigend aantal koppelingen: de vragenlijst erboven
            // verandert dan van hoogte, wat de canvas-container in dezelfde tick
            // laat verschuiven. React Flow's fitView rekent anders nog met de
            // oude containerpositie, waardoor nodes buiten het zichtbare (geclipte)
            // vlak belanden — zichtbaar correct in de DOM, onzichtbaar op het scherm.
            key={applicatieflow.connecties.length}
            nodes={nodesWithHandlers}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
          />
        </div>
      </div>

      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">{detailApp.naam}</h3>
              <button type="button" onClick={() => setDetailAppId(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailToelichting')}</label>
                <textarea
                  value={detailData.toelichting ?? ''}
                  onChange={(e) => saveDetail(detailAppId, { toelichting: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">{t('appflow.detailRisico')}</label>
                <select
                  value={detailData.risico_bij_uitval ?? ''}
                  onChange={(e) => saveDetail(detailAppId, { risico_bij_uitval: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                >
                  <option value="">—</option>
                  {RISICO_BIJ_UITVAL.map((val) => (
                    <option key={val} value={val}>
                      {translateRisicoBijUitval(val, language)}
                    </option>
                  ))}
                </select>
              </div>
              {detailData.risico_bij_uitval === 'ja' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('appflow.detailRisicoToelichting')}</label>
                  <input
                    value={detailData.risico_toelichting ?? ''}
                    onChange={(e) => saveDetail(detailAppId, { risico_toelichting: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setDetailAppId(null)}
                className="rounded-md bg-[#2a5f8a] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#1f4a6c]"
              >
                {t('appflow.detailClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectionPicker({ applications, onAdd, t }) {
  const [van, setVan] = useState('')
  const [naar, setNaar] = useState('')

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
      <select
        value={van}
        onChange={(e) => setVan(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
      >
        <option value="">{t('appflow.vanLabel')}</option>
        {applications.map((a) => (
          <option key={a.id} value={a.id}>
            {a.naam || '—'}
          </option>
        ))}
      </select>
      <span className="text-slate-400">→</span>
      <select
        value={naar}
        onChange={(e) => setNaar(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#2a5f8a] focus:outline-none"
      >
        <option value="">{t('appflow.naarLabel')}</option>
        {applications.map((a) => (
          <option key={a.id} value={a.id}>
            {a.naam || '—'}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onAdd(van, naar)
          setVan('')
          setNaar('')
        }}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {t('appflow.addConnection')}
      </button>
    </div>
  )
}
