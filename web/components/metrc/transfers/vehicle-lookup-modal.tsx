"use client";

import { useEffect, useState } from "react";
import { LookupSelectorModal } from "@/components/metrc/transfers/lookup-selector-modal";
import { VEHICLE_LOOKUP_HEADERS } from "@/lib/transfer-constants";
import { fetchVehicles } from "@/lib/transfer-lookup-sources";
import type { VehicleRecord } from "@/types/transfer";

type VehicleLookupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (record: VehicleRecord) => void;
};

export function VehicleLookupModal({
  open,
  onOpenChange,
  onSelect,
}: VehicleLookupModalProps) {
  const [rows, setRows] = useState<VehicleRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetchVehicles().then(setRows);
  }, [open]);

  return (
    <LookupSelectorModal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Vehicle"
      description="Vehicles are managed under Admin → Vehicles."
      headers={[...VEHICLE_LOOKUP_HEADERS]}
      rows={rows}
      emptyMessage="No vehicles available. Add vehicles under Admin → Vehicles."
      searchPlaceholder="Search vehicle name or license plate…"
      getSearchText={(row) =>
        `${row.vehicleName} ${row.vehicleMake} ${row.vehicleModel} ${row.licensePlate} ${row.vin}`
      }
      columns={[
        { header: "Vehicle Name", getValue: (row) => row.vehicleName },
        { header: "Make", getValue: (row) => row.vehicleMake || "—" },
        { header: "Model", getValue: (row) => row.vehicleModel || "—" },
        { header: "License Plate", getValue: (row) => row.licensePlate || "—" },
        {
          header: "Registration Number",
          getValue: (row) => row.registrationNumber || "—",
        },
        { header: "VIN", getValue: (row) => row.vin || "—" },
      ]}
      onSelect={onSelect}
    />
  );
}
