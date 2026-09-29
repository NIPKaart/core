---
status: accepted
date: 2026-09-26
---

# Resolve destinations internally first with controlled external geocoding

Destination search resolves what a person wants to park near: a place, address, postcode or point of interest. It is separate from parking-record retrieval. Once a destination has coordinates, [ADR 0008](0008-discovery-uses-bounded-postgis-queries-and-clustering.md) applies and parking results come from bounded PostGIS queries through `ParkingDiscovery`. A geocoder never selects, filters or ranks parking records.

This resolves the geocoding/POI provider question left open in [ADR 0009](0009-europe-ready-privacy-minimal-core-and-native-value-gate.md), as decided for [#1169](https://github.com/NIPKaart/core/issues/1169).

## Decision

Destination resolution is **internal first, with Geoapify and public Nominatim as controlled external fallbacks**. All provider calls go through core (`/destinations/suggestions` and `/destinations/resolve`). The browser never calls a geocoder directly and never receives provider credentials.

| Path | Order |
| --- | --- |
| Autocomplete (while typing) | Internal published parking/street matches from PostgreSQL; from 3 characters, Geoapify autocomplete merged and deduplicated with them. The client debounces (~450 ms) and aborts superseded requests. |
| Explicit submit of unresolved text | Cached result → public Nominatim when enabled and within budget → Geoapify search → best internal match. |
| Selecting a suggestion | Uses the suggestion's normalized coordinates/bounds directly; no second geocoding call. |

Every path normalizes to the same destination contract: `key`, `label`, `sub`, `type`, `latitude`, `longitude` and optional `bounds`/`parking_count`. No other provider metadata is kept.

Administrative areas (country, province, municipality) are not resolved internally until NIPKaart holds authoritative geometry for them. Centroids derived from incidental parking records would imply false precision. For the same reason, NIPKaart does not build a partial address geocoder from parking addresses to avoid external calls.

## Why these providers

- **Geoapify** provides European POI/address/postcode autocomplete and search on OpenStreetMap-based data. Its free plan permits commercial production use and has a predictable quota. It sits behind the `DestinationGeocoder` contract, so it can be replaced without changing the frontend or discovery code.
- **Public Nominatim** is free, OSM-native and good at explicit address/place lookups. Its usage policy forbids autocomplete and heavy use, so it is used only for explicit submits.
- **Mapbox** (already used for map tiles) was not chosen for geocoding. Its temporary-geocoding terms restrict storing results, which conflicts with backend caching and with saving normalized destinations. It would also deepen lock-in to one vendor.

## Limits and safeguards

| Provider | External limit (at time of writing) | NIPKaart safeguard |
| --- | --- | --- |
| Geoapify free plan | 3,000 credits/day, up to 5 requests/second; "Powered by Geoapify" attribution required | Minimum 3 characters for external autocomplete, client debounce and cancellation, 24-hour backend cache per query/limit, 3-second timeout. Inert when `GEOAPIFY_API_KEY` is empty. |
| Public Nominatim | Maximum 1 request/second, no autocomplete, identifying User-Agent, results must be cached, OSM attribution required | Explicit submit only; application-wide `nominatim-public` limiter of 1 request/second; no automatic retries; 24-hour cache (including "no result"); identifying `NOMINATIM_USER_AGENT`. `NOMINATIM_PUBLIC_ENABLED=false` disables it by configuration without a frontend release. |
| NIPKaart endpoints | — | `/destinations/*` share a 60 requests/minute budget per user or IP, separate from the parking-discovery limiter. Queries are 2–200 characters and suggestions are capped at 10. |

Provider timeouts, connection errors and error responses are logged with only the provider name and exception class, because request URLs can contain the Geoapify key. Resolution then continues with the next source, and the user gets an explicit "no destination found" or error message instead of a server error.

The search overlay shows Geoapify and OpenStreetMap attribution with the suggestions.

## Privacy

- Providers receive only the typed query text, plus the interface language for Nominatim. Requests originate from the NIPKaart server, so the visitor's IP address, cookies and browser User-Agent are not forwarded. Account identity is never sent.
- Query text can itself be personal (for example a home address). Server-side caches are keyed by a hash of the query, store only the normalized result, contain no user identity and expire after 24 hours.
- NIPKaart keeps no server-side destination search history. Recent searches are stored only in the visitor's browser (`localStorage`) and can be cleared from the overlay.
- The selected destination appears in the `/map` URL (`destination`, `lat`, `lng`, optional bounds) so it can be shared. Sharing that link shares the destination.

## Consequences

- Destination search works without an account, like the rest of basic discovery.
- Search keeps working when either external provider is unavailable or disabled, although quality degrades to the remaining sources.
- Replacing Geoapify means implementing `DestinationGeocoder` for another provider and updating attribution.
- Before relying on the Geoapify free plan in production, confirm with Geoapify that 24-hour result caching is permitted. Their published terms do not address caching. If it is not permitted, shorten or remove the Geoapify cache.
- Monitor Geoapify credit usage. Exceeding the free quota requires a paid plan or tighter client-side limits, not a switch to public Nominatim autocomplete.

## Addendum: locating contributed places (2026-09-29, #1309)

Adding a community parking place needs the reverse direction: which country, province and municipality a pin lies in. The same rules apply. The browser sends only the pin's coordinates to core (`/map/add/locate` while choosing, and again on submit); it never calls a geocoder and never supplies the address itself. `ParkingLocationResolver` asks Geoapify reverse geocoding first and falls back to public Nominatim `/reverse` within the shared `nominatim-public` limiter of 1 request/second. Results are cached for 24 hours per coordinate rounded to five decimals (about 1 m), so moving the pin back and submitting reuse the lookup. The locate endpoint is limited to 60 requests/minute per user and only available to accounts eligible to contribute.

A pin is usable only when it resolves to a country NIPKaart knows and to a municipality; street and house number are optional. Looking up writes nothing. Only a submission creates a province or municipality seen for the first time, matching a known province by its ISO 3166-2 code before its name, so a provider answering in another language does not create a duplicate. Known province names are shown as NIPKaart stores them.

## References

- [Destination-first search #1169](https://github.com/NIPKaart/core/issues/1169)
- [Bounded discovery](0008-discovery-uses-bounded-postgis-queries-and-clustering.md)
- [Privacy-minimal core](0009-europe-ready-privacy-minimal-core-and-native-value-gate.md)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
- [Geoapify pricing and attribution](https://www.geoapify.com/pricing/)
