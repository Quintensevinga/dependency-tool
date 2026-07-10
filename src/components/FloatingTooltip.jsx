export default function FloatingTooltip({ x, y, children }) {
  if (x == null || y == null) return null
  return (
    <div
      className="pointer-events-none fixed z-[60] w-64 rounded-lg bg-[#241f1a] px-3.5 py-3 text-xs leading-relaxed text-stone-100 shadow-xl"
      style={{ left: x + 16, top: y + 16 }}
    >
      {children}
    </div>
  )
}
