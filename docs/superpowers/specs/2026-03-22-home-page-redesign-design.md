# Home Page Redesign — "Hero + Panels"

## Overview

Redesign the HomeView from a flat vertical stack into a cinematic "Hero + Panels" layout. The content sections stay the same; the visual treatment changes dramatically. The page should feel like a warm mission control center — alive, atmospheric, and distinctly Ace.

## Design Decisions

- **Layout**: Hero + Panels (chosen over Bento Grid and Command Center)
- **Health panel style**: Clean rows with dot + name + latency + uptime (chosen over bars + sparklines)
- **Drama level**: Full — ambient glow, pulsing dots, bold typography, tinted problem rows

## Section 1: Hero AI Search

The top section is the dramatic anchor of the page.

### Ambient radial glow
A soft amber `radial-gradient` on the page container's `::before` pseudo-element, positioned behind the hero. This is atmospheric — it bleeds across the top ~200px of the page, not contained to any card.

```css
/* On the main content wrapper */
position: relative;

&::before {
  content: '';
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 300px;
  background: radial-gradient(ellipse 60% 50%, rgba(229,160,13,0.10), rgba(229,160,13,0.03) 50%, transparent 80%);
  pointer-events: none;
  z-index: 0;
}
```

The ambient glow is a static CSS gradient (not animated), so it is unaffected by `prefers-reduced-motion`.

### Hero card
- Background: `linear-gradient(180deg, var(--color-surface-container-low) 0%, var(--color-surface) 100%)`
- Border: `1px solid rgba(229,160,13,0.12)` (amber tint, not neutral outline-variant)
- Border-radius: `16px` (rounded-2xl)
- Padding: `32px` vertical, `32px` horizontal
- `overflow: hidden; position: relative` for the glow line

### Amber glow line
A decorative `::after` pseudo-element on the hero card:
```css
&::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
}
```

### Heading
- Font: Satoshi (font-display), 32px, weight 700
- Letter-spacing: -0.04em
- Color: `var(--color-on-surface)`
- Text: "Ask Ace anything"
- Note: 32px is intentionally between H1 (28px) and Display (48px) from the type scale — this is the only heading on the page and should feel like a hero without dominating a full-screen display treatment.

### Search input area
- Max-width: 480px, centered
- Background: `var(--color-surface-container-high)`
- Border: `1px solid var(--color-outline-variant)`
- Border-radius: 12px
- Padding: 12px 16px
- Placeholder text: "Search services, query data, generate dashboards..."
- Right-aligned `⌘K` badge: 9px text, `var(--color-outline-variant)` border, `var(--color-outline)` text, 4px border-radius
- Clicking the input area or badge opens the existing CmdK command palette (same behavior as current)

## Section 2: Conditional Sections

These stay unchanged:
- `OnboardingBanner` (shown when not dismissed)
- Pinned Dashboards (shown when favorites exist)
- Recently Viewed (shown when recent dashboards exist)

## Section 3: Two-Column Panels

Replaces the current separate System Health grid and AI Insights grid with a `grid-cols-1 lg:grid-cols-2` layout.

### Left Panel — System Health

**Container:**
- Background: `var(--color-surface-container-low)`
- Border: `1px solid var(--color-outline-variant)`
- Border-radius: 12px
- Padding: 20px

