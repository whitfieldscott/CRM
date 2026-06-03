"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";

function facilityLabel(display: string | null, license: string, name: string | null) {
  return display?.trim() || name?.trim() || license;
}

export function MetrcFacilityBar() {
  const pathname = usePathname();
  const {
    facilities,
    selectedLicense,
    loading,
    syncing,
    sandbox,
    baseUrlHost,
    setSelectedLicense,
    refreshFacilities,
  } = useMetrcFacility();

  const onLicense = pathname.startsWith("/metrc/") && pathname !== "/metrc";

  return (
    <div className="border-b border-border-theme/40 bg-card/30 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Seed-To-Sale · Metrc {sandbox ? "Sandbox" : "Live"}
          </div>
          {loading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : (
            <Select
              value={selectedLicense ?? undefined}
              onValueChange={setSelectedLicense}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select facility license" />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((f) => (
                  <SelectItem key={f.license_number} value={f.license_number}>
                    {`${facilityLabel(f.display_name, f.license_number, f.facility_name)} (${f.license_number})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            {facilities.length} facilities · {baseUrlHost}
            {onLicense && selectedLicense ? (
              <>
                {" "}
                ·{" "}
                <Link
                  href={`/metrc/${encodeURIComponent(selectedLicense)}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Dashboard
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={() => void refreshFacilities(true)}
        >
          {syncing ? "Syncing…" : "Sync facilities"}
        </Button>
      </div>
    </div>
  );
}
