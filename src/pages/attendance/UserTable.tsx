import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, ChevronDownIcon, Search } from "lucide-react";
import React from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { CustomDatePicker } from "@/components/Daypicker/CustomDatePicker";
import { DateRange, Preset } from "@/types/attendanceTypes";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";

import {
  endOfDay,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

import {
  parseTimeToMinutes,
  squash,
  toLowerSafe,
} from "@/helpers/attendanceDateHelper";
import { SortState, AttendanceRecord } from "@/types/attendanceTypes";
import { useToast } from "@/toast/ToastProvider";
import { api } from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";

// --- helpers for OT status ---
const parseOtToMinutes = (ot: unknown): number => {
  if (ot == null) return 0;

  if (typeof ot === "number") {
    // if small it's likely hours; if big it's likely minutes
    return ot > 24 ? Math.round(ot) : Math.round(ot * 60);
  }

  const s = String(ot).trim().toLowerCase();
  if (!s) return 0;
  if (["0", "0:00", "0h", "0hr", "0hrs", "0m", "0min", "0mins"].includes(s))
    return 0;

  // HH:mm
  const hhmm = /^(\d+):([0-5]?\d)$/.exec(s);
  if (hhmm) {
    const h = parseInt(hhmm[1], 10);
    const m = parseInt(hhmm[2], 10);
    return h * 60 + m;
  }

  // 2h 15m / 2h / 45m
  let total = 0;
  let matched = false;
  const hMatch = /(\d+(?:\.\d+)?)\s*h/.exec(s);
  if (hMatch) {
    total += Math.round(parseFloat(hMatch[1]) * 60);
    matched = true;
  }
  const mMatch = /(\d+)\s*m/.exec(s);
  if (mMatch) {
    total += parseInt(mMatch[1], 10);
    matched = true;
  }
  if (matched) return total;

  // plain number string -> hours (decimal) unless huge (assume minutes)
  const f = parseFloat(s);
  if (!isNaN(f)) return f > 24 ? Math.round(f) : Math.round(f * 60);

  return 0;
};

const normalizeOtStatus = (
  raw: unknown,
  hasOT: boolean
): "N/A" | "Pending" | "Approved" | "Rejected" => {
  if (!hasOT) return "N/A";
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "pending") return "Pending";
  // default when OT exists but status is absent/unknown
  return "Pending";
};

const otBadgeVariant = (
  status: "N/A" | "Pending" | "Approved" | "Rejected"
) => {
  switch (status) {
    case "Approved":
      return "default" as const;
    case "Rejected":
      return "destructive" as const;
    case "Pending":
      return "secondary" as const;
    case "N/A":
    default:
      return "outline" as const;
  }
};

