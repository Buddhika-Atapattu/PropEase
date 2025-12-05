// Path: src/app/services/comments/comments.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MSG } from '../../types/api-message.types';

export interface ComplaintCommentClient {
  _id?: string;
  byUserId: string;
  byName: string;
  image?: string;            // you added this on BE
  audience:
  'admin' | 'all' | 'agent' | 'tenant' | 'owner' | 'operator' | 'manager' | 'developer' | 'user' | 'system';
  message: string;
  createdAt: string;         // ISO
  attachments?: Array<{ name: string; mimetype: string; size: number; url: string; relPath?: string; }>;
}

export interface CommentsResponse {
  items: ComplaintCommentClient[];
  nextCursor?: string;
  hasMore: boolean;
}


@Injectable( {
  providedIn: 'root'
} )
export class CommentsService {
  private readonly base = ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' );;


  public constructor (
    private readonly http: HttpClient,
    @Inject( PLATFORM_ID ) private readonly platformId: Object,
  ) {}

  public fetchComments( code: string, limit: number, cursor?: string ): Observable<MSG> {
    const url = `${ this.base }/api-tenant/complaints/${ encodeURIComponent( code ) }/comments`;
    let params = new HttpParams().set( 'limit', String( limit ) );
    if ( cursor ) params = params.set( 'cursor', cursor );
    return this.http.get<MSG>( url, { params } );
  }

  public isBrowser(): boolean {
    return isPlatformBrowser( this.platformId );
  }
}
