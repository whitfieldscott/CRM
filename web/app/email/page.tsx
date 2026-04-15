"use client";

import { useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  ConfirmSendResponse,
  PreviewCsvResponse,
  SendBulkResponse,
} from "@/types/api";
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
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function EmailBlasterPage() {
  const [fileName, setFileName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [preview, setPreview] = useState<PreviewCsvResponse | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSendResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendBulkResponse | null>(null);
  const [emailTestMode, setEmailTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  async function runPreview() {
    if (!fileName.trim()) {
      toast.error("Enter a CSV file name.");
      return;
    }
    setPreviewLoading(true);
    setPreview(null);
    setConfirm(null);
    setResult(null);
    try {
      const { data } = await api.get<PreviewCsvResponse>("/preview-csv", {
        params: { file_name: fileName.trim() },
      });
      setPreview(data);
      toast.success("Preview loaded.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runConfirm() {
    if (!fileName.trim()) {
      toast.error("Enter a CSV file name.");
      return;
    }
    setConfirmLoading(true);
    setConfirm(null);
    setResult(null);
    try {
      const { data } = await api.get<ConfirmSendResponse>("/confirm-send", {
        params: { file_name: fileName.trim() },
      });
      setConfirm(data);
      toast.success("List validated.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setConfirmLoading(false);
    }
  }

  async function runSend() {
    if (!fileName.trim()) return;
    setSendOpen(false);
    setSending(true);
    setResult(null);
    try {
      const params: Record<string, string> = { file_name: fileName.trim() };
      const cn = campaignName.trim();
      if (cn) params.campaign_name = cn;
      if (emailTestMode && testEmail.trim()) params.test_email = testEmail.trim();
      const { data } = await api.post<SendBulkResponse>(
        "/send-bulk",
        undefined,
        { params }
      );
      setResult(data);
      toast.success("Send completed.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Blaster</h1>
        <p className="text-muted-foreground">
          Preview, validate, and send bulk campaigns from files in your{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-sm">/data</code>{" "}
          folder.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign setup</CardTitle>
          <CardDescription>
            File must exist on the server under the data directory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="file">CSV file name</Label>
              <Input
                id="file"
                placeholder="e.g. growers_ok.csv"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign name (optional)</Label>
              <Input
                id="campaign"
                placeholder="Spring clone promo"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="email-test" className="text-base font-medium">
                Test mode
              </Label>
              <p className="text-sm text-muted-foreground">
                When on, every send in the batch goes only to the address you type (CSV
                still drives the loop).
              </p>
            </div>
            <Switch
              id="email-test"
              checked={emailTestMode}
              onCheckedChange={setEmailTestMode}
              className="data-[state=checked]:bg-[#2d6e3e]"
            />
          </div>
          {emailTestMode ? (
            <div className="space-y-2">
              <Label htmlFor="test-email-blaster">Test email address</Label>
              <Input
                id="test-email-blaster"
                type="email"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void runPreview()}
              disabled={previewLoading || sending}
            >
              {previewLoading ? "Loading…" : "Preview"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runConfirm()}
              disabled={confirmLoading || sending}
            >
              {confirmLoading ? "Checking…" : "Confirm list"}
            </Button>
            <Button
              className="bg-[#2d6e3e] hover:bg-[#256035]"
              onClick={() => {
                if (emailTestMode) {
                  const te = testEmail.trim();
                  if (!te || !te.includes("@")) {
                    toast.error("Enter a valid test email address.");
                    return;
                  }
                }
                setSendOpen(true);
              }}
              disabled={sending || !fileName.trim()}
            >
              {emailTestMode ? "Send Test Email" : "Send emails"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {sending && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Sending in progress</CardTitle>
            <CardDescription>
              Large batches can take several minutes. Do not close this tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-[#2d6e3e]/70" />
            </div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Preview</CardTitle>
              <Badge variant="secondary">{preview.total_rows} rows</Badge>
            </div>
            <CardDescription>
              Columns: {preview.columns.join(", ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.columns.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((row, i) => (
                    <TableRow key={i}>
                      {preview.columns.map((c) => (
                        <TableCell key={c}>
                          {String((row as Record<string, unknown>)[c] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {confirm && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmation</CardTitle>
            <CardDescription>Ready to send to validated addresses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold">
              {confirm.total_valid_emails} valid emails
            </p>
            <p className="text-sm text-muted-foreground">Sample:</p>
            <ul className="list-inside list-disc text-sm">
              {confirm.sample_emails.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Summary from the API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Campaign log ID:</strong> {result.campaign_log_id}
            </p>
            <p>
              <strong>Rows in file:</strong> {result.total_in_file}
            </p>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-white p-3 text-xs shadow-inner">
              {JSON.stringify(result.result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send campaign?</DialogTitle>
            <DialogDescription>
              {emailTestMode ? (
                <>
                  Test mode: all messages go to{" "}
                  <strong>{testEmail.trim() || "your test address"}</strong>. File:{" "}
                  <strong>{fileName || "—"}</strong>
                </>
              ) : (
                <>
                  Sends through SendGrid (server TEST_MODE may redirect). File:{" "}
                  <strong>{fileName || "—"}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d6e3e] hover:bg-[#256035]"
              disabled={sending}
              onClick={() => void runSend()}
            >
              {sending ? "Sending…" : emailTestMode ? "Send Test Email" : "Confirm send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
