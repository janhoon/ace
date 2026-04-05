# Ace

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Figma-to-Code Rules

### Tokens
Design tokens are CSS custom properties defined in `frontend/src/style.css` under `:root`.
Tailwind CSS v4 maps these via `@theme` directives in the same file.
When implementing Figma designs, map Figma variables to these CSS custom properties.

### Color Mapping
| Figma Token | CSS Variable | Tailwind Class |
|-------------|-------------|----------------|
| Primary | `--color-primary` | `text-primary`, `bg-primary` |
| Surface | `--color-surface` | `bg-surface` |
| Surface Card | `--color-surface-container-low` | `bg-surface-container-low` |
| Surface Elevated | `--color-surface-container-high` | `bg-surface-container-high` |
| Text Primary | `--color-on-surface` | `text-on-surface` |
| Text Secondary | `--color-on-surface-variant` | `text-on-surface-variant` |

### Component Patterns
- Framework: Vue 3 Composition API with `<script setup lang="ts">`
- Styling: Hybrid of Tailwind utility classes + inline `:style` bindings for design tokens
- Icons: `lucide-vue-next` — import named icons, render with `<IconName :size="18" />`
- Charts: `vue-echarts` wrapping ECharts
- Dashboard layout: `vue3-grid-layout-next`

### Styling Approach
- Use Tailwind utilities for layout, spacing, flexbox, grid
- Use inline `:style` bindings with `var(--color-*)` for colors that reference design tokens
- Use `@layer base` in style.css for global element styles
- Animations defined as utility classes in style.css (`.animate-fade-in`, `.animate-slide-up`, etc.)

### Icon System
Icons come from `lucide-vue-next`. Import by name:
```vue
import { Activity, AlertTriangle, Home } from 'lucide-vue-next'
```
Use dynamic rendering: `<component :is="item.icon" :size="18" />`

### Asset Organization
Static assets (datasource logos, etc.) live in `frontend/src/assets/`.
SVG files are imported directly in components.

### Build & Dev
- Dev server: `bun run dev` (Vite on port 5173)
- Build: `bun run build` (vue-tsc + Vite)
- Test: `bun run test` (Vitest + happy-dom)
- Lint: `bun run lint:fix` (Biome)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
