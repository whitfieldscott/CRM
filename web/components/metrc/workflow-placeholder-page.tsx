"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WorkflowPlaceholderPageProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  comingSoon?: boolean;
};

export function WorkflowPlaceholderPage({
  title,
  description,
  emptyTitle,
  emptyBody,
  comingSoon = false,
}: WorkflowPlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {comingSoon ? (
          <Badge variant="outline" className="text-xs font-normal">
            Coming Soon
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{emptyTitle}</CardTitle>
          <CardDescription>{emptyBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border-theme/60 bg-background/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No records to display. Workflow integration is coming in a future
              phase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
