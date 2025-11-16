// Path: src/app/components/property-view-card/property-view-card.component.ts
// Angular core
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID, AfterViewInit, HostListener
} from '@angular/core';

// Material UI
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';

// Services
import {AuthService} from '../../services/auth/auth.service';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';
import {BackEndPropertyData} from '../../services/property/property.service';
import {ImageService} from '../../services/imageService/image.service';

// Components
import {SkeletonLoaderComponent} from '../shared/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-property-view-card',
  imports: [
    // Angular core
    CommonModule,

    // Material UI
    MatIconModule,
    MatTooltipModule,

    // Components
    SkeletonLoaderComponent,
  ],
  standalone: true,
  templateUrl: './property-view-card.component.html',
  styleUrl: './property-view-card.component.scss',
})
export class PropertyViewCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({required: true}) property!: BackEndPropertyData;
  @Input({required: true}) viewMode !: boolean;
  @Input({required: true}) isLoading: boolean = true;
  @Input({required: false}) mode: boolean | null = null;
  @Output() viewProperty: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() editProperty: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() deleteProperty: EventEmitter<boolean> = new EventEmitter<boolean>();

  protected readonly definedPropertyImage =
    'Images/System-images/noProperties.jpg';
  private propertyImage !: string;

  constructor (
    private readonly authService: AuthService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    private readonly windiwRef: WindowsRefService,
    private readonly imageService: ImageService
  ) {
  }

  // Lifecycles
  async ngOnInit(): Promise<void> {

  }

  async ngAfterViewInit(): Promise<void> {

  }



  ngOnDestroy(): void {

  }

  // Operators methods
  protected viewPropertyFunction(): void {
    this.viewProperty.emit(true);
  }

  protected editPropertyFunction(): void {
    this.editProperty.emit(true);
  }

  protected deletePropertyFunction(): void {
    this.deleteProperty.emit(true);
  }

  // Helper operations
  protected detectPropertyImage(): string {
    return this.property.images[0].imageURL ? this.property.images[0].imageURL : this.definedPropertyImage;
  }

  protected detectImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;

    // Prevent infinite loop if fallback image also fails
    if(imgElement.src.includes(this.definedPropertyImage)) {
      return;
    }

    // Apply fallback image
    imgElement.src = this.definedPropertyImage
  }



  protected detectTypeIcon(property: BackEndPropertyData): string {
    try {
      if(!property || !property.type)
        throw new Error('Property is invalid or has no type');

      const type = property.type.trim().toLowerCase();

      // Material icon mapping
      const iconMap: Record<string, string> = {
        apartment: 'apartment',             // 🏢
        house: 'home',                      // 🏠
        villa: 'villa',                     // 🏛️ (Material symbol)
        commercial: 'storefront',           // 🏬
        land: 'terrain',                    // 🌄
        studio: 'meeting_room',             // 🎥 or single-room concept
      };

      // Safe fallback if no matching key
      const icon = iconMap[type];
      if(!icon) throw new Error(`Unknown property type: ${property.type}`);

      return icon;
    } catch(err) {
      console.error('Property icon process failed:', err);
      return 'home'; // universal fallback
    }
  }


  protected makeUppercase(input: unknown): string {
    try {
      if(!input || typeof input !== 'string') throw new Error('Input value either invalid or empty!');
      const text = input.toUpperCase();
      return text.trim();
    }
    catch(err) {
      console.error(err);
      return '';
    }
  }

  /**
   * Public API: produce a safe, short, plain-text bio for card bodies.
   */
  protected filterPortionOfDescription(property: BackEndPropertyData): string {
    try {
      if(!property) throw new Error('Invalid property!');
      if(!property.description || typeof property.description !== 'string') throw new Error('Invalid property description!');

      // 1) Strip tags safely (DOMParser in browser, regex fallback for SSR/Electron)
      const plain = this.extractPlainText(property.description);

      // 2) Normalize whitespace
      const compact = this.normalizeWhitespace(plain);

      // 3) Return a tidy preview (default 140 chars)
      const endTail = compact.length > 140 ? '...' : '.'
      return this.truncateAtWordBoundary(compact, 140) + endTail;
    } catch(err) {
      console.error('Processing property description failed: ', err);
      return '';
    }
  }

  // ────────────────────────────────
  // Helpers (kept class-based)
  // ────────────────────────────────

  /**
   * Convert HTML to plain text.
   * Browser: uses DOMParser for robust tag removal & entity decoding.
   * SSR/Electron: strips tags & decodes a safe subset of entities.
   */
  private extractPlainText(html: string): string {
    if(this.isBrowser()) {
      // DOMParser reliably removes all tags & decodes entities.
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body.textContent ?? '').trim();
    }

    // SSR/Electron fallback: strip <script>/<style>, then all tags.
    const noCode = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ');

    // Decode a minimal, common entity set (extend if needed).
    return this.decodeEntities(noCode).trim();
  }

  /**
   * Collapse whitespace and non-breaking spaces to single spaces.
   */
  private normalizeWhitespace(input: string): string {
    return input
      .replace(/\u00A0/g, ' ')   // NBSP → space
      .replace(/\s+/g, ' ')      // collapse runs of whitespace
      .trim();
  }

  /**
   * Truncate without cutting words in half; adds an ellipsis when truncated.
   * Ensures a sensible minimum before falling back to hard cut.
   */
  private truncateAtWordBoundary(input: string, maxLen: number): string {
    if(input.length <= maxLen) return input;

    const slice = input.slice(0, maxLen);
    const lastSpace = slice.lastIndexOf(' ');

    // Prefer trimming at a word boundary if it keeps at least ~80 chars
    const cutoff = lastSpace >= Math.min(80, Math.floor(maxLen * 0.6)) ? lastSpace : maxLen;
    return input.slice(0, cutoff).trimEnd() + '…';
  }

  /**
   * Minimal HTML entity decoder for SSR/Electron fallback.
   * Add more entities as your content requires.
   */
  private decodeEntities(text: string): string {
    const map: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
    };
    return text.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => map[m] ?? m);
  }

  /**
   * Runtime guard for browser-only features (e.g., DOMParser).
   */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
