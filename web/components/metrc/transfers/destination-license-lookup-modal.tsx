"use client";

import { useEffect, useState } from "react";
import { LookupSelectorModal } from "@/components/metrc/transfers/lookup-selector-modal";
import { DESTINATION_LICENSE_LOOKUP_HEADERS } from "@/lib/transfer-constants";
import { fetchDestinationLicenses } from "@/lib/transfer-lookup-sources";
import type { DestinationLicenseRecord } from "@/types/transfer";

type DestinationLicenseLookupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (record: DestinationLicenseRecord) => void;
};

export function DestinationLicenseLookupModal({
  open,
  onOpenChange,
  onSelect,
}: DestinationLicenseLookupModalProps) {
  const [rows, setRows] = useState<DestinationLicenseRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetchDestinationLicenses().then(setRows);
  }, [open]);

  return (
    <LookupSelectorModal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Destination License"
      description="Licensed businesses will sync from Metrc. Only Metrc-licensed destinations may be selected."
      headers={[...DESTINATION_LICENSE_LOOKUP_HEADERS]}
      rows={rows}
      emptyMessage="No licensed businesses available. Sync Metrc facilities to populate this list."
      searchPlaceholder="Search license number or legal name…"
      getSearchText={(row) =>
        `${row.licenseNumber} ${row.legalName} ${row.licenseType} ${row.address}`
      }
      columns={[
        { header: "License Number", getValue: (row) => row.licenseNumber },
        { header: "Legal Name", getValue: (row) => row.legalName },
        { header: "License Type", getValue: (row) => row.licenseType },
        { header: "Address", getValue: (row) => row.address },
        { header: "Main Phone", getValue: (row) => row.mainPhone || "—" },
        { header: "Mobile Phone", getValue: (row) => row.mobilePhone || "—" },
      ]}
      onSelect={onSelect}
    />
  );
}
