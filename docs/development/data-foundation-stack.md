# Concrete techstack voor batchimports

Status: aanbevolen implementatiestack, 2026-09-08. De gekozen batchaanpak vervangt de eerdere aanbeveling voor een interne worker-API en machine-authenticatie via Sanctum. Voor #1214 zijn opis/json-schema 2.6.0 en de geïsoleerde Python-testdependency jsonschema 4.26.0 met expliciete toestemming toegevoegd en gelockt. Er zijn geen diensten geprovisioned. Overige nieuwe dependencies worden per implementatie beoordeeld conform de repositoryregels. Zie [productbasis](../product/data-foundation.md), [batchcontract](data-import-contract.md) en [uitvoering](data-foundation-delivery.md).

## 1. Eerste versie

| Onderdeel | Concrete keuze | Status en reden |
| --- | --- | --- |
| Core | Laravel 13, PHP 8.4 baseline, PHP 8.5 extra CI-doel | Bestaand |
| Beheer/web | React 19, Inertia 3, TypeScript, bestaande componenten en Wayfinder | Bestaand; alleen dataset-/importbeheer uitbreiden |
| Database/geo | PostgreSQL 18 + PostGIS 3.6 | Bestaand; identiteit, importhistorie, correcties en publicatie |
| Core discoveryplanning | Laravel Scheduler | Controleert ready-manifesten en achterstand; plant geen bronfetches |
| Core verwerking | Laravel Queue met bestaande database-driver | Valideren, staging, diff en publicatie op achtergrond |
| Python-uitvoering | CPython 3.14 met asyncio | Doelruntime; bronpackagecompatibiliteit eerst toetsen |
| Dependencies | Bestaande Poetry-tooling en poetry.lock | Behouden; geen verplichte uv-migratie |
| Bron-HTTP | Bestaande packageclients, aiohttp voor directe async adapterverzoeken | Universele packages behouden hun clientkeuze |
| Recordmodel | dataclasses en expliciete adaptermapping | Kleine getypeerde vertaallaag |
| Contract | JSON Schema Draft 2020-12; Python jsonschema 4.x en PHP opis/json-schema 2.x | Dezelfde normatieve schemas en fixtures |
| Bestanden | UTF-8 JSONL + ready-manifest + SHA-256 | Streaming verwerking en onafhankelijke herverwerking |
| Objectopslag | Private Amazon S3-bucket in gekozen EU-regio, versioning aan | Concrete referentieprovider; geen bucket aangemaakt |
| Opslagclients | Python boto3; bestaande Laravel Flysystem S3-adapter / AWS SDK voor versiegebonden reads | Python uploadt; core leest exacte versies via SDK waar de abstractie dat niet ondersteunt |
| Toegangsbeheer | Afzonderlijke scoped IAM-rollen/credentials per producent en coreconsumer | Geen coretoken of publieke import-API nodig |
| Containers | Linux, Docker Engine en Compose v2; gepind Python slim-image | Eén host voor de pilot |
| Ophaalplanning | Eén systemd-timer per importrepository die een eindige containeruitvoering start | Python kiest lokaal welke geconfigureerde sources aan de beurt zijn |
| Runnerstaat | Kleine lokale SQLite-state via Python-stdlib, op persistent volume | Due-tijden, gereserveerde source-sequences en herstelbare uploadstatus; geen gedeelde broker |
| Images/CI | GitHub Actions + GHCR; Poetry-install, pytest en Ruff | Pipeline per importrepo; core behoudt bestaande checks |
| Monitoring | JSON-logs, hostlogrotatie, runnerfoutmelding; core importhistorie en overdue-status | Geen apart observabilityplatform als startvoorwaarde |

