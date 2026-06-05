"use client";

import { TransferTemplatesPage } from "@/components/metrc/transfer-templates-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcTransferTemplatesPage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return <TransferTemplatesPage />;
}
