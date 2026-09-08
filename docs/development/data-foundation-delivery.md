# Batchimports: uitvoering en beheer

Status: uitvoeringsvoorstel, 2026-09-08. De eigenaar heeft de zelfstandige batchaanpak gekozen. Dit document vervangt de werkpakketten voor door core aangestuurde workers. De uitvoering is op 2026-09-08 in GitHub gepland met 13 nieuwe subissues, bijgewerkte epics en native parent-/blockingrelaties. De [contractproef voor #1214](data-import-pilot.md) voegt goedgekeurde validators, schemas en fixtures toe. Er zijn geen importjobs gestart of productiegegevens geïmporteerd. Zie [productbasis](../product/data-foundation.md), [batchcontract](data-import-contract.md) en [techstack](data-foundation-stack.md).

## Eenvoud als uitgangspunt voor uitvoering

De eerste versie heeft één dataset, één adapter rond een bestaand universeel package en één volledige snapshot. De adapter produceert een bestand; core beoordeelt en verwerkt het. Automatisering verandert alleen hoe dat bestand verschijnt. Brononderzoek/CRM, generieke adapterbouwers, karma en een mobiele app blijven buiten deze eerste keten.

Drie kleine opleveringen:

1. **Bestand naar correcte parkeerdata:** fixture/package naar JSONL en manifest, dezelfde validatie in Python en core, handmatig gestart importproces en beoordeelde publicatie.
2. **Bestanden automatisch leveren en ontdekken:** geplande batchuitvoering in de importomgeving, records uploaden en als laatste gereedmelden; core ontdekt en verwerkt zonder runner-API.
3. **Correctie behouden:** een beoordeelde veldcorrectie op een geïmporteerde plek blijft na herimport bestaan en kan expliciet worden ingetrokken.

De eerste stap werkt lokaal met een fixture; uiteindelijke pilotacceptatie vereist een echte toegestane bron en stagingtransport. Integreer alleen de opslag en UI die deze stappen vereisen. Het beheer begint met datasetinstellingen en een importoverzicht met verschillen, publiceren en afwijzen.

| Direct nodig | Later wanneer aangetoond nodig |
| --- | --- |
| Volledige snapshots en stabiele bron-ID | Deltafeeds/cursors |
| Klaar-manifest pas na volledige upload | Opslagnotificaties of extra delivery-index |
| Unieke batchregistratie en sourcevolgorde | Meerdere productiehosts met coördinatie |
| Eén begrensde publicatietransactie na staging | Grote versioned publicaties met atomair omschakelen |
| Veldcorrectie apart van bronwaarde | Uitgebreid bewijs-/vertrouwensmodel |
| Ongewijzigde records niet herschrijven | Bronafhankelijke conditional requests |
| Bestaande Poetry-tooling | Zelfstandige toolingmigratie indien nuttig |

Correctheid blijft verplicht: beperkte opslagrechten, volledige levering controleren, oudere batches weigeren, idempotente verwerking, stabiele verwijzingen, behoud van correcties en onbekend niet als nul of vrij presenteren.

## 1. Roadmapkoppeling

De bestaande productissues zijn als anker hergebruikt. De concrete planning hieronder is op 2026-09-08 aangemaakt; alle acceptatiecriteria blijven open totdat de uitvoering bewijs oplevert.

| Issue | Bijdrage |
| --- | --- |
| [#1168](https://github.com/NIPKaart/core/issues/1168) | Productervaring; noodzakelijke databasis eerder dan oude Horizon 2-indeling |
| [#1176](https://github.com/NIPKaart/core/issues/1176) | Operationeel datasetregister, batchimporthistorie, identiteit en dekking |
| [#1174](https://github.com/NIPKaart/core/issues/1174) | Provenance, freshness en begrijpelijke status |
| [#1175](https://github.com/NIPKaart/core/issues/1175) / [#276](https://github.com/NIPKaart/core/issues/276) | Correcties/besluiten/retentie; correcties op geïmporteerde plekken expliciet meenemen |
| [#1177](https://github.com/NIPKaart/core/issues/1177) | Voorzieningen en aparte bezettingsstroom |
| [#1170](https://github.com/NIPKaart/core/issues/1170) / [#1172](https://github.com/NIPKaart/core/issues/1172) | Effectieve gegevens en bronkoppelingen in discovery/details |
| [#1171](https://github.com/NIPKaart/core/issues/1171) | Toegankelijke lijst/detail en correctieflow |
| [#455](https://github.com/NIPKaart/core/issues/455) | Bulkbeheer behoudt import-/correctiehistorie |

Maak kleine reviewbare PR's per verticale stap. Sluit issues pas na hun werkelijke acceptatie, niet op basis van deze ontwerptekst.

## Concrete GitHub-planning

De [data-epic #1176](https://github.com/NIPKaart/core/issues/1176) hangt onder [productepic #1168](https://github.com/NIPKaart/core/issues/1168). De [municipal producer-epic #690](https://github.com/NIPKaart/disabled-parking/issues/690) is hergebruikt en herschreven rond bestanden in plaats van directe databasewrites. Correcties, freshness en offstreet blijven onder hun bestaande productepics. Afhankelijkheden zijn echte GitHub-blockingrelaties; dit zijn oplevergroepen zonder verzonnen kalenderdeadlines.

| Oplevering | Issue | Resultaat |
| --- | --- | --- |
| M1 | [core#1214](https://github.com/NIPKaart/core/issues/1214) | Pilotbron en bestandcontract |
| M1 | [disabled-parking#774](https://github.com/NIPKaart/disabled-parking/issues/774) | Eerste packageadapter |
| M1 | [core#1215](https://github.com/NIPKaart/core/issues/1215) | Beoordeelde bestandimport |
| M2 | [disabled-parking#775](https://github.com/NIPKaart/disabled-parking/issues/775) | Zelfstandige batchproducer |
| M2 | [core#1216](https://github.com/NIPKaart/core/issues/1216) | Manifestdiscovery en herstel |
| M2 | [core#1217](https://github.com/NIPKaart/core/issues/1217) | Staging, opslagrechten en retentie |
| M3 | [core#1218](https://github.com/NIPKaart/core/issues/1218) | Correctiebehoud bij herimport |
| M3 | [core#1219](https://github.com/NIPKaart/core/issues/1219) | Herkomst en overdue |
| M3 | [core#1220](https://github.com/NIPKaart/core/issues/1220) | Volledige ketenacceptatie |
| Vervolg | [disabled-parking#776](https://github.com/NIPKaart/disabled-parking/issues/776) | Tweede Europese bron |
| Vervolg | [offstreet-parking#656](https://github.com/NIPKaart/offstreet-parking/issues/656) | Offstreetcatalogus |
| Vervolg | [core#1221](https://github.com/NIPKaart/core/issues/1221) | Bezettingscontract en coreconsumer |
| Vervolg | [offstreet-parking#657](https://github.com/NIPKaart/offstreet-parking/issues/657) | Liveproducer en integratie |

Start met de contractproef in core#1214. Daarna kunnen adapter en core-bestandintake afzonderlijk worden uitgewerkt. Stagingbeslissingen blokkeren de lokale bestandproef niet. De gemeentelijke ketenacceptatie blokkeert verdere bronuitbreiding; de offstreetconsumer wordt eerst op fixtures bewezen voordat de liveproducer integreert.

## 2. Werkpakketten

### A — Package naar bestandcontract

Repos: core voor schemas/fixtures, disabled-parking voor adapter. Geen infrastructuur vereist.

- [ ] Selecteer één echte bron op stabiele ID, begrijpelijke scope en voorwaarden. Amsterdam is kandidaat, niet vooraf geaccepteerd.
- [ ] Controleer packageversie, doelruntime, paginering, nullwaarden, brondata en geografische mapping.
- [ ] Leg toegestane gesaniteerde fixtures vast en maak manifest-/recordschemas volgens het batchcontract.
- [ ] Bouw expliciete adaptermapping en bestanduitvoer; het universele package krijgt geen NIPKaart-afhankelijkheid.
- [ ] Laat Python en PHP dezelfde positieve/negatieve voorbeelden accepteren of afwijzen.
- [ ] Bepaal verplichte grenzen voor bytes, records, regels en uitvoeringsduur op basis van de pilot.

Klaar wanneer een lokaal gemaakt bestand reproduceerbaar geldig is. Een API bereikbaar krijgen bewijst geen volledige of semantisch juiste dataset.

### B — Bestand ontvangen, vergelijken en publiceren

Repo: core. Afhankelijk van A; voltooit de eerste kleine oplevering.

- [ ] Registreer een toegelaten dataset met source-ID, scope, herkomst, voorwaarden, geografische mapping en publicatiebeleid; geen onderzoeksworkflow.
- [ ] Bouw één toepassingsservice voor intake vanaf een lokaal/uploadbestand en later objectopslag. Geen directe spreadsheetwrites naar parkeertabellen.
- [ ] Leg batchidentiteit, volgorde, artifactidentiteit en status vast met unieke constraints en herhaalbare verwerking.
- [ ] Valideer in staging en toon een diff met aantallen, fouten, verdwijningen en kaart/lijststeekproef.
- [ ] Beoordeel eerste publicatie; blokkeer incomplete, onverwacht lege en ongeldige datasets.
- [ ] Behoud bestaande bron-ID's, visibility en verwijzingen; maak alleen inhoudelijke bronwijzigingen tot revisies.
- [ ] Publiceer de begrensde pilot in één korte transactie; bewijs rollback en hervatten bij uitval.
- [ ] Hercontroleer basis-/correctieversies vlak vóór publicatie; missing-from-source is beoordeling, geen delete.

Klaar wanneer lokale eerste import/herimport werkt en mislukte batches bestaande publieke data niet wijzigen.

### C — Zelfstandige aanlevering automatiseren

Repo: disabled-parking en deploymentconfiguratie. Afhankelijk van A; bruikbaar naast B.

- [ ] Leg sourceconfiguratie, ophaalritme en expliciete adapterregistry vast in de importrepo; secrets buiten versiebeheer.
- [ ] Bouw een eindige batchrunner met deadlines, retries/backoff, bronlimieten en durable source-sequence/uploadstatus.
- [ ] Maak een gelockt containerimage en één geplande hostuitvoering per repo; geen container/cron per gemeente.
- [ ] Upload naar private source-prefix met beperkte producentrechten en recordsversion-ID; schrijf manifest pas na complete upload.
- [ ] Test half bestand, manifestuploadfout, herhaalde aanlevering, oudere batch, bron-429, bronfout en stateherstel.
- [ ] Produceer foutlogs en een operationele melding; geen fout als succesmanifest publiceren.
- [ ] Bewijs beperkte bronhouderrequests, ook wanneer packagepaginering intern gebeurt.

Klaar wanneer de importomgeving zonder core beschikbaarheid een complete versieerbare levering kan publiceren. De batchrunner heeft geen coretoken of DB-credentials.

### D — Core ontdekt leveringen en bewaakt actualiteit

Repo: core. Afhankelijk van B/C; voltooit automatisering.

- [ ] Leg toegelaten opslagprefix en verwachte maximale leveringsleeftijd per dataset vast.
- [ ] Ontdek ready-manifesten met volledige paginering en lees exacte recordsversies via read-only opslagrechten.
- [ ] Gebruik dezelfde intake/verwerking als B en herplan niet-afgeronde imports na een crash vóór queuedispatch.
- [ ] Bewijs unieke intake, conflicterende batch-ID, late oudere sequence en twee gelijktijdige coreprocessors.
- [ ] Test core-uitval, ontdekking na herstel en de afgesproken opslagretentie als leveringsgrens.
- [ ] Toon laatste ontvangst, validatie, publicatie, brondatum en overdue afzonderlijk; een oud succes blijft niet gezond.
- [ ] Maak verschil tussen ophalen pauzeren buiten core en verwerking/publicatie pauzeren in core duidelijk.

Klaar wanneer de volledige stagingketen autonoom werkt en een ontbrekende levering zichtbaar wordt zonder dat core het ophaalproces bestuurt.

### E — Correctiebehoud en productacceptatie

Repo: core. Afhankelijk van B; integreer met D voor ketenacceptatie.

- [ ] Laat een gebruiker een veldcorrectie op een geïmporteerde plek voorstellen met reden en waarnemingsdatum.
- [ ] Laat een bevoegde beheerder accepteren/afwijzen met actor, basisversie en duurzame historie.
- [ ] Bewaar bronwaarde en lokale correctie afzonderlijk; details lezen effectieve gegevens.
- [ ] Herimport overschrijft de correctie niet; afwijkende bronwaarden worden als conflict zichtbaar.
- [ ] Intrekken van een correctie gebruikt de actuele bronbasis, niet een toevallige oude kopie.
- [ ] Favorieten en detailverwijzingen blijven stabiel bij herimport, correctie en terugkeer.
- [ ] Test rechten, gelijktijdige wijzigingen, publieke velden en keyboard-/telefoongebruik.

Klaar wanneer de hele keten een correctie en herimport doorstaat. Bijdragerechten/retentie moeten vóór publieke activering geregeld zijn. Foto's en karma kunnen later.

### F — Tweede bron en offstreet

Repos: beide importrepos en core. Na de eerste ketenacceptatie.

- [ ] Sluit een inhoudelijk andere Belgische/Duitse bron aan en toets geografische/semantische variatie.
- [ ] Trek pas werkelijk gedeelde uitvoeringslogica los; geen generiek workerframework vooraf.
- [ ] Sluit een offstreetcatalogus aan op hetzelfde snapshotcontract.
- [ ] Voeg aparte versieerbare bezettingsbatches toe met waarnemingstijd, stale-status, eigen ritme en retentie; geen catalogusverwijdering.
- [ ] Voeg eventueel handmatige CSV/GeoJSON-vertaling toe naar dezelfde intake.
- [ ] Meet runtime, listingvolume, transactieduur en beheerwerk voordat bronnen/hosts worden opgeschaald.
- [ ] Bronkoppelingen en ontdubbeling krijgen eigen review met behoud van bestaande type/ID-verwijzingen.

Klaar per bron; geen claim van volledige Europese dekking.

## 3. Hosting en planning

| Proces | Taak |
| --- | --- |
| Importhost systemd-timer per repository | Start periodiek de eindige due-runner |
| Python-container | Leest sourceconfig, haalt due bronnen op, maakt bestanden en manifesten |
| Persistent runnervolume | Lokale SQLite-staat voor planning, sequences en onafgeronde uploads; tijdelijke bestanden begrensd |
| Private versioned S3-opslag | Uitwisselpunt; source-prefixen en onafhankelijke rechten |
| Core scheduler | Ontdekt manifests, herplant verwerking en controleert overdue |
| Core databasequeueprocessor | Valideert/staget/vergelijkt/publiceert |
| PostgreSQL/PostGIS | Bronidentiteit, batchstatus, correcties en gepubliceerde gegevens |

Start met één Linux-host en één gemeentelijke runner. Docker Compose bevat runtimeconfiguratie; systemd start de batchservice. De due-check kan iedere minuut draaien terwijl sources hun eigen ritme hebben. Hostlocks voorkomen overlap; maximaal één actieve fetch per bronhouder in de pilot met interne pacing. Dezelfde bronhouder in beide repos gebruikt een gedeelde hostlock. Ophaalplanning is geen onderdeel van core.

De runner eindigt na het werk. Crash, timeout of SIGTERM mag geen half gereedmanifest nalaten. Bewaar geproduceerd bestand en uploadstatus waar veilig hervatten mogelijk is; een nieuwe fetch krijgt een nieuwe sequence. Gemiste snapshotmomenten leiden tot de eerstvolgende actuele fetch, niet onbeperkt inhalen.

Livebezetting kan een aparte continue offstreetservice worden met dezelfde bestandgrens. Bij groei sources exclusief verdelen over hosts of eerst coördinatie ontwerpen; zomaar replicas starten kan bronlimieten of sequence-eigenaarschap schenden.

## 4. Beveiliging en bescherming

| Grens | Vereiste |
| --- | --- |
| Producent | Alleen eigen source-prefix schrijven en noodzakelijke upload/herstelacties; geen core- of DB-toegang |
| Coreconsumer | Alleen toegelaten prefixen lezen/listen en exacte versies lezen; geen ophaalcredentials |
| Cleanup | Afzonderlijke beperkte delete/lifecyclebevoegdheid; geen automatisch verwijderen van benodigde herstelversies |
| Secrets | Gescheiden roteerbare rollen/credentials; nooit in image, repo, URL-log of manifest |
| Bestanden | Private opslag, unieke batchkeys, exacte versions, checksum en harde inhoud-/omvangsgrenzen |
| Adapter/netwerk | Expliciete coderegistry; geen code uit configuratie; bronhosts/redirects en egress begrenzen inclusief private/metadataadressen |
| Beheer/community | Bestaande policies en rollen voor datasetbeheer, beoordeling en correcties |
| Publieke dienst | Begrensde queries en rate limits, expliciete publieke velden en aparte bulkkeuze; basiszoeken zonder account |

Een toegelaten producent kan onjuiste gegevens aanleveren. Opslagrechten/checksums bewijzen geen inhoudelijke betrouwbaarheid: validatie, broncontrole en beoordeling blijven nodig. Open images/code geven geen toegang tot de private bucket of core. Datarechten/attributie blijven per bron gelden; de [productbasis](../product/data-foundation.md#9-open-code-en-beschermde-dienstverlening) beschrijft de grenzen.

## 5. Monitoring en retentie

De importomgeving logt source/batch/sequence/adapter/image, fase, duur en veilige foutcode. Meld herhaalde fetch-/uploadfouten via operationele monitoring en bundel herhalingen. Core toont ontvangst, validatie, publicatie en brondatum; uitblijvende levering wordt overdue. Core kent de fetchfoutoorzaak niet zonder aanvullende statusfeed, die niet bij de pilot hoort.

Stel vóór staging vaste upload-/record-/uitvoeringslimieten in. Stel vóór productie ook bewaartermijnen, maximaal te overbruggen core-uitval, RPO/RTO en kostenplafond vast. Recordsobjectversies en manifests moeten samen beschikbaar blijven binnen die uitvalgrens. Weesbestanden mogen eerder worden opgeruimd; benodigde publicatie-/herstelreferenties blijven bewaard. Onbeperkte bezettingshistorie is geen default.

Databasebackups dekken de bucket en lokale runnerstaat niet. Test gezamenlijk herstel van core, benodigde objectversies en sequenceplanning. Bronvoorwaarden bepalen of ruwe payloads bewaard mogen worden. Genormaliseerde batches hebben eveneens expliciet bewaarbeleid. Bestaande user-/plekdeletecascades veranderen niet door dit document; nieuwe bewijsretentie hoort bij #1175/#276.

## 6. Herstel en release

1. Bronfout: inspecteer runnerlogs, pas package/config aan en maak een nieuwe batch; de vorige corepublicatie blijft staan.
2. Uploadfout: hervat de levering van hetzelfde geproduceerde artifact; schrijf ready pas na volledige opslag.
3. Core-uitval: hervat manifestdiscovery en niet-afgeronde imports; behoud sequence- en batchcontrole.
4. Verdachte batch: blokkeer/verwerp publicatie. Een identieke herontdekking omzeilt die beslissing niet.
5. Producentcompromis: trek opslagcredentials in, stop runner en pauzeer nieuwe intake/publicatie voor betrokken sources; beoordeel artifacts/publicaties in die periode.
6. Foute publicatie: nieuw herstelbesluit met geldige bewaarde bronrevisie en actuele correcties. Geen oude DB over nieuwe communitybijdragen terugzetten.
7. Stateherstel: herstel sequences uit lokale staat en reeds gepubliceerde manifesten; hergebruik geen oude sequence. Bij onzekere continuïteit aansluiting pauzeren en expliciet reconciliëren.

Rol nieuwe contractondersteuning eerst in core uit; daarna nieuwe producerimages. Oude ondersteuning verdwijnt pas nadat opgeslagen relevante batches en producers uitgefaseerd zijn. Pin images op digest en bewaar versie-/commitinformatie bij batches. Ophalen blijft uit tot bronvoorwaarden, scope, rechten en limieten klaar zijn. Eerste echte publicatie wordt beoordeeld; automatische normale verwerking volgt na pilotacceptatie.

De [fresh-start-afspraak](postgresql.md#fresh-start-decision) blijft gelden: geen verplichte historische MySQL-transfer. Eventuele oude communityplekken krijgen een aparte herleidbare legacy-import zonder fictieve verificatiedatum. Oude productiejobs uitschakelen is een expliciete deploymentactie, geen gevolg van deze documentatie. Laat oude en nieuwe importsystemen niet tegelijk dezelfde doelgegevens schrijven.

## 7. Tests en startbeslissingen

Volg [quality-checks.md](quality-checks.md) en de toepasselijke skills tijdens implementatie. Deze documentatiewijziging vereist geen applicatie-/databasetest.

| Niveau | Bewijs |
| --- | --- |
| Adapter/schema | Gesaniteerde echte fixtures, semantiek, pagina's, ID's, nullwaarden en fouten |
| Opslagtransport | Upload-before-ready, versioned reads, prefixrechten, half bestand en herhaalde aanlevering |
| Core-integratie | PostgreSQL-transacties, idempotentie, volgorde, revisies en correctiebehoud |
| Stagingketen | Geplande echte producer → private opslag → corediscovery → publicatie → correctie → herimport |
| Operationeel | Overdue, bronlimieten, credentials intrekken, log/retentiegrenzen en herstel |
| Product | Attributie/freshness, juiste locatie en toegankelijke capaciteit, keyboard-/telefoonflow |

Normale CI gebruikt geen gemeentelijke netwerken. Bronprobes zijn apart, read-only en begrensd. Bewaar core-SHA, producerimage-digest, adapter/package/contractversie, sourceconfigversie en batch-ID bij acceptatie. CI is niet hetzelfde als productie- of fysieke datakwaliteit.

| Beslissing | Nodig vóór |
| --- | --- |
| Pilotbron/packageversie en voorwaarden | A afronden |
| Definitief bestandcontract, sourcevolgorde en limieten | B/C |
| Buitenlandse geografische mapping | Betreffende bron aansluiten |
| Host, opslagregio, rechten en budget | Stagingdeploy |
| Retentie, uitvalgrens, herstel en contributierechten | Productie/publieke bijdragen |
| Historische import, foto's, karma, mobiel, bulktoegang | Afzonderlijke vervolgfunctie |

De eerstvolgende ontwikkelopdracht is A met de minimale bestandintake van B. Zo bewijzen we het gegevenscontract en de verwerking voordat automatische aanlevering wordt toegevoegd.
