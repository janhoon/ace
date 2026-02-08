export type PrincipalType = 'user' | 'group'

export type ResourcePermissionLevel = 'view' | 'edit' | 'admin'

export interface UserGroup {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateUserGroupRequest {
  name: string
  description?: string
}

export interface UpdateUserGroupRequest {
  name?: string
  description?: string
}

export interface UserGroupMembership {
  id: string
  organization_id: string
  group_id: string
  user_id: string
  email: string
  name: string | null
  created_at: string
  updated_at: string
}

export interface AddUserGroupMemberRequest {
  user_id: string
}

export interface ResourcePermissionEntry {
  principal_type: PrincipalType
  principal_id: string
  permission: ResourcePermissionLevel
}

export interface ReplaceResourcePermissionsRequest {
  entries: ResourcePermissionEntry[]
}
