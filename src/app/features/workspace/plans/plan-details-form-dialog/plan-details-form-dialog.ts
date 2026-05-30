import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  model,
  output,
  TemplateRef,
  viewChild,
  ViewContainerRef
} from '@angular/core';
import { take } from 'rxjs/operators';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  FormFieldComponent,
  FormGridComponent,
  InputComponent
} from '../../../../shared/ui';
import { openDialogPortal } from '../../../../shared/ui/dialog/attach-centered-dialog';
import type { PlanDetailsFormValue } from './plan-details-form-dialog.model';

export type { PlanDetailsFormValue } from './plan-details-form-dialog.model';

@Component({
  selector: 'app-plan-details-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, FormGridComponent, InputComponent, ButtonComponent],
  templateUrl: './plan-details-form-dialog.html',
  styleUrl: './plan-details-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanDetailsFormDialogComponent {
  private static nextId = 0;
  private readonly instanceId = ++PlanDetailsFormDialogComponent.nextId;
  readonly titleDomId = `app-plan-details-dialog-title-${this.instanceId}`;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly dialogTpl = viewChild.required<TemplateRef<unknown>>('dialogTpl');

  private overlayRef: OverlayRef | null = null;
  private lastAppliedSeed = -1;

  /** Bump when (re)opening so the dialog form re-syncs from `initialValues`. */
  readonly formSeed = input(0);

  readonly open = model(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValues = input<PlanDetailsFormValue>({
    name: '',
    description: '',
    durationWeeks: '',
    workoutsPerWeek: ''
  });

  /** Parent-driven busy state (e.g. create API in flight). */
  readonly primaryBusy = input(false);

  readonly saved = output<PlanDetailsFormValue>();
  readonly cancelled = output<void>();

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    durationWeeks: [''],
    workoutsPerWeek: ['']
  });

  readonly heading = computed(() =>
    this.mode() === 'create' ? 'Create plan' : 'Edit plan details'
  );

  readonly subheading = computed(() =>
    this.mode() === 'create'
      ? 'Name and optional cycle hints. You will add workouts in the builder next.'
      : 'Update how this plan appears in your workspace. Workouts are edited on the page below.'
  );

  readonly primaryLabel = computed(() => (this.mode() === 'create' ? 'Create' : 'Save changes'));

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const seed = this.formSeed();
      if (!isOpen) {
        this.lastAppliedSeed = -1;
        return;
      }
      if (seed !== this.lastAppliedSeed) {
        this.lastAppliedSeed = seed;
        const v = this.initialValues();
        this.form.reset({
          name: v.name ?? '',
          description: v.description ?? '',
          durationWeeks: v.durationWeeks ?? '',
          workoutsPerWeek: v.workoutsPerWeek ?? ''
        });
      }
    });

    afterRenderEffect(() => {
      const shouldOpen = this.open();
      const tpl = this.dialogTpl();
      if (shouldOpen && !this.overlayRef) {
        this.overlayRef = openDialogPortal(this.overlay, this.viewContainerRef, tpl, () => this.dismiss());
        this.overlayRef
          .detachments()
          .pipe(take(1))
          .subscribe(() => {
            this.overlayRef = null;
            this.open.set(false);
          });
      } else if (!shouldOpen && this.overlayRef) {
        this.overlayRef.dispose();
        this.overlayRef = null;
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Escape') return;
    event.preventDefault();
    this.dismiss();
  }

  fieldError(controlName: 'name' | 'description'): string | null {
    const c = this.form.get(controlName);
    if (!c || !c.touched || !c.errors) return null;
    if (c.errors['required']) return 'Required.';
    if (c.errors['maxlength']) return 'Too long.';
    return null;
  }

  onCancel(): void {
    this.dismiss();
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const durationTrim = raw.durationWeeks.trim();
    const perWeekTrim = raw.workoutsPerWeek.trim();

    if (durationTrim) {
      const n = Number(durationTrim);
      if (!Number.isInteger(n) || n < 2 || n > 4) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Duration',
          detail: 'Leave blank or enter a whole number of weeks between 2 and 4.'
        });
        return;
      }
    }

    if (perWeekTrim) {
      const n = Number(perWeekTrim);
      if (!Number.isInteger(n) || n < 3 || n > 6) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Workouts per week',
          detail: 'Leave blank or enter a whole number between 3 and 6.'
        });
        return;
      }
    }

    const payload: PlanDetailsFormValue = {
      name: raw.name.trim(),
      description: (raw.description ?? '').trim(),
      durationWeeks: durationTrim,
      workoutsPerWeek: perWeekTrim
    };

    this.saved.emit(payload);
  }

  private dismiss(): void {
    this.cancelled.emit();
    this.closePortal();
    this.open.set(false);
  }

  private closePortal(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
