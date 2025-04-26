import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PageNavigatorService {
  private currentPage: string = '';
  private isExpanded: boolean = false;

  constructor() {}

  setCurrentPage(page: string): void {
    this.currentPage = page;
  }
  getCurrentPage(): string {
    return this.currentPage;
  }
  setExpanded(expanded: boolean): void {
    this.isExpanded = expanded;
  }
  isExpandedPanel(): boolean {
    return this.isExpanded;
  }
  toggleExpandedPanel(): void {
    this.isExpanded = !this.isExpanded;
  }
}
