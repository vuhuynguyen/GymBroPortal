import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, firstValueFrom, startWith, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent } from '../../../../shared/ui';
import { formatMacroLine, parseQuantity, scaleMacros, type MacroSet } from '../nutrition-macros';
import { FoodService } from '../food.service';
import type { CreateCustomFoodRequest, FoodDto, FoodKind } from '../food.model';

/**
 * Inline custom-food snapshot the picker can emit (off-plan ad-hoc add only — no catalog row). The
 * builder path resolves a custom food to a real catalog `food` before emitting, so `custom` is null there.
 */
export interface FoodPickerCustomPayload {
  name: string;
  kind: FoodKind;
  servingLabel: string;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export interface FoodPickerAddPayload {
  /** Resolved catalog food (always present — even a builder custom-food create resolves to a stub food). */
  food: FoodDto;
  quantity: number;
  addAnother: boolean;
  /** Meal slot chosen in off-plan mode ("Log under …"); null for builder/substitute. */
  mealName: string | null;
  /** Inline custom-food snapshot for an off-plan ad-hoc add (no catalog food); null otherwise. */
  custom: FoodPickerCustomPayload | null;
}

/**
 * The picker's operating context, which gates custom-food behaviour:
 *  - `builder`    plan-item add → a custom food must be POSTed to the catalog first (plans need a foodId).
 *  - `offplan`    trainee off-plan add → a custom food is emitted INLINE (no catalog row) + a meal slot.
 *  - `substitute` swap a planned item → catalog food ONLY (the API rejects inline custom here).
 */
export type FoodPickerMode = 'builder' | 'offplan' | 'substitute';

/** Kind tabs shown above the search list; "All" is the default. */
const ALL_KINDS = 'All' as const;
const FOOD_KINDS: readonly FoodKind[] = ['Food', 'Supplement', 'Beverage'];
type KindTab = typeof ALL_KINDS | FoodKind;

/**
 * Slide-over food search picker — used by BOTH the coach plan builder and the trainee off-plan log, so
 * its behaviour is gated by `mode`. Search hits `/api/foods` server-side; a "New custom food" affordance
 * (hidden in `substitute` mode) opens an inline form that either creates a catalog food (builder) or
 * emits an inline ad-hoc snapshot (off-plan).
 */
@Component({
  selector: 'app-food-picker-panel',
  standalone: true,
  imports: [ReactiveFormsModule, IconField, InputIcon, InputTextModule, ButtonComponent],
  templateUrl: './food-picker-panel.html',
  styleUrl: './food-picker-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodPickerPanelComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly foodService = inject(FoodService);
  private readonly messageService = inject(MessageService);

  /** Optional context label shown in the header subtitle (e.g. the meal name). */
  readonly mealLabel = input<string | null>(null);

  /** Operating context — gates the custom-food affordance and the meal selector. Defaults to builder. */
  readonly mode = input<FoodPickerMode>('builder');

  /** Meal slots for the off-plan "Log under" selector (plan meals + standard slots + "Off-plan"). */
  readonly mealOptions = input<readonly string[]>([]);

  readonly closed = output<void>();
  readonly added = output<FoodPickerAddPayload>();

  readonly kindTabs: readonly KindTab[] = [ALL_KINDS, ...FOOD_KINDS];
  readonly activeKind = signal<KindTab>(ALL_KINDS);
  readonly selected = signal<FoodDto | null>(null);
  readonly loading = signal(false);
  readonly savingCustom = signal(false);

  /** True while the inline custom-food form is open (covers the search list). */
  readonly customOpen = signal(false);

  /** A custom food is only offered outside substitute mode (the API requires a catalog food to swap). */
  readonly allowCustom = computed(() => this.mode() !== 'substitute');

  /** The off-plan meal selector is only shown in off-plan add mode. */
  readonly showMealSelector = computed(() => this.mode() === 'offplan');

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  readonly detailsForm = this.fb.group({
    quantity: this.fb.control<string>('1', [Validators.required]),
    addAnother: this.fb.control<boolean>(true),
    mealName: this.fb.control<string>('')
  });

  /** Inline custom-food form — mirrors the Flutter custom-food sheet (kcal required, macros optional). */
  readonly customForm = this.fb.group({
    name: this.fb.control<string>('', [Validators.required, Validators.maxLength(160)]),
    kind: this.fb.control<FoodKind>('Food'),
    servingLabel: this.fb.control<string>('1 serving'),
    energyKcal: this.fb.control<string>('', [Validators.required]),
    proteinG: this.fb.control<string>(''),
    carbsG: this.fb.control<string>(''),
    fatG: this.fb.control<string>('')
  });

  readonly customKinds: readonly FoodKind[] = FOOD_KINDS;

  /** Server-side search: debounced free text + kind tab → `/api/foods`. */
  readonly results = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      // No distinctUntilChanged: setKind() re-emits the same text to re-run the server search.
      debounceTime(300),
      switchMap((search) => {
        this.loading.set(true);
        return this.foodService
          .search({ search, kind: this.kindFilter(), pageSize: 50 })
          .pipe(map((res) => res.items));
      }),
      map((items) => {
        this.loading.set(false);
        return items;
      })
    ),
    { initialValue: [] as FoodDto[] }
  );

