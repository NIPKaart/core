# Parking discovery read-model direction

This document supports the product roadmap epic and deliberately does **not** propose merging `ParkingSpace`, `ParkingMunicipal` and `ParkingOffstreet` persistence models.

Implementation status: `App\Services\ParkingDiscovery` already combines the three sources for bounded PostGIS radius/viewport queries, including source-qualified identity and publication filters. The frontend map still loads separate collections. Extend this service toward the richer contract below; see the [domain audit](../development/domain-model-audit.md) for current model boundaries and remaining integrity/provenance work.

## Problem

The current map and search code know about three separate datasets and normalize them ad hoc in presentation/search code. The next product experience needs to ask a source-agnostic question:

> Which parking options are useful near this destination?

## Proposed concept

Introduce an application/read-model boundary such as `ParkingOption` / `ParkingResult` (final naming to be decided during implementation) that can represent a discovery result from any source.

Minimum normalized fields should include:

- stable source-qualified identifier
- source type: community / municipal / offstreet
- latitude / longitude
- display title/address
- distance from requested destination (computed for a query, not persisted blindly)
- known parking restrictions/details
- source/provenance summary
- data/verification freshness
- availability summary only when semantically valid
- route/deep-link target

Source-specific detail remains available behind the result; normalization must not erase distinctions or pretend all three models have equivalent fields.

## Query flow

1. Resolve a user-entered destination/place/address to coordinates.
2. Query candidate parking options within a radius.
3. Normalize candidates into the shared read representation.
4. Apply explicit filters.
5. Rank conservatively and explainably.
6. Return a list plus map coordinates from the same result set.
7. Fetch source-specific detail when a result is opened.

## Important constraints

- Do not merge the three database tables for convenience.
- Do not claim general garage occupancy means accessible parking availability.
- Do not hide provenance/source type.
- Do not make Meilisearch the domain model. It can be one query implementation behind the discovery service.
- Keep a database/geospatial fallback path in mind for exact radius/bounds queries.
- Avoid sending every parking record to the browser as the dataset grows; move toward viewport/radius queries.
- Result ranking must remain deterministic/testable and should expose the reason for important ordering choices.

## Initial ranking inputs

For the first iteration, candidates may use:

1. distance to destination;
2. requested parking categories/filters;
3. data visibility/publication status;
4. source freshness / community verification state;
5. live availability only for data that truly describes the relevant parking capacity.

Do not introduce opaque AI/vector ranking for this core flow.

## API shape direction

A future endpoint could conceptually accept:

- destination coordinates
- radius
- source/type filters
- restriction filters
- pagination/limit

and return normalized parking results plus metadata about coverage/freshness. Exact HTTP/API design should follow the application service/read model rather than lead it.

## Testing expectations

- same destination/radius returns consistent candidates
- no hidden cross-source field assumptions
- distance calculations and radius boundary cases
- unpublished/invisible data excluded
- stale/unknown freshness represented honestly
- garage occupancy semantics tested separately from accessibility metadata
- source-specific detail remains reachable
