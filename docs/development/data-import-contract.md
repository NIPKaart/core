# Voorlopige gegevenslevering

Status: werkafspraak voor [#1214](https://github.com/NIPKaart/core/issues/1214). Eén JSON-bestand voor de eerste handmatige import; het formaat wordt pas vastgezet nadat de producer en core samen zijn beproefd. De schema's, validator, Opis-dependency en fixturecorpus uit [PR #1222](https://github.com/NIPKaart/core/pull/1222) zijn vervangen door één daadwerkelijke intake in #1215. De volledige Amsterdamse bronproef blokkeert nog op tien ongeldige polygonen; het formaat is daarom nog geen geaccepteerde productieaansluiting.

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
| `number` | Niet-negatief geheel aantal of `null`; voor Amsterdam een bronschatting, geen geverifieerde telling. Nul en onbekend blijven verschillend; maak van een bronaggregaat geen verzonnen losse bays. |
| `street` | Bronadres of `null`; een nabijheidsadres is geen exact parkeeradres. |
| `access_category` | Voor deze pilot uitsluitend `general`; een andere waarde blokkeert de levering. `general` betekent niet persoonsgebonden gehandicaptenparkeren, geen beschikbaarheid of parkeren zonder vergunning. |
| `source_attributes` | Voor Amsterdam: `regimes`, `orientation` en `version_date`. Alle regimes met hun tijden/dagen/datums/opmerkingen behouden; geen generiek regelsysteem of uitspraak “nu beschikbaar”. |
| `source_updated_at` | Alleen een datum met bekende betekenis als wijziging van het bronrecord; anders `null`. Portaalverwerking is geen veldcontrole. |

Core bewaart de brongeometrie bij de bronclaim en gebruikt na validatie PostGIS `ST_PointOnSurface` voor het afgeleide kaartpunt (vaste afleiding voor deze pilot). Dit blijft een benadering binnen het parkeervlak, geen ingang of individueel vak. Core schrijft de bestaande latitude/longitude-kolommen; PostgreSQL blijft de bestaande `location` afleiden. Zo zijn geen extra Python-geometriepackage of twee concurrerende afleidingen nodig. Zie [PostGIS](https://postgis.net/docs/ST_PointOnSurface.html) en de [bestaande opslagafspraak](postgresql.md#spatial-representation).

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
| Bronwaarde botst met geaccepteerde correctie | Bronwaarde in de ontvangen levering bewaren; correctie behouden en publicatie van de levering blokkeren bij een botsing. Ook in de eerste importimplementatie. |
| Onbekende toegang of gewijzigde scope | Geen automatische algemene publicatie of vergelijking van ontbrekende records; eerst beoordelen. |

Core controleert volgorde en actuele correcties opnieuw bij publicatie, ook als twee beoordeelde imports tegelijk klaarstaan. `retrieved_at` is een eenvoudige volgorderegel voor één producent met correcte UTC-klok; het bewijst geen transactiesnapshot bij de bron. Toekomstige of onlogische tijdstippen vragen beoordeling. Geen gedistribueerde teller bouwen voor de pilot.

## Concrete overdracht

1. **#1214:** bronkeuze, toegestane voorbeeldrij, betekenis en deze voorlopige afspraak.
2. **disabled-parking #774:** eventuele generieke bronpackagefix eerst, daarna één live commando dat dit bestand atomair schrijft. Vervang draftformaat, null-volledigheidsmetadata en achterhaalde voorbeeldroute; behoud slechts nuttige kleine tests.
3. **core #1215:** één intakepad met beoordeling en veilige eerste, gewijzigde, herhaalde, oudere, ontbrekende en conflicterende levering. Vervang/verwijder de oude #1222-schema's en validatie in dezelfde implementatie.
4. **#1217, disabled-parking #775 en core #1216:** provider kiezen, dezelfde levering automatisch uploaden en ontdekken. De gekozen opslaggrens moet voorkomen dat core een gedeeltelijk bestand verwerkt.

Gewone CI werkt offline met kleine voorbeelden van packageobjecten. Eén afzonderlijke begrensde live proef bewijst bronophaling; een daadwerkelijke beoordeelde core-import bewijst de volgende stap. Geen van beide wordt door alleen een fixturetest vervangen.

## Lokale uitvoering en herstel

1. Voer de migraties uit op de bedoelde ontwikkelomgeving en zorg dat de bestaande geografische relaties voor Amsterdam aanwezig zijn. Er worden geen legacygegevens automatisch gekoppeld of vervangen.
2. Registreer de aansluiting met `php artisan nipkaart:register-amsterdam <municipality-id>`. Het commando controleert Amsterdam, land `NL` en provincie `NL-NH`; publicatie staat standaard uit. De ingestelde bbox `[4.65, 52.2, 5.15, 52.5]` is een ruime operationele begrenzing, geen officiële gemeentegrens.
3. Open als beheerder **Gemeentelijke imports**. Controleer de bronvoorwaarden en leg de onderbouwing vast vóór de eerste te publiceren levering. Een configuratiewijziging maakt oudere beoordelingen ongeldig; haal daarna een nieuwe levering op.
4. Bied het ongewijzigde producerbestand aan. Configureer PHP `upload_max_filesize` op minstens `32M` en `post_max_size` en de webserver-bodylimiet hoger dan 32 MiB voor multipart-overhead. Kleinere serverlimieten gelden vóór de applicatiecontrole.
5. Controleer aantallen, oorspronkelijke bronvelden, alle regelingen en een kaartsteekproef. De lijst toont maximaal 50 records per pagina; het parkeervlak en afgeleide punt zijn per record te openen. Goedkeuren en afwijzen vereisen een reden.

`MunicipalImportService::intake()` is het gedeelde toegangspunt voor de upload en de latere bucketconsumer. Autorisatie geldt ook in de service. Eén datasetrij wordt vergrendeld tijdens publicatie; actuele bronrijen en importstatus worden opnieuw gecontroleerd. Een verouderde reviewtoken vereist opnieuw beoordelen. De levering, mutaties en laatste gepubliceerde ophaaltijd worden samen gecommit of teruggedraaid. Opnieuw aanbieden van dezelfde bytes geeft de bestaande status terug, ook na een configuratiewijziging.

Bronclaims staan in `source_record`; `last_imported_values` bewaart de laatst afgeleide waarden. De huidige velden zijn de effectieve waarden: een afwijking ten opzichte van de vorige import geldt conservatief als handmatige correctie. Niet-conflicterende correcties en zichtbaarheid blijven behouden; een gelijktijdige afwijkende bronwijziging blokkeert publicatie. `last_checked_at` registreert de geslaagde controle, `source_updated_at` blijft onbekend. Bestaande niet-aangesloten gemeentelijke records blijven ongemoeid; aansluiting of reconciliatie daarvan is afzonderlijk werk.

`municipal_imports.before_values` bewaart voor gewijzigde records de vorige databasewaarden en voor nieuw aangemaakte records `null`. De ontvangen levering en beoordeling blijven bewaard. Dit ondersteunt een onderbouwde herstelbeslissing; er is geen automatische terugzetknop die latere handmatige correcties kan overschrijven. Bij een databasefout blijft de levering te beoordelen en kan dezelfde publicatie opnieuw worden geprobeerd. De reviewpagina vergelijkt altijd met de huidige gegevens, ook na publicatie; historische verschillen zijn niet hetzelfde als deze actuele vergelijking.

Een migratierollback verwijdert de importaudit en bronkoppeling. Maak eerst een databaseback-up en beoordeel herstel op gegevensniveau; een code-rollback is geen gegevensherstel. Onbekende capaciteit blijft nullable, ook na rollback. Productieactivering, legacyoverdracht, bucketcredentials en planning vallen buiten deze stap.
