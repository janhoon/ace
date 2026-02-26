-- +migrate Up
CREATE TABLE IF NOT EXISTS user_github_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_user_id VARCHAR(255) NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    github_email VARCHAR(255),
    access_token TEXT NOT NULL,  -- encrypted at rest via AES-GCM using JWT_SECRET as key
    scopes TEXT NOT NULL DEFAULT '',
    has_copilot BOOLEAN NOT NULL DEFAULT false,  -- cached from last token check
    copilot_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)  -- one GitHub account per user
);

CREATE INDEX IF NOT EXISTS idx_user_github_connections_user_id ON user_github_connections(user_id);

-- +migrate Down
DROP TABLE IF EXISTS user_github_connections;
DROP INDEX IF EXISTS idx_user_github_connections_user_id;
