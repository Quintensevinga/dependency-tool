import fs from 'node:fs'

// Voegt de commits van een push toe aan CHANGELOG.md, gegroepeerd per datum,
// nieuwste bovenaan. Wordt aangeroepen door .github/workflows/changelog.yml
// met de commits van de push in de COMMITS_JSON env var (github.event.commits,
// altijd oudste-eerst per GitHub's push-payload).
//
// Elke entry toont de subject-regel vetgedrukt, met de commit-body (het
// "waarom"/de details) als ingesprongen subtekst eronder — dat maakt de
// daadwerkelijke inhoud van een change leesbaar zonder de volledige commit
// te hoeven opzoeken. De Co-Authored-By-regel wordt eruit gefilterd.
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

function stripTrailers(body) {
  return body
    .split('\n')
    .filter((line) => !/^co-authored-by:/i.test(line.trim()))
    .join('\n')
    .trim()
}

// 2 spaties inspringen zodat het als vervolgparagraaf van hetzelfde
// lijst-item rendert (GitHub-flavored markdown) i.p.v. als losse tekst.
function indentBody(body) {
  return body
    .split('\n')
    .map((line) => (line.trim() ? `  ${line}` : ''))
    .join('\n')
}

function entryBlock(commit) {
  const [subjectLine, ...bodyLines] = commit.message.split('\n')
  const subject = subjectLine.trim()
  const author = commit.author?.name || 'onbekend'
  const body = stripTrailers(bodyLines.join('\n'))
  return body ? `- **${subject}** (${author})\n\n${indentBody(body)}` : `- **${subject}** (${author})`
}

for (const commit of commits) {
  const date = commit.timestamp.slice(0, 10)
  const block = entryBlock(commit)
  const header = `## ${date}`
  const headerIdx = content.indexOf(header + '\n')

  if (headerIdx !== -1) {
    // Datum bestaat al: nieuwe entry direct onder de kop, dus ook binnen één
    // dag blijft het nieuwste bovenaan.
    const insertAt = headerIdx + header.length + 1
    content = content.slice(0, insertAt) + block + '\n\n' + content.slice(insertAt)
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
      content = content.trimEnd() + `\n\n${header}\n${block}\n`
    } else {
      content = content.slice(0, insertAt) + `${header}\n${block}\n\n` + content.slice(insertAt)
    }
  }
}

fs.writeFileSync(FILE, content)
console.log(`CHANGELOG.md bijgewerkt met ${commits.length} commit(s).`)
