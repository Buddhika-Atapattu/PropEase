import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
    CommonModule,
    MatAutocompleteModule,
  ],
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent
  implements OnInit, OnDestroy, AfterViewInit, OnChanges
{
  @Input() pageCount: number = 0;
  @Input() pageIndex: number = 0;
  @Input() pageSize: number = 0;
  @Input() totalDataCount: number = 0;
  @Input() tableType: string = '';
  @Input() pageSizeOptions: number[] = [];
  @Input() tenantName: string = '';
  @Input() isPaginationEnabled: boolean = false;
  @Input() isReload: boolean = false;
  @Output() pageCountChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() pageIndexChange = new EventEmitter<number>();
  @Output() tenantNameChange = new EventEmitter<string>();
  @Output() isReloadChange = new EventEmitter<boolean>();

  protected name: string = '';
  protected isRefreshFinished: boolean = false;

  // protected pageSizeOptions: number[] = [];
  protected selectedPageSize: number = 0;

  constructor() {}

  ngOnInit() {
    if (this.pageSizeOptions.length > 0) {
      this.selectedPageSize = this.pageSizeOptions[0];
    }
  }

  ngAfterViewInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {}

  ngOnDestroy(): void {}

  protected onPageSizeChanged(newSize: number) {
    this.isPaginationEnabled = newSize < this.totalDataCount;
    this.pageSize = newSize;
    this.pageSizeChange.emit(this.pageSize);
    this.pageCount = Math.ceil(this.totalDataCount / newSize);
    this.pageCountChange.emit(this.pageCount);
    this.pageIndex = 0;
    this.pageIndexChange.emit(this.pageIndex);
  }

  protected onTenantNameChanged(input: string) {
    this.tenantName = input;
    this.tenantNameChange.emit(this.tenantName);
  }

  private paginationChecker(type: string): number {
    switch (type) {
      case 'doubleBackword':
        return -this.pageSize * 2;
      case 'backward':
        return -1;
      case 'forward':
        return 1;
      case 'doubleForward':
        return this.pageSize * 2;
      default:
        return 0;
    }
  }

  protected onPageIndexChanged(type: string): void {
    const delta = this.paginationChecker(type);
    let newIndex = this.pageIndex + delta;

    // Clamp the value within [0, pageCount - 1]
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= this.pageCount) newIndex = this.pageCount - 1;

    if (newIndex !== this.pageIndex) {
      this.pageIndex = newIndex;
      this.pageIndexChange.emit(this.pageIndex);
    }
  }

  protected refreshPage() {
    this.isReload = true;
    this.isRefreshFinished = true;
    this.isReloadChange.emit(this.isReload);
    setTimeout(() => {
      this.isRefreshFinished = false;
    }, 500);
  }
}
