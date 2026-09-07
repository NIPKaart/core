# Laravel 13 capability evaluation

Research for [#1167](https://github.com/NIPKaart/core/issues/1167), evaluated on 2026-09-07 against `main` at `e72ed5b2ba7be83b35429f957b3e04a06944e1b7`. This is a decision record, separate from the framework upgrade in [#1159](https://github.com/NIPKaart/core/issues/1159) and modernization epic [#1158](https://github.com/NIPKaart/core/issues/1158).

## Baseline and recommendation

The committed [Composer manifest](../../composer.json) and [lockfile](../../composer.lock) establish PHP `^8.4`, Laravel 13.30.1 and development-only Boost 2.7.1. The inspected baseline has passing [lint](https://github.com/NIPKaart/core/actions/runs/34156173764) and [test](https://github.com/NIPKaart/core/actions/runs/34156173724) workflows. This is repository/CI evidence, not production deployment evidence.

Adopt no additional runtime capability in this issue. The current implementation already addresses the concrete discovery and authorization needs. Deferred capabilities need a named consumer or measured shortcoming before implementation; framework availability alone is insufficient.

| Candidate                   | Decision                                                                  | Reconsider when                                                             |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| PHP / Laravel attributes    | Later; reject a mass conversion                                           | A small, named refactor demonstrates clearer code with equivalent behavior  |
| JSON:API resources          | Later                                                                     | A funded public/mobile client needs a stable resource contract              |
| Semantic/vector search      | Later for an optional text experiment; reject opaque core parking ranking | A representative query benchmark shows a gap in current text search         |
| Laravel AI SDK              | Later                                                                     | A user or maintainer owns a concrete, measurable assisted workflow          |
| Agentic development tooling | Boost already adopted under #1187; reject additional tooling for now      | An observed maintenance task cannot be handled adequately by existing tools |

## PHP / Laravel attributes

**Framework capability.** Controller `Middleware` colocates declarations; `Authorize` delegates to `can` middleware and existing policies. Eloquent attributes can express table and mass-assignment metadata; job attributes express retry/backoff/timeout settings. FormRequest attributes configure failure/redirect/error-bag behavior, not a replacement for `rules()` or `authorize()`. Changing `StopOnFirstFailure` also changes which errors users receive. Sources: [controllers](https://laravel.com/framework/docs/13.x/controllers#controller-middleware), [Eloquent](https://laravel.com/framework/docs/13.x/eloquent#mass-assignment), [queues](https://laravel.com/framework/docs/13.x/queues#dealing-with-failed-jobs), [validation](https://laravel.com/framework/docs/13.x/validation#form-request-validation).

**NIPKaart problem and existing solution.** Repeated declarations can distract from domain behavior, but no demonstrated attribute-related maintenance defect was found in the inspected paths. Middleware and throttling are visible in [API routes](../../routes/api.php), [web routes](../../routes/web.php) and [application bootstrap](../../bootstrap/app.php). Controllers call policies through `Gate::authorize`; [StoreParkingRuleRequest](../../app/Http/Requests/App/StoreParkingRuleRequest.php) combines authorization with dynamic database-backed validation. [ParkingSpace](../../app/Models/ParkingSpace.php) declares fillable fields and casts, while [AppServiceProvider](../../app/Providers/AppServiceProvider.php) registers its observer. No application `app/Jobs` classes currently provide a concrete job-metadata refactor target.

**Expected benefit.** Colocating a static declaration with its controller/model/job could reduce navigation. That is a developer-readability hypothesis, not a user-facing feature or measured performance improvement. Dynamic uniqueness, geographic hierarchy checks and instance-specific policy behavior still need explicit logic.

**Infrastructure/runtime cost.** No new external service is needed for framework attributes. The cost is migration/review work and verifying interactions with route caching, middleware ordering, model events and queued execution. Do not mix declaration styles arbitrarily or convert code simply to use Laravel 13 syntax.

**Privacy/data implications.** Metadata syntax does not intentionally change the data boundary, but an incorrect authorization declaration, fillable list or observer registration can expose or mutate data. Policies remain authoritative; source-controlled fields must remain guarded.

**Testability.** Any future trial must compare guest, permitted, forbidden and suspended-user behavior, bound model identity and cached/uncached routes where relevant. Model trials must preserve mass-assignment protection, casts and exactly-once observer effects; job trials must cover actual queue behavior. Existing [domain](../../tests/Feature/DomainContractsTest.php), [middleware](../../tests/Feature/BackendMiddlewareTest.php) and [permission](../../tests/Feature/PermissionUpgradeTest.php) tests are starting points, not proof that a proposed conversion is equivalent.

**Decision: later.** Require a separate, narrowly scoped implementation issue/PR with a before/after example and behavior checks. Retain current declarations in this research.

## JSON:API resources

**Framework capability.** `JsonApiResource` provides JSON:API serialization, relationships, sparse fields and its media type. It is not a complete API server: incoming query filtering and sorting still need separate handling. Source: [Laravel JSON:API resources](https://laravel.com/framework/docs/13.x/eloquent-resources#json-api-resources).

**NIPKaart problem and existing solution.** A future mobile/public client may benefit from standardized resource identity, relationships and pagination. Today, [SpacesInfoController](../../app/Http/Controllers/Api/SpacesInfoController.php) returns explicit JSON for the browser, [SearchController](../../app/Http/Controllers/Api/SearchController.php) returns a `hits` envelope, and [FavoriteResource](../../app/Http/Resources/FavoriteResource.php) is a conventional `JsonResource` with NIPKaart-specific availability semantics. API routes use throttling and the web/session middleware; details include user-specific favorite/confirmation fields when signed in.

The issue's original Sanctum direction is superseded: [#1166's infrastructure audit](infrastructure.md) records its approved removal because there is no external consumer. Sanctum is absent from the committed dependency manifest/lockfile. Reintroducing API authentication is a separate decision; a resource serialization format does not provide authentication or authorization.

**Expected benefit.** A real external client could reuse a predictable document structure instead of several browser-specific payloads. Conventional Laravel HTTP resources remain the lower-complexity alternative when a small explicit API contract suffices. JSON:API would also require client changes; silently replacing existing envelopes would break callers.

**Infrastructure/runtime cost.** Resource and client migration, contract versioning, relationship loading, pagination and query-budget work; no new database/service is inherently necessary. The API contract must follow the [discovery read model](../product/discovery-read-model.md), preserving the three source models and source-qualified identity.

**Privacy/data implications.** Explicitly allowlist public fields and included relationships. Separate user-specific state from cacheable public discovery, enforce publication/visibility and ownership, and keep basic discovery available to guests. A standardized envelope must not expose unavailable favorites or unpublished records.

**Testability.** A future API needs document/media-type and client contract tests, stable cross-source identity, pagination and error behavior, bounded relationship queries, hidden-record exclusions and guest/authenticated cache isolation. Existing favorite and detail contracts need compatibility tests during any migration.

**Decision: later.** Define the consumer and versioned contract first, compare ordinary resources with JSON:API, and choose authentication independently. No resource conversion or Sanctum installation is justified now.

## Semantic/vector search

**Framework capability.** Laravel documents vector similarity queries and embedding workflows. Its PostgreSQL vector path requires `pgvector`, which is separate from PostGIS. Semantic relevance does not guarantee spatial or accessibility correctness. Sources: [semantic search](https://laravel.com/framework/docs/13.x/search#semantic-vector-search), [vector storage](https://laravel.com/framework/docs/13.x/search#storing-and-indexing-vectors).

**NIPKaart problem and existing solution.** A possible future query is “parking near the station with room to transfer from a wheelchair”. This is a hypothesis, not a validated user requirement: it combines destination resolution with accessibility facts that may not exist in the source data. Current [text search](../../app/Http/Controllers/Api/SearchController.php) queries PostgreSQL source records with place/postcode handling (#1195). [ParkingDiscovery](../../app/Services/ParkingDiscovery.php) uses exact PostGIS radius/viewport queries, publication filters and deterministic distance/source/ID ordering. The [discovery direction](../product/discovery-read-model.md) explicitly excludes opaque AI/vector ranking from the core flow.

**Expected benefit.** Semantic retrieval could improve synonym or natural-language matching over sufficiently descriptive records. It cannot supply missing accessibility facts, guarantee geographic proximity or establish accessible-space availability from general garage occupancy. Structured filters, improved indexed fields and lexical synonyms should be compared first.

**Infrastructure/runtime cost.** An experiment adds embedding generation, a compatible vector index, model/dimension/version tracking, reindexing and deletion handling, latency and operational monitoring. PostgreSQL/PostGIS availability does not prove vector support is provisioned. Provider pricing and actual corpus costs must be measured when a specific design is proposed; this research installs nothing.

**Privacy/data implications.** Queries can disclose destinations and accessibility needs; descriptions can contain personal information. Do not send raw location history, private favorites, unpublished contributions or user identifiers to an embedding provider. Any trial needs an explicit data allowlist, retention/deletion handling and provider assessment.

**Testability.** Before a trial, label a representative Dutch query set with expected results, including synonyms, exact addresses, postcodes, no-match cases and unsupported accessibility claims. Compare text-only and semantic variants on relevance (for example Recall@10 and nDCG@10), p95 latency and cost per query. Agree a minimum improvement and acceptable budgets before running it. Geographic bounds, visibility and provenance must have zero regressions; failure must retain the existing discovery path. No benchmark has been run and no benefit is claimed here.

**Decision: later for optional text retrieval; reject replacing core geographic filtering/ranking.** A benchmark and concrete corpus are prerequisites for a separate experiment issue, not permission to add vector infrastructure now.

## Laravel AI SDK

**Framework capability.** The first-party `laravel/ai` package offers agents, tools, structured output and embeddings through configured providers, but requires separate installation. It is not automatically included by upgrading `laravel/framework`. Source: [Laravel AI SDK](https://laravel.com/framework/docs/13.x/ai-sdk#installation).

**NIPKaart problem and existing solution.** A possible maintainer workflow is drafting a plain-language summary of a public municipal parking-rule page, with an exact source link and human approval. This has no established owner or demonstrated need yet. [ParkingRule](../../app/Models/ParkingRule.php) currently stores a municipal/national rule reference, and the detail API presents its URL. Human review and source links remain sufficient for the present scope.

**Expected benefit.** An assisted draft might reduce reading time or improve content clarity. It must not invent restrictions, accessibility guarantees or legal interpretations, and it does not solve the core keyboard/screen-reader requirements in the [accessibility direction](../product/accessibility.md).

**Infrastructure/runtime cost.** A new SDK dependency, model/provider configuration, credentials, request budgets, timeouts, retries, observability and potentially queued work. The SDK is absent from the committed manifest/lockfile. Installation would require a separate approved implementation, not a speculative baseline dependency.

**Privacy/data implications.** A future summary trial should use allowlisted public source content and exclude accounts, private reports, precise user locations and favorites. Treat retrieved pages as untrusted content, restrict tools/actions and retain human publication approval. Provider retention, prompt storage and deletion requirements must be established for the selected workflow.

**Testability.** Use SDK fakes for request boundaries, failure/timeouts and unexpected-call prevention; separately evaluate fixed source documents for factual fidelity, citations, unsupported claims and reviewer correction time. Fakes cannot establish model quality. Keep the source-link/manual workflow usable during provider failure.

**Decision: later.** Require a named maintainer/user, measurable task benefit and an agreed data boundary. Do not add an AI runtime dependency or automated publication now.

## Agentic development tooling

**Framework capability.** Boost provides application/package information, documentation search and diagnostic MCP tools, with custom project guidance and skills. These address development context without a production AI SDK. Source: [Laravel Boost](https://laravel.com/framework/docs/13.x/boost#available-mcp-tools).

**NIPKaart problem and existing solution.** Keeping coding-agent guidance aligned with the installed Laravel version and NIPKaart architecture is an actual maintenance need. [Boost is already adopted](boost.md) under [#1187](https://github.com/NIPKaart/core/issues/1187), with portable MCP configuration, package-aware documentation and a Composer update hook. It is not an undecided Laravel 13 production capability.

**Expected benefit.** Existing tooling supplies application context and repeatable guidance regeneration. No additional custom agent service, MCP server or production AI integration has a demonstrated maintenance benefit in this evaluation.

**Infrastructure/runtime cost.** Keep Boost development-only. Additional tools would add configuration, permissions, maintenance and potentially provider costs; duplicate context sources can drift. Production installation must continue to work without development tooling.

**Privacy/data implications.** Agent context and diagnostic tools can expose code, logs or application data to the configured development client. Keep credentials, environment values and personal data out of generated guidance; grant only the access needed for the maintenance task. Development-only dependency placement does not itself guarantee that tool output contains no sensitive data.

**Testability.** Existing [BoostUpdateTest](../../tests/Unit/BoostUpdateTest.php) covers development-only update execution and command failure propagation. The [Boost workflow](boost.md) also requires deterministic regeneration and production `--no-dev` compatibility. Any proposed extra tool needs a repeatable maintenance scenario and tests of its permission/data boundary and failure path.

**Decision: retain adopted Boost; reject additional tooling for now.** Reopen only for a concrete gap that existing Boost, repository guidance and normal CLI/CI tooling cannot address adequately. Boost installation remains owned by #1187.

## Acceptance and follow-up

- No capability is adopted solely because Laravel 13 makes it available.
- All five candidates have a concrete current use case or an explicit deferred/rejected decision, with benefit, cost, privacy and testability recorded above.
- No new candidate is adopted here, so no new implementation issue/PR is required. Boost already has its implementation in [#1192](https://github.com/NIPKaart/core/pull/1192). A future adoption must get its own issue and implementation PR before changing runtime behavior.
- This research changes documentation only and does not alter the framework upgrade, dependencies, schema, discovery, authentication or deployment.

Validation for this document consists of checking the committed code/dependency evidence, primary framework sources and document links. Runtime tests and experiments are described as future acceptance work; no new runtime behavior or measured AI/search improvement is claimed.

Primary sources above were checked through Boost's package-scoped documentation search and official Laravel documentation. The online `13.x` documentation moves over time; availability in that documentation is not proof that every API exists in the exact locked patch. Verify installed framework source before implementing a deferred capability. Recommendations and proposed evaluation criteria are NIPKaart engineering judgments, not measured outcomes or framework guarantees.
