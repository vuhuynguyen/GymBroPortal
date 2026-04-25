import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui';
import type { TrainerPlanItem } from '../trainer-plans';

@Component({
  selector: 'app-plan-card',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './plan-card.html',
  styleUrl: './plan-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanCardComponent {
  readonly plan = input.required<TrainerPlanItem>();
  readonly viewClicked = output<TrainerPlanItem>();

  readonly canView = computed(() => this.plan().visibilityMode === 'Full');
  readonly buttonLabel = computed(() => (this.canView() ? 'View Plan' : 'Plan Locked'));
}
