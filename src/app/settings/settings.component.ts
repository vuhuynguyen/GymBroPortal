import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../shared/ui';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [PageHeaderComponent],
  template: `
    <div class="settings-page flex flex-col gap-6">
      <app-page-header
        title="Settings"
        subtitle="Workspace preferences and account options will live here." />
      <div
        class="settings-panel rounded-inv-lg border border-solid border-inv-border-card bg-inv-surface-base p-8 shadow-inv-card">
        <p class="settings-panel__text">No settings are configured yet.</p>
      </div>
    </div>
  `,
  styles: `
    .settings-panel__text {
      margin: 0;
      font-size: var(--inv-text-body-md);
      color: var(--inv-grey-600);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {}
