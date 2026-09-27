# Parking discovery read-model direction

This document supports the product roadmap epic and deliberately does **not** propose merging `ParkingSpace`, `ParkingMunicipal` and `ParkingOffstreet` persistence models.

Implementation status: `App\Services\ParkingDiscovery` already combines the three sources for bounded PostGIS radius/viewport queries, including source-qualified identity and publication filters. Viewport results report their straight-line distance to a selected destination without changing their order. Opening any result shows one detail view (#1172) with the same section order for every source: navigation, rules, layout, accessibility/availability and source/freshness. It fetches the source-specific detail endpoint and shows missing fields as unknown. Navigation hands off coordinates, not the address, to Google Maps, Apple Maps, OpenStreetMap or a `geo:` app. The public map loads every public record once per Web Mercator area tile (`map/parking/area/{x}/{y}`, zoom 9) in a compact form and clusters it in the browser with Leaflet.markercluster, so zooming never reloads data. A cached index (`map/parking/areas`) lists the areas that contain public parking, so empty areas are never requested. Areas are cached briefly on the server and in browsers, so publication changes can take up to about two minutes to appear on the map. Destination browsing shows a filtered page from the radius query on the map; browsing without a destination retains the area tiles. Extend this service toward the richer contract below; see the [domain audit](../development/domain-model-audit.md) for current model boundaries and remaining integrity/provenance work.

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
- PostgreSQL owns parking-record text search; a separate geocoding provider resolves destinations (#1195/#1169).
- Use PostgreSQL/PostGIS for exact radius/bounds queries.
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

## Discovery filter semantics (#1173)

Destination browsing supports one source selection (`all`, `community`, `municipal`, `offstreet`) and a straight-line radius of 250, 500, 1000, 2000, 5000 or 10000 metres (default 1000). Community and municipal records represent street spaces; offstreet records represent facilities such as garages/P+R. This is a source-based grouping, not a guarantee of physical layout or suitable accessible capacity. PostGIS applies the inclusive radius and publication eligibility before sorting and pagination. The nearby API also accepts integer radii from 50 through 10000 metres.

The UI defaults to `balanced`: order by actual distance plus 250 metres for an offstreet facility, then actual distance, source and identifier. This gives street spaces a bounded preference; a garage more than 250 metres closer outranks a street space. `distance` sorts solely by actual distance, source and identifier. The displayed distance is always the actual straight-line distance, never the adjusted ordering value. This preference is a transparent product rule, not an accessibility or suitability score. The API retains `distance` as its default for existing callers.

The map consumes pages of 100 results, with previous/next controls when needed; all matching results remain reachable. Panning does not change the destination search. Filters open in a mobile drawer or desktop dialog. Changes, including resetting to all sources, 1000 metres and category-plus-distance, remain drafts until Apply; closing cancels the draft. Applying resets pagination and clears selection. Source, radius and sort are reflected in the URL alongside the destination and survive panning and reopening a shared link. The map/list switch has been removed. Desktop search uses an inline field with suggestions; mobile search expands from the navbar icon and collapses after choosing a destination. Detail uses the existing responsive overlay; navigation stays inside the existing detail surface. The current result page is not shared.

Parking-time restrictions, parking-disc requirements and physical layout do not yet have a consistent normalized discovery contract and are not offered as filters. Unknown values are neither treated as false nor used as ranking penalties. Freshness/verification filtering awaits #1174. Occupancy filtering awaits #1177; general facility occupancy never establishes accessible-space availability. Visibility is always an eligibility requirement, not a ranking advantage.
