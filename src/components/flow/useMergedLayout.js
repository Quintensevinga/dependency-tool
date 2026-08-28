import { useCallback, useEffect, useState } from 'react'
import { applyNodeChanges } from 'reactflow'

// Herbruikbaar patroon: herberekent een layout (nodes/edges/eventuele extra
// velden) zodra de gegeven afhankelijkheden wijzigen, maar behoudt de positie
// van nodes die de gebruiker zelf handmatig heeft versleept (`moved: true`) —
// alle overige nodes krijgen bij elke herberekening hun vers berekende
// positie. Zonder dit onderscheid zou een nooit-versleepte node zijn oude
// rasterpositie behouden terwijl het rooster om hem heen verschuift (bv. een
// nieuw toegevoegde categorie schuift alle erna liggende posities op), met
// overlappende nodes tot gevolg. `computeLayout` moet een zuivere functie zijn
// die `{ nodes, edges, ...extra }` teruggeeft en wordt aangeroepen als
// `computeLayout(...deps)`.
export function useMergedLayout(computeLayout, deps) {
  const [layout, setLayout] = useState(() => computeLayout(...deps))

  // `deps` is doorgegeven door de aanroeper en bepaalt zelf wanneer herberekend
  // moet worden — de linter kan de inhoud van die dynamische array niet
  // statisch controleren, vandaar de disable vlak vóór de hook-aanroep zelf
  // (een disable ná de setState-call, zoals voorheen, onderdrukte de
  // waarschuwing niet: die wordt aan de useEffect-aanroep zelf toegeschreven).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fresh = computeLayout(...deps)
    setLayout((prev) => {
      const prevById = new Map(prev.nodes.map((n) => [n.id, n]))
      const mergedNodes = fresh.nodes.map((n) => {
        const prevNode = prevById.get(n.id)
        return prevNode?.moved ? { ...n, position: prevNode.position, moved: true } : n
      })
      return { ...fresh, nodes: mergedNodes }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const onNodesChange = useCallback((changes) => {
    setLayout((prev) => {
      const movedIds = new Set(changes.filter((c) => c.type === 'position' && c.position).map((c) => c.id))
      const nodes = applyNodeChanges(changes, prev.nodes).map((n) => (movedIds.has(n.id) ? { ...n, moved: true } : n))
      return { ...prev, nodes }
    })
  }, [])

  return [layout, onNodesChange]
}
