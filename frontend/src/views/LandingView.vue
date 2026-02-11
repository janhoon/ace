<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const faqStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Which datasources does Dash support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Dash supports Prometheus-compatible metrics, Loki logs, Tempo traces, and VictoriaMetrics backends for self-hosted monitoring workflows.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can teams self-host Dash?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Dash is open source and designed for self-hosted deployments with role-based access control and organization-level settings.',
      },
    },
  ],
})

let faqSchemaElement: HTMLScriptElement | null = null

onMounted(() => {
  faqSchemaElement = document.createElement('script')
  faqSchemaElement.type = 'application/ld+json'
  faqSchemaElement.text = faqStructuredData
  faqSchemaElement.setAttribute('data-landing-faq-schema', 'true')
  document.head.appendChild(faqSchemaElement)
})

onBeforeUnmount(() => {
  if (faqSchemaElement) {
    faqSchemaElement.remove()
    faqSchemaElement = null
  }
})
</script>

<template>
  <div class="landing-page">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">D</span>
        <span class="brand-text">Dash</span>
      </div>
      <nav class="topnav" aria-label="Landing navigation">
        <a href="#overview">Overview</a>
        <a href="#stack">Supported stack</a>
        <RouterLink to="/login">Sign in</RouterLink>
      </nav>
    </header>

    <main>
      <section class="hero" aria-labelledby="landing-title">
        <div class="hero-copy-wrap">
          <p class="eyebrow">Open-source observability platform</p>
          <h1 id="landing-title">Open-Source Monitoring Dashboard with Multi-Datasource Support</h1>
          <p class="hero-copy">
            Dash helps teams monitor infrastructure and applications with one interface for
            Prometheus, Loki, Tempo, and VictoriaMetrics-compatible datasources.
          </p>
          <ul class="feature-list">
            <li>Monitor metrics, logs, and traces with a unified explorer workflow</li>
            <li>Run self-hosted in your own environment with role-based access control</li>
            <li>Import and export dashboards as YAML for reproducible configuration</li>
          </ul>
          <div class="hero-actions">
            <RouterLink class="btn btn-primary" to="/login">Get Started</RouterLink>
            <a class="btn btn-secondary" href="#overview">View Demo</a>
            <a class="btn btn-link" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div class="hero-visual" aria-label="Dash application preview">
          <picture>
            <source srcset="/images/landing-hero.webp" type="image/webp" />
            <img
              src="/images/landing-hero.webp"
              alt="Dash monitoring dashboard screenshot showing metrics, logs, and traces panels"
              width="1600"
              height="900"
              loading="eager"
              decoding="async"
            />
          </picture>
        </div>
      </section>

      <section id="overview" class="content-section" aria-labelledby="overview-title">
        <h2 id="overview-title">Built for operational teams that need fast answers</h2>
        <p>
          Dash separates public marketing content from the authenticated application so search engines can
          index product value clearly while users work in a focused app shell under <code>/app/*</code>.
        </p>
      </section>

      <section id="stack" class="content-section" aria-labelledby="stack-title">
        <h2 id="stack-title">Supported observability stack</h2>
        <div class="stack-grid" role="list" aria-label="Supported integrations">
          <article role="listitem" class="stack-card">
            <h3>Prometheus</h3>
            <p>Query metrics with dashboard panels and Explore metrics tooling.</p>
          </article>
          <article role="listitem" class="stack-card">
            <h3>Loki</h3>
            <p>Run LogQL queries and inspect logs with trace-aware navigation context.</p>
          </article>
          <article role="listitem" class="stack-card">
            <h3>Tempo</h3>
            <p>Visualize trace timelines, span details, and service dependencies.</p>
          </article>
          <article role="listitem" class="stack-card">
            <h3>VictoriaMetrics</h3>
            <p>Use scalable metrics and tracing backends in self-hosted deployments.</p>
          </article>
        </div>
      </section>
    </main>

  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  color: var(--text-primary);
  padding: 1.1rem 1.25rem 2.4rem;
}

.topbar {
  max-width: 1080px;
  margin: 0 auto;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: rgba(10, 18, 28, 0.82);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.9rem;
  backdrop-filter: blur(8px);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 700;
}

.brand-text {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.topnav {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.85rem;
}

.hero,
.content-section {
  max-width: 1080px;
  margin: 0.95rem auto 0;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(14, 23, 36, 0.92), rgba(12, 20, 32, 0.9));
  box-shadow: var(--shadow-sm);
}

.hero {
  padding: 1.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 1rem;
  align-items: center;
}

.hero-copy-wrap {
  min-width: 0;
}

.eyebrow {
  margin: 0;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  font-size: 0.74rem;
}

.hero h1 {
  margin: 0.45rem 0 0.8rem;
  max-width: 16ch;
  font-size: clamp(1.9rem, 5vw, 2.9rem);
  line-height: 1.1;
}

.hero-copy {
  max-width: 58ch;
  font-size: 0.98rem;
}

.feature-list {
  margin: 1rem 0 0;
  padding-left: 1.1rem;
  color: var(--text-secondary);
  display: grid;
  gap: 0.35rem;
}

.hero-actions {
  margin-top: 1.2rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.btn {
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0.58rem 0.88rem;
  font-size: 0.84rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
}

.btn-secondary {
  background: var(--surface-2);
  border-color: var(--border-primary);
  color: var(--text-primary);
}

.btn-link {
  color: var(--text-accent);
}

.hero-visual {
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(8, 14, 24, 0.9);
  box-shadow: var(--shadow-md);
}

.hero-visual picture,
.hero-visual img {
  display: block;
  width: 100%;
}

.content-section {
  padding: 1.25rem;
}

.content-section h2 {
  font-size: 1.25rem;
  margin-bottom: 0.65rem;
}

.stack-grid {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.stack-card {
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  background: rgba(20, 32, 50, 0.75);
  padding: 0.85rem;
}

.stack-card h3 {
  margin-bottom: 0.35rem;
  font-size: 0.93rem;
}

.stack-card p {
  font-size: 0.85rem;
}

@media (max-width: 760px) {
  .landing-page {
    padding: 0.8rem 0.72rem 1.6rem;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .topnav {
    width: 100%;
    justify-content: space-between;
  }

  .hero {
    padding: 1.2rem 1rem;
    grid-template-columns: 1fr;
  }

  .stack-grid {
    grid-template-columns: 1fr;
  }
}
</style>
