"use client";

import { MasterDataEntityPage } from "@/components/metrc/master-data-entity-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcStrainsPage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return <MasterDataEntityPage license={license} entity="strains" />;
}
