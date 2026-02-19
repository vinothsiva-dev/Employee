// src/pages/Dashboard.tsx  (your file, edited)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  FolderOpen,
  TrendingUp,
  CheckCircle2,
  UserCheck,
  Search,
  Inbox,
} from "lucide-react";
import StatsCards from "../components/StatsCards";
import AttendanceOverview from "../components/AttendanceOverview";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/toast/ToastProvider";
import { api } from "@/lib/axios";
import { QuickActionsCard } from "@/widgets/QuickActionsCard"; // ⬅️ new import
import { useSidebar } from "@/components/ui/sidebar";
import { parseISO } from 'date-fns';
import { LeaveBalance, LeaveType } from "@/pages/leavemanagement/types";


export default function Dashboard() {
  const navigate = useNavigate();
  const { user, attendanceRefresh } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setdashboardData] = useState<any>();
  const [requests, setRequests] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [processingActions, setProcessingActions] = useState<Record<string, boolean>>({});
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveType, setLeaveType] = useState<LeaveType>('EL');
  const [searchTerm, setSearchTerm] = useState("");


  const { state } = useSidebar()
  const handleAddEmployee = useCallback(() => {
    navigate("/Employees?AddEmployee");
  }, [navigate]);

  const greetingName = useMemo(
    () => user?.name || user?.displayName || "there",
    [user]
  );

  const handleGetAllDashboardData = async () => {
    try {
      setIsLoading(true);
      const loadingId = toast.info("Fetching Dashboard Data...", {
        durationMs: 1000,
        position: "bottom-left",
        dismissible: true,
      });
      const response = await api.get("/api/employee/getDashboardData");
      if (response?.status === 200) {
        setdashboardData(response?.data);
        toast.remove(loadingId);
        toast.success("Data Fetched Successfully", {
          durationMs: 1000,
          position: "bottom-left",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleFetchAdminData = async () => {
    try {
      const [empRes, pendingRes, approvedRes, balanceRes] = await Promise.all([
        api.get('/api/employee/getAllEmployee'),
        api.get('/api/leave?status=Submitted'),
        api.get('/api/leave?status=HR_Approved'),
        api.get('/api/leave/all-balances')
      ]);

      if (empRes.status === 200) setAllEmployees(empRes.data);
      if (balanceRes.status === 200) {
        setBalances(balanceRes.data);
      }

      const pending = pendingRes.status === 200 ? pendingRes.data : [];
      const approved = approvedRes.status === 200 ? approvedRes.data : [];

      // Merge unique requests (just in case)
      const allRequests = [...pending, ...approved].map((r: any) => ({ ...r, id: r._id }));
      // Deduplicate by id if needed, though status filters should separate them
      const uniqueRequests = Array.from(new Map(allRequests.map(item => [item.id, item])).values());

      setRequests(uniqueRequests);

    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  };

  const handleHrDecision = async (requestId: string, approve: boolean) => {
    if (processingActions[requestId]) return;
    const hrApproverId = user?.employee_id ?? user?._id ?? user?.id;

    try {
      setProcessingActions(prev => ({ ...prev, [requestId]: true }));
      const status = approve ? 'HR_Approved' : 'HR_Rejected';

      // Optimistic UI update
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));

      const res = await api.patch(`/api/leave/${requestId}/status`, {
        status,
        hrApproverId
      });

      if (res.status === 200) {
        toast.success(`Leave ${approve ? 'approved' : 'rejected'} successfully.`);
        // Remove from list after action
        setRequests(prev => prev.filter(r => r.id !== requestId));
      } else {
        // Rollback on failure
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Submitted' } : r));
        toast.error('Action failed. Please try again.');
      }
    } catch (e) {
      console.error(e);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'Submitted' } : r));
      toast.error('Error updating leave status.');
    } finally {
      setProcessingActions(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const hrPending = requests.filter((req) => req.status === 'Submitted');

  const handleCancel = async (requestId: string) => {
    if (processingActions[requestId]) return;
    try {
      setProcessingActions(prev => ({ ...prev, [requestId]: true }));
      const res = await api.patch(`/api/leave/${requestId}/status`, { status: 'Cancelled' });
      if (res.status === 200) {
        toast.success('Leave cancelled.');
        setRequests(prev => prev.filter(r => r.id !== requestId));
      } else {
        toast.error('Cancel failed.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error cancelling leave.');
    } finally {
      setProcessingActions(prev => ({ ...prev, [requestId]: false }));
    }
  };

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
          monthly: { EL: 0, CL: 0, SL: 0, LOP: 0 },
          yearly: { EL: 0, CL: 0, SL: 0, LOP: 0 },
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
        target.monthly[req.leaveType as LeaveType] += req.totalDays;
      }
    });

    return Object.values(record);
  }, [requests, allEmployees, balances]);

  const filteredAnalytics = useMemo(() => {
    return analyticsByEmployeeCorrected.filter((row) => {
      const fullName = `${row.employee.first_name ?? ''} ${row.employee.last_name ?? ''}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase()) ||
        (row.employee.employee_id && row.employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
    });
  }, [analyticsByEmployeeCorrected, searchTerm]);

  useEffect(() => {
    if (user && user.role === "admin") {
      handleGetAllDashboardData();
      handleFetchAdminData();
    }
  }, [attendanceRefresh]);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.warning("You don’t have access to Dashboard.", {
        title: "Access limited",
        durationMs: 3500,
        position: "bottom-left",
      });
      navigate("/Attendance", { replace: true });
    }
  }, [user]);
  console.log(dashboardData?.attendaneState?.todayPresent)
  // Button Styles
  const btnBase = "!inline-flex !items-center !justify-center !rounded-full !text-xs !font-semibold !px-3 !py-2 !transition-all !disabled:opacity-60 !disabled:cursor-not-allowed";

  const btnOutline = "!border !border-[#cbd5e1] !text-[#334155] !hover:bg-[#f8fafc]";
  const btnApprove = "!bg-[#059669] !text-white !hover:bg-[#047857]";
  const btnReject = "!bg-[#e11d48] !text-white !hover:bg-[#be123c]";

  return (
    <div className={`flex flex-col ${state == "expanded" ? "lg:w-[90%]" : "lg:w-full"} w-full min-w-0 h-auto px-4 lg:px-8 py-6 box-border`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2 flex flex-col items-start md:mb-4"
      >
        <p className="text-3xl lg:text-4xl font-bold text-slate-900">
          Welcome back, {greetingName}
        </p>
        <p className="text-lg text-slate-600">
          Here&apos;s what&apos;s happening with your team today
        </p>
      </motion.div>

      {/* KPI Grid → each card now links to its screen */}
      <div
        className="
    grid gap-4 my-4 mb-8
    grid-cols-4
    min-w-0
  "
      >
        <StatsCards
          title="Total Employees"
          value={dashboardData?.totalEmployees?.count}
          change={dashboardData?.totalEmployees?.diff}
          isLoading={isLoading}
          to="Employees"
        />
        <StatsCards
          title="Active Projects"
          value={dashboardData?.activeProjects?.count}
          change={dashboardData?.activeProjects?.diff}
          isLoading={isLoading}
          to="Projects"
        />
        <StatsCards
          title="Current Month Attendance"
          value={dashboardData?.thisMonthAttendance?.count}
          change={dashboardData?.thisMonthAttendance?.diff}
          isLoading={isLoading}
          to="Attendance"
        />
        <StatsCards
          title="Today's Attendance"
          value={dashboardData?.attendaneState?.todayPresent}
          change={dashboardData?.completedTasks?.diff}
          isLoading={isLoading}
          to="Attendance"
        />
        {/* <AttendanceOverview
          isLoading={!!isLoading}
          data={dashboardData?.attendaneState[0]?.value}
        /> */}
      </div>

      <div className="grid lg:grid-cols-1 gap-6 mb-6">
        {/* <div className="lg:col-span-2 space-y-6">
          <AttendanceOverview
            isLoading={!!isLoading}
            data={dashboardData?.attendaneState}
          />
        </div> */}

        <div className="space-y-6">
          {/* Reusable Quick Actions widget */}
          {/* <QuickActionsCard
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Quick Actions
              </span>
            }
            actions={[
              // You can add more actions here; they can navigate or call functions
              {
                label: "Add New Employee",
                icon: Users,
                onClick: handleAddEmployee,
              },
              // { label: "Open Attendance", icon: Clock, to: "/Attendance" },
              // { label: "View Projects", icon: FolderOpen, to: "/Projects" },
            ]}
          /> */}

          {isLoading ? (
            <div className="grid lg:grid-cols-1 gap-2">
              <div className="space-y-6">
                {/* HR Inbox Skeleton */}
                <section className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-6 bg-slate-200 rounded w-24"></div>
                    <div className="h-4 bg-slate-200 rounded w-16"></div>
                  </div>
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <article key={i} className="border border-slate-100 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between gap-4">
                          <div className="h-5 bg-slate-200 rounded w-40"></div>
                          <div className="h-4 bg-slate-200 rounded w-8"></div>
                        </div>
                        <div className="h-3 bg-slate-200 rounded w-32"></div>
                        <div className="flex gap-2 mt-2">
                          <div className="h-8 bg-slate-200 rounded-full w-20"></div>
                          <div className="h-8 bg-slate-200 rounded-full w-20"></div>
                          <div className="h-8 bg-slate-200 rounded-full w-20"></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                {/* Analytics Skeleton */}
                <section className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-slate-200 rounded w-20"></div>
                    <div className="h-4 bg-slate-200 rounded w-32"></div>
                  </div>
                  <div className="space-y-4 mt-4">
                    <div className="flex justify-between">
                      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <div key={j} className="h-3 bg-slate-200 rounded w-12"></div>
                      ))}
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 bg-slate-200 rounded w-full"></div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <>
              {user?.role === "admin" && (
                <div className="grid lg:grid-cols-1 gap-2">
                  <div className="space-y-2">
                    <section className="grid gap-4 lg:grid-cols-2">

                      {/* Analytics */}
                      <article className="bg-white rounded-2xl border border-slate-200 shadow p-5 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs uppercase text-slate-500">Analytics</p>
                            <h3 className="text-lg font-bold text-slate-900">Employee Leave Overview</h3>
                          </div>

                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search employee..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all w-64"
                            />
                          </div>
                        </div>

                        <div className="overflow-x-auto overflow-y-auto max-h-[400px] border border-slate-100 rounded-xl scrollbar-thin scrollbar-thumb-slate-200">
                          <table className="w-full text-sm">
                            <thead className="text-left text-[10px] text-slate-400 sticky top-0 bg-white z-10 shadow-sm">
                              <tr>
                                <th className="p-3 bg-white">Employee</th>
                                <th className="p-3 text-center border-r border-slate-100 bg-white" colSpan={3}>Month</th>
                                <th className="p-3 text-center bg-white" colSpan={3}>Balance</th>
                              </tr>
                              <tr>
                                <th className="pb-2 px-3 bg-white"></th>
                                <th className="pb-2 text-center text-xs bg-white">EL</th>
                                <th className="pb-2 text-center text-xs bg-white">CL</th>
                                <th className="pb-2 text-center text-xs border-r border-slate-100 bg-white">SL</th>
                                <th className="pb-2 text-center text-xs bg-white">EL</th>
                                <th className="pb-2 text-center text-xs bg-white">CL</th>
                                <th className="pb-2 text-center text-xs bg-white">SL</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-600 divide-y divide-slate-50">
                              {filteredAnalytics.length > 0 ? (
                                filteredAnalytics.map((row) => (
                                  <tr key={row.employee.id ?? row.employee.employee_id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3 font-semibold text-xs">{(row.employee.first_name ?? '') + " " + (row.employee.last_name ?? '')}</td>
                                    <td className="p-3 text-center">{row.monthly.EL}</td>
                                    <td className="p-3 text-center">{row.monthly.CL}</td>
                                    <td className="p-3 text-center border-r border-slate-100">{row.monthly.SL}</td>
                                    <td className="p-3 text-center font-medium">{row.yearly.EL}</td>
                                    <td className="p-3 text-center font-medium">{row.yearly.CL}</td>
                                    <td className="p-3 text-center font-medium">{row.yearly.SL}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                    No employees found matching "{searchTerm}"
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </article>

                      {/* HR Inbox */}
                      <div className="space-y-6">
                        <section className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
                          <div className="flex items-center justify-between">
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

                                    {request.reason && (
                                      <p className="text-xs text-slate-600 italic">
                                        "{request.reason}"
                                      </p>
                                    )}

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
                              <div className="flex flex-col items-center justify-center p-6 text-slate-400 text-center">
                                <Inbox className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-base font-medium text-slate-600">No Leave Requests Found</p>
                                <p className="text-xs opacity-60 max-w-[240px]">All caught up!</p>
                              </div>
                            )}
                          </div>
                        </section>
                      </div>


                    </section>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
