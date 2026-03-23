# Home Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the home page from a flat vertical stack into a cinematic "Hero + Panels" layout with ambient glow, pulsing status dots, bold typography, and type-coded AI insight cards.

**Architecture:** Three components change (StatusDot, AiInsightCard, HomeView). StatusDot gains automatic glow for critical/warning. AiInsightCard gets a `type` prop for color-coded left-border accents. HomeView gets a dramatic hero section with amber glow and a two-column panels layout replacing the current grids.

**Tech Stack:** Vue 3 Composition API, Tailwind CSS v4, CSS custom properties, Vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-03-22-home-page-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/components/StatusDot.vue` | Modify | Add glow pulse keyframes + auto-apply for critical/warning |
| `frontend/src/components/StatusDot.spec.ts` | Modify | Add glow animation tests |
| `frontend/src/components/AiInsightCard.vue` | Modify | Add `type` prop, replace glassmorphic with left-border accent |
| `frontend/src/components/AiInsightCard.spec.ts` | Modify | Add `type` prop tests, update style assertions |
| `frontend/src/views/HomeView.vue` | Modify | Hero section, two-column panels, ambient glow, mock data |
| `frontend/src/views/HomeView.spec.ts` | Modify | Update broken style assertions, add `type` to stubs |

---

### Task 1: StatusDot — Add Glow Pulse for Critical/Warning

**Files:**
- Modify: `frontend/src/components/StatusDot.spec.ts`
- Modify: `frontend/src/components/StatusDot.vue`

- [ ] **Step 1: Write failing tests for glow animation**

Add these tests to `frontend/src/components/StatusDot.spec.ts`:

```ts
it('applies glow animation for critical status', () => {
  const wrapper = mount(StatusDot, {
    props: { status: 'critical' },
  })

  const dot = wrapper.find('[role="status"]')
  expect(dot.attributes('style')).toContain('pulse-critical')
})

it('applies glow animation for warning status', () => {
  const wrapper = mount(StatusDot, {
    props: { status: 'warning' },
  })

  const dot = wrapper.find('[role="status"]')
  expect(dot.attributes('style')).toContain('pulse-warning')
})

it('does NOT apply glow animation for healthy status', () => {
  const wrapper = mount(StatusDot, {
    props: { status: 'healthy' },
  })

  const dot = wrapper.find('[role="status"]')
  expect(dot.attributes('style')).not.toContain('pulse-')
})

