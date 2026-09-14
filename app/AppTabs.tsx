"use client";

import type { AppTab } from "./types";

const TABS: { id: AppTab; label: string }[] = [
  { id: "picking", label: "Picking" },
  { id: "bagging", label: "Bagging" },
  { id: "filling", label: "Filling" },
];

export default function AppTabs({
  tab,
  onChange,
}: {
  tab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="app-tabs" aria-label="Warehouse steps">
      {TABS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`app-tab${tab === entry.id ? " is-active" : ""}`}
          onClick={() => onChange(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </nav>
  );
}
