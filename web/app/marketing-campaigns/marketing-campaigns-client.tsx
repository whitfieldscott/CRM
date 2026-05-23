"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CannaCoreTopbar } from "@/components/cannacore/cannacore-topbar";
import { EmailCampaignWorkspace } from "@/components/marketing/email-campaign-workspace";

type MarketingTab = "email-campaigns" | "text-campaigns" | "email-editor" | "text-editor";

export default function MarketingCampaignsClient() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as MarketingTab | null) ?? "email-editor";

  const activeSection = useMemo<"editor" | "history">(() => {
    if (tab === "email-campaigns") return "history";
    return "editor";
  }, [tab]);

  return (
    <>
      <CannaCoreTopbar
        title="Marketing Campaigns"
        subtitle="Create, manage, and track email and text message campaigns."
      />

      <section className="cannacore-context-row">
        <nav className="cannacore-tabs">
          {[
            ["email-campaigns", "Email Campaigns"],
            ["text-campaigns", "Text Campaigns"],
            ["email-editor", "Email Editor"],
            ["text-editor", "Text Editor"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`/marketing-campaigns?tab=${id}`}
              className={`cannacore-tab ${tab === id ? "active" : ""}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <button type="button" className="cannacore-action-btn">
          + New Email Campaign⌄
        </button>
      </section>

      {tab === "email-campaigns" ? (
        <>
          <section className="cannacore-kpi-grid-5">
            {[
              ["✉️", "Emails Sent"],
              ["👥", "Recipients"],
              ["➤", "Open Rate"],
              ["↖", "Click Rate"],
              ["📈", "Conversion Rate"],
            ].map(([icon, title]) => (
              <article key={title} className="cannacore-kpi-card-row">
                <div className="cannacore-kpi-icon">{icon}</div>
                <div>
                  <div className="cannacore-kpi-title">{title}</div>
                  <div className="cannacore-kpi-value">—</div>
                  <div className="cannacore-kpi-sub">No data</div>
                </div>
              </article>
            ))}
          </section>

          <section className="cannacore-marketing-filters">
            <div className="cannacore-filter-cell">
              <input className="cannacore-field" placeholder="⌕  Search campaigns..." />
            </div>
            {["Status", "Type", "Audience", "Date Range"].map((label) => (
              <div key={label} className="cannacore-filter-cell">
                <div className="cannacore-filter-label">{label}</div>
                <select className="cannacore-field" defaultValue="">
                  <option>
                    {label === "Status"
                      ? "All Statuses"
                      : label === "Type"
                        ? "All Types"
                        : label === "Audience"
                          ? "All Audiences"
                          : "Select range"}
                  </option>
                </select>
              </div>
            ))}
            <div className="cannacore-filter-cell">
              <button type="button" className="cannacore-clear-btn">
                Clear Filters
              </button>
            </div>
          </section>
        </>
      ) : null}

      {tab === "text-campaigns" || tab === "text-editor" ? (
        <section className="cannacore-campaign-panel">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title-plain">
              {tab === "text-campaigns" ? "Text Campaigns" : "Text Editor"}
            </div>
          </div>
          <div className="cannacore-empty-center">
            <div>
              <div className="cannacore-empty-icon">💬</div>
              <div className="cannacore-empty-title">Text campaigns</div>
              <div className="cannacore-empty-sub">
                SMS campaign setup and history remain available via the legacy
                routes until the text editor tab is fully integrated here.
              </div>
              <a
                href={tab === "text-campaigns" ? "/text-history" : "/text-campaign"}
                className="cannacore-green-btn"
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                {tab === "text-campaigns"
                  ? "Open Text Campaign History"
                  : "Open Text Campaign Setup"}
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "email-editor" || tab === "email-campaigns" ? (
        <EmailCampaignWorkspace activeSection={activeSection} embedded />
      ) : null}
    </>
  );
}
