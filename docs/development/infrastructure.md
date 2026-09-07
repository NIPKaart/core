# Infrastructure audit (#1166)

Audit date: 2026-09-07. NIPKaart is not yet in production. Laravel 13/PHP 8.4 compatibility is checked through the locked dependencies and quality gates.

## Decisions and consumers

| Integration | Decision and evidence |
| --- | --- |
| Scout/Meilisearch | Removed under #1195. PostgreSQL directly searches published parking records; no synchronized search service remains. |
| Sanctum | Removed with owner approval: no external consumer exists. Package, config and `/api/user` are removed. Fortify/session authentication and the web/throttled parking APIs remain. The historical token-table migration is retained to preserve migration history. |
| Reverb/Echo | Keep and connect with owner approval. Five community-space notifications use database and broadcast channels. The previously unused hook now runs in app/frontend/map layouts, once per layout instead of in each responsive bell. |
| Log Viewer | Keep. UI/API require a non-suspended administrator. Tests cover guests, ordinary users and suspended administrators. Set `LOG_VIEWER_ENABLED=false` to disable all access. |
| Clockwork | Explicit local opt-in via `CLOCKWORK_ENABLE=true`. Other environments disable collection, API and UI even with debug and collect-always environment flags enabled. |
| Spatie Backup | Keep; prepare the DDS-style encrypted database/S3 pattern below. Scheduling is disabled by default. |
| Redis | Optional backing service for cache/queue/session or multi-server Reverb scaling. Current defaults use database cache/queue/session; Reverb scaling is off. No direct application Redis use was found. DDEV Redis/RedisInsight are optional tooling, not an application prerequisite. |

## Parking search audit and replacement (#1195)

`GET /api/search` is parking-record search, used by `searchApi` / `useSearchQuery` and the shared search overlay in public and authenticated layouts. It returns parking labels, source identity, links and coordinates. No current consumer resolves an arbitrary destination/address to coordinates, uses Meilisearch geo filtering, requests facets or supplies a custom ranking configuration. Destination resolution remains #1169: select a geocoding provider there, then pass coordinates to `ParkingDiscovery` for exact PostGIS radius/viewport queries. Parking records are not an address gazetteer.

| Previous consumer or behavior | Replacement |
| --- | --- |
| SearchController multi-index request | `ParkingTextSearch` queries the actual source tables with a SQL union and live municipality/province joins; no copied search tables/documents. |
| Community street/city/postcode/suburb/neighbourhood/amenity/description | Case-insensitive token matching against those same columns. |
| Municipal street/municipality/province; offstreet name/URL/municipality/province | Same fields queried directly, including current related names. |
| Prefix completion and automatic typo tolerance | Literal case-insensitive partial matching; alphabetic tokens of at least five characters also accept `pg_trgm` word similarity of at least 0.6. Every free-text token must match. This is a defined PostgreSQL replacement, not a promise of identical engine ranking. |
| `City, text` | Exact case-insensitive community city or imported municipality filter, with text matching independently. |
| Dutch postcode | Normalized exact community postcode filter, accepting spaced/compact and mixed-case input. With additional text, imported records still search that text without a postcode filter; a postcode alone returns community records only, avoiding unrelated imported results. |
| Result labels, coordinates and navigation | Existing `hits` envelope and `index` compatibility field (now the fixed source table name), type, opaque ID, label/sub, href, numeric lat/lng and score. No environment-dependent prefix. |
| Ranking and limits | Exact phrase matches first, then word similarity, label, source and ID. At most twice the clamped 1–20 limit, globally ordered; total is an exact count of matching published records in the same SQL snapshot. Query length is capped at 200 characters. |
| Searchable traits, naming, eligibility and serialization on three models | Removed. Approved/non-deleted community and visible imported records are filtered in SQL on each request. Writes, bulk operations, restore/delete and geography edits require no indexing callbacks. |
| Scout and Meilisearch PHP packages | Removed from manifest/lockfile; no other application consumer remains. |
| SCOUT/MEILISEARCH configuration and test/CI overrides | Removed, including `config/scout.php` and `.env.example` settings. Old local/deployment environment values can be discarded. |
| DDEV service and addon manifest | Removed. Existing installations can reconcile containers on their next normal DDEV restart; this code change does not delete existing service volumes. |
| `search:configure`, import/flush/rebuild and infrastructure probes | Removed; database restore is sufficient. Infrastructure verification retains the encrypted PostgreSQL/PostGIS backup/restore drill. |
| Search, domain and infrastructure tests | Real PostgreSQL endpoint coverage replaces client/engine mocks; model JSON and visibility contracts remain covered. |

