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

import { Injectable } from '@angular/core';
import { ChartType } from 'angular-google-charts';

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
  viewWindow?: { min?: number; max?: number; };
  gridlines?: { color?: string; count?: number; };
  textStyle?: { color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; };
  titleTextStyle?: { color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; };
  format?: string;
  slantedText?: boolean;
  slantedTextAngle?: number;
}

export interface GoogleChartOptions {
  // Global styling
  title?: string;
  titleTextStyle?: { color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; };
  backgroundColor?: string | ChartFill;
  fontName?: string;
  fontSize?: number;
  colors?: string[];
  width?: number;
  height?: number;

  // Chart area (inner plot bounds)
  chartArea?: { left?: number | string; top?: number | string; width?: number | string; height?: number | string; } & {
    backgroundColor?: string | ChartFill;
  };

  // Legend
  legend?: {
    position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
    alignment?: 'start' | 'center' | 'end';
    textStyle?: { color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; };
  };

  // Axes (Cartesian charts)
  hAxis?: AxisOptions;
  vAxis?: AxisOptions;

  // Tooltips
  tooltip?: {
    isHtml?: boolean;
    showColorCode?: boolean;
    trigger?: 'focus' | 'selection' | 'none';
    textStyle?: { color?: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; };
  };

  // Pie specifics
  is3D?: boolean;
  pieHole?: number; // 0..1
  pieSliceText?: 'percentage' | 'value' | 'label' | 'none';
  slices?: { [ index: number ]: { color?: string; offset?: number; textStyle?: { color?: string; }; }; };

  // Line/Area specifics
  curveType?: 'none' | 'function';
  pointSize?: number;
  lineWidth?: number;

  // Bars
  bar?: { groupWidth?: string; };

  // Combo
  seriesType?: 'line' | 'bars' | 'area';
  series?: { [ seriesIndex: number ]: { type?: 'line' | 'bars' | 'area'; targetAxisIndex?: 0 | 1; }; };

  // Gauge
  greenFrom?: number; greenTo?: number;
  yellowFrom?: number; yellowTo?: number;
  redFrom?: number; redTo?: number;
  minorTicks?: number;
  max?: number;
  min?: number;

  // Misc
  animation?: { startup?: boolean; duration?: number; easing?: 'linear' | 'in' | 'out' | 'inAndOut'; };
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
   │ Color logic – semantic + 100-color accessible palette                   │
   ╰──────────────────────────────────────────────────────────────────────────╯ */

const SEMANTIC_COLOR_MAP: Array<{ keywords: string[]; hex: string; }> = [
  { keywords: [ 'ok', 'success', 'closed', 'available', 'active', 'paid', 'complete', 'resolved' ], hex: '#28c76f' },
  { keywords: [ 'info', 'neutral', 'scheduled', 'planned' ], hex: '#3d5afe' },
  { keywords: [ 'warn', 'pending', 'hold', 'in progress', 'processing', 'due soon' ], hex: '#ff9f43' },
  { keywords: [ 'fail', 'error', 'overdue', 'critical', 'blocked', 'rejected', 'cancelled' ], hex: '#ea5455' },
  { keywords: [ 'primary' ], hex: '#2b59ff' },
  { keywords: [ 'secondary', 'accent' ], hex: '#ffcf4a' },
];

/**
 * Legacy 20-step green→red palette – still used as a fallback
 * for gauges / overflow situations.
 */
const PALETTE_20_EXCELLENT_TO_WORST: string[] = [
  '#15c778', '#1fce7d', '#28c76f', '#47cf79', '#66d683',
  '#85dd8d', '#a4e498', '#c3eaa3', '#e2f0ad', '#fff3a1',
  '#ffe27a', '#ffd052', '#ffbe2b', '#ffab12', '#ff9800',
  '#ff8a65', '#ff7043', '#ff6b6b', '#f4511e', '#d32f2f',
];

/**
 * 100-color, high-contrast, elderly-friendly palette:
 *  - Alternates hue groups (green/blue/red/orange/teal/purple/etc.)
 *  - Designed so adjacent picks are visibly different.
 */
const ACCESSIBLE_100_PALETTE: string[] = [
  '#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e',
  '#e6ab02', '#a6761d', '#666666', '#1f77b4', '#ff7f0e',
  '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
  '#7f7f7f', '#bcbd22', '#17becf', '#00429d', '#73a2ff',
  '#0c7b93', '#00a8e8', '#f4a261', '#e76f51', '#2a9d8f',
  '#264653', '#a8dadc', '#457b9d', '#e63946', '#ffb4a2',
  '#ff6b6b', '#ffa69e', '#ffca3a', '#8ac926', '#1982c4',
  '#6a4c93', '#ff595e', '#ff924c', '#c9cba3', '#006d77',
  '#83c5be', '#edf6f9', '#f28482', '#84a59d', '#f6bd60',
  '#e5989b', '#b5838d', '#6d597a', '#355070', '#3d5a80',
  '#98c1d9', '#e0fbfc', '#ee6c4d', '#293241', '#f94144',
  '#f3722c', '#f8961e', '#f9844a', '#f9c74f', '#90be6d',
  '#43aa8b', '#4d908e', '#577590', '#277da1', '#9b5de5',
  '#f15bb5', '#fee440', '#00bbf9', '#00f5d4', '#007f5f',
  '#2b9348', '#55a630', '#80b918', '#aacc00', '#bfd200',
  '#d4d700', '#dddf00', '#eeef20', '#ffff3f', '#b7094c',
  '#a01a58', '#892b64', '#723c70', '#5c4d7d', '#455e89',
  '#33658a', '#2f4858', '#ff4d6d', '#ff758f', '#ff8fa3',
  '#ffb3c1', '#ffccd5', '#f4d35e', '#ee964b', '#f95738',
  '#0ead69', '#248277', '#379392', '#4fb0c6', '#5e60ce',
];


/* ╭──────────────────────────────────────────────────────────────────────────╮
   │ Theme-aware ChartService                                                 │
   ╰──────────────────────────────────────────────────────────────────────────╯ */

@Injectable( { providedIn: 'root' } )
export class ChartService {

