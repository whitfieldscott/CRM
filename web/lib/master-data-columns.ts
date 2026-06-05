/** Map cached Metrc master data to Metrc-aligned table columns. */

import type {
  MetrcItemRow,
  MetrcLocationRow,
  MetrcStrainRow,
} from "@/types/metrc";

const PLACEHOLDER = "—";

function formatGenetics(strain: MetrcStrainRow): string {
  const indica = strain.indica_percentage;
  const sativa = strain.sativa_percentage;
  if (indica == null && sativa == null) return PLACEHOLDER;
  const parts: string[] = [];
  if (indica != null) parts.push(`Indica ${indica}%`);
  if (sativa != null) parts.push(`Sativa ${sativa}%`);
  return parts.length > 0 ? parts.join(" / ") : PLACEHOLDER;
}

function formatLevel(value: number | null | undefined): string {
  return value != null ? String(value) : PLACEHOLDER;
}

export const LOCATION_TABLE_HEADERS = [
  "Location",
  "Location Type",
  "Sublocation Category",
  "Plant Batches",
  "Plants",
  "Harvests",
  "Packages",
] as const;

export function mapLocationRow(row: MetrcLocationRow): string[] {
  return [
    row.name ?? PLACEHOLDER,
    row.location_type_name ?? PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
  ];
}

export const STRAIN_TABLE_HEADERS = [
  "Strain",
  "Testing",
  "THC",
  "CBD",
  "Genetics",
  "Used",
] as const;

export function mapStrainRow(row: MetrcStrainRow): string[] {
  return [
    row.name ?? PLACEHOLDER,
    row.testing_status ?? PLACEHOLDER,
    formatLevel(row.thc_level),
    formatLevel(row.cbd_level),
    formatGenetics(row),
    PLACEHOLDER,
  ];
}

export const ITEM_TABLE_HEADERS = [
  "Item",
  "Category",
  "Type",
  "Quantity Type",
  "Default LTS",
  "UoM",
  "Strain",
  "CBD%",
  "CBD",
  "THC%",
  "THC",
  "Volume",
  "Weight",
  "Quantity",
  "Number of Doses",
  "Used",
  "Expiration Required",
] as const;

export function mapItemRow(row: MetrcItemRow): string[] {
  return [
    row.name ?? PLACEHOLDER,
    row.product_category_name ?? PLACEHOLDER,
    row.product_category_type ?? PLACEHOLDER,
    row.quantity_type ?? PLACEHOLDER,
    row.default_lab_testing_state ?? PLACEHOLDER,
    row.unit_of_measure_name ?? PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    row.is_active ? "Yes" : "No",
    PLACEHOLDER,
  ];
}
