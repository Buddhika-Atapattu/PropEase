// Path: src/app/services/teamManagement/teamTask/team-task.rest.service.ts
// ============================================================================
// TeamTaskRestService (MSG envelope + multipart-safe)
// ----------------------------------------------------------------------------
// Backend mount: /api-team-management/task
//
// ROUTES (from package.zip -> TeamTaskRouter)
// - GET    /get/:taskMongoId?mode=minimal|advanced
// - POST   /list        body: { mode, filters, page, sort }
// - POST   /count       body: { filters }
// - POST   /key-values  body: { teamCode?, teamMongoId?, domain?, status? }
// - POST   /create      (multipart) fields: evidence[], attachments[], files[]
// - PATCH  /update/:taskMongoId (multipart) fields: evidence[], attachments[], files[]
// - DELETE /delete/:taskMongoId
// - DELETE /evidence/:taskMongoId/:evidenceMongoId   (storageKey style)
// - PATCH  /status/:taskMongoId      body: { status }
// - PATCH  /priority/:taskMongoId    body: { priority }
// - PATCH  /labels/set|add|remove/:taskMongoId   body: { labels }
// - PATCH  /members/set|add|remove/:taskMongoId  body: { memberIds }
// - PATCH  /captain/:taskMongoId     body: { captainUserId } (accepts "null" string to clear)
// - PATCH  /location/:taskMongoId    body: { location } (object or "null")
// - PATCH  /address/:taskMongoId     body: { address } (object or "null")
// - PATCH  /notes/:taskMongoId       body: { notes } (string or "null")
// - GET    /audit/:taskMongoId
// - PATCH  /audit/set|patch|clear/:taskMongoId
// - GET    /timing/:taskMongoId
// - PATCH  /timing/set|patch|clear/:taskMongoId
// - PATCH  /sla/:taskMongoId         body: { sla } (compat -> deadlinePolicy)
// - GET    /users/usernames/:taskMongoId
// - POST   /users/:taskMongoId       body: { userId?, username? }
// ============================================================================

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import type { MSG, TeamTaskApiData } from "../../../types/api-message.types";
import { environment } from "../../../../environments/environment";

@Injectable( { providedIn: "root" } )
export class TeamTaskRestService {
  private readonly baseUrl: string;

