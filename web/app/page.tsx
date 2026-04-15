"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getApiErrorMessage } from "@/lib/api";
import type { CampaignLog, Client, Contact } from "@/types/api";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Users, Building2, Send } from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, clRes, campRes] = await Promise.all([
        api.get<Contact[]>("/contacts", { params: { active_only: false } }),
        api.get<Client[]>("/clients", { params: { active_only: true } }),
        api.get<CampaignLog[]>("/campaigns"),
      ]);
      setContacts(cRes.data);
      setClients(clRes.data);
      setCampaigns(campRes.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lastSend =
    campaigns.length > 0
      ? campaigns.reduce((a, b) => {
          const da = a.date_sent ? new Date(a.date_sent).getTime() : 0;
          const db = b.date_sent ? new Date(b.date_sent).getTime() : 0;
          return db > da ? b : a;
        })
      : null;

  const recent = [...campaigns]
    .sort((a, b) => {
      const da = a.date_sent ? new Date(a.date_sent).getTime() : 0;
      const db = b.date_sent ? new Date(b.date_sent).getTime() : 0;
      return db - da;
    })
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of contacts, clients, and email campaigns.
          </p>
        </div>
        <Button
          asChild
          className="bg-[#2d6e3e] hover:bg-[#256035]"
        >
          <Link href="/campaigns">
            <Mail className="mr-2 h-4 w-4" />
            Quick send
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{contacts.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{clients.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaigns sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{campaigns.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last send</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-lg font-semibold leading-tight">
                {lastSend?.date_sent
                  ? formatDateTime(lastSend.date_sent)
                  : "—"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent campaigns</CardTitle>
          <CardDescription>Latest bulk sends logged in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(row.date_sent)}
                    </TableCell>
                    <TableCell>{row.campaign_name}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">
                      {row.file_used || "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.total_sent}</TableCell>
                    <TableCell className="text-right">{row.total_failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