it('applies both opacity pulse and glow when pulse prop is true on critical status', () => {
  const wrapper = mount(StatusDot, {
    props: { status: 'critical', pulse: true },
  })

  const dot = wrapper.find('[role="status"]')
  const style = dot.attributes('style') || ''
  expect(style).toContain('statusDotPulse')
  expect(style).toContain('pulse-critical')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/StatusDot.spec.ts`
Expected: 4 new tests FAIL (no glow animation applied yet)

- [ ] **Step 3: Implement glow pulse in StatusDot.vue**

Update `frontend/src/components/StatusDot.vue`:

In the `<script setup>` section, update `dotStyle` computed to add glow animation:

```ts
const glowAnimationMap: Record<string, string> = {
  critical: 'pulse-critical 2s ease-in-out infinite',
  warning: 'pulse-warning 2s ease-in-out infinite',
}

const dotStyle = computed(() => {
  const animations: string[] = []
  if (props.pulse) {
    animations.push('statusDotPulse 2s ease-in-out infinite')
  }
  if (glowAnimationMap[props.status]) {
    animations.push(glowAnimationMap[props.status])
  }

  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    backgroundColor: colorMap[props.status],
    borderRadius: '9999px',
    display: 'inline-block',
    flexShrink: 0,
    ...(animations.length > 0 ? { animation: animations.join(', ') } : {}),
  }
})
```

In the `<style scoped>` section, add the glow keyframes alongside the existing `statusDotPulse`:

```css
@keyframes pulse-critical {
  0%, 100% { box-shadow: 0 0 4px rgba(239,68,68,0.4); }
  50% { box-shadow: 0 0 10px rgba(239,68,68,0.7); }
}

@keyframes pulse-warning {
  0%, 100% { box-shadow: 0 0 4px rgba(249,115,22,0.4); }
  50% { box-shadow: 0 0 10px rgba(249,115,22,0.7); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/StatusDot.spec.ts`
Expected: ALL tests PASS (existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StatusDot.vue frontend/src/components/StatusDot.spec.ts
git commit -m "feat(StatusDot): add automatic glow pulse for critical/warning statuses"
```

---

### Task 2: AiInsightCard — Add Type Prop with Color-Coded Left Border

**Files:**
- Modify: `frontend/src/components/AiInsightCard.spec.ts`
- Modify: `frontend/src/components/AiInsightCard.vue`

- [ ] **Step 1: Write failing tests for type prop**

Replace the content of `frontend/src/components/AiInsightCard.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiInsightCard from './AiInsightCard.vue'

describe('AiInsightCard', () => {
  const defaultProps = {
    title: 'Anomaly Detected',
    description: 'CPU usage spiked 40% above baseline at 14:32 UTC.',
    timestamp: '2 minutes ago',
    type: 'anomaly' as const,
  }

  it('renders title, description, and timestamp', () => {
    const wrapper = mount(AiInsightCard, {
      props: defaultProps,
    })

    expect(wrapper.text()).toContain('Anomaly Detected')
    expect(wrapper.text()).toContain('CPU usage spiked 40% above baseline at 14:32 UTC.')
    expect(wrapper.text()).toContain('2 minutes ago')
  })

  it('applies amber left border for anomaly type', () => {
    const wrapper = mount(AiInsightCard, {
      props: { ...defaultProps, type: 'anomaly' },
    })

    const card = wrapper.find('[data-testid="ai-insight-card"]')
    const style = card.attributes('style') || ''
    expect(style).toContain('#E5A00D')
    expect(style).toContain('border-left')
  })

  it('applies blue left border for optimization type', () => {
    const wrapper = mount(AiInsightCard, {
      props: { ...defaultProps, type: 'optimization' },
    })

    const card = wrapper.find('[data-testid="ai-insight-card"]')
    const style = card.attributes('style') || ''
    expect(style).toContain('#60A5FA')
  })

  it('applies orange left border for forecast type', () => {
    const wrapper = mount(AiInsightCard, {
      props: { ...defaultProps, type: 'forecast' },
    })

    const card = wrapper.find('[data-testid="ai-insight-card"]')
    const style = card.attributes('style') || ''
    expect(style).toContain('#F97316')
  })

  it('does not use backdrop-filter (old glassmorphic style removed)', () => {
    const wrapper = mount(AiInsightCard, {
      props: defaultProps,
    })

    const card = wrapper.find('[data-testid="ai-insight-card"]')
    const style = card.attributes('style') || ''
    expect(style).not.toContain('backdrop-filter')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/AiInsightCard.spec.ts`
Expected: FAIL — `type` prop doesn't exist yet, old style assertions fail

- [ ] **Step 3: Implement AiInsightCard with type prop**

Replace the content of `frontend/src/components/AiInsightCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  description: string
  timestamp: string
  type: 'anomaly' | 'optimization' | 'forecast'
}>()

const colorMap = {
  anomaly: { border: '#E5A00D', bg: 'rgba(229,160,13,0.05)' },
  optimization: { border: '#60A5FA', bg: 'rgba(96,165,250,0.05)' },
  forecast: { border: '#F97316', bg: 'rgba(249,115,22,0.05)' },
}

const cardStyle = computed(() => {
  const colors = colorMap[props.type]
  return {
    borderLeft: `2px solid ${colors.border}`,
    backgroundColor: colors.bg,
    borderRadius: '0 8px 8px 0',
    padding: '10px 12px',
  }
})
</script>

<template>
  <div
    data-testid="ai-insight-card"
    :style="cardStyle"
  >
    <h4
      class="text-sm font-semibold"
      :style="{ color: 'var(--color-on-surface)' }"
    >
      {{ title }}
    </h4>
    <p
      class="mt-1 text-sm"
      :style="{ color: 'var(--color-on-surface-variant)' }"
    >
      {{ description }}
    </p>
    <time
      class="mt-1 block text-xs"
      :style="{ color: 'var(--color-outline)' }"
    >
      {{ timestamp }}
    </time>
  </div>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/AiInsightCard.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AiInsightCard.vue frontend/src/components/AiInsightCard.spec.ts
git commit -m "feat(AiInsightCard): add type prop with color-coded left-border accents"
```

---

### Task 3: HomeView — Redesign Template

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/views/HomeView.spec.ts`

This is the largest task. It touches the template, styles, and mock data, but no logic changes.

- [ ] **Step 1: Update HomeView.spec.ts — fix breaking test assertions**

In `frontend/src/views/HomeView.spec.ts`, make these changes:

**a)** Find the test at line 152 (`'renders the "Recent AI Insights" section'`) and update the assertion — the heading changed from "Recent AI Insights" to "AI Insights":

```ts
it('renders the "AI Insights" section with AiInsightCard components', () => {
  wrapper = createWrapper()

  expect(wrapper.text()).toContain('AI Insights')
  const insightCards = wrapper.findAll('[data-testid="ai-insight-card"]')
  expect(insightCards.length).toBeGreaterThanOrEqual(1)
})
```

**b)** Find the test at line 269 (`'AI command input section has glassmorphic styling with backdrop-blur'`) and replace it:

```ts
it('AI command input section has gradient background styling', () => {
  wrapper = createWrapper()

  const inputSection = wrapper.find('[data-testid="ai-command-input"]')
  expect(inputSection.exists()).toBe(true)
  const style = inputSection.attributes('style') || ''
  expect(style).toContain('linear-gradient')
})
```

**c)** Update the AiInsightCard stub in the `createWrapper` function to accept the `type` prop. In the stubs object, update the `AiInsightCard` stub:

```ts
AiInsightCard: defineComponent({
  name: 'AiInsightCard',
  props: ['title', 'description', 'timestamp', 'type'],
  setup(props) {
    return () =>
      h('div', { 'data-testid': 'ai-insight-card' }, props.title)
  },
}),
```

- [ ] **Step 2: Run tests to see current state**

Run: `cd frontend && npx vitest run src/views/HomeView.spec.ts`
Expected: The glassmorphic test now expects `linear-gradient`, which the old template doesn't have yet — it will FAIL. Other tests should still pass.

- [ ] **Step 3: Update HomeView.vue mock data**

In `frontend/src/views/HomeView.vue`, update the `aiInsights` array to add `type` field:

```ts
const aiInsights = [
  {
    title: 'Anomaly Detected',
    description: 'CPU usage on API Gateway spiked 40% above baseline at 14:32 UTC.',
    timestamp: '2 minutes ago',
    type: 'anomaly' as const,
  },
  {
    title: 'Optimization Suggestion',
    description: 'Database query latency can be reduced by 30% with index on users.email.',
    timestamp: '15 minutes ago',
    type: 'optimization' as const,
  },
  {
    title: 'Capacity Forecast',
    description: 'Message Queue will reach 80% capacity in approximately 3 days at current growth rate.',
    timestamp: '1 hour ago',
    type: 'forecast' as const,
  },
]
```

- [ ] **Step 4: Replace the HomeView template**

Replace the `<!-- Normal state -->` div (everything inside `<div v-else ...>`) in `frontend/src/views/HomeView.vue` with the new Hero + Panels layout. The full replacement template:

```html
<!-- Normal state -->
<div v-else class="px-6 py-8 max-w-[1600px] mx-auto space-y-8 relative overflow-hidden">
  <!-- Ambient radial glow -->
  <div
    class="absolute pointer-events-none"
    :style="{
      top: '-60px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '600px',
      height: '300px',
      background: 'radial-gradient(ellipse 60% 50%, rgba(229,160,13,0.10), rgba(229,160,13,0.03) 50%, transparent 80%)',
      zIndex: 0,
    }"
  />

  <!-- 1. Hero AI Command Input -->
  <div
    data-testid="ai-command-input"
    class="rounded-2xl p-8 text-center relative overflow-hidden animate-fade-in"
    :style="{
      background: 'linear-gradient(180deg, var(--color-surface-container-low) 0%, var(--color-surface) 100%)',
      border: '1px solid rgba(229,160,13,0.12)',
      zIndex: 1,
    }"
  >
    <!-- Amber glow line -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-[200px]"
      :style="{
        background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
      }"
    />

    <h1
      class="font-display font-bold mb-4"
      :style="{
        color: 'var(--color-on-surface)',
        fontSize: '32px',
        letterSpacing: '-0.04em',
      }"
    >
      Ask Ace anything
    </h1>
    <div
      class="mx-auto max-w-[480px] rounded-xl px-4 py-3 text-left text-sm cursor-pointer transition-colors flex items-center justify-between"
      :style="{
        backgroundColor: 'var(--color-surface-container-high)',
        color: 'var(--color-on-surface-variant)',
        border: '1px solid var(--color-outline-variant)',
      }"
    >
      <span class="opacity-60">Search services, query data, generate dashboards...</span>
      <kbd
        class="text-[9px] shrink-0 ml-3 px-1.5 py-0.5 rounded"
        :style="{
          border: '1px solid var(--color-outline-variant)',
          color: 'var(--color-outline)',
        }"
      >&#8984;K</kbd>
    </div>
  </div>

  <!-- 2. Onboarding Banner (conditional) -->
  <OnboardingBanner v-if="!onboardingDismissed" />

  <!-- 3. Pinned Dashboards -->
  <section v-if="favorites.length > 0" data-testid="pinned-dashboards">
    <h2
      class="font-display text-lg font-semibold mb-4"
      :style="{ color: 'var(--color-on-surface)' }"
    >
      Pinned Dashboards
    </h2>
    <div class="flex gap-3 overflow-x-auto pb-2">
      <router-link
        v-for="favId in favorites"
        :key="favId"
        :to="`/app/dashboards/${favId}`"
        class="shrink-0 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:opacity-90 no-underline"
        :style="{
          backgroundColor: 'var(--color-surface-container)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          minWidth: '160px',
        }"
      >
        {{ favId }}
      </router-link>
    </div>
  </section>

  <!-- 4. Recently Viewed -->
  <section v-if="recentDashboards.length > 0" data-testid="recently-viewed">
    <h2
      class="font-display text-lg font-semibold mb-4"
      :style="{ color: 'var(--color-on-surface)' }"
    >
      Recently Viewed
    </h2>
    <div class="flex gap-3 overflow-x-auto pb-2">
      <router-link
        v-for="dashboard in recentDashboards"
        :key="dashboard.id"
        :to="`/app/dashboards/${dashboard.id}`"
        class="shrink-0 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:opacity-90 no-underline"
        :style="{
          backgroundColor: 'var(--color-surface-container)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          minWidth: '160px',
        }"
      >
        {{ dashboard.title }}
      </router-link>
    </div>
  </section>

  <!-- 5. Two-Column Panels -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Left Panel: System Health -->
    <section
      data-testid="system-health-grid"
      class="rounded-xl p-5 animate-fade-in"
      :style="{
        backgroundColor: 'var(--color-surface-container-low)',
        border: '1px solid var(--color-outline-variant)',
      }"
    >
      <div class="flex items-center justify-between mb-4">
        <span
          class="text-[11px] uppercase tracking-widest font-semibold"
          :style="{ color: 'var(--color-secondary)' }"
        >
          System Health
        </span>
        <span
          class="text-[11px]"
          :style="{ color: 'var(--color-on-surface-variant)' }"
        >
          {{ healthServices.length }} services
        </span>
      </div>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="service in healthServices"
          :key="service.name"
          data-testid="health-card"
          class="flex items-center gap-3 rounded-lg px-3 py-2"
          :style="{
            backgroundColor:
              service.status === 'critical'
                ? 'rgba(239,68,68,0.08)'
                : service.status === 'warning'
                  ? 'rgba(249,115,22,0.08)'
                  : 'var(--color-surface-container-high)',
            border:
              service.status === 'critical'
                ? '1px solid rgba(239,68,68,0.12)'
                : service.status === 'warning'
                  ? '1px solid rgba(249,115,22,0.12)'
                  : '1px solid transparent',
          }"
        >
          <StatusDot :status="service.status" :size="6" />
          <span
            class="text-sm flex-1"
            :style="{ color: 'var(--color-on-surface)' }"
          >
            {{ service.name }}
          </span>
          <span
            class="font-mono text-[13px]"
            :style="{ color: 'var(--color-on-surface-variant)' }"
          >
            {{ service.latency }}
          </span>
          <span
            class="font-mono text-[13px]"
            :style="{
              color:
                service.status === 'critical'
                  ? 'var(--color-error)'
                  : service.status === 'warning'
                    ? 'var(--color-tertiary)'
                    : 'var(--color-secondary)',
            }"
          >
            {{ service.uptime }}
          </span>
        </div>
      </div>
    </section>

    <!-- Right Panel: AI Insights -->
    <section
      class="rounded-xl p-5 animate-fade-in"
      :style="{
        backgroundColor: 'var(--color-surface-container-low)',
        border: '1px solid rgba(229,160,13,0.08)',
        animationDelay: '50ms',
      }"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span
            class="inline-block shrink-0"
            :style="{
              width: '10px',
              height: '10px',
              borderRadius: '3px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))',
            }"
          />
          <span
            class="text-[11px] uppercase tracking-widest font-semibold"
            :style="{ color: 'var(--color-primary)' }"
          >
            AI Insights
          </span>
        </div>
        <span
          class="text-[11px]"
          :style="{ color: 'var(--color-outline)' }"
        >
          {{ aiInsights.length }} new
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <AiInsightCard
          v-for="(insight, index) in aiInsights"
          :key="index"
          :title="insight.title"
          :description="insight.description"
          :timestamp="insight.timestamp"
          :type="insight.type"
        />
      </div>
    </section>
  </div>
