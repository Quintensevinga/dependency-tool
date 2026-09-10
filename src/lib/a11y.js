import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Kleine, herbruikbare a11y-hook voor modals/drawers/panelen:
// - zet focus op het eerste focusbare element zodra het paneel opent
// - sluit het paneel bij Escape (en alleen dít paneel — zie stopImmediatePropagation)
// - houdt Tab/Shift+Tab binnen het paneel (focus-trap)
// - geeft focus terug aan het element dat het paneel opende, bij sluiten
// Stapel van geopende panelen: alleen het bovenste (laatst geopende) paneel
// reageert op Escape. Document-listeners vuren in registratievolgorde, dus
// zonder deze stapel sloot Escape in een formulier dat vanuit het
// Instellingen-paneel geopend was (Admin → Wijzigingenlog → Bewerken) éérst
// het buitenste paneel — en daarmee ongevraagd ook het formulier, zonder de
// gebruikelijke 'wijzigingen weggooien?'-vraag.
const openPanels = []

// trapFocus: false voor een inline paneel (bv. de selectielijst onder de
// Relatiekaart) — dat krijgt wél Escape-om-te-sluiten en focus bij openen,
// maar geen focus-trap: een sectie in de pagina is geen modal, en Tab moet
// gewoon verder de pagina in kunnen.
export function useModalA11y({ open, onClose, containerRef, trapFocus = true }) {
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
    const panel = {}
    openPanels.push(panel)

    const container = containerRef.current
    const focusTimer = window.setTimeout(() => {
      const focusable = container?.querySelector(FOCUSABLE_SELECTOR)
      ;(focusable ?? container)?.focus?.()
    }, 0)

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        // Niet het bovenste paneel: laat de Escape over aan het paneel dat
        // wél bovenop ligt (zie openPanels hierboven).
        if (openPanels[openPanels.length - 1] !== panel) return
        // stopPropagation voorkomt niet dat ándere keydown-luisteraars op
        // hetzelfde document-object ook vuren (die zijn niet in een
        // ouder/kind-relatie met elkaar, dus propagatie is niet het
        // mechanisme dat ze koppelt) — bij twee open panelen sloot Escape
        // daardoor ze allebei tegelijk. stopImmediatePropagation stopt ook
        // de overige listeners die op ditzelfde moment op hetzelfde element
        // geregistreerd staan.
        e.stopImmediatePropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key === 'Tab' && trapFocus) {
        const node = containerRef.current
        if (!node) return
        const focusableEls = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        )
        if (focusableEls.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusableEls[0]
        const last = focusableEls[focusableEls.length - 1]
        const active = document.activeElement
        // Focus-trap: buiten het paneel (of op de randen ervan) mag Tab niet
        // naar de rest van de pagina lekken — wrapt terug naar het andere
        // uiteinde van het paneel.
        if (e.shiftKey) {
          if (active === first || !node.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else if (active === last || !node.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      const index = openPanels.indexOf(panel)
      if (index >= 0) openPanels.splice(index, 1)
      triggerRef.current?.focus?.()
    }
  }, [open, containerRef, trapFocus])
}
