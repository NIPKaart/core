# Batchimportcontract

Status: snapshotcontract 1.0, 2026-09-08; schemas en offline contractvalidatie zijn uitgewerkt in [de Eindhoven-contractproef](data-import-pilot.md). De eigenaar heeft gekozen voor geplande batchleveringen. Dit vervangt het eerdere workerprotocol; core deelt geen opdrachten uit en registreert geen workers. Zie de [productbasis](../product/data-foundation.md), [techstack](data-foundation-stack.md) en het [uitvoeringsplan](data-foundation-delivery.md). Opslaglevering, scheduling, review en publicatie zijn vervolgstappen en nog niet geïmplementeerd.

## 1. Eigenaarschap

De repositories `disabled-parking` en `offstreet-parking` beheren adapters, bronconfiguratie en ophaalplanning. Een geplande Python-uitvoering gebruikt universele bronpackages en produceert een genormaliseerde levering. Core ontdekt gereedgemelde leveringen en beheert validatie, beoordeling, correcties en publicatie.

Het bestandcontract is de grens. Python heeft geen coretoken of databaseverbinding nodig; core heeft geen gemeentelijke API-credentials nodig. Private objectopslag heeft afzonderlijke toegangsrechten voor producent en consumer. Universele packages kennen dit NIPKaart-contract niet.

De eerste versie ondersteunt volledige snapshots. Delta's/cursors volgen alleen wanneer een concrete bron ze nodig maakt. Livebezetting is een aparte leveringssoort en verandert geen catalogusidentiteit.

## 2. Configuratie zonder twee planners

| Gegeven | Plaats |
| --- | --- |
| Endpoint, adapter, broncredentials, filters en ophaalritme | Importrepository/configuratie en secrets van de importomgeving |
| Stabiele source-ID, scopeversie en contractversie | Afspraak tussen importconfiguratie en toegelaten dataset in core |
| Toegelaten opslagprefix, recordsoort, geografische mapping, voorwaarden | Core-datasetregistratie |
| Verwachte maximale leveringsleeftijd | Core als signaleringsgrens; geen bronplanning |
| Publicatiebeleid, zichtbaarheid en correcties | Core |

Een nieuwe source of scope wordt eerst in core toegelaten. Een manifest kan dat niet zelf autoriseren. Scopewijzigingen krijgen een versie en een beoordeelde baseline. Ophalen pauzeren gebeurt in de importomgeving; verwerken/publiceren pauzeren gebeurt in core. Het beheer maakt dit onderscheid zichtbaar. Er is aanvankelijk geen coreknop om een nieuwe fetch te starten.

## 3. Een levering gereedmelden

Voorgestelde opslagstructuur:

```text
sources/<source_id>/batches/<batch_id>/records.jsonl
sources/<source_id>/ready/<batch_id>.json
```

Een batch heeft een unieke batch-ID, een binnen de source oplopende `source_sequence`, scopeversie en één recordsbestand. Het bestand is UTF-8 JSONL, in de pilot ongecomprimeerd en begrensd. Het ready-bestand is het manifest en wordt als laatste geschreven.

1. De runner reserveert een sequence vóór ophalen en bewaart batchidentiteit en uitvoeringsmoment duurzaam. Eén producer is eigenaar van een source; een hostlock voorkomt overlap tijdens de eerste single-hostopzet.
2. De adapter haalt volledig op, vertaalt en valideert. Ontbrekende pagina's of parsefouten maken de levering onvolledig.
3. De runner schrijft een tijdelijk bestand, berekent recordaantal, bytes en SHA-256 en uploadt naar de unieke batchkey.
4. De referentieopslag heeft versioning; de runner bewaart de exacte recordsobjectversion-ID.
5. Alleen na succesvolle volledige bestandsupload schrijft de runner het ready-manifest met key, version-ID en checksum. Gebruik create-only voor manifestkeys waar ondersteund; dezelfde batch-ID krijgt nooit andere inhoud.
6. Core legt ook de manifestversie/checksum vast en leest de exacte recordsversie. Een latere key-overwrite verandert een al geaccepteerde levering niet.

