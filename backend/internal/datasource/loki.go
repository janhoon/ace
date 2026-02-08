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
)

// LokiClient queries Loki using LogQL
type LokiClient struct {
	baseURL string
	client  *http.Client
}

func NewLokiClient(baseURL string) (*LokiClient, error) {
	return &LokiClient{
		baseURL: baseURL,
		client:  &http.Client{Timeout: 30 * time.Second},
	}, nil
}

type lokiQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Stream map[string]string `json:"stream"`
			Values [][]string        `json:"values"` // [timestamp_ns, line]
		} `json:"result"`
	} `json:"data"`
	Error string `json:"error,omitempty"`
}

type lokiLabelsResponse struct {
	Status string   `json:"status"`
	Data   []string `json:"data"`
	Error  string   `json:"error,omitempty"`
}

func (c *LokiClient) Labels(ctx context.Context) ([]string, error) {
	reqURL := fmt.Sprintf("%s/loki/api/v1/labels", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create labels request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Loki labels: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read labels response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("loki labels request failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var labelsResp lokiLabelsResponse
	if err := json.Unmarshal(body, &labelsResp); err != nil {
		return nil, fmt.Errorf("failed to parse labels response: %w", err)
	}

	if labelsResp.Status != "success" {
		return nil, fmt.Errorf("loki labels request failed: %s", labelsResp.Error)
	}

	labels := make([]string, 0, len(labelsResp.Data))
	for _, label := range labelsResp.Data {
		trimmed := strings.TrimSpace(label)
		if trimmed == "" {
			continue
		}
		labels = append(labels, trimmed)
	}

	sort.Strings(labels)

	return labels, nil
}

func (c *LokiClient) Query(ctx context.Context, query string, start, end time.Time, step time.Duration, limit int) (*QueryResult, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("start", strconv.FormatInt(start.UnixNano(), 10))
	params.Set("end", strconv.FormatInt(end.UnixNano(), 10))
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	} else {
		params.Set("limit", "1000")
	}

	reqURL := fmt.Sprintf("%s/loki/api/v1/query_range?%s", c.baseURL, params.Encode())
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Loki: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var lokiResp lokiQueryResponse
	if err := json.Unmarshal(body, &lokiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if lokiResp.Status != "success" {
		return &QueryResult{
			Status:     "error",
			Error:      lokiResp.Error,
			ResultType: "logs",
		}, nil
	}

	// Convert Loki streams to log entries
	logs := []LogEntry{}
	for _, stream := range lokiResp.Data.Result {
		for _, entry := range stream.Values {
			if len(entry) < 2 {
				continue
			}
			ts := entry[0]
			line := entry[1]

			// Parse nanosecond timestamp to RFC3339
			nsec, _ := strconv.ParseInt(ts, 10, 64)
			timestamp := time.Unix(0, nsec).UTC().Format(time.RFC3339Nano)

			// Try to detect log level from labels or line content
			level := detectLogLevel(stream.Stream, line)

			logs = append(logs, LogEntry{
				Timestamp: timestamp,
				Line:      line,
				Labels:    stream.Stream,
				Level:     level,
			})
		}
	}

	return &QueryResult{
		Status:     "success",
		ResultType: "logs",
		Data: &QueryData{
			ResultType: "streams",
			Logs:       logs,
		},
	}, nil
}

func detectLogLevel(labels map[string]string, line string) string {
	// Check labels first
	if level, ok := labels["level"]; ok {
		return strings.ToLower(level)
	}
	if level, ok := labels["severity"]; ok {
		return strings.ToLower(level)
	}

	// Simple detection from line content
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "error") || strings.Contains(lower, "err="):
		return "error"
	case strings.Contains(lower, "warn"):
		return "warning"
	case strings.Contains(lower, "info"):
		return "info"
	case strings.Contains(lower, "debug"):
		return "debug"
	default:
		return ""
	}
}
