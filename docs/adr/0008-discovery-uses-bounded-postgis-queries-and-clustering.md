---
status: accepted
date: 2026-09-26
---

# Discovery uses bounded PostGIS queries and clustering

NIPKaart discovery must scale beyond loading every parking record into the browser. Core uses PostgreSQL/PostGIS as the authoritative query engine for parking records and serves bounded radius/viewport result sets through a shared discovery read model.

The map may automatically refresh as the viewport changes; this architectural decision does not require a visible “search this area” interaction. At low zoom levels, presentation may cluster nearby results without merging their underlying identities.

## Consequences

- The browser requests current viewport/radius data plus an appropriate margin rather than the complete European dataset.
- Map and list are backed by the same normalized discovery result set.
- PostgreSQL remains the first choice for NIPKaart-owned text/geospatial search; external search infrastructure is added only for a demonstrated limitation.
- Destination/POI/address geocoding remains a separate provider concern and requires a dedicated provider evaluation.
- Clustering is presentation, not deduplication: adjacent physical bays remain independently addressable.
- Ranking stays deterministic and explainable, combining distance and parking type/preferences rather than applying one absolute type ordering.
- The accessible result list remains a first-class path independent of map manipulation.

## References

- [Discovery read-model direction](../product/discovery-read-model.md)
- [Product accessibility direction](../product/accessibility.md)
