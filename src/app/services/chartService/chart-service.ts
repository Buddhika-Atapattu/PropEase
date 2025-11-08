// Path: src/app/services/chart-service/chart-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Purpose
//   Centralize Google Charts configuration for PropEase.
//   • Components pass data only; service returns a ready-to-bind chart object.
//   • Colors are chosen automatically using:
//       1) Semantic mapping for labels (Success/Closed/Overdue/Critical/etc.)
//       2) A 20-step palette from Excellent→Worst (green→red) for the rest.
//   • Transparent backgrounds and theme-aware text/grid colors (light/dark).
//
// Bind Pattern (component):
//   chart = chartService.buildPie('Title', entries);
//   <google-chart [type]="chart.type" [columns]="chart.columns"
//                 [data]="chart.data" [options]="chart.options"></google-chart>
// ─────────────────────────────────────────────────────────────────────────────

import {Injectable} from '@angular/core';
import {ChartType} from 'angular-google-charts';

/* ╭──────────────────────────────────────────────────────────────────────────╮
   │ Types                                                                    │
   ╰──────────────────────────────────────────────────────────────────────────╯ */

export interface ChartFill {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface AxisOptions {
  title?: string;
  minValue?: number;
  maxValue?: number;
  viewWindow?: {min?: number; max?: number};
  gridlines?: {color?: string; count?: number};
  textStyle?: {color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean};
  titleTextStyle?: {color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean};
  format?: string;
  slantedText?: boolean;
  slantedTextAngle?: number;
}

export interface GoogleChartOptions {
  // Global styling
  title?: string;
  titleTextStyle?: {color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean};
  backgroundColor?: string | ChartFill;
  fontName?: string;
  fontSize?: number;
  colors?: string[];
  width?: number;
  height?: number;

  // Chart area (inner plot bounds)
  chartArea?: {left?: number | string; top?: number | string; width?: number | string; height?: number | string} & {
    backgroundColor?: string | ChartFill;
  };

  // Legend
  legend?: {
    position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
    alignment?: 'start' | 'center' | 'end';
    textStyle?: {color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean};
  };

  // Axes (Cartesian charts)
  hAxis?: AxisOptions;
  vAxis?: AxisOptions;

  // Tooltips
  tooltip?: {
    isHtml?: boolean;
    showColorCode?: boolean;
    trigger?: 'focus' | 'selection' | 'none';
    textStyle?: {color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean};
  };

  // Pie specifics
  is3D?: boolean;
  pieHole?: number; // 0..1
  pieSliceText?: 'percentage' | 'value' | 'label' | 'none';
  slices?: {[index: number]: {color?: string; offset?: number; textStyle?: {color?: string}}};

  // Line/Area specifics
  curveType?: 'none' | 'function';
  pointSize?: number;
  lineWidth?: number;

  // Bars
  bar?: {groupWidth?: string};

  // Combo
  seriesType?: 'line' | 'bars' | 'area';
  series?: {[seriesIndex: number]: {type?: 'line' | 'bars' | 'area'; targetAxisIndex?: 0 | 1}};

  // Gauge
  greenFrom?: number; greenTo?: number;
  yellowFrom?: number; yellowTo?: number;
  redFrom?: number; redTo?: number;
  minorTicks?: number;
  max?: number;
  min?: number;

