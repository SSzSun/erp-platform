import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';

interface NavItem { label: string; icon: string; path: string; roles?: string[]; }

const NAV: NavItem[] = [
  { label: 'พนักงาน',      icon: '👥', path: '/employees' },
  { label: 'เงินเดือน',    icon: '💰', path: '/payroll' },
  { label: 'ผังองค์กร',   icon: '🏗️', path: '/org-chart' },
  { label: 'การอนุมัติ',  icon: '✅', path: '/approvals' },
  { label: 'Analytics',   icon: '📊', path: '/analytics', roles: ['admin','hr','finance'] },
  { label: 'การเข้างาน',  icon: '📋', path: '/attendance', roles: ['admin','hr'] },
];

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden bg-gray-50 font-sarabun">

      <!-- Sidebar -->
      <aside class="w-60 flex flex-col shrink-0 bg-white border-r border-gray-100 shadow-sm">

        <!-- Brand -->
        <div class="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
          <span class="text-2xl">🏢</span>
          <span class="font-bold text-gray-800 text-sm leading-tight">ERP Platform</span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          @for (item of visibleNav(); track item.path) {
            <a
              [routerLink]="item.path" routerLinkActive="bg-primary-50 text-primary-600 font-semibold"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500
                     hover:bg-gray-50 hover:text-gray-800 transition-colors"
            >
              <span class="text-base w-5 text-center">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Footer -->
        <div class="p-3 border-t border-gray-100 flex flex-col gap-2">
          <!-- WS status -->
          <div class="flex items-center gap-1.5 px-1">
            <span class="w-2 h-2 rounded-full transition-colors"
              [class]="ws.connected() ? 'bg-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.2)]' : 'bg-gray-300'">
            </span>
            <span class="text-xs text-gray-400">{{ ws.connected() ? 'Real-time' : 'Offline' }}</span>
          </div>
          <!-- User -->
          <div class="flex items-center justify-between px-1">
            <span class="text-xs text-gray-500 truncate max-w-[130px]">{{ auth.user()?.email }}</span>
            <span class="text-xs bg-primary-100 text-primary-700 font-medium px-2 py-0.5 rounded-full">
              {{ auth.user()?.role }}
            </span>
          </div>
          <button
            (click)="auth.logout()"
            class="w-full text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5
                   hover:bg-gray-50 transition"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <!-- Main -->
      <main class="flex-1 overflow-y-auto p-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class LayoutComponent {
  readonly auth = inject(AuthService);
  readonly ws   = inject(WebSocketService);

  visibleNav() {
    const role = this.auth.user()?.role ?? '';
    return NAV.filter(n => !n.roles || n.roles.includes(role));
  }
}
