// Path: src/app/components/shared/comments/comments-list.component.ts
// ============================================================================
// CommentsListComponent — Drop-in Full Version (Pinned + Own Edit/Delete)
// ----------------------------------------------------------------------------
// RULES FOLLOWED:
//   ✅ WebSocket listeners in ONE place (broadcast-only sync via facade streams)
//   ✅ REST is Observable-only (no Promise / firstValueFrom in component)
//   ✅ Component never builds FormData (attachments passed as File[] to facade)
//   ✅ Own comments: only author can edit/delete
//   ✅ Pinned roots shown separately at top
//   ✅ SSR/Electron safe: no browser-only logic on server
// ============================================================================

import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDialog } from "@angular/material/dialog";

import { HttpErrorResponse } from "@angular/common/http";
import { EMPTY, Subject } from "rxjs";
import { catchError, finalize, takeUntil } from "rxjs/operators";

import type { User } from "../../../services/APIs/apis.service";
import { AuthService } from "../../../services/auth/auth.service";

import { CommentEngineFacadeService } from "../../../services/comments/services/comment-engine.facade.service";

import type {
  CommentAudience,
  CommentDto,
  CommentRestAddRequest,
  CommentSectionKey,
  CommentSortOrder,
  CommentTargetDto,
} from "../../../services/comments/contracts/comment.contract";
import { CommentAudienceValues, CommentSectionKeyValues } from "../../../services/comments/contracts/comment.contract";

import { Dropdown } from "../dropdown/dropdown";
import { TextEditorComponent } from "../textEditor/text-editor";
import { Textarea } from "../textarea/textarea.component";

import {
  DEFAULT_ROLES,
  UserRoleLabelHelper,
  type Role,
} from "../../../services/auth/user.contract";

import { NotificationDialogComponent } from "../../dialogs/notificationBar/notificationBar.component";
import { ProgressBarComponent } from "../../dialogs/progress-bar/progress-bar.component";
import { ConfirmationComponent } from "../confirmation/confirmation.component";

import type { MSG } from "../../../types/api-message.types";

// ----------------------------------------------------------------------------
// Json-safe scope helpers (for target.scope usage in replies)
// ----------------------------------------------------------------------------
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [ k: string ]: JsonValue; };
type JsonObject = { [ k: string ]: JsonValue; };

type CommentsMode = "minimum" | "advanced";

interface CommentThreadNode {
  id: string; // commentId
  comment: CommentDto;
  children: CommentThreadNode[];
  depth: number;
}

