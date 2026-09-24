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
| Correcties uitbreiden | core #1218 | Voorstellen, beoordeling, herimport en intrekken werken voor gemeentelijke en offstreetcatalogusrecords. Eerst gemeentelijke acceptatie voor #1220, daarna offstreetacceptatie; zie de twee checkpoints hieronder. |
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

Uitwerking van 2026-09-24; dit beschrijft te bouwen en te toetsen gedrag. De [algemene bijdrageafspraken](../product/data-foundation.md#91-algemene-bijdrageafspraken) onder #1175 blijven een voorstel. #1218 is de toepassing op bestaande `ParkingMunicipal`- en `ParkingOffstreet`-records, niet alleen op gemeentelijke uploads en niet op de volledige communitylevenscyclus.

### Twee acceptatiemomenten zonder circulaire afhankelijkheid

1. **Gemeentelijke correcties:** de bestaande intake uit #1215 koppelen aan voorstellen, beoordeling, expliciete veldcorrecties en intrekken. Bewijs de volledige correctie-/herimportflow en de toepasselijke rechten-/bewaarafspraken. Dit is het correctiecheckpoint voor de gemeentelijke ketenacceptatie in #1220; die wacht niet op offstreet.
2. **Offstreetcataloguscorrecties:** dezelfde gebruikersbetekenis toepassen op statische voorzieningsinformatie, met eigen veldvalidatie en bronmodel. Integreer en bewijs herimport bij offstreet-parking#656 en de bijbehorende corecatalogusintake onder #1177. #1218 sluit pas wanneer beide typen zijn geaccepteerd.

Offstreet-parking#656 volgt volgens de huidige planning op de gemeentelijke ketenacceptatie in #1220. Daarom betekent de verwijzing van #1220 naar #1218 het eerste checkpoint en niet sluiting van het hele issue. #1221 behandelt uitsluitend geordende bezettingswaarnemingen en is geen vervanging voor de catalogusintake. Die offstreetintake en bronwaardeopslag bestaan nog niet in de huidige gemeentelijke importservice; maak de corezijde een expliciete oplevering bij #656/#1177. Er wordt geen reeds werkend offstreetherimportpad aangenomen.

### Veldkeuze en identiteit

| Doel | Eerste correctievelden | Buiten handmatige veldcorrecties |
| --- | --- | --- |
| `ParkingMunicipal` | Straat, nullable aantal volgens bronbetekenis, oriëntatie en weergegeven locatie. De oorspronkelijke brongeometrie blijft apart behouden. | Bron-/dataset-ID, datum van bronophaling, publicatiestatus, persoonlijke reserveringen en verzonnen individuele vakken uit een broncapaciteit. |
| `ParkingOffstreet` | Naam, voorzieningstype, website en weergegeven locatie. Validatie en betekenis vastleggen bij de geselecteerde catalogusbron. | Live vrije plaatsen, feedstatus, waarnemingstijden, automatische claims over toegankelijkheid en algemene capaciteit als toegankelijke capaciteit. Prijzen en capaciteitscorrecties krijgen pas een veldkeuze na een afzonderlijk gevalideerd contract. |

Verdwenen/onbruikbare locaties en dubbelen zijn meldingen die een afzonderlijk moderatiebesluit vragen; een veldvoorstel kan niet rechtstreeks publiceren, verwijderen of zichtbaarheid wijzigen. Correcties blijven gekoppeld aan het bestaande brongekwalificeerde doel. Een inhoudelijk gelijk record uit een andere bron krijgt niet automatisch dezelfde correctie. Favorieten en detailverwijzingen behouden hun doel-ID bij wijzigen, verbergen en herstellen.

### Voorstellen en besluiten

Een voorstel bevat het doeltype en bestaande doel-ID, gewijzigde velden met onderscheid tussen onbekend en nul, de eerdere waarden/basisversie, reden, waarnemingsmethode, bekende waarnemingsdatum of expliciet onbekend, serverregistratietijd en de versie/acceptatie van de toepasselijke bijdragevoorwaarden. Een onbekende waarnemingsdatum wordt nooit aangevuld met de indien- of importdatum. De basisversie omvat de relevante bron- en correctiestaat; hetzelfde veld terugzetten naar een eerdere waarde maakt een oud voorstel niet opnieuw geldig.

Een bevoegde beoordelaar ziet eerdere, actuele en voorgestelde waarden plus onderbouwing. Goedkeuren of afwijzen vereist een reden en registreert actor, tijd en gebruikte basisversie. Een indiener kan de eigen bijdrage niet goedkeuren. Hergebruik `pending`, `approved` en `rejected` waar de betekenis overeenkomt; leg intrekking/vervanging vast als aparte gebeurtenissen zonder de oorspronkelijke beslissing te overschrijven. Een verouderd voorstel vraagt een nieuwe vergelijking en zo nodig een nieuw voorstel; het wordt niet stilzwijgend herbaseerd. Een afwijzing verandert geen parkeerwaarden.

### Bronwaarden, herimport en intrekken

Bewaar de actuele geaccepteerde bronwaarden, actieve lokale veldcorrecties en de daaruit volgende publieke waarden afzonderlijk. Een geaccepteerde bronupdate kan nieuwe bronwaarden opslaan terwijl een actieve correctie publiek blijft gelden; afwijkende waarden komen als conflict in de beoordeling. Voor bestaande handmatige verschillen zonder expliciete correctiegeschiedenis blijft de conservatieve blokkade uit #1215 gelden. Verzin bij omzetting geen auteur, waarnemingsdatum of historisch goedkeuringsbesluit.

Voorbeeld: bron zegt twee, correctie zegt één. Een nieuwe bronwaarde drie blijft afzonderlijk bewaard, de getoonde waarde blijft één en het conflict vraagt aandacht. Bij intrekken wordt drie zichtbaar, niet de oorspronkelijke twee. Zegt de bron tijdelijk ook één en later weer twee, dan blijft de expliciete correctie één gelden totdat zij wordt ingetrokken of vervangen.

Intrekken gebruikt de actuele geldige bronwaarde en bewaart reden, actor, tijd, basisversie en betrokken velden. Het maakt geen oudere lokale correctie opnieuw actief. Is geen geldige bronwaarde beschikbaar, dan volgt expliciete beoordeling in plaats van een verzonnen terugval. Een privacyverzoek verwijdert zo nodig persoonsgegevens via de algemene regeling; het is geen stilzwijgend besluit over de inhoudelijke parkeerwaarde.

Indienen, beoordelen, intrekken en publiceren van imports controleren dezelfde actuele recordversie en gebruiken een consistente transactie-/vergrendelvolgorde. Verouderde reviews worden geweigerd; fouten laten zowel de publicatie als de correctiegeschiedenis ongewijzigd. Een import zonder inhoudelijke wijzigingen wijzigt geen waarnemingsdatum en verlengt geen bewijsretentie.

### Benodigde acceptatie per type

- Eerste voorstel, goedkeuring, afwijzing en intrekking via echte geautoriseerde endpoints; ongeautoriseerde acties en zelfgoedkeuring geweigerd.
- Ongewijzigde en gewijzigde herimport, bron gelijk aan correctie en later weer afwijkend, meerdere voorstellen voor hetzelfde veld, vervangen/intrekken en gelijktijdige import/review met verouderde basisversies.
- Behoud van favoriet-/detailidentiteit bij gewijzigde en ontbrekende bronrecords, onzichtbaarheid en herstel; ontbrekende records veroorzaken geen automatische verwijdering.
- Publieke responses tonen alleen effectieve waarden en veilige herkomst. Onderbouwing, accountgegevens, interne configuratie en bronpayloads blijven afgeschermd. Bronvelden en tijdstempels houden hun eigen betekenis.
- Toetsenbord- en telefoonproef van indienen, foutmeldingen, vergelijking, besluit en intrekken; een kaart is niet vereist om de taak af te maken.
- Vastgestelde voorwaarden en uitvoerbaar bewaren/verwijderen, inclusief accountverwijdering, identificerende vrije tekst, bewijs van voorwaardenacceptatie en herstel van een back-up met reeds verwijderde gegevens. Bewijs apart van gewone CI vastleggen.

Een generieke correctie-engine voor toekomstige bronnen, foto's, karma en een publieke bulk-API zijn geen voorwaarden. Bouw alleen de gedeelde logica die beide concrete bronmodellen nodig hebben; hun tabellen en betekenis blijven afzonderlijk.

## Verificatie

Gewone CI gebruikt kleine offline voorbeelden. Tests richten zich op mapping en verliesrisico's, integriteit en veilige verwerking. Parser/paginering wordt in de universele package getest; geen fixturecorpus van alle gemeenten in disabled-parking.

Naast offline CI komt in #775 een periodieke begrensde live controle: endpoint, verwacht responsetype/velden, identiteit en volledigheid. Een HTTP 200 alleen is onvoldoende. Een gewijzigde API of semantisch onvolledige package-output mag geen nieuwe geldige levering opleveren. Houd deze brongezondheid apart van package-unit-tests; een upstream storing maakt niet iedere code-PR rood. Frequentie en meldingen worden bij automatisering gekozen.

Een begrensde live bronproef wordt afzonderlijk vastgelegd met packageversie, selectie, aantallen, omvang, tijd en concrete beperkingen. Daarna bewijst #1215 een daadwerkelijke lokale intake. #1220 bewijst later de automatische keten, inclusief uitval/herstel. Geen checkboxes afvinken op basis van uitsluitend een prototype.

Volg [quality-checks.md](quality-checks.md) tijdens implementatie. Deze documentatie op zichzelf wijzigt geen applicatiegedrag en vereist geen databaseproef.
