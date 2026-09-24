---
status: accepted
date: 2026-09-08
---

# One community registration per physical parking space

Each community-contributed `ParkingSpace` represents one physical accessible parking bay, including when several bays are adjacent. We retain individual identities instead of representing a group as one community record with a quantity, because adjacent bays can differ in accessibility, position or restrictions and must remain independently verifiable, correctable and removable.

## Consequences

- Submission convenience is separate from record identity: a future flow may let contributors mark several bays and enter shared information once, while retaining a separate location, identity and any differing properties for each bay. This ADR establishes that direction; it does not implement bulk submission.
- Map clustering may group nearby spaces for display without merging their identities or evidence.
- Municipal source records may describe a location with a known number of bays, and offstreet records describe facilities with capacity information. Preserve that source granularity; do not manufacture individually positioned spaces from an aggregate count. These remain separate from community registrations.
- Known capacity is not current availability, and general garage occupancy does not establish accessible-space availability.

## References

- [Domain language](../../CONTEXT.md)
- [Data foundation and source relationships](../product/data-foundation.md)
- [Discovery read-model direction](../product/discovery-read-model.md)
