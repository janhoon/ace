package converter

import (
	"strings"
	"testing"
)

func TestMapGrafanaPanelType(t *testing.T) {
	tests := []struct {
		input       string
		wantType    string
		wantWarning bool
	}{
		{"graph", "line_chart", false},
		{"timeseries", "line_chart", false},
		{"gauge", "gauge", false},
		{"stat", "stat", false},
		{"piechart", "pie", false},
		{"pie chart", "pie", false},
		{"logs", "logs", false},
		{"table", "table", false},
		{"bargauge", "bar_gauge", false},
		{"barchart", "bar_chart", false},
		{"heatmap", "heatmap", false},
		{"histogram", "histogram", false},
		// Case insensitivity
		{"Graph", "line_chart", false},
		{"TIMESERIES", "line_chart", false},
		{"Gauge", "gauge", false},
		{"PieChart", "pie", false},
		{"BarGauge", "bar_gauge", false},
		// Whitespace trimming
		{" graph ", "line_chart", false},
		{" table ", "table", false},
		// Unknown types fall back to line_chart with warning
		{"unknown_panel", "line_chart", true},
		{"nodeGraph", "line_chart", true},
		{"", "line_chart", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			gotType, gotWarning := mapGrafanaPanelType(tt.input)
			if gotType != tt.wantType {
				t.Errorf("mapGrafanaPanelType(%q) type = %q, want %q", tt.input, gotType, tt.wantType)
			}
			hasWarning := gotWarning != ""
			if hasWarning != tt.wantWarning {
				t.Errorf("mapGrafanaPanelType(%q) warning = %q, wantWarning = %v", tt.input, gotWarning, tt.wantWarning)
			}
		})
	}
}

func TestConvertGrafanaDashboard_EnvelopeFormat(t *testing.T) {
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
        "type": "timeseries",
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
        "targets": [
          {"refId": "A", "expr": "sum(rate(container_cpu_usage_seconds_total[5m]))"}
        ]
      },
      {
        "title": "Requests",
        "type": "gauge",
        "gridPos": {"x": 0, "y": 8, "w": 6, "h": 4},
        "targets": [
          {"refId": "B", "expr": "sum(up)"}
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
		t.Fatalf("expected title 'Grafana CPU', got %q", doc.Dashboard.Title)
	}
	if len(doc.Dashboard.Panels) != 2 {
		t.Fatalf("expected 2 panels, got %d", len(doc.Dashboard.Panels))
	}
	if doc.Dashboard.Panels[0].Type != "line_chart" {
		t.Fatalf("expected timeseries → line_chart, got %q", doc.Dashboard.Panels[0].Type)
	}
	if doc.Dashboard.Panels[1].Type != "gauge" {
		t.Fatalf("expected gauge → gauge, got %q", doc.Dashboard.Panels[1].Type)
	}
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %d: %v", len(warnings), warnings)
	}

	// Variables
	if len(doc.Dashboard.Variables) != 1 || doc.Dashboard.Variables[0].Name != "service" {
		t.Fatalf("expected mapped variable 'service'")
	}
	v := doc.Dashboard.Variables[0]
	if !v.Multi || !v.IncludeAll {
		t.Fatalf("expected multi=true, includeAll=true")
	}

	// Time range
	if doc.Dashboard.TimeRange == nil || doc.Dashboard.TimeRange.From != "now-6h" {
		t.Fatalf("expected mapped time range")
	}

	// Refresh
	if doc.Dashboard.RefreshInterval == nil || *doc.Dashboard.RefreshInterval != "10s" {
		t.Fatalf("expected refresh interval '10s'")
	}
}

func TestConvertGrafanaDashboard_RawFormat(t *testing.T) {
	// Without the {"dashboard": ...} envelope
	payload := []byte(`{
    "title": "Raw Dashboard",
    "panels": [
      {
        "title": "Panel 1",
        "type": "stat",
        "gridPos": {"x": 0, "y": 0, "w": 6, "h": 4},
        "targets": [{"refId": "A", "expr": "up"}]
      }
    ]
  }`)

	doc, _, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("expected raw format to succeed: %v", err)
	}
	if doc.Dashboard.Title != "Raw Dashboard" {
		t.Fatalf("expected title 'Raw Dashboard', got %q", doc.Dashboard.Title)
	}
	if doc.Dashboard.Panels[0].Type != "stat" {
		t.Fatalf("expected stat panel type, got %q", doc.Dashboard.Panels[0].Type)
	}
}

func TestConvertGrafanaDashboard_AllPanelTypes(t *testing.T) {
	panels := []struct {
		grafanaType string
		aceType     string
	}{
		{"graph", "line_chart"},
		{"timeseries", "line_chart"},
		{"gauge", "gauge"},
		{"stat", "stat"},
		{"piechart", "pie"},
		{"logs", "logs"},
		{"table", "table"},
		{"bargauge", "bar_gauge"},
		{"barchart", "bar_chart"},
		{"heatmap", "heatmap"},
		{"histogram", "histogram"},
	}

	for _, p := range panels {
		t.Run(p.grafanaType, func(t *testing.T) {
			payload := []byte(`{
        "title": "Test",
        "panels": [{
          "title": "P",
          "type": "` + p.grafanaType + `",
          "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
          "targets": [{"refId": "A", "expr": "up"}]
        }]
      }`)

			doc, warnings, err := ConvertGrafanaDashboard(payload)
			if err != nil {
				t.Fatalf("conversion failed for %s: %v", p.grafanaType, err)
			}
			if doc.Dashboard.Panels[0].Type != p.aceType {
				t.Errorf("%s → got %q, want %q", p.grafanaType, doc.Dashboard.Panels[0].Type, p.aceType)
			}
			if len(warnings) != 0 {
				t.Errorf("%s: unexpected warnings: %v", p.grafanaType, warnings)
			}
		})
	}
}

