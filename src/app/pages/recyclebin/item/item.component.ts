// Path: src/app/pages/recyclebin/item/item.component.ts

import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";

import { Observable, forkJoin, of } from "rxjs";
import {
  catchError,
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs/operators";

import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatChipsModule } from "@angular/material/chips";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type {
  FileMetaPacketDto,
  RecycleBinEntryDto,
  RecycleBinRestorePrepareDto,
  RecycleBinSnapshotReadDto,
} from "../../../types/recyclebin/recyclebin.types";

import { RecycleBinRestService } from "../../../services/recyclebin/recyclebin.rest.service";

type ItemVm = {
  entryId: string;
  entry: RecycleBinEntryDto;
  snapshotData: Record<string, unknown>;
  meta: Record<string, unknown>;
  files: FileMetaPacketDto[];
};

type LoadState =
  | { state: "loading"; entryId: string; }
  | { state: "ok"; entryId: string; data: ItemVm; }
  | { state: "error"; entryId: string; message: string; };

@Component( {
  selector: "app-item-recyclebin",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: "./item.component.html",
  styleUrl: "./item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class RecycleBinItemComponent {
  constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: object,
    private readonly snackBar: MatSnackBar,
  ) {

  }
  // =============================================================================
  // DI (inject() only — do NOT mix with constructor DI)
  // =============================================================================
  private readonly api = inject( RecycleBinRestService );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );

  // =============================================================================
  // Route param
  // =============================================================================
  public readonly entryId$: Observable<string> = this.route.paramMap.pipe(
    map( ( pm ) => ( pm.get( "recycleItemRef" ) ?? "" ).trim() ),
    distinctUntilChanged(),
    shareReplay( { bufferSize: 1, refCount: true } )
  );

  // =============================================================================
  // VM loader (Snapshot + PrepareRestore)
  // =============================================================================
  public readonly vm$: Observable<LoadState> = this.entryId$.pipe(
    switchMap( ( entryId ) => {
      if ( !entryId ) {
        return of( {
          state: "error",
          entryId: "",
          message: "Missing recycle bin entry id in route.",
        } satisfies LoadState );
      }

      // Load both: snapshot(meta + snapshotData) and prepare(files)
      return forkJoin( {
        snap: this.api.snapshot( entryId ),
        prep: this.api.prepareRestore( entryId ),
      } ).pipe(
        map( ( { snap, prep } ) => {
          const vm: ItemVm = this.buildVm( entryId, snap, prep );
          return { state: "ok", entryId, data: vm } satisfies LoadState;
        } ),
        startWith( { state: "loading", entryId } satisfies LoadState ),
        catchError( ( err: unknown ) =>
          of( {
            state: "error",
            entryId,
            message: this.safeErrorMessage( err ),
          } satisfies LoadState )
        )
      );
    } ),
    shareReplay( { bufferSize: 1, refCount: true } )
  );

  // =============================================================================
  // UI actions
  // =============================================================================
  public backToList(): void {
    void this.router.navigate( [ "/dashboard/recycle-bin/recycle-bin-center" ] );
  }

  // =============================================================================
  // View helpers (no any required)
  // =============================================================================
  /**
   * Copies a JSON object to clipboard.
   *
   * @param value - Any JSON-compatible value
   *
   * Expected:
   * - Plain object
   * - Array
   * - Stringified JSON
   *
   * Usage:
   * - Called from Copy button click
   *
   * Important:
   * - SSR safe (browser only)
   * - Uses Navigator Clipboard API
   */
  public async copyJson( value: unknown ): Promise<void> {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    try {
      const formatted =
        typeof value === 'string'
          ? value
          : JSON.stringify( value, null, 2 );

      await navigator.clipboard.writeText( formatted );

      this.snackBar.open( 'JSON copied to clipboard', 'OK', {
        duration: 2000,
      } );

    } catch ( error ) {
      console.error( '[Error:] Failed to copy JSON\n', error );

      this.snackBar.open( 'Failed to copy JSON', 'Dismiss', {
        duration: 3000,
      } );
    }
  }

  public titleFor( vm: ItemVm ): string {
    // Prefer label-like fields if they exist inside entry (your DTO varies)
    const e = vm.entry as unknown as Record<string, unknown>;
    const label = typeof e[ "label" ] === "string" ? String( e[ "label" ] ).trim() : "";
    const entity = typeof e[ "entity" ] === "string" ? String( e[ "entity" ] ).trim() : "";
    return label || entity || `Recycle Bin Item`;
  }

  public iconFor( vm: ItemVm ): string {
    const e = vm.entry as unknown as Record<string, unknown>;
    const module = typeof e[ "module" ] === "string" ? String( e[ "module" ] ).toLowerCase() : "";
    const entity = typeof e[ "entity" ] === "string" ? String( e[ "entity" ] ).toLowerCase() : "";

    const merged = `${ module }:${ entity }`;
    if ( merged.includes( "property" ) ) return "home_work";
    if ( merged.includes( "tenant" ) ) return "person";
    if ( merged.includes( "lease" ) ) return "assignment";
    if ( merged.includes( "payment" ) ) return "payments";
    return "delete";
  }

  public formatJson( v: unknown ): string {
    try {
      return JSON.stringify( v, null, 2 );
    } catch {
      return String( v );
    }
  }

  public trackByIdx( index: number ): number {
    return index;
  }

  public isOk( vm: LoadState ): vm is Extract<LoadState, { state: "ok"; }> {
    return vm.state === "ok";
  }

  public openFile( url: unknown ): void {
    console.log( url );
  }

  // =============================================================================
  // Internals
  // =============================================================================
  private buildVm( entryId: string, snap: RecycleBinSnapshotReadDto, prep: RecycleBinRestorePrepareDto ): ItemVm {
    const entry: RecycleBinEntryDto = ( snap?.entry ?? prep?.entry ) as RecycleBinEntryDto;

    const snapshotData: Record<string, unknown> =
      ( snap?.snapshotData && typeof snap.snapshotData === "object" ) ? snap.snapshotData : {};

    const meta: Record<string, unknown> =
      ( snap?.meta && typeof snap.meta === "object" ) ? snap.meta : {};

    const files: FileMetaPacketDto[] = Array.isArray( prep?.files ) ? prep.files : [];

    return {
      entryId,
      entry,
      snapshotData,
      meta,
      files,
    };
  }

  private safeErrorMessage( err: unknown ): string {
    if ( err && typeof err === "object" && "message" in err ) {
      const m = ( err as { message?: unknown; } ).message;
      if ( typeof m === "string" && m.trim() ) return m.trim();
    }
    return "Failed to load recycle bin item.";
  }
}
