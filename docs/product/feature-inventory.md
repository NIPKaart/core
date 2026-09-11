# NIPKaart product feature inventory

Date: 2026-09-07

This inventory separates the product roadmap from the Laravel 13 modernization in #1158.

## Product promise

NIPKaart should help a disabled parking card holder answer four questions before and during a trip:

1. **Where can I park near my destination?**
2. **Can I actually use this parking option?**
3. **What is the best fallback if the preferred option is unavailable?**
4. **How trustworthy and current is the information?**

The map is a means to answer these questions, not the product goal by itself.

## Current feature matrix

| Capability | State | Evidence / backlog | Product direction |
| --- | --- | --- | --- |
| Unified parking map | Works | Map renders `ParkingSpace`, `ParkingMunicipal` and `ParkingOffstreet` markers | Keep as core surface, evolve toward destination-first discovery |
| Current-location control | Works | Leaflet locate control | Keep |
| Shareable map position | Works | URL hash synchronization | Keep; later support destination/result deep links |
| Marker clustering | Works | Community/municipal and offstreet clusters | Keep, revisit when viewport querying is introduced |
| Community parking details | Works | `ParkingSpace` modal/API | Evolve into a consistent parking-detail experience |
| Municipal parking details | Works | `ParkingMunicipal` modal/API | Add source/freshness/trust context |
| Garage/P+R details | Works | `ParkingOffstreet` modal/API | Evolve into a fallback parking experience |
| Live garage occupancy presentation | Partial | Occupancy status icon/data exists | Add freshness, accessible-space semantics and fallback ranking |
| Community contribution | Works/partial | Map create flow + `ParkingSpace` domain | Redesign as contribution lifecycle with moderation/trust |
| Community confirmations | Works | `ParkingSpaceConfirmation` + policy/UI | Evolve into explicit verification/trust signal |
| Favorites | Works | Favorite domain/profile/map UI | Keep; integrate into destination workflow |
| Search | Works/partial | PostgreSQL parking-record text search (#1195) | Shift from record search toward destination + nearby parking discovery |
| Internationalization | Mostly works | #329; frontend home/contact remain incomplete | Product-wide requirement, not a standalone feature |
| Garage overview | Placeholder | #668 and placeholder page | Rethink around fallback/discovery rather than a simple list |
| Home page | Placeholder/legacy | #246/#329; current page minimal | Rebuild around destination search and product promise |
| Contact | Placeholder | #674 | Low priority product/support surface |
| User dashboard | Partial/legacy concept | #335 | Rethink around useful personal activity, not global counters |
| Municipal bulk management | Backlog | #455 | Keep as operator/admin capability |
| Weekly new-space report | Backlog | #663 | Re-evaluate audience and operational value |
| Data provenance/freshness | Missing | Identified in #1163 | Core trust capability |
| Dataset coverage visibility | Missing | — | Show what official/community/live coverage exists by area |
| Destination-first discovery | Missing | — | Core next-generation experience |
| Distance/radius results | Missing | `_geo` already indexed | Core discovery capability |
| Parking suitability filters | Missing/limited | Parking attributes exist | Core discovery capability |
| Unified result ranking | Missing | Search currently merges indices | Rank by distance, type, trust and availability without claiming false suitability |
| Navigation handoff | Missing | — | Open selected parking/destination in navigation app |
| Report incorrect/outdated data | Missing | — | Core trust/community capability |
| Photos/evidence | Missing | — | Useful for community verification; privacy/moderation required |
| Saved destinations/preferences | Missing | — | Later personalization; avoid sensitive profiling |
| Public coverage/status | Missing | — | Useful for transparency and dataset acquisition |
| Public API/data sharing | Partial/unclear | Existing API/Sanctum | Define only after internal read model is stable |

## Product streams

### 1. Destination discovery

The primary entry point should become a destination/address/place search. After choosing a destination, NIPKaart should show nearby parking options in both map and result form, with configurable radius and useful sorting/filtering.

The user should not need to know whether a result originates from `ParkingSpace`, `ParkingMunicipal` or `ParkingOffstreet` before searching.

### 2. Parking detail and suitability

Create a shared information model for what users need to decide whether a parking option is useful: location, distance to destination, parking type, restrictions/rules, orientation/physical details where known, availability where meaningful, source, last update and trust status.

Do not infer accessibility or legal suitability from incomplete data. Clearly distinguish known, unknown and source-specific fields.

### 3. Community contribution and trust

Treat community data as a lifecycle:

`submitted -> moderated -> published -> confirmed/disputed -> corrected -> archived`

Confirmations should contribute to an understandable trust signal. Users need a low-friction way to report a missing, moved, inaccessible or otherwise incorrect space.

### 4. Official/open-data coverage

Municipal data needs provenance and freshness. Track source, source URL/identifier where appropriate, last successful import, source data timestamp if available, coverage area and import health.

This enables NIPKaart to explain whether an area has official data, community-only data, stale data or no known coverage.

### 5. Garages and live fallback

Offstreet parking should be a first-class fallback when a suitable on-street option cannot be found. Separate general garage occupancy from known accessible-space capacity/availability; never present general free-space counts as accessible-space availability.

### 6. Search, geo and ranking

Build a shared parking discovery/read layer across the three parking aggregates. Keep source tables separate. Use PostgreSQL/PostGIS radius and viewport queries to retrieve candidates near a destination resolved by a separate geocoding provider.

Ranking should be explainable and initially conservative: distance, parking category, source/trust and live availability where semantically valid. Personal suitability scoring is a later feature and must be based only on explicit, non-sensitive preferences.

### 7. Personal experience

Favorites are already useful. Later additions can include saved destinations, recent destinations and non-sensitive display/filter defaults. Accounts should enhance NIPKaart, not be required for basic parking discovery.

### 8. Accessibility and inclusive UX

Accessibility is a product requirement across every stream. Map-only interaction is insufficient: important parking results and controls need keyboard/screen-reader-accessible non-map equivalents, clear states, sufficient touch targets, meaningful labels and understandable source/trust information.

## Proposed delivery horizons

The [data foundation plan](data-foundation.md) refines this sequencing as of 2026-09-08: the minimum operational dataset registry, import history and correction preservation are part of the first data delivery, rather than waiting for Horizon 2. The [work packages](../development/data-foundation-delivery.md) define the implementation and acceptance gates. Broader coverage, automated contributor trust and mobile remain later work; source research/CRM is outside platform scope.

### Horizon 1 — Relaunchable core

- destination/address search
- nearby parking result list + map
- radius and core filters
- unified parking detail presentation
- distance + navigation handoff
- source/freshness indicators
- report incorrect data
- preserve community add/confirm/favorite flows
- garage fallback with honest occupancy semantics

### Horizon 2 — Trust and coverage

- dataset/source registry
- import health and freshness
- municipal coverage visibility
- richer community verification/moderation
- photos/evidence where justified
- improved geo/ranking

### Horizon 3 — Personalization and platform

- saved destinations/preferences
- notifications only for concrete user value
- public coverage/status surfaces
- stable public API/data-sharing strategy
- richer live-data integrations

## Existing backlog disposition

- #195: domain inventory; supersede terminology with `ParkingSpace` and close after #1163 audit.
- #246: navigation checklist is implementation-oriented; replace with product IA after destination discovery is designed.
- #269: handle under auth modernization #1162, not product roadmap.
- #276: community moderation/trust concern; fold relevant behaviour into the community trust stream after terminology cleanup.
- #329: i18n remains a cross-cutting requirement; complete home/contact when those surfaces are rebuilt.
- #335: rethink dashboard; global counters are weak user value for a parking-card holder.
- #455: retain as admin/operator tooling, subordinate to data operations.
- #663: re-evaluate as an operator report rather than automatically building it.
- #668: supersede simple garage-list framing with garages/live-fallback product stream.
- #674: retain as low-priority support surface.

## Product principles

1. Destination-first, not dataset-first.
2. Basic discovery works without an account.
3. Official, community and live data remain distinguishable even when presented together.
4. Unknown data is shown as unknown; never manufacture certainty.
5. General garage occupancy is not accessible-space availability.
6. Trust comes from provenance, freshness and verification, not a decorative score.
7. Map interaction always has an accessible non-map counterpart for essential tasks.
8. Keep source/domain models separate and build shared read models for discovery.
9. Prefer useful, testable increments over a single product rewrite.
10. Avoid collecting sensitive personal information unless a concrete feature truly requires it.
