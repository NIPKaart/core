# Voorlopige gegevenslevering

Status: werkafspraak voor [#1214](https://github.com/NIPKaart/core/issues/1214). Eén JSON-bestand voor de eerste handmatige import; het formaat wordt pas vastgezet nadat de producer en core samen zijn beproefd. De schema's en validator uit [PR #1222](https://github.com/NIPKaart/core/pull/1222) blijven een prototype en worden in #1215 vervangen of verwijderd.

## Van bron naar gebruiker

`gemeentelijke API → universele Python-package → disabled-parking → JSON-bestand → core: valideren, vergelijken en beoordelen → gemeentelijke parkeergegevens → publieke discovery`

De eerste overdracht gebeurt lokaal. Daarna uploadt de producent hetzelfde formaat naar een private bucket en ontdekt core de complete bestanden. De bucket hoort bij de automatische architectuur. R2 is een kandidaat; provider en overdrachtsmechanisme worden in #1217 gekozen. Er komt geen directe producerverbinding met de core-API of database.

| Onderdeel | Verantwoordelijkheid |
| --- | --- |
| Universele package | Bronprotocol, volledige ophaling van een selectie, bron-ID's, oorspronkelijke waarden en volledigheidsinformatie. Zelfstandig bruikbaar zonder NIPKaart. |
| disabled-parking | Datasetselectie, vertaling, leveringsmetadata en bestand schrijven. Python en bronspecifieke tests staan hier of upstream. |
| core | Toegelaten dataset, bestandsvalidatie, verschillen, beoordeling, publicatie en behoud van correcties. Geen Python-omgeving. |
| offstreet-parking | Later een eigen producent voor voorzieningen; pas bij werkelijk gedeelde behoeften uitvoeringscode delen. |

## Eén bestand

UTF-8 JSON met één object en een `records`-array. Geen apart manifest, JSONL, schemarelease of opslagprovider-ID voor de lokale pilot. De concrete bronrij en mapping staan in de [pilotbeschrijving](data-import-pilot.md).

| Veld | Betekenis |
| --- | --- |
| `format` | `nipkaart-municipal-pilot-1`; één voorlopige revisie voor producer en consumer. Vervangt `municipal-records-draft`, geen compatibiliteitslaag. |
| `dataset` | Vaste, door core toegelaten datasetcode. Bronhouder, licentie en geografische mapping horen bij deze aansluiting. |
| `delivery_id` | UUID, één keer gemaakt per geslaagde ophaling. Een retry van hetzelfde bestand behoudt ID en bytes. |
| `retrieved_at` | UTC-tijdstip waarop de ophaling begon, RFC 3339 met `Z`; sorteert leveringen. Geen waarnemingsdatum. Eén actieve ophaling per dataset. |
| `selection` | Vaste code voor de afgesproken collectie/filter, bijvoorbeeld `all`. Een scopewijziging vereist eerst een nieuwe beoordeelde aansluiting of selectie. |
| `complete` | Moet `true` zijn voor intake. Producent verklaart dit alleen op basis van bronbewijs. |
| `source_count` | Aantal dat de bron voor deze selectie meldt; gelijk aan aantal ontvangen unieke records. Een totaal alleen bewijst geen volledigheid wanneer nog een volgende pagina bestaat. |
| `records` | Alle records van de selectie, zonder stilzwijgend afgekeurde of overgeslagen bronrijen. |

De producent controleert bronpagina's, aantallen en unieke ID's voordat het bestand wordt geschreven. Opvangen van parsefouten en doorgaan met de overige records is geen complete levering. Als een bron geen totaal aanbiedt, wordt eerst een andere aantoonbare volledigheidscontrole afgesproken; verzin geen `source_count` uit alleen de ontvangen lijst.

Core accepteert alleen het bekende formaat en de toegelaten dataset/selectie; valideert typen en inhoud en weigert dubbele JSON-sleutels en bron-ID's. Geen remote schemaresolutie of door het bestand aangeleverde download-URL uitvoeren. Begin met de bestaande grenzen van 10.000 records en 32 MiB; de Amsterdamse bronproef van ongeveer 1,33 MB valt daar ruim binnen. Valideer vóór databasepublicatie.

## Een record

| Veld | Regel |
| --- | --- |
| `external_id` | Niet-lege oorspronkelijke ID als string. Identiteit is `(dataset, external_id)`; behoud volledige ID en voorloopnullen. Geen coördinatenhash of interne core-ID. |
| `geometry` | Oorspronkelijke GeoJSON `Polygon` in WGS84 voor Amsterdam, met `[longitude, latitude]`. Behoud ringen; begrens omvang en valideer bereik en geometrie. Geen verzonnen bronpunt. |
| `number` | Niet-negatief geheel aantal of `null`. Nul en onbekend blijven verschillend; maak van een bronaggregaat geen verzonnen losse bays. |
| `street` | Bronadres of `null`; een nabijheidsadres is geen exact parkeeradres. |
| `access_category` | `general`, `personal` of `unknown`. `general` betekent niet persoonsgebonden gehandicaptenparkeren, geen beschikbaarheid of parkeren zonder vergunning. |
| `source_attributes` | Voor Amsterdam: `regimes`, `orientation` en `version_date`. Alle regimes met hun tijden/dagen/datums/opmerkingen behouden; geen generiek regelsysteem of uitspraak “nu beschikbaar”. |
| `source_updated_at` | Alleen een datum met bekende betekenis als wijziging van het bronrecord; anders `null`. Portaalverwerking is geen veldcontrole. |

Core bewaart de brongeometrie bij de bronclaim en gebruikt na validatie PostGIS `ST_PointOnSurface` voor het afgeleide kaartpunt (`geometry_method=point_on_surface`). Dit blijft een benadering binnen het parkeervlak, geen ingang of individueel vak. Core schrijft de bestaande latitude/longitude-kolommen; PostgreSQL blijft de bestaande `location` afleiden. Zo zijn geen extra Python-geometriepackage of twee concurrerende afleidingen nodig. Zie [PostGIS](https://postgis.net/docs/ST_PointOnSurface.html) en de [bestaande opslagafspraak](postgresql.md#spatial-representation).

Land en administratieve relaties worden door core uit de toegelaten datasetconfiguratie gekoppeld. Geen Nederlandse verplichte codes voor Europese bronnen en geen interne foreign keys in het bestand. Deze pilot ondersteunt alleen de aangetroffen Polygon-geometrie. Puntbronnen of andere geometrieën krijgen pas ondersteuning wanneer ze worden aangesloten. Nuttige broninformatie wordt daarbij nooit stilzwijgend weggegooid.

## Herhaling en wijzigingen

| Geval | Gedrag |
| --- | --- |
| Eerste complete levering | Valideren, verschillen en kaartsteekproef tonen; publicatie na beoordeling. |
| Zelfde dataset en delivery-ID, dezelfde bytes | Bestaande importstatus teruggeven; geen tweede verwerking of publicatie. Core bewaart de SHA-256 van de ontvangen bytes. |
| Zelfde delivery-ID, andere bytes | Conflict afwijzen; nooit een bestaande levering vervangen. |
| Nieuwe levering, ongewijzigde records | Geen dubbele plekken of inhoudsrevisies; wel nieuwe ontvangst vastleggen. |
| Oudere `retrieved_at` dan de laatst geaccepteerde levering | Geen actuele gegevens overschrijven. Gelijke tijd met verschillende delivery-ID's is een conflict, geen willekeurige winnaar. |
| Een veld wijzigt bij dezelfde bron-ID | Nieuwe bronwaarde tonen voor beoordeling; identiteit, favorieten en detailverwijzingen behouden. |
| Een record ontbreekt in een complete selectie | Markeren als mogelijk verdwenen en beoordelen; geen automatische verwijdering. Terugkeer gebruikt dezelfde identiteit. |
| Lege/incomplete/ongeldige levering of mislukte fetch | Geen publicatie; bestaande gegevens en laatste geldige export blijven behouden. |
| Bronwaarde botst met geaccepteerde correctie | Bronwaarde afzonderlijk bijwerken; correctie behouden en conflict tonen. Ook in de eerste importimplementatie. |
| Onbekende toegang of gewijzigde scope | Geen automatische algemene publicatie of vergelijking van ontbrekende records; eerst beoordelen. |

Core controleert volgorde en actuele correcties opnieuw bij publicatie, ook als twee beoordeelde imports tegelijk klaarstaan. `retrieved_at` is een eenvoudige volgorderegel voor één producent met correcte UTC-klok; het bewijst geen transactiesnapshot bij de bron. Toekomstige of onlogische tijdstippen vragen beoordeling. Geen gedistribueerde teller bouwen voor de pilot.

## Concrete overdracht

1. **#1214:** bronkeuze, toegestane voorbeeldrij, betekenis en deze voorlopige afspraak.
2. **disabled-parking #774:** eventuele generieke bronpackagefix eerst, daarna één live commando dat dit bestand atomair schrijft. Vervang draftformaat, null-volledigheidsmetadata en achterhaalde voorbeeldroute; behoud slechts nuttige kleine tests.
3. **core #1215:** één intakepad met beoordeling en veilige eerste, gewijzigde, herhaalde, oudere, ontbrekende en conflicterende levering. Vervang/verwijder de oude #1222-schema's en validatie in dezelfde implementatie.
4. **#1217, disabled-parking #775 en core #1216:** provider kiezen, dezelfde levering automatisch uploaden en ontdekken. De gekozen opslaggrens moet voorkomen dat core een gedeeltelijk bestand verwerkt.

Gewone CI werkt offline met kleine voorbeelden van packageobjecten. Eén afzonderlijke begrensde live proef bewijst bronophaling; een daadwerkelijke beoordeelde core-import bewijst de volgende stap. Geen van beide wordt door alleen een fixturetest vervangen.
