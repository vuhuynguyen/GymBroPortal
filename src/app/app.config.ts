import { OverlayModule } from '@angular/cdk/overlay';
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { providePrimeNgTheming } from './core/config/prime-ng.config';
import { authInterceptor } from './core/auth/auth-interceptor';
import { errorInterceptor } from './core/auth/error-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideRouter(routes),
    provideAnimationsAsync(),
    importProvidersFrom(OverlayModule),
    providePrimeNgTheming(),
    MessageService
  ]
};
