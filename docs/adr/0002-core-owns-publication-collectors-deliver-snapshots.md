---
status: accepted
date: 2026-09-26
---

# Core owns publication; collectors deliver complete snapshots

NIPKaart separates source retrieval from product publication. Reusable Python packages implement source protocols. `disabled-parking` and `offstreet-parking` are stateless NIPKaart collectors that select, normalize and deliver source data. Core is the system of record that validates, compares, reviews and publishes parking information.

Collectors do not write the core database and do not decide what becomes publicly visible. They deliver complete, source-qualified snapshots through controlled object storage. Core retains import state, provenance, local corrections and publication decisions.

## Consequences

- Source-specific credentials, pagination and protocol behavior stay outside core.
- Collector output follows a strict, versioned NIPKaart delivery contract rather than leaking provider-specific structures into core.
- A failed fetch never deletes existing published data.
- Core may automate review/publication later, but the publication policy remains a core responsibility.
- `offstreet-parking` should converge on the same delivery boundary already used by `disabled-parking`, while retaining an offstreet-specific contract where semantics differ.
- Reusable source packages remain independently usable and contain no NIPKaart publication state.

## References

- [European data foundation](../product/data-foundation.md)
- [Data import contract](../development/data-import-contract.md)
