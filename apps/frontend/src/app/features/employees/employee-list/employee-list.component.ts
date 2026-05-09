import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { environment } from '../../../../environments/environment';
import { Employee, EmployeeStatus } from '../../../core/models/employee.model';

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: 'ทำงานอยู่', inactive: 'ไม่ใช้งาน',
  resigned: 'ลาออก', terminated: 'เลิกจ้าง',
};
const STATUS_BADGE: Record<EmployeeStatus, string> = {
  active: 'success', inactive: 'warning', resigned: 'danger', terminated: 'danger',
};

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [FormsModule, ScrollingModule],
  template: `
    <div class="page-header">
      <div>
        <h2>รายชื่อพนักงาน</h2>
        <p class="subtitle">ทั้งหมด {{ filteredCount() }} คน</p>
      </div>
      <div class="header-actions">
        <input
          class="form-input search-input"
          type="search"
          placeholder="ค้นหาชื่อ / รหัส / ตำแหน่ง..."
          [(ngModel)]="searchValue"
          (ngModelChange)="search.set($event)"
        />
      </div>
    </div>

    @if (loading()) {
      <div class="loading-state">
        <div class="spinner-lg"></div>
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    } @else if (error()) {
      <div class="card error-state">
        <p>{{ error() }}</p>
        <button class="btn ghost" (click)="load()">ลองอีกครั้ง</button>
      </div>
    } @else {
      <div class="card table-card">
        <!-- Virtual scroll: rows are 52px tall each -->
        <cdk-virtual-scroll-viewport itemSize="52" class="virtual-viewport">
          <table class="data-table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ-นามสกุล</th>
                <th>แผนก</th>
                <th>ตำแหน่ง</th>
                <th style="text-align:right">เงินเดือน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              @for (emp of filtered(); track emp.id) {
                <tr>
                  <td><code>{{ emp.employeeCode }}</code></td>
                  <td>
                    <div class="name-cell">
                      <span class="avatar">{{ initials(emp) }}</span>
                      <div>
                        <div>{{ emp.firstNameTh }} {{ emp.lastNameTh }}</div>
                        <div class="text-muted">{{ emp.firstNameEn }} {{ emp.lastNameEn }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ emp.department?.name ?? '—' }}</td>
                  <td>{{ emp.position ?? '—' }}</td>
                  <td style="text-align:right">{{ emp.salary | number:'1.0-0' }} ฿</td>
                  <td>
                    <span class="badge {{ STATUS_BADGE[emp.status] }}">
                      {{ STATUS_LABEL[emp.status] }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">ไม่พบข้อมูล</td></tr>
              }
            </tbody>
          </table>
        </cdk-virtual-scroll-viewport>
      </div>
    }
  `,
  styles: [`
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.25rem;
      h2 { font-size: 1.25rem; font-weight: 700; }
    }
    .subtitle { font-size: .875rem; color: var(--text-muted); margin-top: .2rem; }
    .search-input { width: 280px; }
    .table-card { padding: 0; overflow: hidden; }
    .virtual-viewport { height: calc(100vh - 220px); }
    .name-cell { display: flex; align-items: center; gap: .75rem; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: .75rem; font-weight: 700; flex-shrink: 0;
    }
    .text-muted { font-size: .75rem; color: var(--text-muted); }
    code { font-size: .8rem; background: var(--bg); padding: .15rem .4rem; border-radius: 4px; }
    .loading-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 1rem; padding: 4rem; color: var(--text-muted);
    }
    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border); border-top-color: var(--primary);
      border-radius: 50%; animation: spin .8s linear infinite;
    }
    .error-state { text-align: center; padding: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: center; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class EmployeeListComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly STATUS_LABEL = STATUS_LABEL;
  readonly STATUS_BADGE = STATUS_BADGE;

  employees = signal<Employee[]>([]);
  search    = signal('');
  loading   = signal(true);
  error     = signal('');
  searchValue = '';

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.employees();
    return this.employees().filter(e =>
      e.firstNameTh.includes(q) || e.lastNameTh.includes(q) ||
      e.firstNameEn.toLowerCase().includes(q) || e.lastNameEn.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.position ?? '').toLowerCase().includes(q)
    );
  });

  filteredCount = computed(() => this.filtered().length);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<Employee[]>(`${environment.apiUrl}/employees`).subscribe({
      next: data => { this.employees.set(data); this.loading.set(false); },
      error: () => { this.error.set('โหลดข้อมูลไม่ได้ กรุณาลองใหม่'); this.loading.set(false); },
    });
  }

  initials(emp: Employee): string {
    return (emp.firstNameEn[0] ?? '') + (emp.lastNameEn[0] ?? '');
  }
}
