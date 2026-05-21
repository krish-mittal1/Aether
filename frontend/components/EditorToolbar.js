"use client";

import {
  Baseline,
  Bold,
  ChevronDown,
  Code2,
  FoldVertical,
  Indent,
  Keyboard,
  Map,
  Maximize2,
  Minimize2,
  Palette,
  WrapText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const THEMES = [
  { id: "aether-sage", label: "Aether Sage", tag: "Sage" },
  { id: "vs-dark", label: "Aether Dark", tag: "Dark" },
  { id: "vs", label: "Light", tag: "Light" },
  { id: "hc-black", label: "High Contrast Dark", tag: "HC" },
  { id: "hc-light", label: "High Contrast Light", tag: "HCL" },
];

const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

function ToolbarButton({ onClick, title, active, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition duration-150 ${
        active ? "ide-soft-active border-current" : "border-transparent text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-slate-700/30" />;
}

export function EditorToolbar({
  theme,
  onThemeChange,
  fontSize,
  onFontSizeChange,
  wordWrap,
  onWordWrapChange,
  minimap,
  onMinimapChange,
  zenMode,
  onZenModeChange,
  onFormat,
  onGoToLine,
  stickyScroll,
  onStickyScrollChange,
  lineNumbers,
  onLineNumbersChange,
  onKeyboardShortcuts,
  indentSize,
  onIndentSizeChange,
  language,
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [indentOpen, setIndentOpen] = useState(false);
  const themeRef = useRef(null);
  const fontRef = useRef(null);
  const indentRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (!themeRef.current?.contains(e.target)) setThemeOpen(false);
      if (!fontRef.current?.contains(e.target)) setFontOpen(false);
      if (!indentRef.current?.contains(e.target)) setIndentOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-700/20 bg-[#080d12]/90 px-3 scrollbar-thin">
      <ToolbarButton onClick={onFormat} title="Format Document (Alt+Shift+F)">
        <Bold size={12} /> Format
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={onWordWrapChange} title="Toggle Word Wrap (Alt+Z)" active={wordWrap}>
        <WrapText size={12} /> Wrap
      </ToolbarButton>
      <ToolbarButton onClick={onMinimapChange} title="Toggle Minimap" active={minimap}>
        <Map size={12} /> Minimap
      </ToolbarButton>
      <ToolbarButton onClick={onStickyScrollChange} title="Toggle Sticky Scroll" active={stickyScroll}>
        <FoldVertical size={12} /> Sticky
      </ToolbarButton>
      <ToolbarButton onClick={onLineNumbersChange} title="Toggle Line Numbers" active={lineNumbers !== "off"}>
        <Baseline size={12} /> Lines
      </ToolbarButton>

      <Divider />

      <div className="relative" ref={fontRef}>
        <button
          className="ide-button inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition"
          onClick={() => setFontOpen((v) => !v)}
          title="Font Size"
        >
          <ZoomIn size={11} /> {fontSize}px <ChevronDown size={10} />
        </button>
        {fontOpen && (
          <div className="absolute left-0 top-9 z-50 w-28 rounded-xl border border-slate-700/30 bg-[#0a1016] py-1 shadow-2xl">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                className={`block w-full px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.055] ${
                  fontSize === size ? "font-bold text-[#8fb39b]" : "text-slate-300"
                }`}
                onClick={() => { onFontSizeChange(size); setFontOpen(false); }}
              >
                {size}px {fontSize === size && "✓"}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.055] hover:text-white" onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))} title="Decrease Font Size">
        <ZoomOut size={12} />
      </button>
      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.055] hover:text-white" onClick={() => onFontSizeChange(Math.min(28, fontSize + 1))} title="Increase Font Size">
        <ZoomIn size={12} />
      </button>

      <Divider />

      <div className="relative" ref={indentRef}>
        <button className="ide-button inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition" onClick={() => setIndentOpen((v) => !v)} title="Indent Size">
          <Indent size={11} /> {indentSize}sp <ChevronDown size={10} />
        </button>
        {indentOpen && (
          <div className="absolute left-0 top-9 z-50 w-32 rounded-xl border border-slate-700/30 bg-[#0a1016] py-1 shadow-2xl">
            {[2, 3, 4, 6, 8].map((size) => (
              <button
                key={size}
                className={`block w-full px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.055] ${
                  indentSize === size ? "font-bold text-[#8fb39b]" : "text-slate-300"
                }`}
                onClick={() => { onIndentSizeChange(size); setIndentOpen(false); }}
              >
                {size} spaces {indentSize === size && "✓"}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      <div className="relative" ref={themeRef}>
        <button className="ide-button inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition" onClick={() => setThemeOpen((v) => !v)} title="Editor Theme">
          <Palette size={11} /> Theme <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-[#b7c9bd]">{currentTheme.tag}</span> <ChevronDown size={10} />
        </button>
        {themeOpen && (
          <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-slate-700/30 bg-[#0a1016] py-1 shadow-2xl">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-white/[0.055] ${
                  theme === t.id ? "font-bold text-[#8fb39b]" : "text-slate-300"
                }`}
                onClick={() => { onThemeChange(t.id); setThemeOpen(false); }}
              >
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400">{t.tag}</span>
                {t.label}
                {theme === t.id && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      <ToolbarButton onClick={onGoToLine} title="Go to Line (Ctrl+G)">
        <Code2 size={12} /> Go to Line
      </ToolbarButton>
      <ToolbarButton onClick={onKeyboardShortcuts} title="Keyboard Shortcuts">
        <Keyboard size={12} /> Shortcuts
      </ToolbarButton>

      <div className="flex-1" />

      {language && (
        <span className="rounded-lg border border-[#8fb39b]/35 bg-[#8fb39b]/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#8fb39b]">
          {language}
        </span>
      )}

      <Divider />

      <ToolbarButton onClick={onZenModeChange} title={zenMode ? "Exit Zen Mode" : "Zen Mode"} active={zenMode}>
        {zenMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        {zenMode ? "Exit Zen" : "Zen"}
      </ToolbarButton>
    </div>
  );
}
