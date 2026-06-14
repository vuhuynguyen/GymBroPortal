export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

export interface MeDto {
  userId: string;
  name: string;
  email: string | null;
  isPlatformAdmin: boolean;
  /** The user's authoritative IANA zone (e.g. "America/Toronto"); null until first reported. */
  timeZoneId: string | null;
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}
