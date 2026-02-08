// Path: src/app/core/security/traffic/traffic-monitor.service.ts

import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type TrafficLogItem = Readonly<{
  atMs: number;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  ok: boolean;
}>;

@Injectable({
  providedIn: 'root',
})
export class TrafficMonitorService {
  private readonly isBrowser: boolean;

  private started: boolean = false;
  private readonly buffer: TrafficLogItem[] = [];
  private readonly BUFFER_LIMIT: number = 500;

  public constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    console.info('[Info:] [Traffic] FE traffic monitor started.\n');
  }

  public stop(): void {
    this.started = false;
    console.info('[Info:] [Traffic] FE traffic monitor stopped.\n');
  }

  public push(item: TrafficLogItem): void {
    if (!this.started) return;

    this.buffer.push(item);
    if (this.buffer.length > this.BUFFER_LIMIT) {
      this.buffer.splice(0, this.buffer.length - this.BUFFER_LIMIT);
    }

    // Optional lightweight console log (you can remove)
    const flag: string = item.ok ? '[Info:]' : '[Warning:]';
    console.log(`${flag} [Traffic] ${item.method} ${item.status} ${item.url} (${item.durationMs}ms)\n`);
  }

  public snapshot(): TrafficLogItem[] {
    return [...this.buffer];
  }

  /**
   * Optional: export logs (browser only) for debugging / audit.
   * You can send this to backend later.
   */
  public exportJson(): string {
    const data: TrafficLogItem[] = this.snapshot();
    return JSON.stringify(
      {
        exportedAtMs: Date.now(),
        count: data.length,
        items: data,
      },
      null,
      2,
    );
  }
}
