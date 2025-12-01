// Path: src/app/components/shared/comments/comments-list.component.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  Output,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { CommentsService } from '../../../services/comments/comments.service';
import { CommentsDataSource } from '../../../source/comments/comments.datasource';
import { APIsService } from '../../../services/APIs/apis.service';
import {
  AttachmentDownloaderService,
  DownloadProgress,
} from '../../../services/comments/attachment-downloader.service';
import * as FileSaver from 'file-saver';
import { Subscription } from 'rxjs';

@Component( {
  selector: 'app-comments-list',
  standalone: true,
  imports: [ CommonModule, MatButtonModule, MatProgressSpinnerModule, MatProgressBarModule, MatTooltipModule, MatIconModule ],
  templateUrl: './comments-list.component.html',
  styleUrls: [ './comments-list.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class CommentsListComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input( { required: true } ) code!: string;
  @Input( { required: false } ) limit: number = 10;
  @Output() limitChange: EventEmitter<number> = new EventEmitter<number>();

  @ViewChild( 'sentinel', { static: true } ) sentinelRef!: ElementRef<HTMLDivElement>;
  protected readonly DEFINED_NO_COMMENT = 'public/Images/System-images/noComments.png';

  public ds!: CommentsDataSource;
  private observer?: IntersectionObserver;

  /** In-flight download ids */
  public downloadingIds = new Set<string>();
  /** id → percent (0..100), when unknown will be 0 and spinner will show indeterminate */
  public progressMap = new Map<string, number>();
  /** id → subscription (for cancel/cleanup) */

  private downloadSubs = new Map<string, Subscription>();

  public constructor (
    private readonly api: CommentsService,
    private readonly apiService: APIsService,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
    private readonly downloader: AttachmentDownloaderService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  public async ngOnInit(): Promise<void> {
    this.ds = new CommentsDataSource( this.api, this.apiService, this.code, this.limit );
    await this.ds.init(); // async pipe template will render when streams emit

    this.cdr.markForCheck();
  }

  public ngAfterViewInit(): void {
    this.setupObserver();
  }

  public ngOnDestroy(): void {
    this.observer?.disconnect();
    // cancel any active downloads
    this.downloadSubs.forEach( s => s.unsubscribe() );
    this.downloadSubs.clear();
  }

  protected async refresh(): Promise<void> {
    try {
      this.ds = new CommentsDataSource( this.api, this.apiService, this.code, this.limit );
      await this.ds.init(); // async pipe template will render when streams emit
      this.cdr.markForCheck();
    }
    catch ( err ) {
      console.error( err );
    }
  }

  private setupObserver(): void {
    if ( !isPlatformBrowser( this.platformId ) ) return;
    this.observer = new IntersectionObserver(
      entries => {
        for ( const e of entries ) {
          if ( e.isIntersecting ) {
            // keep click-to-load UX; call this.onLoadMore() here if you want auto-load
          }
        }
      },
      { root: null, rootMargin: '0px', threshold: 1.0 },
    );
    if ( this.sentinelRef?.nativeElement ) {
      this.observer.observe( this.sentinelRef.nativeElement );
    }
  }

  public async onLoadMore(): Promise<void> {
    await this.ds.loadMore();
    this.cdr.markForCheck();
  }

  public trackById( _i: number, it: any ): string {
    return it._id || `${ it.byUserId }-${ it.createdAt }`;
  }

  public attachmentId( cmtId: string | undefined, idx: number ): string {
    return `${ cmtId ?? 'c' }-${ idx }`;
  }

  /** Start a download with progress + cancel support */
  public onDownload( a: { url: string; name: string; mimetype?: string; }, id: string ): void {
    if ( this.downloadingIds.has( id ) ) return;

    this.downloadingIds.add( id );
    this.progressMap.set( id, 0 );
    this.cdr.markForCheck();

    const sub = this.downloader.fetch( a.url ).subscribe( {
      next: ( p: DownloadProgress ) => {
        if ( p.state === 'progress' ) {
          // if Content-Length missing, percent is undefined → show indeterminate bar in template
          if ( typeof p.percent === 'number' ) this.progressMap.set( id, p.percent );
          this.cdr.markForCheck();
        }
        if ( p.state === 'done' && p.blob ) {
          const filename = p.filename || a.name || 'download';
          FileSaver.saveAs( p.blob, filename );
          this.finishDownload( id );
        }
      },
      error: () => {
        this.finishDownload( id );
      },
    } );

    this.downloadSubs.set( id, sub );
  }

  /** Cancel an active download */
  public onCancel( id: string ): void {
    const sub = this.downloadSubs.get( id );
    if ( sub ) sub.unsubscribe();
    this.finishDownload( id );
  }

  /** Common cleanup for done/cancel/error */
  private finishDownload( id: string ): void {
    this.downloadSubs.get( id )?.unsubscribe();
    this.downloadSubs.delete( id );
    this.downloadingIds.delete( id );
    this.progressMap.delete( id );
    this.cdr.markForCheck();
  }
}