Bij een onzekere uploadrespons controleert de runner de bestaande versie en checksum. Hetzelfde geproduceerde bestand kan opnieuw worden gereedgemeld. Opnieuw ophalen van mogelijk veranderde data is een nieuwe batch met een nieuwe sequence. Gaten door mislukte runs zijn toegestaan. Na restart/restore wordt de sequence niet teruggezet: herstel aan de hand van duurzaam bewaarde staat en de hoogste reeds gereedgemelde sequence. De lokale gereserveerde high-watermark blijft leidend voor nog niet gereedgemelde runs. Als staat verloren is, retentie oude manifesten heeft verwijderd of oude producers nog kunnen schrijven: pauzeer en reconcileer met core plus opslag, trek oude schrijfrechten in en kies pas daarna een sequence boven alle bekende reserveringen/leveringen. Een lege listing is geen toestemming om bij 1 te beginnen.

Een batch-ID bepaalt geen volgorde. Sequence bepaalt de catalogusvolgorde binnen de source, niet directoryvolgorde, UUID of eindtijd. Beschikbare brondatum/versie wordt daarnaast gecontroleerd; ook een nieuwe fetch kan een oude bronversie teruggeven. Dat vereist beoordeling.

Er is in de pilot geen mutable `latest.json` als enige verwijzing. Het ready-prefix bevat de ontdekbare reeks, zodat late uploads geen nieuwere levering onzichtbaar maken.

## 4. Ontdekken en idempotent verwerken

Core inspecteert periodiek de toegelaten ready-prefixen via de opslag-SDK met volledige paginering. De pilot scant de bewaarde manifestreeks per bron en registreert `(source_id, batch_id)` uniek. Listingvolgorde is geen uitvoeringsvolgorde; core sorteert op source-sequence.

Retentie van manifesten én recordsversies is langer dan de afgesproken maximale core-uitval. Python krijgt geen ontvangstbevestiging, dus opslagretentie is onderdeel van de leveringsgarantie. Uitval voorbij die termijn vereist een nieuwe volledige snapshot en een expliciete herstelactie. Een index of opslagnotificatie kan later discovery versnellen; periodieke reconciliatie blijft nodig. Een gepagineerde volledige scan is alleen de pilotkeuze bij gemeten beheersbaar volume.

Core accepteert uitsluitend geconfigureerde source/prefix/scope/recordsoort/contractversie. Het volgt geen willekeurige URL uit het manifest. Cross-sourcekeys, ongeldige paden, onbekende versies, te grote bestanden en ongeldige inhoud worden afgewezen.

Dezelfde batch met dezelfde manifest-/artifactidentiteit wordt overgeslagen of hervat. Dezelfde batch-ID met andere inhoud is een integriteitsconflict. Een dubbele sequence met een andere batch vereist eveneens beoordeling. Oudere sequences worden eventueel `superseded`, maar draaien geen nieuwere publicatie terug.

Na een crash tussen ontvangstregistratie en queuedispatch herplant een periodieke herstelcontrole niet-afgeronde imports. De Laravel-taken blijven idempotent. Er is geen HTTP-completionprotocol nodig.

## 5. Illustratief ready-manifest

