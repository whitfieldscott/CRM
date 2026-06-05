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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  activeTransferSection,
  isTransfersRoute,
  TRANSFER_MENU_ITEMS,
  transferHref,
} from "@/lib/metrc-transfer-routes";
import { parseLicenseFromPath } from "@/lib/metrc-routes";
import { cn } from "@/lib/utils";

export function GrowerTransfersNav() {
  const pathname = usePathname();
  const license = parseLicenseFromPath(pathname);
  const isActive = isTransfersRoute(pathname);
  const activeSection = activeTransferSection(pathname);

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
          Transfers
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          {TRANSFER_MENU_ITEMS.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={transferHref(license, item.id)}
                className={cn(
                  activeSection === item.id && "bg-accent font-medium",
                )}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
