// Path: src/app/types/team-management/work-items/work-item.types.ts
// ============================================================================
// WorkItem Types (Frontend Mirror) — DTO-safe contract
// ----------------------------------------------------------------------------
// Source of truth (backend):
// - src/types/teamManagement/workItem/workItem.types.ts
//
// Key rules
// - FE must NOT use mongoose Types.ObjectId
// - IDs are string
// - Dates arrive as ISO strings
// - exactOptionalPropertyTypes-safe: optional props should be omitted (not undefined)
// ============================================================================

export type ISODateString = string;

// ----------------------------------------------------------------------------
// Enums (const arrays -> strict unions without runtime enum cost)
// ----------------------------------------------------------------------------
export const WORK_ITEM_STATUS = [ "assigned", "in_progress", "blocked", "completed", "cancelled" ] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUS)[number];

export const WORK_ITEM_PRIORITY = [ "low", "medium", "high", "urgent" ] as const;
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITY)[number];

export const DEADLINE_POLICY = ["soft", "hard"] as const;
export type DeadlinePolicy = (typeof DEADLINE_POLICY)[number];

// ----------------------------------------------------------------------------
// Evidence (minimal mirror of backend evidence summary packets)
// ----------------------------------------------------------------------------
export interface WorkItemEvidenceDto {
  label: string;

  relPath: string; // "public/uploads/..."
  url: string;

  mimeType: string;
  originalName: string;
  sizeBytes: number;

  uploadedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Per-member progress summary
// ----------------------------------------------------------------------------
export interface WorkItemMemberProgressDto {
  userId: string;
  progress: number; // 0..100
  status: WorkItemStatus;
  lastActivityAt: ISODateString;
}

// ----------------------------------------------------------------------------
// Main WorkItem DTO (FE mirror of backend WorkItemDto; DTO-safe)
// ----------------------------------------------------------------------------
export interface WorkItemDto {
  _id: string;

  workItemCode: string;
  teamId: string;

  taskId?: string;

  assignedByUserId: string;
  assignedToUserIds: string[];
  assignedAt: ISODateString;

  expectedStartAt?: ISODateString;
  expectedCompleteAt: ISODateString;

  deadlinePolicy: DeadlinePolicy;
  graceMinutes?: number;

  statusCurrent: WorkItemStatus;
  priority: WorkItemPriority;

  progressCurrent: number;

  lastActivityAt?: ISODateString;
  completedAt?: ISODateString;
  completedByUserId?: string;

  memberProgress?: WorkItemMemberProgressDto[];
  completionEvidenceSummary?: WorkItemEvidenceDto[];

  createdByUserId: string;
  updatedByUserId?: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// REST inputs (keep separate from DTO)
// ----------------------------------------------------------------------------
export interface WorkItemCreateRequest {
  workItemCode: string;
  teamId: string;

  taskId?: string;

  assignedByUserId: string;
  assignedToUserIds: string[];

  assignedAt: ISODateString;

  expectedStartAt?: ISODateString;
  expectedCompleteAt: ISODateString;

  deadlinePolicy: DeadlinePolicy;
  graceMinutes?: number;

  statusCurrent: WorkItemStatus;
  priority: WorkItemPriority;

  progressCurrent?: number;
}

export interface WorkItemUpdateRequest {
  expectedStartAt?: ISODateString;
  expectedCompleteAt?: ISODateString;

  deadlinePolicy?: DeadlinePolicy;
  graceMinutes?: number;

  statusCurrent?: WorkItemStatus;
  priority?: WorkItemPriority;

  progressCurrent?: number;

  completedAt?: ISODateString;
  completedByUserId?: string;
}

// ----------------------------------------------------------------------------
// List / count filters (backend requires teamId in query)
// ----------------------------------------------------------------------------
export interface WorkItemListQuery {
  teamId: string;

  assignedToUserId?: string;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;

  dueFrom?: ISODateString;
  dueTo?: ISODateString;

  q?: string;

  page?: number;  // default 1
  limit?: number; // default 20
}

// ----------------------------------------------------------------------------
// Activity append (minimal; you can expand when you wire UI)
// ----------------------------------------------------------------------------
export interface WorkItemAppendActivityRequest {
  message: string;
  at?: ISODateString;
  progress?: number; // optional progress update
}
