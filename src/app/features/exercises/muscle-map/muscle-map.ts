import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MUSCLE_MAP_BACK, MUSCLE_MAP_FRONT, MUSCLE_MAP_VIEWBOX } from './muscle-map-paths';

// Individual muscles, in draw order.
const FINE = [
  'chest', 'obliques', 'abs', 'biceps', 'triceps', 'forearm', 'trapezius', 'deltoids',
  'upper-back', 'lower-back', 'adductors', 'quadriceps', 'tibialis', 'calves', 'hamstring', 'gluteal'
];

// Coarse group keyword → the muscles it spans (the fallback when the movement is unknown).
const GROUP_FINE: Record<string, string[]> = {
  chest: ['chest'],
  core: ['abs', 'obliques'],
  arm: ['biceps', 'triceps', 'forearm'],
  shoulder: ['deltoids'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  leg: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors', 'tibialis']
};

/** A specific muscle name → its canonical muscle slug. */
function fineFromName(n: string): string | null {
  if (n.includes('hamstring')) return 'hamstring';
  if (n.includes('quad')) return 'quadriceps';
  if (n.includes('glute')) return 'gluteal';
  if (n.includes('calf') || n.includes('calve') || n.includes('gastro') || n.includes('soleus')) return 'calves';
  if (n.includes('adductor') || n.includes('inner thigh') || n.includes('groin')) return 'adductors';
  if (n.includes('tibialis') || n.includes('shin')) return 'tibialis';
  if (n.includes('bicep')) return 'biceps';
  if (n.includes('tricep')) return 'triceps';
  if (n.includes('forearm') || n.includes('brachi')) return 'forearm';
  if (n.includes('trap')) return 'trapezius';
  if (n.includes('delt') || n.includes('shoulder')) return 'deltoids';
  if (n.includes('lat') || n.includes('upper back') || n.includes('rhombo')) return 'upper-back';
  if (n.includes('lower back') || n.includes('erector') || n.includes('spinae')) return 'lower-back';
  if (n.includes('oblique')) return 'obliques';
  if (n.includes('abdom') || n === 'abs' || n.includes('rectus') || n.includes('core')) return 'abs';
  if (n.includes('pec') || n.includes('chest')) return 'chest';
  return null;
}

/** One (coarse or fine) muscle name → the individual muscles it implies. */
function fineSetFor(raw: string): string[] {
  const n = raw.toLowerCase();
  const fine = fineFromName(n);
  if (fine) return [fine];
  for (const [key, val] of Object.entries(GROUP_FINE)) {
    if (n.includes(key)) return val;
  }
  return [];
}

/** Exercise name → [primaryMuscles, secondaryMuscles] (specific). Ordered most-specific first. */
function exerciseHeuristic(name: string): [string[], string[]] | null {
  const n = name.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => n.includes(k));

  if (has('leg curl', 'hamstring curl', 'lying curl', 'seated curl', 'nordic')) return [['hamstring'], ['gluteal', 'calves']];
  if (has('leg extension', 'knee extension', 'quad extension')) return [['quadriceps'], []];
  if (has('calf')) return [['calves'], []];
  if (has('hip thrust', 'glute bridge', 'glute kick', 'hip extension', 'glute')) return [['gluteal'], ['hamstring']];
  if (has('romanian', 'rdl', 'stiff leg', 'stiff-leg', 'good morning')) return [['hamstring', 'gluteal'], ['lower-back']];
  if (has('deadlift')) return [['hamstring', 'gluteal'], ['lower-back', 'upper-back', 'trapezius']];
  if (has('squat', 'leg press', 'hack ', 'lunge', 'split squat', 'step up', 'step-up', 'bulgarian')) {
    return [['quadriceps', 'gluteal'], ['hamstring', 'adductors', 'calves']];
  }
  if (has('adduction', 'adductor')) return [['adductors'], []];
  if (has('abduction', 'abductor')) return [['gluteal'], []];
  if (has('face pull', 'rear delt', 'reverse fly', 'reverse pec')) return [['deltoids'], ['upper-back']];
  if (has('bench', 'chest press', 'chest fly', 'pec ', 'push up', 'push-up', 'pushup', 'dip', 'fly')) {
    return [['chest'], ['triceps', 'deltoids']];
  }
  if (has('pulldown', 'pull up', 'pull-up', 'pullup', 'chin up', 'chin-up', 'row', ' lat ')) return [['upper-back'], ['biceps']];
  if (has('shrug')) return [['trapezius'], []];
  if (has('hyperextension', 'back extension', 'superman')) return [['lower-back'], ['gluteal', 'hamstring']];
  if (has('shoulder press', 'overhead press', 'military', 'arnold', 'lateral raise', 'front raise', 'shoulder')) {
    return [['deltoids'], ['triceps']];
  }
  if (has('tricep', 'pushdown', 'skull', 'kickback', 'close grip', 'close-grip')) return [['triceps'], []];
  if (has('curl', 'bicep')) return [['biceps'], ['forearm']];
  if (has('crunch', 'sit up', 'sit-up', 'situp', 'plank', 'leg raise', 'knee raise', 'russian twist', 'hanging', 'ab wheel', 'rollout', 'toes to bar')) {
    return [['abs'], ['obliques']];
  }
  if (has('oblique', 'side bend', 'woodchop', 'wood chop')) return [['obliques'], ['abs']];
  return null;
}

