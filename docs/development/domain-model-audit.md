# Domain model audit

Audit for [#1163](https://github.com/NIPKaart/core/issues/1163), based on commit `c9d8b8f922d0b35260ffb6c351d9ac0cce9ebd05` on 2026-09-07. The inventory sections record that pre-repair snapshot, not production data. Paths below are relative to the repository root unless linked.

The concrete #195 and lifecycle repairs are now implemented in this PR. See [resulting domain contracts and migration notes](domain-contracts.md) for current behavior, validation and the explicit remaining product scope. The checklist below distinguishes implemented fixes from later lifecycle decisions.

## Decisions and compatibility

The canonical community names are **ParkingSpace** and **ParkingSpaceConfirmation**, as recorded in the [glossary](../../CONTEXT.md). Municipal, offstreet and community records remain separate aggregates: ownership, identity, publication and freshness differ. Do not merge their tables to simplify map queries.

`app/Services/ParkingDiscovery.php` already supplies a shared PostGIS query boundary with `source`, source-qualified `key`, original `id`, title, coordinates and optional distance. It excludes unpublished/deleted community and invisible imported records. The current frontend map still loads three full collections; the service is a foundation, not a completed discovery UI. Extend it under [#1170](https://github.com/NIPKaart/core/issues/1170) and [#1169](https://github.com/NIPKaart/core/issues/1169), following the [read-model direction](../product/discovery-read-model.md).

Preserve UUIDs, opaque external IDs, table names, route parameters, favorite morph values, notification payloads and Scout index names. There is no reason for a database rename in this audit. The earlier PostgreSQL [fresh-start decision](postgresql.md#fresh-start-decision) does not authorize another reset or a new identifier rewrite. Adding source identity later requires a collision/backfill plan that preserves links and favorites.

## Model, migration and factory matrix

All eleven models use `id` as primary key and normal `created_at`/`updated_at` timestamps. Only `ParkingSpace` uses soft deletes. A listed factory is present, not proof that every state is supported. All migration links are the actual tracked filenames, not names from old issue checklists.

| Model / table | Key and source identity | Migration(s) | Factory / tracked seeder |
| --- | --- | --- | --- |
| `Country` / `countries` | Incrementing bigint; unique two-character country `code` | [countries](../../database/migrations/2025_05_03_002525_create_countries_table.php) | `CountryFactory`; `CountrySeeder` |
| `Province` / `provinces` | Incrementing bigint; unique `(country_id, geocode)` | [provinces](../../database/migrations/2025_05_03_003204_create_provinces_table.php) | `ProvinceFactory`; `ProvinceSeeder` |
| `Municipality` / `municipalities` | Incrementing bigint; name, country and province; no unique geographic/source key | [municipalities](../../database/migrations/2025_05_03_111253_create_municipalities_table.php) | `MunicipalityFactory`; created by both sample parking seeders |
| `Favorite` / `favorites` | Incrementing bigint; string morph target ID; unique `(user_id, favoritable_id, favoritable_type)` | [favorites](../../database/migrations/2025_05_26_174122_create_favorites_table.php) | No factory or dedicated seeder; no `HasFactory` |
| `ParkingMunicipal` / `parking_municipal_spaces` | Nonincrementing string external ID; no provider/dataset namespace | [municipal](../../database/migrations/2025_05_04_220033_create_parking_municipal_table.php) | `ParkingMunicipalFactory`; `MunicipalityWithParkingSeeder` |
| `ParkingOffstreet` / `parking_offstreet_spaces` | Nonincrementing string external ID; no provider namespace | [offstreet](../../database/migrations/2025_05_04_214643_create_parking_offstreets_table.php) | `ParkingOffstreetFactory`; `MunicipalityWithOffstreetSeeder` |
| `ParkingRule` / `parking_rules` | Incrementing bigint; unique `(country_id, municipality_id)`, with nullable municipality | [rules](../../database/migrations/2025_05_04_230031_create_parking_rules_table.php) | `ParkingRuleFactory`; no tracked dedicated seeder |
| `ParkingSpace` / `parking_spaces` | Nonincrementing UUID; factory creates UUID, frontend writer incorrectly uses `uniqid()` | [spaces](../../database/migrations/2025_05_04_210653_create_parking_spaces_table.php) | `ParkingSpaceFactory`; no dedicated seeder |
| `ParkingSpaceConfirmation` / `parking_space_confirmations` | Incrementing bigint; UUID space FK; bigint user FK | [confirmations](../../database/migrations/2025_05_28_131651_create_parking_space_confirmations_table.php) | No factory or dedicated seeder; no `HasFactory` |
| `Role` / configured `roles` | Incrementing bigint; unique `(name, guard_name)` without teams | [permission tables](../../database/migrations/2025_03_31_202835_create_permission_tables.php) | `HasFactory` but no `RoleFactory`; `PermissionsTableSeeder` |
| `User` / `users` | Incrementing bigint; unique email | [users](../../database/migrations/0001_01_01_000000_create_users_table.php), [two-factor columns](../../database/migrations/2026_09_07_170000_add_two_factor_columns_to_users_table.php) | `UserFactory`; optional `UserTableSeeder` |

Passkeys, notifications, permission pivots, personal-access tokens, sessions, password-reset tokens, cache and queue tables are supporting infrastructure, not additional application domain models. `Contact` is absent as both a model and a migration; [#674](https://github.com/NIPKaart/core/issues/674) owns the contact feature and must establish whether persistence is needed.

`DatabaseSeeder` runs permissions, countries and provinces only. User and sample parking seeders are opt-in. Country/Province seeders delete reference rows and rely on initial IDs: they are fresh-install utilities, not repeatable production imports. Both sample parking seeders depend on the baseline province already existing; their fallback province creation omits required `geocode`. The unrelated, untracked local `ParkingRuleSeeder.php` is excluded from this repository inventory.

## Casts and assignment boundaries

| Model | Current casts | Assignment strategy / gap |
| --- | --- | --- |
| `Country` | Automatic timestamps | Allowlist: name, code |
| `Province` | Automatic timestamps | Allowlist: country, name, geocode |
| `Municipality` | Automatic timestamps | Allowlist: name, country, province |
| `Favorite` | Automatic timestamps | Allowlist: user and morph target; controller derives user and maps allowed target types |
| `ParkingMunicipal` | `ParkingOrientation`, visibility boolean, timestamps | Allows source ID, geographic FKs, coordinates and descriptive fields; no explicit coordinate/number casts |
| `ParkingOffstreet` | String ID, prices array, updated timestamp | Allows only geographic FKs; source fields require deliberate import assignment; missing `ApiState`, visibility, coordinate and capacity casts |
| `ParkingRule` | Automatic timestamps | Allows country, municipality, URL, nationwide; missing boolean cast for nationwide |
| `ParkingSpace` | `ParkingStatus`, `ParkingOrientation`, float coordinates, timestamps | Broad explicit allowlist includes identity, owner, IP and moderation status; missing boolean parking_disc/window_times and integer parking_time casts |
| `ParkingSpaceConfirmation` | `ParkingConfirmationStatus`, confirmed_at datetime | Allows space, user, status, comment and confirmation time; legacy `$dates` declaration is redundant with casts/default timestamps |
| `Role` | Inherits package behavior | Spatie guards the primary key, otherwise permits assignment; controller explicitly supplies name and synchronizes permissions |
| `User` | Verification/suspension/2FA datetimes; hashed password | Allows name, email, locale, password and suspended_at; authentication secrets are hidden; privileged suspension must remain an authorized server operation |

Missing casts are contract consistency gaps, not evidence that PostgreSQL always returns the wrong primitive. Follow-up changes must compare persisted model, JSON, Inertia and Scout values, including nullable enums/counts. Do not blindly broaden `ParkingOffstreet::$fillable` or pass request input directly into the broad community allowlist. Factories run unguarded and therefore do not demonstrate that normal `create()` accepts the same fields.

## Relationships and inverse relationships

| Model | Existing relations | Missing/stale relations or deliberate boundary |
| --- | --- | --- |
| `Country` | provinces, all three parking types, all/national/municipal rules | No municipalities inverse |
| `Province` | country, all three parking types | No municipalities inverse |
| `Municipality` | community spaces, municipal spaces | Missing country/province belongs-to, offstreet and rules inverses |
| `Favorite` | favoritable morph-to; favoritedByUsers morph-to-many | Missing user belongs-to; favoritedByUsers is copied target behavior and would query favorites whose target is a Favorite, not this favorite's owner |
| `ParkingMunicipal` | country, province, municipality; favoritedByUsers via trait | Geographic inverses exist except noted municipality gap |
| `ParkingOffstreet` | country, province, municipality; favoritedByUsers via trait | Municipality offstreet inverse absent |
| `ParkingRule` | country, municipality | Municipality rules inverse absent |
| `ParkingSpace` | user, country, province, municipality, confirmations; favoritedByUsers | Complete forward relations; soft-delete scope affects polymorphic favorites |
| `ParkingSpaceConfirmation` | parkingSpace, user | Both inverses exist |
| `Role` | Package permissions/users relations | `config/permission.php` selects `App\Models\Role`; no separate local relation implementation needed |
| `User` | parkingSpaces, favorites, confirmations; package roles/permissions/passkeys and notifications | confirmations lacks a `HasMany` return type |

Independent country/province/municipality FKs prove that rows exist, not that they belong to one hierarchy. `FindsOrCreatesMunicipality` uses a normalized-name lookup without a database uniqueness constraint; concurrent creation can duplicate municipalities. Define stable source identity and a reconciliation policy before imposing uniqueness on existing names.

## Policies, observers and output contracts

| Model | Policy / authorization | Observer / API or Inertia exposure / Scout |
| --- | --- | --- |
| `Country` | No dedicated policy; reference data through authorized flows | No observer/Scout/resource; option lists and related geographic names |
| `Province` | No dedicated policy; reference data through authorized flows | No observer/Scout/resource; option lists and related geographic names |
| `Municipality` | No dedicated policy; municipal administration gates on ParkingMunicipal | No observer/Scout/resource; option lists, grouping and related names |
| `Favorite` | No policy; profile controller scopes to authenticated user's favorites and allowlists target type | No observer/Scout; sole application JsonResource is `FavoriteResource` |
| `ParkingMunicipal` | `ParkingMunicipalPolicy`; permission-based, restore/forceDelete false | No application observer; explicit SpacesInfo JSON and admin Inertia; Scout index `parking_municipal_spaces`, visible only |
| `ParkingOffstreet` | `ParkingOffstreetPolicy`; permission-based, restore/forceDelete false | No application observer; explicit SpacesInfo JSON and admin Inertia; Scout index `parking_offstreet_spaces`, visible only |
| `ParkingRule` | `ParkingRulePolicy` | No observer/Scout/resource; admin Inertia and public rule URL fallback |
| `ParkingSpace` | `ParkingSpacePolicy`; profile additionally checks owner; submission uses its own request/controller | Registered `ParkingSpaceObserver` sends status/deletion/restore notifications; explicit SpacesInfo JSON, raw admin/profile/map Inertia; Scout index `parking_spaces`, approved only |
| `ParkingSpaceConfirmation` | `ParkingSpaceConfirmationPolicy` for list/delete; creation uses authenticated/verified route and daily check, no create policy | No observer/Scout/resource; admin Inertia and public aggregate count/last confirmation |
| `Role` | `RolePolicy` | Package lifecycle; no application observer/Scout/resource; admin Inertia |
| `User` | `UserPolicy` plus self-service auth/settings boundaries | No application observer/Scout/resource; auth/admin Inertia and authenticated API; secret fields hidden |

Absence of a policy for internal reference data is not itself a defect. Preserve self-service ownership and public publication filters when consolidating authorization. Specific stale call contracts need repair:

- `ParkingSpacePolicy::restore` and `forceDelete` accept `string $class`, but the controller supplies a model instance.
- `ParkingRuleController::destroy` and `RoleController::show`/`destroy` authorize a class while their policies require an instance.
- The municipal restore route names a nonexistent controller action; the model has no soft deletes and its policy denies restore. Remove or deliberately redesign this route, not the table.
- Confirmation creation checks once per day in application code only. Concurrent requests can both pass. Bulk confirmation deletion is not scoped to the space in the URL. Specify the desired rule and enforce/test it consistently.

`ParkingSpaceObserver::restored` casts a UUID to int, and `CommunitySpace\Restored` declares an integer ID: restored links cannot preserve community identity. `forceDeleted()` calls `deleted()` again even though force deletion already emits the deleted event. Bulk builder status/visibility updates and bulk restore/delete do not provide the same per-model observer/Scout effects as single actions. Notifications are not a durable moderation audit trail.

`FavoriteResource` dereferences its target without a null case. A favorite of a soft-deleted space resolves to null; a hard-deleted imported target leaves a dangling polymorphic reference. The removal endpoint also requires finding the target, so it cannot remove an unavailable reference through that path. Define an unavailable favorite representation and deletion behavior together.

The spatial `location` column is hidden by `HasParkingLocation`. Other raw Inertia model payloads remain coupled to model attributes; public detail JSON is explicitly selected. Audit owner/IP/moderation exposure before adding fields. Scout documents omit owner/IP, but `config/scout.php` declares municipal `postcode` as filterable even though neither that table nor its search document contains it. Visibility/status bulk writes and changes to related geographic names need explicit index reconciliation under #1166.

## Uniqueness and deletion semantics

| Record/event | Current database/model behavior | Requirement / follow-up |
| --- | --- | --- |
| Geographic reference deletion | Ordinary FKs restrict deleting referenced country/province/municipality rows | Keep reference identities stable; make seed/import reconciliation explicit |
| User deletion | Community owner becomes null; confirmations and favorites cascade | Decide whether confirmation evidence should survive account removal in anonymized form under #1175/#276; do not silently change retention |
| Community soft delete | Row and confirmations/favorites remain; default model queries hide the space | Restore should preserve identity and evidence; favorites must handle hidden target |
| Community permanent delete | Confirmation FK cascades; favorites have no target FK | Decide cleanup/tombstone/evidence policy before purge; per-model observer effects differ from bulk operations |
| Municipal/offstreet delete | Hard delete; no target FK on favorites | Source disappearance must not automatically destroy user references; retain unavailable state or clean up deliberately |
| Favorite creation | Database unique user/type/ID tuple; check-then-attach is not atomic | Handle duplicate concurrent writes; preserve current full-class morph values until an explicit compatibility migration |
| Confirmation creation | Nonunique `(parking_space_id, user_id, confirmed_at)` index | Once-per-day application check is not a uniqueness guarantee; define timezone and repeat/dispute semantics first |
| ParkingRule | Unique country/municipality tuple, municipality nullable | PostgreSQL permits multiple null municipalities; national rule uniqueness and nationwide/null consistency are not enforced |
| Role deletion | Permission/role pivot FKs cascade; polymorphic user links are package managed | Preserve package guard/role identity and authorization rules |

No scheduled community purge is present in `routes/console.php`. No arbitrary retention period is introduced. A parking-rule constraint change needs duplicate detection and cleanup before a new additive migration; do not rewrite an applied migration to hide conflicts.

## Spatial fields and indexing

All three parking tables already have decimal longitude/latitude, range checks, generated `geography(Point,4326)` and GiST indexes on geography and `location::geometry`. Scalars are the sole writable coordinates; PostGIS derives the point even for bulk SQL writes. `HasParkingLocation` supplies exact radius/distance and viewport scopes. Do not add duplicate writable geometry or replace this with Meilisearch geo ranking.

Remaining needs:

- Integrate bounded radius/viewport discovery instead of full map-table downloads (#1169/#1170).
- Validate coordinate ranges at request boundaries, rather than surfacing database errors (#1164); keep longitude/latitude order explicit.
- Measure representative PostGIS plans and data volumes before adding partial status/visibility/deleted_at indexes. Existing GiST indexes are not evidence of acceptable end-to-end map performance.
- Inventory FK and actual filter/join indexes: PostgreSQL does not automatically index referencing FK columns. Offstreet explicitly indexes municipality; confirmations have a space-first composite index; favorites have target and user-first unique indexes. Evaluate geographic joins, confirmation-by-user/date and rule fallback against their real query plans.
- Source coverage polygons belong to #1176; use the existing SRID deliberately and avoid inferring coverage from a few parking points.

## Field ownership, provenance and freshness

| Domain | Current data and writers | Required distinction |
| --- | --- | --- |
| Geographic reference data | Seeded country/province; community submission can find/create province/municipality from submitted Nominatim address | Stable geographic/source IDs versus editable display names; validate address hierarchy rather than treating submitted geocoder data as authoritative |
| Community | User submits coordinates, orientation, parking time/window restrictions and description; server derives owner/IP, pending status and address fields; operators moderate/update | Separate contribution time, moderation time and meaningful confirmation/dispute evidence; updated_at alone is not verification |
| Municipal | External ID, location, number, street, orientation and geographic FKs; operator update code permits descriptive changes and visibility | Preserve imported source values and local overrides separately so reimport cannot silently erase operator corrections; visibility is local publication state |
| Offstreet | External ID, facility/location/URL/prices/capacities, occupancy and api_state; current admin writes visibility | Static provider metadata, local publication state and live observations have different owners and clocks |
| Rules | Operator-managed country/municipality, URL and nationwide flag | Rule publisher/source URL and last verification of that reference; an edit timestamp is not proof the linked rule is current |

There is no provider-specific importer or persisted source/import-run model in this checkout. Sample factories/seeders are not evidence of a live import contract. Required additions, aligned with the [trust direction](../product/trust-and-provenance.md):

- **Source/dataset registry (#1176):** stable provider and dataset identity, publisher, source URL/license/attribution where available, geographic coverage and upstream record-ID rules. Plan how `(source, external_id)` collisions coexist with existing primary keys and public references.
- **Import runs (#1176):** attempted/completed/last-success times, upstream version or timestamp, status/error, inserted/changed/rejected/missing counts and reconciliation policy. Record disappearance should be evaluated only after a successful complete import, not a failed or partial fetch.
- **Record provenance (#1174/#1176):** source/dataset reference, original source record ID, source-modified time if supplied, first/last seen and last successful observation/import reference. Unknown upstream timestamps must stay unknown; do not backfill them from updated_at as if they were source evidence.
- **Live garages (#1177/#1174):** provider observation time separate from fetched_at and static metadata update time, last successful observation and feed health. Define stale thresholds per feed, reject out-of-order observations, and distinguish unavailable/null from zero spaces. General free/capacity figures must not imply accessible capacity.
- **Community (#1175/#276):** actor, action, reason, occurrence time and evidence references for moderation/correction/restoration, with an explicit retention/anonymization policy. Compute confirmation freshness from meaningful events and preserve disputes, not just a total confirmation count.

## Structural changes worth a compatibility migration

These are recommendations for the next implementation decisions, not changes executed by this audit. The project owner explicitly welcomes breaking changes when they materially improve the platform. Compatibility should be a planned migration cost, not a reason to keep a defective contract indefinitely.

| Recommendation | Benefit and trade-off | Compatibility impact / recommended delivery |
| --- | --- | --- |
| Separate internal imported-record identity from `(dataset/provider, external_id)` | Two municipalities/providers can reuse the same external ID without collision; source changes no longer dictate application identity. Adds a source relationship and reconciliation work. | Under #1176, introduce source-qualified uniqueness and stable internal identity. If changing existing PKs, migrate favorites, public links and Scout documents together, keeping an old-ID lookup during transition. Establish actual datasets/collisions first; do not regenerate IDs just for uniformity. |
| Separate static offstreet facility data from live observations | Facility edits cannot masquerade as fresh occupancy; stale/out-of-order feeds become representable. A latest-observation relation adds query/storage work. | Under #1177, define a snapshot or observation record with observed_at, fetched_at, health and nullable occupancy. Move consumers away from interpreting facility updated_at as feed freshness; define retention before storing every historical sample. |
| Make parking discovery/detail a source-discriminated response contract | Consumers can distinguish community verification, municipal evidence and general garage occupancy instead of guessing from optional fields. Requires an explicit frontend migration. | Under #1170/#1172, build on ParkingDiscovery and expose source-qualified IDs plus source-specific detail. Replace the old three-array map contract deliberately or bridge it temporarily; document changed response types. Persistence remains separate. |
| Represent unavailable favorites explicitly | Deleting/hiding a target stops crashing favorites and users can still remove their saved reference. UI must handle an unavailable state. | Under #195/#276, make target nullable or provide an unavailable result, expose the favorite record ID for deletion, and update clients together. Choose retain-versus-cleanup semantics before migrating old dangling rows. |
| Replace notification-only moderation history with durable domain audit records | Bulk and single actions can retain the same actor/reason/evidence history; users deleting notifications no longer erase the only visible history. Adds retention and access-control obligations. | Under #1175/#276, record actions transactionally and deliver notifications separately. Historical notifications cannot reliably reconstruct a complete audit trail; label the history start rather than fabricating events. |

Recommended order: repair UUID/policy/restore/favorite failures first, establish source and lifecycle contracts second, then migrate discovery and live-data consumers. Adding missing relationships/casts/factories usually needs no destructive schema change. Renaming ParkingSpace, merging the three parking tables or resetting data has no demonstrated benefit here.

## Legacy terminology inventory

At the audited commit, `git grep -niE 'parking.?spots?|userparkingspot'` returned no matches in tracked files. This covers application code, tests, resources/translations, routes, migrations and project documentation; it does not inspect ignored build/dependency files, stored database values, external clients or all historical GitHub comments.

| Location | Finding | Disposition |
| --- | --- | --- |
| Tracked source before this audit | No legacy matches; models, routes, migrations and Scout names already use spaces | Preserve existing names; new glossary/audit mentions of legacy terms are explanatory only |
| #195 checklist | ParkingSpot, ParkingSpotConfirmation, old migration labels and plural ParkingRules | Replace the historical completion checklist with the concrete remaining tasks below and link this audit |
| #276 title | UserparkingSpots; body already says ParkingSpace and points at #1175 | Rename title to ParkingSpace and add concrete deletion/restore findings; keep lifecycle/retention work open |
| #1163 body and new glossary | Explicit explanation of legacy naming | Deliberately retain to prevent reopening the terminology decision |
| Persisted morph types, old notifications, external links/clients | Not inspected by this source audit | No migration or alias removal without an inventory of the deployment being changed |

## Follow-up tasks and acceptance

The audit findings are documented and #195/#276 point to actionable work. Implemented fixes are checked below and have targeted behavior coverage in DomainContractsTest; this does not recreate the earlier standalone spatial/Scout test suite. Product lifecycle decisions remain open.

### #195 — model contracts and integrity

- [x] **Identity:** replace the frontend community writer's `uniqid()` with valid UUID generation; verify an actual submission persists and its returned/deep-linked ID remains unchanged. Preserve opaque imported IDs.
- [x] **Relationships:** add the missing geographic inverses and Favorite owner relation listed above; remove/replace the stale Favorite target-style relation after checking callers; type User confirmations. Verify association retrieval with matching and unrelated records.
- [x] **Casts:** reconcile nullable ApiState, booleans, coordinates and numeric quantities against model/JSON/Inertia/Scout consumers, preserving serialized enum values and nulls.
- [x] **Factories/seeders:** add usable Favorite and ParkingSpaceConfirmation factories; implement or deliberately remove Role's unsupported factory contract; add a national ParkingRule state; make sample seeder prerequisites explicit or supply valid province defaults. Keep destructive baseline seeders limited to fresh installs.
- [x] **Authorization contracts:** repair the model-versus-class policy calls/signatures and stale municipal restore route; verify authorized, forbidden and missing-resource paths.
- [x] **Integrity:** define and enforce national-rule uniqueness/consistency and geographic hierarchy rules using additive migrations after duplicate inspection; coordinate source identity with #1176. Exercise concurrent/duplicate creation cases.
- [x] **Favorites:** handle soft-deleted/missing/invisible targets, allow removing unavailable references and handle concurrent duplicate favorites without a server error; coordinate permanent deletion with #276.
- [x] **Contact:** leave the persistence decision with #674; absence of a Contact model is not evidence of an unfinished required domain table.

### #276 — deletion and restoration, coordinated with #1175

- [x] Preserve UUIDs in restore notifications and links; avoid duplicate force-delete notifications; verify single and bulk notification behavior.
- [ ] Define retention, recovery, permanent deletion, anonymization and actor/evidence history before scheduling any purge.
- [x] Retain unavailable favorites as removable references, including restored/re-published targets.
- [ ] Decide any change to confirmation/evidence retention on space and user deletion; existing cascades remain intact.
- [x] Serialize the existing once-per-application-calendar-day confirmation rule and scope bulk deletion to its intended parent.
- [ ] Evolve confirmation/dispute semantics and evidence retention according to #1175.

### Existing roadmap owners

| Owner | Concrete audit input / acceptance boundary |
| --- | --- |
| [#1164](https://github.com/NIPKaart/core/issues/1164) | Validate coordinate ranges and geographic/address input; reconcile nullable municipal number validation with its non-null column |
| [#1166](https://github.com/NIPKaart/core/issues/1166) | Repair bulk/related-record Scout reconciliation, stale postcode filter setting and transaction/index failure handling; prove published search reflects visibility changes |
| [#1169](https://github.com/NIPKaart/core/issues/1169) / [#1170](https://github.com/NIPKaart/core/issues/1170) | Build on existing ParkingDiscovery; keep source-qualified identity, bounded results and source-specific detail; measure query plans |
| [#1174](https://github.com/NIPKaart/core/issues/1174) / [#1176](https://github.com/NIPKaart/core/issues/1176) | Add registry/run/record provenance with unknown and failed/partial import states; protect local overrides and source-ID collisions |
| [#1175](https://github.com/NIPKaart/core/issues/1175) / [#276](https://github.com/NIPKaart/core/issues/276) | Define evidence and lifecycle semantics before retention/purge implementation |
| [#1177](https://github.com/NIPKaart/core/issues/1177) | Separate static facility data and live general occupancy, including stale/unavailable/out-of-order observations |

## Verification of this audit

Reviewed all application models, migrations, factories, tracked seeders, policies, the registered observer, relevant controllers/requests/routes, FavoriteResource, Scout configuration, spatial service/trait and existing development/product documents. The installed Spatie Role implementation confirms inherited guarded-key and relationship behavior. The later implementation is verified through the dedicated PostgreSQL test database, frontend quality checks and a DDEV production build as described in the resulting contracts; no production/provider state was changed.
