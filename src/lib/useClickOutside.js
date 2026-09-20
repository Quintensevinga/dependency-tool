import { useEffect } from 'react'

// Sluit een floating dropdown/popover zodra er ergens buiten geklikt wordt —
// naast de eigen toggle-knop, die al werkt via de gewone onClick. Gebruikt
// door de toolbar-menu's (+ Toevoegen, Weergeven/Filters, Legenda).
export function useClickOutside(ref, active, onOutside) {
  useEffect(() => {
    if (!active) return
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [active, onOutside, ref])
}
