"""Independent offline Python interpretation of the v1 snapshot contract.

This is a parity reference, not a scheduler, importer or source adapter.
"""
import hashlib
import json
import time
from datetime import datetime
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry

ROOT = Path(__file__).resolve().parents[3]
MAX_MANIFEST_BYTES = 16384
MAX_ARTIFACT_BYTES = 33554432
MAX_LINE_BYTES = 16384
MAX_RECORDS = 10000
MAX_VALIDATION_SECONDS = 30
FORMATS = FormatChecker()


@FORMATS.checks("date-time", raises=ValueError)
def utc_timestamp(value):
    if not isinstance(value, str):
        return True
    datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    return True


def no_remote_reference(uri):
    raise ValueError("Remote schema references are forbidden")


def validator(name):
    schema = json.loads((ROOT / f"resources/schemas/import/v1/{name}.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FORMATS, registry=Registry(retrieve=no_remote_reference))


MANIFEST = validator("manifest")
RECORD = validator("municipal-record")


def reject_constant(value):
    raise ValueError(f"Non-JSON number: {value}")


def check(manifest_bytes, records_path, context, clock=time.monotonic):
    started = clock()
    if len(manifest_bytes) > MAX_MANIFEST_BYTES:
        return "invalid"
    try:
        manifest = json.loads(manifest_bytes.decode("utf-8"), parse_constant=reject_constant)
        if not MANIFEST.is_valid(manifest):
            return "invalid"
        completeness, artifact = manifest["completeness"], manifest["artifact"]
        duration = (datetime.strptime(manifest["fetched_finished_at"], "%Y-%m-%dT%H:%M:%SZ") - datetime.strptime(manifest["fetched_started_at"], "%Y-%m-%dT%H:%M:%SZ")).total_seconds()
        if (manifest["source_id"] != context["source_id"]
            or artifact["key"] != f'sources/{manifest["source_id"]}/batches/{manifest["batch_id"]}/records.jsonl'
            or not 0 <= duration <= 1800
            or completeness["records_seen"] != completeness["records_emitted"] + completeness["records_filtered_out"]
            or completeness["records_emitted"] != artifact["record_count"]
            or (completeness["expected_records"] is not None and completeness["expected_records"] != completeness["records_seen"])):
            return "invalid"
        digest, byte_count, ids, review = hashlib.sha256(), 0, set(), False
        with Path(records_path).open("rb") as stream:
            while line := stream.readline(MAX_LINE_BYTES + 1):
                byte_count += len(line)
                if (byte_count > MAX_ARTIFACT_BYTES or len(line) > MAX_LINE_BYTES
                    or not line.endswith(b"\n") or b"\r" in line
                    or clock() - started > MAX_VALIDATION_SECONDS):
                    return "invalid"
                digest.update(line)
                record = json.loads(line.decode("utf-8"), parse_constant=reject_constant)
                if not RECORD.is_valid(record) or record["external_id"] in ids or len(ids) >= MAX_RECORDS:
                    return "invalid"
                ids.add(record["external_id"])
                west, south, east, north = context["bounds"]
                position = record["position"]
                if (record["country_code"] != context["country_code"]
                    or not west <= position["longitude"] <= east
                    or not south <= position["latitude"] <= north):
                    return "invalid"
                review |= record["access_category"] != "designated_accessible" or bool(record["unmapped_fields"] or record["restrictions"])
        if (byte_count != artifact["bytes"] or len(ids) != artifact["record_count"]
            or digest.hexdigest() != artifact["sha256"]
            or clock() - started > MAX_VALIDATION_SECONDS):
            return "invalid"
        known_hash = context["batches"].get(manifest["batch_id"])
        if known_hash is not None:
            return "duplicate" if known_hash == hashlib.sha256(manifest_bytes).hexdigest() else "conflict"
        if str(manifest["source_sequence"]) in context["sequences"]:
            return "conflict"
        if manifest["source_sequence"] <= context["highest_sequence"]:
            return "superseded"
        if (review or not ids or manifest["scope_version"] != context["scope_version"]
            or manifest["source_config_version"] != context["source_config_version"]):
            return "review"
        return "valid"
    except (ValueError, OSError, RecursionError):
        return "invalid"
