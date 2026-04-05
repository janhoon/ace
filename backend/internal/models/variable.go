package models

import (
	"time"

	"github.com/google/uuid"
)

type Variable struct {
	ID          uuid.UUID `json:"id"`
	DashboardID uuid.UUID `json:"dashboard_id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Label       *string   `json:"label,omitempty"`
	Query       *string   `json:"query,omitempty"`
	Multi       bool      `json:"multi"`
	IncludeAll  bool      `json:"include_all"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateVariableRequest struct {
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	Label      *string `json:"label,omitempty"`
	Query      *string `json:"query,omitempty"`
	Multi      bool    `json:"multi"`
	IncludeAll bool    `json:"include_all"`
	SortOrder  int     `json:"sort_order"`
}

type UpdateVariableRequest struct {
	Name       *string `json:"name,omitempty"`
	Type       *string `json:"type,omitempty"`
	Label      *string `json:"label,omitempty"`
	Query      *string `json:"query,omitempty"`
	Multi      *bool   `json:"multi,omitempty"`
	IncludeAll *bool   `json:"include_all,omitempty"`
	SortOrder  *int    `json:"sort_order,omitempty"`
}

type BulkCreateVariablesRequest struct {
	Variables []CreateVariableRequest `json:"variables"`
}

var validVariableTypes = map[string]bool{
	"query":    true,
	"custom":   true,
	"constant": true,
	"textbox":  true,
}

func (r CreateVariableRequest) Valid() bool {
	return r.Name != "" && validVariableTypes[r.Type]
}
