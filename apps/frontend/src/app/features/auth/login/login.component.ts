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
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-700 to-primary-600 px-4">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-6">

        <!-- Header -->
        <div class="text-center">
          <div class="text-4xl mb-2">🏢</div>
          <h1 class="text-2xl font-bold text-primary-600">ERP Platform</h1>
          <p class="text-sm text-gray-500 mt-1">ระบบบริหารทรัพยากรบุคคล</p>
        </div>

        <!-- Form -->
        <form (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-600">อีเมล</label>
            <input
              class="px-3.5 py-2.5 border rounded-lg text-sm outline-none transition
                     focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                     placeholder:text-gray-300"
              [class.border-red-400]="emailTouched() && !emailValue"
              [class.border-gray-200]="!(emailTouched() && !emailValue)"
              type="email" placeholder="admin@erp.local"
              [(ngModel)]="emailValue" name="email"
              (blur)="emailTouched.set(true)" required
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-600">รหัสผ่าน</label>
            <input
              class="px-3.5 py-2.5 border rounded-lg text-sm outline-none transition
                     focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                     placeholder:text-gray-300"
              [class.border-red-400]="passTouched() && !passwordValue"
              [class.border-gray-200]="!(passTouched() && !passwordValue)"
              type="password" placeholder="••••••••"
              [(ngModel)]="passwordValue" name="password"
              (blur)="passTouched.set(true)" required
            />
          </div>

          @if (error()) {
            <p class="text-sm text-red-500 text-center animate-fade-in">{{ error() }}</p>
          }

          <button
            class="w-full flex items-center justify-center gap-2 mt-1 py-2.5 rounded-lg
                   bg-primary-600 hover:bg-primary-700 text-white font-semibold
                   transition disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit" [disabled]="loading()"
          >
            @if (loading()) {
              <span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            }
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly wsService   = inject(WebSocketService);
  private readonly router      = inject(Router);

  emailValue    = '';
  passwordValue = '';
  loading       = signal(false);
  error         = signal('');
  emailTouched  = signal(false);
  passTouched   = signal(false);

  onSubmit() {
    if (!this.emailValue || !this.passwordValue) return;
    this.loading.set(true);
    this.error.set('');
    this.authService.login(this.emailValue, this.passwordValue).subscribe({
      next: () => { this.wsService.connect(); this.router.navigate(['/employees']); },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        this.loading.set(false);
      },
    });
  }
}
