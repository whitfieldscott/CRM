"use client";

import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";
import { MasterDataPanel } from "@/components/metrc/master-data-panel";
import { setStoredMetrcLicense } from "@/lib/metrc-storage";

export default function MetrcLicenseDashboardPage() {
  const params = useParams();
  const raw = params.license;
  const licenseNumber = useMemo(() => {
    if (typeof raw === "string") return decodeURIComponent(raw);
    if (Array.isArray(raw) && raw[0]) return decodeURIComponent(raw[0]);
    return "";
  }, [raw]);

  const { facilities, loading, sandbox, baseUrlHost } = useMetrcFacility();

  const facility = useMemo(
    () => facilities.find((f) => f.license_number === licenseNumber) ?? null,
    [facilities, licenseNumber],
  );

  useEffect(() => {
    if (licenseNumber) setStoredMetrcLicense(licenseNumber);
  }, [licenseNumber]);

  const displayName =
    facility?.display_name?.trim() ||
    facility?.facility_name?.trim() ||
    licenseNumber ||
    "Facility";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        {loading && !facility ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-2/3 max-w-md" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-56" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">License:</span>{" "}
              <span className="font-mono text-sm">{licenseNumber || "—"}</span>
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">License type:</span>{" "}
              {facility?.license_type ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Metrc {sandbox ? "sandbox" : "production"} · {baseUrlHost}
              {facility?.synced_at
                ? ` · facilities synced ${new Date(facility.synced_at).toLocaleString()}`
                : ""}
            </p>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Operational modules coming in Phase 2.3+.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" disabled>
            Packages
          </Button>
          <Button type="button" variant="outline" disabled>
            Transfers
          </Button>
          <Button type="button" variant="outline" disabled>
            Plants
          </Button>
          <Button type="button" variant="outline" disabled>
            Compliance log
          </Button>
        </CardContent>
      </Card>

      {licenseNumber ? <MasterDataPanel license={licenseNumber} /> : null}
    </div>
  );
}