Dit is een syntactisch JSON-voorbeeld; IDs, versies en checksum zijn illustratief. De normatieve [schema's en fixtures](data-import-pilot.md#normatief-formaat-en-validatiegrens) leggen verplichte velden en enums vast. Dit voorbeeld is geen gemeten of uploadbaar artifact.

```json
{
  "contract_version": "1.0",
  "batch_id": "batch-example-001",
  "source_id": "source-example-amsterdam",
  "source_sequence": 42,
  "source_config_version": 1,
  "scope_version": 1,
  "mode": "snapshot",
  "record_kind": "municipal",
  "adapter": {"key": "amsterdam.accessible_parking", "version": "0.1.0"},
  "packages": [{"name": "example-source-package", "version": "1.0.0"}],
  "fetched_started_at": "2026-09-08T08:00:00Z",
  "fetched_finished_at": "2026-09-08T08:00:20Z",
  "source_updated_at": null,
  "source_version": null,
  "completeness": {
    "status": "complete",
    "pages_fetched": 2,
    "pagination_exhausted": true,
    "expected_records": null,
    "records_seen": 125,
    "records_filtered_out": 2,
    "records_emitted": 123,
    "records_failed": 0
  },
  "artifact": {
    "key": "sources/source-example-amsterdam/batches/batch-example-001/records.jsonl",
    "version_id": "example-object-version",
    "format": "jsonl",
    "bytes": 45678,
    "record_count": 123,
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

De runner verklaart volledigheid; core toetst aantallen, scope, bronkennis en inhoud. Uitgeputte paginering bewijst geen consistente momentopname als de bron tijdens ophalen verandert. Die beperking wordt in adapter-/bronbeleid vastgelegd. Filterredenen zijn expliciet en aantallen sluiten aan. Een volledige maar onverwacht lege snapshot kan gereedgemeld worden en wordt in core tegengehouden; een technisch mislukte run krijgt geen ready-manifest.

## 6. Illustratief record

Dit voorbeeld is uitgeschreven voor leesbaarheid; in JSONL staat ieder record op één regel.

```json
{
  "external_id": "00123",
  "source_updated_at": null,
  "position": {"latitude": 52.3702, "longitude": 4.8952},
  "geometry_method": "source_point",
  "country_code": "NL",
  "administrative_codes": [],
  "name": null,
  "street": "Voorbeeldstraat",
  "accessible_capacity": 2,
  "access_category": "designated_accessible",
  "orientation": null,
  "restrictions": [],
  "unmapped_fields": [],
  "source_record_url": null
}
```

Minimale regels:

- Externe ID's zijn begrensde niet-lege strings, uniek binnen source en batch. Behoud voorloopnullen; coördinaten zijn geen generieke identiteit.
- Posities zijn eindige WGS84-getallen met expliciete lat/lon, geldige grenzen en passende scope. Bron-CRS en conversie blijven herleidbaar. Een polygonenmiddelpunt is niet automatisch een navigatie-ingang.
- Aantallen zijn niet-negatieve gehele getallen of `null`; onbekend is niet nul. Onderscheid algemene toegankelijke versus persoonsgebonden plekken. Neem kentekens niet mee voor publieke classificatie.
- Records zijn volledige weergaven. Verplichte velden mogen niet ontbreken; `null` maakt een oude bronwaarde onbekend. Onbegrepen veiligheidsrelevante beperkingen blokkeren automatische publicatie.
- Begrens tekst, regellengte, bestandsgrootte en recordaantal. Geen uitvoerbare HTML, credentials of lokale paden. Schemas volgen geen externe netwerkreferenties.
- Buitenlandse administratieve niveaus vragen een expliciete mapping naar de huidige geografische relaties; adapters hardcoden geen interne land-/provincie-ID's.

Offstreetcatalogi krijgen afzonderlijke velden voor voorzieningstype, algemene/toegankelijke capaciteit, ingang en URL. Live `observations` bevatten bronrecord-ID, ophaaltijd, bekende/onbekende waarnemingstijd en afzonderlijke algemene/toegankelijke vrije aantallen. Oudere brontijd overschrijft geen nieuwere meting. Zonder brontijd blijft actualiteit een als zodanig benoemde schatting op basis van ophalen. Een meting voor een onbekende voorziening wacht op een cataloguskoppeling. Deze varianten worden met echte package-output beproefd vóór aansluiting.

## 7. Coreopslag en publicatie

| Verantwoordelijkheid | Invariant |
| --- | --- |
| Datasetregistratie | Toegelaten source/prefix/scope, herkomst, voorwaarden, verwachte leveringsleeftijd en publicatiebeleid |
| Importhistorie | Unieke batch en sequencecontrole; immutable artifactreferentie, verwerkingstijden, status en fout |
| Bronrecordidentiteit | Uniek `(source_id, external_id)` met stabiele verwijzing naar bestaande doeltype/ID |
| Bronrevisie | Alleen inhoudelijke wijzigingen maken een nieuwe revisie; noodzakelijke historie blijft herstelbaar |
| Lokale correctie/besluit | Bronwaarde en geaccepteerde correctie apart, met actor, reden, basisversie en waarnemingsdatum |

Dit zijn opslagverantwoordelijkheden, geen verplichte aparte frameworks. Importstatus: `discovered → validating → awaiting_review | ready → publishing → published`; andere resultaten zijn `failed`, `rejected`, `superseded` en `unchanged`. Deze states beschrijven coreverwerking, niet het externe ophaalproces.

1. Download de exacte recordsversie en verifieer bytes/checksum. De checksum bewijst integriteit, niet bronjuistheid.
2. Valideer in staging en bereken de diff tegenover een expliciete actuele bron-/publicatieversie.
3. Beoordeel eerste import, scopewijzigingen, onverwachte aantallen, verdwijningen en conflicten. Latere normale updates volgen pas na pilotacceptatie een automatisch beleid.
4. Controleer vlak vóór publicatie sequence, basisversie en correctieversie opnieuw. Verouderde diffs worden herberekend/beoordeeld.
5. Publiceer de begrensde pilot in één korte transactie met importstatus en actuele waarden. Taken zijn na commit beschikbaar of worden vanuit duurzame status hersteld.

Geen publieke tussentoestand door chunks alvast te publiceren. Grotere datasets vereisen een loadproef en eventueel versieerbare publicaties met atomair omschakelen. Bestaande bronmodellen, detail- en favorietidentiteit blijven behouden.

Hash genormaliseerde inhoud zonder ophaaltijd en irrelevante volgorde om ongewijzigde records te herkennen. Ongewijzigde snapshots bevestigen controle en aanwezigheid binnen die scope, maar vernieuwen geen brondatum en veroorzaken geen nieuwe publicatie. Veranderde lokale correcties worden onafhankelijk daarvan verwerkt.

Alleen afwezigheid binnen dezelfde complete snapshotscope betekent `missing_from_source`; dit wordt in de pilot beoordeeld en nooit vooraf verwijderd. Een terugkeer behoudt identiteit. Livebezetting en mislukte runs verwijderen geen voorzieningen. Een goedgekeurde lokale veldcorrectie blijft gelden bij herimport; een afwijkende nieuwe bronwaarde registreert een conflict zonder de correctie te wissen.

## 8. Uitval en herstel

| Scenario | Gedrag |
| --- | --- |
| Fetch/parsing mislukt | Geen ready-manifest; foutmelding in importomgeving, core signaleert uitblijvende levering |
| Upload half voltooid | Geen ready-manifest; weesobject na retentie opruimen |
| Manifestupload mislukt na geslaagde bestandsupload | Dezelfde artifactversie opnieuw gereedmelden zonder opnieuw ophalen |
| Records ontbreken/checksum fout | Afwijzen of begrensd opnieuw lezen; niet publiceren |
| Core tijdelijk uitgevallen | Gereedgemelde batches blijven liggen; volledige discovery vindt ze na herstel |
| Batch opnieuw ontdekt | Overslaan of eerdere verwerking hervatten |
| Oude levering arriveert later | Sequence/basisversie voorkomt terugdraaien |
| Twee processors verwerken dezelfde batch | Unieke registratie en transactionele publicatie voorkomen dubbelen |
| Lege/sterk kleinere snapshot | Review; bestaande publicatie blijft staan |
| Crash tijdens publiceren | Transactierollback en herstel vanuit duurzame status |
| Communitycorrectie tijdens import | Versiecontrole en correctiebehoud |

De importomgeving beheert retries/backoff, HTTP-timeouts, bron-429 en totale deadlines. Pilot: maximaal drie pogingen binnen een harde catalogusdeadline van 30 minuten. De [contractproef](data-import-pilot.md#verplichte-pilotlimieten) legt byte-, regel-, record- en validatielimieten vast. Verhogingen vereisen een nieuwe capaciteitsbeslissing. Snapshots halen gemiste tijdsloten niet onbeperkt in; de volgende actuele fetch heeft voorrang. Bezettingsprocessen bouwen evenmin een reeks verouderde meetopdrachten op.

Bronhouderlimieten gelden inclusief package-interne requests. De pilot voert één bronhouder tegelijk uit met pacing en een gedeelde hostlock als beide repos dezelfde aanbieder aanspreken. Meerdere hosts vereisen expliciete coördinatie of exclusieve bronverdeling; extra containers alleen garanderen dit niet.

## 9. Gezondheid zonder aansturing vanuit core

Core toont laatste ontvangen, gevalideerde en gepubliceerde batch apart, met brondatum en verwachte maximale leveringsleeftijd. Uitblijven wordt `overdue`; een oud succes blijft niet onbeperkt gezond.

Directe fetchfouten staan in de logs/meldingen van de importomgeving. Core kan uit afwezigheid niet bepalen of bron, host, credentials of opslag faalt. Geen manifest schrijven om een fout als succes te maskeren. Een statusfeed is alleen een latere uitbreiding als beheer die nodig heeft.

## 10. Contractbewijs

Schemas en fixtures zijn versieerbaar in core en worden door beide importrepos getest. Normale tests gebruiken gesaniteerde fixtures zonder bronnetwerk. Aparte read-only bronprobes bevestigen actuele bereikbaarheid en veldbetekenis.

Minimale gevallen: volledige/lege/incomplete snapshot, nul versus onbekend, voorloopnullen, dubbele ID, ongeldige geo, scopewijziging, late oudere sequence, gewijzigde inhoud onder dezelfde batch-ID, half bestand zonder manifest, ontbrekende objectversie, herontdekking na uitval en herimport na lokale correctie. Handmatig bestand en objectopslag gebruiken dezelfde verwerking. Release pas na gelijke contractinterpretatie in PHP en Python.
