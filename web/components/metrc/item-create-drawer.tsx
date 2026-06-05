"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemFormFields } from "@/components/metrc/item-form-fields";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type ItemDraft, validateItemDraft } from "@/lib/master-data-edit";
import { toast } from "sonner";

type ItemCreateDrawerProps = {
  open: boolean;
  draft: ItemDraft | null;
  onDraftChange: (draft: ItemDraft) => void;
  onCancel: () => void;
};

export function ItemCreateDrawer({
  open,
  draft,
  onDraftChange,
  onCancel,
}: ItemCreateDrawerProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
  }, [open]);

  const handleSave = () => {
    if (!draft) return;
    const error = validateItemDraft(draft);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onCancel();
    toast.info("Create Item will be connected to backend item creation next.");
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Create Item</SheetTitle>
          <SheetDescription>
            Category selection controls which fields appear. Item creation will
            be connected once backend create routes are available.
          </SheetDescription>
        </SheetHeader>

        {draft ? (
          <div className="mt-6 space-y-4">
            <ItemFormFields
              draft={draft}
              onDraftChange={(next) => {
                setValidationError(null);
                onDraftChange(next);
              }}
            />
            {validationError ? (
              <p role="alert" className="text-sm text-destructive">
                {validationError}
              </p>
            ) : null}
          </div>
        ) : null}

        <SheetFooter className="mt-8 gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

