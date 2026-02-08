package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/janhoon/dash/backend/internal/auth"
	"github.com/janhoon/dash/backend/internal/datasource"
	"github.com/janhoon/dash/backend/internal/models"
)

type DataSourceHandler struct {
	pool *pgxpool.Pool
}

func NewDataSourceHandler(pool *pgxpool.Pool) *DataSourceHandler {
	return &DataSourceHandler{pool: pool}
}

func (h *DataSourceHandler) checkOrgMembership(ctx context.Context, userID, orgID uuid.UUID) (string, error) {
	var role string
	err := h.pool.QueryRow(ctx,
		`SELECT role FROM organization_memberships WHERE user_id = $1 AND organization_id = $2`,
		userID, orgID,
	).Scan(&role)
	return role, err
}

// Create creates a new datasource for an organization
func (h *DataSourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("orgId"))
	if err != nil {
		http.Error(w, `{"error":"invalid organization id"}`, http.StatusBadRequest)
		return
	}

	var req models.CreateDataSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}
	if !req.Type.Valid() {
		http.Error(w, `{"error":"invalid datasource type, must be one of: prometheus, loki, victorialogs, victoriametrics"}`, http.StatusBadRequest)
		return
	}
	if req.URL == "" {
		http.Error(w, `{"error":"url is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	role, err := h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}
	if role != "admin" {
		http.Error(w, `{"error":"only admins can create datasources"}`, http.StatusForbidden)
		return
	}

	authType := "none"
	if req.AuthType != nil {
		authType = *req.AuthType
	}

	isDefault := false
	if req.IsDefault != nil {
		isDefault = *req.IsDefault
	}

	var ds models.DataSource
	err = h.pool.QueryRow(ctx,
		`INSERT INTO datasources (organization_id, name, type, url, is_default, auth_type, auth_config)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at`,
		orgID, req.Name, req.Type, req.URL, isDefault, authType, req.AuthConfig,
	).Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to create datasource: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ds)
}

// List lists all datasources for an organization
func (h *DataSourceHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("orgId"))
	if err != nil {
		http.Error(w, `{"error":"invalid organization id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}

	rows, err := h.pool.Query(ctx,
		`SELECT id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at
		 FROM datasources
		 WHERE organization_id = $1
		 ORDER BY name ASC`, orgID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch datasources"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	datasources := []models.DataSource{}
	for rows.Next() {
		var ds models.DataSource
		if err := rows.Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt); err != nil {
			http.Error(w, `{"error":"failed to scan datasource"}`, http.StatusInternalServerError)
			return
		}
		datasources = append(datasources, ds)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(datasources)
}

// Get returns a single datasource
func (h *DataSourceHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid datasource id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var ds models.DataSource
	err = h.pool.QueryRow(ctx,
		`SELECT id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at
		 FROM datasources WHERE id = $1`, id,
	).Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error":"datasource not found"}`, http.StatusNotFound)
		return
	}

	_, err = h.checkOrgMembership(ctx, userID, ds.OrganizationID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ds)
}

// Update updates a datasource
func (h *DataSourceHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid datasource id"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateDataSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Type != nil && !req.Type.Valid() {
		http.Error(w, `{"error":"invalid datasource type"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Get existing datasource to check org
	var orgID uuid.UUID
	err = h.pool.QueryRow(ctx, `SELECT organization_id FROM datasources WHERE id = $1`, id).Scan(&orgID)
	if err != nil {
		http.Error(w, `{"error":"datasource not found"}`, http.StatusNotFound)
		return
	}

	role, err := h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}
	if role != "admin" {
		http.Error(w, `{"error":"only admins can update datasources"}`, http.StatusForbidden)
		return
	}

	var ds models.DataSource
	err = h.pool.QueryRow(ctx,
		`UPDATE datasources
		 SET name = COALESCE($1, name),
		     type = COALESCE($2, type),
		     url = COALESCE($3, url),
		     is_default = COALESCE($4, is_default),
		     auth_type = COALESCE($5, auth_type),
		     auth_config = COALESCE($6, auth_config),
		     updated_at = NOW()
		 WHERE id = $7
		 RETURNING id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at`,
		req.Name, req.Type, req.URL, req.IsDefault, req.AuthType, req.AuthConfig, id,
	).Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error":"failed to update datasource"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ds)
}

// Delete deletes a datasource
func (h *DataSourceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid datasource id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var orgID uuid.UUID
	err = h.pool.QueryRow(ctx, `SELECT organization_id FROM datasources WHERE id = $1`, id).Scan(&orgID)
	if err != nil {
		http.Error(w, `{"error":"datasource not found"}`, http.StatusNotFound)
		return
	}

	role, err := h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}
	if role != "admin" {
		http.Error(w, `{"error":"only admins can delete datasources"}`, http.StatusForbidden)
		return
	}

	result, err := h.pool.Exec(ctx, `DELETE FROM datasources WHERE id = $1`, id)
	if err != nil {
		http.Error(w, `{"error":"failed to delete datasource"}`, http.StatusInternalServerError)
		return
	}
	if result.RowsAffected() == 0 {
		http.Error(w, `{"error":"datasource not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Query executes a query against a datasource
func (h *DataSourceHandler) Query(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid datasource id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Fetch datasource
	var ds models.DataSource
	err = h.pool.QueryRow(ctx,
		`SELECT id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at
		 FROM datasources WHERE id = $1`, id,
	).Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error":"datasource not found"}`, http.StatusNotFound)
		return
	}

	_, err = h.checkOrgMembership(ctx, userID, ds.OrganizationID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Parse query from body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to read request body"})
		return
	}

	var queryReq datasource.QueryRequest
	if err := json.Unmarshal(body, &queryReq); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "invalid request body"})
		return
	}

	if queryReq.Query == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "query is required"})
		return
	}

	// Parse time range
	start := time.Now().Add(-1 * time.Hour)
	end := time.Now()
	step := 15 * time.Second

	if queryReq.Start > 0 {
		start = time.Unix(queryReq.Start, 0)
	}
	if queryReq.End > 0 {
		end = time.Unix(queryReq.End, 0)
	}
	if queryReq.Step > 0 {
		step = time.Duration(queryReq.Step) * time.Second
	}

	// Execute query via client
	client, err := datasource.NewClient(ds)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to create datasource client: " + err.Error()})
		return
	}

	result, err := client.Query(ctx, queryReq.Query, start, end, step, queryReq.Limit)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "query failed: " + err.Error()})
		return
	}

	json.NewEncoder(w).Encode(result)
}

