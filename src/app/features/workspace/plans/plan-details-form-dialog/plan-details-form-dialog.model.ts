/** Payload for plan create / header edit dialog (string fields match reactive form controls). */
export interface PlanDetailsFormValue {
  name: string;
  description: string;
  durationWeeks: string;
  workoutsPerWeek: string;
}
