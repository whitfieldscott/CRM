"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhaseActionMenu } from "@/components/metrc/phase-action-menu";
import type { GrowerPhaseId } from "@/lib/grower-phase-actions";

type PhaseColumn = {
  id: GrowerPhaseId | "inventory";
  title: string;
  description: string;
  accentClass: string;
  emptyTitle: string;
  emptyBody: string;
  hasActionMenu: boolean;
};

const PHASE_COLUMNS: PhaseColumn[] = [
  {
    id: "immature",
    title: "Immature",
    description: "Plant batches and clones by room",
    accentClass: "border-emerald-500/50 bg-emerald-500/5",
    emptyTitle: "No immature plants in any room",
    emptyBody:
      "Plant batches will appear inside grow rooms once plantings are created.",
    hasActionMenu: true,
  },
  {
    id: "veg",
    title: "Veg",
    description: "Vegetative and mother plants",
    accentClass: "border-lime-500/50 bg-lime-500/5",
    emptyTitle: "No vegetative plants",
    emptyBody:
      "Tagged vegetative and mother plants will appear by room once the Plants module is connected.",
    hasActionMenu: true,
  },
  {
    id: "flower",
    title: "Flower",
    description: "Flowering tagged plants",
    accentClass: "border-violet-500/50 bg-violet-500/5",
    emptyTitle: "No flowering plants",
    emptyBody:
      "Flowering plants will appear by room once growth phases are tracked in Metrc.",
    hasActionMenu: true,
  },
  {
    id: "harvest",
    title: "Harvest",
    description: "Wet and dry harvest weight",
    accentClass: "border-amber-500/50 bg-amber-500/5",
    emptyTitle: "No active harvests",
    emptyBody:
      "Harvest records and room weights will appear here after harvest workflows are enabled.",
    hasActionMenu: true,
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Packages and bulk inventory",
    accentClass: "border-sky-500/50 bg-sky-500/5",
    emptyTitle: "No package inventory",
    emptyBody:
      "Packaged inventory will appear here after Packages are synced from Metrc.",
    hasActionMenu: false,
  },
];

export function GrowerOverviewShell() {
  return (
    <div className="grid min-h-[calc(100vh-220px)] gap-3 lg:grid-cols-5 lg:gap-4">
      {PHASE_COLUMNS.map((phase) => (
        <Card
          key={phase.id}
          className={`flex min-h-[420px] flex-col border-t-4 ${phase.accentClass}`}
        >
          <CardHeader className="shrink-0 space-y-1 pb-3 pt-4">
            {phase.hasActionMenu ? (
              <PhaseActionMenu
                phaseId={phase.id as GrowerPhaseId}
                title={phase.title}
                description={phase.description}
              />
            ) : (
              <>
                <CardTitle className="text-base font-semibold">{phase.title}</CardTitle>
                <CardDescription className="text-xs">{phase.description}</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              <div className="rounded-md border border-dashed border-border-theme/60 bg-background/40 p-4">
                <p className="text-sm font-medium text-foreground">{phase.emptyTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {phase.emptyBody}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-center text-lg font-semibold tabular-nums text-muted-foreground">
              —
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
