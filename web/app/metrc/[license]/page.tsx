"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type MetrcFacility = {
  DisplayName?: string | null;
  Name?: string | null;
  License?: {
    Number?: string | null;
    LicenseType?: string | null;
  } | null;
};

export default function MetrcLicenseDashboardPage() {
  const params = useParams();
  const raw = params.license;
  const licenseNumber = useMemo(() => {
    if (typeof raw === "string") return decodeURIComponent(raw);
    if (Array.isArray(raw) && raw[0]) return decodeURIComponent(raw[0]);
    return "";
  }, [raw]);

  const [facility, setFacility] = useState<MetrcFacility | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!licenseNumber) {
      setFacility(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<MetrcFacility[]>("/metrc/licenses");
      const list = Array.isArray(data) ? data : [];
      const match = list.find(
        (f) => (f.License?.Number ?? "").trim() === licenseNumber.trim(),
      );
      setFacility(match ?? null);
      if (!match) {
        toast.error("No facility found for this license number.");
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setFacility(null);
    } finally {
      setLoading(false);
    }
  }, [licenseNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = useMemo(() => {
    if (!facility) return "";
    return (
      facility.DisplayName?.trim() ||
      facility.Name?.trim() ||
      facility.License?.Number?.trim() ||
      licenseNumber
    );
  }, [facility, licenseNumber]);

  const licenseType = facility?.License?.LicenseType?.trim() ?? "—";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-2/3 max-w-md" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-56" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">License number:</span>{" "}
              <span className="font-mono text-sm">{licenseNumber || "—"}</span>
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">License type:</span>{" "}
              {licenseType}
            </p>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Placeholder navigation for this license.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" disabled>
            Packages
          </Button>
          <Button type="button" variant="outline" disabled>
            Transfers
          </Button>
          <Button type="button" variant="outline" disabled>
            Invoices
          </Button>
          <Button type="button" variant="outline" disabled>
            Log
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
