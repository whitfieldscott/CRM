"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";

type CannaCoreTopbarProps = {
  title: string;
  subtitle: string;
};

export function CannaCoreTopbar({ title, subtitle }: CannaCoreTopbarProps) {
  return (
    <header className="cannacore-topbar">
      <section className="cannacore-page-title">
        <div className="cannacore-page-title-row">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <ThemeToggle className="cannacore-topbar-theme-toggle" />
        </div>
      </section>

      <section className="cannacore-search-wrap">
        <input
          className="cannacore-search"
          type="search"
          placeholder="Search anything..."
        />
        <span className="cannacore-shortcut">⌘ K</span>
      </section>

      <section className="cannacore-bell">
        🔔
        <span className="cannacore-bell-badge">0</span>
      </section>

      <section className="cannacore-sync">
        <div className="cannacore-sync-title">Last Metrc Sync</div>
        <div className="cannacore-sync-status">
          <span>Not connected</span>
          <span className="cannacore-check">○</span>
        </div>
      </section>
    </header>
  );
}
