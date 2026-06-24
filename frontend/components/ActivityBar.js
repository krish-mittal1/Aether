"use client";

import {
  BookOpen,
  Eye,
  FileText,
  GitBranch,
  Keyboard,
  MessageSquare,
  Search,
  Settings2,
  Terminal,
  Users,
} from "lucide-react";

const ITEMS = [
  { id: "explorer", Icon: FileText,     label: "Explorer (Ctrl+B)" },
  { id: "search",   Icon: Search,       label: "Search (Ctrl+Shift+F)" },
  { id: "chat",     Icon: MessageSquare,label: "Chat (Ctrl+Shift+Y)" },
  { id: "users",    Icon: Users,        label: "Collaborators" },
  { id: "terminal", Icon: Terminal,     label: "Terminal (Ctrl+J)" },
  { id: "preview",  Icon: Eye,          label: "Live Preview" },
  { id: "git",      Icon: GitBranch,    label: "Git" },
  { id: "notebook", Icon: BookOpen,     label: "Notebook Mode" },
];

export function ActivityBar({
  activePanel,
  onPanelToggle,
  onShortcuts,
  onSettings,
  dirtyCount  = 0,
  userCount   = 0,
  messageCount = 0,
}) {
  return (
    <aside
      className="ide-rail flex shrink-0 select-none flex-col items-center justify-between border-r py-1"
      style={{ width: 48 }}
    >
      {/* Top icons */}
      <div className="flex flex-col items-center">
        {ITEMS.map(({ id, Icon, label }) => {
          const isActive = activePanel === id;
          let badge = null;
          if (id === "users"    && userCount    > 0) badge = userCount;
          if (id === "chat"     && messageCount > 0) badge = messageCount;
          if (id === "explorer" && dirtyCount   > 0) badge = dirtyCount;

          return (
            <button
              key={id}
              onClick={() => onPanelToggle(id)}
              title={label}
              style={{ width: 48, height: 48 }}
              className={`relative flex items-center justify-center transition ${
                isActive
                  ? "text-white"
                  : "text-[#858585] hover:text-[#cccccc]"
              }`}
            >
              {/* VS Code-style left accent bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r"
                  style={{ height: 24, background: "#cccccc" }}
                />
              )}
              <Icon size={22} strokeWidth={isActive ? 1.5 : 1.5} />
              {badge != null && badge > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#007acc] px-0.5 text-[9px] font-bold text-white"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center pb-1">
        <button
          onClick={onShortcuts}
          title="Keyboard Shortcuts"
          style={{ width: 48, height: 48 }}
          className="flex items-center justify-center text-[#858585] transition hover:text-[#cccccc]"
        >
          <Keyboard size={22} strokeWidth={1.5} />
        </button>
        <button
          onClick={onSettings}
          title="Settings"
          style={{ width: 48, height: 48 }}
          className="flex items-center justify-center text-[#858585] transition hover:text-[#cccccc]"
        >
          <Settings2 size={22} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}
