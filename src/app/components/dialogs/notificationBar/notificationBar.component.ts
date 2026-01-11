import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type msgTypes =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'primary'
  | 'secondary'
  | 'light'
  | 'dark'
  | 'neutral'
  | 'active'
  | 'inactive'
  | 'processing'
  | 'pending';


const DEFAULT_TYPE_ARRAY: ReadonlyArray<msgTypes> =
  [
    'active',
    'dark',
    'error',
    'inactive',
    'info',
    'light',
    'neutral',
    'pending',
    'primary',
    'processing',
    'secondary',
    'success'
  ];

type SoundKey = msgTypes | 'default';



export interface msg {
  type: msgTypes | string;
  message: string;
}

export interface NotificationType {
  type: msgTypes | string;
  message: string;
}

@Component( {
  selector: 'app-notification-dialog',
  standalone: true,
  imports: [ CommonModule, MatIconModule ],
  templateUrl: './notificationBar.component.html',
  styleUrl: './notificationBar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class NotificationDialogComponent
  implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild( 'notification' )
  public notificationElement!: ElementRef<HTMLDivElement>;

  private readonly isBrowser: boolean;

  protected status: msg[ 'type' ] = 'error';
  protected message: string = '';
  protected showNotification: boolean = false;
  protected isHovered: boolean = false;
  protected isIncomingMessage: boolean = false;

  private readonly notificationSoundPath: string =
    'sounds/notification-pop-up.mp3';


  private readonly soundPaths: ReadonlyArray<{ key: string, path: string; }> = [
    { key: 'success', path: 'sounds/success.mp3' },
    { key: 'info', path: 'sounds/info.mp3' },
    { key: 'warning', path: 'sounds/warning.mp3' },
    { key: 'error', path: 'sounds/error.mp3' },
    { key: 'default', path: 'sounds/notification-pop-up.mp3' },
  ];

  /**
   * Preloaded audio element for the notification sound.
   * Only created/used in the browser.
   */
  private audioElement: HTMLAudioElement | null = null;

  private isDestroyed: boolean = false;

  constructor (
    @Inject( PLATFORM_ID ) private readonly platformId: object,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser( this.platformId );
  }

  public ngAfterViewInit(): void {
    // Nothing special yet; kept for future DOM-related logic.
  }

  public ngOnInit(): void {
    // Preload audio on first load (browser only).
    if ( this.isBrowser ) {
      this.initAudio( this.status );
    }
  }

  public ngOnDestroy(): void {
    this.isDestroyed = true;
    this.audioElement = null;
  }

  /**
   * Public API to show a notification.
   * `incoming = true` → also play the pop-up sound.
   */
  public async notification(
    status: msg[ 'type' ],
    message: string,
  ): Promise<void> {
    this.status = status;
    this.message = message;
    this.showNotification = true;
    this.isIncomingMessage = true;

    if ( this.cdr && this.isBrowser ) {
      this.cdr.detectChanges();
      await new Promise( ( resolve ) => setTimeout( resolve ) );
    }

    // Play sound only for incoming notifications (you can change this rule if needed)
    if ( this.isBrowser ) {
      await this.playNotificationSound( this.status );
    }

    if ( !this.isHovered ) {
      setTimeout( () => {
        this.showNotification = false;
        if ( this.cdr && !this.isDestroyed && this.isBrowser ) {
          this.cdr.detectChanges();
        }
      }, 5000 );
    }
  }

  protected onMouseOver(): void {
    this.isHovered = true;
  }

  protected onMouseOut(): void {
    this.isHovered = false;
  }

  protected close(): void {
    this.showNotification = false;
    if ( this.cdr && this.isBrowser ) {
      this.cdr.detectChanges();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Audio helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Creates and preloads the audio element (browser only).
   */
  private initAudio( status: msg[ 'type' ] ): void {
    if ( !this.isBrowser ) {
      return;
    }

    try {
      const soundPath: string = this.resolveSoundPath( status );

      this.audioElement = new Audio( soundPath );
      this.audioElement.preload = 'auto';
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.error(
        '[Error:] [NotificationSound] Failed to initialise audio element.\n',
        error
      );
    }
  }


  private toSoundKey( status: msg[ 'type' ] ): SoundKey {
    const trimmed: string = String( status ?? '' ).trim();

    if ( !trimmed ) {
      return 'default';
    }

    // Check if it's one of the known msgTypes
    const isKnown: boolean = ( DEFAULT_TYPE_ARRAY as ReadonlyArray<string> ).includes(
      trimmed
    );

    if ( isKnown ) {
      return trimmed as msgTypes;
    }

    return 'default';
  }

  private resolveSoundPath( status: msg[ 'type' ] ): string {
    const key: SoundKey = this.toSoundKey( status );

    const found = this.soundPaths.find( ( item ) => item.key === key );
    if ( found ) {
      return found.path;
    }

    const fallback = this.soundPaths.find( ( item ) => item.key === 'default' );
    if ( fallback ) {
      return fallback.path;
    }

    // final fallback in case array changed
    return 'sounds/notification-pop-up.mp3';
  }


  /**
   * Plays the notification sound from the beginning.
   * Respects SSR and browser autoplay constraints.
   */
  private async playNotificationSound(status: msg['type']): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    if (!this.audioElement) {
      this.initAudio(status);
    } else {
      // If already created for a different status, re-init to ensure correct sound
      const soundPath: string = this.resolveSoundPath(status);
      if (this.audioElement.src.indexOf(soundPath) === -1) {
        this.initAudio(status);
      }
    }

    if (!this.audioElement) {
      return;
    }

    try {
      this.audioElement.currentTime = 0;
      await this.audioElement.play();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[Warning:] [NotificationSound] Unable to play notification sound (possibly due to browser autoplay policy).\n',
        error
      );
    }
  }

}
