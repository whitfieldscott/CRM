"use client";

import { useEffect, useMemo, useState } from "react";
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
import { MetrcDataTable } from "@/components/metrc/metrc-data-table";

export type LookupSelectorColumn<T> = {
  header: string;
  getValue: (row: T) => string;
};

type LookupSelectorModalProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  headers: string[];
  columns: LookupSelectorColumn<T>[];
  rows: T[];
  emptyMessage: string;
  searchPlaceholder?: string;
  getSearchText: (row: T) => string;
  onSelect: (row: T) => void;
};

export function LookupSelectorModal<T>({
  open,
  onOpenChange,
  title,
  description,
  headers,
  columns,
  rows,
  emptyMessage,
  searchPlaceholder = "Search…",
  getSearchText,
  onSelect,
}: LookupSelectorModalProps<T>) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(null);
  }, [open]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      getSearchText(row).toLowerCase().includes(normalized),
    );
  }, [query, rows, getSearchText]);

  const handleSelect = () => {
    if (selectedIndex == null) return;
    const row = filteredRows[selectedIndex];
    if (!row) return;
    onSelect(row);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
        />

        {filteredRows.length > 0 ? (
          <div className="max-h-[360px] overflow-auto rounded-md border">
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="border-b">
                  <th className="h-10 w-10 px-2 text-left" />
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="h-10 whitespace-nowrap px-3 text-left align-middle font-medium text-muted-foreground"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    key={index}
                    className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                      selectedIndex === index ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <td className="p-2 align-middle">
                      <input
                        type="radio"
                        checked={selectedIndex === index}
                        onChange={() => setSelectedIndex(index)}
                        aria-label={`Select row ${index + 1}`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    {columns.map((column, columnIndex) => (
                      <td
                        key={columnIndex}
                        className="whitespace-nowrap p-3 align-middle"
                      >
                        {column.getValue(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <MetrcDataTable headers={[...headers]} rows={[]} empty={emptyMessage} />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selectedIndex == null}
            onClick={handleSelect}
          >
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
