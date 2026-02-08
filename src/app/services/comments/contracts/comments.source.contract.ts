// Path: src/app/service/comments/contracts/comments.source.contract.ts
// ============================================================================
// PropEase FE — Comment Target Registry (Frontend Source of Truth)
// ----------------------------------------------------------------------------
// ✅ Defines FE-known targets
// ✅ Validates section/subSection/refId at runtime
// ✅ Builds CommentTargetDto that matches backend rules
// ✅ exactOptionalPropertyTypes-safe (omit optionals when empty)
// ============================================================================

import type {
  CommentSectionKey,
  CommentSubSection,
  CommentTargetDto,
  CommentSubSectionKey,
} from "./comment.contract";

import {
  CommentSectionKeyValues,
  CommentSubSectionKeyValues,
} from "./comment.contract";

/* ========================================================================== *
 * 1) REF-ID RULES
 * ========================================================================== */

export interface RefIdRule {
  label: string;
  fieldHint: string;
  example: string;

  regex?: RegExp;
  notes?: string;
}

/* ========================================================================== *
 * 2) TARGET SOURCE ENTRY (FE metadata only)
 * ========================================================================== */

export interface CommentTargetSourceFe {
  section: CommentSectionKey;

  /**
   * Only Teams section uses subSection.
   * - Non-Teams => absent
   * - Teams => present in each Teams-related source entry
   */
  subSection?: CommentSubSection;

  refId: RefIdRule;

  uiRouteTemplate?: string;
  apiRouteTemplate?: string;

  meta?: Record<string, unknown>;
}

/* ========================================================================== *
 * 3) REGISTRY
 * ========================================================================== */

export class CommentsSourceRegistryFe {
  // =========================================================================
  // 3.1) CANONICAL SOURCE LIST
  // =========================================================================

  private static readonly SOURCES: ReadonlyArray<CommentTargetSourceFe> = [
    {
      section: "Users",
      refId: {
        label: "Username (business key)",
        fieldHint: "username",
        example: "john_doe",
        regex: /^[a-z0-9._-]{2,64}$/i,
      },
      uiRouteTemplate: "/dashboard/users/user-profile/:refId",
    },
    {
      section: "Properties",
      refId: {
        label: "Property business id",
        fieldHint: "id",
        example: "PROP-MKF8KHPM-3USA3L",
        regex: /^[a-z0-9][a-z0-9._-]{2,80}$/i,
      },
      uiRouteTemplate: "/dashboard/properties/view/:refId",
    },
    {
      section: "Complaints",
      refId: {
        label: "Complaint code",
        fieldHint: "code",
        example: "CMP-2026-000124",
        regex: /^[a-z0-9][a-z0-9._-]{2,80}$/i,
      },
      uiRouteTemplate: "/dashboard/complaints/view/:refId",
    },
    {
      section: "Tenants",
      refId: {
        label: "Tenant username",
        fieldHint: "username",
        example: "tenant_sahan",
        regex: /^[a-z0-9._-]{2,64}$/i,
      },
      uiRouteTemplate: "/dashboard/tenants/view/:refId",
    },
    {
      section: "Leases",
      refId: {
        label: "Lease business id",
        fieldHint: "leaseID",
        example: "LEASE-MKF8KHPM-3USA3L",
        regex: /^[a-z0-9][a-z0-9._-]{2,80}$/i,
      },
      uiRouteTemplate: "/dashboard/leases/view/:refId",
    },

    // Teams (team itself)
    {
      section: "Teams",
      subSection: "Teams",
      refId: {
        label: "Team code",
        fieldHint: "teamCode",
        example: "TEAM-MKF8KHPM",
        regex: /^[a-z0-9][a-z0-9._-]{2,80}$/i,
      },
      uiRouteTemplate: "/dashboard/team-management/team/:refId",
      meta: { teamsSubSectionIsRequired: true },
    },

    // Teams → WorkItems
    {
      section: "Teams",
      subSection: "WorkItems",
      refId: {
        label: "WorkItem business id",
        fieldHint: "id",
        example: "WORK-2026-000245",
        regex: /^[a-z0-9][a-z0-9._-]{2,80}$/i,
      },
      uiRouteTemplate: "/dashboard/team-management/work-items/view/:refId",
    },

    // Teams → Events
    {
      section: "Teams",
      subSection: "Events",
      refId: {
        label: "WorkEvent ObjectId string",
        fieldHint: "_id",
        example: "66b1c2d3e4f5a6b7c8d9e0f1",
        regex: /^[a-f0-9]{24}$/i,
      },
      uiRouteTemplate: "/dashboard/team-management/events/view/:refId",
    },
  ];

  // =========================================================================
  // 3.2) PRECOMPUTED LISTS
  // =========================================================================

  private static readonly SECTIONS: ReadonlyArray<CommentSectionKey> = CommentSectionKeyValues;

  private static readonly TEAM_SUBSECTIONS: ReadonlyArray<CommentSubSectionKey> =
    CommentSubSectionKeyValues;

  // =========================================================================
  // 3.3) PUBLIC READ
  // =========================================================================

  public static getAllSources(): ReadonlyArray<CommentTargetSourceFe> {
    return this.SOURCES;
  }

  public static getAllSections(): ReadonlyArray<CommentSectionKey> {
    return this.SECTIONS;
  }

  public static getTeamSubSections(): ReadonlyArray<CommentSubSectionKey> {
    return this.TEAM_SUBSECTIONS;
  }

  // =========================================================================
  // 3.4) NORMALIZATION / VALIDATION
  // =========================================================================

