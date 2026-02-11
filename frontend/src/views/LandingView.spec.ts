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
      .querySelectorAll('script[data-landing-faq-schema="true"]')
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

  it('adds FAQ schema to document head', () => {
    const wrapper = mountLanding()

    const schemaElement = document.head.querySelector('script[data-landing-faq-schema="true"]')

    expect(schemaElement).not.toBeNull()
    expect(schemaElement?.textContent).toContain('"@type":"FAQPage"')
    expect(schemaElement?.textContent).toContain('Which datasources does Dash support?')

    wrapper.unmount()

    expect(document.head.querySelector('script[data-landing-faq-schema="true"]')).toBeNull()
  })
})
