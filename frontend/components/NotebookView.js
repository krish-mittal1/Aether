"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Plus, Square, Trash2, ChevronUp, ChevronDown, BookOpen } from "lucide-react";
import { apiLong } from "../lib/api";

// Cell separator markers by language
const CELL_MARKERS = {
  python: /^#\s*%%/,
  javascript: /^\/\/\s*%%/,
  typescript: /^\/\/\s*%%/,
  default: /^#\s*%%/,
};

function parseCells(content, language) {
  const marker = CELL_MARKERS[language] || CELL_MARKERS.default;
  const lines = (content || "").split("\n");
  const cells = [];
  let current = [];
  let label = "";

  for (const line of lines) {
    if (marker.test(line.trim())) {
      if (current.length > 0 || cells.length > 0) {
        cells.push({ code: current.join("\n"), label });
      }
      label = line.replace(marker, "").trim();
      current = [];
    } else {
      current.push(line);
    }
  }
  cells.push({ code: current.join("\n"), label: label || (cells.length === 0 ? "Cell 1" : `Cell ${cells.length + 1}`) });
  return cells.filter((c) => c.code.trim() || cells.length === 1);
}

function serializeCells(cells, language) {
  const prefix = language === "python" ? "# %%" : "// %%";
  return cells
    .map((c, i) => `${prefix} ${c.label || `Cell ${i + 1}`}\n${c.code}`)
    .join("\n\n");
}

function CellOutput({ output, error, running }) {
  if (running) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="h-3 w-3 animate-spin rounded-full border border-[#6fb982] border-t-transparent" />
        <span className="font-mono text-[10px] text-slate-500">Running…</span>
      </div>
    );
  }
  if (!output && !error) return null;
  return (
    <div className="border-t border-white/10 bg-[#0d1117] px-4 py-2">
      {output && (
        <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-slate-300">
          {output}
        </pre>
      )}
      {error && (
        <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-red-400">
          {error}
        </pre>
      )}
    </div>
  );
}

