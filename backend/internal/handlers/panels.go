package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/janhoon/dash/backend/internal/models"
)

type PanelHandler struct {
	pool *pgxpool.Pool
}

func NewPanelHandler(pool *pgxpool.Pool) *PanelHandler {
	return &PanelHandler{pool: pool}
}

func (h *PanelHandler) Create(w http.ResponseWriter, r *http.Request) {
	dashboardIDStr := r.PathValue("id")
	dashboardID, err := uuid.Parse(dashboardIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid dashboard id"}`, http.StatusBadRequest)
		return
	}

	var req models.CreatePanelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Verify dashboard exists
	var exists bool
	err = h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dashboards WHERE id = $1)`, dashboardID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"dashboard not found"}`, http.StatusNotFound)
		return
	}

	panelType := "line_chart"
	if req.Type != nil {
		panelType = *req.Type
	}

	gridPosJSON, err := json.Marshal(req.GridPos)
	if err != nil {
		http.Error(w, `{"error":"invalid grid_pos"}`, http.StatusBadRequest)
		return
	}

	var panel models.Panel
	var gridPosBytes []byte
	var queryBytes []byte

	err = h.pool.QueryRow(ctx,
		`INSERT INTO panels (dashboard_id, title, type, grid_pos, query)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, dashboard_id, title, type, grid_pos, query, created_at, updated_at`,
		dashboardID, req.Title, panelType, gridPosJSON, req.Query,
	).Scan(&panel.ID, &panel.DashboardID, &panel.Title, &panel.Type,
		&gridPosBytes, &queryBytes, &panel.CreatedAt, &panel.UpdatedAt)

	if err != nil {
		http.Error(w, `{"error":"failed to create panel"}`, http.StatusInternalServerError)
		return
	}

	json.Unmarshal(gridPosBytes, &panel.GridPos)
	panel.Query = queryBytes

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(panel)
}

func (h *PanelHandler) ListByDashboard(w http.ResponseWriter, r *http.Request) {
	dashboardIDStr := r.PathValue("id")
	dashboardID, err := uuid.Parse(dashboardIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid dashboard id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.pool.Query(ctx,
		`SELECT id, dashboard_id, title, type, grid_pos, query, created_at, updated_at
		 FROM panels
		 WHERE dashboard_id = $1
		 ORDER BY created_at ASC`, dashboardID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch panels"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	panels := []models.Panel{}
	for rows.Next() {
		var p models.Panel
		var gridPosBytes []byte
		var queryBytes []byte

		if err := rows.Scan(&p.ID, &p.DashboardID, &p.Title, &p.Type,
			&gridPosBytes, &queryBytes, &p.CreatedAt, &p.UpdatedAt); err != nil {
			http.Error(w, `{"error":"failed to scan panel"}`, http.StatusInternalServerError)
			return
		}

		json.Unmarshal(gridPosBytes, &p.GridPos)
		p.Query = queryBytes

		panels = append(panels, p)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to iterate panels"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(panels)
}

func (h *PanelHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid panel id"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdatePanelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var gridPosJSON []byte
	if req.GridPos != nil {
		gridPosJSON, _ = json.Marshal(req.GridPos)
	}

	var panel models.Panel
	var gridPosBytes []byte
	var queryBytes []byte

	err = h.pool.QueryRow(ctx,
		`UPDATE panels
		 SET title = COALESCE($1, title),
		     type = COALESCE($2, type),
		     grid_pos = COALESCE($3, grid_pos),
		     query = COALESCE($4, query),
		     updated_at = NOW()
		 WHERE id = $5
		 RETURNING id, dashboard_id, title, type, grid_pos, query, created_at, updated_at`,
		req.Title, req.Type, gridPosJSON, req.Query, id,
	).Scan(&panel.ID, &panel.DashboardID, &panel.Title, &panel.Type,
		&gridPosBytes, &queryBytes, &panel.CreatedAt, &panel.UpdatedAt)

	if err != nil {
		http.Error(w, `{"error":"panel not found"}`, http.StatusNotFound)
		return
	}

	json.Unmarshal(gridPosBytes, &panel.GridPos)
	panel.Query = queryBytes

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(panel)
}

func (h *PanelHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid panel id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	result, err := h.pool.Exec(ctx, `DELETE FROM panels WHERE id = $1`, id)
	if err != nil {
		http.Error(w, `{"error":"failed to delete panel"}`, http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, `{"error":"panel not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
