import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Sidebar from './Sidebar.vue'

const mockPush = vi.fn()
const mockCurrentOrg = ref({ id: 'org-1' })
const mockUser = ref({ email: 'user@example.com' })

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/app/dashboards',
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({
    fetchOrganizations: vi.fn(),
    clearOrganizations: vi.fn(),
    currentOrg: mockCurrentOrg,
  }),
}))

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: mockUser,
  }),
}))

describe('Sidebar', () => {
  const originalInnerWidth = window.innerWidth

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    })
  })

  it('keeps toggle button in collapsed header layout', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1000,
    })

    const wrapper = mount(Sidebar, {
      global: {
        stubs: {
          OrganizationDropdown: true,
          CreateOrganizationModal: true,
        },
      },
    })

    expect(wrapper.get('.sidebar').classes()).not.toContain('expanded')
    expect(wrapper.get('.sidebar-header').classes()).toContain('collapsed')

    await wrapper.get('.toggle-btn').trigger('click')

    expect(wrapper.get('.sidebar').classes()).toContain('expanded')
    expect(wrapper.get('.sidebar-header').classes()).not.toContain('collapsed')
  })

  it('temporarily expands when hovered while collapsed', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1000,
    })

    const wrapper = mount(Sidebar, {
      global: {
        stubs: {
          OrganizationDropdown: true,
          CreateOrganizationModal: true,
        },
      },
    })

    expect(wrapper.get('.sidebar').classes()).not.toContain('expanded')

    await wrapper.get('.sidebar').trigger('mouseenter')

    expect(wrapper.get('.sidebar').classes()).toContain('expanded')
    expect(wrapper.get('.sidebar-header').classes()).not.toContain('collapsed')

    await wrapper.get('.sidebar').trigger('mouseleave')

    expect(wrapper.get('.sidebar').classes()).not.toContain('expanded')
    expect(wrapper.get('.sidebar-header').classes()).toContain('collapsed')
  })
})
