/** License-scoped Seed-To-Sale route helpers. */

import { isAdminRoute } from "@/lib/metrc-admin-routes";
import { isTransfersRoute } from "@/lib/metrc-transfer-routes";

export type GrowerSubNavId =
  | "overview"
  | "plants"
  | "harvests"
  | "packages"
  | "transfers"
  | "locations"
  | "strains"
  | "items"
  | "admin";

export type GrowerSubNavItem = {
  id: GrowerSubNavId;
  label: string;
  segment: string;
  enabled: boolean;
};

export const GROWER_SUB_NAV: GrowerSubNavItem[] = [
  { id: "overview", label: "Overview", segment: "", enabled: true },
  { id: "plants", label: "Plants", segment: "plants", enabled: false },
  { id: "harvests", label: "Harvests", segment: "harvests", enabled: false },
  { id: "packages", label: "Packages", segment: "packages", enabled: false },
  { id: "transfers", label: "Transfers", segment: "transfers/licensed", enabled: true },
  { id: "locations", label: "Locations", segment: "locations", enabled: true },
  { id: "strains", label: "Strains", segment: "strains", enabled: true },
  { id: "items", label: "Items", segment: "items", enabled: true },
];

export function parseLicenseFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/metrc\/([^/]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Path after license segment, e.g. "" or "/locations". */
export function getLicensePathSuffix(pathname: string): string {
  const match = pathname.match(/^\/metrc\/[^/]+(\/.*)?$/);
  return match?.[1] ?? "";
}

export function growerHref(license: string, segment: string): string {
  const base = `/metrc/${encodeURIComponent(license)}`;
  return segment ? `${base}/${segment}` : base;
}

export function activeGrowerSubNavId(pathname: string): GrowerSubNavId {
  if (isAdminRoute(pathname)) return "admin";

  const suffix = getLicensePathSuffix(pathname);
  if (!suffix || suffix === "/") return "overview";

  if (isTransfersRoute(pathname)) return "transfers";

  const segment = suffix.replace(/^\//, "").split("/")[0] ?? "";
  const item = GROWER_SUB_NAV.find((nav) => nav.segment === segment);
  if (item) return item.id;

  const nestedItem = GROWER_SUB_NAV.find((nav) => {
    if (!nav.segment.includes("/")) return false;
    return suffix.replace(/^\//, "").startsWith(nav.segment);
  });
  if (nestedItem) return nestedItem.id;

  return "overview";
}
