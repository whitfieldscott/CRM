"use client";

import { LicensedTransfersPage } from "@/components/metrc/licensed-transfers-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcLicensedTransfersPage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return <LicensedTransfersPage license={license} />;
}
