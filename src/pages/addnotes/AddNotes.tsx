// src/pages/AddNotes.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/axios";
import { useToast } from "@/toast/ToastProvider";

// shadcn/ui primitives (adjust paths to your setup)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

import { Search, Pencil, Plus } from "lucide-react";
import "../../styles/notes-html.css"; // bullet/align + 3-line clamp styles

// Dialogs & Tooltips
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useSidebar } from "@/components/ui/sidebar";
import DOMPurify from "dompurify";
import Editor from "@/components/TextEditor/plugins/Editor";

const sanitizeHtml = (html?: string) =>
  html ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : "";

// Basic “is empty” check for HTML content
const isEmptyHtml = (html: string) =>
  !html ||
  !DOMPurify.sanitize(html)
    .replace(/<[^>]+>/g, "")
    .trim();

// ---------- Types (client removed)
export type Note = {
  _id: string;
  noteId: string;
  title: string;
  notes?: string; // server's canonical field
  text?: string; // optional alias in some responses
  createdAt: string; // ISO
  createdByUser?: {
    employee_id?: string;
    first_name?: string;
    last_name?: string;
  };
  createdBy?: {
    id?: string;
    name?: string;
    email?: string;
  };
};

// ---------- Utilities
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "");

// ---------- Page (client-agnostic)
export default function AddNotes() {
  const { user } = useAuth();
  const toast = useToast();
  const { state } = useSidebar();

  // Notes collection
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  // Search (notes)
  const [noteSearch, setNoteSearch] = useState("");
  const [noteSearchDebounced, setNoteSearchDebounced] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Create Note Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Note Dialog state
  const [editing, setEditing] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Per-note expanded state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Per-note overflow (whether content exceeds 3-line clamp)
  const [overflowing, setOverflowing] = useState<Record<string, boolean>>({});
  const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Assign/measure ref for collapsed previews only
  const setPreviewRef =
    (id: string) =>
      (el: HTMLDivElement | null): void => {
        previewRefs.current[id] = el;
        if (!el) return;
        const measure = () => {
          // If clamped: scrollHeight > clientHeight => needs toggle button
          const isOverflow = el.scrollHeight > el.clientHeight + 1;
          setOverflowing((prev) => ({ ...prev, [id]: isOverflow }));
        };
        // measure after layout paint
        requestAnimationFrame(measure);
      };

  // Re-measure on window resize for all collapsed previews
  useEffect(() => {
    const onResize = () => {
      Object.entries(previewRefs.current).forEach(([id, el]) => {
        if (!el) return;
        const isOverflow = el.scrollHeight > el.clientHeight + 1;
        setOverflowing((prev) => ({ ...prev, [id]: isOverflow }));
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // --- Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setNoteSearchDebounced(noteSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [noteSearch]);

  // ---- Fetch Notes (global, no clientId)
  const fetchNotes = async (q = "") => {
    setNotesLoading(true);
    try {
      const res = await api.get(`/api/client/note`, { params: { q } });
      if (res?.status === 200) {
        setNotes(res.data?.items ?? []);
      } else {
        setNotes([]);
        toast.error("Unable to load notes.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Notes service is currently unavailable.");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  // ---- Create Note (Dialog) — no client precondition
  const createNote = async () => {
    if (!newTitle.trim() || isEmptyHtml(newText)) {
      toast.warning("Title and Notes are required.");
      return;
    }

    setCreating(true);
    const loadingId = toast.info("Publishing note…");
    try {
      const res = await api.post(
        `/api/client/note?userId=${user?.employee_id}`,
        {
          title: newTitle.trim(),
          text: newText.trim(),
        }
      );

      if (res?.status === 200 || res?.status === 201) {
        const created: Note | undefined = res.data?.data ?? res.data?.item;
        setNotes((prev) => {
          if (!prev) return created ? [created] : prev;
          return created ? [created, ...prev] : prev;
        });
        setNewTitle("");
        setNewText("");
        setAddOpen(false);
        toast.success("Note created successfully.");
      } else {
        toast.error("Failed to create note.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not create note. Try again later.");
    } finally {
      setCreating(false);
      toast.remove(loadingId);
    }
  };

  // ---- Start Edit (Dialog)
  const startEdit = (note: Note) => {
    setEditing(note);
    setEditTitle(note.title ?? "");
    setEditText(note.notes ?? note.text ?? "");
  };

  // ---- Save Edit (Dialog)
  const saveEdit = async () => {
    if (!editing) return;
    if (!editTitle.trim() || isEmptyHtml(editText)) {
      toast.warning("Title and Notes are required.");
      return;
    }

    setSavingEdit(true);
    const loadingId = toast.info("Updating note…");
    try {
      const res = await api.patch(
        `/api/client/note/${editing._id}?userId=${user?.employee_id}`,
        {
          title: editTitle.trim(),
          text: editText.trim(), // server maps -> notes
        }
      );

      if (res?.status === 200) {
        setNotes((prev) =>
          prev
            ? prev.map((n) =>
              n._id === editing._id
                ? {
                  ...n,
                  title: editTitle.trim(),
                  notes: editText.trim(),
                }
                : n
            )
            : prev
        );
        setEditing(null);
        toast.success("Note updated.");
      } else {
        toast.error("Failed to update note.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not update note.");
    } finally {
      setSavingEdit(false);
      toast.remove(loadingId);
    }
  };

  // ---- Effects
  useEffect(() => {
    fetchNotes(""); // initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchNotes(noteSearchDebounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteSearchDebounced]);

  // ---- Derived (lightweight, future-ready)
  const noteCount = useMemo(() => notes?.length ?? 0, [notes]);

  // ---------- Render
  return (
    <div
      className={`h-full ${state == "expanded" ? "lg:w-[90%]" : "lg:w-full"
        } w-full grid grid-cols-1 gap-4 p-4`}
    >
      {/* Single Pane - Notes */}
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notes</CardTitle>
            <div className="text-xs text-muted-foreground">
              {noteCount} {noteCount === 1 ? "entry" : "entries"}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="flex flex-col gap-4 flex-1">
          {/* Notes Toolbar: Add + Search */}
          <div className="flex flex-col md:flex-row items-end justify-end gap-3">
            <div className="relative">
              <Label htmlFor="note-search" className="sr-only">
                Search notes (title or body)
              </Label>
              <Search
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="note-search"
                placeholder="Filter by title/notes…"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  if (!noteSearch.trim()) setSearchFocused(false);
                }}
                className={[
                  "pl-8",
                  "transition-all duration-300 ease-out",
                  "focus:ring-2 focus:ring-sky-500/40",
                  "shadow-sm",
                  searchFocused || noteSearch.trim()
                    ? "w-[80vw] md:w-[420px]"
                    : "w-[120px] md:w-[10px]",
                ].join(" ")}
                aria-label="Search notes"
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    className="shrink-0 !text-white !bg-black"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create a new note</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Separator className="my-2" />

          {/* Notes List */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              {notesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))}
                </div>
              ) : notes && notes.length > 0 ? (
                <ul className="space-y-4">
                  {notes.map((n) => {
                    const isExpanded = !!expanded[n._id];
                    const showToggle = isExpanded || !!overflowing[n._id];
                    return (
                      <li key={n._id} className="group rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {n.createdByUser?.first_name &&
                              n.createdByUser?.last_name
                              ? `${n.createdByUser.first_name} ${n.createdByUser.last_name}`
                              : n.createdBy?.name || "User"}{" "}
                            • {fmtDate(n.createdAt)}
                          </div>

                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEdit(n)}
                                    aria-label={`Edit ${n.noteId}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {n.noteId ? (
                              <Badge variant="outline">{n.noteId}</Badge>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm">
                          <span className="font-medium">Title:</span> {n.title}
                        </p>

                        {/* bullet/align safe HTML + 3-line clamp when NOT expanded */}

                        <span className="text-sm font-medium">Note:</span>
                        <div
                          data-note-html
                          className={[
                            "mt-2 text-sm prose prose-sm dark:prose-invert max-w-none",
                            isExpanded ? "" : "note-preview",
                          ].join(" ")}
                          ref={!isExpanded ? setPreviewRef(n._id) : undefined}
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(n.notes ?? n.text ?? ""),
                          }}
                        />

                        {/* Toggle only when needed (content > 3 lines) */}
                        {showToggle && (
                          <div className="mt-1">
                            <button
                              type="button"
                              className="opacity-80 group-hover:opacity-100 transition-opacity text-xs text-sky-600 hover:underline"
                              onClick={() => toggleExpanded(n._id)}
                            >
                              {isExpanded ? "Show less" : "Show more"}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No notes yet. Be the first mover and document the intel.
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>

        <Dialog open={addOpen} onOpenChange={(o) => setAddOpen(o)}>


          <DialogContent className="sm:max-w-3xl h-[90vh] max-h-[90vh] flex flex-col">

            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Create Note</DialogTitle>
              <DialogDescription>
                Capture the signal, minimize the noise.
              </DialogDescription>
            </DialogHeader>

            <Separator className="my-2 flex-shrink-0" />

            <div className="mt-4 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 p-2">
              <Label htmlFor="new-title">Title*</Label>
              <Input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={creating}
                placeholder="Add a title…"
              />

              <Label htmlFor="new-notes" className="mt-2">
                Notes*
              </Label>
              <Editor
                value={newText}
                onChange={setNewText}
                disabled={creating}
                placeholder="Add a note…"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex-shrink-0">
              * required fields
            </p>


            <DialogFooter className="mt-4 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  setNewTitle("");
                  setNewText("");
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                className="!text-white !bg-black"
                onClick={createNote}
                disabled={creating}
              >
                {creating ? "Saving…" : "Create Note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Edit Note Dialog */}
        <Dialog
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
        >

          <DialogContent className="sm:max-w-3xl h-[90vh] max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                Edit Note {editing?.noteId ? `(${editing.noteId})` : ""}
              </DialogTitle>
              <DialogDescription>
                Refine the content and ship the update.
              </DialogDescription>
            </DialogHeader>
            <Separator className="my-2 flex-shrink-0" />

            <div className="mt-4 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 p-2">
              <Label htmlFor="edit-title">Title*</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={savingEdit}
              />

              <Label htmlFor="edit-notes" className="mt-2">
                Notes*
              </Label>
              <Editor
                value={editText}
                onChange={setEditText}
                disabled={savingEdit}
                placeholder="Update your note…"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex-shrink-0">
              * required fields
            </p>

            <DialogFooter className="mt-4 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                className="!text-white !bg-black"
                onClick={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