func TestConvertGrafanaDashboard_UnsupportedPanelTypeWarning(t *testing.T) {
	payload := []byte(`{
    "title": "Test",
    "panels": [{
      "title": "Custom Plugin",
      "type": "custom-plugin-panel",
      "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
      "targets": [{"refId": "A", "expr": "up"}]
    }]
  }`)

	doc, warnings, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("conversion failed: %v", err)
	}
	if doc.Dashboard.Panels[0].Type != "line_chart" {
		t.Errorf("expected fallback to line_chart, got %q", doc.Dashboard.Panels[0].Type)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}
	if !strings.Contains(warnings[0], "custom-plugin-panel") {
		t.Errorf("warning should mention the unsupported type: %s", warnings[0])
	}
}

func TestConvertGrafanaDashboard_TitleRequired(t *testing.T) {
	_, _, err := ConvertGrafanaDashboard([]byte(`{"dashboard":{"title":"","panels":[]}}`))
	if err == nil {
		t.Fatal("expected error for missing title")
	}
}

func TestConvertGrafanaDashboard_MalformedJSON(t *testing.T) {
	_, _, err := ConvertGrafanaDashboard([]byte(`{not valid json`))
	if err == nil {
		t.Fatal("expected error for malformed JSON")
	}
}

func TestConvertGrafanaDashboard_MissingTitle(t *testing.T) {
	payload := []byte(`{
    "panels": [{
      "title": "P",
      "type": "stat",
      "gridPos": {"x": 0, "y": 0, "w": 6, "h": 4},
      "targets": [{"refId": "A", "expr": "up"}]
    }]
  }`)

	_, _, err := ConvertGrafanaDashboard(payload)
	if err == nil {
		t.Fatal("expected error for missing title")
	}
}

func TestConvertGrafanaDashboard_MissingPanelTitle(t *testing.T) {
	payload := []byte(`{
    "title": "Test",
    "panels": [{
      "title": "",
      "type": "stat",
      "gridPos": {"x": 0, "y": 0, "w": 6, "h": 4},
      "targets": [{"refId": "A", "expr": "up"}]
    }]
  }`)

	doc, _, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("conversion should succeed with auto-generated title: %v", err)
	}
	if doc.Dashboard.Panels[0].Title != "Panel 1" {
		t.Errorf("expected auto-generated title 'Panel 1', got %q", doc.Dashboard.Panels[0].Title)
	}
}

func TestConvertGrafanaDashboard_MissingGridPos(t *testing.T) {
	payload := []byte(`{
    "title": "Test",
    "panels": [{
      "title": "P",
      "type": "stat",
      "targets": [{"refId": "A", "expr": "up"}]
    }]
  }`)

	doc, _, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("should auto-generate grid_pos: %v", err)
	}
	gp := doc.Dashboard.Panels[0].GridPos
	if gp["w"] != 12 || gp["h"] != 8 {
		t.Errorf("expected default grid_pos w=12 h=8, got %v", gp)
	}
}

func TestConvertGrafanaDashboard_VariableExtraction(t *testing.T) {
	payload := []byte(`{
    "title": "Vars Test",
    "templating": {
      "list": [
        {"name": "job", "type": "query", "query": "label_values(up, job)", "multi": false, "includeAll": false},
        {"name": "env", "type": "custom", "label": "Environment", "definition": "prod,staging,dev", "multi": true, "includeAll": true},
        {"name": "const", "type": "constant", "query": "fixed-value"}
      ]
    },
    "panels": [{
      "title": "P",
      "type": "stat",
      "gridPos": {"x": 0, "y": 0, "w": 6, "h": 4},
      "targets": [{"refId": "A", "expr": "up{job=\"$job\"}"}]
    }]
  }`)

	doc, _, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("conversion failed: %v", err)
	}
	if len(doc.Dashboard.Variables) != 3 {
		t.Fatalf("expected 3 variables, got %d", len(doc.Dashboard.Variables))
	}

	// First var: query type, uses query field
	v0 := doc.Dashboard.Variables[0]
	if v0.Name != "job" || v0.Type != "query" || v0.Query != "label_values(up, job)" {
		t.Errorf("variable 0 mismatch: %+v", v0)
	}

	// Second var: custom type, falls back to definition field
	v1 := doc.Dashboard.Variables[1]
	if v1.Name != "env" || v1.Type != "custom" || v1.Query != "prod,staging,dev" {
		t.Errorf("variable 1 mismatch: %+v", v1)
	}
	if !v1.Multi || !v1.IncludeAll {
		t.Errorf("variable 1 multi/includeAll mismatch")
	}

	// Third var: constant type
	v2 := doc.Dashboard.Variables[2]
	if v2.Name != "const" || v2.Type != "constant" || v2.Query != "fixed-value" {
		t.Errorf("variable 2 mismatch: %+v", v2)
	}
}

func TestConvertGrafanaDashboard_QueryFallbackToQueryField(t *testing.T) {
	// When expr is empty, should fall back to the query field
	payload := []byte(`{
    "title": "Test",
    "panels": [{
      "title": "P",
      "type": "table",
      "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
      "targets": [{"refId": "A", "query": "sum(up)"}]
    }]
  }`)

	doc, _, err := ConvertGrafanaDashboard(payload)
	if err != nil {
		t.Fatalf("conversion failed: %v", err)
	}

	// Query should contain the expression from the query field
	queryStr := string(doc.Dashboard.Panels[0].Query)
	if !strings.Contains(queryStr, "sum(up)") {
		t.Errorf("expected query to contain 'sum(up)', got %s", queryStr)
	}
}
