"use client";

import { notFound } from "next/navigation";
import { useParams } from "next/navigation";
import { WorkflowPlaceholderPage } from "@/components/metrc/workflow-placeholder-page";
import { getAdminMenuItem } from "@/lib/metrc-admin-routes";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcAdminPlaceholderPage() {
  const license = useMetrcLicenseParam();
  const params = useParams();
  const raw = params.slug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const item = slug ? getAdminMenuItem(slug) : null;

  if (!license || !item) {
    notFound();
  }

  return (
    <WorkflowPlaceholderPage
      title={item.title}
      description={item.description}
      emptyTitle={item.emptyTitle}
      emptyBody={item.emptyBody}
      comingSoon
    />
  );
}
