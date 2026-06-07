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
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}
