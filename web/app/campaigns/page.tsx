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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CampaignLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CampaignLog[]>("/campaigns");
      setCampaigns(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openRow(id: number) {
    try {
      const { data } = await api.get<CampaignLog>(`/campaigns/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaign history</h1>
        <p className="text-muted-foreground">
          All logged bulk sends and their outcomes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${campaigns.length} records`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer",
                      loading && "pointer-events-none opacity-50"
                    )}
                    onClick={() => void openRow(row.id)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(row.date_sent)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.campaign_name}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {row.file_used || "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.total_sent}</TableCell>
                    <TableCell className="text-right">
                      {row.total_failed}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.total_skipped}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campaign details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">ID:</span> {detail.id}
              </p>
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                {detail.campaign_name}
              </p>
              <p>
                <span className="text-muted-foreground">File:</span>{" "}
                {detail.file_used || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Date:</span>{" "}
                {formatDateTime(detail.date_sent)}
              </p>
              <p>
                <span className="text-muted-foreground">Sent:</span>{" "}
                {detail.total_sent}
              </p>
              <p>
                <span className="text-muted-foreground">Failed:</span>{" "}
                {detail.total_failed}
              </p>
              <p>
                <span className="text-muted-foreground">Skipped:</span>{" "}
                {detail.total_skipped}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
