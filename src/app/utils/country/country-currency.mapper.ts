// Path: src/app/utils/country/country-currency.mapper.ts
// =============================================================================
// CountryCurrencyMapper — normalize unknown[] -> CountryCurrencyCard[] (runtime-safe)
// =============================================================================

import type { CountryDetailsCustomType } from "../../services/property/property.service";

export interface CountryCurrencyCard {
  name: string;     // Country common name
  currency: string; // Currency code (e.g., "LKR")
  flag: string;     // PNG flag URL
  cca2: string;     // ISO2 country code
}

export class CountryCurrencyMapper {
  private constructor() {}

  /**
   * Normalize unknown[] into CountryCurrencyCard[] safely at runtime.
   *
   * @param countries
   * - Expected: unknown[] (API output)
   * - Runtime safety: validates each item before mapping
   *
   * @returns CountryCurrencyCard[]
   * - Stable: sorted by country name then currency code
   */
  public static toCurrencyCards(countries: unknown[]): CountryCurrencyCard[] {
    // CHANGE: defensive guard even though signature is unknown[]
    if (!Array.isArray(countries) || countries.length === 0) return [];

    const out: CountryCurrencyCard[] = [];

    for (const item of countries) {
      // CHANGE: runtime safe mapping per row
      const cards = this.pickCurrencyCardsSafe(item);
      if (cards.length === 0) continue;

      out.push(...cards);

      // CHANGE: hard cap safety (prevents UI overload if API explodes)
      if (out.length >= 5000) break;
    }

    // CHANGE: stable sort for deterministic UI
    out.sort((a, b) => {
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      return a.currency.localeCompare(b.currency);
    });

    return out;
  }

  // =============================================================================
  // Runtime-safe row mapper
  // =============================================================================

  /**
   * Extract one-or-many currency cards from a single unknown country object.
   * Preserves your current behavior: returns a card per currency code.
   *
   * @param raw
   * - Expected: unknown (one country record)
   */
  private static pickCurrencyCardsSafe(raw: unknown): CountryCurrencyCard[] {
    const rec = this.asRecord(raw);
    if (!rec) return [];

    // CHANGE: read and validate critical fields
    const nameCommon = this.readNestedText(rec, ["name", "common"]);
    const cca2 = this.readText(rec["cca2"]);
    const flagPng = this.readNestedText(rec, ["flags", "png"]);

    // All must be present for a usable UI row
    if (!nameCommon || !cca2 || cca2.length !== 2 || !flagPng) return [];

    // CHANGE: currencies must be an object map
    const currencies = this.asRecord(rec["currencies"]);
    if (!currencies) return [];

    // CHANGE: deterministic currency codes list
    const codes = Object.keys(currencies)
      .map((c) => this.cleanCurrencyCode(c))
      .filter((c) => Boolean(c))
      .sort((a, b) => a.localeCompare(b));

    if (codes.length === 0) return [];

    const out: CountryCurrencyCard[] = [];
    const safeName = this.cap(nameCommon, 120);
    const safeFlag = this.cap(flagPng, 400); // URL length cap
    const safeCca2 = cca2.toUpperCase();

    // CHANGE: build a card per currency code (your current UI behavior)
    for (const code of codes) {
      out.push({
        name: safeName,
        currency: code, // already sanitized + upper
        flag: safeFlag,
        cca2: safeCca2,
      });

      // CHANGE: limit per country to avoid abnormal currency maps
      if (out.length >= 50) break;
    }

    return out;
  }

  // =============================================================================
  // Tiny runtime helpers (class-based)
  // =============================================================================

  private static asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
  }

  private static readText(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s ? s : null;
  }

  private static readNestedText(
    root: Record<string, unknown>,
    path: string[]
  ): string | null {
    let cur: unknown = root;

    for (const key of path) {
      const rec = this.asRecord(cur);
      if (!rec) return null;
      cur = rec[key];
    }

    return this.readText(cur);
  }

  /**
   * Currency code sanitizer:
   * - uppercase
   * - keep A-Z0-9 only
   * - length 2..10 (safe internal extensions)
   */
  private static cleanCurrencyCode(input: string): string {
    const raw = (input || "").trim().toUpperCase();
    if (!raw) return "";

    const code = raw.replace(/[^A-Z0-9]/g, "");
    if (code.length < 2 || code.length > 10) return "";

    return code;
  }

  private static cap(v: string, max: number): string {
    if (v.length <= max) return v;
    return v.slice(0, max).trim();
  }
}
