# Voorlopige gegevenslevering

Status: werkafspraak voor de eerste handmatige keten, 2026-09-08. Er is nog geen vrijgegeven contract 1.0. De schemas en validator in [PR #1222](https://github.com/NIPKaart/core/pull/1222) zijn een onvoltooid prototype; hun opslagvelden en uitvoeringsmechanismen zijn geen vastgestelde eisen. Dit document vervangt de eerdere verplichting om eerst een volledig automatisch afleverprotocol te bouwen.

Het doel is één bruikbare bron via één lokaal bestand beoordeeld in core verwerken. Zie [#1214](https://github.com/NIPKaart/core/issues/1214), de [bronbevindingen](data-import-pilot.md) en de [uitvoeringsvolgorde](data-foundation-delivery.md).

## Verantwoordelijkheden

| Onderdeel | Verantwoordelijkheid |
| --- | --- |
| Universele bronpackage | Begrijpt de gemeentelijke API, haalt de afgesproken selectie volledig op en exposeert bron-ID's, oorspronkelijke waarden en informatie over volledigheid. Kent NIPKaart niet. |
| disabled-parking | Kiest dataset/filter, vertaalt de betekenis naar NIPKaart en maakt de lokale levering. Hier staan Python-code, bronpackages en Python-tests. Schrijft niet rechtstreeks in de core-database. |
| core | Beschrijft welke gegevens het kan verwerken, valideert die in PHP, toont verschillen en beheert beoordeling, publicatie en communitycorrecties. Bevat geen Python-omgeving of gemeentelijke API-clients. |
| offstreet-parking | Vervult dezelfde producerrol voor voorzieningen zodra dat werkpakket begint. We ontwerpen nu geen gedeeld producerframework. |

Een bronpackage mag generieke verbeteringen nodig hebben voor paginering of bron-ID's. Dat is geen reden om het ophalen naar core te verplaatsen. Onderzoek naar mogelijke bronnen blijft buiten het platform.

## Eén voorbeeld

Een fictieve gemeente biedt parkeerplek `000123` aan, aan de Voorbeeldstraat, op een bekende WGS84-locatie. Het bronveld betekent expliciet twee algemene gehandicaptenparkeerplaatsen. Dit voorbeeld beschrijft een gewenste gegevensstroom, niet een bevestigde interpretatie van de Eindhoven-dataset.

De package geeft de oorspronkelijke gegevens terug. De adapter in disabled-parking vertaalt deze naar onderstaande betekenis. Core herkent de plek aan de combinatie van dataset en bron-ID.

| Gegeven | Voorbeeld | Betekenis |
| --- | --- | --- |
| Dataset | `voorbeeldgemeente-toegankelijk` | Aangesloten dataset met bekende herkomst en geografische mapping |
| Unieke levering | `levering-001` | Herkennen dat hetzelfde bestand opnieuw wordt aangeboden; geen voorgeschreven UUID- of opslagmechanisme |
| Opgehaald op | `2026-09-08T08:00:00Z` | Tijdstip van onze fetch, geen bewijs van veldcontrole |
| Selectie | Alle algemene gehandicaptenparkeerplaatsen in deze dataset | Expliciete afbakening om volledigheid en ontbrekende records te kunnen beoordelen |
| Volledigheid | Volledig, met onderbouwing uit de bronresponse | Alleen verklaren wanneer alle resultaten van de selectie zijn opgehaald |
| Formaatrevisie | Voorlopig voorbeeld A | Nog geen stabiele release of compatibiliteitsbelofte |
| Bron-ID | `000123` | String; behoud voorloopnullen, gebruik geen coördinaten als identiteit |
| Positie | Latitude `52.3702`, longitude `4.8952` | Benoemde WGS84-coördinaten, geen impliciete volgorde |
| Toegankelijk aantal | `2` | Niet-negatief geheel aantal; onbekend blijft `null` |
| Toegang | Algemeen toegankelijk met gehandicaptenparkeerkaart | Onderscheiden van persoonsgebonden en onbekende toegang |
| Beperkingen | Onbekend tenzij de bron ze expliciet beschrijft | Geen ontbrekend veld vertalen naar “geen beperkingen” |
| Brondatum | Onbekend | Alleen invullen wanneer de betekenis van de brondatum bekend is |

De gekozen echte bron moet een toegestane bronrij en een veld-voor-veldvertaling opleveren. Dit fictieve voorbeeld is daarvoor geen vervanging. Het is nog niet besloten of leveringsinformatie en records in één bestand of twee bestanden komen; een bestaande JSONL/manifestproef mag een mogelijkheid aantonen, maar legt de keuze niet vast.

## Gedrag bij vervolggevallen

| Gebeurtenis | Verwacht gedrag |
| --- | --- |
| De bron wijzigt het aantal van dezelfde plek | Nieuwe bronwaarde bij dezelfde dataset + bron-ID; core toont het verschil voor beoordeling. |
| Hetzelfde bestand wordt opnieuw aangeboden | Geen dubbele parkeerplek of dubbele publicatie. De consumer herkent de levering. |
| Een plek ontbreekt bij de volgende volledige selectie | Toon als mogelijk verdwenen; niet automatisch verwijderen. |
| Fetch of paginering mislukt | Geen complete levering presenteren. De bestaande publicatie blijft staan. |
| Capaciteit ontbreekt | Bewaar onbekend; maak er geen nul van. |
| Toegangsbetekenis is onduidelijk | Niet automatisch als algemene gehandicaptenparkeerplek publiceren. |
| Een gebruiker meldt een correctie | Core beoordeelt deze. Een geaccepteerde correctie blijft afzonderlijk van de bronwaarde bestaan. |
| Een volgende bronwaarde wijkt af van een geaccepteerde correctie | Toon het conflict; overschrijf de correctie niet stilzwijgend. |
| De selectie verandert | Vergelijk afwezigheid niet ongemerkt met de oude selectie; beoordeel eerst de gewijzigde afbakening. |

Bestaande bronmodellen en detail-/favorietverwijzingen blijven behouden. Het bestandsformaat bepaalt geen publicatiebeleid.

## Eerst bewijzen, daarna automatiseren

1. **#1214:** bruikbare bron selecteren, betekenis controleren, één voorlopige voorbeeldlevering vastleggen en de verantwoordelijkheden afbakenen.
2. **disabled-parking #774:** vanuit de echte package een lokaal bestand maken met expliciete mapping en volledigheidscontrole.
3. **core #1215:** dat bestand lezen, fouten en verschillen tonen en na beoordeling verwerken. Herimport behoudt identiteit en verwijdert ontbrekende records niet automatisch. Correctiebehoud krijgt een expliciete aansluiting op #1218.
4. **Vervolgwerk:** automatisch ophalen, overdragen en ontdekken van bestanden nadat de lokale keten werkt.

Integriteit, begrensde invoer en veilige herverwerking blijven nodig. De bestaande prototypekeuzes voor hashes, JSONL, exacte tijdsyntax en byte-/recordlimieten moeten bij de echte levering opnieuw worden beoordeeld. Opslagkeys, objectversies, ready-manifest-last, duurzame producersequences en herstel over meerdere hosts worden pas verplicht als het ontwerp voor automatische overdracht dat rechtvaardigt.

Het contract wordt pas vastgezet nadat de eerste keten is beproefd. Testresultaten van een losstaande validator bewijzen die keten niet.
