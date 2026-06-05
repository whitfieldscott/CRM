/** Frontend transfer workflow models — architecture for future Metrc sync. */

export type TransferType =
  | "Wholesale Transfer"
  | "Waste Disposal"
  | "Lab Sample Transfer"
  | "Decontamination Transfer";

export type InvoiceStatus = "Draft" | "Pending" | "Paid" | "Cancelled";

export type TransferDestination = {
  destinationLicenseId: string;
  destinationLicenseNumber: string;
  destinationBusinessName: string;
  destinationAddress: string;
};

export type TransferTransporter = {
  id: string;
  transporterId: string;
  transporterLicense: string;
  businessName: string;
  phone: string;
};

export type TransferDriver = {
  driverId: string;
  driverName: string;
  employeeId: string;
  driverLicenseNumber: string;
  phoneNumber: string;
};

export type TransferVehicle = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleMake: string;
  vehicleModel: string;
  licensePlate: string;
  registrationNumber: string;
  vin: string;
  notes: string;
};

export type TransferPackage = {
  id: string;
  packageId: string;
  packageTag: string;
  itemName: string;
  currentQuantity: string;
  location: string;
};

export type TransferInvoiceLine = {
  pricePerUnit: string;
  quantity: string;
  discount: string;
  tax: string;
  shipping: string;
  additionalFees: string;
  notes: string;
};

export type TransferInvoice = {
  invoiceNumber: string;
  line: TransferInvoiceLine;
  lineTotal: number;
  transferTotal: number;
};

export type TransferManifest = {
  manifestId: string | null;
  manifestNumber: string | null;
};

/** Licensed transfer draft — UI state until backend pipeline is connected. */
export type LicensedTransferDraft = {
  destination: TransferDestination | null;
  transferType: TransferType | "";
  invoiceNumber: string;
  estimatedDepartureDate: string;
  estimatedDepartureTime: string;
  estimatedArrivalDate: string;
  estimatedArrivalTime: string;
  transporters: TransferTransporter[];
  driver: TransferDriver | null;
  vehicles: TransferVehicle[];
  packages: TransferPackage[];
  invoice: TransferInvoice;
  manifest: TransferManifest;
};

export type TransferRecord = LicensedTransferDraft & {
  id: string;
  status: InvoiceStatus;
  transferDate: string | null;
};

/** Lookup source record shapes (populated from Metrc / Admin modules later). */
export type DestinationLicenseRecord = {
  id: string;
  licenseNumber: string;
  legalName: string;
  licenseType: string;
  address: string;
  mainPhone: string;
  mobilePhone: string;
};

export type TransporterRecord = {
  id: string;
  transporterLicense: string;
  businessName: string;
  phone: string;
};

export type DriverRecord = {
  id: string;
  driverName: string;
  employeeId: string;
  driverLicenseNumber: string;
  phoneNumber: string;
};

export type VehicleRecord = {
  id: string;
  vehicleName: string;
  vehicleMake: string;
  vehicleModel: string;
  licensePlate: string;
  registrationNumber: string;
  vin: string;
  notes: string;
};

export type TransferPackageRecord = {
  id: string;
  packageTag: string;
  itemName: string;
  currentQuantity: string;
  location: string;
};

export type InvoiceListRecord = {
  invoiceNumber: string;
  manifestNumber: string;
  transferDate: string;
  destinationBusiness: string;
  transferType: TransferType | "";
  totalPrice: number;
  status: InvoiceStatus;
};
