import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TableTagSeverity } from '../../../shared/ui';
import { exerciseDifficultyTagSeverity } from '../exercise-difficulty-tag-severity';
import { MuscleMapComponent } from '../muscle-map/muscle-map';

/** Lightweight snapshot for the exercise form live preview (presentational only). */
export interface ExercisePreviewVm {
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  movementType: string;
  difficulty: string;
  equipment: string;
  primaryMuscle: string;
  secondaryMuscles: readonly string[];
  caloriesLabel: string;
  durationLabel: string;
  /** Non-empty instruction lines (ordered). */
  instructions: readonly string[];
  catalogTags: readonly string[];
  catalogWarnings: readonly string[];
  /** Non-empty media rows. */
  catalogMedia: readonly { url: string; type: string }[];
}

@Component({
  selector: 'app-exercise-preview-card',
  standalone: true,
  imports: [MuscleMapComponent],
  templateUrl: './exercise-preview-card.html',
  styleUrl: './exercise-preview-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExercisePreviewCardComponent {
  readonly data = input.required<ExercisePreviewVm>();

  /** Only allow http(s) URLs in img to avoid broken UI from random strings. */
  readonly imageSrc = computed(() => {
    const raw = this.data().imageUrl?.trim() ?? '';
    if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') {
      return null;
    }
    if (raw.startsWith('https://') || raw.startsWith('http://')) {
      return raw;
    }
    return null;
  });

  readonly secondaryMuscleLine = computed(() => {
    const secondaries = this.data().secondaryMuscles.filter((s) => !!String(s).trim());
    return secondaries.length ? secondaries.join(', ') : '';
  });

  readonly showCaloriesRow = computed(() => !!this.data().caloriesLabel?.trim());
  readonly showDurationRow = computed(() => !!this.data().durationLabel?.trim());

  readonly hasMetaSection = computed(
    () =>
      !!(
        this.data().equipment?.trim() ||
        this.data().primaryMuscle?.trim() ||
        this.secondaryMuscleLine() ||
        this.showCaloriesRow() ||
        this.showDurationRow()
      )
  );

  /** Figma: metadata block uses `mb-3` when a bordered catalog section follows. */
  readonly hasCatalogAfterMeta = computed(
    () =>
      this.data().instructions.length > 0 ||
      this.data().catalogWarnings.length > 0 ||
      this.data().catalogMedia.length > 0 ||
      this.data().catalogTags.length > 0
  );

  readonly leadSpacerBeforeWarnings = computed(
    () => !this.hasMetaSection() && this.data().instructions.length === 0
  );

  readonly leadSpacerBeforeMedia = computed(
    () =>
      !this.hasMetaSection() &&
      this.data().instructions.length === 0 &&
      this.data().catalogWarnings.length === 0
  );

  readonly leadSpacerBeforeTags = computed(
    () =>
      !this.hasMetaSection() &&
      this.data().instructions.length === 0 &&
      this.data().catalogWarnings.length === 0 &&
      this.data().catalogMedia.length === 0
  );

  readonly marginBelowInstructions = computed(
    () =>
      this.data().catalogWarnings.length > 0 ||
      this.data().catalogMedia.length > 0 ||
      this.data().catalogTags.length > 0
  );

  readonly marginBelowWarnings = computed(
    () => this.data().catalogMedia.length > 0 || this.data().catalogTags.length > 0
  );

  readonly marginBelowMedia = computed(() => this.data().catalogTags.length > 0);

  readonly hasAnyTag = computed(
    () =>
      !!(
        this.data().type?.trim() ||
        this.data().movementType?.trim() ||
        this.data().difficulty?.trim()
      )
  );

  /** Same severity as exercise list `p-tag` column (`exerciseDifficultyTagSeverity`). */
  readonly difficultyListSeverity = computed<TableTagSeverity>(() =>
    exerciseDifficultyTagSeverity(this.data().difficulty)
  );

  readonly instructionPreviewLines = computed(() => this.data().instructions.slice(0, 3));

  readonly instructionMoreCount = computed(() =>
    Math.max(0, this.data().instructions.length - 3)
  );

  readonly warningPreviewLines = computed(() => this.data().catalogWarnings.slice(0, 2));

  readonly warningMoreCount = computed(() =>
    Math.max(0, this.data().catalogWarnings.length - 2)
  );

  readonly mediaPreviewItems = computed(() => this.data().catalogMedia.slice(0, 2));

  readonly mediaMoreCount = computed(() => Math.max(0, this.data().catalogMedia.length - 2));

  readonly tagPreviewItems = computed(() => this.data().catalogTags.slice(0, 4));

  readonly tagMoreCount = computed(() => Math.max(0, this.data().catalogTags.length - 4));
}
