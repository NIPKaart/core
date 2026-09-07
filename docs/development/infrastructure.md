# Infrastructure audit (#1166)

Audit date: 2026-09-07. NIPKaart is not yet in production. Laravel 13/PHP 8.4 compatibility is checked through the locked dependencies and quality gates.

## Decisions and consumers

| Integration | Decision and evidence |
| --- | --- |
| Scout/Meilisearch | Keep. Three parking models publish documents; SearchController performs multi-index text search. |
| Sanctum | Removed with owner approval: no external consumer exists. Package, config and `/api/user` are removed. Fortify/session authentication and the web/throttled parking APIs remain. The historical token-table migration is retained to preserve migration history. |
| Reverb/Echo | Keep and connect with owner approval. Five community-space notifications use database and broadcast channels. The previously unused hook now runs in app/frontend/map layouts, once per layout instead of in each responsive bell. |
| Log Viewer | Keep. UI/API require a non-suspended administrator. Tests cover guests, ordinary users and suspended administrators. Set `LOG_VIEWER_ENABLED=false` to disable all access. |
| Clockwork | Explicit local opt-in via `CLOCKWORK_ENABLE=true`. Other environments disable collection, API and UI even with debug and collect-always environment flags enabled. |
| Spatie Backup | Keep; prepare the DDS-style encrypted database/S3 pattern below. Scheduling is disabled by default. |
| Redis | Optional backing service for cache/queue/session or multi-server Reverb scaling. Current defaults use database cache/queue/session; Reverb scaling is off. No direct application Redis use was found. DDEV Redis/RedisInsight are optional tooling, not an application prerequisite. |

## Recreate search

Set `SCOUT_DRIVER=meilisearch`, `SCOUT_QUEUE=false`, `MEILISEARCH_HOST` and `MEILISEARCH_KEY`. DDEV uses `http://meilisearch:7700` and development key `ddev`. Outside development, provision a private service/key; never expose its administrative key in Vite variables.

```sh
ddev artisan search:configure
ddev artisan scout:import 'App\Models\ParkingSpace'
ddev artisan scout:import 'App\Models\ParkingMunicipal'
ddev artisan scout:import 'App\Models\ParkingOffstreet'
```

The configure command creates missing indexes through the settings API, waits for asynchronous settings tasks, and fails on server failure/timeout. It is repeatable and does not delete documents. Scout imports submit asynchronous document tasks: inspect Meilisearch task success and document counts before declaring completion. With queued Scout syncing, also run the Laravel queue worker.

All model index names and API queries now honor `SCOUT_PREFIX` (empty by default). Use a separate prefix per environment. An older environment with a nonempty prefix must configure/import the newly prefixed indexes before switching traffic.

To remove stale documents during a rebuild, pause model writes and search traffic, run `scout:flush` for each of the same three models, then configure/import and wait for server tasks. Imports only upsert eligible records; they do not prove stale records were deleted. Flushing temporarily empties search results. Search indexes are derived data and must be rebuilt after database recovery.

City/municipality filters apply to their respective aggregates. Community postcode is now filterable. Municipal and offstreet documents have no postcode, so postcode filters are not submitted for those indexes; postcode queries constrain community hits only. Each aggregate retains its own label, link and coordinate normalization.

`_geo` positions search hits on the map. There are no Meilisearch radius/bounds/distance queries, so `_geo` is deliberately not filterable/sortable. Exact spatial querying belongs to PostgreSQL/PostGIS and ParkingDiscovery.

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
4. Start a separate application instance against the restored database and rebuild Meilisearch using the steps above.
5. Record archive identity, timestamps, sizes, results and recovery duration. Plan any cutover separately and remove temporary decrypted files afterwards.

## Local verification

```sh
ddev exec php scripts/verify-infrastructure.php
ddev test
ddev exec composer ci:lint
ddev exec npm run build
```

The infrastructure script only runs inside local DDEV. It creates two random disposable databases, runs real migrations, writes a PostGIS probe, creates an AES-256 Spatie archive on a temporary local disk, restores it and checks the spatial value. It also configures three fresh prefixed Meilisearch indexes and verifies document ingestion, text/postcode search and geo payloads. It cleans up its databases/indexes/files and sends no backup notifications.

Verified locally: encrypted PostgreSQL/PostGIS backup/restore and three clean Meilisearch indexes. This proves the local package/data path; S3 transport, production scheduling, operator alerts and production recoverability still require deployment evidence.
