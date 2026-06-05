"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import "@/styles/cannacore.css";

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: string;
  match?: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    href: "/",
    label: "Dashboard",
    icon: "🏠",
    match: (p) => p === "/",
  },
  {
    id: "seed-to-sale",
    href: "/metrc",
    label: "Seed-To-Sale",
    icon: "🌿",
    match: (p) => p.startsWith("/metrc"),
  },
  {
    id: "invoices",
    href: "/invoices",
    label: "Invoices",
    icon: "🧾",
    match: (p) => p.startsWith("/invoices"),
  },
  {
    id: "package-prep",
    href: "/package-prep",
    label: "Package Prepping",
    icon: "📦",
    match: (p) => p.startsWith("/package-prep"),
  },
  {
    id: "crm",
    href: "/crm",
    label: "CRM",
    icon: "👥",
    match: (p) =>
      p.startsWith("/crm") ||
      p.startsWith("/contacts") ||
      p.startsWith("/clients"),
  },
  {
    id: "marketing",
    href: "/marketing-campaigns",
    label: "Marketing Campaigns",
    icon: "📣",
    match: (p) =>
      p.startsWith("/marketing-campaigns") ||
      p.startsWith("/campaigns") ||
      p.startsWith("/email-history") ||
      p.startsWith("/text-campaign") ||
      p.startsWith("/text-history") ||
      p === "/marketing",
  },
  {
    id: "analytics",
    href: "/analytics",
    label: "Analytics",
    icon: "📊",
    match: (p) => p.startsWith("/analytics") || p === "/marketing",
  },
  {
    id: "calendar",
    href: "/calendar",
    label: "Calendar",
    icon: "🗓️",
    match: (p) => p.startsWith("/calendar"),
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    icon: "⚙️",
    match: (p) => p.startsWith("/settings"),
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="cannacore-nav">
      {NAV_ITEMS.map((item) => {
        const active = item.match
          ? item.match(pathname)
          : pathname === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={cn("cannacore-nav-item", active && "active")}
          >
            <span className="cannacore-nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <>
      <section className="cannacore-omma-card">
        <div className="cannacore-omma-header">
          <span>🔔 OMMA Notifications</span>
          <span className="cannacore-omma-badge">0</span>
        </div>
        <div className="cannacore-omma-empty">
          Connect OMMA alert emails or an approved notification feed to populate
          advisories, rule changes, testing updates, and compliance notices here.
        </div>
        <Link href="#" className="cannacore-omma-link">
          View all notifications →
        </Link>
      </section>

      <section className="cannacore-user-card">
        <div className="cannacore-avatar">👤</div>
        <div>
          <div className="cannacore-user-name">User Name</div>
          <div className="cannacore-user-role">Administrator</div>
        </div>
        <div className="cannacore-user-caret">⌄</div>
      </section>
    </>
  );
}

function SidebarBrand() {
  return (
    <div className="cannacore-brand">
      <div className="cannacore-brand-mark">🌿</div>
      <div>
        <div className="cannacore-brand-title">
          Canna<span>Core</span>
        </div>
        <div className="cannacore-brand-subtitle">by ArkOne Systems</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hasTopbar =
    pathname === "/" ||
    pathname === "/crm" ||
    pathname.startsWith("/marketing-campaigns");

  return (
    <div className="cannacore-app">
      <aside className="cannacore-sidebar hidden md:flex">
        <SidebarBrand />
        <SidebarNav />
        <div className="cannacore-sidebar-spacer" />
        <SidebarFooter />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border-theme/40 px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] border-border-theme/40 bg-sidebar-bg p-0 text-text-primary"
            >
              <div className="flex h-full flex-col p-6">
                <SidebarBrand />
                <SidebarNav onNavigate={() => setOpen(false)} />
                <div className="cannacore-sidebar-spacer" />
                <SidebarFooter />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-text-primary">CannaCore</span>
          <ThemeToggle className="cannacore-mobile-theme" />
        </header>

        <main className="cannacore-main min-w-0 flex-1">
          {!hasTopbar ? (
            <div className="cannacore-global-theme-bar">
              <ThemeToggle />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
