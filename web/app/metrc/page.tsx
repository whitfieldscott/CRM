"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : facilities.length === 0 ? (
        <p className="text-muted-foreground">
          No facilities loaded. Use <strong>Sync facilities</strong> above and confirm
          Metrc credentials are set in backend <code className="text-xs">.env</code>.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Select a facility from the dropdown above, or open{" "}
          <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
            Dashboard
          </Link>
          .
        </p>
      )}
    </div>
  );
}
