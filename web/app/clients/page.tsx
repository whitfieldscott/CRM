"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  CampaignLog,
  Client,
  ClientNote,
  Contact,
  EmailSendRecord,
} from "@/types/api";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Mail, Trash2, User, UserPlus } from "lucide-react";
export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);

  const [emails, setEmails] = useState<EmailSendRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [noteText, setNoteText] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [modalContacts, setModalContacts] = useState<Contact[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalPick, setModalPick] = useState<Set<number>>(new Set());

  function toggleClientSelect(id: number) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAllClients() {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)));
    }
  }

  const loadModalContacts = useCallback(async () => {
    setModalLoading(true);
    try {
      const params: Record<string, string | boolean> = { active_only: true };
      if (contactSearch.trim()) params.search = contactSearch.trim();
      const { data } = await api.get<Contact[]>("/contacts", { params });
      setModalContacts(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setModalLoading(false);
    }
  }, [contactSearch]);

  useEffect(() => {
    if (!addOpen) return;
    const t = setTimeout(() => void loadModalContacts(), 250);
    return () => clearTimeout(t);
  }, [addOpen, loadModalContacts]);

  async function addClientsFromModal() {
    if (modalPick.size === 0) {
      toast.error("Select at least one contact.");
      return;
    }
    setBulkWorking(true);
    try {
      const { data } = await api.post<{ created: number; skipped_existing: number }>(
        "/clients/from-contacts",
        { contact_ids: Array.from(modalPick) }
      );
      toast.success(
        `Created ${data.created} client(s). Skipped (already exists): ${data.skipped_existing}.`
      );
      setAddOpen(false);
      setModalPick(new Set());
      setContactSearch("");
      void loadList();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBulkWorking(false);
    }
  }

  async function confirmBulkDeactivateClients() {
    if (selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      await api.post("/clients/bulk-deactivate", { ids: Array.from(selectedIds) });
      toast.success(
        `${selectedIds.size} client${selectedIds.size === 1 ? "" : "s"} deactivated.`
      );
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      setOpen(false);
      setSelected(null);
      void loadList();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBulkWorking(false);
    }
  }

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Client[]>("/clients", {
        params: { active_only: true },
      });
      setClients(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openClient(c: Client) {
    setSelected(c);
    setOpen(true);
    setDetailLoading(true);
    setEmails([]);
    setCampaigns([]);
    setNotes([]);
    setNoteText("");
    try {
      const [eRes, campRes, nRes] = await Promise.all([
        api.get<EmailSendRecord[]>(`/clients/${c.id}/emails`),
        api.get<CampaignLog[]>(`/clients/${c.id}/campaigns`),
        api.get<ClientNote[]>(`/clients/${c.id}/notes`),
      ]);
      setEmails(eRes.data);
      setCampaigns(campRes.data);
      setNotes(nRes.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }

  async function addNote() {
    if (!selected || !noteText.trim()) return;
    try {
      await api.post(`/clients/${selected.id}/notes`, { note: noteText.trim() });
      toast.success("Note added.");
      setNoteText("");
      const { data } = await api.get<ClientNote[]>(
        `/clients/${selected.id}/notes`
      );
      setNotes(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Licensed partners and primary contacts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setModalPick(new Set());
              setContactSearch("");
              setAddOpen(true);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add from contacts
          </Button>
          <Button
            variant="destructive"
            disabled={bulkWorking || selectedIds.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading clients…</p>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active clients. Add some from the contacts directory.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>{clients.length} active clients</CardDescription>
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
                          clients.length > 0 && selectedIds.size === clients.length
                        }
                        onChange={() => toggleSelectAllClients()}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Primary contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => void openClient(c)}
                    >
                      <TableCell
                        className="w-10 pr-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleClientSelect(c.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.primary_contact_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.primary_contact_email || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {c.city || "—"}, {c.state || "OK"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add from contacts</DialogTitle>
            <DialogDescription>
              Search your contacts and create clients for any that are not already linked
              by primary email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="contact-search">Search</Label>
            <Input
              id="contact-search"
              placeholder="Name, email, company…"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            <ScrollArea className="h-[min(360px,50vh)] rounded-md border">
              {modalLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : modalContacts.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No contacts match.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modalContacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border"
                            checked={modalPick.has(c.id)}
                            onChange={() => {
                              setModalPick((prev) => {
                                const n = new Set(prev);
                                if (n.has(c.id)) n.delete(c.id);
                                else n.add(c.id);
                                return n;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{c.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d6e3e] hover:bg-[#256035]"
              disabled={bulkWorking || modalPick.size === 0}
              onClick={() => void addClientsFromModal()}
            >
              {bulkWorking
                ? "Adding…"
                : modalPick.size
                  ? `Add ${modalPick.size} client(s)`
                  : "Add clients"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate selected clients?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks {selectedIds.size} client
              {selectedIds.size === 1 ? "" : "s"} as inactive (same as row delete in the
              API).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkWorking}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={bulkWorking}
              onClick={() => void confirmBulkDeactivateClients()}
            >
              {bulkWorking ? "Working…" : "Deactivate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>
              Client profile · ID {selected?.id}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="mt-2 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-[#2d6e3e]" />
                  Contact information
                </div>
                <Separator className="my-3" />
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Primary</dt>
                    <dd>{selected.primary_contact_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{selected.primary_contact_email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{selected.primary_contact_phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">License</dt>
                    <dd className="capitalize">
                      {selected.license_number || "—"} ·{" "}
                      {selected.license_type || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd>{selected.address || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd>{selected.notes || "—"}</dd>
                  </div>
                </dl>
              </div>

              <Tabs defaultValue="emails" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="emails">Emails</TabsTrigger>
                  <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="emails" className="mt-4 min-h-0 flex-1">
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <ScrollArea className="h-[280px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead>OK</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emails.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center">
                                No sends logged for this client.
                              </TableCell>
                            </TableRow>
                          ) : (
                            emails.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>
                                  {formatDateTime(r.sent_at)}
                                </TableCell>
                                <TableCell>{r.recipient_email}</TableCell>
                                <TableCell>{r.success ? "Yes" : "No"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="campaigns" className="mt-4">
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <ScrollArea className="h-[280px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Sent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaigns.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center">
                                No linked campaigns.
                              </TableCell>
                            </TableRow>
                          ) : (
                            campaigns.map((x) => (
                              <TableRow key={x.id}>
                                <TableCell>
                                  {formatDateTime(x.date_sent)}
                                </TableCell>
                                <TableCell>{x.campaign_name}</TableCell>
                                <TableCell>{x.total_sent}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Add note</Label>
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Call summary, visit notes…"
                      rows={3}
                    />
                    <Button
                      size="sm"
                      className="bg-[#2d6e3e] hover:bg-[#256035]"
                      onClick={() => void addNote()}
                    >
                      Add note
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Timeline</p>
                    {detailLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notes.</p>
                    ) : (
                      <ul className="space-y-3">
                        {notes.map((n) => (
                          <li
                            key={n.id}
                            className="rounded-md border bg-card p-3 text-sm"
                          >
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(n.created_at)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{n.note}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
