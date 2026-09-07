# Backend skeleton decisions

Issue #1160 reconciles the established NIPKaart backend with the Laravel 13 React Starter Kit. Comparison date: 2026-09-07. Sources: the upstream [provider](https://github.com/laravel/react-starter-kit/blob/main/app/Providers/AppServiceProvider.php), [bootstrap](https://github.com/laravel/react-starter-kit/blob/main/bootstrap/app.php) and [Composer manifest](https://github.com/laravel/react-starter-kit/blob/main/composer.json). These upstream links track a moving branch; the decisions below describe this reconciliation. This is a historical snapshot: Sanctum/Scout removal is recorded in [infrastructure](infrastructure.md), Fortify and administrator provisioning in [auth security](auth-security.md), and Pest 5 adoption in [quality checks](quality-checks.md).

| Area | Classification | Decision |
| --- | --- | --- |
| API, web, console, broadcast and health routing | Keep | Retain all NIPKaart route registrations, including Sanctum and the existing API web/throttle middleware. |
| Locale, appearance, Inertia, preload and suspension middleware | Keep | Preserve middleware order and unencrypted locale/appearance/sidebar cookies. Suspension continues to log out and redirect with a session error; this is a middleware response, not an exception converted to JSON. |
| API exception rendering | Upgrade | Exceptions on `api/*` always render JSON, including clients without a JSON Accept header. Other routes use `expectsJson()`, retaining browser HTML and authentication redirects. Status codes, validation errors and HTTP headers remain Laravel's responsibility. |
| Destructive database commands | Keep | Continue prohibiting destructive commands in production. |
| Strict Eloquent models | Keep | Continue enabling strict behavior outside production. |
| Automatic relationship eager loading | Keep | Preserve the explicit application-wide opt-in. Accessing an unloaded relationship may batch-load that relationship for the model collection; removing this changes query behavior. This reconciliation makes no performance improvement claim. |
| ParkingSpace observer | Keep | Preserve domain observer registration. |
| Log Viewer authorization | Keep | Preserve the admin-role check; further security review belongs to #1166. |
| Production password defaults | Upgrade | Require at least 12 characters, uppercase and lowercase letters, a number, a symbol, and Laravel's uncompromised check. |
| Immutable dates | Investigate — deferred | Retain mutable dates for this change; see the audit boundary below. |
| Environment template | Upgrade | Set `APP_NAME=NIPKaart`; preserve PostgreSQL, session/cache/queue, Reverb, Scout and map settings. |
| Composer CI scripts | Keep | #1165 already delivered `ci:lint`, `ci:test` and `ci:check`; use the documented project commands. |
| Starter `setup` script | Investigate — deferred | Keep the documented PostgreSQL/PostGIS and DDEV setup. Copying a generic setup that generates keys and runs migrations does not establish the project's database prerequisites. |
| Chisel / Pao | Investigate — deferred | Existing `composer dev`, concurrently and Pail cover the current process/log workflow. No demonstrated missing workflow justifies another package in this reconciliation. |
| Larastan / Pest major upgrade | Investigate — deferred | Follow the explicit deferrals in the quality-checks document; no new dependencies here. |
| Fortify and starter feature installation hooks | Investigate — deferred | #1162 owns auth-provider decisions. Existing controllers do not require feature scaffolding; do not add template installation hooks. |

No existing backend component needs replacement or removal to meet this issue. See [quality checks](quality-checks.md) for the local and CI command contract.

## Password policy and auth boundary

The shared rule applies to the existing registration, password reset and settings password-update controllers, which already call `Password::defaults()`. Production is determined by Laravel's application environment (`APP_ENV=production`). Other environments retain Laravel's minimum-eight-character default, so existing development fixtures and auth tests remain usable. Existing password hashes and login validation are unchanged; users must meet the stronger policy when choosing a new password.

Laravel's uncompromised validator queries the Pwned Passwords range API using the first five characters of a SHA-1 hash, not the password itself. We retain the framework verifier and its failure behavior: unavailable or unsuccessful service responses do not reject an otherwise valid password. Tests substitute the verifier to cover both clean and compromised results without external network traffic. A separate fail-closed policy is not introduced here.

The production feature tests exercise every rule through all three existing HTTP entry points and verify stored passwords on success and unchanged accounts on rejection. Legacy-password login and the existing non-production auth suite provide compatibility coverage. #1162 should retain this shared rule if it migrates these flows to Fortify. The administrative `user:create` command currently bypasses the HTTP validation rules; auditing administrative credential provisioning belongs to that auth review.

## Date audit and deferral

The application scan found direct `now()` timestamps in user verification, suspension, notifications and parking-space confirmations, plus date formatting in API queries and search documents. No obvious ignored-return date mutation was found in application code. However, `User`, `ParkingSpace`, `ParkingSpaceConfirmation`, `ParkingMunicipal` and `ParkingOffstreet` still use mutable `datetime` casts. Absence of an obvious mutation does not prove compatibility across Eloquent date casting, observers, serialization and package integrations.

Do not configure `Date::use(CarbonImmutable::class)` in this change. Adoption should be a focused change with tests for confirmation timestamps and day boundaries, suspension/verification timestamps, API/search serialization and observer behavior, and explicit decisions about model casts. Immutable dates are an optional starter default, not a prerequisite for this issue's JSON and password improvements.
