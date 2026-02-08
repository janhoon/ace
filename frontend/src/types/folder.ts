export interface Folder {
  id: string
  organization_id: string
  parent_id: string | null
  name: string
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateFolderRequest {
  name: string
  parent_id?: string
  sort_order?: number
}

export interface UpdateFolderRequest {
  name?: string
  parent_id?: string
  sort_order?: number
}
