# Provisional data delivery contract

Status: working agreement for [#1214](https://github.com/NIPKaart/core/issues/1214). One JSON file supports the initial manual import; the format is finalized only after the collector and core have been tested together. The schemas, validator, Opis dependency and fixture corpus from [PR #1222](https://github.com/NIPKaart/core/pull/1222) were replaced by a single working intake in #1215. Ten invalid Amsterdam polygons receive a geometry derivation in core that requires explicit review. The format is not yet an accepted production integration.

## From source to user

`municipal API → reusable Python package → disabled-parking → JSON file → core: validate, compare and review → municipal parking data → public discovery`

The first handoff uses a local file. The collector then uploads the same format to a private bucket, where core discovers complete files. The bucket is part of the automated architecture. Cloudflare R2 has been selected; provisioning and operational acceptance belong to #1217. The collector never connects directly to the core API or database.

| Component | Responsibility |
| --- | --- |
| Reusable package | Source protocol, complete retrieval of a selection, source IDs, original values and completeness evidence. Independently usable without NIPKaart. |
| disabled-parking | Dataset selection, mapping, delivery metadata and file output. Python and source-specific tests belong here or upstream. |
| core | Allowed datasets, file validation, differences, review, publication and preservation of corrections. No Python environment. |
| offstreet-parking | A separate collector for facilities later; share execution code only when actual common needs emerge. |

## One file

UTF-8 JSON containing one object and a `records` array. No separate manifest, JSONL, schema release or storage-provider ID for the local pilot. The concrete source record and mapping are documented in the [pilot description](data-import-pilot.md).

| Field | Meaning |
| --- | --- |
| `format` | `nipkaart-municipal-pilot-1`; one provisional revision shared by collector and consumer. Replaces `municipal-records-draft` without a compatibility layer. |
| `dataset` | Fixed dataset code allowed by core. The source owner, license and geographical mapping belong to this integration. |
| `delivery_id` | UUID created once per successful retrieval. Retrying the same file preserves its ID and bytes. |
| `retrieved_at` | UTC retrieval start, RFC 3339 with `Z`; orders deliveries. Not an observation date. One active retrieval per dataset. |
| `selection` | Fixed code for the agreed collection/filter, such as `all`. A scope change first requires a newly reviewed integration or selection. |
| `complete` | Must be `true` for intake. The collector declares this only on the basis of source evidence. |
| `source_count` | Count reported by the source for this selection; equal to the number of unique received records. A total alone does not prove completeness when another page remains. |
| `records` | Every record in the selection, without silently rejected or skipped source rows. |

The collector checks source pages, counts and unique IDs before writing the file. Catching parsing failures and continuing with the remaining records does not produce a complete delivery. If a source provides no total, agree another demonstrable completeness check first; do not invent `source_count` from the received list alone.

Core accepts only the known format and allowed dataset/selection, validates types and content, and rejects duplicate JSON keys and source IDs. Do not resolve remote schemas or follow download URLs supplied by the file. Start with the existing limits of 10,000 records and 32 MiB; the Amsterdam source sample of approximately 1.33 MB fits comfortably. Validate before database publication.

## A record

| Field | Rule |
| --- | --- |
| `external_id` | Non-empty original ID as a string. Identity is `(dataset, external_id)`; preserve full IDs and leading zeros. No coordinate hash or internal core ID. |
| `geometry` | Original GeoJSON `Polygon` in WGS84 for Amsterdam, using `[longitude, latitude]`. Preserve rings, bound size and validate coordinate ranges and geometry. Do not invent a source point. |
| `number` | Non-negative integer or `null`; an estimate from the Amsterdam source, not a verified count. Zero and unknown remain distinct; do not turn a source aggregate into invented individual bays. |
| `street` | Source address or `null`; a nearby address is not an exact parking address. |
| `access_category` | Only `general` for this pilot; any other value blocks the delivery. This means accessible parking without a personal reservation, not availability or permit-free parking. |
| `source_attributes` | For Amsterdam: `regimes`, `orientation` and `version_date`. Preserve every regime with its times/days/dates/comments; no generic rules engine or claim of current availability. |
| `source_updated_at` | Required and strictly `null` for this Amsterdam pilot: its meaning as a source-record modification timestamp has not been established. Empty strings and arrays are also rejected. Supporting a genuine source modification timestamp first requires a reviewed source mapping and corresponding contract and validator changes; portal processing is not a field inspection. |

Core preserves the original source geometry with the source claim and uses PostGIS `ST_PointOnSurface` for the public map marker. The public map displays only that marker, not the parking polygon. Where possible, an invalid polygon receives a separate derivation through `ST_MakeValid(geometry, 'method=linework')`; only a valid, non-empty Polygon or MultiPolygon is usable. Geometries that collapse into lines/points or mixed collections are rejected without filtering out components. The map point is calculated from the usable area. It lies within that area and represents neither an entrance nor an individual bay; it need not be the geometric centroid. Core writes the existing latitude/longitude columns; PostgreSQL continues deriving the existing `location`. No additional Python geometry package or competing derivation is needed. See [PostGIS PointOnSurface](https://postgis.net/docs/ST_PointOnSurface.html), [MakeValid](https://postgis.net/docs/ST_MakeValid.html) and the [existing storage agreement](postgresql.md#spatial-representation).

Core associates country and administrative relationships using the allowed dataset configuration. Do not require Dutch codes for European sources or include internal foreign keys in the file. This pilot supports only the observed Polygon geometry. Point sources and other geometries receive support when they are integrated. Useful source information must never be silently discarded.

## Repeated deliveries and changes

| Case | Behavior |
| --- | --- |
| First complete delivery | Validate, show differences and a map sample; publish after review. |
| Same dataset and delivery ID, identical bytes | Return the existing import status; no second processing or publication. Core stores the SHA-256 of received bytes. |
| Same delivery ID, different bytes | Reject the conflict; never replace an existing delivery. |
| New delivery, unchanged records | No duplicate places or content revisions; record the new receipt. |
| `retrieved_at` older than the last accepted delivery | Do not overwrite current data. Equal timestamps with different delivery IDs are a conflict, not an arbitrary winner. |
| A field changes for the same source ID | Present the new source value for review; preserve identity, favorites and detail references. |
| A record is missing from a complete selection | Flag it as potentially removed and review it; no automatic deletion. A returning record keeps its identity. |
| Empty/incomplete/invalid delivery or failed fetch | No publication; preserve existing data and the last valid export. |
| Source value conflicts with an accepted correction | Store the source value in the received delivery, preserve the correction and block publication on conflict, including in the first import implementation. |
| Unknown access or changed scope | No automatic general publication or missing-record comparison; review first. |

Core rechecks ordering and current corrections at publication, including when two reviewed imports are ready concurrently. `retrieved_at` provides a simple ordering rule for one collector with an accurate UTC clock; it does not establish a transactional source snapshot. Future or implausible timestamps require review. Do not build a distributed counter for the pilot.

## Delivery milestones

1. **#1214:** source selection, accepted example record, semantics and this provisional agreement.
2. **disabled-parking #774:** any generic source-package fix first, followed by one live command that writes this file atomically. Replace the draft format, null completeness metadata and obsolete example route; retain only useful small tests.
3. **core #1215:** one intake path with review and safe handling of initial, changed, repeated, older, missing and conflicting deliveries. Replace/remove the old #1222 schemas and validation in the same implementation.
4. **#1217, disabled-parking #775 and core #1216:** provision the selected provider, automatically upload and discover the same delivery. The storage boundary must prevent core from processing partial files.

Regular CI runs offline with small package-object examples. A separate bounded live probe establishes source retrieval; an actual reviewed core import establishes the next step. Fixture tests alone replace neither.

## Local execution and recovery

1. Run migrations in the intended development environment and ensure Amsterdam's existing geographical relationships are present. No legacy data is automatically associated or replaced.
2. Register the integration using `php artisan nipkaart:register-amsterdam <municipality-id>`. The command checks Amsterdam, country `NL` and province `NL-NH`; publication is disabled by default. The configured bbox `[4.65, 52.2, 5.15, 52.5]` is a broad operational boundary, not an official municipal boundary.
3. As an administrator, open **Municipal imports** (shown as **Gemeentelijke imports** in the Dutch interface). Check source terms and record the supporting evidence before the first delivery to be published. Configuration changes invalidate earlier reviews; retrieve a new delivery afterwards.
4. Submit the unchanged collector file. Set PHP `upload_max_filesize` to at least `32M`, and `post_max_size` and the web server body limit above 32 MiB to allow multipart overhead. Smaller server limits apply before application validation.
5. Check counts, original source fields, every restriction and a map sample. The list displays up to 50 records per page; each record's parking area and derived point can be expanded. Approval and rejection require a reason. Records with a derivation appear first. Only the administration screen displays the original and derived geometry together for review, distinguished by lines and colors. Publishing a delivery with derivations requires explicit confirmation that every derivation has been reviewed; rejection does not require this confirmation. The service enforces this too.

`MunicipalImportService::intake()` is the shared entry point for uploads and the future bucket consumer. Authorization also applies inside the service. Publication locks one dataset row and rechecks current source records and import status. An outdated review token requires another review. The delivery, mutations and latest published retrieval timestamp are committed or rolled back together. Resubmitting identical bytes returns the existing status, including after a configuration change.

Source claims remain unchanged in `source_record`. For repairs, `geometry_derivation` separately stores the proposed shape, error reason, method and PostGIS/GEOS version; the received delivery retains the same derivation. Normal review records the reviewer, timestamp and reason. MultiPolygon components are not converted into individual parking spaces. A new delivery with the same derivation does not change content; a later source-repaired polygon removes the current derivation while preserving the previous one in the import audit. Source and derivation are covered by the review token, so a changed derivation requires review again. `last_imported_values` stores the last derived values. Current fields are the effective values: a difference from the previous import is conservatively treated as a manual correction. Non-conflicting corrections and visibility are preserved; a concurrent conflicting source change blocks publication. `last_checked_at` records the successful check; `source_updated_at` remains unknown. Existing municipal records that are not connected to this integration remain untouched; linking or reconciling them is separate work.

`municipal_imports.before_values` stores previous database values for changed records and `null` for newly created records. The received delivery and review are retained. This supports an informed recovery decision; there is no automatic rollback button that could overwrite later manual corrections. A database failure leaves the delivery available for review and the same publication can be retried. The review page always compares against current data, including after publication; historical differences are distinct from this current comparison.

Rolling back the migration removes the import audit and source association. Back up the database first and assess recovery at the data level; reverting code does not restore data. Unknown capacity remains nullable, including after rollback. Production activation, legacy transfer, bucket credentials and scheduling are outside this step.

## Automatic R2 handoff (#775 / #1216)

The collector uploads the same file in one `PutObject` to `municipal/nl-amsterdam-parkeervakken-e6a/<delivery_id>.json` in a private Cloudflare R2 bucket. `If-None-Match: *` prevents this uploader from overwriting objects. `Content-MD5` contains the base64-encoded binary MD5 digest of the file bytes (not the hexadecimal digest) and checks transport integrity; `sha256` metadata contains the SHA-256 of the exact bytes. When an object name already exists, the collector compares its full remote content with the retained pending file. Only identical bytes count as a successful retry. No multipart upload or separate manifest. See the [supported R2 operations](https://developers.cloudflare.com/r2/api/s3/api/).

The consumer in core #1216 discovers complete objects within the allowed prefix, limits downloads to 32 MiB, and checks SHA-256, file contents and agreement between object name, dataset and delivery ID before calling the same intake. Metadata is not an independent source of trust. Existing intake rules for conflicts, retries, ordering and review remain in force; receiving a file never publishes it automatically.

One persistent collector container on an owner-managed Linux host runs finite commands serially. The default wait after success is 24 hours; after failures, at most five minutes. A volume retains `pending.json` until upload is acknowledged, then keeps `last.json`. After a restart, the same bytes are retried before fetching new data. The final region, retention exceeding the allowed core outage, budget and verified access rights remain part of #1217. Implementation and local tests do not replace recovery rehearsal against actual staging R2 and core.

## Core bucket intake (#1216)

Automatic intake is opt-in through `MUNICIPAL_DELIVERIES_ENABLED`. Configure `MUNICIPAL_R2_ENDPOINT`, `MUNICIPAL_R2_BUCKET`, `MUNICIPAL_R2_ACCESS_KEY_ID` and `MUNICIPAL_R2_SECRET_ACCESS_KEY` with dedicated read/list credentials, then refresh Laravel's configuration cache. Core needs no collector credentials or municipal API access. The source must already be registered using the existing Amsterdam command. Allowed dataset prefixes and the maximum expected age (48 hours for Amsterdam) are configured in `config/municipal-deliveries.php`; source retrieval scheduling remains in the collector.

Run `php artisan nipkaart:discover-municipal-deliveries` for a one-off discovery. When enabled, Laravel schedules the command every five minutes. Run the usual Laravel scheduler and queue worker using shared database/cache infrastructure. Jobs use a 60-second timeout, three attempts and a 30-second retry delay; the queue reservation timeout must exceed 60 seconds (the existing database/Redis default is 90). S3 requests use bounded timeouts and one SDK retry. Only the configured bucket and exact dataset/UUID JSON paths are considered; partial files and arbitrary paths are ignored. Listing pagination is handled by the existing AWS SDK. Downloads use the discovered ETag as an `If-Match` condition and validate SHA-256 and bounded file length before intake.

The additive `municipal_deliveries` table records object identity and discovery time before dispatch. A later discovery redispatches pending receipts, including ones left behind when queue dispatch or processing failed. A queue uniqueness lock lasts at most five minutes; failed dispatch may therefore delay recovery until that lock expires. Receipt processing locks the database row, and intake plus validated receipt status commit together. Repeated jobs return without another download once processing has completed. Missing objects, interrupted reads and transient storage failures remain retryable; complete invalid deliveries are retained as rejected receipts with a safe error code. A changed ETag on an already discovered object is flagged as an immutable-object conflict. Do not automatically delete or reset rejected receipts to make errors disappear.

Successful receipt records `received_at` and `validated_at` separately from the source retrieval timestamp and later publication review. `late_on_receipt` records whether the source retrieval was already beyond the configured expected age at intake; it is not a continuously updated freshness indicator. Late retained files can still be reviewed after an outage, while existing publication ordering prevents older data replacing newer published data. Machine intake has no human submitter (`submitted_by = null`); it enters the same validation and staging implementation through an internal storage entry point. Manual upload authorization and publication policies remain unchanged. Bucket receipt never approves or publishes a delivery.

Keep R2 retention longer than the agreed maximum core outage. Losing the pending queue does not lose receipt identity; losing a retained object before intake prevents its recovery. A database rollback of this migration drops transport receipts but retains the existing import/review records; reconstruct receipts from retained objects, which remain subject to existing delivery-ID deduplication. Verify real R2 access boundaries, retention and outage/replay behavior in isolated staging before production activation. Local SDK-stub tests do not prove the deployed bucket configuration or real multi-worker behavior.
