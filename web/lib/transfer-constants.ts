import type { TransferType } from "@/types/transfer";

export const TRANSFER_TYPE_OPTIONS: TransferType[] = [
  "Wholesale Transfer",
  "Waste Disposal",
  "Lab Sample Transfer",
  "Decontamination Transfer",
];

export const DESTINATION_LICENSE_LOOKUP_HEADERS = [
  "License Number",
  "Legal Name",
  "License Type",
  "Address",
  "Main Phone",
  "Mobile Phone",
] as const;

export const TRANSPORTER_LOOKUP_HEADERS = [
  "Transporter License",
  "Business Name",
  "Phone",
] as const;

export const DRIVER_LOOKUP_HEADERS = [
  "Driver Name",
  "Employee ID",
  "Driver License Number",
  "Phone Number",
] as const;

export const VEHICLE_LOOKUP_HEADERS = [
  "Vehicle Name",
  "Make",
  "Model",
  "License Plate",
  "Registration Number",
  "VIN",
] as const;

export const PACKAGE_LOOKUP_HEADERS = [
  "Package Tag",
  "Item Name",
  "Current Quantity",
  "Location",
] as const;

export const INVOICE_TABLE_HEADERS = [
  "Invoice Number",
  "Manifest Number",
  "Transfer Date",
  "Destination Business",
  "Transfer Type",
  "Total Price",
  "Status",
] as const;

export const INVOICE_STATUS_OPTIONS = [
  "Draft",
  "Pending",
  "Paid",
  "Cancelled",
] as const;
