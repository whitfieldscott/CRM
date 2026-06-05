/** License-scoped package workflow routes and table definitions. */

export type PackageTabId =
  | "active"
  | "on-hold"
  | "inactive"
  | "in-transit"
  | "transferred"
  | "product-labels"
  | "staged-product-labels";

export type PackageWorkflowAction = {
  label: string;
  variant?: "default" | "outline";
};

export type PackageTabConfig = {
  id: PackageTabId;
  label: string;
  headers: readonly string[];
  emptyMessage: string;
  actions: PackageWorkflowAction[];
};

export const PACKAGE_TABLE_HEADERS = [
  "Tag",
  "Source Harvests",
  "Source Packages",
  "Original Source Package Label",
  "Source Plants",
  "Location",
  "Sublocation",
  "Item",
  "Category",
  "Item Strain",
  "Quantity",
  "Unit of Measure",
  "Lab Testing Status",
  "Production Batch Number",
  "Expiration Date",
  "Received Date",
  "Last Modified",
] as const;

export const PACKAGE_LABEL_TABLE_HEADERS = [
  "Label",
  "Package Tag",
  "Item",
  "Category",
  "Quantity",
  "Unit of Measure",
  "Date Created",
  "Status",
] as const;

export const ACTIVE_PACKAGE_ACTIONS: PackageWorkflowAction[] = [
  { label: "New Packages" },
  { label: "Submit for Testing" },
  { label: "Remediate" },
  { label: "Create Plantings" },
  { label: "Unpack Plants" },
  { label: "New Transfer" },
  { label: "Change Locations" },
  { label: "Change Items" },
  { label: "Change Required Lab Testing Batches" },
  { label: "Adjust" },
  { label: "Return" },
  { label: "Change Notes" },
  { label: "Finish" },
];

export const PRODUCT_LABEL_ACTIONS: PackageWorkflowAction[] = [
  { label: "Print Labels" },
  { label: "Reprint Labels" },
  { label: "Stage Product Labels" },
  { label: "Download Labels" },
];

export const PACKAGE_TABS: PackageTabConfig[] = [
  {
    id: "active",
    label: "Active",
    headers: PACKAGE_TABLE_HEADERS,
    emptyMessage: "No active packages available.",
    actions: ACTIVE_PACKAGE_ACTIONS,
  },
  {
    id: "on-hold",
    label: "On Hold",
    headers: PACKAGE_TABLE_HEADERS,
    emptyMessage: "No packages on hold available.",
    actions: [],
  },
  {
    id: "inactive",
    label: "Inactive",
    headers: PACKAGE_TABLE_HEADERS,
    emptyMessage: "No inactive packages available.",
    actions: [],
  },
  {
    id: "in-transit",
    label: "In Transit",
    headers: PACKAGE_TABLE_HEADERS,
    emptyMessage: "No packages in transit available.",
    actions: [],
  },
  {
    id: "transferred",
    label: "Transferred",
    headers: PACKAGE_TABLE_HEADERS,
    emptyMessage: "No transferred packages available.",
    actions: [],
  },
  {
    id: "product-labels",
    label: "Product Labels",
    headers: PACKAGE_LABEL_TABLE_HEADERS,
    emptyMessage: "No product labels available.",
    actions: PRODUCT_LABEL_ACTIONS,
  },
  {
    id: "staged-product-labels",
    label: "Staged Product Labels",
    headers: PACKAGE_LABEL_TABLE_HEADERS,
    emptyMessage: "No staged product labels available.",
    actions: [],
  },
];

export const DEFAULT_PACKAGE_TAB_ID: PackageTabId = "active";

export function packageHref(license: string): string {
  return `/metrc/${encodeURIComponent(license)}/packages`;
}