  /** Kind tab filtering is applied client-side too so tab clicks don't need a new request round-trip. */
  readonly filtered = computed<FoodDto[]>(() => {
    const kind = this.activeKind();
    const items = this.results();
    if (kind === ALL_KINDS) return items;
    return items.filter((f) => f.kind.toLowerCase() === kind.toLowerCase());
  });

  private readonly quantitySignal = toSignal(
    this.detailsForm.controls.quantity.valueChanges.pipe(
      startWith(this.detailsForm.controls.quantity.value)
    ),
    { initialValue: '1' }
  );

  readonly canAdd = computed(
    () => !!this.selected() && parseQuantity(this.quantitySignal()) != null
  );

  /** Live macro preview for the selected food × quantity. */
  readonly selectedMacroLine = computed(() => {
    const food = this.selected();
    const qty = parseQuantity(this.quantitySignal());
    if (!food || qty == null) return '';
    return formatMacroLine(scaleMacros(food, qty));
  });

  close(): void {
    this.closed.emit();
  }

  setKind(tab: KindTab): void {
    this.activeKind.set(tab);
    // Re-issue the server search with the new kind filter.
    this.searchControl.setValue(this.searchControl.value);
  }

  private kindFilter(): string | undefined {
    const kind = this.activeKind();
    return kind === ALL_KINDS ? undefined : kind;
  }

  selectFood(food: FoodDto): void {
    this.selected.set(food);
  }

  isSelected(id: string): boolean {
    return this.selected()?.id === id;
  }

  foodMeta(food: FoodDto): string {
    const macro = formatMacroLine(scaleMacros(food, 1));
    const bits = [food.servingLabel, macro].filter(Boolean);
    if (food.brand) bits.unshift(food.brand);
    return bits.join(' · ');
  }

  kindIcon(kind: string): string {
    switch (kind.toLowerCase()) {
      case 'supplement':
        return 'pi pi-sparkles';
      case 'beverage':
        return 'pi pi-filter';
      default:
        return 'pi pi-apple';
    }
  }

  // ── Inline custom food ─────────────────────────────────────────────────────
  openCustom(): void {
    if (!this.allowCustom()) return;
    // Seed the kind from the active tab so a "Supplement" filter pre-selects Supplement.
    const tab = this.activeKind();
    this.customForm.reset({
      name: this.searchControl.value.trim(),
      kind: tab === ALL_KINDS ? 'Food' : tab,
      servingLabel: '1 serving',
      energyKcal: '',
      proteinG: '',
      carbsG: '',
      fatG: ''
    });
    this.customOpen.set(true);
  }

  setCustomKind(kind: FoodKind): void {
    this.customForm.controls.kind.setValue(kind);
  }

  cancelCustom(): void {
    this.customOpen.set(false);
  }

