// Bouwt een prefill-object voor het dependency-formulier op basis van een
// bestaande dependency, voor de 'Dupliceren'-actie. Draagt bewust geen id,
// laatst_bijgewerkt of geaccepteerd-status over — die worden bij het
// opslaan van de kopie vers bepaald (nieuw id, huidige datum, nooit al
// geaccepteerd). Het team komt wel mee als voorinvulling, maar blijft in
// het formulier gewoon een wijzigbaar keuzeveld.
export function buildDuplicatePrefill(dependency, titlePrefix) {
  const { id: _id, laatst_bijgewerkt: _laatstBijgewerkt, geaccepteerd: _geaccepteerd, ...rest } = dependency
  return { ...rest, titel: `${titlePrefix}${dependency.titel}` }
}
