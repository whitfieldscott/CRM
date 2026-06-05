"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DestinationLicenseLookupModal } from "@/components/metrc/transfers/destination-license-lookup-modal";
import { DriverLookupModal } from "@/components/metrc/transfers/driver-lookup-modal";
import { InvoiceDetailsModal } from "@/components/metrc/transfers/invoice-details-modal";
import { LookupField } from "@/components/metrc/transfers/lookup-field";
import { PackageLookupModal } from "@/components/metrc/transfers/package-lookup-modal";
import { TransporterLookupModal } from "@/components/metrc/transfers/transporter-lookup-modal";
import { VehicleLookupModal } from "@/components/metrc/transfers/vehicle-lookup-modal";
import { TRANSFER_TYPE_OPTIONS } from "@/lib/transfer-constants";
import { formatCurrency } from "@/lib/transfer-invoice";
import {
  blankLicensedTransferDraft,
  createSlotId,
  destinationFromLicenseRecord,
  driverFromRecord,
  isTransferType,
  packageFromRecord,
  transporterFromRecord,
  validateLicensedTransferDraft,
  vehicleFromRecord,
} from "@/lib/transfer-draft";
import type {
  DestinationLicenseRecord,
  DriverRecord,
  LicensedTransferDraft,
  TransferPackageRecord,
  TransporterRecord,
  VehicleRecord,
} from "@/types/transfer";
import { toast } from "sonner";

type NewLicensedTransferModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ActiveLookup =
  | "destination"
  | "transporter"
  | "driver"
  | "vehicle"
  | "package"
  | null;

