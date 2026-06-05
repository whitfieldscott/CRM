"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

export function useMetrcLicenseParam(): string {
  const params = useParams();
  return useMemo(() => {
    const raw = params.license;
    if (typeof raw === "string") return decodeURIComponent(raw);
    if (Array.isArray(raw) && raw[0]) return decodeURIComponent(raw[0]);
    return "";
  }, [params.license]);
}
