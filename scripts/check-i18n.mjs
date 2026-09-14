#!/usr/bin/env node
// Controleert of elke statisch gebruikte t('…')-sleutel in src/ bestaat in
// zowel de nl- als en-woordenlijst (src/i18n/strings.js), en of beide
// woordenlijsten dezelfde sleutels hebben. Dynamische sleutels
// (t(`prefix.${x}`)) worden apart genoemd om handmatig na te lopen.
//
//   node scripts/check-i18n.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const { STRINGS } = await import(path.join(root, 'src/i18n/strings.js'))
const nl = new Set(Object.keys(STRINGS.nl))
const en = new Set(Object.keys(STRINGS.en))

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) walk(full, out)
    else if (/\.(jsx?|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

const used = new Map()
const dynamic = []
for (const file of walk(path.join(root, 'src')).filter((f) => !f.endsWith('i18n/strings.js'))) {
  const src = fs.readFileSync(file, 'utf8')
  const rel = path.relative(root, file)
  for (const m of src.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)) {
    if (!used.has(m[2])) used.set(m[2], [])
    used.get(m[2]).push(rel)
  }
  for (const m of src.matchAll(/\bt\(\s*`([^`]+)`/g)) dynamic.push(`${rel}: \`${m[1]}\``)
}

const problems = []
for (const key of used.keys()) {
  if (!nl.has(key)) problems.push(`ontbreekt in nl: ${key} (${used.get(key).join(', ')})`)
  if (!en.has(key)) problems.push(`ontbreekt in en: ${key} (${used.get(key).join(', ')})`)
}
for (const key of nl) if (!en.has(key)) problems.push(`alleen in nl: ${key}`)
for (const key of en) if (!nl.has(key)) problems.push(`alleen in en: ${key}`)

console.log(`${used.size} statische sleutels gecontroleerd, ${nl.size} nl / ${en.size} en sleutels.`)
if (dynamic.length > 0) {
  console.log('Dynamische sleutels (handmatig nalopen):')
  for (const d of dynamic) console.log(`  ${d}`)
}
if (problems.length === 0) {
  console.log('Geen ontbrekende of scheve sleutels.')
  process.exit(0)
}
console.log(`${problems.length} probleem/problemen:`)
for (const p of problems) console.log(`  - ${p}`)
process.exit(1)
