// components/clients/TaskPanel.tsx
import React, { useState } from "react";
import {
  CheckSquare,
  PlusCircle,
  Trash2,
  Edit3,
  CalendarIcon,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  employeeFullName,
  formatMaybe,
  isOverdue,
  taskStatusClass,
} from "../../../../utils/projectUtils.js";

import { Employee, Option, Task } from "@/types/projectTypes";
import { TaskDialog } from "./TaskDialog.js";

// NEW: shadcn Select for the assignee filter
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext.js";

type Mode = "create" | "edit";

interface TaskPanelProps {
  tasks: any;
  employeesById: Map<string, Employee>;
  employees: Employee[];
  employeeOptions: Option[];
  onCreateTask: (projectId: string, payload: Omit<Task, "id">) => void;
  onUpdateTask: (projectId: string, payload: Task) => void;
  onRemoveTask: (projectId: string, taskId: string) => void;
  onToggleChecklistItem: (
    projectId: string,
    taskId: string,
    itemId: string
  ) => void;
  clientId: string;
  clientName?: string;
  isLoading?: boolean;
  // you already declared this in your props interface earlier
  handleGetAllTasks: (
    clientId: string,
    userId?: string | undefined
  ) => Promise<void>;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  tasks,
  employeesById,
  employees,
  employeeOptions,
  onCreateTask,
  onUpdateTask,
  onRemoveTask,
  onToggleChecklistItem,
  clientId,
  clientName,
  isLoading = false,
  handleGetAllTasks,
}) => {
  // Dialog state (create/edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [initial, setInitial] = useState<Task | null>(null);
  const { user } = useAuth();
  // Central delete confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);

  // NEW: Assignee filter state
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "me">("all");

  // TODO: Replace with your real user id from auth context
  const MY_USER_ID = user?.employee_id;

  const openCreate = () => {
    setMode("create");
    setInitial(null);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setMode("edit");
    setInitial(task);
    setDialogOpen(true);
  };

  const requestDelete = (task: Task) => {
    setTaskPendingDelete(task);
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (taskPendingDelete?._id) {
      onRemoveTask(clientId, taskPendingDelete._id);
    }
    setConfirmOpen(false);
    setTaskPendingDelete(null);
  };

  const handleSave = (payload: Omit<Task, "_id"> & { _id?: string }) => {
    if (mode === "create") {
      const { _id: _omit, ...rest } = payload;
      onCreateTask(clientId, rest as any);
    } else {
      onUpdateTask(clientId, payload as Task);
    }
  };

  // NEW: when filter changes, fetch accordingly
  const onChangeAssigneeFilter = async (value: "all" | "me") => {
    setAssigneeFilter(value);
    if (value === "all") {
      await handleGetAllTasks(clientId);
    } else {
      await handleGetAllTasks(clientId, MY_USER_ID);
    }
  };

  return (
    <div className="px-2 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-900 font-medium">
          <CheckSquare className="h-4 w-4" />
          Tasks for {clientName}
        </div>

        <div className="flex items-center gap-2">
          {/* NEW: Assignee filter dropdown */}
          <Select value={assigneeFilter} onValueChange={onChangeAssigneeFilter}>
            <SelectTrigger className="w-44" aria-label="Assignee filter">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="gap-2 !bg-yellow-500 !text-white"
            onClick={openCreate}
          >
            <PlusCircle className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`task-skeleton-${i}`} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : tasks?.length === 0 ? (
        <div className="text-sm text-slate-600">
          No tasks yet. Lean in and create the first one.
        </div>
      ) : (
        <div className="grid gap-3">
          {tasks.map((t: any) => {
            const total = t.checklist.length;
            const done = t.checklist.filter((c: any) => c.done).length;
            const pct = total ? Math.round((done / total) * 100) : 0;

            return (
              <div
                key={t._id || t.id}
                className="rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {t.title}
                    </span>

                    <Badge
                      variant={
                        t.priority === "Critical"
                          ? "destructive"
                          : t.priority === "High"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {t.priority}
                    </Badge>

                    <Badge
                      variant="outline"
                      className={taskStatusClass(t.status)}
                    >
                      {t.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => openEdit(t)}
                    >
                      <Edit3 className="h-4 w-4" /> Edit
                    </Button>

                    <AlertDialog
                      open={confirmOpen}
                      onOpenChange={setConfirmOpen}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => requestDelete(t)}
                          aria-label={`Delete task ${t.title}`}
                        >
                          <Trash2 className="h-4 w-4 text-slate-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete “{taskPendingDelete?.title}”?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This is a destructive operation. Once deleted, this
                            task and its checklist will be permanently removed.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={confirmDelete}
                            className="!bg-red-600 !hover:bg-red-700"
                          >
                            Delete Task
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Meta grid */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <div className="space-y-0.5">
                      <div>
                        <span className="text-slate-500">Start:</span>{" "}
                        {formatMaybe(t.startDate)}
                      </div>
                      <div>
                        <span className="text-slate-500">Due:</span>{" "}
                        {formatMaybe(t.dueDate)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <div>
                      <span className="text-slate-500">Actual:</span>{" "}
                      {formatMaybe(t.actualEndDate)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    <div className="flex flex-wrap gap-1">
                      {t.assigneeEmployeeIds.length === 0 ? (
                        <span className="text-slate-500">Unassigned</span>
                      ) : (
                        t.assigneeEmployeeIds
                          .map((eid: any) => employeesById.get(eid))
                          .filter(Boolean)
                          .map((e: any) => (
                            <Badge
                              key={(e as Employee).employee_id}
                              variant="outline"
                            >
                              {employeeFullName(e as Employee)}
                            </Badge>
                          ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {t.description && (
                  <div className="mt-3 text-sm w-full text-wrap text-slate-700">
                    <span className="font-bold">Description:</span>{" "}
                    {t.description}
                  </div>
                )}

                {/* Status row */}
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-2 w-32" />
                    <span className="text-xs text-slate-600 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  {typeof t.estimatedHours === "number" && (
                    <span className="text-xs text-slate-600">
                      ⏱ {t.estimatedHours}h est.
                    </span>
                  )}
                  <span>
                    {isOverdue(t.dueDate, t.actualEndDate) ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="secondary">On time</Badge>
                    )}
                  </span>
                </div>

                {/* Checklist */}
                {t.checklist.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {t.checklist.map((c: any) => (
                      <label
                        key={c._id || c.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={c.done}
                          onChange={() =>
                            onToggleChecklistItem(
                              clientId as string,
                              t._id,
                              c._id
                            )
                          }
                        />
                        <span
                          className={
                            c.done
                              ? "line-through text-slate-500 w-full text-wrap"
                              : ""
                          }
                        >
                          {c.text}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Dialog (Create/Edit) */}
      <TaskDialog
        mode={mode}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        employees={employees}
        employeeOptions={employeeOptions}
        initial={initial}
      />
    </div>
  );
};
