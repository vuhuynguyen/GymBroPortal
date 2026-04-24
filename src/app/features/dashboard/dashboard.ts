import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  constructor() {
    inject(Router).navigateByUrl('/workspace/plans', { replaceUrl: true });
  }
}
