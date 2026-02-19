export type Role = 'Employee' | 'HR';
export type LeaveType = 'EL' | 'CL' | 'SL' | 'LOP';
export type LeaveStatus =
  | 'Draft'
  | 'Submitted'
  | 'HR_Approved'
  | 'HR_Rejected'
  | 'Cancelled'
  | 'AutoProcessed';

export type AttendanceStatus = 'Present' | 'Absent' | 'OnLeave';

export interface Employee {
  id: string;
  employee_id?: string;
  name: string;
  email: string;
  role: string;
  teamId?: string;
  teamLeadId?: string;
  joiningDate?: string;
  status: 'Active' | 'Inactive';
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  EL_allocated: number;
  EL_used: number;
  EL_available: number;
  CL_allocated: number;
  CL_used: number;
  CL_available: number;
  SL_allocated: number;
  SL_used: number;
  SL_available: number;
  lastRecalculatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  appliedAt: string;
  status: LeaveStatus;
  hrApproverId?: string;
  hrActionAt?: string;
  hrRemarks?: string;
  cancelledById?: string;
}

export interface LeaveApprovalLog {
  id: string;
  requestId: string;
  action: 'Submitted' | 'Approved' | 'Rejected' | 'SendBack' | 'Cancelled' | 'Edited' | 'AutoDeduct';
  actionBy: string;
  actionAt: string;
  remarks?: string;
  previousStatus: LeaveStatus;
  newStatus: LeaveStatus;
}

export interface Holiday {
  id: string;
  date: string;
  title: string;
  type: 'Government';
  region?: string;
  isActive: boolean;
}

export interface NotificationItem {
  id: string;
  type: 'HolidayReminder' | 'LeaveStatusUpdate';
  targetUserId: string;
  messageTitle: string;
  messageBody: string;
  scheduledAt: string;
  sentAt?: string;
  status: 'Pending' | 'Sent' | 'Failed';
  channel: 'Popup' | 'Email';
  read?: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  linkedLeaveRequestId?: string;
  updatedBy: string;
  updatedAt: string;
  deductionLogId?: string;
}

export interface AuditLogEntry {
  _id: string;
  entity: 'Client' | 'Task' | 'Leave';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'SOFT_DELETE' | 'APPLY' | 'APPROVE' | 'REJECT' | 'CANCEL';
  changes: {
    before?: any;
    after?: any;
    diff?: any;
  };
  actor: string;
  createdAt: string;
}
