"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  SendGridSeriesResponse,
  SendGridStats,
  SmsSeriesResponse,
  SmsSummaryAnalytics,
  SuppressionListResponse,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function pct(n: number, d: number): number {
  if (!d || !Number.isFinite(n) || !Number.isFinite(d)) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function deliveryRateClass(rate: number): string {
  if (rate > 95) return "font-semibold text-emerald-600";
  if (rate >= 80) return "font-semibold text-amber-600";
  return "font-semibold text-red-600";
}

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  body[data-print-target="email"] #marketing-email-reports,
  body[data-print-target="email"] #marketing-email-reports * { visibility: visible !important; }
  body[data-print-target="email"] #marketing-email-reports {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    padding: 0 12px !important;
  }
  body[data-print-target="text"] #marketing-text-reports,
  body[data-print-target="text"] #marketing-text-reports * { visibility: visible !important; }
  body[data-print-target="text"] #marketing-text-reports {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    padding: 0 12px !important;
  }
}
`;

export default function MarketingPage() {
  const [sendgrid, setSendgrid] = useState<SendGridStats | null>(null);
  const [smsSummary, setSmsSummary] = useState<SmsSummaryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingSg, setRefreshingSg] = useState(false);

  const [emailGranularity, setEmailGranularity] = useState<"day" | "week" | "month">(
    "day"
  );
  const [emailSeries, setEmailSeries] = useState<SendGridSeriesResponse | null>(null);
  const [emailSeriesLoading, setEmailSeriesLoading] = useState(false);

  const [smsGranularity, setSmsGranularity] = useState<"day" | "week" | "month">("day");
  const [smsSeries, setSmsSeries] = useState<SmsSeriesResponse | null>(null);
  const [smsSeriesLoading, setSmsSeriesLoading] = useState(false);

  const [bounces, setBounces] = useState<SuppressionListResponse | null>(null);
  const [unsubs, setUnsubs] = useState<SuppressionListResponse | null>(null);
  const [supLoading, setSupLoading] = useState(true);
  const [supActionKey, setSupActionKey] = useState<string | null>(null);

  useEffect(() => {
    const clear = () => {
      delete document.body.dataset.printTarget;
    };
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  const loadSendgrid = useCallback(async () => {
    const { data } = await api.get<SendGridStats>("/analytics/sendgrid");
    setSendgrid(data);
  }, []);

  const loadSmsSummary = useCallback(async () => {
    const { data } = await api.get<SmsSummaryAnalytics>("/analytics/sms/summary");
    setSmsSummary(data);
  }, []);

  const loadEmailSeries = useCallback(async () => {
    setEmailSeriesLoading(true);
    try {
      const { data } = await api.get<SendGridSeriesResponse>(
        "/analytics/sendgrid/series",
        { params: { granularity: emailGranularity } }
      );
      setEmailSeries(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setEmailSeries(null);
    } finally {
      setEmailSeriesLoading(false);
    }
  }, [emailGranularity]);

  const loadSmsSeries = useCallback(async () => {
    setSmsSeriesLoading(true);
    try {
      const { data } = await api.get<SmsSeriesResponse>("/analytics/sms/series", {
        params: { granularity: smsGranularity },
      });
      setSmsSeries(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setSmsSeries(null);
    } finally {
      setSmsSeriesLoading(false);
    }
  }, [smsGranularity]);

  const loadSuppressions = useCallback(async () => {
    setSupLoading(true);
    try {
      const [b, u] = await Promise.all([
        api.get<SuppressionListResponse>("/analytics/suppression/bounces"),
        api.get<SuppressionListResponse>("/analytics/suppression/unsubscribes"),
      ]);
      setBounces(b.data);
      setUnsubs(u.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSupLoading(false);
    }
  }, []);

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadSendgrid(), loadSmsSummary()]);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadSendgrid, loadSmsSummary]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadEmailSeries();
  }, [loadEmailSeries]);

  useEffect(() => {
    void loadSmsSeries();
  }, [loadSmsSeries]);

  useEffect(() => {
    void loadSuppressions();
  }, [loadSuppressions]);

  const refreshSummaries = useCallback(async () => {
    setRefreshingSg(true);
    try {
      await Promise.all([loadSendgrid(), loadSmsSummary()]);
      toast.success("Summaries refreshed");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRefreshingSg(false);
    }
  }, [loadSendgrid, loadSmsSummary]);

  const deliveredPct = sendgrid ? pct(sendgrid.delivered, sendgrid.requests) : 0;
  const openRate = sendgrid ? pct(sendgrid.opens, sendgrid.delivered) : 0;
  const clickRate = sendgrid ? pct(sendgrid.clicks, sendgrid.delivered) : 0;

  const smsDeliveryRate = smsSummary
    ? pct(smsSummary.total_sent, smsSummary.total_sent + smsSummary.total_failed)
    : 0;

  const emailChartData =
    emailSeries?.points.map((p) => ({
      period: p.period,
      Delivered: p.delivered,
      Opens: p.opens,
      Clicks: p.clicks,
      Bounces: p.bounces,
    })) ?? [];

  const smsChartData =
    smsSeries?.points.map((p) => ({
      period: p.period,
      "SMS Sent": p.sent,
      "SMS Failed": p.failed,
      "SMS Skipped": p.skipped,
    })) ?? [];

  function actionKey(kind: "bounce" | "unsubscribe", email: string, op: string) {
    return `${kind}:${email}:${op}`;
  }

  async function deleteSuppression(kind: "bounce" | "unsubscribe", email: string) {
    const path =
      kind === "bounce"
        ? "/analytics/suppression/bounce"
        : "/analytics/suppression/unsubscribe";
    const k = actionKey(kind, email, "del");
    setSupActionKey(k);
    try {
      await api.delete(path, { params: { email } });
      toast.success("Removed from SendGrid.");
      await loadSuppressions();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSupActionKey(null);
    }
  }

  async function flagFollowUp(kind: "bounce" | "unsubscribe", email: string) {
    const k = actionKey(kind, email, "flag");
    setSupActionKey(k);
    try {
      await api.post("/analytics/suppression/follow-up", { kind, email });
      toast.success("Flagged for follow-up.");
      await loadSuppressions();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSupActionKey(null);
    }
  }

  function printEmailReport() {
    document.body.dataset.printTarget = "email";
    window.print();
  }

  function printTextReport() {
    document.body.dataset.printTarget = "text";
    window.print();
  }

  const emailGranularityLabel =
    emailGranularity === "day"
      ? "Day"
      : emailGranularity === "week"
        ? "Week"
        : "Month";

  const smsGranularityLabel =
    smsGranularity === "day" ? "Day" : smsGranularity === "week" ? "Week" : "Month";

  return (
    <div className="space-y-10">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing Analytics</h1>
        <p className="text-muted-foreground">
          Email and SMS performance, SendGrid deliverability, and suppression lists
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Email reports</h2>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Select
              value={emailGranularity}
              onValueChange={(v) =>
                setEmailGranularity(v as "day" | "week" | "month")
              }
            >
              <SelectTrigger className="w-[160px] border-[#2d6e3e]/40">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#2d6e3e]/40 text-[#2d6e3e] hover:bg-[#2d6e3e]/10"
              onClick={() => printEmailReport()}
            >
              Print to PDF
            </Button>
          </div>
        </div>

        <div
          id="marketing-email-reports"
          className="rounded-lg border border-[#2d6e3e]/20 bg-white p-4 shadow-sm"
        >
          <div className="mb-4 hidden print:block">
            <h2 className="text-xl font-bold">Email report · {emailGranularityLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Delivered, opens, clicks, and bounces (SendGrid)
            </p>
          </div>
          {emailSeriesLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : emailSeries?.error ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {emailSeries.error}
            </p>
          ) : emailChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No series data for this range.
            </p>
          ) : (
            <div className="h-[min(360px,50vh)] w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={emailChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Delivered"
                    stroke="#2d6e3e"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Opens"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Clicks"
                    stroke="#ca8a04"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Bounces"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Email summary</h2>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[#2d6e3e]/40 text-[#2d6e3e] hover:bg-[#2d6e3e]/10 sm:w-auto no-print"
            disabled={refreshingSg}
            onClick={() => void refreshSummaries()}
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
            <CardTitle className="text-base">Email summary</CardTitle>
            <CardDescription>Last 30 days from SendGrid (live)</CardDescription>
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

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Text reports</h2>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Select
              value={smsGranularity}
              onValueChange={(v) =>
                setSmsGranularity(v as "day" | "week" | "month")
              }
            >
              <SelectTrigger className="w-[160px] border-[#2d6e3e]/40">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#2d6e3e]/40 text-[#2d6e3e] hover:bg-[#2d6e3e]/10"
              onClick={() => printTextReport()}
            >
              Print to PDF
            </Button>
          </div>
        </div>

        <div
          id="marketing-text-reports"
          className="rounded-lg border border-[#2d6e3e]/20 bg-white p-4 shadow-sm"
        >
          <div className="mb-4 hidden print:block">
            <h2 className="text-xl font-bold">SMS report · {smsGranularityLabel}</h2>
            <p className="text-sm text-muted-foreground">
              SMS sent, failed, and skipped by period (campaign logs)
            </p>
          </div>
          {smsSeriesLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : smsSeries?.error ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {smsSeries.error}
            </p>
          ) : smsChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No SMS data for this range.
            </p>
          ) : (
            <div className="h-[min(360px,50vh)] w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={smsChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="SMS Sent"
                    stroke="#2d6e3e"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="SMS Failed"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="SMS Skipped"
                    stroke="#ca8a04"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Text summary</h2>
        <Card className="border-[#2d6e3e]/25 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">SMS campaign totals</CardTitle>
            <CardDescription>Aggregated from all rows in sms_campaign_logs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 rounded-lg border border-[#2d6e3e]/15 bg-[#2d6e3e]/5 p-4">
                <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total sent
                  </p>
                  <p className="text-lg font-bold tabular-nums text-[#2d6e3e]">
                    {(smsSummary?.total_sent ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total failed
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {(smsSummary?.total_failed ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total skipped
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {(smsSummary?.total_skipped ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 rounded-md border border-white/60 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Delivery rate
                  </p>
                  <p
                    className={`text-lg font-bold tabular-nums ${deliveryRateClass(smsDeliveryRate)}`}
                  >
                    {smsDeliveryRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Sent ÷ (sent + failed)</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Bounces &amp; unsubscribes
        </h2>
        <Card className="border-[#2d6e3e]/20 shadow-sm">
          <CardContent className="pt-6">
            <Tabs defaultValue="bounces">
              <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="bounces">Bounces</TabsTrigger>
                <TabsTrigger value="unsubscribes">Unsubscribes</TabsTrigger>
              </TabsList>
              <TabsContent value="bounces">
                {supLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : bounces?.error ? (
                  <p className="text-sm text-amber-800">{bounces.error}</p>
                ) : !bounces?.items.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No bounces in SendGrid suppression list.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bounces.items.map((row) => (
                        <TableRow key={row.email}>
                          <TableCell className="font-mono text-sm">{row.email}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-sm">
                            {row.reason}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {row.date}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {row.marked_follow_up ? (
                                <Badge variant="secondary">Follow-up</Badge>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                  supActionKey === actionKey("bounce", row.email, "flag")
                                }
                                onClick={() =>
                                  void flagFollowUp("bounce", row.email)
                                }
                              >
                                Flag for follow-up
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={
                                  supActionKey === actionKey("bounce", row.email, "del")
                                }
                                onClick={() =>
                                  void deleteSuppression("bounce", row.email)
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="unsubscribes">
                {supLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : unsubs?.error ? (
                  <p className="text-sm text-amber-800">{unsubs.error}</p>
                ) : !unsubs?.items.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No global unsubscribes in SendGrid suppression list.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unsubs.items.map((row) => (
                        <TableRow key={row.email}>
                          <TableCell className="font-mono text-sm">{row.email}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-sm">
                            {row.reason}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {row.date}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {row.marked_follow_up ? (
                                <Badge variant="secondary">Follow-up</Badge>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                  supActionKey ===
                                  actionKey("unsubscribe", row.email, "flag")
                                }
                                onClick={() =>
                                  void flagFollowUp("unsubscribe", row.email)
                                }
                              >
                                Flag for follow-up
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={
                                  supActionKey ===
                                  actionKey("unsubscribe", row.email, "del")
                                }
                                onClick={() =>
                                  void deleteSuppression("unsubscribe", row.email)
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
