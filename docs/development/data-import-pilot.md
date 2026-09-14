# Pilot: algemene gehandicaptenparkeerplaatsen Amsterdam

Status 2026-09-14: `odp-amsterdam` 7.0.0 is uitgebracht en [disabled-parking #783](https://github.com/NIPKaart/disabled-parking/pull/783) is gemerged. De live collector levert het afgesproken bestand. De eerste core-intake vond tien zelfdoorsnijdende polygonen. De gekozen vervolgafspraak is een afzonderlijke beoordeelde geometrie-afleiding in core, met behoud van de oorspronkelijke bron. Publieke ingebruikname is niet uitgevoerd.

## Waarom deze bron

De selectie `eType=E6a` benoemt algemene gehandicaptenparkeerplaatsen expliciet. Dat voorkomt de onbewezen algemene/persoonsgebonden interpretatie bij Eindhoven. Amsterdam levert oorspronkelijke string-ID's, parkeervlakken, aantallen, regimes en versie-informatie. De read-only proef ontving 1.420 unieke records; een afzonderlijke count-query meldde hetzelfde totaal. De [officiële datasetdocumentatie](https://api.data.amsterdam.nl/v1/docs/datasets/parkeervakken.html) beschrijft de velden. `aantal` is een geschatte capaciteit en `versiedatum` de geldigheidsdatum van de dataset; presenteer die niet als telling of veldcontrole.

De leverancier is Gemeente Amsterdam. De dataset wordt in de [overheidscatalogus](https://data.overheid.nl/dataset/318a98b8-ef87-4335-9674-f5405f2bc4be) als CC0 aangeboden, bevestigd in de [CKAN-metadata](https://data.overheid.nl/data/api/3/action/package_show?id=318a98b8-ef87-4335-9674-f5405f2bc4be). De catalogus linkt oudere ontsluitingen van dezelfde dataset; het licentieveld in de huidige REST-documentatie is leeg. Dit is het traceerbare hergebruikbewijs voor de technische pilot, geen afzonderlijke nieuwe licentieverklaring van de REST-API. Hercontroleer deze koppeling en eventuele voorwaarden vóór publieke ingebruikname. De licentie van de Python-package is daarvan onafhankelijk. Bewaar bronvermelding bij de aansluiting, ook wanneer geen attributie verplicht is.

| Onderdeel | Afbakening |
| --- | --- |
| Datasetcode | `nl-amsterdam-parkeervakken-e6a` |
| Selectiecode | `e6a-all` = alle records uit `parkeervakken/parkeervakken` met exact `eType=E6a`; geen bbox of aanvullende stille filtering. |
| Package | `odp-amsterdam==7.0.0` wordt door de collector gebruikt; de eerste onderzoeksproef gebruikte 6.0.0. |
| Identiteit | `properties.id`, als volledige string binnen de dataset. De GeoJSON-wrapper `parkeervakken.<id>` wordt niet als tweede identiteit gebruikt. |
| Geografie | Nederland (`NL`), Noord-Holland (`NL-NH`), gemeente Amsterdam (`nl:cbs:municipality`, `0363`). Core koppelt deze codes aan relaties. |
| Betekenis | Algemene gehandicaptenparkeerplaats, mogelijk met tijdsbeperkingen. Geen actuele beschikbaarheid, geen garantie op toegankelijkheid voor ieder voertuig. |
| Granulariteit | Eén bronrecord beschrijft een parkeervlak met aantal; niet omzetten naar verzonnen individuele communityplekken. |

## Gemeten bewijs en beperkingen

| Meting | Uitkomst |
| --- | --- |
| Volledige GeoJSON-response | 1.420 features / 1.420 unieke `properties.id` |
| Onafhankelijke count-query | `X-Total-Count=1420`, `page.totalElements=1420` |
| Omvang | 1.332.469 bytes |
| SHA-256 volledige onderzoeksresponse | `b330ae455f3efbeb8373b419da6fad4f24da351cd0cf90547cb928811e0e6efa` |
| Geometrie | Alle records Polygon in WGS84 |
| Packageparser | Alle 1.420 bronrecords zijn met de geïnstalleerde parser gelezen |
| Regimes | 1.579 regimes; 159 records hebben meerdere regimes, 172 hebben tijdsvakken en 13 een opmerking |
| Toegang | Alle aangetroffen regimes beschrijven algemene gehandicaptenparkeerplaatsen; kentekenvelden zijn leeg |
| Versiedatum | Alle records `2026-09-11`; datasetgeldigheid, geen afzonderlijke recordwijziging of veldcontrole |
| Tijdstip | HTTP Date volledige response `2026-09-13T21:55:18Z`; count-response `2026-09-13T21:55:56Z` |

Requests: [volledige selectie](https://api.data.amsterdam.nl/v1/parkeervakken/parkeervakken?_pageSize=2000&eType=E6a&_format=geojson) met header `Accept-Crs: EPSG:4326`, en [count-query](https://api.data.amsterdam.nl/v1/parkeervakken/parkeervakken?_pageSize=1&eType=E6a&_count=true). De GeoJSON-response heeft geen volgende pagina (`_links: []`).

Dit bewijst volledige ontvangst ten opzichte van het toen gerapporteerde totaal, geen volledige werkelijkheid op straat of gegarandeerde transactiesnapshot. Het bronbestand blijft tijdelijk onderzoeksmateriaal; we voegen geen gemeentelijke fixturecorpus toe aan core.

De destijds onderzochte package 6.0.0 deed één request met een limiet, geeft geen totalen/paginering door en gebruikt slechts delen van het eerste regime. Daardoor verdwijnen tijdsbeperkingen en de versiedatum; `int(aantal)` kan bovendien ongeldige fractionele waarden afronden. Succesvol parsen betekent dus niet dat de levering inhoudelijk volledig is.

ID's zijn nu uniek en als bron-ID beschikbaar, maar toekomstige hernummering is niet uitgesloten. Grote identiteitswisselingen en verdwenen records vragen beoordeling. Niet terugvallen op coördinatenmatching. De API-documentatie kondigt verplichte API-keys aan; de proef werkte zonder key. Ondersteuning voor eventuele bronauthenticatie hoort in de universele package/collector, nooit in het afleverbestand. De bron biedt geen bewezen mutatieversie over meerdere pagina's: controleer aantallen vóór/na en geef bij verschillen geen complete levering af; gelijke aantallen bewijzen geen snapshotisolatie.

## Concrete bronrij en vertaling

Onderstaand voorbeeld is de echte bronrij `114323484886`, met alleen relevante velden. Het lege `kenteken` is weggelaten. Beide regimes blijven behouden; hun onderlinge betekenis wordt niet door de adapter gegokt.

```json
{
  "id": "114323484886",
  "straatnaam": "Pieter Calandlaan",
  "eType": "E6a",
  "type": "Haaks",
  "aantal": 1.0,
  "versiedatum": "2026-09-11",
  "geometry": {"type": "Polygon", "coordinates": [[[4.790157860968076, 52.35038717769686], [4.790188598734742, 52.3503934444639], [4.79020922008023, 52.3503552603837], [4.790178482337059, 52.35034899362201], [4.790157860968076, 52.35038717769686]]]},
  "regimes": [
    {"soort": "MULDER", "eType": "E6a", "eTypeDescription": "Gehandicaptenparkeerplaats algemeen", "aantal": 1.0, "bord": "", "beginTijd": null, "eindTijd": null, "beginDatum": null, "eindDatum": null, "dagen": [], "opmerking": null, "typeUitzondering": "Venstertijden"},
    {"soort": "MULDER", "eType": "E6a", "eTypeDescription": "Gehandicaptenparkeerplaats algemeen", "aantal": 1.0, "bord": "", "beginTijd": "09:00:00", "eindTijd": "16:00:00", "beginDatum": null, "eindDatum": null, "dagen": ["ma", "di", "wo", "do"], "opmerking": null, "typeUitzondering": "Venstertijden"}
  ]
}
```

De NIPKaart-representatie gebruikt onderstaande mapping. `geometry` en de twee `regimes` worden uit het voorbeeld ongewijzigd overgenomen; ze worden hier niet nogmaals gekopieerd.

| Bron | Levering | Uitleg |
| --- | --- | --- |
| `properties.id` | `external_id="114323484886"` | Bronidentiteit; geen numerieke conversie of verkorting. |
| `geometry` | `geometry` | Volledig Polygon behouden. Core berekent pas bij intake een kaartpunt met PostGIS `ST_PointOnSurface`; geen Python-geometrieafhankelijkheid. |
| `aantal=1.0` | `number=1` | Geschatte capaciteit volgens de bron. Alleen na controle dat het getal eindig, geheel en niet-negatief is. `null` blijft onbekend, nul blijft nul. |
| `straatnaam` | `street="Pieter Calandlaan"` | Bronstraat, geen geocoding of afgeleid huisnummer. |
| `eType` en alle regimebeschrijvingen | `access_category="general"` | Alleen bij consistente algemene betekenis; onbekend of persoonsgebonden wordt niet algemeen verklaard. |
| Alle `regimes` | `source_attributes.regimes` | Tijd, dagen, datums, bord, uitzondering en opmerking blijven zichtbaar voor review. Geen berekende “nu beschikbaar”-status. |
| `type` | `source_attributes.orientation="Haaks"` | Oorspronkelijke plaatsingsaanduiding. |
| `versiedatum` | `source_attributes.version_date="2026-09-11"` | Datasetgeldigheid behouden; `source_updated_at=null` omdat dit geen afzonderlijke recordwijziging is. |
| `kenteken=null` | Niet afleveren | Verwacht leeg voor deze selectie. Een ingevuld kenteken of onverwachte persoonsgebonden betekenis blokkeert de levering; niet wegfilteren en alsnog compleet verklaren. |
| Wrapper-ID, buurtcode en dubbele broncategorie `soort` | Geen afzonderlijk generiek veld | Identiteit, geografie en categorie zijn al expliciet vastgelegd; regimegebonden `soort` blijft behouden. |

Regimes zijn broninformatie die core moet tonen voordat deze records worden gepubliceerd. Het samengaan van een basisregime en tijdvenster wordt niet vertaald naar een belofte van onbeperkte toegang. Onbegrepen beperkingen blijven in review; een beheerder moet de betekenis kunnen onderbouwen of publicatie achterwege laten.

De volledige levering volgt [het ene JSON-bestand](data-import-contract.md): `format=nipkaart-municipal-pilot-1`, bovengenoemde dataset/selectie, een werkelijke delivery-UUID en ophaaltijd, `complete=true`, een gecontroleerd `source_count` en alle records. Het voorbeeld hierboven is één record en mag nooit als volledige Amsterdamse levering worden aangeleverd. De toekomstige export mag 1.420 niet hardcoderen.

## Opgelost in de universele package

Afgerond met packageversie 7.0.0, oorspronkelijk package-issue: [python-odp-amsterdam #1291](https://github.com/klaasnicolaas/python-odp-amsterdam/issues/1291). Deze afhankelijkheid van disabled-parking #774 is inmiddels geleverd. De oorspronkelijke opdracht was:

1. Stel de bron-ID, volledige geometrie, alle regimes en versiedatum beschikbaar. Bewaar oorspronkelijke aantallen zonder verliesgevende conversie; test onbekend, nul, fractioneel en meerdere regimes.
2. Bied een publieke volledige ophaling met totalen/pagina-informatie aan. Controleer de laatste pagina en unieke ID's; één `limit=2000` is geen blijvend volledigheidsbewijs. Behoud de bestaande beperkte ophaalmethode voor andere packagegebruikers indien die onderdeel is van de publieke API.
3. Test generieke paginering en gewijzigde/ontbrekende bronvelden upstream. Maak geen NIPKaart-bestandsformaat of publicatiebeleid onderdeel van de package.
4. Leg de geteste packageversie en één afzonderlijke begrensde live proef vast. Pas daarna de adapter op de nieuwe publieke package-interface aansluiten.

[disabled-parking #783](https://github.com/NIPKaart/disabled-parking/pull/783) levert inmiddels het live commando en heeft de tijdelijke Hamburg-route vervangen. #1215 implementeert de ontvangende kant met geometrievalidatie, beoordeling en behoud van identiteit/correcties. De eerste werkende keten blijft handmatig; de private bucket volgt bij automatisering.

## Andere onderzochte kandidaten

- **Eindhoven:** de [metadata](https://data.eindhoven.nl/api/explore/v2.1/catalog/datasets/parkeerplaatsen) is opnieuw gecontroleerd; de eerdere proef van 2026-09-08 vond 180 records, maar de metadata noemt dekking tot juli 2018; de package verliest `objectid` en volledigheidsinformatie en de toegang is niet aantoonbaar algemeen. Niet geselecteerd. De vroegere uitgebreide proef blijft in de gitgeschiedenis; de #1222-fixtures zijn geen geaccepteerde aansluiting.
- **Hamburg:** de [actuele collectie](https://api.hamburg.de/datasets/v1/behindertenstellplaetze/collections?f=json) en [WFS](https://geodienste.hamburg.de/wfs_behindertenstellplaetze?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&typename=de.hh.up%3Abehindertenstellplaetze) zijn onderzocht. Het endpoint van package 3.0.0 geeft 404; de nieuwe collectie bestaat maar de itemsrequests liepen bij deze proef vast. WFS leverde 936 unieke features en een afzonderlijke hits-query meldde 936, maar de normale response meldt `numberMatched=unknown` en `numberReturned=0`. Een alternatief protocol en CRS-verwerking zijn extra werk. De oude Hamburg-fixture bewijst geen huidige packagewerking.

## Broncontrole na implementatie

Offline tests bewijzen gedrag tegen bekende voorbeelden. Een periodieke begrensde live controle in #775 controleert daarnaast endpoint, velden, identiteit en volledigheid. Ook een HTTP 200 met gewijzigde betekenis kan een fout zijn. Bij een bronfout geen nieuwe complete levering publiceren; de laatste geaccepteerde gegevens blijven staan en de collector meldt de storing. De broncheck staat los van gewone package-CI.

## Werkelijke collector → core-proef op 2026-09-14

De live export bevat 1.420 unieke bronrecords en 1.579 regimes, is 1.384.804 bytes groot en heeft SHA-256 `99a6744f950a5c4307d9851524a84790f4a9ff3bb704819d02bd976df1abcd31`. Leverings-ID: `7982ffb8-87d7-401e-8989-424a81284738`; ophaalstart: `2026-09-13T23:41:47.974385Z`. Dit is een andere representatie dan de oorspronkelijke onderzoeksresponse hierboven.

PostGIS controleerde alle geometrieën op de afzonderlijke core-testdatabase. Alle liggen binnen de ingestelde bbox, maar `ST_IsValidReason` meldt een zelfdoorsnijding voor bron-ID's `114185488210`, `114187488001`, `118990486331`, `119459482101`, `119478482386`, `121780485119`, `123005483477`, `123773490356`, `123778490343` en `124156485525`.

In die eerste proef is daarom niets uit deze levering gepubliceerd of gedeeltelijk geïmporteerd. De foutmelding identificeert alle betrokken bron-ID's. De collector garandeert structurele volledigheid; dat is geen garantie op geometrische geldigheid. Kleine synthetische voorbeelden testen het veilige publicatiepad, maar vervangen deze ontbrekende acceptatie niet.

Vervolgkeuze van de eigenaar op 2026-09-14: beoordeelde geometrie-afleiding in core, met behoud van de oorspronkelijke brongeometrie. `ST_MakeValid` met expliciete methode `linework` levert voor alle tien een geldige MultiPolygon met twee delen op (totale oppervlakte circa 11,43–15,71 m²). Dit is geometrische bruikbaarheid, geen bewijs van de werkelijkheid op straat. Origineel, afleiding en afgeleid kaartpunt staan alleen samen op de beheerkaart. Op de publieke kaart verschijnt uitsluitend de marker. Geen tien records overslaan en alsnog `complete=true` verklaren; elke afleiding vereist review.

## Afzonderlijke implementatiecontrole

`composer ci:check` slaagde lokaal met 280 backendtests (1.167 assertions), drie frontendtests, linting, types en productiebuild. De gerichte importtests draaien ook op DDEV/PHP 8.4 met PostGIS. De frontendbuild draaide op de host omdat de lokaal geïnstalleerde native buildmodule voor macOS is; dezelfde `node_modules` in de Linux-container gebruiken is niet ondersteund.

Een afzonderlijke operationele proef op `nipkaart_test` liet twee PHP-processen gelijktijdig dezelfde synthetische levering publiceren terwijl de datasetrij eerst vergrendeld was. Eén publicatie slaagde, de andere kreeg “Deze levering is al beoordeeld”; er bleef precies één gemeentelijk record bestaan. De browserproef controleerde desktop en 390px mobiel, de polygoon/kaartpuntweergave en daadwerkelijke goedkeuring van een synthetische wijziging van onbekende capaciteit naar nul. Dit bewijst implementatiegedrag, geen geaccepteerde Amsterdam-import of productiepublicatie.

## Lokale keten na beoordeelde geometrie-afleiding

Het oorspronkelijke collectorbestand met bovenstaande SHA-256 is na deze wijziging volledig ter beoordeling aangeboden: 1.420 nieuwe records, tien afleidingen, intake en vergelijking in circa 0,85 seconde op de lokale testomgeving. Alle oorspronkelijke bronclaims zijn vergeleken met de gepubliceerde `source_record`-waarden en gelijk gebleven. De tien afleidingen behouden de bronbegrenzing; hun kleinste delen beslaan circa 0,00000044–0,00017 m². Alle tien opgeslagen markerpunten liggen binnen hun afgeleide vorm. Er ontstaan geen extra parkeerplaatsen of markers uit deze delen.

De daadwerkelijke browserpublicatie op `nipkaart_test` is eerst zonder geometriebevestiging geprobeerd en geblokkeerd. Na technische beoordeling en expliciete bevestiging is de volledige levering gepubliceerd. Een gecontroleerde herhaling behield alle 1.420 identiteiten en inhoudstijdstippen; een gewijzigde testkopie toonde één gewijzigde en één ontbrekende bronrij, waarbij het ontbrekende record behouden bleef. Een volgende testkopie botste met een handmatig aangepast aantal en werd geblokkeerd. Deze varianten zijn testmutaties van het vastgelegde bestand, geen nieuwe gemeentelijke waarnemingen.

De publieke `/map`-pagina is ook mobiel gecontroleerd: alleen bestaande parkeermarkers, geen bron- of afgeleide polygonen. Voor de visuele controle is de bestaande Google Hybride-laag gebruikt; de lokale Mapbox-laag laadde geen achtergrond. De publieke discoverygegevens bevatten identiteit, titel, coördinaten en afstand; de geometrieclaims blijven bij intake/review. Alleen daar worden de twee vormen getoond om het markerpunt te beoordelen.

De uitgebreide proef hield aanvankelijk meerdere volledige imports tegelijk vast en overschreed de lokale PHP-limiet van 128 MiB. De afzonderlijke conflictproef slaagde met een piek van 108 MiB. Dit is geen capaciteitstest voor de volledige bestandslimiet van 32 MiB: benchmark geheugen en verwerkingsduur vóór grotere datasets of langlevende workers. Een mislukte poging bleef ongepubliceerd; er is geen dataset gedeeltelijk vervangen.

Deze resultaten bewijzen de lokale technische keten met het vastgelegde bronbestand. De review van deze PR, hercontrole van bronvoorwaarden en eventuele publieke activering blijven afzonderlijke stappen. Er zijn geen productiegegevens of bucketinstellingen gewijzigd.
