import { RouterLinkStub, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
  it('renders the primary SEO heading', () => {
    const wrapper = mountLanding()

    expect(wrapper.get('h1').text()).toBe(
      'Open-Source Monitoring Dashboard with Multi-Datasource Support',
    )
  })

  it('includes CTA to authenticated app shell', () => {
    const wrapper = mountLanding()

    const appLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.props('to') === '/app/dashboards')

    expect(appLink).toBeDefined()
  })
})
