"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Code2, Copy, ExternalLink, FolderKanban, Hash, LogOut, Plus, Trash2, UserPlus, X, Cpu, Terminal } from "lucide-react";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useRequireAuth } from "../../hooks/useRequireAuth";

/* ──────────────────────────────────────────
   CUSTOM CURSOR (Matches Landing)
────────────────────────────────────────── */
function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const rpos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e) => { pos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", move);
    let raf;
    const animate = () => {
      rpos.current.x += (pos.current.x - rpos.current.x) * 0.12;
      rpos.current.y += (pos.current.y - rpos.current.y) * 0.12;
      if (dot.current) {
        dot.current.style.transform = `translate(${pos.current.x - 5}px, ${pos.current.y - 5}px)`;
      }
      if (ring.current) {
        ring.current.style.transform = `translate(${rpos.current.x - 20}px, ${rpos.current.y - 20}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    document.querySelectorAll("a,button,input").forEach(el => {
      el.addEventListener("mouseenter", () => ring.current && ring.current.classList.add("c-ring-hover"));
      el.addEventListener("mouseleave", () => ring.current && ring.current.classList.remove("c-ring-hover"));
    });
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div ref={dot} className="c-dot" />
      <div ref={ring} className="c-ring" />
    </>
  );
}

/* ──────────────────────────────────────────
   MAGNETIC BUTTON
────────────────────────────────────────── */
function MagBtn({ children, href, className = "", onClick, type = "button", style = {} }) {
  const ref = useRef(null);
  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * 0.28}px, ${y * 0.28}px)`;
  }, []);
  const handleLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = "translate(0,0)";
  }, []);

  const props = {
    ref,
    className,
    style: { ...style, transition: "transform 0.35s cubic-bezier(0.23,1,0.32,1)", display: "inline-flex", alignItems: "center", justifyContent: "center" },
    onMouseMove: handleMove,
    onMouseLeave: handleLeave,
    onClick
  };

  if (href) {
    return <Link href={href} {...props}>{children}</Link>;
  }
  return <button type={type} {...props}>{children}</button>;
}