  // ───────────────────────────── Theme helpers ──────────────────────────────
  /**
   * Read a CSS variable from :root and return its computed value.
   * SSR/Electron-safe: returns fallback if DOM is not available.
   */
  private readCssVar( varName: string, fallback: string ): string {
    try {
      if ( typeof window === 'undefined' || typeof document === 'undefined' ) return fallback;
      const cs = getComputedStyle( document.documentElement );
      const raw = cs.getPropertyValue( varName );
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
      onSurface: this.readCssVar( '--on-surface', '#14161a' ),
      muted: this.readCssVar( '--muted', '#6b7280' ),
      border: this.readCssVar( '--border-color', 'rgba(0,0,0,0.15)' ),
      primary: this.readCssVar( '--primary', '#2b59ff' ),
      surface: this.readCssVar( '--surface', '#ffffff' ),
    };
  }

  /**
   * Apply transparent background + theme-aware text/grid colors.
   * Merges with user-provided options (user wins).
   */
  private applyThemeDefaults( options?: GoogleChartOptions ): GoogleChartOptions {
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
        textStyle: { color: theme.onSurface, fontSize: 12 },
      },
      tooltip: {
        isHtml: false,
        textStyle: { color: theme.onSurface, fontSize: 12 },
      },
      hAxis: {
        textStyle: { color: theme.onSurface, fontSize: 12 },
        titleTextStyle: { color: theme.muted, fontSize: 12 },
        gridlines: { color: theme.border },
      },
      vAxis: {
        textStyle: { color: theme.onSurface, fontSize: 12 },
        titleTextStyle: { color: theme.muted, fontSize: 12 },
        gridlines: { color: theme.border },
      },
      titleTextStyle: { color: theme.onSurface, fontSize: 14 },
      // Allow pointer/hover interactions
      enableInteractivity: true,
      // Smooth default animations without being slow
      animation: { startup: true, duration: 300, easing: 'out' },
    };

    // Merge user overrides last (user wins)
    const merged: GoogleChartOptions = {
      ...base,
      ...( options ?? {} ),
      chartArea: { ...base.chartArea, ...( options?.chartArea ?? {} ) },
      legend: { ...base.legend, ...( options?.legend ?? {} ) },
      tooltip: { ...base.tooltip, ...( options?.tooltip ?? {} ) },
      hAxis: { ...base.hAxis, ...( options?.hAxis ?? {} ) },
      vAxis: { ...base.vAxis, ...( options?.vAxis ?? {} ) },
    };

