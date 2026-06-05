"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";

type GrowerPageHeaderProps = {
  title: string;
  subtitle: string;
  license: string;
  actions?: React.ReactNode;
};

export function GrowerPageHeader({
  title,
  subtitle,
  license,
  actions,
}: GrowerPageHeaderProps) {
  const { facilities, loading, sandbox, baseUrlHost } = useMetrcFacility();

  const facility = facilities.find((f) => f.license_number === license) ?? null;
  const facilityLabel =
    facility?.display_name?.trim() ||
    facility?.facility_name?.trim() ||
    license;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {loading && !facility ? (
          <>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-4 w-96" />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{facilityLabel}</span>
              {" · "}
              <span className="font-mono">{license}</span>
              {facility?.license_type ? ` · ${facility.license_type}` : ""}
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
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
