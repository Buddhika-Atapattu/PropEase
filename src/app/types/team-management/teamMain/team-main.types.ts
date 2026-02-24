// Path: src/app/types/team-management/teamMain/team-main.types.ts
// ============================================================================
// Team MAIN — Frontend Types (FE mirror of backend TeamManagementDto)
// ----------------------------------------------------------------------------
// - No mongoose Types in FE
// - IDs are string
// - Optional props must be OMITTED (do NOT set `undefined`)
// ============================================================================

import { ISODateString } from "../../common";

// ----------------------------------------------------------------------------
// Domains
// ----------------------------------------------------------------------------
export const TEAM_DOMAINS = [
  "sales",
  "development",
  "support",
  "operations",
  "marketing",
  "finance",
  "other",
] as const;

export type TeamDomain = (typeof TEAM_DOMAINS)[number];

// ----------------------------------------------------------------------------
// Organization unit type
// ----------------------------------------------------------------------------
export type OrgUnitType = "team" | "department" | "squad" | "board";

// ----------------------------------------------------------------------------
// Roles inside a team
// ----------------------------------------------------------------------------
export const TEAM_ROLES = [
  "captain",
  "member",
  "lead",
  "supervisor",
  "observer",
  "mechanic",
  "carpenter",
  "electrician",
  "plumber",
  "technician",
  "welder",
  "driver",
  "cleaner",
  "security",
  "gardener",
  "painter",
  "mason",
  "helper",
] as const;

export type RoleInTeam = (typeof TEAM_ROLES)[number];

// ----------------------------------------------------------------------------
// Minimal user snapshot (avoid coupling to User module DTO-heavy types)
// ----------------------------------------------------------------------------
export interface TeamUserMiniDto {
  userId: string;
  username: string;

  // Optional enrich fields (UI convenience)
  displayName?: string;
  email?: string;
  photoUrl?: string;
}

// ----------------------------------------------------------------------------
// Logo / file meta (team-only)
// ----------------------------------------------------------------------------
export interface FileMetaBase {
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
}

export interface TeamLogoMeta {
  name: string;

  file?: FileMetaBase;
  url?: string;
  storageKey?: string;

  uploadedById?: string;
  uploadedByUsername?: string;
  uploadedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// Member structures
// ----------------------------------------------------------------------------
export interface UserTeamsDto {
  teamName: string;
  domain: TeamDomain;
}

export interface TeamMemberDto {
  id: string;
  username: string;

  // Optional enrich fields (from pipelines)
  user?: TeamUserMiniDto | null;
  teams?: UserTeamsDto[] | null;

  roleInTeam?: RoleInTeam | null;
  reason?: string | null;
  joinedAt?: ISODateString | null;

  // denormalized snapshot for quick UI
  domain?: TeamDomain | null;
  teamName?: string | null;
  teamReason?: string | null;
}

// ----------------------------------------------------------------------------
// Audit
// ----------------------------------------------------------------------------
export interface TeamAuditMetaDto {
  createdByUserId?: string;
  createdByUsername?: string;

  lastUpdatedByUserId?: string;
  lastUpdatedByUsername?: string;

  lastActivityAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// Root team entity (NO TASKS HERE)
// ----------------------------------------------------------------------------
export interface TeamMainDto {
  _id: string;
  teamCode: string;
  teamName: string;

  orgType?: OrgUnitType;
  domain: TeamDomain;

  description: string;

  members: TeamMemberDto[];
  captain: TeamMemberDto;

  memberTotal: number;

  teamLogo?: TeamLogoMeta;

  createdAt: ISODateString;
  updatedAt: ISODateString;

  isActive?: boolean;
  audit?: TeamAuditMetaDto;
}

// ----------------------------------------------------------------------------
// REST payloads (keep separate from DTO)
// ----------------------------------------------------------------------------
export interface TeamMainCreateRequest {
  teamCode: string;
  teamName: string;
  domain: TeamDomain;
  description: string;

  orgType?: OrgUnitType;

  // If your backend supports these on create (optional)
  captainUsername?: string;
  memberUsernames?: string[];
}

export interface TeamMainUpdateRequest {
  teamName?: string;
  domain?: TeamDomain;
  description?: string;
  orgType?: OrgUnitType;
  isActive?: boolean;

  // Optional member operations if supported by your controller update()
  captainUsername?: string;
  memberUsernames?: string[];
}

export interface TeamUsersQuery {
  domain?: TeamDomain;
}

// ----------------------------------------------------------------------------
// Generic API response shape (matches your ApiResponseBuilder style)
// ----------------------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  message: string;

  data?: T;
  other?: {
    total?: number;
    [k: string]: unknown;
  };

  error?: {
    code?: string;
    details?: unknown;
  };
}
