"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  CampaignAnalyticsRow,
  SendGridSeriesResponse,
  SendGridStats,
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
  #marketing-report-print, #marketing-report-print * { visibility: visible !important; }
  #marketing-report-print {
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
  const [campaigns, setCampaigns] = useState<CampaignAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSg, setRefreshingSg] = useState(false);

  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [series, setSeries] = useState<SendGridSeriesResponse | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);

  const [bounces, setBounces] = useState<SuppressionListResponse | null>(null);
  const [unsubs, setUnsubs] = useState<SuppressionListResponse | null>(null);
  const [supLoading, setSupLoading] = useState(true);
  const [supActionKey, setSupActionKey] = useState<string | null>(null);

  const loadSendgrid = useCallback(async () => {
    const { data } = await api.get<SendGridStats>("/analytics/sendgrid");
    setSendgrid(data);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const { data } = await api.get<CampaignAnalyticsRow[]>("/analytics/campaigns");
    setCampaigns(data);
  }, []);

  const loadSeries = useCallback(async () => {
    setSeriesLoading(true);
    try {
      const { data } = await api.get<SendGridSeriesResponse>(
        "/analytics/sendgrid/series",
        { params: { granularity } }
      );
      setSeries(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setSeries(null);
    } finally {
      setSeriesLoading(false);
    }
  }, [granularity]);

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
      await Promise.all([loadSendgrid(), loadCampaigns()]);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadSendgrid, loadCampaigns]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    void loadSuppressions();
  }, [loadSuppressions]);

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

  const deliveredPct = sendgrid ? pct(sendgrid.delivered, sendgrid.requests) : 0;
  const openRate = sendgrid ? pct(sendgrid.opens, sendgrid.delivered) : 0;
  const clickRate = sendgrid ? pct(sendgrid.clicks, sendgrid.delivered) : 0;

  const chartData =
    series?.points.map((p) => ({
      period: p.period,
      Delivered: p.delivered,
      Opens: p.opens,
      Clicks: p.clicks,
      Bounces: p.bounces,
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

  function printReport() {
    window.print();
  }

  const granularityLabel =
    granularity === "day" ? "Day" : granularity === "week" ? "Week" : "Month";

  return (
    <div className="space-y-10">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing Analytics</h1>
        <p className="text-muted-foreground">
          Email campaign performance and deliverability
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Reports</h2>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Select
              value={granularity}
              onValueChange={(v) =>
                setGranularity(v as "day" | "week" | "month")
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
              onClick={() => printReport()}
            >
              Print to PDF
            </Button>
          </div>
        </div>

        <div id="marketing-report-print" className="rounded-lg border border-[#2d6e3e]/20 bg-white p-4 shadow-sm">
          <div className="mb-4 hidden print:block">
            <h2 className="text-xl font-bold">SendGrid report · {granularityLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Delivered, opens, clicks, and bounces by period
            </p>
          </div>
          {seriesLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : series?.error ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {series.error}
            </p>
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No series data for this range.
            </p>
          ) : (
            <div className="h-[min(360px,50vh)] w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
