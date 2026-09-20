import { vergelijkbareNaam } from './namen.js'

// Scheefstand in wat er al staat: records zonder naam, en dezelfde externe
// partij die meer dan één keer voorkomt.
//
// Alle regels die deze opdracht toevoegt werken vooruit — ze voorkomen dat er
// nieuwe naamloze of dubbele records bijkomen. Wat er al stond bleef daardoor
// onvindbaar. Deze twee controles maken dat zichtbaar.
//
// Bewust alleen rapporteren en nooit repareren: een naamloos item weggooien of
// twee partijen samenvoegen is per geval een keuze, en de verkeerde keuze is
// hier onomkeerbaar.
//
// Eén bron voor twee plekken: de Analysepagina en scripts/audit-relations.mjs.
// Twee kopieën van deze regels zouden na de eerste wijziging andere aantallen
// geven, en dan weet niemand meer welke klopt.

function naamVan(record) {
  return typeof record?.naam === 'string' ? record.naam : ''
}

// Wat telt als 'geen naam': leeg, alleen spaties, of helemaal afwezig. Een
// streepje of een punt telt wél als naam — dat is een bewuste (zij het magere)
// invoer van iemand, geen gat.
function leeg(waarde) {
  return typeof waarde !== 'string' || waarde.trim() === ''
}

export function vindNaamloos(parsed) {
  const teams = Array.isArray(parsed?.teams) ? parsed.teams : []
  const teamNaam = new Map(teams.map((tm) => [tm?.id, naamVan(tm) || tm?.id]))
  const treffers = []

  for (const tm of teams) {
    if (leeg(tm?.naam)) treffers.push({ soort: 'team', id: tm?.id ?? '—', team: null, omschrijving: tm?.id ?? '—' })
  }

  for (const dep of Array.isArray(parsed?.dependencies) ? parsed.dependencies : []) {
    if (leeg(dep?.titel)) {
      treffers.push({ soort: 'dependency', id: dep?.id ?? '—', team: teamNaam.get(dep?.teamId) ?? null, omschrijving: dep?.id ?? '—' })
    }
  }

  for (const party of Array.isArray(parsed?.externalParties) ? parsed.externalParties : []) {
    if (leeg(party?.naam)) treffers.push({ soort: 'partij', id: party?.id ?? '—', team: null, omschrijving: party?.id ?? '—' })
  }

  for (const [teamId, wf] of Object.entries(parsed?.teamWorkflows ?? {})) {
    if (!wf || typeof wf !== 'object') continue
    const naam = teamNaam.get(teamId) ?? teamId
    for (const kant of ['inputs', 'outputs']) {
      for (const item of wf[kant] ?? []) {
        if (leeg(item?.label)) {
          treffers.push({ soort: kant === 'inputs' ? 'input' : 'output', id: item?.id ?? '—', team: naam, omschrijving: item?.id ?? '—' })
        }
      }
    }
    for (const app of wf.applications ?? []) {
      if (leeg(app?.naam)) treffers.push({ soort: 'applicatie', id: app?.id ?? '—', team: naam, omschrijving: app?.id ?? '—' })
    }
    for (const rij of wf.capacity ?? []) {
      if (leeg(rij?.rol)) treffers.push({ soort: 'capaciteit', id: rij?.id ?? '—', team: naam, omschrijving: rij?.id ?? '—' })
    }
  }

  return treffers
}

// Externe partijen die onder de vergelijkingsregel dezelfde naam hebben
// (hoofdletters, streepjes, spaties en onderstrepingen negeren — zie
// lib/namen.js, dezelfde regel als de waarschuwing in de partijkiezer).
//
// Geweigerde partijen tellen mee: die staan nog in de lijst en kunnen nog
// steeds aan records gekoppeld zijn. Naamloze partijen niet — die komen al uit
// vindNaamloos, en zonder deze uitzondering zou elk naamloos paar hier als
// "dubbel" verschijnen.
export function vindDubbelePartijen(parsed) {
  const groepen = new Map()
  for (const party of Array.isArray(parsed?.externalParties) ? parsed.externalParties : []) {
    const sleutel = vergelijkbareNaam(naamVan(party))
    if (!sleutel) continue
    if (!groepen.has(sleutel)) groepen.set(sleutel, [])
    groepen.get(sleutel).push(party)
  }
  return [...groepen.values()]
    .filter((groep) => groep.length > 1)
    .map((groep) => ({
      sleutel: vergelijkbareNaam(naamVan(groep[0])),
      aantal: groep.length,
      namen: groep.map((p) => naamVan(p)),
      ids: groep.map((p) => p.id),
    }))
}

export function vindScheefstand(parsed) {
  const naamloos = vindNaamloos(parsed)
  const dubbelePartijen = vindDubbelePartijen(parsed)
  return { naamloos, dubbelePartijen, totaal: naamloos.length + dubbelePartijen.length }
}
