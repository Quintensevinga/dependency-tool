import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Kleine, herbruikbare a11y-hook voor modals/drawers/panelen:
// - zet focus op het eerste focusbare element zodra het paneel opent
// - sluit het paneel bij Escape
// - geeft focus terug aan het element dat het paneel opende, bij sluiten
export function useModalA11y({ open, onClose, containerRef }) {
  const triggerRef = useRef(null)
  // onClose komt bij de meeste aanroepers (bv. DependencyForm) elke render
  // opnieuw binnen als een nieuwe inline functie. Die niet rechtstreeks als
  // effect-dependency gebruiken, maar via een ref bijhouden: anders vuurt dit
  // effect (incl. de forceer-focus-timer hieronder) bij elke toetsaanslag in
  // het formulier opnieuw af, en springt de focus middenin het typen naar het
  // eerste focusbare element (vaak de sluitknop) — precies het "focus
  // springt weg tijdens typen"-bug dat dit veroorzaakte.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

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
        onCloseRef.current?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus?.()
    }
  }, [open, containerRef])
}
