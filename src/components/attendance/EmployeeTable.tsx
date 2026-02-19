import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import axios from "axios";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/toast/ToastProvider";
import { api } from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";

import FiltersBar from "./FiltersBar";
import GroupedAttendanceTable from "./GroupedAttendanceTable";
import BulkMoreSheet from "./BulkMoreSheet";
import OTApprovalDialog from "./OTApprovalDialog";

import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useGroupState } from "@/hooks/useGroupState";

import {
  AttendanceRow,
  Employee,
  Filters,
  OTStatus,
  Option,
} from "@/types/attendanceTypes";

import {
  parseTimeToMinutes, // still used for search
  squash,
  toLowerSafe,
} from "@/helpers/attendanceDateHelper";
import {
  fmtDateTime,
  fmtDay,
  serializeParams,
  toOffsetISOString,
} from "../../../utils/attendanceData";

// ---------------- constants ----------------
const PAGE_SIZE = 50;
const TRIGGER_INDEX_IN_PAGE = 8;

// canonical defaults for filters
const DEFAULT_FILTERS: Filters = {
  selectedEmployeeIds: [],
  singleDate: undefined,
  range: undefined,
  search: "",
  preset: null,
  sort: null,
};

type Props = {
  setMonthlyAbsents: (n: number) => void;
  setMonthlyPresents: (n: number) => void;
  setCurrentViewAbsent: (n: number) => void;
  setcurrentViewPresent: (n: number) => void;
};

