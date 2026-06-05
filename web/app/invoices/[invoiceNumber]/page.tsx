"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function InvoiceDetailPage() {
  const params = useParams();
  const raw = params.invoiceNumber;
  const invoiceNumber =
    typeof raw === "string" ? decodeURIComponent(raw) : "";

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Invoice Detail</h1>
          <p className="text-sm text-muted-foreground">{invoiceNumber}</p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/invoices">Back to Invoices</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice workflow shell</CardTitle>
          <CardDescription>
            Detail view will connect to transfer invoice records and PDF
            generation in a future phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border-theme/60 bg-background/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No invoice record loaded. Invoice detail will populate when
              transfer creation is connected.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
