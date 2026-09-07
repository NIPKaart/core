# NIPKaart architecture

- Use Laravel 13 and PHP 8.4 as the supported baseline. Read `docs/development/quality-checks.md` before changing tooling or running checks.
- Use `ParkingSpace` for community contributions. Read `CONTEXT.md` before changing domain terminology or models.
- Keep `ParkingSpace`, `ParkingMunicipal` and `ParkingOffstreet` as separate source models and persistence tables. Shared discovery is a read model; read `docs/product/discovery-read-model.md` and `docs/development/domain-contracts.md` before changing discovery or source identity.
- PostgreSQL with PostGIS is the database baseline. PostGIS owns exact spatial queries; Meilisearch provides textual/search discovery. Read `docs/development/postgresql.md` before changing storage, coordinates or search responsibilities.
- Prefer Laravel policies for resource authorization and Spatie Permission for roles and permissions. Read `docs/development/auth-security.md` before changing access control.
- Keep basic parking discovery available without an account. Read `docs/product/accessibility.md` before changing the public discovery flow.
- Preserve repository-specific guidance in `.ai/guidelines/`; regenerate the Boost sections with `php artisan boost:update --no-interaction --no-discover`. Read `docs/development/boost.md` before changing agent tooling.
- Run GitHub `gh` commands outside the sandbox. Keep Markdown paragraphs on logical lines; no forced 88-character wrapping.
