import { buildTransferInvoice, generateInvoiceNumber } from "@/lib/transfer-invoice";
import type {
  DestinationLicenseRecord,
  DriverRecord,
  LicensedTransferDraft,
  TransferDestination,
  TransferDriver,
  TransferInvoiceLine,
  TransferPackage,
  TransferPackageRecord,
  TransferTransporter,
  TransferType,
  TransferVehicle,
  TransporterRecord,
  VehicleRecord,
} from "@/types/transfer";

const BLANK_INVOICE_LINE: TransferInvoiceLine = {
  pricePerUnit: "",
  quantity: "",
  discount: "",
  tax: "",
  shipping: "",
  additionalFees: "",
  notes: "",
};

export function createSlotId(prefix: string): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function blankTransporterSlot(): TransferTransporter {
  return {
    id: createSlotId("transporter"),
    transporterId: "",
    transporterLicense: "",
    businessName: "",
    phone: "",
  };
}

function blankDriverSlot(): TransferDriver {
  return {
    id: createSlotId("driver"),
    driverId: "",
    driverName: "",
    employeeId: "",
    driverLicenseNumber: "",
    phoneNumber: "",
  };
}

function blankVehicleSlot(): TransferVehicle {
  return {
    id: createSlotId("vehicle"),
    vehicleId: "",
    vehicleName: "",
    vehicleMake: "",
    vehicleModel: "",
    licensePlate: "",
    registrationNumber: "",
    vin: "",
    notes: "",
  };
}

function blankPackageSlot(): TransferPackage {
  return {
    id: createSlotId("package"),
    packageId: "",
    packageTag: "",
    itemName: "",
    currentQuantity: "",
    location: "",
  };
}

export function blankLicensedTransferDraft(license: string): LicensedTransferDraft {
  const invoiceNumber = generateInvoiceNumber(license);
  return {
    destination: null,
    transferType: "",
    invoiceNumber,
    estimatedDepartureDate: "",
    estimatedDepartureTime: "",
    estimatedArrivalDate: "",
    estimatedArrivalTime: "",
    plannedRoute: "",
    transporters: [blankTransporterSlot()],
    drivers: [blankDriverSlot()],
    vehicles: [blankVehicleSlot()],
    packages: [blankPackageSlot()],
    invoice: buildTransferInvoice(invoiceNumber, { ...BLANK_INVOICE_LINE }),
    manifest: {
      manifestId: null,
      manifestNumber: null,
      plannedRoute: "",
    },
  };
}

export function destinationFromLicenseRecord(
  record: DestinationLicenseRecord,
): TransferDestination {
  return {
    destinationLicenseId: record.id,
    destinationLicenseNumber: record.licenseNumber,
    destinationBusinessName: record.legalName,
    destinationAddress: record.address,
  };
}

export function transporterFromRecord(
  record: TransporterRecord,
  slotId: string,
): TransferTransporter {
  return {
    id: slotId,
    transporterId: record.id,
    transporterLicense: record.transporterLicense,
    businessName: record.businessName,
    phone: record.phone,
  };
}

export function driverFromRecord(
  record: DriverRecord,
  slotId: string,
): TransferDriver {
  return {
    id: slotId,
    driverId: record.id,
    driverName: record.driverName,
    employeeId: record.employeeId,
    driverLicenseNumber: record.driverLicenseNumber,
    phoneNumber: record.phoneNumber,
  };
}

export function vehicleFromRecord(
  record: VehicleRecord,
  slotId: string,
): TransferVehicle {
  return {
    id: slotId,
    vehicleId: record.id,
    vehicleName: record.vehicleName,
    vehicleMake: record.vehicleMake,
    vehicleModel: record.vehicleModel,
    licensePlate: record.licensePlate,
    registrationNumber: record.registrationNumber,
    vin: record.vin,
    notes: record.notes,
  };
}

export function packageFromRecord(
  record: TransferPackageRecord,
  slotId: string,
): TransferPackage {
  return {
    id: slotId,
    packageId: record.id,
    packageTag: record.packageTag,
    itemName: record.itemName,
    currentQuantity: record.currentQuantity,
    location: record.location,
  };
}

export function validateLicensedTransferDraft(
  draft: LicensedTransferDraft,
): string | null {
  if (!draft.destination) return "Select a destination license.";
  if (!draft.transferType) return "Select a transfer type.";
  if (!draft.estimatedDepartureDate.trim()) {
    return "Estimated departure date is required.";
  }
  if (!draft.estimatedArrivalDate.trim()) {
    return "Estimated arrival date is required.";
  }
  if (draft.transporters.length === 0) {
    return "Add at least one transporter.";
  }
  if (draft.drivers.length === 0) return "Add at least one driver.";
  if (!draft.drivers.some((driver) => driver.driverId)) {
    return "Select a driver.";
  }
  if (draft.vehicles.length === 0) return "Add at least one vehicle.";
  if (draft.packages.length === 0) {
    return "Add at least one package from inventory.";
  }
  return null;
}

export function isTransferType(value: string): value is TransferType {
  return [
    "Wholesale Transfer",
    "Waste Disposal",
    "Lab Sample Transfer",
    "Decontamination Transfer",
  ].includes(value);
}

export { BLANK_INVOICE_LINE };
