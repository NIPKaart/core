---
status: proposed
date: 2026-11-08
---

# Ingest location proposal sources separately from parking datasets

A location proposal gives a moderator evidence of possible accessible parking. NDW traffic signs are the first source. An E6 sign locates the sign itself, may serve several bays and may have a licence-plate under-sign. Core keeps these points as moderation evidence. Only the individual bays a moderator confirms and draws enter public discovery, as community `ParkingSpace` records.

## One national dataset

Discover proposal sources under `proposals/<dataset>/<delivery_id>.json` in the private bucket, using the versioned `nipkaart-location-proposals-1` format. Reuse the receipt, provenance and one-time administrator approval of [ADR 0013](0013-discover-dataset-sources-from-deliveries-with-one-time-approval.md), including re-approval for a changed source description. Approval enables validated snapshots to update proposal evidence directly. These deliveries skip parking-record staging, review and publication.

NDW delivers one national dataset. Its `source.area` identifies the Netherlands by country code. Each point carries its CBS municipality code when NDW supplies one. Core resolves the code against official reference data and can create a municipality from that data. Points without a resolvable code stay in the snapshot as unresolved evidence and are held out of the queue until resolved. A national dataset needs one approval and preserves sign identity through municipality changes. Splitting by municipality would reuse the smaller delivery limits but require separate dataset identities and approvals, plus coordination to reconcile a sign that moves between municipality datasets.

On 8 November 2026, the [NDW v4 current-state endpoint](https://docs.ndw.nu/data-uitwisseling/interface-beschrijvingen/verkeersborden-api/) returned 96,197 distinct placed signs for the API code `E6` (called E06 in the issue), in 53,223,559 bytes of uncompressed WGS84 GeoJSON. Of these, 123 had no municipality code. The same request with `E06` returned an empty collection. The raw response measures upstream retrieval size. Measure the normalized, privacy-filtered delivery separately before locking its limit.

The [delivery contract](../development/data-import-contract.md#location-proposal-snapshots) defines completeness and bounded processing for this national selection. A snapshot describes the current coverage of the source. It cannot establish that NDW knows about every sign in the country.

## Evidence and moderation

- Core keys each point by `(dataset_source, external_id)`, using the NDW sign UUID for this source. Keep the source's last-seen date separately from core's `last_seen_at` and `missing_since`. Only a newer complete, valid snapshot can mark an absent point missing. A returning point clears its missing state and keeps its identity and history. Source updates leave published bays and prior moderation decisions intact. See [ADR 0003](0003-preserve-source-records-provenance-and-history.md).
- The collector flags personal signs, including NDW's `KEN` under-sign type, and strips licence-plate text before serialization. Personal points remain in the count of delivered evidence and are ineligible for proposals.
- Start with one proposal per eligible point. A moderator groups points when imagery shows they refer to the same parking location, for example two signs delimiting one row of bays. Keep all contributing point identities. Proximity or a shared street name alone is insufficient, including near an existing municipal or community place. Show nearby places as review context. A reported bay count is optional context.
- A moderator checks the location against aerial imagery and Street View. Submitting the drawn bays creates individual approved `ParkingSpace` records, attributed reviews and dated existence confirmations in one transaction with the completion decision. Each bay links to the proposal and its supporting source point or points. These bays enter discovery immediately and earn no community points.
- Core stores each attributable decision in the database with its proposal, moderator, timestamp, outcome, reason when applicable and optional note. **Completed** means at least one bay was published. If a known count was only partly met, record why the rest were omitted (not visible, gone or other). **Rejected** requires a reason (no accessible bay or already registered as a community space). For an existing community space, retain the selected published space as the basis for the decision. A decided proposal leaves the queue. A moderator can reopen it to add bays and record another decision while retaining the earlier history.
