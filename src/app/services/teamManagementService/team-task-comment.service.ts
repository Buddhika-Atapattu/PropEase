// Path: src/app/services/team-management/team-task-comment.service.ts
// ============================================================================
// Team Task Comment Service (FE)
// ----------------------------------------------------------------------------
// Goal:
// - Submit a task comment (optionally with file attachments)
// - Keep backend contract style: ApiResponse(ApiData) where "small payloads"
//   (like comment upload results) live in `data.other`.
// ----------------------------------------------------------------------------
// Expected BE endpoints (recommended):
//  1) POST /api-team-management/task/upload/comment/:teamCode/:taskId
//      - multipart/form-data field: "files"
//      - returns: data.other.files = [{ originalName, storedName, ... , url, storageKey }]
//
//  2) POST /api-team-management/task/comment/add/:teamCode/:taskId
//      - body: { comment: AddTaskCommentRequestDto } OR direct payload
//      - returns: data.other.comment (and optionally system.team updated)
//
// If you decide to reuse existing evidence upload endpoint instead of (1),
// just point uploadCommentFiles() to that route.
// ============================================================================

import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, catchError, map, switchMap, throwError, firstValueFrom } from 'rxjs';


import type { MSG, ApiData, SystemData } from '../../types/api-message.types';
import type { FileMetaBase } from '../../types/api-message.types';

import type {
  AddTaskCommentRequestDto,
  TaskCommentDto,
} from './team-management.types';

// If you already have environment.ts, use it.
// Otherwise, replace with your base URL provider.
import { environment } from '../../../environments/environment';

type UploadedCommentFile = FileMetaBase & {
  url: string;
  storageKey: string;
};

type UploadCommentFilesOther = {
  files: UploadedCommentFile[];
};

type AddCommentOther = {
  comment: TaskCommentDto;
  teamCode: string;
  taskId: string;
};

@Injectable({ providedIn: 'root' })
export class TeamTaskCommentService {
  private readonly baseUrl: string = environment.apiOrigin ?? 'http://localhost:3000'; // adapt to your env key
  private readonly apiRoot: string = `${this.baseUrl}/api-team-management/task`;

  public constructor(private readonly http: HttpClient) {}

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * (Step 1) Upload comment attachments as files (multipart).
   * Backend should return metadata in: data.other.files[]
   */
  public uploadCommentFiles(
    teamCode: string,
    taskId: string,
    files: File[],
    headers?: HttpHeaders
  ): Observable<UploadedCommentFile[]> {
    const safeTeamCode = String(teamCode ?? '').trim();
    const safeTaskId = String(taskId ?? '').trim();

    if (!safeTeamCode || !safeTaskId) {
      return throwError(() => new Error('Team code and taskId are required.'));
    }

    if (!Array.isArray(files) || files.length === 0) {
      return throwError(() => new Error('At least one file is required.'));
    }

    const form = new FormData();
    for (const f of files) form.append('files', f);

    // ✅ Recommended endpoint dedicated for comment files:
    const url = `${this.apiRoot}/upload/comment/${encodeURIComponent(
      safeTeamCode
    )}/${encodeURIComponent(safeTaskId)}`;

    // If you want to reuse task evidence upload instead:
    // const url = `${this.apiRoot}/upload/evidence/${encodeURIComponent(safeTeamCode)}/${encodeURIComponent(safeTaskId)}`;

    return this.http
      .post<MSG<ApiData<SystemData, UploadCommentFilesOther>>>(url, form, {
        headers,
      })
      .pipe(
        map((msg) => this.extractOtherOrThrow(msg, 'files').files),
        catchError((e) => this.handleHttpError(e))
      );
  }

  /**
   * (Step 2) Submit the comment payload (JSON).
   * Backend returns comment in: data.other.comment
   */
  public addTaskComment(
    teamCode: string,
    taskId: string,
    payload: AddTaskCommentRequestDto,
    headers?: HttpHeaders
  ): Observable<TaskCommentDto> {
    const safeTeamCode = String(teamCode ?? '').trim();
    const safeTaskId = String(taskId ?? '').trim();

    if (!safeTeamCode || !safeTaskId) {
      return throwError(() => new Error('Team code and taskId are required.'));
    }

    const commentor = String(payload?.commentor ?? '').trim();
    const comment = String(payload?.comment ?? '').trim();

    if (!commentor || !comment) {
      return throwError(
        () => new Error('commentor and comment are required.')
      );
    }

    const url = `${this.apiRoot}/comment/add/${encodeURIComponent(
      safeTeamCode
    )}/${encodeURIComponent(safeTaskId)}`;

    // Router supports: { comment: {...} } OR direct {...}
    const body = { comment: payload };

    return this.http
      .post<MSG<ApiData<SystemData, AddCommentOther>>>(url, body, { headers })
      .pipe(
        map((msg) => this.extractOtherOrThrow(msg, 'comment').comment),
        catchError((e) => this.handleHttpError(e))
      );
  }

