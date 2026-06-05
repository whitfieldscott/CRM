/** Metrc-aligned item category rules — drives Items UI and future Packages/Harvests flows. */

export type MeasurementType = "count" | "weight";

export const COUNT_LOCKED_UOM = "Each" as const;

export const WEIGHT_UOM_OPTIONS = [
  "Grams",
  "Kilograms",
  "Milligrams",
  "Ounces",
  "Pounds",
] as const;

export type WeightUomOption = (typeof WEIGHT_UOM_OPTIONS)[number];

export type ItemCategoryConfig = {
  category: string;
  requiresStrain: boolean;
  showStrain: boolean;
  measurementType: MeasurementType;
  /** Set for count-based categories; UoM is locked to this value. */
  lockedUom: typeof COUNT_LOCKED_UOM | null;
  /** Weight categories expose a selectable weight unit dropdown. */
  allowWeightUnits: boolean;
};

export type CategoryFormField =
  | "strain"
  | "uom"
  | "unitWeight"
  | "weightUom"
  | "ingredientCount"
  | "itemCount";

function countConfig(
  category: string,
  requiresStrain: boolean,
  showStrain: boolean,
): ItemCategoryConfig {
  return {
    category,
    requiresStrain,
    showStrain,
    measurementType: "count",
    lockedUom: COUNT_LOCKED_UOM,
    allowWeightUnits: false,
  };
}

function weightConfig(
  category: string,
  requiresStrain: boolean,
  showStrain: boolean,
): ItemCategoryConfig {
  return {
    category,
    requiresStrain,
    showStrain,
    measurementType: "weight",
    lockedUom: null,
    allowWeightUnits: true,
  };
}

/** Count-based categories — UoM locked to Each. */
const COUNT_CATEGORY_CONFIGS: ItemCategoryConfig[] = [
  countConfig("Flower & Bud (Count)", true, true),
  countConfig("Immature Plants", true, true),
  countConfig("Mature Plants", true, true),
  countConfig("MMJ Clone Waste", false, false),
  countConfig("MMJ Waste (by Count)", false, false),
  countConfig("Seeds", false, false),
];

/** Weight-based categories — selectable weight UoM. */
const WEIGHT_CATEGORY_CONFIGS: ItemCategoryConfig[] = [
  weightConfig("Flower & Buds bulk", true, true),
  weightConfig("Flower - For Decontamination", true, true),
  weightConfig("Kief (Count)", false, false),
  weightConfig("Kief bulk", false, false),
  weightConfig("MMJ Waste", false, false),
  weightConfig("Pre-Roll (Flower Only)", true, true),
  weightConfig("Shake/Trim (by Strain)", true, true),
  weightConfig("Shake/Trim (Count)", true, true),
  weightConfig("Shake/Trim - For Decontamination", true, true),
  weightConfig("Shake/Trim bulk", true, true),
  weightConfig("Whole Wet Plant", false, false),
];

export const ITEM_CATEGORY_CONFIGS: ItemCategoryConfig[] = [
  ...COUNT_CATEGORY_CONFIGS,
  ...WEIGHT_CATEGORY_CONFIGS,
];

export const DEFAULT_WEIGHT_UOM: WeightUomOption = "Grams";

export const DEFAULT_UNKNOWN_CATEGORY_CONFIG: ItemCategoryConfig = {
  category: "",
  requiresStrain: false,
  showStrain: true,
  measurementType: "weight",
  lockedUom: null,
  allowWeightUnits: true,
};

function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase();
}

export function getAllItemCategoryNames(): string[] {
  return ITEM_CATEGORY_CONFIGS.map((config) => config.category);
}

export function findItemCategoryConfig(
  category: string,
): ItemCategoryConfig | undefined {
  const key = normalizeCategoryKey(category);
  if (!key) return undefined;
  return ITEM_CATEGORY_CONFIGS.find(
    (config) => normalizeCategoryKey(config.category) === key,
  );
}

export function resolveItemCategoryConfig(category: string): ItemCategoryConfig {
  const match = findItemCategoryConfig(category);
  if (match) return match;
  return {
    ...DEFAULT_UNKNOWN_CATEGORY_CONFIG,
    category: category.trim(),
  };
}

export function getCategoryFormFields(
  config: ItemCategoryConfig,
): CategoryFormField[] {
  const fields: CategoryFormField[] = [];

  if (config.showStrain) {
    fields.push("strain");
  }

  if (config.measurementType === "count") {
    fields.push("uom", "ingredientCount", "itemCount");
    return fields;
  }

  fields.push("unitWeight", "weightUom");
  return fields;
}

function isWeightUom(value: string): value is WeightUomOption {
  return WEIGHT_UOM_OPTIONS.includes(value as WeightUomOption);
}

export { isWeightUom };
