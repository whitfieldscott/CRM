"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_MENU_GROUPS,
  adminHref,
  isAdminRoute,
} from "@/lib/metrc-admin-routes";
import { parseLicenseFromPath } from "@/lib/metrc-routes";
import { cn } from "@/lib/utils";

export function GrowerAdminNav() {
  const pathname = usePathname();
  const license = parseLicenseFromPath(pathname);
  const isActive = isAdminRoute(pathname);

  if (!license) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "inline-flex h-auto shrink-0 items-center gap-1 rounded-none border-b-2 px-3 py-3 text-sm font-medium hover:bg-transparent",
            isActive
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Admin
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {ADMIN_MENU_GROUPS.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {group.items.map((item) => (
                <DropdownMenuItem key={item.slug} asChild>
                  <Link href={adminHref(license, item.slug)}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
