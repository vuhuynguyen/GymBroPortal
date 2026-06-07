import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
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
import { ButtonComponent } from '../button/button';
import { openDialogPortal } from '../dialog/attach-centered-dialog';
import type { InfoDialogBadgeTone, InfoDialogRow } from './info-dialog.models';

@Component({
  selector: 'app-info-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './info-dialog.html',
  styleUrl: './info-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoDialogComponent {
  private static nextId = 0;
  private readonly instanceId = ++InfoDialogComponent.nextId;
  readonly titleDomId = `app-info-dialog-title-${this.instanceId}`;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly dialogTpl = viewChild.required<TemplateRef<unknown>>('dialogTpl');

  private overlayRef: OverlayRef | null = null;

  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly intro = input.required<string>();
  readonly rows = input<readonly InfoDialogRow[]>([]);
  readonly primaryLabel = input('Understood');
  readonly headerIconClass = input('pi pi-info-circle');

  readonly closed = output<void>();

  constructor() {
    afterRenderEffect(() => {
      const shouldOpen = this.open();
      const tpl = this.dialogTpl();
      if (shouldOpen && !this.overlayRef) {
        this.overlayRef = openDialogPortal(this.overlay, this.viewContainerRef, tpl, () =>
          this.dismiss()
        );
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

  badgeClasses(tone: InfoDialogBadgeTone): string {
    const base = 'rounded-lg px-2.5 py-1 text-xs font-medium';
    switch (tone) {
      case 'success':
        return `${base} bg-inv-success-0 text-inv-success-300`;
      case 'warn':
        return `${base} bg-inv-warning-0 text-inv-warning-300`;
      default:
        return `${base} bg-inv-primary-25 text-inv-primary-800`;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    this.dismiss();
  }

  onClose(): void {
    this.dismiss();
  }

  onPrimary(): void {
    this.dismiss();
  }

  private dismiss(): void {
    this.closed.emit();
    const ref = this.overlayRef;
    this.overlayRef = null;
    ref?.dispose();
    this.open.set(false);
  }
}
