import { getNodesBounds, getViewportForBounds } from 'reactflow'

// Zoomt zo groot mogelijk in op alle (zichtbare) nodes — een gewone volledige
// fit — en houdt daarbij alleen rekening met een kléíne, rechthoekige
// 'safe area' in de linkerbenedenhoek (waar de zwevende canvas-toolbar zit).
// Bewust geen marge over de hele breedte/hoogte: eerdere versie trok
// reserveLeft/reserveBottom af van de volledige paneWidth/paneHeight, wat de
// hele fit onnodig veel kleiner maakte terwijl de toolbar zelf maar een klein
// hoekje beslaat. Nu geldt: eerst een normale, volledige fit; alleen als de
// content dáárna echt in de hoek terechtkomt, verschuiven we 'm net genoeg om
// vrij te komen; pas als verschuiven niet zou passen (content te groot voor
// de resterende ruimte) wijkt dit uit naar iets minder zoom. Zo blijft "zo
// groot mogelijk" de norm en is de hoek-correctie de uitzondering.
export function fitViewAvoidingCorner(
  instance,
  paneEl,
  { safeAreaWidth = 0, safeAreaHeight = 0, padding = 0.1, minZoom = 0.2, maxZoom = 2, duration = 200 } = {},
) {
  if (!instance || !paneEl) return
  const nodes = instance.getNodes().filter((node) => !node.hidden)
  if (nodes.length === 0) return
  const bounds = getNodesBounds(nodes)
  const paneWidth = paneEl.clientWidth
  const paneHeight = paneEl.clientHeight
  if (!paneWidth || !paneHeight) return

  let { zoom } = getViewportForBounds(bounds, paneWidth, paneHeight, minZoom, maxZoom, padding)
  let x = (paneWidth - bounds.width * zoom) / 2 - bounds.x * zoom
  let y = (paneHeight - bounds.height * zoom) / 2 - bounds.y * zoom

  if (safeAreaWidth > 0 && safeAreaHeight > 0) {
    const safeRight = safeAreaWidth
    const safeTop = paneHeight - safeAreaHeight
    const contentLeft = x + bounds.x * zoom
    const contentRight = contentLeft + bounds.width * zoom
    const contentBottom = y + (bounds.y + bounds.height) * zoom
    const overlapsCorner = contentLeft < safeRight && contentBottom > safeTop

    if (overlapsCorner) {
      const shiftX = safeRight - contentLeft
      const shiftY = safeTop - contentBottom
      const fitsAfterShift = contentRight + shiftX <= paneWidth && y + shiftY + bounds.y * zoom >= 0
      if (fitsAfterShift) {
        x += shiftX
        y += shiftY
      } else {
        // Verschuiven alleen zou content aan de tegenoverliggende rand
        // afsnijden — de content is dus te groot om de hoek te ontwijken op
        // volle zoom. Enige overgebleven optie: fitten binnen de ruimte die
        // overblijft ná de safe area (het oude gedrag), maar alléén nu het
        // écht nodig is, niet standaard.
        const effectiveWidth = Math.max(paneWidth - safeAreaWidth, 80)
        const effectiveHeight = Math.max(paneHeight - safeAreaHeight, 80)
        zoom = getViewportForBounds(bounds, effectiveWidth, effectiveHeight, minZoom, maxZoom, padding).zoom
        x = safeAreaWidth + (effectiveWidth - bounds.width * zoom) / 2 - bounds.x * zoom
        y = (effectiveHeight - bounds.height * zoom) / 2 - bounds.y * zoom
      }
    }
  }

  instance.setViewport({ x, y, zoom }, { duration })
}
