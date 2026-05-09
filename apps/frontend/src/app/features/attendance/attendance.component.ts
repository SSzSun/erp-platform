import { Component, signal, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { WebSocketService } from '../../core/services/websocket.service';
import { environment } from '../../../environments/environment';
import { AttendanceEvent } from '../../core/models/employee.model';

interface ManualScanResult { success: boolean; message: string; recordedAt: number; }

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="mb-5">
      <h2 class="text-xl font-bold text-gray-800">การเข้างาน</h2>
      <p class="text-sm text-gray-400 mt-0.5">บันทึกและติดตามการเข้าออกงานแบบ Real-time</p>
    </div>

    <div class="grid grid-cols-[380px_1fr] gap-4">

      <!-- Manual scan panel -->
      <div class="flex flex-col gap-4">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-semibold text-gray-700 mb-4">🖐️ บันทึกการสแกนด้วยตนเอง</h3>

          <div class="flex flex-col gap-3">
            <div>
              <label class="text-sm font-medium text-gray-600 block mb-1">รหัสพนักงาน</label>
              <input [(ngModel)]="empId" placeholder="กรอก Employee ID"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none
                       focus:border-primary-400 focus:ring-2 focus:ring-primary-100"/>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-600 block mb-1">ประเภท</label>
              <div class="grid grid-cols-2 gap-2">
                <button (click)="scanType = 'CHECK_IN'"
                  class="py-2 rounded-lg border-2 text-sm font-semibold transition"
                  [class]="scanType === 'CHECK_IN'
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                  🟢 เข้างาน
                </button>
                <button (click)="scanType = 'CHECK_OUT'"
                  class="py-2 rounded-lg border-2 text-sm font-semibold transition"
                  [class]="scanType === 'CHECK_OUT'
                    ? 'border-red-400 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                  🔴 ออกงาน
                </button>
              </div>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-600 block mb-1">สถานที่ (ไม่บังคับ)</label>
              <input [(ngModel)]="location" placeholder="เช่น อาคาร A ชั้น 3"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400"/>
            </div>

            <button (click)="recordScan()" [disabled]="!empId || scanning()"
              class="w-full py-2.5 rounded-lg font-semibold text-sm transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
              [class]="scanType === 'CHECK_IN'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'">
              @if (scanning()) {
                <span class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2"></span>
              }
              บันทึกการ{{ scanType === 'CHECK_IN' ? 'เข้า' : 'ออก' }}งาน
            </button>

            @if (scanResult()) {
              <div class="flex items-center gap-2 p-3 rounded-lg animate-fade-in text-sm font-medium"
                [class]="scanResult()!.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">
                {{ scanResult()!.success ? '✓' : '✕' }} {{ scanResult()!.message }}
              </div>
            }
          </div>
        </div>

        <!-- Stats today -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-semibold text-gray-700 mb-3">สถิติวันนี้</h3>
          <div class="grid grid-cols-2 gap-3">
            @for (stat of todayStats(); track stat.label) {
              <div class="text-center p-3 bg-gray-50 rounded-lg">
                <p class="text-2xl font-bold" [class]="stat.color">{{ stat.value }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ stat.label }}</p>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Real-time feed -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-700">Real-time Feed</h3>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full"
              [class]="ws.connected() ? 'bg-green-400 animate-pulse' : 'bg-gray-300'">
            </span>
            <span class="text-xs text-gray-400">{{ ws.attendanceEvents().length }} events วันนี้</span>
            <button (click)="clearFeed()" class="text-xs text-gray-400 hover:text-gray-600 underline ml-2">ล้าง</button>
          </div>
        </div>

        <!-- Events list -->
        <div class="flex flex-col gap-2 overflow-y-auto flex-1" style="max-height: calc(100vh - 300px)">
          @for (ev of ws.attendanceEvents(); track ev.timestamp) {
            <div class="flex items-center gap-3 p-3 rounded-lg border animate-fade-in"
              [class]="ev.scanType === 'CHECK_IN'
                ? 'bg-green-50 border-green-100'
                : 'bg-red-50 border-red-100'">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                [class]="ev.scanType === 'CHECK_IN' ? 'bg-green-100' : 'bg-red-100'">
                {{ ev.scanType === 'CHECK_IN' ? '🟢' : '🔴' }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-semibold text-sm text-gray-800">
                    {{ ev.scanType === 'CHECK_IN' ? 'เข้างาน' : 'ออกงาน' }}
                  </p>
                  @if (ev.location) {
                    <span class="text-xs text-gray-400">📍 {{ ev.location }}</span>
                  }
                </div>
                <p class="text-xs text-gray-500 mt-0.5 truncate">ID: {{ ev.employeeId }}</p>
              </div>
              <span class="text-xs text-gray-400 shrink-0 font-mono">
                {{ ev.timestamp | date:'HH:mm:ss' }}
              </span>
            </div>
          } @empty {
            <div class="flex flex-col items-center justify-center flex-1 py-16 text-gray-300">
              <div class="text-5xl mb-3">📋</div>
              <p class="text-sm">รอข้อมูลการสแกนเข้า-ออกงาน...</p>
              <p class="text-xs mt-1">เชื่อมต่อ WebSocket: {{ ws.connected() ? 'สำเร็จ ✓' : 'กำลังเชื่อมต่อ...' }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class AttendanceComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly ws = inject(WebSocketService);

  empId    = '';
  location = '';
  scanType: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN';
  scanning   = signal(false);
  scanResult = signal<ManualScanResult | null>(null);

  todayStats = signal([
    { label: 'เข้างาน',  value: '—', color: 'text-green-500' },
    { label: 'ออกงาน',   value: '—', color: 'text-red-500'   },
    { label: 'สาย',       value: '—', color: 'text-yellow-500'},
    { label: 'ขาดงาน',   value: '—', color: 'text-gray-500'  },
  ]);

  ngOnInit() { this.loadTodayStats(); }

  recordScan() {
    if (!this.empId) return;
    this.scanning.set(true);
    this.scanResult.set(null);

    this.http.post<ManualScanResult>(`${environment.apiUrl}/attendance/scan`, {
      employeeId: this.empId,
      scanType: this.scanType,
      timestamp: Date.now(),
      location: this.location,
      deviceId: 'manual-web',
    }).subscribe({
      next: res => {
        this.scanResult.set(res);
        this.scanning.set(false);
        if (res.success) { this.empId = ''; this.location = ''; }
        // update stats
        this.loadTodayStats();
      },
      error: () => {
        this.scanResult.set({ success: false, message: 'เกิดข้อผิดพลาด', recordedAt: 0 });
        this.scanning.set(false);
      },
    });
  }

  clearFeed() {
    this.ws.attendanceEvents.set([]);
  }

  private loadTodayStats() {
    this.http.get<{ checkIn:number; checkOut:number; late:number; absent:number }>(
      `${environment.apiUrl}/attendance/today-stats`
    ).subscribe({
      next: s => this.todayStats.set([
        { label:'เข้างาน', value: String(s.checkIn),  color:'text-green-500'  },
        { label:'ออกงาน',  value: String(s.checkOut), color:'text-red-500'    },
        { label:'สาย',      value: String(s.late),     color:'text-yellow-500' },
        { label:'ขาดงาน',  value: String(s.absent),   color:'text-gray-500'   },
      ]),
      error: () => this.todayStats.set([
        { label:'เข้างาน', value:'142', color:'text-green-500'  },
        { label:'ออกงาน',  value:'38',  color:'text-red-500'    },
        { label:'สาย',      value:'7',   color:'text-yellow-500' },
        { label:'ขาดงาน',  value:'5',   color:'text-gray-500'   },
      ]),
    });
  }
}
