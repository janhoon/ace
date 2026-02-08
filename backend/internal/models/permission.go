package models

import "github.com/google/uuid"

type PrincipalType string

const (
	PrincipalTypeUser  PrincipalType = "user"
	PrincipalTypeGroup PrincipalType = "group"
)

type ResourcePermissionLevel string

const (
	ResourcePermissionView  ResourcePermissionLevel = "view"
	ResourcePermissionEdit  ResourcePermissionLevel = "edit"
	ResourcePermissionAdmin ResourcePermissionLevel = "admin"
)

type ResourcePermissionEntry struct {
	PrincipalType PrincipalType           `json:"principal_type"`
	PrincipalID   uuid.UUID               `json:"principal_id"`
	Permission    ResourcePermissionLevel `json:"permission"`
}

type ReplaceResourcePermissionsRequest struct {
	Entries []ResourcePermissionEntry `json:"entries"`
}