  public constructor ( private readonly http: HttpClient ) {
    this.baseUrl = this.safeJoin( environment.apiOrigin, "/api-team-management/task" );
  }

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  public getByMongoId( taskMongoId: string, mode: "minimal" | "advanced" = "minimal" ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/get/${ encodeURIComponent( taskMongoId ) }?mode=${ encodeURIComponent( mode ) }` );
    return this.http.get<MSG<TeamTaskApiData>>( url );
  }

  public list( body: {
    mode?: "minimal" | "advanced";
    filters?: Record<string, unknown>;
    page?: { limit?: number; page?: number; pageIndex?: number; };
    sort?: { key?: string; dir?: "asc" | "desc"; };
  } ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, "/list" );
    return this.http.post<MSG<TeamTaskApiData>>( url, this.omitUndefined( body ) );
  }

  public count( body: { filters?: Record<string, unknown>; } ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, "/count" );
    return this.http.post<MSG<TeamTaskApiData>>( url, this.omitUndefined( body ) );
  }

  public keyValues( body: {
    teamCode?: string;
    teamMongoId?: string;
    domain?: string;
    status?: string;
  } ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, "/key-values" );
    return this.http.post<MSG<TeamTaskApiData>>( url, this.omitUndefined( body ) );
  }

  // ---------------------------------------------------------------------------
  // WRITE (multipart supported)
  // ---------------------------------------------------------------------------

  /**
   * Create TeamTask (multipart).
   *
   * @param fields
   * - Expected: plain object of task fields.
   * - IMPORTANT: arrays/objects should be passed as real arrays/objects; this helper JSON.stringifies them.
   *
   * @param uploads
   * - Optional file groups aligned to backend Upload fields:
   *   - evidence[], attachments[], files[]
   */
  public create(
    fields: Record<string, unknown>,
    uploads?: {
      evidence?: File[];
      attachments?: File[];
      files?: File[];
    }
  ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, "/create" );
    const fd = this.buildMultipart( fields, uploads );
    return this.http.post<MSG<TeamTaskApiData>>( url, fd );
  }

  /**
   * Update TeamTask (multipart).
   */
  public update(
    taskMongoId: string,
    fields: Record<string, unknown>,
    uploads?: {
      evidence?: File[];
      attachments?: File[];
      files?: File[];
    }
  ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/update/${ encodeURIComponent( taskMongoId ) }` );
    const fd = this.buildMultipart( fields, uploads );
    return this.http.patch<MSG<TeamTaskApiData>>( url, fd );
  }

  public remove( taskMongoId: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/delete/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.delete<MSG<TeamTaskApiData>>( url );
  }

  public getAllForTeam(
    teamCode: string,
    mode: "minimal" | "advanced" = "minimal",
    page?: { limit?: number; page?: number; }
  ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin(
      this.baseUrl,
      `/get-all-for-team/${ encodeURIComponent( teamCode ) }?mode=${ encodeURIComponent( mode ) }${ page ? `&limit=${ encodeURIComponent( page.limit ?? "" ) }&page=${ encodeURIComponent( page.page ?? "" ) }` : "" }`
    );
    return this.http.get<MSG<TeamTaskApiData>>( url );
  }

  public countAllForTeam( teamCode: string ): Observable<MSG> {
    const url = this.safeJoin( this.baseUrl, `/get-count-for-team/${ encodeURIComponent( teamCode ) }` );
    return this.http.get<MSG>( url );
  }

  // Evidence: backend treats evidenceMongoId param as storageKey (per router note)
  public removeEvidenceByStorageKey( taskMongoId: string, storageKey: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin(
      this.baseUrl,
      `/evidence/${ encodeURIComponent( taskMongoId ) }/${ encodeURIComponent( storageKey ) }`
    );
    return this.http.delete<MSG<TeamTaskApiData>>( url );
  }

  // ---------------------------------------------------------------------------
  // Atomic Operations
  // ---------------------------------------------------------------------------

  public setStatus( taskMongoId: string, status: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/status/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { status } );
  }

  public setPriority( taskMongoId: string, priority: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/priority/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { priority } );
  }

  public setLabels( taskMongoId: string, labels: string[] ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/labels/set/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { labels } );
  }

  public addLabels( taskMongoId: string, labels: string[] ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/labels/add/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { labels } );
  }

  public removeLabels( taskMongoId: string, labels: string[] ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/labels/remove/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { labels } );
  }

  public setAssignedMembers( taskMongoId: string, memberIds: string[] ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/members/set/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { memberIds } );
  }

  public addAssignedMembers( taskMongoId: string, memberIds: string[] ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/members/add/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { memberIds } );
  }

  public removeAssignedMembers( taskMongoId: string, memberIds: string[] ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/members/remove/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { memberIds } );
  }

  /**
   * Backend accepts "null" to clear captain.
   */
  public setCaptain( taskMongoId: string, captainUserIdOrNull: string | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/captain/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, {
      captainUserId: captainUserIdOrNull === null ? "null" : captainUserIdOrNull,
    } );
  }

  public setLocation( taskMongoId: string, locationOrNull: Record<string, unknown> | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/location/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { location: locationOrNull === null ? "null" : locationOrNull } );
  }

  public setAddress( taskMongoId: string, addressOrNull: Record<string, unknown> | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/address/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { address: addressOrNull === null ? "null" : addressOrNull } );
  }

  public setNotes( taskMongoId: string, notesOrNull: string | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/notes/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { notes: notesOrNull === null ? "null" : notesOrNull } );
  }

  // ---------------------------------------------------------------------------
  // Audit / Timing / SLA
  // ---------------------------------------------------------------------------

  public getAudit( taskMongoId: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/audit/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.get<MSG<TeamTaskApiData>>( url );
  }

  public setAudit( taskMongoId: string, auditOrNull: Record<string, unknown> | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/audit/set/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { audit: auditOrNull === null ? "null" : auditOrNull } );
  }

  public patchAudit( taskMongoId: string, patch: Record<string, unknown> ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/audit/patch/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { patch } );
  }

  public clearAudit( taskMongoId: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/audit/clear/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, {} );
  }

  public getTiming( taskMongoId: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/timing/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.get<MSG<TeamTaskApiData>>( url );
  }

  public setTiming( taskMongoId: string, timingOrNull: Record<string, unknown> | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/timing/set/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { timing: timingOrNull === null ? "null" : timingOrNull } );
  }

  public patchTiming( taskMongoId: string, patch: Record<string, unknown> ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/timing/patch/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { patch } );
  }

  public clearTiming( taskMongoId: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/timing/clear/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, {} );
  }

  /**
   * SLA endpoint is a compat shim -> deadlinePolicy in service.
   */
  public setSla( taskMongoId: string, slaOrNull: Record<string, unknown> | null ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/sla/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.patch<MSG<TeamTaskApiData>>( url, { sla: slaOrNull === null ? "null" : slaOrNull } );
  }

  // ---------------------------------------------------------------------------
  // Task Users
  // ---------------------------------------------------------------------------

  public getAssignedMemberUsernames( taskMongoId: string ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/users/usernames/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.get<MSG<TeamTaskApiData>>( url );
  }

  public getTaskUsers( taskMongoId: string, body: { userId?: string; username?: string; } ): Observable<MSG<TeamTaskApiData>> {
    const url = this.safeJoin( this.baseUrl, `/users/${ encodeURIComponent( taskMongoId ) }` );
    return this.http.post<MSG<TeamTaskApiData>>( url, this.omitUndefined( body ) );
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private safeJoin( a: string, b: string ): string {
    const a2 = a.endsWith( "/" ) ? a.slice( 0, -1 ) : a;
    const b2 = b.startsWith( "/" ) ? b : `/${ b }`;
    return `${ a2 }${ b2 }`;
  }

  /**
   * exactOptionalPropertyTypes-safe omit undefined keys.
   * NOTE: uses `T extends object` to avoid index-signature error.
   */
  private omitUndefined<T extends object>( obj: T ): Partial<T> {
    const out: Partial<T> = {};
    for ( const k of Object.keys( obj ) as Array<keyof T> ) {
      const v = obj[ k ];
      if ( v !== undefined ) out[ k ] = v;
    }
    return out;
  }

  /**
   * Build multipart FormData:
   * - primitives become strings
   * - arrays/objects become JSON strings (backend parses JSON using parseJsonArray/parseJsonObj)
   * - files are appended to: evidence | attachments | files (backend upload fields)
   */
  private buildMultipart(
    fields: Record<string, unknown>,
    uploads?: { evidence?: File[]; attachments?: File[]; files?: File[]; }
  ): FormData {
    const fd = new FormData();

    for ( const key of Object.keys( fields ) ) {
      const v = fields[ key ];

      if ( v === undefined ) continue;

      if ( v === null ) {
        fd.append( key, "null" );
        continue;
      }

      if ( typeof v === "string" || typeof v === "number" || typeof v === "boolean" ) {
        fd.append( key, String( v ) );
        continue;
      }

      // arrays/objects -> JSON string (controller expects JSON text for many fields)
      fd.append( key, JSON.stringify( v ) );
    }

    if ( uploads?.evidence?.length ) {
      for ( const f of uploads.evidence ) fd.append( "evidence", f );
    }
    if ( uploads?.attachments?.length ) {
      for ( const f of uploads.attachments ) fd.append( "attachments", f );
    }
    if ( uploads?.files?.length ) {
      for ( const f of uploads.files ) fd.append( "files", f );
    }

    return fd;
  }
}
