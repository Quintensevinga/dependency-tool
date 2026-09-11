# Dependency Insight

Standalone webapplicatie voor Scrum Masters / Agile coaches om team- en
ketenafhankelijkheden in kaart te brengen: een heatmap van teams tegen
categorieën, een ketenoverzicht en een analysepagina, met automatisch
berekende risicoscores. Draait volledig client-side — geen backend, geen
server, geen internetverbinding nodig na installatie.

## Vereisten

- [Node.js](https://nodejs.org/) versie 20 of hoger (inclusief npm)

## Installeren en starten

```
npm install
npm run dev
```

Open daarna de URL die in de terminal verschijnt (meestal `http://localhost:5173`).

## Data en privacy

- Alle data wordt lokaal opgeslagen in de browser (localStorage) — er wordt niets naar een server verstuurd.
- De app start met fictieve demo-data (8 teams in één keten, ruim 190 dependencies, een register van externe partijen en een gevulde wijzigingenlog). Via "Instellingen & privacy" onderaan de zijbalk kun je alle data wissen en desgewenst teruggaan naar de demo-data.
- Het datamodel bevat bewust geen namen van personen, alleen rol-aanduidingen.

## Admin-afscherming (geen echte beveiliging)

Het Admin-gedeelte in Instellingen zit achter een wachtwoord (`VITE_ADMIN_PASSWORD`, zie
`.env.example`, standaard `ww`). Dit is **geen beveiligingsmaatregel** — de app is 100%
client-side, dus de waarde zit gewoon in de gepubliceerde bundel voor wie er echt naar zoekt.
Het is puur bedoeld om per ongeluk klikken in het Admin-gedeelte te voorkomen, niet om data
af te schermen tegen iemand die dat probeert.

## Belangrijkste functionaliteit

- **Heatmap**: teams (rijen) tegen categorieën (kolommen), elke cel gekleurd naar het hoogste risico erin; klik op een cel, rij of kolom voor de bijbehorende dependencies. Filters op team, risiconiveau, workflowstap en team-/ketenniveau.
- **Ketenoverzicht**: de keten als samenhangend diagram, met de koppelingen tussen teams en externe partijen.
- **Analyse**: één pagina met alle metrieken, trends, constateringen en hygiënecontroles over álle data (dependencies, historie, keten, applicaties, partijen, log), plus een rapport in lopende tekst en waarschuwingen per geval — elke kaart legt zijn eigen regel uit; filterbaar per team.
- **Taal**: NL/EN-toggle rechtsboven.
- **Export**: huidige weergave als PNG, of alle data als JSON (back-up/herstel).

## Scripts

- `npm run dev` — start de ontwikkelserver
- `npm run build` — bouwt een productieversie in de map `dist/`
- `npm run preview` — bekijkt de gebouwde productieversie lokaal
- `npm run lint` — controleert de code met Oxlint
