// Path: src/app/core/routing/app-title.strategy.ts
import {Inject, Injectable, PLATFORM_ID} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {isPlatformBrowser} from '@angular/common';
import {RouterStateSnapshot, TitleStrategy} from '@angular/router';

@Injectable({providedIn: 'root'})
export class AppTitleStrategy extends TitleStrategy {
  public constructor (private readonly title: Title, @Inject(PLATFORM_ID) private readonly platformId: any) {
    super();
  }

  // Uses route.data['title'] when present; else builds from last segment.
  public override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot) ?? this.autoFromUrl(snapshot.url);
    if(t && isPlatformBrowser(this.platformId)) {
      this.title.setTitle(`PropEase • ${t}`);
    }
  }

  private autoFromUrl(url: string): string {
    const seg = url.split('?')[0].split('/').filter(Boolean).pop() ?? '';
    return seg ? this.toTitle(seg) : 'Dashboard';
  }

  private toTitle(raw: string): string {
    return raw
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, m => m.toUpperCase());
  }
}
