import { OverlayModule } from '@angular/cdk/overlay';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { providePrimeNgTheming } from './core/prime-ng.config';
import { authInterceptor } from './auth/auth.interceptor';
import { FeaturesService } from './core/features/features.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideAnimationsAsync(),
    importProvidersFrom(OverlayModule),
    providePrimeNgTheming(),
    MessageService,
    {
      provide: APP_INITIALIZER,
      useFactory: (features: FeaturesService) => () => features.load(),
      deps: [FeaturesService],
      multi: true
    }
  ]
};
