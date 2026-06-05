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
import { Textarea } from "@/components/ui/textarea";
import { BLANK_INVOICE_LINE } from "@/lib/transfer-draft";
import {
  buildTransferInvoice,
  formatCurrency,
} from "@/lib/transfer-invoice";
import type { TransferInvoice, TransferInvoiceLine } from "@/types/transfer";

type InvoiceDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  invoice: TransferInvoice;
  onSave: (invoice: TransferInvoice) => void;
};

export function InvoiceDetailsModal({
  open,
  onOpenChange,
  invoiceNumber,
  invoice,
  onSave,
}: InvoiceDetailsModalProps) {
  const [line, setLine] = useState<TransferInvoiceLine>(invoice.line);
  const [preview, setPreview] = useState(invoice);

  useEffect(() => {
    if (!open) return;
    setLine(invoice.line);
    setPreview(invoice);
  }, [open, invoice]);

  const updateLine = (patch: Partial<TransferInvoiceLine>) => {
    const nextLine = { ...line, ...patch };
    setLine(nextLine);
    setPreview(buildTransferInvoice(invoiceNumber, nextLine));
  };

  const handleSave = () => {
    onSave(preview);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
          <DialogDescription>
            {invoiceNumber} — pricing architecture for future invoice generation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invoice-price-per-unit">Price Per Unit</Label>
            <Input
              id="invoice-price-per-unit"
              type="number"
              min="0"
              step="any"
              value={line.pricePerUnit}
              onChange={(e) => updateLine({ pricePerUnit: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-quantity">Quantity</Label>
            <Input
              id="invoice-quantity"
              type="number"
              min="0"
              step="any"
              value={line.quantity}
              onChange={(e) => updateLine({ quantity: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-discount">Discount</Label>
            <Input
              id="invoice-discount"
              type="number"
              min="0"
              step="any"
              value={line.discount}
              onChange={(e) => updateLine({ discount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-tax">Tax</Label>
            <Input
              id="invoice-tax"
              type="number"
              min="0"
              step="any"
              value={line.tax}
              onChange={(e) => updateLine({ tax: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-shipping">Shipping</Label>
            <Input
              id="invoice-shipping"
              type="number"
              min="0"
              step="any"
              value={line.shipping}
              onChange={(e) => updateLine({ shipping: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-additional-fees">Additional Fees</Label>
            <Input
              id="invoice-additional-fees"
              type="number"
              min="0"
              step="any"
              value={line.additionalFees}
              onChange={(e) => updateLine({ additionalFees: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Notes</Label>
            <Textarea
              id="invoice-notes"
              value={line.notes}
              onChange={(e) => updateLine({ notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Line Total</span>
              <span className="font-medium">
                {formatCurrency(preview.lineTotal)}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Transfer Total</span>
              <span className="font-semibold">
                {formatCurrency(preview.transferTotal)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLine({ ...BLANK_INVOICE_LINE });
              setPreview(buildTransferInvoice(invoiceNumber, BLANK_INVOICE_LINE));
            }}
          >
            Reset
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
