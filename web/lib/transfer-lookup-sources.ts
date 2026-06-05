/**
 * Placeholder lookup sources for transfer workflows.
 * Returns empty arrays until Metrc sync and Admin entity modules are connected.
 */

import type {
  DestinationLicenseRecord,
  DriverRecord,
  InvoiceListRecord,
  TransferPackageRecord,
  TransporterRecord,
  VehicleRecord,
} from "@/types/transfer";

export async function fetchDestinationLicenses(): Promise<
  DestinationLicenseRecord[]
> {
  return [];
}

export async function fetchTransporters(): Promise<TransporterRecord[]> {
  return [];
}

export async function fetchDrivers(): Promise<DriverRecord[]> {
  return [];
}

export async function fetchVehicles(): Promise<VehicleRecord[]> {
  return [];
}

export async function fetchTransferPackages(): Promise<TransferPackageRecord[]> {
  return [];
}

export async function fetchInvoices(): Promise<InvoiceListRecord[]> {
  return [];
}
