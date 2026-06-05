"use client";

import { useMemo, useState } from "react";

export function useRowSelection(rowIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rowIds.length > 0 && selected.size === rowIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rowIds));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  return {
    selected,
    allSelected,
    someSelected,
    toggleAll,
    toggleRow,
    clearSelection,
  };
}

export function useRowSelectionKeys(rows: { id: string | number }[]) {
  return useMemo(() => rows.map((row) => String(row.id)), [rows]);
}
