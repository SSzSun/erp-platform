import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AttendanceEvent } from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly auth = inject(AuthService);

  readonly attendanceEvents = signal<AttendanceEvent[]>([]);
  readonly connected        = signal(false);

  connect() {
    const token = this.auth.getAccessToken();
    if (!token || this.socket?.connected) return;

    this.socket = io(`${environment.wsUrl}/notifications`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.connected.set(true);
      this.socket!.emit('subscribe:payroll');
    });

    this.socket.on('disconnect', () => this.connected.set(false));

    this.socket.on('attendance:event', (event: AttendanceEvent) => {
      this.attendanceEvents.update(prev => [event, ...prev].slice(0, 100));
    });

    this.socket.on('payroll:ready', (data: { year: number; month: number; netPay: number }) => {
      // Dispatch a custom DOM event so any component can react
      window.dispatchEvent(new CustomEvent('payroll:ready', { detail: data }));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