/** A catalog muscle token → its canonical fine slug. Exact slug match first (the catalog already speaks our 16
 *  slugs), else the fuzzy name map so authored / API-coarse names still resolve. */
function canon(s: string): string | null {
  const n = s.toLowerCase().trim();
  if (!n) return null;
  if (FINE.includes(n)) return n;
  return fineFromName(n);
}

/**
 * Per-muscle involvement (0 none, 1 secondary, 2 primary). Exported for tests.
 *
 * Resolution order, most-trustworthy first: (1) catalog-supplied specific muscles
 * `detailedPrimary`/`detailedSecondary`; (2) the exercise-name heuristic; (3) the coarse group names.
 */
export function muscleInvolvement(
  exerciseName: string,
  primary: readonly string[],
  secondary: readonly string[],
  detailedPrimary: readonly string[] = [],
  detailedSecondary: readonly string[] = []
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of FINE) m[f] = 0;

  // 0. Catalog-supplied specific muscles (data-driven — accurate, no guessing).
  if (detailedPrimary.length || detailedSecondary.length) {
    for (const raw of detailedSecondary) { const f = canon(raw); if (f) m[f] = 1; }
    for (const raw of detailedPrimary) { const f = canon(raw); if (f) m[f] = 2; }
    if (Object.values(m).some((v) => v !== 0)) return m;
  }

  // 1. Specific-muscle heuristic from the exercise name (most accurate of the inferred paths).
  const h = exerciseHeuristic(exerciseName);
  if (h) {
    for (const f of h[1]) if (f in m) m[f] = 1;
    for (const f of h[0]) if (f in m) m[f] = 2;
    return m;
  }

  // 2. Coarse muscle names (fine if recognised, else the whole group).
  const apply = (names: readonly string[], level: number) => {
    for (const raw of names) for (const f of fineSetFor(raw)) m[f] = level;
  };
  apply(secondary, 1);
  apply(primary, 2);
  return m;
}

// Red heat-map palette (a fixed diagram palette — worked muscles run hot).
const PRIMARY = '#DC2626';
const SECONDARY = '#F87171';
const BASE = '#D7DCE3';
const STRUCT = '#EAEDF1';

/**
 * Muscle-activation map — front + back anatomical body with the exercise's worked muscles highlighted as a red
 * heat-map. When the catalog carries the exercise's *specific* muscles (`detailedPrimary`/`detailedSecondary`)
 * they drive the map directly; otherwise we infer them from the exercise name (e.g. "leg curl" → hamstrings),
 * falling back to the whole coarse group. Vector anatomy from `react-native-body-highlighter`
 * (MIT — see `THIRD_PARTY_NOTICES.md`). Mirrors the Flutter figure.
 */
@Component({
  selector: 'app-muscle-map',
  standalone: true,
  imports: [],
  templateUrl: './muscle-map.html',
  styleUrl: './muscle-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MuscleMapComponent {
  /** Exercise name — drives the specific-muscle heuristic. */
  readonly exerciseName = input<string>('');
  /** Primary worked muscle name (coarse, e.g. `Legs`). */
  readonly primaryMuscle = input<string>('');
  /** Secondary worked muscle names. */
  readonly secondaryMuscles = input<readonly string[]>([]);
  /** Catalog-supplied specific (fine) muscle slugs — preferred over the name heuristic when present. */
  readonly detailedPrimary = input<readonly string[]>([]);
  readonly detailedSecondary = input<readonly string[]>([]);

  readonly viewBox = MUSCLE_MAP_VIEWBOX;

  private readonly involvement = computed(() =>
    muscleInvolvement(
      this.exerciseName(),
      [this.primaryMuscle()],
      this.secondaryMuscles(),
      this.detailedPrimary(),
      this.detailedSecondary()
    )
  );

  readonly hasContent = computed(() => Object.values(this.involvement()).some((v) => v !== 0));

  /** Flat draw list (structure → base → secondary → primary), front then back. */
  readonly layers = computed<{ paths: readonly string[]; fill: string }[]>(() => {
    const inv = this.involvement();
    const out: { paths: readonly string[]; fill: string }[] = [];
    for (const side of [MUSCLE_MAP_FRONT, MUSCLE_MAP_BACK]) {
      out.push({ paths: side['Structure'] ?? [], fill: STRUCT });
      for (let state = 0; state <= 2; state++) {
        const fill = state === 2 ? PRIMARY : state === 1 ? SECONDARY : BASE;
        for (const mu of FINE) {
          if ((inv[mu] ?? 0) !== state) continue;
          out.push({ paths: side[mu] ?? [], fill });
        }
      }
    }
    return out;
  });
}
