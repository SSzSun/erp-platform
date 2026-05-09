export type RoleName = 'admin' | 'hr' | 'manager' | 'employee' | 'finance';

export interface User {
  id: string;
  email: string;
  role: RoleName;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