/* ──────────────────────────────────────────
   CONFIRM DELETE MODAL
────────────────────────────────────────── */
function ConfirmDeleteModal({ room, onConfirm, onCancel, loading }) {
  if (!room) return null;
  return (
    <div className="d-modal-overlay">
      <div className="d-modal">
        <div className="d-modal-header">
          <div className="d-modal-title-group">
            <span className="d-modal-alert-icon"><AlertTriangle size={14} /></span>
            <h2>Delete Workspace</h2>
          </div>
          <button onClick={onCancel} className="d-modal-close"><X size={14} /></button>
        </div>
        <div className="d-modal-body">
          <p>Are you sure you want to permanently delete <strong>"{room.name}"</strong>?</p>
          <p className="d-modal-sub">All files, chat history, and collaborator access will be removed permanently.</p>
          <div className="d-modal-code">ID: {room.id}</div>
        </div>
        <div className="d-modal-footer">
          <button onClick={onCancel} className="d-btn-cancel">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="d-btn-delete">
            {loading ? "Deleting..." : "Delete Workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   SIMULATED EMPTY STATE TERMINAL
────────────────────────────────────────── */
function MockTerminal() {
  const [lines, setLines] = useState([""]);
  useEffect(() => {
    const sequence = [
      "aether status --workspaces",
      "checking active room sessions...",
      "warning: 0 active workspaces found.",
      "tip: enter workspace name on the left orchestrator panel to mount a sandbox container."
    ];
    let li = 0, ci = 0;
    const interval = setInterval(() => {
      if (li < sequence.length) {
        const line = sequence[li];
        if (ci < line.length) {
          setLines(prev => {
            const next = [...prev];
            next[li] = (li === 0 ? "$ " : "") + line.slice(0, ci + 1);
            return next;
          });
          ci++;
        } else {
          li++;
          ci = 0;
          if (li < sequence.length) setLines(prev => [...prev, ""]);
        }
      } else {
        clearInterval(interval);
      }
    }, 45);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mock-term">
      <div className="mock-term-header">
        <span className="mock-term-dot" /><span className="mock-term-dot" /><span className="mock-term-dot" />
        <span className="mock-term-title">aether-diagnostics</span>
      </div>
      <div className="mock-term-body">
        {lines.map((l, i) => (
          <div key={i} className={`mock-term-line ${i === 0 ? "cmd" : i === 2 ? "warn" : ""}`}>{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN DASHBOARD INNER
══════════════════════════════════════════ */
function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, booted } = useRequireAuth();
  const logout = useAuthStore((s) => s.logout);
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("Team Workspace");
  const [joinId, setJoinId] = useState(searchParams.get("join") || "");
  const [deleting, setDeleting] = useState(false);
  const [confirmRoom, setConfirmRoom] = useState(null);

  async function loadRooms() {
    try {
      const { data } = await api.get("/rooms");
      setRooms(data);
    } catch {
      toast.error("Failed to load rooms");
    }
  }

  useEffect(() => { if (user) loadRooms(); }, [user]);

  useEffect(() => {
    const joinParam = searchParams.get("join");
    if (user && joinParam) handleAutoJoin(joinParam);
  }, [user]);

  async function handleAutoJoin(roomId) {
    try {
      const { data } = await api.post("/rooms/join", { roomId });
      toast.success("Joined room via invite link");
      router.push(`/room/${data.id}`);
    } catch (error) {
      const detail = error.response?.data?.detail || "";
      if (!detail.toLowerCase().includes("already")) {
        toast.error(detail || "Invite link invalid or expired");
      } else {
        router.push(`/room/${roomId}`);
      }
    }
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Room name cannot be empty");
    try {
      const { data } = await api.post("/rooms", { name: name.trim() });
      toast.success("Workspace created!");
      router.push(`/room/${data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create room");
    }
  }

  async function joinRoom(e) {
    e.preventDefault();
    if (!joinId.trim()) return toast.error("Paste a room ID to join");
    try {
      const { data } = await api.post("/rooms/join", { roomId: joinId.trim() });
      toast.success("Joined workspace!");
      router.push(`/room/${data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Room not found");
    }
  }

  async function confirmDelete() {
    if (!confirmRoom) return;
    setDeleting(true);
    try {
      await api.delete(`/rooms/${confirmRoom.id}`);
      setRooms((r) => r.filter((rm) => rm.id !== confirmRoom.id));
      toast.success(`"${confirmRoom.name}" deleted`);
      setConfirmRoom(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete room");
    } finally {
      setDeleting(false);
    }
  }

  function copyToClipboard(id, e) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => toast.success("Room ID copied!"));
  }

  if (!booted || !user) {
    return (
      <div className="d-loading">
        <style>{`
          .d-loading {
            min-height: 100vh;
            background: #09090b;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7a7d;
            font-family: monospace;
            font-size: 12px;
            letter-spacing: 0.12em;
          }
        `}</style>
        SYNCING CONSOLE STATE...
      </div>
    );
  }

  return (
    <main className="d-shell">
      {/* SCOPED CUSTOM STYLES */}
      <style>{`
        .d-shell {
          min-height: 100vh;
          background: #09090b;
          color: #e2e8ea;
          font-family: Inter, ui-sans-serif, sans-serif;
          padding: 60px 40px;
          position: relative;
          overflow-x: hidden;
          cursor: none;
        }

        /* CURSOR */
        .c-dot {
          position: fixed; z-index: 9999;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #4ade80;
          pointer-events: none;
          will-change: transform;
          top: 0; left: 0;
          mix-blend-mode: difference;
        }
        .c-ring {
          position: fixed; z-index: 9998;
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 1.5px solid rgba(74,222,128,0.55);
          pointer-events: none;
          will-change: transform;
          top: 0; left: 0;
          transition: transform 0s, border-color 0.2s, width 0.25s, height 0.25s;
        }
        .c-ring.c-ring-hover {
          width: 56px; height: 56px;
          border-color: #4ade80;
          margin: -8px;
        }
        @media (pointer: coarse) {
          .c-dot, .c-ring { display: none !important; }
          .d-shell { cursor: auto !important; }
        }

        /* Ambient Designer Grid Backdrop */
        .d-grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at top center, black 60%, transparent 95%);
          pointer-events: none;
          z-index: 0;
        }

        .d-container {
          max-width: 1280px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }

        /* HEADER */
        .d-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 32px;
          margin-bottom: 56px;
          flex-wrap: wrap;
          gap: 20px;
        }
        .d-logo-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .d-logo-box {
          width: 36px;
          height: 36px;
          background: #4ade80;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #050f08;
          font-size: 20px;
          font-weight: 900;
          font-style: italic;
        }
        .d-logo-title {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: #f0f3f4;
        }
        .d-logo-user {
          font-size: 12px;
          color: #6b7a7d;
          margin-top: 2px;
        }
        .d-logo-user a {
          color: #b0bec0;
          text-decoration: none;
          font-weight: 600;
        }
        .d-logo-user a:hover {
          color: #4ade80;
        }

        .d-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .d-btn-profile {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #b0bec0;
          padding: 9px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .d-btn-profile:hover {
          background: #15191b;
          border-color: rgba(255, 255, 255, 0.12);
        }
        .d-btn-logout {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #6b7a7d;
          padding: 9px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 650;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .d-btn-logout:hover {
          background: rgba(239, 68, 68, 0.06);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* TWO COLUMN WORKSPACE */
        .d-split-layout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 60px;
        }

        /* LEFT COLUMN - ACTION BAR */
        .d-left-col {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .d-orchestrator-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #4ade80;
        }

        .d-form-card {
          background: #0d1012;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 28px;
        }

        .d-form-card h2 {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #f0f3f4;
          margin-bottom: 4px;
        }

        .d-form-card p {
          font-size: 11.5px;
          color: #6b7a7d;
          margin-bottom: 24px;
        }

        .d-input-group {
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: relative;
        }

        .d-input-group:focus-within {
          border-color: #4ade80;
        }

        .d-input-field {
          width: 100%;
          background: transparent;
          border: none;
          padding: 10px 0;
          color: #e2e8ea;
          font-size: 13.5px;
          outline: none;
        }

        .d-submit-action {
          width: 100%;
          background: #4ade80;
          color: #040d06;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 0.2s;
        }

        .d-submit-action:hover {
          filter: brightness(1.08);
        }

        .d-submit-action-ghost {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #e2e8ea;
        }

        .d-submit-action-ghost:hover {
          background: #15191b;
          border-color: rgba(255, 255, 255, 0.12);
        }

        /* RIGHT COLUMN - WORKSPACES PANEL */
        .d-right-col {}

        .d-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }

        .d-section-title {
          font-size: 12px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b7a7d;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .d-section-count {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #b0bec0;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 4px;
        }

        .d-playground-strip {
          background: #0d1012;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .d-playground-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .d-playground-icon {
          width: 38px;
          height: 38px;
          background: rgba(74, 222, 128, 0.06);
          border: 1px solid rgba(74, 222, 128, 0.2);
          border-radius: 8px;
          color: #4ade80;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .d-playground-text h3 {
          font-size: 13.5px;
          font-weight: 900;
          color: #e2e8ea;
        }

        .d-playground-text p {
          font-size: 11.5px;
          color: #6b7a7d;
          margin-top: 2px;
          max-width: 460px;
        }

        /* Mock Diagnostics Terminal Empty State */
        .mock-term {
          background: #050608;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          overflow: hidden;
          font-family: monospace;
          box-shadow: 0 15px 40px rgba(0,0,0,0.5);
        }
        .mock-term-header {
          background: #0d1012;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          height: 32px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 12px;
        }
        .mock-term-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #1c2326;
        }
        .mock-term-title {
          font-size: 10px;
          color: #5a6a6c;
          margin-left: 8px;
        }
        .mock-term-body {
          padding: 16px;
          min-height: 120px;
          font-size: 11.5px;
        }
        .mock-term-line {
          line-height: 1.7;
          color: #6b7a7d;
        }
        .mock-term-line.cmd {
          color: #e2e8ea;
        }
        .mock-term-line.warn {
          color: #fca5a5;
        }

        /* WORKSPACES ROW LAYOUT */
        .d-row-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .d-row-card {
          background: #0d1012;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 18px 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: border-color 0.2s, background 0.2s;
          gap: 20px;
        }

        .d-row-card:hover {
          border-color: rgba(74, 222, 128, 0.25);
          background: #111416;
        }

        .d-row-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .d-row-icon {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7a7d;
          transition: color 0.2s, border-color 0.2s;
        }
        .d-row-card:hover .d-row-icon {
          color: #4ade80;
          border-color: rgba(74, 222, 128, 0.2);
        }

        .d-row-details {
          min-width: 0;
        }

        .d-row-name {
          font-size: 14px;
          font-weight: 800;
          color: #e2e8ea;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .d-row-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
          font-size: 11px;
          color: #6b7a7d;
        }

        .d-row-id {
          font-family: monospace;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 1px 5px;
          border-radius: 3px;
        }

        .d-row-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .d-row-badge-owner {
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
          color: #4ade80;
        }
        .d-row-badge-member {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #6b7a7d;
        }

        .d-row-right {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-shrink: 0;
        }

        .d-row-launch {
          font-size: 12px;
          font-weight: 750;
          text-transform: uppercase;
          color: #4ade80;
          display: flex;
          align-items: center;
          gap: 4px;
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 0.2s, transform 0.2s;
        }
        .d-row-card:hover .d-row-launch {
          opacity: 1;
          transform: none;
        }

        .d-row-actions {
          display: flex;
          gap: 6px;
        }

        .d-row-btn {
          background: #151a1c;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #5a6a6c;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .d-row-btn:hover {
          background: #1f272a;
          color: #e2e8ea;
        }
        .d-row-btn-delete:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* MODAL */
        .d-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(9, 9, 11, 0.85);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .d-modal {
          width: 100%;
          max-width: 400px;
          background: #0d1012;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          box-shadow: 0 40px 90px rgba(0, 0, 0, 0.7);
          overflow: hidden;
        }
        .d-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .d-modal-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .d-modal-alert-icon {
          width: 28px;
          height: 28px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 6px;
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .d-modal-title-group h2 {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #f0f3f4;
        }
        .d-modal-close {
          background: transparent;
          border: none;
          color: #6b7a7d;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .d-modal-close:hover {
          color: #e2e8ea;
        }
        .d-modal-body {
          padding: 20px;
          font-size: 13.5px;
          line-height: 1.5;
        }
        .d-modal-sub {
          font-size: 12px;
          color: #6b7a7d;
          margin-top: 8px;
        }
        .d-modal-code {
          margin-top: 14px;
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 8px 12px;
          font-family: monospace;
          font-size: 11px;
          color: #b0bec0;
        }
        .d-modal-footer {
          padding: 16px 20px;
          background: #111416;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .d-btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #b0bec0;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .d-btn-cancel:hover {
          background: #15191b;
        }
        .d-btn-delete {
          background: #ef4444;
          border: none;
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .d-btn-delete:hover {
          background: #dc2626;
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .d-split-layout { grid-template-columns: 1fr; gap: 40px; }
        }
      `}</style>

      <Cursor />
      <div className="d-grid-bg" />

      <div className="d-container">
        {/* Header */}
        <header className="d-header">
          <div className="d-logo-group">
            <div className="d-logo-box">A</div>
            <div>
              <h1 className="d-logo-title">Aether Console</h1>
              <p className="d-logo-user">
                Logged in as <Link href="/profile">{user.username}</Link>
              </p>
            </div>
          </div>
          <div className="d-header-actions">
            <Link href="/profile" className="d-btn-profile">
              Account Profile
            </Link>
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="d-btn-logout"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </header>

        {/* Dynamic Split Layout */}
        <div className="d-split-layout">
          
          {/* Left Column: Actions / Orchestrator */}
          <div className="d-left-col">
            <div className="d-orchestrator-title">Workspace Orchestrator</div>

            {/* Create Workspace */}
            <form onSubmit={createRoom} className="d-form-card">
              <h2>New Workspace</h2>
              <p>Spin up a container-isolated editor room instantly.</p>
              <div className="d-input-group">
                <input
                  className="d-input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Workspace name..."
                  maxLength={80}
                  required
                />
              </div>
              <MagBtn type="submit" className="d-submit-action">
                <Plus size={14} /> Create Workspace
              </MagBtn>
            </form>

            {/* Join Workspace */}
            <form onSubmit={joinRoom} className="d-form-card">
              <h2>Join Workspace</h2>
              <p>Join an active session using an invite link or ID.</p>
              <div className="d-input-group">
                <input
                  className="d-input-field"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Paste Invite ID..."
                />
              </div>
              <MagBtn type="submit" className="d-submit-action d-submit-action-ghost">
                <UserPlus size={14} /> Join Session
              </MagBtn>
            </form>
          </div>

          {/* Right Column: Active Workspaces & Playground */}
          <div className="d-right-col">
            
            {/* Playground Strip */}
            <div className="d-playground-strip">
              <div className="d-playground-info">
                <span className="d-playground-icon"><Cpu size={18} /></span>
                <div className="d-playground-text">
                  <h3>Sandboxed Playground</h3>
                  <p>Compile algorithms securely in Python, C++, JS, and TS. Customize input streams and read execution times instantly.</p>
                </div>
              </div>
              <MagBtn href="/playground" className="d-submit-action d-submit-action-ghost" style={{ width: "auto", padding: "10px 20px" }}>
                <ExternalLink size={13} style={{ marginRight: 6 }} /> Open Playground
              </MagBtn>
            </div>

            {/* Workspaces Section */}
            <section>
              <div className="d-section-header">
                <h2 className="d-section-title">
                  <FolderKanban size={14} style={{ marginRight: 4 }} />
                  Active Workspace Sessions
                </h2>
                <span className="d-section-count">{rooms.length}</span>
              </div>

              {rooms.length === 0 ? (
                <MockTerminal />
              ) : (
                <div className="d-row-grid">
                  {rooms.map((room) => {
                    const isOwner = room.ownerId === user.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => router.push(`/room/${room.id}`)}
                        className="d-row-card"
                      >
                        <div className="d-row-left">
                          <span className="d-row-icon"><Terminal size={14} /></span>
                          <div className="d-row-details">
                            <div className="d-row-name">{room.name}</div>
                            <div className="d-row-meta">
                              <span className="d-row-id">ID: {room.id.slice(0, 8)}...</span>
                              {isOwner ? (
                                <span className="d-row-badge d-row-badge-owner">Owner</span>
                              ) : (
                                <span className="d-row-badge d-row-badge-member">Member</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="d-row-right" onClick={(e) => e.stopPropagation()}>
                          <span className="d-row-launch">
                            Launch <ExternalLink size={11} style={{ marginLeft: 2 }} />
                          </span>
                          <div className="d-row-actions">
                            <button
                              className="d-row-btn"
                              onClick={(e) => copyToClipboard(room.id, e)}
                              title="Copy Room ID"
                            >
                              <Copy size={12} />
                            </button>
                            {isOwner && (
                              <button
                                className="d-row-btn d-row-btn-delete"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmRoom(room); }}
                                title="Delete Workspace"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        room={confirmRoom}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmRoom(null)}
        loading={deleting}
      />
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="d-loading">
        <style>{`
          .d-loading {
            min-height: 100vh;
            background: #09090b;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7a7d;
            font-family: monospace;
            font-size: 12px;
            letter-spacing: 0.12em;
          }
        `}</style>
        SYNCING CONSOLE STATE...
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
