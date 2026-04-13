"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  CampaignLog,
  Client,
  ClientNote,
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
import { MapPin, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Licensed partners and primary contacts.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading clients…</p>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active clients. Create clients via the API or expand this UI later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <Card
              key={c.id}
              className={cn(
                "cursor-pointer transition-shadow hover:shadow-md",
                "border-l-4 border-l-[#2d6e3e]"
              )}
              onClick={() => void openClient(c)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <CardDescription className="capitalize">
                  {c.license_type || "License"} · {c.city || "—"},{" "}
                  {c.state || "OK"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {c.primary_contact_name || "—"}
                    {c.primary_contact_email && (
                      <>
                        <br />
                        <span className="text-foreground">
                          {c.primary_contact_email}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {c.city || "—"}, {c.state || "OK"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