// Labels returns indexed labels/fields for log datasources
func (h *DataSourceHandler) Labels(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid datasource id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var ds models.DataSource
	err = h.pool.QueryRow(ctx,
		`SELECT id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at
		 FROM datasources WHERE id = $1`, id,
	).Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error":"datasource not found"}`, http.StatusNotFound)
		return
	}

	_, err = h.checkOrgMembership(ctx, userID, ds.OrganizationID)
	if err != nil {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}

	var labels []string
	switch ds.Type {
	case models.DataSourceLoki:
		client, err := datasource.NewLokiClient(ds.URL)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to create datasource client: " + err.Error()})
			return
		}

		labels, err = client.Labels(ctx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to fetch labels: " + err.Error()})
			return
		}

	case models.DataSourceVictoriaLogs:
		client, err := datasource.NewVictoriaLogsClient(ds.URL)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to create datasource client: " + err.Error()})
			return
		}

		labels, err = client.Labels(ctx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to fetch labels: " + err.Error()})
			return
		}

	default:
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "label discovery is only supported for log datasources"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Status string   `json:"status"`
		Data   []string `json:"data"`
	}{
		Status: "success",
		Data:   labels,
	})
}

// QueryByParams handles GET-based query with query parameters (backwards compatible with existing Prometheus handler)
func (h *DataSourceHandler) QueryByParams(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	dsIDStr := r.URL.Query().Get("datasource_id")
	if dsIDStr == "" {
		// Fall back to the old Prometheus handler behavior using PROMETHEUS_URL env
		// This maintains backwards compatibility
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "datasource_id parameter is required"})
		return
	}

	dsID, err := uuid.Parse(dsIDStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "invalid datasource_id"})
		return
	}

	query := r.URL.Query().Get("query")
	if query == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "query parameter is required"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var ds models.DataSource
	err = h.pool.QueryRow(ctx,
		`SELECT id, organization_id, name, type, url, is_default, auth_type, auth_config, created_at, updated_at
		 FROM datasources WHERE id = $1`, dsID,
	).Scan(&ds.ID, &ds.OrganizationID, &ds.Name, &ds.Type, &ds.URL, &ds.IsDefault, &ds.AuthType, &ds.AuthConfig, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "datasource not found"})
		return
	}

	start := time.Now().Add(-1 * time.Hour)
	end := time.Now()
	step := 15 * time.Second

	if s := r.URL.Query().Get("start"); s != "" {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil {
			start = time.Unix(v, 0)
		}
	}
	if e := r.URL.Query().Get("end"); e != "" {
		if v, err := strconv.ParseInt(e, 10, 64); err == nil {
			end = time.Unix(v, 0)
		}
	}
	if st := r.URL.Query().Get("step"); st != "" {
		if v, err := strconv.ParseInt(st, 10, 64); err == nil {
			step = time.Duration(v) * time.Second
		}
	}

	limit := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	client, err := datasource.NewClient(ds)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "failed to create datasource client: " + err.Error()})
		return
	}

	result, err := client.Query(ctx, query, start, end, step, limit)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Status: "error", Error: "query failed: " + err.Error()})
		return
	}

	json.NewEncoder(w).Encode(result)
}
