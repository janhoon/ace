package handlers

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aceobservability/ace/backend/internal/converter"
)

// DatasourceResolver translates between datasource UUIDs (DB) and
// portable DatasourceRef values (name + type) used in the v2 export format.
type DatasourceResolver struct {
	pool *pgxpool.Pool
}

func NewDatasourceResolver(pool *pgxpool.Pool) *DatasourceResolver {
	return &DatasourceResolver{pool: pool}
}

// LookupRefs returns a DatasourceRef (name + type) for each given UUID.
// Unknown IDs are silently skipped (panel may have no datasource).
func (r *DatasourceResolver) LookupRefs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]converter.DatasourceRef, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, name, type FROM datasources WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, fmt.Errorf("lookup datasources: %w", err)
	}
	defer rows.Close()

	result := make(map[uuid.UUID]converter.DatasourceRef, len(ids))
	for rows.Next() {
		var id uuid.UUID
		var name, dsType string
		if err := rows.Scan(&id, &name, &dsType); err != nil {
			return nil, fmt.Errorf("scan datasource: %w", err)
		}
		result[id] = converter.DatasourceRef{Name: name, Type: dsType}
	}
	return result, rows.Err()
}

// ResolveRef finds a datasource UUID in the given org matching a DatasourceRef.
// Priority: exact name+type match → default datasource of that type → any of that type → error.
func (r *DatasourceResolver) ResolveRef(ctx context.Context, orgID uuid.UUID, ref converter.DatasourceRef) (*uuid.UUID, error) {
	// Try exact name+type match
	if ref.Name != "" {
		var id uuid.UUID
		err := r.pool.QueryRow(ctx,
			`SELECT id FROM datasources
			 WHERE organization_id = $1 AND name = $2 AND type = $3
			 LIMIT 1`,
			orgID, ref.Name, ref.Type,
		).Scan(&id)
		if err == nil {
			return &id, nil
		}
	}

	// Fall back to default datasource of that type, or any of that type
	var id uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT id FROM datasources
		 WHERE organization_id = $1 AND type = $2
		 ORDER BY is_default DESC, created_at ASC
		 LIMIT 1`,
		orgID, ref.Type,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("no datasource of type %q found in organization", ref.Type)
	}
	return &id, nil
}
