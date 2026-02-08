// Path: src/app/services/comments/contracts/comment.contract.helper.ts
// ============================================================================
// PropEase FE — Comment Contract Helpers (NO TYPES REDEFINED)
// ----------------------------------------------------------------------------
// ✅ Helpers only (runtime validation / normalization / parsing).
// ❌ DO NOT declare CommentDto / CommentTargetDto / etc here.
// ============================================================================

import type {
  CommentAudience,
  CommentSectionKey,
  CommentSubSectionKey,
  CommentTargetDto,
  CommentTargetPeekDto,
} from "./comment.contract";

import {
  CommentAudienceValues,
  CommentSectionKeyValues,
  CommentSubSectionKeyValues,
} from "./comment.contract";

/* ========================================================================== *
 * 1) SIMPLE GUARDS
 * ========================================================================== */

export function isCommentSectionKey(x: unknown): x is CommentSectionKey {
  if (typeof x !== "string") return false;
  const raw = x.trim().toLowerCase();
  return CommentSectionKeyValues.some(v => v.toLowerCase() === raw);
}

export function isCommentSubSectionKey(x: unknown): x is CommentSubSectionKey {
  if (typeof x !== "string") return false;
  const raw = x.trim().toLowerCase();
  return CommentSubSectionKeyValues.some(v => v.toLowerCase() === raw);
}

export function isCommentAudience(x: unknown): x is CommentAudience {
  if (typeof x !== "string") return false;
  const raw = x.trim().toLowerCase();
  return (CommentAudienceValues as readonly string[]).some(v => v.toLowerCase() === raw);
}

/* ========================================================================== *
 * 2) NORMALIZERS (throwing)
 * ========================================================================== */

export function normalizeCommentSectionKey(input: unknown): CommentSectionKey {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("[Error:] [CommentContractHelper] section is required.\n");

  const found = CommentSectionKeyValues.find(v => v.toLowerCase() === raw.toLowerCase());
  if (!found) {
    throw new Error(
      `[Error:] [CommentContractHelper] Invalid section "${raw}". Allowed: ${CommentSectionKeyValues.join(", ")}\n`,
    );
  }
  return found;
}

export function normalizeTeamsSubSectionOrThrow(input: unknown): CommentSubSectionKey {
  const raw = String(input ?? "").trim();
  if (!raw) {
    throw new Error("[Error:] [CommentContractHelper] subSection is required for Teams.\n");
  }

  const found = CommentSubSectionKeyValues.find(v => v.toLowerCase() === raw.toLowerCase());
  if (!found) {
    throw new Error(
      `[Error:] [CommentContractHelper] Invalid Teams subSection "${raw}". Allowed: ${CommentSubSectionKeyValues.join(", ")}\n`,
    );
  }
  return found;
}

export function normalizeAudienceOrThrow(input: unknown): CommentAudience {
  const raw = String(input ?? "").trim();
  if (!raw) {
    throw new Error("[Error:] [CommentContractHelper] audience is required.\n");
  }

  const found = (CommentAudienceValues as readonly string[]).find(
    v => v.toLowerCase() === raw.toLowerCase(),
  );

  if (!found) {
    throw new Error(
      `[Error:] [CommentContractHelper] Invalid audience "${raw}". Allowed: ${CommentAudienceValues.join(", ")}\n`,
    );
  }

  return found as CommentAudience;
}

export function normalizeRefIdOrThrow(input: unknown): string {
  const refId = String(input ?? "").trim();
  if (!refId) throw new Error("[Error:] [CommentContractHelper] refId is required.\n");
  return refId;
}

/* ========================================================================== *
 * 3) BUILD CANONICAL CommentTargetDto (exactOptionalPropertyTypes-safe)
 * ========================================================================== */

export function buildCommentTargetOrThrow(input: CommentTargetPeekDto): CommentTargetDto {
  const section = normalizeCommentSectionKey(input.section);
  const refId = normalizeRefIdOrThrow(input.refId);

  const module = typeof input.module === "string" ? input.module.trim() : "";
  const modelName = typeof input.modelName === "string" ? input.modelName.trim() : "";

  // scope can be omitted OR explicitly null OR object
  const scopeRaw = input.scope;
  const scope =
    scopeRaw === undefined
      ? undefined
      : scopeRaw === null
        ? null
        : typeof scopeRaw === "object"
          ? (scopeRaw as Record<string, unknown>)
          : undefined;

  if (section !== "Teams") {
    // subSection must be absent (union enforces never)
    const out: Record<string, unknown> = { section, refId };

    if (module) out["module"] = module;
    if (scope !== undefined) out["scope"] = scope;
    if (modelName) out["modelName"] = modelName;

    return out as CommentTargetDto;
  }

  // Teams requires subSection
  const subSection = normalizeTeamsSubSectionOrThrow(input.subSection);

  const out: Record<string, unknown> = {
    section: "Teams",
    subSection,
    refId,
  };

  if (module) out["module"] = module;
  if (scope !== undefined) out["scope"] = scope;
  if (modelName) out["modelName"] = modelName;

  return out as CommentTargetDto;
}

/* ========================================================================== *
 * 4) MULTIPART SAFE PARSERS
 * ========================================================================== */

/**
 * Parse commentTargetJson (string) safely into canonical CommentTargetDto.
 * Throws on invalid JSON or missing required fields.
 */
export function parseCommentTargetJsonOrThrow(json: unknown): CommentTargetDto {
  const raw = typeof json === "string" ? json.trim() : "";
  if (!raw) throw new Error("[Error:] [CommentContractHelper] commentTargetJson is required.\n");

  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("[Error:] [CommentContractHelper] commentTargetJson is not valid JSON.\n");
  }

  if (!obj || typeof obj !== "object") {
    throw new Error("[Error:] [CommentContractHelper] commentTargetJson must be an object.\n");
  }

  const o = obj as Record<string, unknown>;

  const section = normalizeCommentSectionKey(o["section"]);
  const refId = normalizeRefIdOrThrow(o["refId"]);

  const subSectionRaw = o["subSection"];
  const moduleRaw = o["module"];
  const modelNameRaw = o["modelName"];
  const scopeRaw = o["scope"];

  const peek: CommentTargetPeekDto = {
    section,
    refId,
    ...(typeof subSectionRaw === "string" ? { subSection: subSectionRaw } : {}),
    ...(typeof moduleRaw === "string" ? { module: moduleRaw } : {}),
    ...(typeof modelNameRaw === "string" ? { modelName: modelNameRaw } : {}),
    ...(scopeRaw === null || typeof scopeRaw === "object" ? { scope: scopeRaw as any } : {}),
  };

  return buildCommentTargetOrThrow(peek);
}
