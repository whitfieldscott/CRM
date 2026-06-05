"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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
  license: string;
};

type ActiveLookup =
  | "destination"
  | "transporter"
  | "driver"
  | "vehicle"
  | "package"
  | null;

function SlotRemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={label}
      onClick={onClick}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

export function NewLicensedTransferModal({
  open,
  onOpenChange,
  license,
}: NewLicensedTransferModalProps) {
  const [draft, setDraft] = useState<LicensedTransferDraft>(() =>
    blankLicensedTransferDraft(license),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeLookup, setActiveLookup] = useState<ActiveLookup>(null);
  const [lookupSlotId, setLookupSlotId] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(blankLicensedTransferDraft(license));
    setValidationError(null);
    setActiveLookup(null);
    setLookupSlotId(null);
  }, [open, license]);

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

  const openDriverLookup = (slotId: string) => {
    setLookupSlotId(slotId);
    setActiveLookup("driver");
  };

  const openPackageLookup = (slotId: string) => {
    setLookupSlotId(slotId);
    setActiveLookup("package");
  };

  const removeTransporterSlot = (slotId: string) => {
    setDraft((prev) => {
      if (prev.transporters.length <= 1) return prev;
      return {
        ...prev,
        transporters: prev.transporters.filter((slot) => slot.id !== slotId),
      };
    });
    setValidationError(null);
  };

  const removeDriverSlot = (slotId: string) => {
    setDraft((prev) => {
      if (prev.drivers.length <= 1) return prev;
      return {
        ...prev,
        drivers: prev.drivers.filter((slot) => slot.id !== slotId),
      };
    });
    setValidationError(null);
  };

  const removeVehicleSlot = (slotId: string) => {
    setDraft((prev) => {
      if (prev.vehicles.length <= 1) return prev;
      return {
        ...prev,
        vehicles: prev.vehicles.filter((slot) => slot.id !== slotId),
      };
    });
    setValidationError(null);
  };

  const removePackageSlot = (slotId: string) => {
    setDraft((prev) => {
      if (prev.packages.length <= 1) return prev;
      return {
        ...prev,
        packages: prev.packages.filter((slot) => slot.id !== slotId),
      };
    });
    setValidationError(null);
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

  const addDriverSlot = () => {
    updateDraft({
      drivers: [
        ...draft.drivers,
        {
          id: createSlotId("driver"),
          driverId: "",
          driverName: "",
          employeeId: "",
          driverLicenseNumber: "",
          phoneNumber: "",
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

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="planned-route">Planned Route</Label>
                <Textarea
                  id="planned-route"
                  value={draft.plannedRoute}
                  onChange={(e) => {
                    const plannedRoute = e.target.value;
                    updateDraft({
                      plannedRoute,
                      manifest: {
                        ...draft.manifest,
                        plannedRoute,
                      },
                    });
                  }}
                  rows={4}
                  placeholder="Paste planned route or driving directions from departing facility to destination."
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
              {draft.transporters.map((transporter, index) => (
                <div
                  key={transporter.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <div className="flex items-start justify-between sm:col-span-2">
                    <p className="text-sm font-medium">
                      Transporter #{index + 1}
                    </p>
                    {draft.transporters.length > 1 ? (
                      <SlotRemoveButton
                        label="Remove Transporter"
                        onClick={() => removeTransporterSlot(transporter.id)}
                      />
                    ) : null}
                  </div>
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Drivers</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDriverSlot}
                >
                  Add Driver
                </Button>
              </div>
              {draft.drivers.map((driver, index) => (
                <div
                  key={driver.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <div className="flex items-start justify-between sm:col-span-2">
                    <p className="text-sm font-medium">Driver #{index + 1}</p>
                    {draft.drivers.length > 1 ? (
                      <SlotRemoveButton
                        label="Remove Driver"
                        onClick={() => removeDriverSlot(driver.id)}
                      />
                    ) : null}
                  </div>
                  <LookupField
                    id={`driver-${driver.id}`}
                    label="Driver"
                    value={driver.driverName}
                    onLookupClick={() => openDriverLookup(driver.id)}
                    placeholder="Select from Admin → Drivers"
                    required
                  />
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input
                      readOnly
                      className="bg-muted"
                      value={driver.employeeId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Driver License Number</Label>
                    <Input
                      readOnly
                      className="bg-muted"
                      value={driver.driverLicenseNumber}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      readOnly
                      className="bg-muted"
                      value={driver.phoneNumber}
                      placeholder="Populated from lookup"
                    />
                  </div>
                </div>
              ))}
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
              {draft.vehicles.map((vehicle, index) => (
                <div
                  key={vehicle.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <div className="flex items-start justify-between sm:col-span-2">
                    <p className="text-sm font-medium">Vehicle #{index + 1}</p>
                    {draft.vehicles.length > 1 ? (
                      <SlotRemoveButton
                        label="Remove Vehicle"
                        onClick={() => removeVehicleSlot(vehicle.id)}
                      />
                    ) : null}
                  </div>
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
              {draft.packages.map((pkg, index) => (
                <div
                  key={pkg.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <div className="flex items-start justify-between sm:col-span-2">
                    <p className="text-sm font-medium">Package #{index + 1}</p>
                    {draft.packages.length > 1 ? (
                      <SlotRemoveButton
                        label="Remove Package"
                        onClick={() => removePackageSlot(pkg.id)}
                      />
                    ) : null}
                  </div>
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
          if (!lookupSlotId) return;
          setDraft((prev) => ({
            ...prev,
            drivers: prev.drivers.map((slot) =>
              slot.id === lookupSlotId
                ? driverFromRecord(record, slot.id)
                : slot,
            ),
          }));
          setActiveLookup(null);
          setLookupSlotId(null);
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