  public static normalizeSection(input: unknown): CommentSectionKey {
    const raw = String(input ?? "").trim();
    if (!raw) {
      throw new Error("[Error:] [CommentsSourceRegistryFe] section is required.\n");
    }

    for (const s of this.SECTIONS) {
      if (s.toLowerCase() === raw.toLowerCase()) return s;
    }

    throw new Error(
      `[Error:] [CommentsSourceRegistryFe] Invalid section "${raw}". Allowed: ${this.SECTIONS.join(", ")}\n`,
    );
  }

  public static normalizeSubSection(
    section: CommentSectionKey,
    input: unknown,
  ): CommentSubSectionKey | undefined {
    if (section !== "Teams") return undefined;

    const raw = String(input ?? "").trim();
    if (!raw) {
      throw new Error("[Error:] [CommentsSourceRegistryFe] subSection is required for Teams.\n");
    }

    for (const s of this.TEAM_SUBSECTIONS) {
      if (s.toLowerCase() === raw.toLowerCase()) return s;
    }

    throw new Error(
      `[Error:] [CommentsSourceRegistryFe] Invalid Teams subSection "${raw}". Allowed: ${this.TEAM_SUBSECTIONS.join(", ")}\n`,
    );
  }

  public static normalizeRefId(input: unknown): string {
    const refId = String(input ?? "").trim();
    if (!refId) {
      throw new Error("[Error:] [CommentsSourceRegistryFe] refId is required.\n");
    }
    return refId;
  }

  public static resolveSource(
    sectionInput: unknown,
    subSectionInput: unknown,
  ): CommentTargetSourceFe {
    const section = this.normalizeSection(sectionInput);
    const subSection = this.normalizeSubSection(section, subSectionInput);

    const source = this.findSourceInternal(section, subSection);
    if (!source) {
      throw new Error(
        `[Error:] [CommentsSourceRegistryFe] No target source found for "${this.buildKey(section, subSection)}".\n`,
      );
    }

    return source;
  }

  public static validateTargetOrThrow(target: {
    section: unknown;
    subSection?: unknown;
    refId: unknown;
  }): {
    section: CommentSectionKey;
    subSection: CommentSubSectionKey | undefined;
    refId: string;
    source: CommentTargetSourceFe;
  } {
    const section = this.normalizeSection(target.section);
    const subSection = this.normalizeSubSection(section, target.subSection);
    const refId = this.normalizeRefId(target.refId);

    const source = this.findSourceInternal(section, subSection);
    if (!source) {
      throw new Error(
        `[Error:] [CommentsSourceRegistryFe] Unsupported target "${this.buildKey(section, subSection)}".\n`,
      );
    }

    if (source.refId.regex && !source.refId.regex.test(refId)) {
      throw new Error(
        `[Error:] [CommentsSourceRegistryFe] Invalid refId "${refId}" for ${this.buildKey(section, subSection)}. Expected: ${source.refId.label} (${source.refId.fieldHint}).\n`,
      );
    }

    return { section, subSection, refId, source };
  }

  // =========================================================================
  // 3.5) BUILDERS (produce CommentTargetDto safely)
  // =========================================================================

  public static buildTarget(input: {
    section: CommentSectionKey;
    subSection?: CommentSubSectionKey;
    refId: string;

    module?: string;
    scope?: Record<string, unknown> | null;
    modelName?: string;
  }): CommentTargetDto {
    const validated = this.validateTargetOrThrow({
      section: input.section,
      subSection: input.subSection,
      refId: input.refId,
    });

    const base = this.buildBase(validated.refId, input.module, input.scope, input.modelName);

    if (validated.section !== "Teams") {
      // Non-team: subSection forbidden by union (`never`)
      const out: Record<string, unknown> = {
        section: validated.section,
        refId: base.refId,
      };

      if (base.module) out["module"] = base.module;
      if (base.scope !== undefined) out["scope"] = base.scope; // allow explicit null
      if (base.modelName) out["modelName"] = base.modelName;

      return out as CommentTargetDto;
    }

    // Teams: subSection required (validated)
    const out: Record<string, unknown> = {
      section: "Teams",
      subSection: validated.subSection as CommentSubSectionKey,
      refId: base.refId,
    };

    if (base.module) out["module"] = base.module;
    if (base.scope !== undefined) out["scope"] = base.scope;
    if (base.modelName) out["modelName"] = base.modelName;

    return out as CommentTargetDto;
  }

  // =========================================================================
  // 3.6) INTERNALS
  // =========================================================================

  private static findSourceInternal(
    section: CommentSectionKey,
    subSection?: CommentSubSectionKey,
  ): CommentTargetSourceFe | undefined {
    if (section !== "Teams") {
      return this.SOURCES.find(s => s.section === section && !s.subSection);
    }
    return this.SOURCES.find(s => s.section === "Teams" && s.subSection === subSection);
  }

  private static buildKey(section: CommentSectionKey, subSection?: CommentSubSectionKey): string {
    if (section !== "Teams") return section;
    return `Teams/${String(subSection ?? "")}`;
  }

  private static buildBase(
    refId: string,
    module?: string,
    scope?: Record<string, unknown> | null,
    modelName?: string,
  ): {
    refId: string;
    module?: string;
    scope?: Record<string, unknown> | null;
    modelName?: string;
  } {
    const safeRefId = String(refId ?? "").trim();
    if (!safeRefId) {
      throw new Error("[Error:] [CommentsSourceRegistryFe] refId is required.\n");
    }

    const safeModule = String(module ?? "").trim();
    const safeModelName = String(modelName ?? "").trim();

    const base: {
      refId: string;
      module?: string;
      scope?: Record<string, unknown> | null;
      modelName?: string;
    } = { refId: safeRefId };

    if (safeModule) base.module = safeModule;

    // allow explicit null, or omit entirely
    if (scope !== undefined) base.scope = scope;

    if (safeModelName) base.modelName = safeModelName;

    return base;
  }
}
