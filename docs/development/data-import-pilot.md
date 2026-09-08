# Contractproef 1.0: Eindhoven

Status: implementatie van [#1214](https://github.com/NIPKaart/core/issues/1214), 2026-09-08. Dit bevriest het gemeentelijke snapshotformaat en levert offline PHP/Python-contractchecks. Eindhoven is de gekozen **contractpilot**; publicatie blijft geblokkeerd door onderstaande bronvoorwaarden. Er is geen producer, opslagintegratie, database-import of productieaansluiting gebouwd.

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

## Mapping en concrete aansluitvoorwaarden voor #774

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

Deze acties horen bij de eerste adapter in [disabled-parking#774](https://github.com/NIPKaart/disabled-parking/issues/774). Het contract kan onafhankelijk worden geïmplementeerd door #1215. Brononderzoek blijft buiten core; bovenstaande punten zijn concrete toelatingsvoorwaarden voor deze ene aansluiting.

## Normatief formaat en validatiegrens

[Manifestschema](../../resources/schemas/import/v1/manifest.schema.json) en [gemeentelijk recordschema](../../resources/schemas/import/v1/municipal-record.schema.json) zijn JSON Schema Draft 2020-12, contract `1.0`. Er zijn geen externe `$ref`-verwijzingen of schema's uit leveringen. De validator laadt uitsluitend deze lokale vertrouwde schema's; Python heeft bovendien een resolver die netwerkreferenties weigert. Een `$id` is een identifier, geen te downloaden bestand.

Records zijn UTF-8 zonder BOM, één JSON-object per regel, uitsluitend LF en altijd een afsluitende LF. Geen compressie, lege regels of impliciete ontbrekende velden. Producers schrijven JSON via een encoder, geen handmatige stringconcatenatie. Tijdstippen gebruiken UTC-seconden `YYYY-MM-DDTHH:mm:ssZ`, echte kalenderdatums, geen leap seconds. Nullwaarden staan expliciet in het bestand. Onbekende velden worden afgewezen; uitbreidingen krijgen een afgesproken contractversie. V1 omvat alleen gemeentelijke snapshots, geen offstreet- of livevelden.

`SnapshotContract::check()` en de onafhankelijke Python-referentie controleren een lokaal recordsbestand en de **exacte manifestbytes**. Het pad en de context komen van de vertrouwde consumer, niet uit het manifest. Context bevat bron/geografische toelating, actuele config/scope en de volledige bewaarde batch-/sequencehistorie voor deze source. Een manifest kan zijn eigen bron of scope niet toelaten.

| Resultaat | Betekenis |
| --- | --- |
| `invalid` | Vorm, integriteit, volledigheid, geografie of limiet faalt; niet verwerken. |
| `conflict` | Bekende batch-ID met andere exacte manifestbytes, of reeds gebruikte sequence; niet verwerken zonder onderzoek. |
| `duplicate` | Dezelfde batch en exacte manifesthash na bestandsvalidatie; consumer bepaalt hervatten of overslaan. |
| `superseded` | Sequence ouder dan/gelijk aan de vertrouwde high-watermark; nooit nieuwere data terugdraaien. |
| `review` | Technisch geldig maar leeg, gewijzigde config/scope, onbekende/persoonlijke toegang of onbegrepen beperkingen. Geen automatische publicatie. |
| `valid` | De begrensde contractcheck slaagt. **Geen publicatiebesluit**: eerste import, aantalsdaling, brondatumregressie, verschillen en correctiebehoud worden pas in #1215/#1218 beoordeeld. |

Een identieke levering moet ook dezelfde manifestserialisatie behouden. Hashes omvatten exacte bytes, inclusief LF. De checker raadpleegt geen objectopslag of database en bewijst geen bestaande objectversie, locking, queueherstel of transactionele publicatie. De consumer moet state onder lock opnieuw controleren vóór publicatie. De Python-code is een kleine testreferentie; de producerimplementatie blijft in disabled-parking.

## Verplichte pilotlimieten

| Limiet | Waarde |
| --- | --- |
| Ready-manifest | 16.384 bytes |
| JSONL-regel inclusief LF | 16.384 bytes |
| Recordsbestand | 33.554.432 bytes (32 MiB), ongecomprimeerd |
| Records per snapshot | 10.000 |
| Fetch inclusief requests, retries en parsing | 1.800 seconden |
| Lokale contractvalidatie | 30 seconden monotone verstreken tijd |
| Probe | 30 seconden totaal, 15 seconden request-timeout, één fetch, geen automatische retries |

Deze zijn harde pilotplafonds, geen schaalbelofte. Producer en consumer moeten ze afdwingen. De lokale validator telt werkelijke bytes en regels tijdens streaming; een manifest mag niet met kleine metadata een groter bestand toestaan. Deadlinecontrole gebeurt tussen regels en bij afronding. De opslagdownload moet in #1215/#1216 zelfstandig een byte- en wall-clockgrens krijgen; een geblokkeerde storage-read wordt niet door deze lokale checker onderbroken. Een nieuwe bron die niet past krijgt een bewuste limiet-/capaciteitsbeslissing, geen stilzwijgende verhoging.

De 180 werkelijk gemeten bronrecords normaliseren in de proef naar 79.566 bytes, maximaal 457 bytes per regel. Een synthetische 10.000-recordproef gebruikt 4.409.201 bytes. De ceilings bieden ruimte boven deze bron, met begrensd geheugengebruik voor de set externe ID's. Gemeten validatietijden voor 180 / 10.000 records: PHP 0,024 / 0,600 seconden, Python 0,051 / 1,900 seconden. Dit is contractvalidatie op de ontwikkelmachine; databasepublicatie en stagingcapaciteit moeten afzonderlijk worden gemeten.

## Reproduceren

Vanaf de repositoryroot:

```sh
vendor/bin/pest tests/Unit/Support/SnapshotContractTest.php --no-tia --compact
poetry -C tests/Support/import_contract env use python3.14
poetry -C tests/Support/import_contract install --no-interaction
poetry -C tests/Support/import_contract run python -m unittest -v
```

PHP en Python gebruiken dezelfde bestanden uit [de fixturelijst](../../tests/Fixtures/import/v1/cases.json). De Python-testreference is uitsluitend contractcompatibiliteit, zonder bronpackages, netwerkfetches of producerlogica. Een aparte deadlineproef gebruikt een gecontroleerde monotone klok. Normale CI doet geen bronrequests en gebruikt de vastgelegde dependencies. Een nieuwe read-only bronproef hoort in de importrepository of een tijdelijke onderzoeksomgeving, met `eindhoven==5.1.0` en CPython 3.14.2. Gebruik de bovenstaande package-aanroep en controleer op dezelfde response `nhits`, rijenaantal, unieke IDs en bytes. De publieke [packagevoorbeeldcode](https://github.com/klaasnicolaas/python-eindhoven/tree/v5.1.0/examples) toont het ophalen. Voor de meting is via een aiohttp trace callback de ongewijzigde response geteld; de package zelf exposeert de completenessmetadata nog niet.

Herhaal die proef bij bron-/packagewijzigingen; voeg live netwerkafhankelijkheid of een bronadapter niet toe aan core. De normale tests blijven offline.
