package datasource

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// VictoriaLogsClient queries Victoria Logs using LogsQL
type VictoriaLogsClient struct {
	baseURL string
	client  *http.Client
}

func NewVictoriaLogsClient(baseURL string) (*VictoriaLogsClient, error) {
	return &VictoriaLogsClient{
		baseURL: baseURL,
		client:  &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Victoria Logs returns JSONL (JSON Lines) format
type vlLogEntry struct {
	Message   string `json:"_msg"`
	Time      string `json:"_time"`
	Stream    string `json:"_stream"`
	StreamID  string `json:"_stream_id"`
	ExtraFields map[string]interface{} `json:"-"`
}

func (c *VictoriaLogsClient) Query(ctx context.Context, query string, start, end time.Time, step time.Duration, limit int) (*QueryResult, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("start", start.UTC().Format(time.RFC3339))
	params.Set("end", end.UTC().Format(time.RFC3339))
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	} else {
		params.Set("limit", "1000")
	}

	reqURL := fmt.Sprintf("%s/select/logsql/query?%s", c.baseURL, params.Encode())
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query Victoria Logs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &QueryResult{
			Status:     "error",
			Error:      fmt.Sprintf("Victoria Logs returned status %d", resp.StatusCode),
			ResultType: "logs",
		}, nil
	}

	// Victoria Logs returns JSONL format - one JSON object per line
	logs := []LogEntry{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024) // 1MB max line size
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

		entry := LogEntry{
			Labels: make(map[string]string),
		}

		// Extract known fields
		if msg, ok := raw["_msg"].(string); ok {
			entry.Line = msg
		}
		if t, ok := raw["_time"].(string); ok {
			entry.Timestamp = t
		}

		// Build labels from remaining fields
		for k, v := range raw {
			if k == "_msg" || k == "_time" {
				continue
			}
			if str, ok := v.(string); ok {
				entry.Labels[k] = str
			}
		}

		// Detect level
		level := ""
		if l, ok := entry.Labels["level"]; ok {
			level = strings.ToLower(l)
		} else if l, ok := entry.Labels["severity"]; ok {
			level = strings.ToLower(l)
		} else {
			level = detectLogLevel(entry.Labels, entry.Line)
		}
		entry.Level = level

		logs = append(logs, entry)
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
