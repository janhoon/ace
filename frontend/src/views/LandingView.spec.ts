import { RouterLinkStub, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import LandingView from './LandingView.vue'

function mountLanding() {
  return mount(LandingView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  })
}

describe('LandingView', () => {
  afterEach(() => {
    document.head
      .querySelectorAll(
        'script[data-landing-faq-schema="true"], script[data-landing-features-schema="true"], script[data-landing-comparison-schema="true"], script[data-landing-breadcrumb-schema="true"]',
      )
      .forEach((schemaElement) => schemaElement.remove())
  })

  it('renders the primary SEO heading', () => {
    const wrapper = mountLanding()

    expect(wrapper.get('h1').text()).toBe(
      'Open-Source Monitoring Dashboard with Multi-Datasource Support',
    )

    wrapper.unmount()
  })

  it('renders hero CTAs and screenshot preview', () => {
    const wrapper = mountLanding()

    const getStartedLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.props('to') === '/login' && link.text() === 'Get Started')

    expect(getStartedLink).toBeDefined()
    expect(wrapper.get('.hero-actions a[href="#overview"]').text()).toBe('View Demo')
    expect(wrapper.get('.hero-actions a[href="https://github.com"]').text()).toBe('GitHub')
    expect(wrapper.get('img').attributes('src')).toBe('/images/landing-hero.webp')

    wrapper.unmount()
  })

  it('renders six feature cards in a semantic list', () => {
    const wrapper = mountLanding()

    const cards = wrapper.get('.features-grid').findAll('li.feature-card')

    expect(cards).toHaveLength(6)
    expect(wrapper.get('#feature-multi-datasource-title').text()).toContain(
      'Prometheus, Loki, Tempo, and VictoriaMetrics',
    )
    expect(wrapper.get('#feature-grafana-title').text()).toContain(
      'Grafana-compatible dashboard migration',
    )
    expect(wrapper.get('#feature-sso-title').text()).toContain(
      'Single Sign-On and role-based access control',
    )

    wrapper.unmount()
  })

  it('renders a semantic comparison table with ten feature rows', () => {
    const wrapper = mountLanding()

    const table = wrapper.get('#comparison table')
    const bodyRows = table.findAll('tbody tr')

    expect(table.get('caption').text()).toContain('Feature comparison')
    expect(table.findAll('thead th').map((element) => element.text())).toEqual([
      'Feature',
      'Dash',
      'Grafana',
    ])
    expect(bodyRows).toHaveLength(10)
    expect(bodyRows[0].find('th').attributes('scope')).toBe('row')
    expect(wrapper.text()).toContain('Dash vs Grafana comparison for self-hosted monitoring teams')

    wrapper.unmount()
  })

  it('adds FAQ schema to document head', () => {
    const wrapper = mountLanding()

    const schemaElement = document.head.querySelector('script[data-landing-faq-schema="true"]')

    expect(schemaElement).not.toBeNull()
    expect(schemaElement?.textContent).toContain('"@type":"FAQPage"')
    expect(schemaElement?.textContent).toContain('Which datasources does Dash support?')

    wrapper.unmount()

    expect(document.head.querySelector('script[data-landing-faq-schema="true"]')).toBeNull()
  })

  it('adds feature ItemList schema to document head', () => {
    const wrapper = mountLanding()

    const schemaElement = document.head.querySelector('script[data-landing-features-schema="true"]')

    expect(schemaElement).not.toBeNull()
    expect(schemaElement?.textContent).toContain('"@type":"ItemList"')
    expect(schemaElement?.textContent).toContain('"position":6')
    expect(schemaElement?.textContent).toContain('Flexible themes for operations teams')

    wrapper.unmount()

    expect(document.head.querySelector('script[data-landing-features-schema="true"]')).toBeNull()
  })

  it('adds comparison and breadcrumb schema to document head', () => {
    const wrapper = mountLanding()

    const comparisonSchema = document.head.querySelector('script[data-landing-comparison-schema="true"]')
    const breadcrumbSchema = document.head.querySelector('script[data-landing-breadcrumb-schema="true"]')

    expect(comparisonSchema).not.toBeNull()
    expect(comparisonSchema?.textContent).toContain('"@type":"Table"')
    expect(comparisonSchema?.textContent).toContain('Dash vs Grafana feature comparison')
    expect(breadcrumbSchema).not.toBeNull()
    expect(breadcrumbSchema?.textContent).toContain('"@type":"BreadcrumbList"')
    expect(breadcrumbSchema?.textContent).toContain('Dash vs Grafana Comparison')

    wrapper.unmount()

    expect(document.head.querySelector('script[data-landing-comparison-schema="true"]')).toBeNull()
    expect(document.head.querySelector('script[data-landing-breadcrumb-schema="true"]')).toBeNull()
  })
})
