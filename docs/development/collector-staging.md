# Disabled-parking op de Ubuntu-VM

Deze container levert parkeerdata aan R2; core leest die bestanden afzonderlijk in. Docker Engine, de Compose-plugin en Git moeten op de Ubuntu-VM beschikbaar zijn. Voer de commando’s vanuit dezelfde `disabled-parking`-map uit. Gebruik `sudo docker` als jouw gebruiker geen Docker-toegang heeft.

## 1. Repo ophalen

```bash
git clone https://github.com/NIPKaart/disabled-parking.git
cd disabled-parking
```

## 2. Configuratie invullen

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Open in Cloudflare **R2 → nipkaart-imports** en kopieer het EU **S3 API endpoint**. Vul daarnaast de bestaande **Access Key ID** en **Secret Access Key** van het collectortoken in. Dit token heeft **Object Read & Write**, beperkt tot `nipkaart-imports`; gebruik hier geen core-credentials.

```dotenv
R2_ENDPOINT=https://ACCOUNT_ID.eu.r2.cloudflarestorage.com
R2_BUCKET=nipkaart-imports
AWS_ACCESS_KEY_ID=COLLECTOR_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=COLLECTOR_SECRET_ACCESS_KEY
COLLECTOR_INTERVAL_SECONDS=86400
```

Bewaar `.env` privé en commit het bestand niet. Bij een bestaande installatie pas je de bestaande `.env` aan in plaats van die opnieuw te kopiëren. Het collectortoken kan binnen deze bucket ook overschrijven en verwijderen; dat blijft een bekende beperking.

## 3. Starten

```bash
docker compose up -d --build
```

De collector ondersteunt nu **Amsterdam**. Hij draait direct bij starten en wacht na succes 24 uur. Bij een fout probeert hij binnen vijf minuten opnieuw; een mislukte upload behoudt dezelfde levering totdat die is afgeleverd. Compose regelt herstarts en persistente opslag, dus een extra cronjob is niet nodig.

## 4. Upload controleren

```bash
docker compose logs --tail 100 -f collector
```

`Delivered` bevestigt de upload. Met Ctrl-C verlaat je de logs; de container blijft draaien. Controleer daarna of dezelfde levering in core bij de gemeentelijke imports verschijnt. Publicatie blijft handmatig.

## Aansluiting op core

Configureer in de **core-omgeving** dezelfde bucket en hetzelfde EU-endpoint, met aparte core-credentials met **Object Read & Write**, beperkt tot `nipkaart-imports`. Core heeft schrijfrechten nodig om handmatige backenduploads te bewaren; gebruik niet het collectortoken:

```dotenv
MUNICIPAL_DELIVERIES_ENABLED=true
MUNICIPAL_R2_ENDPOINT=https://ACCOUNT_ID.eu.r2.cloudflarestorage.com
MUNICIPAL_R2_BUCKET=nipkaart-imports
MUNICIPAL_R2_ACCESS_KEY_ID=CORE_ACCESS_KEY_ID
MUNICIPAL_R2_SECRET_ACCESS_KEY=CORE_SECRET_ACCESS_KEY
```

Amsterdam moet in core als bron geregistreerd zijn. Vernieuw na configuratiewijzigingen de configuratiecache en herstart de queue-worker. Met de Laravel-scheduler en queue-worker actief ontdekt core iedere vijf minuten nieuwe bestanden. Zie het [intakecontract](data-import-contract.md#core-bucket-intake-1216) voor de bestaande commando’s. Bij DDEV overschrijft de lokale RustFS-configuratie de R2-waarden; zie de [DDEV-aansluiting](data-import-contract.md#local-object-storage-with-ddev).

## Kort beheer

Stoppen:

```bash
docker compose stop collector
```

Bijwerken vanuit de bestaande checkout op de gevolgde branch:

```bash
git pull --ff-only
docker compose up -d --build collector
docker compose logs --tail 100 collector
```

Voer de herstart alleen uit als het ophalen van de update is geslaagd. Compose behoudt het volume. Na uitsluitend gewijzigde credentials in `.env` gebruik je `docker compose up -d --force-recreate collector`.

Bewaar het Docker-volume: gebruik geen `docker compose down -v`. Stel in de private R2-bucket een bewaartermijn van 30 dagen in voor `municipal/nl-amsterdam-parkeervakken-e6a/`.

Heb je eerder met `-p nipkaart-collector-staging` gewerkt, blijf die optie dan gebruiken bij alle Compose-commando’s, zodat je dezelfde container en hetzelfde volume beheert.
