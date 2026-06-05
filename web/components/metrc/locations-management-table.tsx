"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyLocationStructureModal } from "@/components/metrc/copy-location-structure-modal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ManagementTableChrome,
  RowActions,
  RowCheckbox,
} from "@/components/metrc/management-table-chrome";
import { useRowSelection, useRowSelectionKeys } from "@/components/metrc/use-row-selection";
import { LOCATION_TABLE_HEADERS } from "@/lib/master-data-columns";
import {
  locationDraftFromRow,
  locationDraftToCells,
  LOCATION_TYPE_OPTIONS,
  type LocationDraft,
  validateLocationDraft,
} from "@/lib/master-data-edit";
import type { MetrcLocationRow } from "@/types/metrc";
import { toast } from "sonner";

type LocationsManagementTableProps = {
  rows: MetrcLocationRow[];
  empty: string;
};

export function LocationsManagementTable({
  rows,
  empty,
}: LocationsManagementTableProps) {
  const [drafts, setDrafts] = useState<Record<string, LocationDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LocationDraft | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  const locationOptions = useMemo(
    () =>
      rows
        .map((row) => {
          const id = String(row.metrc_id);
          const draft = drafts[id] ?? locationDraftFromRow(row);
          return {
            id,
            name: draft.name.trim() || row.name || "—",
            sublocationCategory: draft.sublocationCategory.trim(),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows, drafts],
  );

  const existingLocations = useMemo(
    () =>
      locationOptions
        .filter((loc) => loc.name !== "—")
        .map((loc) => ({
          name: loc.name,
          sublocationCategory: loc.sublocationCategory,
        })),
    [locationOptions],
  );

  const tableRows = rows.map((row) => {
    const id = String(row.metrc_id);
    const draft = drafts[id] ?? locationDraftFromRow(row);
    return { id, cells: locationDraftToCells(draft) };
  });

  const rowKeys = useRowSelectionKeys(tableRows);
  const { selected, allSelected, someSelected, toggleAll, toggleRow } =
    useRowSelection(rowKeys);

  const defaultCopySourceId = useMemo(() => {
    const selectedIds = Array.from(selected).sort();
    if (selectedIds.length === 1) return selectedIds[0];
    const firstSelected = locationOptions.find((loc) => selected.has(loc.id));
    return firstSelected?.id ?? locationOptions[0]?.id ?? "";
  }, [selected, locationOptions]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        const id = String(row.metrc_id);
        if (!next[id]) next[id] = locationDraftFromRow(row);
      }
      return next;
    });
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  const startEdit = (id: string) => {
    const draft = drafts[id] ?? locationDraftFromRow(
      rows.find((r) => String(r.metrc_id) === id)!,
    );
    setEditingId(id);
    setEditDraft({ ...draft });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!editingId || !editDraft) return;
    const error = validateLocationDraft(editDraft);
    if (error) {
      toast.error(error);
      return;
    }
    setDrafts((prev) => ({ ...prev, [editingId]: { ...editDraft } }));
    setEditingId(null);
    setEditDraft(null);
    toast.info("Location editing will be connected to backend update next.");
  };

  return (
    <>
    <ManagementTableChrome
      headers={[...LOCATION_TABLE_HEADERS]}
      entityLabel="location"
      selectedCount={selected.size}
      allSelected={allSelected}
      someSelected={someSelected}
      onToggleAll={toggleAll}
      bulkActions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCopyModalOpen(true)}
        >
          Copy Location Structure
        </Button>
      }
    >
      {tableRows.map((row) => {
        const isEditing = editingId === row.id;
        const draft = isEditing && editDraft ? editDraft : drafts[row.id];

        return (
          <TableRow
            key={row.id}
            data-state={selected.has(row.id) ? "selected" : undefined}
          >
            <RowCheckbox
              rowId={row.id}
              checked={selected.has(row.id)}
              onToggle={() => toggleRow(row.id)}
            />
            {isEditing && editDraft ? (
              <>
                <TableCell>
                  <Input
                    value={editDraft.name}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, name: e.target.value })
                    }
                    className="h-8 min-w-[140px]"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={editDraft.locationType}
                    onValueChange={(value: LocationDraft["locationType"]) =>
                      setEditDraft({
                        ...editDraft,
                        locationType: value,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 min-w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={editDraft.sublocationCategory}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        sublocationCategory: e.target.value,
                      })
                    }
                    placeholder="e.g. Rack, Table, Bench"
                    className="h-8 min-w-[140px]"
                  />
                </TableCell>
                {row.cells.slice(3).map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </>
            ) : (
              (draft ? locationDraftToCells(draft) : row.cells).map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))
            )}
            <RowActions
              isEditing={isEditing}
              onEdit={() => startEdit(row.id)}
              onDelete={() => toast.info("Delete location — coming soon")}
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          </TableRow>
        );
      })}
    </ManagementTableChrome>

    <CopyLocationStructureModal
      open={copyModalOpen}
      onOpenChange={setCopyModalOpen}
      locations={locationOptions}
      defaultSourceId={defaultCopySourceId}
      existingLocations={existingLocations}
    />
    </>
  );
}
