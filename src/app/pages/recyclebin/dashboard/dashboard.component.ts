// Path: src/app/pages/recyclebin/dashboard/dashboard.component.ts
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";

import { RecycleBinCenterService, type RecycleBinCenterRow } from "../../../services/recyclebin/recyclebin-center.service";
import type { Observable } from "rxjs";

@Component( {
  selector: "app-dashboard-recyclebin",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class RecycleBinDashboardComponent {
  public vm$: Observable<{
    rows: RecycleBinCenterRow[];
    total: number;
    page: number;
    limit: number;
  }> | null = null;
  public readonly isLoading$: Observable<boolean> | null = null;

  public searchText: string = "";

  public readonly displayedColumns: string[] = [
    "select",
    "name",
    "originalLocation",
    "dateDeleted",
    "type",
    "size",
  ];

  public constructor ( public readonly center: RecycleBinCenterService ) {
    // Initial Windows-like load (details view)
    this.vm$ = this.center.rows$();
    this.isLoading$ = this.center.isLoading$();
    this.center.loadPage( { page: 1, limit: 25 } );
  }



  public onSearchChange(): void {
    this.center.setSearch( this.searchText );
  }

  public onToggleExpand( entryId: string ): void {
    this.center.toggleExpand( entryId );
  }

  public onToggleSelect( rowId: string ): void {
    this.center.toggleRowSelection( rowId );
  }

  public isRowSelected( rowId: string ): boolean {
    return this.center.isSelected( rowId );
  }

  public onRestoreSelected(): void {
    this.center.restoreSelected().subscribe( {
      next: () => {},
      error: () => {},
    } );
  }

  public onDeleteSelected(): void {
    this.center.purgeSelected().subscribe( {
      next: () => {},
      error: () => {},
    } );
  }

  public formatBytes( bytes: number ): string {
    const b = typeof bytes === "number" && Number.isFinite( bytes ) ? bytes : 0;
    if ( b <= 0 ) return "";
    const units = [ "B", "KB", "MB", "GB", "TB" ];
    let v = b;
    let i = 0;
    while ( v >= 1024 && i < units.length - 1 ) {
      v = v / 1024;
      i += 1;
    }
    const fixed = v >= 10 ? v.toFixed( 0 ) : v.toFixed( 1 );
    return `${ fixed } ${ units[ i ] }`;
  }
}
