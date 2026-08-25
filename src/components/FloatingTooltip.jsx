import { useLayoutEffect, useRef, useState } from 'react'

// Tooltip volgt de cursor, maar klapt om zodra hij anders buiten de viewport
// (of de scrollcontainer waarin het canvas zit) zou vallen — rechts/onder
// standaard, links/boven zodra daar geen ruimte meer is. Meet zichzelf na
// render (de inhoud varieert per hover) i.p.v. een vaste breedte/hoogte aan
// te nemen.
const OFFSET = 16
const MARGIN = 8

export default function FloatingTooltip({ x, y, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (x == null || y == null || !ref.current) {
      setPos(null)
      return
    }
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const vw = window.innerWidth
    const vh = window.innerHeight

    const fitsRight = x + OFFSET + w <= vw - MARGIN
    const left = fitsRight ? x + OFFSET : Math.max(MARGIN, x - OFFSET - w)

    const fitsBelow = y + OFFSET + h <= vh - MARGIN
    const top = fitsBelow ? y + OFFSET : Math.max(MARGIN, y - OFFSET - h)

    setPos({ left, top })
  }, [x, y, children])

  if (x == null || y == null) return null
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[60] w-64 max-w-[calc(100vw-16px)] rounded-lg bg-[#1e293b] px-3.5 py-3 text-xs leading-relaxed text-slate-100 shadow-xl"
      // Eerste render (vóór de layout-meting) alvast op x/y+offset zetten
      // i.p.v. pos=null over te slaan — anders flikkert de tooltip één frame
      // op de verkeerde plek voordat useLayoutEffect 'm corrigeert.
      style={{ left: pos?.left ?? x + OFFSET, top: pos?.top ?? y + OFFSET, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>
  )
}
