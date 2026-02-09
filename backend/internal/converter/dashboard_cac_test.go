package converter

import (
	"testing"

	"github.com/google/uuid"
)

func TestEncodeDecodeDashboardDocumentJSON(t *testing.T) {
	id := uuid.New()
	doc := DashboardDocument{
		SchemaVersion: CurrentSchemaVersion,
		Dashboard: DashboardResource{
			ID:    &id,
			Title: "Service Health",
			Panels: []PanelResource{
				{
					Title:   "CPU",
					Type:    "line_chart",
					GridPos: map[string]int{"x": 0, "y": 0, "w": 12, "h": 8},
				},
			},
		},
	}

	encoded, err := EncodeDashboardDocument(doc, "json")
	if err != nil {
		t.Fatalf("expected JSON encode to succeed: %v", err)
	}

	decoded, err := DecodeDashboardDocument(encoded, "json")
	if err != nil {
		t.Fatalf("expected JSON decode to succeed: %v", err)
	}

	if decoded.Dashboard.Title != doc.Dashboard.Title {
		t.Fatalf("expected dashboard title %q, got %q", doc.Dashboard.Title, decoded.Dashboard.Title)
	}
	if len(decoded.Dashboard.Panels) != 1 {
		t.Fatalf("expected 1 panel, got %d", len(decoded.Dashboard.Panels))
	}
}

func TestDecodeDashboardDocumentYAML(t *testing.T) {
	payload := []byte(`schema_version: 1
dashboard:
  title: API Overview
  panels:
    - title: Requests
      type: line_chart
      grid_pos:
        x: 0
        y: 0
        w: 8
        h: 6
`)

	decoded, err := DecodeDashboardDocument(payload, "yaml")
	if err != nil {
		t.Fatalf("expected YAML decode to succeed: %v", err)
	}

	if decoded.Dashboard.Title != "API Overview" {
		t.Fatalf("expected dashboard title %q, got %q", "API Overview", decoded.Dashboard.Title)
	}
}

func TestDecodeDashboardDocumentValidationError(t *testing.T) {
	payload := []byte(`{"schema_version":1,"dashboard":{"title":"","panels":[]}}`)

	_, err := DecodeDashboardDocument(payload, "json")
	if err == nil {
		t.Fatal("expected decode to fail for missing dashboard title")
	}
}
