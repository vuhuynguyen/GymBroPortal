import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { TemplateRef, ViewContainerRef } from '@angular/core';

const BACKDROP_CLASS = 'ui-inv-dialog-backdrop';

export function openDialogPortal(
  overlay: Overlay,
  viewContainerRef: ViewContainerRef,
  template: TemplateRef<unknown>,
  onBackdropClick: () => void
): OverlayRef {
  const ref = overlay.create({
    hasBackdrop: true,
    disposeOnNavigation: true,
    backdropClass: BACKDROP_CLASS,
    positionStrategy: overlay
      .position()
      .global()
      .centerHorizontally()
      .centerVertically(),
    scrollStrategy: overlay.scrollStrategies.block(),
    panelClass: 'ui-inv-dialog-pane'
  });
  ref.backdropClick().subscribe(() => onBackdropClick());
  ref.attach(new TemplatePortal(template, viewContainerRef));
  return ref;
}