export function NotebookView({ activeFile, onContentChange }) {
  const [cells, setCells] = useState([]);
  const [outputs, setOutputs] = useState({}); // index → { output, error, running }
  const [runningAll, setRunningAll] = useState(false);

  const language = activeFile?.language || "python";

  // Parse cells from file content
  useEffect(() => {
    if (!activeFile) return;
    const parsed = parseCells(activeFile.content || "", language);
    setCells(parsed.map((c, i) => ({ ...c, id: `cell-${i}-${Date.now()}` })));
    setOutputs({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.id]);

  // Propagate cell edits back to the file
  const flushCells = useCallback(
    (nextCells) => {
      if (onContentChange) {
        onContentChange(serializeCells(nextCells, language));
      }
    },
    [onContentChange, language]
  );

  async function runCell(index) {
    const cell = cells[index];
    if (!cell) return;
    setOutputs((prev) => ({ ...prev, [index]: { running: true, output: "", error: "" } }));
    try {
      const { data } = await apiLong.post("/execute", {
        language,
        code: cell.code,
        stdin: "",
      });
      setOutputs((prev) => ({
        ...prev,
        [index]: { running: false, output: data.output || "", error: data.error || "" },
      }));
    } catch (err) {
      setOutputs((prev) => ({
        ...prev,
        [index]: {
          running: false,
          output: "",
          error: err.response?.data?.detail || err.message || "Execution failed",
        },
      }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    for (let i = 0; i < cells.length; i++) {
      await runCell(i);
    }
    setRunningAll(false);
  }

  function updateCell(index, code) {
    const next = cells.map((c, i) => (i === index ? { ...c, code } : c));
    setCells(next);
    flushCells(next);
  }

  function updateLabel(index, label) {
    const next = cells.map((c, i) => (i === index ? { ...c, label } : c));
    setCells(next);
    flushCells(next);
  }

  function addCellAfter(index) {
    const newCell = { code: "", label: `Cell ${cells.length + 1}`, id: `cell-new-${Date.now()}` };
    const next = [...cells.slice(0, index + 1), newCell, ...cells.slice(index + 1)];
    setCells(next);
    flushCells(next);
  }

  function deleteCell(index) {
    if (cells.length === 1) return;
    const next = cells.filter((_, i) => i !== index);
    setCells(next);
    setOutputs((prev) => {
      const o = { ...prev };
      delete o[index];
      return o;
    });
    flushCells(next);
  }

  function moveCell(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= cells.length) return;
    const next = [...cells];
    [next[index], next[target]] = [next[target], next[index]];
    setCells(next);
    flushCells(next);
  }

  if (!activeFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <BookOpen size={24} className="text-slate-600" />
        <p className="text-[11px] text-slate-600">Open a Python or JavaScript file to use Notebook mode.</p>
      </div>
    );
  }

  if (!["python", "javascript", "typescript"].includes(language)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-8">
        <BookOpen size={24} className="text-slate-600" />
        <p className="text-[11px] text-slate-500 font-mono font-bold uppercase tracking-widest">Language not supported</p>
        <p className="text-[10px] text-slate-600">Notebook mode supports Python, JavaScript, and TypeScript files.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0f1117]">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#161b22] px-3 py-2">
        <div className="flex items-center gap-2">
          <BookOpen size={12} className="text-[#6fb982]" />
          <span className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-400">
            Notebook
          </span>
          <span className="rounded bg-[#6fb982]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#9ed4aa]">
            {activeFile.name}
          </span>
          <span className="font-mono text-[9px] text-slate-600">
            {cells.length} cell{cells.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAll}
            disabled={runningAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#6fb982]/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#9ed4aa] transition hover:bg-[#6fb982]/30 disabled:opacity-50"
          >
            {runningAll ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-[#9ed4aa] border-t-transparent" />
            ) : (
              <Play size={10} className="fill-current" />
            )}
            Run All
          </button>
        </div>
      </div>

      {/* Cells */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {cells.map((cell, index) => {
          const out = outputs[index] || {};
          return (
            <div
              key={cell.id}
              className="rounded-xl border border-white/10 bg-[#1a1d22] overflow-hidden"
            >
              {/* Cell header */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#161b22] px-3 py-1.5">
                <span className="font-mono text-[9px] text-slate-600">[{index + 1}]</span>
                <input
                  value={cell.label || ""}
                  onChange={(e) => updateLabel(index, e.target.value)}
                  placeholder={`Cell ${index + 1}`}
                  className="flex-1 bg-transparent font-mono text-[10px] text-slate-400 outline-none placeholder:text-slate-700"
                />
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => moveCell(index, -1)}
                    disabled={index === 0}
                    className="rounded p-1 text-slate-600 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-30"
                  >
                    <ChevronUp size={10} />
                  </button>
                  <button
                    onClick={() => moveCell(index, 1)}
                    disabled={index === cells.length - 1}
                    className="rounded p-1 text-slate-600 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-30"
                  >
                    <ChevronDown size={10} />
                  </button>
                  <button
                    onClick={() => deleteCell(index)}
                    disabled={cells.length === 1}
                    className="rounded p-1 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 size={10} />
                  </button>
                  <button
                    onClick={() => runCell(index)}
                    disabled={out.running}
                    className="ml-1 rounded-lg bg-[#6fb982]/20 px-2 py-1 text-[9px] font-black uppercase text-[#9ed4aa] transition hover:bg-[#6fb982]/30 disabled:opacity-50"
                  >
                    {out.running ? <Square size={9} /> : <Play size={9} className="fill-current" />}
                  </button>
                </div>
              </div>

              {/* Code editor area */}
              <textarea
                value={cell.code}
                onChange={(e) => updateCell(index, e.target.value)}
                spellCheck={false}
                rows={Math.max(3, cell.code.split("\n").length)}
                className="w-full resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-200 outline-none"
                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" }}
              />

              {/* Output */}
              <CellOutput {...out} />
            </div>
          );
        })}

        {/* Add cell button */}
        <button
          onClick={() => addCellAfter(cells.length - 1)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition hover:border-[#6fb982]/30 hover:text-[#9ed4aa]"
        >
          <Plus size={11} /> Add Cell
        </button>
      </div>
    </div>
  );
}
