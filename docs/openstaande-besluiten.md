# Openstaande besluiten

Twee punten uit de verbeterlijst zijn bewust niet uitgevoerd. Ze zijn hier vastgelegd zodat
ze niet verdwijnen. Allebei hangen ze aan hetzelfde, nog niet genomen besluit over de
datastructuur — hetzelfde besluit dat ook de drie geparkeerde punten uit die lijst blokkeert.

## 1. Vier categorienamen met een dubbele betekenis

`src/data/constants.js` — `CATEGORIES_INTERN` en `CATEGORIES_EXTERN` bevatten allebei de namen
Besluitvormingsafhankelijkheid, Technische afhankelijkheid, Data-afhankelijkheid en
Omgevingsafhankelijkheid, met een andere betekenis. Wissel je bij een dependency van scope, dan
raak je je categoriekeuze kwijt: de gekozen waarde komt niet voor in de andere lijst.

Niet opgelost, met opzet. Netjes maken is geen hernoeming maar een omzetting van bestaande
data: elke dependency die nu een van deze vier categorieën draagt moet meeverhuizen, en welke
kant dat op gaat hangt af van hoe de categorieën er na het datastructuurbesluit uitzien.
Half omzetten is slechter dan niet omzetten.

## 2. Een externe partij hernoemen werkt niet overal door

Het register van externe partijen (punt sinds beurt 7) is de enige plek waar een partijnaam
hoort te staan, maar oudere records hebben de naam ooit meegekopieerd. Een beheerder die het
register opruimt maakt de kaart daarmee onbedoeld onbetrouwbaarder: het register zegt A, de
records zeggen nog B.

Afgesproken tussenstap: bij het hernoemen een melding tonen in de trant van "deze naam staat
nog in 7 records", zodat de beheerder weet wat hij achterlaat. De echte omzetting — de
meegekopieerde namen vervangen door een verwijzing naar het register — hoort bij dezelfde
aanpak als het centrale applicatieregister (punt 30) en bij het datastructuurbesluit.

Die melding is nog niet gebouwd; dit punt stond op "alleen opschrijven".
