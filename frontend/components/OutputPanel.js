"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Minus, Play, Plus, Search, Square, Terminal as TermIcon, Trash2, X } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

// ─── helpers ────────────────────────────────────────────────────────────────

let _uid = 1;
function genId() { return `t${_uid++}`; }
function makeTab(n) { const id = genId(); return { id, name: `bash ${n}` }; }

function buildRunCmd(language, name, content) {
  if (language === "python")     return `python3 ${name}`;
  if (language === "javascript") return `node ${name}`;
  if (language === "typescript") return `npx ts-node ${name}`;
  if (language === "cpp")        return `g++ -O2 ${name} -o _main && ./_main`;
  if (language === "java") {
    const m = (content || "").match(/public\s+class\s+(\w+)/);
    return `javac ${name} && java ${m ? m[1] : "Main"}`;
  }
  return "";
}

function buildProjectCmd(language, content) {
  if (language === "python")     return `python3 -u $(ls *.py | head -1)`;
  if (language === "javascript") return `node $(ls *.js | head -1)`;
  if (language === "typescript") return `npx ts-node $(ls *.ts | head -1)`;
  if (language === "cpp")        return `g++ -O2 *.cpp -o _app 2>&1 && ./_app`;
  if (language === "java") {
    const m = (content || "").match(/public\s+class\s+(\w+)/);
    return `javac *.java && java ${m ? m[1] : "Main"}`;
  }
  return "";
}

const XTERM_THEME = {
  background:                  "#0d0d10",
  foreground:                  "#d4d4d4",
  cursor:                      "#9ed4aa",
  cursorAccent:                "#0d0d10",
  selectionBackground:         "rgba(111,185,130,0.22)",
  selectionForeground:         "#ffffff",
  selectionInactiveBackground: "rgba(111,185,130,0.10)",
  black:    "#1e1e1e", red:    "#f44747", green:   "#4ec9b0", yellow:  "#dcdcaa",
  blue:     "#569cd6", magenta:"#c586c0", cyan:    "#9cdcfe", white:   "#d4d4d4",
  brightBlack:   "#808080", brightRed:    "#f44747", brightGreen:  "#4ec9b0",
  brightYellow:  "#dcdcaa", brightBlue:   "#569cd6", brightMagenta:"#c586c0",
  brightCyan:    "#9cdcfe", brightWhite:  "#ffffff",
};

// ─── component ───────────────────────────────────────────────────────────────

