// Path: src/app/services/recyclebin/recyclebin-center.service.ts
// =============================================================================
// RecycleBinCenterService — Windows-11-like "Recycle Bin Center" Aggregator
// =============================================================================
// 01) Introduction
// - Builds a single flat "items list" that looks like Windows Recycle Bin.
// - Your backend list() returns "entries" (deleted records), but Windows shows
//   "items" (files/folders). We bridge that gap by flattening:
//     A) one "record item" per entry (the deleted data itself)
//     B) N "file items" per entry (loaded lazily via prepareRestore)
//
// 02) Important matters
// - Avoid eager loading file manifests for all entries (performance).
// - File manifests are fetched only when entry is expanded or selected.
// - Never set optional props to undefined (strict + safe DTO boundary).
//
// 03) Why we make this class
// - UI components must not know backend envelope structures or restore flows.
// - Central place for icon mapping, flattening, caching, and selection state.
//
// 04) Parameter descriptions
// - See each method JSDoc.
//
// 05) Usage hint
// - component calls:
//     this.center.loadPage({ page: 1, limit: 25 });
//     this.center.setSearch("LEASE");
//     this.center.toggleExpand(entryId);
//     this.center.restoreSelected();
//
// 06) Keep in mind
// - ISO/IEC 27001/27002 (Control 8.28): do not console.log snapshot or file paths.
// =============================================================================

import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map, of, switchMap, tap } from "rxjs";

import type {
  PageQuery,
  RecycleBinEntryDto,
  RecycleBinListFilters,
  RecycleBinListUiResult,
  RecycleBinRestorePrepareDto,
} from "../../types/recyclebin/recyclebin.types";

import type { FileMetaPacketDto } from "../../types/recyclebin/recyclebin.types";
import { RecycleBinRestService } from "./recyclebin.rest.service";

// =============================================================================
// Types (UI rows)
// =============================================================================

export type RecycleBinItemKind = "record" | "file";

export type RecycleBinItemIconKey =
  | "folder"
  | "file"
  | "pdf"
  | "image"
  | "doc"
  | "xls"
  | "ppt"
  | "zip"
  | "json"
  | "txt"
  | "code"
  | "unknown";

export interface RecycleBinCenterRow {
  // stable row id (unique in table)
  rowId: string;

  // parent entry id (needed for restore/purge actions)
  entryId: string;

  // record item OR file item
  kind: RecycleBinItemKind;

  // Windows-like columns
  name: string;
  typeLabel: string;
  originalLocation: string;
  dateDeletedIso: string;
  sizeBytes: number;

  // hierarchy (expand/collapse)
  depth: number; // 0=top, 1=file under entry
  isExpandable: boolean;
  isExpanded: boolean;

  // icon mapping
  iconKey: RecycleBinItemIconKey;

  // raw backing refs for action/preview
  entry: RecycleBinEntryDto;
  file?: FileMetaPacketDto;
}

// =============================================================================

@Injectable({ providedIn: "root" })
export class RecycleBinCenterService {
  private readonly page$ = new BehaviorSubject<PageQuery>({ page: 1, limit: 25 });
  private readonly filters$ = new BehaviorSubject<RecycleBinListFilters>({});
  private readonly loading$ = new BehaviorSubject<boolean>(false);

  // expanded entry ids
  private readonly expandedSet$ = new BehaviorSubject<Set<string>>(new Set());

  // cache for prepareRestore(entryId)
  private readonly prepareCache = new Map<string, RecycleBinRestorePrepareDto>();

  // selection
  private readonly selectedRowIds$ = new BehaviorSubject<Set<string>>(new Set());

  public constructor(private readonly api: RecycleBinRestService) {}

  // =============================================================================
  // Public streams (bind in component)
  // =============================================================================

  public isLoading$(): Observable<boolean> {
    return this.loading$.asObservable();
  }

  public pageState$(): Observable<PageQuery> {
    return this.page$.asObservable();
  }

  public selectedCount$(): Observable<number> {
    return this.selectedRowIds$.pipe(map((s) => s.size));
  }

  /**
   * Windows-like "flat rows" stream.
   */
  public rows$(): Observable<{ rows: RecycleBinCenterRow[]; total: number; page: number; limit: number }> {
    return combineLatest([this.page$, this.filters$, this.expandedSet$]).pipe(
      tap(() => this.loading$.next(true)),
      switchMap(([page, filters, expanded]) =>
        this.api.list({ page, filters }).pipe(
          switchMap((res) => this.buildRows(res, expanded)),
          tap(() => this.loading$.next(false))
        )
      )
    );
  }

