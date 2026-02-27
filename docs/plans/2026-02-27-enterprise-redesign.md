# Enterprise Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Ace observability app from "startup" to "enterprise" aesthetic - sharp corners, Inter/JetBrains Mono fonts, true gray neutrals, slim icon rail sidebar, balanced density, and restore missing Alerts view.

**Architecture:** CSS-variable-driven design token system in `style.css` controls all theming. Components use Tailwind utilities referencing these tokens. Sidebar is a standalone component. Font loading via Google Fonts CSS import. Both light and dark themes get equal polish.

**Tech Stack:** Vue 3, Tailwind CSS 4.2, CSS custom properties, Google Fonts (Inter + JetBrains Mono), Lucide Vue icons

**Design Doc:** `docs/plans/2026-02-27-enterprise-redesign-design.md`

---

### Task 1: Update Design Tokens — Fonts & Colors

**Files:**
- Modify: `frontend/src/style.css` (lines 1-123)

**Step 1: Update Google Fonts import**

Replace line 3 in `frontend/src/style.css`:

```css
/* OLD */
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;600;700&display=swap");

/* NEW */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap");
```

**Step 2: Update @theme font variables**

In `frontend/src/style.css` around line 105-106:

```css
/* OLD */
--font-sans: "Space Grotesk", "Segoe UI", sans-serif;
--font-mono: "IBM Plex Mono", "Cascadia Mono", monospace;

/* NEW */
--font-sans: "Inter", "Segoe UI", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "Cascadia Mono", monospace;
```

**Step 3: Update light mode CSS variables**

In `frontend/src/style.css` lines 8-56 — update the `:root` block surface and text colors:

```css
/* Surfaces — true gray instead of slate */
--color-surface-base: #f9fafb;      /* was #f8fafc */
--color-surface-raised: #ffffff;     /* unchanged */
--color-surface-overlay: #f3f4f6;   /* was #f1f5f9 */
--color-surface-input: #ffffff;     /* unchanged */
--color-surface-sidebar: #111118;   /* was #0f172a */

/* Text — true gray */
--color-text-primary: #111827;      /* was #0f172a */
--color-text-secondary: #4b5563;    /* was #475569 */
--color-text-muted: #9ca3af;        /* was #94a3b8 */
--color-text-inverse: #f9fafb;      /* was #f8fafc */

/* Borders — true gray */
--color-border: #e5e7eb;            /* was #e2e8f0 */
--color-border-strong: #d1d5db;     /* was #cbd5e1 */
```

**Step 4: Update dark mode CSS variables**

In `frontend/src/style.css` lines 58-102 — update the `.dark` block:

```css
--color-surface-base: #0a0a0f;      /* was #0f172a — premium near-black */
--color-surface-raised: #111118;    /* was #1e293b */
--color-surface-overlay: #1a1a24;   /* was #334155 */
--color-surface-input: #0f0f17;     /* was #1e293b */
--color-surface-sidebar: #08080d;   /* was #0f172a */

--color-text-primary: #f3f4f6;      /* was #f1f5f9 */
--color-text-secondary: #9ca3af;    /* was #94a3b8 */
--color-text-muted: #4b5563;        /* was #64748b */
--color-text-inverse: #111827;      /* was #0f172a */

--color-border: #1f1f2e;            /* was #334155 */
--color-border-strong: #2a2a3d;     /* was #475569 */
```

**Step 5: Add info color token**

Add to both `:root` and `.dark` blocks (after the existing accent colors):

```css
/* In :root */
--color-info: #3b82f6;
--color-info-muted: rgba(59, 130, 246, 0.15);

/* In .dark — same values */
--color-info: #3b82f6;
--color-info-muted: rgba(59, 130, 246, 0.15);
```

And expose in the `@theme` block:

```css
--color-info: var(--color-info);
--color-info-muted: var(--color-info-muted);
```

**Step 6: Update base heading styles**

In `frontend/src/style.css` lines 162-186, update the heading base styles to use proper weights without uppercase:

```css
h1 {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}
h2 {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
}
h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
}
h4, h5, h6 {
  font-weight: 600;
}
```

**Step 7: Verify fonts load correctly**

Run: `cd frontend && npm run dev`
Open browser, inspect elements, verify Inter and JetBrains Mono are loaded and applied.

**Step 8: Commit**

```bash
git add frontend/src/style.css
git commit -m "feat: update design tokens for enterprise redesign — Inter font, true gray palette, premium dark mode"
```

---

### Task 2: Redesign Sidebar — Slim Icon Rail with Flyout

