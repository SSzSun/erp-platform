import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';

interface MonthlyPayroll { month: number; year: number; totalNet: number; headCount: number; }
interface TurnoverData   { month: number; resigned: number; hired: number; }
interface DeptHeadcount  { deptName: string; count: number; }

interface Analytics {
  totalHeadcount: number;
  avgSalary: number;
  turnoverRate: number;
  monthlyPayroll: MonthlyPayroll[];
  turnoverTrend: TurnoverData[];
  deptBreakdown: DeptHeadcount[];
}

const MONTH_TH_SHORT = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="mb-5">
      <h2 class="text-xl font-bold text-gray-800">Analytics & KPI</h2>
      <p class="text-sm text-gray-400 mt-0.5">ข้อมูล 12 เดือนล่าสุด</p>
    </div>

    <!-- KPI row -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">พนักงานทั้งหมด</p>
        <p class="text-3xl font-bold text-gray-800">{{ data()?.totalHeadcount | number }}</p>
        <p class="text-xs text-green-500 mt-1">👤 Active employees</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">เงินเดือนเฉลี่ย</p>
        <p class="text-3xl font-bold text-primary-600">{{ data()?.avgSalary | number:'1.0-0' }}</p>
        <p class="text-xs text-gray-400 mt-1">บาท / เดือน</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">อัตรา Turnover</p>
        <p class="text-3xl font-bold" [class]="(data()?.turnoverRate ?? 0) > 5 ? 'text-red-500' : 'text-green-500'">
          {{ data()?.turnoverRate | number:'1.1-1' }}%
        </p>
        <p class="text-xs text-gray-400 mt-1">เฉลี่ย 12 เดือน</p>
      </div>
    </div>

    <div class="grid grid-cols-[1fr_300px] gap-4">

      <!-- Payroll bar chart -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-700 mb-4">Net Payroll รายเดือน (฿)</h3>
        @if (data()) {
          <div class="flex items-end gap-2 h-48">
            @for (m of data()!.monthlyPayroll; track m.month) {
              <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                <!-- Bar -->
                <div class="relative w-full group">
                  <div class="w-full bg-primary-500 hover:bg-primary-600 rounded-t-md transition-all"
                    [style.height]="barHeight(m.totalNet) + 'px'">
                  </div>
                  <!-- Tooltip -->
                  <div class="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block
                              bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {{ m.totalNet | number:'1.0-0' }} ฿
                  </div>
                </div>
                <span class="text-xs text-gray-400 text-center">{{ MONTH_TH[m.month] }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="h-48 flex items-center justify-center">
            <div class="w-8 h-8 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        }
      </div>

      <!-- Dept breakdown -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-700 mb-4">สัดส่วนพนักงานต่อแผนก</h3>
        @if (data()) {
          <div class="flex flex-col gap-3">
            @for (d of data()!.deptBreakdown; track d.deptName) {
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-gray-700 truncate max-w-[180px]">{{ d.deptName }}</span>
                  <span class="text-sm font-semibold text-gray-800">{{ d.count }}</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary-500 rounded-full transition-all"
                    [style.width]="deptBarPct(d.count) + '%'">
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Turnover trend -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mt-4">
      <h3 class="font-semibold text-gray-700 mb-4">แนวโน้ม Turnover (เข้า vs ออก)</h3>
      @if (data()) {
        <div class="flex items-end gap-3 h-36">
          @for (t of data()!.turnoverTrend; track t.month) {
            <div class="flex-1 flex flex-col items-center gap-0.5">
              <div class="w-full flex gap-0.5 items-end justify-center" style="height:100px">
                <div class="w-[45%] bg-green-400 rounded-t hover:bg-green-500 transition"
                  [style.height]="turnoverBarH(t.hired) + 'px'" title="เข้า {{ t.hired }}">
                </div>
                <div class="w-[45%] bg-red-400 rounded-t hover:bg-red-500 transition"
                  [style.height]="turnoverBarH(t.resigned) + 'px'" title="ออก {{ t.resigned }}">
                </div>
              </div>
              <span class="text-xs text-gray-400">{{ MONTH_TH[t.month] }}</span>
            </div>
          }
        </div>
        <div class="flex gap-4 mt-3 text-xs text-gray-500">
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-green-400 inline-block"></span> เข้างาน</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-400 inline-block"></span> ลาออก</span>
        </div>
      }
    </div>
  `,
})
export class AnalyticsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly MONTH_TH = MONTH_TH_SHORT;

  data = signal<Analytics | null>(null);
  maxPayroll = computed(() => Math.max(...(this.data()?.monthlyPayroll.map(m => m.totalNet) ?? [1])));
  maxHeadcount = computed(() => Math.max(...(this.data()?.deptBreakdown.map(d => d.count) ?? [1])));
  maxTurnover  = computed(() => Math.max(...(this.data()?.turnoverTrend.flatMap(t => [t.hired, t.resigned]) ?? [1])));

  ngOnInit() {
    this.http.get<Analytics>(`${environment.apiUrl}/analytics`).subscribe({
      next: d => this.data.set(d),
      error: () => this.data.set(this.mockData()),
    });
  }

  barHeight(v: number)       { return Math.max(4, Math.round((v / this.maxPayroll()) * 160)); }
  deptBarPct(v: number)      { return Math.round((v / this.maxHeadcount()) * 100); }
  turnoverBarH(v: number)    { return Math.max(2, Math.round((v / this.maxTurnover()) * 96)); }

  private mockData(): Analytics {
    return {
      totalHeadcount: 247,
      avgSalary: 38500,
      turnoverRate: 3.2,
      monthlyPayroll: Array.from({length:12},(_,i)=>({ month:i+1, year:2026, totalNet: 8_000_000 + Math.random()*1_500_000, headCount:247 })),
      turnoverTrend:  Array.from({length:12},(_,i)=>({ month:i+1, hired: Math.floor(Math.random()*8)+1, resigned: Math.floor(Math.random()*5)+1 })),
      deptBreakdown: [
        {deptName:'ฝ่ายผลิต', count:82}, {deptName:'ฝ่ายขาย', count:54},
        {deptName:'ฝ่าย IT', count:38}, {deptName:'ฝ่ายบุคคล', count:22},
        {deptName:'ฝ่ายบัญชี', count:19}, {deptName:'ฝ่ายอื่นๆ', count:32},
      ],
    };
  }
}
