// Path: src/app/components/user-view-card/user-view-card.component.ts
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
import {type User} from '../../services/APIs/apis.service';
import {AuthService} from '../../services/auth/auth.service';
import {WindowsRefService} from '../../services/windowRef/windowRef.service';
import {ImageService} from '../../services/imageService/image.service';

// Components
import {SkeletonLoaderComponent} from '../shared/skeleton-loader/skeleton-loader.component';



@Component({
  selector: 'app-user-view-card',
  imports: [
    // Angular core
    CommonModule,

    // Material UI
    MatIconModule,
    MatTooltipModule,

    // Components
    SkeletonLoaderComponent,
  ],
  templateUrl: './user-view-card.component.html',
  styleUrl: './user-view-card.component.scss'
})
export class UserViewCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({required: true}) user!: User;
  @Input({required: true}) viewMode: boolean = false;
  @Input({required: true}) isLoading !: boolean;
  @Input({required: false}) mode: boolean | null = null;
  @Output() viewUser: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() editUser: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() deleteUser: EventEmitter<boolean> = new EventEmitter<boolean>();




  protected readonly definedMaleDummyImageURL =
    'Images/user-images/dummy-user/dummy-user.jpg';
  protected readonly definedWomanDummyImageURL =
    'Images/user-images/dummy-user/dummy_woman.jpg';

  private userImage !: string;

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

  get activeUser(): boolean {
    return this.user.isActive;
  }

  // Operators methods
  protected viewUserFunction(): void {
    this.viewUser.emit(true);
  }

  protected editUserFunction(): void {
    this.editUser.emit(true);
  }

  protected deleteUserFunction(): void {
    this.deleteUser.emit(true);
  }

  // Helper operations
  protected detectUserImage(): string {
    return this.user.image as string;
  }

  

  /**
   * Public API: produce a safe, short, plain-text bio for card bodies.
   */
  protected filterPortionOfBio(user: User): string {
    try {
      if(!user) throw new Error('Invalid user!');
      if(!user.bio || typeof user.bio !== 'string') throw new Error('Invalid user bio!');

      // 1) Strip tags safely (DOMParser in browser, regex fallback for SSR/Electron)
      const plain = this.extractPlainText(user.bio);

      // 2) Normalize whitespace
      const compact = this.normalizeWhitespace(plain);

      // 3) Return a tidy preview (default 140 chars)
      const endTail = compact.length > 140 ? '...' : '.'
      return this.truncateAtWordBoundary(compact, 140) + endTail;
    } catch(err) {
      console.error('Processing user bio failed: ', err);
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
