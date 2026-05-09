import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, DatePipe } from '@angular/common';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';
import { AttendanceEvent } from '../../../core/models/employee.model';

interface PayrollSummary {
  employeeId: string;
  year: number;
  month: number;
  grossPay: number;
  netPay: number;
  tax: number;
  socialSecurity: number;
  status: string;
}

const MONTH_TH = ['', 'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                       'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

@Component({
  selector: 'app-payroll-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  template: `
    <div class="page-header">
      <div>
        <h2>Payroll Dashboard</h2>
        <p class="subtitle">{{ currentMonthLabel() }}</p>
      </div>
      <button class="btn primary" (click)="runBatch()" [disabled]="running()">
        @if (running()) { <span class="spinner"></span> }
        คำนวณเงินเดือน
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="card kpi-card">
        <div class="kpi-label">รวม Gross Pay</div>
        <div class="kpi-value">{{ totalGross() | number:'1.0-0' }} ฿</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">รวม Net Pay</div>
        <div class="kpi-value primary">{{ totalNet() | number:'1.0-0' }} ฿</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">รวมภาษี</div>
        <div class="kpi-value">{{ totalTax() | number:'1.0-0' }} ฿</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">พนักงานทั้งหมด</div>
        <div class="kpi-value">{{ payrolls().length }} คน</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Payroll table -->
      <div class="card table-section">
        <h3>รายละเอียดเงินเดือน</h3>
        @if (payrolls().length) {
          <table class="data-table" style="margin-top:.75rem">
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th style="text-align:right">Gross</th>
                <th style="text-align:right">ภาษี</th>
                <th style="text-align:right">ประกันสังคม</th>
                <th style="text-align:right">Net Pay</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              @for (p of payrolls(); track p.employeeId) {
                <tr>
                  <td><code>{{ p.employeeId.slice(0,8) }}…</code></td>
                  <td style="text-align:right">{{ p.grossPay | number:'1.0-0' }}</td>
                  <td style="text-align:right">{{ p.tax | number:'1.0-0' }}</td>
                  <td style="text-align:right">{{ p.socialSecurity | number:'1.0-0' }}</td>
                  <td style="text-align:right"><strong>{{ p.netPay | number:'1.0-0' }}</strong></td>
                  <td><span class="badge success">{{ p.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="empty">ยังไม่มีข้อมูลเงินเดือนเดือนนี้</p>
        }
      </div>

      <!-- Real-time attendance feed -->
      <div class="card feed-section">
        <div class="feed-header">
          <h3>Attendance Feed</h3>
          <div class="ws-indicator">
            <span class="ws-dot" [class.connected]="ws.connected()"></span>
            Real-time
          </div>
        </div>

        <div class="feed-list">
          @for (event of ws.attendanceEvents(); track event.timestamp) {
            <div class="feed-item" [class.check-out]="event.scanType === 'CHECK_OUT'">
              <div class="feed-icon">
                {{ event.scanType === 'CHECK_IN' ? '🟢' : '🔴' }}
              </div>
              <div class="feed-body">
                <span class="feed-type">{{ event.scanType === 'CHECK_IN' ? 'เข้างาน' : 'ออกงาน' }}</span>
                <span class="feed-emp">{{ event.employeeId.slice(0,8) }}…</span>
                @if (event.location) {
                  <span class="feed-loc">📍 {{ event.location }}</span>
                }
              </div>
              <span class="feed-time">{{ event.timestamp | date:'HH:mm:ss' }}</span>
            </div>
          } @empty {
            <p class="empty">รอ event การเข้างาน...</p>
          }
        </div>
      </div>
    </div>

    @if (batchMsg()) {
      <div class="toast" [class.error]="batchError()">{{ batchMsg() }}</div>
    }
  `,
  styles: [`
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.25rem;
      h2 { font-size: 1.25rem; font-weight: 700; }
    }
    .subtitle { font-size: .875rem; color: var(--text-muted); margin-top: .2rem; }

    .kpi-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 1rem; margin-bottom: 1.25rem;
    }
    .kpi-card { text-align: center; }
    .kpi-label { font-size: .8rem; color: var(--text-muted); margin-bottom: .35rem; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; &.primary { color: var(--primary); } }

    .dashboard-grid { display: grid; grid-template-columns: 1fr 360px; gap: 1rem; }
    .table-section h3, .feed-section h3 { font-size: 1rem; font-weight: 600; }

    .feed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .75rem; }
    .ws-indicator { display: flex; align-items: center; gap: .4rem; font-size: .75rem; color: var(--text-muted); }
    .ws-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--border);
      &.connected { background: var(--success); animation: pulse 2s infinite; }
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(14,159,110,.4); }
      50% { box-shadow: 0 0 0 4px rgba(14,159,110,0); }
    }

    .feed-list { display: flex; flex-direction: column; gap: .5rem; max-height: 500px; overflow-y: auto; }
    .feed-item {
      display: flex; align-items: center; gap: .75rem;
      padding: .5rem .75rem; border-radius: var(--radius);
      background: #f0fdf4; border-left: 3px solid var(--success);
      &.check-out { background: #fff5f5; border-left-color: var(--danger); }
    }
    .feed-body { flex: 1; display: flex; flex-direction: column; gap: .1rem; }
    .feed-type { font-size: .8rem; font-weight: 600; }
    .feed-emp, .feed-loc { font-size: .75rem; color: var(--text-muted); }
    .feed-time { font-size: .75rem; color: var(--text-muted); white-space: nowrap; }

    .empty { color: var(--text-muted); font-size: .875rem; padding: 1rem 0; text-align: center; }

    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
      border-radius: 50%; animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      background: var(--success); color: #fff;
      padding: .75rem 1.25rem; border-radius: var(--radius);
      box-shadow: var(--shadow); font-size: .875rem;
      animation: fadeIn .3s ease;
      &.error { background: var(--danger); }
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } }
  `],
})
export class PayrollDashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly ws = inject(WebSocketService);

  payrolls  = signal<PayrollSummary[]>([]);
  running   = signal(false);
  batchMsg  = signal('');
  batchError = signal(false);

  totalGross = computed(() => this.payrolls().reduce((s, p) => s + p.grossPay, 0));
  totalNet   = computed(() => this.payrolls().reduce((s, p) => s + p.netPay,   0));
  totalTax   = computed(() => this.payrolls().reduce((s, p) => s + p.tax,      0));

  private now = new Date();
  currentMonthLabel = signal(`${MONTH_TH[this.now.getMonth() + 1]} ${this.now.getFullYear() + 543}`);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.loadPayrolls();
    window.addEventListener('payroll:ready', this.onPayrollReady);
  }

  ngOnDestroy() {
    window.removeEventListener('payroll:ready', this.onPayrollReady);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadPayrolls() {
    const y = this.now.getFullYear();
    const m = this.now.getMonth() + 1;
    this.http.get<PayrollSummary[]>(`${environment.apiUrl}/payroll?year=${y}&month=${m}`)
      .subscribe({ next: data => this.payrolls.set(data), error: () => {} });
  }

  runBatch() {
    this.running.set(true);
    const y = this.now.getFullYear();
    const m = this.now.getMonth() + 1;
    this.http.post<PayrollSummary[]>(`${environment.apiUrl}/payroll/batch`, { year: y, month: m })
      .subscribe({
        next: results => {
          this.payrolls.set(results);
          this.running.set(false);
          this.showToast(`คำนวณเงินเดือนเสร็จสิ้น ${results.length} คน`, false);
        },
        error: () => {
          this.running.set(false);
          this.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', true);
        },
      });
  }

  private onPayrollReady = (e: Event) => {
    const { year, month, netPay } = (e as CustomEvent).detail;
    this.showToast(`เงินเดือนออกแล้ว ${MONTH_TH[month]} — Net ${netPay.toLocaleString()} ฿`, false);
  };

  private showToast(msg: string, isError: boolean) {
    this.batchMsg.set(msg);
    this.batchError.set(isError);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.batchMsg.set(''), 4000);
  }
}