export function NewLicensedTransferModal({
  open,
  onOpenChange,
}: NewLicensedTransferModalProps) {
  const [draft, setDraft] = useState<LicensedTransferDraft>(
    blankLicensedTransferDraft(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeLookup, setActiveLookup] = useState<ActiveLookup>(null);
  const [lookupSlotId, setLookupSlotId] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(blankLicensedTransferDraft());
    setValidationError(null);
    setActiveLookup(null);
    setLookupSlotId(null);
  }, [open]);

  const updateDraft = (patch: Partial<LicensedTransferDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setValidationError(null);
  };

  const openTransporterLookup = (slotId: string) => {
    setLookupSlotId(slotId);
    setActiveLookup("transporter");
  };

  const openVehicleLookup = (slotId: string) => {
    setLookupSlotId(slotId);
    setActiveLookup("vehicle");
  };

  const openPackageLookup = (slotId: string) => {
    setLookupSlotId(slotId);
    setActiveLookup("package");
  };

  const addTransporterSlot = () => {
    updateDraft({
      transporters: [
        ...draft.transporters,
        {
          id: createSlotId("transporter"),
          transporterId: "",
          transporterLicense: "",
          businessName: "",
          phone: "",
        },
      ],
    });
  };

  const addVehicleSlot = () => {
    updateDraft({
      vehicles: [
        ...draft.vehicles,
        {
          id: createSlotId("vehicle"),
          vehicleId: "",
          vehicleName: "",
          vehicleMake: "",
          vehicleModel: "",
          licensePlate: "",
          registrationNumber: "",
          vin: "",
          notes: "",
        },
      ],
    });
  };

  const addPackageSlot = () => {
    updateDraft({
      packages: [
        ...draft.packages,
        {
          id: createSlotId("package"),
          packageId: "",
          packageTag: "",
          itemName: "",
          currentQuantity: "",
          location: "",
        },
      ],
    });
  };

  const handleSave = () => {
    const error = validateLicensedTransferDraft(draft);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onOpenChange(false);
    toast.info(
      "Licensed transfer creation will be connected to Metrc in a future phase.",
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Licensed Transfer</DialogTitle>
            <DialogDescription>
              Transfer → Manifest → Packages → Route Stops → Transporter →
              Delivery Confirmation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <section className="grid gap-4 sm:grid-cols-2">
              <LookupField
                id="destination-license"
                label="Destination License"
                value={
                  draft.destination?.destinationLicenseNumber ??
                  ""
                }
                onLookupClick={() => setActiveLookup("destination")}
                placeholder="Select licensed destination"
                required
              />
              <div className="space-y-2">
                <Label>Destination Name</Label>
                <Input
                  readOnly
                  className="bg-muted"
                  value={draft.destination?.destinationBusinessName ?? ""}
                  placeholder="Populated from license lookup"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Destination Address</Label>
                <Input
                  readOnly
                  className="bg-muted"
                  value={draft.destination?.destinationAddress ?? ""}
                  placeholder="Populated from license lookup"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-type">
                  Transfer Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={draft.transferType || undefined}
                  onValueChange={(value) => {
                    if (isTransferType(value)) {
                      updateDraft({ transferType: value });
                    }
                  }}
                >
                  <SelectTrigger id="transfer-type">
                    <SelectValue placeholder="Select transfer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-number">Invoice Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="invoice-number"
                    readOnly
                    className="bg-muted"
                    value={draft.invoiceNumber}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInvoiceModalOpen(true)}
                  >
                    Invoice Details
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Transfer total: {formatCurrency(draft.invoice.transferTotal)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="est-departure-date">
                  Estimated Departure Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="est-departure-date"
                  type="date"
                  value={draft.estimatedDepartureDate}
                  onChange={(e) =>
                    updateDraft({ estimatedDepartureDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-departure-time">Estimated Departure Time</Label>
                <Input
                  id="est-departure-time"
                  type="time"
                  value={draft.estimatedDepartureTime}
                  onChange={(e) =>
                    updateDraft({ estimatedDepartureTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-arrival-date">
                  Estimated Arrival Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="est-arrival-date"
                  type="date"
                  value={draft.estimatedArrivalDate}
                  onChange={(e) =>
                    updateDraft({ estimatedArrivalDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-arrival-time">Estimated Arrival Time</Label>
                <Input
                  id="est-arrival-time"
                  type="time"
                  value={draft.estimatedArrivalTime}
                  onChange={(e) =>
                    updateDraft({ estimatedArrivalTime: e.target.value })
                  }
                />
              </div>
            </section>

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Transporters</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTransporterSlot}
                >
                  Add Transporter
                </Button>
              </div>
              {draft.transporters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Transporter #1 — use Add Transporter to begin.
                </p>
              ) : null}
              {draft.transporters.map((transporter, index) => (
                <div
                  key={transporter.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <p className="text-sm font-medium sm:col-span-2">
                    Transporter #{index + 1}
                  </p>
                  <LookupField
                    id={`transporter-${transporter.id}`}
                    label="Transporter"
                    value={transporter.businessName || transporter.transporterLicense}
                    onLookupClick={() => openTransporterLookup(transporter.id)}
                    placeholder="Select from Admin → Transporters"
                    required
                  />
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      readOnly
                      className="bg-muted"
                      value={transporter.phone}
                      placeholder="Populated from lookup"
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Driver</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <LookupField
                  id="transfer-driver"
                  label="Driver"
                  value={draft.driver?.driverName ?? ""}
                  onLookupClick={() => setActiveLookup("driver")}
                  placeholder="Select from Admin → Drivers"
                  required
                />
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input
                    readOnly
                    className="bg-muted"
                    value={draft.driver?.employeeId ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Driver License Number</Label>
                  <Input
                    readOnly
                    className="bg-muted"
                    value={draft.driver?.driverLicenseNumber ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    readOnly
                    className="bg-muted"
                    value={draft.driver?.phoneNumber ?? ""}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Vehicles</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVehicleSlot}
                >
                  Add Vehicle
                </Button>
              </div>
              {draft.vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Vehicle #1 — use Add Vehicle to begin.
                </p>
              ) : null}
              {draft.vehicles.map((vehicle, index) => (
                <div
                  key={vehicle.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <p className="text-sm font-medium sm:col-span-2">
                    Vehicle #{index + 1}
                  </p>
                  <LookupField
                    id={`vehicle-${vehicle.id}`}
                    label="Vehicle"
                    value={vehicle.vehicleName || vehicle.licensePlate}
                    onLookupClick={() => openVehicleLookup(vehicle.id)}
                    placeholder="Select from Admin → Vehicles"
                    required
                  />
                  <div className="space-y-2">
                    <Label>License Plate</Label>
                    <Input
                      readOnly
                      className="bg-muted"
                      value={vehicle.licensePlate}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Packages</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPackageSlot}
                >
                  Add Package
                </Button>
              </div>
              {draft.packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Package #1 — use Add Package to select inventory packages.
                </p>
              ) : null}
              {draft.packages.map((pkg, index) => (
                <div
                  key={pkg.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <p className="text-sm font-medium sm:col-span-2">
                    Package #{index + 1}
                  </p>
                  <LookupField
                    id={`package-${pkg.id}`}
                    label="Package"
                    value={pkg.packageTag || pkg.itemName}
                    onLookupClick={() => openPackageLookup(pkg.id)}
                    placeholder="Select from Packages module"
                    required
                  />
                  <div className="space-y-2">
                    <Label>Current Quantity</Label>
                    <Input
                      readOnly
                      className="bg-muted"
                      value={pkg.currentQuantity}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Location</Label>
                    <Input readOnly className="bg-muted" value={pkg.location} />
                  </div>
                </div>
              ))}
            </section>

            {validationError ? (
              <p role="alert" className="text-sm text-destructive">
                {validationError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DestinationLicenseLookupModal
        open={activeLookup === "destination"}
        onOpenChange={(isOpen) => !isOpen && setActiveLookup(null)}
        onSelect={(record: DestinationLicenseRecord) => {
          updateDraft({ destination: destinationFromLicenseRecord(record) });
          setActiveLookup(null);
        }}
      />

      <TransporterLookupModal
        open={activeLookup === "transporter"}
        onOpenChange={(isOpen) => !isOpen && setActiveLookup(null)}
        onSelect={(record: TransporterRecord) => {
          if (!lookupSlotId) return;
          updateDraft({
            transporters: draft.transporters.map((slot) =>
              slot.id === lookupSlotId
                ? transporterFromRecord(record, slot.id)
                : slot,
            ),
          });
          setActiveLookup(null);
          setLookupSlotId(null);
        }}
      />

      <DriverLookupModal
        open={activeLookup === "driver"}
        onOpenChange={(isOpen) => !isOpen && setActiveLookup(null)}
        onSelect={(record: DriverRecord) => {
          updateDraft({ driver: driverFromRecord(record) });
          setActiveLookup(null);
        }}
      />

      <VehicleLookupModal
        open={activeLookup === "vehicle"}
        onOpenChange={(isOpen) => !isOpen && setActiveLookup(null)}
        onSelect={(record: VehicleRecord) => {
          if (!lookupSlotId) return;
          updateDraft({
            vehicles: draft.vehicles.map((slot) =>
              slot.id === lookupSlotId
                ? vehicleFromRecord(record, slot.id)
                : slot,
            ),
          });
          setActiveLookup(null);
          setLookupSlotId(null);
        }}
      />

      <PackageLookupModal
        open={activeLookup === "package"}
        onOpenChange={(isOpen) => !isOpen && setActiveLookup(null)}
        onSelect={(record: TransferPackageRecord) => {
          if (!lookupSlotId) return;
          updateDraft({
            packages: draft.packages.map((slot) =>
              slot.id === lookupSlotId
                ? packageFromRecord(record, slot.id)
                : slot,
            ),
          });
          setActiveLookup(null);
          setLookupSlotId(null);
        }}
      />

      <InvoiceDetailsModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        invoiceNumber={draft.invoiceNumber}
        invoice={draft.invoice}
        onSave={(invoice) => updateDraft({ invoice })}
      />
    </>
  );
}
