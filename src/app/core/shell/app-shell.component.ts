import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { Avatar } from 'primeng/avatar';
import { ButtonComponent } from '../../shared/ui';
import { filter, map, startWith } from 'rxjs/operators';

export interface BreadcrumbItem {
  label: string;
  link: string | null;
}

interface NavItem {
  label: string;
  icon: string;
  route: string;
  activeMatch?: 'prefix';
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent, Avatar],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  readonly appTitle = 'GymBro Portal';
  readonly footerYear = new Date().getFullYear();

  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointObserver);

  readonly mobileSidebarOpen = signal(false);
  /** When true on viewports ≥768px, sidebar shows as a narrow icon rail (240px → 72px). */
  readonly sidebarMinimized = signal(false);

  readonly isMobile = toSignal(
    this.breakpoint.observe('(max-width: 767px)').pipe(map((r) => r.matches)),
    { initialValue: false }
  );

  readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.computeBreadcrumbs()),
      startWith(this.computeBreadcrumbs())
    ),
    { initialValue: this.computeBreadcrumbs() }
  );

  readonly navItems: NavItem[] = [
    // { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dashboard' },
    { label: 'Exercises', icon: 'pi pi-table', route: '/exercises', activeMatch: 'prefix' },
    // { label: 'Settings', icon: 'pi pi-cog', route: '/settings' }
  ];

  readonly sidebarRailMode = computed(
    () => !this.isMobile() && this.sidebarMinimized()
  );

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.mobileSidebarOpen.set(false));
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleSidebarMinimize(): void {
    this.sidebarMinimized.update((v) => !v);
  }

  goSettings(): void {
    void this.router.navigateByUrl('/settings');
  }

  private computeBreadcrumbs(): BreadcrumbItem[] {
    const url = this.router.url.split('?')[0] || '/';
    if (url.startsWith('/exercises/create')) {
      return [
        { label: 'Home', link: '/exercises' },
        { label: 'Exercises', link: '/exercises' },
        { label: 'Create', link: null }
      ];
    }
    if (/\/exercises\/edit\//.test(url)) {
      return [
        { label: 'Home', link: '/dashboard' },
        { label: 'Exercises', link: '/exercises' },
        { label: 'Edit', link: null }
      ];
    }
    if (url.startsWith('/exercises')) {
      return [
        { label: 'Home', link: '/dashboard' },
        { label: 'Exercises', link: null }
      ];
    }
    if (url.startsWith('/settings')) {
      return [
        { label: 'Settings', link: null }
      ];
    }
    return [
      { label: 'Home', link: '/dashboard' },
      { label: 'Dashboard', link: null }
    ];
  }
}
