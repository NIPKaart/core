---
status: accepted
date: 2026-09-26
---

# Defer the external API and bulk data access

NIPKaart does not offer an external API for now. The project owner selected this direction while addressing [#1271](https://github.com/NIPKaart/core/issues/1271), rather than introducing a limited API with keys for approved external applications. We therefore defer the v1 contract until a concrete external use case justifies its data exposure, support and operational costs.

This is the current exposure policy, not a completed v1 resource specification or a commitment to launch an API. [ADR 0010](0010-separate-web-application-endpoints-from-public-api.md) continues to reserve `/api/v1` for a deliberately accepted external contract. No v1 resource may be exposed under this decision.

## Current boundary

- The public NIPKaart web experience remains available, including basic parking discovery without an account. Its feature-oriented JSON endpoints are internal application transport, not supported third-party integration endpoints.
- No external API resources, API keys, scopes, registration flow or partner access are introduced. Session authentication for the web application does not grant an external API contract.
- Collector delivery and import remain separate integration boundaries; the [integration contract inventory](../development/integration-contracts.md) records their classification for [#1272](https://github.com/NIPKaart/core/issues/1272). They do not become public read or export interfaces.
- No bulk download, dataset enumeration, change feed or unrestricted export of the aggregated NIPKaart dataset is offered. Internal discovery must not acquire unbounded queries or export functionality merely to enable third-party reuse.
- Public browser reads necessarily reveal the records displayed. Bounded spatial queries and the existing discovery throttles reduce extraction and resource abuse; they cannot guarantee that visible data will never be scraped. CORS and undocumented URLs are not access control. This decision does not claim new anti-scraping controls have been implemented.
- Open-source code does not establish redistribution rights for the aggregated data. Source licensing, attribution and community contribution terms must be assessed before any future external exposure. This decision does not change rights granted by upstream publishers or prohibit access to their own datasets.

## Decisions required before reopening external access

The topics in #1271 are deliberately deferred as follows. Existing browser behavior must not become the default external contract by accident.

| Topic | Current decision and future acceptance requirement |
| --- | --- |
| Resources and exposed data | No external resources. Define an explicit field allowlist, publication rules, source-qualified identity, provenance and freshness. Keep community, municipal and offstreet meanings separate; exclude private contributor and moderation data. |
| Versioning and compatibility | Reserve `/api/v1`; it is not available. Accept compatibility, migration notice and deprecation rules before the first supported release. |
| Authentication and scopes | No external credentials are issued. Choose a client/access model, least-privilege scopes, issuance, rotation and revocation for the actual use case. Do not add an authentication package in anticipation. |
| Pagination and filtering | No external listing contract. Define allowed filters, deterministic ordering, page/result caps and pagination consistency without enabling unrestricted enumeration. |
| Radius and bounds | No external geospatial contract. Specify coordinate order/CRS, units, inclusive boundaries, antimeridian behavior, maximum extent/radius and truncation semantics; preserve exact PostGIS query ownership. |
| Rate limits and quotas | Existing web limits remain web-specific. Set external per-client and aggregate budgets, exhaustion responses and operational ownership before access is enabled. |
| Caching and ETags | No external caching guarantee. Decide freshness, conditional responses, authorization isolation and behavior when a record is unpublished or access is revoked. |
| CORS | No third-party browser access is introduced. Decide supported client types and any origin policy alongside authentication; an origin policy cannot protect a distributed secret. |
| Errors | No external error envelope. Select stable status codes and a documented machine-readable envelope before implementation. |
| Documentation and OpenAPI | Do not publish a speculative v1 specification. An accepted API must have a version-controlled OpenAPI contract, examples and implementation contract tests before release. |
| Export and scraping | No aggregated export surface. Assess source rights, allowed reuse, attribution and extraction risks explicitly; any bulk/export capability needs a separate accepted decision. |

## Reconsideration

Reopen the design when there is a named external consumer and a concrete workflow that the NIPKaart web experience cannot serve. Record the minimum necessary data, expected query volume, client environment, reuse needs and responsible operator. Then accept a superseding decision and the complete contract above before implementing or enabling public routes. Merely requesting JSON, building an internal read model or completing a collector integration is not a launch trigger.

For #1271, the outcome is this explicit deferral and exposure boundary. It must not be reported as delivery of a designed or implemented public API v1.

## References

- [Web and public API boundary epic #1269](https://github.com/NIPKaart/core/issues/1269)
- [Privacy-minimal core and unresolved bulk-data licensing](0009-europe-ready-privacy-minimal-core-and-native-value-gate.md)
- [Bounded discovery](0008-discovery-uses-bounded-postgis-queries-and-clustering.md)
- [Discovery read-model direction](../product/discovery-read-model.md)
