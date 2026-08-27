# Dependency Insight — projectinstructies

Client-side React app (Vite) voor het in kaart brengen van team- en ketenafhankelijkheden.
Geen backend — alle data leeft in `localStorage`. Zie `docs/gebruikshandleiding.html` voor een
functionele rondleiding.

## Regressietestset — verplicht vóór elke release/demo

Er is een blijvende Playwright-testset in `e2e/` die de belangrijkste flows dekt (matrix/netwerk/
ketenoverzicht, dependency CRUD, teampagina, capaciteit, Miro-toolbar, navigatie, instellingen).

**Regel:** voordat een feature, fix of wijziging als "klaar" wordt gerapporteerd, moet
`npm run test:e2e` zijn gedraaid en volledig groen zijn. Dit geldt voor mij (Claude) in elke
sessie aan dit project, en voor iedereen die hierna meewerkt.

```
npm run test:e2e        # headless, één run
npm run test:e2e:ui     # interactieve UI-modus, handig bij debuggen
```

Nieuwe functionaliteit? Voeg er een test voor toe in `e2e/` — de set moet meegroeien, niet
achterblijven. Losse, wegwerp-Playwright-scriptjes (zoals in eerdere sessies gebruikt) zijn prima
voor ad-hoc verkennen tijdens het bouwen, maar het uiteindelijke regressiebewijs hoort in `e2e/`
terecht te komen, niet weggegooid te worden.

Er is nog geen git-repository voor dit project. Zodra die er wel is (en een remote op GitHub),
activeert `.github/workflows/e2e.yml` automatisch — die staat al klaar en draait de set bij elke
push/PR zonder dat iemand daar nog aan hoeft te denken.

## Kernprincipes (niet zomaar wijzigen zonder het expliciet te bespreken)

- Alles blijft lokaal — geen server, geen persoonsgegevens, alleen rollen/teamniveau-informatie.
- Risicoscores zijn altijd uitlegbaar (impact × frequentie + statuscorrectie) — nooit een black box.
- Geen stoplichtkleuren (rood/groen/geel) — warme, ordinale kleurenreeks.
- UI-wijzigingen altijd verifiëren met echte browserinteracties (Playwright), niet alleen
  `npm run build`. Dat heeft al meerdere keren een verborgen bug blootgelegd die de build niet ving.
