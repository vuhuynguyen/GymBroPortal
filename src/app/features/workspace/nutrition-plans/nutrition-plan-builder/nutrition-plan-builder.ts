import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormGroup, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { distinctUntilChanged, map, merge, startWith } from 'rxjs';
import {
  ButtonComponent,
  PageContainerComponent,
  PageStickyFooterComponent,
  PanelCardComponent
} from '../../../../shared/ui';
import { uuid } from '../../../../shared/uuid';
import { TenantService } from '../../../../core/tenant/tenant';
import { NutritionPlanService } from '../nutrition-plan.service';
import type {
  NutritionPlanDetailDto,
  NutritionPlanMealRequest,
  PlanMealItemDto
} from '../nutrition-plan.model';
import {
  STANDARD_MEAL_NAMES,
  dayApplicabilityToLabel,
  dayApplicabilityToValue,
  scheduledTimeToInput,
  scheduledTimeToWire,
  type DayApplicabilityLabel
} from '../nutrition-enums';
import { formatMacroLine, parseQuantity, scaleMacros, sumMacros, type MacroSet } from '../nutrition-macros';
import { FoodPickerPanelComponent, type FoodPickerAddPayload } from '../food-picker-panel/food-picker-panel';
import {
  NutritionPlanDetailsDialogComponent,
  type NutritionPlanDetailsFormValue
} from '../nutrition-plan-details-dialog/nutrition-plan-details-dialog';

/**
 * Nutrition plan builder — stacked meal panel cards with food rows + quantities, macro subtotals per
 * meal and per day, and the workout builder's one-save-one-version UX (clone of `plan-builder`).
 */
