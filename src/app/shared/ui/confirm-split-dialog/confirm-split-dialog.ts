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
import { openDialogPortal } from '../dialog/attach-centered-dialog';

@Component({
  selector: 'app-confirm-split-dialog',
  standalone: true,
  templateUrl: './confirm-split-dialog.html',
  styleUrl: './confirm-split-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmSplitDialogComponent {
  private static nextId = 0;
  private readonly instanceId = ++ConfirmSplitDialogComponent.nextId;
  readonly titleDomId = `app-confirm-split-title-${this.instanceId}`;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly dialogTpl = viewChild.required<TemplateRef<unknown>>('dialogTpl');

  private overlayRef: OverlayRef | null = null;

  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Delete');
  readonly cancelLabel = input('Cancel');
  readonly iconClass = input('pi pi-trash');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

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

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    this.dismiss();
  }

  onCancel(): void {
    this.dismiss();
  }

  onConfirm(): void {
    this.confirmed.emit();
    this.closePortal();
    this.open.set(false);
  }

  private dismiss(): void {
    this.cancelled.emit();
    this.closePortal();
    this.open.set(false);
  }

  private closePortal(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
