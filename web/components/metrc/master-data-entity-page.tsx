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
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCreateDrawer } from "@/components/metrc/item-create-drawer";
import { ItemsManagementTable } from "@/components/metrc/items-management-table";
import { LocationsManagementTable } from "@/components/metrc/locations-management-table";
import { StrainsManagementTable } from "@/components/metrc/strains-management-table";
import { useMetrcFacility } from "@/components/metrc/metrc-facility-context";
import { blankItemDraft, type ItemDraft } from "@/lib/master-data-edit";
import type {
  MetrcItemsResponse,
  MetrcLocationsResponse,
  MetrcReferenceResponse,
  MetrcStrainsResponse,
} from "@/types/metrc";
import { toast } from "sonner";

export type MasterDataEntity =
  | "locations"
  | "strains"
  | "items"
  | "units-of-measure";

type EntityConfig = {
  title: string;
  subtitle: string;
  syncLabel: string;
  createLabel?: string;
  emptyTitle: string;
  emptyBody: string;
};

const ENTITY_CONFIG: Record<MasterDataEntity, EntityConfig> = {
  locations: {
    title: "Locations",
    subtitle: "Grow rooms and facility areas from Metrc.",
    syncLabel: "Sync locations",
    createLabel: "Create Location",
    emptyTitle: "No locations created yet",
    emptyBody: "Create your first location before creating plant batches.",
  },
  strains: {
    title: "Strains",
    subtitle: "Cannabis strains used for plant batches and inventory.",
    syncLabel: "Sync strains",
    createLabel: "Create Strain",
    emptyTitle: "No strains created yet",
    emptyBody: "Create your first strain before creating plant batches.",
  },
  items: {
    title: "Items",
    subtitle: "Product and plant item definitions from Metrc.",
    syncLabel: "Sync items",
    createLabel: "Create Item",
    emptyTitle: "No items created yet",
    emptyBody: "Create your first item before creating packages.",
  },
  "units-of-measure": {
    title: "Units of Measure",
    subtitle: "Metrc reference units — read only.",
    syncLabel: "Refresh units",
    emptyTitle: "No units of measure available",
    emptyBody: "Reference data will load from Metrc when available.",
  },
};

function ManagementEmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border-theme/60 bg-background/40 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function MasterDataEntityPage({
  license,
  entity,
}: {
  license: string;
  entity: MasterDataEntity;
}) {
  const { sandbox } = useMetrcFacility();
  const config = ENTITY_CONFIG[entity];
  const canCreate = entity !== "units-of-measure";

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<MetrcLocationsResponse | null>(null);
  const [strains, setStrains] = useState<MetrcStrainsResponse | null>(null);
  const [items, setItems] = useState<MetrcItemsResponse | null>(null);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<unknown>(null);
  const [itemCreateOpen, setItemCreateOpen] = useState(false);
  const [itemCreateDraft, setItemCreateDraft] = useState<ItemDraft | null>(null);

  const loadEntity = useCallback(
    async (sync: boolean) => {
      if (!license) return;
      setLoading(true);
      try {
        const params = { license, ...(sync ? { sync: true } : {}) };

        if (entity === "locations") {
          const { data } = await api.get<MetrcLocationsResponse>("/metrc/locations", {
            params,
          });
          setLocations(data);
        } else if (entity === "strains") {
          const { data } = await api.get<MetrcStrainsResponse>("/metrc/strains", {
            params,
          });
          setStrains(data);
        } else if (entity === "items") {
          const { data } = await api.get<MetrcItemsResponse>("/metrc/items", {
            params,
          });
          setItems(data);
        } else {
          const { data } = await api.get<MetrcReferenceResponse>(
            "/metrc/reference/units-of-measure",
          );
          setUnitsOfMeasure(data.data);
        }

        if (sync) {
          toast.success(`${config.title} synced from Metrc${sandbox ? " sandbox" : ""}`);
        }
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [license, entity, config.title, sandbox],
  );

  useEffect(() => {
    void loadEntity(false);
  }, [loadEntity]);

  const handleCreate = () => {
    if (!config.createLabel) return;
    if (entity === "items") {
      setItemCreateDraft(blankItemDraft());
      setItemCreateOpen(true);
      return;
    }
    toast.info(`${config.createLabel} — coming soon`);
  };

  const locationRows = locations?.locations ?? [];
  const strainRows = strains?.strains ?? [];
  const itemRows = items?.items ?? [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{config.title}</h1>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canCreate && config.createLabel ? (
            <Button type="button" size="sm" variant="default" onClick={handleCreate}>
              {config.createLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void loadEntity(true)}
          >
            {loading ? "Loading…" : config.syncLabel}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{config.title}</CardTitle>
          <CardDescription>
            {entity === "locations" && locationRows.length > 0
              ? `${locationRows.length} location${locationRows.length === 1 ? "" : "s"} synced`
              : entity === "strains" && strainRows.length > 0
                ? `${strainRows.length} strain${strainRows.length === 1 ? "" : "s"} synced`
                : entity === "items" && itemRows.length > 0
                  ? `${itemRows.length} item${itemRows.length === 1 ? "" : "s"} synced`
                  : "Synced from Metrc cache"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entity === "locations" ? (
            loading && !locations ? (
              <Skeleton className="h-32 w-full" />
            ) : locationRows.length === 0 ? (
              <ManagementEmptyState
                title={config.emptyTitle}
                body={config.emptyBody}
              />
            ) : (
              <LocationsManagementTable
                rows={locationRows}
                empty={config.emptyBody}
              />
            )
          ) : null}

          {entity === "strains" ? (
            loading && !strains ? (
              <Skeleton className="h-32 w-full" />
            ) : strainRows.length === 0 ? (
              <ManagementEmptyState
                title={config.emptyTitle}
                body={config.emptyBody}
              />
            ) : (
              <StrainsManagementTable
                rows={strainRows}
                empty={config.emptyBody}
              />
            )
          ) : null}

          {entity === "items" ? (
            loading && !items ? (
              <Skeleton className="h-32 w-full" />
            ) : itemRows.length === 0 ? (
              <ManagementEmptyState
                title={config.emptyTitle}
                body={config.emptyBody}
              />
            ) : (
              <ItemsManagementTable rows={itemRows} empty={config.emptyBody} />
            )
          ) : null}

          {entity === "items" ? (
            <ItemCreateDrawer
              open={itemCreateOpen}
              draft={itemCreateDraft}
              onDraftChange={setItemCreateDraft}
              onCancel={() => {
                setItemCreateOpen(false);
                setItemCreateDraft(null);
              }}
            />
          ) : null}

          {entity === "units-of-measure" ? (
            loading && unitsOfMeasure === null ? (
              <Skeleton className="h-32 w-full" />
            ) : !unitsOfMeasure ||
              (Array.isArray(unitsOfMeasure) && unitsOfMeasure.length === 0) ? (
              <ManagementEmptyState
                title={config.emptyTitle}
                body={config.emptyBody}
              />
            ) : (
              <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-4 text-xs">
                {JSON.stringify(unitsOfMeasure, null, 2)}
              </pre>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
