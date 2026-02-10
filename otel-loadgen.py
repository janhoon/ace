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


def env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if raw == "":
        return default
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
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
ENABLE_INTERSERVICE = env_bool("OTEL_LOAD_ENABLE_INTERSERVICE", True)
INTERSERVICE_RATIO = min(max(env_float("OTEL_LOAD_INTERSERVICE_RATIO", 0.85), 0.0), 1.0)

NS_PER_MS = 1_000_000

RUNNING = True
BATCH_INDEX = 0


def handle_stop(_signal, _frame):
    global RUNNING
    RUNNING = False
    print("received stop signal, exiting", flush=True)


def otlp_value(value):
    if isinstance(value, bool):
        return {"boolValue": value}
    if isinstance(value, int):
        return {"intValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    return {"stringValue": str(value)}


def otlp_attr(key: str, value):
    return {"key": key, "value": otlp_value(value)}


def ensure_end(start_ns: int, end_ns: int, minimum_duration_ms: int = 1) -> int:
    minimum_duration_ns = minimum_duration_ms * NS_PER_MS
    if end_ns <= start_ns:
        return start_ns + minimum_duration_ns
    return end_ns


def new_span_id() -> str:
    return os.urandom(8).hex()


def span(
    trace_id: str,
    span_id: str,
    name: str,
    start_ns: int,
    end_ns: int,
    kind: int = 1,
    parent_id: str = "",
    attrs=None,
    error: bool = False,
):
    attributes = [
        otlp_attr("loadgen.marker", True),
        otlp_attr("loadgen.batch", BATCH_INDEX),
    ]
    if attrs:
        attributes.extend(attrs)

    payload = {
        "traceId": trace_id,
        "spanId": span_id,
        "name": name,
        "kind": kind,
        "startTimeUnixNano": str(start_ns),
        "endTimeUnixNano": str(ensure_end(start_ns, end_ns)),
        "attributes": attributes,
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
    total_spans = 0
    interservice_trace_count = 0

    for idx in range(TRACES_PER_BATCH):
        trace_id = os.urandom(16).hex()
        edge_service = (
            f"{SERVICE_PREFIX}-edge-{(BATCH_INDEX + idx) % SERVICE_COUNT + 1}"
        )
        trace_start = now + idx * 4 * NS_PER_MS
        trace_error = (BATCH_INDEX + idx) % ERROR_EVERY == 0

        use_interservice = ENABLE_INTERSERVICE and random.random() < INTERSERVICE_RATIO
        if use_interservice:
            trace_services = build_interservice_trace(
                trace_id, edge_service, trace_start, trace_error
            )
            interservice_trace_count += 1
        else:
            trace_services = build_single_service_trace(
                trace_id, edge_service, trace_start, trace_error
            )

        for service_name, spans in trace_services.items():
            total_spans += len(spans)
            resource_spans.append(
                {
                    "resource": {
                        "attributes": [
                            otlp_attr("service.name", service_name),
                            otlp_attr("service.namespace", SERVICE_PREFIX),
                            otlp_attr("deployment.environment", "load-test"),
                        ]
                    },
                    "scopeSpans": [
                        {
                            "scope": {"name": "dash-otel-loadgen", "version": "2.0.0"},
                            "spans": spans,
                        }
                    ],
                }
            )

    return (
        {"resourceSpans": resource_spans},
        {
            "span_count": total_spans,
            "interservice_traces": interservice_trace_count,
            "resource_span_count": len(resource_spans),
        },
    )


def build_single_service_trace(
    trace_id: str, service_name: str, trace_start: int, trace_error: bool
):
    root_span_id = new_span_id()
    root_duration = random.randint(30, 120) * NS_PER_MS
    root_end = trace_start + root_duration

    db_start = trace_start + random.randint(5, 12) * NS_PER_MS
    db_end = db_start + random.randint(4, 14) * NS_PER_MS

    cache_start = trace_start + random.randint(9, 16) * NS_PER_MS
    cache_end = cache_start + random.randint(2, 10) * NS_PER_MS

    spans = [
        span(
            trace_id,
            root_span_id,
            "GET /api/loadgen",
            trace_start,
            root_end,
            kind=2,
            attrs=[
                otlp_attr("http.method", "GET"),
                otlp_attr("http.route", "/api/loadgen"),
                otlp_attr("loadgen.trace.profile", "single-service"),
            ],
            error=trace_error,
        ),
        span(
            trace_id,
            new_span_id(),
            "db.query",
            db_start,
            db_end,
            kind=1,
            parent_id=root_span_id,
            attrs=[
                otlp_attr("db.system", "postgresql"),
                otlp_attr("db.operation", "SELECT"),
            ],
            error=trace_error,
        ),
        span(
            trace_id,
            new_span_id(),
            "cache.lookup",
            cache_start,
            cache_end,
            kind=1,
            parent_id=root_span_id,
            attrs=[
                otlp_attr("cache.system", "redis"),
                otlp_attr("cache.hit", random.choice([True, False])),
            ],
        ),
    ]

    return {service_name: spans}


def build_interservice_trace(
    trace_id: str, edge_service: str, trace_start: int, trace_error: bool
):
    checkout_service = f"{SERVICE_PREFIX}-checkout"
    payments_service = f"{SERVICE_PREFIX}-payments"
    inventory_service = f"{SERVICE_PREFIX}-inventory"
    worker_service = f"{SERVICE_PREFIX}-worker"

    service_spans = {
        edge_service: [],
        checkout_service: [],
        payments_service: [],
        inventory_service: [],
    }

    root_span_id = new_span_id()
    root_duration = random.randint(120, 280) * NS_PER_MS
    root_end = trace_start + root_duration

    edge_to_checkout_id = new_span_id()
    edge_to_checkout_start = trace_start + random.randint(2, 8) * NS_PER_MS
    edge_to_checkout_end = edge_to_checkout_start + random.randint(50, 140) * NS_PER_MS
    edge_to_checkout_end = min(edge_to_checkout_end, root_end - 15 * NS_PER_MS)
    edge_to_checkout_end = ensure_end(edge_to_checkout_start, edge_to_checkout_end, 8)

    checkout_server_id = new_span_id()
    checkout_server_start = edge_to_checkout_start + random.randint(1, 3) * NS_PER_MS
    checkout_server_end = edge_to_checkout_end - random.randint(2, 6) * NS_PER_MS
    checkout_server_end = ensure_end(checkout_server_start, checkout_server_end, 10)

    service_spans[edge_service].append(
        span(
            trace_id,
            root_span_id,
            "GET /api/checkout",
            trace_start,
            root_end,
            kind=2,
            attrs=[
                otlp_attr("http.method", "GET"),
                otlp_attr("http.route", "/api/checkout"),
                otlp_attr("loadgen.trace.profile", "inter-service"),
            ],
            error=trace_error,
        )
    )
    service_spans[edge_service].append(
        span(
            trace_id,
            edge_to_checkout_id,
            "checkout RPC",
            edge_to_checkout_start,
            edge_to_checkout_end,
            kind=3,
            parent_id=root_span_id,
            attrs=[
                otlp_attr("rpc.system", "http"),
                otlp_attr("rpc.service", checkout_service),
                otlp_attr("peer.service", checkout_service),
            ],
            error=trace_error,
        )
    )

    service_spans[checkout_service].append(
        span(
            trace_id,
            checkout_server_id,
            "POST /checkout",
            checkout_server_start,
            checkout_server_end,
            kind=2,
            parent_id=edge_to_checkout_id,
            attrs=[
                otlp_attr("http.method", "POST"),
                otlp_attr("http.route", "/checkout"),
                otlp_attr("upstream.service", edge_service),
            ],
            error=trace_error,
        )
    )

    checkout_db_start = checkout_server_start + random.randint(3, 9) * NS_PER_MS
    checkout_db_end = checkout_db_start + random.randint(8, 18) * NS_PER_MS
    service_spans[checkout_service].append(
        span(
            trace_id,
            new_span_id(),
            "orders DB query",
            checkout_db_start,
            checkout_db_end,
            kind=1,
            parent_id=checkout_server_id,
            attrs=[
                otlp_attr("db.system", "postgresql"),
                otlp_attr("db.operation", "SELECT"),
            ],
        )
    )

    checkout_to_payments_id = new_span_id()
    checkout_to_payments_start = (
        checkout_server_start + random.randint(8, 18) * NS_PER_MS
    )
    checkout_to_payments_end = (
        checkout_to_payments_start + random.randint(20, 60) * NS_PER_MS
    )
    payments_server_id = new_span_id()
    payments_server_start = (
        checkout_to_payments_start + random.randint(1, 4) * NS_PER_MS
    )
    payments_server_end = checkout_to_payments_end - random.randint(1, 4) * NS_PER_MS
    payments_server_end = ensure_end(payments_server_start, payments_server_end, 6)

    service_spans[checkout_service].append(
        span(
            trace_id,
            checkout_to_payments_id,
            "payments RPC",
            checkout_to_payments_start,
            checkout_to_payments_end,
            kind=3,
            parent_id=checkout_server_id,
            attrs=[otlp_attr("peer.service", payments_service)],
            error=trace_error,
        )
    )
    service_spans[payments_service].append(
        span(
            trace_id,
            payments_server_id,
            "POST /payments/charge",
            payments_server_start,
            payments_server_end,
            kind=2,
            parent_id=checkout_to_payments_id,
            attrs=[
                otlp_attr("http.method", "POST"),
                otlp_attr("http.route", "/payments/charge"),
            ],
            error=trace_error,
        )
    )

    payments_db_start = payments_server_start + random.randint(2, 8) * NS_PER_MS
    payments_db_end = payments_db_start + random.randint(6, 16) * NS_PER_MS
    service_spans[payments_service].append(
        span(
            trace_id,
            new_span_id(),
            "payments DB write",
            payments_db_start,
            payments_db_end,
            kind=1,
            parent_id=payments_server_id,
            attrs=[
                otlp_attr("db.system", "postgresql"),
                otlp_attr("db.operation", "INSERT"),
            ],
            error=trace_error,
        )
    )

    checkout_to_inventory_id = new_span_id()
    checkout_to_inventory_start = (
        checkout_server_start + random.randint(12, 22) * NS_PER_MS
    )
    checkout_to_inventory_end = (
        checkout_to_inventory_start + random.randint(15, 50) * NS_PER_MS
    )
    inventory_server_id = new_span_id()
    inventory_server_start = (
        checkout_to_inventory_start + random.randint(1, 3) * NS_PER_MS
    )
    inventory_server_end = checkout_to_inventory_end - random.randint(1, 3) * NS_PER_MS
    inventory_server_end = ensure_end(inventory_server_start, inventory_server_end, 6)

    service_spans[checkout_service].append(
        span(
            trace_id,
            checkout_to_inventory_id,
            "inventory RPC",
            checkout_to_inventory_start,
            checkout_to_inventory_end,
            kind=3,
            parent_id=checkout_server_id,
            attrs=[otlp_attr("peer.service", inventory_service)],
        )
    )
    service_spans[inventory_service].append(
        span(
            trace_id,
            inventory_server_id,
            "GET /inventory/reserve",
            inventory_server_start,
            inventory_server_end,
            kind=2,
            parent_id=checkout_to_inventory_id,
            attrs=[
                otlp_attr("http.method", "GET"),
                otlp_attr("http.route", "/inventory/reserve"),
            ],
        )
    )
    cache_start = inventory_server_start + random.randint(2, 6) * NS_PER_MS
    cache_end = cache_start + random.randint(3, 10) * NS_PER_MS
    service_spans[inventory_service].append(
        span(
            trace_id,
            new_span_id(),
            "inventory cache lookup",
            cache_start,
            cache_end,
            kind=1,
            parent_id=inventory_server_id,
            attrs=[
                otlp_attr("cache.system", "redis"),
                otlp_attr("cache.hit", random.choice([True, False])),
            ],
        )
    )

    if random.random() < 0.65:
        producer_span_id = new_span_id()
        producer_start = checkout_server_start + random.randint(28, 44) * NS_PER_MS
        producer_end = producer_start + random.randint(3, 9) * NS_PER_MS
        service_spans[checkout_service].append(
            span(
                trace_id,
                producer_span_id,
                "order.events publish",
                producer_start,
                producer_end,
                kind=4,
                parent_id=checkout_server_id,
                attrs=[
                    otlp_attr("messaging.system", "kafka"),
                    otlp_attr("messaging.destination", "order-events"),
                ],
            )
        )

        worker_consume_id = new_span_id()
        worker_start = producer_start + random.randint(2, 7) * NS_PER_MS
        worker_end = worker_start + random.randint(12, 40) * NS_PER_MS
        worker_db_start = worker_start + random.randint(2, 6) * NS_PER_MS
        worker_db_end = worker_db_start + random.randint(5, 13) * NS_PER_MS

        service_spans[worker_service] = [
            span(
                trace_id,
                worker_consume_id,
                "order.events consume",
                worker_start,
                worker_end,
                kind=5,
                parent_id=producer_span_id,
                attrs=[
                    otlp_attr("messaging.system", "kafka"),
                    otlp_attr("messaging.destination", "order-events"),
                ],
            ),
            span(
                trace_id,
                new_span_id(),
                "fulfillment DB update",
                worker_db_start,
                worker_db_end,
                kind=1,
                parent_id=worker_consume_id,
                attrs=[
                    otlp_attr("db.system", "postgresql"),
                    otlp_attr("db.operation", "UPDATE"),
                ],
            ),
        ]

    return service_spans


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
        (
            f"starting otel loadgen target={TARGET} interval={INTERVAL_SEC}s "
            f"traces_per_batch={TRACES_PER_BATCH} interservice={ENABLE_INTERSERVICE} "
            f"interservice_ratio={INTERSERVICE_RATIO}"
        ),
        flush=True,
    )

    while RUNNING:
        payload, stats = build_payload()
        try:
            status = send_batch(payload)
            print(
                (
                    f"batch={BATCH_INDEX} status={status} traces={TRACES_PER_BATCH} "
                    f"spans={stats['span_count']} interservice={stats['interservice_traces']} "
                    f"resourceSpans={stats['resource_span_count']}"
                ),
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
