---
status: accepted
date: 2026-09-26
---

# Community evidence overlays source data

Community evidence may change what NIPKaart presents without rewriting what an official source stated. Municipal/open-data records, community parking spaces and offstreet facilities remain separate persistence domains.

Community confirmations, correction proposals and moderation decisions form an evidence/publication layer over those records. A sufficiently supported decision may hide an imported place from normal discovery while retaining the imported record and its provenance.

## Consequences

- Community and municipal records are not merged merely because they appear to describe the same physical place.
- Cross-source duplicate detection starts as a measurable/reviewable presentation concern; a canonical-place model is introduced only if real data justifies it.
- Approved community spaces cannot be silently rewritten by later contributors. Published changes use correction/change proposals with moderation and history.
- Imported source values remain recoverable even when a local correction or visibility decision overrides their presentation.
- Admin overrides survive subsequent imports until explicitly reversed.
- User-facing discovery may present one coherent result set without erasing source distinctions.

## References

- [One community registration per physical parking space](0001-individual-community-parking-spaces.md)
- [Discovery read-model direction](../product/discovery-read-model.md)
- [Trust, provenance and freshness](../product/trust-and-provenance.md)
