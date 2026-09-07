# Garage and P+R fallback direction

`ParkingOffstreet` should become part of the same destination workflow as on-street accessible parking, while preserving the semantic differences between facility and accessible-space data.

## Product role

Garages/P+R are alternatives when:
- the user explicitly requests them;
- nearby on-street results are absent/insufficient;
- the user broadens the search to alternatives.

A separate garage overview may still be useful, but it should not be the only way to discover offstreet options.

## Occupancy semantics

NIPKaart currently has general free/capacity data. This must not be described as accessible-space availability unless the upstream source explicitly provides accessible-space occupancy/capacity.

Represent separately:

- facility open/operational state, if known
- general capacity
- general current free spaces
- accessible-space capacity, if known
- accessible-space current availability, only if explicitly provided
- live observation timestamp
- live feed health/freshness

Examples of safe UI meaning:

- “37 spaces available in garage” — only if general occupancy is live/current.
- “Accessible parking spaces: 4” — only if accessible capacity is known.
- “Accessible-space availability: unknown” — when only general occupancy is known.

Never turn “37 general spaces free” into “accessible parking available”.

## Destination integration

For each offstreet result, show:
- distance to destination
- facility name/type
- known accessible-parking metadata
- general live occupancy where useful and clearly labelled
- data freshness
- navigation handoff
- source/provider

## Future provider integrations

Model provider/source identity and freshness independently enough that multiple live providers can be supported. Prefer adapters/importers around a stable internal representation rather than provider-specific fields leaking into the discovery UI.
