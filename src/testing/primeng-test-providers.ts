import { EnvironmentProviders, Provider } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService } from 'primeng/api';
import { providePrimeNgTheming } from '../app/core/config/prime-ng.config';

export const primengTestProviders: Array<Provider | EnvironmentProviders> = [
  provideAnimationsAsync(),
  providePrimeNgTheming(),
  MessageService
];
