"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type { CampaignLog } from "@/types/api";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function deliveryRate(sent: number, failed: number): number {
  const d = sent + failed;
  if (!d) return 0;
  return Math.round((100 * sent) / d * 10) / 10;
}

function rateClass(rate: number): string {
  if (rate > 95) return "font-semibold text-emerald-600";
  if (rate >= 80) return "font-semibold text-amber-600";
  return "font-semibold text-red-600";
}

export default function EmailCampaignHistoryPage() {
  const [rows, setRows] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CampaignLog[]>("/campaigns");
      setRows(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Campaign History</h1>
        <p className="text-muted-foreground">
          Email campaigns sent from the CRM (same columns as Text Campaign History).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No email campaigns yet.
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
                {rows.map((row) => {
                  const dr = deliveryRate(row.total_sent, row.total_failed);
                  return (
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
                        className={`text-right tabular-nums ${rateClass(dr)}`}
                      >
                        {dr.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
