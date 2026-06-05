import type { TransferInvoice, TransferInvoiceLine } from "@/types/transfer";

const INVOICE_COUNTER_KEY = "cannacore-invoice-sequence";

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function generateInvoiceNumber(date = new Date()): string {
  const year = date.getFullYear();
  let sequence = 1;

  if (typeof window !== "undefined") {
    const stored = window.sessionStorage.getItem(INVOICE_COUNTER_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { year: number; sequence: number };
        if (parsed.year === year) {
          sequence = parsed.sequence + 1;
        }
      } catch {
        sequence = 1;
      }
    }
    window.sessionStorage.setItem(
      INVOICE_COUNTER_KEY,
      JSON.stringify({ year, sequence }),
    );
  }

  return `INV-${year}-${String(sequence).padStart(6, "0")}`;
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
