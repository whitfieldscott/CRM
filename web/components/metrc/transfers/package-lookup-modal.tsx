"use client";

import { useEffect, useState } from "react";
import { LookupSelectorModal } from "@/components/metrc/transfers/lookup-selector-modal";
import { PACKAGE_LOOKUP_HEADERS } from "@/lib/transfer-constants";
import { fetchTransferPackages } from "@/lib/transfer-lookup-sources";
import type { TransferPackageRecord } from "@/types/transfer";

type PackageLookupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (record: TransferPackageRecord) => void;
};

export function PackageLookupModal({
  open,
  onOpenChange,
  onSelect,
}: PackageLookupModalProps) {
  const [rows, setRows] = useState<TransferPackageRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetchTransferPackages().then(setRows);
  }, [open]);

  return (
    <LookupSelectorModal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Package"
      description="Only packages already created in inventory may be added to a transfer."
      headers={[...PACKAGE_LOOKUP_HEADERS]}
      rows={rows}
      emptyMessage="No packages available. Packages will appear when the Packages module is connected."
      searchPlaceholder="Search package tag or item name…"
      getSearchText={(row) =>
        `${row.packageTag} ${row.itemName} ${row.location}`
      }
      columns={[
        { header: "Package Tag", getValue: (row) => row.packageTag },
        { header: "Item Name", getValue: (row) => row.itemName },
        { header: "Current Quantity", getValue: (row) => row.currentQuantity },
        { header: "Location", getValue: (row) => row.location },
      ]}
      onSelect={onSelect}
    />
  );
}
