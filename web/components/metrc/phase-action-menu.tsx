"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GrowerPhaseId } from "@/lib/grower-phase-actions";
import { getPhaseMenuActions } from "@/lib/grower-phase-actions";
import { toast } from "sonner";

type PhaseActionMenuProps = {
  phaseId: GrowerPhaseId;
  title: string;
  description: string;
};

export function PhaseActionMenu({
  phaseId,
  title,
  description,
}: PhaseActionMenuProps) {
  const { workflow, status } = getPhaseMenuActions(phaseId);

  const handleAction = (actionLabel: string) => {
    toast.info(`${actionLabel} — coming soon`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between px-0 py-0 text-left hover:bg-transparent"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-base font-semibold text-foreground">
              {title}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {description}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{title} actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workflow.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onSelect={() => handleAction(action.label)}
          >
            <span>{action.label}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Workflow status
        </DropdownMenuLabel>
        {status.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onSelect={() => handleAction(action.label)}
          >
            <span>{action.label}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
