import type { PerformedExerciseDto, PerformedSetDto } from '../session.model';
import {
  averageCompletedRpe,
  computeElapsedSeconds,
  computeProgressPercent,
  countLoggedSets,
  formatDuration,
  formatRestClock,
  isPerformedExerciseComplete,
  resolveTargetSetCount,
  sumCompletedVolumeKg
} from './session-metrics';

function set(partial: Partial<PerformedSetDto>): PerformedSetDto {
  return {
    id: crypto.randomUUID(),
    planSetId: null,
    setNumber: 1,
    setType: 'working',
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceM: null,
    rpe: null,
    restSeconds: null,
    isCompleted: false,
    estimatedOneRepMaxKg: null,
    loggedAt: '2026-01-01T00:00:00Z',
    isPr: false,
    ...partial
  };
}

function exercise(sets: PerformedSetDto[]): PerformedExerciseDto {
  return {
    id: crypto.randomUUID(),
    exerciseId: crypto.randomUUID(),
    exerciseName: 'Bench Press',
    order: 1,
    status: 'InProgress',
    sets
  };
}

describe('formatDuration', () => {
  it('formats sub-hour as MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(599)).toBe('09:59');
  });

  it('formats hour-plus as H:MM:SS', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

describe('formatRestClock', () => {
  it('formats as M:SS without zero-padding minutes', () => {
    expect(formatRestClock(0)).toBe('0:00');
    expect(formatRestClock(90)).toBe('1:30');
    expect(formatRestClock(605)).toBe('10:05');
  });
});

describe('computeElapsedSeconds', () => {
  it('derives whole seconds from wall-clock anchors', () => {
    expect(computeElapsedSeconds(1000, 11000, 0)).toBe(10);
  });

  it('subtracts accumulated pause time', () => {
    expect(computeElapsedSeconds(0, 60000, 20000)).toBe(40);
  });

  it('never returns negative', () => {
    expect(computeElapsedSeconds(10000, 0, 0)).toBe(0);
  });
});

describe('countLoggedSets', () => {
  it('sums set counts across exercises', () => {
    const exercises = [exercise([set({}), set({})]), exercise([set({})])];
    expect(countLoggedSets(exercises)).toBe(3);
  });

  it('is zero for no exercises', () => {
    expect(countLoggedSets([])).toBe(0);
  });

  it('rolls up drop stages — a lead + its stages count as one set', () => {
    const lead = set({ id: 'lead', reps: 6 });
    const ex = exercise([
      lead,
      set({ reps: 4, parentSetId: 'lead' }),
      set({ reps: 3, parentSetId: 'lead' }),
      set({ reps: 8 }) // a separate standalone set
    ]);
    expect(countLoggedSets([ex])).toBe(2); // the drop cluster + the standalone = 2 sets, not 4
  });
});

describe('isPerformedExerciseComplete (drop rollup)', () => {
  it('counts a drop cluster as one completed set toward the plan', () => {
    const lead = set({ id: 'l', isCompleted: true });
    const ex = exercise([lead, set({ isCompleted: true, parentSetId: 'l' })]);
    // 1 lead set (with a stage) → complete against a 1-set plan, not 2.
    expect(isPerformedExerciseComplete(ex, 1)).toBe(true);
    expect(isPerformedExerciseComplete(ex, 2)).toBe(false);
  });
});

describe('sumCompletedVolumeKg', () => {
  it('sums weight × reps over completed sets only', () => {
    const exercises = [
      exercise([
        set({ isCompleted: true, weightKg: 100, reps: 5 }), // 500
        set({ isCompleted: false, weightKg: 100, reps: 5 }) // excluded
      ]),
      exercise([set({ isCompleted: true, weightKg: 60, reps: 10 })]) // 600
    ];
    expect(sumCompletedVolumeKg(exercises)).toBe(1100);
  });

  it('treats null weight/reps as zero', () => {
    const exercises = [exercise([set({ isCompleted: true, weightKg: null, reps: 5 })])];
    expect(sumCompletedVolumeKg(exercises)).toBe(0);
  });
});

describe('averageCompletedRpe', () => {
  it('averages RPE over completed sets, 1 dp', () => {
    const exercises = [
      exercise([
        set({ isCompleted: true, rpe: 8 }),
        set({ isCompleted: true, rpe: 9 })
      ])
    ];
    expect(averageCompletedRpe(exercises)).toBe(8.5);
  });

  it('ignores incomplete sets and sets without RPE', () => {
    const exercises = [
      exercise([
        set({ isCompleted: true, rpe: 10 }),
        set({ isCompleted: false, rpe: 4 }),
        set({ isCompleted: true, rpe: null })
      ])
    ];
    expect(averageCompletedRpe(exercises)).toBe(10);
  });

  it('returns null when no completed RPE sets exist', () => {
    expect(averageCompletedRpe([exercise([set({ isCompleted: false, rpe: 8 })])])).toBeNull();
  });
});

describe('resolveTargetSetCount', () => {
  it('uses the planned count when it is highest', () => {
    expect(resolveTargetSetCount(2, 5, false)).toBe(5);
  });

  it('uses logged count when no plan', () => {
    expect(resolveTargetSetCount(3, 0, false)).toBe(3);
  });

  it('adds the active entry row and floors at 1', () => {
    expect(resolveTargetSetCount(2, 0, true)).toBe(3);
    expect(resolveTargetSetCount(0, 0, true)).toBe(1);
  });
});

describe('isPerformedExerciseComplete', () => {
  it('is complete when completed sets reach the plan', () => {
    const ex = exercise([set({ isCompleted: true }), set({ isCompleted: true })]);
    expect(isPerformedExerciseComplete(ex, 2)).toBe(true);
  });

  it('is incomplete below the planned count', () => {
    const ex = exercise([set({ isCompleted: true })]);
    expect(isPerformedExerciseComplete(ex, 3)).toBe(false);
  });

  it('falls back to logged count when there is no plan', () => {
    const ex = exercise([set({ isCompleted: true })]);
    expect(isPerformedExerciseComplete(ex, null)).toBe(true);
  });

  it('a planned count of zero is never complete', () => {
    expect(isPerformedExerciseComplete(exercise([]), 0)).toBe(false);
  });
});

describe('computeProgressPercent', () => {
  it('is the clamped integer percentage of logged/total', () => {
    expect(computeProgressPercent(1, 4)).toBe(25);
    expect(computeProgressPercent(3, 3)).toBe(100);
  });

  it('clamps above 100 and guards zero total', () => {
    expect(computeProgressPercent(5, 4)).toBe(100);
    expect(computeProgressPercent(2, 0)).toBe(0);
  });
});
