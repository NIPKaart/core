---
status: accepted
date: 2026-09-26
---

# Offstreet live data is facility-wide and freshness-aware

`ParkingOffstreet` represents a garage or P+R facility and remains a separate domain from individual accessible parking spaces. Live occupancy describes the whole facility unless the upstream source explicitly provides accessible-space occupancy.

Core stores the latest useful live observation and its observation time for product discovery. Full occupancy time-series history is not a core requirement.

## Consequences

- General free-space counts are never presented as proof that an accessible bay is free.
- Static facility metadata and dynamic observations have separate freshness semantics.
- Each provider/source has an expected update cadence and freshness policy.
- A live value transitions from current to stale/unknown when expected observations stop; the facility itself remains discoverable.
- UI/API representations include the observation timestamp and communicate stale/unknown state honestly.
- Historic time-series storage may be added later for a demonstrated product/analytics need, without changing the meaning of current availability.

## References

- [Garage and P+R fallback direction](../product/garage-fallback.md)
- [Trust, provenance and freshness](../product/trust-and-provenance.md)
