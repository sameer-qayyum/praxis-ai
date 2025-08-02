// Permission levels enum for app access
export enum PermissionLevel {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin',
}

// Interfaces for app permissions
export interface AppPermission {
  id: string;
  app_id: string;
  user_id: string;
  permission_level: PermissionLevel;
  created_by: string;
  created_at: string;
  updated_at: string;
}
