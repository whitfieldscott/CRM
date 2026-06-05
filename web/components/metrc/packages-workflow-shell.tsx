"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetrcDataTable } from "@/components/metrc/metrc-data-table";
import {
  DEFAULT_PACKAGE_TAB_ID,
  PACKAGE_TABS,
  type PackageTabConfig,
  type PackageTabId,
} from "@/lib/metrc-package-routes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PACKAGE_ACTION_BUTTON_CLASS =
  "h-7 shrink-0 px-2 text-xs font-medium sm:px-2.5";

function PackageTabPanel({ tab }: { tab: PackageTabConfig }) {
  return (
    <div className="space-y-4">
      {tab.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1 sm:flex-nowrap sm:overflow-x-auto">
          {tab.actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              size="sm"
              variant={action.variant ?? "outline"}
              className={cn(PACKAGE_ACTION_BUTTON_CLASS)}
              onClick={() =>
                toast.info(
                  `${action.label} workflow will be connected in a future phase.`,
                )
              }
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      <MetrcDataTable
        headers={[...tab.headers]}
        rows={[]}
        empty={tab.emptyMessage}
      />
    </div>
  );
}

export function PackagesWorkflowShell() {
  const [activeTab, setActiveTab] = useState<PackageTabId>(DEFAULT_PACKAGE_TAB_ID);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Packages</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as PackageTabId)}
          >
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              {PACKAGE_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {PACKAGE_TABS.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                <PackageTabPanel tab={tab} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
