export type InfoDialogBadgeTone = 'success' | 'primary' | 'warn';

export interface InfoDialogRow {
  label: string;
  description: string;
  tone: InfoDialogBadgeTone;
}
