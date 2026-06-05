"use client";

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
import { GrowerSubNav } from "@/components/metrc/grower-sub-nav";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";
import { parseLicenseFromPath } from "@/lib/metrc-routes";

function facilityLabel(display: string | null, license: string, name: string | null) {
  return display?.trim() || name?.trim() || license;
}

function LicenseControls({ license }: { license?: string }) {
  const {
    facilities,
    selectedLicense,
    loading,
    syncing,
    setSelectedLicense,
    refreshFacilities,
    refreshCurrentFacility,
  } = useMetrcFacility();

  const handleRefresh = () => {
    if (license) {
      void refreshCurrentFacility(license);
      return;
    }
    void refreshFacilities(true);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        onClick={handleRefresh}
      >
        {syncing
          ? "Refreshing…"
          : license
            ? "Refresh facility"
            : "Sync facilities"}
      </Button>
    </div>
  );
}

function WorkspaceStatusLine({ license }: { license: string }) {
  const { facilities, loading, sandbox, baseUrlHost } = useMetrcFacility();
  const facility = facilities.find((f) => f.license_number === license) ?? null;

  if (loading && !facility) {
    return <Skeleton className="ml-auto h-4 w-80 max-w-full" />;
  }

  return (
    <p className="text-right text-xs text-muted-foreground">
      Metrc {sandbox ? "sandbox" : "production"} · {baseUrlHost}
      {facility?.synced_at
        ? ` · facility synced ${new Date(facility.synced_at).toLocaleString()}`
        : ""}
    </p>
  );
}

function IndexHeader() {
  const { sandbox, facilities } = useMetrcFacility();

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
        <LicenseControls />
      </div>
    </header>
  );
}

export function MetrcWorkspaceChrome() {
  const pathname = usePathname();
  const license = parseLicenseFromPath(pathname);

  if (!license) {
    return <IndexHeader />;
  }

  return (
    <header className="border-b border-border-theme/40 bg-card/30">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 overflow-hidden">
            <GrowerSubNav embedded />
          </div>
          <div className="pb-2 lg:pb-0 lg:pt-2">
            <LicenseControls license={license} />
          </div>
        </div>
        <div className="border-t border-border-theme/30 py-2">
          <WorkspaceStatusLine license={license} />
        </div>
      </div>
    </header>
  );
}
