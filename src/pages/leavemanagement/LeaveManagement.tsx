import { addDays, format, isWeekend, parseISO } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { api } from '@/lib/axios';
import { useAuth } from "@/context/AuthContext";
import { useToast } from '@/toast/ToastProvider';
import {
    AttendanceRecord,
    AttendanceStatus,
    Holiday,
    LeaveApprovalLog,
    LeaveBalance,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    NotificationItem,
} from './types';
import { success } from 'zod';
import { useSidebar } from '@/components/ui/sidebar';

const currentYear = new Date().getFullYear();
const formatDate = (value: Date | string) => (typeof value === 'string' ? value : format(value, 'yyyy-MM-dd'));

const dayCount = (from: string, to: string, holidays: string[]) => {
    const start = parseISO(from);
    const end = parseISO(to);
    if (end < start) return 0;
    let total = 0;
    for (let pointer = new Date(start); pointer <= end; pointer.setDate(pointer.getDate() + 1)) {
        const key = formatDate(pointer);
        if (isWeekend(pointer)) continue;
        if (holidays.includes(key)) continue;
        total += 1;
    }
    return total;
};

const isDateRangeOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
    const A1 = parseISO(aStart);
    const A2 = parseISO(aEnd);
    const B1 = parseISO(bStart);
    const B2 = parseISO(bEnd);
    return A1 <= B2 && B1 <= A2;
};

