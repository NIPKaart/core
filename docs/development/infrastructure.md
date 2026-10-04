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

The active global search is destination-first: `SearchButton` in the frontend navigation and application sidebar opens `SearchOverlay`, mounted in the frontend, application and map layouts. The overlay calls `/destinations/suggestions` and `/destinations/resolve`; selecting a result opens `/map` focused on that destination. The backend `DestinationSearch` service combines internal published parking matches with configured geocoding providers; provider choice, limits and privacy are recorded in [ADR 0012](../adr/0012-destination-resolution-internal-first-with-controlled-external-geocoding.md). `InternalDestinationSearch` still uses `ParkingTextSearch` for those internal matches, so its PostgreSQL matching behavior and tests remain required.

The #1274 consumer audit found that `/search/results` was only called by `resources/js/hooks/use-search-query.tsx` through `resources/js/lib/search.tsx`, solely for the old `backend/search/index.tsx` page. The only incoming link to `/search` was in `SearchBar`, which had no imports or mounted consumers. That obsolete page, route, controller, hook, client helpers, types and page translations have been removed. There is no separate active parking-record search UI to preserve. Matching, visibility, ranking and injection tests now exercise `ParkingTextSearch` directly; HTTP input validation remains covered through destination suggestions.

First-party JSON reads stay on feature-oriented web routes. Viewport and nearby queries share the named `parking-discovery` limiter: 1,000 requests/minute and 10,000 requests/hour per authenticated user or guest IP, with separate counter keys for the two windows. The minute window allows interactive bursts; the hourly window protects against sustained abuse. Client debounce, cancellation and loaded-bounds reuse remain the first line of request control. Destination suggestions and resolution have a separate 60/minute budget because they may call external providers. Exhausting either workload does not consume the other's allowance. Parking details remain session-aware web reads. `/api` is reserved for a future explicitly designed `/api/v1` contract.

| Previous consumer or behavior | Replacement |
| --- | --- |
| Former SearchController multi-index request | `ParkingTextSearch` queries the actual source tables with a SQL union and live municipality/province joins; no copied search tables/documents. |
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
| Search, domain and infrastructure tests | Real PostgreSQL service and destination endpoint coverage replaces client/engine mocks; model JSON and visibility contracts remain covered. |