    return merged;
  }

  // ───────────────────────────────── SMART BUILDER ──────────────────────────
  public buildSmart( opts: {
    title: string;
    pieEntries?: PieEntry[];
    categories?: string[];
    series?: SeriesEntry[];
    prefer?: 'pie' | 'donut' | 'pie3d' | 'column' | 'bar' | 'line' | 'area' | 'combo' | 'gauge';
    chartOptions?: GoogleChartOptions;
  } ): ChartBuild {
    const { title, pieEntries, categories, series, prefer, chartOptions } = opts;

    if ( prefer === 'gauge' ) {
      const values = ( series?.[ 0 ]?.values ?? [] ).map( ( v, i ) => ( {
        label: categories?.[ i ] ?? `Metric ${ i + 1 }`,
        value: v,
      } ) );
      return this.buildGauge( title, values, chartOptions );
    }

    if ( pieEntries?.length ) {
      switch ( prefer ) {
        case 'donut': return this.buildDonut( title, pieEntries, 0.45, chartOptions );
        case 'pie3d': return this.buildPie3D( title, pieEntries, chartOptions );
        default: return this.buildPie( title, pieEntries, chartOptions );
      }
    }

    if ( ( categories?.length ?? 0 ) && ( series?.length ?? 0 ) ) {
      switch ( prefer ) {
        case 'bar': return this.buildBar( title, categories!, series!, chartOptions );
        case 'line': return this.buildLine( title, categories!, series!, chartOptions );
        case 'area': return this.buildArea( title, categories!, series!, chartOptions );
        case 'combo': return this.buildCombo( title, categories!, series!, chartOptions );
        default: return this.buildColumn( title, categories!, series!, chartOptions );
      }
    }

    return this.buildPie( title, [], chartOptions );
  }

  // ───────────────────────────────── PIE / DONUT / 3D ───────────────────────
  public buildPie( title: string, entries: PieEntry[], options?: GoogleChartOptions ): ChartBuild {
    const data = entries.map( e => [ e.label, this.toNum( e.value ) ] );
    const colors = options?.colors ?? this.assignSliceColors( entries );

    const final: GoogleChartOptions = this.applyThemeDefaults( {
      title,
      pieSliceText: options?.pieSliceText ?? 'percentage',
      colors,
      slices: this.mergeSlicesWithColors( entries, options?.slices ),
      is3D: false,
      pieHole: undefined,
      ...options,
    } );

    return { type: ChartType.PieChart, columns: [ 'Label', 'Value' ], data, options: final };
  }

  public buildPie3D( title: string, entries: PieEntry[], options?: GoogleChartOptions ): ChartBuild {
    const build = this.buildPie( title, entries, options );
    build.options.is3D = true;
    build.options.pieHole = undefined;
    return build;
  }

  public buildDonut( title: string, entries: PieEntry[], hole = 0.45, options?: GoogleChartOptions ): ChartBuild {
    const build = this.buildPie( title, entries, options );
    build.options.is3D = false;
    build.options.pieHole = this.clamp( hole, 0, 0.9 );
    return build;
  }

  // ───────────────────── COLUMN / BAR / LINE / AREA ─────────────────────────
  public buildColumn( title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions ): ChartBuild {
    const columns = [ 'Category', ...series.map( s => s.name ) ];
    const rows = categories.map( ( c, i ) => [ c, ...series.map( s => this.asNumber( s.values[ i ] ?? 0 ) ) ] );
    const colors = options?.colors ?? this.collectColors( series, options?.colors );

    const final: GoogleChartOptions = this.applyThemeDefaults( {
      title,
      colors,
      bar: { groupWidth: '65%' },
      ...options,
    } );

    return { type: ChartType.ColumnChart, columns, data: rows, options: final };
  }

  public buildBar( title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions ): ChartBuild {
    const base = this.buildColumn( title, categories, series, options );
    base.type = ChartType.BarChart;
    return base;
  }

  public buildLine( title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions ): ChartBuild {
    const columns = [ 'Category', ...series.map( s => s.name ) ];
    const rows = categories.map( ( c, i ) => [ c, ...series.map( s => this.asNumber( s.values[ i ] ?? 0 ) ) ] );
    const colors = options?.colors ?? this.collectColors( series, options?.colors );

    const final: GoogleChartOptions = this.applyThemeDefaults( {
      title,
      colors,
      curveType: options?.curveType ?? 'function',
      pointSize: options?.pointSize ?? 4,
      lineWidth: options?.lineWidth ?? 2,
      ...options,
    } );

    return { type: ChartType.LineChart, columns, data: rows, options: final };
  }

  public buildArea( title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions ): ChartBuild {
    const columns = [ 'Category', ...series.map( s => s.name ) ];
    const rows = categories.map( ( c, i ) => [ c, ...series.map( s => this.asNumber( s.values[ i ] ?? 0 ) ) ] );
    const colors = options?.colors ?? this.collectColors( series, options?.colors );

    const final: GoogleChartOptions = this.applyThemeDefaults( {
      title,
      colors,
      ...options,
    } );

    return { type: ChartType.AreaChart, columns, data: rows, options: final };
  }

  // ───────────────────────────────────── COMBO ──────────────────────────────
  public buildCombo( title: string, categories: string[], series: SeriesEntry[], options?: GoogleChartOptions ): ChartBuild {
    const columns = [ 'Category', ...series.map( s => s.name ) ];
    const rows = categories.map( ( c, i ) => [ c, ...series.map( s => this.asNumber( s.values[ i ] ?? 0 ) ) ] );
    const colors = options?.colors ?? this.collectColors( series, options?.colors );

    const seriesTypes: NonNullable<GoogleChartOptions[ 'series' ]> = {};
    series.forEach( ( s, idx ) => { if ( s.type ) seriesTypes[ idx ] = { type: s.type }; } );

    const final: GoogleChartOptions = this.applyThemeDefaults( {
      title,
      colors,
      seriesType: 'bars',
      series: Object.keys( seriesTypes ).length ? seriesTypes : options?.series,
      ...options,
    } );

    return { type: ChartType.ComboChart, columns, data: rows, options: final };
  }

  // ───────────────────────────────────── GAUGE ──────────────────────────────
  public buildGauge(
    title: string,
    values: { label: string; value: number; }[],
    options?: GoogleChartOptions
  ): ChartBuild {
    const data = values.map( v => [ v.label, this.toNum( v.value ) ] );

    const final: GoogleChartOptions = this.applyThemeDefaults( {
      title,
      width: options?.width, height: options?.height,
      greenFrom: options?.greenFrom ?? 70, greenTo: options?.greenTo ?? 100,
      yellowFrom: options?.yellowFrom ?? 40, yellowTo: options?.yellowTo ?? 70,
      redFrom: options?.redFrom ?? 0, redTo: options?.redTo ?? 40,
      minorTicks: options?.minorTicks ?? 5,
      max: options?.max ?? 100,
      min: options?.min ?? 0,
      ...options,
    } );

    return { type: ChartType.Gauge, columns: [ 'Label', 'Value' ], data, options: final };
  }

  // ───────────────────────── Records → Series adapter ───────────────────────
  public adaptRecordsToSeries<T extends Record<string, unknown>>(
    records: T[],
    categoryKey: keyof T,
    seriesKeys: { key: keyof T; name: string; type?: 'line' | 'bars' | 'area'; colorHex?: string; }[]
  ): { categories: string[]; series: SeriesEntry[]; } {
    const categories = ( records ?? [] ).map( r => String( r?.[ categoryKey ] ?? '' ) );
    const series: SeriesEntry[] = seriesKeys.map( sk => ( {
      name: sk.name,
      values: ( records ?? [] ).map( r => this.toNum( r?.[ sk.key ] ?? 0 ) ),
      type: sk.type,
      colorHex: sk.colorHex,
    } ) );
    return { categories, series };
  }

  /* ╭────────────────────────────────────────────────────────────────────────╮
     │ Private helpers                                                        │
     ╰────────────────────────────────────────────────────────────────────────╯ */

  private asNumber( v: unknown ): number { return this.toNum( v ); }

  private toNum( v: unknown ): number {
    const n = Number( v );
    return Number.isFinite( n ) ? n : 0;
  }

  private clamp( n: number, min: number, max: number ): number {
    if ( n < min ) return min;
    if ( n > max ) return max;
    return n;
  }

  private collectColors( series: SeriesEntry[], hintedColors?: string[] | null ): string[] {
    if ( Array.isArray( hintedColors ) && hintedColors.length > 0 ) {
      const out: string[] = [];
      for ( let i = 0; i < series.length; i++ ) out.push( hintedColors[ i % hintedColors.length ] );
      return out;
    }
    return this.assignSeriesColors( series );
  }


  private assignSliceColors( entries: PieEntry[] ): string[] {
    const colors: string[] = [];
    const used = new Set<string>();

    for ( const e of entries ) {
      // 1) Explicit color from entry
      if ( e.colorHex ) {
        const hex = e.colorHex;
        colors.push( hex );
        used.add( hex.toLowerCase() );
        continue;
      }

      // 2) Semantic color based on label
      const semantic = this.pickSemanticColor( e.label );
      if ( semantic && !used.has( semantic.toLowerCase() ) ) {
        colors.push( semantic );
        used.add( semantic.toLowerCase() );
        continue;
      }

      // 3) Palette color with contrast-aware selection
      const last = colors.length ? colors[ colors.length - 1 ] : undefined;
      const next = this.nextPaletteColor( used, last );
      colors.push( next );
      used.add( next.toLowerCase() );
    }

    return colors;
  }

  private assignSeriesColors( series: SeriesEntry[] ): string[] {
    const colors: string[] = [];
    const used = new Set<string>();

    for ( const s of series ) {
      // 1) Explicit color from series
      if ( s.colorHex ) {
        const hex = s.colorHex;
        colors.push( hex );
        used.add( hex.toLowerCase() );
        continue;
      }

      // 2) Semantic color based on series name
      const semantic = this.pickSemanticColor( s.name );
      if ( semantic && !used.has( semantic.toLowerCase() ) ) {
        colors.push( semantic );
        used.add( semantic.toLowerCase() );
        continue;
      }

      // 3) Palette color with contrast-aware selection
      const last = colors.length ? colors[ colors.length - 1 ] : undefined;
      const next = this.nextPaletteColor( used, last );
      colors.push( next );
      used.add( next.toLowerCase() );
    }

    return colors;
  }


  private pickSemanticColor( label: string ): string | null {
    const l = ( label ?? '' ).toLowerCase();

    // Buckets from SEMANTIC_COLOR_MAP
    for ( const bucket of SEMANTIC_COLOR_MAP ) {
      if ( bucket.keywords.some( k => l.includes( k ) ) ) return bucket.hex;
    }

    // Extra regex-based hints as a fallback
    if ( /(success|pass|healthy|good)/i.test( label ) ) return '#28c76f';
    if ( /(warn|soon|pending|hold|progress)/i.test( label ) ) return '#ff9f43';
    if ( /(fail|error|down|overdue|critical|danger)/i.test( label ) ) return '#ea5455';
    if ( /(info|neutral)/i.test( label ) ) return '#3d5afe';

    return null;
  }


  /**
   * Pick the next unused color from the 100-step accessible palette.
   *  - Avoids already-used colors.
   *  - Tries to maximise contrast vs. the last used color.
   *  - Falls back to "any unused" and finally to the 20-step palette.
   */
  private nextPaletteColor( used: Set<string>, lastUsed?: string ): string {
    // 1) First pass – require high contrast vs lastUsed
    for ( const hex of ACCESSIBLE_100_PALETTE ) {
      const lower = hex.toLowerCase();
      if ( used.has( lower ) ) continue;
      if ( !this.isHighContrast( lastUsed, hex ) ) continue;
      return hex;
    }

    // 2) Second pass – ignore contrast, just ensure uniqueness
    for ( const hex of ACCESSIBLE_100_PALETTE ) {
      const lower = hex.toLowerCase();
      if ( !used.has( lower ) ) return hex;
    }

    // 3) Fallback – cycle through the small 20-color palette
    const idx = used.size % PALETTE_20_EXCELLENT_TO_WORST.length;
    return PALETTE_20_EXCELLENT_TO_WORST[ idx ];
  }


  private mergeSlicesWithColors(
    entries: PieEntry[],
    existing?: GoogleChartOptions[ 'slices' ]
  ): NonNullable<GoogleChartOptions[ 'slices' ]> {
    const slices: NonNullable<GoogleChartOptions[ 'slices' ]> = existing ? { ...existing } : {};
    entries.forEach( ( e, i ) => {
      const prev = slices[ i ] ?? {};
      slices[ i ] = { ...prev, color: e.colorHex ?? prev.color, offset: e.explode ? 0.15 : prev.offset };
    } );
    return slices;
  }

  /** Parse #RRGGBB into RGB; returns null if invalid. */
  private hexToRgb( hex: string ): { r: number; g: number; b: number; } | null {
    const m = /^#?([0-9a-f]{6})$/i.exec( hex.trim() );
    if ( !m ) return null;
    const int = parseInt( m[ 1 ], 16 );
    return {
      r: ( int >> 16 ) & 0xff,
      g: ( int >> 8 ) & 0xff,
      b: int & 0xff,
    };
  }

  /** Simple Euclidean distance in RGB space. */
  private colorDistance( a: string, b: string ): number {
    const ra = this.hexToRgb( a );
    const rb = this.hexToRgb( b );
    if ( !ra || !rb ) return 255; // fallback: treat as very different
    const dr = ra.r - rb.r;
    const dg = ra.g - rb.g;
    const db = ra.b - rb.b;
    return Math.sqrt( dr * dr + dg * dg + db * db );
  }

  /**
   * Decide if candidate has "enough" contrast against previous.
   * Threshold ~80 is a good compromise for elderly visibility.
   */
  private isHighContrast( prev: string | undefined, candidate: string ): boolean {
    if ( !prev ) return true;
    return this.colorDistance( prev, candidate ) >= 80;
  }

}