**Files:**
- Modify: `frontend/src/components/Sidebar.vue` (373 lines — full rewrite of template and styles)

**Step 1: Rewrite Sidebar.vue**

This is the biggest single change. The sidebar needs to go from a full always-visible sidebar to a slim 48px icon rail with a flyout panel on hover. Key requirements:

- 48px wide icon rail, always visible, dark in both themes
- Active nav item: 2px left accent border (no background fill)
- Hover over rail: flyout panel slides out to ~220px showing labels
- Flyout includes org switcher in header
- Submenu items (Metrics/Logs/Traces under Explore) indent in flyout
- Add Alerts nav item between Dashboards and Explore
- Bottom section: Settings, Theme toggle (icon-only in rail, labeled in flyout)
- Logo mark only in rail, full logo + text in flyout
- User avatar/email in flyout bottom
- Auto-collapse flyout 200ms after mouse leaves
- All hardcoded slate colors replaced with CSS variable references or appropriate neutral classes
- Zero border radius on sidebar itself
- Tooltips on icon rail items when flyout is closed

Replace all hardcoded slate classes (bg-slate-950, border-slate-700, bg-slate-800/60, etc.) with semantic CSS variable classes (bg-surface-sidebar, border-border, etc.).

Navigation items to include (in order):
1. Dashboards (LayoutDashboard icon)
2. Alerts (Bell icon) — NEW
3. Explore (Compass icon) — with submenu: Metrics, Logs, Traces
4. Settings (Settings icon) — bottom
5. Theme toggle (Moon/Sun/Monitor icons) — bottom
6. User section with logout — bottom of flyout only

The App.vue layout also needs updating — the main content area padding-left should be 48px (sidebar rail width) instead of the current sidebar width.

**Step 2: Update App.vue layout**

In `frontend/src/App.vue`, update the main content container to account for the new 48px rail width instead of the previous full sidebar width.

**Step 3: Visual verification**

- Open browser, verify icon rail renders at 48px
- Hover over sidebar, verify flyout slides out
- Click nav items, verify routing works
- Check dark + light mode
- Check collapsed/expanded behavior
- Verify Alerts item is present and clickable

**Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.vue frontend/src/App.vue
git commit -m "feat: redesign sidebar as slim icon rail with hover flyout"
```

---

### Task 3: Restore Alerts Route

**Files:**
- Modify: `frontend/src/router/index.ts` (line ~190, add route)

**Step 1: Add alerts route**

In `frontend/src/router/index.ts`, add the AlertsView route to the app routes (inside the `/app` children array, after dashboards routes):

```typescript
{
  path: 'alerts',
  name: 'alerts',
  component: () => import('../views/AlertsView.vue'),
  meta: { requiresAuth: true }
},
```

**Step 2: Verify route works**

Navigate to `/app/alerts` in the browser. Verify the AlertsView renders correctly.

**Step 3: Commit**

```bash
git add frontend/src/router/index.ts
git commit -m "feat: restore alerts route to router configuration"
```

---

### Task 4: Update LoginView

**Files:**
- Modify: `frontend/src/views/LoginView.vue` (136 lines)

**Step 1: Update login page styling**

Replace all `rounded-lg` with `rounded-sm` (2px). Update the logo container from `rounded-lg` to `rounded-sm`. Make form inputs sharper. Keep the centered card layout but make it crisper.

Specific replacements in template:
- Logo icon container: `rounded-lg` → `rounded-sm`
- Error alert: `rounded-lg` → `rounded-sm`
- All input fields: `rounded-lg` → `rounded-sm`
- Submit button: `rounded-lg` → `rounded-sm`
- Card container: add `rounded` (4px) if not present, or update existing

**Step 2: Update heading casing**

Any uppercase headings should become Title Case (e.g., "LOG IN" → "Log In", "CREATE ACCOUNT" → "Create Account").

**Step 3: Visual verification**

Open `/login` in browser, verify sharp corners, correct fonts, proper styling in both themes.

**Step 4: Commit**

```bash
git add frontend/src/views/LoginView.vue
git commit -m "feat: update LoginView with enterprise design language"
```

---

### Task 5: Update DashboardList Component

**Files:**
- Modify: `frontend/src/components/DashboardList.vue` (1370 lines)

**Step 1: Update border radius classes**

Systematically replace across the entire file:
- `rounded-xl` → `rounded` (4px for cards/panels)
- `rounded-lg` → `rounded-sm` (2px for buttons/inputs)
- `rounded-full` → `rounded-sm` (2px for badges — no more pills)
- `rounded-[10px]` → `rounded` (4px)
- `rounded-md` → `rounded-sm` (2px)

**Step 2: Update heading casing**

Replace any uppercase text transforms or all-caps heading text with Title Case equivalents. For example:
- "DASHBOARDS" → "Dashboards"

Keep metadata labels (like "CREATED", "MODIFIED") in uppercase — those are appropriate.

**Step 3: Visual verification**

Navigate to `/app/dashboards`, verify the list renders with sharp corners, correct casing, proper styling.

**Step 4: Commit**

```bash
git add frontend/src/components/DashboardList.vue
git commit -m "feat: update DashboardList with enterprise design language"
```

---

### Task 6: Update Dashboard Detail & Settings Views

**Files:**
- Modify: `frontend/src/views/DashboardDetailView.vue` (551 lines)
- Modify: `frontend/src/views/DashboardSettingsView.vue` (824 lines)

**Step 1: Update DashboardDetailView border radius classes**

Same pattern as Task 5:
- `rounded-xl` → `rounded`
- `rounded-lg` → `rounded-sm`
- `rounded-full` → `rounded-sm`
- `rounded-[10px]` → `rounded`

**Step 2: Update DashboardSettingsView border radius classes**

Same replacements. Also update any hardcoded colors to use CSS variable classes.

**Step 3: Update heading casing in both files**

Replace all-caps headings with Title Case.

**Step 4: Visual verification**

Navigate to a dashboard detail view and settings, verify sharp design in both themes.

**Step 5: Commit**

```bash
git add frontend/src/views/DashboardDetailView.vue frontend/src/views/DashboardSettingsView.vue
git commit -m "feat: update dashboard views with enterprise design language"
```

---

### Task 7: Update Panel Components

**Files:**
- Modify: `frontend/src/components/Panel.vue` (608 lines)
- Modify: `frontend/src/components/PanelEditModal.vue` (685 lines)
- Modify: `frontend/src/components/StatPanel.vue` (256 lines)
- Modify: `frontend/src/components/TablePanel.vue` (113 lines)

**Step 1: Update Panel.vue**

Replace rounded classes. Panel containers should use `rounded` (4px). Panel header should have a subtle background tint to visually separate from content. Update any hardcoded colors.

**Step 2: Update PanelEditModal.vue**

Replace rounded classes. Modal should use `rounded` (4px), form inputs `rounded-sm` (2px), buttons `rounded-sm` (2px).

**Step 3: Update StatPanel.vue and TablePanel.vue**

Same border radius updates.

**Step 4: Visual verification**

Check dashboard panels render correctly with sharp borders and compact headers.

**Step 5: Commit**

```bash
git add frontend/src/components/Panel.vue frontend/src/components/PanelEditModal.vue frontend/src/components/StatPanel.vue frontend/src/components/TablePanel.vue
git commit -m "feat: update panel components with enterprise design language"
```

---

### Task 8: Update Chart Components

**Files:**
- Modify: `frontend/src/components/LineChart.vue` (252 lines)
- Modify: `frontend/src/components/BarChart.vue` (250 lines)
- Modify: `frontend/src/components/PieChart.vue` (190 lines)
- Modify: `frontend/src/components/GaugeChart.vue` (246 lines)

**Step 1: Update border radius in all chart components**

Replace any `rounded-lg`, `rounded-xl` with `rounded` (4px) for chart containers.

**Step 2: Visual verification**

Check chart containers render with crisp corners.

**Step 3: Commit**

```bash
git add frontend/src/components/LineChart.vue frontend/src/components/BarChart.vue frontend/src/components/PieChart.vue frontend/src/components/GaugeChart.vue
git commit -m "feat: update chart components with enterprise design language"
```

---

### Task 9: Update Explore Views

**Files:**
- Modify: `frontend/src/views/Explore.vue` (737 lines)
- Modify: `frontend/src/views/ExploreLogs.vue` (1172 lines)
- Modify: `frontend/src/views/ExploreTraces.vue` (1116 lines)

**Step 1: Update Explore.vue (Metrics)**

- Replace rounded classes throughout
- Update tab styling from pill tabs to underline tabs (border-bottom based active state)
- Update data source selector to be more compact: icon + name + status dot inline
- Update heading casing — "Explore" Title Case, keep metadata labels uppercase
- Replace any hardcoded slate colors

**Step 2: Update ExploreLogs.vue**

Same rounded class replacements. Update tab styling to underline tabs. Update headings.

**Step 3: Update ExploreTraces.vue**

Same rounded class replacements. Update tab styling. Update headings.

**Step 4: Visual verification**

Navigate to Explore > Metrics, Logs, Traces. Verify sharp design, underline tabs, compact data source selector.

**Step 5: Commit**

```bash
git add frontend/src/views/Explore.vue frontend/src/views/ExploreLogs.vue frontend/src/views/ExploreTraces.vue
git commit -m "feat: update explore views with enterprise design language"
```

---

### Task 10: Update Query Builder & Editor Components

**Files:**
- Modify: `frontend/src/components/QueryBuilder.vue` (389 lines)
- Modify: `frontend/src/components/QueryEditor.vue` (163 lines)
- Modify: `frontend/src/components/MonacoQueryEditor.vue` (283 lines)
- Modify: `frontend/src/components/LogQLQueryBuilder.vue` (467 lines)
- Modify: `frontend/src/components/ClickHouseSQLEditor.vue` (97 lines)
- Modify: `frontend/src/components/CloudWatchQueryEditor.vue` (81 lines)
- Modify: `frontend/src/components/ElasticsearchQueryEditor.vue` (81 lines)

**Step 1: Update all query components**

Replace rounded classes throughout all files. Inputs get `rounded-sm`, containers get `rounded`, buttons get `rounded-sm`.

**Step 2: Visual verification**

Check query builder renders correctly in Explore views.

**Step 3: Commit**

```bash
git add frontend/src/components/QueryBuilder.vue frontend/src/components/QueryEditor.vue frontend/src/components/MonacoQueryEditor.vue frontend/src/components/LogQLQueryBuilder.vue frontend/src/components/ClickHouseSQLEditor.vue frontend/src/components/CloudWatchQueryEditor.vue frontend/src/components/ElasticsearchQueryEditor.vue
git commit -m "feat: update query components with enterprise design language"
```

---

### Task 11: Update Trace Components

**Files:**
- Modify: `frontend/src/components/TraceHeatmapPanel.vue` (203 lines)
- Modify: `frontend/src/components/TraceListPanel.vue` (133 lines)
- Modify: `frontend/src/components/TraceServiceGraph.vue` (343 lines)
- Modify: `frontend/src/components/TraceSpanDetailsPanel.vue` (352 lines)
- Modify: `frontend/src/components/TraceTimeline.vue` (451 lines)

**Step 1: Update all trace components**

Replace rounded classes throughout. Update any hardcoded colors to semantic variables.

**Step 2: Visual verification**

Navigate to Explore > Traces, verify all trace-related components render with sharp design.

**Step 3: Commit**

```bash
git add frontend/src/components/TraceHeatmapPanel.vue frontend/src/components/TraceListPanel.vue frontend/src/components/TraceServiceGraph.vue frontend/src/components/TraceSpanDetailsPanel.vue frontend/src/components/TraceTimeline.vue
git commit -m "feat: update trace components with enterprise design language"
```

---

### Task 12: Update AlertsView

**Files:**
- Modify: `frontend/src/views/AlertsView.vue` (977 lines)

**Step 1: Update AlertsView border radius classes**

Extensive changes needed (see exploration notes for exact locations):
- `rounded-full` → `rounded-sm` at lines ~527, 535, 568, 672, 680, 688, 802
- `rounded-xl` → `rounded` at lines ~551, 592, 723, 774, 840
- `rounded-lg` → `rounded-sm` at lines ~631, 665, 697, 702, 707, 756, 840, 865, 878, 911, 920, 933, 958, 965
- `rounded-md` → `rounded-sm` at lines ~697, 702, 707

**Step 2: Update heading casing**

Replace any uppercase headings with Title Case.

**Step 3: Visual verification**

Navigate to `/app/alerts`, verify alert cards, modal, tabs all render with enterprise styling.

**Step 4: Commit**

```bash
git add frontend/src/views/AlertsView.vue
git commit -m "feat: update AlertsView with enterprise design language"
```

---

### Task 13: Update Organization Settings & Branding

**Files:**
- Modify: `frontend/src/views/OrganizationSettings.vue` (1492 lines)
- Modify: `frontend/src/views/OrgBrandingSettings.vue` (254 lines)

**Step 1: Update OrganizationSettings.vue**

Replace all rounded classes (extensive — 1492 lines). This is the settings page with tabs for General, Members, Groups, Data Sources, Branding, AI.

Update the tab styling to use vertical tab list on the left side of the page (within the content area) instead of horizontal tabs at the top.

Replace hardcoded slate colors with CSS variable classes.

**Step 2: Update OrgBrandingSettings.vue**

Replace rounded classes. Update the sidebar preview section to match the new sidebar design (slim icon rail).

**Step 3: Visual verification**

Navigate to Settings, verify all tabs, forms, and the branding preview render correctly.

**Step 4: Commit**

```bash
git add frontend/src/views/OrganizationSettings.vue frontend/src/views/OrgBrandingSettings.vue
git commit -m "feat: update organization settings with enterprise design language"
```

---

### Task 14: Update Modal Components

**Files:**
- Modify: `frontend/src/components/CreateDashboardModal.vue` (413 lines)
- Modify: `frontend/src/components/EditDashboardModal.vue` (116 lines)
- Modify: `frontend/src/components/CreateOrganizationModal.vue` (222 lines)
- Modify: `frontend/src/components/FolderPermissionsModal.vue` (266 lines)
- Modify: `frontend/src/components/DashboardPermissionsEditor.vue` (252 lines)

**Step 1: Update all modal components**

All modals: `rounded` (4px) on modal container, `rounded-sm` (2px) on inputs/buttons. Modals should have 1px border + light shadow. Backdrop blur.

**Step 2: Visual verification**

Open each modal, verify sharp styling.

**Step 3: Commit**

```bash
git add frontend/src/components/CreateDashboardModal.vue frontend/src/components/EditDashboardModal.vue frontend/src/components/CreateOrganizationModal.vue frontend/src/components/FolderPermissionsModal.vue frontend/src/components/DashboardPermissionsEditor.vue
git commit -m "feat: update modal components with enterprise design language"
```

---

### Task 15: Update Remaining Components

**Files:**
- Modify: `frontend/src/components/TimeRangePicker.vue` (280 lines)
- Modify: `frontend/src/components/OrganizationDropdown.vue` (113 lines)
- Modify: `frontend/src/components/CopilotPanel.vue` (262 lines)
- Modify: `frontend/src/components/CookieConsentBanner.vue` (61 lines)
- Modify: `frontend/src/components/LogViewer.vue` (321 lines)
- Modify: `frontend/src/components/DataSourceSettingsPanel.vue` (109 lines)
- Modify: `frontend/src/components/GitHubAppSettings.vue` (178 lines)

**Step 1: Update all remaining components**

Same rounded class replacement pattern. Update any hardcoded colors.

**Step 2: Visual verification**

Spot-check components across the app.

**Step 3: Commit**

```bash
git add frontend/src/components/TimeRangePicker.vue frontend/src/components/OrganizationDropdown.vue frontend/src/components/CopilotPanel.vue frontend/src/components/CookieConsentBanner.vue frontend/src/components/LogViewer.vue frontend/src/components/DataSourceSettingsPanel.vue frontend/src/components/GitHubAppSettings.vue
git commit -m "feat: update remaining components with enterprise design language"
```

---

### Task 16: Update Remaining Views

**Files:**
- Modify: `frontend/src/views/DataSourceCreateView.vue` (982 lines)
- Modify: `frontend/src/views/DataSourceSettings.vue` (256 lines)
- Modify: `frontend/src/views/PrivacySettingsView.vue` (121 lines)
- Modify: `frontend/src/views/UserSettingsView.vue` (116 lines)

**Step 1: Update all remaining views**

Replace rounded classes, update heading casing, replace hardcoded colors.

**Step 2: Visual verification**

Navigate to each view, verify enterprise styling.

**Step 3: Commit**

```bash
git add frontend/src/views/DataSourceCreateView.vue frontend/src/views/DataSourceSettings.vue frontend/src/views/PrivacySettingsView.vue frontend/src/views/UserSettingsView.vue
git commit -m "feat: update remaining views with enterprise design language"
```

---

### Task 17: Final Polish & Cross-Theme Verification

**Files:**
- Possibly modify: Any files with remaining issues found during verification

**Step 1: Full app walkthrough — Dark mode**

Navigate through every page in dark mode:
- Login page
- Dashboards list
- Dashboard detail (if data exists)
- Explore > Metrics, Logs, Traces
- Alerts
- Settings > all tabs
- Data source creation

Check for: consistent corners, correct fonts, proper colors, no hardcoded slate values bleeding through.

**Step 2: Full app walkthrough — Light mode**

Toggle to light mode and repeat the full walkthrough. Pay special attention to:
- Surface colors (should be true gray, not slate-tinted)
- Text contrast
- Sidebar staying dark
- Borders visible but not harsh

**Step 3: Fix any issues found**

Address any visual inconsistencies, missed rounded classes, or color issues.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: final polish for enterprise redesign — cross-theme verification"
```
