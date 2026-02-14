// components/clients/AddClientSheet.tsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import ReactSelect from "react-select";
import { Plus } from "lucide-react";

import { animatedComponents } from "./TaskDialog.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

import { Option, ProjectWithTasks } from "@/types/projectTypes";
import { toISOFromDateInput } from "../../../../utils/projectUtils.js";
import { createClinet } from "@/api/createClient"; // keeping your API name
import { updateClient } from "@/api/updateClient";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/toast/ToastProvider"; // ✅ your in-house toast

type PartialClient = Partial<ProjectWithTasks> & { id?: string | number };

interface AddClientSheetProps {
  employeeOptions: Option[];

  /** If provided, the sheet hydrates and becomes “Edit Client”. */
  client?: any;

  /** Back-compat: still fires on successful CREATE */
  onCreated?: () => void;

  /** New: fires on successful SAVE (create or update) */
  onSaved?: () => void;

  /** Optional custom trigger (e.g., an Edit icon button) */
  trigger?: React.ReactNode;

  /** Optionally control initial open state */
  defaultOpen?: boolean;
}

const toDateInputValue = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // yyyy-mm-dd
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export const AddClient: React.FC<AddClientSheetProps> = ({
  employeeOptions,
  client,
  onCreated,
  onSaved,
  trigger,
  defaultOpen = false,
}) => {
  const isEdit = Boolean(client?._id);
  const { user } = useAuth();
  const toast = useToast();

  const [open, setOpen] = useState(defaultOpen);

  const [name, setName] = useState("");
  const [ownerOpt, setOwnerOpt] = useState<Option | undefined>();
  const [team, setTeam] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<any>("NOT STARTED");
  const [due, setDue] = useState<string>("");

  // touched state gates when errors appear
  const [touched, setTouched] = useState<{ name?: boolean; owner?: boolean }>({});

  const errors = useMemo(() => {
    const e: { name?: string; owner?: string } = {};
    if (!name.trim()) e.name = "Client name is required.";
    if (!ownerOpt?.value) e.owner = "Lead is required.";
    return e;
  }, [name, ownerOpt]);

  const isValid = Object.keys(errors).length === 0;

  const reset = useCallback(() => {
    setName("");
    setOwnerOpt(undefined);
    setTeam("");
    setTags("");
    setStatus("NOT STARTED");
    setDue("");
    setTouched({});
  }, []);

  const hydrateFromClient = useCallback(
    (c: any) => {
      console.log(c.name)
      setName(c.name ? c.name : "");
      // map owner id -> select option
      const opt = c.owner
        ? employeeOptions.find((o) => o.value === c.owner) ?? undefined
        : undefined;
      setOwnerOpt(opt);
      setTeam(c.team ?? "");
      const tagString = Array.isArray(c.tags) ? c.tags.join(", ") : (c as any).tags ?? "";
      setTags(tagString);
      setStatus(c.status ?? "NOT STARTED");
      setDue(toDateInputValue((c as any).dueDate));
      setTouched({});
    },
    [employeeOptions]
  );

  // Re-hydrate on open with a client payload
  useEffect(() => {
    if (open && isEdit && client) {
      hydrateFromClient(client);
    }
    if (open && !isEdit) {
      // create mode: start clean
      reset();
    }
  }, [open, isEdit, client, hydrateFromClient, reset]);

  const buildPayload = (): ProjectWithTasks => {
    return {
      name: name.trim(),
      owner: ownerOpt?.value as string, // required
      team: team.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      // you had progress previously, but it's commented out in the UI; default to 0
      progress: 0,
      status,
      dueDate: toISOFromDateInput(due) ?? new Date().toISOString(),
      tasks: Array.isArray((client as any)?.tasks) ? ((client as any).tasks as any[]) : [],
    };
  };

  const handleSave = async () => {
    if (!isValid) {
      // reveal errors + toast
      setTouched({ name: true, owner: true });
      const missing = [
        !name.trim() ? "Client Name" : null,
        !ownerOpt?.value ? "Lead" : null,
      ]
        .filter(Boolean)
        .join(" and ");
      toast.error(`${missing} ${missing.includes(" and ") ? "are" : "is"} required.`, {
        title: "Missing required fields",
        durationMs: 4000,
        position: "bottom-left",
      });
      return;
    }

    const verb = isEdit ? "Updating" : "Standing up";
    const loadingId = toast.info(`${verb} the client record…`, {
      durationMs: 0,
      position: "bottom-left",
      dismissible: true,
    });

    try {
      const payload = buildPayload();
      let response: any;

      if (isEdit && client?._id != null) {
        /**
         * 🔧 Adjust this call signature to your API:
         * Common patterns:
         *   updateClient(clientId, payload, employeeId)
         *   updateClient(payload, clientId, employeeId)
         *   updateClient({ id: clientId, ...payload }, employeeId)
         */
        response = await updateClient(client._id as string, payload, user?.employee_id);
      } else {
        response = await createClinet(payload, user?.employee_id);
      }

      toast.remove(loadingId);

      if (response?.status === 200 || response?.status === 201) {
        toast.success(
          isEdit ? "Client updated successfully." : "Client created successfully.",
          {
            title: isEdit ? "Refreshed" : "All set",
            durationMs: 2000,
            position: "bottom-left",
          }
        );
        if (!isEdit) onCreated?.();
        onSaved?.();
        if (isEdit) {
          // keep sheet open but clear touched, or close—choose your adventure:
          setOpen(false);
        } else {
          reset();
          setOpen(false);
        }
      } else {
        toast.warning?.("The server responded unexpectedly.", {
          title: `Status ${response?.status ?? "—"}`,
          durationMs: 3000,
          position: "bottom-left",
        });
      }
    } catch (err: any) {
      toast.remove(loadingId);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        (isEdit
          ? "We couldn’t update the client right now."
          : "We couldn’t create the client right now.");
      toast.error(msg, {
        title: isEdit ? "Update failed" : "Create failed",
        durationMs: 4500,
        position: "bottom-left",
      });
    }
  };

  const defaultTrigger = (
    <Button className="gap-2 !bg-black !text-white">
      <Plus className="h-4 w-4" />
      Add Client
    </Button>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <SheetTrigger asChild>{trigger ?? defaultTrigger}</SheetTrigger>

      <SheetContent className="w-full sm:max-w-xl !p-4 !overflow-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Client" : "Create Client"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Right-size the client artifact. Iterate safely; changes are reversible in future sprints."
              : "Spin up a net-new client artifact. You can recalibrate fields post-MVP."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          {/* Client Name (required) */}
          <div className="grid gap-2">
            <Label htmlFor="np-name">
              Client Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              aria-required="true"
              aria-invalid={!!errors.name}
              placeholder="e.g., Acme Corp"
            />
            {touched.name && errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Lead (required) */}
          <div className="grid gap-2">
            <Label htmlFor="np-owner">
              Lead <span className="text-red-500">*</span>
            </Label>
            <ReactSelect
              inputId="np-owner"
              components={animatedComponents}
              placeholder="Select Lead"
              options={employeeOptions}
              value={ownerOpt}
              onChange={(selected: any) => setOwnerOpt(selected ?? undefined)}
              onBlur={() => setTouched((t) => ({ ...t, owner: true }))}
              classNamePrefix="rs"
              aria-invalid={!!errors.owner}
              aria-required="true"
            />
            {touched.owner && errors.owner && (
              <p className="text-xs text-red-500">{errors.owner}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="np-team">Team</Label>
            <Input
              id="np-team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="np-tags">Tags (comma separated)</Label>
            <Input
              id="np-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="api, design, billing"
            />
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT STARTED">Not Started</SelectItem>
                <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* <div className="grid gap-2">
            <Label htmlFor="np-due">Due Date</Label>
            <Input
              id="np-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div> */}
        </div>

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="ghost">Cancel</Button>
          </SheetClose>
          <Button
            onClick={handleSave}
            className="!bg-black !text-white"
            disabled={!isValid}
            aria-disabled={!isValid}
            title={!isValid ? "Fill required fields to proceed" : undefined}
          >
            {isEdit ? "Update Client" : "Create Client"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
