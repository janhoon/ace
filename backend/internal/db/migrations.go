package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrations := []string{
		// Create dashboards table
		`CREATE TABLE IF NOT EXISTS dashboards (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			title VARCHAR(255) NOT NULL,
			description TEXT,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			user_id VARCHAR(255)
		)`,
		// Create panels table
		`CREATE TABLE IF NOT EXISTS panels (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			type VARCHAR(50) DEFAULT 'line_chart',
			grid_pos JSONB NOT NULL,
			query JSONB,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		// Create data_sources table
		`CREATE TABLE IF NOT EXISTS data_sources (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			type VARCHAR(50) NOT NULL,
			url VARCHAR(500) NOT NULL,
			config JSONB,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		// Multi-tenancy tables (006_multi_tenancy.sql)
		// Organizations table: isolated tenants
		`CREATE TABLE IF NOT EXISTS organizations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			slug VARCHAR(100) NOT NULL UNIQUE,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		// Users table: can belong to multiple orgs
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(255),
			name VARCHAR(255),
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		// Organization memberships: user-org relationships with roles
		`CREATE TABLE IF NOT EXISTS organization_memberships (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(organization_id, user_id)
		)`,
		// User auth methods: for SSO providers
		`CREATE TABLE IF NOT EXISTS user_auth_methods (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			provider VARCHAR(50) NOT NULL,
			provider_user_id VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(provider, provider_user_id)
		)`,
		// SSO configs: per-org Google/Microsoft SSO configuration
		`CREATE TABLE IF NOT EXISTS sso_configs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'microsoft')),
			client_id VARCHAR(255) NOT NULL,
			client_secret VARCHAR(500) NOT NULL,
			tenant_id VARCHAR(255),
			enabled BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(organization_id, provider)
		)`,
		// Prometheus datasources: per-org data sources
		`CREATE TABLE IF NOT EXISTS prometheus_datasources (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			url VARCHAR(500) NOT NULL,
			is_default BOOLEAN DEFAULT false,
			auth_type VARCHAR(50) DEFAULT 'none',
			auth_config JSONB,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		// Add organization_id and created_by to dashboards
		`ALTER TABLE dashboards
			ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
			ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`,
		// Add created_by to panels
		`ALTER TABLE panels
			ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`,
		// Create indexes for performance
		`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id ON organization_memberships(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON organization_memberships(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_id ON user_auth_methods(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sso_configs_org_id ON sso_configs(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_prometheus_datasources_org_id ON prometheus_datasources(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboards_organization_id ON dashboards(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by)`,
		`CREATE INDEX IF NOT EXISTS idx_panels_created_by ON panels(created_by)`,
		// Create default 'Personal' organization for existing data
		`INSERT INTO organizations (id, name, slug)
			VALUES ('00000000-0000-0000-0000-000000000001', 'Personal', 'personal')
			ON CONFLICT (slug) DO NOTHING`,
		// Update existing dashboards to belong to the default organization
		`UPDATE dashboards SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL`,
		// Unified datasources table for all source types
		`CREATE TABLE IF NOT EXISTS datasources (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(50) NOT NULL CHECK (type IN ('prometheus', 'loki', 'victorialogs', 'victoriametrics')),
			url VARCHAR(500) NOT NULL,
			is_default BOOLEAN DEFAULT false,
			auth_type VARCHAR(50) DEFAULT 'none',
			auth_config JSONB,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_datasources_org_id ON datasources(organization_id)`,
		// Add datasource_id to panels (nullable, for non-default datasource)
		`ALTER TABLE panels ADD COLUMN IF NOT EXISTS datasource_id UUID REFERENCES datasources(id) ON DELETE SET NULL`,
	}

	for _, migration := range migrations {
		_, err := pool.Exec(ctx, migration)
		if err != nil {
			return err
		}
	}

	return nil
}
