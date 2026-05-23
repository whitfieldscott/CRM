import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeScript } from "@/components/theme/theme-script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CannaCore | Operations",
  description: "Cannabis operations platform by ArkOne Systems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={inter.className}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
