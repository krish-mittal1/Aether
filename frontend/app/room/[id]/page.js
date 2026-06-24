"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, Bug, ChevronRight, Code2 as Code2Icon, Command, Copy, Download, FileCode2, FolderOpen, Gauge, GitBranch, HardDrive, Hash, Menu, MessageSquarePlus, MoreHorizontal, PanelRight, Play, RefreshCw, Save, Search, Sparkles, Square, TestTube2, Wand2, X } from "lucide-react";
import { ActivityBar } from "../../../components/ActivityBar";
import { KeyboardShortcutsModal } from "../../../components/KeyboardShortcutsModal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChatPanel } from "../../../components/ChatPanel";
import { FileExplorer, inferLanguage } from "../../../components/FileExplorer";
import { GitPanel } from "../../../components/GitPanel";
import { LivePreview } from "../../../components/LivePreview";
import { NotebookView } from "../../../components/NotebookView";
import { OutputPanel } from "../../../components/OutputPanel";
import { VoiceChat } from "../../../components/VoiceChat";
import { useRequireAuth } from "../../../hooks/useRequireAuth";
import { api, apiLong } from "../../../lib/api";
import { clearRoomDirHandle, loadRoomDirHandle, saveRoomDirHandle, verifyPermission, walkDirectory } from "../../../lib/localFS";
import { createSocket } from "../../../lib/socket";
import { useAuthStore } from "../../../store/authStore";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const IGNORE_DIRS = [".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv", "venv", ".idea", ".vscode"];
const BLOCKED_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".zip", ".exe", ".dll", ".pdf", ".mp4", ".mov", ".ttf", ".woff", ".woff2"];

