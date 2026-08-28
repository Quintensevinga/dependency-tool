# Dependency Insight — projectinstructies

Client-side React app (Vite) voor het in kaart brengen van team- en ketenafhankelijkheden.
Geen backend — alle data leeft in `localStorage`. Zie `docs/gebruikshandleiding.html` voor een
functionele rondleiding.

## Twee ontwikkelaars, om de beurt op dezelfde branch

Lars en zijn collega werken om de beurt aan `main` (GitHub: `Quintensevinga/dependency-tool`,
auto-deploy naar `https://dependency-tool.vercel.app/`) om merge-conflicten te voorkomen — niet
gelijktijdig aan dezelfde versie. Er is geen permanente Playwright-regressietestset meer (die is
bewust verwijderd: bij elke beurtwisseling veranderde de UI genoeg om de set constant te laten
falen zonder dat er iets kapot was — meer ruis dan waarde in deze werkwijze). Verifieer wijzigingen
met echte browserinteracties tijdens het bouwen (ad-hoc, wegwerpbaar), niet met `npm run build`
alleen.

## Changelog en releases

`CHANGELOG.md` wordt automatisch bijgewerkt door `.github/workflows/changelog.yml` — elke push
naar `main` voegt de commits van die push toe (nieuwste bovenaan). Niet handmatig bewerken: de
volgende push overschrijft de layout-aannames van een handmatige toevoeging niet per se fout, maar
het is gewoon overbodig werk. Voor een groter mijlpaal (bijv. na een hele "beurt" met meerdere
features) kan iemand optioneel een GitHub Release aanmaken — dat is geen automatisch proces, gewoon
op het moment dat het zinvol voelt:

1. Ga naar de GitHub-pagina van de repo → "Releases" (rechts in de zijbalk) → "Draft a new release".
2. Maak een nieuwe tag aan (bijv. `v1.1`, gewoon oplopend) op de huidige `main`.
3. Klik "Generate release notes" — GitHub vult de beschrijving automatisch met de commits sinds de
   vorige tag.
4. Publiceren. Dit is puur een overzichtelijke "mijlpaal-samenvatting" bovenop wat al in
   `CHANGELOG.md` staat, geen technische stap die iets aan de app verandert.

## Kernprincipes (niet zomaar wijzigen zonder het expliciet te bespreken)

- Alles blijft lokaal — geen server, geen persoonsgegevens, alleen rollen/teamniveau-informatie.
- Risicoscores zijn altijd uitlegbaar (impact × frequentie + statuscorrectie) — nooit een black box.
- Geen stoplichtkleuren (rood/groen/geel) — warme, ordinale kleurenreeks.
- UI-wijzigingen altijd verifiëren met echte browserinteracties, niet alleen `npm run build`.
  Dat heeft al meerdere keren een verborgen bug blootgelegd die de build niet ving.
