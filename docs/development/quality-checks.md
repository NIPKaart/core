# CI quality checks

The supported baseline is Laravel 13, PHP 8.4 and Node 24 (CI pins Node 24.20.0). The test workflow also checks PHP 8.5. Both workflows use read-only GitHub permissions, SHA-pinned actions, `npm ci` and PHP coverage `none`. Coverage reporting and thresholds are not currently part of the quality gate.

PostgreSQL 18 with PostGIS 3.6 replaced MySQL in #1182. The MySQL acceptance item in #1165 predates that change: CI retains real database migration, seeding and test coverage using PostgreSQL/PostGIS. See [database setup](postgresql.md). Each CI test job migrates an empty service database and runs the baseline, municipal and offstreet sample seeders before testing.

## Run locally

Install the locked dependencies with `composer install` and `npm ci`, and configure `.env` and an application key as described in the database setup guide. Use PHP 8.4 and Node 24 to match the primary CI runtime.

```sh
composer ci:lint
composer ci:test
# Or run both:
composer ci:check
```

`ci:lint` generates ignored Wayfinder route helpers before checking Pint, Prettier, ESLint and TypeScript. All formatting and lint checks are read-only; generated route helpers and build artifacts are expected outputs, not source fixes. `ci:test` builds both production client and SSR bundles and runs Pest through the existing Composer test command. An SSR build checks compilation, not live SSR rendering.

Tests require the dedicated `nipkaart_test` PostgreSQL database with PostGIS available. They reset test data. For DDEV, `ddev test` provisions that database; then use:

```sh
ddev exec env DB_HOST=db composer ci:check
```

For host execution, provide the test server's `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD`. PHPUnit fixes the database name to `nipkaart_test` and clears `DB_URL`. Never point test commands at a database containing data you need to retain. Fresh-install migrations and sample seeding are exercised separately by CI; the combined local check does not seed the application database.

To repair formatting locally, use `vendor/bin/pint`, `npm run format` and `npm run lint`. Commit those repairs before running check commands. CI never invokes these fix commands.

## Deferred tooling

Larastan/PHPStan is explicitly deferred to a focused follow-up. This change first establishes passing checks for the existing toolchain and repairs its existing formatting/type baseline. A static-analysis follow-up should install Larastan separately, measure its initial findings and select a level before deciding whether cleanup fits one PR; no analysis baseline has been measured here and no errors are suppressed.

Pest 5 is also explicitly deferred. Keep Pest 4 and its Laravel plugin for this baseline; evaluate Pest 5 migration and behavioral compatibility in a separate PR after this gate is green. Vite Plus remains in #1161's scope.
