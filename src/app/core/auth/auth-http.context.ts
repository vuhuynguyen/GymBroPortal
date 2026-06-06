import { HttpContextToken } from '@angular/common/http';

/** Auth bootstrap/login calls must bypass interceptors that inject AuthService (circular dep). */
export const AUTH_HTTP = new HttpContextToken<boolean>(() => false);
