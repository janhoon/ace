package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type PrometheusDatasource struct {
	ID             uuid.UUID       `json:"id"`
	OrganizationID uuid.UUID       `json:"organization_id"`
	Name           string          `json:"name"`
	URL            string          `json:"url"`
	IsDefault      bool            `json:"is_default"`
	AuthType       string          `json:"auth_type"`
	AuthConfig     json.RawMessage `json:"auth_config,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type CreatePrometheusDatasourceRequest struct {
	OrganizationID uuid.UUID       `json:"organization_id"`
	Name           string          `json:"name"`
	URL            string          `json:"url"`
	IsDefault      *bool           `json:"is_default,omitempty"`
	AuthType       *string         `json:"auth_type,omitempty"`
	AuthConfig     json.RawMessage `json:"auth_config,omitempty"`
}

type UpdatePrometheusDatasourceRequest struct {
	Name       *string         `json:"name,omitempty"`
	URL        *string         `json:"url,omitempty"`
	IsDefault  *bool           `json:"is_default,omitempty"`
	AuthType   *string         `json:"auth_type,omitempty"`
	AuthConfig json.RawMessage `json:"auth_config,omitempty"`
}
