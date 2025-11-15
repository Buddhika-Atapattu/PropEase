// Path: scr/app/source/comment/comment.datasource.ts
import {BehaviorSubject} from 'rxjs';
import {CommentsService, ComplaintCommentClient, CommentsResponse} from '../../services/comments/comments.service';


export class CommentsDataSource {
  public readonly items$ = new BehaviorSubject<ComplaintCommentClient[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);
  public readonly ended$ = new BehaviorSubject<boolean>(false);

  private nextCursor: string | undefined;
  private readonly limit: number;
  private readonly code: string;

  public constructor (private readonly api: CommentsService, code: string, limit = 10) {
    this.code = code;
    this.limit = limit;
  }

  public async init(): Promise<void> {
    await this.loadMore();
  }

  public hasMore(): boolean {
    return !this.ended$.value;
  }

  public async loadMore(): Promise<void> {
    if(this.loading$.value || this.ended$.value) return;
    this.loading$.next(true);
    try {
      const res = await this.api.fetchComments(this.code, this.limit, this.nextCursor).toPromise();
      this.handlePage(res);
    } finally {
      this.loading$.next(false);
    }
  }

  private handlePage(res?: CommentsResponse): void {
    if(!res) {this.ended$.next(true); return;}
    const current = this.items$.value;
    const merged = current.concat(res.items);     // append preserves earlier items in memory
    this.items$.next(merged);
    this.nextCursor = res.nextCursor;
    this.ended$.next(!res.hasMore);
  }

  public reset(): void {
    this.items$.next([]);
    this.loading$.next(false);
    this.ended$.next(false);
    this.nextCursor = undefined;
  }
}
