"use client";

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
  const {
    facilities,
    selectedLicense,
    loading,
    syncing,
    sandbox,
    setSelectedLicense,
    refreshFacilities,
  } = useMetrcFacility();

  return (
    <header className="border-b border-border-theme/40 bg-card/30 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Seed-To-Sale
          </h2>
          <p className="text-xs text-muted-foreground">
            Grower workspace · Metrc {sandbox ? "Sandbox" : "Live"}
            {facilities.length > 0 ? ` · ${facilities.length} facilities` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {loading ? (
            <Skeleton className="h-9 w-[220px]" />
          ) : (
            <Select
              value={selectedLicense ?? undefined}
              onValueChange={setSelectedLicense}
            >
              <SelectTrigger className="w-[220px] sm:w-[260px]">
                <SelectValue placeholder="Select license" />
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
    </header>
  );
}
