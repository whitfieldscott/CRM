"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Users,
  Building2,
  Megaphone,
  BarChart2,
  Settings,
  Menu,
  Leaf,
  ChevronRight,
  ChevronDown,
  FileText,
  MessageSquare,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useMemo, useState, type ComponentType } from "react";

type IconComp = ComponentType<{ className?: string }>;

type NavLeaf = {
  kind: "leaf";
  id: string;
  href: string;
  label: string;
  icon?: IconComp;
  hidden?: boolean;
};

type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  hidden?: boolean;
  children: NavLeaf[];
};

type NavSection = {
  kind: "section";
  id: string;
  label: string;
  icon: IconComp;
  /** When set, the section title row links here (e.g. /contacts) */
  parentHref?: string;
  hidden?: boolean;
  children: (NavLeaf | NavGroup)[];
};

type NavTop =
  | { kind: "link"; id: string; href: string; label: string; icon: IconComp }
  | NavSection;

const NAV: NavTop[] = [
  { kind: "link", id: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    kind: "section",
    id: "contacts",
    label: "Contacts",
    icon: Users,
    parentHref: "/contacts",
    children: [
      {
        kind: "leaf",
        id: "contacts-clients",
        href: "/clients",
        label: "Clients",
        icon: Building2,
      },
      {
        kind: "leaf",
        id: "contacts-calendar",
        href: "/calendar",
        label: "Calendar",
        hidden: true,
      },
    ],
  },
  {
    kind: "section",
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    parentHref: "/marketing",
    children: [
      {
        kind: "leaf",
        id: "marketing-email-setup",
        href: "/email",
        label: "Email - Campaign Setup",
        icon: Mail,
      },
      {
        kind: "leaf",
        id: "marketing-email-history",
        href: "/campaigns",
        label: "Email - Campaign History",
        icon: Megaphone,
      },
      {
        kind: "leaf",
        id: "marketing-email-templates",
        href: "/email/templates",
        label: "Email - Campaign Templates",
        icon: FileText,
        hidden: true,
      },
      {
        kind: "leaf",
        id: "marketing-text-setup",
        href: "/text-campaign",
        label: "Text - Campaign Setup",
        icon: MessageSquare,
      },
      {
        kind: "leaf",
        id: "marketing-text-history",
        href: "/text-history",
        label: "Text - Campaign History",
        icon: MessageSquare,
      },
      {
        kind: "leaf",
        id: "marketing-text-templates",
        href: "/text/campaigns/templates",
        label: "Text - Campaign Templates",
        icon: MessageSquare,
        hidden: true,
      },
      /** Preserves existing /marketing analytics route; hidden until listed in nav spec */
      {
        kind: "leaf",
        id: "marketing-email-analytics",
        href: "/marketing",
        label: "Email - Analytics",
        icon: BarChart2,
        hidden: true,
      },
    ],
  },
  {
    kind: "section",
    id: "metro",
    label: "Metro",
    icon: MapPin,
    hidden: true,
    children: [
      {
        kind: "group",
        id: "metro-grow",
        label: "Grow",
        children: [
          { kind: "leaf", id: "metro-grow-invoices", href: "/metro/grow/invoices", label: "Invoices" },
          { kind: "leaf", id: "metro-grow-log", href: "/metro/grow/log", label: "Log Page" },
        ],
      },
      {
        kind: "group",
        id: "metro-processor",
        label: "Processor",
        children: [
          { kind: "leaf", id: "metro-processor-invoices", href: "/metro/processor/invoices", label: "Invoices" },
          { kind: "leaf", id: "metro-processor-log", href: "/metro/processor/log", label: "Log Page" },
        ],
      },
      {
        kind: "group",
        id: "metro-dispensary",
        label: "Dispensary",
        children: [
          { kind: "leaf", id: "metro-dispensary-invoices", href: "/metro/dispensary/invoices", label: "Invoices" },
          { kind: "leaf", id: "metro-dispensary-log", href: "/metro/dispensary/log", label: "Log Page" },
        ],
      },
      {
        kind: "group",
        id: "metro-transporter",
        label: "Transporter",
        children: [
          { kind: "leaf", id: "metro-transporter-invoices", href: "/metro/transporter/invoices", label: "Invoices" },
          { kind: "leaf", id: "metro-transporter-log", href: "/metro/transporter/log", label: "Log Page" },
        ],
      },
    ],
  },
  { kind: "link", id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

function pathMatches(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function leafActive(leaf: NavLeaf, pathname: string): boolean {
  return pathMatches(leaf.href, pathname);
}

function groupHasActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((l) => leafActive(l, pathname));
}

function sectionHasActive(section: NavSection, pathname: string): boolean {
  if (section.parentHref && pathMatches(section.parentHref, pathname)) return true;
  for (const ch of section.children) {
    if (ch.kind === "leaf" && leafActive(ch, pathname)) return true;
    if (ch.kind === "group" && groupHasActive(ch, pathname)) return true;
  }
  return false;
}

function navConfigHasActive(top: NavTop, pathname: string): boolean {
  if (top.kind === "link") return pathMatches(top.href, pathname);
  return sectionHasActive(top, pathname);
}

function computeDefaultOpen(pathname: string): Set<string> {
  const s = new Set<string>();
  for (const item of NAV) {
    if (item.kind === "section" && !item.hidden && navConfigHasActive(item, pathname)) {
      s.add(item.id);
    }
  }
  return s;
}

function filterVisibleLeaves(g: NavGroup): NavGroup | null {
  const vis = g.children.filter((l) => !l.hidden);
  if (vis.length === 0) return null;
  return { ...g, children: vis };
}

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    computeDefaultOpen(pathname)
  );

  useEffect(() => {
    setOpenSections((prev) => {
      const next = computeDefaultOpen(pathname);
      const merged = new Set(prev);
      next.forEach((id) => merged.add(id));
      return merged;
    });
  }, [pathname]);

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const topItemsVisible = useMemo(
    () => NAV.filter((t) => !(t.kind === "section" && t.hidden)),
    []
  );

  const renderLeaf = (leaf: NavLeaf, indentClass: string) => {
    if (leaf.hidden) return null;
    const active = leafActive(leaf, pathname);
    const Icon = leaf.icon;
    return (
      <Link
        key={leaf.id}
        href={leaf.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-lg py-2 pr-2 text-sm font-medium transition-colors",
          indentClass,
          active ? "bg-[#2d6e3e]/20 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" /> : null}
        <span>{leaf.label}</span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup, depth: number) => {
    const g = filterVisibleLeaves(group);
    if (!g) return null;
    const indent = depth === 0 ? "pl-3" : "pl-6";
    return (
      <div key={g.id} className={cn("space-y-0.5 border-l border-slate-700/80", indent)}>
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {g.label}
        </p>
        {g.children.map((leaf) => renderLeaf(leaf, "pl-2"))}
      </div>
    );
  };

  const renderSection = (section: NavSection) => {
    if (section.hidden) return null;
    const isOpen = openSections.has(section.id);
    const anyActive = sectionHasActive(section, pathname);
    const parentLinkActive =
      Boolean(section.parentHref) && pathMatches(section.parentHref!, pathname);
    const Icon = section.icon;

    const visibleChildren = section.children
      .map((ch) => {
        if (ch.kind === "leaf") {
          return ch.hidden ? null : ch;
        }
        return filterVisibleLeaves(ch);
      })
      .filter(Boolean) as (NavLeaf | NavGroup)[];

    return (
      <div key={section.id} className="space-y-1">
        <div
          className={cn(
            "flex items-stretch gap-0 rounded-lg",
            anyActive && !isOpen ? "bg-[#2d6e3e]/10" : ""
          )}
        >
          {section.parentHref ? (
            <Link
              href={section.parentHref}
              onClick={onNavigate}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-sm font-medium transition-colors",
                parentLinkActive
                  ? "bg-[#2d6e3e]/20 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              <span className="truncate">{section.label}</span>
            </Link>
          ) : (
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-sm font-medium",
                anyActive
                  ? "bg-[#2d6e3e]/20 text-white"
                  : "text-slate-300"
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              <span className="truncate">{section.label}</span>
            </div>
          )}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`nav-section-${section.id}`}
            onClick={() => toggle(section.id)}
            className={cn(
              "flex w-10 shrink-0 items-center justify-center rounded-r-lg border-l border-slate-800/80 text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
              isOpen && "text-white"
            )}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {isOpen && (
          <div id={`nav-section-${section.id}`} className="space-y-1 pl-2 pt-0.5">
            {visibleChildren.map((ch) => {
              if (ch.kind === "leaf") return renderLeaf(ch, "pl-7");
              return <div key={ch.id}>{renderGroup(ch, 0)}</div>;
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={cn("flex flex-col gap-2", className)}>
      {topItemsVisible.map((item) => {
        if (item.kind === "link") {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#2d6e3e]/20 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              {item.label}
            </Link>
          );
        }
        return renderSection(item);
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
