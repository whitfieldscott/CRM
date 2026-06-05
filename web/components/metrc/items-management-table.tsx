"use client";

import { useEffect, useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { ItemEditDrawer } from "@/components/metrc/item-edit-drawer";
import {
  ManagementTableChrome,
  RowActions,
  RowCheckbox,
} from "@/components/metrc/management-table-chrome";
import { useRowSelection, useRowSelectionKeys } from "@/components/metrc/use-row-selection";
import { ITEM_TABLE_HEADERS } from "@/lib/master-data-columns";
import {
  itemDraftFromRow,
  itemDraftToCells,
  type ItemDraft,
} from "@/lib/master-data-edit";
import type { MetrcItemRow } from "@/types/metrc";
import { toast } from "sonner";

type ItemsManagementTableProps = {
  rows: MetrcItemRow[];
  empty: string;
};

export function ItemsManagementTable({ rows, empty }: ItemsManagementTableProps) {
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemDraft | null>(null);

  const tableRows = rows.map((row) => {
    const id = String(row.metrc_id);
    const draft = drafts[id] ?? itemDraftFromRow(row);
    return { id, cells: itemDraftToCells(draft) };
  });

  const rowKeys = useRowSelectionKeys(tableRows);
  const { selected, allSelected, someSelected, toggleAll, toggleRow } =
    useRowSelection(rowKeys);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        const id = String(row.metrc_id);
        if (!next[id]) next[id] = itemDraftFromRow(row);
      }
      return next;
    });
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  const startEdit = (id: string) => {
    const draft =
      drafts[id] ?? itemDraftFromRow(rows.find((r) => String(r.metrc_id) === id)!);
    setEditingId(id);
    setEditDraft({ ...draft });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!editingId || !editDraft) return;
    setDrafts((prev) => ({ ...prev, [editingId]: { ...editDraft } }));
    setEditingId(null);
    setEditDraft(null);
    toast.info("Item editing will be connected to backend update next.");
  };

  return (
    <>
      <ManagementTableChrome
        headers={[...ITEM_TABLE_HEADERS]}
        entityLabel="item"
        selectedCount={selected.size}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={toggleAll}
      >
        {tableRows.map((row) => {
          const draft = drafts[row.id];
          const displayCells = draft ? itemDraftToCells(draft) : row.cells;

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
              {displayCells.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))}
              <RowActions
                isEditing={false}
                onEdit={() => startEdit(row.id)}
                onDelete={() => toast.info("Delete item — coming soon")}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            </TableRow>
          );
        })}
      </ManagementTableChrome>

      <ItemEditDrawer
        open={editingId !== null && editDraft !== null}
        draft={editDraft}
        onDraftChange={setEditDraft}
        onSave={saveEdit}
        onCancel={cancelEdit}
      />
    </>
  );
}
