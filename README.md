# Dependency Insight

Standalone webapplicatie voor Scrum Masters / Agile coaches om team- en
ketenafhankelijkheden in kaart te brengen: een matrix-overzicht en een
interactieve netwerkweergave, met automatisch berekende risicoscores en
regel-gebaseerde observaties. Draait volledig client-side — geen backend,
geen server, geen internetverbinding nodig na installatie.

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
- De app start met fictieve demo-data (7 teams). Via het tandwiel-icoon (Instellingen) kun je alle data wissen en desgewenst teruggaan naar de demo-data.
- Het datamodel bevat bewust geen namen van personen, alleen rol-aanduidingen.

## Admin-afscherming (geen echte beveiliging)

Het Admin-gedeelte in Instellingen zit achter een wachtwoord (`VITE_ADMIN_PASSWORD`, zie
`.env.example`, standaard `ww`). Dit is **geen beveiligingsmaatregel** — de app is 100%
client-side, dus de waarde zit gewoon in de gepubliceerde bundel voor wie er echt naar zoekt.
Het is puur bedoeld om per ongeluk klikken in het Admin-gedeelte te voorkomen, niet om data
af te schermen tegen iemand die dat probeert.

## Belangrijkste functionaliteit

- **Matrix-overzicht**: sorteerbare tabel per team/keten-niveau, met filters op team en risiconiveau.
- **Netwerkweergave**: teams en categorieën als sleepbare blokjes, klikbare categorie-legenda, en de mogelijkheid om een nieuwe dependency aan te maken door een lijn tussen twee blokjes te slepen.
- **Taal**: NL/EN-toggle rechtsboven.
- **Export**: huidige weergave als PNG, of alle data als JSON (back-up/herstel).

## Scripts

- `npm run dev` — start de ontwikkelserver
- `npm run build` — bouwt een productieversie in de map `dist/`
- `npm run preview` — bekijkt de gebouwde productieversie lokaal
- `npm run lint` — controleert de code met Oxlint
