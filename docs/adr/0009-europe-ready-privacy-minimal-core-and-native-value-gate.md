---
status: accepted
date: 2026-09-26
---

# Build an Europe-ready, privacy-minimal core and require native value for mobile

NIPKaart is designed for European expansion while prioritizing excellent Dutch coverage first. Data structures must not assume Dutch-only identifiers or administrative conventions. A supported foreign dataset may be published before broad coverage exists in that country when its provenance and quality requirements are met.

Location-based discovery uses the user's current location client-side and does not create a location history. NIPKaart does not collect disability details or parking-card identifiers for discovery.

A native mobile application is not a goal by itself. Native development proceeds only when research demonstrates meaningful value beyond the responsive web/PWA experience.

## Consequences

- UI launches with Dutch and English and remains structurally ready for additional languages.
- Foreign source information does not require automatic translation to be stored or linked.
- PWA capability may be used where it provides concrete value.
- Mobile discovery evaluates share-to-NIPKaart, widgets/shortcuts, native push, offline use, GPS-assisted contributions and CarPlay/Android Auto.
- Offline support is not a web-v1 requirement.
- Public bulk API/open-dataset licensing is a separate unresolved decision; open-source code does not by itself define redistribution rights for the aggregated data.
- Geocoding/POI provider selection is also unresolved and requires research covering European quality, privacy, caching/licensing, cost and lock-in.

## References

- [European data foundation](../product/data-foundation.md)
- [Product accessibility direction](../product/accessibility.md)
