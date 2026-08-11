import { BarChart3, CircleUserRound, Layers3, Sun } from "lucide-react";
import type { AppTab } from "../lib/recovery";

type BottomNavProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

const items: Array<{ id: AppTab; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Heute", icon: Sun },
  { id: "progress", label: "Fortschritt", icon: BarChart3 },
  { id: "counters", label: "Counter", icon: Layers3 },
  { id: "profile", label: "Ich", icon: CircleUserRound },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      <div className="bottom-nav-inner">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === activeTab;
          return (
            <button
              className={`nav-item ${active ? "is-active" : ""}`}
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(id)}
            >
              <span className="nav-icon-wrap"><Icon size={21} strokeWidth={active ? 2.3 : 1.8} /></span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