const LeaveManagement: React.FC = () => {
    // API State
    const showToast = useToast()
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const { user } = useAuth();
    const [userId, setUserId] = useState<string>('');

    // UI State
    const [logs, setLogs] = useState<LeaveApprovalLog[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [page, setPage] = useState<'Employee' | 'HR'>('Employee');
    const [leaveType, setLeaveType] = useState<LeaveType>('EL');
    const [fromDate, setFromDate] = useState(formatDate(new Date()));
    const [toDate, setToDate] = useState(formatDate(new Date()));
    const [reason, setReason] = useState('');
    const [filterStatus, setFilterStatus] = useState<LeaveStatus | ''>('');
    const [holidayForm, setHolidayForm] = useState({ date: formatDate(addDays(new Date(), 1)), title: '', region: 'All' });
    const [showPolicyEditor, setShowPolicyEditor] = useState(false);
    const [showHolidayEditor, setShowHolidayEditor] = useState(false);

    const [leavePolicy, setLeavePolicy] = useState({ EL: 12, CL: 6, SL: 6 });
    const [policyForm, setPolicyForm] = useState(leavePolicy);

    // Guards to prevent accidental double-submit / double-approval
    const [submittingLeave, setSubmittingLeave] = useState(false);
    const [processingActions, setProcessingActions] = useState<Record<string, boolean>>({}); // requestId -> true
    const [isLoading, setIsLoading] = useState(true);

    const startAction = (requestId: string) =>
        setProcessingActions(prev => ({ ...prev, [requestId]: true }));
    const endAction = (requestId: string) =>
        setProcessingActions(prev => ({ ...prev, [requestId]: false }));

    // Initialize userId from auth context
    React.useEffect(() => {
        if (user?.employee_id) {
            setUserId(user.employee_id);
        }
    }, [user]);

    const activeUser = allEmployees.find((emp) => emp.employee_id === userId) || {
        id: userId,
        employee_id: userId,
        name: user?.name || 'User',
        role: user?.role === 'admin' ? 'HR' : 'Employee'
    } as any;

    const holidayKeys = holidays.filter((h) => h.isActive).map((h) => h.date);

    // Initial Data Fetch
    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Always ensure balances & fetch holidays
                await api.post('/api/leave/ensure-balances').catch(err => console.error("Failed to ensure balances", err));
                const holidaysRes = await api.get('/api/leave/holidays').catch(err => console.error("Failed to fetch holidays", err));
                if (holidaysRes?.data) setHolidays(holidaysRes.data);

                // Admin data
                if (user?.role === 'admin') {
                    const [empRes, allBalancesRes, adminRequestsRes] = await Promise.all([
                        api.get('/api/employee/getAllEmployee'),
                        api.get('/api/leave/all-balances'),
                        api.get('/api/leave?status=Submitted')
                    ]);

                    if (empRes?.data) setAllEmployees(empRes.data);
                    if (allBalancesRes?.data) {
                        setBalances(prev => {
                            const existing = new Map(prev.map(b => [b.employeeId, b]));
                            allBalancesRes.data.forEach((b: LeaveBalance) => existing.set(b.employeeId, b));
                            return Array.from(existing.values());
                        });
                    }
                    if (adminRequestsRes?.data) {
                        const data = adminRequestsRes.data;
                        setRequests(prev => {
                            const existingIds = new Set(prev.map(r => r.id));
                            const newReqs = data.filter((r: any) => !existingIds.has(r._id));
                            return [...prev, ...newReqs.map((r: any) => ({ ...r, id: r._id }))];
                        });
                    }
                } else if (user?.employee_id) {
                    setAllEmployees([{
                        id: user.employee_id,
                        employee_id: user.employee_id,
                        name: user.name,
                        role: user.role,
                        email: user.email
                    } as any]);
                }

                // User specific data (if userId is available)
                if (userId) {
                    const [userBalancesRes, userRequestsRes] = await Promise.all([
                        api.get(`/api/leave/balances?employeeId=${encodeURIComponent(userId)}`),
                        api.get(`/api/leave?employeeId=${encodeURIComponent(userId)}`)
                    ]);

                    if (userBalancesRes?.data) {
                        setBalances(prev => {
                            const filtered = prev.filter(p => p.employeeId !== userId);
                            return [...filtered, userBalancesRes.data];
                        });
                    }
                    if (userRequestsRes?.data) {
                        setRequests(userRequestsRes.data.map((r: any) => ({ ...r, id: r._id })));
                    }
                }

            } catch (err) {
                console.error("Failed to load initial data", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) loadData();
    }, [user, userId]);

    const logAction = (entry: LeaveApprovalLog) => setLogs((prev) => [entry, ...prev]);
    const addNotification = (note: Omit<NotificationItem, 'id' | 'scheduledAt'>) =>
        setNotifications((prev) => [...prev, { ...note, id: `note-${Date.now()}`, scheduledAt: new Date().toISOString() }]);

    const refreshData = () => {
        api.get(`/api/leave/balances?employeeId=${encodeURIComponent(userId)}`)
            .then(res => setBalances(prev => prev.map(b => b.employeeId === userId ? res.data : b)));

        api.get(`/api/leave?employeeId=${encodeURIComponent(userId)}`)
            .then(res => setRequests(res.data.map((r: any) => ({ ...r, id: r._id }))));
    };

    const availableBalance = (employeeId: string, type: LeaveType) => {
        const balance = balances.find((item) => item.employeeId === employeeId);
        if (!balance) return 0;
        return type === 'EL'
            ? balance.EL_available
            : type === 'CL'
                ? balance.CL_available
                : balance.SL_available;
    };

    const handleLeaveSubmit = async () => {
        if (!activeUser) return;
        if (submittingLeave) return;

        const start = parseISO(fromDate);
        const end = parseISO(toDate);
        if (end < start) {
            showToast.error('Please select a valid date range (To Date should be >= From Date).', 'error');
            return;
        }

        const days = dayCount(fromDate, toDate, holidayKeys);
        if (days <= 0) {
            showToast.warning('No payable leave days in the selected range (weekends/holidays excluded).', 'warning');
            return;
        }

        // Collision check: block if overlaps any existing leave that is not Cancelled/Rejected
        const userLeaves = requests.filter(r => r.employeeId === userId);
        const blockingStatuses: LeaveStatus[] = ['Submitted', 'HR_Approved', 'AutoProcessed'];
        const hasCollision = userLeaves.some(r => {
            if (!blockingStatuses.includes(r.status)) return false;
            return isDateRangeOverlap(fromDate, toDate, r.startDate, r.endDate);
        });

        if (hasCollision) {
            showToast.error('Leave request overlaps with an existing leave. Please adjust the date range.', 'error');
            return;
        }

        if (days > availableBalance(userId, leaveType)) {
            showToast?.error('Insufficient leave balance for the selected leave type.', 'error');
            return;
        }

        try {
            setSubmittingLeave(true);

            const res = await api.post('/api/leave', {
                employeeId: userId,
                leaveType,
                startDate: fromDate,
                endDate: toDate,
                totalDays: days,
                reason
            });

            if (res.status === 200 || res.status === 201) {
                const newRequest = res.data;
                setRequests((prev) => [{ ...newRequest, id: newRequest._id }, ...prev]);
                setReason('');
                refreshData();

                addNotification({
                    type: 'LeaveStatusUpdate',
                    targetUserId: userId,
                    messageTitle: 'Leave submitted',
                    messageBody: `${leaveType} from ${fromDate} → ${toDate}`,
                    status: 'Pending',
                    channel: 'Popup',
                });

                showToast?.success('Leave request submitted successfully.');
            } else {
                showToast?.error('Failed to submit leave.', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast?.error('Error submitting leave.', 'error');
        } finally {
            setSubmittingLeave(false);
        }
    };

    const handleHrDecision = async (requestId: string, approve: boolean) => {
        if (processingActions[requestId]) return;

        const req = requests.find(r => r.id === requestId);
        if (!req) return;

        // Only action "Submitted" requests; avoids re-approving already actioned rows
        if (req.status !== 'Submitted') {
            showToast?.warning('This request is already actioned.', 'warning');
            return;
        }

        const hrUser = allEmployees.find((emp) => emp.role === 'HR' || emp.role === 'admin');
        const hrApproverId = hrUser?.employee_id ?? hrUser?._id ?? hrUser?.id;

        try {
            startAction(requestId);

            const status = approve ? 'HR_Approved' : 'HR_Rejected';

            // Optimistic lock in UI so double-click doesn't hit API twice
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));

            const res = await api.patch(`/api/leave/${requestId}/status`, {
                status,
                hrApproverId
            });

            if (res.status === 200) {
                const updated = res.data;
                setRequests((prev) =>
                    prev.map((r) =>
                        r.id === requestId
                            ? { ...r, status: updated.status, hrApproverId: updated.hrApproverId }
                            : r
                    )
                );
                refreshData();

                addNotification({
                    type: 'LeaveStatusUpdate',
                    targetUserId: updated.employeeId,
                    messageTitle: `Leave ${approve ? 'approved' : 'rejected'}`,
                    messageBody: `HR ${approve ? 'approved' : 'rejected'} leave request`,
                    status: 'Pending',
                    channel: 'Popup',
                });

                showToast?.success(`Leave ${approve ? 'approved' : 'rejected'} successfully.`);
            } else {
                // rollback if needed
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Submitted' } : r));
                showToast?.error('Action failed. Please try again.');
            }
        } catch (e) {
            console.error(e);
            // rollback if needed
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Submitted' } : r));
            showToast?.error('Error updating leave status.');
        } finally {
            endAction(requestId);
        }
    };

    const handleCancel = async (requestId: string) => {
        if (processingActions[requestId]) return;

        const request = requests.find((req) => req.id === requestId);
        if (!request) return;

        // Avoid cancelling already cancelled
        if (request.status === 'Cancelled') return;

        try {
            startAction(requestId);

            // optimistic UI
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Cancelled' } : r));

            const res = await api.patch(`/api/leave/${requestId}/status`, {
                status: 'Cancelled'
            });

            if (res.status === 200) {
                refreshData();

                addNotification({
                    type: 'LeaveStatusUpdate',
                    targetUserId: request.employeeId,
                    messageTitle: 'Leave cancelled',
                    messageBody: `Leave ${request.startDate} → ${request.endDate} was cancelled`,
                    status: 'Pending',
                    channel: 'Popup',
                });

                showToast.success('Leave cancelled.');
            } else {
                // rollback
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: request.status } : r));
                showToast?.error('Cancel failed. Please try again.', 'error');
            }
        } catch (e) {
            console.error(e);
            // rollback
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: request.status } : r));
            showToast?.error('Error cancelling leave.', 'error');
        } finally {
            endAction(requestId);
        }
    };

    const handleHolidayCreate = () => {
        if (!holidayForm.title || !holidayForm.date) return;
        setHolidays((prev) => [
            ...prev,
            {
                id: `holiday-${Date.now()}`,
                date: holidayForm.date,
                title: holidayForm.title,
                type: 'Government',
                region: holidayForm.region,
                isActive: true,
            },
        ]);
        addNotification({
            type: 'HolidayReminder',
            targetUserId: userId,
            messageTitle: `${holidayForm.title} added`,
            messageBody: `${holidayForm.title} scheduled on ${holidayForm.date}`,
            status: 'Pending',
            channel: 'Popup',
        });
        setShowHolidayEditor(false);
        setHolidayForm((prev) => ({ ...prev, title: '', date: formatDate(addDays(new Date(), 1)) }));
        showToast?.info('Holiday added.');
    };

    const priorities: LeaveType[] = ['CL', 'EL', 'SL'];
    const statusPalette = {
        success: 'bg-emerald-50 text-emerald-700',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-rose-50 text-rose-700',
        info: 'bg-sky-50 text-sky-700',
    };

    const adjustBalance = (employeeId: string, type: LeaveType, amount: number) => {
        setBalances((prev) =>
            prev.map((balance) => {
                if (balance.employeeId !== employeeId) return balance;

                const updated = { ...balance };
                if (type === 'EL') {
                    updated.EL_available = Math.max(0, updated.EL_available - amount);
                    updated.EL_used += amount;
                } else if (type === 'CL') {
                    updated.CL_available = Math.max(0, updated.CL_available - amount);
                    updated.CL_used += amount;
                } else if (type === 'SL') {
                    updated.SL_available = Math.max(0, updated.SL_available - amount);
                    updated.SL_used += amount;
                }
                updated.lastRecalculatedAt = new Date().toISOString();
                return updated;
            }),
        );
    };

    const autoDeduct = (employeeId: string, status: AttendanceStatus) => {
        for (const type of priorities) {
            if (availableBalance(employeeId, type) > 0) {
                adjustBalance(employeeId, type, 1);
                const autoRequest: LeaveRequest = {
                    id: `auto-${employeeId}-${Date.now()}`,
                    employeeId,
                    leaveType: type,
                    startDate: formatDate(new Date()),
                    endDate: formatDate(new Date()),
                    totalDays: 1,
                    reason: `Auto deduction (${status})`,
                    appliedAt: new Date().toISOString(),
                    status: 'AutoProcessed',
                };
                setRequests((prev) => [autoRequest, ...prev]);
                logAction({
                    id: `log-auto-${autoRequest.id}`,
                    requestId: autoRequest.id,
                    action: 'AutoDeduct',
                    actionBy: 'system',
                    actionAt: autoRequest.appliedAt,
                    previousStatus: 'Submitted',
                    newStatus: 'AutoProcessed',
                    remarks: `Auto deduction due to ${status}`,
                });
                return;
            }
        }
        logAction({
            id: `log-auto-lop-${employeeId}`,
            requestId: 'lop',
            action: 'AutoDeduct',
            actionBy: 'system',
            actionAt: new Date().toISOString(),
            previousStatus: 'Submitted',
            newStatus: 'AutoProcessed',
            remarks: 'No balance available, counted as LOP',
        });
    };

    const handleAttendance = (employeeId: string, status: AttendanceStatus) => {
        const record: AttendanceRecord = {
            id: `att-${employeeId}-${Date.now()}`,
            employeeId,
            date: formatDate(new Date()),
            status,
            updatedBy: 'HR Admin',
            updatedAt: new Date().toISOString(),
        };
        setAttendance((prev) => {
            const existingIndex = prev.findIndex((item) => item.employeeId === employeeId && item.date === record.date);
            if (existingIndex > -1) {
                const copy = [...prev];
                copy[existingIndex] = record;
                return copy;
            }
            return [...prev, record];
        });
        if (status !== 'Present') {
            autoDeduct(employeeId, status);
        }
    };

    const filtered = requests.filter((req) => (page === 'Employee' ? req.employeeId === userId : true) && (filterStatus ? req.status === filterStatus : true));
    const hrPending = requests.filter((req) => req.status === 'Submitted');
    const userNotifications = notifications.filter((note) => note.targetUserId === userId && note.status === 'Pending');
    const [showHolidayPanel, setShowHolidayPanel] = useState(true);

    const applyPolicyChanges = () => {
        setLeavePolicy(policyForm);
        setBalances((prev) =>
            prev.map((balance) => {
                const updated = { ...balance };
                updated.EL_allocated = policyForm.EL;
                updated.EL_available = Math.max(0, updated.EL_allocated - updated.EL_used);
                updated.CL_allocated = policyForm.CL;
                updated.CL_available = Math.max(0, updated.CL_allocated - updated.CL_used);
                updated.SL_allocated = policyForm.SL;
                updated.SL_available = Math.max(0, updated.SL_allocated - updated.SL_used);
                updated.lastRecalculatedAt = new Date().toISOString();
                return updated;
            }),
        );
        logAction({
            id: `log-policy-${Date.now()}`,
            requestId: 'policy-update',
            action: 'Edited',
            actionBy: 'HR',
            actionAt: new Date().toISOString(),
            previousStatus: 'HR_Approved',
            newStatus: 'HR_Approved',
            remarks: `Policy updated to EL:${policyForm.EL}, CL:${policyForm.CL}, SL:${policyForm.SL}`,
        });

        allEmployees.forEach((employee) => {
            const targetUserId = employee.employee_id ?? employee._id ?? employee.id;
            addNotification({
                type: 'LeaveStatusUpdate',
                targetUserId,
                messageTitle: 'Policy updated',
                messageBody: `Leave allocations changed to EL:${policyForm.EL}, CL:${policyForm.CL}, SL:${policyForm.SL}`,
                status: 'Pending',
                channel: 'Popup',
            });
        });

        setShowPolicyEditor(false);
        showToast?.success('Leave policy updated.');
    };

    const stats = useMemo(() => {
        const summary: Record<LeaveType, number> = { EL: 0, CL: 0, SL: 0 };
        requests.forEach((req) => {
            if (req.status === 'HR_Approved' || req.status === 'AutoProcessed') {
                summary[req.leaveType] += req.totalDays;
            }
        });
        return summary;
    }, [requests]);

    const analyticsByEmployeeCorrected = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const record: Record<
            string,
            {
                employee: any;
                monthly: Record<LeaveType, number>;
                yearly: Record<LeaveType, number>;
            }
        > = {};

        allEmployees.forEach((emp) => {
            if (emp.employee_id) {
                record[emp.employee_id] = {
                    employee: emp,
                    monthly: { EL: 0, CL: 0, SL: 0 },
                    yearly: { EL: 0, CL: 0, SL: 0 },
                };
            }
        });

        balances.forEach(b => {
            if (record[b.employeeId]) {
                record[b.employeeId].yearly.EL = b.EL_available;
                record[b.employeeId].yearly.CL = b.CL_available;
                record[b.employeeId].yearly.SL = b.SL_available;
            }
        });

        requests.forEach((req) => {
            if (req.status !== 'HR_Approved' && req.status !== 'AutoProcessed') return;
            const start = parseISO(req.startDate);
            const month = start.getMonth();
            const year = start.getFullYear();
            const target = record[req.employeeId];
            if (!target) return;

            if (year === currentYear && month === currentMonth) {
                target.monthly[req.leaveType] += req.totalDays;
            }
        });

        return Object.values(record);
    }, [requests, allEmployees, balances]);

    const [showNotifications, setShowNotifications] = useState(false);
    const { state } = useSidebar();

    // Tab Styles
    const tabBase = "!px-4 !py-2 !rounded-full !text-sm !font-semibold !transition-all";
    const tabActive = "!bg-[#0f172a] !text-white !shadow";
    const tabInactive = "!bg-transparent !text-[#475569] !hover:bg-white/70";

    // Button Styles
    const btnBase = "!inline-flex !items-center !justify-center !rounded-full !text-xs !font-semibold !px-3 !py-2 !transition-all !disabled:opacity-60 !disabled:cursor-not-allowed";

    const btnOutline = "!border !border-[#cbd5e1] !text-[#334155] !hover:bg-[#f8fafc]";
    const btnApprove = "!bg-[#059669] !text-white !hover:bg-[#047857]";
    const btnReject = "!bg-[#e11d48] !text-white !hover:bg-[#be123c]";

    return (
        <div className={`flex flex-col ${state == "expanded" ? "lg:w-[90%]" : "lg:w-full"} w-full max-w-none min-w-0 px-4 lg:px-8 py-6 space-y-4 lg:space-y-8`}>
            <div className="space-y-6">

                {/* Top Bar */}
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Leave Management</h3>
                        <p className="text-lg text-slate-600">Manage your leaves and holidays efficiently</p>
                    </div>

                    {/* Modern Tabs - Restricted to Admin */}
                    {user?.role === 'admin' && (
                        <div className="bg-slate-100 p-1 rounded-full flex gap-1">
                            <button
                                className={`${tabBase} ${page === 'Employee' ? tabActive : tabInactive}`}
                                onClick={() => setPage('Employee')}
                            >
                                My Leaves
                            </button>

                            <button
                                className={`${tabBase} ${page === 'HR' ? tabActive : tabInactive}`}
                                onClick={() => setPage('HR')}
                            >
                                HR Dashboard
                            </button>
                        </div>
                    )}
                </div>

                {page === 'Employee' ? (
                    isLoading ? (
                        <div className="space-y-6 animate-pulse">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="h-6 w-32 bg-slate-200 rounded mb-2"></div>
                                    <div className="h-4 w-48 bg-slate-200 rounded"></div>
                                </div>
                                <div className="h-8 w-24 bg-slate-200 rounded-full"></div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                <div className="space-y-4">
                                    <section className="grid gap-4 sm:grid-cols-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>
                                        ))}
                                    </section>
                                    <div className="h-96 bg-slate-200 rounded-2xl"></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-64 bg-slate-200 rounded-2xl"></div>
                                </div>
                            </div>
                            <div className="h-48 bg-slate-200 rounded-2xl"></div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-end">
                                <button
                                    className={`${btnBase} ${btnOutline}`}
                                    onClick={() => setShowHolidayPanel((prev) => !prev)}
                                >
                                    {showHolidayPanel ? 'Hide holidays' : 'Show holidays'}
                                </button>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                <div className="space-y-4">
                                    <section className="grid gap-4 sm:grid-cols-3">
                                        {(['EL', 'CL', 'SL'] as LeaveType[]).map((type) => (
                                            <article key={type} className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-xl p-5 shadow">
                                                <p className="text-xs uppercase">
                                                    {type === 'EL' ? 'Earned' : type === 'CL' ? 'Casual' : 'Sick'}
                                                </p>
                                                <p className="text-3xl font-semibold">{availableBalance(userId, type)} days</p>
                                                <p className="text-xs mt-1">Available</p>
                                            </article>
                                        ))}
                                    </section>

                                    <section className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
                                        <div>
                                            {/* <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Apply leave</p>
                                        <h2 className="text-lg font-semibold">Submit a request</h2> */}
                                            <h2 className="text-lg font-bold text-slate-900">Apply leave</h2>
                                            <p className="text-sm text-slate-500">Submit a request</p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <select
                                                value={leaveType}
                                                onChange={(event) => setLeaveType(event.target.value as LeaveType)}
                                                className="border rounded-2xl px-3 py-2"
                                            >
                                                <option value="EL">Earned</option>
                                                <option value="CL">Casual</option>
                                                <option value="SL">Sick</option>
                                            </select>

                                            <input
                                                type="date"
                                                value={fromDate}
                                                onChange={(event) => setFromDate(event.target.value)}
                                                className="border rounded-2xl px-3 py-2"
                                            />

                                            <input
                                                type="date"
                                                value={toDate}
                                                onChange={(event) => setToDate(event.target.value)}
                                                className="border rounded-2xl px-3 py-2"
                                            />
                                        </div>

                                        <textarea
                                            className="w-full border rounded-2xl px-3 py-2 min-h-[80px]"
                                            placeholder="Reason"
                                            value={reason}
                                            onChange={(event) => setReason(event.target.value)}
                                        />

                                        <button
                                            className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                            onClick={handleLeaveSubmit}
                                            disabled={submittingLeave}
                                        >
                                            {submittingLeave ? 'Submitting...' : 'Submit leave'}
                                        </button>
                                    </section>
                                </div>

                                <aside className="space-y-3">
                                    {showHolidayPanel ? (
                                        <section className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3 sticky top-6">
                                            <div className="flex items-center justify-between">
                                                {/* <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Holiday calendar</p> */}
                                                <h2 className="text-lg font-bold text-slate-900">Holiday calendar</h2>
                                                {/* <p className="text-sm text-slate-500">Manage your leaves and holidays</p> */}
                                                <span className="text-xs text-slate-400">{holidayKeys.length} active</span>
                                            </div>
                                            <div className="space-y-3">
                                                {holidays.filter((holiday) => holiday.isActive).map((holiday) => (
                                                    <article
                                                        key={holiday.id}
                                                        className="flex justify-between items-center text-sm border border-slate-100 rounded-2xl px-4 py-3"
                                                    >
                                                        <div>
                                                            <p className="font-semibold">{holiday.title}</p>
                                                            <p className="text-xs text-slate-500">{holiday.date}</p>
                                                        </div>
                                                        <span className="text-xs uppercase text-slate-400">{holiday.region ?? 'All'}</span>
                                                    </article>
                                                ))}
                                                {!holidays.filter((holiday) => holiday.isActive).length && (
                                                    <p className="text-sm text-slate-500">No active holidays scheduled yet.</p>
                                                )}
                                            </div>
                                        </section>
                                    ) : (
                                        <section className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3 sticky top-6">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs uppercase text-slate-500">Your focus</p>
                                                <span className="text-xs text-slate-400">{filtered.length} requests</span>
                                            </div>
                                            <div className="space-y-3 text-sm">
                                                <div className={`rounded-2xl px-3 py-2 ${statusPalette.warning}`}>
                                                    <p className="text-[10px] uppercase">Pending</p>
                                                    <p className="font-semibold text-lg">
                                                        {filtered.filter((req) => req.status === 'Submitted').length}
                                                    </p>
                                                </div>
                                                <div className={`rounded-2xl px-3 py-2 ${statusPalette.success}`}>
                                                    <p className="text-[10px] uppercase">Approved days</p>
                                                    <p className="font-semibold text-lg">{stats.EL + stats.CL + stats.SL} days</p>
                                                </div>
                                                <div className={`rounded-2xl px-3 py-2 ${statusPalette.info}`}>
                                                    <p className="text-[10px] uppercase">Upcoming</p>
                                                    {filtered
                                                        .filter((req) => req.status === 'HR_Approved')
                                                        .slice(0, 2)
                                                        .map((req) => (
                                                            <div key={req.id} className="flex items-center justify-between">
                                                                <p>{req.leaveType}</p>
                                                                <span className="text-xs text-slate-400">
                                                                    {req.startDate} → {req.endDate}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    {!filtered.some((req) => req.status === 'HR_Approved') && (
                                                        <p className="text-xs text-slate-500">No upcoming leaves</p>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    )}
                                </aside>
                            </div>

                            <section className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    {/* <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Leave history</p> */}
                                    <h2 className="text-lg font-bold text-slate-900">Leave history</h2>
                                    <select
                                        value={filterStatus}
                                        onChange={(event) => setFilterStatus(event.target.value as LeaveStatus | '')}
                                        className="border rounded-full px-3 py-1 text-xs"
                                    >
                                        <option value="">All statuses</option>
                                        {(['Submitted', 'HR_Approved', 'HR_Rejected', 'Cancelled', 'AutoProcessed'] as LeaveStatus[]).map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    {filtered.length ? (
                                        filtered.map((request) => (
                                            <article key={request.id} className="border border-slate-100 rounded-2xl p-4">
                                                <div className="flex justify-between text-sm">
                                                    <div>
                                                        <p className="font-semibold">{request.leaveType}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {request.startDate} → {request.endDate}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs uppercase">{request.status}</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-2">{request.reason || 'No reason provided'}</p>
                                            </article>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">No requests yet.</p>
                                    )}
                                </div>
                            </section>
                        </>
                    )
                ) : (
                    isLoading ? (
                        <div className="space-y-6 animate-pulse">
                            <section className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-6 w-32 bg-slate-200 rounded"></div>
                                    <div className="h-4 w-24 bg-slate-200 rounded"></div>
                                </div>
                                <div className="space-y-3">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="h-24 bg-slate-200 rounded-2xl"></div>
                                    ))}
                                </div>
                            </section>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="h-64 bg-slate-200 rounded-2xl"></div>
                                <div className="h-64 bg-slate-200 rounded-2xl"></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <section className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    {/* <p className="text-xs uppercase tracking-[0.4em] text-slate-500">HR inbox</p> */}
                                    <h2 className="text-lg font-bold text-slate-900">HR inbox</h2>
                                    <p className="text-sm text-slate-500">{hrPending.length} pending</p>
                                </div>

                                <div className="space-y-3">
                                    {hrPending.length ? (
                                        hrPending.map((request) => {
                                            const busy = !!processingActions[request.id];
                                            const emp = allEmployees.find((e) => e.employee_id == request.employeeId);
                                            const empName = emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : request.employeeId;

                                            return (
                                                <article
                                                    key={request.id}
                                                    className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-gradient-to-tr from-white via-slate-50 to-white shadow-sm"
                                                >
                                                    <div className="flex justify-between gap-4">
                                                        <p className="font-semibold">
                                                            {empName} • {request.leaveType}
                                                        </p>
                                                        <span className="text-xs uppercase text-slate-500">{request.totalDays}d</span>
                                                    </div>

                                                    <p className="text-xs text-slate-500">
                                                        {request.startDate} → {request.endDate}
                                                    </p>

                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            className={`${btnBase} ${btnApprove}`}
                                                            onClick={() => handleHrDecision(request.id, true)}
                                                            disabled={busy}
                                                        >
                                                            {busy ? 'Processing...' : 'Approve'}
                                                        </button>

                                                        <button
                                                            className={`${btnBase} ${btnReject}`}
                                                            onClick={() => handleHrDecision(request.id, false)}
                                                            disabled={busy}
                                                        >
                                                            {busy ? 'Processing...' : 'Reject'}
                                                        </button>

                                                        <button
                                                            className={`${btnBase} ${btnOutline}`}
                                                            onClick={() => handleCancel(request.id)}
                                                            disabled={busy}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-slate-500">No pending leaves.</p>
                                    )}
                                </div>
                            </section>

                            <section className="grid gap-4 lg:grid-cols-2">
                                <article className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        {/* <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Holiday calendar</p> */}
                                        <h2 className="text-lg font-bold text-slate-900">Holiday calendar</h2>
                                        <button
                                            className={`${btnBase} ${btnOutline}`}
                                            onClick={() => setShowHolidayEditor((prev) => !prev)}
                                        >
                                            {showHolidayEditor ? 'Close' : 'New holiday'}
                                        </button>
                                    </div>

                                    <div className="space-y-3 text-sm">
                                        {holidays.map((holiday) => (
                                            <div key={holiday.id} className="flex justify-between items-center rounded-2xl border border-dashed border-slate-100 px-4 py-3">
                                                <div>
                                                    <p className="font-semibold">{holiday.title}</p>
                                                    <p className="text-xs text-slate-500">{holiday.date}</p>
                                                </div>
                                                <label className="flex items-center gap-2 text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={holiday.isActive}
                                                        onChange={() =>
                                                            setHolidays((prev) =>
                                                                prev.map((item) => (item.id === holiday.id ? { ...item, isActive: !item.isActive } : item)),
                                                            )
                                                        }
                                                    />
                                                    {holiday.isActive ? 'Active' : 'Disabled'}
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    {showHolidayEditor && (
                                        <div className="space-y-2 text-sm">
                                            <input
                                                type="text"
                                                className="w-full border rounded-2xl px-3 py-2"
                                                placeholder="Holiday name"
                                                value={holidayForm.title}
                                                onChange={(event) => setHolidayForm((prev) => ({ ...prev, title: event.target.value }))}
                                            />
                                            <input
                                                type="date"
                                                className="w-full border rounded-2xl px-3 py-2"
                                                value={holidayForm.date}
                                                onChange={(event) => setHolidayForm((prev) => ({ ...prev, date: event.target.value }))}
                                            />
                                            <button
                                                className="bg-slate-900 text-white rounded-2xl px-4 py-2 text-xs font-semibold"
                                                onClick={handleHolidayCreate}
                                            >
                                                Save holiday
                                            </button>
                                        </div>
                                    )}
                                </article>

                                <article className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        {/* <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Leave policy</p> */}
                                        <h2 className="text-lg font-bold text-slate-900">Leave policy</h2>
                                        <button
                                            className={`${btnBase} ${btnOutline}`}
                                            onClick={() => setShowPolicyEditor((prev) => !prev)}
                                        >
                                            {showPolicyEditor ? 'Close' : 'Edit policy'}
                                        </button>
                                    </div>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between bg-emerald-50 rounded-2xl px-4 py-3">
                                            <p className="font-semibold">Earned</p>
                                            <span className="text-xs text-emerald-700">EL {leavePolicy.EL} days</span>
                                        </div>
                                        <div className="flex justify-between bg-amber-50 rounded-2xl px-4 py-3">
                                            <p className="font-semibold">Casual</p>
                                            <span className="text-xs text-amber-700">CL {leavePolicy.CL} days</span>
                                        </div>
                                        <div className="flex justify-between bg-rose-50 rounded-2xl px-4 py-3">
                                            <p className="font-semibold">Sick</p>
                                            <span className="text-xs text-rose-700">SL {leavePolicy.SL} days</span>
                                        </div>
                                    </div>

                                    {showPolicyEditor && (
                                        <div className="space-y-3 text-sm">
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <input
                                                    type="number"
                                                    className="w-full border rounded-2xl px-3 py-2"
                                                    value={policyForm.EL}
                                                    onChange={(event) => setPolicyForm((prev) => ({ ...prev, EL: Number(event.target.value) }))}
                                                />
                                                <input
                                                    type="number"
                                                    className="w-full border rounded-2xl px-3 py-2"
                                                    value={policyForm.CL}
                                                    onChange={(event) => setPolicyForm((prev) => ({ ...prev, CL: Number(event.target.value) }))}
                                                />
                                                <input
                                                    type="number"
                                                    className="w-full border rounded-2xl px-3 py-2"
                                                    value={policyForm.SL}
                                                    onChange={(event) => setPolicyForm((prev) => ({ ...prev, SL: Number(event.target.value) }))}
                                                />
                                            </div>

                                            <button
                                                className="bg-slate-900 text-white rounded-2xl px-4 py-2 text-xs font-semibold"
                                                onClick={applyPolicyChanges}
                                            >
                                                Save policy
                                            </button>
                                        </div>
                                    )}
                                </article>
                            </section>

                            <section className="grid gap-4 lg:grid-cols-2">
                                {/* <article className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs uppercase text-slate-500">Analytics</p>
                                        <p className="text-xs text-slate-400">Month vs year per employee</p>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-left text-[10px] text-slate-400">
                                                <tr>
                                                    <th className="pb-2">Employee</th>
                                                    <th className="pb-2 text-center">Month EL</th>
                                                    <th className="pb-2 text-center">Month CL</th>
                                                    <th className="pb-2 text-center">Month SL</th>
                                                    <th className="pb-2 text-center">Balance EL</th>
                                                    <th className="pb-2 text-center">Balance CL</th>
                                                    <th className="pb-2 text-center">Balance SL</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-slate-600">
                                                {analyticsByEmployeeCorrected.map((row) => (
                                                    <tr key={row.employee.id ?? row.employee.employee_id} className="border-t border-slate-100">
                                                        <td className="py-3 font-semibold">{(row.employee.first_name ?? '') + " " + (row.employee.last_name ?? '')}</td>
                                                        <td className="py-3 text-center">{row.monthly.EL}</td>
                                                        <td className="py-3 text-center">{row.monthly.CL}</td>
                                                        <td className="py-3 text-center">{row.monthly.SL}</td>
                                                        <td className="py-3 text-center">{row.yearly.EL}</td>
                                                        <td className="py-3 text-center">{row.yearly.CL}</td>
                                                        <td className="py-3 text-center">{row.yearly.SL}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </article> */}

                                <article className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3">
                                    <p className="text-xs uppercase text-slate-500">Audit log</p>
                                    <div className="space-y-2 text-sm">
                                        {logs.slice(0, 4).map((log) => (
                                            <div key={log.id} className="flex justify-between">
                                                <div>
                                                    <p className="font-semibold">{log.action}</p>
                                                    <p className="text-xs text-slate-500 truncate">{log.remarks}</p>
                                                </div>
                                                <span className="text-xs text-slate-400">{format(new Date(log.actionAt), 'HH:mm')}</span>
                                            </div>
                                        ))}
                                        {!logs.length && <p className="text-xs text-slate-500">No logs yet</p>}
                                    </div>
                                </article>
                            </section>
                        </>
                    ))}
            </div>
        </div>
    );
};

export default LeaveManagement;
