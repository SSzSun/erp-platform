import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, LoginResponse } from '../models/user.model';

const ACCESS_KEY  = 'erp_access';
const REFRESH_KEY = 'erp_refresh';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private _user = signal<User | null>(this.loadUser());
  readonly user       = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin    = computed(() => this._user()?.role === 'admin');
  readonly isHR       = computed(() => ['admin','hr'].includes(this._user()?.role ?? ''));

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(ACCESS_KEY,  res.accessToken);
        localStorage.setItem(REFRESH_KEY, res.refreshToken);
        this._user.set(res.user);
      }),
    );
  }

  logout() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken })
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  refreshToken() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return EMPTY;

    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${environment.apiUrl}/auth/refresh`, { refreshToken }
    ).pipe(
      tap(res => {
        localStorage.setItem(ACCESS_KEY,  res.accessToken);
        localStorage.setItem(REFRESH_KEY, res.refreshToken);
      }),
      catchError(() => {
        this.logout();
        return EMPTY;
      }),
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  private loadUser(): User | null {
    const token = localStorage.getItem(ACCESS_KEY);
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Check expiry
      if (payload.exp * 1000 < Date.now()) return null;
      return { id: payload.sub, email: payload.email, role: payload.role, permissions: payload.permissions };
    } catch {
      return null;
    }
  }
}
