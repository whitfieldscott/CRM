"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type { Contact, CSVImportSummary } from "@/types/api";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, Plus, Upload, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const LICENSE_OPTIONS = ["all", "grower", "dispensary", "processor"] as const;

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [licenseType, setLicenseType] =
    useState<(typeof LICENSE_OPTIONS)[number]>("all");
  const [tags, setTags] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const [selected, setSelected] = useState<Contact | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const [editForm, setEditForm] = useState<Partial<Contact>>({});

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  }

  function csvEscape(val: string): string {
    if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
    return val;
  }

  function exportContactsCsv() {
    const headers = [
      "Name",
      "Company",
      "Email",
      "Phone",
      "License #",
      "License type",
      "City",
      "State",
      "Tags",
      "Active",
    ];
    const lines = [headers.join(",")];
    for (const c of contacts) {
      lines.push(
        [
          csvEscape(c.name ?? ""),
          csvEscape(c.company ?? ""),
          csvEscape(c.email),
          csvEscape(c.phone ?? ""),
          csvEscape(c.license_number ?? ""),
          csvEscape(c.license_type ?? ""),
          csvEscape(c.city ?? ""),
          csvEscape(c.state ?? ""),
          csvEscape(c.tags ?? ""),
          c.is_active ? "yes" : "no",
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded.");
  }

  function exportContactsPdf() {
    const rows = contacts
      .map(
        (c) =>
          `<tr><td>${escapeHtml(c.name ?? "—")}</td><td>${escapeHtml(
            c.company ?? "—"
          )}</td><td>${escapeHtml(c.email)}</td><td>${escapeHtml(
            c.phone ?? "—"
          )}</td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><title>Contacts</title>
      <style>body{font-family:system-ui,sans-serif;padding:16px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:6px;font-size:12px;} th{background:#f4f4f4;text-align:left;}</style></head><body>
      <h1>Contacts</h1>
      <table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to export PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function moveSelectedToClients() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one contact.");
      return;
    }
    setBulkWorking(true);
    try {
      const { data } = await api.post<{ created: number; skipped_existing: number }>(
        "/clients/from-contacts",
        { contact_ids: Array.from(selectedIds) }
      );
      toast.success(
        `Clients created: ${data.created}. Skipped (already a client): ${data.skipped_existing}.`
      );
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBulkWorking(false);
    }
  }

  async function confirmBulkDeleteContacts() {
    if (selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      await api.post("/contacts/bulk-delete", { ids: Array.from(selectedIds) });
      toast.success(`Deleted ${selectedIds.size} contact(s).`);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelected(null);
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBulkWorking(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {
        active_only: activeOnly,
      };
      if (search.trim()) params.search = search.trim();
      if (licenseType !== "all") params.license_type = licenseType;
      if (tags.trim()) params.tags = tags.trim();
      const { data } = await api.get<Contact[]>("/contacts", { params });
      setContacts(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [search, licenseType, tags, activeOnly]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  function openContact(c: Contact) {
    setSelected(c);
    setEditForm({
      name: c.name ?? "",
      email: c.email,
      phone: c.phone ?? "",
      company: c.company ?? "",
      license_number: c.license_number ?? "",
      license_type: c.license_type ?? "_none",
      city: c.city ?? "",
      state: c.state ?? "OK",
      tags: c.tags ?? "",
      notes: c.notes ?? "",
      is_active: c.is_active,
    });
    setSheetOpen(true);
  }

  async function saveContact() {
    if (!selected) return;
    try {
      await api.put(`/contacts/${selected.id}`, {
        name: editForm.name || null,
        email: editForm.email,
        phone: editForm.phone || null,
        company: editForm.company || null,
        license_number: editForm.license_number || null,
        license_type:
          !editForm.license_type || editForm.license_type === "_none"
            ? null
            : editForm.license_type,
        city: editForm.city || null,
        state: editForm.state || "OK",
        tags: editForm.tags || null,
        notes: editForm.notes || null,
        is_active: editForm.is_active,
      });
      toast.success("Contact updated.");
      setSheetOpen(false);
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function deleteContact() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/contacts/${deleteTarget.id}`);
      toast.success("Contact deleted.");
      setDeleteTarget(null);
      setSheetOpen(false);
      setSelected(null);
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    license_number: "",
    license_type: "grower",
    city: "",
    state: "OK",
    tags: "",
    notes: "",
  });

  async function createContact() {
    try {
      await api.post("/contacts", {
        name: createForm.name || null,
        email: createForm.email,
        phone: createForm.phone || null,
        company: createForm.company || null,
        license_number: createForm.license_number || null,
        license_type: createForm.license_type,
        city: createForm.city || null,
        state: createForm.state || "OK",
        tags: createForm.tags || null,
        notes: createForm.notes || null,
      });
      toast.success("Contact created.");
      setCreateOpen(false);
      setCreateForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        license_number: "",
        license_type: "grower",
        city: "",
        state: "OK",
        tags: "",
        notes: "",
      });
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function runImport() {
    if (!importFile) {
      toast.error("Choose a CSV file.");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const { data } = await api.post<CSVImportSummary>(
        "/contacts/import-csv",
        fd
      );
      toast.success(
        `Import complete: ${data.added} added, ${data.updated} updated, ${data.skipped_invalid} skipped.`
      );
      setImportOpen(false);
      setImportFile(null);
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Search, filter, import, and manage licensed operator contacts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={contacts.length === 0}
            onClick={() => exportContactsCsv()}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            disabled={contacts.length === 0}
            onClick={() => exportContactsPdf()}
          >
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            disabled={bulkWorking || selectedIds.size === 0}
            onClick={() => void moveSelectedToClients()}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Move to clients
          </Button>
          <Button
            variant="destructive"
            disabled={bulkWorking || selectedIds.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            className="bg-[#2d6e3e] hover:bg-[#256035]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New contact
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Results update as you type.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              placeholder="Name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>License type</Label>
            <Select
              value={licenseType}
              onValueChange={(v) =>
                setLicenseType(v as (typeof LICENSE_OPTIONS)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="grower">Grower</SelectItem>
                <SelectItem value="dispensary">Dispensary</SelectItem>
                <SelectItem value="processor">Processor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tags contain</Label>
            <Input
              placeholder="e.g. VIP"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              Active only
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${contacts.length} contacts`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <span className="sr-only">Select</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={
                        contacts.length > 0 && selectedIds.size === contacts.length
                      }
                      onChange={() => toggleSelectAll()}
                      disabled={loading || contacts.length === 0}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Last contacted</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow
                    key={c.id}
                    className={cn("cursor-pointer", loading && "opacity-50")}
                    onClick={() => openContact(c)}
                  >
                    <TableCell
                      className="w-10 pr-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.name || "—"}
                    </TableCell>
                    <TableCell>{c.company || "—"}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell className="capitalize">
                      {c.license_type || "—"}
                    </TableCell>
                    <TableCell>{formatDateTime(c.last_contacted)}</TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {c.tags || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit contact</SheetTitle>
            <SheetDescription>
              {selected?.email} — ID {selected?.id}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 flex-1 pr-4">
            <div className="space-y-4 pb-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={String(editForm.name ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={String(editForm.email ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={String(editForm.phone ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={String(editForm.company ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, company: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>License #</Label>
                  <Input
                    value={String(editForm.license_number ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        license_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>License type</Label>
                  <Select
                    value={editForm.license_type || "_none"}
                    onValueChange={(v) =>
                      setEditForm((f) => ({ ...f, license_type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      <SelectItem value="grower">Grower</SelectItem>
                      <SelectItem value="dispensary">Dispensary</SelectItem>
                      <SelectItem value="processor">Processor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={String(editForm.city ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={String(editForm.state ?? "")}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, state: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={String(editForm.tags ?? "")}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, tags: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={String(editForm.notes ?? "")}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={4}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_active ?? true}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border"
                />
                Active
              </label>
            </div>
          </ScrollArea>
          <div className="mt-auto flex flex-col gap-2 border-t pt-4">
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#2d6e3e] hover:bg-[#256035]"
                onClick={() => void saveContact()}
              >
                Save changes
              </Button>
              <Button
                variant="destructive"
                onClick={() => selected && setDeleteTarget(selected)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New contact</DialogTitle>
            <DialogDescription>Add a contact to the database.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={createForm.company}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, company: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>License #</Label>
                <Input
                  value={createForm.license_number}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      license_number: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>License type</Label>
                <Select
                  value={createForm.license_type}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, license_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grower">Grower</SelectItem>
                    <SelectItem value="dispensary">Dispensary</SelectItem>
                    <SelectItem value="processor">Processor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={createForm.city}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={createForm.state}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, state: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={createForm.tags}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d6e3e] hover:bg-[#256035]"
              onClick={() => void createContact()}
              disabled={!createForm.email.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import contacts</DialogTitle>
            <DialogDescription>
              Upload a CSV. Existing emails will be updated.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={importing} onClick={() => void runImport()}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {selectedIds.size} contact
              {selectedIds.size === 1 ? "" : "s"} from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkWorking}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={bulkWorking}
              onClick={() => void confirmBulkDeleteContacts()}
            >
              {bulkWorking ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <strong>{deleteTarget?.email}</strong> from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void deleteContact()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
