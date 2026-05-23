import { Suspense } from "react";
import MarketingCampaignsClient from "./marketing-campaigns-client";

export default function MarketingCampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-text-secondary">Loading marketing campaigns…</div>
      }
    >
      <MarketingCampaignsClient />
    </Suspense>
  );
}
