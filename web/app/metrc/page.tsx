"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";

export default function MetrcIndexPage() {
  const router = useRouter();
  const { facilities, selectedLicense, loading } = useMetrcFacility();

  useEffect(() => {
    if (!loading && selectedLicense) {
      router.replace(`/metrc/${encodeURIComponent(selectedLicense)}`);
    }
  }, [loading, selectedLicense, router]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Seed-To-Sale</h1>
      <p className="text-muted-foreground">
        Select a facility license in the upper right to open the grower workspace.
      </p>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : facilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No facilities loaded. Use <strong>Sync facilities</strong> and confirm
          Metrc credentials are set in backend <code className="text-xs">.env</code>.
        </p>
      ) : null}
    </div>
  );
}
