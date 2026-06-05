"use client";

import { WorkflowPlaceholderPage } from "@/components/metrc/workflow-placeholder-page";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcInactivePage() {
  const license = useMetrcLicenseParam();

  if (!license) return null;

  return (
    <WorkflowPlaceholderPage
      title="Inactive"
      description="Plants that are harvested, destroyed, or no longer active."
      emptyTitle="No inactive plants"
      emptyBody="Inactive plant records will appear here when the Plants module is connected."
    />
  );
}
