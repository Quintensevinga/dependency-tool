import { useEffect, useLayoutEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

// Generieke spotlight-rondleiding: verduistert het scherm behalve een
// uitgesneden rechthoek rond het element bij `data-tour="{step.target}"`,
// met een tekstkaart ernaast die uitlegt wat daar te zien is. Puur
// CSS-techniek (box-shadow-cutout), geen externe library nodig.
export default function SpotlightTour({ steps, onClose }) {
  const { t } = useLanguage()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  // Alleen de stappen waarvan het doelelement er echt staat. Op een leeg team
  // wees de rondleiding naar secties die nog niet bestaan: een verduisterd
  // scherm met een tekstkaart over iets wat je nergens ziet. Staat er niets
  // van de rondleiding op de pagina, dan gaat hij meteen dicht in plaats van
  // een leeg scherm te tonen.
  //
  // useLayoutEffect en niet tijdens de render: dit component wordt samen met
  // de pagina eromheen gerenderd, dus tijdens die render staat de rest nog
  // niet in de DOM en zou querySelector alles wegfilteren.
  const [zichtbareStappen, setZichtbareStappen] = useState(null)
  useLayoutEffect(() => {
    const aanwezig = steps.filter((s) => document.querySelector(`[data-tour="${s.target}"]`))
    if (aanwezig.length === 0) {
      onClose()
      return
    }
    setZichtbareStappen(aanwezig)
    // Eenmalig bij het openen: de rondleiding hoort niet halverwege van
    // samenstelling te veranderen doordat er iets bijkomt op de pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape sluit de rondleiding. Zonder dit was 'Overslaan' in de kaart de
  // enige uitweg, en die staat niet altijd in beeld.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const step = zichtbareStappen?.[stepIndex]

  useEffect(() => {
    let cancelled = false
    const el = step ? document.querySelector(`[data-tour="${step.target}"]`) : null
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
    // Meet een paar keer kort na elkaar in plaats van één keer na een vaste
    // vertraging: `scrollIntoView` en eventuele layout-reflow (bv. een
    // tabwissel) zijn niet altijd binnen dezelfde tick klaar, en één vaste
    // timeout race'te af en toe met die reflow.
    let attempts = 0
    function measure() {
      if (cancelled) return
      setRect(el.getBoundingClientRect())
      attempts += 1
      if (attempts < 6) requestAnimationFrame(measure)
    }
    const raf = requestAnimationFrame(measure)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [stepIndex, step])

  const isLast = stepIndex === (zichtbareStappen?.length ?? 0) - 1
  const pad = 8

  const cutout = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  // Tooltip onder het uitgesneden vlak plaatsen, of erboven als er onderin
  // geen ruimte meer is.
  const tooltipTop = cutout
    ? cutout.top + cutout.height + 16 + 160 > window.innerHeight
      ? Math.max(16, cutout.top - 16 - 180)
      : cutout.top + cutout.height + 16
    : window.innerHeight / 2 - 90
  const tooltipLeft = cutout ? Math.min(Math.max(16, cutout.left), window.innerWidth - 336) : window.innerWidth / 2 - 160

  // Zolang nog niet bepaald is welke stappen er zijn: niets tekenen. Anders
  // flitst er een verduisterd scherm voorbij dat daarna leeg blijkt.
  if (!zichtbareStappen || !step) return null

  return (
    <div className="fixed inset-0 z-[100]">
      {cutout ? (
        <div
          className="absolute rounded-lg transition-all duration-200"
          style={{
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            boxShadow: '0 0 0 9999px rgba(30,41,59,0.72)',
            border: '2px solid #2a5f8a',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#1e293b]/70" />
      )}

      <div className="absolute w-80 rounded-xl bg-white p-4 shadow-2xl" style={{ top: tooltipTop, left: tooltipLeft }}>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {stepIndex + 1} / {zichtbareStappen.length}
        </div>
        <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{step.title}</h3>
        <p className="mb-4 text-xs leading-relaxed text-slate-600">{step.body}</p>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            {t('tour.skip')}
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('tour.previous')}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setStepIndex((i) => i + 1))}
              className="rounded-md bg-[#2a5f8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1f4a6c]"
            >
              {isLast ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
