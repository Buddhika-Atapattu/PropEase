// Path: src/app/services/security/session-expiry-ui.service.ts

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';

export interface SessionExpiryWarning {
  secondsLeft: number;
  expiresAt?: Date | null;
  /** Epoch millis when this warning was last updated from server. */
  updatedAt: number;
}

@Injectable( { providedIn: 'root' } )
export class SessionExpiryUiService {
  private readonly isBrowser: boolean;

  private warningSubject = new BehaviorSubject<SessionExpiryWarning | null>( null );
  public readonly warning$: Observable<SessionExpiryWarning | null> =
    this.warningSubject.asObservable();

  private tickSub: Subscription | null = null;

  constructor ( @Inject( PLATFORM_ID ) platformId: Object ) {
    this.isBrowser = isPlatformBrowser( platformId );
  }

  /**
   * Called by the interceptor when backend signals that session is near expiry.
   * Starts/refreshes a 1s countdown on the client.
   */
  public showWarning( secondsLeft: number, expiresAtIso?: string | null ): void {
    if ( !this.isBrowser ) {
      return;
    }

    const now = Date.now();

    let expiresAt: Date | null = null;
    if ( expiresAtIso ) {
      const parsed = new Date( expiresAtIso );
      if ( !Number.isNaN( parsed.getTime() ) ) {
        expiresAt = parsed;
      }
    }

    // Update state
    this.warningSubject.next( {
      secondsLeft: Math.max( 0, secondsLeft ),
      expiresAt,
      updatedAt: now,
    } );

    // (Re)start client-side countdown
    this.startTicking();
  }

  /** Clears the warning banner / countdown. */
  public clearWarning(): void {
    this.warningSubject.next( null );
    if ( this.tickSub ) {
      this.tickSub.unsubscribe();
      this.tickSub = null;
    }
  }

  /**
   * Simple client-side countdown (1 second interval).
   * If server sends a new warning with fresher data, showWarning() will
   * update the state and the next tick will work from that.
   */
  private startTicking(): void {
    if ( !this.isBrowser ) {
      return;
    }

    if ( this.tickSub ) {
      this.tickSub.unsubscribe();
    }

    this.tickSub = interval( 1000 ).subscribe( () => {
      const current = this.warningSubject.value;
      if ( !current ) {
        return;
      }

      const nextSeconds = current.secondsLeft - 1;

      if ( nextSeconds <= 0 ) {
        this.warningSubject.next( {
          ...current,
          secondsLeft: 0,
        } );
        // Do NOT auto-clear here; let the component react (e.g. auto-logout).
        return;
      }

      this.warningSubject.next( {
        ...current,
        secondsLeft: nextSeconds,
      } );
    } );
  }
}
