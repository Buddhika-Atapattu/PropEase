import {CountryCodes, PhoneNumber} from '../../types/common';



/* =============================================================================
 * PhoneNumberGuard
 * -----------------------------------------------------------------------------
 * 01. Introduction
 * - Runtime validator for `CountryCodes` and `PhoneNumber`.
 * - Accepts `unknown` and returns typed object OR null.
 *
 * 02. Important matters
 * - Never returns partially-valid objects.
 * - Optional fields are OMITTED (alt is only included when present as a string).
 * - Designed for strict TS + safe API payload building.
 *
 * 03. Why we make this class
 * - Prevents "trusting UI data" and avoids runtime crashes from bad shapes.
 *
 * 04. Usage hint
 * - const phone = PhoneNumberGuard.asPhoneNumber(value);
 * - if (!phone) { ...invalid... }
 * ============================================================================= */
export class PhoneNumberGuard {
  private constructor() {}

  /**
   * Validate and normalize a value into PhoneNumber.
   *
   * @param input
   * - Expected: unknown (e.g., form value, API response, local storage value)
   *
   * @returns PhoneNumber | null
   * - Returns a fully-validated PhoneNumber, otherwise null.
   */
  public static asPhoneNumber(input: unknown): PhoneNumber | null {
    const rec = this.asRecord(input);
    if (!rec) return null;

    const code = this.asCountryCodes(rec["code"]);
    if (!code) return null;

    const number = this.readRequiredText(rec["number"]);
    if (!number) return null;

    return { code, number };
  }

  /**
   * Validate and normalize a value into CountryCodes.
   *
   * @param input
   * - Expected: unknown (e.g., nested object rec["code"])
   *
   * @returns CountryCodes | null
   */
  public static asCountryCodes(input: unknown): CountryCodes | null {
    const rec = this.asRecord(input);
    if (!rec) return null;

    const name = this.readRequiredText(rec["name"]);
    const code = this.readRequiredText(rec["code"]);
    if (!name || !code) return null;

    const flagsRec = this.asRecord(rec["flags"]);
    if (!flagsRec) return null;

    const png = this.readRequiredText(flagsRec["png"]);
    const svg = this.readRequiredText(flagsRec["svg"]);
    if (!png || !svg) return null;

    const alt = this.readOptionalText(flagsRec["alt"]);

    // exactOptionalPropertyTypes-safe: only include alt when it exists
    const flags = alt ? { png, svg, alt } : { png, svg };

    return { name, code, flags };
  }

  // ===========================================================================
  // Internals (strict + safe)
  // ===========================================================================

  private static asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
  }

  private static readRequiredText(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s ? s : null;
  }

  private static readOptionalText(v: unknown): string | null {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s ? s : null;
  }
}