`pg_trgm` is justified by the existing autocomplete's typo-tolerant matching, using PostgreSQL's [word similarity function](https://www.postgresql.org/docs/current/pgtrgm.html). The migration enables it in `public`; a restricted deployment role needs an administrator to enable it beforehand. Rollback retains the shared extension, like PostGIS. No speculative full-text/trigram indexes or synchronized search projections are added: the current query joins related names and uses an explicit similarity threshold. This baseline can scan published rows and sort matches; benchmark representative production-sized data before choosing an indexable query/index strategy. Existing spatial GiST indexes continue serving exact discovery.

Boost removes the generated Scout skills and its selection after package removal; generic locally cached skills are not runtime consumers. Historical audit observations remain historical and are superseded by this decision.

## Live notifications and occupancy

Set `BROADCAST_CONNECTION=reverb` and matching nonempty `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`. Supervise a queue worker and `php artisan reverb:start`. Backend `REVERB_HOST/PORT/SCHEME` identify the publishing endpoint; `VITE_REVERB_HOST/PORT/SCHEME` identify the browser-reachable endpoint. Rebuild assets after Vite changes. DDEV exposes Reverb on port 8080 (8443 over HTTPS) and starts three background processes from `.ddev/config.yaml`: `reverb:start`, `queue:listen` and `schedule:work`. They restart with `ddev start`/`ddev restart`; check them with `ddev logs`. Do not also run `composer dev` inside DDEV, or jobs are processed by two workers.

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
4. Start a separate application instance against the restored database, ensure `pg_trgm` is installed and verify `/destinations/suggestions` with a known published parking query. No search-index rebuild is required.
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

## Post-modernization cleanup audit (#1196)

Audited on 2026-09-08 against registered routes, PHP references, React imports, Inertia page names (including `inertia()` and Fortify views), providers, notifications, commands, schedules, manifests, environment settings, DDEV, tests and #1168. At the owner's request, this pass deliberately limits deletion to empty, unregistered methods and unused demonstration helpers. Other candidates remain in place for separate consideration; lack of a current caller alone does not justify removing substantial code in this pass.

| Area | Classification and evidence |
| --- | --- |
| Municipal/offstreet controller `create` and `store` | Remove. Four empty methods with no registered routes or callers. Preserve all implemented actions and the municipal request class, including currently unregistered detail/edit/update/delete behavior. New HTTP tests protect the retained imported-parking lists, municipality drill-down, visibility changes and authorization. |
| Starter `inspire` command and Pest `toBeOne` / `something` helpers | Remove. Demonstration scaffolding with no schedule, script, test or documented operational consumer. Keep the independent quote prop consumed by the active auth layout. Preserve all existing tests, including the client-rendering homepage test and trivial unit example. |
| Other backend code | Keep. Routes, Fortify bindings, favorites serialization, parking discovery/text search, provider registration and contribution/status/delete/restore notifications have current consumers. No API or route is removed. |
| Frontend candidates | Retained during #1196; rechecked and classified individually in the #1207 audit below. Active sidebar/split-auth/public/map layouts and responsive hooks remain. |
| Dependency candidates | Retained during #1196; final dependency consumers and the narrow removals are recorded in the #1207 audit below. #1196 itself did not change manifests, lockfiles or dependency versions. |
| Other dependencies and infrastructure | Keep. Fortify/Permission/Inertia/Wayfinder supply auth, authorization, rendering and routes. Reverb, Clockwork, Log Viewer, Backup and the S3 adapter have documented consumers above. Tinker/Pail and Boost/Pint/test packages are development entry points. Other frontend libraries support UI primitives, RHF, maps, search state/query caching, translations, notifications and build checks. Redis/RedisInsight remain optional tooling with documented Valkey selection. The encrypted PostgreSQL/PostGIS restore probe remains useful. |
| Config and environment | Keep. Remaining template variables have configuration/frontend consumers, including map tokens, optional cache/queue/mail/filesystem drivers and backup settings. Scout/Meilisearch removal already belongs to completed #1195; no further service or volume changes are needed here. |
| Operator commands | Keep / follow-up. Artisan auto-discovers `nipkaart:make-admin`, `logs:clear` and `app:inject-version`. The legacy `user:create` command was retired in #1209: `nipkaart:make-admin` bootstraps administrators and administration creates other accounts, both under the normal password policy. Log clearing and writing `.version` retain operational behavior. |
| Tests, factories, migrations and identity | Keep / historical. Preserve all existing tests, factories, historical migrations, persisted permissions, source tables, opaque IDs and compatibility fields. The unused test helpers above contain no test cases. |
| Documentation | Correct the active feature-inventory search guidance to PostgreSQL/PostGIS. Explicitly mark the backend reconciliation as a historical snapshot superseded by current infrastructure/auth/quality decisions. Retain deliberate MySQL/Scout migration evidence and `ParkingSpot` terminology discussion in the domain audit. |

The owner approved narrowing #1196 to this limited pass and moving the retained candidates to explicit follow-ups: #1207 covers frontend scaffolding and dependencies, #1208 covers retained controller actions and incomplete administration surfaces, and #1209 covers legacy `user:create` provisioning. The revised #1196 delivery criterion remains open until the local cleanup, regression tests and audit documentation are delivered in a reviewable PR. This scope decision does not claim that every known unused component has been removed. Existing public, account and admin surfaces stay in place regardless of Horizon 1 status. Registered user/role detail actions reference missing pages and some registered resource actions are stubs; these are reachable product gaps, not dead code to delete. Product behavior, destination resolution and shared discovery remain under #1168/#1169/#1170.

## Retained frontend scaffolding and dependency decisions (#1207)

Rechecked on 2026-10-04 against React imports (including relative imports), the lazy `pages/**/*.tsx` resolver in `app.tsx`, registered routes, controller `Inertia::render()` / `inertia()` calls, Fortify view bindings, tests, scripts, DDEV configuration and locked package dependency edges. Each candidate has the following final role; this is a bounded cleanup of the candidates from #1196, not a general sweep of unused UI primitives.

| Candidate | Decision and current evidence |
| --- | --- |
| `pages/welcome.tsx` | Remove. No public/controller/Fortify route resolves this starter demo. Its only named-page consumer was `FormFeedbackTest`; that test now resolves the existing `frontend/home` page with `garages: null` and keeps its marker-based partial reloads, all four flash severities, one-time delivery, repeated feedback and validation/error-correction coverage. An initial-visit assertion checks that the replacement page exists. |
| `layouts/app/app-header-layout.tsx` and `components/app-header.tsx` | Remove. The header's only caller was this unused layout, and no page selected the layout. `app-layout.tsx` selects the active sidebar layout. The public navigation separately consumes `ui/navigation-menu`, so that primitive and its dependency stay. Navigation redesign remains owned by #1178. |
| `layouts/auth/auth-simple-layout.tsx` and `auth-card-layout.tsx` | Remove. Neither has an importer or page resolver. `auth-layout.tsx` selects `auth-split-layout.tsx` for the active Fortify pages; the split layout and its quote prop stay. |
| `components/appearance-dropdown.tsx` | Remove. No importer. Theme initialization and persistence remain in `hooks/use-appearance.tsx`, consumed by `app.tsx`, settings `appearance-tabs.tsx` and the public `frontend/nav/theme-toggle.tsx`. |
| `components/banner.tsx` | Remove. No importer. The independently implemented `alerts/status-parking-space.tsx` and `alerts/outdated-municipalities.tsx` have active page consumers and stay. |
| `components/ui/icon.tsx` | Remove. No importer. The distinct `components/icon.tsx` remains used by public navigation and the sidebar footer. |
| `components/ui/sonner.tsx` and `next-themes` | Remove together. The wrapper has no importer; it was the sole `next-themes` consumer. `app.tsx` directly imports Sonner's `toast` / `Toaster` for Inertia flash feedback. The `sonner` dependency and the application's own appearance hook stay. |
| `components/ui/toggle.tsx`, `toggle-group.tsx`, `@radix-ui/react-toggle` and `@radix-ui/react-toggle-group` | Keep. Unlike the September snapshot, `pages/backend/moderation/group-editor.tsx` now uses the toggle group for orientation and under-sign editing, reached through `review-sheet.tsx` from the moderation page. The group wrapper imports `toggleVariants` from the toggle wrapper; Radix toggle-group also depends on Radix toggle. |
| `http-interop/http-factory-guzzle` | Remove. `composer why` reports only the root requirement. No application/provider/config/script/test PSR-17 factory or `Http\Factory\Guzzle` consumer was found. `guzzlehttp/psr7` and `psr/http-factory` remain required transitively by the active HTTP stack; those packages stay. |
| `laravel/sail` | Remove. `composer why` reports only the root development requirement. There is no Sail Compose setup, script or operational guide; local PHP 8.4 / Node 24 / PostgreSQL development and checks use the committed DDEV configuration. `boost.json` already disables Sail. |

All listed candidates are either removed or kept with a concrete consumer; none requires a new product issue. Manifests and lockfiles remove only the three named packages, preserving every other locked version. No route, source model, public/map/sidebar/split-auth layout, theme behavior, responsive hook or active feedback mechanism changes.

Validation: 119 focused feedback/auth/settings/homepage tests passed (556 assertions), followed by a successful `ddev exec env DB_HOST=db composer ci:check`: Pint, Prettier, Oxlint, TypeScript, frontend unit tests, production build and all 758 backend tests (4,280 assertions). Package discovery succeeded after removing Sail. A before/after comparison of both lockfiles confirmed exactly the three intended removals, no additions and no changes to retained package entries. The production build reports a chunk-size warning; this cleanup does not change bundling strategy.
