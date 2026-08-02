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
