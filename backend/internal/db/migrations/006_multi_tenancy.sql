-- +migrate Up

-- Organizations table: isolated tenants
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table: can belong to multiple orgs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization memberships: user-org relationships with roles
CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- User auth methods: for SSO providers
CREATE TABLE IF NOT EXISTS user_auth_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

-- SSO configs: per-org Google/Microsoft SSO configuration
CREATE TABLE IF NOT EXISTS sso_configs (
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
);

-- Prometheus datasources: per-org data sources
CREATE TABLE IF NOT EXISTS prometheus_datasources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    auth_type VARCHAR(50) DEFAULT 'none',
    auth_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add organization_id and created_by to dashboards
ALTER TABLE dashboards
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add created_by to panels
ALTER TABLE panels
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_id ON user_auth_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_configs_org_id ON sso_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_prometheus_datasources_org_id ON prometheus_datasources(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_organization_id ON dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_panels_created_by ON panels(created_by);

-- Create default 'Personal' organization for existing data
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Personal', 'personal')
ON CONFLICT (slug) DO NOTHING;

-- Update existing dashboards to belong to the default organization
UPDATE dashboards SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- +migrate Down

-- Remove indexes
DROP INDEX IF EXISTS idx_panels_created_by;
DROP INDEX IF EXISTS idx_dashboards_created_by;
DROP INDEX IF EXISTS idx_dashboards_organization_id;
DROP INDEX IF EXISTS idx_prometheus_datasources_org_id;
DROP INDEX IF EXISTS idx_sso_configs_org_id;
DROP INDEX IF EXISTS idx_user_auth_methods_user_id;
DROP INDEX IF EXISTS idx_organization_memberships_user_id;
DROP INDEX IF EXISTS idx_organization_memberships_org_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_organizations_slug;

-- Remove columns from panels
ALTER TABLE panels DROP COLUMN IF EXISTS created_by;

-- Remove columns from dashboards
ALTER TABLE dashboards DROP COLUMN IF EXISTS created_by;
ALTER TABLE dashboards DROP COLUMN IF EXISTS organization_id;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS prometheus_datasources;
DROP TABLE IF EXISTS sso_configs;
DROP TABLE IF EXISTS user_auth_methods;
DROP TABLE IF EXISTS organization_memberships;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;
