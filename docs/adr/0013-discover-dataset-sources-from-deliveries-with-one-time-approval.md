---
status: proposed
date: 2026-09-28
---

# Discover dataset sources from deliveries, with one-time approval

[ADR 0002](0002-core-owns-publication-collectors-deliver-snapshots.md) lets collectors deliver complete snapshots and keeps publication in core. Until now, core only accepted a dataset after a person added it to `config/dataset-deliveries.php` and ran `nipkaart:register-dataset` against a municipality that already existed. Every new source needed a code change, a manual command and sometimes a manually created municipality. That does not scale to many European municipalities and garage providers.

## Decision

A source describes itself in every delivery, and core discovers new sources from the import bucket. A source becomes usable after **one approval by an administrator**; its deliveries then follow the existing review and publication flow.

### Source description in every delivery

The delivery envelope gains a `source` block. There is no separate manifest file: the description travels with the data it describes, so a source cannot exist without a delivery and cannot drift from it unnoticed.

```json
"source": {
  "name": "Amsterdam parkeergarages en P+R",
  "publisher": "Gemeente Amsterdam",
  "source_url": "https://p-info.vorin-amsterdam.nl/v1/ParkingLocation.json",
  "licence": "CC-BY-4.0",
  "terms_url": "https://data.overheid.nl/dataset/9orkef6t-au29g",
  "attribution": "Gemeente Amsterdam; Actuele beschikbaarheid Parkeergarages; CC-BY 4.0.",
  "area": {
    "country": "NL",
    "subdivision": "NL-NH",
    "municipality": { "scheme": "nl-cbs", "code": "GM0363", "name": "Amsterdam" }
  },
  "bounds": [4.65, 52.2, 5.15, 52.5],
  "expected_interval_hours": 24
}
```

- `licence` is an SPDX identifier, or `null` when the source publishes no licence. Unknown is never guessed.
- `area.country` is ISO 3166-1 alpha-2 and `area.subdivision` is ISO 3166-2. `area.municipality` uses an official code per country (`nl-cbs` for CBS codes in the Netherlands; other schemes such as the German AGS are added when a first source needs them). Names are for display; codes are the identity.
- `bounds` is the expected area of the records; core keeps rejecting records outside it.
- `expected_interval_hours` is the collector's delivery cadence and drives the overdue status that `max_age_hours` provided in configuration.

The formats that carry this block get a new version: `nipkaart-municipal-2` and `nipkaart-offstreet-catalog-2`. The dataset code stays the folder name in the bucket (`<type>/<dataset>/<delivery_id>.json`) and remains the stable identity of a source. Occupancy observations (#1221) reference a catalog dataset and do not repeat the block.

### Discovery and approval in core

1. The scheduled discovery lists dataset folders under each known type prefix (`municipal/`, `offstreet/`) instead of reading a fixed list from configuration.
2. For an unknown folder, core validates the newest delivery and creates a dataset source in state **awaiting approval**, with publication disabled. The municipality is found by country, scheme and code, or created from the `area` block when it does not exist yet. Countries and subdivisions are reference data: an unknown country or subdivision keeps the source waiting and shows why.
3. Administrators get a notification. The approval screen shows the source description, the licence and terms link, the area and bounds, and a record count from the delivery.
4. Approval makes the source's deliveries flow into the existing staging, review and publication. Rejection keeps the source and its receipts for traceability and ignores its deliveries until someone reverses the decision.
5. A later delivery whose source block differs from the approved one (for example a changed licence, publisher or area) is held for re-approval of the source before it can be reviewed.

Validation becomes per format, not per dataset. Rules that are specific to one upstream source (such as Amsterdam's E6a regime filter) stay in that source's collector adapter, which must deliver records that already mean what the format says.

## Why

- New sources need no core code change, command or manual reference data, which fits a Europe-wide rollout ([ADR 0009](0009-europe-ready-privacy-minimal-core-and-native-value-gate.md)).
- Licence and terms still get a human decision once per source, instead of being trusted automatically or re-checked on every delivery.
- Official area codes avoid duplicate municipalities caused by spelling or language differences.
- Keeping the description inside each delivery respects the delivery decision in [#1176](https://github.com/NIPKaart/core/issues/1176) not to add a separate manifest; the bucket completion mechanism, idempotency and ordering stay unchanged.

## Consequences

- `config/dataset-deliveries.php` keeps only general settings; the per-source list and `nipkaart:register-dataset` are removed.
- `municipalities` gains an official code with its scheme. Existing municipalities without a code are matched by country, subdivision and name once, then carry the code.
- `MunicipalSnapshot` loses its per-dataset branches (Amsterdam and Eindhoven); the municipal format states the geometry type and access category it carries.
- Both collectors add the source block to their dataset registry and switch to the new format versions. Core accepts only the new versions once they are released, as nothing is deployed yet.
- The approval screen and its notification are new admin surfaces; delivery review stays as it is.
- Automatic creation of municipalities means reference data can grow from deliveries. Countries and subdivisions do not; they remain seeded reference data.

## References

- [European batch data foundation #1176](https://github.com/NIPKaart/core/issues/1176)
- [Offstreet catalog intake #1250](https://github.com/NIPKaart/core/issues/1250)
- [Data import contract](../development/data-import-contract.md)
- [ISO 3166-2](https://www.iso.org/iso-3166-country-codes.html)
- [SPDX licence list](https://spdx.org/licenses/)
