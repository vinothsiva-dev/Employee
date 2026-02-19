// components/attendance/GroupedAttendanceTable.tsx
import React from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, ChevronsUpDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtDay } from "../../../utils/attendanceData";
import { AttendanceRow } from "@/types/attendanceTypes";

// ----- helpers: OT parsing + display status -----
const otMinutesFromString = (raw?: string | null): number => {
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();
  if (!s) return 0;

  // common cases: "HH:MM" (or "H:MM")
  if (s.includes(":")) {
    const [hStr, mStr] = s.split(":");
    const h = Number.parseInt(hStr || "0", 10) || 0;
    const m = Number.parseInt(mStr || "0", 10) || 0;
    return Math.max(0, h * 60 + m);
  }

  // fallback: decimal hours like "1.5", "2", "0"
  const numeric = Number.parseFloat(s.replace(/[^\d.]/g, ""));
  if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric * 60));

  return 0;
};

type DisplayOT = "N/A" | "Pending" | "Approved" | "Rejected";

const normalizeOtStatusDisplay = (
  ot: string | null | undefined,
  rawStatus: string | null | undefined
): { status: DisplayOT; hasPositiveOT: boolean } => {
  const mins = otMinutesFromString(ot);
  const hasPositiveOT = mins > 0;

  if (!hasPositiveOT) return { status: "N/A", hasPositiveOT: false };

  const s = String(rawStatus ?? "")
    .trim()
    .toLowerCase();

  if (s === "approved") return { status: "Approved", hasPositiveOT: true };
  if (s === "rejected") return { status: "Rejected", hasPositiveOT: true };
  // default when OT exists but status empty/unknown
  return { status: "Pending", hasPositiveOT: true };
};

