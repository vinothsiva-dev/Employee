"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/toast/ToastProvider";

const PRIORITIES = ["Low", "Medium", "High"] as const;
const STATUSES = ["On-going", "Completed", "Hold", "Assigned"] as const;

const PriorityEnum = z.enum(PRIORITIES);
const StatusEnum = z.enum(STATUSES);

const TaskRowSchema = z.object({
  taskName: z.string().min(1, "Task Name is required"),
  customer: z.string().min(1, "Customer is required"),
  priority: PriorityEnum,
  assignedDate: z.string().min(1, "Assigned Date is required"),
  assignedBy: z.string().min(1, "Assigned By is required"),
  estimatedCompletion: z.string().min(1, "Estimated Completion is required"),
  remarks: z.string().optional(),
  status: StatusEnum,
  totalHours: z.number().positive("Total Hours Spent must be > 0"),
});

export const FormSchema = z.object({
  tasks: z.array(TaskRowSchema).min(1, "At least one task is required"),
});

export type LogoutWorklogPayload = z.infer<typeof FormSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: LogoutWorklogPayload) => Promise<void> | void;
};

export function LogoutWorklogDialog({ open, onOpenChange, onConfirm }: Props) {
  const toast = useToast();
  const [step, setStep] = React.useState<"form" | "review">("form");
  const [submitting, setSubmitting] = React.useState(false);
  const [expandedRemarks, setExpandedRemarks] = React.useState<Record<number, boolean>>({});

  const toggleRemarkExpansion = (index: number) => {
    setExpandedRemarks(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const form = useForm<LogoutWorklogPayload>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      tasks: [
        {
          taskName: "",
          customer: "",
          priority: "Medium",
          assignedDate: new Date().toISOString().slice(0, 10),
          assignedBy: "",
          estimatedCompletion: new Date().toISOString().slice(0, 10),
          remarks: "",
          status: "On-going",
          totalHours: 1,
        },
      ],
    },
    mode: "onBlur",
  });

  const { control, handleSubmit, formState } = form;
  const { fields, append, remove } = useFieldArray<
    LogoutWorklogPayload,
    "tasks"
  >({
    control,
    name: "tasks",
  });

  const newRow: LogoutWorklogPayload["tasks"][number] = {
    taskName: "",
    customer: "",
    priority: "Medium",
    assignedDate: new Date().toISOString().slice(0, 10),
    assignedBy: "",
    estimatedCompletion: new Date().toISOString().slice(0, 10),
    remarks: "",
    status: "On-going",
    totalHours: 1,
  };

  const goReview = handleSubmit(() => setStep("review"));
  const backToForm = () => setStep("form");

  const finalize = handleSubmit(async (values: LogoutWorklogPayload) => {
    try {
      setSubmitting(true);
      await onConfirm(values);
    } catch (e) {
      console.error("Logout worklog submit failed:", e);
      toast.error("We couldn’t submit your worklog. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });

  React.useEffect(() => {
    if (!open) {
      setStep("form");
      setExpandedRemarks({});
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          p-0 gap-0 !w-screen !h-screen rounded-none
          !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none
          overflow-hidden
        "
      >
        <div className="flex h-full w-full min-h-0 flex-col">

          <DialogHeader
            className="!flex !flex-row !justify-between flex-shrink-0
              sticky top-0 z-20 border-b
              bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60
              px-6 py-4
              pt-[calc(env(safe-area-inset-top)+1rem)]
            "
          >
            <div className="flex flex-col">
              <DialogTitle>Before you logout, log today’s work</DialogTitle>
              <DialogDescription>
                Capture your deliverables to keep the ops engine humming.
              </DialogDescription>
            </div>
            {step === "form" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => append(newRow)}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" /> Add More Task
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {step === "form" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Add at least one task. This fuels downstream reporting and
                    velocity metrics.
                  </p>
                </div>

                <div className="grid gap-4 ">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          Task #{idx + 1}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => fields.length > 1 && remove(idx)}
                          disabled={fields.length === 1}
                          title={
                            fields.length === 1
                              ? "At least one row required"
                              : "Remove row"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Controller
                          control={control}
                          name={`tasks.${idx}.taskName`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Task Name
                              </label>
                              <Input
                                placeholder="e.g., Build Attendance list"
                                {...field}
                              />
                              {formState.errors.tasks?.[idx]?.taskName && (
                                <p className="text-xs text-red-600 mt-1">
                                  {
                                    formState.errors.tasks[idx]?.taskName
                                      ?.message as string
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.customer`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Customer
                              </label>
                              <Input
                                placeholder="Internal / Client name"
                                {...field}
                              />
                              {formState.errors.tasks?.[idx]?.customer && (
                                <p className="text-xs text-red-600 mt-1">
                                  {
                                    formState.errors.tasks[idx]?.customer
                                      ?.message as string
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.priority`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Priority
                              </label>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITIES.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {formState.errors.tasks?.[idx]?.priority && (
                                <p className="text-xs text-red-600 mt-1">
                                  {
                                    formState.errors.tasks[idx]?.priority
                                      ?.message as string
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.assignedDate`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Assigned Date
                              </label>
                              <Input type="date" {...field} />
                              {formState.errors.tasks?.[idx]?.assignedDate && (
                                <p className="text-xs text-red-600 mt-1">
                                  {
                                    formState.errors.tasks[idx]?.assignedDate
                                      ?.message as string
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.assignedBy`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Assigned By
                              </label>
                              <Input placeholder="Manager / Self" {...field} />
                              {formState.errors.tasks?.[idx]?.assignedBy && (
                                <p className="text-xs text-red-600 mt-1">
                                  {
                                    formState.errors.tasks[idx]?.assignedBy
                                      ?.message as string
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.estimatedCompletion`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Estimated Completion
                              </label>
                              <Input type="date" {...field} />
                              {formState.errors.tasks?.[idx]
                                ?.estimatedCompletion && (
                                  <p className="text-xs text-red-600 mt-1">
                                    {
                                      formState.errors.tasks[idx]
                                        ?.estimatedCompletion?.message as string
                                    }
                                  </p>
                                )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.status`}
                          render={({ field }) => (
                            <div>
                              <label className="text-sm font-medium">
                                Status
                              </label>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {formState.errors.tasks?.[idx]?.status && (
                                <p className="text-xs text-red-600 mt-1">
                                  {
                                    formState.errors.tasks[idx]?.status
                                      ?.message as string
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.totalHours`}
                          render={({ field }) => {
                            const safeValue =
                              typeof field.value === "number" ||
                                field.value === ""
                                ? field.value
                                : "";
                            return (
                              <div>
                                <label className="text-sm font-medium">
                                  Total Hours Spent
                                </label>
                                <Input
                                  type="number"
                                  step="0.25"
                                  min={0.25}
                                  name={field.name}
                                  ref={field.ref}
                                  value={safeValue}
                                  onBlur={field.onBlur}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    field.onChange(v === "" ? "" : Number(v));
                                  }}
                                />
                                {formState.errors.tasks?.[idx]?.totalHours && (
                                  <p className="text-xs text-red-600 mt-1">
                                    {
                                      formState.errors.tasks[idx]?.totalHours
                                        ?.message as string
                                    }
                                  </p>
                                )}
                              </div>
                            );
                          }}
                        />

                        <Controller
                          control={control}
                          name={`tasks.${idx}.remarks`}
                          render={({ field }) => (
                            <div className="md:col-span-3">
                              <label className="text-sm font-medium">
                                Remarks
                              </label>
                              <Textarea
                                placeholder="Notes, blockers, links…"
                                {...field}
                              />
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {typeof formState.errors.tasks?.message === "string" && (
                  <p className="text-sm text-red-600">
                    {formState.errors.tasks?.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Quick review before we push this into the system of record:
                </p>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned Date</TableHead>
                        <TableHead>Assigned By</TableHead>
                        <TableHead>Estimated Completion</TableHead>
                        <TableHead className="w-[250px] min-w-[250px]">Remarks</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Hours Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.getValues("tasks").map((t, i) => {
                        const isExpanded = expandedRemarks[i] ?? false;
                        const hasRemarks = !!t.remarks;
                        const displayRemarks = t.remarks || "-";

                        return (
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap">
                              {t.taskName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {t.customer}
                            </TableCell>
                            <TableCell>{t.priority}</TableCell>
                            <TableCell>{t.assignedDate}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {t.assignedBy}
                            </TableCell>
                            <TableCell>{t.estimatedCompletion}</TableCell>

                            <TableCell className="max-w-[250px] p-2 align-top">
                              <div
                                className={`text-sm ${!isExpanded && hasRemarks ? 'overflow-hidden text-ellipsis whitespace-nowrap' : 'whitespace-pre-wrap'
                                  }`}
                              >
                                {displayRemarks}
                              </div>

                              {hasRemarks && displayRemarks.length > 20 && (
                                <button
                                  type="button"
                                  onClick={() => toggleRemarkExpansion(i)}
                                  className="text-xs text-sky-600 hover:underline mt-1 block"
                                >
                                  {isExpanded ? "Show less" : "Show more"}
                                </button>
                              )}
                            </TableCell>

                            <TableCell>{t.status}</TableCell>
                            <TableCell>{t.totalHours ?? ""}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter
            className="flex-shrink-0
              sticky bottom-0 z-20 border-t
              bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60
              px-6 py-4
              pb-[calc(env(safe-area-inset-bottom)+1rem)]
            "
          >
            {step === "form" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button onClick={goReview} className="!bg-black !text-white">
                  Review
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={backToForm}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  className="!bg-black !text-white"
                  onClick={finalize}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit & Logout"}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}