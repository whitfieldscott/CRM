/** Local draft types and helpers for master data inline editing. */

import type {
  MetrcItemRow,
  MetrcLocationRow,
  MetrcStrainRow,
} from "@/types/metrc";
import {
  COUNT_LOCKED_UOM,
  DEFAULT_WEIGHT_UOM,
  isWeightUom,
  resolveItemCategoryConfig,
} from "@/lib/item-category-config";

const PLACEHOLDER = "—";

export const LOCATION_TYPE_OPTIONS = ["Indoor", "Outdoor"] as const;
export type LocationTypeOption = (typeof LOCATION_TYPE_OPTIONS)[number];

export type LocationDraft = {
  name: string;
  locationType: LocationTypeOption;
  /** Naming convention for sublocations within this location (e.g. Rack, Table, Bench). */
  sublocationCategory: string;
};

export const TESTING_STATUS_OPTIONS = ["ThirdParty", "InHouse", "None"] as const;
export type TestingStatusOption = (typeof TESTING_STATUS_OPTIONS)[number];

export type StrainDraft = {
  name: string;
  testing: TestingStatusOption;
  thc: string;
  cbd: string;
  genetics: string;
  used: string;
};

export type ItemDraft = {
  name: string;
  category: string;
  type: string;
  quantityType: string;
  defaultLts: string;
  uom: string;
  strain: string;
  cbdPercent: string;
  cbd: string;
  thcPercent: string;
  thc: string;
  volume: string;
  weight: string;
  quantity: string;
  numberOfDoses: string;
  used: string;
  expirationRequired: string;
  /** Future — ingredient count for count-based categories. */
  ingredientCount: string;
  /** Future — item count for count-based categories. */
  itemCount: string;
};

export function blankToEmpty(value: string | null | undefined): string {
  if (value == null || value === PLACEHOLDER) return "";
  return value;
}

export function mapLocationTypeToDropdown(
  metrcType: string | null | undefined,
): LocationTypeOption {
  const normalized = (metrcType ?? "").toLowerCase();
  if (normalized.includes("outdoor")) return "Outdoor";
  return "Indoor";
}

export function mapTestingStatusToDropdown(
  value: string | null | undefined,
): TestingStatusOption {
  const normalized = (value ?? "").replace(/\s+/g, "").toLowerCase();
  if (normalized === "thirdparty" || normalized.includes("thirdparty")) {
    return "ThirdParty";
  }
  if (normalized === "inhouse" || normalized.includes("inhouse")) {
    return "InHouse";
  }
  if (normalized === "none" || !normalized) {
    return "None";
  }
  return "None";
}

export function locationDraftFromRow(row: MetrcLocationRow): LocationDraft {
  return {
    name: row.name ?? "",
    locationType: mapLocationTypeToDropdown(row.location_type_name),
    sublocationCategory: "",
  };
}

export function strainDraftFromRow(row: MetrcStrainRow): StrainDraft {
  const indica = row.indica_percentage;
  const sativa = row.sativa_percentage;
  let genetics = "";
  if (indica != null || sativa != null) {
    const parts: string[] = [];
    if (indica != null) parts.push(`Indica ${indica}%`);
    if (sativa != null) parts.push(`Sativa ${sativa}%`);
    genetics = parts.join(" / ");
  }

  return {
    name: row.name ?? "",
    testing: mapTestingStatusToDropdown(row.testing_status),
    thc: row.thc_level != null ? String(row.thc_level) : "",
    cbd: row.cbd_level != null ? String(row.cbd_level) : "",
    genetics,
    used: "",
  };
}

export function itemDraftFromRow(row: MetrcItemRow): ItemDraft {
  const category = blankToEmpty(row.product_category_name);
  const base: ItemDraft = {
    name: row.name ?? "",
    category,
    type: blankToEmpty(row.product_category_type),
    quantityType: blankToEmpty(row.quantity_type),
    defaultLts: blankToEmpty(row.default_lab_testing_state),
    uom: blankToEmpty(row.unit_of_measure_name),
    strain: "",
    cbdPercent: "",
    cbd: "",
    thcPercent: "",
    thc: "",
    volume: "",
    weight: "",
    quantity: "",
    numberOfDoses: "",
    used: row.is_active ? "Yes" : "No",
    expirationRequired: "",
    ingredientCount: "",
    itemCount: "",
  };

  if (!category) return base;

  const config = resolveItemCategoryConfig(category);
  if (config.measurementType === "count") {
    return { ...base, uom: COUNT_LOCKED_UOM };
  }

  return applyItemCategoryChange(base, category);
}

export function blankItemDraft(): ItemDraft {
  return {
    name: "",
    category: "",
    type: "",
    quantityType: "",
    defaultLts: "",
    uom: "",
    strain: "",
    cbdPercent: "",
    cbd: "",
    thcPercent: "",
    thc: "",
    volume: "",
    weight: "",
    quantity: "",
    numberOfDoses: "",
    used: "Yes",
    expirationRequired: "",
    ingredientCount: "",
    itemCount: "",
  };
}

/** Apply category defaults when the user selects a new category. */
export function applyItemCategoryChange(
  draft: ItemDraft,
  newCategory: string,
): ItemDraft {
  const config = resolveItemCategoryConfig(newCategory);
  const next: ItemDraft = { ...draft, category: newCategory };

  if (config.measurementType === "count") {
    next.uom = COUNT_LOCKED_UOM;
    next.weight = "";
  } else if (config.allowWeightUnits && !isWeightUom(next.uom)) {
    next.uom = DEFAULT_WEIGHT_UOM;
  }

  if (!config.showStrain) {
    next.strain = "";
  }

  return next;
}

