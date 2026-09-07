# PostgreSQL 18 and PostGIS

This implements [#1180](https://github.com/NIPKaart/core/issues/1180). PostgreSQL 18 with PostGIS 3.6 is the NIPKaart application database baseline. DDEV supplies `pdo_pgsql` and installs the PostgreSQL 18 backup client. CI uses `postgis/postgis:18-3.6` with PHP 8.4 and 8.5.

## Fresh-start decision

On 2026-09-07, the project owner explicitly chose a fresh database instead of retaining or transferring existing MySQL data. Work package C's legacy transfer/row-reconciliation requirement is therefore superseded by a validated fresh install. This PR does not claim that any historical production/community data was migrated. Existing local MySQL volumes have not been deleted by the implementation work.

Before deployment, confirm the chosen environment is intended to start empty. Provision a new PostgreSQL database, enable PostGIS, configure the app and workers, migrate, seed baseline reference/permission data, then import any newly selected sources and rebuild search. Keep the previous release and database available until the new deployment is accepted. Reverting after new PostgreSQL writes requires deciding how to preserve those writes; changing connection settings alone is not a data reconciliation strategy.

## Fresh development environment

For a new checkout without an existing DDEV database:

```sh
cp .env.example .env
ddev start
ddev composer install
ddev artisan key:generate
ddev artisan migrate
ddev artisan db:seed
ddev test
```

DDEV manages Laravel's local connection settings (`pgsql`, host `db`, port `5432`, database/user/password `db`). Changing the DDEV database type does not convert a MySQL volume. Use a new environment or deliberately reset a disposable old environment; a MySQL SQL dump cannot be imported directly into PostgreSQL.

`ddev test` creates the dedicated `nipkaart_test` database and clears cached configuration before running Pest. PHPUnit clears `DB_URL` and fixes the connection and database name to avoid accidentally selecting the application's database. For host execution, supply `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` for the test server before running `vendor/bin/pest`.

The default CountrySeeder/ProvinceSeeder are fresh-install seeders, not data transfer or recovery tools. They delete reference rows and ProvinceSeeder depends on the initial country IDs. Do not rerun them on a populated database. CI also exercises the existing municipal and offstreet sample seeders after the baseline seed. This repository currently contains no provider-specific dataset importer; CI exercises the available sample seeders.

## Database schema

The first parking-table migration runs `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public`. PostGIS packages must already be installed. With restricted deployment roles, ask the database administrator to enable the extension before running migrations. Rolling back application migrations deliberately retains the extension; Laravel excludes `spatial_ref_sys` from `migrate:fresh`.

Existing Laravel schema types compile on PostgreSQL: enums use string/check constraints, UUIDs retain their type, JSON remains JSON, `ipAddress` becomes `inet`, and foreign IDs and incrementing keys use compatible bigint types. PostgreSQL does not enforce Laravel's unsigned modifiers; existing permission keys and queue counters do not rely on MySQL unsigned casts. There are no raw MySQL DDL statements, SET columns, custom collations or MySQL JSON indexes in the migrations.

Two initial-schema fixes ensure real relationships: favorites use string target IDs for community UUIDs and opaque municipal/offstreet IDs; confirmations use `foreignUuid` so their intended foreign key and cascade are created. Notification filters use PostgreSQL JSON extraction and literal category-prefix matching. Stock Laravel connection definitions remain to avoid unrelated configuration removal; only PostgreSQL/PostGIS is exercised and supported by the application migrations and queries.

## Spatial representation

The three existing parking-table migrations directly create a stored, generated `geography(Point,4326)` location and two GiST indexes: geography for radius queries, and a geometry expression for exact rectangular viewports. Coordinates are checked against valid latitude/longitude ranges before generating the point. PostGIS X/Y order is explicitly longitude, latitude.

The existing scalar columns remain the only writable coordinates during the current API/import transition. PostgreSQL derives `location` for every insert/update, including bulk/query-builder writes. There are no independently writable duplicate locations or model-event synchronization requirements. The generated column is hidden from model JSON. A future change may reverse the interface and derive scalars from a writable spatial point, but must migrate all scalar writers together.

## Query API

All three parking models expose:

```php
$origin = new GeoPoint(latitude: 52.37, longitude: 4.9);
ParkingMunicipal::withinRadius($origin, 500)->nearestTo($origin)->get();
ParkingMunicipal::inViewport(new GeoBounds(west: 4.8, south: 52.3, east: 5, north: 52.4))->get();
```

`ST_DWithin` filters in metres using the geography index; `ST_Distance` returns spheroidal metre distances. Equal distances are ordered by ID. Viewport bounds include their boundary and can cross the antimeridian (`west > east`). Invalid coordinates, radii and result limits are rejected. Model scopes do not impose public visibility rules, so admin uses remain possible; the admin nearby-space views now use the exact PostGIS distance primitive.

`App\Services\ParkingDiscovery` combines all three sources for `withinRadius` and `inViewport`, with a bounded result limit. It returns `key` (source-qualified ID), original `id`, `source`, title, numeric coordinates, and distance in metres when applicable. It excludes pending/rejected/soft-deleted community spaces and invisible municipal/offstreet spaces. Ordering is deterministic across sources. #1169/#1170 can add their endpoint, filters and richer read-model fields on this service without merging persistence models. The source model remains authoritative for restrictions, provenance and availability semantics.

For #1176, coverage polygons can use `geometry(MultiPolygon,4326)` and a GiST index, intersecting `location::geometry` without another database change. No speculative dataset/polygon tables are introduced here; their domain model remains with #1176.

## Backups and derived search

Spatie backups use the configured PostgreSQL connection and verify that generated archives can be opened and contain files. Every backup worker needs a client matching the PostgreSQL server major version. A restore target must have PostGIS packages. Archive verification alone does not prove database restorability.

A one-time native dump/restore rehearsal succeeded locally and in [CI on 2026-09-07](https://github.com/NIPKaart/core/actions/runs/34133702813). It compared every public table's row count and verified the three generated parking columns and a known SRID-4326 point. This is migration evidence; there is no permanent backup/restore script or CI job in the project.

```sh
pg_dump --format=custom --no-owner --no-acl --file=nipkaart.dump "$SOURCE_PG_URL"
createdb --maintenance-db="$ADMIN_PG_URL" nipkaart_restore
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_PG_URL" nipkaart.dump
```

Meilisearch is derived data. A one-time rehearsal rebuilt the three parking indexes from PostgreSQL, verifying public IDs and coordinates. The new Scout regression test and disposable CI service were removed at the owner's request; permanent coverage is deferred to the planned Pest 5 work.

For a fresh application deployment, configure `SCOUT_DRIVER=meilisearch`, the host/key and worker settings, then run `php artisan scout:import` separately for `App\Models\ParkingSpace`, `App\Models\ParkingMunicipal` and `App\Models\ParkingOffstreet`. Wait for asynchronous Meilisearch tasks and inspect failures before treating search as ready.

## Validation and deployment boundary

Local validation includes fresh DDEV/PHP 8.4/PostgreSQL 18.4/PostGIS 3.6 startup, all 15 migrations, baseline/sample seeders, SQL-coordinate derivation, radius/distance/viewport behavior, mixed-source visibility, real GiST query-plan use, native backup/restore and real Scout rebuilds. CI runs the existing test suite against PostgreSQL. The newly introduced spatial, relationship, notification and Scout regression tests were removed at the owner's request; the earlier successful runs remain implementation evidence, not ongoing regression coverage. Remote CI and review status are reported on the PR.

This is a tested implementation, not a production deployment. Production provisioning, enabling PostGIS with the actual role, choosing newly imported datasets, configuring the backup destination/retention, and application rollout remain operational actions. No historical-data transfer is required under the fresh-start decision.

## DDS reference and sources

The lint/test workflows follow [DDS Platform at 27ae3a2](https://github.com/dutchdronesquad/dds-platform/tree/27ae3a222e86d1c891a97c42ff739c66ac00a686): pinned actions, PHP 8.4/8.5 and coverage reporting. NIPKaart retains its branch triggers and npm cache and adds PostgreSQL/PostGIS, migration/seed checks. DDS-specific Rector/PHPStan/browser steps are omitted because these tools/suites are absent here; its 95% coverage target is not imposed on this existing suite. Feature tests disable SSR/Vite integration and reject unexpected HTTP requests. PostgreSQL remains the test database rather than DDS's SQLite.

DDS's dedicated backup disk, mandatory encrypted backup command and production-only run/monitor/cleanup schedules are a reference for the later operational rollout. No remote backup destination or scheduler was activated here.

- [DDEV supported databases](https://docs.ddev.com/en/stable/users/extend/database-types/)
- [PostGIS activation](https://postgis.net/documentation/getting_started/)
- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [PostgreSQL generated columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)
