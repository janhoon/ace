package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/janhoon/dash/backend/internal/auth"
	"github.com/janhoon/dash/backend/internal/models"
)

type GroupHandler struct {
	pool *pgxpool.Pool
}

func NewGroupHandler(pool *pgxpool.Pool) *GroupHandler {
	return &GroupHandler{pool: pool}
}

func (h *GroupHandler) checkOrgMembership(ctx context.Context, userID, orgID uuid.UUID) (string, error) {
	var role string
	err := h.pool.QueryRow(ctx,
		`SELECT role FROM organization_memberships WHERE user_id = $1 AND organization_id = $2`,
		userID, orgID,
	).Scan(&role)
	return role, err
}

func (h *GroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid organization id"}`, http.StatusBadRequest)
		return
	}

	var req models.CreateUserGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	role, err := h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"failed to check membership"}`, http.StatusInternalServerError)
		return
	}

	if role != string(models.RoleAdmin) {
		http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
		return
	}

	var group models.UserGroup
	err = h.pool.QueryRow(ctx,
		`INSERT INTO user_groups (organization_id, name, description, created_by)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, organization_id, name, description, created_by, created_at, updated_at`,
		orgID, name, req.Description, userID,
	).Scan(
		&group.ID,
		&group.OrganizationID,
		&group.Name,
		&group.Description,
		&group.CreatedBy,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			http.Error(w, `{"error":"group name already exists in this organization"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to create group"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(group)
}

func (h *GroupHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid organization id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"failed to check membership"}`, http.StatusInternalServerError)
		return
	}

	rows, err := h.pool.Query(ctx,
		`SELECT id, organization_id, name, description, created_by, created_at, updated_at
		 FROM user_groups
		 WHERE organization_id = $1
		 ORDER BY name ASC`,
		orgID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to list groups"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	groups := []models.UserGroup{}
	for rows.Next() {
		var group models.UserGroup
		if err := rows.Scan(
			&group.ID,
			&group.OrganizationID,
			&group.Name,
			&group.Description,
			&group.CreatedBy,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			http.Error(w, `{"error":"failed to scan group"}`, http.StatusInternalServerError)
			return
		}
		groups = append(groups, group)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to iterate groups"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

func (h *GroupHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid organization id"}`, http.StatusBadRequest)
		return
	}

	groupID, err := uuid.Parse(r.PathValue("groupId"))
	if err != nil {
		http.Error(w, `{"error":"invalid group id"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateUserGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	var trimmedName *string
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			http.Error(w, `{"error":"name cannot be empty"}`, http.StatusBadRequest)
			return
		}
		trimmedName = &name
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	role, err := h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"failed to check membership"}`, http.StatusInternalServerError)
		return
	}

	if role != string(models.RoleAdmin) {
		http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
		return
	}

	var group models.UserGroup
	if trimmedName != nil && req.Description != nil {
		err = h.pool.QueryRow(ctx,
			`UPDATE user_groups
			 SET name = $1,
			     description = $2,
			     updated_at = NOW()
			 WHERE id = $3 AND organization_id = $4
			 RETURNING id, organization_id, name, description, created_by, created_at, updated_at`,
			*trimmedName, *req.Description, groupID, orgID,
		).Scan(
			&group.ID,
			&group.OrganizationID,
			&group.Name,
			&group.Description,
			&group.CreatedBy,
			&group.CreatedAt,
			&group.UpdatedAt,
		)
	} else if trimmedName != nil {
		err = h.pool.QueryRow(ctx,
			`UPDATE user_groups
			 SET name = $1,
			     updated_at = NOW()
			 WHERE id = $2 AND organization_id = $3
			 RETURNING id, organization_id, name, description, created_by, created_at, updated_at`,
			*trimmedName, groupID, orgID,
		).Scan(
			&group.ID,
			&group.OrganizationID,
			&group.Name,
			&group.Description,
			&group.CreatedBy,
			&group.CreatedAt,
			&group.UpdatedAt,
		)
	} else if req.Description != nil {
		err = h.pool.QueryRow(ctx,
			`UPDATE user_groups
			 SET description = $1,
			     updated_at = NOW()
			 WHERE id = $2 AND organization_id = $3
			 RETURNING id, organization_id, name, description, created_by, created_at, updated_at`,
			*req.Description, groupID, orgID,
		).Scan(
			&group.ID,
			&group.OrganizationID,
			&group.Name,
			&group.Description,
			&group.CreatedBy,
			&group.CreatedAt,
			&group.UpdatedAt,
		)
	} else {
		err = h.pool.QueryRow(ctx,
			`SELECT id, organization_id, name, description, created_by, created_at, updated_at
			 FROM user_groups
			 WHERE id = $1 AND organization_id = $2`,
			groupID, orgID,
		).Scan(
			&group.ID,
			&group.OrganizationID,
			&group.Name,
			&group.Description,
			&group.CreatedBy,
			&group.CreatedAt,
			&group.UpdatedAt,
		)
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"group not found"}`, http.StatusNotFound)
			return
		}
		if isUniqueViolation(err) {
			http.Error(w, `{"error":"group name already exists in this organization"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to update group"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

func (h *GroupHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, `{"error":"invalid organization id"}`, http.StatusBadRequest)
		return
	}

	groupID, err := uuid.Parse(r.PathValue("groupId"))
	if err != nil {
		http.Error(w, `{"error":"invalid group id"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	role, err := h.checkOrgMembership(ctx, userID, orgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"failed to check membership"}`, http.StatusInternalServerError)
		return
	}

	if role != string(models.RoleAdmin) {
		http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
		return
	}

	result, err := h.pool.Exec(ctx,
		`DELETE FROM user_groups WHERE id = $1 AND organization_id = $2`,
		groupID, orgID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to delete group"}`, http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, `{"error":"group not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "group deleted"})
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
