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
import { ButtonComponent, FormFieldComponent, InputComponent } from '../../../../shared/ui';
import { openDialogPortal } from '../../../../shared/ui/dialog/attach-centered-dialog';

/** Payload for nutrition plan create / details edit (string fields match reactive form controls). */
export interface NutritionPlanDetailsFormValue {
  name: string;
  description: string;
}

/** Create/edit dialog for nutrition plan name + description — clone of `plan-details-form-dialog`. */
@Component({
  selector: 'app-nutrition-plan-details-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, InputComponent, ButtonComponent],
  templateUrl: './nutrition-plan-details-dialog.html',
  styleUrl: './nutrition-plan-details-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionPlanDetailsDialogComponent {
  private static nextId = 0;
  private readonly instanceId = ++NutritionPlanDetailsDialogComponent.nextId;
  readonly titleDomId = `app-nutrition-plan-details-dialog-title-${this.instanceId}`;

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
  readonly initialValues = input<NutritionPlanDetailsFormValue>({ name: '', description: '' });

  /** Parent-driven busy state (e.g. create API in flight). */
  readonly primaryBusy = input(false);

  readonly saved = output<NutritionPlanDetailsFormValue>();
  readonly cancelled = output<void>();

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]]
  });

  readonly heading = computed(() =>
    this.mode() === 'create' ? 'Create nutrition plan' : 'Edit plan details'
  );

  readonly subheading = computed(() =>
    this.mode() === 'create'
      ? 'Name and optional notes. You will add meals and foods in the builder next.'
      : 'Update how this plan appears in your workspace. Meals are edited on the page below.'
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
        this.form.reset({ name: v.name ?? '', description: v.description ?? '' });
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
    if (this.form.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Check fields',
        detail: 'Fix validation errors before saving.'
      });
      return;
    }

    const raw = this.form.getRawValue();
    this.saved.emit({ name: raw.name.trim(), description: (raw.description ?? '').trim() });
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
