"use client";

import { useEffect, useState } from "react";
import { LookupSelectorModal } from "@/components/metrc/transfers/lookup-selector-modal";
import { TRANSPORTER_LOOKUP_HEADERS } from "@/lib/transfer-constants";
import { fetchTransporters } from "@/lib/transfer-lookup-sources";
import type { TransporterRecord } from "@/types/transfer";

type TransporterLookupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (record: TransporterRecord) => void;
};

export function TransporterLookupModal({
  open,
  onOpenChange,
  onSelect,
}: TransporterLookupModalProps) {
  const [rows, setRows] = useState<TransporterRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetchTransporters().then(setRows);
  }, [open]);

  return (
    <LookupSelectorModal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Transporter"
      description="Transporters are managed under Admin → Transporters."
      headers={[...TRANSPORTER_LOOKUP_HEADERS]}
      rows={rows}
      emptyMessage="No transporters available. Add transporters under Admin → Transporters."
      searchPlaceholder="Search transporter license or business name…"
      getSearchText={(row) =>
        `${row.transporterLicense} ${row.businessName} ${row.phone}`
      }
      columns={[
        {
          header: "Transporter License",
          getValue: (row) => row.transporterLicense,
        },
        { header: "Business Name", getValue: (row) => row.businessName },
        { header: "Phone", getValue: (row) => row.phone || "—" },
      ]}
      onSelect={onSelect}
    />
  );
}
