package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/janhoon/dash/backend/internal/models"
)

func TestParseTrace_JaegerDataFormat(t *testing.T) {
	payload := []byte(`{"data":[{"traceID":"trace-1","spans":[{"traceID":"trace-1","spanID":"root","operationName":"GET /","references":[],"startTime":1700000000000000,"duration":2000,"tags":[{"key":"http.method","value":"GET"}],"logs":[{"timestamp":1700000000000100,"fields":[{"key":"event","value":"start"}]}],"processID":"p1"},{"traceID":"trace-1","spanID":"child","operationName":"SELECT users","references":[{"refType":"CHILD_OF","spanID":"root"}],"startTime":1700000000000500,"duration":500,"tags":[{"key":"error","value":true}],"processID":"p2"}],"processes":{"p1":{"serviceName":"frontend"},"p2":{"serviceName":"postgres"}}}]}`)

	trace, err := parseTrace(payload)
	if err != nil {
		t.Fatalf("parseTrace returned error: %v", err)
	}

	if trace.TraceID != "trace-1" {
		t.Fatalf("expected trace id trace-1, got %q", trace.TraceID)
	}
	if len(trace.Spans) != 2 {
		t.Fatalf("expected 2 spans, got %d", len(trace.Spans))
	}
	if trace.Spans[1].ParentSpanID != "root" {
		t.Fatalf("expected child span parent root, got %q", trace.Spans[1].ParentSpanID)
	}
	if trace.Spans[1].Status != "error" {
		t.Fatalf("expected child span status error, got %q", trace.Spans[1].Status)
	}
	if !slices.Equal(trace.Services, []string{"frontend", "postgres"}) {
		t.Fatalf("expected services [frontend postgres], got %#v", trace.Services)
	}
	if trace.DurationNano <= 0 {
		t.Fatalf("expected positive trace duration, got %d", trace.DurationNano)
	}
}

func TestParseTrace_TempoBatchesFormat(t *testing.T) {
	payload := []byte(`{"batches":[{"processes":{"p1":{"serviceName":"api"}},"spans":[{"traceId":"trace-batch","spanId":"span-1","operationName":"GET /health","processId":"p1","startTimeUnixNano":"1700000000000000000","durationNanos":"3000000"}]}]}`)

	trace, err := parseTrace(payload)
	if err != nil {
		t.Fatalf("parseTrace returned error: %v", err)
	}

	if trace.TraceID != "trace-batch" {
		t.Fatalf("expected trace id trace-batch, got %q", trace.TraceID)
	}
	if len(trace.Spans) != 1 {
		t.Fatalf("expected 1 span, got %d", len(trace.Spans))
	}
	if trace.Spans[0].ServiceName != "api" {
		t.Fatalf("expected service api, got %q", trace.Spans[0].ServiceName)
	}
	if trace.Spans[0].DurationNano != 3000000 {
		t.Fatalf("expected duration 3000000, got %d", trace.Spans[0].DurationNano)
	}
}

func TestParseTraceSearchResponse_TempoFormat(t *testing.T) {
	payload := []byte(`{"traces":[{"traceID":"trace-tempo","rootServiceName":"frontend","rootTraceName":"GET /api","startTimeUnixNano":"1700000000000000000","durationMs":12.5,"spanSet":[{},{}]}]}`)

	traces, err := parseTraceSearchResponse(payload)
	if err != nil {
		t.Fatalf("parseTraceSearchResponse returned error: %v", err)
	}

	if len(traces) != 1 {
		t.Fatalf("expected 1 trace summary, got %d", len(traces))
	}
	if traces[0].TraceID != "trace-tempo" {
		t.Fatalf("expected trace id trace-tempo, got %q", traces[0].TraceID)
	}
	if traces[0].SpanCount != 2 {
		t.Fatalf("expected span count 2, got %d", traces[0].SpanCount)
	}
	if traces[0].DurationNano <= 0 {
		t.Fatalf("expected positive duration, got %d", traces[0].DurationNano)
	}
}

func TestParseTraceSearchResponse_JaegerFormat(t *testing.T) {
	payload := []byte(`{"data":[{"traceID":"trace-jaeger","spans":[{"traceID":"trace-jaeger","spanID":"root","operationName":"GET /","references":[],"startTime":1700000000000000,"duration":1000,"tags":[],"processID":"p1"},{"traceID":"trace-jaeger","spanID":"child","operationName":"db","references":[{"refType":"CHILD_OF","spanID":"root"}],"startTime":1700000000000200,"duration":400,"tags":[{"key":"error","value":"true"}],"processID":"p2"}],"processes":{"p1":{"serviceName":"frontend"},"p2":{"serviceName":"postgres"}}}]}`)

	traces, err := parseTraceSearchResponse(payload)
	if err != nil {
		t.Fatalf("parseTraceSearchResponse returned error: %v", err)
	}

	if len(traces) != 1 {
		t.Fatalf("expected 1 trace summary, got %d", len(traces))
	}
	if traces[0].RootServiceName != "frontend" {
		t.Fatalf("expected root service frontend, got %q", traces[0].RootServiceName)
	}
	if traces[0].ErrorSpanCount != 1 {
		t.Fatalf("expected 1 error span, got %d", traces[0].ErrorSpanCount)
	}
}

func TestParseStringSlicePayload(t *testing.T) {
	fromWrapped, err := parseStringSlicePayload([]byte(`{"data":["api","worker"]}`))
	if err != nil {
		t.Fatalf("parseStringSlicePayload wrapped returned error: %v", err)
	}
	if !slices.Equal(fromWrapped, []string{"api", "worker"}) {
		t.Fatalf("expected wrapped payload to parse, got %#v", fromWrapped)
	}

	fromRaw, err := parseStringSlicePayload([]byte(`["api","worker"]`))
	if err != nil {
		t.Fatalf("parseStringSlicePayload raw returned error: %v", err)
	}
	if !slices.Equal(fromRaw, []string{"api", "worker"}) {
		t.Fatalf("expected raw payload to parse, got %#v", fromRaw)
	}
}

func TestTempoClient_GetTrace(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/traces/trace-123" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"data":[{"traceID":"trace-123","spans":[{"traceID":"trace-123","spanID":"root","operationName":"GET /","references":[],"startTime":1700000000000000,"duration":1000,"tags":[],"processID":"p1"}],"processes":{"p1":{"serviceName":"frontend"}}}]}`))
	}))
	defer server.Close()

	client, err := NewTempoClient(models.DataSource{Type: models.DataSourceTempo, URL: server.URL})
	if err != nil {
		t.Fatalf("NewTempoClient returned error: %v", err)
	}

	trace, err := client.GetTrace(context.Background(), "trace-123")
	if err != nil {
		t.Fatalf("GetTrace returned error: %v", err)
	}

	if trace.TraceID != "trace-123" {
		t.Fatalf("expected trace id trace-123, got %q", trace.TraceID)
	}
}

func TestVictoriaTracesClient_ServicesFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/select/jaeger/api/services":
			w.WriteHeader(http.StatusNotFound)
		case "/api/services":
			_, _ = w.Write([]byte(`["frontend","worker"]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client, err := NewVictoriaTracesClient(models.DataSource{Type: models.DataSourceVictoriaTraces, URL: server.URL})
	if err != nil {
		t.Fatalf("NewVictoriaTracesClient returned error: %v", err)
	}

	services, err := client.Services(context.Background())
	if err != nil {
		t.Fatalf("Services returned error: %v", err)
	}

	if !slices.Equal(services, []string{"frontend", "worker"}) {
		t.Fatalf("expected services [frontend worker], got %#v", services)
	}
}