  // Misc
  animation?: {startup?: boolean; duration?: number; easing?: 'linear' | 'in' | 'out' | 'inAndOut'};
  enableInteractivity?: boolean;
  reverseCategories?: boolean;
}

export interface ChartBuild {
  type: ChartType;
  data: any[];
  columns?: string[];
  options: GoogleChartOptions;
}

export interface PieEntry {
  label: string;
  value: number;
  colorHex?: string;
  explode?: boolean;
}

export interface SeriesEntry {
  name: string;
  values: number[];
  type?: 'line' | 'bars' | 'area';
  colorHex?: string;
}

/* ╭──────────────────────────────────────────────────────────────────────────╮
   │ Color logic                                                              │
   ╰──────────────────────────────────────────────────────────────────────────╯ */

const SEMANTIC_COLOR_MAP: Array<{keywords: string[]; hex: string}> = [
  {keywords: ['ok', 'success', 'closed', 'available', 'active', 'paid', 'complete', 'resolved'], hex: '#28c76f'},
  {keywords: ['info', 'neutral', 'scheduled', 'planned'], hex: '#3d5afe'},
  {keywords: ['warn', 'pending', 'hold', 'in progress', 'processing', 'due soon'], hex: '#ff9f43'},
  {keywords: ['fail', 'error', 'overdue', 'critical', 'blocked', 'rejected', 'cancelled'], hex: '#ea5455'},
  {keywords: ['primary'], hex: '#2b59ff'},
  {keywords: ['secondary', 'accent'], hex: '#ffcf4a'},
];

const PALETTE_20_EXCELLENT_TO_WORST: string[] = [
  '#15c778', '#1fce7d', '#28c76f', '#47cf79', '#66d683',
  '#85dd8d', '#a4e498', '#c3eaa3', '#e2f0ad', '#fff3a1',
  '#ffe27a', '#ffd052', '#ffbe2b', '#ffab12', '#ff9800',
  '#ff8a65', '#ff7043', '#ff6b6b', '#f4511e', '#d32f2f',
];

/* ╭──────────────────────────────────────────────────────────────────────────╮
   │ Theme-aware ChartService                                                 │
   ╰──────────────────────────────────────────────────────────────────────────╯ */

@Injectable({providedIn: 'root'})
export class ChartService {

