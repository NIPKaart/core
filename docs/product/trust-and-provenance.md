# Trust, provenance and freshness direction

NIPKaart combines information with very different trust characteristics. The UI must make those differences understandable instead of flattening everything into identical markers.

The [European data foundation](data-foundation.md), [batch import contract](../development/data-import-contract.md) and [delivery plan](../development/data-foundation-delivery.md) elaborate this direction as of 2026-09-08. Independent Python collectors schedule collection and publish complete versioned files; core discovers, validates and publishes their information while preserving corrections. Core does not coordinate workers. Source research and CRM workflows remain outside the platform. These are design documents, not implemented capabilities.

## Source classes

### Community (`ParkingSpace`)

Trust signals can include:
- publication/moderation status
- creator/update timestamps
- confirmation/dispute history
- last meaningful verification
- optional evidence/photos in a later phase

### Municipal/open data (`ParkingMunicipal`)

Trust signals should include:
- municipality/source identity
- source dataset identifier/URL where publishable
- last successful NIPKaart import
- source-provided data timestamp when available
- import status
- coverage scope

### Offstreet/live (`ParkingOffstreet`)

Separate relatively static facility metadata from live observations.

Trust/freshness should include:
- facility/source/provider
- static metadata update time
- live-feed observation time
- live-feed health/state
- explicit distinction between total/general occupancy and accessible-space information

## User-facing states

Avoid a single unexplained numeric trust score. Prefer understandable labels and metadata such as:

- Official data
- Community contributed
- Confirmed recently
- Last updated …
- Live data updated … ago
- Live data unavailable
- Source data may be outdated
- Accessibility capacity unknown

Exact copy/design belongs to implementation/UX work, but the underlying states must be explicit.

## Dataset/source registry direction

Introduce a source/import concept before expanding municipal coverage substantially. It should be able to answer:

- What is the source?
- Who owns/publishes it?
- What geographic area does it cover?
- What kind of parking data does it contain?
- When did NIPKaart last attempt and successfully complete an import?
- What timestamp/version did the upstream source provide?
- How many records were imported/changed/rejected?
- Is the source currently healthy?

Do not overload individual parking records with every import-run concern; use source/import-run entities where appropriate and retain record-level provenance identifiers needed for reconciliation.

## Community correction flow

A published parking option should support reporting problems such as:

- location no longer exists
- location/coordinates are wrong
- restrictions/details are wrong
- duplicate
- temporarily unavailable/changed (only if the product can handle temporary state reliably)

Reports should feed moderation/correction, not instantly mutate trusted source data.

The [proposed contribution terms and retention policy](data-foundation.md#91-algemene-bijdrageafspraken) apply across new community places, confirmations, disputes, reports and corrections. They remain a proposal until explicitly adopted and implemented. Public provenance does not expose contributor identity or private moderation evidence.

[Core #1218](https://github.com/NIPKaart/core/issues/1218) settled corrections to imported `ParkingMunicipal` and `ParkingOffstreet` records: sources stay authoritative, reimports keep identities, favorites and management visibility, and a locally differing field blocks publication rather than being silently overwritten. There is no field-override or contributor proposal flow for imported records; offstreet names, types and locations are fixed in the collector or at the source. Live occupancy is a separate observation stream, never a manual override. See the [decision](../development/data-foundation-delivery.md#correcties-op-geïmporteerde-records-1218).


## Coverage transparency

A future area/municipality coverage view should distinguish:

- official dataset available and healthy
- official dataset available but stale/unhealthy
- community coverage only
- garage/live provider coverage
- no known data

“No result” must not automatically mean “no accessible parking exists.” It may mean NIPKaart has no data for that area.
