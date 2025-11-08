import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';

import {MatIcon} from '@angular/material/icon';

export interface DropzonePreviewItem {
  file: File;
  previewDataUrl?: string;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dropdown implements AfterViewInit, OnDestroy {
  // ─────────────────────────────────────────────────────────────
  // Inputs (customize per usage)
  // ─────────────────────────────────────────────────────────────

  /** Accept pattern for input element & validation (e.g., "image/*,application/pdf") */
  @Input() accept: string = 'image/*';

  /** Allow selecting more than one file */
  @Input() multiple: boolean = true;

  /** Maximum number of files allowed in the queue */
  @Input() maxFiles: number = 12;

  /** Maximum allowed file size in bytes (default 10MB) */
  @Input() maxSizeBytes: number = 10 * 1024 * 1024;

  /** Show inline previews (images) */
  @Input() showPreviews: boolean = true;

  /** Compact visual mode (smaller height, tighter paddings) */
  @Input() compact: boolean = false;

  /** Allow clipboard paste (screenshots, etc.) */
  @Input() enablePaste: boolean = true;

  /** Optional: override MIME whitelist; if empty we infer from `accept` */
  @Input() allowedMime: ReadonlyArray<string> = [];

  // ─────────────────────────────────────────────────────────────
  // Outputs
  // ─────────────────────────────────────────────────────────────

  /** Fires the full queue whenever it changes */
  @Output() filesChange = new EventEmitter<File[]>();

  /** Fires only new files appended in a single interaction */
  @Output() filesAdded = new EventEmitter<File[]>();

  /** Fires when a file is removed, emits the removed file */
  @Output() fileRemoved = new EventEmitter<File>();

  // ─────────────────────────────────────────────────────────────
  // Template refs & state
  // ─────────────────────────────────────────────────────────────
  @ViewChild('fileInput', {static: true}) fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('dropHost', {static: true}) dropHost!: ElementRef<HTMLElement>;

  protected isDragging = false;
  protected queue: DropzonePreviewItem[] = [];

  private dragEnterUnsub?: () => void;
  private dragOverUnsub?: () => void;
  private dragLeaveUnsub?: () => void;
  private dropUnsub?: () => void;

  private readonly isBrowser: boolean;

  public constructor (
    private readonly renderer: Renderer2,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle: attach/remove DnD listeners via Renderer2
  // ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    if(!this.isBrowser) return;
    const host = this.dropHost?.nativeElement;
    if(!host) return;

    this.dragEnterUnsub = this.renderer.listen(host, 'dragenter', (e: DragEvent) => this.onDragEnter(e));
    this.dragOverUnsub = this.renderer.listen(host, 'dragover', (e: DragEvent) => this.onDragOver(e));
    this.dragLeaveUnsub = this.renderer.listen(host, 'dragleave', (e: DragEvent) => this.onDragLeave(e));
    this.dropUnsub = this.renderer.listen(host, 'drop', (e: DragEvent) => this.onDrop(e));
  }

  ngOnDestroy(): void {
    this.dragEnterUnsub?.();
    this.dragOverUnsub?.();
    this.dragLeaveUnsub?.();
    this.dropUnsub?.();
  }

  // ─────────────────────────────────────────────────────────────
  // Public API for parent components
  // ─────────────────────────────────────────────────────────────

  /** Clear the queue programmatically */
  public clear(): void {
    this.queue = [];
    this.emitAll();
  }

  /** Get a snapshot of current files (without previews) */
  public getFiles(): File[] {
    return this.queue.map(q => q.file);
  }

  // ─────────────────────────────────────────────────────────────
  // Template handlers
  // ─────────────────────────────────────────────────────────────

  protected onBrowseClick(): void {
    this.fileInput.nativeElement.click();
  }

  protected onFileInputChanged(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if(!input?.files || input.files.length === 0) return;
    const justAdded = this.ingestFileList(input.files);
    input.value = ''; // allow re-select same file later
    if(justAdded.length > 0) {
      this.filesAdded.emit(justAdded);
      this.emitAll();
    }
  }

  private onDragEnter(e: DragEvent): void {
    this.prevent(e);
    this.isDragging = true;
  }

  private onDragOver(e: DragEvent): void {
    this.prevent(e);
    this.isDragging = true;
  }

  private onDragLeave(e: DragEvent): void {
    this.prevent(e);
    this.isDragging = false;
  }

  private onDrop(e: DragEvent): void {
    this.prevent(e);
    this.isDragging = false;
    if(!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    const justAdded = this.ingestFileList(e.dataTransfer.files);
    if(justAdded.length > 0) {
      this.filesAdded.emit(justAdded);
      this.emitAll();
    }
  }

  // Clipboard paste (document level) — only if enabled
  @HostListener('document:paste', ['$event'])
  protected onPaste(e: ClipboardEvent): void {
    if(!this.enablePaste) return;
    const target = e.target as HTMLElement | null;

    // Respect default paste behavior inside text fields/editor areas
    if(target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.hasAttribute('contenteditable')
    )) return;

    const items = e.clipboardData?.items;
    if(!items || items.length === 0) return;

    let added = false;
    const toAdd: File[] = [];

    for(const item of items) {
      if(item.kind !== 'file') continue;
      const file = item.getAsFile();
      if(file) {
        toAdd.push(file);
        added = true;
      }
    }

    if(added) {
      const justAdded = this.ingestFiles(toAdd);
      if(justAdded.length > 0) {
        this.filesAdded.emit(justAdded);
        this.emitAll();
      }
      e.preventDefault();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Core ingest + validation + preview
  // ─────────────────────────────────────────────────────────────

  /** Ingest a native FileList */
  private ingestFileList(list: FileList): File[] {
    return this.ingestFiles(Array.from(list));
  }

  /** Ingest an array of Files (drag/paste/input) */
  private ingestFiles(files: File[]): File[] {
    const allowed = this.resolveAllowedMime();
    const newOnes: File[] = [];

    for(const f of files) {
      // 1) Capacity
      if(this.queue.length >= this.maxFiles) break;

      // 2) MIME check
      if(!this.isAllowed(f, allowed)) continue;

      // 3) Size check
      if(f.size > this.maxSizeBytes) continue;

      // 4) de-dupe by name+size
      const exists = this.queue.some(q => q.file.name === f.name && q.file.size === f.size);
      if(exists) continue;

      newOnes.push(f);
    }

    if(newOnes.length === 0) return [];

    // 5) Create preview items (with DataURL for images)
    for(const file of newOnes) {
      if(this.showPreviews && file.type.startsWith('image/')) {
        this.readAsDataURL(file).then((url) => {
          this.queue = [...this.queue, {file, previewDataUrl: url}];
          this.emitAll(); // keep parent in sync even if previews resolve next-tick
        }).catch(() => {
          this.queue = [...this.queue, {file}];
          this.emitAll();
        });
      } else {
        this.queue = [...this.queue, {file}];
      }
    }

    return newOnes;
  }

  /** Remove a file by index */
  protected removeAt(i: number): void {
    if(i < 0 || i >= this.queue.length) return;
    const removed = this.queue[i].file;
    const next = [...this.queue];
    next.splice(i, 1);
    this.queue = next;
    this.fileRemoved.emit(removed);
    this.emitAll();
  }

  /** Emit the full file array to parent */
  private emitAll(): void {
    this.filesChange.emit(this.getFiles());
  }

  // ─────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────

  private prevent(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  /** Parse `accept` (e.g., "image/*,application/pdf") into MIME filters */
  private resolveAllowedMime(): ReadonlyArray<string> {
    if(this.allowedMime.length > 0) return this.allowedMime;

    const raw = (this.accept || '').split(',').map(s => s.trim()).filter(Boolean);
    // Keep wildcards like "image/*" intact; validate against startsWith later.
    return raw.length > 0 ? raw : ['*/*'];
  }

  /** Check MIME type against allowed list (supports wildcards like "image/*") */
  private isAllowed(file: File, allow: ReadonlyArray<string>): boolean {
    if(allow.includes('*/*')) return true;
    const type = file.type || '';
    for(const rule of allow) {
      if(rule.endsWith('/*')) {
        const base = rule.replace('/*', '');
        if(type.startsWith(base + '/')) return true;
      } else if(rule === type) {
        return true;
      }
    }
    return false;
  }

  /** Read a file as data URL for preview */
  private readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('readAsDataURL failed'));
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(file);
    });
  }
}

