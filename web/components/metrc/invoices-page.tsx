"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetrcDataTable } from "@/components/metrc/metrc-data-table";
import { INVOICE_TABLE_HEADERS } from "@/lib/transfer-constants";
import { formatCurrency } from "@/lib/transfer-invoice";
import { fetchInvoices } from "@/lib/transfer-lookup-sources";
import type { InvoiceListRecord } from "@/types/transfer";

export function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceListRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchInvoices()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Transfer invoices linked to manifests and licensed shipments.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transfer Invoices</CardTitle>
          <CardDescription>
            Statuses: Draft, Pending, Paid, Cancelled. Invoice numbers link to
            detail pages when records are available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <MetrcDataTable
              headers={[...INVOICE_TABLE_HEADERS]}
              rows={[]}
              empty="No invoices available."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b">
                    {INVOICE_TABLE_HEADERS.map((header) => (
                      <th
                        key={header}
                        className="h-10 whitespace-nowrap px-3 text-left align-middle font-medium text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.invoiceNumber} className="border-b">
                      <td className="p-3 align-middle">
                        <Link
                          href={`/invoices/${encodeURIComponent(row.invoiceNumber)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="p-3 align-middle">
                        {row.manifestNumber || "—"}
                      </td>
                      <td className="p-3 align-middle">
                        {row.transferDate || "—"}
                      </td>
                      <td className="p-3 align-middle">
                        {row.destinationBusiness || "—"}
                      </td>
                      <td className="p-3 align-middle">
                        {row.transferType || "—"}
                      </td>
                      <td className="p-3 align-middle">
                        {formatCurrency(row.totalPrice)}
                      </td>
                      <td className="p-3 align-middle">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
