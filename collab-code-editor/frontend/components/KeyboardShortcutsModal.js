"use client";

import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  {
    category: "File",
    items: [
      { keys: ["Ctrl", "S"], desc: "Save active file" },
      { keys: ["Ctrl", "Shift", "S"], desc: "Save all files" },
      { keys: ["Ctrl", "W"], desc: "Close active tab" },
    ],
  },
  {
    category: "Navigation",
    items: [
      { keys: ["Ctrl", "P"], desc: "Quick open file" },
      { keys: ["Ctrl", "Shift", "P"], desc: "Command palette" },
      { keys: ["Ctrl", "Shift", "F"], desc: "Global search" },
      { keys: ["Ctrl", "G"], desc: "Go to line" },
      { keys: ["Ctrl", "Tab"], desc: "Switch tab" },
    ],
  },
  {
    category: "Editor",
    items: [
      { keys: ["Alt", "Shift", "F"], desc: "Format document" },
      { keys: ["Alt", "Z"], desc: "Toggle word wrap" },
      { keys: ["Ctrl", "/"], desc: "Toggle line comment" },
      { keys: ["Ctrl", "D"], desc: "Select next occurrence" },
      { keys: ["Alt", "↑/↓"], desc: "Move line up/down" },
      { keys: ["Ctrl", "Shift", "K"], desc: "Delete line" },
      { keys: ["Ctrl", "Enter"], desc: "Insert line below" },
      { keys: ["Ctrl", "Shift", "Enter"], desc: "Insert line above" },
      { keys: ["Ctrl", "]"], desc: "Indent line" },
      { keys: ["Ctrl", "["], desc: "Outdent line" },
      { keys: ["Ctrl", "Home"], desc: "Go to beginning" },
      { keys: ["Ctrl", "End"], desc: "Go to end" },
    ],
  },
  {
    category: "Multi-cursor",
    items: [
      { keys: ["Alt", "Click"], desc: "Insert cursor" },
      { keys: ["Ctrl", "Alt", "↑/↓"], desc: "Add cursor above/below" },
      { keys: ["Ctrl", "Shift", "L"], desc: "Select all occurrences" },
    ],
  },
  {
    category: "Code Execution",
    items: [
      { keys: ["F5"], desc: "Run active file" },
      { keys: ["Ctrl", "F5"], desc: "Stop execution" },
    ],
  },
  {
    category: "Panels",
    items: [
      { keys: ["Ctrl", "B"], desc: "Toggle sidebar" },
      { keys: ["Ctrl", "J"], desc: "Toggle terminal" },
      { keys: ["Ctrl", "Shift", "Y"], desc: "Toggle chat panel" },
    ],
  },
];

function KeyBadge({ label }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-line bg-rail px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300 shadow-sm min-w-[24px]">
      {label}
    </kbd>
  );
}

export function KeyboardShortcutsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-accent" />
            <h2 className="text-sm font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcut List */}
        <div className="scrollbar-thin overflow-auto max-h-[calc(80vh-60px)] p-5">
          <div className="grid gap-6 sm:grid-cols-2">
            {SHORTCUTS.map((section) => (
              <div key={section.category}>
                <h3 className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-accent">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <div key={item.desc} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-400">{item.desc}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <KeyBadge label={key} />
                            {i < item.keys.length - 1 && (
                              <span className="text-[9px] text-slate-600">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
