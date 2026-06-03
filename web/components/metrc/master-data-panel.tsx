"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";
import type {
  MetrcItemsResponse,
  MetrcLocationsResponse,
  MetrcReferenceResponse,
  MetrcStrainsResponse,
} from "@/types/metrc";
import { toast } from "sonner";

type ReferenceBundle = {
  locationTypes: unknown;
  itemCategories: unknown;
  unitsOfMeasure: unknown;
};

export function MasterDataPanel({ license }: { license: string }) {
  const { sandbox, baseUrlHost } = useMetrcFacility();
  const [tab, setTab] = useState("locations");
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<MetrcLocationsResponse | null>(null);
  const [strains, setStrains] = useState<MetrcStrainsResponse | null>(null);
  const [items, setItems] = useState<MetrcItemsResponse | null>(null);
  const [reference, setReference] = useState<ReferenceBundle | null>(null);

  const loadMasterData = useCallback(
    async (sync: boolean) => {
      if (!license) return;
      setLoading(true);
      try {
        const params = { license, ...(sync ? { sync: true } : {}) };
        const [locRes, strainRes, itemRes] = await Promise.all([
          api.get<MetrcLocationsResponse>("/metrc/locations", { params }),
          api.get<MetrcStrainsResponse>("/metrc/strains", { params }),
          api.get<MetrcItemsResponse>("/metrc/items", { params }),
        ]);
        setLocations(locRes.data);
        setStrains(strainRes.data);
        setItems(itemRes.data);
        if (sync) {
          toast.success("Master data synced from Metrc sandbox");
        }
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [license],
  );

  const loadReference = useCallback(async () => {
    if (!license) return;
    try {
      const [lt, ic, uom] = await Promise.all([
        api.get<MetrcReferenceResponse>("/metrc/reference/location-types", {
          params: { license },
        }),
        api.get<MetrcReferenceResponse>("/metrc/reference/item-categories", {
          params: { license },
        }),
        api.get<MetrcReferenceResponse>("/metrc/reference/units-of-measure"),
      ]);
      setReference({
        locationTypes: lt.data.data,
        itemCategories: ic.data.data,
        unitsOfMeasure: uom.data.data,
      });
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }, [license]);

  useEffect(() => {
    void loadMasterData(false);
  }, [loadMasterData]);

  useEffect(() => {
    if (tab === "reference") void loadReference();
  }, [tab, loadReference]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Master data</CardTitle>
          <CardDescription>
            Cached from Metrc for{" "}
            <span className="font-mono text-xs">{license}</span> · {baseUrlHost}
            {sandbox ? " (sandbox)" : ""}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void loadMasterData(true)}
        >
          {loading ? "Loading…" : "Sync master data"}
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="locations">
              Locations ({locations?.count ?? "—"})
            </TabsTrigger>
            <TabsTrigger value="strains">
              Strains ({strains?.count ?? "—"})
            </TabsTrigger>
            <TabsTrigger value="items">Items ({items?.count ?? "—"})</TabsTrigger>
            <TabsTrigger value="reference">Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="mt-4">
            {loading && !locations ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <DataTable
                headers={["Name", "Type", "Metrc ID", "Active", "Synced"]}
                rows={(locations?.locations ?? []).map((r) => [
                  r.name ?? "—",
                  r.location_type_name ?? "—",
                  String(r.metrc_id),
                  r.is_active ? "Yes" : "No",
                  formatTime(r.synced_at),
                ])}
                empty="No locations cached. Run seed script or sync master data."
              />
            )}
          </TabsContent>

          <TabsContent value="strains" className="mt-4">
            {loading && !strains ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <DataTable
                headers={["Name", "THC", "CBD", "Metrc ID", "Synced"]}
                rows={(strains?.strains ?? []).map((r) => [
                  r.name ?? "—",
                  r.thc_level != null ? String(r.thc_level) : "—",
                  r.cbd_level != null ? String(r.cbd_level) : "—",
                  String(r.metrc_id),
                  formatTime(r.synced_at),
                ])}
                empty="No strains cached."
              />
            )}
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            {loading && !items ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <DataTable
                headers={["Name", "Category", "UoM", "Metrc ID", "Synced"]}
                rows={(items?.items ?? []).map((r) => [
                  r.name ?? "—",
                  r.product_category_name ?? "—",
                  r.unit_of_measure_name ?? "—",
                  String(r.metrc_id),
                  formatTime(r.synced_at),
                ])}
                empty="No items cached."
              />
            )}
          </TabsContent>

          <TabsContent value="reference" className="mt-4">
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
              {reference
                ? JSON.stringify(reference, null, 2)
                : "Loading reference data…"}
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