Patchversies worden in lockfiles en image-digests vastgelegd. Python 3.14 is een onderhouden versie volgens de [Python-status](https://devguide.python.org/versions/). De huidige repos declareren Python ^3.11; dat bewijst geen compatibiliteit met 3.14. De [Eindhoven-contractproef](data-import-pilot.md) heeft package 5.1.0 op Python 3.14.2 uitgevoerd; bronpackages zijn geen core-dependencies. Een tijdelijke geteste 3.13-baseline is mogelijk als dat nodig blijkt, met expliciete upgradeactie. Universele packages houden hun eigen supportbeleid en tooling.

## 2. Twee onafhankelijke planningen

De importhost start bijvoorbeeld iedere minuut een due-check per repository via een systemd-timer. De container voert alleen sources uit die volgens de repositoryconfiguratie aan de beurt zijn en eindigt daarna. De daadwerkelijke bronfrequentie staat bij de source; de timerfrequentie is niet de fetchfrequentie. Een overlappende start van dezelfde service wordt voorkomen; bronhouderlocks beschermen waar beide repos dezelfde API aanspreken.

De runner bewaart planning, sequences en status van geproduceerde maar nog niet gereedgemelde bestanden op een persistent volume. De SQLite-staat is lokaal operationeel herstelmateriaal, geen tweede domeindatabase en geen gedistribueerde taakqueue. Eén producer is eigenaar van een source. Meerdere hosts komen pas met expliciete bronverdeling of een afzonderlijk coördinatieontwerp.

Core draait zijn eigen Laravel-scheduler: ready-manifesten ontdekken, vastgelopen verwerkingen herplannen en uitblijvende leveringen signaleren. De databasequeue verwerkt de ontvangen gegevens. Batches blijven beschikbaar wanneer core tijdelijk uitstaat. Voor bron- en corepauzes zijn afzonderlijke handelingen nodig, zoals beschreven in het contract.

Frequente bezetting kan later een apart continu offstreetproces krijgen. Het publiceert hetzelfde type versieerbare meetbatch met een eigen stream/source-ID en limieten. Catalogussnapshots en liveobservaties krijgen verschillende ritmes en retentie. Dit verandert niets aan de zelfstandigheid van core.

## 3. Python en bestanden

De adapter roept het bestaande bronpackage aan en schrijft records regel voor regel naar een tijdelijk bestand. De runner valideert, berekent checksum/grootte/aantallen en uploadt met boto3. Na geslaagde upload publiceert hij het ready-manifest. Synchrone SDK-/CPU-stappen worden zo uitgevoerd dat benodigde async bronverzoeken niet blokkeren; de eerste eindige batchrunner heeft geen heartbeat-taak.

Gebruik standaard dataclasses, json, hashlib, logging, datetime, zoneinfo en sqlite3 waar dat volstaat. Boto3 beheert opslagtransport; aiohttp is beschikbaar waar de bronadapter zelf async HTTP nodig heeft. De bronpackages krijgen geen verplichte NIPKaart-client of dependency.

Poetry installeert gelockte dependencies tijdens imagebuild. Start productie zonder downloads bij containerstart. Zie [Poetry's lockfilegedrag](https://python-poetry.org/docs/basic-usage/). Bestaande pymysql-writes en databasecredentials vervallen bij vervanging van de legacy-importuitvoering; de universele bronclients veranderen daarvoor niet.

## 4. Contract en coreverwerking

De schemas in een core-contractrelease zijn normatief. Dataclasses valideren geen JSON. Python gebruikt [jsonschema](https://python-jsonschema.readthedocs.io/en/stable/), PHP [Opis](https://opis.io/json-schema/2.x/); A bewijst dezelfde Draft 2020-12-subset met positieve en negatieve fixtures. Datum-/URI-formatchecks zijn expliciet en externe netwerkresolutie van schema-referenties staat uit. Er is voor bestanduitwisseling geen OpenAPI-specificatie nodig.

Core gebruikt unieke batchregistratie, sequencecontrole en transacties voor idempotente verwerking. Jobs worden na commit beschikbaar gemaakt en een herstelcontrole herplant duurzaam geregistreerde niet-afgeronde imports. Alleen after-commit dispatch is geen garantie tegen een crash vóór dispatch; zie de [queue-transactiedocumentatie](https://laravel.com/docs/13.x/queues#jobs-and-database-transactions).

Valkey is beschikbaar in [DDEV](valkey.md), maar wordt geen nieuwe productieafhankelijkheid voor de batchketen. De core-databasequeue blijft de startkeuze. Meet belasting voordat een queuedriver of opslagindex wordt gewijzigd.

## 5. Opslag en bevoegdheden

S3 is de referentieprovider. De bucket is private, versioning staat aan, core leest de exacte recordsversie uit het manifest en legt de manifestidentiteit vast. Verwerk niet blind de actuele inhoud van een overschrijfbare key. De [S3-versioningdocumentatie](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) beschrijft afzonderlijke objectversies; de integratietest moet dit gedrag aantonen.

De producent heeft alleen toegang tot eigen source-prefixen en noodzakelijke upload-/herstelhandelingen; geen database- of corebeheerrechten. Core heeft read/list/versionread voor toegelaten prefixen. Cleanup/delete loopt via afzonderlijke beperkte bevoegdheden. Gebruik waar mogelijk tijdelijke rolcredentials, anders afzonderlijke roteerbare secrets. Credentials staan buiten code en images. Een algemene publieke API-key of workerregistratie in core is niet nodig.

Een andere S3-compatible provider kan pas worden gekozen na toetsing van versioning, create-only writes, paginering, retentie en exacte versie-reads. Er is geen provider gecontracteerd. Ruwe brondata wordt alleen opgeslagen als dat nodig en toegestaan is; een recordsartifact is de genormaliseerde aanlevering.

## 6. Hosting, CI en schaalpad

Core behoudt zijn bestaande hosting. Op de importhost beheert [Docker Compose](https://docs.docker.com/compose/how-tos/production/) de containerdefinities; systemd start de eindige batchservices. Images worden op digest gebruikt. Voorgestelde namen zijn ghcr.io/nipkaart/disabled-parking en ghcr.io/nipkaart/offstreet-parking; de documentatie bewijst niet dat ze al bestaan. [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) bewaart de OCI-images.

De host heeft geen publieke importpoort nodig. Runtime krijgt alleen benodigde sourceconfig, opslagrechten, persistent statevolume, tijdelijke werkruimte en resourcegrenzen. Geen Docker-socket in de container. systemd/Docker beheren deadlines, exits en logs. Beheerde hostkeuze, machinegrootte en budget worden bij staging bepaald; er is geen gemeten capaciteit geclaimd.

Lokaal kan dezelfde adapter naar een bestand schrijven zonder opslagaccount. Core verwerkt het bestand via dezelfde validator en services. DDEV blijft de coreomgeving. Staging test de echte opslagoverdracht, versioning, discovery, permissions en herstel. Python test met pytest, pytest-asyncio waar async gedrag nodig is en Ruff; core gebruikt Pest en [bestaande qualitychecks](quality-checks.md). Gewone CI haalt geen gemeentelijke datasets op.

Bij groei eerst meten: runtime, gemiste leveringen, bronlimieten, bytes, manifestlistingkosten en coreverwerkingstijd. Daarna sources verdelen over exclusieve producenten, discovery versnellen of kernverwerking opschalen. Een gedeeld Python-framework ontstaat pas als de tweede repository werkelijk dezelfde uitvoeringslogica nodig heeft.
