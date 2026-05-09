import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="brand-icon">🏢</span>
          <span class="brand-name">ERP Platform</span>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/employees" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">👥</span> พนักงาน
          </a>
          <a routerLink="/payroll" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">💰</span> เงินเดือน
          </a>
          @if (auth.isHR()) {
            <a routerLink="/attendance" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📋</span> การเข้างาน
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="ws-status">
            <span class="ws-dot" [class.connected]="ws.connected()"></span>
            {{ ws.connected() ? 'Real-time' : 'Offline' }}
          </div>
          <div class="user-info">
            <span class="user-email">{{ auth.user()?.email }}</span>
            <span class="badge info">{{ auth.user()?.role }}</span>
          </div>
          <button class="btn ghost logout-btn" (click)="auth.logout()">ออกจากระบบ</button>
        </div>
      </aside>

      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: var(--sidebar-w);
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-brand {
      padding: 1.25rem 1rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: .6rem;
      font-weight: 700;
      font-size: 1rem;
    }
    .brand-icon { font-size: 1.4rem; }

    .sidebar-nav {
      flex: 1;
      padding: .75rem .5rem;
      display: flex;
      flex-direction: column;
      gap: .25rem;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .6rem .75rem;
      border-radius: var(--radius);
      text-decoration: none;
      color: var(--text-muted);
      font-size: .9rem;
      transition: background .15s, color .15s;
      &:hover { background: var(--bg); color: var(--text); }
      &.active { background: #eff6ff; color: var(--primary); font-weight: 600; }
    }
    .nav-icon { width: 20px; text-align: center; }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: .75rem;
    }
    .ws-status {
      display: flex;
      align-items: center;
      gap: .4rem;
      font-size: .75rem;
      color: var(--text-muted);
    }
    .ws-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--border);
      &.connected { background: var(--success); box-shadow: 0 0 0 2px rgba(14,159,110,.2); }
    }
    .user-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .user-email { font-size: .75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
    .logout-btn { width: 100%; justify-content: center; font-size: .8rem; padding: .4rem; }

    .main-content { flex: 1; overflow-y: auto; padding: 1.5rem; }
  `],
})
export class LayoutComponent {
  readonly auth = inject(AuthService);
  readonly ws   = inject(WebSocketService);
}
