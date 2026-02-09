package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGrafanaConverterHandler_Convert_Success(t *testing.T) {
	handler := NewGrafanaConverterHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/convert/grafana?format=yaml", bytes.NewBufferString(`{
  "dashboard": {
    "title": "API Overview",
    "panels": [
      {
        "title": "Requests",
        "type": "graph",
        "gridPos": {"x":0,"y":0,"w":12,"h":8},
        "targets": [{"expr":"rate(http_requests_total[5m])"}]
      }
    ]
  }
}`))
	rr := httptest.NewRecorder()

	handler.Convert(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var response GrafanaConvertResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("expected valid JSON response: %v", err)
	}

	if response.Format != "yaml" {
		t.Fatalf("expected yaml format, got %q", response.Format)
	}
	if response.Document.Dashboard.Title != "API Overview" {
		t.Fatalf("expected converted title, got %q", response.Document.Dashboard.Title)
	}
}

func TestGrafanaConverterHandler_Convert_BadPayload(t *testing.T) {
	handler := NewGrafanaConverterHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/convert/grafana", bytes.NewBufferString(`{"broken"`))
	rr := httptest.NewRecorder()

	handler.Convert(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}