@Component({
  selector: 'app-nutrition-plan-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageContainerComponent,
    PanelCardComponent,
    ButtonComponent,
    PageStickyFooterComponent,
    FoodPickerPanelComponent,
    NutritionPlanDetailsDialogComponent,
    Menu,
    Tooltip,
    DragDropModule
  ],
  templateUrl: './nutrition-plan-builder.html',
  styleUrl: './nutrition-plan-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionPlanBuilderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly nutritionPlanService = inject(NutritionPlanService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  readonly planId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly canEdit = computed(() => this.tenantService.currentRole() === 'Owner');

  /** Publish state for the current head: edits land on a draft, only "Publish" advances the live version. */
  readonly version = signal<number | null>(null);
  readonly isDraft = signal(false);
  readonly latestPublishedVersion = signal<number | null>(null);

  /** Which meal is currently using the slide-over food picker (null = closed). */
  readonly pickerMealIndex = signal<number | null>(null);

  readonly planDetailsDialogOpen = signal(false);
  readonly planDetailsDialogSeed = signal(0);
  readonly planDetailsDialogSnapshot = signal<NutritionPlanDetailsFormValue>({ name: '', description: '' });

  /** Shared kebab menu (one element, model swapped per meal) — mirrors the workout builder. */
  readonly mealMenu = viewChild<Menu>('mealMenu');
  readonly mealMenuModel = signal<MenuItem[]>([]);

  /** Per-meal collapse state. A meal is expanded unless explicitly collapsed (default: all open). */
  private readonly collapsedMeals = signal<ReadonlySet<string>>(new Set<string>());

  /** Standard meal-slot suggestions for the meal-name `<datalist>` (any custom text is still allowed). */
  readonly mealNameSuggestions: readonly string[] = STANDARD_MEAL_NAMES;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    meals: this.fb.array<FormGroup>([])
  });

  /** Tracks `form.dirty` via value, status, and unified `events` (dirty/pristine). */
  readonly hasUnsavedChanges = toSignal(
    merge(
      this.form.valueChanges.pipe(map(() => this.form.dirty)),
      this.form.statusChanges.pipe(map(() => this.form.dirty)),
      this.form.events.pipe(map(() => this.form.dirty))
    ).pipe(distinctUntilChanged()),
    { initialValue: false }
  );

  /** Form value as a signal so macro subtotals recompute on any nested change. */
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value), map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  /** Per-meal macro subtotals (each item = food per-serving macros × quantity). */
  readonly mealMacroLines = computed<string[]>(() => {
    void this.formValue();
    const lines: string[] = [];
    const meals = this.meals();
    for (let mi = 0; mi < meals.length; mi++) {
      lines.push(formatMacroLine(sumMacros(this.mealItemMacros(mi))) || 'No macro data');
    }
    return lines;
  });

  /** Whole-day macro total across all meals. */
  readonly dayMacros = computed<MacroSet>(() => {
    void this.formValue();
    const all: MacroSet[] = [];
    const meals = this.meals();
    for (let mi = 0; mi < meals.length; mi++) all.push(...this.mealItemMacros(mi));
    return sumMacros(all);
  });

  readonly dayMacroLine = computed(() => formatMacroLine(this.dayMacros()));

  readonly planSummary = computed(() => {
    void this.formValue();
    let totalItems = 0;
    const mealCount = this.meals().length;
    for (let mi = 0; mi < mealCount; mi++) totalItems += this.itemsAt(mi).length;
    return { mealCount, totalItems };
  });

  /** Meal being targeted by the picker, exposed for the panel's header context. */
  readonly pickerTargetName = computed(() => {
    const mi = this.pickerMealIndex();
    if (mi == null) return null;
    const g = this.meals().at(mi);
    return ((g?.get('name')?.value as string) || '').trim() || null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(), map((p) => p.get('planId'))).subscribe((id) => {
      this.planId.set(id);
      if (id) this.loadPlan(id);
    });
  }

  meals(): FormArray<FormGroup> {
    return this.form.get('meals') as FormArray<FormGroup>;
  }

  itemsAt(mealIndex: number): FormArray<FormGroup> {
    return this.meals().at(mealIndex).get('items') as FormArray<FormGroup>;
  }

  private mealItemMacros(mealIndex: number): MacroSet[] {
    const items = this.itemsAt(mealIndex);
    const out: MacroSet[] = [];
    for (let ii = 0; ii < items.length; ii++) {
      const g = items.at(ii);
      const qty = parseQuantity(g.get('quantity')?.value) ?? 0;
      out.push(scaleMacros(g.get('macros')?.value as MacroSet, qty));
    }
    return out;
  }

  itemMacroLine(mealIndex: number, itemIndex: number): string {
    void this.formValue();
    const g = this.itemsAt(mealIndex).at(itemIndex);
    const qty = parseQuantity(g.get('quantity')?.value);
    if (qty == null) return '';
    return formatMacroLine(scaleMacros(g.get('macros')?.value as MacroSet, qty));
  }

  /** One plan item form group — fields mirror NutritionPlanItemRequest (+ display snapshot fields). */
  private createItemGroup(seed: {
    foodId: string;
    foodName: string;
    servingLabel: string;
    quantity: number;
    macros: MacroSet;
  }): FormGroup {
    return this.fb.group({
      key: [uuid()],
      foodId: [seed.foodId, Validators.required],
      foodName: [seed.foodName],
      servingLabel: [seed.servingLabel],
      quantity: [String(seed.quantity), Validators.required],
      // Per-serving macro snapshot (display-only; the API re-snapshots from the food at save time).
      macros: [seed.macros]
    });
  }

  private createMealGroup(seed?: {
    name?: string;
    scheduledTime?: string;
    dayApplicability?: DayApplicabilityLabel;
  }): FormGroup {
    return this.fb.group({
      key: [uuid()],
      name: [seed?.name ?? '', [Validators.required, Validators.maxLength(120)]],
      scheduledTime: [seed?.scheduledTime ?? ''],
      dayApplicability: [seed?.dayApplicability ?? ('EveryDay' as DayApplicabilityLabel), Validators.required],
      items: this.fb.array<FormGroup>([])
    });
  }

  private loadPlan(id: string): void {
    this.loading.set(true);
    this.nutritionPlanService.get(id).subscribe({
      next: (dto) => this.patchFromDto(dto),
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not load nutrition plan',
          detail: 'It may have been removed or you may not have access.'
        });
      }
    });
  }

  private patchFromDto(dto: NutritionPlanDetailDto): void {
    this.form.patchValue({ name: dto.name, description: dto.description ?? '' });
    this.planDetailsDialogOpen.set(false);

    this.version.set(dto.version);
    this.isDraft.set(dto.isDraft);
    this.latestPublishedVersion.set(dto.latestPublishedVersion);

    const mealsArr = this.meals();
    mealsArr.clear();

    for (const meal of [...dto.meals].sort((a, b) => a.order - b.order)) {
      const mg = this.createMealGroup({
        name: meal.name,
        scheduledTime: scheduledTimeToInput(meal.scheduledTime),
        dayApplicability: dayApplicabilityToLabel(meal.dayApplicability) ?? 'EveryDay'
      });
      const itemsArr = mg.get('items') as FormArray<FormGroup>;
      for (const item of [...meal.items].sort((a, b) => a.order - b.order)) {
        itemsArr.push(this.createItemGroup(this.itemSeedFromDto(item)));
      }
      mealsArr.push(mg);
    }

    this.pickerMealIndex.set(null);
    this.form.markAsPristine();
    this.loading.set(false);
  }

  private itemSeedFromDto(item: PlanMealItemDto) {
    return {
      foodId: item.foodId,
      foodName: item.foodName,
      servingLabel: item.servingLabel,
      quantity: item.quantity,
      macros: {
        energyKcal: item.energyKcal,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG
      }
    };
  }

  /** A meal slot is "taken" if a DIFFERENT meal already uses that name (drives dropdown option disabling). */
  isMealNameTaken(mealIndex: number, name: string): boolean {
    return this.meals().controls.some((g, i) => i !== mealIndex && g.get('name')?.value === name);
  }

  /** The first standard slot not yet used by any meal, or null when all are taken. */
  private nextUnusedMealName(): string | null {
    const used = new Set(this.meals().controls.map((g) => g.get('name')?.value));
    return STANDARD_MEAL_NAMES.find((n) => !used.has(n)) ?? null;
  }

  /** Add Meal is disabled once every standard slot is in use (no duplicate meals allowed). */
  readonly canAddMeal = computed(() => this.meals().length < STANDARD_MEAL_NAMES.length);

  addMeal(): void {
    if (!this.canEdit()) return;
    const name = this.nextUnusedMealName();
    if (name == null) return; // all slots used — no duplicate meals
    this.meals().push(this.createMealGroup({ name }));
    this.form.markAsDirty();
  }

  removeMeal(index: number): void {
    if (!this.canEdit()) return;
    this.cancelPicker();
    this.meals().removeAt(index);
    this.form.markAsDirty();
  }

  moveMeal(index: number, delta: number): void {
    if (!this.canEdit()) return;
    this.cancelPicker();
    const arr = this.meals();
    const next = index + delta;
    if (next < 0 || next >= arr.length) return;
    moveItemInArray(arr.controls, index, next);
    this.form.markAsDirty();
  }

  /** Stable key for a meal (used for collapse identity so reorder/delete don't desync). */
  private mealKey(index: number): string {
    const g = this.meals().at(index);
    const k = g?.get('key')?.value;
    return typeof k === 'string' && k.length > 0 ? k : `meal-${index}`;
  }

  isMealExpanded(index: number): boolean {
    return !this.collapsedMeals().has(this.mealKey(index));
  }

  toggleMealExpanded(index: number): void {
    const key = this.mealKey(index);
    const set = new Set(this.collapsedMeals());
    if (set.has(key)) set.delete(key);
    else set.add(key);
    this.collapsedMeals.set(set);
  }

  openMealMenu(event: Event, mi: number): void {
    if (!this.canEdit()) return;
    this.mealMenuModel.set(this.buildMealMenuItems(mi));
    queueMicrotask(() => this.mealMenu()?.toggle(event));
  }

  private buildMealMenuItems(mi: number): MenuItem[] {
    const len = this.meals().length;
    return [
      {
        label: 'Move up',
        icon: 'pi pi-arrow-up',
        disabled: mi === 0,
        command: () => this.moveMeal(mi, -1)
      },
      {
        label: 'Move down',
        icon: 'pi pi-arrow-down',
        disabled: mi === len - 1,
        command: () => this.moveMeal(mi, 1)
      },
      {
        label: 'Delete meal',
        icon: 'pi pi-trash',
        styleClass: 'text-red-600',
        command: () => this.removeMeal(mi)
      }
    ];
  }

  onMealsDropped(event: CdkDragDrop<unknown>): void {
    if (!this.canEdit() || event.previousIndex === event.currentIndex) return;

    const arr = this.meals();
    const pi = this.pickerMealIndex();
    const pickerFg = pi != null && pi < arr.length ? arr.at(pi) : null;

    moveItemInArray(arr.controls, event.previousIndex, event.currentIndex);

    if (pickerFg) {
      const ni = arr.controls.indexOf(pickerFg);
      if (ni >= 0) this.pickerMealIndex.set(ni);
    }
    this.form.markAsDirty();
  }

  removeItem(mealIndex: number, itemIndex: number): void {
    if (!this.canEdit()) return;
    this.itemsAt(mealIndex).removeAt(itemIndex);
    this.form.markAsDirty();
  }

  trackKey(_index: number, group: AbstractControl): string {
    const k = (group as FormGroup).get('key')?.value;
    return typeof k === 'string' && k.length > 0 ? k : `row-${_index}`;
  }

  openFoodPicker(mealIndex: number): void {
    if (!this.canEdit()) return;
    this.pickerMealIndex.set(mealIndex);
  }

  cancelPicker(): void {
    this.pickerMealIndex.set(null);
  }

  onFoodAdded(payload: FoodPickerAddPayload): void {
    const mi = this.pickerMealIndex();
    if (mi == null || !this.canEdit()) return;
    const items = this.itemsAt(mi);

    // Merge: if this catalog food is already in the meal, sum the quantity instead of a duplicate row.
    const foodId = payload.food.id;
    if (foodId) {
      const existing = items.controls.find((g) => g.get('foodId')?.value === foodId);
      if (existing) {
        const qtyControl = existing.get('quantity');
        const current = Number(qtyControl?.value) || 0;
        qtyControl?.setValue(current + payload.quantity);
        existing.markAsDirty();
        this.form.markAsDirty();
        if (!payload.addAnother) this.cancelPicker();
        return;
      }
    }

    items.push(
      this.createItemGroup({
        foodId: payload.food.id,
        foodName: payload.food.name,
        servingLabel: payload.food.servingLabel,
        quantity: payload.quantity,
        macros: {
          energyKcal: payload.food.energyKcal,
          proteinG: payload.food.proteinG,
          carbsG: payload.food.carbsG,
          fatG: payload.food.fatG,
          fiberG: payload.food.fiberG
        }
      })
    );
    this.form.markAsDirty();
    if (!payload.addAnother) this.cancelPicker();
  }

  openPlanDetailsDialog(): void {
    if (!this.canEdit()) return;
    this.planDetailsDialogSnapshot.set({
      name: (this.form.get('name')?.value ?? '').toString(),
      description: (this.form.get('description')?.value ?? '').toString()
    });
    this.planDetailsDialogSeed.update((n) => n + 1);
    this.planDetailsDialogOpen.set(true);
  }

  onPlanDetailsDialogSaved(v: NutritionPlanDetailsFormValue): void {
    if (!this.canEdit()) return;
    this.form.patchValue({ name: v.name, description: v.description });
    this.form.markAsDirty();
    this.planDetailsDialogOpen.set(false);
  }

  onCancel(): void {
    void this.router.navigate(['/workspace/nutrition-plans']);
  }

  /**
   * Every successful save forks a new immutable plan version with a new id; re-point this page to it so
   * the NEXT save targets the latest version. URL swapped in place (no reload, form state preserved).
   */
  private adoptVersionId(newId: string | null | undefined): void {
    if (!newId || newId === this.planId()) return;
    this.planId.set(newId);
    this.location.replaceState(`/workspace/nutrition-plans/${newId}`);
  }

  /** Walks the form to name the first invalid field, so the warning points to exactly what to fix. */
  private describeFirstInvalid(): string | null {
    if (this.form.get('name')?.invalid) return 'Plan name is required.';
    const meals = this.meals();
    for (let mi = 0; mi < meals.length; mi++) {
      const mealGroup = meals.at(mi);
      const mealName = ((mealGroup.get('name')?.value as string) || '').trim() || `Meal ${mi + 1}`;
      if (mealGroup.get('name')?.invalid) return `“${mealName}”: meal name is required.`;
      const items = this.itemsAt(mi);
      for (let ii = 0; ii < items.length; ii++) {
        const itemGroup = items.at(ii);
        if (itemGroup.get('foodId')?.invalid) return `“${mealName}” · item ${ii + 1}: pick a food.`;
        if (parseQuantity(itemGroup.get('quantity')?.value) == null)
          return `“${mealName}” · item ${ii + 1}: quantity must be a positive number.`;
      }
    }
    return null;
  }

  savePlan(): void {
    if (!this.canEdit()) return;
    const id = this.planId();
    if (!id) return;

    this.form.markAllAsTouched();
    const invalid = this.describeFirstInvalid();
    if (this.form.invalid || invalid) {
      if (this.form.get('name')?.invalid) this.openPlanDetailsDialog();
      this.messageService.add({
        severity: 'warn',
        summary: 'Check fields',
        detail: invalid ?? 'Fix the highlighted field before saving.'
      });
      return;
    }

    const structure = this.buildStructurePayload();
    if (structure.error) {
      this.messageService.add({ severity: 'warn', summary: 'Structure', detail: structure.error });
      return;
    }

    this.saving.set(true);

    // Metadata + meals go in ONE request so the save lands as a single new version; re-point to the
    // returned latest-version id (mirrors the workout builder).
    this.nutritionPlanService
      .replaceStructure(id, {
        name: (this.form.get('name')?.value ?? '').toString().trim(),
        description: (this.form.get('description')?.value ?? '').toString().trim() || null,
        meals: structure.meals!
      })
      .subscribe({
        next: (ref) => {
          this.saving.set(false);
          this.adoptVersionId(ref.id);
          // The save landed on the draft head — there are now unpublished changes to publish.
          this.isDraft.set(true);
          this.form.markAsPristine();
          this.messageService.add({
            severity: 'success',
            summary: 'Draft saved',
            detail: 'Saved as a draft. Publish to push it to assigned trainees.'
          });
        },
        error: (err: { error?: unknown }) => {
          this.saving.set(false);
          const msg = typeof err?.error === 'string' ? err.error : 'Save failed.';
          this.messageService.add({ severity: 'error', summary: 'Save failed', detail: msg });
        }
      });
  }

  /**
   * Publishes the draft head — the only action that advances the version trainees/assignments see. Requires the
   * form to be saved first (unsaved edits aren't on the server yet), and only fires when there's a draft to publish.
   */
  publishPlan(): void {
    if (!this.canEdit()) return;
    const id = this.planId();
    if (!id) return;
    if (this.hasUnsavedChanges()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Save first',
        detail: 'Save your changes before publishing.'
      });
      return;
    }
    if (!this.isDraft()) return;

    this.publishing.set(true);
    this.nutritionPlanService.publish(id).subscribe({
      next: ({ version }) => {
        this.publishing.set(false);
        this.version.set(version);
        this.latestPublishedVersion.set(version);
        this.isDraft.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Published',
          detail: `Published as v${version}. Assigned trainees can now move to this version.`
        });
      },
      error: (err: { error?: unknown }) => {
        this.publishing.set(false);
        const msg = typeof err?.error === 'string' ? err.error : 'Publish failed.';
        this.messageService.add({ severity: 'error', summary: 'Publish failed', detail: msg });
      }
    });
  }

  private buildStructurePayload():
    | { meals: NutritionPlanMealRequest[]; error: null }
    | { meals: null; error: string } {
    const mealsArr = this.meals();
    const meals: NutritionPlanMealRequest[] = [];

    for (let mi = 0; mi < mealsArr.length; mi++) {
      const mg = mealsArr.at(mi);
      const name = ((mg.get('name')?.value as string) || '').trim();
      if (!name) return { meals: null, error: 'Each meal needs a name.' };

      const itemsArr = this.itemsAt(mi);
      if (itemsArr.length === 0)
        return { meals: null, error: `Add at least one food to "${name}" (or remove the meal).` };

      const items = [];
      for (let ii = 0; ii < itemsArr.length; ii++) {
        const ig = itemsArr.at(ii);
        const foodId = ((ig.get('foodId')?.value as string) || '').trim();
        if (!foodId) return { meals: null, error: 'Select a food for every row.' };
        const quantity = parseQuantity(ig.get('quantity')?.value);
        if (quantity == null)
          return { meals: null, error: `"${name}" item ${ii + 1}: quantity must be a positive number.` };
        items.push({ foodId, order: ii + 1, quantity });
      }

      const day = dayApplicabilityToLabel(mg.get('dayApplicability')?.value) ?? 'EveryDay';
      meals.push({
        name,
        order: mi + 1,
        scheduledTime: scheduledTimeToWire(mg.get('scheduledTime')?.value),
        dayApplicability: dayApplicabilityToValue(day),
        items
      });
    }

    return { meals, error: null };
  }
}
