"use client";

import type { ReactNode } from "react";
import { MetrcFacilityProvider } from "@/components/metrc/metrc-facility-context";
import { MetrcFacilityBar } from "@/components/metrc/facility-bar";

export default function MetrcLayout({ children }: { children: ReactNode }) {
  return (
    <MetrcFacilityProvider>
      <MetrcFacilityBar />
      <div className="px-4 py-6 md:px-6">{children}</div>
    </MetrcFacilityProvider>
  );
}
