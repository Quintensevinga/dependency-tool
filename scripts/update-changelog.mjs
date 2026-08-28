import fs from 'node:fs'

// Voegt de commits van een push toe aan CHANGELOG.md, gegroepeerd per datum,
// nieuwste bovenaan. Wordt aangeroepen door .github/workflows/changelog.yml
// met de commits van de push in de COMMITS_JSON env var (github.event.commits,
// altijd oudste-eerst per GitHub's push-payload).
const FILE = 'CHANGELOG.md'
const INTRO = '# Changelog\n\nAutomatisch bijgehouden overzicht van wijzigingen op main. Nieuwste bovenaan.\n\n'

const commits = JSON.parse(process.env.COMMITS_JSON || '[]').filter(
  (c) => !c.message.includes('[skip changelog]'),
)

if (commits.length === 0) {
  console.log('Geen relevante commits in deze push, changelog blijft ongewijzigd.')
  process.exit(0)
}

let content = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : INTRO

function entryLine(commit) {
  const subject = commit.message.split('\n')[0].trim()
  const author = commit.author?.name || 'onbekend'
  return `- ${subject} (${author})`
}

for (const commit of commits) {
  const date = commit.timestamp.slice(0, 10)
  const line = entryLine(commit)
  const header = `## ${date}`
  const headerIdx = content.indexOf(header + '\n')

  if (headerIdx !== -1) {
    // Datum bestaat al: nieuwe regel direct onder de kop, dus ook binnen één
    // dag blijft het nieuwste bovenaan.
    const insertAt = headerIdx + header.length + 1
    content = content.slice(0, insertAt) + line + '\n' + content.slice(insertAt)
  } else {
    // Nieuwe datum: invoegen vóór de eerste bestaande sectie die ouder is,
    // zodat de volgorde altijd nieuwste-bovenaan klopt — ook in het
    // (zeldzame) geval dat een push een oudere datum bevat die nog geen
    // eigen sectie had.
    const headerRegex = /^## (\d{4}-\d{2}-\d{2})$/gm
    let insertAt = null
    let match
    while ((match = headerRegex.exec(content))) {
      if (match[1] < date) {
        insertAt = match.index
        break
      }
    }
    if (insertAt === null) {
      content = content.trimEnd() + `\n\n${header}\n${line}\n`
    } else {
      content = content.slice(0, insertAt) + `${header}\n${line}\n\n` + content.slice(insertAt)
    }
  }
}

fs.writeFileSync(FILE, content)
console.log(`CHANGELOG.md bijgewerkt met ${commits.length} commit(s).`)
