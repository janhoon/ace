package datasource

import (
	"context"
	"fmt"
	"time"

	"github.com/janhoon/dash/backend/internal/models"
)

// QueryRequest represents a query request body
type QueryRequest struct {
	Query string `json:"query"`
	Start int64  `json:"start"` // Unix timestamp in seconds
	End   int64  `json:"end"`   // Unix timestamp in seconds
	Step  int64  `json:"step"`  // Step interval in seconds
	Limit int    `json:"limit"` // Max results for log queries
}

// QueryResult is the unified query result format
type QueryResult struct {
	Status     string      `json:"status"`
	Data       *QueryData  `json:"data,omitempty"`
	Error      string      `json:"error,omitempty"`
	ResultType string      `json:"resultType"` // "metrics" or "logs"
}

// QueryData contains the result
type QueryData struct {
	ResultType string         `json:"resultType"`
	Result     []MetricResult `json:"result,omitempty"`
	Logs       []LogEntry     `json:"logs,omitempty"`
}

// MetricResult represents a single metric series (for Prometheus/VictoriaMetrics)
type MetricResult struct {
	Metric map[string]string `json:"metric"`
	Values [][]interface{}   `json:"values"`
}

// LogEntry represents a single log line (for Loki/VictoriaLogs)
type LogEntry struct {
	Timestamp string            `json:"timestamp"`
	Line      string            `json:"line"`
	Labels    map[string]string `json:"labels,omitempty"`
	Level     string            `json:"level,omitempty"`
}

// Client is the interface that all datasource clients implement
type Client interface {
	Query(ctx context.Context, query string, start, end time.Time, step time.Duration, limit int) (*QueryResult, error)
}

// NewClient creates a datasource client based on the datasource type
func NewClient(ds models.DataSource) (Client, error) {
	switch ds.Type {
	case models.DataSourcePrometheus:
		return NewPrometheusClient(ds.URL)
	case models.DataSourceVictoriaMetrics:
		return NewVictoriaMetricsClient(ds.URL)
	case models.DataSourceLoki:
		return NewLokiClient(ds.URL)
	case models.DataSourceVictoriaLogs:
		return NewVictoriaLogsClient(ds.URL)
	default:
		return nil, fmt.Errorf("unsupported datasource type: %s", ds.Type)
	}
}