  // =============================================================================
  // Commands (called from UI)
  // =============================================================================

  /**
   * Load a specific page (1-based).
   *
   * @param page
   * - Expected: { page: 1..N, limit: 1..100 }
   */
  public loadPage(page: PageQuery): void {
    this.page$.next({ page: page.page, limit: page.limit });
  }

  /**
   * Update search text (maps to filters.search).
   *
   * @param text
   * - Expected: any string; empty clears search filter
   */
  public setSearch(text: string): void {
    const clean = typeof text === "string" ? text.trim() : "";
    const prev = this.filters$.value;
    const next: RecycleBinListFilters = { ...prev };

    if (clean) next.search = clean;
    else delete (next as { search?: string }).search;

    this.filters$.next(next);
    this.clearSelection();
  }

  /**
   * Toggle expand/collapse for an entry.
   *
   * @param entryId
   * - Expected: non-empty entry id string
   */
  public toggleExpand(entryId: string): void {
    const id = this.safeId(entryId);
    const set = new Set(this.expandedSet$.value);

    if (set.has(id)) set.delete(id);
    else set.add(id);

    this.expandedSet$.next(set);
  }

  /**
   * Ensure file manifest exists in cache (lazy-load).
   *
   * @param entryId
   * - Expected: non-empty entry id string
   */
  public ensurePrepared(entryId: string): Observable<RecycleBinRestorePrepareDto | null> {
    const id = this.safeId(entryId);
    const cached = this.prepareCache.get(id);
    if (cached) return of(cached);

    return this.api.prepareRestore(id).pipe(
      tap((dto) => {
        this.prepareCache.set(id, dto);
      })
    );
  }

  // =============================================================================
  // Selection (Windows-like)
  // =============================================================================

  public isSelected(rowId: string): boolean {
    return this.selectedRowIds$.value.has(rowId);
  }

