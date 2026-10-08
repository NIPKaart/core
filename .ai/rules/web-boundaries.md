---
paths:
  - 'routes/**'
  - 'app/Http/**'
  - 'resources/js/**'
---

# Web application boundaries and request budgets

Read ADR 0010 and ADR 0011 before introducing or moving JSON endpoints.

- Inertia/Laravel web routes are the default for pages, forms and application actions.
- First-party asynchronous browser reads use feature-oriented web routes with web middleware. Returning JSON does not make a route a public API.
- Keep `routes/api.php` reserved for a deliberately designed, versioned external API. Do not move first-party browser endpoints there for organizational convenience.
- Collector/import contracts are separate machine-to-machine boundaries; do not conflate them with browser endpoints or a future public read API.

Treat rate limiting as part of each interaction's design, not as one global request budget.

- Inspect the actual client request pattern before choosing a limiter: viewport movement, area loading, autocomplete, mutations and external-provider lookups have different traffic shapes and costs.
- Reuse an existing named limiter when its semantics match. Do not copy a numeric limit from an unrelated endpoint.
- Map discovery may generate bursts during normal pan/zoom behavior; protect the service without making ordinary interaction hit 429 responses.
- Destination/geocoder endpoints need their own budget because external provider cost and policy differ from PostGIS-backed discovery.
- When changing a request budget, cover expected normal traffic and abuse boundaries with tests where practical, and document the reason rather than only the number.

Read ADR 0008 and `docs/product/discovery-read-model.md` before changing map discovery, clustering or result loading.
