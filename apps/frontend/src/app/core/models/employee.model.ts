export type EmployeeStatus = 'active' | 'inactive' | 'resigned' | 'terminated';

export interface Employee {
  id: string;
  employeeCode: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  position: string | null;
  salary: number;
  startDate: string;
  status: EmployeeStatus;
  department?: { id: string; name: string; code: string };
}

export interface AttendanceEvent {
  employeeId: string;
  scanType: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: number;
  location: string;
}
