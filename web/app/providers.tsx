"use client";

import { Toaster } from "sonner";
import { ThemeSync } from "@/components/theme/theme-toggle";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeSync />
      {children}
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}
