"use client";

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

type ItemEditDrawerProps = {
  open: boolean;
  draft: ItemDraft | null;
  onDraftChange: (draft: ItemDraft) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ItemEditDrawer({
  open,
  draft,
  onDraftChange,
  onSave,
  onCancel,
}: ItemEditDrawerProps) {
  const handleSave = () => {
    if (!draft) return;
    const error = validateItemDraft(draft);
    if (error) {
      toast.error(error);
      return;
    }
    onSave();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit Item</SheetTitle>
          <SheetDescription>
            Category selection controls which fields appear. Changes are saved
            locally until backend update is connected.
          </SheetDescription>
        </SheetHeader>

        {draft ? (
          <div className="mt-6">
            <ItemFormFields draft={draft} onDraftChange={onDraftChange} />
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
