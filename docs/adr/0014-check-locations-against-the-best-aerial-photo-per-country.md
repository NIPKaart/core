---
status: accepted
date: 2026-11-03
---

# Check locations against the best aerial photo per country

Reviewers judge whether a parking place lies where a source or contributor says it does: a delivered parking bay, a moved community pin, a reported place. They do that against an aerial photo, so the photo itself must be placed accurately.

Until now every review map used Google satellite tiles. For the Amsterdam delivery of 30 October 2026, bay `114185488210` on the Bok de Korverweg looked about 3.5 m off on Google, half on the cycle path. The same coordinates lie exactly on the painted bay in the PDOK orthophoto (Beeldmateriaal Nederland, 8 cm per pixel), and they equal what Amsterdam's own API returns in EPSG:4326. The data was right; Google's photo was shifted. Google's offset differs per area and per photo, so a reviewer cannot correct for it.

## Decision

Review maps take their aerial photo from a server-side catalogue, `AerialImagery`, in the shape of the geocoder chain ([ADR 0012](0012-destination-resolution-internal-first-with-controlled-external-geocoding.md)):

- `services.imagery.providers` (`IMAGERY_PROVIDERS`, default `pdok,google`) sets the order of preference.
- Each provider is a fixed definition: label, tile URL, attribution, subdomains, native maximum zoom and the countries it covers. A provider without countries covers the whole world.
- `forCountry($code)` returns the providers covering that country, best first. The page receives that list as an Inertia prop, `imagery`; the map opens on the first and offers the others to compare.
- The country comes from the record: a delivery's municipality, a moderation item's municipality, or for the moderation queue the country most open items lie in.

Providers are data, not classes. Unlike geocoders they share one behaviour, drawing XYZ tiles, so an interface per provider would add code without adding a seam.

**Why per country and not per map area.** A national orthophoto does not fail outside its country: PDOK answers 200 with a blank tile for Antwerp, Brussels or Aachen. A bounding box around the Netherlands would therefore cover Google with grey squares along the border. The record's country is known, exact and cheap.

**Why PDOK first for the Netherlands.** It is the authoritative Dutch orthophoto, open data under CC BY 4.0, free, without key or quota, and served in EPSG:3857 up to zoom 21. Google remains available as the second layer and as the only layer outside the Netherlands, in line with [ADR 0009](0009-europe-ready-privacy-minimal-core-and-native-value-gate.md).

## Consequences

- Adding a country's orthophoto (for example Flanders) is one definition plus its name in `IMAGERY_PROVIDERS`.
- PDOK requires attribution. Review maps that show Leaflet's attribution credit it automatically; the moderation map hides attribution today, which should be revisited for both Mapbox and PDOK.
- Tiles are requested by the browser, as before, so the provider sees the reviewer's IP address. Only signed-in reviewers use these maps.
- The public map keeps Google's hybrid layer with street labels for now; it can adopt the catalogue later without a new decision.
