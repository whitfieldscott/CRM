"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CannaCoreTopbar } from "@/components/cannacore/cannacore-topbar";
import { ContactsDirectory } from "@/components/crm/contacts-directory";
import { api, getApiErrorMessage } from "@/lib/api";
import type { Client, Contact } from "@/types/api";
import { toast } from "sonner";

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSignal, setCreateSignal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, clRes] = await Promise.all([
        api.get<Contact[]>("/contacts", { params: { active_only: false } }),
        api.get<Client[]>("/clients", { params: { active_only: true } }),
      ]);
      setContacts(cRes.data);
      setClients(clRes.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const byType = (t: string) =>
      contacts.filter((c) => (c.license_type ?? "").toLowerCase() === t).length;
    return {
      total: contacts.length,
      growers: byType("grower"),
      processors: byType("processor"),
      dispensaries: byType("dispensary"),
      transporters: byType("transporter"),
      labs: byType("lab"),
      other: contacts.filter((c) => {
        const lt = (c.license_type ?? "").toLowerCase();
        return !["grower", "processor", "dispensary", "transporter", "lab"].includes(lt);
      }).length,
      clients: clients.length,
    };
  }, [contacts, clients]);

  return (
    <>
      <CannaCoreTopbar
        title="CRM"
        subtitle="Manage your relationships, clients, vendors, and business contacts."
      />

      <section className="cannacore-context-row">
        <nav className="cannacore-tabs">
          <button type="button" className="cannacore-tab active">
            Overview
          </button>
          <button type="button" className="cannacore-tab">
            Clients
          </button>
          <button type="button" className="cannacore-tab">
            Vendors
          </button>
          <button type="button" className="cannacore-tab">
            Growers
          </button>
          <button type="button" className="cannacore-tab">
            Processors
          </button>
          <button type="button" className="cannacore-tab">
            Dispensaries
          </button>
          <button type="button" className="cannacore-tab">
            Transporters
          </button>
          <button type="button" className="cannacore-tab">
            Labs
          </button>
          <button type="button" className="cannacore-tab">
            All Contacts
          </button>
          <button type="button" className="cannacore-tab">
            Activity
          </button>
          <button type="button" className="cannacore-tab">
            Notes
          </button>
          <button type="button" className="cannacore-tab">
            Tasks
          </button>
        </nav>
        <button
          type="button"
          className="cannacore-action-btn"
          onClick={() => setCreateSignal((n) => n + 1)}
        >
          + New Contact⌄
        </button>
      </section>

      <section className="cannacore-kpi-grid-5">
        {[
          ["👥", "Total Contacts", loading ? "—" : String(counts.total)],
          ["👤", "Clients", loading ? "—" : String(counts.clients)],
          ["🏢", "Vendors", "—"],
          ["🤝", "Active Relationships", "—"],
          ["📋", "Tasks Due", "—"],
        ].map(([icon, title, value]) => (
          <article key={title} className="cannacore-kpi-card-row">
            <div className="cannacore-kpi-icon">{icon}</div>
            <div>
              <div className="cannacore-kpi-title">{title}</div>
              <div className="cannacore-kpi-value">{value}</div>
              <div className="cannacore-kpi-sub">
                {loading ? "Loading…" : "Live from CRM database"}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="cannacore-panel-grid-crm">
        <article className="cannacore-panel cannacore-panel-crm">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title-plain">Contacts by Type</div>
          </div>
          <table className="cannacore-type-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["👤 Growers", counts.growers],
                ["🏢 Processors", counts.processors],
                ["🏬 Dispensaries", counts.dispensaries],
                ["🚚 Transporters", counts.transporters],
                ["⚗️ Labs", counts.labs],
                ["💬 Other", counts.other],
              ].map(([label, count]) => (
                <tr key={String(label)}>
                  <td>{label}</td>
                  <td>{loading ? "—" : count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="cannacore-panel-link" href="#contacts-directory">
            View all contacts →
          </a>
        </article>

        <article className="cannacore-panel cannacore-panel-crm">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title-plain">Recent Activity</div>
            <select className="cannacore-field" defaultValue="all">
              <option>All Activity</option>
            </select>
          </div>
          <div className="cannacore-empty-center">
            <div>
              <div className="cannacore-empty-icon">〽</div>
              <div className="cannacore-empty-title">No recent activity</div>
              <div className="cannacore-empty-sub">
                Activity related to your contacts will appear here.
              </div>
            </div>
          </div>
          <a className="cannacore-panel-link" href="#">
            View all activity →
          </a>
        </article>

        <article className="cannacore-panel cannacore-panel-crm">
          <div className="cannacore-panel-header">
            <div className="cannacore-panel-title-plain">Tasks & Follow Ups</div>
            <a className="cannacore-panel-link" href="#">
              View all tasks →
            </a>
          </div>
          <div className="cannacore-empty-center">
            <div>
              <div className="cannacore-empty-icon">✓</div>
              <div className="cannacore-empty-title">No tasks pending</div>
              <div className="cannacore-empty-sub">You&apos;re all caught up!</div>
              <button type="button" className="cannacore-green-btn">
                + New Task
              </button>
            </div>
          </div>
        </article>
      </section>

      <div id="contacts-directory">
        <ContactsDirectory embedded createSignal={createSignal} />
      </div>
    </>
  );
}
