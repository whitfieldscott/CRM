/** License-scoped transfer workflow routes and table definitions. */

export type TransferSectionId = "licensed" | "templates" | "external";

export type TransferTabId =
  | "incoming"
  | "inactive"
  | "outgoing"
  | "rejected"
  | "external-incoming"
  | "external-inactive";

export type TransferMenuItem = {
  id: TransferSectionId;
  label: string;
  segment: string;
  pageTitle: string;
  description: string;
  emptyMessage: string;
};

export const TRANSFER_MENU_ITEMS: TransferMenuItem[] = [
  {
    id: "licensed",
    label: "Licensed",
    segment: "licensed",
    pageTitle: "Licensed Transfers",
    description:
      "Facility-to-facility licensed transfers, manifests, and delivery confirmation.",
    emptyMessage: "No transfers available.",
  },
  {
    id: "templates",
    label: "Templates",
    segment: "templates",
    pageTitle: "Licensed Transfer Templates",
    description: "Saved transfer configurations for recurring licensed shipments.",
    emptyMessage: "No templates available.",
  },
  {
    id: "external",
    label: "External",
    segment: "external",
    pageTitle: "External Transfers",
    description:
      "Out-of-state and external manifest workflows for incoming shipments.",
    emptyMessage: "No external transfers available.",
  },
];

export const LICENSED_TRANSFER_TABS: { id: TransferTabId; label: string }[] = [
  { id: "incoming", label: "Incoming" },
  { id: "inactive", label: "Inactive" },
  { id: "outgoing", label: "Outgoing" },
  { id: "rejected", label: "Rejected" },
];

export const EXTERNAL_TRANSFER_TABS: { id: TransferTabId; label: string }[] = [
  { id: "external-incoming", label: "Incoming" },
  { id: "external-inactive", label: "Inactive" },
];

export const LICENSED_TRANSFER_TABLE_HEADERS = [
  "Manifest",
  "Manifest Number",
  "Origin",
  "Type",
  "Package Count",
  "Estimated Departure",
  "Actual Departure",
  "Estimated Arrival",
  "Actual Arrival",
  "Received",
  "Estimated Receipt Date",
  "Actual Receipt Date",
  "Estimated Return Arrival",
  "Actual Return Arrival",
] as const;

export const TRANSFER_TEMPLATE_TABLE_HEADERS = [
  "Template",
  "Manifest",
  "Destination",
  "Stops",
  "Packages",
  "Date Created",
] as const;

export const EXTERNAL_TRANSFER_TABLE_HEADERS = [
  "Manifest",
  "Origin",
  "Type",
  "Package Count",
  "Estimated Arrival",
  "Actual Arrival",
  "Received",
] as const;

export function isTransfersRoute(pathname: string): boolean {
  return /\/transfers(\/|$)/.test(pathname);
}

export function activeTransferSection(pathname: string): TransferSectionId | null {
  const match = pathname.match(/\/transfers\/(licensed|templates|external)(?:\/|$)/);
  if (!match?.[1]) return null;
  return match[1] as TransferSectionId;
}

export function transferHref(
  license: string,
  section: TransferSectionId,
): string {
  return `/metrc/${encodeURIComponent(license)}/transfers/${section}`;
}

export function getTransferMenuItem(
  section: TransferSectionId,
): TransferMenuItem {
  const item = TRANSFER_MENU_ITEMS.find((entry) => entry.id === section);
  if (!item) {
    return TRANSFER_MENU_ITEMS[0];
  }
  return item;
}
