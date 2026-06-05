"use client";

import type { ReactNode } from "react";
import { MetrcFacilityProvider } from "@/components/metrc/metrc-facility-context";
import { MetrcWorkspaceChrome } from "@/components/metrc/metrc-workspace-chrome";

export default function MetrcLayout({ children }: { children: ReactNode }) {
  return (
    <MetrcFacilityProvider>
      <MetrcWorkspaceChrome />
      <div className="px-4 py-3 md:px-6">{children}</div>
    </MetrcFacilityProvider>
  );
}
