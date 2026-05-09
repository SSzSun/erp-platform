import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, DatePipe } from '@angular/common';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';

interface PayrollSummary {
  employeeId: string; year: number; month: number;
  grossPay: number; netPay: number; tax: number; socialSecurity: number; status: string;
}
const MONTH_TH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

@Component({
  selector: 'app-payroll-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  template: `
    <!-- Header -->
    <div class="flex items-start justify-between mb-5">
      <div>
        <h2 class="text-xl font-bold text-gray-800">Payroll Dashboard</h2>
        <p class="text-sm text-gray-400 mt-0.5">{{ currentMonthLabel() }}</p>
      </div>
      <button
        (click)="runBatch()" [disabled]="running()"
        class="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white
               text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        @if (running()) {
          <span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
        }
        คำนวณเงินเดือน
      </button>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-4 gap-4 mb-5">
      @for (kpi of kpis(); track kpi.label) {
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p class="text-xs text-gray-400 mb-1">{{ kpi.label }}</p>
          <p class="text-2xl font-bold" [class]="kpi.color ?? 'text-gray-800'">{{ kpi.value }}</p>
        </div>
      }
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-[1fr_340px] gap-4">

      <!-- Payroll table -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 class="font-semibold text-gray-700 mb-3">รายละเอียดเงินเดือน</h3>
        @if (payrolls().length) {
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="pb-2 text-left text-xs font-semibold text-gray-400 uppercase">พนักงาน</th>
                <th class="pb-2 text-right text-xs font-semibold text-gray-400 uppercase">Gross</th>
                <th class="pb-2 text-right text-xs font-semibold text-gray-400 uppercase">ภาษี</th>
                <th class="pb-2 text-right text-xs font-semibold text-gray-400 uppercase">ประกันสังคม</th>
                <th class="pb-2 text-right text-xs font-semibold text-gray-400 uppercase">Net Pay</th>
                <th class="pb-2 text-left text-xs font-semibold text-gray-400 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              @for (p of payrolls(); track p.employeeId) {
                <tr class="border-b border-gray-50 hover:bg-gray-50/60">
                  <td class="py-2.5"><code class="text-xs bg-gray-100 px-2 py-0.5 rounded">{{ p.employeeId.slice(0,8) }}…</code></td>
                  <td class="py-2.5 text-right text-gray-600">{{ p.grossPay | number:'1.0-0' }}</td>
                  <td class="py-2.5 text-right text-gray-600">{{ p.tax | number:'1.0-0' }}</td>
                  <td class="py-2.5 text-right text-gray-600">{{ p.socialSecurity | number:'1.0-0' }}</td>
                  <td class="py-2.5 text-right font-semibold text-gray-800">{{ p.netPay | number:'1.0-0' }}</td>
                  <td class="py-2.5">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{{ p.status }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูลเงินเดือนเดือนนี้</p>
        }
      </div>

      <!-- Real-time attendance feed -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-700">Attendance Feed</h3>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" [class]="ws.connected() ? 'bg-green-400 animate-pulse' : 'bg-gray-300'"></span>
            <span class="text-xs text-gray-400">Real-time</span>
          </div>
        </div>

        <div class="flex flex-col gap-2 overflow-y-auto flex-1 max-h-[520px]">
          @for (ev of ws.attendanceEvents(); track ev.timestamp) {
            <div class="flex items-center gap-2.5 p-2.5 rounded-lg border-l-2 animate-fade-in"
              [class]="ev.scanType === 'CHECK_IN'
                ? 'bg-green-50 border-green-400'
                : 'bg-red-50 border-red-400'">
              <span class="text-base shrink-0">{{ ev.scanType === 'CHECK_IN' ? '🟢' : '🔴' }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-gray-700">
                  {{ ev.scanType === 'CHECK_IN' ? 'เข้างาน' : 'ออกงาน' }}
                </p>
                <p class="text-xs text-gray-400 truncate">{{ ev.employeeId.slice(0,8) }}…</p>
                @if (ev.location) {
                  <p class="text-xs text-gray-400">📍 {{ ev.location }}</p>
                }
              </div>
              <span class="text-xs text-gray-400 shrink-0">{{ ev.timestamp | date:'HH:mm:ss' }}</span>
            </div>
          } @empty {
            <p class="text-sm text-gray-400 text-center py-8">รอ event การเข้างาน...</p>
          }
        </div>
      </div>
    </div>

    <!-- Toast -->
    @if (batchMsg()) {
      <div class="fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in"
        [class]="batchError() ? 'bg-red-500' : 'bg-green-500'">
        {{ batchMsg() }}
      </div>
    }
  `,
})
export class PayrollDashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly ws = inject(WebSocketService);

  payrolls   = signal<PayrollSummary[]>([]);
  running    = signal(false);
  batchMsg   = signal('');
  batchError = signal(false);
  private now = new Date();
  currentMonthLabel = signal(`${MONTH_TH[this.now.getMonth()+1]} ${this.now.getFullYear()+543}`);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  kpis = computed(() => [
    { label: 'รวม Gross Pay', value: (this.payrolls().reduce((s,p)=>s+p.grossPay,0)|0).toLocaleString()+' ฿' },
    { label: 'รวม Net Pay',   value: (this.payrolls().reduce((s,p)=>s+p.netPay,0)|0).toLocaleString()+' ฿', color: 'text-primary-600' },
    { label: 'รวมภาษี',       value: (this.payrolls().reduce((s,p)=>s+p.tax,0)|0).toLocaleString()+' ฿' },
    { label: 'พนักงาน',       value: this.payrolls().length+' คน' },
  ]);

  ngOnInit() { this.loadPayrolls(); window.addEventListener('payroll:ready', this.onPayrollReady); }
  ngOnDestroy() { window.removeEventListener('payroll:ready', this.onPayrollReady); if(this.toastTimer) clearTimeout(this.toastTimer); }

  loadPayrolls() {
    const y=this.now.getFullYear(), m=this.now.getMonth()+1;
    this.http.get<PayrollSummary[]>(`${environment.apiUrl}/payroll?year=${y}&month=${m}`)
      .subscribe({ next: d=>this.payrolls.set(d), error:()=>{} });
  }

  runBatch() {
    this.running.set(true);
    const y=this.now.getFullYear(), m=this.now.getMonth()+1;
    this.http.post<PayrollSummary[]>(`${environment.apiUrl}/payroll/batch`,{year:y,month:m}).subscribe({
      next: r => { this.payrolls.set(r); this.running.set(false); this.toast(`คำนวณเสร็จ ${r.length} คน`,false); },
      error: () => { this.running.set(false); this.toast('เกิดข้อผิดพลาด กรุณาลองใหม่',true); },
    });
  }

  private onPayrollReady = (e:Event) => {
    const { month, netPay } = (e as CustomEvent).detail;
    this.toast(`เงินเดือนออกแล้ว ${MONTH_TH[month]} — Net ${netPay.toLocaleString()} ฿`, false);
  };
  private toast(msg:string, err:boolean) {
    this.batchMsg.set(msg); this.batchError.set(err);
    if(this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(()=>this.batchMsg.set(''), 4000);
  }
}
