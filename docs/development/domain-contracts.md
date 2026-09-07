# Domain contracts after the audit repairs

Implementation for #1163 / #195 and the concrete restoration/deletion defects from #276. The [audit](domain-model-audit.md) retains the original inventory and larger architecture recommendations; this document describes the resulting behavior.

## Community identity and lifecycle

Community submissions generate UUIDs compatible with `parking_spaces.id`, accept omitted optional parking-time/description fields and redirect to the actual `location-map` route. Requests reject out-of-range coordinates. Imported IDs remain opaque strings.

Restore policy methods receive a ParkingSpace instance, and restore notifications retain its UUID in both database and broadcast payloads. Permanent deletion emits one deletion notification per owner per action. Bulk status changes, restores and permanent deletes visit models in ID chunks so they execute the same model observers as individual operations. UUID constraints on individual restore/delete routes prevent the `bulk` path segment being mistaken for a parking ID. The nonexistent municipal restore route is removed; municipal data does not acquire soft deletes.

Confirmations retain the existing limit of one contribution per user/space/calendar day in the configured application timezone (`UTC` by default). The HTTP writer locks the parent space inside a transaction before checking and inserting, serializing simultaneous requests. Bulk confirmation deletion validates and deletes through the space from the route. This does not invent new report/moderation semantics or a global uniqueness rule for historical imports.

Existing database retention remains: soft deletion retains confirmations and favorites; permanent community deletion cascades confirmations; deleting a user nulls community ownership and cascades that user's confirmations/favorites. No purge scheduler or new retention period is introduced. #1175/#276 still own durable moderation history, report/correction semantics and any change to evidence retention or anonymization.

## Favorites contract

Both the profile list and map dialog now consume:

- `favorite_id`: the user's favorite record ID, usable for deletion even when the target is missing.
- `id` and `type`: the existing target identity and source label, retained for compatible callers.
- `available`: true only for a published community space or visible municipal/offstreet record that still exists.
- `latitude`/`longitude`: numbers when available, otherwise null. Unavailable targets expose an empty title and no address/geographic metadata.

Unavailable references remain saved until the user removes them, and become available again if their target is restored and published. Both UIs label unavailable entries, omit/disable map navigation and offer removal. This nullable-coordinate response must be deployed together with the updated frontend; consumers must check `available` before constructing a map link.

The existing DELETE endpoint accepts either `{favorite_id}` or the legacy `{type, id}` body, scoped to the current user's favorites. It no longer requires a resolvable target. POST still accepts `{type, id}`, rejects unpublished/invisible targets and uses Eloquent's race-safe `firstOrCreate` with the existing unique tuple. Target-type strings stored in the database are unchanged.

## Model consistency and search

Country and Province expose municipalities; Municipality exposes country, province, offstreet spaces and parking rules. Favorite has an owner relationship instead of the erroneous target-style many-to-many relation. User confirmations have a typed relationship.

Favorite, ParkingSpaceConfirmation and Role now have factories. ParkingRule has a `nationwide()` factory state. Sample municipal/offstreet seeders resolve the country by code and can supply a complete Noord-Holland province (`NL-NH`) without the baseline reference seeders. The existing CountrySeeder/ProvinceSeeder remain fresh-install-only tools.

Parking booleans, numeric quantities, coordinates, nationwide rules and nullable ApiState now have explicit casts. Serialized backed enum values remain strings; unknown/null ApiState remains null in model JSON. ParkingOffstreet permits assignment of local `visibility` alongside geographic FKs; source-controlled facility/occupancy fields remain guarded.

Municipal/offstreet bulk visibility writes retain model events. Under #1195, PostgreSQL search reads publication flags and related geography directly; changes are visible without remote indexing or reconciliation. See the [search audit](infrastructure.md).

## Database integrity and rollout

The additive `2026_09_07_190000_enforce_domain_integrity` migration enforces:

- `nationwide` is true exactly when a rule has no municipality.
- At most one national rule per country (partial unique index); municipal uniqueness remains as before.
- A municipality's province belongs to its country.
- Each parking record's municipality, province and country belong to the same hierarchy.
- A municipal rule's municipality belongs to its country.

Normal rule requests validate uniqueness, scope and URL length before saving, and edits exclude their own record from duplicate detection. Geographic editing validates the same parent hierarchy. Rule/Role instance policy calls are corrected, and national rules no longer accidentally empty the available-municipalities selector through a SQL `NOT IN (NULL)` condition.

The migration validates existing rows, runs transactionally on PostgreSQL, and fails on conflicts. It never deletes duplicate rules, chooses a geographic owner or rewrites identifiers. Before applying to a populated environment, inspect conflicts using read-only SQL, reconcile them explicitly, and retry. These queries return only conflict counts:

```sql
SELECT count(*) AS invalid_rule_scopes FROM public.parking_rules
WHERE nationwide <> (municipality_id IS NULL);

SELECT count(*) AS duplicate_national_countries FROM (
    SELECT country_id FROM public.parking_rules WHERE municipality_id IS NULL
    GROUP BY country_id HAVING count(*) > 1
) AS conflicts;

SELECT count(*) AS invalid_municipality_hierarchies
FROM public.municipalities m JOIN public.provinces p ON p.id = m.province_id
WHERE m.country_id <> p.country_id;

SELECT count(*) AS invalid_parking_hierarchies FROM (
    SELECT municipality_id, province_id, country_id FROM public.parking_spaces
    UNION ALL SELECT municipality_id, province_id, country_id FROM public.parking_municipal_spaces
    UNION ALL SELECT municipality_id, province_id, country_id FROM public.parking_offstreet_spaces
) AS parking JOIN public.municipalities m ON m.id = parking.municipality_id
WHERE parking.province_id <> m.province_id OR parking.country_id <> m.country_id;

SELECT count(*) AS invalid_municipal_rule_countries
FROM public.parking_rules r JOIN public.municipalities m ON m.id = r.municipality_id
WHERE r.country_id <> m.country_id;
```

Take normal migration backups and allow for table validation/index creation locks. Rollback removes only the new constraints/indexes; it does not restore removed favorites or undo other user actions. The migration has been exercised on the dedicated test database, including refusal of duplicate pre-existing rules without data loss. No application/production database was migrated as part of this delivery.

## Verification and remaining architecture

`tests/Feature/DomainContractsTest.php` exercises real submission, favorite and authorization endpoints, notification identity/counts, bulk lifecycle behavior, daily confirmations, parent-scoped deletion, persisted casts/relations/factories, sample seeders and PostgreSQL constraints. Search tests execute real PostgreSQL queries, including visibility changes without index synchronization.

The source-qualified identity migration, separation of facility metadata/live observations, richer discovery API and durable moderation history remain with #1176, #1177, #1170/#1172 and #1175/#276 respectively. Their benefits and compatibility costs are documented in the audit. These product models are not silently invented by the baseline repair, and #276 remains open.
