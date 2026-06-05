"use client";

import { GrowerOverviewShell } from "@/components/metrc/grower-overview-shell";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcGrowerOverviewPage() {
  const licenseNumber = useMetrcLicenseParam();

  if (!licenseNumber) return null;

  return (
    <div className="mx-auto max-w-[1600px]">
      <GrowerOverviewShell />
    </div>
  );
}