@Component( {
  selector: "app-comments-list",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,

    TextEditorComponent,
    Textarea,
    Dropdown,
    ProgressBarComponent,
    NotificationDialogComponent,
  ],
  templateUrl: "./comments-list.component.html",
  styleUrl: "./comments-list.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class CommentsListComponent implements OnInit, OnChanges, OnDestroy {
  // ===========================================================================
  // ViewChildren
  // ===========================================================================
  @ViewChild( NotificationDialogComponent, { static: true } )
  public notificationBar!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent, { static: true } )
  public progressBar!: ProgressBarComponent;

  @ViewChild( Dropdown, { static: false } )
  public dropdown: Dropdown | null = null;

  // ===========================================================================
  // REQUIRED input (Parent -> Child)
  // ===========================================================================
  @Input( { required: true } ) public context!: CommentTargetDto;

  // ===========================================================================
  // Feature toggles
  // ===========================================================================
  @Input() public mode: CommentsMode = "minimum";
  @Input() public enableCounts = true;

  @Input() public enableClientSearch = true;
  @Input() public enableServerSearch = false;

  @Input() public showComposer = true;

  @Input() public limit = 6;
  @Input() public sort: CommentSortOrder = "newest";

  @Input() public scopeKey?: string;
  @Input() public scopeValue?: string;

  @Input() public listAudience?: CommentAudience;

  // ===========================================================================
  // Internal state
  // ===========================================================================
  public Math: Math = Math;

  // Raw loaded rows (from backend)
  public comments: CommentDto[] = [];

  // Thread roots for the current visible page
  public threadRoots: CommentThreadNode[] = [];

  // Split pinned roots (top section)
  public pinnedRoots: CommentThreadNode[] = [];
  public normalRoots: CommentThreadNode[] = [];

  private _clearFiles = false;
  public get clearFiles(): boolean {
    return this._clearFiles;
  }
  public set clearFiles( value: boolean ) {
    this._clearFiles = value;
  }

  public isLoading = false;
  public hasMoreFromServer = false;

  public totalTarget = 0;
  public pageIndex = 0;
  public searchText = "";

  // Composer (ROOT only)
  public composerAudience: CommentAudience = "member";
  public comment = "";
  private selectedAttachments: File[] = [];

  // Replies (text-only)
  public openedReplyForId: string | null = null;
  public replyTextById: Record<string, string> = {};
  public isReplySubmittingById: Record<string, boolean> = {};

  // Edit (own comments)
  public openedEditForId: string | null = null;
  public editTextById: Record<string, string> = {};
  public isEditSubmittingById: Record<string, boolean> = {};

  // Role/audience selection
  public composerAudienceOptions: CommentAudience[] = [];
  protected readonly defaultRoles: readonly Role[] = DEFAULT_ROLES;

  protected readonly DUMMY_AVATAR = "Images/user-images/dummy-user/dummy-user.jpg";
  protected loggedUser: User | null = null;

  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  private readonly destroy$ = new Subject<void>();

  public constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly facade: CommentEngineFacadeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
  ) {
    this.loggedUser = this.authService.getLoggedUser ?? null;
    this.rebuildAudienceOptions();
  }

  // ===========================================================================
  // Role helpers
  // ===========================================================================
  private get loggedRole(): string {
    const roleRaw = ( this.loggedUser as unknown as { role?: unknown; } | null )?.role;
    return String( roleRaw ?? "" ).trim().toLowerCase();
  }

  public get canUseRichEditor(): boolean {
    return this.isRoleOneOf( [ "admin", "operator", "manager" ] );
  }

  public get canSelectAudience(): boolean {
    return this.isRoleOneOf( [ "admin", "operator", "manager" ] );
  }

  protected convertRoleIntoHumanReadable( role: string ): string {
    return UserRoleLabelHelper.toHuman( role );
  }

  private isRoleOneOf( roles: string[] ): boolean {
    const r = this.loggedRole;
    return !!r && roles.includes( r );
  }

  private buildAllowedAudiencesForRole( role: string ): CommentAudience[] {
    const all = ( CommentAudienceValues as readonly string[] ) as CommentAudience[];

    if ( role === "admin" ) return [ ...all ];

    if ( role === "manager" || role === "operator" ) {
      // Conservative: still allow all (your requirement), but easily clamp later
      return all.length ? [ ...all ] : [ "all" ];
    }

    // Regular users: simplest visibility
    return [ "all" ];
  }

  private rebuildAudienceOptions(): void {
    const options = this.buildAllowedAudiencesForRole( this.loggedRole );
    this.composerAudienceOptions = options;

    if ( !options.includes( this.composerAudience ) ) {
      this.composerAudience = options[ 0 ] ?? "all";
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  public ngOnInit(): void {
    if ( !this.isBrowserSafe() ) return;

    this.loggedUser = this.authService.getLoggedUser ?? null;
    this.rebuildAudienceOptions();

    this.initWsStreams();
    this.resetAndReload();
  }

  public ngOnChanges( changes: SimpleChanges ): void {
    if ( !this.isBrowserSafe() ) return;

    if (
      changes[ "context" ] ||
      changes[ "mode" ] ||
      changes[ "listAudience" ] ||
      changes[ "sort" ]
    ) {
      this.resetAndReload();
      return;
    }

    if ( changes[ "limit" ] ) {
      this.limit = this.normalizeLimit( this.limit );
      this.pageIndex = 0;
      this.reloadCurrentPage( false );
      this.refreshCountIfEnabled();
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if ( this.searchDebounceHandle ) {
      clearTimeout( this.searchDebounceHandle );
      this.searchDebounceHandle = undefined;
    }
  }

  // ===========================================================================
  // WebSocket listeners in ONE place (broadcast-only sync)
  // ===========================================================================
  private initWsStreams(): void {
    // NOTE: These streams are expected to already be scoped by the facade
    // or broadcast globally — we reload current view for consistency.

    this.facade.created$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => {
        this.pageIndex = 0;
        this.reloadCurrentPage( false );
        this.refreshCountIfEnabled();
      } );

    this.facade.updated$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => {
        this.reloadCurrentPage( false );
      } );

    this.facade.deleted$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => {
        this.pageIndex = 0;
        this.reloadCurrentPage( false );
        this.refreshCountIfEnabled();
      } );

    this.facade.pinned$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => {
        this.reloadCurrentPage( false );
      } );

    this.facade.unpinned$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => {
        this.reloadCurrentPage( false );
      } );

    this.facade.toggled$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( () => {
        this.reloadCurrentPage( false );
      } );

    this.facade.error$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe( ( err ) => {
        // eslint-disable-next-line no-console
        console.error( "[Warning:] [CommentsListComponent] WS error.\n", err, "\n" );
      } );
  }

  // ===========================================================================
  // Template-safe accessors (NO "(x as any)" in HTML)
  // ===========================================================================
  public audLower( c: CommentDto ): string {
    const audience = this.safeString( ( c as unknown as { audience?: unknown; } | null )?.audience );
    return audience.toLowerCase();
  }

  public byName( c: CommentDto ): string {
    return this.safeString( ( c as unknown as { byName?: unknown; } | null )?.byName ) || "Unknown user";
  }

  public byUserId( c: CommentDto ): string {
    return this.safeString( ( c as unknown as { byUserId?: unknown; } | null )?.byUserId );
  }

  public authorRole( c: CommentDto ): string {
    const role = ( c as unknown as { author?: { role?: unknown; } | null; } | null )?.author?.role;
    return this.safeString( role );
  }

  public createdAtIso( c: CommentDto ): string {
    return this.safeString( ( c as unknown as { createdAtIso?: unknown; } | null )?.createdAtIso );
  }

  public pinnedAtIso( c: CommentDto ): string {
    return this.safeString( ( c as unknown as { pinnedAtIso?: unknown; } | null )?.pinnedAtIso );
  }

  public avatarUrl( c: CommentDto ): string {
    const byAvatarUrl = this.safeString( ( c as unknown as { byAvatarUrl?: unknown; } | null )?.byAvatarUrl );
    if ( byAvatarUrl ) return byAvatarUrl;

    const authorImage = this.safeString( ( c as unknown as { author?: { image?: unknown; } | null; } | null )?.author?.image );
    if ( authorImage ) return authorImage;

    return this.DUMMY_AVATAR;
  }

  public messageHtml( c: CommentDto ): string {
    return this.safeString( ( c as unknown as { messageHtml?: unknown; } | null )?.messageHtml );
  }

  public attachments(
    c: CommentDto
  ): Array<{ name: string; url: string; mimetype?: string | null; }> {
    const raw = ( c as unknown as { attachments?: unknown; } | null )?.attachments;
    if ( !Array.isArray( raw ) ) return [];
    return raw
      .map( ( x ) => x as { name?: unknown; url?: unknown; mimetype?: unknown; } )
      .filter( ( x ) => !!this.safeString( x?.name ) && !!this.safeString( x?.url ) )
      .map( ( x ) => ( {
        name: this.safeString( x.name ),
        url: this.safeString( x.url ),
        mimetype: this.safeNullableString( x.mimetype ),
      } ) );
  }

  public commentId( c: CommentDto ): string {
    const id = this.safeString( ( c as unknown as { commentId?: unknown; } | null )?.commentId );
    return id.trim();
  }

  private readScope( c: CommentDto ): JsonObject | null {
    const scope = ( c as unknown as { commentTarget?: { scope?: unknown; } | null; } | null )?.commentTarget?.scope;
    if ( !scope || typeof scope !== "object" ) return null;
    return scope as JsonObject;
  }

  public parentCommentId( c: CommentDto ): string | null {
    const scope = this.readScope( c );
    const v = scope ? this.safeString( scope[ "parentCommentId" ] ) : "";
    return v ? v : null;
  }

  public rootCommentId( c: CommentDto ): string | null {
    const scope = this.readScope( c );
    const v = scope ? this.safeString( scope[ "rootCommentId" ] ) : "";
    return v ? v : null;
  }

  public isRootNode( node: CommentThreadNode ): boolean {
    return node.depth === 0;
  }

  public hasAttachments( c: CommentDto ): boolean {
    return this.attachments( c ).length > 0;
  }

  public isPinned( c: CommentDto ): boolean {
    const v = c.pinned ?? false;
    return Boolean( v );
  }

  public displayFileName( name: string ): string {
    const n = this.safeString( name );
    return n.length > 30 ? `${ n.slice( 0, 30 ) }…` : n;
  }

  // ===========================================================================
  // OWN comment permissions
  // ===========================================================================
  public canManageOwn( c: CommentDto ): boolean {
    const me = this.loggedUser?.username;
    const author = c.byUsername;
    const canManage = me === author;
    return canManage;
  }

  // ===========================================================================
  // Derived UI helpers (client search/paging)
  // ===========================================================================
  public get filteredComments(): CommentDto[] {
    const list = Array.isArray( this.comments ) ? this.comments : [];
    if ( !this.enableClientSearch ) return list;

    const q = this.safeString( this.searchText ).trim().toLowerCase();
    if ( !q ) return list;

    return list.filter( ( c ) => {
      const byName = this.byName( c ).toLowerCase();
      const audience = this.audLower( c );

      const messagePlain = this.messageHtml( c )
        .replace( /<[^>]*>/g, " " )
        .replace( /\s+/g, " " )
        .trim()
        .toLowerCase();

      const attachmentNames = this.attachments( c )
        .map( ( a ) => this.safeString( a?.name ).toLowerCase() )
        .join( " " );

      return (
        byName.includes( q ) ||
        audience.includes( q ) ||
        messagePlain.includes( q ) ||
        attachmentNames.includes( q )
      );
    } );
  }

  public get totalFiltered(): number {
    return this.filteredComments.length;
  }

  public get totalPages(): number {
    const size = this.normalizeLimit( this.limit );
    const pages = Math.ceil( this.totalFiltered / size );
    return Math.max( pages, 1 );
  }

  public get visibleComments(): CommentDto[] {
    const size = this.normalizeLimit( this.limit );
    const startIndex = this.pageIndex * size;
    const endIndex = startIndex + size;
    return this.filteredComments.slice( startIndex, endIndex );
  }

  public audienceLabel( c: CommentDto ): string {
    const raw = this.safeString( ( c as unknown as { audience?: unknown; } | null )?.audience ).trim();
    if ( !raw ) return "Unknown";

    return raw
      .split( "_" )
      .map( ( word ) =>
        word.length > 0
          ? word.charAt( 0 ).toUpperCase() + word.slice( 1 ).toLowerCase()
          : ""
      )
      .join( " " );
  }

  // ===========================================================================
  // Thread building (from CURRENT visible page)
  // ===========================================================================
  private rebuildThreadTreeFromVisible(): void {
    const roots = this.buildThreadTree( this.visibleComments );

    const pinned: CommentThreadNode[] = [];
    const normal: CommentThreadNode[] = [];

    for ( const r of roots ) {
      if ( this.isRootNode( r ) && this.isPinned( r.comment ) ) pinned.push( r );
      else normal.push( r );
    }

    // Sort pinned by pinnedAtIso desc; fallback createdAtIso
    pinned.sort( ( a, b ) => {
      const ap = new Date( this.pinnedAtIso( a.comment ) || this.createdAtIso( a.comment ) ).getTime();
      const bp = new Date( this.pinnedAtIso( b.comment ) || this.createdAtIso( b.comment ) ).getTime();
      return bp - ap;
    } );

    this.threadRoots = roots;
    this.pinnedRoots = pinned;
    this.normalRoots = normal;

    this.cdr.markForCheck();
  }

  private buildThreadTree( rows: CommentDto[] ): CommentThreadNode[] {
    const nodeById = new Map<string, CommentThreadNode>();
    const roots: CommentThreadNode[] = [];

    // 1) Nodes
    for ( const c of rows ) {
      const id = this.commentId( c );
      if ( !id ) continue;
      nodeById.set( id, { id, comment: c, children: [], depth: 0 } );
    }

    // 2) Links
    for ( const node of nodeById.values() ) {
      const parentId = this.parentCommentId( node.comment );

      if ( parentId && nodeById.has( parentId ) ) {
        const parent = nodeById.get( parentId )!;
        node.depth = parent.depth + 1;
        parent.children.push( node );
      } else {
        roots.push( node );
      }
    }

    // 3) Sort stable
    const sortDir = this.sort === "oldest" ? 1 : -1;

    const sortNodes = ( list: CommentThreadNode[] ): void => {
      list.sort( ( a, b ) => {
        const at = new Date( this.createdAtIso( a.comment ) ).getTime();
        const bt = new Date( this.createdAtIso( b.comment ) ).getTime();
        return ( at - bt ) * sortDir;
      } );
      for ( const n of list ) sortNodes( n.children );
    };

    sortNodes( roots );
    return roots;
  }

  // ===========================================================================
  // Toolbar actions
  // ===========================================================================
  public onSearchInputChange( value: string ): void {
    this.searchText = value ?? "";
    this.pageIndex = 0;

    if ( this.enableServerSearch ) {
      if ( this.searchDebounceHandle ) clearTimeout( this.searchDebounceHandle );

      this.searchDebounceHandle = setTimeout( () => {
        this.reloadCurrentPage( false );
        this.refreshCountIfEnabled();
      }, 350 );
    }

    this.rebuildThreadTreeFromVisible();
  }

  public clearSearch(): void {
    this.searchText = "";
    this.pageIndex = 0;

    if ( this.enableServerSearch ) {
      this.reloadCurrentPage( false );
      this.refreshCountIfEnabled();
    }

    this.rebuildThreadTreeFromVisible();
  }

  public onRefreshClick(): void {
    this.pageIndex = 0;
    this.reloadCurrentPage( false );
    this.refreshCountIfEnabled();
  }

  // ===========================================================================
  // Pagination (client paging + backend append)
  // ===========================================================================
  public onPreviousPage(): void {
    this.pageIndex = Math.max( this.pageIndex - 1, 0 );
    this.rebuildThreadTreeFromVisible();
  }

  public onNextPage(): void {
    const nextIndex = this.pageIndex + 1;

    if ( this.canServePageFromLoadedData( nextIndex ) ) {
      this.pageIndex = nextIndex;
      this.rebuildThreadTreeFromVisible();
      return;
    }

    if ( this.hasMoreFromServer && !this.isLoading ) {
      this.loadPageFromBackend( nextIndex, true );
      return;
    }

    const maxIndex = Math.max( 0, this.totalPages - 1 );
    this.pageIndex = Math.min( nextIndex, maxIndex );
    this.rebuildThreadTreeFromVisible();
  }

  private canServePageFromLoadedData( nextPageIndex: number ): boolean {
    const size = this.normalizeLimit( this.limit );
    const needed = ( nextPageIndex + 1 ) * size;
    return this.filteredComments.length >= needed;
  }

  // ===========================================================================
  // Attachments (ROOT composer only)
  // ===========================================================================
  public onAttachmentsSelected( files: File[] ): void {
    this.selectedAttachments = Array.isArray( files ) ? files : [];
    this.cdr.markForCheck();
  }

  // ===========================================================================
  // SUBMIT PIPELINE (ONE PLACE)
  // ===========================================================================
  private submitComment$( req: CommentRestAddRequest, uiSuccessMessage: string ): void {
    this.progressBar.start();
    this.isLoading = true;
    this.cdr.markForCheck();

    this.facade
      .addComment( req )
      .pipe(
        takeUntil( this.destroy$ ),
        catchError( ( err ) => {
          // eslint-disable-next-line no-console
          console.error( "[Error:] [CommentsListComponent] submit failed.\n", err, "\n" );
          this.errorMessageNotification( err );
          return EMPTY;
        } ),
        finalize( () => {
          this.isLoading = false;

          // Reset composer UI safely
          this.comment = "";
          this.clearFiles = true;

          if ( this.dropdown ) {
            try {
              this.dropdown.clear();
            } catch ( e ) {
              // eslint-disable-next-line no-console
              console.warn( "[Warning:] [CommentsListComponent] dropdown.clear failed.\n", e, "\n" );
            }
          }

          this.selectedAttachments = [];
          this.openedReplyForId = null;

          // Reset edit state too
          this.openedEditForId = null;

          this.pageIndex = 0;
          this.reloadCurrentPage( false );
          this.refreshCountIfEnabled();

          this.progressBar.complete();
          this.cdr.markForCheck();
        } )
      )
      .subscribe( ( msg: MSG ) => {
        if ( !msg?.success ) {
          throw new Error( msg?.message ?? "Comment submit failed." );
        }
        this.notificationBar.notification( "success", uiSuccessMessage );
      } );
  }

  // ===========================================================================
  // ROOT submit
  // ===========================================================================
  public onCommentSubmit(): void {
    const message = this.safeString( this.comment ).trim();
    if ( !message ) return;

    const ctx = this.getContextOrThrow();
    const target = this.buildTargetJson( ctx, null );

    const req: CommentRestAddRequest = {
      messageHtml: message,
      audience: this.buildAudience(),
      commentTargetJson: JSON.stringify( target ),
      ...( this.selectedAttachments.length ? { attachments: this.selectedAttachments } : {} ),
    };

    this.submitComment$( req, "Add comment success." );
  }

  private buildAudience(): CommentAudience {
    const audience = this.safeString( this.composerAudience ).trim().toLowerCase();
    const found = ( CommentAudienceValues as readonly CommentAudience[] ).find(
      ( item ) => this.safeString( item ).toLowerCase() === audience
    );
    return found ?? "all";
  }

  // ===========================================================================
  // Replies (text-only)
  // ===========================================================================
  public toggleReplyBox( node: CommentThreadNode ): void {
    const id = node.id;

    if ( this.openedReplyForId === id ) {
      this.openedReplyForId = null;
      this.cdr.markForCheck();
      return;
    }

    this.openedReplyForId = id;
    if ( typeof this.replyTextById[ id ] !== "string" ) this.replyTextById[ id ] = "";
    this.cdr.markForCheck();
  }

  public cancelReply( node: CommentThreadNode ): void {
    const id = node.id;
    this.openedReplyForId = null;
    this.replyTextById[ id ] = "";
    this.cdr.markForCheck();
  }

  public isReplyOpen( node: CommentThreadNode ): boolean {
    return this.openedReplyForId === node.id;
  }

  public getReplyText( node: CommentThreadNode ): string {
    return this.safeString( this.replyTextById[ node.id ] );
  }

  public setReplyText( node: CommentThreadNode, value: string ): void {
    this.replyTextById[ node.id ] = value ?? "";
  }

  public submitReply( node: CommentThreadNode ): void {
    const parentId = node.id;
    const message = this.safeString( this.replyTextById[ parentId ] ).trim();
    if ( !message ) return;

    this.isReplySubmittingById[ parentId ] = true;
    this.cdr.markForCheck();

    try {
      const ctx = this.getContextOrThrow();
      const rootId = this.rootCommentId( node.comment ) ?? parentId;

      const threadScope: JsonObject = {
        parentCommentId: parentId,
        rootCommentId: rootId,
      };

      const target = this.buildTargetJson( ctx, threadScope );

      const req: CommentRestAddRequest = {
        messageHtml: message,
        audience: this.buildAudience(),
        commentTargetJson: JSON.stringify( target ),
      };

      this.submitComment$( req, "Reply sent." );
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.error( "[Error:] [CommentsListComponent] reply failed.\n", err, "\n" );
      this.errorMessageNotification( err );
    } finally {
      this.replyTextById[ parentId ] = "";
      this.openedReplyForId = null;
      this.isReplySubmittingById[ parentId ] = false;
      this.cdr.markForCheck();
    }
  }

  // ===========================================================================
  // PIN/UNPIN (ROOT ONLY)
  // ===========================================================================
  public togglePin( node: CommentThreadNode ): void {
    if ( !this.isRootNode( node ) ) return;

    const id = node.id;
    const nextPinned = !this.isPinned( node.comment );

    this.facade
      .pinToggle( id, nextPinned )
      .pipe(
        takeUntil( this.destroy$ ),
        catchError( ( err ) => {
          // eslint-disable-next-line no-console
          console.error( "[Error:] [CommentsListComponent] pin/unpin failed.\n", err, "\n" );
          this.notificationBar.notification( "error", "Pin/Unpin failed." );
          return EMPTY;
        } )
      )
      .subscribe( ( msg: MSG ) => {
        if ( !msg?.success ) {
          throw new Error( msg?.message ?? "Pin/Unpin failed." );
        }

        // Optimistic UI update (then reload will normalize)
        ( node.comment as unknown as { pinned?: boolean; } ).pinned = nextPinned;

        this.notificationBar.notification( "success", nextPinned ? "Pinned." : "Unpinned." );
        this.reloadCurrentPage( false );
      } );
  }

  // ===========================================================================
  // EDIT (own comments only)
  // ===========================================================================
  public toggleEdit( node: CommentThreadNode ): void {
    if ( !this.canManageOwn( node.comment ) ) return;

    const id = node.id;

    if ( this.openedEditForId === id ) {
      this.openedEditForId = null;
      this.cdr.markForCheck();
      return;
    }

    this.openedEditForId = id;

    // preload
    const html = this.messageHtml( node.comment );
    const plain = html.replace( /<[^>]*>/g, " " ).replace( /\s+/g, " " ).trim();

    if ( typeof this.editTextById[ id ] !== "string" || !this.editTextById[ id ] ) {
      this.editTextById[ id ] = plain;
    }

    this.cdr.markForCheck();
  }

  public isEditOpen( node: CommentThreadNode ): boolean {
    return this.openedEditForId === node.id;
  }

  public getEditText( node: CommentThreadNode ): string {
    return this.safeString( this.editTextById[ node.id ] );
  }

  public setEditText( node: CommentThreadNode, value: string ): void {
    this.editTextById[ node.id ] = value ?? "";
  }

  public cancelEdit( node: CommentThreadNode ): void {
    this.openedEditForId = null;
    this.editTextById[ node.id ] = "";
    this.cdr.markForCheck();
  }

  public submitEdit( node: CommentThreadNode ): void {
    if ( !this.canManageOwn( node.comment ) ) return;

    const id = node.id;
    const txt = this.safeString( this.editTextById[ id ] ).trim();
    if ( !txt ) return;

    this.isEditSubmittingById[ id ] = true;
    this.cdr.markForCheck();

    // If backend expects HTML: wrap in <p>
    const messageHtml = `<p>${ this.escapeHtml( txt ) }</p>`;


    this.facade
      .edit( {
        id,
        messageHtml,
      } )
      .pipe(
        takeUntil( this.destroy$ ),
        catchError( ( err ) => {
          // eslint-disable-next-line no-console
          console.error( "[Error:] [CommentsListComponent] edit failed.\n", err, "\n" );
          this.errorMessageNotification( err );
          return EMPTY;
        } ),
        finalize( () => {
          this.isEditSubmittingById[ id ] = false;
          this.openedEditForId = null;
          this.cdr.markForCheck();
        } )
      )
      .subscribe( ( msg: MSG ) => {
        if ( !msg?.success ) throw new Error( msg?.message ?? "Edit failed." );

        this.notificationBar.notification( "success", "Comment updated." );
        this.reloadCurrentPage( false );
      } );
  }

  // ===========================================================================
  // DELETE (own comments only)
  // ===========================================================================
  public deleteOwn( node: CommentThreadNode ): void {
    if ( !this.canManageOwn( node.comment ) ) return;

    const id = node.id;

    const dialogRef = this.dialog.open( ConfirmationComponent, {
      width: '400px',
      height: 'auto',
      data: {
        title: 'Confirm Delete comment',
        message: 'Do you wish to delete the comment!'
      }
    } );

    dialogRef.afterClosed().subscribe( ( v ) => {
      if ( v ) {
        this.facade
          .delete( id )
          .pipe(
            takeUntil( this.destroy$ ),
            catchError( ( err ) => {
              // eslint-disable-next-line no-console
              console.error( "[Error:] [CommentsListComponent] delete failed.\n", err, "\n" );
              this.errorMessageNotification( err );
              return EMPTY;
            } )
          )
          .subscribe( ( msg: MSG ) => {
            if ( !msg?.success ) throw new Error( msg?.message ?? "Delete failed." );

            this.notificationBar.notification( "success", "Comment deleted." );
            this.pageIndex = 0;
            this.reloadCurrentPage( false );
            this.refreshCountIfEnabled();
          } );
      }
    } );


  }

  // ===========================================================================
  // Loading orchestration (REST only)
  // ===========================================================================
  private resetAndReload(): void {
    this.pageIndex = 0;
    this.searchText = "";
    this.comments = [];

    this.threadRoots = [];
    this.pinnedRoots = [];
    this.normalRoots = [];

    this.hasMoreFromServer = false;
    this.totalTarget = 0;

    this.loggedUser = this.authService.getLoggedUser ?? null;
    this.rebuildAudienceOptions();

    this.reloadCurrentPage( false );
    this.refreshCountIfEnabled();
  }

  private reloadCurrentPage( append: boolean ): void {
    this.loadPageFromBackend( this.pageIndex, append );
  }

  private loadPageFromBackend( pageIndex: number, append: boolean ): void {
    if ( !this.isBrowserSafe() ) return;

    const ctx = this.getContextOrThrow();

    this.isLoading = true;
    this.cdr.markForCheck();

    const size = this.normalizeLimit( this.limit );
    const start = pageIndex * size;

    const q = this.safeString( this.searchText ).trim();
    const query = q.length ? q : "";

    const scopePair = this.resolveScopePair( ctx );

    this.facade
      .load( {
        filters: {
          section: this.filterSection( ctx.section ),
          refId: ( ctx as unknown as { refId: string; } ).refId,

          ...( this.safeString( ( ctx as unknown as { subSection?: unknown; } ).subSection )
            ? { subSection: this.safeString( ( ctx as unknown as { subSection?: unknown; } ).subSection ) }
            : {} ),

          ...( this.safeString( ( ctx as unknown as { module?: unknown; } ).module )
            ? { module: this.safeString( ( ctx as unknown as { module?: unknown; } ).module ) }
            : {} ),

          ...( this.listAudience ? { audience: this.listAudience } : {} ),

          ...( scopePair ? { scopeKey: scopePair.k, scopeValue: scopePair.v } : {} ),

          ...( this.enableServerSearch && query ? { q: query } : {} ),
        },
        start,
        limit: size,
        sort: this.sort === "oldest" ? "oldest" : "newest",
      } )
      .pipe(
        takeUntil( this.destroy$ ),
        catchError( ( err ) => {
          // eslint-disable-next-line no-console
          console.error( "[Error:] [CommentsListComponent] load failed.\n", err, "\n" );
          this.errorMessageNotification( err );
          return EMPTY;
        } ),
        finalize( () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        } )
      )
      .subscribe( ( msg: MSG ) => {
        const rows =
          ( msg?.data as unknown as { system?: { comments?: unknown; }; } | null )?.system?.comments;

        const list = Array.isArray( rows ) ? ( rows as CommentDto[] ) : [];

        if ( append ) {
          this.comments = [ ...( this.comments ?? [] ), ...list ];
          this.pageIndex = pageIndex;
        } else {
          this.comments = list;
          this.pageIndex = pageIndex;
        }

        this.hasMoreFromServer = Boolean(
          ( msg?.data as unknown as { pagination?: { hasMore?: unknown; }; } | null )?.pagination?.hasMore
        );

        this.rebuildThreadTreeFromVisible();
      } );
  }

  private filterSection( text: unknown ): CommentSectionKey {
    const safeText = typeof text === 'string' ? text.trim() : '';
    const value = CommentSectionKeyValues.find( ( item ) => item.toLowerCase() === safeText.toLowerCase() );
    if ( !safeText || !value ) {
      return this.context.section;
    }
    else {
      return value;
    }

  }

  private refreshCountIfEnabled(): void {
    if ( !this.enableCounts ) return;
    if ( !this.isBrowserSafe() ) return;

    const ctx = this.getContextOrThrow();

    const q = this.safeString( this.searchText ).trim();
    const query = q.length ? q : "";

    const scopePair = this.resolveScopePair( ctx );

    const filters: Record<string, unknown> = {
      section: ( ctx as unknown as { section: string; } ).section,
      refId: ( ctx as unknown as { refId: string; } ).refId,

      ...( this.safeString( ( ctx as unknown as { subSection?: unknown; } ).subSection )
        ? { subSection: this.safeString( ( ctx as unknown as { subSection?: unknown; } ).subSection ) }
        : {} ),

      ...( this.safeString( ( ctx as unknown as { module?: unknown; } ).module )
        ? { module: this.safeString( ( ctx as unknown as { module?: unknown; } ).module ) }
        : {} ),

      ...( this.listAudience ? { audience: this.listAudience } : {} ),

      ...( scopePair ? { scopeKey: scopePair.k, scopeValue: scopePair.v } : {} ),

      ...( this.enableServerSearch && query ? { q: query } : {} ),
    };

    this.facade
      .countLoad( filters )
      .pipe(
        takeUntil( this.destroy$ ),
        catchError( ( err ) => {
          // eslint-disable-next-line no-console
          console.error( "[Warning:] [CommentsListComponent] count failed.\n", err, "\n" );
          this.errorMessageNotification( err );
          this.totalTarget = 0;
          return EMPTY;
        } )
      )
      .subscribe( ( msg: MSG ) => {
        const total =
          ( msg?.data as unknown as { other?: { total?: unknown; }; total?: unknown; } | null )?.other?.total ??
          ( msg?.data as unknown as { other?: { total?: unknown; }; total?: unknown; } | null )?.total ??
          ( msg as unknown as { other?: { total?: unknown; }; total?: unknown; } | null )?.other?.total ??
          ( msg as unknown as { other?: { total?: unknown; }; total?: unknown; } | null )?.total;

        this.totalTarget = Number( total ) || 0;
        this.cdr.markForCheck();
      } );
  }

  // ===========================================================================
  // Error notifications (centralized)
  // ===========================================================================
  private errorMessageNotification( error: unknown ): void {
    let message = "Something went wrong. Please try again.";

    if ( error instanceof HttpErrorResponse ) {
      message =
        ( error.error as unknown as { message?: unknown; } | null )?.message?.toString() ??
        error.message ??
        "Request failed. Please try again.";
    } else if ( error instanceof Error ) {
      message = error.message || message;
    } else if ( typeof error === "string" ) {
      message = error;
    } else if ( error && typeof error === "object" ) {
      const m = ( error as { message?: unknown; } | null )?.message;
      const em = ( error as { error?: { message?: unknown; }; } | null )?.error?.message;
      message = this.safeString( m ) || this.safeString( em ) || message;
    }

    this.notificationBar.notification( "error", message );
  }

  // ===========================================================================
  // Context + helpers
  // ===========================================================================
  private isBrowserSafe(): boolean {
    return isPlatformBrowser( this.platformId );
  }

  private getContextOrThrow(): CommentTargetDto {
    const ctx = this.context as CommentTargetDto;

    const section = this.safeString( ( ctx as unknown as { section?: unknown; } | null )?.section ) as CommentTargetDto[ "section" ];
    const refId = this.safeString( ( ctx as unknown as { refId?: unknown; } | null )?.refId );

    if ( !section || !refId ) {
      throw new Error( "Comments context is invalid: section + refId are required." );
    }

    const out: Record<string, unknown> = { section, refId };

    const module = this.safeString( ( ctx as unknown as { module?: unknown; } | null )?.module );
    if ( module ) out[ "module" ] = module;

    const scope = ( ctx as unknown as { scope?: unknown; } | null )?.scope;
    if ( scope && typeof scope === "object" ) out[ "scope" ] = scope;
    else if ( scope === null ) out[ "scope" ] = null;

    if ( section === "Teams" ) {
      const sub = this.safeString( ( ctx as unknown as { subSection?: unknown; } | null )?.subSection );
      if ( !sub ) throw new Error( 'Comments context invalid: "Teams" requires subSection.' );
      out[ "subSection" ] = sub;
    }

    return out as CommentTargetDto;
  }

  private buildTargetJson( base: CommentTargetDto, extraScope: JsonObject | null ): CommentTargetDto {
    const section = this.safeString( ( base as unknown as { section?: unknown; } | null )?.section ) as CommentTargetDto[ "section" ];
    const refId = this.safeString( ( base as unknown as { refId?: unknown; } | null )?.refId );

    if ( !section || !refId ) {
      throw new Error( "Comments context invalid: section + refId are required." );
    }

    const out: Record<string, unknown> = { section, refId };

    const module = this.safeString( ( base as unknown as { module?: unknown; } | null )?.module );
    if ( module ) out[ "module" ] = module;

    if ( section === "Teams" ) {
      const sub = this.safeString( ( base as unknown as { subSection?: unknown; } | null )?.subSection );
      if ( !sub ) throw new Error( 'Comments context invalid: "Teams" requires subSection.' );
      out[ "subSection" ] = sub;
    }

    const baseScope = ( base as unknown as { scope?: unknown; } | null )?.scope;
    let mergedScope: JsonObject | null = null;

    if ( baseScope && typeof baseScope === "object" ) mergedScope = { ...( baseScope as JsonObject ) };
    if ( extraScope ) mergedScope = { ...( mergedScope ?? {} ), ...extraScope };

    if ( mergedScope ) out[ "scope" ] = mergedScope;

    return out as CommentTargetDto;
  }

  private resolveScopePair( ctx: CommentTargetDto ): { k: string; v: string; } | null {
    const sk = this.safeString( this.scopeKey ).trim();
    const sv = this.safeString( this.scopeValue ).trim();
    if ( sk && sv ) return { k: sk, v: sv };

    const scope = ( ctx as unknown as { scope?: unknown; } | null )?.scope;
    if ( !scope || typeof scope !== "object" ) return null;

    const keys = Object.keys( scope as Record<string, unknown> );
    if ( keys.length !== 1 ) return null;

    const k = keys[ 0 ];
    const v = this.safeString( ( scope as Record<string, unknown> )[ k ] ).trim();
    if ( !k || !v ) return null;

    return { k, v };
  }

  private normalizeLimit( value: number ): number {
    const n = Number( value );
    if ( !Number.isFinite( n ) ) return 6;
    if ( n < 1 ) return 1;
    if ( n > 50 ) return 50;
    return Math.floor( n );
  }

  private escapeHtml( input: string ): string {
    return input
      .replace( /&/g, "&amp;" )
      .replace( /</g, "&lt;" )
      .replace( />/g, "&gt;" )
      .replace( /"/g, "&quot;" )
      .replace( /'/g, "&#039;" );
  }

  private safeString( val: unknown ): string {
    return typeof val === "string" ? val : val === null || typeof val === "undefined" ? "" : String( val );
  }

  private safeNullableString( val: unknown ): string | null {
    if ( val === null ) return null;
    const s = this.safeString( val ).trim();
    return s ? s : null;
  }
}
