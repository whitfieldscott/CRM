"use client";

import { useEffect, useState } from "react";
import { LookupSelectorModal } from "@/components/metrc/transfers/lookup-selector-modal";
import { DRIVER_LOOKUP_HEADERS } from "@/lib/transfer-constants";
import { fetchDrivers } from "@/lib/transfer-lookup-sources";
import type { DriverRecord } from "@/types/transfer";

type DriverLookupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (record: DriverRecord) => void;
};

export function DriverLookupModal({
  open,
  onOpenChange,
  onSelect,
}: DriverLookupModalProps) {
  const [rows, setRows] = useState<DriverRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetchDrivers().then(setRows);
  }, [open]);

  return (
    <LookupSelectorModal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Driver"
      description="Drivers are managed under Admin → Drivers."
      headers={[...DRIVER_LOOKUP_HEADERS]}
      rows={rows}
      emptyMessage="No drivers available. Add drivers under Admin → Drivers."
      searchPlaceholder="Search driver name or employee ID…"
      getSearchText={(row) =>
        `${row.driverName} ${row.employeeId} ${row.driverLicenseNumber} ${row.phoneNumber}`
      }
      columns={[
        { header: "Driver Name", getValue: (row) => row.driverName },
        { header: "Employee ID", getValue: (row) => row.employeeId || "—" },
        {
          header: "Driver License Number",
          getValue: (row) => row.driverLicenseNumber || "—",
        },
        { header: "Phone Number", getValue: (row) => row.phoneNumber || "—" },
      ]}
      onSelect={onSelect}
    />
  );
}
