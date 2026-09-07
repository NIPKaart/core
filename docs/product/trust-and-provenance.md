# Trust, provenance and freshness direction

NIPKaart combines information with very different trust characteristics. The UI must make those differences understandable instead of flattening everything into identical markers.

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

## Coverage transparency

A future area/municipality coverage view should distinguish:

- official dataset available and healthy
- official dataset available but stale/unhealthy
- community coverage only
- garage/live provider coverage
- no known data

“No result” must not automatically mean “no accessible parking exists.” It may mean NIPKaart has no data for that area.
