#!/usr/bin/env python3

import json
import os
import random
import signal
import time
import urllib.error
import urllib.request


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


TARGET = os.getenv("OTEL_LOAD_TARGET", "http://otel-collector:4318/v1/traces").strip()
INTERVAL_SEC = max(env_float("OTEL_LOAD_INTERVAL_SEC", 1.0), 0.1)
TRACES_PER_BATCH = max(env_int("OTEL_LOAD_TRACES_PER_BATCH", 8), 1)
SERVICE_PREFIX = (
    os.getenv("OTEL_LOAD_SERVICE_PREFIX", "loadgen-service").strip()
    or "loadgen-service"
)
SERVICE_COUNT = max(env_int("OTEL_LOAD_SERVICE_COUNT", 3), 1)
ERROR_EVERY = max(env_int("OTEL_LOAD_ERROR_EVERY", 7), 1)

RUNNING = True
BATCH_INDEX = 0


def handle_stop(_signal, _frame):
    global RUNNING
    RUNNING = False
    print("received stop signal, exiting", flush=True)


def span(
    trace_id: str,
    span_id: str,
    name: str,
    start_ns: int,
    end_ns: int,
    parent_id: str = "",
    error: bool = False,
):
    payload = {
        "traceId": trace_id,
        "spanId": span_id,
        "name": name,
        "startTimeUnixNano": str(start_ns),
        "endTimeUnixNano": str(end_ns),
        "attributes": [
            {"key": "loadgen.marker", "value": {"stringValue": "true"}},
            {"key": "loadgen.batch", "value": {"intValue": str(BATCH_INDEX)}},
        ],
    }

    if parent_id:
        payload["parentSpanId"] = parent_id

    if error:
        payload["status"] = {"code": "STATUS_CODE_ERROR"}
        payload["attributes"].append({"key": "error", "value": {"stringValue": "true"}})

    return payload


def build_payload():
    now = time.time_ns()
    resource_spans = []

    for idx in range(TRACES_PER_BATCH):
        trace_id = os.urandom(16).hex()
        root_span_id = os.urandom(8).hex()
        service_name = f"{SERVICE_PREFIX}-{(BATCH_INDEX + idx) % SERVICE_COUNT + 1}"
        root_start = now + idx * 3_000_000
        root_duration = random.randint(30, 120) * 1_000_000
        root_end = root_start + root_duration

        db_start = root_start + 6_000_000
        db_end = db_start + random.randint(4, 14) * 1_000_000
        cache_start = root_start + 9_000_000
        cache_end = cache_start + random.randint(2, 10) * 1_000_000

        trace_error = (BATCH_INDEX + idx) % ERROR_EVERY == 0

        spans = [
            span(
                trace_id,
                root_span_id,
                "http.request",
                root_start,
                root_end,
                error=trace_error,
            ),
            span(
                trace_id,
                os.urandom(8).hex(),
                "db.query",
                db_start,
                db_end,
                parent_id=root_span_id,
                error=trace_error,
            ),
            span(
                trace_id,
                os.urandom(8).hex(),
                "cache.lookup",
                cache_start,
                cache_end,
                parent_id=root_span_id,
            ),
        ]

        spans[0]["attributes"].extend(
            [
                {"key": "http.method", "value": {"stringValue": "GET"}},
                {"key": "http.route", "value": {"stringValue": "/api/loadgen"}},
            ]
        )

        resource_spans.append(
            {
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": service_name}},
                        {
                            "key": "deployment.environment",
                            "value": {"stringValue": "load-test"},
                        },
                    ]
                },
                "scopeSpans": [
                    {
                        "scope": {"name": "dash-otel-loadgen", "version": "1.0.0"},
                        "spans": spans,
                    }
                ],
            }
        )

    return {"resourceSpans": resource_spans}


def send_batch(payload):
    request = urllib.request.Request(
        TARGET,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=10) as response:
        _ = response.read()
        return response.status


def main():
    global BATCH_INDEX

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    print(
        f"starting otel loadgen target={TARGET} interval={INTERVAL_SEC}s traces_per_batch={TRACES_PER_BATCH}",
        flush=True,
    )

    while RUNNING:
        payload = build_payload()
        try:
            status = send_batch(payload)
            print(
                f"batch={BATCH_INDEX} status={status} traces={TRACES_PER_BATCH}",
                flush=True,
            )
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="replace")
            print(f"batch={BATCH_INDEX} status={err.code} error={body}", flush=True)
        except Exception as err:  # pylint: disable=broad-except
            print(f"batch={BATCH_INDEX} error={err}", flush=True)

        BATCH_INDEX += 1
        time.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    main()
