"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  type ExistingLocationStructure,
  type LocationStructureCopyForm,
  validateLocationStructureCopy,
} from "@/lib/master-data-edit";
import { toast } from "sonner";

type LocationOption = {
  id: string;
  name: string;
  sublocationCategory: string;
};

type CopyLocationStructureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationOption[];
  defaultSourceId: string;
  existingLocations: ExistingLocationStructure[];
};

const DEFAULT_FORM: LocationStructureCopyForm = {
  sourceLocationId: "",
  destinationName: "",
};

export function CopyLocationStructureModal({
  open,
  onOpenChange,
  locations,
  defaultSourceId,
  existingLocations,
}: CopyLocationStructureModalProps) {
  const [form, setForm] = useState<LocationStructureCopyForm>(DEFAULT_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...DEFAULT_FORM,
      sourceLocationId: defaultSourceId || locations[0]?.id || "",
    });
    setValidationError(null);
  }, [open, defaultSourceId, locations]);

  const updateForm = (patch: Partial<LocationStructureCopyForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setValidationError(null);
  };

  const handleSave = () => {
    const source = locations.find((loc) => loc.id === form.sourceLocationId);
    const error = validateLocationStructureCopy(
      form,
      existingLocations,
      source?.sublocationCategory ?? "",
    );
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    onOpenChange(false);
    toast.info(
      "Location structure copy workflow will be connected during Sublocation implementation.",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Location Structure</DialogTitle>
          <DialogDescription>
            Copy a location layout and its sublocation structure to a new
            location. Plant batches, plants, harvests, and packages are not
            copied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="copy-source-location">Source Location</Label>
            <Select
              value={form.sourceLocationId}
              onValueChange={(value) =>
                updateForm({ sourceLocationId: value })
              }
            >
              <SelectTrigger id="copy-source-location">
                <SelectValue placeholder="Select source location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="copy-destination-name">
              Destination Location Name
            </Label>
            <Input
              id="copy-destination-name"
              value={form.destinationName}
              onChange={(e) =>
                updateForm({ destinationName: e.target.value })
              }
              placeholder="e.g. Flower Room B"
              aria-invalid={validationError != null}
            />
          </div>

          {validationError ? (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {validationError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
