"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Terminal, Cpu, X, Maximize2, Trash2 } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

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
  height = 238
}) {
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "compiler"
  const terminalContainerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  
  const canRun = ["javascript", "python", "cpp", "typescript", "java"].includes(activeFile?.language);
  const runLabel = { javascript: "JS", python: "Py", cpp: "C++", typescript: "TS", java: "Java" }[activeFile?.language] || "";
  
  // Set up xterm.js interactive terminal
  useEffect(() => {
    if (typeof window === "undefined" || !socket || !roomId || activeTab !== "terminal") return;
    
    let isMounted = true;
    let term;
    let fitAddon;
    let resizeObserver;

    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit")
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (!isMounted || !terminalContainerRef.current) return;
      
      term = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        theme: {
          background: "#07070a",
          foreground: "#cbd5e1",
          cursor: "#9ed4aa",
          cursorAccent: "#07070a",
          selectionBackground: "rgba(111, 185, 130, 0.24)",
          black: "#1a1a2e",
          red: "#f87171",
          green: "#4ade80",
          yellow: "#fbbf24",
          blue: "#60a5fa",
          magenta: "#a78bfa",
          cyan: "#9db5a5",
          white: "#e2e8f0",
          brightBlack: "#334155",
          brightRed: "#fca5a5",
          brightGreen: "#86efac",
          brightYellow: "#fde68a",
          brightBlue: "#93c5fd",
          brightMagenta: "#b8a8c8",
          brightCyan: "#b5c5bd",
          brightWhite: "#f8fafc",
        },
        fontSize: 14,
        fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
        allowProposedApi: true,
        letterSpacing: 0.5,
        lineHeight: 1.4,
      });
      
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalContainerRef.current);
      
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      
      // Delay fit slightly to let DOM sizing stabilize
      setTimeout(() => {
        if (!isMounted) return;
        try {
          fitAddon.fit();
          socket.emit("terminal_init", {
            roomId,
            cols: term.cols,
            rows: term.rows
          });
        } catch (e) {
          console.warn("Resize fit failed:", e);
        }
      }, 100);

      // Handle user typing
      term.onData((data) => {
        socket.emit("terminal_input", { data });
      });

      // Handle server output
      socket.on("terminal_output", ({ data }) => {
        if (term) term.write(data);
      });

      // Handle server closing connection
      socket.on("terminal_closed", () => {
        if (term) {
          term.write("\r\n\x1b[31m[Shell Session Ended]\x1b[0m\r\n");
        }
      });

      // ResizeObserver is much cleaner and more reliable than window.onresize
      resizeObserver = new ResizeObserver(() => {
        if (!isMounted || !fitAddon || !term) return;
        try {
          fitAddon.fit();
          socket.emit("terminal_resize", {
            cols: term.cols,
            rows: term.rows
          });
        } catch {}
      });
      
      if (terminalContainerRef.current) {
        resizeObserver.observe(terminalContainerRef.current.parentElement);
      }
    });

    return () => {
      isMounted = false;
      if (socket) {
        socket.off("terminal_output");
        socket.off("terminal_closed");
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (term) {
        term.dispose();
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [socket, roomId, activeTab]);

  // Handle "Run File in Terminal" (types execution command dynamically)
  function handleRunInTerminal() {
    if (!socket || !activeFile) return;
    
    // Resolve basic relative path based on name (root level)
    const name = activeFile.name;
    let cmd = "";
    
    if (activeFile.language === "python") cmd = `python3 ${name}`;
    else if (activeFile.language === "javascript") cmd = `node ${name}`;
    else if (activeFile.language === "typescript") cmd = `npx ts-node ${name}`;
    else if (activeFile.language === "cpp") cmd = `g++ -O2 ${name} -o main && ./main`;
    else if (activeFile.language === "java") {
      const match = activeFile.content.match(/public\s+class\s+(\w+)/);
      const className = match ? match[1] : "Main";
      cmd = `javac ${name} && java ${className}`;
    }
    
    if (cmd) {
      // Send Ctrl+C to cancel any active command, then write execution command with carriage return
      socket.emit("terminal_input", { data: `\u0003${cmd}\r` });
    }
  }

  function clearTerminal() {
    if (xtermRef.current) {
      xtermRef.current.clear();
      // Also send clear command to shell
      socket.emit("terminal_input", { data: "clear\r" });
    }
  }

  return (
    <section className="flex shrink-0 select-none flex-col bg-[#17181c] font-mono" style={{ height }}>
      {/* VS Code Tab Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#1b1d22] px-3">
        <div className="flex h-full items-center gap-1">
          {/* Terminal Tab */}
          <button
            onClick={() => setActiveTab("terminal")}
            className={`relative flex h-full items-center gap-1.5 px-3 text-[11px] font-black uppercase tracking-widest transition ${
              activeTab === "terminal" ? "text-[#9ed4aa]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {activeTab === "terminal" && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#6fb982] " />}
            &gt;_ TERMINAL
          </button>

          {/* Compiler Tab */}
          <button
            onClick={() => setActiveTab("compiler")}
            className={`relative flex h-full items-center gap-1.5 px-3 text-[11px] font-black uppercase tracking-widest transition ${
              activeTab === "compiler" ? "text-[#9ed4aa]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {activeTab === "compiler" && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#6fb982] " />}
            COMPILER OUTPUT
          </button>
        </div>
        
        {/* Actions bar */}
        <div className="flex items-center gap-2">
          {activeTab === "terminal" ? (
            <>
              <button 
                onClick={clearTerminal}
                title="Clear Terminal"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.055] hover:text-white"
              >
                <Trash2 size={11} />
              </button>
              <button 
                disabled={!canRun}
                onClick={handleRunInTerminal}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#6fb982] bg-transparent px-3 text-[10px] font-black uppercase tracking-wider text-[#9ed4aa] transition hover:bg-[#6fb982]/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Play size={8} className="fill-current text-[#9ed4aa]" /> RUN CODE
              </button>
            </>
          ) : (
            <div>
              {running ? (
                <button 
                  onClick={onStop}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-red-500/30 bg-transparent px-3 text-[9px] font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500/10"
                >
                  <Square size={8} className="fill-current text-red-500 animate-pulse" /> STOP RUN
                </button>
              ) : (
                <button 
                  disabled={!canRun} 
                  onClick={onRun}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#6fb982] bg-transparent px-3 text-[10px] font-black uppercase tracking-wider text-[#9ed4aa] transition hover:bg-[#6fb982]/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Play size={8} className="fill-current text-[#9ed4aa]" /> RUN CODE
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 min-h-0 relative">
        {/* Tab 1: Interactive PTY Terminal */}
        <div 
          className={`absolute inset-0 overflow-hidden bg-[#17181c] p-2.5 ${
            activeTab === "terminal" ? "block" : "hidden"
          }`}
        >
          <div ref={terminalContainerRef} className="h-full w-full" />
        </div>

        {/* Tab 2: Classic Isolated Compiler */}
        <div 
          className={`absolute inset-0 flex flex-col ${
            activeTab === "compiler" ? "flex" : "hidden"
          }`}
        >
          {/* Output Screen */}
          <div className="scrollbar-thin flex-1 overflow-auto bg-[#111216] p-4 font-mono text-[14px] leading-relaxed select-text">
            {output ? (
              <div className="space-y-1">
                {output.split("\n").map((line, idx) => {
                  const isStderrLine = line.startsWith("[stderr]") || line.toLowerCase().includes("error") || line.toLowerCase().includes("exception") || line.toLowerCase().includes("failed");
                  return (
                    <div 
                      key={idx} 
                      className={isStderrLine ? "text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/10 font-bold" : "text-slate-300"}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-600 text-[13px] italic">
                {canRun 
                  ? "Standby compiler. Click Compile to execute a sandboxed run." 
                  : "Active language buffer not executable. Open a JS, TS, Py, C++, or Java file."}
              </div>
            )}
          </div>

          {/* Stdin input bar */}
          <div className="relative flex h-11 shrink-0 items-center border-t border-white/10 bg-[#111216] px-3.5">
            <span className="mr-2 shrink-0 select-none text-[11px] font-extrabold uppercase tracking-wider text-[#9ed4aa]">$ stdin &gt;</span>
            <input
              className="w-full bg-transparent text-[13px] text-slate-300 placeholder-slate-600 outline-none"
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              placeholder="Input standard stdin stream here..."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
