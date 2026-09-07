# CI quality checks

The supported baseline is Laravel 13, PHP 8.4 and Node 24 (CI pins Node 24.20.0). The test workflow also checks PHP 8.5. The lint and full-test workflows use read-only GitHub permissions, SHA-pinned actions, `npm ci` and PHP coverage `none`. The separate TIA baseline workflow enables Xdebug to record test dependencies; coverage thresholds are not part of the quality gate.

PostgreSQL 18 with PostGIS 3.6 replaced MySQL in #1182. The MySQL acceptance item in #1165 predates that change: CI retains real database migration, seeding and test coverage using PostgreSQL/PostGIS. See [database setup](postgresql.md). Each CI test job migrates an empty service database and runs the baseline, municipal and offstreet sample seeders before testing.

## Run locally

Install the locked dependencies with `composer install` and `npm ci`, and configure `.env` and an application key as described in the database setup guide. Use PHP 8.4 and Node 24 to match the primary CI runtime.

```sh
composer ci:lint
composer ci:test
# Or run both:
composer ci:check
```

`ci:lint` generates ignored Wayfinder route helpers before checking Pint, Prettier, ESLint and TypeScript. All formatting and lint checks are read-only; generated route helpers and build artifacts are expected outputs, not source fixes. `ci:test` builds the production client bundle and runs Pest through the existing Composer test command. React renders in the browser; SSR is explicitly disabled in application configuration. Feature tests use that real configuration rather than overriding it. See [frontend baseline](frontend-baseline.md) for the architecture decision.

Tests require the dedicated `nipkaart_test` PostgreSQL database with PostGIS available. They reset test data. For DDEV, `ddev test` provisions that database; then use:

```sh
ddev exec env DB_HOST=db composer ci:check
```

For host execution, provide the test server's `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD`. PHPUnit fixes the database name to `nipkaart_test` and clears `DB_URL`. Never point test commands at a database containing data you need to retain. Fresh-install migrations and sample seeding are exercised separately by CI; the combined local check does not seed the application database.

To repair formatting locally, use `vendor/bin/pint`, `npm run format` and `npm run lint`. Commit those repairs before running check commands. CI never invokes these fix commands.

## Deferred tooling

Larastan/PHPStan is explicitly deferred to a focused follow-up. This change first establishes passing checks for the existing toolchain and repairs its existing formatting/type baseline. A static-analysis follow-up should install Larastan separately, measure its initial findings and select a level before deciding whether cleanup fits one PR; no analysis baseline has been measured here and no errors are suppressed.

Vite Plus remains in #1161's scope.

## Pest 5 and Test Impact Analysis

Pest and its Laravel plugin use v5. Pest 5 requires PHP 8.4 and moves the suite from PHPUnit 12 to PHPUnit 13; the existing Pest bootstrap and PHPUnit XML remain compatible. See the [Pest upgrade guide](https://pestphp.com/docs/upgrade-guide). No existing test behavior or assertion was relaxed for this upgrade.

`composer test` clears cached configuration and executes the entire backend suite with `--no-tia`, even if TIA is enabled through the environment. `composer ci:test` builds client assets and calls that full command. The `tests` workflow's **PHP 8.4** and **PHP 8.5** jobs remain the authoritative full regression gates for pull requests and pushes to `main`/`develop`. TIA is a local iteration aid, not a replacement for these gates or for `composer ci:check` before delivery.

Use Composer 2.8 or newer so test arguments are passed only to Pest, not to the configuration-clear command. For a fast local iteration after a baseline exists:

```sh
composer test:tia
# Bound parallel database connections on smaller machines:
composer test:tia -- --processes=2
# Rebuild after broad changes or to investigate stale results:
composer test:tia -- --processes=2 --fresh
```

TIA needs an enabled PCOV or Xdebug coverage driver. For DDEV, provision the dedicated test database once with `ddev test`, enable Xdebug with `ddev xdebug on`, then run `ddev exec env DB_HOST=db XDEBUG_MODE=coverage composer test:tia -- --processes=2`. Restore normal development performance afterwards with `ddev xdebug off`. Host execution needs the PostgreSQL connection overrides described above. Parallel workers create disposable `nipkaart_test_test_<token>` databases; the test database role needs `CREATEDB` and permission to enable PostGIS. Do not use application data in those databases.

The command opts into Pest's shared baseline fetch using `--baselined`. Install and authenticate `gh` in the runtime executing Pest to download the `pest-tia-baseline` artifact from `tia-baseline.yml`; agents must run this command outside the sandbox because it may invoke `gh`. Missing authentication, missing artifacts or incompatible baselines fall back to local recording. Use the reported affected/replayed counts to distinguish executed tests from cached results. Dependency, runtime and structural configuration changes can invalidate the cache. After migration, spatial SQL, fixtures, seeders or broad configuration changes, run the full suite as well. TIA does not validate an external database's current state or replace frontend checks.

The **TIA Baseline** workflow records a fresh full parallel run on PHP 8.4 with PostgreSQL 18/PostGIS 3.6 and Xdebug. It runs after every `main` push, manually, and Mondays at 03:23 UTC. Weekly refresh and 14-day retention leave a previous weekly artifact available without daily runs when the code is unchanged. The artifact path comes from `pest --baseline`, and an absent artifact fails the upload. Composer and Node use their lockfiles and assets are built for the existing frontend configuration checks.

Additional plugins were evaluated individually: agent output is optional and the existing compact Pest output is sufficient; browser tests do not exist yet; PHPStan and Rector plugins have no configured consumers. None are added solely for DDS parity. Revisit them when their corresponding tooling is introduced.

Permanent spatial coverage lives in `ParkingLocationTest`, `ParkingDiscoveryTest`, `GeoPointTest` and `GeoBoundsTest`: all source models, generated SRID/coordinate order and bulk updates, metre distances, deterministic ties, inclusive bounds, antimeridian queries, public filtering, and invalid inputs. There is no application coverage-polygon/intersection API yet; no speculative polygon model or tests of bare PostGIS functions are introduced. Query-plan assertions are intentionally omitted: tiny transactional fixtures do not meaningfully predict planner choices, while exact query results are stable regression contracts.

See [Pest TIA documentation](https://pestphp.com/docs/tia) for baseline storage, invalidation and replay behavior.
