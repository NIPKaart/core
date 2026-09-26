---
status: accepted
date: 2026-09-26
---

# Preserve source records, provenance and history

Imported parking records remain attributable to their source dataset and external source identity. Core preserves enough import and publication history to explain what a source supplied, when NIPKaart received it, what changed and which delivery produced the public representation.

A source record disappearing from one complete delivery is evidence that it is missing from that delivery, not proof that the physical parking place no longer exists. Missing records are not deleted automatically.

## Consequences

- Identity for imported records is source-qualified, such as `(dataset_source, external_id)`.
- Core retains source records/imports and publication provenance instead of replacing them with an untraceable normalized row.
- Missing-state tracking may include `last_seen_at`, `missing_since` and consecutive successful missing deliveries.
- Automatic deactivation requires a separately justified policy based on observed source behavior; until then, disappearance remains reviewable.
- If the same source identity returns later, reactivate/reconcile the existing record rather than manufacturing a new identity.
- Sanity checks may block implausible bulk or geometry changes from publication without discarding the received delivery.

## References

- [European data foundation](../product/data-foundation.md)
- [Trust, provenance and freshness](../product/trust-and-provenance.md)
