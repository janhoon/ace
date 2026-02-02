package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type GridPos struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type Panel struct {
	ID          uuid.UUID       `json:"id"`
	DashboardID uuid.UUID       `json:"dashboard_id"`
	Title       string          `json:"title"`
	Type        string          `json:"type"`
	GridPos     GridPos         `json:"grid_pos"`
	Query       json.RawMessage `json:"query,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type CreatePanelRequest struct {
	Title   string          `json:"title"`
	Type    *string         `json:"type,omitempty"`
	GridPos GridPos         `json:"grid_pos"`
	Query   json.RawMessage `json:"query,omitempty"`
}

type UpdatePanelRequest struct {
	Title   *string         `json:"title,omitempty"`
	Type    *string         `json:"type,omitempty"`
	GridPos *GridPos        `json:"grid_pos,omitempty"`
	Query   json.RawMessage `json:"query,omitempty"`
}
