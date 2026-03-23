# Copilot Device Flow in Settings + Cmd+K Integration

## Summary

Replace the admin-only GitHub OAuth App configuration form in Settings > AI Configuration with a per-user GitHub device flow connection panel. Integrate Copilot as an AI chat option within the existing Cmd+K modal, alongside dashboard/query search.

## Background

The Kinetic Observability Redesign (PR #125) deleted `CopilotPanel.vue` — the right-side chat sidebar that handled GitHub device flow authentication and AI-assisted query writing. The `useCopilot` and `useCopilotTools` composables, backend endpoints, and `DashboardSpecPreview` component all still exist and work. The current `GitHubAppSettings` component asks admins to configure a Client ID/Secret, but the device flow uses GitHub's hardcoded public Copilot client ID (`Iv1.b507a08c87ecfe98`), so no admin configuration is needed.

## Change 1: Settings > AI Configuration

### What changes

Replace `GitHubAppSettings.vue` with a new `CopilotConnectionPanel.vue` component. Remove the `GitHubAppSettings` component entirely.

### Behavior

The panel is visible to **all users** (not admin-gated). It uses the existing `useCopilot` composable for all API calls.

**States:**

| State | UI |
|---|---|
| Loading | Spinner, "Checking connection..." |
| Not connected | Description text explaining Copilot. "Connect GitHub Copilot" button. |
| Device flow active | User code displayed large + copyable. "Open GitHub" button (opens `verificationUri` in new tab). Cancel button. Spinner indicating polling. |
| Connected + has Copilot | GitHub username shown. "Copilot Active" badge (primary color). Disconnect button. |
| Connected + no subscription | GitHub username shown. Warning text: "No active Copilot subscription detected." Disconnect button. |
| Error | Error message with retry option. |

**Lifecycle:**
1. `onMounted` calls `checkConnection()` from `useCopilot`
2. "Connect" button calls `connect(orgId)` which starts device flow and polls
3. On success, shows connected state
4. "Disconnect" calls `disconnect()`

### Integration point

In `UnifiedSettingsView.vue`, replace:
```vue
<GitHubAppSettings v-if="orgId" :org-id="orgId" :is-admin="isAdmin ?? false" />
```
with:
```vue
<CopilotConnectionPanel v-if="orgId" :org-id="orgId" />
```

Remove the `isAdmin` prop — the panel is available to everyone.

## Change 2: Cmd+K Modal

### What changes

Expand `CmdKModal.vue` from a stub input into a functional command palette with search and AI chat.

### Modes

**1. Search mode (default)**

When the user types, show filtered results:
- Dashboards from `listDashboards()` API, filtered client-side by title/description match
- Results shown as a scrollable list with keyboard navigation (arrow keys + Enter)
- Selecting a dashboard navigates to `/app/dashboards/{id}`
- If copilot is connected, show an "Ask Copilot: {query}" option at the bottom of results

**2. AI chat mode**

Activated when:
- User selects the "Ask Copilot" option from search results
- Query is clearly a question (heuristic: starts with question word or ends with `?`)

UI within the modal:
- Chat message list (user + assistant messages) with markdown rendering
- Streaming responses via `useCopilot.sendMessage()` / `sendChatRequest()`
- Tool call status indicators (running/complete/error) via `useCopilotTools`
- `DashboardSpecPreview` rendered inline when the agent calls `generate_dashboard`
- Model selector (optional, from `useCopilot.models`)
- Input textarea at bottom for follow-up messages
- "Back to search" button to return to search mode, clearing chat

**3. Not connected state**

If copilot is not connected and user tries to activate AI chat:
- Show inline message: "Connect your GitHub Copilot subscription in Settings to use AI features"
- Link to `/app/settings/ai`

### Data flow

```
User types in Cmd+K
  |
  +--> Filter dashboards (client-side, from listDashboards cache)
  |
  +--> Show "Ask Copilot: {query}" option (if connected)
         |
         +--> User selects --> Enter chat mode
               |
               +--> sendChatRequest() with tools from useCopilotTools
               |
               +--> Tool calls executed (get_metrics, get_labels, etc.)
               |
               +--> generate_dashboard intercepted --> DashboardSpecPreview
```

### Context awareness

The existing `useCommandContext` composable provides view context (current dashboard, datasource). Pass this as the context pill (already rendered) and include it in the system prompt so the AI knows what the user is looking at.

## Files to create

| File | Purpose |
|---|---|
| `frontend/src/components/CopilotConnectionPanel.vue` | Device flow connect/disconnect UI for settings |
| `frontend/src/components/CopilotConnectionPanel.spec.ts` | Tests for connection panel |

## Files to modify

| File | Change |
|---|---|
| `frontend/src/views/UnifiedSettingsView.vue` | Swap `GitHubAppSettings` for `CopilotConnectionPanel`, remove admin gate |
| `frontend/src/components/CmdKModal.vue` | Add search results, AI chat mode, copilot integration |
| `frontend/src/components/CmdKModal.spec.ts` | Tests for new functionality (create if doesn't exist) |

## Files to delete

| File | Reason |
|---|---|
| `frontend/src/components/GitHubAppSettings.vue` | Replaced by CopilotConnectionPanel; admin OAuth config no longer needed |

## No backend changes

All backend endpoints exist and work:
- `POST /api/auth/github/device` — start device flow
- `POST /api/auth/github/device/poll` — poll for completion
- `GET /api/auth/github/connection` — check connection status
- `DELETE /api/auth/github/connection` — disconnect
- `GET /api/copilot/models` — list models
- `POST /api/copilot/chat` — streaming chat with optional tool calling

## No changes to admin OAuth App config API

The `getGitHubAppConfig` / `configureGitHubApp` API functions in `frontend/src/api/sso.ts` and the corresponding backend endpoints can remain — they just won't be called from the UI. The device flow does not use them.

## Testing

- CopilotConnectionPanel: test all states (loading, not connected, device flow active, connected with/without subscription, error), connect/disconnect actions
- CmdKModal: test search filtering, keyboard navigation, AI chat mode activation, not-connected state, DashboardSpecPreview rendering on dashboard generation
