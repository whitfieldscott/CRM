"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TransferWorkflowShell } from "@/components/metrc/transfer-workflow-shell";
import {
  getTransferMenuItem,
  LICENSED_TRANSFER_TABLE_HEADERS,
  LICENSED_TRANSFER_TABS,
} from "@/lib/metrc-transfer-routes";
import { toast } from "sonner";

const NewLicensedTransferModal = dynamic(
  () =>
    import("@/components/metrc/transfers/new-licensed-transfer-modal").then(
      (m) => m.NewLicensedTransferModal,
    ),
  { ssr: false, loading: () => null },
);

export function LicensedTransfersPage({ license }: { license: string }) {
  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const config = getTransferMenuItem("licensed");

  return (
    <>
      <TransferWorkflowShell
        title={config.pageTitle}
        description={config.description}
        emptyMessage={config.emptyMessage}
        headers={LICENSED_TRANSFER_TABLE_HEADERS}
        tabs={LICENSED_TRANSFER_TABS}
        actions={[
          {
            label: "New Transfer",
            onClick: () => setNewTransferOpen(true),
          },
          {
            label: "View Manifest",
            variant: "outline",
            onClick: () =>
              toast.info(
                "View Manifest workflow will be connected in a future phase.",
              ),
          },
        ]}
      />

      {newTransferOpen ? (
        <NewLicensedTransferModal
          open={newTransferOpen}
          onOpenChange={setNewTransferOpen}
          license={license}
        />
      ) : null}
    </>
  );
}