const UserTable: React.FC<any> = ({
  pageSize,
  user,
  attendanceRefresh,
  setMonthlyPresents,
  setMonthlyAbsents,
  setCurrentViewAbsent,
  setcurrentViewPresent,
  setParentLoading,
}) => {
  const [sorting, setSorting] = useState<SortState>(null);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(undefined);
  const [openSingle, setOpenSingle] = useState<boolean>(false);
  const [openRange, setOpenRange] = useState<boolean>(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [query, setQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const toast = useToast();

  const handleGetAttendanceData = async () => {
    setLoading(true);
    setParentLoading?.(true);
    try {
      const response = await api.get(
        `/api/attendance/getAttendanceByEmployee?employeeId=${user?.employee_id}`
      );
      setAttendanceData(response.data.data);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      // toast.error(
      //   "We couldn’t fetch your attendance records at this moment. Please try again shortly.",
      //   {
      //     title: "Attendance fetch failed",
      //     durationMs: 5000,
      //     position: "bottom-left",
      //   }
      // );
      setAttendanceData([]);
    } finally {
      setLoading(false);
      setParentLoading?.(false);
    }
  };

  useEffect(() => {
    handleGetAttendanceData();
  }, [user?.employee_id, attendanceRefresh]);
  const filteredAndSortedData = useMemo(() => {
    let currentData = [...attendanceData];

    if (date) {
      currentData = currentData.filter((item) =>
        isSameDay(parseISO(item.attendanceDate), date)
      );
    }

    if (dateRange && (dateRange.from || dateRange.to)) {
      const start = dateRange.from ? startOfDay(dateRange.from) : undefined;
      const end = dateRange.to ? endOfDay(dateRange.to) : undefined;

      currentData = currentData.filter((item) => {
        const d = parseISO(item.attendanceDate);
        if (start && end) return isWithinInterval(d, { start, end });
        if (start) return isAfter(d, start) || isSameDay(d, start);
        if (end) return isBefore(d, end) || isSameDay(d, end);
        return true;
      });
    }

    if (query.trim()) {
      const q = toLowerSafe(query);
      const qSquash = squash(query);
      const qMins = parseTimeToMinutes(query);

      currentData = currentData.filter((item) => {
        const dateStr = format(
          parseISO(item.attendanceDate),
          "PPPP"
        ).toLowerCase();
        const cin = toLowerSafe(item.clockIn);
        const cout = toLowerSafe(item.clockOut);
        const cinSquash = squash(item.clockIn);
        const coutSquash = squash(item.clockOut);
        const cinMins = parseTimeToMinutes(item.clockIn);
        const coutMins = parseTimeToMinutes(item.clockOut);
        const status = toLowerSafe(item.status);

        const textHit =
          dateStr.includes(q) ||
          status.includes(q) ||
          cin.includes(q) ||
          cout.includes(q) ||
          cinSquash.includes(qSquash) ||
          coutSquash.includes(qSquash);

        const timeHit =
          qMins !== null && (cinMins === qMins || coutMins === qMins);
        return textHit || timeHit;
      });
    }

    if (sorting?.id === "attendanceDate") {
      currentData.sort((a, b) => {
        const A = parseISO(a.attendanceDate).getTime();
        const B = parseISO(b.attendanceDate).getTime();
        return sorting.desc ? B - A : A - B;
      });
    }

    return currentData;
  }, [date, dateRange, query, sorting, attendanceData, attendanceRefresh]);

  // Monthly aggregates
  useEffect(() => {
    const today = new Date();
    const currentMonthData = attendanceData.filter((item) => {
      const itemDate = parseISO(item.attendanceDate);
      return (
        itemDate.getMonth() === today.getMonth() &&
        itemDate.getFullYear() === today.getFullYear()
      );
    });

    setMonthlyPresents(
      currentMonthData.filter((i) => i.status === "Present").length
    );
    setMonthlyAbsents(
      currentMonthData.filter((i) => i.status === "Absent").length
    );
  }, [
    attendanceData,
    attendanceRefresh,
    setMonthlyPresents,
    setMonthlyAbsents,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [date, dateRange, query, sorting]);

  useEffect(() => {
    const presents = filteredAndSortedData.filter(
      (i) => i.status === "Present"
    ).length;
    const absents = filteredAndSortedData.filter(
      (i) => i.status === "Absent"
    ).length;
    setCurrentViewAbsent(absents);
    setcurrentViewPresent(presents);
  }, [filteredAndSortedData, setCurrentViewAbsent, setcurrentViewPresent]);

  const total = filteredAndSortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = filteredAndSortedData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleSort = (columnId: "attendanceDate") => {
    setSorting((prev) => {
      if (prev && prev.id === columnId)
        return { id: columnId, desc: !prev.desc };
      return { id: columnId, desc: true };
    });
  };

  const applyPreset = (preset: Preset) => {
    const now = new Date();
    setActivePreset(preset === "clear" ? null : preset);

    if (preset === "today") {
      setDate(now);
      setDateRange(undefined);
    } else if (preset === "week") {
      setDate(undefined);
      setDateRange({
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      });
    } else if (preset === "month") {
      setDate(undefined);
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    } else {
      setDate(undefined);
      setDateRange(undefined);
    }
  };

  return (
    <>
      <div className="mb-4 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Input
                aria-label="Search attendance"
                placeholder="Search date, status, or time…"
                className="w-[260px] pr-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
            </div>

            {/* Single date */}
            <Popover open={openSingle} onOpenChange={setOpenSingle}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-44 justify-between"
                  aria-label="Pick a date"
                >
                  <span className="truncate">
                    {date ? format(date, "PP") : "Select date"}
                  </span>
                  <ChevronDownIcon className="h-4 w-4 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto overflow-hidden p-0"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={date}
                  captionLayout="dropdown"
                  onSelect={(d?: Date) => {
                    setDate(d);
                    if (d) setDateRange(undefined);
                    setOpenSingle(false);
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Range date */}
            <Popover open={openRange} onOpenChange={setOpenRange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[280px] justify-start text-left"
                  aria-label="Pick a date range"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} –{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span className="text-slate-500">Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CustomDatePicker
                  selected={dateRange}
                  onSelect={(r: DateRange) => {
                    setDateRange(r);
                    if (r?.from || r?.to) setDate(undefined);
                  }}
                  footer={
                    <div className="flex w-full items-center justify-between p-2">
                      <div className="text-xs text-slate-500">
                        Tip: drag to select a range
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setDateRange(undefined)}
                        className="text-sm"
                      >
                        Clear
                      </Button>
                    </div>
                  }
                />
              </PopoverContent>
            </Popover>

            {/* Presets */}
            <Button
              variant={activePreset === "today" ? "outline" : "ghost"}
              size="sm"
              onClick={() => applyPreset("today")}
              className={
                activePreset === "today" ? "!hidden sm:inline-flex" : ""
              }
            >
              Today
            </Button>
            <Button
              variant={activePreset === "week" ? "outline" : "ghost"}
              size="sm"
              onClick={() => applyPreset("week")}
              className={
                activePreset === "week" ? "!hidden sm:inline-flex" : ""
              }
            >
              This week
            </Button>
            <Button
              variant={activePreset === "month" ? "outline" : "ghost"}
              size="sm"
              onClick={() => applyPreset("month")}
              className={
                activePreset === "month" ? "!hidden sm:inline-flex" : ""
              }
            >
              This month
            </Button>
            <Button
              variant={activePreset === null ? "outline" : "ghost"}
              size="sm"
              onClick={() => applyPreset("clear")}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-xl border bg-white shadow-sm"
      >
        <div className="overflow-auto">
          <Table className="min-w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60">
              <TableRow>
                <TableHead className="whitespace-nowrap">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("attendanceDate")}
                  >
                    Date{" "}
                    {sorting?.id === "attendanceDate"
                      ? sorting.desc
                        ? "🔽"
                        : "🔼"
                      : ""}
                  </Button>
                </TableHead>
                <TableHead className="whitespace-nowrap">Clock In</TableHead>
                <TableHead className="whitespace-nowrap">Clock Out</TableHead>
                <TableHead className="whitespace-nowrap">
                  Total Hours Worked
                </TableHead>
                <TableHead className="whitespace-nowrap">OT</TableHead>
                <TableHead className="whitespace-nowrap">OT Status</TableHead>
                <TableHead className="whitespace-nowrap">Late</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : paged.length > 0 ? (
                paged.map((row: any) => {
                  const otMinutes = parseOtToMinutes(row.ot);
                  const hasOT = otMinutes > 0;
                  const effectiveStatus = normalizeOtStatus(
                    row.otStatus,
                    hasOT
                  );
                  const badgeVariant = otBadgeVariant(effectiveStatus);

                  return (
                    <TableRow
                      key={row.id}
                      className="even:bg-slate-50/40 hover:bg-amber-50/60 transition-colors"
                    >
                      <TableCell className="font-medium">
                        {format(parseISO(row.attendanceDate), "PPP")}
                      </TableCell>
                      <TableCell>
                        {row.clockIn === "" ? "—" : row.clockIn}
                      </TableCell>
                      <TableCell>
                        {row.clockOut === "" ? "—" : row.clockOut}
                      </TableCell>
                      <TableCell>
                        {row.worked === "" ? "—" : row.worked}
                      </TableCell>
                      <TableCell>{row.ot ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={badgeVariant}
                          className="uppercase tracking-wide"
                        >
                          {effectiveStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.late ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "Present" ? "default" : "destructive"
                          }
                          className="uppercase tracking-wide"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="w-full">
                  <TableCell
                    colSpan={8}
                    className="h-56 text-center align-middle"
                  >
                    <div className="mx-auto max-w-sm">
                      <div className="mb-2 text-5xl">🗓️</div>
                      <div className="text-lg font-semibold text-slate-900">
                        No results in this view
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Try widening your date range or clearing filters.
                      </div>
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          onClick={() => applyPreset("clear")}
                        >
                          Reset filters
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer / pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t p-3 sm:flex-row">
          <div className="text-xs text-slate-600">
            Showing{" "}
            <span className="font-medium">
              {total === 0 ? 0 : (page - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(page * pageSize, total)}
            </span>{" "}
            of <span className="font-medium">{total}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <div className="text-xs text-slate-600">
              Page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p: number) => Math.min(totalPages, p + 1))
              }
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default UserTable;
