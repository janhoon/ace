package converter

import (
	"testing"
)

func TestConvertGrafanaDashboard(t *testing.T) {
	payload := []byte(`{
  "dashboard": {
    "title": "Grafana CPU",
    "description": "CPU monitoring",
    "refresh": "10s",
    "time": {"from": "now-6h", "to": "now"},
    "templating": {
      "list": [
        {
          "name": "service",
          "type": "query",
          "label": "Service",
          "query": "label_values(up, service)",
          "multi": true,
          "includeAll": true
        }
      ]
    },
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
        "targets": [
          {"refId": "A", "expr": "sum(rate(container_cpu_usage_seconds_total[5m]))"}
        ]
      },
      {
        "title": "Unknown",
        "type": "heatmap",
        "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
        "targets": [
          {"refId": "B", "query": "sum(up)"}
        ]
      }
    ]
  }
}`)

	doc, warnings, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("expected conversion to succeed: %v", err)
	}

	if doc.Dashboard.Title != "Grafana CPU" {
		t.Fatalf("expected title Grafana CPU, got %q", doc.Dashboard.Title)
	}
	if len(doc.Dashboard.Panels) != 2 {
		t.Fatalf("expected 2 panels, got %d", len(doc.Dashboard.Panels))
	}
	if doc.Dashboard.Panels[0].Type != "line" {
		t.Fatalf("expected graph to map to line, got %q", doc.Dashboard.Panels[0].Type)
	}
	if doc.Dashboard.Panels[1].Type != "line" {
		t.Fatalf("expected unsupported type fallback to line, got %q", doc.Dashboard.Panels[1].Type)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected one warning, got %d", len(warnings))
	}
	if len(doc.Dashboard.Variables) != 1 || doc.Dashboard.Variables[0].Name != "service" {
		t.Fatalf("expected mapped variables")
	}
	if doc.Dashboard.TimeRange == nil || doc.Dashboard.TimeRange.From != "now-6h" {
		t.Fatalf("expected mapped time range")
	}
}

func TestConvertGrafanaDashboard_TitleRequired(t *testing.T) {
	_, _, err := ConvertGrafanaDashboard([]byte(`{"dashboard":{"title":"","panels":[]}}`))
	if err == nil {
		t.Fatal("expected error for missing title")
	}
}
