# Batchimports: uitvoering en beheer

Status: uitvoering van het KISS-plan uit [core #1176](https://github.com/NIPKaart/core/issues/1176). De [pilotbeschrijving](data-import-pilot.md), [leveringsafspraak](data-import-contract.md) en [techstack](data-foundation-stack.md) geven de concrete eerste stap. Geen productie-import of infrastructuur is door deze documentatie geactiveerd.

## Werkvolgorde

| Stap | Issue | Klaar wanneer |
| --- | --- | --- |
| Voorbereiding | disabled-parking #778 | Afgerond met gemergede #779 (uv), #780 (SQL-verwijdering) en #781 (klein voorbeeld). Dit bewijst nog geen live aansluiting. |
| Bron en bestand | core #1214 | Eén bruikbare bron, hergebruikbewijs, betekenis, beperkingen, voorbeeldrij en voorlopige levering zijn beschreven. |
| Live export | disabled-parking #774 | Eén commando haalt die bron volledig via de package op en schrijft het afgesproken bestand; failures behouden de vorige geldige export. |
| Handmatige keten | core #1215 | Werkelijke eerste en herhaalde levering beoordeeld verwerkt, met veilige wijzigingen, ontbrekende records en correctiebehoud. |
| Opslagbesluit | core #1217 | Provider, regio, kosten, rechten, retentie en veilige voltooiing van een upload zijn gekozen en getest vóór inzet. R2 blijft kandidaat. |
| Automatisch leveren | disabled-parking #775 | Een geplande eindige uitvoering uploadt hetzelfde bestandsformaat naar de private bucket. |
| Automatisch ontvangen | core #1216 | Core ontdekt complete bestanden en gebruikt hetzelfde intakepad als bij de lokale proef. |
| Correcties op imports | core #1218 | Afgerond: bronleidende herimport en beheerzichtbaarheid voor gemeentelijke en offstreetcatalogusrecords, zonder override- of voorstelsysteem; zie de sectie hieronder. |
| Actualiteit | core #1219 | Ontvangst, publicatie, brondatum en uitblijvende leveringen zijn afzonderlijk zichtbaar. |
| Ketenacceptatie | core #1220 | De automatische stagingketen, herstel en correctie/herimport werken samen. |
| Tweede bron | disabled-parking #776 | Een tweede Europese bron bewijst hergebruik na de eerste ketenacceptatie. |
| Offstreet | offstreet-parking #656/#657, core #1221 | Eerst catalogus, daarna afzonderlijke bezettingsbetekenis en passend ritme. |

Issues behouden hun eigen acceptatiecriteria. Een merge van een voorbeeld, groene CI of bereikbare endpoint bewijst geen volledige dataset of beoordeelde publicatie.

## Eerste werkende keten

1. Leg in core één toegelaten dataset vast met bronhouder, licentie/attributie, vaste selectie, geografische mapping en publicatiebeleid. Brononderzoek gebeurt buiten het platform; geen CRM bouwen.
2. Laat de universele package de bron begrijpen en volledig ophalen. Generieke endpoint-, parser- en pagineringsfixes horen daar; NIPKaart-velden niet.
3. Laat disabled-parking de bronobjecten vertalen naar één begrensd JSON-bestand met identiteit, ophaaltijd en onderbouwde volledigheid.
4. Laat core het bestand valideren en verschillen tonen vóór publicatie. Eerste publicatie wordt beoordeeld; gewone bestandsintake publiceert niets vanzelf.
5. Bewijs herhaling, wijziging, oudere/incomplete/lege levering, ontbrekend record en geaccepteerde correctie. Identiteit en bestaande verwijzingen blijven behouden.

#774 vervangt `municipal-records-draft`, onvoorwaardelijke null-metadata en achterhaalde voorbeeldcode. #1215 vervangt of verwijdert de schemas en validator uit #1222 zodra het echte intakepad ze opvolgt. Eén actief formaat, geen parallelle compatibiliteitslaag. Een lokale export en kleine offline tests blijven nuttig.

## Automatisering na de handmatige proef

`gemeentelijke API → universele package → collector → private bucket → core intake/review → PostgreSQL/PostGIS → publieke discovery`

De bucket is de afgesproken automatische overdracht. De collector heeft geen coretoken of databaseverbinding en blijft verantwoordelijk voor ophaalplanning. Core verwerkt leveringen en beheert beoordeling en publicatie.

Begin met één geplande eindige uitvoering en maximaal één actieve ophaling per dataset. Stel deadlines en beperkte retries in; houd rekening met bronlimieten. De implementatie van host/timer, uploadvoltooiing en herstel hoort bij #775/#1217. Geen verplicht manifest, version-ID, gedistribueerde teller of permanente runnerstaat zonder aantoonbare behoefte.

Automatische discovery gebruikt dezelfde validatie en importservice als de lokale proef. Een half bestand mag niet als complete levering worden verwerkt. Herontdekking is veilig, een oudere levering overschrijft geen nieuwere publicatie en een conflict omzeilt geen eerder besluit. Automatisch ontvangen betekent niet automatisch alle wijzigingen publiceren.

## Beheer en herstel

| Gebeurtenis | Actie |
| --- | --- |
| Bronfout of onvolledige selectie | Geen nieuwe geldige export afleveren; bestaande publicatie blijft staan. |
| Uploadfout | Hetzelfde geproduceerde bestand met dezelfde delivery-ID opnieuw proberen; geen tweede fetch voorstellen als dezelfde levering. |
| Core-uitval | Complete bestanden later opnieuw ontdekken; eerder ontvangen en afgeronde leveringen herkennen. |
| Onjuiste of verdachte levering | Publicatie blokkeren en beoordelen; niet automatisch bestaande records verwijderen. |
| Bron botst met lokale correctie | Bronwaarde afzonderlijk bewaren; correctie behouden en conflict tonen. |
| Gecompromitteerde collector | Rechten intrekken, ophaling en intake voor die dataset pauzeren en betrokken leveringen beoordelen. |
| Foute publicatie | Een nieuw herstelbesluit met behoud van actuele communitycorrecties; geen oude database over nieuwe bijdragen terugzetten. |

Core toont wanneer iets is ontvangen, gevalideerd en gepubliceerd. Een verwerkingsdatum is geen veldwaarneming. De collector meldt fetch-/uploadfouten; core kan zonder aanvullende status alleen zien dat een levering uitblijft. Een apart monitoringplatform of statusfeed is geen pilotvoorwaarde.

Vóór staging: keuze voor host/bucket, scoped rechten, harde grenzen en budget. Vóór productie: retentie, maximaal te overbruggen uitval, herstelproef, attributie en beheerrechten. Private opslag beschermt de operatie; de voorwaarden van iedere bron blijven gelden. Publieke discovery blijft begrensd en vraagt geen account voor basisgebruik.

De [fresh-start-afspraak](postgresql.md#fresh-start-decision) blijft gelden. Geen verplichte historische MySQL-transfer. Productiejobs uitschakelen of een nieuwe dienst activeren is een afzonderlijke deploymentactie.

## Correcties op geïmporteerde records (#1218)

Vastgesteld op 2026-09-29. Het eerdere ontwerp met voorstellen, beoordeling en intrekken van veldcorrecties is vervallen als bouwopdracht. Bronnen blijven leidend; imports werken bronfeiten bij na beoordeling, en beheer bepaalt alleen de zichtbaarheid. De [algemene bijdrageafspraken](../product/data-foundation.md#91-algemene-bijdrageafspraken) onder #1175 gelden pas wanneer bijdragers correcties op geïmporteerde records mogen indienen; dat gebeurt nu niet.

| Doel | Vastgesteld gedrag |
| --- | --- |
| `ParkingMunicipal` | Geaccepteerd in #1220. Bronidentiteit, favorieten en één kaartmarkering per record blijven behouden; ontbrekende capaciteit blijft onbekend. De oorspronkelijke geometrie blijft bewaard en automatische reparaties worden expliciet beoordeeld; een latere geldige brongeometrie vervangt de afleiding. |
| `ParkingOffstreet` | De catalogus (`nipkaart-offstreet-catalog-3`) levert alleen naam, voorzieningstype en locatie. De collector normaliseert bronnamen (`P-104_ Amsterdam Centraal (opendata)` → `Amsterdam Centraal`); een onjuiste naam, type of locatie wordt in de collector of bij de bron opgelost, niet met een override in core. Capaciteit, vrije plaatsen en status komen uit de waarnemingen (#1221) en worden nooit handmatig overschreven. |

Voor beide typen geldt:

- Alleen beheerders met `parking-municipal.update` of `parking-offstreet.update` kunnen een locatie verbergen en weer tonen; zichtbaarheid blijft behouden bij gewijzigde en ongewijzigde herimport.
- Herimport behoudt ID's, favorieten en detailverwijzingen. Een ontbrekend record wordt niet automatisch verwijderd.
- Een lokaal afwijkend veld blijft staan. Wijzigt de bron datzelfde veld naar een andere waarde, dan blokkeert publicatie totdat het verschil is opgelost. Bronwaarden (`source_record`, `last_imported_values`) blijven apart van de getoonde waarden.

Er is geen beheerscherm voor veldcorrecties en geen correctievoorstel door bijdragers. Komt daar met een concrete bron een aantoonbare noodzaak voor, dan is dat een nieuw issue onder #1175. Communitytoevoegingen, -correcties en -bevestigingen van `ParkingSpace` blijven een aparte levenscyclus.

### Bewijs

- Gemeentelijk: `MunicipalImportTest`, `ImportedParkingAdminTest`, `ParkingDiscoveryTest` en `DomainContractsTest` (86 geslaagd op 2026-09-24).
- Offstreet: `OffstreetImportTest` en `ImportedParkingAdminTest` (25 geslaagd op 2026-09-29), met records uit de echte Amsterdamse catalogus. De eerste echte levering van `nl-amsterdam-garages` (47 records) is via R2 ontdekt, beoordeeld en gepubliceerd onder #1250.

Dit is lokaal en stagingbewijs, geen productieactivering.

## Verificatie

Gewone CI gebruikt kleine offline voorbeelden. Tests richten zich op mapping en verliesrisico's, integriteit en veilige verwerking. Parser/paginering wordt in de universele package getest; geen fixturecorpus van alle gemeenten in disabled-parking.

Naast offline CI komt in #775 een periodieke begrensde live controle: endpoint, verwacht responsetype/velden, identiteit en volledigheid. Een HTTP 200 alleen is onvoldoende. Een gewijzigde API of semantisch onvolledige package-output mag geen nieuwe geldige levering opleveren. Houd deze brongezondheid apart van package-unit-tests; een upstream storing maakt niet iedere code-PR rood. Frequentie en meldingen worden bij automatisering gekozen.

Een begrensde live bronproef wordt afzonderlijk vastgelegd met packageversie, selectie, aantallen, omvang, tijd en concrete beperkingen. Daarna bewijst #1215 een daadwerkelijke lokale intake. #1220 bewijst later de automatische keten, inclusief uitval/herstel. Geen checkboxes afvinken op basis van uitsluitend een prototype.

Volg [quality-checks.md](quality-checks.md) tijdens implementatie. Deze documentatie op zichzelf wijzigt geen applicatiegedrag en vereist geen databaseproef.
