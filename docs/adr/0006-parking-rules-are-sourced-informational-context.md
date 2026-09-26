---
status: accepted
date: 2026-09-26
---

# Parking rules are sourced informational context

NIPKaart presents parking rules as sourced information, not as a legal eligibility or permission engine. Rules can exist at country, region/province, municipality and specific-location scope. More specific information is presented primarily while broader country context remains available.

NIPKaart does not model arbitrary geographic parking-rule zones in the initial architecture and does not claim that a user is legally permitted to park based on profile or permit data.

## Consequences

- Rule records combine structured common properties where reliable with human-readable information and source references.
- Official government sources are distinguished from secondary informational sources.
- Location-specific restrictions take precedence in presentation over general municipal or national context.
- Where local information is absent, country-level information can be shown as fallback with that limitation made clear.
- Admins curate published rules; users may later propose corrections with supporting sources.
- NIPKaart does not collect disability details or parking-card identifiers to determine legal eligibility.
- User-facing rule surfaces include a concise disclaimer that information must be checked locally and no rights can be derived from NIPKaart data.

## References

- [Domain language](../../CONTEXT.md)
