"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GrowerAdminNav } from "@/components/metrc/grower-admin-nav";
import { GrowerTransfersNav } from "@/components/metrc/grower-transfers-nav";
import {
  activeGrowerSubNavId,
  GROWER_SUB_NAV,
  growerHref,
  parseLicenseFromPath,
} from "@/lib/metrc-routes";

export function GrowerSubNav({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const license = parseLicenseFromPath(pathname);

  if (!license) return null;

  const activeId = activeGrowerSubNavId(pathname);

  return (
    <nav
      className={embedded ? undefined : "border-b border-border-theme/40 bg-card/20"}
      aria-label="Grower workspace"
    >
      <div
        className={
          embedded
            ? "flex gap-1 overflow-x-auto"
            : "mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 md:px-6"
        }
      >
        {GROWER_SUB_NAV.map((item) => {
          if (item.id === "transfers") {
            return <GrowerTransfersNav key={item.id} />;
          }

          const isActive = item.id === activeId;
          const className = cn(
            "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
            isActive
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
            !item.enabled && "cursor-default opacity-70",
          );

          if (!item.enabled) {
            return (
              <span key={item.id} className={className} aria-disabled="true">
                {item.label}
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                  Soon
                </Badge>
              </span>
            );
          }

          return (
            <Link
              key={item.id}
              href={growerHref(license, item.segment)}
              className={className}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
        <GrowerAdminNav />
      </div>
    </nav>
  );
}