`pg_trgm` is justified by the existing autocomplete's typo-tolerant matching, using PostgreSQL's [word similarity function](https://www.postgresql.org/docs/current/pgtrgm.html). The migration enables it in `public`; a restricted deployment role needs an administrator to enable it beforehand. Rollback retains the shared extension, like PostGIS. No speculative full-text/trigram indexes or synchronized search projections are added: the current query joins related names and uses an explicit similarity threshold. This baseline can scan published rows and sort matches; benchmark representative production-sized data before choosing an indexable query/index strategy. Existing spatial GiST indexes continue serving exact discovery.

Boost removes the generated Scout skills and its selection after package removal; generic locally cached skills are not runtime consumers. Historical audit observations remain historical and are superseded by this decision.

## Live notifications and occupancy

Set `BROADCAST_CONNECTION=reverb` and matching nonempty `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`. Supervise a queue worker and `php artisan reverb:start`. Backend `REVERB_HOST/PORT/SCHEME` identify the publishing endpoint; `VITE_REVERB_HOST/PORT/SCHEME` identify the browser-reachable endpoint. Rebuild assets after Vite changes. DDEV exposes Reverb on port 8080.

Echo connects lazily for an authenticated layout with a configured public key. It subscribes to private `App.Models.User.{id}`, reloads only shared notification props, and releases the matching channel on cleanup. Both responsive bells consume the refreshed props. Existing private-channel tests reject another user's channel; frontend tests cover guest/config guards, notification reload and cleanup.

Before deployment acceptance, test real delivery with two signed-in accounts: the intended account's bell updates without navigation, the other account receives nothing, and logout/navigation releases the subscription. A real browser-to-Reverb delivery check is separate from the automated dispatch/channel/effect tests.

Garage controllers currently read stored occupancy/capacity and `api_state`. No upstream occupancy ingestion or scheduled polling implementation was found. Future work must establish source, timestamps, update interval, stale-data handling and general-versus-accessible capacity before choosing polling/push. Existing notification broadcasts do not decide the garage architecture.

## Backup reference and deployment gates

Reference: the current DDS Platform repository's `routes/console.php`, `config/backup.php` and `config/filesystems.php`; production execution was not inspected. NIPKaart adopts a separate S3-compatible backups disk, required archive password, database-only job, monitoring, cleanup and retention defaults. No current upload workflow was found. Future uploads/object storage need their own backup contract. Git, `.env` and application keys are excluded; preserve deployment secrets and the original `APP_KEY` separately for encrypted fields.

Before enabling `BACKUP_ENABLED=true` in production:

1. Provision a private bucket and scoped `BACKUP_AWS_*` credentials/endpoint. Store `BACKUP_ARCHIVE_PASSWORD` separately from the backup destination.
2. Set `BACKUP_NOTIFICATION_EMAIL` to the operator and verify mail delivery.
3. Install a server-compatible PostgreSQL dump client and ZipArchive AES-256 support. The S3 adapter is included in Composer.
4. Run Laravel's scheduler every minute and use a shared supported cache for its single-server/overlap locks (database cache is supported).
5. Run `backup:run-encrypted`, download the bucket archive and complete an isolated restore. Verify monitoring and cleanup.

Enabled production schedules run backup at 01:30 UTC, monitor at 03:00 UTC and cleanup at 03:30 UTC. DDS retention defaults: all backups for 7 days, daily for 30 days, weekly for 8 weeks, monthly for 12 months, yearly for 3 years. A configurable 10 GiB cleanup ceiling can shorten that history. These are initial defaults, not agreed RPO/RTO. Daily scheduling implies roughly one day of potential loss only when jobs succeed; confirm recovery objectives and storage capacity before launch.

Use `backup:run-encrypted`: it refuses a missing password and runs Spatie with `--only-db`. Raw `backup:run` bypasses the wrapper's password guard. Archive verification alone is not a restore test.

## Restore procedure

1. Download the archive to a restricted temporary directory and decrypt it with an AES-compatible ZIP tool. Keep the password out of shell history/logs.
2. Create an empty isolated PostgreSQL database with PostGIS available. Restore SQL using `psql -v ON_ERROR_STOP=1`; never overwrite a live database for a drill.
3. Verify migrations, representative parking/users/permissions/notifications, spatial queries and constraints. Supply the original application key through secret management and check encrypted fields/authentication.
4. Start a separate application instance against the restored database, ensure `pg_trgm` is installed and verify `/api/search`. No search-index rebuild is required.
5. Record archive identity, timestamps, sizes, results and recovery duration. Plan any cutover separately and remove temporary decrypted files afterwards.

## Local verification

```sh
ddev exec php scripts/verify-infrastructure.php
ddev test
ddev exec composer ci:lint
ddev exec npm run build
```

The infrastructure script only runs inside local DDEV. It creates two random disposable databases, runs real migrations, writes a PostGIS probe, creates an AES-256 Spatie archive on a temporary local disk, restores it and checks the spatial value. It cleans up its databases/files and sends no backup notifications.

The original #1166 rehearsal verified encrypted PostgreSQL/PostGIS backup/restore and the now-removed search service. This proves the local package/data path; S3 transport, production scheduling, operator alerts and production recoverability still require deployment evidence.
