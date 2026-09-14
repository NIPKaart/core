# Technology stack for the first import pipeline

Status: implementation choices for [#1214](https://github.com/NIPKaart/core/issues/1214). See the [delivery contract](data-import-contract.md) and [work packages](data-foundation-delivery.md). The live Amsterdam export and manually reviewed core import were accepted on 14 September 2026; disabled-parking #783 and core #1222 are merged. The private bucket and automatic execution have not been provisioned.

| Component | Initial choice |
| --- | --- |
| Core | Existing Laravel 13 application, PHP 8.4 baseline and PostgreSQL/PostGIS. |
| Administration | Existing React/Inertia interface for comparison and review; no separate import application. |
| Producer | `disabled-parking`, its existing Python >=3.12 environment and reusable source package. Check source package versions when a required fix is made. |
| Dependency management | uv and `uv.lock`; install with `uv sync --locked`, then use `uv run ...`. Reusable packages retain their own tooling. |
| Mapping | Small Python dataclass and explicit mapping for one source. |
| File | One bounded UTF-8 JSON document, written through a temporary file and atomic replacement. |
| Validation | Explicit type and content checks on both sides. The Opis/schema prototype was removed in #1222; one intake service handles the pilot format. |
| Tests | Existing Python unittest/pre-commit checks and core Pest. Small mapping examples; no municipal network calls in regular CI. |
| Initial handoff | Local file passed to the same core intake service that will later process bucket objects. |
| Automatic handoff | Private Cloudflare R2 bucket. Region, costs, access rights and staging validation belong to #1217; no resources have been provisioned. |
| Scheduled execution | One persistent Docker container per producer repository on an owner-managed Linux host or cloud VM. An internal scheduler runs finite commands serially; no container per municipality. Core uses its own scheduler/queue. Implementation in #775/#1217. |

The uv migration and SQL runtime removal were merged in disabled-parking #779 and #780. The temporary Hamburg export from #781 was replaced by the live Amsterdam route in #783. Core #1222 provides the corresponding review and publication flow. Core contains no Python code or source clients.

Use standard libraries and existing dependencies where they suffice. The first source needs no new broker, worker framework, local SQLite scheduling database, mandatory sequences, JSONL or separate manifest. Add a component only when the working pipeline demonstrates a need for it.

The producer should receive only the necessary permissions for its private bucket destination. Core receives separate read access and decides publication. The producer holds no database credentials or core token. The handoff must guarantee complete, unique deliveries without prescribing a particular S3 versioning implementation upfront. Actual credential boundaries must be verified in #1217.

First prove the entire pipeline manually, then automate delivery of the same files. As usage grows, measure runtime, source limits, file size and maintenance effort before adding processes or shared frameworks. Offstreet follows with its own data semantics; general garage occupancy does not establish the availability of an accessible parking space.