  // ───────────────────────────── Theme helpers ──────────────────────────────
  /**
   * Read a CSS variable from :root and return its computed value.
   * SSR/Electron-safe: returns fallback if DOM is not available.
   */
  private readCssVar(varName: string, fallback: string): string {
    try {
      if(typeof window === 'undefined' || typeof document === 'undefined') return fallback;
      const cs = getComputedStyle(document.documentElement);
      const raw = cs.getPropertyValue(varName);
      const val = raw?.trim();
      return val && val.length > 0 ? val : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Collect theme colors from CSS variables (see global.scss tokens).
   * Fallbacks ensure sensible defaults if variables are missing.
   */
  private getThemeColors(): {
    onSurface: string;
    muted: string;
    border: string;
    primary: string;
    surface: string;
  } {
    return {
      onSurface: this.readCssVar('--on-surface', '#14161a'),
      muted: this.readCssVar('--muted', '#6b7280'),
      border: this.readCssVar('--border-color', 'rgba(0,0,0,0.15)'),
      primary: this.readCssVar('--primary', '#2b59ff'),
      surface: this.readCssVar('--surface', '#ffffff'),
    };
  }

  /**
   * Apply transparent background + theme-aware text/grid colors.
   * Merges with user-provided options (user wins).
   */
  private applyThemeDefaults(options?: GoogleChartOptions): GoogleChartOptions {
    const theme = this.getThemeColors();

    const base: GoogleChartOptions = {
      backgroundColor: 'transparent',
      chartArea: {
        left: '10%',
        top: '10%',
        width: '80%',
        height: '75%',
        backgroundColor: 'transparent',
      },
      legend: {
        position: 'right',
        textStyle: {color: theme.onSurface, fontSize: 12},
      },
      tooltip: {
        isHtml: false,
        textStyle: {color: theme.onSurface, fontSize: 12},
      },
      hAxis: {
        textStyle: {color: theme.onSurface, fontSize: 12},
        titleTextStyle: {color: theme.muted, fontSize: 12},
        gridlines: {color: theme.border},
      },
      vAxis: {
        textStyle: {color: theme.onSurface, fontSize: 12},
        titleTextStyle: {color: theme.muted, fontSize: 12},
        gridlines: {color: theme.border},
      },
      titleTextStyle: {color: theme.onSurface, fontSize: 14},
      // Allow pointer/hover interactions
      enableInteractivity: true,
      // Smooth default animations without being slow
      animation: {startup: true, duration: 300, easing: 'out'},
    };

    // Merge user overrides last (user wins)
    const merged: GoogleChartOptions = {
      ...base,
      ...(options ?? {}),
      chartArea: {...base.chartArea, ...(options?.chartArea ?? {})},
      legend: {...base.legend, ...(options?.legend ?? {})},
      tooltip: {...base.tooltip, ...(options?.tooltip ?? {})},
      hAxis: {...base.hAxis, ...(options?.hAxis ?? {})},
      vAxis: {...base.vAxis, ...(options?.vAxis ?? {})},
    };

    return merged;
  }

  // ───────────────────────────────── SMART BUILDER ──────────────────────────
  public buildSmart(opts: {
    title: string;
    pieEntries?: PieEntry[];
    categories?: string[];
    series?: SeriesEntry[];
    prefer?: 'pie' | 'donut' | 'pie3d' | 'column' | 'bar' | 'line' | 'area' | 'combo' | 'gauge';
    chartOptions?: GoogleChartOptions;
  }): ChartBuild {
    const {title, pieEntries, categories, series, prefer, chartOptions} = opts;

    if(prefer === 'gauge') {
      const values = (series?.[0]?.values ?? []).map((v, i) => ({
        label: categories?.[i] ?? `Metric ${i + 1}`,
        value: v,
      }));
      return this.buildGauge(title, values, chartOptions);
    }

    if(pieEntries?.length) {
      switch(prefer) {
        case 'donut': return this.buildDonut(title, pieEntries, 0.45, chartOptions);
        case 'pie3d': return this.buildPie3D(title, pieEntries, chartOptions);
        default: return this.buildPie(title, pieEntries, chartOptions);
      }
    }

    if((categories?.length ?? 0) && (series?.length ?? 0)) {
      switch(prefer) {
        case 'bar': return this.buildBar(title, categories!, series!, chartOptions);
        case 'line': return this.buildLine(title, categories!, series!, chartOptions);
        case 'area': return this.buildArea(title, categories!, series!, chartOptions);
        case 'combo': return this.buildCombo(title, categories!, series!, chartOptions);
        default: return this.buildColumn(title, categories!, series!, chartOptions);
      }
    }

    return this.buildPie(title, [], chartOptions);
  }

  // ───────────────────────────────── PIE / DONUT / 3D ───────────────────────
  public buildPie(title: string, entries: PieEntry[], options?: GoogleChartOptions): ChartBuild {
    const data = entries.map(e => [e.label, this.toNum(e.value)]);
    const colors = options?.colors ?? this.assignSliceColors(entries);

    const final: GoogleChartOptions = this.applyThemeDefaults({
      title,
      pieSliceText: options?.pieSliceText ?? 'percentage',
      colors,
      slices: this.mergeSlicesWithColors(entries, options?.slices),
      is3D: false,
      pieHole: undefined,
      ...options,
    });

    return {type: ChartType.PieChart, columns: ['Label', 'Value'], data, options: final};
  }

  public buildPie3D(title: string, entries: PieEntry[], options?: GoogleChartOptions): ChartBuild {
    const build = this.buildPie(title, entries, options);
    build.options.is3D = true;
    build.options.pieHole = undefined;
    return build;
  }

  public buildDonut(title: string, entries: PieEntry[], hole = 0.45, options?: GoogleChartOptions): ChartBuild {
    const build = this.buildPie(title, entries, options);
    build.options.is3D = false;
    build.options.pieHole = this.clamp(hole, 0, 0.9);
    return build;
  }

  // ───────────────────── COLUMN / BAR / LINE / AREA ─────────────────────────
  public buildColumn(title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions): ChartBuild {
    const columns = ['Category', ...series.map(s => s.name)];
    const rows = categories.map((c, i) => [c, ...series.map(s => this.asNumber(s.values[i] ?? 0))]);
    const colors = options?.colors ?? this.collectColors(series, options?.colors);

    const final: GoogleChartOptions = this.applyThemeDefaults({
      title,
      colors,
      bar: {groupWidth: '65%'},
      ...options,
    });

    return {type: ChartType.ColumnChart, columns, data: rows, options: final};
  }

  public buildBar(title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions): ChartBuild {
    const base = this.buildColumn(title, categories, series, options);
    base.type = ChartType.BarChart;
    return base;
  }

  public buildLine(title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions): ChartBuild {
    const columns = ['Category', ...series.map(s => s.name)];
    const rows = categories.map((c, i) => [c, ...series.map(s => this.asNumber(s.values[i] ?? 0))]);
    const colors = options?.colors ?? this.collectColors(series, options?.colors);

    const final: GoogleChartOptions = this.applyThemeDefaults({
      title,
      colors,
      curveType: options?.curveType ?? 'function',
      pointSize: options?.pointSize ?? 4,
      lineWidth: options?.lineWidth ?? 2,
      ...options,
    });

    return {type: ChartType.LineChart, columns, data: rows, options: final};
  }

  public buildArea(title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions): ChartBuild {
    const columns = ['Category', ...series.map(s => s.name)];
    const rows = categories.map((c, i) => [c, ...series.map(s => this.asNumber(s.values[i] ?? 0))]);
    const colors = options?.colors ?? this.collectColors(series, options?.colors);

    const final: GoogleChartOptions = this.applyThemeDefaults({
      title,
      colors,
      ...options,
    });

    return {type: ChartType.AreaChart, columns, data: rows, options: final};
  }

  // ───────────────────────────────────── COMBO ──────────────────────────────
  public buildCombo(title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions): ChartBuild {
    const columns = ['Category', ...series.map(s => s.name)];
    const rows = categories.map((c, i) => [c, ...series.map(s => this.asNumber(s.values[i] ?? 0))]);
    const colors = options?.colors ?? this.collectColors(series, options?.colors);

    const seriesTypes: NonNullable<GoogleChartOptions['series']> = {};
    series.forEach((s, idx) => {if(s.type) seriesTypes[idx] = {type: s.type};});

    const final: GoogleChartOptions = this.applyThemeDefaults({
      title,
      colors,
      seriesType: 'bars',
      series: Object.keys(seriesTypes).length ? seriesTypes : options?.series,
      ...options,
    });

    return {type: ChartType.ComboChart, columns, data: rows, options: final};
  }

  // ───────────────────────────────────── GAUGE ──────────────────────────────
  public buildGauge(
    title: string,
    values: {label: string; value: number}[],
    options?: GoogleChartOptions
  ): ChartBuild {
    const data = values.map(v => [v.label, this.toNum(v.value)]);

    const final: GoogleChartOptions = this.applyThemeDefaults({
      title,
      width: options?.width, height: options?.height,
      greenFrom: options?.greenFrom ?? 70, greenTo: options?.greenTo ?? 100,
      yellowFrom: options?.yellowFrom ?? 40, yellowTo: options?.yellowTo ?? 70,
      redFrom: options?.redFrom ?? 0, redTo: options?.redTo ?? 40,
      minorTicks: options?.minorTicks ?? 5,
      max: options?.max ?? 100,
      min: options?.min ?? 0,
      ...options,
    });

    return {type: ChartType.Gauge, columns: ['Label', 'Value'], data, options: final};
  }

  // ───────────────────────── Records → Series adapter ───────────────────────
  public adaptRecordsToSeries<T extends Record<string, unknown>>(
    records: T[],
    categoryKey: keyof T,
    seriesKeys: {key: keyof T; name: string; type?: 'line' | 'bars' | 'area'; colorHex?: string}[]
  ): {categories: string[]; series: SeriesEntry[]} {
    const categories = (records ?? []).map(r => String(r?.[categoryKey] ?? ''));
    const series: SeriesEntry[] = seriesKeys.map(sk => ({
      name: sk.name,
      values: (records ?? []).map(r => this.toNum(r?.[sk.key] ?? 0)),
      type: sk.type,
      colorHex: sk.colorHex,
    }));
    return {categories, series};
  }

  /* ╭────────────────────────────────────────────────────────────────────────╮
     │ Private helpers                                                        │
     ╰────────────────────────────────────────────────────────────────────────╯ */

  private asNumber(v: unknown): number {return this.toNum(v);}

  private toNum(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private clamp(n: number, min: number, max: number): number {
    if(n < min) return min;
    if(n > max) return max;
    return n;
  }

  private collectColors(series: SeriesEntry[], hintedColors?: string[] | null): string[] {
    if(Array.isArray(hintedColors) && hintedColors.length > 0) {
      const out: string[] = [];
      for(let i = 0; i < series.length; i++) out.push(hintedColors[i % hintedColors.length]);
      return out;
    }
    return this.assignSeriesColors(series);
  }

  private assignSliceColors(entries: PieEntry[]): string[] {
    const colors: string[] = [];
    const used = new Set<string>();
    for(const e of entries) {
      if(e.colorHex) {colors.push(e.colorHex); used.add(e.colorHex.toLowerCase()); continue;}
      const semantic = this.pickSemanticColor(e.label);
      if(semantic && !used.has(semantic.toLowerCase())) {colors.push(semantic); used.add(semantic.toLowerCase()); continue;}
      const next = this.nextPaletteColor(used);
      colors.push(next); used.add(next.toLowerCase());
    }
    return colors;
  }

  private assignSeriesColors(series: SeriesEntry[]): string[] {
    const colors: string[] = [];
    const used = new Set<string>();
    for(const s of series) {
      if(s.colorHex) {colors.push(s.colorHex); used.add(s.colorHex.toLowerCase()); continue;}
      const semantic = this.pickSemanticColor(s.name);
      if(semantic && !used.has(semantic.toLowerCase())) {colors.push(semantic); used.add(semantic.toLowerCase()); continue;}
      const next = this.nextPaletteColor(used);
      colors.push(next); used.add(next.toLowerCase());
    }
    return colors;
  }

  private pickSemanticColor(label: string): string | null {
    const l = (label ?? '').toLowerCase();
    for(const bucket of SEMANTIC_COLOR_MAP) {
      if(bucket.keywords.some(k => l.includes(k))) return bucket.hex;
    }
    if(/(success|pass|healthy|good)/i.test(label)) return '#28c76f';
    if(/(warn|soon|pending|hold|progress)/i.test(label)) return '#ff9f43';
    if(/(fail|error|down|overdue|critical|danger)/i.test(label)) return '#ea5455';
    if(/(info|neutral)/i.test(label)) return '#3d5afe';
    return null;
  }

  private nextPaletteColor(used: Set<string>): string {
    for(const hex of PALETTE_20_EXCELLENT_TO_WORST) {
      if(!used.has(hex.toLowerCase())) return hex;
    }
    const idx = used.size % PALETTE_20_EXCELLENT_TO_WORST.length;
    return PALETTE_20_EXCELLENT_TO_WORST[idx];
  }

  private mergeSlicesWithColors(
    entries: PieEntry[],
    existing?: GoogleChartOptions['slices']
  ): NonNullable<GoogleChartOptions['slices']> {
    const slices: NonNullable<GoogleChartOptions['slices']> = existing ? {...existing} : {};
    entries.forEach((e, i) => {
      const prev = slices[i] ?? {};
      slices[i] = {...prev, color: e.colorHex ?? prev.color, offset: e.explode ? 0.15 : prev.offset};
    });
    return slices;
  }
}
