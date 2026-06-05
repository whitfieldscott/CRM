"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { transferHref } from "@/lib/metrc-transfer-routes";
import { useMetrcLicenseParam } from "@/hooks/use-metrc-license-param";

export default function MetrcTransfersIndexPage() {
  const license = useMetrcLicenseParam();
  const router = useRouter();

  useEffect(() => {
    if (!license) return;
    router.replace(transferHref(license, "licensed"));
  }, [license, router]);

  return null;
}
