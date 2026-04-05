import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SidebarUserMenu from './SidebarUserMenu.vue'

const mockUser = ref({ email: 'jane@example.com', name: 'Jane Doe' })
const mockLogout = vi.fn()
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}))

vi.mock('../composables/useClickOutside', () => ({
  useClickOutside: vi.fn(),
}))

vi.mock('../composables/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    showHelp: ref(false),
  }),
}))

describe('SidebarUserMenu', () => {
  let wrapper: VueWrapper

  function createWrapper() {
    return mount(SidebarUserMenu, {
      props: { isOpen: true },
      global: {
        stubs: {
          LogOut: { template: '<span class="icon-logout" />' },
          Keyboard: { template: '<span class="icon-keyboard" />' },
        },
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.value = { email: 'jane@example.com', name: 'Jane Doe' }
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('shows user name and email', () => {
    wrapper = createWrapper()
    const text = wrapper.text()
    expect(text).toContain('Jane Doe')
    expect(text).toContain('jane@example.com')
  })

  it('calls logout when logout button is clicked', async () => {
    wrapper = createWrapper()
    await wrapper.find('[data-testid="user-menu-logout"]').trigger('click')
    expect(mockLogout).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', () => {
    wrapper = mount(SidebarUserMenu, {
      props: { isOpen: false },
    })
    expect(wrapper.find('[data-testid="user-menu"]').exists()).toBe(false)
  })

  it('renders keyboard shortcuts link', () => {
    wrapper = createWrapper()
    expect(wrapper.find('[data-testid="user-menu-shortcuts"]').exists()).toBe(true)
  })

  it('closes on Escape key', async () => {
    wrapper = createWrapper()
    await wrapper.find('[data-testid="user-menu"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
