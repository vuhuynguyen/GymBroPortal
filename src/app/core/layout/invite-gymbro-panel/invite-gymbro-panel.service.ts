import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Lets feature code open the shell Invite to GymBro panel without routing to a dedicated invite page. */
@Injectable({ providedIn: 'root' })
export class InviteGymBroPanelService {
  private readonly open$ = new Subject<void>();

  readonly openRequests$ = this.open$.asObservable();

  requestOpen(): void {
    this.open$.next();
  }
}
