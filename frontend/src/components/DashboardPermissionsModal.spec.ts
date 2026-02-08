import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DashboardPermissionsModal from './DashboardPermissionsModal.vue'

const mockListDashboardPermissions = vi.hoisted(() => vi.fn())
const mockReplaceDashboardPermissions = vi.hoisted(() => vi.fn())
const mockListMembers = vi.hoisted(() => vi.fn())
const mockListGroups = vi.hoisted(() => vi.fn())

vi.mock('../api/permissions', () => ({
  listDashboardPermissions: mockListDashboardPermissions,
  replaceDashboardPermissions: mockReplaceDashboardPermissions,
}))

vi.mock('../api/organizations', () => ({
  listMembers: mockListMembers,
}))

vi.mock('../api/groups', () => ({
  listGroups: mockListGroups,
}))

const dashboard = {
  id: 'dashboard-1',
  title: 'Operations Overview',
  description: 'Main dashboard',
  organization_id: 'org-1',
  created_at: '2026-02-08T00:00:00Z',
  updated_at: '2026-02-08T00:00:00Z',
}

describe('DashboardPermissionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockListDashboardPermissions.mockResolvedValue([
      {
        principal_type: 'group',
        principal_id: 'group-1',
        permission: 'view',
      },
    ])
    mockListMembers.mockResolvedValue([
      {
        id: 'member-1',
        user_id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        created_at: '2026-02-08T00:00:00Z',
      },
      {
        id: 'member-2',
        user_id: 'user-2',
        email: 'editor@example.com',
        name: 'Editor User',
        role: 'editor',
        created_at: '2026-02-08T00:00:00Z',
      },
    ])
    mockListGroups.mockResolvedValue([
      {
        id: 'group-1',
        organization_id: 'org-1',
        name: 'SRE Team',
        description: null,
        created_by: 'user-1',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      },
    ])
    mockReplaceDashboardPermissions.mockResolvedValue([
      {
        principal_type: 'group',
        principal_id: 'group-1',
        permission: 'view',
      },
      {
        principal_type: 'user',
        principal_id: 'user-2',
        permission: 'edit',
      },
    ])
  })

  it('loads permissions, allows adding entries, and saves ACL updates', async () => {
    const wrapper = mount(DashboardPermissionsModal, {
      props: {
        dashboard,
        orgId: 'org-1',
      },
    })

    await flushPromises()

    expect(mockListDashboardPermissions).toHaveBeenCalledWith('dashboard-1')
    expect(mockListMembers).toHaveBeenCalledWith('org-1')
    expect(mockListGroups).toHaveBeenCalledWith('org-1')

    await wrapper.get('[data-testid="principal-type-select"]').setValue('user')
    await wrapper.get('[data-testid="principal-select"]').setValue('user-2')
    await wrapper.get('[data-testid="permission-select"]').setValue('edit')
    await wrapper.get('[data-testid="add-permission-entry"]').trigger('click')

    await wrapper.get('[data-testid="save-dashboard-permissions"]').trigger('click')
    await flushPromises()

    expect(mockReplaceDashboardPermissions).toHaveBeenCalledWith('dashboard-1', {
      entries: [
        {
          principal_type: 'group',
          principal_id: 'group-1',
          permission: 'view',
        },
        {
          principal_type: 'user',
          principal_id: 'user-2',
          permission: 'edit',
        },
      ],
    })

    expect(wrapper.text()).toContain('Dashboard permissions updated')
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('shows actionable validation when adding duplicate principals', async () => {
    const wrapper = mount(DashboardPermissionsModal, {
      props: {
        dashboard,
        orgId: 'org-1',
      },
    })

    await flushPromises()

    await wrapper.get('[data-testid="principal-type-select"]').setValue('group')
    await wrapper.get('[data-testid="principal-select"]').setValue('group-1')
    await wrapper.get('[data-testid="permission-select"]').setValue('admin')
    await wrapper.get('[data-testid="add-permission-entry"]').trigger('click')

    expect(wrapper.text()).toContain('This principal already has a permission entry')
    expect(mockReplaceDashboardPermissions).not.toHaveBeenCalled()
  })
})
