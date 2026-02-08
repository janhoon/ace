package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Dashboard struct {
	ID             uuid.UUID  `json:"id"`
	Title          string     `json:"title"`
	Description    *string    `json:"description,omitempty"`
	FolderID       *uuid.UUID `json:"folder_id,omitempty"`
	SortOrder      *int       `json:"sort_order,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	UserID         *string    `json:"user_id,omitempty"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
}

type CreateDashboardRequest struct {
	Title          string     `json:"title"`
	Description    *string    `json:"description,omitempty"`
	UserID         *string    `json:"user_id,omitempty"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
}

type UpdateDashboardRequest struct {
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	FolderID    *uuid.UUID `json:"folder_id,omitempty"`
	FolderIDSet bool       `json:"-"`
}

func (r *UpdateDashboardRequest) UnmarshalJSON(data []byte) error {
	type updateDashboardRequestAlias struct {
		Title       *string    `json:"title,omitempty"`
		Description *string    `json:"description,omitempty"`
		FolderID    *uuid.UUID `json:"folder_id,omitempty"`
	}

	var alias updateDashboardRequestAlias
	if err := json.Unmarshal(data, &alias); err != nil {
		return err
	}

	r.Title = alias.Title
	r.Description = alias.Description
	r.FolderID = alias.FolderID
	r.FolderIDSet = false

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if folderIDRaw, ok := raw["folder_id"]; ok {
		r.FolderIDSet = true
		if string(folderIDRaw) == "null" {
			r.FolderID = nil
		}
	}

	return nil
}
