import { Observable } from 'rxjs';

// ── Payroll ───────────────────────────────────────────────────────────────────

export interface Allowance {
  type: string;
  amount: number;
}

export interface CalculatePayrollRequest {
  employeeId: string;
  baseSalary: number;
  year: number;
  month: number;
  otHours: number;
  unpaidLeaveDays: number;
  allowances: Allowance[];
}

export interface PayrollResult {
  employeeId: string;
  year: number;
  month: number;
  baseSalary: number;
  otPay: number;
  totalAllowance: number;
  grossPay: number;
  tax: number;
  socialSecurity: number;
  providentFund: number;
  totalDeduction: number;
  netPay: number;
  status: string;
  errorMessage: string;
}

export interface PayrollBatchRequest {
  year: number;
  month: number;
  employeeIds: string[];
}

export interface PayrollHistoryRequest {
  employeeId: string;
  year: number;
}

export interface PayrollHistoryResponse {
  records: PayrollResult[];
}

export interface PayrollServiceClient {
  calculatePayroll(req: CalculatePayrollRequest): Observable<PayrollResult>;
  processPayrollBatch(req: PayrollBatchRequest): Observable<PayrollResult>;
  getPayrollHistory(req: PayrollHistoryRequest): Observable<PayrollHistoryResponse>;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export enum ScanType {
  CHECK_IN = 1,
  CHECK_OUT = 2,
}

export interface ScanRequest {
  employeeId: string;
  scanType: ScanType;
  timestamp: number;
  deviceId: string;
  location: string;
}

export interface ScanResponse {
  success: boolean;
  message: string;
  recordedAt: number;
}

export interface DailySummaryRequest {
  employeeId: string;
  date: string;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string;
  checkInAt: number;
  checkOutAt: number;
  workHours: number;
  otHours: number;
  isLate: boolean;
  isAbsent: boolean;
  status: string;
}

export interface MonthlySummaryRequest {
  employeeId: string;
  year: number;
  month: number;
}

export interface AttendanceServiceClient {
  recordScan(req: ScanRequest): Observable<ScanResponse>;
  getDailySummary(req: DailySummaryRequest): Observable<{ record: AttendanceRecord }>;
  getMonthlySummary(req: MonthlySummaryRequest): Observable<{ records: AttendanceRecord[] }>;
}
