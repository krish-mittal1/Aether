"use client";

import {
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
  { id: "explorer", Icon: FileText, label: "Explorer (Ctrl+B)" },
  { id: "search", Icon: Search, label: "Search (Ctrl+Shift+F)" },
  { id: "chat", Icon: MessageSquare, label: "Chat (Ctrl+Shift+Y)" },
  { id: "users", Icon: Users, label: "Collaborators" },
  { id: "terminal", Icon: Terminal, label: "Terminal (Ctrl+J)" },
];

const BOTTOM_ITEMS = [
  { id: "shortcuts", Icon: Keyboard, label: "Keyboard Shortcuts" },
  { id: "settings", Icon: Settings2, label: "Editor Settings" },
];

export function ActivityBar({
  activePanel,
  onPanelToggle,
  onShortcuts,
  onSettings,
  dirtyCount = 0,
  userCount = 0,
  messageCount = 0,
}) {
  return (
    <aside className="ide-rail flex w-14 flex-col items-center justify-between border-r py-3 shrink-0 select-none">
      {/* Top actions */}
      <div className="flex flex-col items-center gap-0.5">
        {ITEMS.map(({ id, Icon, label }) => {
          const isActive = activePanel === id;
          let badge = null;
          if (id === "users" && userCount > 0) badge = userCount;
          if (id === "chat" && messageCount > 0) badge = messageCount;
          if (id === "explorer" && dirtyCount > 0) badge = dirtyCount;

          return (
            <button
              key={id}
              onClick={() => onPanelToggle(id)}
              title={label}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition duration-150 ${
                isActive
                  ? "text-[#8fb39b] drop-"
                  : "text-slate-500 hover:bg-white/[0.045] hover:text-slate-200"
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 h-6 w-[3px] rounded-r bg-[#8fb39b] " />
              )}
              <Icon size={18} />
              {badge != null && badge > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8fb39b] text-[8px] font-black text-slate-950 ">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onShortcuts}
          title="Keyboard Shortcuts"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.055] hover:text-slate-100"
        >
          <Keyboard size={18} />
        </button>
        <button
          onClick={onSettings}
          title="Editor Settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.055] hover:text-slate-100"
        >
          <Settings2 size={18} />
        </button>
      </div>
    </aside>
  );
}