**Header row:**
- Left: `SYSTEM HEALTH` in 11px uppercase, letter-spacing 0.08em, color `var(--color-secondary)` (#34D399)
- Right: service count in 11px, color `var(--color-on-surface-variant)`

**Service rows:**
Each service is a row with:
- Status dot: 6px circle, color-coded (green/orange/red)
- Service name: 14px, `var(--color-on-surface)`
- Latency: 13px mono, `var(--color-on-surface-variant)`, right-aligned
- Uptime: 13px mono, color matches status dot, right-aligned
- Gap between rows: 6px

**Tinted problem rows:**
- Critical status: `background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.12)`
- Warning status: `background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.12)`
- Healthy status: `background: var(--color-surface-container-high)` (neutral)
- All rows: border-radius 8px, padding 8px 12px

**Pulsing status dots (critical/warning only):**

Replace the existing opacity-based `statusDotPulse` animation in `StatusDot.vue` with a `box-shadow` glow animation. The new animation uses hardcoded rgba values per status since CSS custom properties holding hex values cannot be decomposed into `rgba()` channels:

```css
/* Critical pulse */
@keyframes pulse-critical {
  0%, 100% { box-shadow: 0 0 4px rgba(239,68,68,0.4); }
  50% { box-shadow: 0 0 10px rgba(239,68,68,0.7); }
}

/* Warning pulse */
@keyframes pulse-warning {
  0%, 100% { box-shadow: 0 0 4px rgba(249,115,22,0.4); }
  50% { box-shadow: 0 0 10px rgba(249,115,22,0.7); }
}
```

- Duration: 2s, ease-in-out, infinite
- The existing `pulse` prop is **kept** (it's used in AlertsView and RefreshIndicator). The new behavior is additive: StatusDot gains a `glowPulse` computed that automatically applies `box-shadow` glow when `status` is `'critical'` or `'warning'`, independent of the `pulse` prop. The existing opacity-based `statusDotPulse` animation continues to work for callers that set `pulse=true`. Both animations can coexist (opacity pulse + glow pulse).
- On the home page, StatusDot is rendered without the `pulse` prop (as it currently is) — the glow effect activates automatically based on status.
- Respects `prefers-reduced-motion: reduce` (animation disabled via existing global rule in style.css)

### Right Panel — AI Insights

**Container:**
- Background: `var(--color-surface-container-low)`
- Border: `1px solid rgba(229,160,13,0.08)` (subtle amber tint)
- Border-radius: 12px
- Padding: 20px

**Header row:**
- Left: gradient amber square icon (10px, border-radius 3px, `linear-gradient(135deg, primary, primary-dim)`) + `AI INSIGHTS` in 11px uppercase, letter-spacing 0.08em, color `var(--color-primary)`
- Right: count badge ("3 new") in 11px, color `var(--color-outline)`

**Insight cards:**
Each insight is a left-border accent card:
- Left border: 2px solid, color varies by insight type
- Background: subtle tint of the border color at 0.05 opacity
- Border-radius: 0 8px 8px 0
- Padding: 10px 12px
- Title: 14px, `var(--color-on-surface)`
- Timestamp: 12px, `var(--color-outline)`
- Gap between cards: 8px

**Color coding by insight type:**
| Type | Border | Background tint |
|------|--------|-----------------|
| Anomaly/Alert | `#E5A00D` | `rgba(229,160,13,0.05)` |
| Optimization | `#60A5FA` | `rgba(96,165,250,0.05)` |
| Forecast/Warning | `#F97316` | `rgba(249,115,22,0.05)` |

**Mock data type mapping:**

Add a `type` field to each mock insight in HomeView.vue:

```ts
const aiInsights = [
  { title: 'Anomaly Detected', description: '...', timestamp: '2 minutes ago', type: 'anomaly' as const },
  { title: 'Optimization Suggestion', description: '...', timestamp: '15 minutes ago', type: 'optimization' as const },
  { title: 'Capacity Forecast', description: '...', timestamp: '1 hour ago', type: 'forecast' as const },
]
```

## Animation & Motion

All animations follow DESIGN.md's "intentional" motion approach:
- Hero and panels: `animate-fade-in` (250ms ease-out) on mount
- Panels stagger by 50ms (health first, then insights)
- Pulse animation on status dots: 2s ease-in-out (critical/warning only)
- All animations disabled under `prefers-reduced-motion: reduce` (handled by existing global rule in style.css)
- Ambient radial glow is a static gradient — not animated, not affected by reduced-motion

## Component Changes

### HomeView.vue
- Hero section: updated template and styles (larger heading, gradient background, amber border, glow line pseudo-element)
- Ambient glow: `::before` pseudo-element on the wrapper div
- Health grid: replaced 2x3 grid of cards with rows-in-a-panel layout
- AI insights grid: replaced 1x3 grid with panel alongside health panel
- Mock data: add `type` field to `aiInsights` array
- All `data-testid` attributes preserved

### AiInsightCard.vue
- Add `type` prop: `'anomaly' | 'optimization' | 'forecast'`
- Use type to determine left-border color and background tint (see color coding table above)
- Remove current gradient border-top and background tint treatment

### StatusDot.vue
- Keep the existing `pulse` prop and opacity-based `statusDotPulse` animation (used by AlertsView, RefreshIndicator)
- Add automatic `box-shadow` glow animation for `'critical'` and `'warning'` statuses via per-status keyframes (`pulse-critical`, `pulse-warning`)
- Both animations coexist: `pulse` prop controls opacity pulse, status controls glow pulse

### No new components needed

## Test Impact

- All existing `data-testid` selectors preserved
- `data-testid="ai-command-input"` stays on hero card
- `data-testid="system-health-grid"` stays on health section (now contains rows, not grid cards)
- `data-testid="health-card"` stays on each service row
- `data-testid="ai-insight-card"` stays on each insight card
- Existing test assertions about text content, component presence, and conditional rendering all remain valid
- **Breaking test**: HomeView spec line 269 asserts `backdrop-filter` on `[data-testid="ai-command-input"]` — the hero no longer uses glassmorphic `backdrop-filter`, so this assertion must be updated to check for the gradient background instead
- **Breaking test**: AiInsightCard currently uses `backdrop-filter` and `color-mix` background — tests asserting these styles will need updating for the new left-border accent card treatment
- Update: AiInsightCard tests to cover `type` prop and color variations
- Update: StatusDot tests — keep existing `pulse` prop tests, add tests for automatic glow on critical/warning status
- Update: HomeView test stubs to pass `type` prop to AiInsightCard
