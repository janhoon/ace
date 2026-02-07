package datasource

import (
	"testing"

	"github.com/janhoon/dash/backend/internal/models"
)

func TestNewClient_Prometheus(t *testing.T) {
	ds := models.DataSource{
		Type: models.DataSourcePrometheus,
		URL:  "http://localhost:9090",
	}
	client, err := NewClient(ds)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := client.(*PrometheusClient); !ok {
		t.Errorf("expected PrometheusClient, got %T", client)
	}
}

func TestNewClient_VictoriaMetrics(t *testing.T) {
	ds := models.DataSource{
		Type: models.DataSourceVictoriaMetrics,
		URL:  "http://localhost:8428",
	}
	client, err := NewClient(ds)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := client.(*VictoriaMetricsClient); !ok {
		t.Errorf("expected VictoriaMetricsClient, got %T", client)
	}
}

func TestNewClient_Loki(t *testing.T) {
	ds := models.DataSource{
		Type: models.DataSourceLoki,
		URL:  "http://localhost:3100",
	}
	client, err := NewClient(ds)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := client.(*LokiClient); !ok {
		t.Errorf("expected LokiClient, got %T", client)
	}
}

func TestNewClient_VictoriaLogs(t *testing.T) {
	ds := models.DataSource{
		Type: models.DataSourceVictoriaLogs,
		URL:  "http://localhost:9428",
	}
	client, err := NewClient(ds)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := client.(*VictoriaLogsClient); !ok {
		t.Errorf("expected VictoriaLogsClient, got %T", client)
	}
}

func TestNewClient_InvalidType(t *testing.T) {
	ds := models.DataSource{
		Type: "invalid",
		URL:  "http://localhost:9090",
	}
	_, err := NewClient(ds)
	if err == nil {
		t.Error("expected error for invalid type, got nil")
	}
}

func TestDetectLogLevel(t *testing.T) {
	tests := []struct {
		labels map[string]string
		line   string
		want   string
	}{
		{map[string]string{"level": "ERROR"}, "some message", "error"},
		{map[string]string{"severity": "Warning"}, "some message", "warning"},
		{map[string]string{}, "Error: something failed", "error"},
		{map[string]string{}, "WARN: low disk space", "warning"},
		{map[string]string{}, "INFO starting service", "info"},
		{map[string]string{}, "DEBUG verbose output", "debug"},
		{map[string]string{}, "just a regular log line", ""},
	}

	for _, tt := range tests {
		got := detectLogLevel(tt.labels, tt.line)
		if got != tt.want {
			t.Errorf("detectLogLevel(%v, %q) = %q, want %q", tt.labels, tt.line, got, tt.want)
		}
	}
}
