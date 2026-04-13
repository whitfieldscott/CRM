"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Users,
  Building2,
  History,
  Settings,
  Menu,
  Leaf,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/email", label: "Email Blaster", icon: Mail },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/campaigns", label: "Campaign History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-[#2d6e3e]/20 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="h-5 w-5 shrink-0 opacity-90" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2d6e3e]">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">
              Rooted Dominion
            </p>
            <p className="text-xs text-slate-400">Operations</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <NavLinks />
        </div>
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">
          Licensed Oklahoma cannabis operations
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col bg-muted/40">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-slate-800 bg-[hsl(var(--sidebar))] p-0 text-white">
              <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2d6e3e]">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold">Rooted Dominion</span>
              </div>
              <div className="p-4">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-foreground">Rooted Dominion</span>
        </header>

        <main className="flex-1 bg-white p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