</div>
```

- [ ] **Step 5: Run all tests**

Run: `cd frontend && npx vitest run src/views/HomeView.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: ALL tests PASS (StatusDot pulse prop still works for AlertsView/RefreshIndicator)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/HomeView.vue frontend/src/views/HomeView.spec.ts
git commit -m "feat(HomeView): redesign home page with Hero + Panels layout

- Dramatic hero section with amber glow line and radial ambient glow
- 32px Satoshi heading with tight tracking
- Two-column panels: System Health rows + AI Insights
- Tinted rows for critical/warning services
- Type-coded AI insight cards with colored left borders
- Keyboard shortcut badge on search input"
```

---

### Task 4: Visual Verification

**Files:** None (manual check)

- [ ] **Step 1: Start dev server and verify**

Run: `cd frontend && npm run dev`

Open `http://localhost:5173/app` and verify:
1. Amber radial glow visible behind the hero section
2. Amber glow line at top of hero card
3. "Ask Ace anything" heading is large (32px) and bold
4. `⌘K` badge visible in search input
5. System Health panel shows clean rows with status dots
6. Critical (Search Engine) and warning (Database Primary) rows have tinted backgrounds
7. Critical/warning status dots pulse with a glow effect
8. AI Insights panel shows three cards with colored left borders (amber, blue, orange)
9. Panels are side-by-side on desktop, stacked on mobile

- [ ] **Step 2: Verify reduced motion**

In browser DevTools, enable "Emulate prefers-reduced-motion: reduce" and verify pulse animations stop.
