"use client";

import { CannaCoreTopbar } from "@/components/cannacore/cannacore-topbar";

export default function DashboardPage() {
  return (
    <>
      <CannaCoreTopbar
        title="Dashboard"
        subtitle="Connect your data sources to populate live operational activity."
      />

      <section className="cannacore-kpi-grid">
        <article className="cannacore-kpi-card">
          <div className="cannacore-kpi-icon">🌿</div>
          <div className="cannacore-kpi-title">Active Harvests</div>
          <div className="cannacore-kpi-value">—</div>
          <div className="cannacore-kpi-sub">Connect Metrc to populate.</div>
          <div className="cannacore-kpi-arrow">→</div>
        </article>
        <article className="cannacore-kpi-card">
          <div className="cannacore-kpi-icon">🚚</div>
          <div className="cannacore-kpi-title">Transfers Pending</div>
          <div className="cannacore-kpi-value gold">—</div>
          <div className="cannacore-kpi-sub">Connect Metrc to populate.</div>
          <div className="cannacore-kpi-arrow">→</div>
        </article>
        <article className="cannacore-kpi-card">
          <div className="cannacore-kpi-icon">🧾</div>
          <div className="cannacore-kpi-title">Open Invoices</div>
          <div className="cannacore-kpi-value blue">—</div>
          <div className="cannacore-kpi-sub">No invoice data loaded.</div>
          <div className="cannacore-kpi-arrow">→</div>
        </article>
        <article className="cannacore-kpi-card">
          <div className="cannacore-kpi-icon">📣</div>
          <div className="cannacore-kpi-title">Campaigns Sent</div>
          <div className="cannacore-kpi-value purple">—</div>
          <div className="cannacore-kpi-sub">No campaign data loaded.</div>
          <div className="cannacore-kpi-arrow">→</div>
        </article>
        <article className="cannacore-kpi-card">
          <div className="cannacore-kpi-icon">🔄</div>
          <div className="cannacore-kpi-title">Metrc Sync Status</div>
          <div className="cannacore-circle-check">○</div>
          <div className="cannacore-kpi-sub">Not connected.</div>
        </article>
        <article className="cannacore-kpi-card">
          <div className="cannacore-kpi-icon">👥</div>
          <div className="cannacore-kpi-title">New CRM Contacts</div>
          <div className="cannacore-kpi-value">—</div>
          <div className="cannacore-kpi-sub">No CRM data loaded.</div>
          <div className="cannacore-kpi-arrow">→</div>
        </article>
      </section>

      <section className="cannacore-panel-grid">
        <article className="cannacore-panel">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title">
              <span>☑</span>Today&apos;s Tasks
            </div>
          </div>
          {[1, 2, 3].map((n) => (
            <div key={n} className="cannacore-empty-row cannacore-task-empty">
              <div className="cannacore-row-icon">✓</div>
              <div>
                <div className="cannacore-empty-main">No task loaded</div>
                <div className="cannacore-empty-sub">
                  Calendar, workflow, package prep, invoice, and CRM reminders will
                  appear here.
                </div>
              </div>
              <div className="cannacore-priority-chip">—</div>
            </div>
          ))}
          <a className="cannacore-panel-link" href="#">
            View all tasks →
          </a>
        </article>

        <article className="cannacore-panel">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title">
              <span>🗓️</span>Upcoming Calendar
            </div>
            <a className="cannacore-panel-link" href="#">
              View calendar →
            </a>
          </div>
          {[1, 2, 3].map((n) => (
            <div key={n} className="cannacore-calendar-row">
              <div className="cannacore-date-box">
                —<strong>—</strong>
              </div>
              <div>
                <div className="cannacore-empty-main">No event scheduled</div>
                <div className="cannacore-empty-sub">
                  Harvests, deliveries, campaigns, compliance checks, and team
                  events will appear here.
                </div>
              </div>
              <div className="cannacore-tag">—</div>
            </div>
          ))}
        </article>

        <article className="cannacore-panel">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title">
              <span>🔔</span>System Updates
            </div>
            <a className="cannacore-panel-link" href="#">
              View all →
            </a>
          </div>
          {[
            ["🌿", "No Metrc update loaded", "Metrc sync activity, manifests, packages, transfers, and compliance events will appear here."],
            ["✉️", "No campaign update loaded", "Email and text campaign sends, opens, replies, and delivery notices will appear here."],
            ["🧾", "No invoice update loaded", "Invoice creation, payment status, and outgoing/incoming invoice activity will appear here."],
          ].map(([icon, title, text]) => (
            <div key={title} className="cannacore-update-row">
              <div className="cannacore-update-icon">{icon}</div>
              <div>
                <div className="cannacore-update-title">{title}</div>
                <div className="cannacore-update-text">{text}</div>
              </div>
            </div>
          ))}
          <a className="cannacore-panel-link" href="#">
            View all updates →
          </a>
        </article>
      </section>

      <section className="cannacore-activity">
        <div className="cannacore-panel-header">
          <div className="cannacore-panel-title">
            <span>〽</span>Recent Activity Feed
          </div>
          <a className="cannacore-panel-link" href="#">
            View all activity →
          </a>
        </div>
        {[
          ["—", "🌿", "No activity", "Connect Metrc, CRM, calendar, invoicing, and marketing systems to populate activity."],
          ["—", "✉️", "No activity", "Campaign and email events will appear here."],
          ["—", "🧾", "No activity", "Invoice and package events will appear here."],
        ].map(([time, icon, source, text]) => (
          <div key={source + text} className="cannacore-activity-row">
            <div className="cannacore-activity-time">{time}</div>
            <div>{icon}</div>
            <div className="cannacore-activity-source">{source}</div>
            <div>{text}</div>
          </div>
        ))}
      </section>
    </>
  );
}