const EmployeeTable: React.FC<Props> = ({
  setMonthlyAbsents,
  setMonthlyPresents,
  setCurrentViewAbsent,
  setcurrentViewPresent,
}) => {
  const { attendanceRefresh, user, setAttendanceRefresh } = useAuth();
  const toast = useToast();
  const [dateValue, setDateValue] = useState<Date | null>(null);

  // filters (no page here; paging is internal/infinite)
  const [filters, setFilters] = useState<Filters>({
    selectedEmployeeIds: [],
    singleDate: undefined,
    range: undefined,
    search: "",
    preset: null,
    sort: null,
  });

  // data state
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadedPage, setLoadedPage] = useState(0);
  const [openTasks, setOpenTasks] = useState(false);
  const [allLoading, setAllLoading] = useState(false);

  // search UI draft
  const [searchDraft, setSearchDraft] = useState<string>("");

  // dropdown + employee search in filter
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // bulk sheet
  const [openSheet, setOpenSheet] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Option[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<Option | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // OT dialog
  const [otDialogOpen, setOtDialogOpen] = useState(false);
  const [otDialogRow, setOtDialogRow] = useState<AttendanceRow | null>(null);
  const [otNextStatus, setOtNextStatus] = useState<OTStatus>("Pending");

  // time inputs for "Present"
  const [clockInTime, setClockInTime] = useState<string>("");
  const [clockInMeridiem, setClockInMeridiem] = useState<"AM" | "PM">("AM");
  const [clockOutTime, setClockOutTime] = useState<string>("");
  const [clockOutMeridiem, setClockOutMeridiem] = useState<"AM" | "PM">("PM");

  // ---------- duration utilities (robust for "HH:mm" and "X hr(s) Y min(s)") ----------
  const toTodayFrom12h = (hhmm: string, meridiem: "AM" | "PM"): Date | null => {
    const m = /^(\d{1,2}):([0-5]\d)$/.exec(hhmm.trim());
    if (!m) return null;
    let hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "PM" ? 12 : 0);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  // Parses "8 hrs 17 mins", "8 hr 17 min", "8h 17m", "08:17", "8", "17m"
  const parseDurationToMinutes = (val?: string | null): number => {
    if (!val) return 0;
    const s = String(val).trim().toLowerCase();

    // 1) "HH:mm"
    const mClock = /^(\d{1,2}):([0-5]\d)$/.exec(s);
    if (mClock) {
      const h = parseInt(mClock[1], 10);
      const m = parseInt(mClock[2], 10);
      return h * 60 + m;
    }

    // 2) "xh ym" variants (with/without spaces/plurals)
    const mHrsMins =
      /^(?:(\d+)\s*h(?:r|rs)?)?\s*(?:(\d+)\s*m(?:in|ins)?)?$/.exec(
        s.replace(/\s+/g, " ").trim()
      );
    if (mHrsMins && (mHrsMins[1] || mHrsMins[2])) {
      const h = mHrsMins[1] ? parseInt(mHrsMins[1], 10) : 0;
      const m = mHrsMins[2] ? parseInt(mHrsMins[2], 10) : 0;
      return h * 60 + m;
    }

    // 3) "x hrs y mins" long form
    const mLong = /^(?:(\d+)\s*hour(?:s)?)?(?:\s*(\d+)\s*minute(?:s)?)?$/.exec(
      s
    );
    if (mLong && (mLong[1] || mLong[2])) {
      const h = mLong[1] ? parseInt(mLong[1], 10) : 0;
      const m = mLong[2] ? parseInt(mLong[2], 10) : 0;
      return h * 60 + m;
    }

    // 4) just hours ("8"), just minutes ("17m", "17 min")
    const mJustH = /^(\d+)$/.exec(s);
    if (mJustH) return parseInt(mJustH[1], 10) * 60;

    const mJustM = /^(\d+)\s*m(?:in|ins)?$/.exec(s);
    if (mJustM) return parseInt(mJustM[1], 10);

    return 0;
  };
  const StatusCards = (tasks: any) => {
    const counts = {
      ongoing:
        tasks?.filter((t: any) => t.status?.toLowerCase() === "on-going")
          .length || 0,
      completed:
        tasks?.filter((t: any) => t.status?.toLowerCase() === "completed")
          .length || 0,
      hold:
        tasks?.filter((t: any) => t.status?.toLowerCase() === "hold").length ||
        0,
      assigned:
        tasks?.filter((t: any) => t.status?.toLowerCase() === "assigned")
          .length || 0, // total tasks
    };

    const cards = [
      { label: "On Going", value: counts.ongoing },
      { label: "Completed", value: counts.completed },
      { label: "Hold", value: counts.hold },
      { label: "Assigned", value: counts.assigned },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-4 shadow hover:shadow-md transition flex flex-col items-center"
            style={{
              background:
                c.label == "On Going"
                  ? "#ffa5007d"
                  : c.label == "Completed"
                    ? "#10f05d7d"
                    : c.label == "Hold"
                      ? "#00ffe57d"
                      : "#a610f07d",
              boxShadow:
                "0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p className="text-sm font-bold">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    );
  };
  const minutesToHrsMins = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hPart = h > 0 ? `${h} hr${h === 1 ? "" : "s"}` : "";
    const mPart = m > 0 ? `${m} min${m === 1 ? "" : "s"}` : "";
    if (!hPart && !mPart) return "0 mins";
    return [hPart, mPart].filter(Boolean).join(" ");
  };

  // ---------- select options ----------
  const attendanceStatus: Option[] = [
    { value: "Present", label: "Present" },
    { value: "Absent", label: "Absent" },
    { value: "On Leave", label: "OnLeave" },
    { value: "Permission", label: "Permission" },
  ];

  const employeeSelectOptions: Option[] = useMemo(
    () =>
      employeeOptions.map((emp) => ({
        value: emp.employee_id,
        label: `${emp.first_name} ${emp.last_name}`,
      })),
    [employeeOptions]
  );

  // ---------- debounced search ----------
  const commitSearchDebounced = useDebouncedCallback((next: string) => {
    setFilters((f) => ({ ...f, search: next }));
  }, 3000);

  const handleClearAll = useCallback(() => {
    commitSearchDebounced.cancel();
    setFilters(DEFAULT_FILTERS);
    setSearchDraft("");
    setEmployeeSearch("");
    setDropdownOpen(false);

    toast.info("Cleared filters.", {
      durationMs: 1200,
      position: "bottom-left",
    });
  }, [commitSearchDebounced, toast]);

  useEffect(
    () => () => commitSearchDebounced.cancel(),
    [commitSearchDebounced]
  );
  useEffect(() => setSearchDraft(filters.search || ""), [filters.search]);

  // ---------- bootstrap employees ----------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get<Employee[]>("/api/employee/getAllEmployee");
        if (!active) return;
        setEmployeeOptions(res.data ?? []);
      } catch {
        if (!active) return;
        setEmployeeOptions([]);
        toast.warning(
          "Couldn’t load employees for filtering. Try again later.",
          {
            title: "Filter data unavailable",
            durationMs: 3500,
            position: "bottom-left",
          }
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  // ---------- fetch logic (paged) ----------
  const lastAbortRef = useRef<AbortController | null>(null);

  const fetchAttendancePage = useCallback(
    async (pageToLoad: number, isFirstPage: boolean) => {
      if (!isFirstPage && (!hasMore || loadingMore)) return;

      lastAbortRef.current?.abort();
      const controller = new AbortController();
      lastAbortRef.current = controller;

      if (isFirstPage) setInitialLoading(true);
      else setLoadingMore(true);

      const loaderToastId = isFirstPage
        ? toast.info("Fetching attendance…", {
          durationMs: 0,
          position: "bottom-left",
          dismissible: true,
        })
        : null;

      try {
        const qs = serializeParams({
          employeeIds: filters.selectedEmployeeIds,
          today: filters?.singleDate,
          from: filters.range?.from,
          to: filters.range?.to,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
          search: filters?.search,
        });
        if (isFirstPage) {
          setAllLoading(true);
        }
        console.log("res", qs);
        const res = await api.get(`/api/attendance/getAllAttendance${qs}`, {
          signal: controller.signal,
        });

        console.log("res", res);
        setAllLoading(false);
        const data: AttendanceRow[] = (res.data?.data ?? []).map(
          (r: AttendanceRow) => ({
            ...r,
            otStatus:
              (r.otStatus as OTStatus | null | undefined) ??
              (r.ot ? "Pending" : null),
          })
        );

        setRows((prev) => (isFirstPage ? data : [...prev, ...data]));
        setLoadedPage(pageToLoad);
        setHasMore(res?.data.hasMore);
        setMonthlyAbsents(res?.data?.monthSummary?.absent);
        setMonthlyPresents(res?.data?.monthSummary?.present);

        if (loaderToastId) {
          toast.remove(loaderToastId);
          toast.success("Attendance refreshed.", {
            durationMs: 1500,
            position: "bottom-left",
          });
        }
      } catch (e: any) {
        if (axios.isCancel(e)) {
          if (loaderToastId) toast.remove(loaderToastId);
          return;
        }
        setHasMore(false);
        if (loaderToastId) toast.remove(loaderToastId);
        const status = e?.response?.status;
        if (status === 404) {
          if (isFirstPage) setRows([]);
          toast.info("No records found for the selected view.", {
            durationMs: 2200,
            position: "bottom-left",
          });
        } else {
          const isNetwork =
            e?.code === "ERR_NETWORK" ||
            e?.message?.toLowerCase?.().includes("network");
          toast.error(
            isNetwork
              ? "Network hiccup while loading attendance. Please retry."
              : "We couldn’t load attendance right now.",
            {
              title: "Load failed",
              durationMs: 4000,
              position: "bottom-left",
            }
          );
        }
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [
      filters.selectedEmployeeIds,
      filters.singleDate,
      filters.range?.from,
      filters.range?.to,
      filters.search,
      hasMore,
      loadingMore,
      toast,
      setMonthlyAbsents,
      setMonthlyPresents,
    ]
  );

  // initial + on filter changes → reset and load page 1
  useEffect(() => {
    setHasMore(true);
    setLoadedPage(0);
    fetchAttendancePage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attendanceRefresh,
    filters.selectedEmployeeIds.join(","),
    filters.singleDate?.toString(),
    filters.range?.from?.toString(),
    filters.range?.to?.toString(),
    filters.search,
    filters.sort?.id,
    filters.sort?.desc,
  ]);

  // ---------- local filter + sort (client) ----------
  const filteredAndSorted = useMemo(() => {
    const q = filters.search.trim();
    const qLower = toLowerSafe(q);
    const qSquash = squash(q);
    const qMins = parseTimeToMinutes(q);

    let data = rows;
    if (q) {
      data = data.filter((item) => {
        const dateStr = format(
          parseISO(item.attendanceDate),
          "PPPP"
        ).toLowerCase();
        const cin = toLowerSafe(item.clockIn ?? "");
        const cout = toLowerSafe(item.clockOut ?? "");
        const cinSquash = squash(item.clockIn ?? "");
        const coutSquash = squash(item.clockOut ?? "");
        const cinMins = parseTimeToMinutes(item.clockIn ?? "");
        const coutMins = parseTimeToMinutes(item.clockOut ?? "");
        const status = toLowerSafe(item.status);
        const name = toLowerSafe(item.employeeName ?? "");
        const createdName = toLowerSafe(item.createdBy?.name ?? "");
        const editedName = toLowerSafe(item.editedBy?.name ?? "");

        const textHit =
          dateStr.includes(qLower) ||
          status.includes(qLower) ||
          cin.includes(qLower) ||
          cout.includes(qLower) ||
          cinSquash.includes(qSquash) ||
          coutSquash.includes(qSquash) ||
          name.includes(qLower) ||
          createdName.includes(qLower) ||
          editedName.includes(qLower);

        const timeHit =
          qMins !== null && (cinMins === qMins || coutMins === qMins);
        return textHit || timeHit;
      });
    }

    if (filters.sort?.id === "attendanceDate") {
      const desc = !!filters.sort.desc;
      data = [...data].sort((a, b) => {
        const A = parseISO(a.attendanceDate).getTime();
        const B = parseISO(b.attendanceDate).getTime();
        return desc ? B - A : A - B;
      });
    }
    return data;
  }, [rows, filters.search, filters.sort]);

  // ---------- groups ----------
  const groups = useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();
    for (const r of filteredAndSorted) {
      const key = format(parseISO(r.attendanceDate), "yyyy-MM-dd");
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [filteredAndSorted]);

  // group state + toggle-all
  const { openGroups, toggleGroup, allOpen, toggleAllGroups } =
    useGroupState(groups);

  // ---------- KPIs for parent ----------
  useEffect(() => {
    const presents = filteredAndSorted.filter(
      (i) => i.status === "Present"
    ).length;
    const absents = filteredAndSorted.filter(
      (i) => i.status === "Absent"
    ).length;
    setCurrentViewAbsent(absents);
    setcurrentViewPresent(presents);
  }, [filteredAndSorted, setCurrentViewAbsent, setcurrentViewPresent]);

  // ---------- infinite scroll ----------
  const { attachTriggerRef } = useInfiniteScroll({
    hasMore,
    rowsLength: rows.length,
    loadedPage,
    triggerIndexInPage: TRIGGER_INDEX_IN_PAGE,
    pageSize: PAGE_SIZE,
    onLoadNext: (nextPage) => fetchAttendancePage(nextPage, false),
  });

  // ---------- rollups for export ----------
  const exportRollups = useMemo(() => {
    const totalPresent = filteredAndSorted.filter(
      (r) => r.status === "Present"
    ).length;
    const totalAbsent = filteredAndSorted.filter(
      (r) => r.status === "Absent"
    ).length;

    const totalWorkedMinutes = filteredAndSorted.reduce((acc, r) => {
      return acc + parseDurationToMinutes(r.worked ?? "");
    }, 0);

    const totalOTApprovedMinutes = filteredAndSorted.reduce((acc, r) => {
      if ((r.otStatus ?? "").toLowerCase() === "approved") {
        return acc + parseDurationToMinutes(r.ot ?? "");
      }
      return acc;
    }, 0);

    return {
      totalPresent,
      totalAbsent,
      totalWorkedStr: minutesToHrsMins(totalWorkedMinutes),
      totalOTApprovedStr: minutesToHrsMins(totalOTApprovedMinutes),
    };
  }, [filteredAndSorted]);

  // ---------- export helpers ----------
  const buildExportRows = (data: AttendanceRow[]) =>
    data.map((row) => ({
      Date: fmtDay(row.attendanceDate),
      "Employee Name": row.employeeName ?? "—",
      Department: row.employeeDepartment ?? "—",
      "Clock In": row.clockIn ? row.clockIn : "—",
      "Clock Out": row.clockOut ? row.clockOut : "—",
      "Total Hours Worked": row.worked ?? "—",
      OT: row.ot ?? "—",
      "OT Status": row.otStatus ?? "—",
      Late: row.late ?? "—",
      Status: row.status,
      "Created By": row.createdBy?.name ?? "—",
      "Created On": fmtDateTime(row.createdAt),
      "Edited By": row.editedBy?.name?.trim() ? row.editedBy!.name : "—",
      "Edited On": fmtDateTime(row.editedAt),
    }));

  const buildSummaryRecords = () => [
    { Metric: "Total Present", Value: exportRollups.totalPresent },
    { Metric: "Total Absent", Value: exportRollups.totalAbsent },
    { Metric: "Total Hours Worked", Value: exportRollups.totalWorkedStr },
    {
      Metric: "Total OT Hours (Approved)",
      Value: exportRollups.totalOTApprovedStr,
    },
  ];

  const handleExportExcel = () => {
    if (!filteredAndSorted.length) {
      toast.info("No rows to export for the current view.", {
        title: "Nothing to export",
        durationMs: 2000,
        position: "bottom-left",
      });
      return;
    }
    const loadingId = toast.info("Packaging Excel…", {
      durationMs: 0,
      position: "bottom-left",
      dismissible: true,
    });
    try {
      const data = buildExportRows(filteredAndSorted);
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const summary = buildSummaryRecords();
      const wsSummary = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // Sheet 2: Attendance
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `attendance_${stamp}.xlsx`);

      toast.remove(loadingId);
      toast.success("Excel exported successfully.", {
        durationMs: 1800,
        position: "bottom-left",
      });
    } catch {
      toast.error("We couldn’t export Excel. Please retry.", {
        title: "Export failed",
        durationMs: 3500,
        position: "bottom-left",
      });
    }
  };

  const handleExportCSV = () => {
    if (!filteredAndSorted.length) {
      toast.info("No rows to export for the current view.", {
        title: "Nothing to export",
        durationMs: 2000,
        position: "bottom-left",
      });
      return;
    }
    const loadingId = toast.info("Generating CSV…", {
      durationMs: 0,
      position: "bottom-left",
      dismissible: true,
    });
    try {
      const data = buildExportRows(filteredAndSorted);

      // Build "Summary" section for CSV
      const summary = buildSummaryRecords();
      const wsSummary = XLSX.utils.json_to_sheet(summary);
      const csvSummary = XLSX.utils.sheet_to_csv(wsSummary);

      // Build Attendance section
      const ws = XLSX.utils.json_to_sheet(data);
      const csvAttendance = XLSX.utils.sheet_to_csv(ws);

      // Stitch with a blank line between sections
      const csv = `Summary\n${csvSummary}\nAttendance\n${csvAttendance}`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `attendance_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.remove(loadingId);
      toast.success("CSV exported successfully.", {
        durationMs: 1800,
        position: "bottom-left",
      });
    } catch {
      toast.error("We couldn’t export CSV. Please retry.", {
        title: "Export failed",
        durationMs: 3500,
        position: "bottom-left",
      });
    }
  };

  // ---------- bulk actions (unchanged) ----------
  const addAttendance = async (payload: {
    employeeIds: string[];
    status: string | null;
    reason: string | null;
    date: Date | string | null;
    clockIn?: any;
    clockOut?: any;
  }) => api.post(`/api/attendance/MoreActions/${user?.userId}`, { payload });

  const handleBulkSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployees.length) {
      toast.info("Select at least one employee to proceed.", {
        title: "Nothing to update",
        durationMs: 2500,
        position: "bottom-left",
      });
      return;
    }
    if (!selectedStatus?.value) {
      toast.warning("Pick an attendance status.", {
        title: "Missing status",
        durationMs: 2500,
        position: "bottom-left",
      });
      return;
    }
    if (reason.trim().length > 200) {
      toast.warning("Reason is capped at 200 characters.", {
        title: "Too long",
        durationMs: 2500,
        position: "bottom-left",
      });
      return;
    }

    let clockInISO: string | undefined;
    let clockOutISO: string | undefined;

    if (selectedStatus.value === "Present") {
      const ci = toTodayFrom12h(clockInTime, clockInMeridiem);
      const co = toTodayFrom12h(clockOutTime, clockOutMeridiem);
      if (!ci || !co) {
        toast.warning(
          "Please provide both Clock In and Clock Out in hh:mm + AM/PM.",
          {
            title: "Time required",
            durationMs: 2800,
            position: "bottom-left",
          }
        );
        return;
      }
      if (ci >= co) {
        toast.warning("Clock In must be earlier than Clock Out.", {
          title: "Invalid time range",
          durationMs: 2800,
          position: "bottom-left",
        });
        return;
      }
      clockInISO = toOffsetISOString(ci);
      clockOutISO = toOffsetISOString(co);
    }
    if (!dateValue) {
      toast.warning("Kindly Select The Date", {
        title: "select Date",
        durationMs: 2800,
        position: "bottom-left",
      });
      return;
    }
    setAttendanceRefresh(!attendanceRefresh);
    setSubmitting(true);
    const loadingId = toast.info("Applying attendance updates…", {
      durationMs: 0,
      position: "bottom-left",
      dismissible: true,
    });

    const payload: any = {
      employeeIds: selectedEmployees.map((o) => o.value),
      status: selectedStatus.value,
      reason: reason.trim() || null,
      date: dateValue,
    };
    if (clockInISO && clockOutISO) {
      payload.clockIn = clockInISO;
      payload.clockOut = clockOutISO;
    }

    try {
      await addAttendance(payload);
      toast.remove(loadingId);
      toast.success("Attendance updated successfully.", {
        title: "Done",
        durationMs: 2200,
        position: "bottom-left",
      });
      setAttendanceRefresh(!attendanceRefresh);
      setOpenSheet(false);
      setSelectedEmployees([]);
      setSelectedStatus(null);
      setReason("");
    } catch (err: any) {
      toast.remove(loadingId);
      const isNetwork =
        err?.code === "ERR_NETWORK" ||
        err?.message?.toLowerCase?.().includes("network");
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message;
      toast.error(
        isNetwork
          ? "Network hiccup while saving. Check your connection and retry."
          : apiMsg || "We couldn’t apply those updates. Please try again.",
        {
          title: "Update failed",
          durationMs: 5000,
          position: "bottom-left",
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- OT dialog flows (unchanged) ----------
  const updateOTStatus = async (row: AttendanceRow, next: OTStatus) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, otStatus: next } : r))
    );
    try {
      await api.patch(
        `/api/attendance/editAttendance/${row.id}/ot-status?userId=${user?.userId}`,
        { status: next }
      );
      toast.success(`OT marked as ${next}.`, {
        durationMs: 1500,
        position: "bottom-left",
      });
    } catch (err: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, otStatus: row.otStatus ?? null } : r
        )
      );
      const isNetwork =
        err?.code === "ERR_NETWORK" ||
        err?.message?.toLowerCase?.().includes("network");
      toast.error(
        isNetwork
          ? "Network hiccup while updating OT."
          : "Couldn’t update OT status. Please retry.",
        {
          title: "OT update failed",
          durationMs: 3500,
          position: "bottom-left",
        }
      );
    }
  };

  const openOTDialog = (row: AttendanceRow) => {
    setOtDialogRow(row);
    setOtNextStatus((row.otStatus ?? "Pending") as OTStatus);
    setOtDialogOpen(true);
  };
  const [selectedRow, setSelectedRow] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const buildQueryFromRow = (row: any) => {
    const q: Record<string, string> = {};

    if (row.employeeName) q.submittedByName = row.employeeName.trim();
    if (row.attendanceDate) q.from = row.attendanceDate;

    return new URLSearchParams(q).toString();
  };
  const openTask = async (row: AttendanceRow) => {
    setOpenTasks(true);
    setTaskLoading(true);
    const qs = buildQueryFromRow(row);
    const res = await api.get(`/api/worklog?${qs}`);
    if (res) {
      if (res?.data?.data) {
        setSelectedName(row.employeeName || "");
        let date = format(parseISO(row.attendanceDate), "dd-MM-yyyy");
        setSelectedDate(date || "");
        const orderedData = res?.data?.data[0]?.tasks?.map((task: any) => ({
          taskName: task.taskName,
          customer: task.customer,
          assignedBy: task.assignedBy,
          assignedDate: task.assignedDate,
          status: task.status,
          priority: task.priority,
          totalHours: task.totalHours,
          estimatedCompletion: task.estimatedCompletion,
          remarks: task.remarks,
        }));
        console.log(selectedName, selectedRow, row, "data of the task");
        setSelectedRow(orderedData);
        setTaskLoading(false);
      }
    }
  };

  const confirmOTUpdate = async () => {
    if (!otDialogRow) return;
    await updateOTStatus(otDialogRow, otNextStatus);
    setOtDialogOpen(false);
    setOtDialogRow(null);
  };

  // derived ISO previews for bulk sheet
  const ci =
    selectedStatus?.value === "Present"
      ? toTodayFrom12h(clockInTime, clockInMeridiem)
      : null;
  const co =
    selectedStatus?.value === "Present"
      ? toTodayFrom12h(clockOutTime, clockOutMeridiem)
      : null;
  const clockInISO = ci ? toOffsetISOString(ci) : null;
  const clockOutISO = co ? toOffsetISOString(co) : null;
  console.log(selectedRow, selectedRow?.length, "lengtn");
  return (
    <>
      <FiltersBar
        searchDraft={searchDraft}
        setSearchDraft={setSearchDraft}
        onSearchCommit={commitSearchDebounced}
        filters={filters}
        setFilters={setFilters}
        employeeOptions={employeeOptions}
        employeeSearch={employeeSearch}
        setEmployeeSearch={setEmployeeSearch}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        onOpenMore={() => setOpenSheet(true)}
        onClearAll={handleClearAll}
      />

      <GroupedAttendanceTable
        groups={(() => groups)()}
        openGroups={openGroups}
        toggleGroup={toggleGroup}
        allOpen={allOpen}
        toggleAllGroups={toggleAllGroups}
        attachTriggerRef={attachTriggerRef}
        loadingMore={loadingMore}
        hasMore={hasMore}
        rowsLength={rows.length}
        onOpenOTDialog={openOTDialog}
        onOpenTask={openTask}
        taskLoading={allLoading}
      />

      {/* Bulk More Sheet */}
      <BulkMoreSheet
        open={openSheet}
        onOpenChange={setOpenSheet}
        employeeOptions={employeeSelectOptions}
        selectedEmployees={selectedEmployees}
        setSelectedEmployees={setSelectedEmployees}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        attendanceStatus={attendanceStatus}
        reason={reason}
        setReason={setReason}
        submitting={submitting}
        onSubmit={handleBulkSubmit}
        clockInTime={clockInTime}
        setClockInTime={setClockInTime}
        clockOutTime={clockOutTime}
        setClockOutTime={setClockOutTime}
        clockInMeridiem={clockInMeridiem}
        setClockInMeridiem={setClockInMeridiem}
        clockOutMeridiem={clockOutMeridiem}
        setClockOutMeridiem={setClockOutMeridiem}
        clockInISO={clockInISO}
        clockOutISO={clockOutISO}
        dateValue={dateValue}
        setDateValue={setDateValue}
      />

      {/* OT Approval Dialog */}
      <OTApprovalDialog
        open={otDialogOpen}
        row={otDialogRow}
        value={otNextStatus}
        onValueChange={setOtNextStatus}
        onClose={() => setOtDialogOpen(false)}
        onConfirm={confirmOTUpdate}
      />

      <Dialog open={openTasks} onOpenChange={setOpenTasks}>
        <DialogContent className="" style={{ width: "70vw", maxWidth: "none" }}>
          <DialogHeader>
            <DialogTitle>
              Task Details Of <strong>{selectedName}</strong> On{" "}
              <strong>{selectedDate}</strong>
            </DialogTitle>
            <div
              style={{
                border: "1px solid #e3dcdc",
                marginTop: "0.5rem",
                marginBottom: "0.5rem",
              }}
            ></div>
          </DialogHeader>
          <div>{StatusCards(selectedRow)}</div>
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border bg-white shadow-sm"
          >
            <div className="overflow-x-auto overflow-x-auto max-h-[70vh] max-w-[67vw]">
              <Table className="min-w-max text-sm">
                <TableHeader className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur">
                  <TableRow>
                    <TableHead className="whitespace-nowrap sticky left-0 z-20 bg-slate-50/90">
                      Task Name
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Customer
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Assigned By
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Assigned On
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Priority
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Total Hours
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Estimated Completion
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                {taskLoading && (
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`skeleton-task-${i}`}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
                {!selectedRow && !taskLoading && (
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={9} className="py-6 text-center">
                        <div className="flex justify-center items-center gap-3">
                          <span>No Data Found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                )}
                {selectedRow?.length != 0 && !taskLoading && (
                  <TableBody>
                    {selectedRow?.map((t: any, i: number) => (
                      <TableRow key={i}>
                        {/* Sticky first column */}
                        <TableCell className="sticky left-0 z-20 bg-white">
                          {t.taskName}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.customer}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.assignedBy}
                        </TableCell>
                        <TableCell className="text-center">
                          {format(parseISO(t.assignedDate), "dd-MM-yyyy")}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.status}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.priority}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.totalHours}
                        </TableCell>
                        <TableCell className="text-center">
                          {format(
                            parseISO(t.estimatedCompletion),
                            "dd-MM-yyyy"
                          )}
                        </TableCell>
                        <TableCell className="">{t.remarks || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </Table>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeTable;
