import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Kleine, herbruikbare a11y-hook voor modals/drawers/panelen:
// - zet focus op het eerste focusbare element zodra het paneel opent
// - sluit het paneel bij Escape
// - geeft focus terug aan het element dat het paneel opende, bij sluiten
export function useModalA11y({ open, onClose, containerRef }) {
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    triggerRef.current = document.activeElement

    const container = containerRef.current
    const focusTimer = window.setTimeout(() => {
      const focusable = container?.querySelector(FOCUSABLE_SELECTOR)
      ;(focusable ?? container)?.focus?.()
    }, 0)

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus?.()
    }
  }, [open, onClose, containerRef])
}
