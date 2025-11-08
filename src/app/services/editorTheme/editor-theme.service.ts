// Path: src/app/services/editorTheme/editor-theme.service.ts
// ──────────────────────────────────────────────────────────────────────────────
// Purpose
//   Build and inject TinyMCE `content_style` with *resolved* PropEase theme
//   tokens (not CSS variables) so the iframe gets the correct colors.
//
//   • Modes:
//       - "page"  → A4-like centered canvas (MS Word look)
//       - "fluid" → Full-width, card-like block
//   • Theme-aware:
//       - Reads current tokens from <html> (light/dark) and computes fallbacks
//       - Injects caret color + selection color inside the iframe
//   • SSR/Electron safe:
//       - Guards browser APIs during server rendering
//
// Usage (TinyMCE Angular component):
//   const css = this.editorTheme.buildContentStyle('page');
//   init: { content_style: css, setup: (ed) => this.editorTheme.reloadInto(ed, 'page') }
//   // On theme toggle: this.editorTheme.reloadInto(tinymce.get(thisId), 'page');
// ──────────────────────────────────────────────────────────────────────────────

import {Inject, Injectable, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';

export type EditorLayoutMode = 'page' | 'fluid';


/** Strongly-typed resolved palette for the editor iframe */
interface EditorResolvedTokens {
  surface: string;
  surfaceVar: string;
  onSurface: string;
  primary: string;
  secondary: string;
  border: string;
  shadow: string;
  muted: string;
  onPrimary: string;
  card: string;
  caret: string;
  caretSelBg: string;
}


@Injectable({providedIn: 'root'})
export class EditorThemeService {
  // We keep a small in-memory cache to avoid re-reading computed styles too often.
  // Cache is invalidated each time you explicitly call buildContentStyle/reload.
  private tokensCache: EditorResolvedTokens | null = null;

  constructor (@Inject(PLATFORM_ID) private platformId: Object) {}

  /**
   * Build TinyMCE `content_style` as a single CSS string.
   * Always returns *resolved* colors (NO CSS variables) so the iframe can render
   * correctly without inheriting from the host page.
   */
  public buildContentStyle(mode: EditorLayoutMode = 'page'): string {
    const t = this.tokens(); // resolved palette
    const layout = mode === 'page' ? this.pageCSS(t) : this.fluidCSS(t);
    const common = this.commonCSS(t);
    const dark = this.darkOverrides(t);
    const print = this.printCSS(mode, t);

    // `color-scheme` hints the UA for form controls inside iframe.
    return [
      ':root{color-scheme:light dark;}',
      'html,body{background:transparent!important;scrollbar-gutter:stable;}',
      layout,
      common,
      dark,
      print,
    ].join('\n');
  }

  /**
   * Return a data: URL wrapping the CSS (handy for ed.dom.loadCSS()).
   */
  public buildStyleDataUrl(mode: EditorLayoutMode = 'page'): string {
    const css = this.buildContentStyle(mode);
    return 'data:text/css;charset=utf-8,' + encodeURIComponent(css);
  }

  /**
   * Load (or reload) the latest themed CSS into a live TinyMCE editor instance.
   * Safe to call after you toggle themes.
   */
  public reloadInto(editor: any, mode: EditorLayoutMode = 'page'): void {
    if(!editor) return;
    // Clear token cache so we re-read the actual (possibly new) theme values
    this.tokensCache = null;
    const dataUrl = this.buildStyleDataUrl(mode);
    try {
      editor.dom.loadCSS(dataUrl);
    } catch {
      // Swallow — some wrappers may not expose dom.loadCSS early in lifecycle.
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal: Read + resolve tokens from <html>, with sensible fallbacks
  // ────────────────────────────────────────────────────────────────────────────

  private tokens(): EditorResolvedTokens {
    if(this.tokensCache) return this.tokensCache;

    // SSR guard: return safe defaults
    if(!isPlatformBrowser(this.platformId)) {
      return (this.tokensCache = this.defaults());
    }

    const root = document.documentElement;
    const css = getComputedStyle(root);

    const get = (name: string, fallback: string) => {
      const v = css.getPropertyValue(name);
      return v && v.trim().length ? v.trim() : fallback;
    };

    const t: EditorResolvedTokens = {
      surface: get('--surface', '#ffffff'),
      surfaceVar: get('--surface-variant', '#f6f8fb'),
      onSurface: get('--on-surface', '#14161a'),
      primary: get('--primary', '#2b59ff'),
      secondary: get('--secondary', '#ffcf4a'),
      border: get('--border-color', '#d8dee6'),
      shadow: get('--shadow-color', 'rgba(0,0,0,0.16)'),
      muted: get('--muted', '#6b7280'),
      onPrimary: get('--on-primary', '#ffffff'),
      card: get('--bs-card-bg', get('--card', '#ffffff')),
      // Caret + selection (tokens you set in styles.scss §3)
      caret: get('--caret-color', get('--primary', '#2b59ff')),
      caretSelBg: get('--caret-selection-bg', 'rgba(43,89,255,0.15)'),
    };

    // If <html> has .dark, strengthen defaults for shadow/etc.
    if(root.classList.contains('dark')) {
      t.shadow = get('--shadow-color', 'rgba(0,0,0,0.7)');
      // If card not defined in dark, pick a sane value
      if(!t.card || t.card === '#ffffff') t.card = '#1e293b';
      // Selection fallback for dark if missing
      if(!get('--caret-selection-bg', '')) t.caretSelBg = 'rgba(255,207,74,0.30)';
      // Caret fallback for dark if missing
      if(!get('--caret-color', '')) t.caret = t.secondary;
    }

    return (this.tokensCache = t);
  }

  private defaults(): EditorResolvedTokens {
    return {
      surface: '#ffffff',
      surfaceVar: '#f6f8fb',
      onSurface: '#14161a',
      primary: '#2b59ff',
      secondary: '#ffcf4a',
      border: '#d8dee6',
      shadow: 'rgba(0,0,0,0.16)',
      muted: '#6b7280',
      onPrimary: '#ffffff',
      card: '#ffffff',
      caret: '#2b59ff',
      caretSelBg: 'rgba(43,89,255,0.15)',
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Layout CSS (resolved values only — no CSS variables)
  // ────────────────────────────────────────────────────────────────────────────

  /** A4-style layout (MS Word visual) */
  private pageCSS(t: EditorResolvedTokens): string {
    return `
      body.mce-content-body {
        margin: 24px auto;
        padding: 48px 64px;
        width: 816px;                     /* ≈ A4 portrait width at 96dpi */
        min-height: 1120px;
        box-sizing: border-box;
        background: ${t.card};
        color: ${t.onSurface};
        border: 1px solid ${t.border};
        border-radius: 12px;
        box-shadow: 0 12px 28px ${t.shadow};
        font: 12pt/1.6 -apple-system, Segoe UI, Roboto, system-ui,
              "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
        caret-color: ${t.caret};
        overflow-wrap: break-word;
        word-break: break-word;
      }`;
  }

  /** Fluid layout for inline editing (no fixed page width) */
  private fluidCSS(t: EditorResolvedTokens): string {
    return `
      body.mce-content-body {
        margin: 0;
        padding: 24px 28px;
        width: auto;
        min-height: 420px;
        box-sizing: border-box;
        background: ${t.card};
        color: ${t.onSurface};
        border: 1px solid ${t.border};
        border-radius: 12px;
        box-shadow: 0 8px 20px ${t.shadow};
        font: 12pt/1.6 -apple-system, Segoe UI, Roboto, system-ui,
              "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
        caret-color: ${t.caret};
        overflow-wrap: break-word;
      }`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Shared content (typography, elements, structure)
  // ────────────────────────────────────────────────────────────────────────────

  private commonCSS(t: EditorResolvedTokens): string {
    return `
      /* Headings & paragraphs */
      p { margin: 0 0 10px; }
      h1, h2, h3, h4, h5, h6 {
        margin: 16px 0 8px;
        font-weight: 600;
        line-height: 1.25;
      }
      h1 { font-size: 28pt; }
      h2 { font-size: 24pt; }
      h3 { font-size: 20pt; }
      h4 { font-size: 16pt; }
      h5 { font-size: 14pt; }
      h6 {
        font-size: 12pt;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: ${this.mix(t.onSurface, 0.7)};
      }

      /* Lists */
      ul, ol { padding-left: 1.4em; margin: 0 0 10px; }
      li { margin: 0.15em 0; }
      ul ul, ol ol, ul ol, ol ul { margin-bottom: 0; }

      /* Links */
      a { color: ${t.primary}; text-decoration: underline; }
      a:hover { text-decoration-thickness: 2px; }

      /* Emphasis */
      mark { background: ${this.mix(t.primary, 0.25)}; }

      /* Code */
      code, pre, kbd, samp {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 11pt;
      }
      code, kbd, samp {
        background: ${this.mix(t.muted, 0.12)};
        border-radius: 6px;
        padding: 2px 6px;
      }
      pre {
        background: ${this.mix(t.muted, 0.10)};
        border: 1px solid ${this.mix(t.border, 0.7)};
        border-radius: 8px;
        padding: 10px 12px;
        overflow: auto;
      }

      /* Quotes */
      blockquote {
        margin: 12px 0;
        padding: 12px 16px;
        border-left: 4px solid ${this.mix(t.primary, 0.55, true)};
        background: ${this.mix(t.primary, 0.08)};
        border-radius: 8px;
      }

      /* Rules */
      hr {
        height: 1px;
        border: 0;
        background: ${this.mix(t.border, 0.7)};
        margin: 16px 0;
      }

      /* Tables */
      table { border-collapse: collapse; width: 100%; table-layout: auto; }
      th, td { border: 1px solid ${t.border}; padding: 8px 10px; vertical-align: top; }
      thead th { background: ${this.mix(t.surfaceVar, 0.8)}; font-weight: 600; }
      tbody tr:nth-child(odd) { background: ${this.mix(t.surfaceVar, 0.35)}; }

      /* Media */
      img { max-width: 100%; height: auto; border-radius: 6px; object-fit: contain; object-position: center; }
      figure { margin: 12px 0; }
      figcaption {
        font-size: 10pt;
        text-align: center;
        color: ${this.mix(t.onSurface, 0.7)};
        margin-top: 6px;
      }

      /* Selection (inside iframe) */
      ::selection { background: ${t.caretSelBg}; color: ${t.onPrimary}; }
      *::selection { background: ${t.caretSelBg}; color: ${t.onPrimary}; }

      /* Page breaks for print/export */
      .page-break { page-break-after: always; break-after: page; height: 0; overflow: hidden; }
    `;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Dark overrides (prefers-color-scheme) — provides a hint for OS dark users
  // ────────────────────────────────────────────────────────────────────────────

  private darkOverrides(t: EditorResolvedTokens): string {
    // We purposely keep this mild; primary colors are resolved already.
    return `
      @media (prefers-color-scheme: dark) {
        body.mce-content-body {
          background: ${t.card || '#1e293b'};
          color: ${t.onSurface || '#e5e7eb'};
          border-color: ${t.border || '#39414d'};
          box-shadow: 0 12px 28px ${t.shadow || 'rgba(0,0,0,.7)'};
        }
        thead th { background: ${this.mix(t.surfaceVar || '#111827', 0.86)}; }
        tbody tr:nth-child(odd) { background: ${this.mix(t.surfaceVar || '#111827', 0.35)}; }
        pre {
          background: ${this.mix(t.muted || '#a6a6a6', 0.12)};
          border-color: ${this.mix(t.border || '#39414d', 0.7)};
        }
      }
    `;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Print-friendly CSS
  // ────────────────────────────────────────────────────────────────────────────

  private printCSS(mode: EditorLayoutMode, t: EditorResolvedTokens): string {
    return `
      @page { size: A4; margin: 20mm 16mm; }
      @media print {
        html, body { background: #fff !important; }
        body.mce-content-body {
          ${mode === 'page' ? 'width:auto;min-height:auto;' : ''}
          margin: 0; padding: 0; border: 0;
          box-shadow: none; color: #000;
        }
        a { color: #000; text-decoration: underline; }
      }
    `;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * A lightweight "mix" helper that emulates `color-mix(..., X n%, base)`.
   * We keep it simple by returning rgba() with given alpha for subtle blends.
   *
   * @param hexOrRgba base color (hex or rgb/rgba string)
   * @param strength  0..1 where 0.35 ≈ "35%"
   * @param darkenEdge when true, simulate a slightly darker accent edge (used for borders)
   */
  private mix(hexOrRgba: string, strength: number, darkenEdge: boolean = false): string {
    // If already rgba, adjust its alpha
    if(hexOrRgba.startsWith('rgba')) {
      return hexOrRgba.replace(/rgba\(([^)]+)\)/, (_m, inner) => {
        const parts = inner.split(',').map((p: string) => p.trim());
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, strength))})`;
      });
    }

    if(hexOrRgba.startsWith('rgb')) {
      return hexOrRgba.replace(/rgb\(([^)]+)\)/, (_m, inner) => {
        const parts = inner.split(',').map((p: string) => p.trim());
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, strength))})`;
      });
    }

    // hex → rgba
    const {r, g, b} = this.hexToRgb(hexOrRgba);
    const a = Math.min(1, Math.max(0, strength));
    if(darkenEdge) {
      return `rgba(${Math.max(0, r - 25)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)}, ${Math.min(1, a + 0.05)})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  private hexToRgb(hex: string): {r: number; g: number; b: number} {
    const normalized = hex.replace('#', '');
    const isShort = normalized.length === 3;
    const r = parseInt(isShort ? normalized[0] + normalized[0] : normalized.slice(0, 2), 16);
    const g = parseInt(isShort ? normalized[1] + normalized[1] : normalized.slice(2, 4), 16);
    const b = parseInt(isShort ? normalized[2] + normalized[2] : normalized.slice(4, 6), 16);
    return {r, g, b};
  }
}
