import { getNodesBounds, getViewportForBounds } from 'reactflow'

// Zoomt zo ver mogelijk in op alle nodes, maar houdt een rechthoekige marge
// vrij in de linkerbenedenhoek van het canvas (waar de zwevende
// canvas-toolbar overheen zou vallen) zodat daar nooit content onder
// verdwijnt. Bij weinig/compacte content (marge niet nodig) is het resultaat
// gelijk aan een gewone fitView.
export function fitViewAvoidingCorner(
  instance,
  paneEl,
  { reserveLeft = 0, reserveBottom = 0, padding = 0.15, minZoom = 0.2, maxZoom = 2, duration = 200 } = {},
) {
  if (!instance || !paneEl) return
  const nodes = instance.getNodes().filter((node) => !node.hidden)
  if (nodes.length === 0) return
  const bounds = getNodesBounds(nodes)
  const paneWidth = paneEl.clientWidth
  const paneHeight = paneEl.clientHeight
  if (!paneWidth || !paneHeight) return

  const effectiveWidth = Math.max(paneWidth - reserveLeft, 80)
  const effectiveHeight = Math.max(paneHeight - reserveBottom, 80)
  const { zoom } = getViewportForBounds(bounds, effectiveWidth, effectiveHeight, minZoom, maxZoom, padding)
  const x = reserveLeft + (effectiveWidth - bounds.width * zoom) / 2 - bounds.x * zoom
  const y = (effectiveHeight - bounds.height * zoom) / 2 - bounds.y * zoom
  instance.setViewport({ x, y, zoom }, { duration })
}
