"use client";

import { TransferWorkflowShell } from "@/components/metrc/transfer-workflow-shell";
import {
  getTransferMenuItem,
  TRANSFER_TEMPLATE_TABLE_HEADERS,
} from "@/lib/metrc-transfer-routes";
import { toast } from "sonner";

export function TransferTemplatesPage() {
  const config = getTransferMenuItem("templates");

  return (
    <TransferWorkflowShell
      title={config.pageTitle}
      description={config.description}
      emptyMessage={config.emptyMessage}
      headers={TRANSFER_TEMPLATE_TABLE_HEADERS}
      actions={[
        {
          label: "New Template",
          onClick: () =>
            toast.info("New Template workflow will be connected in a future phase."),
        },
      ]}
    />
  );
}
