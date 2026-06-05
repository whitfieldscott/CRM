/** Metrc-inspired phase workflow actions (UI structure only). */

export type GrowerPhaseId = "immature" | "veg" | "flower" | "harvest";

export type PhaseAction = {
  id: string;
  label: string;
  group?: "action" | "status";
};

export const WORKFLOW_STATUS_ACTIONS: PhaseAction[] = [
  { id: "on-hold", label: "On Hold", group: "status" },
  { id: "inactive", label: "Inactive", group: "status" },
];

export const IMMATURE_ACTIONS: PhaseAction[] = [
  { id: "create-plantings", label: "Create Plantings" },
  { id: "create-packages", label: "Create Packages" },
  { id: "split-plantings", label: "Split Plantings" },
  { id: "rename", label: "Rename" },
  { id: "change-strains", label: "Change Strains" },
  { id: "change-location", label: "Change Location" },
  { id: "change-growth-phase", label: "Change Growth Phase" },
  { id: "destroy-plants", label: "Destroy Plants" },
  { id: "record-additives", label: "Record Additives" },
  { id: "record-waste", label: "Record Waste" },
];

export const VEG_ACTIONS: PhaseAction[] = [
  { id: "assign-tags", label: "Assign Tags" },
  { id: "replace-tags", label: "Replace Tags" },
  { id: "change-strains", label: "Change Strains" },
  { id: "change-location", label: "Change Location" },
  { id: "change-growth-phase", label: "Change Growth Phase" },
  { id: "changes-by-location", label: "Changes by Location" },
  { id: "destroy", label: "Destroy" },
  { id: "record-additives", label: "Record Additives" },
  { id: "record-waste", label: "Record Waste" },
  { id: "create-plantings", label: "Create Plantings" },
  { id: "create-packages", label: "Create Packages" },
  { id: "manicure", label: "Manicure" },
];

export const FLOWER_ACTIONS: PhaseAction[] = [
  { id: "replace-tags", label: "Replace Tags" },
  { id: "change-strains", label: "Change Strains" },
  { id: "change-location", label: "Change Location" },
  { id: "change-growth-phase", label: "Change Growth Phase" },
  { id: "changes-by-location", label: "Changes by Location" },
  { id: "destroy", label: "Destroy" },
  { id: "record-additives", label: "Record Additives" },
  { id: "record-waste", label: "Record Waste" },
  { id: "create-plantings", label: "Create Plantings" },
  { id: "create-immature-packages", label: "Create Immature Plant Packages" },
  { id: "manicure", label: "Manicure" },
  { id: "harvest", label: "Harvest" },
];

export const HARVEST_ACTIONS: PhaseAction[] = [
  { id: "create-packages", label: "Create Packages" },
  { id: "rename", label: "Rename" },
  { id: "change-location", label: "Change Location" },
  { id: "report-waste", label: "Report Waste" },
  { id: "finish", label: "Finish" },
  { id: "restore-all", label: "Restore All" },
];

export const PHASE_ACTIONS: Record<GrowerPhaseId, PhaseAction[]> = {
  immature: IMMATURE_ACTIONS,
  veg: VEG_ACTIONS,
  flower: FLOWER_ACTIONS,
  harvest: HARVEST_ACTIONS,
};

export function getPhaseMenuActions(phaseId: GrowerPhaseId): {
  workflow: PhaseAction[];
  status: PhaseAction[];
} {
  return {
    workflow: PHASE_ACTIONS[phaseId],
    status: WORKFLOW_STATUS_ACTIONS,
  };
}
