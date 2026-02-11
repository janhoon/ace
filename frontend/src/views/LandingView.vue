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

const featureListStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Dash monitoring platform features',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Multi-datasource observability',
      description:
        'Query Prometheus metrics, Loki logs, Tempo traces, and VictoriaMetrics data from a single monitoring dashboard.',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Self-hosted monitoring control',
      description:
        'Deploy Dash in your own infrastructure for secure, open-source observability without vendor lock-in.',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Grafana-compatible migration path',
      description:
        'Import Grafana dashboards and convert panel configurations into Dash for easier migration from legacy tooling.',
    },
    {
      '@type': 'ListItem',
      position: 4,
      name: 'Integrated alerting workflows',
      description:
        'Build alert rules tied to dashboards and datasource queries so incidents can be triaged from one workflow.',
    },
    {
      '@type': 'ListItem',
      position: 5,
      name: 'Single Sign-On administration',
      description:
        'Configure authentication providers and organization access controls for secure SSO onboarding.',
    },
    {
      '@type': 'ListItem',
      position: 6,
      name: 'Flexible themes for operations teams',
      description:
        'Use light and dark dashboard themes tuned for day-shift and on-call monitoring sessions.',
    },
  ],
})

let faqSchemaElement: HTMLScriptElement | null = null
let featureSchemaElement: HTMLScriptElement | null = null

onMounted(() => {
  faqSchemaElement = document.createElement('script')
  faqSchemaElement.type = 'application/ld+json'
  faqSchemaElement.text = faqStructuredData
  faqSchemaElement.setAttribute('data-landing-faq-schema', 'true')
  document.head.appendChild(faqSchemaElement)

  featureSchemaElement = document.createElement('script')
  featureSchemaElement.type = 'application/ld+json'
  featureSchemaElement.text = featureListStructuredData
  featureSchemaElement.setAttribute('data-landing-features-schema', 'true')
  document.head.appendChild(featureSchemaElement)
})

onBeforeUnmount(() => {
  if (faqSchemaElement) {
    faqSchemaElement.remove()
    faqSchemaElement = null
  }

  if (featureSchemaElement) {
    featureSchemaElement.remove()
    featureSchemaElement = null
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
        <a href="#features">Features</a>
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

      <section id="features" class="content-section" aria-labelledby="features-title">
        <h2 id="features-title">Core Dash features for modern observability teams</h2>
        <p>
          Dash combines monitoring, alerting, and access control into a single open-source platform so teams can
          troubleshoot incidents quickly without switching tools.
        </p>
        <ul class="features-grid" aria-label="Dash platform feature list">
          <li class="feature-card">
            <article aria-labelledby="feature-multi-datasource-title">
              <svg viewBox="0 0 24 24" role="img" aria-label="Multi-datasource icon">
                <path
                  d="M4 6.5a8 3 0 1 0 16 0a8 3 0 1 0 -16 0M4 6.5v5a8 3 0 0 0 16 0v-5M4 11.5v5a8 3 0 0 0 16 0v-5"
                />
              </svg>
              <h3 id="feature-multi-datasource-title">Multi-datasource monitoring with Prometheus, Loki, Tempo, and VictoriaMetrics</h3>
              <p>
                Query metrics, logs, and traces from one dashboard experience to reduce context switching during
                incident response.
              </p>
            </article>
          </li>
          <li class="feature-card">
            <article aria-labelledby="feature-self-hosted-title">
              <svg viewBox="0 0 24 24" role="img" aria-label="Self-hosted icon">
                <path d="M12 3l9 4.5v4.7c0 5.3-3.5 8.6-9 9.8c-5.5-1.2-9-4.5-9-9.8V7.5L12 3z" />
                <path d="M9 12l2 2l4-4" />
              </svg>
              <h3 id="feature-self-hosted-title">Self-hosted observability for secure infrastructure ownership</h3>
              <p>
                Deploy Dash in your own environment with full control over data retention, network boundaries, and
                operational policies.
              </p>
            </article>
          </li>
          <li class="feature-card">
            <article aria-labelledby="feature-grafana-title">
              <svg viewBox="0 0 24 24" role="img" aria-label="Grafana migration icon">
                <path d="M4 6h9v12H4z" />
                <path d="M11 9h9v12h-9z" />
                <path d="M7 10h3M7 13h3M14 13h3M14 16h3" />
              </svg>
              <h3 id="feature-grafana-title">Grafana-compatible dashboard migration and import workflows</h3>
              <p>
                Bring existing Grafana JSON into Dash, preview conversion results, and continue iterating without
                rebuilding dashboards from scratch.
              </p>
            </article>
          </li>
          <li class="feature-card">
            <article aria-labelledby="feature-alerting-title">
              <svg viewBox="0 0 24 24" role="img" aria-label="Alerting icon">
                <path d="M12 4a5 5 0 0 1 5 5v3.5l1.6 2.7c.2.3 0 .8-.4.8H5.8c-.4 0-.6-.5-.4-.8L7 12.5V9a5 5 0 0 1 5-5z" />
                <path d="M10 18a2 2 0 0 0 4 0" />
              </svg>
              <h3 id="feature-alerting-title">Alerting and on-call workflows connected to datasource queries</h3>
              <p>
                Configure alerts tied to dashboard panels and investigate triggered conditions directly in Explore and
                dashboard views.
              </p>
            </article>
          </li>
          <li class="feature-card">
            <article aria-labelledby="feature-sso-title">
              <svg viewBox="0 0 24 24" role="img" aria-label="SSO icon">
                <path d="M7 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8zM17 21a4 4 0 1 0 0-8a4 4 0 0 0 0 8z" />
                <path d="M10.5 8.5l3 3M13.5 15.5l3-3" />
              </svg>
              <h3 id="feature-sso-title">Single Sign-On and role-based access control for organization security</h3>
              <p>
                Enable Google or Microsoft SSO, manage members and groups, and enforce admin, editor, and viewer
                permissions across teams.
              </p>
            </article>
          </li>
          <li class="feature-card">
            <article aria-labelledby="feature-themes-title">
              <svg viewBox="0 0 24 24" role="img" aria-label="Themes icon">
                <path d="M12 3a9 9 0 1 0 9 9a7 7 0 0 1-9-9z" />
              </svg>
              <h3 id="feature-themes-title">Customizable light and dark themes for day-shift and on-call use</h3>
              <p>
                Choose themes that fit your working environment while preserving visual clarity for dense metrics,
                logs, and tracing data.
              </p>
            </article>
          </li>
        </ul>
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

.features-grid {
  margin-top: 0.9rem;
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.feature-card {
  margin: 0;
}

.feature-card article {
  display: grid;
  gap: 0.55rem;
  height: 100%;
}

.feature-card article svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: var(--text-accent);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.feature-card article {
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  background: rgba(20, 32, 50, 0.75);
  padding: 0.9rem;
}

.feature-card h3 {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.35;
}

.feature-card p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

@media (max-width: 980px) {
  .features-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
