"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  CampaignAnalyticsRow,
  EmailAnalytics,
  SendGridStats,
} from "@/types/analytics";
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
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mail,
  Megaphone,
  RefreshCw,
  TriangleAlert,
  Users,
  XCircle,
} from "lucide-react";

function pct(n: number, d: number): number {
  if (!d || !Number.isFinite(n) || !Number.isFinite(d)) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function deliveryRateClass(rate: number): string {
  if (rate > 95) return "font-semibold text-emerald-600";
  if (rate >= 80) return "font-semibold text-amber-600";
  return "font-semibold text-red-600";
}

function aggregateDeliveryRate(email: EmailAnalytics | null): number {
  if (!email) return 0;
  const d = email.total_sent + email.total_failed;
  if (!d) return 0;
  return Math.round((100 * email.total_sent) / d * 10) / 10;
}

export default function MarketingPage() {
  const [email, setEmail] = useState<EmailAnalytics | null>(null);
  const [sendgrid, setSendgrid] = useState<SendGridStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSg, setRefreshingSg] = useState(false);

  const loadEmail = useCallback(async () => {
    const { data } = await api.get<EmailAnalytics>("/analytics/email");
    setEmail(data);
  }, []);

  const loadSendgrid = useCallback(async () => {
    const { data } = await api.get<SendGridStats>("/analytics/sendgrid");
    setSendgrid(data);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const { data } = await api.get<CampaignAnalyticsRow[]>("/analytics/campaigns");
    setCampaigns(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadEmail(), loadSendgrid(), loadCampaigns()]);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadEmail, loadSendgrid, loadCampaigns]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshSendgrid = useCallback(async () => {
    setRefreshingSg(true);
    try {
      await loadSendgrid();
      toast.success("SendGrid stats refreshed");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRefreshingSg(false);
    }
  }, [loadSendgrid]);

  const dr = aggregateDeliveryRate(email);
  const deliveredPct = sendgrid ? pct(sendgrid.delivered, sendgrid.requests) : 0;
  const openRate = sendgrid ? pct(sendgrid.opens, sendgrid.delivered) : 0;
  const clickRate = sendgrid ? pct(sendgrid.clicks, sendgrid.delivered) : 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing Analytics</h1>
        <p className="text-muted-foreground">
          Email campaign performance and deliverability
        </p>
      </div>

      {/* Section 1 — key metrics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Key metrics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total sent (all time)</CardTitle>
              <Mail className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(email?.total_sent ?? 0).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivery rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className={`text-2xl font-bold tabular-nums ${deliveryRateClass(dr)}`}>
                  {dr.toFixed(1)}%
                </p>
              )}
              <p className="text-xs text-muted-foreground">From campaign logs</p>
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total opens</CardTitle>
              <Eye className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(sendgrid?.opens ?? 0).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground">SendGrid · last 30 days</p>
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unsubscribes</CardTitle>
              <XCircle className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(email?.total_unsubscribes ?? 0).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground">On file in CRM</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total campaigns</CardTitle>
              <Megaphone className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(email?.total_campaigns ?? 0).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total contacts</CardTitle>
              <Users className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(email?.total_contacts ?? 0).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bounces</CardTitle>
              <TriangleAlert className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(sendgrid?.bounces ?? 0).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground">SendGrid · last 30 days</p>
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Spam reports</CardTitle>
              <AlertTriangle className="h-4 w-4 text-[#2d6e3e]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">
                  {(sendgrid?.spam_reports ?? 0).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground">SendGrid · last 30 days</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 2 — SendGrid */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Live deliverability (last 30 days)
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[#2d6e3e]/40 text-[#2d6e3e] hover:bg-[#2d6e3e]/10 sm:w-auto"
            disabled={refreshingSg}
            onClick={() => void refreshSendgrid()}
          >
            {refreshingSg ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
        <Card className="border-[#2d6e3e]/25 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">SendGrid summary</CardTitle>
            <CardDescription>Data pulled live from SendGrid</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                {sendgrid?.error ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {sendgrid.error}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3 rounded-lg border border-[#2d6e3e]/15 bg-[#2d6e3e]/5 p-4">
                  <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Delivered
                    </p>
                    <p className="text-lg font-bold tabular-nums text-[#2d6e3e]">
                      {(sendgrid?.delivered ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deliveredPct.toFixed(1)}% of requests
                    </p>
                  </div>
                  <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Opens
                    </p>
                    <p className="text-lg font-bold tabular-nums text-[#2d6e3e]">
                      {(sendgrid?.opens ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {openRate.toFixed(1)}% open rate
                    </p>
                  </div>
                  <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Clicks
                    </p>
                    <p className="text-lg font-bold tabular-nums text-[#2d6e3e]">
                      {(sendgrid?.clicks ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {clickRate.toFixed(1)}% click rate
                    </p>
                  </div>
                  <div className="min-w-[120px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Bounces
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {(sendgrid?.bounces ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="min-w-[120px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Spam reports
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {(sendgrid?.spam_reports ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="min-w-[120px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Unsubscribes
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {(sendgrid?.unsubscribes ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requests (SendGrid): {(sendgrid?.requests ?? 0).toLocaleString()}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section 3 — campaign table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Campaign history</h2>
        <Card className="border-[#2d6e3e]/20 shadow-sm">
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : campaigns.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No data yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Campaign name</TableHead>
                    <TableHead>File used</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Delivery rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(row.date_sent)}
                      </TableCell>
                      <TableCell className="font-medium">{row.campaign_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {row.file_used || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_sent}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_failed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_skipped}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${deliveryRateClass(row.delivery_rate)}`}
                      >
                        {row.delivery_rate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
