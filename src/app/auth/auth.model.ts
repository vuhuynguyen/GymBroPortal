export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

export interface AuthUser {
  email: string;
  name: string;
}
