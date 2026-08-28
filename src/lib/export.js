// Retourneert of de export echt is gelukt i.p.v. stil terug te keren bij een
// leeg/ontbrekend element — de aanroeper (App.jsx) toont dan een duidelijke
// melding in plaats van dat de knop merkbaar niets doet.
//
// html2canvas-pro wordt hier dynamisch geïmporteerd (i.p.v. statisch
// bovenaan) — het is een fors pakket dat verder nergens in de app gebruikt
// wordt, dus alleen laden op het moment dat iemand daadwerkelijk exporteert
// i.p.v. altijd in de hoofdbundel (zie B-18).
export async function exportElementAsPng(element, filename) {
  if (!element) return false
  const { default: html2canvas } = await import('html2canvas-pro')
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 })
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
  return true
}

export function exportDataAsJson(state, filename) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
