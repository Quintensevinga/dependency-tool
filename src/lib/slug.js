// Losstaande slug-utility (geen afhankelijkheid van storage.js of
// mockData.js) zodat beide die vrij kunnen importeren zonder circulaire
// imports te veroorzaken.

export function slugify(text) {
  return (
    String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') // diakrieten weg (bv. o + trema -> o)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  )
}

export function uniqueSlug(base, existingIds) {
  let candidate = slugify(base)
  let i = 2
  while (existingIds.has(candidate)) {
    candidate = `${slugify(base)}-${i}`
    i += 1
  }
  return candidate
}
