// Path: src/app/pages/login/login.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  NotificationDialogComponent,
} from '../../components/dialogs/notification/notificationBar.component';
import { AuthService } from '../../services/auth/auth.service';
import { WindowsRefService } from '../../services/windowRef/windowRef.service';

@Component( {
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    NotificationDialogComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
} )
export class LoginComponent implements OnInit, OnDestroy {

  // ─────────────────────────────────────────────────────────────
  // View children
  // ─────────────────────────────────────────────────────────────

  @ViewChild( NotificationDialogComponent, { static: true } )
  protected notification!: NotificationDialogComponent;

  // ─────────────────────────────────────────────────────────────
  // Template-bound state
  // ─────────────────────────────────────────────────────────────

  protected username: string | null = '';
  protected password: string | null = '';

  protected rememberMe: boolean = false;
  protected hidePassword: boolean = true;

  protected isEmpty: boolean = true;
  protected isError: boolean = false;
  protected isSubmitting: boolean = false;

  protected mode: boolean | null = null;
  protected isUserSaved: boolean = false;

  // ─────────────────────────────────────────────────────────────
  // Internal fields
  // ─────────────────────────────────────────────────────────────

  private readonly isBrowser: boolean;
  private modeSub: Subscription | null = null;

  constructor (
    private readonly windowRef: WindowsRefService,
    protected readonly authService: AuthService,
    private readonly router: Router,
    @Inject( PLATFORM_ID ) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  public async ngOnInit(): Promise<void> {
    if ( this.isBrowser ) {
      ( window as any ).LoginComponent = this;

      this.modeSub = this.windowRef.mode$.subscribe( ( val ) => {
        this.mode = val;
      } );
    }

    // Delegate auto-login + remember-me to AuthService
    const bootstrap = await this.authService.bootstrapLoginView();

    // 1) If auto-login succeeded → redirect and stop
    if ( bootstrap.autoLoggedIn && bootstrap.redirectUrl ) {
      await this.router.navigate( [ bootstrap.redirectUrl ] );
      this.isUserSaved = true;
      return;
    }

    // 2) Otherwise, pre-fill remembered credentials if available
    if ( bootstrap.remembered ) {
      this.username = bootstrap.remembered.username;
      this.password = bootstrap.remembered.password;
      this.rememberMe = bootstrap.remembered.rememberMe ?? true;
      this.isEmpty = false;
    }
  }

  public ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // Template handlers
  // ─────────────────────────────────────────────────────────────

  protected togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  protected updateRememberMe( event: MatCheckboxChange ): void {
    this.rememberMe = event.checked;
  }

  /**
   * Pure UI -> delegates all logic to AuthService.loginWithCredentials
   */
  protected async login(): Promise<void> {
    if ( this.isSubmitting ) {
      return;
    }

    try {
      this.isSubmitting = true;
      this.isError = false;

      const trimmedUsername: string = ( this.username ?? '' ).trim();
      const rawPassword: string = this.password ?? '';

      if ( !trimmedUsername || !rawPassword ) {
        this.isEmpty = true;
        this.notification.notification(
          'error',
          'Username and password cannot be empty.',
        );
        return;
      }

      this.isEmpty = false;

      const result = await this.authService.loginWithCredentials(
        trimmedUsername,
        rawPassword,
        this.rememberMe,
      );

      if ( !result.success ) {
        this.isError = true;
        this.notification.notification(
          'error',
          result.errorMessage || 'Login failed. Please try again.',
        );
        return;
      }

      // MFA branch – AuthService already set tempUsername + challenge
      if ( result.mfaRequired && result.challenge ) {
        await this.router.navigate( [ '/mfa/verification' ] );
        return;
      }

      // Normal login: redirect to provided URL (or dashboard fallback)
      const targetUrl: string = result.redirectUrl || '/dashboard/home';
      await this.router.navigate( [ targetUrl ] );
    } catch ( error: any ) {
      console.error( '[LoginComponent] login error:', error );
      this.isError = true;

      this.notification.notification(
        'error',
        error?.message || 'Unknown error during login.',
      );
    } finally {
      this.isSubmitting = false;
    }
  }
}
