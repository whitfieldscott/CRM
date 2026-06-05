"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type ManagementTableChromeProps = {
  headers: string[];
  entityLabel: string;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  bulkActions?: React.ReactNode;
  children: React.ReactNode;
};

export function ManagementBulkBar({
  selectedCount,
  entityLabel,
  extraActions,
}: {
  selectedCount: number;
  entityLabel: string;
  extraActions?: React.ReactNode;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-theme/50 bg-muted/20 px-3 py-2">
      <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.info(`Delete Selected ${entityLabel} — coming soon`)
        }
      >
        Delete Selected
      </Button>
      {extraActions}
    </div>
  );
}

export function ManagementTableChrome({
  headers,
  entityLabel,
  selectedCount,
  allSelected,
  someSelected,
  onToggleAll,
  bulkActions,
  children,
}: ManagementTableChromeProps) {
  return (
    <div className="space-y-3">
      <ManagementBulkBar
        selectedCount={selectedCount}
        entityLabel={entityLabel}
        extraActions={bulkActions}
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              </TableHead>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </div>
    </div>
  );
}

export function RowCheckbox({
  rowId,
  checked,
  onToggle,
}: {
  rowId: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <TableCell>
      <input
        type="checkbox"
        aria-label={`Select row ${rowId}`}
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded border-border accent-primary"
      />
    </TableCell>
  );
}

export function RowActions({
  isEditing,
  onEdit,
  onDelete,
  onSave,
  onCancel,
}: {
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-2"
            onClick={onSave}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell className="text-right">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </TableCell>
  );
}