  /** Submit the inline custom-food form: create a catalog food (builder) or emit inline (off-plan). */
  async submitCustom(): Promise<void> {
    this.customForm.markAllAsTouched();
    const name = this.customForm.controls.name.value.trim();
    if (!name) {
      this.warn('Name required', 'Give the food a name.');
      return;
    }
    const kcal = parseMacro(this.customForm.controls.energyKcal.value);
    if (kcal == null || kcal <= 0) {
      this.warn('Calories required', 'Enter the calories (kcal) per serving.');
      return;
    }
    const quantity = parseQuantity(this.detailsForm.controls.quantity.value);
    if (quantity == null) {
      this.warn('Fix quantity', 'Quantity must be a positive number of servings.');
      return;
    }
    if (this.showMealSelector() && !this.resolveMealName()) {
      this.warn('Pick a slot', 'Choose where to log this under.');
      return;
    }

    const servingLabel = this.customForm.controls.servingLabel.value.trim() || '1 serving';
    const kind = this.customForm.controls.kind.value;
    const macros: MacroSet = {
      energyKcal: kcal,
      proteinG: parseMacro(this.customForm.controls.proteinG.value),
      carbsG: parseMacro(this.customForm.controls.carbsG.value),
      fatG: parseMacro(this.customForm.controls.fatG.value),
      fiberG: null
    };

    if (this.mode() === 'builder') {
      await this.createCatalogCustom(name, kind, servingLabel, macros, quantity);
      return;
    }

    // Off-plan: emit an inline ad-hoc snapshot (no catalog row). The synthesized FoodDto carries
    // isCustom:true so MyNutritionService routes it down the inline-custom branch.
    const food: FoodDto = {
      id: `custom-${Date.now()}`,
      name,
      brand: null,
      kind,
      servingLabel,
      servingSizeGrams: null,
      ...macros,
      isCustom: true
    };
    this.emitAdd(food, quantity, {
      name,
      kind,
      servingLabel,
      ...macros
    });
  }

  private async createCatalogCustom(
    name: string,
    kind: FoodKind,
    servingLabel: string,
    macros: MacroSet,
    quantity: number
  ): Promise<void> {
    this.savingCustom.set(true);
    const body: CreateCustomFoodRequest = {
      name,
      kind,
      servingLabel,
      energyKcal: macros.energyKcal ?? undefined,
      proteinG: macros.proteinG ?? undefined,
      carbsG: macros.carbsG ?? undefined,
      fatG: macros.fatG ?? undefined
    };
    try {
      const res = await firstValueFrom(this.foodService.createCustom(body));
      const food: FoodDto = {
        id: res.id,
        name,
        brand: null,
        kind,
        servingLabel,
        servingSizeGrams: null,
        ...macros,
        isCustom: true
      };
      this.emitAdd(food, quantity, null);
    } catch (err: unknown) {
      const detail =
        typeof (err as { error?: unknown })?.error === 'string'
          ? ((err as { error?: string }).error as string)
          : 'Could not create the custom food.';
      this.messageService.add({ severity: 'error', summary: 'Create failed', detail });
    } finally {
      this.savingCustom.set(false);
    }
  }

  submit(): void {
    this.detailsForm.markAllAsTouched();
    const food = this.selected();
    if (!food) {
      this.warn('Select a food', 'Choose a food from the list above.');
      return;
    }
    const quantity = parseQuantity(this.detailsForm.controls.quantity.value);
    if (quantity == null) {
      this.warn('Fix quantity', 'Quantity must be a positive number of servings.');
      return;
    }
    if (this.showMealSelector() && !this.resolveMealName()) {
      this.warn('Pick a slot', 'Choose where to log this under.');
      return;
    }
    this.emitAdd(food, quantity, null);
  }

  /** The chosen "Log under" slot (off-plan only); the first option is the default when untouched. */
  private resolveMealName(): string | null {
    if (!this.showMealSelector()) return null;
    const chosen = this.detailsForm.controls.mealName.value.trim();
    if (chosen) return chosen;
    const opts = this.mealOptions();
    return opts.length ? opts[0] : null;
  }

  private emitAdd(food: FoodDto, quantity: number, custom: FoodPickerCustomPayload | null): void {
    const addAnother = !!this.detailsForm.controls.addAnother.value;
    this.added.emit({
      food,
      quantity,
      addAnother,
      mealName: this.resolveMealName(),
      custom
    });

    // Reset for the next add (clear selection/search/custom form; keep quantity + meal slot defaults).
    if (addAnother) {
      this.selected.set(null);
      this.searchControl.setValue('');
      this.detailsForm.controls.quantity.setValue('1');
      this.customOpen.set(false);
    }
  }

  private warn(summary: string, detail: string): void {
    this.messageService.add({ severity: 'warn', summary, detail });
  }
}

/** Parse an optional macro field: non-negative finite number, or null when blank/invalid. */
function parseMacro(v: unknown): number | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}
