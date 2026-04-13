"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type { Settings } from "@/types/api";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [testMode, setTestMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Settings>("/settings");
      setSettings(data);
      setTestMode(data.test_mode);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const { data } = await api.put<Settings>("/settings", {
        test_mode: testMode,
      });
      setSettings(data);
      setTestMode(data.test_mode);
      toast.success("Settings saved.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Email delivery configuration from the API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SendGrid & mail</CardTitle>
          <CardDescription>Read-only values from the backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-muted-foreground">FROM_EMAIL</Label>
                <p className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                  {settings?.from_email ?? "—"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SendGrid status</span>
                {settings?.sendgrid_configured ? (
                  <Badge variant="success">Configured</Badge>
                ) : (
                  <Badge variant="destructive">Not configured</Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sending mode</CardTitle>
          <CardDescription>
            When TEST_MODE is on, bulk sends use the server test recipient
            instead of real addresses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="test-mode">TEST_MODE</Label>
              <p className="text-xs text-muted-foreground">
                Toggle and click Save to persist.
              </p>
            </div>
            <Switch
              id="test-mode"
              checked={testMode}
              onCheckedChange={setTestMode}
              disabled={loading}
            />
          </div>
          <Button
            className="w-full bg-[#2d6e3e] hover:bg-[#256035]"
            disabled={loading || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
