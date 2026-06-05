"use client";

import { ExternalTransfersPage } from "@/components/metrc/external-transfers-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcExternalTransfersPage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return <ExternalTransfersPage />;
}
