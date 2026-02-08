package models

import (
	"time"

	"github.com/google/uuid"
)

type Folder struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	ParentID       *uuid.UUID `json:"parent_id,omitempty"`
	Name           string     `json:"name"`
	SortOrder      int        `json:"sort_order"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type CreateFolderRequest struct {
	Name      string     `json:"name"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	SortOrder *int       `json:"sort_order,omitempty"`
}

type UpdateFolderRequest struct {
	Name      *string    `json:"name,omitempty"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	SortOrder *int       `json:"sort_order,omitempty"`
}
