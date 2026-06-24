"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, GitCommit, RefreshCw, Plus, Check, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import toast from "react-hot-toast";

const STATUS_LABELS = {
  M: { label: "Modified", color: "#d29922" },
  A: { label: "Added", color: "#3fb950" },
  D: { label: "Deleted", color: "#f85149" },
  R: { label: "Renamed", color: "#58a6ff" },
  "?": { label: "Untracked", color: "#8b949e" },
  "!": { label: "Ignored", color: "#484f58" },
};

function statusColor(s) {
  return STATUS_LABELS[s]?.color || "#8b949e";
}

function statusLabel(s) {
  return STATUS_LABELS[s]?.label || s;
}

export function GitPanel({ roomId, socket }) {
  const [status, setStatus] = useState(null);
  const [commits, setCommits] = useState([]);
  const [diff, setDiff] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("changes"); // "changes" | "history" | "diff"
  const [showDiff, setShowDiff] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, logRes] = await Promise.all([
        api.get(`/git/${roomId}/status`),
        api.get(`/git/${roomId}/log`),
      ]);
      setStatus(statusRes.data);
      setCommits(logRes.data.commits || []);
    } catch {
      // Git not init'd yet is fine — status will show initialized: false
    }
  }, [roomId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Refresh on file saves
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadStatus();
    socket.on("code-ack", handler);
    socket.on("file-created", handler);
    socket.on("file-deleted", handler);
    return () => {
      socket.off("code-ack", handler);
      socket.off("file-created", handler);
      socket.off("file-deleted", handler);
    };
  }, [socket, loadStatus]);

  async function handleInit() {
    setLoading(true);
    try {
      const { data } = await api.post(`/git/${roomId}/init`);
      toast.success(data.message || "Repository initialized");
      loadStatus();
    } catch (e) {
      toast.error(e.response?.data?.detail || "git init failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!commitMsg.trim()) return toast.error("Commit message required");
    setLoading(true);
    try {
      const { data } = await api.post(`/git/${roomId}/commit`, {
        message: commitMsg.trim(),
        author: "Aether User",
      });
      toast.success(`Committed ${data.hash}`);
      setCommitMsg("");
      loadStatus();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Commit failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadDiff() {
    try {
      const { data } = await api.get(`/git/${roomId}/diff`);
      setDiff(data.diff || data.staged || "No changes to diff.");
      setTab("diff");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not load diff");
    }
  }

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6fb982] border-t-transparent" />
      </div>
    );
  }

  if (!status.initialized) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6fb982]/20 bg-[#6fb982]/5 text-[#9ed4aa]">
          <GitBranch size={22} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-200">No Git Repository</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Initialize a repository to track changes, commit files, and view history.
          </p>
        </div>
        <button
          onClick={handleInit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#6fb982] px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-950 transition hover:bg-[#84c792] disabled:opacity-50"
        >
          {loading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
          ) : (
            <Plus size={12} />
          )}
          Initialize Repository
        </button>
      </div>
    );
  }

  const changedFiles = status.files || [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#161b22] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <GitBranch size={12} className="text-[#6fb982]" />
          <span className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-400">
            Git
          </span>
          {status.branch && (
            <span className="rounded bg-[#6fb982]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#9ed4aa]">
              {status.branch}
            </span>
          )}
        </div>
        <button
          onClick={loadStatus}
          className="rounded p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-white/10">
        {[
          { id: "changes", label: `Changes (${changedFiles.length})` },
          { id: "history", label: `History (${commits.length})` },
          { id: "diff", label: "Diff" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { setTab(id); if (id === "diff") loadDiff(); }}
            className={`relative flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition ${
              tab === id ? "text-[#9ed4aa]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab === id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#6fb982]" />
            )}
            {label}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {/* Changes tab */}
        {tab === "changes" && (
          <div className="flex flex-col">
            {changedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Check size={20} className="text-[#6fb982]" />
                <p className="text-[11px] text-slate-500">Working tree clean</p>
              </div>
            ) : (
              <div className="px-2 py-2">
                {changedFiles.map(({ status: s, path }) => (
                  <div
                    key={path}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.04]"
                  >
                    <span
                      className="shrink-0 rounded px-1 py-0.5 font-mono text-[8px] font-black"
                      style={{ background: statusColor(s) + "22", color: statusColor(s) }}
                      title={statusLabel(s)}
                    >
                      {s || "?"}
                    </span>
                    <span className="truncate font-mono text-[11px] text-slate-300">{path}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Commit area */}
            <div className="shrink-0 border-t border-white/10 p-3">
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message..."
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-[#1a1d22] p-3 font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#6fb982]/40"
              />
              <button
                onClick={handleCommit}
                disabled={loading || !commitMsg.trim()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6fb982] py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 transition hover:bg-[#84c792] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <GitCommit size={12} />
                )}
                Commit All Changes
              </button>
            </div>
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div className="px-2 py-2">
            {commits.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[11px] text-slate-500">No commits yet</p>
              </div>
            ) : (
              commits.map(({ hash, message }) => (
                <div
                  key={hash}
                  className="flex items-start gap-2 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-[#6fb982]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#9ed4aa]">
                    {hash}
                  </span>
                  <span className="text-[11px] leading-relaxed text-slate-300">{message}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Diff tab */}
        {tab === "diff" && (
          <div className="p-2">
            {diff ? (
              <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300">
                {diff.split("\n").map((line, i) => {
                  const color = line.startsWith("+") && !line.startsWith("+++")
                    ? "#3fb950"
                    : line.startsWith("-") && !line.startsWith("---")
                    ? "#f85149"
                    : line.startsWith("@@")
                    ? "#58a6ff"
                    : undefined;
                  return (
                    <span key={i} style={{ color }} className="block">
                      {line || " "}
                    </span>
                  );
                })}
              </pre>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[11px] text-slate-500">No diff available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