export function validateItemDraftForCategory(
  draft: ItemDraft,
  config = resolveItemCategoryConfig(draft.category),
): string | null {
  if (!draft.name.trim()) return "Item name cannot be empty.";
  if (!draft.category.trim()) return "Category is required.";

  if (config.showStrain && config.requiresStrain && !draft.strain.trim()) {
    return "Strain is required for this category.";
  }

  if (config.measurementType === "count") {
    if (draft.uom !== COUNT_LOCKED_UOM) {
      return `Unit of measure must be ${COUNT_LOCKED_UOM} for this category.`;
    }
    return null;
  }

  if (config.allowWeightUnits) {
    if (!draft.uom.trim()) return "Weight unit is required.";
    if (!isWeightUom(draft.uom)) {
      return "Select a valid weight unit.";
    }
  }

  return null;
}

export function locationDraftToCells(draft: LocationDraft): string[] {
  return [
    draft.name || PLACEHOLDER,
    draft.locationType,
    draft.sublocationCategory.trim() || PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
  ];
}

export function strainDraftToCells(draft: StrainDraft): string[] {
  return [
    draft.name || PLACEHOLDER,
    draft.testing,
    draft.thc || PLACEHOLDER,
    draft.cbd || PLACEHOLDER,
    draft.genetics || PLACEHOLDER,
    draft.used || PLACEHOLDER,
  ];
}

export function itemDraftToCells(draft: ItemDraft): string[] {
  return [
    draft.name || PLACEHOLDER,
    draft.category || PLACEHOLDER,
    draft.type || PLACEHOLDER,
    draft.quantityType || PLACEHOLDER,
    draft.defaultLts || PLACEHOLDER,
    draft.uom || PLACEHOLDER,
    draft.strain || PLACEHOLDER,
    draft.cbdPercent || PLACEHOLDER,
    draft.cbd || PLACEHOLDER,
    draft.thcPercent || PLACEHOLDER,
    draft.thc || PLACEHOLDER,
    draft.volume || PLACEHOLDER,
    draft.weight || PLACEHOLDER,
    draft.quantity || PLACEHOLDER,
    draft.numberOfDoses || PLACEHOLDER,
    draft.used || PLACEHOLDER,
    draft.expirationRequired || PLACEHOLDER,
  ];
}

export function validateLocationDraft(draft: LocationDraft): string | null {
  if (!draft.name.trim()) return "Location name cannot be empty.";
  if (!LOCATION_TYPE_OPTIONS.includes(draft.locationType)) {
    return "Location type must be Indoor or Outdoor.";
  }
  return null;
}

/** Form state for copying a location layout (structure only, no operational data). */
export type LocationStructureCopyForm = {
  sourceLocationId: string;
  destinationName: string;
};

export type ExistingLocationStructure = {
  name: string;
  sublocationCategory: string;
};

function normalizeStructureValue(value: string): string {
  return value.trim().toLowerCase();
}

export function validateLocationStructureCopy(
  form: LocationStructureCopyForm,
  existingLocations: ExistingLocationStructure[],
  sourceSublocationCategory: string,
): string | null {
  if (!form.sourceLocationId) return "Select a source location.";
  const destination = form.destinationName.trim();
  if (!destination) return "Destination location name cannot be empty.";

  const destName = normalizeStructureValue(destination);
  const destCategory = normalizeStructureValue(sourceSublocationCategory);

  const hasLocationAndSublocationDuplicate = existingLocations.some(
    (loc) =>
      normalizeStructureValue(loc.name) === destName &&
      destCategory !== "" &&
      normalizeStructureValue(loc.sublocationCategory) === destCategory,
  );
  if (hasLocationAndSublocationDuplicate) {
    return "Location and sublocation already exist.";
  }

  const hasLocationDuplicate = existingLocations.some(
    (loc) => normalizeStructureValue(loc.name) === destName,
  );
  if (hasLocationDuplicate) return "Location name already exists.";

  return null;
}

export function validateStrainDraft(draft: StrainDraft): string | null {
  if (!draft.name.trim()) return "Strain name cannot be empty.";
  if (!TESTING_STATUS_OPTIONS.includes(draft.testing)) {
    return "Testing status must be ThirdParty, InHouse, or None.";
  }
  if (draft.thc.trim() && Number.isNaN(Number(draft.thc))) {
    return "THC must be a number or blank.";
  }
  if (draft.cbd.trim() && Number.isNaN(Number(draft.cbd))) {
    return "CBD must be a number or blank.";
  }
  return null;
}

export function validateItemDraft(draft: ItemDraft): string | null {
  return validateItemDraftForCategory(draft);
}

/** Fields driven by item category config — rendered in the category section. */
export const ITEM_CATEGORY_DRIVEN_KEYS = new Set<keyof ItemDraft>([
  "name",
  "category",
  "strain",
  "uom",
  "weight",
  "ingredientCount",
  "itemCount",
]);

export const ITEM_SUPPLEMENTARY_DRAFT_FIELDS: {
  key: keyof ItemDraft;
  label: string;
  inputType?: "text" | "select-used";
}[] = [
  { key: "type", label: "Type" },
  { key: "quantityType", label: "Quantity Type" },
  { key: "defaultLts", label: "Default LTS" },
  { key: "cbdPercent", label: "CBD%" },
  { key: "cbd", label: "CBD" },
  { key: "thcPercent", label: "THC%" },
  { key: "thc", label: "THC" },
  { key: "volume", label: "Volume" },
  { key: "quantity", label: "Quantity" },
  { key: "numberOfDoses", label: "Number of Doses" },
  { key: "used", label: "Used", inputType: "select-used" },
  { key: "expirationRequired", label: "Expiration Required" },
];