export function OutputPanel({
  activeFile,
  output,
  running,
  stdin,
  onStdinChange,
  onRun,
  onStop,
  socket,
  roomId,
  height = 260,
}) {
  const [panel,        setPanel]        = useState("terminal");
  const [tabs,         setTabs]         = useState(() => [makeTab(1)]);
  const [activeTermId, setActiveTermId] = useState(() => tabs[0].id);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [fontSize,     setFontSize]     = useState(13);

  const innerRefs   = useRef({});  // termId → DOM node xterm mounts into
  const xtermMap    = useRef({});  // termId → { term, fitAddon, searchAddon, ro }
  const searchRef   = useRef(null);
  const activeIdRef = useRef(activeTermId);
  activeIdRef.current = activeTermId;

  const canRun = ["javascript", "python", "cpp", "typescript", "java"]
    .includes(activeFile?.language);

  // ── single global socket output router ───────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onOut = ({ data, termId }) => {
      const e = xtermMap.current[termId ?? activeIdRef.current];
      e?.term?.write(data);
    };
    const onClosed = ({ termId }) => {
      const e = xtermMap.current[termId];
      if (e) e.term.write(
        "\r\n\x1b[38;5;196m[process exited]\x1b[0m  Press \x1b[1mEnter\x1b[0m to restart.\r\n"
      );
    };
    socket.on("terminal_output", onOut);
    socket.on("terminal_closed", onClosed);
    return () => {
      socket.off("terminal_output", onOut);
      socket.off("terminal_closed", onClosed);
    };
  }, [socket]);

  // ── init xterm when a tab becomes the visible active one ─────────────────
  useEffect(() => {
    if (!socket || !roomId || panel !== "terminal" || !activeTermId) return;

    if (xtermMap.current[activeTermId]) {
      setTimeout(() => {
        const e = xtermMap.current[activeTermId];
        try { e?.fitAddon?.fit(); e?.term?.focus(); } catch {}
      }, 20);
      return;
    }

    const container = innerRefs.current[activeTermId];
    if (!container) return;

    let disposed = false;

    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-search"),
      import("@xterm/addon-web-links"),
    ]).then(([{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }]) => {
      if (disposed || xtermMap.current[activeTermId]) return;

      const term = new Terminal({
        cursorBlink:        true,
        cursorStyle:        "bar",
        cursorWidth:        2,
        scrollback:         10000,
        fastScrollModifier: "alt",
        allowProposedApi:   true,
        fontSize,
        fontFamily:         "'JetBrains Mono','Cascadia Code','Fira Code',Menlo,monospace",
        letterSpacing:      0,
        lineHeight:         1.5,
        theme:              XTERM_THEME,
      });

      const fitAddon    = new FitAddon();
      const searchAddon = new SearchAddon();
      const webLinks    = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(searchAddon);
      term.loadAddon(webLinks);
      term.open(container);

      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      term.writeln(`\x1b[2m  Aether Terminal  ${ts}\x1b[0m\r\n`);

      const ro = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          socket.emit("terminal_resize", { termId: activeTermId, cols: term.cols, rows: term.rows });
        } catch {}
      });
      ro.observe(container.parentElement || container);

      xtermMap.current[activeTermId] = { term, fitAddon, searchAddon, ro };

      term.onData((data) => socket.emit("terminal_input", { termId: activeTermId, data }));

      setTimeout(() => {
        if (disposed) return;
        try {
          fitAddon.fit();
          socket.emit("terminal_init", { termId: activeTermId, roomId, cols: term.cols, rows: term.rows });
          term.focus();
        } catch {}
      }, 80);
    });

    return () => { disposed = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTermId, socket, roomId, panel]);

  // ── live font-size update ─────────────────────────────────────────────────
  useEffect(() => {
    const e = xtermMap.current[activeTermId];
    if (!e) return;
    try { e.term.options.fontSize = fontSize; e.fitAddon.fit(); } catch {}
  }, [fontSize, activeTermId]);

  // ── Ctrl+F search shortcut ────────────────────────────────────────────────
  useEffect(() => {
    const h = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "f" && panel === "terminal") {
        ev.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [panel]);

  useEffect(() => { if (showSearch) searchRef.current?.focus(); }, [showSearch]);

  // ── cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(xtermMap.current).forEach(({ term, ro }) => {
        ro?.disconnect();
        term?.dispose();
      });
    };
  }, []);

  // ── search ────────────────────────────────────────────────────────────────
  function doSearch(q, dir = "next") {
    const e = xtermMap.current[activeTermId];
    if (!e) return;
    const opts = { caseSensitive: false, incremental: false };
    dir === "next" ? e.searchAddon.findNext(q, opts) : e.searchAddon.findPrevious(q, opts);
  }

  // ── terminal tab management ───────────────────────────────────────────────
  function addTerminal() {
    if (tabs.length >= 6) return;
    const tab = makeTab(tabs.length + 1);
    setTabs((p) => [...p, tab]);
    setActiveTermId(tab.id);
  }

  function closeTab(termId) {
    socket?.emit("terminal_kill", { termId });
    const entry = xtermMap.current[termId];
    if (entry) { entry.ro?.disconnect(); entry.term?.dispose(); delete xtermMap.current[termId]; }
    delete innerRefs.current[termId];

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== termId);
      if (activeTermId === termId && next.length) {
        const idx = prev.findIndex((t) => t.id === termId);
        setActiveTermId(next[Math.min(idx, next.length - 1)].id);
      }
      return next;
    });
  }

  // ── run commands ──────────────────────────────────────────────────────────
  function sendCmd(cmd) { socket?.emit("terminal_input", { termId: activeTermId, data: `${cmd}\r` }); }
  function clearActive() { const e = xtermMap.current[activeTermId]; if (e) { e.term.clear(); sendCmd("clear"); } }
  function handleRunFile()    { if (!activeFile) return; const c = buildRunCmd(activeFile.language, activeFile.name, activeFile.content); if (c) sendCmd(c); }
  function handleRunProject() { if (!activeFile) return; const c = buildProjectCmd(activeFile.language, activeFile.content); if (c) sendCmd(c); }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <section className="flex shrink-0 select-none flex-col" style={{ height, background: "#0d0d10" }}>

      {/* ── header / tab bar ── */}
      <div className="flex h-9 shrink-0 items-stretch border-b border-white/[0.07]" style={{ background: "#141418" }}>

        {/* Panel type selectors */}
        <button
          onClick={() => setPanel("terminal")}
          className={`flex shrink-0 items-center gap-1.5 border-r border-white/[0.06] px-4 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
            panel === "terminal" ? "border-b-2 border-b-[#6fb982] bg-[#0d0d10] text-[#9ed4aa]" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <ChevronRight size={10} /> TERMINAL
        </button>
        <button
          onClick={() => setPanel("compiler")}
          className={`flex shrink-0 items-center gap-1.5 border-r border-white/[0.06] px-4 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
            panel === "compiler" ? "border-b-2 border-b-[#6fb982] bg-[#0d0d10] text-[#9ed4aa]" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          COMPILER
        </button>

        {/* Terminal instance tabs */}
        {panel === "terminal" && (
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTermId(tab.id)}
                className={`group relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-white/[0.05] px-3 text-[10px] transition ${
                  activeTermId === tab.id
                    ? "bg-[#0d0d10] text-slate-200"
                    : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
                }`}
              >
                {activeTermId === tab.id && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#6fb982]" />
                )}
                <TermIcon size={9} className={activeTermId === tab.id ? "text-[#9ed4aa]" : ""} />
                <span className="font-mono">{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className="ml-0.5 rounded p-0.5 text-slate-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <X size={8} />
                  </button>
                )}
              </div>
            ))}
            {tabs.length < 6 && (
              <button
                onClick={addTerminal}
                title="New terminal session"
                className="flex shrink-0 items-center px-2.5 text-slate-600 transition hover:bg-white/[0.04] hover:text-[#9ed4aa]"
              >
                <Plus size={11} />
              </button>
            )}
          </div>
        )}

        {/* Right-side controls */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 px-2">
          {panel === "terminal" && (
            <>
              <button onClick={() => setFontSize((s) => Math.max(9, s - 1))} title="Smaller font" className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300">
                <Minus size={10} />
              </button>
              <span className="w-5 text-center font-mono text-[9px] tabular-nums text-slate-600">{fontSize}</span>
              <button onClick={() => setFontSize((s) => Math.min(22, s + 1))} title="Larger font" className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300">
                <Plus size={10} />
              </button>

              <div className="mx-1.5 h-4 w-px bg-white/[0.08]" />

              <button onClick={() => setShowSearch((v) => !v)} title="Find in terminal (Ctrl+F)" className={`flex h-6 w-6 items-center justify-center rounded transition ${showSearch ? "bg-[#6fb982]/10 text-[#9ed4aa]" : "text-slate-600 hover:bg-white/[0.05] hover:text-slate-300"}`}>
                <Search size={11} />
              </button>
              <button onClick={clearActive} title="Clear" className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300">
                <Trash2 size={11} />
              </button>

              <div className="mx-1.5 h-4 w-px bg-white/[0.08]" />

              <button disabled={!canRun} onClick={handleRunFile} title="Run active file in terminal" className="flex h-6 items-center gap-1 rounded border border-[#6fb982]/25 bg-[#6fb982]/[0.07] px-2 text-[9px] font-bold uppercase tracking-wider text-[#9ed4aa] transition hover:bg-[#6fb982]/[0.15] disabled:cursor-not-allowed disabled:opacity-30">
                <Play size={8} className="fill-current" /> Run
              </button>
              <button disabled={!canRun} onClick={handleRunProject} title="Compile and run all project files" className="ml-0.5 flex h-6 items-center gap-1 rounded border border-slate-700/40 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition hover:border-[#6fb982]/25 hover:text-[#9ed4aa] disabled:cursor-not-allowed disabled:opacity-30">
                Run All
              </button>
            </>
          )}

          {panel === "compiler" && (
            running ? (
              <button onClick={onStop} className="flex h-6 items-center gap-1 rounded border border-red-500/30 bg-red-500/[0.07] px-2 text-[9px] font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-500/[0.14]">
                <Square size={8} className="fill-current animate-pulse" /> Stop
              </button>
            ) : (
              <button disabled={!canRun} onClick={onRun} className="flex h-6 items-center gap-1 rounded border border-[#6fb982]/25 bg-[#6fb982]/[0.07] px-2 text-[9px] font-bold uppercase tracking-wider text-[#9ed4aa] transition hover:bg-[#6fb982]/[0.15] disabled:cursor-not-allowed disabled:opacity-30">
                <Play size={8} className="fill-current" /> Run Code
              </button>
            )
          )}
        </div>
      </div>

      {/* ── in-terminal search bar ── */}
      {panel === "terminal" && showSearch && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-1.5" style={{ background: "#141418" }}>
          <Search size={10} className="shrink-0 text-slate-500" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch(searchQuery, e.shiftKey ? "prev" : "next");
              if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
            }}
            placeholder="Find in terminal…  Enter ↓  Shift+Enter ↑  Esc to close"
            className="flex-1 bg-transparent font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
          />
          <div className="flex items-center gap-0.5">
            <button onClick={() => doSearch(searchQuery, "prev")} className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-slate-500 hover:bg-white/[0.05] hover:text-slate-200">↑</button>
            <button onClick={() => doSearch(searchQuery, "next")} className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-slate-500 hover:bg-white/[0.05] hover:text-slate-200">↓</button>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:text-red-400">
              <X size={9} />
            </button>
          </div>
        </div>
      )}

      {/* ── main content area ── */}
      <div className="relative min-h-0 flex-1">

        {/* Terminal panes — all kept in DOM; visibility toggled with CSS */}
        <div className={`absolute inset-0 ${panel === "terminal" ? "block" : "hidden"}`}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 overflow-hidden p-2 ${activeTermId === tab.id ? "block" : "hidden"}`}
            >
              <div
                ref={(el) => { if (el) innerRefs.current[tab.id] = el; }}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

        {/* Compiler / sandbox panel */}
        <div className={`absolute inset-0 flex flex-col ${panel === "compiler" ? "flex" : "hidden"}`} style={{ background: "#0d0d10" }}>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed select-text">
            {output ? (
              <div className="space-y-0.5">
                {output.split("\n").map((line, i) => {
                  const isErr = line.startsWith("[stderr]") || /\b(error|exception|failed|traceback)\b/i.test(line);
                  return (
                    <div key={i} className={isErr ? "font-medium text-[#f44747]" : "text-[#d4d4d4]"}>
                      {line || " "}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[12px] italic text-slate-600">
                {canRun
                  ? "Press Run Code to execute in an isolated sandbox."
                  : "Open a JS, TS, Python, C++, or Java file to run."}
              </span>
            )}
          </div>
          <div className="flex h-10 shrink-0 items-center border-t border-white/[0.07] px-4" style={{ background: "#141418" }}>
            <span className="mr-2 shrink-0 font-mono text-[10px] font-bold text-[#9ed4aa]">stdin&gt;</span>
            <input
              className="flex-1 bg-transparent font-mono text-[12px] text-slate-300 outline-none placeholder:text-slate-700"
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              placeholder="Standard input for sandbox run…"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
