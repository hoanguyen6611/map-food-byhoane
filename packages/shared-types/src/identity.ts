// Mirrors docs/06-database-erd.md §2 (Identity & Access). Auth endpoints/DTOs
// are added by build-prompts/02-auth.md — this module only defines the enums
// needed so other modules can reference roles without a circular dependency.

export type RoleCode = 'guest' | 'user' | 'moderator' | 'admin' | 'owner';

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface RoleDto {
  id: string;
  code: RoleCode;
  label: string;
}

// Admin User Management — docs/01-prd-mvp.md §10.11 ("manage users
// (suspend/ban)"), added in docs/build-prompts/08-favorites-notifications-polish.md
// as a gap-fix: no earlier build-prompt module (1-8) actually implemented
// this despite it being explicit MVP scope. API-only for now — see
// backend/src/modules/admin/admin-user.controller.ts's doc comment.
export interface AdminUserListItemDto {
  id: string;
  email: string;
  displayName: string | null;
  roleCode: RoleCode;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UpdateUserRoleRequest {
  roleCode: RoleCode;
}

// Screen 33's "detail hoạt động" panel (docs/04-screen-list.md §33) — the
// list endpoint stays lightweight (AdminUserListItemDto); this is fetched
// only when an admin opens one user's detail view.
export interface AdminUserDetailDto extends AdminUserListItemDto {
  reviewCount: number;
  // Reports filed against this user's reviews — Report has no direct 'user'
  // target type (see ReportTargetType), so this is derived server-side by
  // joining through the user's own reviews.
  reportsReceivedCount: number;
}
