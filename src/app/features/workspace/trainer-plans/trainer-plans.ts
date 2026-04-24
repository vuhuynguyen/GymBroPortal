import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageContainerComponent, PageHeaderComponent } from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-trainer-plans',
  standalone: true,
  imports: [PageContainerComponent, PageHeaderComponent],
  templateUrl: './trainer-plans.html',
  styleUrl: './trainer-plans.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainerPlansComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly tenantService = inject(TenantService);

  private readonly trainerId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('trainerId') ?? ''))
  );

  readonly workspace = computed(() => {
    const id = this.trainerId();
    return this.tenantService.trainerWorkspaces().find((w) => w.id === id) ?? null;
  });

  readonly coachName = computed(() => this.workspace()?.ownerName || null);
}
