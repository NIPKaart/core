# Product accessibility direction

NIPKaart serves a disability-related use case, so accessibility cannot be treated as a final QA pass.

## Core principle

Every essential task that can be completed through the map must also have an understandable, keyboard-operable non-map path.

For destination discovery this means a result list and detail surface must remain usable without manipulating Leaflet markers.

## Baseline requirements

- semantic landmarks/headings and predictable focus order
- full keyboard operation for search, filters, results, details and contribution flows
- visible focus states
- screen-reader names for controls, status indicators and map/result relationships
- sufficient touch targets and spacing
- no information encoded by color alone
- meaningful loading, empty, error and stale-data states
- reduced-motion considerations
- dialogs/drawers with correct focus management
- accessible validation/error summaries
- map controls that do not block the equivalent list workflow
- source/trust/availability states expressed as text, not icon-only

## Map/result relationship

Selecting a result should be able to focus/highlight the map marker, but map interaction must not be required to open or understand a result.

Selecting a marker should synchronize the corresponding result/detail where practical.

Clustering must not make records unreachable to keyboard/screen-reader users; the result list remains the authoritative accessible browse surface.

## Content clarity

NIPKaart should explicitly distinguish:
- known information
- unknown information
- estimated/derived information
- live information and its age
- official versus community information

Avoid jargon based on internal model names.

## Testing direction

Add accessibility checks at component/page level where practical, but retain manual keyboard and screen-reader acceptance for core flows:

1. search destination
2. browse nearby parking options
3. filter results
4. inspect details/source/freshness
5. open navigation handoff
6. add a community parking space
7. report/confirm information
