import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { environment } from '../../../../environments/environment';
import { Employee, EmployeeStatus } from '../../../core/models/employee.model';

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: 'ทำงานอยู่', inactive: 'ไม่ใช้งาน', resigned: 'ลาออก', terminated: 'เลิกจ้าง',
};
const STATUS_CLS: Record<EmployeeStatus, string> = {
  active:     'bg-green-100 text-green-700',
  inactive:   'bg-yellow-100 text-yellow-700',
  resigned:   'bg-red-100 text-red-600',
  terminated: 'bg-red-100 text-red-600',
};

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [FormsModule, ScrollingModule],
  template: `
    <!-- Header -->
    <div class="flex items-start justify-between mb-5">
      <div>
        <h2 class="text-xl font-bold text-gray-800">รายชื่อพนักงาน</h2>
        <p class="text-sm text-gray-400 mt-0.5">ทั้งหมด {{ filteredCount() }} คน</p>
      </div>
      <input
        class="w-72 px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none
               focus:border-primary-500 focus:ring-2 focus:ring-primary-100 placeholder:text-gray-300"
        type="search" placeholder="ค้นหาชื่อ / รหัส / ตำแหน่ง..."
        [(ngModel)]="searchValue" (ngModelChange)="search.set($event)"
      />
    </div>

    <!-- Loading -->
    @if (loading()) {
      <div class="flex flex-col items-center gap-3 py-20 text-gray-400">
        <div class="w-10 h-10 border-[3px] border-gray-200 border-t-primary-500 rounded-full animate-spin"></div>
        <p class="text-sm">กำลังโหลดข้อมูล...</p>
      </div>
    } @else if (error()) {
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center flex flex-col items-center gap-3">
        <p class="text-gray-500 text-sm">{{ error() }}</p>
        <button class="px-4 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50" (click)="load()">
          ลองอีกครั้ง
        </button>
      </div>
    } @else {
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <cdk-virtual-scroll-viewport itemSize="56" class="virtual-viewport">
          <table class="w-full border-collapse text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="bg-gray-50 border-b border-gray-100">
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">รหัส</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">ชื่อ-นามสกุล</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">แผนก</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">ตำแหน่ง</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">เงินเดือน</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              @for (emp of filtered(); track emp.id) {
                <tr class="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td class="px-4 py-3">
                    <code class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{{ emp.employeeCode }}</code>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-primary-600 text-white text-xs font-bold
                                  flex items-center justify-center shrink-0">
                        {{ initials(emp) }}
                      </div>
                      <div class="min-w-0">
                        <div class="font-medium text-gray-800 truncate">{{ emp.firstNameTh }} {{ emp.lastNameTh }}</div>
                        <div class="text-xs text-gray-400 truncate">{{ emp.firstNameEn }} {{ emp.lastNameEn }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-gray-600">{{ emp.department?.name ?? '—' }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ emp.position ?? '—' }}</td>
                  <td class="px-4 py-3 text-right font-medium text-gray-800">
                    {{ emp.salary | number:'1.0-0' }} ฿
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full {{ STATUS_CLS[emp.status] }}">
                      {{ STATUS_LABEL[emp.status] }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="py-12 text-center text-sm text-gray-400">ไม่พบข้อมูล</td></tr>
              }
            </tbody>
          </table>
        </cdk-virtual-scroll-viewport>
      </div>
    }
  `,
})
export class EmployeeListComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly STATUS_LABEL = STATUS_LABEL;
  readonly STATUS_CLS   = STATUS_CLS;

  employees     = signal<Employee[]>([]);
  search        = signal('');
  loading       = signal(true);
  error         = signal('');
  searchValue   = '';

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.employees();
    return this.employees().filter(e =>
      e.firstNameTh.includes(q) || e.lastNameTh.includes(q) ||
      e.firstNameEn.toLowerCase().includes(q) || e.lastNameEn.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) || (e.position ?? '').toLowerCase().includes(q)
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

  initials(emp: Employee) { return (emp.firstNameEn[0] ?? '') + (emp.lastNameEn[0] ?? ''); }
}
