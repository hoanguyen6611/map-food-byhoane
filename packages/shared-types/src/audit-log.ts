// Admin Dashboard's "Hoạt động gần đây" feed — a thin read view over
// `AuditLogService.record()`'s append-only rows (backend/src/modules/admin/
// audit-log.service.ts). `action`/`targetType` are free-form strings set by
// each call site (e.g. "restaurant.create", "moderation.approved") — admin-web
// maps them to Vietnamese labels itself, same convention as ModerationDecision
// display labels.
export interface AuditLogEntryDto {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}
