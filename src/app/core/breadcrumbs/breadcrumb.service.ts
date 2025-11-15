import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  UrlSegment,
} from '@angular/router';
import {BehaviorSubject, filter} from 'rxjs';
import {isPlatformBrowser} from '@angular/common';

export interface Crumb {
  label: string;
  url: string;
}

@Injectable({providedIn: 'root'})
export class BreadcrumbService {
  private readonly crumbs$ = new BehaviorSubject<Crumb[]>([]);
  public readonly breadcrumbs$ = this.crumbs$.asObservable();

  private lastSectionLabel: string | null = null;

  private readonly sectionPaths = new Set<string>(['/tenants', '/properties', '/dashboard']);

  // Keep labels EXACTLY as your route data.title values for consistency.
  private readonly sectionLabelToUrl: Record<string, string> = {
    Tenant: '/tenants',
    Tenants: '/tenants',
    Properties: '/properties',
    Dashboard: '/dashboard',
  };

  public constructor (
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.rebuild());
  }

  private rebuild(): void {
    const tree = this.fromActivatedRoute(this.route.root);

    const section = this.detectSection(tree);
    if(section) {
      this.lastSectionLabel = section.label;
      if(isPlatformBrowser(this.platformId)) {
        try {sessionStorage.setItem('pe:lastSectionLabel', this.lastSectionLabel);} catch {}
      }
    } else if(!this.lastSectionLabel && isPlatformBrowser(this.platformId)) {
      try {
        const saved = sessionStorage.getItem('pe:lastSectionLabel');
        if(saved) this.lastSectionLabel = saved;
      } catch {}
    }

    const currentPath = tree.length ? tree[tree.length - 1].url : this.router.url;

    if(this.isEntityView(currentPath) && this.lastSectionLabel && !tree.some(c => c.label === this.lastSectionLabel)) {
      tree.unshift({
        label: this.lastSectionLabel,
        url: this.sectionUrlForLabel(this.lastSectionLabel),
      });
    }

    this.crumbs$.next(tree);
  }

  private fromActivatedRoute(root: ActivatedRoute): Crumb[] {
    const out: Crumb[] = [];
    let ar: ActivatedRoute | null = root;
    let urlAcc = '';

    while(ar) {
      const child: ActivatedRoute | null = ar.firstChild;
      if(!child) break;

      const snap: ActivatedRouteSnapshot = child.snapshot;
      const segs: string[] = snap.url
        .map((seg: UrlSegment) => seg.path)
        .filter((p: string): p is string => Boolean(p));

      if(segs.length > 0) {
        urlAcc += '/' + segs.join('/');
        const label =
          (typeof snap.data?.['title'] === 'string' && snap.data['title']) ||
          this.autoLabel(segs[segs.length - 1]);
        out.push({label, url: urlAcc});
      }

      ar = child;
    }
    return out;
  }

  private autoLabel(raw: string): string {
    const cleaned = raw.replace(/%20/g, ' ').replace(/[-_]/g, ' ').trim();
    return cleaned ? cleaned.replace(/\b\w/g, (m: string) => m.toUpperCase()) : 'Untitled';
  }

  private normalizeUrl(u: string): string {
    return u.split('?')[0];
  }

  private detectSection(crumbs: Crumb[]): Crumb | null {
    for(const c of crumbs) {
      if(this.sectionPaths.has(this.normalizeUrl(c.url))) return c;
    }
    return null;
  }

  private isEntityView(url: string): boolean {
    const u = this.normalizeUrl(url);
    return /^\/property\/[^/]+/.test(u) || /^\/tenant\/[^/]+/.test(u);
  }

  private sectionUrlForLabel(label: string): string {
    return this.sectionLabelToUrl[label] ?? '/';
  }
}
