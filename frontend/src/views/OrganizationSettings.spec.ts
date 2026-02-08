import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OrganizationSettings from './OrganizationSettings.vue'

const mockRouteParams = { id: 'org-1' }
const mockPush = vi.fn()
const mockBack = vi.fn()

const mockFetchOrganizations = vi.hoisted(() => vi.fn())

const mockGetOrganization = vi.hoisted(() => vi.fn())
const mockUpdateOrganization = vi.hoisted(() => vi.fn())
const mockDeleteOrganization = vi.hoisted(() => vi.fn())
const mockListMembers = vi.hoisted(() => vi.fn())
const mockCreateInvitation = vi.hoisted(() => vi.fn())
const mockUpdateMemberRole = vi.hoisted(() => vi.fn())
const mockRemoveMember = vi.hoisted(() => vi.fn())

const mockListGroups = vi.hoisted(() => vi.fn())
const mockCreateGroup = vi.hoisted(() => vi.fn())
const mockUpdateGroup = vi.hoisted(() => vi.fn())
const mockDeleteGroup = vi.hoisted(() => vi.fn())
const mockListGroupMembers = vi.hoisted(() => vi.fn())
const mockAddGroupMember = vi.hoisted(() => vi.fn())
const mockRemoveGroupMember = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mockRouteParams }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

vi.mock('../composables/useOrganization', () => ({
  useOrganization: () => ({
    fetchOrganizations: mockFetchOrganizations,
  }),
}))

vi.mock('../api/organizations', () => ({
  getOrganization: mockGetOrganization,
  updateOrganization: mockUpdateOrganization,
  deleteOrganization: mockDeleteOrganization,
  listMembers: mockListMembers,
  createInvitation: mockCreateInvitation,
  updateMemberRole: mockUpdateMemberRole,
  removeMember: mockRemoveMember,
}))

vi.mock('../api/groups', () => ({
  listGroups: mockListGroups,
  createGroup: mockCreateGroup,
  updateGroup: mockUpdateGroup,
  deleteGroup: mockDeleteGroup,
  listGroupMembers: mockListGroupMembers,
  addGroupMember: mockAddGroupMember,
  removeGroupMember: mockRemoveGroupMember,
}))

const baseOrg = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  role: 'admin',
  created_at: '2026-02-08T00:00:00Z',
  updated_at: '2026-02-08T00:00:00Z',
}

const baseMembers = [
  {
    id: 'mem-1',
    user_id: 'user-1',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'admin',
    created_at: '2026-02-08T00:00:00Z',
  },
  {
    id: 'mem-2',
    user_id: 'user-2',
    email: 'editor@example.com',
    name: 'Editor',
    role: 'editor',
    created_at: '2026-02-08T00:00:00Z',
  },
]

const baseGroup = {
  id: 'group-1',
  organization_id: 'org-1',
  name: 'Platform Team',
  description: 'Infra owners',
  created_by: 'user-1',
  created_at: '2026-02-08T00:00:00Z',
  updated_at: '2026-02-08T00:00:00Z',
}

describe('OrganizationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetOrganization.mockResolvedValue({ ...baseOrg })
    mockUpdateOrganization.mockResolvedValue({ ...baseOrg })
    mockDeleteOrganization.mockResolvedValue(undefined)
    mockListMembers.mockResolvedValue([...baseMembers])
    mockCreateInvitation.mockResolvedValue({ token: 'abc' })
    mockUpdateMemberRole.mockResolvedValue(undefined)
    mockRemoveMember.mockResolvedValue(undefined)

    mockListGroups.mockResolvedValue([{ ...baseGroup }])
    mockCreateGroup.mockResolvedValue({ ...baseGroup })
    mockUpdateGroup.mockResolvedValue({ ...baseGroup, name: 'Renamed Team' })
    mockDeleteGroup.mockResolvedValue(undefined)
    mockListGroupMembers.mockResolvedValue([
      {
        id: 'membership-1',
        organization_id: 'org-1',
        group_id: 'group-1',
        user_id: 'user-1',
        email: 'owner@example.com',
        name: 'Owner',
        created_at: '2026-02-08T00:00:00Z',
        updated_at: '2026-02-08T00:00:00Z',
      },
    ])
    mockAddGroupMember.mockResolvedValue({})
    mockRemoveGroupMember.mockResolvedValue(undefined)

    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('alert', vi.fn(() => undefined))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lets admins create, rename, delete groups and manage memberships', async () => {
    const wrapper = mount(OrganizationSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('Groups (1)')
    expect(wrapper.text()).toContain('Platform Team')

    await wrapper.get('[data-testid="new-group-button"]').trigger('click')
    await wrapper.get('[data-testid="create-group-name"]').setValue('SRE Team')
    await wrapper.get('[data-testid="create-group-description"]').setValue('Reliability')
    await wrapper.get('[data-testid="create-group-submit"]').trigger('click')
    await flushPromises()

    expect(mockCreateGroup).toHaveBeenCalledWith('org-1', {
      name: 'SRE Team',
      description: 'Reliability',
    })

    await wrapper.get('[data-testid="rename-group-group-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-group-name"]').setValue('Renamed Team')
    await wrapper.get('[data-testid="save-group-group-1"]').trigger('click')
    await flushPromises()

    expect(mockUpdateGroup).toHaveBeenCalledWith('org-1', 'group-1', {
      name: 'Renamed Team',
      description: 'Infra owners',
    })

    await wrapper.get('[data-testid="toggle-group-members-group-1"]').trigger('click')
    await flushPromises()

    expect(mockListGroupMembers).toHaveBeenCalledWith('org-1', 'group-1')

    await wrapper.get('[data-testid="add-member-select-group-1"]').setValue('user-2')
    await wrapper.get('[data-testid="add-member-button-group-1"]').trigger('click')
    await flushPromises()

    expect(mockAddGroupMember).toHaveBeenCalledWith('org-1', 'group-1', { user_id: 'user-2' })

    await wrapper.get('[data-testid="remove-member-group-1-user-1"]').trigger('click')
    await flushPromises()

    expect(mockRemoveGroupMember).toHaveBeenCalledWith('org-1', 'group-1', 'user-1')

    await wrapper.get('[data-testid="delete-group-group-1"]').trigger('click')
    await flushPromises()

    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'group-1')
  })

  it('shows read-only groups UI for non-admin members', async () => {
    mockGetOrganization.mockResolvedValueOnce({
      ...baseOrg,
      role: 'viewer',
    })

    const wrapper = mount(OrganizationSettings)
    await flushPromises()

    expect(wrapper.find('[data-testid="new-group-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rename-group-group-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-group-group-1"]').exists()).toBe(false)

    await wrapper.get('[data-testid="toggle-group-members-group-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="add-member-button-group-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remove-member-group-1-user-1"]').exists()).toBe(false)
  })

  it('shows empty and error states for groups section', async () => {
    mockListGroups.mockResolvedValueOnce([])

    const emptyWrapper = mount(OrganizationSettings)
    await flushPromises()

    expect(emptyWrapper.text()).toContain('No groups yet.')

    mockListGroups.mockRejectedValueOnce(new Error('Failed to fetch groups'))
    const errorWrapper = mount(OrganizationSettings)
    await flushPromises()

    expect(errorWrapper.text()).toContain('Failed to fetch groups')
  })
})
