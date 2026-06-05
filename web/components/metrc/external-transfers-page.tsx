"use client";

import { TransferWorkflowShell } from "@/components/metrc/transfer-workflow-shell";
import {
  EXTERNAL_TRANSFER_TABLE_HEADERS,
  EXTERNAL_TRANSFER_TABS,
  getTransferMenuItem,
} from "@/lib/metrc-transfer-routes";
import { toast } from "sonner";

export function ExternalTransfersPage() {
  const config = getTransferMenuItem("external");

  return (
    <TransferWorkflowShell
      title={config.pageTitle}
      description={config.description}
      emptyMessage={config.emptyMessage}
      headers={EXTERNAL_TRANSFER_TABLE_HEADERS}
      tabs={EXTERNAL_TRANSFER_TABS}
      actions={[
        {
          label: "View Manifest",
          variant: "outline",
          onClick: () =>
            toast.info("View Manifest workflow will be connected in a future phase."),
        },
      ]}
    />
  );
}
