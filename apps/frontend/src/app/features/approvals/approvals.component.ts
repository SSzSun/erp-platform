import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

type ApprovalType   = 'leave' | 'ot' | 'expense';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ApprovalRequest {
  id: string; type: ApprovalType; status: ApprovalStatus;
  employeeId: string; employeeName: string;
  title: string; detail: string;
  amount?: number; startDate?: string; endDate?: string;
  createdAt: string; updatedAt: string;
  rejectReason?: string;
}

const TYPE_LABEL: Record<ApprovalType, string>   = { leave:'ลาหยุด', ot:'ทำงานล่วงเวลา', expense:'เบิกค่าใช้จ่าย' };
const TYPE_COLOR: Record<ApprovalType, string>   = { leave:'bg-blue-100 text-blue-700', ot:'bg-orange-100 text-orange-700', expense:'bg-purple-100 text-purple-700' };
const STATUS_LABEL: Record<ApprovalStatus, string> = { pending:'รอดำเนินการ', approved:'อนุมัติแล้ว', rejected:'ปฏิเสธ' };
const STATUS_COLOR: Record<ApprovalStatus, string> = { pending:'bg-yellow-100 text-yellow-700', approved:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-600' };

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <!-- Header + Tabs -->
    <div class="mb-5">
      <h2 class="text-xl font-bold text-gray-800 mb-4">การอนุมัติ</h2>

      <div class="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        @for (tab of tabs; track tab.key) {
          <button (click)="activeTab.set(tab.key)"
            class="px-4 py-1.5 rounded-lg text-sm font-medium transition"
            [class]="activeTab() === tab.key
              ? 'bg-white shadow text-gray-800'
              : 'text-gray-500 hover:text-gray-700'">
            {{ tab.label }}
            @if (tab.key === 'pending' && pendingCount() > 0) {
              <span class="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{{ pendingCount() }}</span>
            }
          </button>
        }
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 mb-4">
      <select [(ngModel)]="typeFilter" (ngModelChange)="typeFilter = $event"
        class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400 bg-white">
        <option value="">ทุกประเภท</option>
        @for (t of types; track t.key) { <option [value]="t.key">{{ t.label }}</option> }
      </select>
    </div>

    <!-- List -->
    <div class="flex flex-col gap-3">
      @for (req of filtered(); track req.id) {
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:shadow-md transition">
          <!-- Type badge -->
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 {{ TYPE_COLOR[req.type] }}">
            {{ TYPE_LABEL[req.type] }}
          </span>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="font-semibold text-gray-800 text-sm">{{ req.title }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ req.employeeName }} · {{ req.createdAt | date:'d MMM yyyy HH:mm' }}</p>
              </div>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 {{ STATUS_COLOR[req.status] }}">
                {{ STATUS_LABEL[req.status] }}
              </span>
            </div>

            <p class="text-sm text-gray-600 mt-1.5">{{ req.detail }}</p>

            @if (req.amount) {
              <p class="text-sm font-semibold text-gray-800 mt-1">฿{{ req.amount | number:'1.0-0' }}</p>
            }
            @if (req.startDate) {
              <p class="text-xs text-gray-400 mt-1">{{ req.startDate }} – {{ req.endDate }}</p>
            }
            @if (req.rejectReason) {
              <p class="text-xs text-red-500 mt-1.5 bg-red-50 px-2 py-1 rounded-lg">⚠ {{ req.rejectReason }}</p>
            }

            <!-- Actions (HR/Admin only, pending only) -->
            @if (auth.isHR() && req.status === 'pending') {
              <div class="flex gap-2 mt-3">
                <button (click)="approve(req)"
                  class="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition">
                  ✓ อนุมัติ
                </button>
                <button (click)="openReject(req)"
                  class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition">
                  ✕ ปฏิเสธ
                </button>
              </div>
            }
          </div>
        </div>
      } @empty {
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-sm text-gray-400">
          ไม่มีรายการ{{ activeTab() === 'pending' ? 'ที่รอดำเนินการ' : '' }}
        </div>
      }
    </div>

    <!-- Reject modal -->
    @if (rejectTarget()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
          <h3 class="font-bold text-gray-800">เหตุผลการปฏิเสธ</h3>
          <textarea [(ngModel)]="rejectReason" rows="3" placeholder="ระบุเหตุผล..."
            class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400 resize-none">
          </textarea>
          <div class="flex gap-2">
            <button (click)="rejectTarget.set(null)"
              class="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
            <button (click)="confirmReject()"
              class="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold">ยืนยันปฏิเสธ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ApprovalsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);

  readonly TYPE_LABEL   = TYPE_LABEL;
  readonly TYPE_COLOR   = TYPE_COLOR;
  readonly STATUS_LABEL = STATUS_LABEL;
  readonly STATUS_COLOR = STATUS_COLOR;

  requests     = signal<ApprovalRequest[]>([]);
  activeTab    = signal<ApprovalStatus | 'all'>('pending');
  typeFilter   = '';
  rejectTarget = signal<ApprovalRequest | null>(null);
  rejectReason = '';

  tabs  = [{ key:'pending' as const, label:'รอดำเนินการ' }, { key:'approved' as const, label:'อนุมัติแล้ว' }, { key:'rejected' as const, label:'ปฏิเสธ' }, { key:'all' as const, label:'ทั้งหมด' }];
  types = [{ key:'leave', label:'ลาหยุด' }, { key:'ot', label:'OT' }, { key:'expense', label:'เบิกค่าใช้จ่าย' }];

  pendingCount = computed(() => this.requests().filter(r => r.status === 'pending').length);

  filtered = computed(() => {
    let list = this.requests();
    const tab = this.activeTab();
    if (tab !== 'all') list = list.filter(r => r.status === tab);
    if (this.typeFilter) list = list.filter(r => r.type === this.typeFilter);
    return list;
  });

  ngOnInit() { this.load(); }

  load() {
    this.http.get<ApprovalRequest[]>(`${environment.apiUrl}/approvals`).subscribe({
      next: d => this.requests.set(d),
      error: () => this.requests.set(this.mockData()),
    });
  }

  approve(req: ApprovalRequest) {
    this.http.patch(`${environment.apiUrl}/approvals/${req.id}/approve`, {}).subscribe({
      next: () => this.requests.update(list => list.map(r => r.id === req.id ? { ...r, status: 'approved' } : r)),
      error: () => this.requests.update(list => list.map(r => r.id === req.id ? { ...r, status: 'approved' } : r)),
    });
  }

  openReject(req: ApprovalRequest) { this.rejectTarget.set(req); this.rejectReason = ''; }

  confirmReject() {
    const req = this.rejectTarget();
    if (!req) return;
    this.http.patch(`${environment.apiUrl}/approvals/${req.id}/reject`, { reason: this.rejectReason }).subscribe({
      next: () => {},
      error: () => {},
    });
    this.requests.update(list => list.map(r => r.id === req.id ? { ...r, status: 'rejected', rejectReason: this.rejectReason } : r));
    this.rejectTarget.set(null);
  }

  private mockData(): ApprovalRequest[] {
    return [
      { id:'1', type:'leave', status:'pending', employeeId:'e1', employeeName:'สมศักดิ์ ใจดี', title:'ลาพักร้อน', detail:'ลาพักร้อนประจำปี', startDate:'2026-05-20', endDate:'2026-05-22', createdAt:'2026-05-09T08:00:00Z', updatedAt:'2026-05-09T08:00:00Z' },
      { id:'2', type:'ot', status:'pending', employeeId:'e2', employeeName:'วิภา รักงาน', title:'OT วันเสาร์', detail:'ทำงานพิเศษโปรเจค ERP', createdAt:'2026-05-09T09:00:00Z', updatedAt:'2026-05-09T09:00:00Z' },
      { id:'3', type:'expense', status:'approved', employeeId:'e3', employeeName:'ประสิทธิ์ มั่นคง', title:'ค่าเดินทาง', detail:'เดินทางไปอบรมที่เชียงใหม่', amount:4500, createdAt:'2026-05-08T10:00:00Z', updatedAt:'2026-05-09T10:00:00Z' },
      { id:'4', type:'leave', status:'rejected', employeeId:'e4', employeeName:'นิภา สร้างสรรค์', title:'ลากิจ', detail:'ธุระส่วนตัวด่วน', startDate:'2026-05-10', endDate:'2026-05-10', rejectReason:'ไม่มีคนทดแทน', createdAt:'2026-05-07T08:00:00Z', updatedAt:'2026-05-08T08:00:00Z' },
    ];
  }
}