const badgeVariantForOT = (status: DisplayOT) => {
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

// ----- component -----
type Props = {
  groups: Map<string, AttendanceRow[]>;
  openGroups: Record<string, boolean>;
  toggleGroup: (k: string) => void;

  // header toggle-all
  allOpen: boolean;
  toggleAllGroups: () => void;

  // infinite scroll
  attachTriggerRef: (
    flatIndex: number
  ) => (el: HTMLTableRowElement | null) => void;
  loadingMore: boolean;
  hasMore: boolean;
  rowsLength: number; taskLoading: boolean;

  // actions
  onOpenTask: (row: AttendanceRow) => void;
  onOpenOTDialog: (row: AttendanceRow) => void;
};

const GroupedAttendanceTable: React.FC<Props> = ({
  groups,
  openGroups,
  toggleGroup,
  allOpen,
  toggleAllGroups,
  attachTriggerRef,
  loadingMore,
  hasMore,
  rowsLength,
  taskLoading,
  onOpenOTDialog, onOpenTask,
}) => {
  const today = new Date().toISOString().split("T")[0];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border bg-white shadow-sm"
    >
      <div className="overflow-auto ">
        <Table className="min-w-full text-sm">
          <TableHeader className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60">
            <TableRow>
              {/* Sticky Date header with expand/collapse-all */}
              <TableHead className="whitespace-nowrap sticky left-0 z-20 bg-slate-50">
                <button
                  type="button"
                  onClick={toggleAllGroups}
                  className="flex items-center gap-1 hover:text-slate-900 text-slate-700"
                  title={allOpen ? "Collapse all dates" : "Expand all dates"}
                >
                  Date
                  <ChevronsUpDown
                    className={`h-4 w-4 transition-transform ${allOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>
              </TableHead>
              <TableHead className="whitespace-nowrap">Employee Name</TableHead>
              <TableHead className="whitespace-nowrap">Department</TableHead>
              <TableHead className="whitespace-nowrap">Clock In</TableHead>
              <TableHead className="whitespace-nowrap">Clock Out</TableHead>
              <TableHead className="whitespace-nowrap">
                Total Hours Worked
              </TableHead>
              <TableHead className="whitespace-nowrap">OT</TableHead>
              <TableHead className="whitespace-nowrap">OT Status</TableHead>
              <TableHead className="whitespace-nowrap">OT Approval</TableHead>
              <TableHead className="whitespace-nowrap">Late</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Created By</TableHead>
              <TableHead className="whitespace-nowrap">Created On</TableHead>
              <TableHead className="whitespace-nowrap">Edited By</TableHead>
              <TableHead className="whitespace-nowrap">Edited On</TableHead>
              <TableHead className="whitespace-nowrap sticky right-0 bg-white z-10 pr-7"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {taskLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto rounded-full" /></TableCell>
                </TableRow>
              ))
            }
            {!taskLoading && (
              <>
                {Array.from(groups.entries()).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={16}
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
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => {
                    let flatIndex = 0;
                    const nodes: React.ReactNode[] = [];

                    for (const [key, items] of Array.from(groups.entries())) {
                      const dayLabel = format(
                        parseISO(items[0].attendanceDate),
                        "PPP"
                      );
                      const open = !!openGroups[key];

                      // group header
                      nodes.push(
                        <TableRow key={`hdr-${key}`} className="bg-slate-50/70">
                          <TableCell colSpan={16} className="!p-0">
                            <div
                              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-100 cursor-pointer"
                              onClick={() => toggleGroup(key)}
                              role="button"
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""
                                  }`}
                              />
                              <span className="font-semibold">{dayLabel}</span>
                              <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                                {items.length} record{items.length > 1 ? "s" : ""}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );

                      // rows when open
                      if (open) {
                        for (const row of items) {
                          const refCb = attachTriggerRef(flatIndex);
                          flatIndex += 1;

                          const { status: displayOT, hasPositiveOT } =
                            normalizeOtStatusDisplay(row.ot, row.otStatus as any);
                          const badgeVariant = badgeVariantForOT(displayOT);

                          nodes.push(
                            <TableRow
                              key={row.id}
                              ref={refCb}
                              className="even:bg-slate-50/40 hover:bg-amber-50/60 transition-colors"
                            >
                              {/* sticky date cell */}
                              <TableCell className="font-medium sticky left-0 z-10 bg-white">
                                {fmtDay(row.attendanceDate)}
                              </TableCell>
                              <TableCell>{row.employeeName ?? "—"}</TableCell>
                              <TableCell>{row.employeeDepartment ?? "—"}</TableCell>
                              <TableCell>
                                {row.clockIn === "" ? "—" : row.clockIn}
                              </TableCell>
                              <TableCell>
                                {row.clockOut === "" ? "—" : row.clockOut}
                              </TableCell>
                              <TableCell>{row.worked ?? "—"}</TableCell>
                              <TableCell>{row.ot ?? "—"}</TableCell>

                              {/* OT Status (N/A if OT <= 0) */}
                              <TableCell>
                                <Badge
                                  variant={badgeVariant}
                                  className="uppercase tracking-wide"
                                >
                                  {displayOT}
                                </Badge>
                              </TableCell>

                              {/* OT Approval: disabled when OT not positive */}
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onOpenOTDialog(row)}
                                  disabled={!hasPositiveOT}
                                  title={
                                    hasPositiveOT
                                      ? "Review & approve OT"
                                      : "No OT hours to review"
                                  }
                                >
                                  Review
                                </Button>
                              </TableCell>

                              <TableCell>{row.late ?? "—"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    row.status === "Present"
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="uppercase tracking-wide"
                                >
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.createdBy?.name ?? "—"}</TableCell>
                              <TableCell>{fmtDateTime(row.createdAt)}</TableCell>
                              <TableCell>
                                {row.editedBy?.name?.trim()
                                  ? row.editedBy?.name
                                  : "—"}
                              </TableCell>
                              <TableCell>{fmtDateTime(row.editedAt)}</TableCell>
                              <TableCell className="sticky right-0 bg-white z-10 pr-7 text-center">

                                {row.attendanceDate !== today && (
                                  <Eye
                                    className="w-5 h-5 text-gray-600 cursor-pointer inline-block ml-2"
                                    onClick={() => onOpenTask(row)}
                                  />
                                )}
                              </TableCell>

                            </TableRow>
                          );
                        }
                      }
                    }

                    // tail loader / caught-up
                    if (loadingMore && rowsLength > 9 && hasMore) {
                      nodes.push(
                        <TableRow key="loading-more">
                          <TableCell
                            colSpan={16}
                            className="py-4 text-center text-slate-500"
                          >
                            Loading more…
                          </TableCell>
                        </TableRow>
                      );
                    }
                    if (!hasMore && rowsLength >= 10) {
                      nodes.push(
                        <TableRow key="caught-up">
                          <TableCell
                            colSpan={16}
                            className="py-4 text-center text-slate-400"
                          >
                            You’re all caught up.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return nodes;
                  })()
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default GroupedAttendanceTable;
