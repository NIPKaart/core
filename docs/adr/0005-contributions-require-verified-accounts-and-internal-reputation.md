---
status: accepted
date: 2026-09-26
---

# Contributions require verified accounts and use internal reputation

Reading and discovering parking information remains public. Creating community parking spaces, confirming their existence and proposing corrections requires an authenticated, verified account.

NIPKaart uses an internal reputation profile to give moderators context about accumulated contribution value. Reputation reflects demonstrated reliability rather than raw activity. It is not a public score, badge system or automatic authority to make irreversible publication decisions.

## Consequences

- Contributor identity is available to moderation but is not exposed as public provenance by default.
- Repeated confirmations alone do not manufacture trust; later independent agreement and admin validation are stronger signals.
- Reliability can increase or decrease as later evidence resolves earlier contributions.
- A parking place disappearing months after a correct contribution does not penalize the original contributor.
- Suspicious activity is flagged and rate-limited where necessary; suspension or durable contribution restrictions remain an admin decision initially.
- Account deletion may anonymize retained contributions/confirmations so deleting personal data does not destroy parking history.
- Moderation uses the moderator role and permission/policy boundaries introduced under #1314.

## Reputation clarification — 2026-10-21

Community points (Dutch: communitypunten, #1256) measures accumulated contribution value, starting at 0 without a maximum of 100. Reliability remains the correctness/usefulness context of reviewed outcomes rather than a percentage implied by the reputation total. V1 is visible only in authorized moderation surfaces; its calculation is server-side and does not change queue order, publication, permissions or suspension. Achievements and rewards are separate future systems.

Only reviewed outcomes recorded after introduction count; no complete historical backfill is claimed. Minimal outcomes survive parking-record deletion, while deleting a contributor removes their personal reputation ledger. Reputation combines accumulated useful value with a smoothed quality factor derived from positive and weighted negative reviewed evidence. Neutral exclusions do not affect quality, moderator corrections are not a penalty, and inactivity does not reduce reputation. Parameters can be configured privately; code committed to a public repository is not secret.

## References

- [Trust, provenance and freshness](../product/trust-and-provenance.md)
