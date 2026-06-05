"use client";

import { useMemo, useState } from "react";
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

export type ManagementTableRow = {
  id: string | number;
  cells: string[];
};

type MetrcManagementTableProps = {
  headers: string[];
  rows: ManagementTableRow[];
  empty: string;
  entityLabel: string;
};

export function MetrcManagementTable({
  headers,
  rows,
  empty,
  entityLabel,
}: MetrcManagementTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rowKeys = useMemo(
    () => rows.map((row) => String(row.id)),
    [rows],
  );

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rowKeys));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleComingSoon = (action: string) => {
    toast.info(`${action} — coming soon`);
  };

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-theme/50 bg-muted/20 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleComingSoon(`Delete Selected ${entityLabel}`)}
          >
            Delete Selected
          </Button>
        </div>
      ) : null}

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
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              </TableHead>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const key = String(row.id);
              const isSelected = selected.has(key);
              return (
                <TableRow key={key} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select row ${key}`}
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </TableCell>
                  {row.cells.map((cell, j) => (
                    <TableCell key={j}>{cell}</TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleComingSoon(`Edit ${entityLabel}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleComingSoon(`Delete ${entityLabel}`)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
