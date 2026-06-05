import type { TransferInvoice, TransferInvoiceLine } from "@/types/transfer";

const INVOICE_COUNTER_KEY = "cannacore-invoice-sequence-by-license";

type LicenseInvoiceCounter = {
  yy: string;
  sequence: number;
};

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Last 4 digits of license (non-digits stripped), zero-padded when fewer than 4. */
export function extractLicenseInvoicePrefix(license: string): string {
  const digits = license.replace(/\D/g, "");
  if (!digits) return "0000";
  return digits.slice(-4).padStart(4, "0");
}

function readLicenseCounters(): Record<string, LicenseInvoiceCounter> {
  if (typeof window === "undefined") return {};
  const stored = window.sessionStorage.getItem(INVOICE_COUNTER_KEY);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as Record<string, LicenseInvoiceCounter>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLicenseCounters(counters: Record<string, LicenseInvoiceCounter>): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(INVOICE_COUNTER_KEY, JSON.stringify(counters));
}

/**
 * Generate invoice number: LLLL-YY-000001
 * LLLL = last 4 license digits, YY = 2-digit year, counter scoped per license.
 */
export function generateInvoiceNumber(
  license: string,
  date = new Date(),
): string {
  const licenseKey = license.trim() || "unknown";
  const prefix = extractLicenseInvoicePrefix(licenseKey);
  const yy = String(date.getFullYear()).slice(-2);

  const counters = readLicenseCounters();
  const existing = counters[licenseKey];
  const sequence =
    existing && existing.yy === yy ? existing.sequence + 1 : 1;

  counters[licenseKey] = { yy, sequence };
  writeLicenseCounters(counters);

  return `${prefix}-${yy}-${String(sequence).padStart(6, "0")}`;
}

export function calculateLineTotal(line: TransferInvoiceLine): number {
  const subtotal = parseMoney(line.pricePerUnit) * parseMoney(line.quantity);
  const discount = parseMoney(line.discount);
  const tax = parseMoney(line.tax);
  const shipping = parseMoney(line.shipping);
  const fees = parseMoney(line.additionalFees);
  return Math.max(0, subtotal - discount + tax + shipping + fees);
}

export function calculateTransferTotal(lineTotal: number): number {
  return lineTotal;
}

export function buildTransferInvoice(
  invoiceNumber: string,
  line: TransferInvoiceLine,
): TransferInvoice {
  const lineTotal = calculateLineTotal(line);
  return {
    invoiceNumber,
    line,
    lineTotal,
    transferTotal: calculateTransferTotal(lineTotal),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
