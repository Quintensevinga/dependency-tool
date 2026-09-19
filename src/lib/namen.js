// Eén vergelijkingsregel voor namen, voor élke plek waar de app op dubbele
// namen controleert: hoofdletters, streepjes, spaties en onderstrepingen tellen
// niet mee. Bewust hier en niet per scherm: als het formulier strenger of losser
// vergelijkt dan de controlelijst, waarschuwt de een wel en de ander niet — en
// dan lijkt de app zichzelf tegen te spreken.
//
// Wat er níét in zit: diakrieten normaliseren of afkortingen uitschrijven.
// 'Polis' en 'Polissen' blijven dus verschillend, en dat hoort ook: dit is een
// waarschuwing die de gebruiker zelf beoordeelt, geen automatische samenvoeging.
export function vergelijkbareNaam(naam) {
  if (typeof naam !== 'string') return ''
  return naam.toLowerCase().replace(/[\s\-_]+/g, '')
}

// Twee namen die onder die regel hetzelfde zijn. Lege namen leveren nooit een
// match op: anders zou elk naamloos record met elk ander naamloos record
// "dubbel" heten.
export function zelfdeNaam(a, b) {
  const genormaliseerdA = vergelijkbareNaam(a)
  if (!genormaliseerdA) return false
  return genormaliseerdA === vergelijkbareNaam(b)
}
