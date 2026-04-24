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

@Component({
  selector: 'app-success-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './success-dialog.html',
  styleUrl: './success-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuccessDialogComponent {
  private static nextId = 0;
  private readonly instanceId = ++SuccessDialogComponent.nextId;
  readonly titleDomId = `app-success-dialog-title-${this.instanceId}`;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly dialogTpl = viewChild.required<TemplateRef<unknown>>('dialogTpl');

  private overlayRef: OverlayRef | null = null;

  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly primaryLabel = input('Got it');
  readonly iconClass = input('pi pi-check-circle');

  readonly acknowledged = output<void>();

  constructor() {
    afterRenderEffect(() => {
      const shouldOpen = this.open();
      const tpl = this.dialogTpl();
      if (shouldOpen && !this.overlayRef) {
        this.overlayRef = openDialogPortal(this.overlay, this.viewContainerRef, tpl, () =>
          this.closeFromBackdrop()
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

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    this.closeFromBackdrop();
  }

  onPrimary(): void {
    this.acknowledged.emit();
    this.disposeOverlay();
    this.open.set(false);
  }

  private closeFromBackdrop(): void {
    this.disposeOverlay();
    this.open.set(false);
  }

  private disposeOverlay(): void {
    const ref = this.overlayRef;
    this.overlayRef = null;
    ref?.dispose();
  }
}
