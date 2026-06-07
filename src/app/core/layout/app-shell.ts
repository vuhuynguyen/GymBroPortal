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
import { AuthService } from '../auth/auth';
import { TenantService } from '../tenant/tenant';
import { ProfilePanelComponent } from './profile-panel/profile-panel';
import { ChangePasswordPanelComponent } from './change-password-panel/change-password-panel';
import { JoinGymBroPanelComponent } from './join-gymbro-panel/join-gymbro-panel';
import { InviteGymBroPanelComponent } from './invite-gymbro-panel/invite-gymbro-panel';
import { InviteGymBroPanelService } from './invite-gymbro-panel/invite-gymbro-panel.service';

export interface BreadcrumbItem {
  label: string;
  link: string | null;
}

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  activeMatch?: 'prefix';
  section: 'general' | 'trainer' | 'trainee' | 'admin';
  /** Opens the Invite to GymBro side panel instead of navigating to `route`. */
  opensInviteGymBroPanel?: boolean;
  /** Opens the Join GymBro side panel instead of navigating to `route`. */
  opensJoinGymBroPanel?: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent, Avatar, ProfilePanelComponent, ChangePasswordPanelComponent, JoinGymBroPanelComponent, InviteGymBroPanelComponent],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  readonly appTitle = 'GymBro Portal';
  readonly footerYear = new Date().getFullYear();

  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointObserver);
  private readonly auth = inject(AuthService);
  private readonly inviteGymBroPanelService = inject(InviteGymBroPanelService);
  readonly tenantService = inject(TenantService);

  readonly currentUser = this.auth.currentUser;
  readonly isPlatformAdmin = this.auth.isPlatformAdmin;
  readonly activeTenant = this.tenantService.activeTenant;
  readonly tenants = this.tenantService.tenants;
  readonly currentRole = this.tenantService.currentRole;
  readonly ownTenant = this.tenantService.ownTenant;
  readonly hasClients = this.tenantService.hasClients;
  readonly trainerWorkspaces = this.tenantService.trainerWorkspaces;
  readonly coachingWorkspaceIds = computed<string[]>(() => {
    const trainerIds = this.trainerWorkspaces().map((w) => w.id);
    if (trainerIds.length > 0) return trainerIds;
    const ownId = this.ownTenant()?.id;
    return ownId ? [ownId] : [];
  });

  readonly showProfilePanel = signal(false);
  readonly showChangePasswordPanel = signal(false);
  readonly showJoinGymBroPanel = signal(false);
  readonly showInviteGymBroPanel = signal(false);
  readonly userMenuOpen = signal(false);
  readonly mobileSidebarOpen = signal(false);
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

  /** Path from last NavigationEnd — ignore duplicate events for the same path so overlays stay open. */
  private lastNavigationEndPath = '';

  readonly sidebarRailMode = computed(() => !this.isMobile() && this.sidebarMinimized());

  readonly navItems = computed<NavItem[]>(() => {
    if (this.isPlatformAdmin()) {
      return [
        { label: 'Exercises', icon: 'pi pi-table', route: '/exercises', activeMatch: 'prefix', section: 'general' },
        { label: 'Tenants', icon: 'pi pi-building', route: '/admin/tenants', activeMatch: 'prefix', section: 'admin' },
        { label: 'Users', icon: 'pi pi-users', route: '/admin/users', activeMatch: 'prefix', section: 'admin' },
      ];
    }

    const items: NavItem[] = [];

    // Base: always visible for regular users
    items.push(
      { label: 'My Plans', icon: 'pi pi-calendar', route: '/workspace/plans', activeMatch: 'prefix', section: 'general' },
      { label: 'Workout Log', icon: 'pi pi-history', route: '/workspace/logs', activeMatch: 'prefix', section: 'general' }
    );

    // Trainer section — invite always visible; clients only once someone has joined
    if (this.ownTenant()) {
      items.push({
        label: 'Plan Assignments',
        icon: 'pi pi-sitemap',
        route: '/workspace/plan-assignments',
        activeMatch: 'prefix',
        section: 'general'
      });

      if (this.hasClients()) {
        items.push(
          { label: 'GymBros', icon: 'pi pi-users', route: '/workspace/clients', activeMatch: 'prefix', section: 'trainer' }
        );
      }
      items.push({
        label: 'Invite to GymBro',
        icon: 'pi pi-user-plus',
        route: '__invite_gymbro_panel__',
        section: 'trainer',
        opensInviteGymBroPanel: true
      });
    }

    items.push({
      label: 'Join GymBro',
      icon: 'pi pi-sign-in',
      route: '__join_gymbro_panel__',
      section: 'trainer',
      opensJoinGymBroPanel: true
    });

    // Trainee sections: one per joined trainer workspace
    for (const ws of this.trainerWorkspaces()) {
      const trainerName = ws.ownerName ?? ws.name;
      items.push({
        label: trainerName,
        icon: 'pi pi-bolt',
        route: `/workspace/trainer/${ws.id}/plans`,
        activeMatch: 'prefix',
        section: 'trainee'
      });
    }

    return items;
  });

  readonly generalNavItems = computed(() => this.navItems().filter((i) => i.section === 'general'));
  readonly trainerNavItems = computed(() => this.navItems().filter((i) => i.section === 'trainer'));
  readonly traineeNavItems = computed(() => this.navItems().filter((i) => i.section === 'trainee'));
  readonly adminNavItems = computed(() => this.navItems().filter((i) => i.section === 'admin'));

  readonly roleBadge = computed<string>(() => {
    if (this.isPlatformAdmin()) return 'Platform Admin';
    const hasClients = this.hasClients();
    const trainers = this.trainerWorkspaces();
    if (hasClients && trainers.length > 0) return 'Trainer & Trainee';
    if (hasClients) return 'Trainer';
    if (trainers.length > 0) return 'Trainee';
    return 'Personal Training';
  });

  constructor() {
    this.lastNavigationEndPath = this.router.url.split('?')[0] || '/';

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((e) => {
        this.mobileSidebarOpen.set(false);
        this.userMenuOpen.set(false);
        const path = e.urlAfterRedirects.split('?')[0] || '/';
        if (path !== this.lastNavigationEndPath) {
          this.lastNavigationEndPath = path;
          this.showInviteGymBroPanel.set(false);
          this.showJoinGymBroPanel.set(false);
        }
      });

    // Tenants are already loaded by authGuard before the shell activates; ensureLoaded() is the
    // idempotent safety net (no double-fetch). Use loadTenants() only to force a post-mutation refresh.
    void this.tenantService.ensureLoaded();

    this.inviteGymBroPanelService.openRequests$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.showInviteGymBroPanel.set(true);
        this.mobileSidebarOpen.set(false);
      });
  }

  toggleMobileSidebar(): void { this.mobileSidebarOpen.update((v) => !v); }
  closeMobileSidebar(): void { this.mobileSidebarOpen.set(false); }
  toggleSidebarMinimize(): void { this.sidebarMinimized.update((v) => !v); }
  toggleUserMenu(): void { this.userMenuOpen.update((v) => !v); }

  openProfile(): void {
    this.userMenuOpen.set(false);
    this.showProfilePanel.set(true);
    this.mobileSidebarOpen.set(false);
  }

  openChangePassword(): void {
    this.userMenuOpen.set(false);
    this.showChangePasswordPanel.set(true);
    this.mobileSidebarOpen.set(false);
  }

  openInviteClient(): void {
    this.openInviteGymBroPanel();
  }

  openJoinGymBroPanel(): void {
    this.userMenuOpen.set(false);
    this.showJoinGymBroPanel.set(true);
    this.mobileSidebarOpen.set(false);
  }

  openInviteGymBroPanel(): void {
    this.inviteGymBroPanelService.requestOpen();
  }

  goSettings(): void {
    this.userMenuOpen.set(false);
    void this.router.navigateByUrl('/settings');
  }

  logout(): void { this.auth.logout(); }

  switchTenant(id: string): void {
    this.tenantService.setActiveTenant(id);
    this.userMenuOpen.set(false);
  }

  private computeBreadcrumbs(): BreadcrumbItem[] {
    const url = this.router.url.split('?')[0] || '/';
    if (url.startsWith('/exercises/create')) return [{ label: 'Exercises', link: '/exercises' }, { label: 'Create', link: null }];
    if (/\/exercises\/edit\//.test(url)) return [{ label: 'Exercises', link: '/exercises' }, { label: 'Edit', link: null }];
    if (url.startsWith('/exercises')) return [{ label: 'Exercises', link: null }];
    if (url.startsWith('/workspace/clients')) return [{ label: 'GymBro', link: null }];
    if (url.startsWith('/workspace/members')) return [{ label: 'Team', link: null }];
    if (url.startsWith('/workspace/plans/'))
      return [
        { label: 'My Plans', link: '/workspace/plans' },
        { label: 'Plan', link: null }
      ];
    if (url.startsWith('/workspace/plans')) return [{ label: 'My Plans', link: null }];
    if (url.startsWith('/workspace/logs/session/'))
      return [
        { label: 'Home', link: '/' },
        { label: 'Workout Log', link: '/workspace/logs' },
        { label: 'Session', link: null }
      ];
    if (url.startsWith('/workspace/logs'))
      return [
        { label: 'Home', link: '/' },
        { label: 'Dashboard', link: '/workspace/plans' },
        { label: 'Workout Log', link: null }
      ];
    if (url.startsWith('/workspace/trainer')) return [{ label: 'Assigned Plans', link: null }];
    if (url.startsWith('/admin/tenants')) return [{ label: 'Admin', link: null }, { label: 'Tenants', link: null }];
    if (url.startsWith('/admin/users')) return [{ label: 'Admin', link: null }, { label: 'Users', link: null }];
    if (url.startsWith('/settings')) return [{ label: 'Settings', link: null }];
    return [{ label: 'Dashboard', link: null }];
  }
}
