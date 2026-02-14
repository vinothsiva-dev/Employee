// src/pages/Worklogs.tsx
"use client";

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Filter,
  RefreshCw,
  Users,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/toast/ToastProvider";
import { useSidebar } from "@/components/ui/sidebar";

// ---- types aligned with enriched API (no _id, no attendanceId) ----
type WorklogTask = {
  taskName: string;
  customer: string;
  priority: "Low" | "Medium" | "High";
  assignedDate: string; // yyyy-mm-dd
  assignedBy: string;
  estimatedCompletion: string; // yyyy-mm-dd
  remarks?: string;
  status: "On-going" | "Completed" | "Hold" | "Assigned";
  totalHours: number;
};

type Worklog = {
  employeeId: string;
  date: string; // yyyy-mm-dd
  submittedByName: string; // enriched by backend
  tasks: WorklogTask[];
  totalHours: number;
  createdAt: string;
  updatedAt: string;
};

// ---- styling helpers ----
const PRIORITY_BADGE: Record<WorklogTask["priority"], string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_BADGE: Record<WorklogTask["status"], string> = {
  "On-going": "bg-sky-50 text-sky-700 border-sky-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Hold: "bg-zinc-50 text-zinc-700 border-zinc-200",
  Assigned: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function Worklogs() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  // ✅ switch filter from employeeId → submittedByName (URL-synced)
  const [submittedByName, setSubmittedByName] = React.useState(
    params.get("submittedByName") || ""
  );
  const [from, setFrom] = React.useState(params.get("from") || "");
  const [to, setTo] = React.useState(params.get("to") || "");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Worklog[]>([]);
  const [view, setView] = React.useState<"cards" | "table">("cards");

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const q: Record<string, string> = {};
      if (submittedByName.trim()) q.submittedByName = submittedByName.trim();
      if (from) q.from = from;
      if (to) q.to = to;
      const qs = new URLSearchParams(q).toString();

      const res = await api.get(`/api/worklog${qs ? `?${qs}` : ""}`);
      setData(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      console.error("Worklogs fetch failed:", e);
      setError("Unable to fetch worklogs.");
      toast.error("We couldn’t fetch worklogs.");
    } finally {
      setLoading(false);
    }
  }, [submittedByName, from, to, toast]);

  React.useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApply = () => {
    const next = new URLSearchParams();
    if (submittedByName.trim()) next.set("submittedByName", submittedByName.trim());
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    setParams(next, { replace: true });
    fetchData();
  };

  const onReset = () => {
    setSubmittedByName("");
    setFrom("");
    setTo("");
    setParams(new URLSearchParams(), { replace: true });
    fetchData();
  };

  const totalHoursAll = data.reduce((sum, w) => sum + (w.totalHours || 0), 0);
  const { state } = useSidebar();

  return (
    <div
      className={`flex flex-col ${state == "expanded" ? "lg:w-[90%]" : "lg:w-full"
        } w-full min-w-0 h-auto px-4 lg:px-8 py-6 box-border`}
    >
      {/* header rail */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight">Worklogs</p>
          <p className="text-sm text-muted-foreground">
            Operational telemetry: cards for narrative, table for governance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCsv(data)}
            disabled={!data.length}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* filters + kpis */}
      <div className="mb-4 rounded-lg border bg-white">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <div className="w-full md:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Submitted By (name)
            </label>
            <Input
              placeholder="e.g., Jane Doe"
              value={submittedByName}
              onChange={(e) => setSubmittedByName(e.target.value)}
            />
          </div>
          <div className="w-full md:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              From (date)
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-full md:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              To (date)
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex gap-2 md:ml-auto">
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
            <Button onClick={onApply} className="!bg-black !text-white">
              <Filter className="mr-2 h-4 w-4" /> Apply
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Kpi
            icon={<Users className="h-4 w-4" />}
            label="Records"
            value={data.length.toLocaleString()}
          />
          <Kpi
            icon={<Clock className="h-4 w-4" />}
            label="Total Hours"
            value={totalHoursAll.toFixed(2)}
          />
          <Kpi
            icon={<CalendarDays className="h-4 w-4" />}
            label="Date Window"
            value={from || to ? `${from || "…"} → ${to || "…"}` : "All time"}
          />
        </div>
      </div>

      {/* view switcher */}
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as any)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          {loading ? (
            <CardGridSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchData} />
          ) : data.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.map((w, idx) => (
                <WorklogCard key={`${w.employeeId}-${w.date}-${idx}`} w={w} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="table">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchData} />
          ) : data.length === 0 ? (
            <EmptyState />
          ) : (
            <WorklogTable rows={data} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------- Presentational Components ------------------- */

function Kpi(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md border bg-white p-2">{props.icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{props.label}</div>
          <div className="text-base font-semibold">{props.value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorklogCard({ w }: { w: Worklog }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="truncate">Employee Id: {w.employeeId}</span>
          <Badge variant="secondary">{w.date}</Badge>
        </CardTitle>
        <CardDescription className="truncate">
          Submitted by{" "}
          <span className="font-medium">{w.submittedByName || "—"}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Total Hours</div>
          <div className="text-sm font-semibold">
            {Number(w.totalHours).toFixed(2)}
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          {w.tasks.slice(0, 3).map((t, idx) => (
            <div key={idx} className="rounded-md border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="truncate font-medium">{t.taskName}</div>
                <div className="flex shrink-0 gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${PRIORITY_BADGE[t.priority]
                      }`}
                  >
                    {t.priority}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[t.status]
                      }`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {t.customer} · Assigned by {t.assignedBy} · ETA{" "}
                {t.estimatedCompletion}
              </div>
              <div className="mt-1 text-xs">
                Hours: <span className="font-medium">{t.totalHours}</span>
              </div>
              {t.remarks ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                  {t.remarks}
                </p>
              ) : null}
            </div>
          ))}
          {w.tasks.length > 3 && (
            <div className="text-xs text-muted-foreground">
              +{w.tasks.length - 3} more…
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        Updated {new Date(w.updatedAt).toLocaleString()}
      </CardFooter>
    </Card>
  );
}

function WorklogTable({ rows }: { rows: Worklog[] }) {
  return (
    <div className="overflow-auto rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead className="whitespace-nowrap">Employee Id</TableHead>
            <TableHead className="whitespace-nowrap">Submitted By</TableHead>
            <TableHead className="whitespace-nowrap">Task Name</TableHead>
            <TableHead className="whitespace-nowrap">Customer</TableHead>
            <TableHead className="whitespace-nowrap">Priority</TableHead>
            <TableHead className="whitespace-nowrap">Assigned</TableHead>
            <TableHead className="whitespace-nowrap">Assigned By</TableHead>
            <TableHead className="whitespace-nowrap">ETA</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="whitespace-nowrap">Hours</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.flatMap((w, wi) =>
            w.tasks.map((t, ti) => (
              <TableRow key={`${w.employeeId}-${w.date}-${wi}-${ti}`}>
                <TableCell className="whitespace-nowrap">{w.date}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {w.employeeId}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {w.submittedByName || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.taskName}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.customer}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${PRIORITY_BADGE[t.priority]
                      }`}
                  >
                    {t.priority}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.assignedDate}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.assignedBy}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.estimatedCompletion}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[t.status]
                      }`}
                  >
                    {t.status}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.totalHours}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-12">
        <NotebookIcon />
        <div className="text-sm font-medium">No worklogs yet</div>
        <div className="text-xs text-muted-foreground">
          Try expanding your filters or submit a worklog.
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10">
        <div className="text-sm font-medium text-red-600">{message}</div>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Separator />
            {[0, 1, 2].map((k) => (
              <div key={k} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Skeleton className="h-3 w-24" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-white p-4">
      <Skeleton className="h-6 w-40 mb-3" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-48" />
        </div>
      ))}
    </div>
  );
}

function NotebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8 text-muted-foreground"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M6 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm2 4h6v2H8V6Zm0 4h6v2H8v-2Zm0 4h6v2H8v-2Z"
      />
    </svg>
  );
}

// ---- CSV export (one row per task; no internal IDs) ----
function exportCsv(rows: Worklog[]) {
  if (!rows.length) return;
  const flat = rows.flatMap((w) =>
    w.tasks.map((t) => ({
      date: w.date,
      employeeId: w.employeeId,
      submittedBy: w.submittedByName || "",
      taskName: t.taskName,
      customer: t.customer,
      priority: t.priority,
      assignedDate: t.assignedDate,
      assignedBy: t.assignedBy,
      estimatedCompletion: t.estimatedCompletion,
      status: t.status,
      totalHours: t.totalHours,
      remarks: t.remarks || "",
    }))
  );

  const headers = Object.keys(
    flat[0] || { date: "", employeeId: "", submittedBy: "" }
  );
  const csv = [
    headers.join(","),
    ...flat.map((row) =>
      headers
        .map((h) => {
          const val = String((row as any)[h] ?? "");
          return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `worklogs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
