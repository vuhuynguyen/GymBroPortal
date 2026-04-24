import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';

interface FeaturesResponse {
  phoneLogin: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeaturesService {
  private readonly http = inject(HttpClient);

  readonly phoneLoginEnabled = signal(false);

  load() {
    return this.http.get<FeaturesResponse>('/api/config/features').pipe(
      tap((f) => this.phoneLoginEnabled.set(f.phoneLogin)),
      catchError(() => of(null))
    );
  }
}
