"use client";

import { WorkflowPlaceholderPage } from "@/components/metrc/workflow-placeholder-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcOnHoldPage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return (
    <WorkflowPlaceholderPage
      title="On Hold"
      description="Plants temporarily held from normal workflow."
      emptyTitle="No plants on hold"
      emptyBody="Held plant records will appear here when the Plants module is connected."
    />
  );
}
