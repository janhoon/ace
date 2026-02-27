# Enterprise Redesign - Design Document

**Date:** 2026-02-27
**Direction:** Sharp Professional (Approach A)
**Inspiration:** Grafana technical credibility + New Relic polished enterprise feel

## Overview

Full visual redesign of the Ace observability app from "startup" to "enterprise". Covers typography, color system, component design language, sidebar/navigation, and all page layouts. Both dark and light themes receive equal design attention. Also restores the missing Alerts view.

## Typography

### Fonts
- **Primary:** Inter (400, 500, 600, 700) via Google Fonts
- **Monospace:** JetBrains Mono (400, 600) via Google Fonts
- Replaces: Space Grotesk + IBM Plex Mono

### Scale

| Element | Size | Weight | Case |
|---------|------|--------|------|
| Page title | 1.5rem (24px) | 700 | Title Case |
| Section heading | 1.125rem (18px) | 600 | Title Case |
| Card title | 0.9375rem (15px) | 600 | Title Case |
| Body text | 0.875rem (14px) | 400 | Sentence |
| Label/caption | 0.75rem (12px) | 500 | Uppercase w/ tracking |
| Code/data | 0.8125rem (13px) | 400 | As-is |

### Heading Rules
- Page titles and section headings: Title Case, no letter-spacing manipulation
- Metadata labels (DATA SOURCE, QUERY RANGE, YOUR ROLE, etc.): Uppercase with letter-spacing (standard enterprise pattern)

## Color System

### Neutrals (moving from slate-tinted to true gray)

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `surface-base` | `#f9fafb` | `#0a0a0f` | Page background |
| `surface-raised` | `#ffffff` | `#111118` | Cards, panels |
| `surface-overlay` | `#f3f4f6` | `#1a1a24` | Hover states, secondary surfaces |
| `surface-input` | `#ffffff` | `#0f0f17` | Input backgrounds |
| `surface-sidebar` | `#111118` | `#08080d` | Sidebar (always dark) |

### Text

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `text-primary` | `#111827` | `#f3f4f6` | Main content |
| `text-secondary` | `#4b5563` | `#9ca3af` | Descriptions, secondary |
| `text-muted` | `#9ca3af` | `#4b5563` | Placeholders, disabled |

### Semantic Colors
- **Accent:** `#10b981` (emerald-500) - primary interactive, CTAs
- **Danger:** `#f43f5e` (rose-500) - destructive actions, errors
- **Warning:** `#f59e0b` (amber-500) - caution states
- **Success:** `#10b981` (emerald-500) - healthy states
- **Info:** `#3b82f6` (blue-500) - informational states, links, focus

### Key Change
Dark mode background shifts from blue-tinted `#0f172a` (slate-900) to warm near-black `#0a0a0f`. More premium, less "developer tool dark theme".

## Component Design Language

### Border Radius
- Buttons, inputs, dropdowns: `2px`
- Cards, panels, modals: `4px`
- Badges/status pills: `4px` (no full pill shapes)
- Sidebar: `0px`
- Avatars/org icons: `4px` (square with slight rounding)

### Borders & Depth
- Cards: 1px solid border, no box-shadow
- Inputs: 1px border, darker on focus (border color change to accent, no glow)
- Dashboard panels: 1px border, compact panel header with subtle background tint
- Modals: 1px border + light shadow for elevation, backdrop blur

### Buttons
- **Primary:** Solid emerald bg, white text, 2px radius, 600 weight
- **Secondary:** 1px border, transparent bg, text-secondary. Hover fills lightly
- **Ghost:** No border, text only, hover shows subtle background
- **Danger:** Solid rose for destructive actions
- Height: 32px (compact) / 36px (default)

### Tables & Data
- Alternating row backgrounds (very subtle)
- Sticky headers
- Monospace for data values, Inter for labels
- 1px bottom borders between rows

### Badges/Status
- 4px radius (square-ish, not pills)
- 20px height, 10px horizontal padding
- Dot indicator + text for status

## Sidebar & Navigation

### Icon Rail (collapsed, default)
- Width: 48px
- Dark background (`#111118`) in both themes
- Icons centered, 20px size
- Active: 2px left border accent line (not background fill)
- Tooltip on hover
- Top: Logo mark only
- Bottom: user avatar, theme toggle

### Flyout (expanded on hover)
- Width: ~220px
- Slides out from rail, 150ms transition
- Full labels next to icons
- Submenu items indent (Metrics, Logs, Traces under Explore)
- Organization switcher in flyout header
- Slight shadow on flyout edge
- Auto-collapse 200ms after mouse leaves
- Click main content to dismiss

### Navigation Items
1. Dashboards
2. Alerts (restored!)
3. Explore (submenu: Metrics, Logs, Traces)
4. Settings (bottom)
5. Theme toggle (bottom)

## Page Layouts

### Dashboards List
- Title Case "Dashboards" (700 weight), action buttons right-aligned
- Table layout: Name, Created, Modified, Owner columns
- Row hover with subtle background
- Inline folder expand/collapse
- Buttons: "New Dashboard" (primary), "New Folder" (secondary)

### Dashboard Detail
- Compact header bar: name left, time range + refresh + actions right
- Grid panels: 1px borders, compact titles (12px uppercase in panel header)
- Panel header: subtle background tint
- Edit mode: dashed border on hover, visible drag handles

### Explore (Metrics/Logs/Traces)
- Query builder top, results bottom (clear visual separation)
- Underline tabs for Builder/Code (not pill tabs)
- Compact data source selector: icon + name + status dot
- Results with crisp borders

### Settings
- Vertical tab list on the left (within page content, not sidebar)
- Content on right
- Clean form layouts
- Section cards with 4px radius, 1px borders

### Login
- Centered card, clean background
- Logo + app name
- Sharp, compact form inputs

## Additional Requirements
- Restore missing Alerts view (route + navigation)
- Both light and dark themes receive equal polish
- All existing functionality preserved
- Organization branding system continues to work (custom accent colors)
