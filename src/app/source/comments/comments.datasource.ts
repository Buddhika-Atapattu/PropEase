// Path: scr/app/source/comment/comment.datasource.ts
import { BehaviorSubject } from 'rxjs';
import { APIsService } from '../../services/APIs/apis.service';
import { CommentsService, ComplaintCommentClient } from '../../services/comments/comments.service';
import type { PaginationMeta } from '../../types/api-message.types';


export class CommentsDataSource {
  public readonly items$ = new BehaviorSubject<ComplaintCommentClient[]>( [] );
  public readonly loading$ = new BehaviorSubject<boolean>( false );
  public readonly ended$ = new BehaviorSubject<boolean>( false );

  private nextCursor: string | undefined;
  private readonly limit: number | null;
  private readonly code: string | null;


  public constructor (
    private readonly api: CommentsService,
    private readonly apiService: APIsService,
    code: string = '',
    limit: number = 10, ) {
    try {
      if ( !code ) {
        throw new Error( 'Invalid comment code!' );
      }

      if ( !limit || limit === 0 ) {
        throw new Error( 'Invalid limit parameter detected during comment load initialization.' );
      }
      this.code = code;
      this.limit = limit;
    }
    catch ( error ) {
      console.error( error );
      this.code = null;
      this.limit = null;
    }
  }

  public async init(): Promise<void> {
    await this.loadMore();
  }

  public hasMore(): boolean {
    return !this.ended$.value;
  }

  public async loadMore(): Promise<void> {

    try {
      if ( this.loading$.value || this.ended$.value ) return;
      this.loading$.next( true );

      if ( !this.limit ) {
        throw new Error( 'Invalid limit for comment load' );
      }

      if ( !this.code ) {
        throw new Error( 'Invalid complaint code for comment load' );
      }
      const res = await this.api.fetchComments( this.code, this.limit, this.nextCursor ).toPromise();

      if ( !res?.success || res.status !== 'success' ) {
        throw new Error( 'Failed to fetch comments' );
      }

      const pagination: PaginationMeta | undefined = res.data?.pagination;
      const comments: ComplaintCommentClient[] | null = this.apiService.extractArrayFromOther<ComplaintCommentClient>( res.data, 'comments' );


      if ( !Array.isArray( comments ) ) {
        throw new Error( 'Invalid array of complaints' );
      }

      if ( !pagination ) {
        throw new Error( 'Invalid complaint pagination' );
      }


      this.handlePage( comments, pagination );
    } finally {
      this.loading$.next( false );
    }
  }

  private handlePage( comments?: ComplaintCommentClient[], pagination?: PaginationMeta ): void {
    try {
      if ( !comments || !pagination ) { this.ended$.next( true ); return; }
      const current = this.items$.value;
      const merged = current.concat( comments ); // append preserves earlier items in memory
      this.items$.next( merged );
      this.nextCursor = pagination.nextCursor;
      this.ended$.next( !pagination.hasMore );
    }
    catch ( error ) {
      console.error( error );
    }
  }

  public reset(): void {
    this.items$.next( [] );
    this.loading$.next( false );
    this.ended$.next( false );
    this.nextCursor = undefined;
  }
}
