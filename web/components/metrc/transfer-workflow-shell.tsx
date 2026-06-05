"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetrcDataTable } from "@/components/metrc/metrc-data-table";

export type TransferWorkflowAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
};

export type TransferWorkflowTab = {
  id: string;
  label: string;
};

type TransferWorkflowShellProps = {
  title: string;
  description: string;
  actions: TransferWorkflowAction[];
  headers: readonly string[];
  emptyMessage: string;
  tabs?: TransferWorkflowTab[];
  cardTitle?: string;
};

function TransferTablePanel({
  headers,
  emptyMessage,
}: {
  headers: readonly string[];
  emptyMessage: string;
}) {
  return (
    <MetrcDataTable
      headers={[...headers]}
      rows={[]}
      empty={emptyMessage}
    />
  );
}

export function TransferWorkflowShell({
  title,
  description,
  actions,
  headers,
  emptyMessage,
  tabs,
  cardTitle,
}: TransferWorkflowShellProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id ?? "default");

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                size="sm"
                variant={action.variant ?? "default"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{cardTitle ?? title}</CardTitle>
          <CardDescription>
            Transfer → Manifest → Packages → Route Stops → Transporter → Delivery
            Confirmation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tabs && tabs.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  <TransferTablePanel
                    headers={headers}
                    emptyMessage={emptyMessage}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <TransferTablePanel headers={headers} emptyMessage={emptyMessage} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
