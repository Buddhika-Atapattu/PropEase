// Path: src/app/core/security/has-access.directive.ts
// ============================================================================
// HasAccessDirective (attribute directive)
// ----------------------------------------------------------------------------
// Goal:
//   Works on real elements like <button>, <a>, <div> using:
//     [accessKey]="PERM.TeamManagement.delete"
//     accessMode="hide" | "disable"
//
// Why attribute directive:
//   TemplateRef/ViewContainerRef only works for structural directives (*xxx).
//   Buttons need direct DOM manipulation (disable/hide).
// ============================================================================

import { Directive, ElementRef, Input, OnChanges, Renderer2 } from '@angular/core';
import { AccessControlService } from './access-control.service';
import type { PermPair } from './permissions.const';

@Directive({
  selector: '[accessKey]',
  standalone: true,
})
export class HasAccessDirective implements OnChanges {
  /**
   * Permission pair generated from PERM
   * Example: PERM.TeamManagement.delete
   */
  @Input('accessKey') public permission!: PermPair;

  /**
   * How to behave when access is denied:
   *  - 'disable' (default): disable the element
   *  - 'hide'             : display:none
   */
  @Input() public accessMode: 'disable' | 'hide' = 'disable';

  /**
   * Optional manual override (rare)
   * Example: [accessDisabled]="isLoading"
   */
  @Input() public accessDisabled = false;

  constructor(
    private readonly accessService: AccessControlService,
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2
  ) {}

  ngOnChanges(): void {
    this.apply();
  }

  private apply(): void {
    const allowed = this.accessService.can(this.permission);

    // -------------------------
    // Mode: hide
    // -------------------------
    if (this.accessMode === 'hide') {
      this.renderer.setStyle(this.el.nativeElement, 'display', allowed ? '' : 'none');
      return;
    }

    // -------------------------
    // Mode: disable (default)
    // -------------------------
    const shouldDisable = this.accessDisabled || !allowed;

    // Works for real <button>, <input>, etc.
    const anyEl = this.el.nativeElement as any;

    if ('disabled' in anyEl) {
      anyEl.disabled = shouldDisable;
    } else {
      // Fallback for non-form elements
      this.renderer.setAttribute(
        this.el.nativeElement,
        'aria-disabled',
        shouldDisable ? 'true' : 'false'
      );
      this.renderer.setStyle(this.el.nativeElement, 'pointer-events', shouldDisable ? 'none' : '');
      this.renderer.setStyle(this.el.nativeElement, 'opacity', shouldDisable ? '0.55' : '');
    }
  }
}