export default function RoomPage() {
  const { id: roomId } = useParams();
  const { user } = useRequireAuth();
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const remoteCursorCollection = useRef(null);
  const remoteCursors = useRef({});
  const saveTimer = useRef(null);
  const runAbortRef = useRef(null);
  const aiAbortRef = useRef(null);
  const aiApplyRef = useRef(null);
  const inlineAiEnabledRef = useRef(true);
  const inlineAiCacheRef = useRef(new Map());
  const inlineAiDisposablesRef = useRef([]);
  const inlineAiTriggerTimerRef = useRef(null);
  const inlineAiRequestSeqRef = useRef(0);
  const terminalResizeRef = useRef(false);
  const panelResizeRef = useRef(null);
  const conflictToastRef = useRef(0);
  const lastLocalContentRef = useRef("");       // last content typed (for remote-edit detection)
  const pendingContentRef = useRef({});          // fileId → latest typed content (not yet flushed to state)
  const flushTimerRef = useRef(null);            // debounce timer for flushing typed content to React state
  const isDirtyRef = useRef({});                 // fileId → bool  (avoids repeated setDirtyFiles calls)
  const [room, setRoom] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [dirtyFiles, setDirtyFiles] = useState({});
  const [localHandles, setLocalHandles] = useState({});
  const [localDirHandle, setLocalDirHandle] = useState(null);
  const [localDirName, setLocalDirName] = useState("");
  // "none" | "connected" | "needs-permission"
  const [localSyncStatus, setLocalSyncStatus] = useState("none");
  const [socket, setSocket] = useState(null);

  const [output, setOutput] = useState("");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  // VS Code-like editor settings
  const [editorTheme, setEditorTheme] = useState("aether-sage");
  const [fontSize, setFontSize] = useState(15);
  const [wordWrap, setWordWrap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [stickyScroll, setStickyScroll] = useState(false);
  const [lineNumbers, setLineNumbers] = useState("on");
  const [indentSize, setIndentSize] = useState(2);
  const [zenMode, setZenMode] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const cursorPosRef = useRef({ line: 1, col: 1 });
  // Panel visibility
  const [showExplorer, setShowExplorer] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(238);
  const [explorerWidth, setExplorerWidth] = useState(340);
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const [activeActivityPanel, setActiveActivityPanel] = useState("explorer");
  // Tab context menu
  const [tabMenu, setTabMenu] = useState(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMode, setAiMode] = useState("assist");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiCanApply, setAiCanApply] = useState(false);
  const [aiLastModel, setAiLastModel] = useState("");
  const [inlineAiEnabled, setInlineAiEnabled] = useState(true);
  // Advanced feature states
  const [showPreview, setShowPreview] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [aiFullContext, setAiFullContext] = useState(false);
  const [aiDiffMode, setAiDiffMode] = useState(false);

  const activeFileRef = useRef(activeFile);
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { inlineAiEnabledRef.current = inlineAiEnabled; }, [inlineAiEnabled]);
  useEffect(() => () => disposeInlineAi(), []);
  // Lock to prevent socket-triggered loadState() from overwriting state mid-import
  const importingRef = useRef(false);

  useEffect(() => {
    function onMove(event) {
      if (terminalResizeRef.current) {
        const nextHeight = Math.min(460, Math.max(150, window.innerHeight - event.clientY - 28));
        setTerminalHeight(nextHeight);
        return;
      }
      const resize = panelResizeRef.current;
      if (!resize) return;
      const dx = event.clientX - resize.startX;
      if (resize.panel === "explorer") {
        setExplorerWidth(Math.min(520, Math.max(260, resize.startWidth + dx)));
      }
      if (resize.panel === "right") {
        setRightPanelWidth(Math.min(560, Math.max(320, resize.startWidth - dx)));
      }
    }
    function onUp() {
      terminalResizeRef.current = false;
      panelResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const beginPanelResize = useCallback((panel, event) => {
    panelResizeRef.current = {
      panel,
      startX: event.clientX,
      startWidth: panel === "explorer" ? explorerWidth : rightPanelWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [explorerWidth, rightPanelWidth]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = createSocket(token);
    socketRef.current = socket;
    setSocket(socket);
    socket.on("connect", () => socket.emit("join_room", { roomId }));
    socket.on("room-users", ({ users }) => setUsers(users));
    socket.on("user-joined", ({ users }) => setUsers(users));
    socket.on("user-left", ({ users }) => setUsers(users));
    socket.on("code-updated", ({ fileId, content, version }) => {
      // Always update React state (files list stays in sync for saving / tree)
      setFiles((items) => items.map((f) => f.id === fileId ? { ...f, content, version } : f));

      if (activeFileRef.current?.id === fileId) {
        setActiveFile((f) => ({ ...f, content, version }));

        // ── KEY FIX: skip editor.setValue() if we have pending typed content ──
        // When typing fast, the server echoes our own code_change back as code-updated
        // (with an older version). If we applied it, it would REVERT our latest typing
        // and jump the cursor. pendingContentRef tracks "we're the author of this file
        // right now" — any incoming update is our own stale echo, not a teammate's edit.
        const hasPending = pendingContentRef.current[fileId] !== undefined;
        if (hasPending) return; // our own echo — editor already has the latest

        // It's a genuine teammate edit — apply with cursor preservation
        const editor = editorRef.current;
        if (editor && editor.getValue() !== content) {
          const pos = editor.getPosition();
          const scrollTop = editor.getScrollTop();
          editor.setValue(content);
          lastLocalContentRef.current = content;
          if (pos) editor.setPosition(pos);
          editor.setScrollTop(scrollTop);
        }
      }
    });
    socket.on("code-ack", ({ fileId, version }) => {
      // Only update version in files list; skip setState on activeFile/lastSavedAt
      // to avoid triggering re-renders during active typing sessions.
      setFiles((items) => items.map((f) => f.id === fileId ? { ...f, version } : f));
    });

    socket.on("code-conflict", ({ serverFile, message }) => {
      // Silently sync the file — only surface a toast if it hasn't shown in the last 5s
      setFiles((items) => items.map((f) => f.id === serverFile.id ? serverFile : f));
      if (activeFileRef.current?.id === serverFile.id) setActiveFile(serverFile);
      const now = Date.now();
      if (now - conflictToastRef.current > 5000) {
        conflictToastRef.current = now;
        toast("↩ Remote change synced", {
          icon: "🔄",
          duration: 2000,
          style: { background: "#0d1012", color: "#b0bec0", border: "1px solid rgba(255,255,255,0.06)", fontSize: "12px" }
        });
      }
    });
    socket.on("cursor-updated", ({ user: cursorUser, fileId, position }) => {
      if (!cursorUser || cursorUser.id === user.id || activeFileRef.current?.id !== fileId) return;
      remoteCursors.current[cursorUser.id] = { user: cursorUser, position, seenAt: Date.now() };
      renderRemoteCursors();
    });
    socket.on("user-typing", ({ user: typingUser }) => {
      if (!typingUser || typingUser.id === user.id) return;
      setTypingUsers((existing) => [...new Set([...existing, typingUser.username])]);
      setTimeout(() => setTypingUsers((existing) => existing.filter((u) => u !== typingUser.username)), 1200);
    });
    socket.on("receive-message", (message) => setMessages((items) => [...items, message]));
    socket.on("file-created", ({ file }) => setFiles((items) => [...items, file]));
    socket.on("file-deleted", ({ fileId }) => {
      setFiles((items) => items.filter((f) => f.id !== fileId));
      setOpenTabs((tabs) => tabs.filter((id) => id !== fileId));
      setActiveFile((f) => f?.id === fileId ? null : f);
    });
    socket.on("file-renamed", ({ file }) => {
      setFiles((items) => items.map((f) => f.id === file.id ? file : f));
      setActiveFile((f) => f?.id === file.id ? file : f);
    });
    socket.on("files-refresh", () => {
      // Skip reload if we triggered the refresh ourselves via an import
      // to avoid overwriting the freshly-set file state
      if (importingRef.current) return;
      loadState().catch(() => toast.error("Could not refresh files"));
    });
    socket.on("disconnect", () => setUsers([]));
    return () => {
      socket.emit("leave_room", { roomId });
      socket.disconnect();
      setSocket(null);
    };
  }, [token, user, roomId]);

  async function loadState() {
    const [roomRes, filesRes, chatRes] = await Promise.all([
      api.get(`/rooms/${roomId}`),
      api.get(`/files/${roomId}`),
      api.get(`/chat/${roomId}`)
    ]);
    setRoom(roomRes.data);
    setFiles(filesRes.data);
    setMessages(chatRes.data);
    const firstFile = filesRes.data.find((f) => f.type === "file") || null;
    setActiveFile((old) => old || firstFile);
    if (firstFile) setOpenTabs((tabs) => tabs.length ? tabs : [firstFile.id]);
  }

  useEffect(() => { if (user) loadState().catch(() => toast.error("Could not load workspace")); }, [user, roomId]);

  useEffect(() => {
    if (!roomId) return;
    loadRoomDirHandle(roomId).then(async (handle) => {
      if (!handle) return;
      setLocalDirHandle(handle);
      setLocalDirName(handle.name);
      const ok = await verifyPermission(handle, { request: false });
      setLocalSyncStatus(ok ? "connected" : "needs-permission");
    });
  }, [roomId]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(`workspace:${roomId}:state`) || "{}");
      if (cached.activeFileId) setActiveFile((current) => current || files.find((f) => f.id === cached.activeFileId) || null);
      if (typeof cached.autoSave === "boolean") setAutoSave(cached.autoSave);
    } catch {}
  }, [roomId, files]);

  useEffect(() => {
    try {
      localStorage.setItem(`workspace:${roomId}:state`, JSON.stringify({
        openTabs,
        activeFileId: activeFile?.id,
        autoSave
      }));
    } catch {}
  }, [roomId, openTabs, activeFile?.id, autoSave]);

  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) saveAllFiles(); else saveActiveFile();
      }
      if (ctrl && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandOpen(false);
        setSearchOpen(true);
        setQuery("");
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandOpen(true);
        setQuery("");
      }
      if (ctrl && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setAiPanelOpen((open) => !open);
      }
      if (ctrl && e.key.toLowerCase() === "\\") {
        e.preventDefault();
        triggerInlineAi();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeFile, files, dirtyFiles]);

  const updateContent = useCallback((content) => {
    const file = activeFileRef.current;
    if (!file) return;

    // ── 1. Ref updates (zero re-renders) ──────────────────────────────────────
    lastLocalContentRef.current = content;
    pendingContentRef.current[file.id] = content;

    // ── 2. Mark dirty (only one setState per file, not per keystroke) ─────────
    if (!isDirtyRef.current[file.id]) {
      isDirtyRef.current[file.id] = true;
      setDirtyFiles((d) => ({ ...d, [file.id]: true }));
    }

    // ── 3. Socket emit — immediate, latency-sensitive ─────────────────────────
    const baseVersion = file.version || 0;
    socketRef.current?.emit("code_change", { roomId, fileId: file.id, content, baseVersion });
    socketRef.current?.emit("typing", { roomId, fileId: file.id });

    // ── 4. Debounced flush to React state + auto-save ─────────────────────────
    // Fires 500 ms after the LAST keystroke. Does NOT run during active typing.
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      const latestContent = pendingContentRef.current[file.id];
      if (latestContent === undefined) return;
      const flushed = { ...file, content: latestContent, version: (file.version || 0) + 1 };
      setActiveFile(flushed);
      setFiles((items) => items.map((f) => f.id === file.id ? flushed : f));
      if (autoSave) saveFileById(file.id);
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, autoSave]);

  // NOTE: We intentionally do NOT have a useEffect watching activeFile?.content here.
  // Monaco is uncontrolled (defaultValue + key={activeFile.id}). Remote edits are
  // pushed directly from the socket handler above with cursor preservation.
  // Any useEffect on activeFile.content would fire on every intermediate batched state
  // update while typing fast and cause setValue() → cursor jump.

  async function createFile(data) {
    socketRef.current?.emit("create_file", { roomId, ...data });
  }

  async function selectFile(file) {
    setOpenTabs((tabs) => tabs.includes(file.id) ? tabs : [...tabs, file.id]);
    // If content was stripped on initial load (large file), fetch it now
    if (file.content === null || file.content === undefined) {
      setActiveFile({ ...file, content: "" }); // show empty editor immediately
      try {
        const { data } = await api.get(`/files/${roomId}/content/${file.id}`);
        const loaded = { ...file, content: data.content, version: data.version };
        setActiveFile(loaded);
        setFiles((items) => items.map((f) => f.id === file.id ? loaded : f));
      } catch {
        toast.error("Failed to load file content");
      }
    } else {
      setActiveFile(file);
    }
  }

  function closeTab(fileId) {
    setOpenTabs((tabs) => tabs.filter((id) => id !== fileId));
    if (activeFile?.id === fileId) {
      const remaining = openTabs.filter((id) => id !== fileId);
      const nextFile = files.find((f) => f.id === remaining[remaining.length - 1]) || files.find((f) => f.type === "file") || null;
      setActiveFile(nextFile);
    }
  }

  function shouldImportFile(file) {
    const path = file.webkitRelativePath || file.name;
    if (IGNORE_DIRS.some((part) => path.split("/").includes(part))) return false;
    if (file.size > 25 * 1024 * 1024) return false; // skip files > 25MB
    return !BLOCKED_EXTS.some((ext) => path.toLowerCase().endsWith(ext));
  }

  async function importFolder(localFiles) {
    const importable = localFiles.filter(shouldImportFile).slice(0, 50_000);
    const skipped = localFiles.length - importable.length;

    if (!importable.length) {
      toast.error("No importable source files found. Make sure you're opening a project folder with code files.");
      if (skipped > 0) {
        toast("ℹ️ Skipped folders: node_modules, .git, dist, build, .next and binary/image files are always excluded.", {
          duration: 6000,
          style: { background: "#1e2030", color: "#94a3b8", fontSize: "12px" }
        });
      }
      return;
    }

    const toastId = toast.loading(`Importing ${importable.length} source files...`);

    // If a lot of files were skipped, show a friendly info toast explaining why
    if (skipped > 100) {
      setTimeout(() => {
        toast(`⚡ Skipped ${skipped.toLocaleString()} files — node_modules, .git, dist, build, .next, and binary files (images, fonts, zips) are automatically excluded to keep your workspace clean.`, {
          duration: 8000,
          icon: "📦",
          style: { background: "#1e2030", color: "#94a3b8", fontSize: "12px", maxWidth: "420px" }
        });
      }, 500);
    }

    importingRef.current = true;
    try {
      const handleMap = {};
      const filesPayload = await Promise.all(importable.map(async (file) => {
        const path = file.webkitRelativePath || file.name;
        if (file.handle) handleMap[path] = file.handle;
        return { path, content: await file.text(), language: inferLanguage(file.name) };
      }));
      const { data } = await api.post("/files/import-folder", { roomId, files: filesPayload });
      setFiles(data.files);
      const nextHandles = {};
      const paths = buildWorkspacePaths(data.files);
      data.files.forEach((workspaceFile) => {
        const match = filesPayload.find((item) => item.path === paths[workspaceFile.id]);
        if (match && handleMap[match.path]) nextHandles[workspaceFile.id] = handleMap[match.path];
      });
      setLocalHandles((current) => ({ ...current, ...nextHandles }));
      const firstImported = data.files.find((f) => f.type === "file");
      if (firstImported) selectFile(firstImported);
      socketRef.current?.emit("file_tree_refresh", { roomId });
      toast.success(
        skipped > 0
          ? `✅ Imported ${data.count} source files. ${skipped.toLocaleString()} files were skipped (node_modules, binaries, etc.)`
          : `✅ Imported ${data.count} files successfully`,
        { id: toastId, duration: 5000 }
      );
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Folder import failed", { id: toastId });
    } finally {
      setTimeout(() => { importingRef.current = false; }, 1500);
    }
  }

  async function openFolderWithFileSystemAccess() {
    if (!window.showDirectoryPicker) {
      return toast.error("Open Folder requires Chrome or Edge. Use the import button in the file explorer instead.");
    }
    let root;
    try {
      root = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch {
      return; // user cancelled
    }
    // Persist the root handle so it survives page refresh
    await saveRoomDirHandle(roomId, root);
    setLocalDirHandle(root);
    setLocalDirName(root.name);
    setLocalSyncStatus("connected");

    // Walk directory and collect all text files with their handles
    const toastId = toast.loading("Reading folder...");
    const entries = await walkDirectory(root, IGNORE_DIRS);
    const found = [];
    for (const { path, handle } of entries) {
      const file = await handle.getFile();
      Object.defineProperty(file, "webkitRelativePath", { value: path });
      Object.defineProperty(file, "handle", { value: handle });
      if (shouldImportFile(file)) found.push(file);
    }
    toast.dismiss(toastId);
    await importFolder(found);
  }

  /** Called when a stored handle needs re-permission (user must click first). */
  async function reconnectLocalFolder() {
    if (!localDirHandle) return;
    const ok = await verifyPermission(localDirHandle, { request: true });
    if (!ok) return toast.error("Permission denied for local folder.");
    setLocalSyncStatus("connected");
    // Rebuild handles by re-walking the directory
    const entries = await walkDirectory(localDirHandle, IGNORE_DIRS);
    const paths = buildWorkspacePaths(files);
    // Invert: path → fileId
    const pathToId = Object.fromEntries(Object.entries(paths).map(([id, p]) => [p, id]));
    const nextHandles = {};
    for (const { path, handle } of entries) {
      const fileId = pathToId[path];
      if (fileId) nextHandles[fileId] = handle;
    }
    setLocalHandles((h) => ({ ...h, ...nextHandles }));
    toast.success(`Local folder "${localDirHandle.name}" reconnected — ${Object.keys(nextHandles).length} files linked`);
  }

  async function disconnectLocalFolder() {
    await clearRoomDirHandle(roomId);
    setLocalDirHandle(null);
    setLocalDirName("");
    setLocalSyncStatus("none");
    setLocalHandles({});
    toast.success("Local folder disconnected");
  }

  async function deleteFile(file) {
    socketRef.current?.emit("delete_file", { fileId: file.id });
  }

  async function renameFile(file, name) {
    socketRef.current?.emit("rename_file", { fileId: file.id, name });
  }

  async function moveFile(fileId, parentId) {
    const file = files.find((f) => f.id === fileId);
    if (!file || file.id === parentId) return;
    try {
      const { data } = await api.patch(`/files/${fileId}`, { parentId });
      setFiles((items) => items.map((f) => f.id === fileId ? data : f));
      socketRef.current?.emit("file_tree_refresh", { roomId });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Move failed");
    }
  }

  async function sendMessage(content) {
    socketRef.current?.emit("send_message", { roomId, content });
  }

  async function runCode() {
    if (!activeFile) return;
    setRunning(true);
    setOutput("Running...");
    const controller = new AbortController();
    runAbortRef.current = controller;
    // Use latest typed content from ref — might not be flushed to state yet
    const code = pendingContentRef.current[activeFile.id] ?? activeFile.content ?? "";
    try {
      const { data } = await apiLong.post("/execute", { language: activeFile.language, code, stdin }, { signal: controller.signal });
      const parts = [];
      if (data.output) parts.push(data.output);
      if (data.error) parts.push(`[stderr]\n${data.error}`);
      setOutput(parts.join("\n") || `✓ Exited in ${data.executionTimeMs}ms`);
    } catch (error) {
      if (error.name === "CanceledError" || error.name === "AbortError") {
        setOutput("Execution stopped.");
      } else {
        setOutput(`Error: ${error.response?.data?.detail || error.message || "Execution failed"}`);
      }
    } finally {
      setRunning(false);
      runAbortRef.current = null;
    }
  }

  function stopRun() {
    runAbortRef.current?.abort();
  }

  async function saveFileById(fileId) {
    const liveActiveFile = activeFileRef.current;
    let file = files.find((f) => f.id === fileId) ||
               (liveActiveFile?.id === fileId ? liveActiveFile : null);
    if (!file || file.type !== "file") return;
    // Always use the latest typed content — might not be flushed to state yet
    const pendingContent = pendingContentRef.current[fileId];
    if (pendingContent !== undefined) file = { ...file, content: pendingContent };
    try {
      const { data } = await api.patch(`/files/${file.id}`, { content: file.content || "", baseVersion: file.version || 0 });
      setFiles((items) => items.map((f) => f.id === data.id ? data : f));
      if (activeFileRef.current?.id === data.id) setActiveFile(data);
      delete pendingContentRef.current[fileId]; // flush accepted — clear pending
      isDirtyRef.current[fileId] = false;
      setDirtyFiles((dirty) => {
        const next = { ...dirty };
        delete next[data.id];
        return next;
      });
      const handle = localHandles[file.id];
      if (handle?.createWritable) {
        const writable = await handle.createWritable();
        await writable.write(file.content || "");
        await writable.close();
      }
      setLastSavedAt(new Date());
    } catch (error) {
      if (error.response?.status === 409) {
        try {
          const { data: contentData } = await api.get(`/files/${roomId}/content/${fileId}`);
          const mergedFile = { ...file, content: contentData.content, version: contentData.version };
          setFiles((items) => items.map((f) => f.id === fileId ? mergedFile : f));
          if (activeFileRef.current?.id === fileId) setActiveFile(mergedFile);
          delete pendingContentRef.current[fileId];
          isDirtyRef.current[fileId] = false;
          setDirtyFiles((dirty) => { const next = { ...dirty }; delete next[fileId]; return next; });
        } catch { /* network failure — leave dirty */ }
      }
    }
  }

  async function saveActiveFile() {
    if (!activeFile) return;
    await saveFileById(activeFile.id);
    toast.success(localHandles[activeFile.id] ? "Saved workspace and local file" : "Saved workspace");
  }

  async function saveAllFiles() {
    const ids = Object.keys(dirtyFiles);
    await Promise.all(ids.map(saveFileById));
    toast.success(ids.length ? `Saved ${ids.length} files` : "Nothing to save");
  }

  async function formatActiveFile() {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await editor.getAction("editor.action.formatDocument")?.run();
      toast.success("Formatted");
    } catch {
      toast.error("Formatter unavailable for this file");
    }
  }

  function goToLine() {
    editorRef.current?.getAction("editor.action.gotoLine")?.run();
  }

  function findInFile() {
    editorRef.current?.getAction("actions.find")?.run();
  }

  function colorForUser(id) {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return `hsl(${hash}, 82%, 58%)`;
  }

  function injectCursorStyle(userId, username) {
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const styleId = `remote-cursor-style-${safeId}`;
    if (document.getElementById(styleId)) return safeId;
    const color = colorForUser(userId);
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `.monaco-editor .remote-cursor-${safeId}{border-left:2px solid ${color}}.monaco-editor .remote-cursor-label-${safeId}::after{content:"${username.replace(/"/g, "")}";position:absolute;transform:translate(2px,-18px);background:${color};color:#07110c;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none}`;
    document.head.appendChild(style);
    return safeId;
  }

  function renderRemoteCursors() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !remoteCursorCollection.current) return;
    const now = Date.now();
    remoteCursorCollection.current.set(Object.values(remoteCursors.current)
      .filter(({ seenAt }) => now - seenAt < 15000)
      .map(({ user, position }) => {
        const safeId = injectCursorStyle(user.id, user.username);
        return {
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          options: {
            className: `remote-cursor-${safeId}`,
            afterContentClassName: `remote-cursor-label-${safeId}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        };
      }));
  }

  function getEditorSnapshot() {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const file = activeFileRef.current;
    const code = editor?.getValue() ?? pendingContentRef.current[file?.id] ?? file?.content ?? "";
    const selection = editor?.getSelection();
    const hasSelection = Boolean(selection && (
      selection.startLineNumber !== selection.endLineNumber ||
      selection.startColumn !== selection.endColumn
    ));
    const selectedText = hasSelection && model ? model.getValueInRange(selection) : "";
    const position = editor?.getPosition() || { lineNumber: 1, column: 1 };
    return { editor, model, file, code, selection, hasSelection, selectedText, position };
  }

  function buildAiWorkspaceContext() {
    const visibleFiles = files.slice(0, 120).map((file) => {
      const path = workspacePaths[file.id] || file.name;
      const status = dirtyFiles[file.id] ? "dirty" : "saved";
      return `${file.type}: ${path}${file.type === "file" ? ` [${file.language || inferLanguage(file.name)}; ${status}]` : ""}`;
    });
    const base = [
      `Room: ${room?.name || roomId}`,
      `Active: ${activeFile ? workspacePaths[activeFile.id] || activeFile.name : "none"}`,
      `Open tabs: ${openTabs.map((id) => workspacePaths[id] || files.find((f) => f.id === id)?.name).filter(Boolean).join(", ") || "none"}`,
      "Workspace tree:",
      ...visibleFiles,
    ];
    // When full context is on, include content of open tab files (capped at 40k chars total)
    if (aiFullContext) {
      let budget = 40_000;
      const contentLines = ["", "--- File Contents ---"];
      for (const fileId of openTabs.slice(0, 8)) {
        const f = files.find((x) => x.id === fileId);
        if (!f || f.type !== "file" || !f.content) continue;
        const path = workspacePaths[f.id] || f.name;
        const snippet = f.content.slice(0, Math.min(budget, 8000));
        budget -= snippet.length;
        contentLines.push(`\n// ${path}\n${snippet}`);
        if (budget <= 0) break;
      }
      if (contentLines.length > 2) base.push(...contentLines);
    }
    return base.join("\n");
  }

  function buildInlineAiContext(file) {
    const activePath = file ? workspacePaths[file.id] || file.name : "unknown";
    const open = openTabs
      .map((id) => workspacePaths[id] || files.find((f) => f.id === id)?.name)
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
    const nearbyFiles = files
      .filter((item) => item.type === "file")
      .slice(0, 35)
      .map((item) => workspacePaths[item.id] || item.name)
      .join(", ");
    return `Inline completion. Active file: ${activePath}. Open tabs: ${open || "none"}. Project files: ${nearbyFiles || "none"}.`;
  }

  function getInlineCodeWindow(model, position) {
    const startLine = Math.max(1, position.lineNumber - 70);
    const endLine = Math.min(model.getLineCount(), position.lineNumber + 24);
    const lines = [];
    for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
      lines.push(model.getLineContent(lineNo));
    }
    return {
      code: lines.join("\n"),
      cursorLine: position.lineNumber - startLine + 1,
      cursorColumn: position.column,
    };
  }

  function replaceEditorText(text, rangeOverride = null) {
    const { editor, model } = getEditorSnapshot();
    if (!editor || !model) return;
    const range = rangeOverride || editor.getSelection() || model.getFullModelRange();
    editor.executeEdits("aether-ai", [{ range, text, forceMoveMarkers: true }]);
    editor.focus();
    updateContent(editor.getValue());
  }

  async function aiCompleteAtCursor() {
    const { editor, file, code, position } = getEditorSnapshot();
    if (!editor || !file) {
      toast.error("Open a file before asking AI to complete code");
      return;
    }
    aiAbortRef.current?.abort?.();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiPanelOpen(true);
    setAiMode("complete");
    setAiBusy(true);
    setAiError("");
    setAiResult("");
    setAiCanApply(false);
    try {
      const { data } = await api.post("/ai/complete", {
        language: file.language || inferLanguage(file.name),
        code,
        cursorLine: position.lineNumber,
        cursorColumn: position.column,
        context: buildAiWorkspaceContext(),
      }, { signal: controller.signal });
      const completion = (data.completion || "").trimEnd();
      if (!completion) {
        toast("AI did not return a completion for this cursor");
        return;
      }
      setAiLastModel(data.model || "");
      editor.executeEdits("aether-ai-complete", [{
        range: new monacoRef.current.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: completion,
        forceMoveMarkers: true,
      }]);
      updateContent(editor.getValue());
      setAiResult(completion);
      toast.success("AI completion inserted");
    } catch (error) {
      if (error.name === "CanceledError" || error.name === "AbortError") return;
      const detail = error.response?.data?.detail || "AI completion failed";
      setAiError(typeof detail === "string" ? detail : JSON.stringify(detail));
      toast.error("AI completion failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function runWorkspaceAi(task, extraPrompt = "") {
    const { file, code, selection, hasSelection, selectedText, model } = getEditorSnapshot();
    if (!file) {
      toast.error("Open a file before using AI");
      return;
    }
    aiAbortRef.current?.abort?.();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    aiApplyRef.current = null;
    setAiPanelOpen(true);
    setAiMode(task);
    setAiBusy(true);
    setAiError("");
    setAiResult("");
    setAiCanApply(false);
    try {
      const { data } = await api.post("/ai/workspace", {
        task,
        language: file.language || inferLanguage(file.name),
        code,
        selection: selectedText,
        fileName: workspacePaths[file.id] || file.name,
        workspaceContext: buildAiWorkspaceContext(),
        prompt: extraPrompt || aiPrompt,
      }, { signal: controller.signal });
      const result = (data.result || "").trim();
      setAiResult(result);
      setAiLastModel(data.model || "");
      if (["fix", "optimize", "refactor"].includes(task) && result) {
        aiApplyRef.current = {
          range: hasSelection
            ? selection
            : model?.getFullModelRange(),
        };
        setAiCanApply(true);
      }
      toast.success(`AI ${task} ready`);
    } catch (error) {
      if (error.name === "CanceledError" || error.name === "AbortError") return;
      const detail = error.response?.data?.detail || "AI request failed";
      setAiError(typeof detail === "string" ? detail : JSON.stringify(detail));
      toast.error("AI request failed");
    } finally {
      setAiBusy(false);
    }
  }

  function applyAiResult() {
    if (!aiResult.trim()) return;
    const range = aiApplyRef.current?.range || null;
    replaceEditorText(aiResult, range);
    setAiCanApply(false);
    toast.success("AI changes applied to editor");
  }

  function sendAiResultToChat() {
    if (!aiResult.trim()) return;
    sendMessage(`[Aether AI]\n${aiResult.slice(0, 1800)}`);
    toast.success("AI result sent to chat");
  }

  function summarizeActiveFile() {
    const fileLabel = activeFile ? (workspacePaths[activeFile.id] || activeFile.name) : "active file";
    return runWorkspaceAi(
      "ask",
      `Summarize the whole file "${fileLabel}" for a developer who just opened it.

Include:
- what this file does
- important functions, classes, components, hooks, routes, or services
- main data flow and side effects
- external dependencies/API calls
- bugs, risky areas, or missing error handling you notice
- the 3 most useful next edits

Keep it concise but useful. Do not rewrite the file.`
    );
  }

  function disposeInlineAi() {
    clearTimeout(inlineAiTriggerTimerRef.current);
    inlineAiDisposablesRef.current.forEach((disposable) => disposable?.dispose?.());
    inlineAiDisposablesRef.current = [];
  }

  function triggerInlineAi() {
    const editor = editorRef.current;
    if (!editor || !inlineAiEnabledRef.current) return;
    editor.getAction("editor.action.inlineSuggest.trigger")?.run();
  }

  function shouldRequestInlineAi(model, position) {
    const line = model.getLineContent(position.lineNumber);
    const before = line.slice(0, Math.max(0, position.column - 1));
    const trimmed = before.trim();
    if (!trimmed && position.lineNumber <= 1) return false;
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) return false;
    if (trimmed.length >= 2) return true;
    return /[({[=:,]$/.test(trimmed) || position.column === 1;
  }

  function cleanInlineCompletion(text, model, position) {
    let completion = (text || "")
      .replace(/\r/g, "")
      .replace(/^```[a-zA-Z0-9+#-]*\s*/, "")
      .replace(/```$/, "")
      .trimEnd();
    if (!completion.trim()) return "";

    const line = model.getLineContent(position.lineNumber);
    const before = line.slice(0, Math.max(0, position.column - 1));
    const trimmedBefore = before.trimStart();
    if (trimmedBefore && completion.startsWith(trimmedBefore)) {
      completion = completion.slice(trimmedBefore.length);
    }
    if (before && completion.startsWith(before)) {
      completion = completion.slice(before.length);
    }
    completion = completion.replace(/^\n{3,}/, "\n\n");
    const lines = completion.split("\n");
    if (lines.length > 30) completion = lines.slice(0, 30).join("\n");
    if (completion.length > 1800) completion = completion.slice(0, 1800);
    if (!completion.trim()) return "";
    if (completion.trim() === trimmedBefore.trim()) return "";
    return completion;
  }

  function setupInlineAi(editor, monaco) {
    disposeInlineAi();
    const supportedLanguages = ["javascript", "typescript", "python", "cpp", "java", "go", "rust", "json", "html", "css"];
    const providerDisposables = supportedLanguages.map((languageId) => monaco.languages.registerInlineCompletionsProvider(languageId, {
      provideInlineCompletions: async (model, position, _context, token) => {
        const file = activeFileRef.current;
        if (!inlineAiEnabledRef.current || !file || model !== editor.getModel()) return { items: [] };
        if (!shouldRequestInlineAi(model, position)) return { items: [] };

        const code = model.getValue();
        const line = model.getLineContent(position.lineNumber);
        const before = line.slice(0, Math.max(0, position.column - 1));
        const cacheSeed = code.slice(Math.max(0, model.getOffsetAt(position) - 900), model.getOffsetAt(position) + 300);
        const cacheKey = `${file.id}:${position.lineNumber}:${position.column}:${before}:${cacheSeed}`;
        const cached = inlineAiCacheRef.current.get(cacheKey);
        if (cached) {
          return {
            items: [{ insertText: cached, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }],
          };
        }

        await new Promise((resolve) => setTimeout(resolve, 110));
        if (token?.isCancellationRequested || !inlineAiEnabledRef.current || model !== editor.getModel()) return { items: [] };

        const requestSeq = ++inlineAiRequestSeqRef.current;
        const codeWindow = getInlineCodeWindow(model, position);
        try {
          const { data } = await api.post("/ai/complete", {
            language: file.language || inferLanguage(file.name),
            code: codeWindow.code,
            cursorLine: codeWindow.cursorLine,
            cursorColumn: codeWindow.cursorColumn,
            context: buildInlineAiContext(file),
          });
          if (token?.isCancellationRequested || requestSeq !== inlineAiRequestSeqRef.current) return { items: [] };
          const completion = cleanInlineCompletion(data.completion || "", model, position);
          if (!completion) return { items: [] };

          inlineAiCacheRef.current.set(cacheKey, completion);
          if (inlineAiCacheRef.current.size > 80) {
            const firstKey = inlineAiCacheRef.current.keys().next().value;
            inlineAiCacheRef.current.delete(firstKey);
          }
          setAiLastModel(data.model || "");
          return {
            items: [{
              insertText: completion,
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            }],
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {},
    }));

    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (!inlineAiEnabledRef.current) return;
      clearTimeout(inlineAiTriggerTimerRef.current);
      inlineAiTriggerTimerRef.current = setTimeout(() => triggerInlineAi(), 220);
    });

    const cursorDisposable = editor.onDidChangeCursorPosition(() => {
      if (!inlineAiEnabledRef.current) return;
      clearTimeout(inlineAiTriggerTimerRef.current);
      inlineAiTriggerTimerRef.current = setTimeout(() => triggerInlineAi(), 320);
    });

    inlineAiDisposablesRef.current = [...providerDisposables, contentDisposable, cursorDisposable];
  }

  function onEditorMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom VS Code-like graphite theme
    monaco.editor.defineTheme('aether-sage', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6f7782', fontStyle: 'italic' },
        { token: 'keyword', foreground: '8bbf96', fontStyle: 'bold' },
        { token: 'string', foreground: 'd8b56d' },
        { token: 'number', foreground: 'c98f77' },
        { token: 'type', foreground: '8fb6d8' },
        { token: 'class', foreground: '8fb6d8' },
        { token: 'function', foreground: '98c7ad' },
        { token: 'operator', foreground: 'b9c0ca' }
      ],
      colors: {
        'editor.background': '#1f2024',
        'editor.foreground': '#d9dee7',
        'editor.lineHighlightBackground': '#2a2c31',
        'editorLineNumber.foreground': '#858b94',
        'editorLineNumber.activeForeground': '#9ed4aa',
        'editor.selectionBackground': '#3d424b',
        'editorCursor.foreground': '#9ed4aa',
        'editorIndentGuide.background1': '#33363c',
        'editorIndentGuide.activeBackground1': '#606773',
      }
    });

    monaco.editor.setTheme(editorTheme);

    remoteCursorCollection.current = editor.createDecorationsCollection([]);
    // Core keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveActiveFile);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, saveAllFiles);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => setSearchOpen(true));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => setSearchOpen(true));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => setCommandOpen(true));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => setShowExplorer(v => !v));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => setShowTerminal(v => !v));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyY, () => setShowChat(v => !v));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => setAiPanelOpen(v => !v));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Space, aiCompleteAtCursor);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, triggerInlineAi);
    editor.addAction({
      id: "aether.acceptInlineAi",
      label: "Accept Aether AI Inline Suggestion",
      keybindings: [monaco.KeyCode.Tab],
      precondition: "inlineSuggestionVisible",
      run: () => editor.getAction("editor.action.inlineSuggest.commit")?.run(),
    });
    editor.addCommand(monaco.KeyCode.F5, runCode);
    // Track cursor position
    cursorPosRef.current = { line: 1, col: 1 };
    const el = document.getElementById("footer-cursor-pos");
    if (el) el.textContent = "Ln 1, Col 1";

    editor.onDidChangeCursorPosition((e) => {
      const pos = { line: e.position.lineNumber, col: e.position.column };
      cursorPosRef.current = pos;
      const el = document.getElementById("footer-cursor-pos");
      if (el) el.textContent = `Ln ${pos.line}, Col ${pos.col}`;
      socketRef.current?.emit("cursor_change", { roomId, fileId: activeFileRef.current?.id, position: e.position });
    });
    // Configure enhanced IntelliSense
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: getJsSnippets(monaco, range) };
      }
    });
    setupInlineAi(editor, monaco);
  }

  function handleActivityPanel(id) {
    if (id === "explorer") { setShowExplorer(v => !v); setActiveActivityPanel("explorer"); }
    else if (id === "search") { setSearchOpen(true); setActiveActivityPanel("search"); }
    else if (id === "chat") { setShowChat(v => !v); setActiveActivityPanel(id); }
    else if (id === "terminal") { setShowTerminal(v => !v); setActiveActivityPanel(id); }
    else if (id === "users") { setShowChat(true); setActiveActivityPanel(id); }
    else if (id === "preview") {
      const next = !showPreview;
      setShowPreview(next);
      if (next) { setShowGit(false); setShowNotebook(false); setAiPanelOpen(false); setShowChat(false); }
      setActiveActivityPanel(id);
    }
    else if (id === "git") {
      const next = !showGit;
      setShowGit(next);
      if (next) { setShowPreview(false); setShowNotebook(false); setAiPanelOpen(false); setShowChat(false); }
      setActiveActivityPanel(id);
    }
    else if (id === "notebook") {
      setShowNotebook(v => !v);
      setActiveActivityPanel(id);
    }
  }

  function getJsSnippets(monaco, range) {
    const S = monaco.languages.CompletionItemKind.Snippet;
    const F = monaco.languages.CompletionItemKind.Function;
    return [
      { label: "clog", kind: S, insertText: "console.log($1);", insertTextRules: 4, documentation: "console.log()", range },
      { label: "fn", kind: S, insertText: "function ${1:name}(${2:params}) {\n\t$0\n}", insertTextRules: 4, documentation: "Function declaration", range },
      { label: "afn", kind: S, insertText: "const ${1:name} = async (${2:params}) => {\n\t$0\n};", insertTextRules: 4, documentation: "Async arrow function", range },
      { label: "imp", kind: S, insertText: "import ${1:name} from '${2:module}';", insertTextRules: 4, documentation: "Import statement", range },
      { label: "ife", kind: S, insertText: "if (${1:condition}) {\n\t$0\n}", insertTextRules: 4, documentation: "If statement", range },
      { label: "trycatch", kind: S, insertText: "try {\n\t$1\n} catch (${2:error}) {\n\t$0\n}", insertTextRules: 4, documentation: "Try/catch block", range },
      { label: "arr", kind: S, insertText: "const ${1:arr} = [${2}];", insertTextRules: 4, documentation: "Array", range },
      { label: "obj", kind: S, insertText: "const ${1:obj} = { ${2} };", insertTextRules: 4, documentation: "Object", range },
      { label: "useEffect", kind: S, insertText: "useEffect(() => {\n\t$1\n}, [$2]);", insertTextRules: 4, documentation: "React useEffect", range },
      { label: "useState", kind: S, insertText: "const [${1:state}, set${2:State}] = useState(${3:null});", insertTextRules: 4, documentation: "React useState", range },
    ];
  }

  const commands = [
    ["Save File (Ctrl+S)", saveActiveFile],
    ["Save All (Ctrl+Shift+S)", saveAllFiles],
    ["Quick Open (Ctrl+P)", () => setSearchOpen(true)],
    ["Find in File", findInFile],
    ["Global Search (Ctrl+Shift+F)", () => setSearchOpen(true)],
    ["Go to Line (Ctrl+G)", goToLine],
    ["Format Document", formatActiveFile],
    ["Toggle Auto Save", () => setAutoSave((v) => !v)],
    ["Run Active File (F5)", runCode],
    ["AI: Open Assistant (Ctrl+I)", () => setAiPanelOpen(true)],
    ["AI: Toggle Inline Ghost Suggestions", () => setInlineAiEnabled((enabled) => !enabled)],
    ["AI: Trigger Inline Suggestion (Ctrl+\\)", triggerInlineAi],
    ["AI: Complete at Cursor (Ctrl+Alt+Space)", aiCompleteAtCursor],
    ["AI: Summarize Active File", summarizeActiveFile],
    ["AI: Explain Selection/File", () => runWorkspaceAi("explain")],
    ["AI: Fix Selection/File", () => runWorkspaceAi("fix")],
    ["AI: Optimize Selection/File", () => runWorkspaceAi("optimize")],
    ["AI: Generate Tests", () => runWorkspaceAi("tests")],
    ["AI: Review File", () => runWorkspaceAi("review")],
    ["Open Local Folder", openFolderWithFileSystemAccess],
    ["Toggle Explorer (Ctrl+B)", () => setShowExplorer(v => !v)],
    ["Toggle Terminal (Ctrl+J)", () => setShowTerminal(v => !v)],
    ["Toggle Chat (Ctrl+Shift+Y)", () => setShowChat(v => !v)],
    ["Toggle Live Preview", () => handleActivityPanel("preview")],
    ["Toggle Git Panel", () => handleActivityPanel("git")],
    ["Toggle Notebook Mode", () => setShowNotebook(v => !v)],
    ["AI: Toggle Full Context Mode", () => setAiFullContext(v => !v)],
    ["AI: Toggle Diff View", () => setAiDiffMode(v => !v)],
    ["Toggle Zen Mode", () => setZenMode(v => !v)],
    ["Keyboard Shortcuts", () => setShortcutsOpen(true)],
    ["Toggle Word Wrap", () => setWordWrap(v => !v)],
    ["Toggle Minimap", () => setMinimap(v => !v)],
    ["Theme: Dark", () => setEditorTheme("vs-dark")],
    ["Theme: Light", () => setEditorTheme("vs")],
    ["Theme: High Contrast", () => setEditorTheme("hc-black")],
  ].filter(([name]) => name.toLowerCase().includes(query.toLowerCase()));

  const workspacePaths = useMemo(() => buildWorkspacePaths(files), [files]);
  const breadcrumb = useMemo(() => {
    if (!activeFile) return [];
    const path = workspacePaths[activeFile.id] || activeFile.name;
    return path.split("/");
  }, [activeFile, workspacePaths]);
  const fileItems = useMemo(() => files.filter((f) => f.type === "file"), [files]);
  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return fileItems
      .map((file) => ({ file, path: workspacePaths[file.id] || file.name }))
      .filter(({ file, path }) => path.toLowerCase().includes(q) || (file.content || "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [fileItems, query, workspacePaths]);

  if (!user || !room) return (
    <div style={{
      display: "flex", minHeight: "100vh",
      alignItems: "center", justifyContent: "center",
      background: "#050607", flexDirection: "column", gap: 16,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "2px solid #8b5cf6",
        borderTopColor: "transparent",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <span style={{ color: "#4a5c5e", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.12em" }}>LOADING WORKSPACE...</span>
    </div>
  );

  const rightPanelVisible = !zenMode && (aiPanelOpen || showChat || showPreview || showGit);
  const colLayout = [showExplorer && !zenMode && `${explorerWidth}px`, "minmax(0,1fr)", rightPanelVisible && `${rightPanelWidth}px`].filter(Boolean).join(" ");

  return (
    <main className={`ide-shell grid h-screen text-slate-200 font-sans ${zenMode ? "grid-rows-[52px_1fr]" : "grid-rows-[52px_1fr_28px]"}`}>
      {/* Header */}
      <header className="ide-topbar z-20 grid h-[52px] grid-cols-[minmax(260px,420px)_minmax(260px,1fr)_auto] items-center gap-3 px-4 select-none">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-white" title="Dashboard">
            <Menu size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-wide text-slate-200 uppercase">TEAM WORKSPACE</h1>
            <div className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px] text-slate-400">
              <span className="font-semibold text-slate-200">{room.name}</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-0.5 text-slate-500"><Hash size={8} /> {roomId.slice(0, 8)}</span>
            </div>
          </div>
          <button className="flex h-9 max-w-[160px] items-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-3 font-mono text-[12px] text-slate-300 transition hover:bg-white/[0.08]">
            <Hash size={11} className="text-slate-500" />
            <span className="truncate">{roomId.slice(0, 8)}...</span>
            <ChevronRight size={12} className="rotate-90 text-slate-500" />
          </button>
        </div>

        <button
          onClick={() => { setCommandOpen(false); setSearchOpen(true); setQuery(""); }}
          className="group flex h-9 min-w-0 items-center justify-between rounded-md border border-white/10 bg-[#24262b] px-3.5 text-left text-[14px] text-slate-400 shadow-inner transition hover:border-white/20 hover:bg-[#2d3036] hover:text-slate-200"
          title="Quick Open"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search size={14} className="shrink-0 text-slate-500 group-hover:text-slate-300" />
            <span className="truncate">Search files, symbols, commands...</span>
          </span>
          <span className="ml-3 shrink-0 rounded border border-white/10 bg-black/25 px-2 py-0.5 font-mono text-[11px] text-slate-500">Ctrl P</span>
        </button>
        
        <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden">
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/dashboard?join=${roomId}`).then(() => toast.success("Invite link copied!")); }} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/[0.09] lg:inline-flex">
            <Copy size={13} className="text-slate-400" /> Invite
          </button>
          <button onClick={openFolderWithFileSystemAccess} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/[0.09] 2xl:inline-flex">
            <RefreshCw size={13} className="text-slate-400" /> Sync Folder
          </button>
          <button onClick={saveAllFiles} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/[0.09] xl:inline-flex">
            <Download size={13} className="text-slate-400" /> Save All
          </button>
          <button onClick={saveActiveFile} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#6fb982] px-4 text-[13px] font-semibold uppercase text-[#07110b] transition hover:bg-[#84c792]">
            <Save size={13} /> Save
          </button>
        </div>
      </header>

      {/* Workspace body */}
      <div className="flex min-h-0 overflow-hidden bg-[#121316]">
        {/* Activity Bar */}
        {!zenMode && (
          <ActivityBar
            activePanel={activeActivityPanel}
            onPanelToggle={handleActivityPanel}
            onShortcuts={() => setShortcutsOpen(true)}
            onSettings={() => setCommandOpen(true)}
            dirtyCount={Object.keys(dirtyFiles).length}
            userCount={users.length}
          />
        )}

        {/* Panels grid */}
        <div className="min-h-0 flex-1" style={{ display: "grid", gridTemplateColumns: colLayout, overflow: "hidden", height: "100%" }}>
          {/* Explorer */}
          {showExplorer && !zenMode && (
            <div className="relative overflow-hidden border-r border-white/10 shadow-2xl shadow-black/20" style={{ height: "100%" }}>
              <FileExplorer files={files} activeFile={activeFile} onSelect={selectFile} onCreate={createFile} onImportFolder={importFolder} onDelete={deleteFile} onRename={renameFile} onMove={moveFile} localHandles={localHandles} />
              <div
                className="absolute right-0 top-0 z-30 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-[#6fb982]/50"
                onMouseDown={(event) => beginPanelResize("explorer", event)}
                title="Drag to resize explorer"
              />
            </div>
          )}

          {/* Editor column */}
          <div className="flex min-w-0 flex-col min-h-0 overflow-hidden border-x border-white/10 bg-[#1f2024] shadow-2xl shadow-black/20">
            {/* VS Code style menu bar */}
            {!zenMode && (
              <div className="flex h-[46px] shrink-0 items-center gap-3 overflow-hidden border-b border-white/10 bg-[#1b1d22] px-3">
                <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap pr-2 text-[14px] text-slate-200">
                  {["File", "Edit", "View", "Go", "Run", "Terminal", "Help"].map((item) => (
                    <button key={item} className="transition hover:text-white">{item}</button>
                  ))}
                  <span className="h-5 w-px bg-white/10" />
                  <button onClick={runCode} className="flex items-center gap-1.5 text-slate-200 transition hover:text-white">
                    <Play size={14} /> Run
                  </button>
                  <button onClick={() => setAiPanelOpen(true)} className="flex items-center gap-1.5 text-slate-200 transition hover:text-white">
                    <Bot size={14} /> AI Assistant
                  </button>
                  <button onClick={() => setInlineAiEnabled((enabled) => !enabled)} className={`flex items-center gap-1.5 transition ${inlineAiEnabled ? "text-slate-100" : "text-slate-500"}`}>
                    <Wand2 size={14} /> Inline AI
                  </button>
                  <button onClick={() => handleActivityPanel("git")} className="flex items-center gap-1.5 text-slate-200 transition hover:text-white">
                    <GitBranch size={14} /> Git
                  </button>
                  <button onClick={saveAllFiles} className="flex items-center gap-1.5 text-slate-200 transition hover:text-white">
                    <RefreshCw size={14} /> Sync
                  </button>
                  <button onClick={saveActiveFile} className="rounded bg-[#6fb982] px-2.5 py-1 text-[13px] font-semibold text-[#07110b] transition hover:bg-[#84c792]">
                    Save
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-slate-400">
                  <button onClick={() => setMinimap(v => !v)} className="rounded p-1 transition hover:bg-white/10 hover:text-white" title="Toggle minimap"><PanelRight size={15} /></button>
                  <button onClick={() => setCommandOpen(true)} className="rounded p-1 transition hover:bg-white/10 hover:text-white" title="More"><MoreHorizontal size={16} /></button>
                </div>
              </div>
            )}

            {/* Breadcrumb */}
            {activeFile && !zenMode && (
              <div className="scrollbar-thin flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 bg-[#1a1c21] px-4 py-2 font-mono text-[12px] text-slate-500 select-none">
                {breadcrumb.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <ChevronRight size={8} className="text-slate-600" />}
                    <span className={i === breadcrumb.length - 1 ? "font-bold text-[#b7c9bd]" : "transition hover:text-slate-300"}>{seg}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="ide-tabbar scrollbar-thin flex shrink-0 items-center overflow-x-auto border-b text-xs select-none">
              {openTabs.length ? openTabs.map((fileId) => {
                const file = files.find((f) => f.id === fileId);
                if (!file) return null;
                const dirty = dirtyFiles[fileId];
                const isActive = activeFile?.id === fileId;
                return (
                  <button key={fileId} className={`group relative flex h-10 min-w-36 shrink-0 items-center justify-between border-r border-slate-700/20 px-4 font-mono text-[13px] transition ${isActive ? "ide-tab-active font-semibold" : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-100"}`}
                    onClick={() => selectFile(file)}
                    onContextMenu={(e) => { e.preventDefault(); setTabMenu({ x: e.clientX, y: e.clientY, fileId }); }}>
                    {isActive && <span className="absolute inset-x-0 top-0 h-0.5 bg-[#6fb982]" />}
                    <span className="truncate pr-2.5 flex items-center gap-1.5">
                      {dirty && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#6fb982]" />}
                      {file.name}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); closeTab(fileId); }} className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100 transition">
                      <X size={9} />
                    </button>
                  </button>
                );
              }) : <span className="px-4 text-slate-500 italic font-mono text-[10px]">No active buffers</span>}
            </div>

            {/* Editor or Notebook */}
            <div className="ide-editor-frame flex-1 min-h-0">
              {showNotebook && activeFile ? (
                <NotebookView
                  activeFile={activeFile}
                  onContentChange={(content) => {
                    updateContent(content);
                  }}
                />
              ) : activeFile ? (
                <MonacoEditor
                  key={activeFile.id}
                  height="100%"
                  theme={editorTheme}
                  language={activeFile.language}
                  defaultValue={activeFile.content || ""}
                  onChange={(value) => updateContent(value || "")}
                  onMount={onEditorMount}
                  options={{
                    fontSize,
                    fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                    fontLigatures: true,
                    wordWrap: wordWrap ? "on" : "off",
                    minimap: { enabled: minimap },
                    lineNumbers,
                    tabSize: indentSize,
                    automaticLayout: true,
                    bracketPairColorization: { enabled: true },
                    formatOnPaste: true,
                    formatOnType: true,
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: { other: true, comments: false, strings: true },
                    inlineSuggest: { enabled: inlineAiEnabled, showToolbar: "onHover", mode: "prefix" },
                    parameterHints: { enabled: true },
                    hover: { enabled: true, delay: 300 },
                    stickyScroll: { enabled: stickyScroll },
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on",
                    renderLineHighlight: "all",
                    renderWhitespace: "selection",
                    guides: { indentation: true, bracketPairs: true },
                    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                    padding: { top: 8 },
                    snippetSuggestions: "top",
                    suggest: { showSnippets: true, showKeywords: true, showFunctions: true, filterGraceful: true },
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-[#0b1015] p-8 text-center select-none">
                  <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#6fb982]/15 bg-[#6fb982]/5 text-[#b7c9bd] ">
                    <Code2Icon size={22} />
                  </span>
                  <h3 className="text-base font-black uppercase tracking-widest text-slate-200">Workspace Standby</h3>
                  <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-slate-500">Select or create a file in the explorer to start coding.</p>
                  <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-700/20 bg-black/20 p-5 text-left font-mono text-[10px] text-slate-500">
                    <div className="flex justify-between gap-12"><span className="text-slate-600">Quick Open</span><span className="text-[#9ed4aa]">Ctrl+P</span></div>
                    <div className="flex justify-between gap-12"><span className="text-slate-600">Commands</span><span className="text-[#9ed4aa]">Ctrl+Shift+P</span></div>
                    <div className="flex justify-between gap-12"><span className="text-slate-600">Global Search</span><span className="text-[#9ed4aa]">Ctrl+Shift+F</span></div>
                    <div className="flex justify-between gap-12"><span className="text-slate-600">AI Assistant</span><span className="text-[#9ed4aa]">Ctrl+I</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal */}
            {showTerminal && (
              <>
                <div
                  className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center bg-[#15171b] hover:bg-[#6fb982]/5"
                  onMouseDown={() => {
                    terminalResizeRef.current = true;
                    document.body.style.cursor = "row-resize";
                    document.body.style.userSelect = "none";
                  }}
                  title="Drag to resize terminal"
                >
                  <span className="h-0.5 w-12 rounded-full bg-slate-600/70 transition group-hover:bg-[#6fb982]/70" />
                </div>
                <OutputPanel activeFile={activeFile} output={output} running={running} stdin={stdin} onStdinChange={setStdin} onRun={runCode} onStop={stopRun} socket={socket} roomId={roomId} height={terminalHeight} />
              </>
            )}
          </div>

          {/* Right rail: AI or Chat */}
          {rightPanelVisible && (
            <div className="relative flex min-h-0 overflow-hidden border-l border-white/10 bg-[#181a1f] shadow-2xl shadow-black/25">
              <div
                className="absolute left-0 top-0 z-30 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-[#6fb982]/50"
                onMouseDown={(event) => beginPanelResize("right", event)}
                title="Drag to resize side panel"
              />
              {showPreview ? (
                <LivePreview activeFile={activeFile} files={files} className="w-full" />
              ) : showGit ? (
                <GitPanel roomId={roomId} socket={socket} />
              ) : aiPanelOpen ? (
                <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#181a1f]">
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-700/25 bg-white/[0.025] px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-100">
                        <Bot size={14} className="text-[#9ed4aa]" /> Aether AI
                      </h2>
                      <p className="mt-1 truncate font-mono text-[9px] text-slate-500">
                        {aiBusy ? "Thinking..." : aiLastModel ? `model: ${aiLastModel}` : "Tab accepts inline suggestions"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setAiPanelOpen(false); setShowChat(true); }}
                        className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition hover:bg-white/5 hover:text-[#b7c9bd]"
                      >
                        Chat
                      </button>
                      <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white" onClick={() => setAiPanelOpen(false)}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="shrink-0 border-b border-slate-700/20 p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <button disabled={aiBusy || !activeFile} onClick={aiCompleteAtCursor} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><Wand2 size={12} /> Complete</button>
                      <button disabled={aiBusy || !activeFile} onClick={summarizeActiveFile} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><Hash size={12} /> Summary</button>
                      <button disabled={aiBusy || !activeFile} onClick={() => runWorkspaceAi("explain")} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><FileCode2 size={12} /> Explain</button>
                      <button disabled={aiBusy || !activeFile} onClick={() => runWorkspaceAi("fix")} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><Bug size={12} /> Fix</button>
                      <button disabled={aiBusy || !activeFile} onClick={() => runWorkspaceAi("optimize")} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><Gauge size={12} /> Optimize</button>
                      <button disabled={aiBusy || !activeFile} onClick={() => runWorkspaceAi("tests")} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><TestTube2 size={12} /> Tests</button>
                      <button disabled={aiBusy || !activeFile} onClick={() => runWorkspaceAi("review")} className="ide-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold transition disabled:opacity-40"><Search size={12} /> Review</button>
                    </div>
                  </div>

                  <div className="shrink-0 border-b border-slate-700/20 p-3">
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ask about the active file, selected code, bugs, approach, complexity..."
                      className="ide-input h-20 w-full resize-none rounded-2xl p-3 text-xs leading-relaxed outline-none placeholder:text-slate-600"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button disabled={aiBusy || !activeFile || !aiPrompt.trim()} onClick={() => runWorkspaceAi("ask", aiPrompt)} className="ide-primary inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40">
                        <Sparkles size={12} /> Ask AI
                      </button>
                      {aiBusy && (
                        <button onClick={() => aiAbortRef.current?.abort?.()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-bold uppercase text-red-300">
                          <Square size={10} /> Stop
                        </button>
                      )}
                    </div>
                    {/* AI Options row */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setAiFullContext(v => !v)}
                        title="Include full file contents in AI context (better answers, slower)"
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition ${
                          aiFullContext ? "border border-[#6fb982]/30 bg-[#6fb982]/10 text-[#9ed4aa]" : "border border-white/10 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <FileCode2 size={9} /> Full Context
                      </button>
                      <button
                        onClick={() => setAiDiffMode(v => !v)}
                        title="Show diff view for fix/optimize/refactor results"
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition ${
                          aiDiffMode ? "border border-[#6fb982]/30 bg-[#6fb982]/10 text-[#9ed4aa]" : "border border-white/10 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <GitBranch size={9} /> Diff View
                      </button>
                    </div>
                  </div>

                  <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-3">
                    {aiError ? (
                      <pre className="whitespace-pre-wrap rounded-2xl border border-red-500/20 bg-red-500/10 p-3 font-mono text-[11px] leading-relaxed text-red-200">{aiError}</pre>
                    ) : aiBusy ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#6fb982] border-t-transparent" />
                        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Aether AI is reading your workspace</p>
                      </div>
                    ) : aiResult && aiDiffMode && ["fix", "optimize", "refactor"].includes(aiMode) ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 text-[9px] uppercase tracking-wider text-slate-500">
                          <span className="flex-1 rounded bg-red-500/10 px-2 py-1 text-red-400">Original</span>
                          <span className="flex-1 rounded bg-green-500/10 px-2 py-1 text-green-400">AI Result</span>
                        </div>
                        <div className="flex gap-2 min-h-0">
                          <pre className="flex-1 overflow-auto rounded-xl border border-red-500/15 bg-red-500/5 p-3 font-mono text-[10px] leading-relaxed text-slate-400">{activeFile?.content || ""}</pre>
                          <pre className="flex-1 overflow-auto rounded-xl border border-green-500/15 bg-green-500/5 p-3 font-mono text-[10px] leading-relaxed text-slate-200">{aiResult}</pre>
                        </div>
                      </div>
                    ) : aiResult ? (
                      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-700/25 bg-black/25 p-4 font-mono text-[11px] leading-relaxed text-slate-200 shadow-inner">{aiResult}</pre>
                    ) : (
                      <div className="flex h-full flex-col justify-center gap-4 text-center text-slate-500">
                        <Sparkles size={28} className="mx-auto text-[#9ed4aa]/80" />
                        <div>
                          <p className="text-xs font-bold text-slate-300">AI help is docked beside your code.</p>
                          <p className="mt-2 text-[10px] leading-relaxed">Use Complete for cursor inserts, or Fix and Optimize for patches you can apply. Enable Diff View to compare changes side by side.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 border-t border-slate-700/20 bg-black/15 p-3">
                    <button disabled={!aiCanApply || !aiResult.trim()} onClick={applyAiResult} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#6fb982]/30 bg-[#6fb982]/10 px-3 text-[10px] font-black uppercase tracking-wider text-[#b7c9bd] transition hover:bg-[#6fb982]/15 disabled:cursor-not-allowed disabled:opacity-40">
                      <Wand2 size={12} /> Apply
                    </button>
                    <button disabled={!aiResult.trim()} onClick={sendAiResultToChat} className="ide-button inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40">
                      <MessageSquarePlus size={12} /> Chat
                    </button>
                    <button disabled={!aiResult.trim()} onClick={() => navigator.clipboard.writeText(aiResult).then(() => toast.success("AI result copied"))} className="ide-button inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40">
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </aside>
              ) : (
                <ChatPanel
                  messages={messages}
                  users={users}
                  typingUsers={typingUsers}
                  onSend={sendMessage}
                  voiceSlot={
                    <VoiceChat
                      socket={socket}
                      roomId={roomId}
                      currentUser={user}
                    />
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {!zenMode && (
        <footer className="ide-status z-20 flex h-[28px] items-center justify-between px-4 font-mono text-[11px] text-slate-400 select-none">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6fb982]" />{users.length} Peer{users.length !== 1 ? "s" : ""}</span>
            <span className="h-3 w-[1px] bg-line/60" />
            <button className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${autoSave ? "border border-[#6fb982]/20 bg-[#6fb982]/10 text-[#b7c9bd]" : "border border-slate-700/30 bg-slate-900 text-slate-500"}`} onClick={() => setAutoSave(v => !v)}>Auto Save {autoSave ? "On" : "Off"}</button>
            {localSyncStatus === "connected" && (
              <><span className="h-3 w-[1px] bg-line/60" /><span className="flex items-center gap-1 text-accent"><HardDrive size={10} />Synced: {localDirName}<button className="ml-1.5 hover:text-red-400 transition" onClick={disconnectLocalFolder}>(disconnect)</button></span></>
            )}
            {localSyncStatus === "needs-permission" && (
              <><span className="h-3 w-[1px] bg-line/60" /><button className="flex items-center gap-1 rounded bg-yellow-600/20 px-1.5 py-0.5 text-[8px] text-yellow-400 border border-yellow-600/30 font-bold uppercase tracking-wide" onClick={reconnectLocalFolder}><FolderOpen size={10} />Reconnect FS</button></>
            )}
          </span>
          <span className="flex items-center gap-3">
            {activeFile && (
              <>
                <span id="footer-cursor-pos">Ln {cursorPosRef.current.line}, Col {cursorPosRef.current.col}</span>
                <span className="h-3 w-[1px] bg-line/60" />
                <span>{indentSize} spaces</span>
                <span className="h-3 w-[1px] bg-line/60" />
                <span className="font-bold uppercase tracking-wider text-[#9ed4aa]">{activeFile.language}</span>
              </>
            )}
          </span>
        </footer>
      )}

      {/* Floating neon "1 Issue" badge at bottom-left */}
      <div className="fixed bottom-10 left-4 z-50 flex items-center gap-2 rounded-full border border-[#6fb982] bg-[#17181c] px-3.5 py-1.5 ">
        <span className="flex h-2 w-2 relative">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6fb982]"></span>
        </span>
        <span className="font-mono text-[10px] font-bold text-[#b7c9bd] tracking-wider">1 ISSUE</span>
      </div>

      {/* Modals & Menus */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div className="glass-card w-[520px] rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-700/20 pb-3">
              <Search size={14} className="text-[#9ed4aa]" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full bg-transparent text-xs text-white outline-none"
              />
            </div>
            <div className="mt-3 max-h-60 overflow-y-auto pr-1">
              {searchResults.length ? searchResults.map(({ file, path }) => (
                <button
                  key={file.id}
                  onClick={() => { selectFile(file); setSearchOpen(false); }}
                  className="flex w-full flex-col gap-1 rounded-xl p-2.5 text-left transition hover:bg-[#6fb982]/10 hover:text-[#9ed4aa]"
                >
                  <span className="font-mono text-xs">{file.name}</span>
                  <span className="font-mono text-[9px] text-slate-500">{path}</span>
                </button>
              )) : (
                <div className="py-6 text-center text-[10px] font-mono text-slate-600">No matching files</div>
              )}
            </div>
          </div>
        </div>
      )}

      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 backdrop-blur-sm" onClick={() => setCommandOpen(false)}>
          <div className="glass-card w-[520px] rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-700/20 pb-3">
              <Command size={14} className="text-[#9ed4aa]" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command..."
                className="w-full bg-transparent text-xs text-white outline-none"
              />
            </div>
            <div className="mt-3 max-h-60 overflow-y-auto pr-1">
              {commands.length ? commands.map(([name, action], i) => (
                <button
                  key={i}
                  onClick={() => { action(); setCommandOpen(false); }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-mono text-xs text-slate-300 transition hover:bg-[#6fb982]/10 hover:text-[#9ed4aa]"
                >
                  <span>{name}</span>
                </button>
              )) : (
                <div className="py-6 text-center text-[10px] font-mono text-slate-600">No matching commands</div>
              )}
            </div>
          </div>
        </div>
      )}

      {shortcutsOpen && <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />}
      
      {tabMenu && (
        <div className="fixed z-50 w-44 rounded-xl border border-white/10 bg-[#1b1d22] p-1 shadow-2xl" style={{ top: tabMenu.y, left: tabMenu.x }} onMouseLeave={() => setTabMenu(null)}>
          <button onClick={() => { closeTab(tabMenu.fileId); setTabMenu(null); }} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-[#6fb982]/10 hover:text-[#9ed4aa]">Close Tab</button>
          <button onClick={() => { setOpenTabs((tabs) => tabs.filter((id) => id === tabMenu.fileId)); setActiveFile(files.find((f) => f.id === tabMenu.fileId)); setTabMenu(null); }} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-[#6fb982]/10 hover:text-[#9ed4aa]">Close Other Tabs</button>
          <button onClick={() => { setOpenTabs([]); setActiveFile(null); setTabMenu(null); }} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-[#6fb982]/10 hover:text-[#9ed4aa]">Close All Tabs</button>
        </div>
      )}
    </main>
  );
}

function buildWorkspacePaths(items) {
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  const paths = {};
  function pathFor(item) {
    if (paths[item.id]) return paths[item.id];
    if (!item.parentId || !byId[item.parentId]) { paths[item.id] = item.name; return paths[item.id]; }
    paths[item.id] = `${pathFor(byId[item.parentId])}/${item.name}`;
    return paths[item.id];
  }
  items.forEach(pathFor);
  return paths;
}

