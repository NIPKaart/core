# Brononderzoek: kandidaat Eindhoven

Status: onderzochte kandidaat voor [#1214](https://github.com/NIPKaart/core/issues/1214), 2026-09-08. Eindhoven is nog geen geaccepteerde aansluiting of bewezen bruikbare pilotbron. Onderstaande bevindingen blijven behouden; de selectie staat open. Er is geen definitief contract 1.0 en geen producer, database-import of productieaansluiting gebouwd.

## Bron en bewijs

De bron is [Gemeente Eindhoven — Parkeerplaatsen](https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/information/), met filter `type_en_merk = 'Parkeerplaats Gehandicapten'`. De [datasetmetadata](https://data.eindhoven.nl/api/explore/v2.1/catalog/datasets/parkeerplaatsen) noemt Gemeente Eindhoven als uitgever, “Publiek domein” als licentie en geen aanvullende licentie-URL. De geselecteerde bronrij bevat uitsluitend parkeerlocatiegegevens; `tests/Fixtures/import/v1/pilot-source.json` behoudt de relevante velden en verwijdert portalwrapper, portal-ID en timestamp. Herkomst blijft hier vastgelegd. De overige randgevallen zijn door ons gemaakte fictieve gegevens; ze zijn geen meldingen over echte parkeerplaatsen.

De bestaande universele package [eindhoven 5.1.0](https://github.com/klaasnicolaas/python-eindhoven/releases/tag/v5.1.0) is op CPython 3.14.2 uitgevoerd. De packagecode is MIT; dat is een afzonderlijk gegeven van de datasetlicentie. Deze bronproef is uitgevoerd in een tijdelijke, geïsoleerde omgeving; core heeft geen dependency op de Eindhoven-package. De importrepository gebruikt nog een oudere major; #774 moet de nieuwe geneste datamodellen expliciet verwerken.

Read-only meting op 2026-09-08, met `ODPEindhoven.locations(limit=1000, parking_type=ParkingType.DISABLED_PARKING)`:

| Meting | Uitkomst |
| --- | --- |
| HTTP-verzoeken | 1 |
| `nhits` / ontvangen / unieke portal-ID's / unieke `objectid` | 180 / 180 / 180 / 180 |
| Responsebytes / grootste losse bronrij | 88.805 / 506 bytes |
| Totale fetch inclusief packageparsing | 0,317 seconden |
| Response SHA-256 | `9100542741d1d37f69eb82101f89729b545afb5bdb4c01a44c6692e5dd7d99ef` |
| Recordtimestamps | Allemaal `2026-08-10T21:45:03.036Z` |
| Portal `modified` | `2026-08-10T21:45:24Z` |
| Geografische uitersten, west/zuid/oost/noord | `5.450612694939047, 51.426665509086355, 5.4905604066468765, 51.47076467693479` |

Dit is één actuele netwerkproef, geen beschikbaarheids-SLA en geen bewijs van volledige gemeentelijke dekking. De metadata noemt ook `temporal: t/m juli 2018`. Portalverwerking in 2026 bewijst daarom geen recente veldcontrole.

## Voorlopige mapping en open bronvragen

| Onderwerp | Afspraak en beperking |
| --- | --- |
| Source/scope | `nl-eindhoven-accessible`, scope 1 = genoemde dataset en exact filter. Geen dynamisch afwijkend geografisch filter onder dezelfde scopeversie. |
| Identiteit | Gebruik bronveld `objectid` als string, gekoppeld aan deze source; nooit coördinaten. In deze response zijn alle 180 waarden aanwezig en uniek. Langdurige stabiliteit/hernummering moet de aansluiting nog vaststellen. De package geeft alleen portal-`recordid` door en laat `objectid` weg: **blokker voor de adapter**, op te lossen door een generieke package-uitbreiding. Geen stilzwijgende fallback naar portalhash. |
| Volledigheid | De package doet één request, exposeert `nhits` niet en heeft geen offset/paginering. In deze meting past alles in één response en is ontvangen = `nhits`; `limit=1000` alleen is geen bewijs. Voor gereedmelding moet de package generiek het totaal en volledige iteratie beschikbaar maken, of aantoonbaar één complete response met totaal teruggeven. Bij meer resultaten, afgekapt antwoord, gewijzigde datasetversie tijdens ophalen of onbekende volledigheid: geen ready-manifest. |
| Bronplatform | De package gebruikt [Search API v1](https://help.opendatasoft.com/apis/ods-search-v1/), die de aanbieder deprecated noemt. Kies de ondersteunde API bij de generieke pagination/identity-uitbreiding; kopieer de oude client niet naar core. |
| Positie | Bron-GeoJSON is Point in WGS84; `[longitude, latitude]` wordt expliciet `position.longitude/latitude`. Geen centroid nodig. Het is een parkeerlocatie, geen bewezen navigatie-ingang. |
| Geografie | `country_code=NL`, `administrative_codes=[{"scheme":"nl:cbs:municipality","code":"0772"}]`. Core koppelt dit aan zijn bestaande relaties; geen interne database-ID's in de adapter. De testbounds `[5.3,51.3,5.6,51.6]` zijn een grove foutcontrole, geen gemeentegrens. |
| Capaciteit | `aantal` is een brongetal (double in metadata); alleen integrale, niet-negatieve waarden overnemen. `null` blijft onbekend en is geen nul. Package 5.1.0 typeert dit als int; de adapter mag een ontbrekend of fractioneel brongetal niet onopgemerkt laten coerceren. |
| Toegangsbetekenis | Het bronlabel zegt gehandicaptenparkeerplaats, maar bevat geen aantoonbaar onderscheid tussen algemene en persoonsgebonden reservering of tijdsbeperkingen. Pilotfixture gebruikt daarom `access_category=unknown` en `unmapped_fields=["reservation_status"]`, wat review oplevert. Publicatie vereist bronverduidelijking of een concrete beoordeelde waarneming. |
| Datums | `record_timestamp` en portal `modified` zijn verwerkingsmetadata; niet presenteren als veldwaarneming. In de genormaliseerde pilot is `source_updated_at=null`. `fetched_*` beschrijft alleen onze fetch. |
| Hergebruik | De datasetmetadata is de basis voor het opgenomen minimale fixture. Hercontroleer voorwaarden en bronbetekenis vóór aansluiting; licentietekst of gebruiksvoorwaarden veranderen niet ongemerkt mee met een manifest. |

Deze bronvragen moeten bij #1214 worden opgelost of tot een andere bronkeuze leiden. Daarna bouwt [disabled-parking#774](https://github.com/NIPKaart/disabled-parking/issues/774) de export en #1215 de coreverwerking. Brononderzoek blijft buiten core; bovenstaande punten zijn concrete toelatingsvoorwaarden voor deze ene aansluiting.

## Status van de eerdere contractproef

De schemas, gesaniteerde voorbeelden en PHP-validator in [PR #1222](https://github.com/NIPKaart/core/pull/1222) zijn experimenteel. De paden `resources/schemas/import/v1` en de daarin opgenomen waarde `1.0` zijn namen uit dat prototype, geen vrijgegeven contractversie. De [voorlopige gegevenslevering](data-import-contract.md) is het actuele uitgangspunt.

De eerdere offline proef dekte onder meer voorloopnullen, onbekend versus nul, ongeldige coördinaten, incomplete/lege bestanden en conflicterende leveringen. Er is nog geen producer of beoordeelde core-import gebouwd. De Python-proef staat lokaal en ongecommit in disabled-parking; een bijbehorende PR en vastgepinde CI-workflow bestaan nog niet. Core bevat geen Python-code of Poetry-omgeving.

De metingen uit de eerdere proef blijven onderzoeksgegevens: 180 bronrecords werden 79.566 bytes, met maximaal 457 bytes per regel. Een synthetische 10.000-recordproef gebruikte 4.409.201 bytes; validatietijden waren PHP 0,024 / 0,600 seconden en Python 0,051 / 1,900 seconden voor respectievelijk 180 / 10.000 records. Dit rechtvaardigt geen definitief formaat, verplichte productielimieten of claim over databasepublicatie.

## Eerstvolgende bronbeslissing

Eindhoven kan pas de bruikbare pilotbron worden nadat bronidentiteit, aantoonbare volledigheid en toegangsbetekenis voldoende zijn vastgesteld. Een generieke package-uitbreiding kan daarvoor nodig zijn. Als die gaten niet praktisch kunnen worden opgelost, kiezen we een andere bron voor de eerste keten. We schuiven deze selectie niet als voldongen feit door naar de adapterimplementatie.

De bestaande echte bronrij in `tests/Fixtures/import/v1/pilot-source.json` is bruikbaar onderzoeksmateriaal. De afgeleide fixture met onbekende toegang en benodigde beoordeling is geen bewijs dat de bron als algemeen toegankelijke parkeerdata kan worden gepubliceerd. Voor afronding van #1214 is één bruikbare bron met een onderbouwde voorlopige voorbeeldlevering nodig; dat staat nog open.
