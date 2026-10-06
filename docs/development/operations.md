# Operations: monitoring, backups and recovery (#1261)

This page records what NIPKaart watches, where an alert goes, what a backup covers and how a restore is rehearsed. Decisions taken on 2026-10-05: alerts go by **email**, application errors are tracked in **Laravel Nightwatch**, there is **no external uptime or heartbeat check yet**, and the **recovery point objective is one day**. Backup mechanics and the restore procedure are in [infrastructure](infrastructure.md#backup-reference-and-deployment-gates).

## Signals and where they go

Two kinds of health are kept apart. **Infrastructure incidents** (errors, failing jobs or tasks, failed backups) go to the operator by email. **Product and source health** (a municipality stops delivering, a garage feed goes quiet, an official link breaks) is shown to administrators in the application, where they act on it; published data is never hidden or deleted because of it.

| Signal | Detected by | Destination |
| --- | --- | --- |
| Unhandled exceptions in requests, commands, queued jobs and scheduled tasks | Nightwatch, which opens an issue per distinct exception | Nightwatch issue notifications by email (new, reopened) |
| Failed and retried queued jobs (for example `ProcessDatasetDelivery`) | Nightwatch jobs; the exception that fails a job opens an issue | Nightwatch issue notifications by email |
| Scheduled tasks that fail (deliveries, observations, rule links, backups) | Nightwatch scheduled tasks; a task's exception opens an issue | Nightwatch issue notifications by email |
| Backup failed, unhealthy backup (missing or older than a day, or over the storage limit), cleanup failed | `spatie/laravel-backup` | Email to `BACKUP_NOTIFICATION_EMAIL` |
| Delivery could not be processed, delivery overdue, source awaiting (re)approval or review | Data sources overview (`SourceOverview`) | Admin sidebar count, dashboard and data sources page; database notifications for review and approval |
| A garage source's live measurements stop (newest measurement older than `observation_stale_after_minutes`, 10 minutes) | Data sources overview, status `live_stale` | Same as above; visitors see the occupancy as stale |
| An official parking-rule link stops opening | Daily `nipkaart:check-rule-links` (#1315) | Parking rules page |

Not covered yet: an external check that the site answers on `/up` and that the scheduler runs. Nightwatch shows scheduled task runs, but nothing alerts when the scheduler stops altogether. Add an external uptime and heartbeat check once the hosting is chosen.

## Nightwatch

- **Process.** Install with `laravel/nightwatch` (present). In production, set `NIGHTWATCH_ENABLED=true` and the environment's `NIGHTWATCH_TOKEN`, and keep `php artisan nightwatch:agent` running under a process monitor next to the queue worker. Choose the **EU region** when creating the application. Check the agent with `php artisan nightwatch:status`.
- **Disabled elsewhere.** It is disabled in `.env.example` and in tests (`phpunit.xml`), because without an agent it would try to reach one on every request.
- **Sampling.** Requests at 10% (`NIGHTWATCH_REQUEST_SAMPLE_RATE=0.1`); commands, scheduled tasks and exceptions at 100%.
- **Alerts.** Nightwatch emails account members when an issue is created, resolved or reopened, and for performance alerts; that is its default. Keep these notifications on for the operator's account.
- **What it is not told** (`App\Support\ObservabilityPrivacy`):
  - Users are known by id only, never by name or email.
  - Request IP addresses are dropped.
  - Query strings are removed from incoming and outgoing URLs, because they hold destination searches, map coordinates and the geocoding API key.
  - Request payloads are not captured (Nightwatch's default), and sensitive headers are redacted.
  - Mail is counted per recipient type, without addresses.
  - Database queries are reported without their bound values.

## Backup coverage and retention

All state that cannot be rebuilt lives in PostgreSQL, and the nightly encrypted database backup covers it:

- community parking spaces with their reviews, improvements, confirmations, reports and removals;
- users, roles, permissions, suspensions, passkeys and favorites;
- in-app notifications;
- dataset sources with their approval state, imports, delivery records and the published municipal and garage records;
- parking-rule sources and their link health;
- the reference geography (countries, provinces, municipalities).

Queue, cache and session tables are included, but they are disposable.

The backup does **not** contain the retained deliveries in object storage, `.env`, or the application key. Keep the original `APP_KEY` and the backup password in secret management, separately from the backup bucket.

- **Schedule.** Backup at 01:30 UTC, monitor at 03:00 UTC and cleanup at 03:30 UTC.
- **Retention.** All backups for 7 days, one a day for 30 days, one a week for 8 weeks, one a month for 12 months and one a year for 3 years, within `BACKUP_MAX_STORAGE_MEGABYTES` (10 GiB).

## Recovery expectations

- **Core database.** The recovery point objective is **one day**: in the worst case, the changes since the last nightly backup are lost and contributors re-submit them. Restore follows the [restore procedure](infrastructure.md#restore-procedure) into a new database. The local rehearsal below restored in seconds. A production restore time (RTO) is set once the hosting and database size are known; until then, restore is a manual operator action.
- **Retained deliveries in object storage.** They are not backed up by NIPKaart. Published municipal and garage data is in the database, so visitors are not affected if deliveries are lost. Lost deliveries are replaced by the collectors' next deliveries, which are discovered and imported as usual. Only the audit trail of older deliveries is lost.
- **Live garage occupancy.** It is transient. After a restore, it is current again with the next observation, within minutes.

## Restore rehearsal

Run `ddev exec php scripts/rehearse-restore.php`. The script:

1. backs up the current local database with `backup:run-encrypted` to a temporary disk;
2. decrypts the AES-256 archive and restores it into a separate database;
3. compares both databases: every table's row count, PostGIS and `pg_trgm`, constraint validity, a checksum of the parking locations, and a trigram search;
4. removes the restored database and the archive afterwards.

Rehearse after schema changes and before a release. Once production runs, repeat the rehearsal against a downloaded production archive in an isolated environment, and record it here.

| Date | Environment | Data | Archive | Backup | Restore | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-05 | Local DDEV, PostgreSQL 18.6, PostGIS 3.6.4 | 35 tables, 10,501 rows | 2.1 MiB, AES-256 | 0.8 s | 1.0 s | All checks passed |
