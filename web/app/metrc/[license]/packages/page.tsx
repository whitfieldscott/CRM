"use client";

import { PackagesPage } from "@/components/metrc/packages-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcPackagesPage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return <PackagesPage />;
}
