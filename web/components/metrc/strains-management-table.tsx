"use client";

import { useEffect, useState } from "react";
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
import { STRAIN_TABLE_HEADERS } from "@/lib/master-data-columns";
import {
  strainDraftFromRow,
  strainDraftToCells,
  TESTING_STATUS_OPTIONS,
  type StrainDraft,
  type TestingStatusOption,
  validateStrainDraft,
} from "@/lib/master-data-edit";
import type { MetrcStrainRow } from "@/types/metrc";
import { toast } from "sonner";

const USED_OPTIONS = ["", "Yes", "No"] as const;

type StrainsManagementTableProps = {
  rows: MetrcStrainRow[];
  empty: string;
};

export function StrainsManagementTable({
  rows,
  empty,
}: StrainsManagementTableProps) {
  const [drafts, setDrafts] = useState<Record<string, StrainDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StrainDraft | null>(null);

  const tableRows = rows.map((row) => {
    const id = String(row.metrc_id);
    const draft = drafts[id] ?? strainDraftFromRow(row);
    return { id, cells: strainDraftToCells(draft) };
  });

  const rowKeys = useRowSelectionKeys(tableRows);
  const { selected, allSelected, someSelected, toggleAll, toggleRow } =
    useRowSelection(rowKeys);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        const id = String(row.metrc_id);
        if (!next[id]) next[id] = strainDraftFromRow(row);
      }
      return next;
    });
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  const startEdit = (id: string) => {
    const draft =
      drafts[id] ??
      strainDraftFromRow(rows.find((r) => String(r.metrc_id) === id)!);
    setEditingId(id);
    setEditDraft({ ...draft });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!editingId || !editDraft) return;
    const error = validateStrainDraft(editDraft);
    if (error) {
      toast.error(error);
      return;
    }
    setDrafts((prev) => ({ ...prev, [editingId]: { ...editDraft } }));
    setEditingId(null);
    setEditDraft(null);
    toast.info("Strain editing will be connected to backend update next.");
  };

  const updateField = (key: keyof StrainDraft, value: string) => {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [key]: value });
  };

  return (
    <ManagementTableChrome
      headers={[...STRAIN_TABLE_HEADERS]}
      entityLabel="strain"
      selectedCount={selected.size}
      allSelected={allSelected}
      someSelected={someSelected}
      onToggleAll={toggleAll}
    >
      {tableRows.map((row) => {
        const isEditing = editingId === row.id;
        const draft = isEditing && editDraft ? editDraft : drafts[row.id];
        const displayCells = draft ? strainDraftToCells(draft) : row.cells;

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
                    onChange={(e) => updateField("name", e.target.value)}
                    className="h-8 min-w-[120px]"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={editDraft.testing}
                    onValueChange={(value: TestingStatusOption) =>
                      updateField("testing", value)
                    }
                  >
                    <SelectTrigger className="h-8 min-w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TESTING_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={editDraft.thc}
                    onChange={(e) => updateField("thc", e.target.value)}
                    className="h-8 min-w-[72px]"
                    inputMode="decimal"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={editDraft.cbd}
                    onChange={(e) => updateField("cbd", e.target.value)}
                    className="h-8 min-w-[72px]"
                    inputMode="decimal"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={editDraft.genetics}
                    onChange={(e) => updateField("genetics", e.target.value)}
                    className="h-8 min-w-[160px]"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={editDraft.used || "unset"}
                    onValueChange={(value) =>
                      updateField("used", value === "unset" ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-8 min-w-[88px]">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">—</SelectItem>
                      {USED_OPTIONS.filter(Boolean).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </>
            ) : (
              displayCells.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))
            )}
            <RowActions
              isEditing={isEditing}
              onEdit={() => startEdit(row.id)}
              onDelete={() => toast.info("Delete strain — coming soon")}
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          </TableRow>
        );
      })}
    </ManagementTableChrome>
  );
}
