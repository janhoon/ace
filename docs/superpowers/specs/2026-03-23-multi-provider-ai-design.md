# Multi-Provider AI Support

Replace the Copilot-only chat system with a provider abstraction that supports OpenAI, Anthropic, OpenRouter, Ollama, vLLM, and any OpenAI-compatible endpoint — while keeping Copilot as a personal fallback.

## Provider Hierarchy

1. Org has AI providers configured and enabled -> use those
2. No org providers -> user's personal Copilot connection (if any)
3. Neither -> "no AI provider configured" error

When org providers exist, Copilot does not appear in the provider list regardless of user's Copilot connection status.

## Database Schema

### New table: `ai_providers`

```sql
CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL,  -- 'openai', 'anthropic', 'openrouter', 'ollama', 'custom'
    display_name VARCHAR(255) NOT NULL,
    base_url TEXT NOT NULL,              -- e.g. 'https://api.openai.com/v1'
    api_key TEXT,                        -- encrypted AES-GCM, nullable for local providers
    enabled BOOLEAN NOT NULL DEFAULT true,
    models_override JSONB,              -- e.g. [{"id":"gpt-4o","name":"GPT-4o"}], null for auto-discover
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, provider_type, base_url)
);
```

### Existing tables unchanged

- `user_github_connections` — Copilot device flow auth (user-level)
- `sso_configs` with `github_copilot` — org-level GitHub OAuth app config

## Backend Provider Interface

```go
type AIProvider interface {
    ListModels(ctx context.Context) ([]AIModel, error)
    Chat(ctx context.Context, req ChatRequest, w http.ResponseWriter) error
}

type AIModel struct {
    ID       string `json:"id"`
    Name     string `json:"name"`
    Vendor   string `json:"vendor"`
    Category string `json:"category"`
}

type ChatRequest struct {
    Model    string        `json:"model"`
    Messages []interface{} `json:"messages"`
    Tools    []interface{} `json:"tools,omitempty"`
    Stream   bool          `json:"stream"`
}
```

### Implementations

**`OpenAICompatibleProvider`** — covers OpenAI, Anthropic, OpenRouter, Ollama, vLLM, custom. Needs `baseURL` + `apiKey`. Calls `baseURL/models` for discovery, `baseURL/chat/completions` for chat. Handles both SSE streaming and JSON non-streaming passthrough.

**`CopilotProvider`** — wraps existing Copilot token-fetching logic. `ListModels()` fetches a Copilot token then hits the models endpoint with special headers. `Chat()` does the same token dance then forwards to Copilot chat completions with `Editor-Version`, `Copilot-Integration-Id`, etc.

### Provider Resolution

```
1. Query ai_providers WHERE organization_id = user's org AND enabled = true
2. If found -> return as available providers
3. If none -> check user_github_connections for Copilot token
4. If Copilot connected -> return CopilotProvider as sole provider
5. If neither -> error
```

## API Endpoints

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai/providers` | List available providers for current user (resolved) |
| `GET` | `/api/ai/models` | List models across all available providers |
| `POST` | `/api/ai/chat` | Chat request with `provider_id` routing |
| `POST` | `/api/orgs/{id}/ai-providers` | Admin: create provider |
| `GET` | `/api/orgs/{id}/ai-providers` | Admin: list org providers |
| `PUT` | `/api/orgs/{id}/ai-providers/{pid}` | Admin: update provider |
| `DELETE` | `/api/orgs/{id}/ai-providers/{pid}` | Admin: delete provider |
| `POST` | `/api/orgs/{id}/ai-providers/{pid}/test` | Admin: test connection |

### Kept (Copilot auth is user-level)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/github/device` | Start Copilot device flow |
| `POST` | `/api/auth/github/device/poll` | Poll device flow |
| `GET` | `/api/auth/github/connection` | Check Copilot connection |
| `DELETE` | `/api/auth/github/connection` | Disconnect Copilot |

### Removed

- `GET /api/copilot/models` -> replaced by `GET /api/ai/models`
- `POST /api/copilot/chat` -> replaced by `POST /api/ai/chat`
- `POST /api/orgs/{id}/github-app` and `GET /api/orgs/{id}/github-app` -> replaced by generic provider CRUD

### Chat request body

```json
{
  "provider_id": "uuid-or-copilot",
  "model": "claude-sonnet-4.6",
  "datasource_type": "victoriametrics",
  "datasource_name": "prod",
  "messages": [],
  "tools": [],
  "stream": true
}
```

## Frontend Changes

### `useCopilot.ts` -> `useAIProvider.ts`

Same module-level shared state pattern, provider-aware:

```ts
// State
const providers = ref<AIProviderInfo[]>([])
const selectedProviderId = ref<string>('')    // uuid or 'copilot'
const models = ref<AIModel[]>([])
const selectedModel = ref<string>('')

// Functions
fetchProviders()     // GET /api/ai/providers
fetchModels()        // GET /api/ai/models?provider_id=X
sendMessage()        // POST /api/ai/chat with provider_id (SSE streaming)
sendChatRequest()    // POST /api/ai/chat non-streaming (tool calling)
```

### `useCopilotAuth.ts` (extracted)

Copilot-specific auth state: `isConnected`, `hasCopilot`, `githubUsername`, device flow refs. Only used by `CopilotConnectionPanel` and provider resolution display.

### Component changes

- **`CmdKModal.vue`** — gate on `providers.length > 0` instead of `isConnected`
- **`CmdKChatView.vue`** — model selector grouped by provider. Uses `useAIProvider` instead of `useCopilot`
- **`CopilotConnectionPanel.vue`** — shown only when no org providers configured. Unchanged internally.
- **`UnifiedSettingsView.vue`** — new "AI Providers" admin section: add/edit/delete providers, test connection, see discovered models. Copilot connection moves under "Personal Fallback" subsection.
- **`useCopilotTools.ts`** — unchanged. Tools are datasource-specific, passed to whichever provider handles chat.

## Error Handling

- **Provider unavailable** (401, connection refused): return clear error, no automatic fallback to another provider. User can manually switch.
- **Copilot token expiry**: `fetchCopilotToken()` gets fresh token per request, no change needed.
- **API key rotation**: admin updates via PUT, takes effect immediately (read per-request, not cached).
- **Provider deleted mid-session**: next request returns "provider not found", frontend refreshes provider list.
- **Model discovery fails**: fall back to `models_override` from DB. If empty, return provider with empty model list and warning.
- **Org providers exist + user has Copilot**: Copilot does NOT appear. Org providers take full precedence.

## Testing

### Backend

- Provider resolution logic (org > copilot fallback > none)
- `OpenAICompatibleProvider` against mock HTTP server (models list, streaming chat, non-streaming chat)
- Provider CRUD endpoints (create, update, delete, test connection)
- Full chat flow through `/api/ai/chat`
- Existing Copilot tests adapted to new interface

### Frontend

- `useAIProvider.spec.ts` — provider fetching, model fetching, selection, Copilot fallback
- `AIProviderSettings.spec.ts` — add/edit/delete provider, test connection
- `CmdKChatView.spec.ts` — updated for provider_id, model grouping
- `CmdKModal.spec.ts` — gate on providers instead of isConnected
- `CopilotConnectionPanel.spec.ts` — only shown when no org providers
