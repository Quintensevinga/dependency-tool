// Zuivere functie die ketenkoppelingen herleidt uit de teamWorkflows: een
// input van team B die expliciet verwijst naar een output-item van team A
// (via id-referentie, nooit tekst-matching) levert één gekoppelde edge op.
// Niet-gekoppelde input/output-items worden hier simpelweg niet in
// opgenomen — de aanroeper rendert ze los, nooit als foutstatus.
export function resolveChainEdges(teamWorkflows) {
  const edges = []

  for (const [team, workflow] of Object.entries(teamWorkflows)) {
    for (const input of workflow.inputs ?? []) {
      if (!input.linkedTeam || !input.linkedOutputId) continue
      const sourceWorkflow = teamWorkflows[input.linkedTeam]
      const sourceOutput = sourceWorkflow?.outputs?.find((o) => o.id === input.linkedOutputId)
      if (!sourceOutput) continue
      edges.push({
        id: `${input.linkedTeam}:${sourceOutput.id}->${team}:${input.id}`,
        sourceTeam: input.linkedTeam,
        sourceOutputId: sourceOutput.id,
        sourceLabel: sourceOutput.label,
        targetTeam: team,
        targetInputId: input.id,
        targetLabel: input.label,
      })
    }
  }

  return edges
}
