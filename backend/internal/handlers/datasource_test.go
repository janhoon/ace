package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/janhoon/dash/backend/internal/models"
)

func TestDataSourceHandler_Create_MissingName(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	body := bytes.NewBufferString(`{"type":"prometheus","url":"http://localhost:9090"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/orgs/test/datasources", body)
	req.SetPathValue("orgId", "invalid-uuid")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	// Should fail on auth (no user in context), not on name validation
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestDataSourceHandler_Create_InvalidOrgID(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	body := bytes.NewBufferString(`{"name":"test","type":"prometheus","url":"http://localhost:9090"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/orgs/invalid/datasources", body)
	req.SetPathValue("orgId", "not-a-uuid")
	rr := httptest.NewRecorder()

	handler.Create(rr, req)

	// Should fail on auth (no user in context)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestDataSourceHandler_Get_InvalidUUID(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/api/datasources/invalid-uuid", nil)
	req.SetPathValue("id", "invalid-uuid")
	rr := httptest.NewRecorder()

	handler.Get(rr, req)

	// Should fail on auth (no user in context)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestDataSourceHandler_Update_InvalidUUID(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	body := bytes.NewBufferString(`{"name":"updated"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/datasources/invalid-uuid", body)
	req.SetPathValue("id", "invalid-uuid")
	rr := httptest.NewRecorder()

	handler.Update(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestDataSourceHandler_Delete_InvalidUUID(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	req := httptest.NewRequest(http.MethodDelete, "/api/datasources/invalid-uuid", nil)
	req.SetPathValue("id", "invalid-uuid")
	rr := httptest.NewRecorder()

	handler.Delete(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestDataSourceHandler_Query_InvalidUUID(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	body := bytes.NewBufferString(`{"query":"up"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/datasources/invalid-uuid/query", body)
	req.SetPathValue("id", "invalid-uuid")
	rr := httptest.NewRecorder()

	handler.Query(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestDataSourceHandler_List_InvalidOrgID(t *testing.T) {
	handler := &DataSourceHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/api/orgs/invalid/datasources", nil)
	req.SetPathValue("orgId", "not-a-uuid")
	rr := httptest.NewRecorder()

	handler.List(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestCreateDataSourceRequest_JSON(t *testing.T) {
	req := models.CreateDataSourceRequest{
		Name: "My Prometheus",
		Type: models.DataSourcePrometheus,
		URL:  "http://localhost:9090",
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	var decoded models.CreateDataSourceRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal request: %v", err)
	}

	if decoded.Name != req.Name {
		t.Errorf("expected name %s, got %s", req.Name, decoded.Name)
	}
	if decoded.Type != req.Type {
		t.Errorf("expected type %s, got %s", req.Type, decoded.Type)
	}
	if decoded.URL != req.URL {
		t.Errorf("expected url %s, got %s", req.URL, decoded.URL)
	}
}

func TestUpdateDataSourceRequest_JSON(t *testing.T) {
	name := "Updated Name"
	req := models.UpdateDataSourceRequest{
		Name: &name,
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	var decoded models.UpdateDataSourceRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal request: %v", err)
	}

	if decoded.Name == nil || *decoded.Name != *req.Name {
		t.Errorf("expected name %v, got %v", req.Name, decoded.Name)
	}
}

func TestDataSourceType_Valid(t *testing.T) {
	tests := []struct {
		dsType models.DataSourceType
		valid  bool
	}{
		{models.DataSourcePrometheus, true},
		{models.DataSourceLoki, true},
		{models.DataSourceVictoriaLogs, true},
		{models.DataSourceVictoriaMetrics, true},
		{"invalid", false},
		{"", false},
	}

	for _, tt := range tests {
		if got := tt.dsType.Valid(); got != tt.valid {
			t.Errorf("DataSourceType(%q).Valid() = %v, want %v", tt.dsType, got, tt.valid)
		}
	}
}

func TestDataSourceType_IsMetrics(t *testing.T) {
	tests := []struct {
		dsType  models.DataSourceType
		metrics bool
	}{
		{models.DataSourcePrometheus, true},
		{models.DataSourceVictoriaMetrics, true},
		{models.DataSourceLoki, false},
		{models.DataSourceVictoriaLogs, false},
	}

	for _, tt := range tests {
		if got := tt.dsType.IsMetrics(); got != tt.metrics {
			t.Errorf("DataSourceType(%q).IsMetrics() = %v, want %v", tt.dsType, got, tt.metrics)
		}
	}
}

func TestDataSourceType_IsLogs(t *testing.T) {
	tests := []struct {
		dsType models.DataSourceType
		logs   bool
	}{
		{models.DataSourcePrometheus, false},
		{models.DataSourceVictoriaMetrics, false},
		{models.DataSourceLoki, true},
		{models.DataSourceVictoriaLogs, true},
	}

	for _, tt := range tests {
		if got := tt.dsType.IsLogs(); got != tt.logs {
			t.Errorf("DataSourceType(%q).IsLogs() = %v, want %v", tt.dsType, got, tt.logs)
		}
	}
}

func TestCreateDataSourceRequest_AllTypes(t *testing.T) {
	types := []models.DataSourceType{
		models.DataSourcePrometheus,
		models.DataSourceLoki,
		models.DataSourceVictoriaLogs,
		models.DataSourceVictoriaMetrics,
	}

	for _, dsType := range types {
		req := models.CreateDataSourceRequest{
			Name: "test",
			Type: dsType,
			URL:  "http://localhost:8080",
		}

		data, err := json.Marshal(req)
		if err != nil {
			t.Fatalf("failed to marshal %s request: %v", dsType, err)
		}

		var decoded models.CreateDataSourceRequest
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal %s request: %v", dsType, err)
		}

		if decoded.Type != dsType {
			t.Errorf("type mismatch: expected %s, got %s", dsType, decoded.Type)
		}
	}
}
