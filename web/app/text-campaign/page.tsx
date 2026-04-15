"use client";

import { useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type { SmsContactsResponse, SmsSendResponse } from "@/types/api";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_CSV = "Master Grow Email List.csv";
const SMS_MAX = 160;

export default function TextCampaignSetupPage() {
  const [fileName, setFileName] = useState(DEFAULT_CSV);
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [contacts, setContacts] = useState<SmsContactsResponse | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SmsSendResponse | null>(null);
  const [smsTestMode, setSmsTestMode] = useState(false);

  const messageValid =
    message.trim().length > 0 && message.trim().length <= SMS_MAX;
  /** True when the primary send / confirm actions should be disabled. */
  const testSendBlocked =
    sending ||
    !messageValid ||
    (!smsTestMode && !fileName.trim());

  async function loadContacts() {
    if (!fileName.trim()) {
      toast.error("Enter a CSV file name.");
      return;
    }
    setContactsLoading(true);
    setContacts(null);
    setResult(null);
    try {
      const { data } = await api.get<SmsContactsResponse>("/sms/contacts", {
        params: { file_name: fileName.trim() },
      });
      setContacts(data);
      toast.success("Recipient list loaded.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setContactsLoading(false);
    }
  }

  async function runSend() {
    const body = message.trim();
    if (!body) return;
    if (body.length > SMS_MAX) {
      toast.error(`Message must be ${SMS_MAX} characters or fewer.`);
      return;
    }
    const safeFile = fileName.trim() || DEFAULT_CSV;
    if (!smsTestMode && !fileName.trim()) return;
    setSendOpen(false);
    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post<SmsSendResponse>("/sms/send", {
        file_name: safeFile,
        message: body,
        campaign_name: campaignName.trim() || undefined,
        sms_test_mode: smsTestMode,
      });
      setResult(data);
      toast.success("SMS campaign completed.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Text Campaign Setup</h1>
        <p className="text-muted-foreground">
          Send SMS broadcasts via Twilio from phone numbers in your CSV under{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-sm">/data</code>.
          Warmup limits match the email blaster (starting at 200/day).
        </p>
      </div>

      {smsTestMode && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm"
        >
          <p className="font-semibold text-amber-950">
            Test Mode: SMS will only go to your verified test number
          </p>
          {contacts && !contacts.test_sms_to_configured && (
            <p className="mt-2 text-sm text-amber-900/90">
              Recipients response: <code className="text-xs">TEST_SMS_TO</code> is not
              set on the server yet. If the send fails, add it to{" "}
              <code className="text-xs">.env</code> (E.164).
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Campaign setup</CardTitle>
          <CardDescription>
            File must exist on the server (use the phone column). Invalid or
            duplicate numbers are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="sms-test-mode" className="text-base font-medium">
                Test Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                When on, sends only to <code className="text-xs">TEST_SMS_TO</code> from
                .env (same warmup batch size, one destination per message).
              </p>
            </div>
            <Switch
              id="sms-test-mode"
              checked={smsTestMode}
              onCheckedChange={setSmsTestMode}
              className="data-[state=checked]:bg-[#2d6e3e]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="file">CSV file name</Label>
              <Input
                id="file"
                placeholder={DEFAULT_CSV}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign name (optional)</Label>
              <Input
                id="campaign"
                placeholder="Spring SMS promo"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="msg">Message</Label>
              <span className="text-sm text-muted-foreground">
                {message.length} / {SMS_MAX}
              </span>
            </div>
            <Textarea
              id="msg"
              placeholder="Write your SMS (160 characters max)…"
              value={message}
              maxLength={SMS_MAX}
              rows={4}
              className="resize-y"
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void loadContacts()}
              disabled={contactsLoading || sending}
            >
              {contactsLoading ? "Loading…" : "Load recipients & status"}
            </Button>
            <Button
              className="bg-[#2d6e3e] hover:bg-[#256035]"
              onClick={() => setSendOpen(true)}
              disabled={testSendBlocked}
            >
              {smsTestMode ? "Send Test SMS" : "Send SMS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {contacts && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-[#2d6e3e]/25">
            <CardHeader>
              <CardTitle className="text-base">Recipients</CardTitle>
              <CardDescription>After normalizing and deduplicating phones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Estimated recipients:</span>{" "}
                <strong className="text-lg text-[#2d6e3e]">
                  {contacts.total_valid_phones.toLocaleString()}
                </strong>
              </p>
              <p className="text-muted-foreground">
                Rows in file: {contacts.total_rows_in_file.toLocaleString()} · Skipped
                (invalid/missing phone):{" "}
                {contacts.rows_without_valid_phone.toLocaleString()}
              </p>
              {contacts.sample_phones.length > 0 && (
                <>
                  <p className="text-muted-foreground">Sample numbers:</p>
                  <ul className="list-inside list-disc text-xs">
                    {contacts.sample_phones.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#2d6e3e]/25">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Warmup & limits</CardTitle>
                {contacts.warmup_complete ? (
                  <Badge variant="secondary">Warmup complete</Badge>
                ) : (
                  <Badge className="bg-[#2d6e3e] hover:bg-[#256035]">
                    Day {contacts.warmup_day}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Same schedule as email: caps lift through day 21, then unlimited.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Daily send cap (approx.):</span>{" "}
                <strong>
                  {contacts.daily_limit >= 999999
                    ? "No limit"
                    : contacts.daily_limit.toLocaleString()}
                </strong>{" "}
                SMS / day
              </p>
              <p className="text-muted-foreground">
                Server TEST_MODE (email / other):{" "}
                <strong>{contacts.test_mode ? "On" : "Off"}</strong>
              </p>
              <p className="text-muted-foreground">
                <code className="text-xs">TEST_SMS_TO</code> for SMS test sends:{" "}
                <strong>
                  {contacts.test_sms_to_configured ? "Configured" : "Not set"}
                </strong>
              </p>
              <p className="text-muted-foreground">
                Twilio:{" "}
                <strong>
                  {contacts.twilio_configured ? "Configured" : "Not configured"}
                </strong>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {sending && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Sending in progress</CardTitle>
            <CardDescription>
              Large batches can take several minutes. Do not close this tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-[#2d6e3e]/70" />
            </div>
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
              <strong>SMS campaign log ID:</strong> {result.sms_campaign_log_id}
            </p>
            <p>
              <strong>Unique valid numbers in file:</strong> {result.total_in_file}
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
            <DialogTitle>
              {smsTestMode ? "Send test SMS?" : "Send SMS campaign?"}
            </DialogTitle>
            <DialogDescription>
              {smsTestMode ? (
                <>
                  Test Mode is on: messages go only to your{" "}
                  <code className="text-xs">TEST_SMS_TO</code> number. File:{" "}
                  <strong>{fileName || "—"}</strong>
                </>
              ) : (
                <>
                  Sends via Twilio to recipients from your CSV. File:{" "}
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
              disabled={testSendBlocked}
              onClick={() => void runSend()}
            >
              {sending
                ? "Sending…"
                : smsTestMode
                  ? "Send Test SMS"
                  : "Confirm send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
