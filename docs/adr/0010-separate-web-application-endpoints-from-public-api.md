---
status: accepted
date: 2026-09-26
---

# Web application endpoints are separate from the public API

NIPKaart distinguishes its first-party web application transport from APIs intentionally offered to external consumers.

Inertia/Laravel web routes are the default for pages, forms and application actions. Interactive browser features that require partial asynchronous data without an Inertia navigation, such as destination suggestions and map viewport discovery, use feature-oriented web endpoints with the `web` middleware. These endpoints are implementation details of the NIPKaart web application and carry no public backwards-compatibility guarantee.

The `/api` namespace is reserved for a deliberately designed external API. When that API is introduced, its first stable contract starts under `/api/v1`. A route does not become part of the public API merely because it returns JSON.

Current exposure policy: [ADR 0011](0011-defer-external-api-and-bulk-data-access.md) records the decision not to offer an external API for now. Reserving the namespace is not a commitment to launch one.

Collector delivery/import contracts are machine-to-machine integration boundaries and remain separate from both first-party web endpoints and the public read API.

## Consequences

- Prefer Inertia for page navigation, forms and mutations where it fits the interaction.
- First-party async browser reads live under feature-oriented web routes, for example map discovery and destination resolution, not under `/api`.
- Web endpoints may use session, CSRF, application-specific throttling and other web middleware as appropriate.
- Internal endpoint URLs and response shapes may evolve together with the React application.
- Public API routes are versioned from their introduction: `/api/v1/...`.
- Public API resources, authentication/API keys, scopes, pagination, geospatial query semantics, rate limits, caching, CORS, errors, deprecation and data-export policy must be designed explicitly before exposure.
- Internal discovery read models are not automatically public data-export contracts.
- Open-source application code does not imply that every internal query surface must be exposed as an unrestricted public API.
- Collector/import interfaces are versioned and secured according to their own integration requirements rather than inheriting the public API contract.

## Migration

Existing first-party browser endpoints currently under `/api` are transitional. Move browser-only consumers to feature-oriented web routes before treating `/api` as a stable external namespace. Do not break or remove a route until all first-party consumers and tests have migrated.

## References

- [Discovery uses bounded PostGIS queries and clustering](0008-discovery-uses-bounded-postgis-queries-and-clustering.md)
- [Discovery read-model direction](../product/discovery-read-model.md)