  public toggleRowSelection(rowId: string): void {
    const id = this.safeRowId(rowId);
    const set = new Set(this.selectedRowIds$.value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.selectedRowIds$.next(set);
  }

  public clearSelection(): void {
    this.selectedRowIds$.next(new Set());
  }

  // =============================================================================
  // Actions (restore/purge)
  // =============================================================================

  /**
   * Restore selected entries (Windows: "Restore the selected items").
   * - If a user selects child file rows, we still restore the parent entry,
   *   because backend restore is entry-based.
   */
  public restoreSelected(): Observable<{ restored: number }> {
    const entryIds = this.getSelectedEntryIdsUnique();
    if (entryIds.length === 0) return of({ restored: 0 });

    // Sequential restore to keep UI predictable (and avoid server burst).
    return this.restoreSequential(entryIds, 0, 0);
  }

  /**
   * Permanently delete selected (Windows: "Delete" in Recycle Bin).
   */
  public purgeSelected(): Observable<{ purged: number }> {
    const entryIds = this.getSelectedEntryIdsUnique();
    if (entryIds.length === 0) return of({ purged: 0 });

    return this.purgeSequential(entryIds, 0, 0);
  }

  // =============================================================================
  // Row builder (Windows columns + icons)
  // =============================================================================

  private buildRows(
    res: RecycleBinListUiResult,
    expanded: Set<string>
  ): Observable<{ rows: RecycleBinCenterRow[]; total: number; page: number; limit: number }> {
    const entries = Array.isArray(res.items) ? res.items : [];
    const requests: Observable<RecycleBinCenterRow[]>[] = [];

    for (const e of entries) {
      const entryId = this.safeId((e as { entryId?: string }).entryId || "");
      const isExpanded = expanded.has(entryId);

      // (A) record row (top-level)
      const recordRow: RecycleBinCenterRow = {
        rowId: `record:${entryId}`,
        entryId,
        kind: "record",
        name: this.getRecordName(e),
        typeLabel: this.getRecordTypeLabel(e),
        originalLocation: this.getOriginalLocationLabel(e),
        dateDeletedIso: this.getDeletedIso(e),
        sizeBytes: 0,
        depth: 0,
        isExpandable: true, // record expands to show files
        isExpanded,
        iconKey: this.getRecordIconKey(e),
        entry: e,
      };

      // always push record row
      if (!isExpanded) {
        requests.push(of([recordRow]));
        continue;
      }

      // (B) if expanded => add child file rows (lazy prepareRestore)
      const obs = this.ensurePrepared(entryId).pipe(
        map((prep) => {
          const rows: RecycleBinCenterRow[] = [recordRow];

          const files = prep && Array.isArray(prep.files) ? prep.files : [];
          for (const f of files) {
            const fileRow: RecycleBinCenterRow = {
              rowId: `file:${entryId}:${this.safeRowId(this.getFileStableKey(f))}`,
              entryId,
              kind: "file",
              name: this.getFileName(f),
              typeLabel: this.getFileTypeLabel(f),
              originalLocation: this.getFileOriginalLocationLabel(f, e),
              dateDeletedIso: this.getDeletedIso(e),
              sizeBytes: this.getFileSize(f),
              depth: 1,
              isExpandable: false,
              isExpanded: false,
              iconKey: this.getFileIconKey(f),
              entry: e,
              file: f,
            };
            rows.push(fileRow);
          }

          return rows;
        })
      );

      requests.push(obs);
    }

    return combineLatest(requests).pipe(
      map((chunks) => {
        const rows = chunks.flat();
        return {
          rows,
          total: res.total,
          page: res.page,
          limit: res.limit,
        };
      })
    );
  }

  // =============================================================================
  // Restore/Purge sequential helpers
  // =============================================================================

  private restoreSequential(entryIds: string[], index: number, restored: number): Observable<{ restored: number }> {
    if (index >= entryIds.length) {
      this.clearSelection();
      // refresh by re-emitting same page/filters (simple)
      this.page$.next({ page: this.page$.value.page, limit: this.page$.value.limit });
      return of({ restored });
    }

    const id = entryIds[index];

    // Your backend flow is:
    // 1) prepareRestore(entryId)  (optional precheck)
    // 2) domain restore (not implemented here)
    // 3) markRestored(entryId)
    //
    // Since your UI is "center", we do:
    // - prepareRestore just to validate snapshot exists
    // - then markRestored (assuming domain restore is handled elsewhere)
    return this.ensurePrepared(id).pipe(
      switchMap(() => this.api.markRestored(id)),
      switchMap(() => this.restoreSequential(entryIds, index + 1, restored + 1))
    );
  }

  private purgeSequential(entryIds: string[], index: number, purged: number): Observable<{ purged: number }> {
    if (index >= entryIds.length) {
      this.clearSelection();
      this.page$.next({ page: this.page$.value.page, limit: this.page$.value.limit });
      return of({ purged });
    }

    const id = entryIds[index];
    return this.api.purge(id).pipe(
      switchMap(() => this.purgeSequential(entryIds, index + 1, purged + 1))
    );
  }

  private getSelectedEntryIdsUnique(): string[] {
    const ids = new Set<string>();
    for (const rowId of this.selectedRowIds$.value) {
      // rowId is "record:<entryId>" OR "file:<entryId>:<...>"
      const parts = rowId.split(":");
      if (parts.length >= 2) {
        const entryId = parts[1] || "";
        if (entryId.trim()) ids.add(entryId.trim());
      }
    }
    return Array.from(ids);
  }

  // =============================================================================
  // Icon + label mapping (Windows-like)
  // =============================================================================

  private getRecordName(e: RecycleBinEntryDto): string {
    // Prefer "title/name" if your dto has it; fallback to entryId
    const anyE = e as unknown as Record<string, unknown>;
    const label = typeof anyE["title"] === "string" ? String(anyE["title"]).trim() : "";
    const entity = typeof anyE["entity"] === "string" ? String(anyE["entity"]).trim() : "";
    const entryId = typeof anyE["entryId"] === "string" ? String(anyE["entryId"]).trim() : "";
    return label || entity || `Deleted Item (${entryId.slice(0, 6) || "Record"})`;
  }

  private getRecordTypeLabel(e: RecycleBinEntryDto): string {
    const anyE = e as unknown as Record<string, unknown>;
    const module = typeof anyE["module"] === "string" ? String(anyE["module"]).trim() : "";
    const entity = typeof anyE["entity"] === "string" ? String(anyE["entity"]).trim() : "";
    if (module && entity) return `${module} • ${entity}`;
    return module || entity || "Record";
  }

  private getOriginalLocationLabel(e: RecycleBinEntryDto): string {
    // Windows column "Original Location"
    // Use sourceKey/module/entity style if backend doesn't store original path.
    const anyE = e as unknown as Record<string, unknown>;
    const module = typeof anyE["module"] === "string" ? String(anyE["module"]).trim() : "";
    const entity = typeof anyE["entity"] === "string" ? String(anyE["entity"]).trim() : "";
    const sourceKey = typeof anyE["sourceKey"] === "string" ? String(anyE["sourceKey"]).trim() : "";
    const parts = [module, entity, sourceKey].filter((x) => !!x);
    return parts.length ? parts.join(" / ") : "System";
  }

  private getDeletedIso(e: RecycleBinEntryDto): string {
    const anyE = e as unknown as Record<string, unknown>;
    const iso = typeof anyE["deletedAtIso"] === "string" ? String(anyE["deletedAtIso"]).trim() : "";
    // fallback keys if your dto uses a different field name
    const alt = typeof anyE["deletedAt"] === "string" ? String(anyE["deletedAt"]).trim() : "";
    return iso || alt || "";
  }

  private getRecordIconKey(e: RecycleBinEntryDto): RecycleBinItemIconKey {
    // You can map by module/entity if you want (Lease->doc, Payments->xls, etc.)
    const anyE = e as unknown as Record<string, unknown>;
    const module = typeof anyE["module"] === "string" ? String(anyE["module"]).toLowerCase() : "";
    if (module.includes("lease")) return "doc";
    if (module.includes("payment")) return "xls";
    if (module.includes("property")) return "folder";
    return "file";
  }

  private getFileStableKey(f: FileMetaPacketDto): string {
    const anyF = f as unknown as Record<string, unknown>;
    const stored = typeof anyF["storedName"] === "string" ? String(anyF["storedName"]).trim() : "";
    const rel = typeof anyF["publicRel"] === "string" ? String(anyF["publicRel"]).trim() : "";
    const orig = typeof anyF["originalName"] === "string" ? String(anyF["originalName"]).trim() : "";
    return stored || rel || orig || "file";
  }

  private getFileName(f: FileMetaPacketDto): string {
    const anyF = f as unknown as Record<string, unknown>;
    const orig = typeof anyF["originalName"] === "string" ? String(anyF["originalName"]).trim() : "";
    const stored = typeof anyF["storedName"] === "string" ? String(anyF["storedName"]).trim() : "";
    return orig || stored || "File";
  }

  private getFileSize(f: FileMetaPacketDto): number {
    const anyF = f as unknown as Record<string, unknown>;
    const size = anyF["sizeBytes"];
    if (typeof size === "number" && Number.isFinite(size)) return size;
    const alt = anyF["size"];
    if (typeof alt === "number" && Number.isFinite(alt)) return alt;
    return 0;
  }

  private getFileTypeLabel(f: FileMetaPacketDto): string {
    // Windows column "Type"
    const name = this.getFileName(f);
    const ext = this.extOf(name);
    if (!ext) return "File";
    return `${ext.toUpperCase()} File`;
  }

  private getFileOriginalLocationLabel(f: FileMetaPacketDto, e: RecycleBinEntryDto): string {
    // If your file meta includes original path, use it.
    // Otherwise use entry’s "Original Location" as a realistic substitute.
    const anyF = f as unknown as Record<string, unknown>;
    const origRel = typeof anyF["originalRel"] === "string" ? String(anyF["originalRel"]).trim() : "";
    const origAbs = typeof anyF["originalAbs"] === "string" ? String(anyF["originalAbs"]).trim() : "";
    return origRel || origAbs || this.getOriginalLocationLabel(e);
  }

  private getFileIconKey(f: FileMetaPacketDto): RecycleBinItemIconKey {
    const name = this.getFileName(f);
    const ext = this.extOf(name);

    if (!ext) return "file";
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) return "image";
    if (["pdf"].includes(ext)) return "pdf";
    if (["doc", "docx", "rtf"].includes(ext)) return "doc";
    if (["xls", "xlsx", "csv"].includes(ext)) return "xls";
    if (["ppt", "pptx"].includes(ext)) return "ppt";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
    if (["json"].includes(ext)) return "json";
    if (["txt", "log"].includes(ext)) return "txt";
    if (["ts", "js", "html", "css", "scss", "md"].includes(ext)) return "code";
    return "unknown";
  }

  private extOf(filename: string): string {
    const n = typeof filename === "string" ? filename.trim() : "";
    const i = n.lastIndexOf(".");
    if (i <= 0) return "";
    const ext = n.slice(i + 1).toLowerCase().trim();
    return ext;
  }

  // =============================================================================
  // Safety
  // =============================================================================

  private safeId(v: string): string {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) throw new Error("RecycleBinCenter: entryId is required");
    return s;
  }

  private safeRowId(v: string): string {
    const s = typeof v === "string" ? v.trim() : "";
    return s || "row";
  }
}
