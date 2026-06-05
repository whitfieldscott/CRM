"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNT_LOCKED_UOM,
  getAllItemCategoryNames,
  getCategoryFormFields,
  resolveItemCategoryConfig,
  WEIGHT_UOM_OPTIONS,
  type CategoryFormField,
} from "@/lib/item-category-config";
import {
  ITEM_SUPPLEMENTARY_DRAFT_FIELDS,
  applyItemCategoryChange,
  type ItemDraft,
} from "@/lib/master-data-edit";

function categorySelectOptions(currentCategory: string): string[] {
  const names = getAllItemCategoryNames();
  const trimmed = currentCategory.trim();
  if (!trimmed) return names;
  const exists = names.some(
    (name) => name.toLowerCase() === trimmed.toLowerCase(),
  );
  return exists ? names : [trimmed, ...names];
}

function CategoryDrivenField({
  field,
  draft,
  onUpdate,
}: {
  field: CategoryFormField;
  draft: ItemDraft;
  onUpdate: (patch: Partial<ItemDraft>) => void;
}) {
  const config = resolveItemCategoryConfig(draft.category);

  switch (field) {
    case "strain":
      return (
        <div className="space-y-2">
          <Label htmlFor="item-strain">
            Strain
            {config.requiresStrain ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </Label>
          <Input
            id="item-strain"
            value={draft.strain}
            onChange={(e) => onUpdate({ strain: e.target.value })}
            placeholder="Select or enter strain"
          />
        </div>
      );

    case "uom":
      return (
        <div className="space-y-2">
          <Label htmlFor="item-uom">Unit of Measure</Label>
          <Input
            id="item-uom"
            value={COUNT_LOCKED_UOM}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>
      );

    case "ingredientCount":
      return (
        <div className="space-y-2">
          <Label htmlFor="item-ingredient-count">Ingredient Count (future)</Label>
          <Input
            id="item-ingredient-count"
            value={draft.ingredientCount}
            disabled
            placeholder="Available during item creation"
            className="bg-muted"
          />
        </div>
      );

    case "itemCount":
      return (
        <div className="space-y-2">
          <Label htmlFor="item-item-count">Item Count (future)</Label>
          <Input
            id="item-item-count"
            value={draft.itemCount}
            disabled
            placeholder="Available during item creation"
            className="bg-muted"
          />
        </div>
      );

    case "unitWeight":
      return (
        <div className="space-y-2">
          <Label htmlFor="item-unit-weight">Unit Weight</Label>
          <Input
            id="item-unit-weight"
            type="number"
            min="0"
            step="any"
            value={draft.weight}
            onChange={(e) => onUpdate({ weight: e.target.value })}
            placeholder="e.g. 1.0"
          />
        </div>
      );

    case "weightUom":
      return (
        <div className="space-y-2">
          <Label htmlFor="item-weight-uom">Weight Unit</Label>
          <Select
            value={draft.uom || undefined}
            onValueChange={(value) => onUpdate({ uom: value })}
          >
            <SelectTrigger id="item-weight-uom">
              <SelectValue placeholder="Select weight unit" />
            </SelectTrigger>
            <SelectContent>
              {WEIGHT_UOM_OPTIONS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}

export function ItemFormFields({
  draft,
  onDraftChange,
}: {
  draft: ItemDraft;
  onDraftChange: (draft: ItemDraft) => void;
}) {
  const categoryConfig = useMemo(
    () => resolveItemCategoryConfig(draft.category),
    [draft.category],
  );

  const categoryFields = useMemo(
    () => getCategoryFormFields(categoryConfig),
    [categoryConfig],
  );

  const categoryOptions = useMemo(
    () => categorySelectOptions(draft.category),
    [draft.category],
  );

  const updateField = (key: keyof ItemDraft, value: string) => {
    onDraftChange({ ...draft, [key]: value });
  };

  const updateDraft = (patch: Partial<ItemDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  const handleCategoryChange = (value: string) => {
    onDraftChange(applyItemCategoryChange(draft, value));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="item-name">Item Name</Label>
          <Input
            id="item-name"
            value={draft.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-category">Category</Label>
          <Select value={draft.category || undefined} onValueChange={handleCategoryChange}>
            <SelectTrigger id="item-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {categoryFields.map((field) => (
          <CategoryDrivenField
            key={field}
            field={field}
            draft={draft}
            onUpdate={updateDraft}
          />
        ))}
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium text-foreground">Additional details</p>
        <div className="grid gap-4">
          {ITEM_SUPPLEMENTARY_DRAFT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`item-${field.key}`}>{field.label}</Label>
              {field.inputType === "select-used" ? (
                <Select
                  value={draft[field.key] || "unset"}
                  onValueChange={(value) =>
                    updateField(field.key, value === "unset" ? "" : value)
                  }
                >
                  <SelectTrigger id={`item-${field.key}`}>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">—</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`item-${field.key}`}
                  value={draft[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

