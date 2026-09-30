# Domain contracts after the audit repairs

Implementation for #1163 / #195 and the concrete restoration/deletion defects from #276. The [audit](domain-model-audit.md) retains the original inventory and larger architecture recommendations; this document describes the resulting behavior.

## Community identity and lifecycle

Community submissions generate UUIDs compatible with `parking_spaces.id`, accept omitted optional parking-time/description fields and redirect to the actual `location-map` route. Requests reject out-of-range coordinates. Imported IDs remain opaque strings.

Restore policy methods receive a ParkingSpace instance, and restore notifications retain its UUID in both database and broadcast payloads. Permanent deletion emits one deletion notification per owner per action. Bulk status changes, restores and permanent deletes visit models in ID chunks so they execute the same model observers as individual operations. UUID constraints on individual restore/delete routes prevent the `bulk` path segment being mistaken for a parking ID. The nonexistent municipal restore route is removed; municipal data does not acquire soft deletes.

Confirmations are source-independent (#1311): a signed-in, eligible user confirms that a published community or municipal place exists through `POST map/places/{source}/{id}/confirm` (`source` is `community` or `municipal`; garages are facilities and cannot be confirmed). A confirmation means only "this disabled parking place exists here"; it records no status choice or comment, and proposing an improvement is a separate action. Each confirmation targets exactly one place through its own foreign key (`parking_space_id` or `parking_municipal_id`, enforced by a check constraint), so removing either place removes its confirmations. Until #1312 links community and municipal records of the same bay, the source-qualified record is the logical place.

The limit of one confirmation per user/place/calendar day in the configured application timezone (`UTC` by default) remains. The writer locks the place inside a transaction before checking and inserting, serializing simultaneous requests. Public community and municipal details expose `confirmations_count.confirmed`, `last_confirmed_at` and the viewer's `confirmed_today`; no reliability score is derived. Legacy `moved`/`unavailable` rows remain for moderators but are not counted. Bulk confirmation deletion validates and deletes through the space from the route.

Existing database retention remains: soft deletion retains confirmations and favorites; permanent community deletion cascades confirmations; deleting a user nulls community ownership and cascades that user's confirmations/favorites. No purge scheduler or new retention period is introduced. #1175/#276 still own durable moderation history, report/correction semantics and any change to evidence retention or anonymization.

## Reports of disappeared places

Reports (#1313) follow the same place identity as confirmations: `POST map/places/{source}/{id}/report` accepts a published community or municipal place, an optional `ReportReason` (what the reporter saw: sign or bay removed, now a regular bay, something else) and an optional note of at most 500 characters. A report never hides or deletes anything. A user has one open report per place (enforced by partial unique indexes), and may report again once a moderator has decided. Public detail JSON exposes only the viewer's own `reported_by_you`; report counts stay internal.

Moderators (`parking-place-report.view_any` and `.resolve`) work from the queue at `app/reports`. Each reported place appears once, with its open reports and notes, and the existence confirmations given since the first open report. They either keep the place, also when existence stays uncertain, which closes its reports, or remove it with a required `RemovalReason`:

- a community place is deleted permanently, together with its confirmations, reviews, reports and favorites;
- a municipal place is hidden through `visibility`, which later imports preserve; its confirmations, favorites and resolved reports remain.

Each reporter with an open report hears the decision in a notification: kept (with a link back to the place) or removed (with the reason). Every removal writes a `ParkingPlaceRemoval` with source, identity, label, action, reason, note, open report count and moderator. There is no report threshold and no resurrection state: re-adding a place later is a new contribution. After deploying, run `php artisan db:seed --class=PermissionsTableSeeder --force` so moderators receive the new permissions.

### Street-place detail dialog

The detail of a community or municipal place has two tabs. **Info** holds the facts and one existence question, "Is de plek er nog?": *Ja* confirms at once, *Nee* opens a report step inside the same sheet. After confirming or reporting, the question gives way to the outcome until the next day or the moderator's decision. **Bijdragen** shows the confirmation evidence, the place's sources, the report action and the visitor's own activity; improving information (#1310, community places only) is offered there, and linked sources (#1312) belong there. Signed-out visitors see only the facts plus a quiet "Log in" hint that returns them to the same place. Garages keep a single view without these parts.

## Improvements of community places

Any signed-in, eligible user can propose an improvement to a published community place (#1310) from the Bijdragen tab. It reopens the add flow at `map/places/community/{id}/improve`, filled with the current pin and details, and applies the same rules as a new contribution: required orientation, under-sign details only with an under-sign, a note of at most 500 characters. Unlike a new contribution, an unknown under-sign may stay unknown. A moved pin is reverse-geocoded again and must resolve a country and municipality; it then replaces the whole location, including a new municipality or province, without a separate move workflow. Paid/free, dimensions and generic accessibility attributes are not part of the flow.

A `ParkingSpaceImprovement` stores only the changed values in `submitted` and never changes the public place. A user has one pending proposal per place (partial unique index); a proposal that changes nothing is refused. Public detail JSON exposes only the viewer's own `improvement_pending`.

Moderators (`parking-space-improvement.view_any` and `.review`) work from `app/improvements`. The **Open** tab is a paginated table, oldest first, that can be searched by street, municipality or proposer and filtered by municipality and kind of change (location, bay, under-sign, note). A row flags only what stands out: a move to another municipality, several open proposals for the same space or an open report, and a proposer who is new or mostly rejected. Several proposals can be rejected at once, for example spam; approving always happens one proposal at a time.

A proposal opens on its own page at `app/improvements/{id}` with its place in the queue and previous/next links. It lists only the changed fields, current value above the proposed one. The moderator unticks what not to take over, or adjusts a value in place (the location also by dragging the proposed pin on the map), and approves, or rejects with an `ImprovementRejectionReason` (does not match the situation, insufficient information, spam, other) and an optional note. Either decision continues with the next open proposal. Approval stores `approved` and the replaced `previous` values; the **Decided** tab shows each decision with what was submitted and what was applied. The proposer hears the decision in a notification, with the rejection reason when there is one and a link back to the space; moderators get no notification per proposal and follow the sidebar count instead. Municipal places are not improvable: imported records remain source-authoritative, and a display location separate from the source coordinates belongs with #1312. After deploying, run `php artisan db:seed --class=PermissionsTableSeeder --force` so moderators receive the new permissions.

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
