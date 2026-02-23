// Path: src/app/types/team-management/team-main/team-management.types.ts
// =============================================================================
// Team Management — Types & Contracts (NO TASKS HERE) (FE ↔ BE aligned)
// -----------------------------------------------------------------------------
// Mirrors backend:
//   src/types/teamManagement/teamMain/teamManagement.types.ts
//
// ✅ Purpose:
// - Keep Team domain types stable and reusable
// - Remove task-related types from TeamMain
// - TeamTask module becomes the single source-of-truth for tasks
//
// Rules:
// - FE uses string IDs (no ObjectId)
// - Dates are ISODateString
// - Optional fields are OMITTED (never `undefined`)
// =============================================================================

import type { User } from "../../../services/APIs/apis.service";
import type { ISODateString } from "../../common";

// ─────────────────────────────────────────────
// Domains
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Organization unit type
// ─────────────────────────────────────────────

export type OrgUnitType = "team" | "department" | "squad" | "board";

// ─────────────────────────────────────────────
// Roles inside a team
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// File meta (team-only)
// ─────────────────────────────────────────────

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
  uploadedByUsername?: User["username"];
  uploadedAt?: ISODateString;
}

// ─────────────────────────────────────────────
// Member structures
// ─────────────────────────────────────────────

export type UserTeams = {
  teamName: TeamManagementBaseDto["teamName"];
  domain: TeamDomain;
};

export interface TeamMemberDto {
  id: string;
  username: User["username"];

  // Optional enrich fields from pipelines
  user?: User | null;
  teams?: UserTeams[] | null;

  roleInTeam?: RoleInTeam | null;
  reason?: string | null;
  joinedAt?: ISODateString | null;

  // denormalized snapshot for quick UI
  domain?: TeamDomain | null;
  teamName?: TeamManagementBaseDto["teamName"] | null;
  teamReason?: string | null;
}

// ─────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────

export interface TeamAuditMetaDto {
  createdByUserId?: string;
  createdByUsername?: User["username"];

  lastUpdatedByUserId?: string;
  lastUpdatedByUsername?: User["username"];

  lastActivityAt?: ISODateString;
}

// ─────────────────────────────────────────────
// Root team entity (NO TASKS HERE)
// ─────────────────────────────────────────────

export interface TeamManagementBaseDto {
  teamMongoId: string; // FE replacement for backend _id

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

/**
 * Canonical DTO for FE usage.
 * Backend uses `_id`; FE uses `teamMongoId`.
 * Your controller should map:
 *   teamMongoId: String(doc._id)
 */
export type TeamManagementDto = TeamManagementBaseDto;

// Optional helper type you used earlier
export interface UserWithTeams extends User {
  teams?: UserTeams[];
}
