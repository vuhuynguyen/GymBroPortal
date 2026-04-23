import type { TableTagSeverity } from '../shared/ui';

/** Aligns `p-tag` / data-table difficulty colors with the exercise catalog list. */
export function exerciseDifficultyTagSeverity(raw: string | null | undefined): TableTagSeverity {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'advanced') {
    return 'danger';
  }
  if (v === 'intermediate') {
    return 'info';
  }
  if (v === 'beginner') {
    return 'success';
  }
  return 'secondary';
}
