# Techstack voor de eerste importketen

Status: eenvoudige uitvoeringskeuzes bij [#1214](https://github.com/NIPKaart/core/issues/1214). Zie de [leveringsafspraak](data-import-contract.md) en [werkpakketten](data-foundation-delivery.md). De live Amsterdam-export en de handmatig beoordeelde core-import zijn op 14 september 2026 geaccepteerd; disabled-parking #783 en core #1222 zijn gemerged. De private bucket en automatische uitvoering zijn nog niet ingericht.

| Onderdeel | Keuze voor de eerste stap |
| --- | --- |
| Core | Bestaande Laravel 13-applicatie, PHP 8.4 baseline en PostgreSQL/PostGIS. |
| Beheer | Bestaande React/Inertia-interface voor vergelijken en beoordelen; geen afzonderlijke importapp. |
| Producer | `disabled-parking`, bestaande Python >=3.11-omgeving en universele bronpackage. Bronpackageversies worden bij de noodzakelijke fix gecontroleerd. |
| Dependencybeheer | uv en `uv.lock`; installatie met `uv sync --locked`, daarna `uv run ...`. Universele packages houden hun eigen tooling. |
| Mapping | Kleine Python-dataclass en expliciete mapping voor één bron. |
| Bestand | Eén begrensd UTF-8 JSON-document, geschreven via tijdelijk bestand en atomische vervanging. |
| Validatie | Expliciete typen en inhoudscontroles aan beide kanten. De Opis/schema-proef is in #1222 verwijderd; één intakeservice verwerkt het pilotformaat. |
| Tests | Bestaande Python unittest/pre-commit-checks en core Pest. Kleine mappingvoorbeelden; geen gemeentelijke netwerken in gewone CI. |
| Eerste overdracht | Lokaal bestand naar dezelfde core-intakeservice die later bucketbestanden verwerkt. |
| Automatische overdracht | Private Cloudflare R2-bucket. Regio, kosten, toegangsrechten en stagingvalidatie in #1217; er zijn nog geen resources ingericht. |
| Uitvoering later | Eén permanent draaiende Docker-container per producerrepo op een eigen Linux-host of cloud-VM. Een interne scheduler start eindige opdrachten achter elkaar; geen container per gemeente. Core gebruikt zijn eigen scheduler/queue. Uitwerking in #775/#1217. |

De uv-migratie en SQL-runtimeverwijdering zijn gemerged in disabled-parking #779 en #780. De tijdelijke Hamburg-export uit #781 is door de live Amsterdam-route in #783 vervangen. Core #1222 levert de bijbehorende beoordeling en publicatie. Core bevat geen Python-code of bronclients.

Gebruik bestaande standaardbibliotheken en dependencies waar die voldoen. Geen nieuwe broker, workerframework, lokale SQLite-planningsdatabase, verplichte sequences, JSONL of apart manifest voor de eerste bron. Voeg een component pas toe wanneer de werkende keten die aantoonbaar nodig heeft.

De producent krijgt uitsluitend de noodzakelijke rechten op zijn eigen private bucketlocatie. Core krijgt aparte leesrechten en beslist over publicatie. Geen databasecredentials of coretoken in de producer. Het overdrachtsmechanisme moet complete, unieke leveringen garanderen; daarvoor is niet vooraf één bepaalde S3-versioningimplementatie voorgeschreven.

Eerst handmatig de hele keten bewijzen, daarna dezelfde bestanden automatisch overdragen. Bij groei meten we looptijd, bronlimieten, bestandsomvang en beheerwerk voordat we extra processen of gedeelde frameworks toevoegen. Offstreet volgt met eigen inhoudelijke afspraken; algemene garagebezetting bewijst geen beschikbare gehandicaptenparkeerplaats.
