package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/janhoon/dash/backend/internal/models"
)

// TracingClient is the interface for trace-specific datasource operations.
type TracingClient interface {
	GetTrace(ctx context.Context, traceID string) (*Trace, error)
	SearchTraces(ctx context.Context, req TraceSearchRequest) ([]TraceSummary, error)
	Services(ctx context.Context) ([]string, error)
}

// TraceSearchRequest represents a trace search request body.
type TraceSearchRequest struct {
	Query       string            `json:"query,omitempty"`
	Service     string            `json:"service,omitempty"`
	Operation   string            `json:"operation,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
	MinDuration string            `json:"minDuration,omitempty"`
	MaxDuration string            `json:"maxDuration,omitempty"`
	Start       int64             `json:"start,omitempty"` // unix seconds
	End         int64             `json:"end,omitempty"`   // unix seconds
	Limit       int               `json:"limit,omitempty"`
}

// Trace is the unified trace model returned by tracing endpoints.
type Trace struct {
	TraceID           string      `json:"traceId"`
	Spans             []TraceSpan `json:"spans"`
	Services          []string    `json:"services"`
	StartTimeUnixNano int64       `json:"startTimeUnixNano"`
	DurationNano      int64       `json:"durationNano"`
}

// TraceSpan is a normalized span model.
type TraceSpan struct {
	SpanID            string            `json:"spanId"`
	ParentSpanID      string            `json:"parentSpanId,omitempty"`
	OperationName     string            `json:"operationName"`
	ServiceName       string            `json:"serviceName"`
	StartTimeUnixNano int64             `json:"startTimeUnixNano"`
	DurationNano      int64             `json:"durationNano"`
	Tags              map[string]string `json:"tags,omitempty"`
	Logs              []TraceLog        `json:"logs,omitempty"`
	Status            string            `json:"status,omitempty"`
}

// TraceLog is a normalized span log/event.
type TraceLog struct {
	TimestampUnixNano int64             `json:"timestampUnixNano"`
	Fields            map[string]string `json:"fields,omitempty"`
}

// TraceSummary is a compact trace model for search results.
type TraceSummary struct {
	TraceID           string `json:"traceId"`
	RootServiceName   string `json:"rootServiceName,omitempty"`
	RootOperationName string `json:"rootOperationName,omitempty"`
	StartTimeUnixNano int64  `json:"startTimeUnixNano"`
	DurationNano      int64  `json:"durationNano"`
	SpanCount         int    `json:"spanCount"`
	ServiceCount      int    `json:"serviceCount"`
	ErrorSpanCount    int    `json:"errorSpanCount"`
}

func NewTracingClient(ds models.DataSource) (TracingClient, error) {
	switch ds.Type {
	case models.DataSourceTempo:
		return NewTempoClient(ds)
	case models.DataSourceVictoriaTraces:
		return NewVictoriaTracesClient(ds)
	default:
		return nil, fmt.Errorf("unsupported tracing datasource type: %s", ds.Type)
	}
}

func doTracingRequest(ctx context.Context, httpClient *http.Client, ds models.DataSource, method, endpoint string, body io.Reader) ([]byte, error) {
	targetURL, err := resolveHealthEndpoint(ds.URL, endpoint)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, method, targetURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if err := applyDataSourceAuth(req, ds); err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	payload, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, fmt.Errorf("failed to read response body: %w", readErr)
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return payload, nil
	}

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("authentication failed with status %d", resp.StatusCode)
	}

	message := strings.TrimSpace(string(payload))
	if message == "" {
		message = http.StatusText(resp.StatusCode)
	}

	return nil, fmt.Errorf("tracing api request failed with status %d: %s", resp.StatusCode, message)
}

func buildTraceSearchParams(req TraceSearchRequest) url.Values {
	values := url.Values{}

	if q := strings.TrimSpace(req.Query); q != "" {
		values.Set("q", q)
		values.Set("query", q)
	}
	if service := strings.TrimSpace(req.Service); service != "" {
		values.Set("service", service)
	}
	if operation := strings.TrimSpace(req.Operation); operation != "" {
		values.Set("operation", operation)
	}
	if minDuration := strings.TrimSpace(req.MinDuration); minDuration != "" {
		values.Set("minDuration", minDuration)
	}
	if maxDuration := strings.TrimSpace(req.MaxDuration); maxDuration != "" {
		values.Set("maxDuration", maxDuration)
	}
	if req.Start > 0 {
		values.Set("start", strconv.FormatInt(req.Start, 10))
	}
	if req.End > 0 {
		values.Set("end", strconv.FormatInt(req.End, 10))
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 1000 {
		limit = 1000
	}
	values.Set("limit", strconv.Itoa(limit))

	if len(req.Tags) > 0 {
		keys := make([]string, 0, len(req.Tags))
		for key := range req.Tags {
			keys = append(keys, key)
		}
		sort.Strings(keys)

		tags := make([]string, 0, len(keys))
		for _, key := range keys {
			tags = append(tags, key+"="+req.Tags[key])
		}

		values.Set("tags", strings.Join(tags, ","))
	}

	return values
}

type jaegerTag struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

type jaegerLog struct {
	Timestamp int64       `json:"timestamp"`
	Fields    []jaegerTag `json:"fields"`
}

type jaegerReference struct {
	RefType string `json:"refType"`
	SpanID  string `json:"spanID"`
}

type jaegerSpan struct {
	TraceID       string            `json:"traceID"`
	SpanID        string            `json:"spanID"`
	OperationName string            `json:"operationName"`
	References    []jaegerReference `json:"references"`
	StartTime     int64             `json:"startTime"`
	Duration      int64             `json:"duration"`
	Tags          []jaegerTag       `json:"tags"`
	Logs          []jaegerLog       `json:"logs"`
	ProcessID     string            `json:"processID"`
}

type jaegerProcess struct {
	ServiceName string `json:"serviceName"`
}

type jaegerTraceEnvelope struct {
	TraceID   string                   `json:"traceID"`
	Spans     []jaegerSpan             `json:"spans"`
	Processes map[string]jaegerProcess `json:"processes"`
}

type jaegerTraceResponse struct {
	Data []jaegerTraceEnvelope `json:"data"`
}

func parseTrace(tracePayload []byte) (*Trace, error) {
	if trace, err := parseJaegerDataTrace(tracePayload); err == nil {
		return trace, nil
	}

	return parseTempoBatchesTrace(tracePayload)
}

func parseJaegerDataTrace(tracePayload []byte) (*Trace, error) {
	var decoded jaegerTraceResponse
	if err := json.Unmarshal(tracePayload, &decoded); err != nil {
		return nil, fmt.Errorf("failed to decode jaeger trace response: %w", err)
	}

	if len(decoded.Data) == 0 {
		return nil, fmt.Errorf("trace response has no data")
	}

	trace := decoded.Data[0]
	return jaegerEnvelopeToTrace(trace), nil
}

func jaegerEnvelopeToTrace(trace jaegerTraceEnvelope) *Trace {
	servicesSet := map[string]struct{}{}
	spans := make([]TraceSpan, 0, len(trace.Spans))
	traceID := trace.TraceID

	var startMin int64
	var endMax int64

	for idx, span := range trace.Spans {
		if traceID == "" {
			traceID = span.TraceID
		}

		serviceName := trace.Processes[span.ProcessID].ServiceName
		if serviceName != "" {
			servicesSet[serviceName] = struct{}{}
		}

		parentSpanID := ""
		for _, ref := range span.References {
			if strings.EqualFold(ref.RefType, "CHILD_OF") {
				parentSpanID = ref.SpanID
				break
			}
			if parentSpanID == "" {
				parentSpanID = ref.SpanID
			}
		}

		tags := map[string]string{}
		for _, tag := range span.Tags {
			tags[tag.Key] = fmt.Sprint(tag.Value)
		}

		logs := make([]TraceLog, 0, len(span.Logs))
		for _, log := range span.Logs {
			fields := map[string]string{}
			for _, field := range log.Fields {
				fields[field.Key] = fmt.Sprint(field.Value)
			}
			logs = append(logs, TraceLog{
				TimestampUnixNano: log.Timestamp * 1000,
				Fields:            fields,
			})
		}

		startUnixNano := span.StartTime * 1000
		durationNano := span.Duration * 1000
		endUnixNano := startUnixNano + durationNano

		if idx == 0 || startUnixNano < startMin {
			startMin = startUnixNano
		}
		if idx == 0 || endUnixNano > endMax {
			endMax = endUnixNano
		}

		traceSpan := TraceSpan{
			SpanID:            span.SpanID,
			ParentSpanID:      parentSpanID,
			OperationName:     span.OperationName,
			ServiceName:       serviceName,
			StartTimeUnixNano: startUnixNano,
			DurationNano:      durationNano,
			Tags:              tags,
			Logs:              logs,
		}
		if hasErrorTag(tags) {
			traceSpan.Status = "error"
		}

		spans = append(spans, traceSpan)
	}

	services := make([]string, 0, len(servicesSet))
	for service := range servicesSet {
		services = append(services, service)
	}
	sort.Strings(services)

	duration := int64(0)
	if endMax > startMin {
		duration = endMax - startMin
	}

	return &Trace{
		TraceID:           traceID,
		Spans:             spans,
		Services:          services,
		StartTimeUnixNano: startMin,
		DurationNano:      duration,
	}
}

func parseTempoBatchesTrace(tracePayload []byte) (*Trace, error) {
	var decoded map[string]interface{}
	if err := json.Unmarshal(tracePayload, &decoded); err != nil {
		return nil, fmt.Errorf("failed to decode tempo trace response: %w", err)
	}

	rawBatches, ok := decoded["batches"].([]interface{})
	if !ok || len(rawBatches) == 0 {
		return nil, fmt.Errorf("trace response has no data")
	}

	servicesSet := map[string]struct{}{}
	spans := make([]TraceSpan, 0)
	traceID := ""

	var startMin int64
	var endMax int64
	spanIndex := 0

	for _, rawBatch := range rawBatches {
		batchMap, ok := rawBatch.(map[string]interface{})
		if !ok {
			continue
		}

		processServiceByID := map[string]string{}
		if rawProcesses, ok := batchMap["processes"].(map[string]interface{}); ok {
			for processID, rawProcess := range rawProcesses {
				if processMap, ok := rawProcess.(map[string]interface{}); ok {
					if serviceName := anyToString(processMap["serviceName"]); serviceName != "" {
						processServiceByID[processID] = serviceName
					}
				}
			}
		}

		rawSpans, ok := batchMap["spans"].([]interface{})
		if !ok {
			continue
		}

		for _, rawSpan := range rawSpans {
			spanMap, ok := rawSpan.(map[string]interface{})
			if !ok {
				continue
			}

			spanTraceID := anyToString(firstNonNil(spanMap["traceID"], spanMap["traceId"]))
			if traceID == "" {
				traceID = spanTraceID
			}

			spanID := anyToString(firstNonNil(spanMap["spanID"], spanMap["spanId"]))
			operationName := anyToString(spanMap["operationName"])
			processID := anyToString(firstNonNil(spanMap["processID"], spanMap["processId"]))

			serviceName := processServiceByID[processID]
			if serviceName == "" {
				if rawProcess, ok := spanMap["process"].(map[string]interface{}); ok {
					serviceName = anyToString(rawProcess["serviceName"])
				}
			}
			if serviceName != "" {
				servicesSet[serviceName] = struct{}{}
			}

			startUnixNano, ok := anyToInt64(firstNonNil(spanMap["startTimeUnixNano"], spanMap["startTimeUnixNanos"]))
			if !ok {
				if startMicros, microsOK := anyToInt64(spanMap["startTime"]); microsOK {
					startUnixNano = startMicros * 1000
				}
			}

			durationNano, ok := anyToInt64(firstNonNil(spanMap["durationNano"], spanMap["durationNanos"]))
			if !ok {
				if durationMicros, microsOK := anyToInt64(spanMap["duration"]); microsOK {
					durationNano = durationMicros * 1000
				}
			}

			if startUnixNano > 0 {
				if spanIndex == 0 || startUnixNano < startMin {
					startMin = startUnixNano
				}
				endUnixNano := startUnixNano + durationNano
				if spanIndex == 0 || endUnixNano > endMax {
					endMax = endUnixNano
				}
			}

			parentSpanID := ""
			if rawReferences, ok := spanMap["references"].([]interface{}); ok {
				for _, rawRef := range rawReferences {
					refMap, ok := rawRef.(map[string]interface{})
					if !ok {
						continue
					}
					candidate := anyToString(firstNonNil(refMap["spanID"], refMap["spanId"]))
					if candidate == "" {
						continue
					}
					if parentSpanID == "" {
						parentSpanID = candidate
					}
					if strings.EqualFold(anyToString(firstNonNil(refMap["refType"], refMap["referenceType"])), "CHILD_OF") {
						parentSpanID = candidate
						break
					}
				}
			}

			tags := map[string]string{}
			if rawTags, ok := spanMap["tags"].([]interface{}); ok {
				for _, rawTag := range rawTags {
					tagMap, ok := rawTag.(map[string]interface{})
					if !ok {
						continue
					}
					key := anyToString(tagMap["key"])
					if key == "" {
						continue
					}
					tags[key] = anyToString(tagMap["value"])
				}
			}

			logs := make([]TraceLog, 0)
			if rawLogs, ok := spanMap["logs"].([]interface{}); ok {
				for _, rawLog := range rawLogs {
					logMap, ok := rawLog.(map[string]interface{})
					if !ok {
						continue
					}
					logTimestamp, _ := anyToInt64(firstNonNil(logMap["timestampUnixNano"], logMap["timestamp"]))
					if logTimestamp > 0 && logTimestamp < 1_000_000_000_000 {
						logTimestamp *= 1000
					}

					fields := map[string]string{}
					if rawFields, ok := logMap["fields"].([]interface{}); ok {
						for _, rawField := range rawFields {
							fieldMap, ok := rawField.(map[string]interface{})
							if !ok {
								continue
							}
							key := anyToString(fieldMap["key"])
							if key == "" {
								continue
							}
							fields[key] = anyToString(fieldMap["value"])
						}
					}

					logs = append(logs, TraceLog{TimestampUnixNano: logTimestamp, Fields: fields})
				}
			}

			traceSpan := TraceSpan{
				SpanID:            spanID,
				ParentSpanID:      parentSpanID,
				OperationName:     operationName,
				ServiceName:       serviceName,
				StartTimeUnixNano: startUnixNano,
				DurationNano:      durationNano,
				Tags:              tags,
				Logs:              logs,
			}
			if hasErrorTag(tags) {
				traceSpan.Status = "error"
			}

			spans = append(spans, traceSpan)
			spanIndex++
		}
	}

	if len(spans) == 0 {
		return nil, fmt.Errorf("trace response has no spans")
	}

	services := make([]string, 0, len(servicesSet))
	for service := range servicesSet {
		services = append(services, service)
	}
	sort.Strings(services)

	duration := int64(0)
	if endMax > startMin {
		duration = endMax - startMin
	}

	return &Trace{
		TraceID:           traceID,
		Spans:             spans,
		Services:          services,
		StartTimeUnixNano: startMin,
		DurationNano:      duration,
	}, nil
}

func parseTraceSearchResponse(payload []byte) ([]TraceSummary, error) {
	if traces, err := parseTempoTraceSearch(payload); err == nil && len(traces) > 0 {
		return traces, nil
	}

	return parseJaegerTraceSearch(payload)
}

func parseTempoTraceSearch(payload []byte) ([]TraceSummary, error) {
	var decoded map[string]interface{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, fmt.Errorf("failed to decode tempo trace search response: %w", err)
	}

	rawTraces, ok := decoded["traces"].([]interface{})
	if !ok || len(rawTraces) == 0 {
		return nil, fmt.Errorf("trace search response has no traces")
	}

	traces := make([]TraceSummary, 0, len(rawTraces))
	for _, raw := range rawTraces {
		traceMap, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}

		traceID := anyToString(firstNonNil(traceMap["traceID"], traceMap["traceId"]))
		if traceID == "" {
			continue
		}

		startTimeUnixNano, _ := anyToInt64(firstNonNil(traceMap["startTimeUnixNano"], traceMap["startTimeUnixNanos"]))
		durationNano, hasDurationNano := anyToInt64(firstNonNil(traceMap["durationNano"], traceMap["durationNanos"]))
		if !hasDurationNano {
			durationMs, _ := anyToFloat64(traceMap["durationMs"])
			durationNano = int64(durationMs * float64(time.Millisecond))
		}

		spanCount := 0
		if rawSpanSet, ok := traceMap["spanSet"].([]interface{}); ok {
			spanCount = len(rawSpanSet)
		}

		traces = append(traces, TraceSummary{
			TraceID:           traceID,
			RootServiceName:   anyToString(traceMap["rootServiceName"]),
			RootOperationName: anyToString(firstNonNil(traceMap["rootTraceName"], traceMap["rootOperationName"])),
			StartTimeUnixNano: startTimeUnixNano,
			DurationNano:      durationNano,
			SpanCount:         spanCount,
			ServiceCount:      0,
			ErrorSpanCount:    0,
		})
	}

	if len(traces) == 0 {
		return nil, fmt.Errorf("trace search response has no traces")
	}

	return traces, nil
}

func parseJaegerTraceSearch(payload []byte) ([]TraceSummary, error) {
	var decoded jaegerTraceResponse
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, fmt.Errorf("failed to decode jaeger trace search response: %w", err)
	}

	if len(decoded.Data) == 0 {
		return nil, fmt.Errorf("trace search response has no data")
	}

	traces := make([]TraceSummary, 0, len(decoded.Data))
	for _, trace := range decoded.Data {
		summary := jaegerEnvelopeToSummary(trace)
		if summary.TraceID == "" {
			continue
		}
		traces = append(traces, summary)
	}

	if len(traces) == 0 {
		return nil, fmt.Errorf("trace search response has no traces")
	}

	return traces, nil
}

func jaegerEnvelopeToSummary(trace jaegerTraceEnvelope) TraceSummary {
	traceID := trace.TraceID
	serviceSet := map[string]struct{}{}

	var rootService string
	var rootOperation string
	var spanCount int
	var errorCount int
	var startMin int64
	var endMax int64

	for idx, span := range trace.Spans {
		if traceID == "" {
			traceID = span.TraceID
		}
		spanCount++

		serviceName := trace.Processes[span.ProcessID].ServiceName
		if serviceName != "" {
			serviceSet[serviceName] = struct{}{}
		}

		isRoot := true
		for _, ref := range span.References {
			if strings.EqualFold(ref.RefType, "CHILD_OF") {
				isRoot = false
				break
			}
		}
		if isRoot {
			if rootService == "" {
				rootService = serviceName
			}
			if rootOperation == "" {
				rootOperation = span.OperationName
			}
		}

		tags := map[string]string{}
		for _, tag := range span.Tags {
			tags[tag.Key] = fmt.Sprint(tag.Value)
		}
		if hasErrorTag(tags) {
			errorCount++
		}

		startUnixNano := span.StartTime * 1000
		durationNano := span.Duration * 1000
		endUnixNano := startUnixNano + durationNano

		if idx == 0 || startUnixNano < startMin {
			startMin = startUnixNano
		}
		if idx == 0 || endUnixNano > endMax {
			endMax = endUnixNano
		}
	}

	if rootService == "" {
		for service := range serviceSet {
			rootService = service
			break
		}
	}

	duration := int64(0)
	if endMax > startMin {
		duration = endMax - startMin
	}

	return TraceSummary{
		TraceID:           traceID,
		RootServiceName:   rootService,
		RootOperationName: rootOperation,
		StartTimeUnixNano: startMin,
		DurationNano:      duration,
		SpanCount:         spanCount,
		ServiceCount:      len(serviceSet),
		ErrorSpanCount:    errorCount,
	}
}

func parseStringSlicePayload(payload []byte) ([]string, error) {
	var wrapped map[string]json.RawMessage
	if err := json.Unmarshal(payload, &wrapped); err == nil {
		if rawData, ok := wrapped["data"]; ok {
			var data []string
			if err := json.Unmarshal(rawData, &data); err == nil {
				return data, nil
			}
		}
	}

	var raw []string
	if err := json.Unmarshal(payload, &raw); err == nil {
		return raw, nil
	}

	return nil, fmt.Errorf("response body is not a string list")
}

func hasErrorTag(tags map[string]string) bool {
	if len(tags) == 0 {
		return false
	}

	if value, ok := tags["error"]; ok {
		lower := strings.ToLower(value)
		return lower == "true" || lower == "1" || lower == "error"
	}

	if value, ok := tags["otel.status_code"]; ok {
		return strings.EqualFold(value, "error")
	}

	if value, ok := tags["status.code"]; ok {
		return strings.EqualFold(value, "error")
	}

	return false
}

func firstNonNil(values ...interface{}) interface{} {
	for _, value := range values {
		if value != nil {
			return value
		}
	}

	return nil
}

func anyToString(value interface{}) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case json.Number:
		return typed.String()
	default:
		return fmt.Sprint(typed)
	}
}

func anyToInt64(value interface{}) (int64, bool) {
	switch typed := value.(type) {
	case nil:
		return 0, false
	case int64:
		return typed, true
	case int:
		return int64(typed), true
	case float64:
		return int64(typed), true
	case json.Number:
		if intVal, err := typed.Int64(); err == nil {
			return intVal, true
		}
		if floatVal, err := typed.Float64(); err == nil {
			return int64(floatVal), true
		}
	case string:
		if typed == "" {
			return 0, false
		}
		if intVal, err := strconv.ParseInt(typed, 10, 64); err == nil {
			return intVal, true
		}
		if floatVal, err := strconv.ParseFloat(typed, 64); err == nil {
			return int64(floatVal), true
		}
	}

	return 0, false
}

func anyToFloat64(value interface{}) (float64, bool) {
	switch typed := value.(type) {
	case nil:
		return 0, false
	case float64:
		return typed, true
	case int64:
		return float64(typed), true
	case int:
		return float64(typed), true
	case json.Number:
		floatVal, err := typed.Float64()
		if err != nil {
			return 0, false
		}
		return floatVal, true
	case string:
		if typed == "" {
			return 0, false
		}
		floatVal, err := strconv.ParseFloat(typed, 64)
		if err != nil {
			return 0, false
		}
		return floatVal, true
	}

	return 0, false
}