  /**
   * Convenience: Upload files (if any) → submit comment with attachments meta.
   *
   * This is the clean “two-phase” pattern:
   * - Files are uploaded via multipart endpoint
   * - Comment endpoint receives ONLY JSON metadata (storageKey/url/fileMeta)
   */
  public addTaskCommentWithFiles(
    teamCode: string,
    taskId: string,
    commentor: string,
    comment: string,
    files: File[] | undefined,
    headers?: HttpHeaders
  ): Observable<TaskCommentDto> {
    const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];

    // No files: direct comment
    if (safeFiles.length === 0) {
      const payload: AddTaskCommentRequestDto = {
        commentor: commentor as any,
        comment,
      };
      return this.addTaskComment(teamCode, taskId, payload, headers);
    }

    // With files: upload first, then send attachments meta
    return this.uploadCommentFiles(teamCode, taskId, safeFiles, headers).pipe(
      switchMap((uploaded) => {
        const payload: AddTaskCommentRequestDto = {
          commentor: commentor as any,
          comment,
          attachments: uploaded.map((f) => ({
            name: f.originalName,
            storageKey: f.storageKey,
            url: f.url,
            uploadedAt: new Date().toISOString(),
            uploadedByName: commentor as any,
            fileMeta: {
              originalName: f.originalName,
              storedName: f.storedName,
              extension: f.extension,
              mimeType: f.mimeType,
              sizeBytes: f.sizeBytes,
            },
          })),
        };

        return this.addTaskComment(teamCode, taskId, payload, headers);
      }),
      catchError((e) => this.handleHttpError(e))
    );
  }


  public async submitTaskComment(
    teamCode: string,
    taskId: string,
    form: FormData
  ): Promise<MSG> {

    const safeTeamCode = encodeURIComponent(String(teamCode ?? '').trim());
    const safeTaskId = encodeURIComponent(String(taskId ?? '').trim());

    if (!safeTeamCode || !safeTaskId) {
      throw new Error('Team code and task id are required.');
    }

    const url = `${this.apiRoot}/comment/submit/${safeTeamCode}/${safeTaskId}`;

    return await firstValueFrom(
      this.http.post<MSG>(url, form)
    );
  }

  public async loadComments(
    teamCode: string,
    taskId: string,
    start: number,
    limit: number,
  )
  : Promise<MSG> {
    const safeTeamCode = encodeURIComponent(String(teamCode ?? '').trim());
    const safeTaskId = encodeURIComponent(String(taskId ?? '').trim());
    if (!safeTeamCode || !safeTaskId) {
      throw new Error('Team code and task id are required.');
    }
    const url = `${this.apiRoot}/comments/load/${safeTeamCode}/${safeTaskId}?start=${start}&limit=${limit}`;

    return await firstValueFrom(
      this.http.get<MSG>(url)
    );
  }


  // ========================================================================
  // Utilities (contract-safe extraction + error handling)
  // ========================================================================

  /**
   * Extract strongly-typed `data.other` and ensure key exists.
   * We keep this strict because you said "small sections go to other".
   */
  private extractOtherOrThrow<
    TOther extends Record<string, unknown>,
    K extends keyof TOther
  >(msg: MSG<ApiData<SystemData, TOther>>, requiredKey: K): TOther {
    if (!msg?.success) {
      throw new Error(msg?.message ?? 'Request failed.');
    }

    const other = msg?.data?.other;
    if (!other) {
      throw new Error('Response missing data.other.');
    }

    if (!(requiredKey in other)) {
      throw new Error(`Response missing data.other.${String(requiredKey)}.`);
    }

    return other;
  }

  private handleHttpError(err: unknown): Observable<never> {
    if (err instanceof HttpErrorResponse) {
      const apiMsg =
        (err.error as any)?.message ||
        err.message ||
        'Network/API error occurred.';
      return throwError(() => new Error(apiMsg));
    }
    return throwError(() => new Error('Unexpected error occurred.'));
  }
}
