# Demomateriaal

Drie dingen die bij elkaar horen, voor een demo van tien minuten aan management.

| Bestand | Wat het is |
|---|---|
| `demo-dataset.json` | De dataset die je in de app importeert. Zes teams, 120 afhankelijkheden, de keten ertussen. |
| `spiekbriefje.html` / `.pdf` | De minuut-voor-minuut opbouw: welke knop, welke zin, welke cijfers. Vier pagina's: de eerste twee houd je vast tijdens de demo, de laatste twee zijn naslag. |
| `presentatie.html` | Zeven schermen voor op de beamer, voor de opening en de afsluiting. Pijltjestoetsen of spatie; `f` voor volledig scherm. |

## De dataset verversen

```
node scripts/demo-dataset.mjs
```

Doe dit op de ochtend van de demo. De data draagt datums — "nieuw in de laatste 30 dagen",
"al 90 dagen niet bijgewerkt", "een besluit duurt gemiddeld zeven dagen" — en die zinnen
kloppen niet meer als het bestand een paar weken oud is. Het script print na afloop de
cijfers waar de demo op leunt, zodat je in één oogopslag ziet of het verhaal nog staat.

Wil je oefenen met een andere datum, bijvoorbeeld de dag van de demo:

```
node scripts/demo-dataset.mjs --datum=2026-11-03
```

Importeren gaat via Instellingen → Data → "Importeer data uit JSON".

## Wat erin zit en wat verzonnen is

De teamnamen zijn echt. De applicatienamen zijn functienamen — ze beschrijven wat iets doet
en kunnen daarom niet feitelijk fout zijn. Aantallen, datums en doorlooptijden zijn
plaatshouders: plausibel en onderling consistent, maar het zijn geen metingen.

Er staan geen persoonsnamen in. De sleutelrol bij TET is vastgelegd als rol
("Databasespecialist, 1, senior, risico bij wegvallen: ja") met een feitelijke toelichting.
De tool kan geen personen opslaan, en voor dit onderwerp is dat precies goed: de zaal maakt
de rekensom zelf.

De patronen komen uit de beschrijving van de werkvloer: legacy die over de jaren complex is
geworden, wetgeving die ad hoc moet worden ingebouwd, autorisaties die het onderzoeken van
een incident blokkeren, een verplichte externe toetsing vóór elke oplevering, broncode die
bij een externe partij ligt, en kennis die bij enkelingen zit.

## Controleren of de set nog klopt

```
node scripts/audit-relations.mjs docs/demo/demo-dataset.json
```

Meldt verwijzingen die nergens meer naartoe wijzen en records zonder naam. Hoort schoon te zijn.
