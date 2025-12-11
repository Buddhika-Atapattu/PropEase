// Path: src/app/services/uploads/rich-text-upload.service.ts
import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable( {
  providedIn: 'root'
} )
export class RichTextUploadService {
  private readonly apiBase: string;

  constructor ( private http: HttpClient ) {
    // Use your environment API base. For Electron/dev you often have http://localhost:3000
    this.apiBase = ( environment as any )?.apiBase || 'http://localhost:3000';
  }

  /**
   * Upload one image blob for TinyMCE, returning the final public URL.
   * - Validates size client-side (defense-in-depth; backend validates again).
   */
  public async uploadImage( blob: Blob, filenameHint: string ): Promise<string> {
    const MAX_MB = 5;
    const maxBytes = MAX_MB * 1024 * 1024;
    if ( blob.size > maxBytes ) {
      throw new Error( `Image too large. Max ${ MAX_MB } MB.` );
    }

    const form = new FormData();
    // Use a hint filename for nicer logs; backend will generate a safe filename.
    form.append( 'file', blob, filenameHint || 'image' );

    const url = `${ this.apiBase }/api-rich-text/uploads/richtext`;
    try {
      const res = await firstValueFrom( this.http.post<{ success: boolean; url: string; message?: string; }>( url, form, {
        headers: new HttpHeaders( {
          // Add Authorization header if you require it server-side
          // 'Authorization': `Bearer ${token}`
        } ),
        withCredentials: false,
      } ) );

      if ( !res?.success || !res?.url ) {
        throw new Error( res?.message || 'Malformed upload response' );
      }
      // Return a RELATIVE or ABSOLUTE URL. We choose relative-friendly here.
      return res.url;
    } catch ( e ) {
      const err = e as HttpErrorResponse;
      const msg = ( err?.error?.message as string ) || err?.message || 'Upload failed';
      throw new Error( msg );
    }
  }
}
