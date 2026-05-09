import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card card">
        <div class="login-header">
          <h1>ERP Platform</h1>
          <p>ระบบบริหารทรัพยากรบุคคล</p>
        </div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="form-group">
            <label class="form-label">อีเมล</label>
            <input
              class="form-input"
              [class.error]="emailTouched() && !email()"
              type="email"
              placeholder="admin@erp.local"
              [(ngModel)]="emailValue"
              name="email"
              (blur)="emailTouched.set(true)"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">รหัสผ่าน</label>
            <input
              class="form-input"
              [class.error]="passTouched() && !password()"
              type="password"
              placeholder="••••••••"
              [(ngModel)]="passwordValue"
              name="password"
              (blur)="passTouched.set(true)"
              required
            />
          </div>

          @if (error()) {
            <p class="form-error" style="text-align:center">{{ error() }}</p>
          }

          <button class="btn primary" type="submit" [disabled]="loading()">
            @if (loading()) { <span class="spinner"></span> }
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e429f 0%, #1a56db 100%);
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      margin: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .login-header {
      text-align: center;
      h1 { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
      p  { font-size: .875rem; color: var(--text-muted); margin-top: .25rem; }
    }
    form { display: flex; flex-direction: column; gap: 1rem; }
    .btn { width: 100%; justify-content: center; padding: .75rem; font-size: 1rem; margin-top: .5rem; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly wsService   = inject(WebSocketService);
  private readonly router      = inject(Router);

  emailValue    = '';
  passwordValue = '';

  email    = signal('');
  password = signal('');
  loading  = signal(false);
  error    = signal('');
  emailTouched = signal(false);
  passTouched  = signal(false);

  onSubmit() {
    if (!this.emailValue || !this.passwordValue) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.emailValue, this.passwordValue).subscribe({
      next: () => {
        this.wsService.connect();
        this.router.navigate(['/employees']);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        this.loading.set(false);
      },
    });
  }
}
