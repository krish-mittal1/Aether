"use client";

import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Pencil,
  Search,
  Trash2,
  X,
  Code
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function buildTree(files) {
  const byParent = {};
  files.forEach((f) => {
    const key = f.parentId || "root";
    byParent[key] = byParent[key] || [];
    byParent[key].push(f);
  });
  const walk = (parent = "root") => (byParent[parent] || [])
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1))
    .map((node) => ({ ...node, children: walk(node.id) }));
  return walk();
}

function findNode(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node;
    const child = findNode(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function getFileIconStyles(name, isFolder, isOpen) {
  if (isFolder) {
    return {
      Icon: isOpen ? FolderOpen : Folder,
      colorClass: "text-[#cccccc]"
    };
  }
  
  return { Icon: File, colorClass: "text-[#cccccc]" };
}

function TreeNode({
  node,
  depth,
  activeFileId,
  selectedFolderId,
  expanded,
  onToggle,
  onSelectFile,
  onSelectFolder,
  onStartCreate,
  onContextMenu,
  onMove,
  onDelete,
  onRename,
  localHandles = {},
  onStartRename,
  onStartDelete,
}) {
  const isFolder = node.type === "folder";
  const isOpen = expanded[node.id] ?? true;
  const isActive = activeFileId === node.id;
  const isSelectedFolder = selectedFolderId === node.id;
  
  const { Icon: FileIcon, colorClass } = getFileIconStyles(node.name, isFolder, isOpen);

  return (
    <div>
      <div
        className={`group flex h-[22px] items-center gap-1 text-[13px] transition-none ${
          isActive
            ? "text-white border-l-2 border-[#007acc]"
            : isSelectedFolder
              ? "text-[#cccccc]"
              : "text-[#cccccc]"
        }`}
        style={{
          paddingLeft: `${depth * 12 + (isActive ? 2 : 4)}px`,
          background: isActive ? "#094771" : undefined,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#2a2d2e"; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ""; }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node);
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-workspace-file", node.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (isFolder) e.preventDefault();
        }}
        onDrop={(e) => {
          const fileId = e.dataTransfer.getData("application/x-workspace-file");
          if (fileId && isFolder && fileId !== node.id) {
            e.preventDefault();
            onMove(fileId, node.id);
          }
        }}
      >
        {isFolder ? (
          <button className="p-0.5 text-[#858585] hover:text-[#cccccc]" onClick={() => onToggle(node.id)} title={isOpen ? "Collapse" : "Expand"}>
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-mono"
          onClick={() => isFolder ? onSelectFolder(node.id) : onSelectFile(node)}
          onDoubleClick={() => isFolder && onToggle(node.id)}
          title={node.name}
        >
          <FileIcon size={13} className={`${colorClass} shrink-0`} />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          
          {/* Disk icon when file is linked to local filesystem */}
          {!isFolder && localHandles[node.id] && (
            <HardDrive size={10} className="shrink-0 text-[#8fb39b]" title="Synced to local disk" />
          )}
        </button>

        {/* Tree item inline actions */}
        <div className="hidden items-center gap-0 group-hover:flex pr-1">
          {isFolder && (
            <>
              <button className="p-0.5 text-[#858585] hover:text-white" title="New file" onClick={() => onStartCreate("file", node.id)}>
                <FilePlus size={11} />
              </button>
              <button className="p-0.5 text-[#858585] hover:text-white" title="New folder" onClick={() => onStartCreate("folder", node.id)}>
                <FolderPlus size={11} />
              </button>
            </>
          )}
          <button className="p-0.5 text-[#858585] hover:text-white" title="Rename" onClick={() => onStartRename(node)}>
            <Pencil size={11} />
          </button>
          <button className="p-0.5 text-[#858585] hover:text-red-400" title="Delete" onClick={() => onStartDelete(node)}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Visual lines for child directories */}
      {isFolder && isOpen && (
        <div className="relative ml-3 border-l border-[#3c3c3c] pl-1.5">
          {node.children?.length ? node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth}
              activeFileId={activeFileId}
              selectedFolderId={selectedFolderId}
              expanded={expanded}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onSelectFolder={onSelectFolder}
              onStartCreate={onStartCreate}
              onContextMenu={onContextMenu}
              onMove={onMove}
              onDelete={onDelete}
              onRename={onRename}
              localHandles={localHandles}
              onStartRename={onStartRename}
              onStartDelete={onStartDelete}
            />
          )) : (
            <div className="py-0.5 text-[10px] text-slate-600 font-mono pl-4 italic">
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ files, activeFile, onSelect, onCreate, onImportFolder, onDelete, onRename, onMove, localHandles = {} }) {
  const [filter, setFilter] = useState("");
  const tree = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return buildTree(files);
    const keep = new Set();
    const byId = Object.fromEntries(files.map((file) => [file.id, file]));
    files.forEach((file) => {
      if (file.name.toLowerCase().includes(q) || (file.content || "").toLowerCase().includes(q)) {
        let current = file;
        while (current) {
          keep.add(current.id);
          current = current.parentId ? byId[current.parentId] : null;
        }
      }
    });
    return buildTree(files.filter((file) => keep.has(file.id)));
  }, [files, filter]);
  const [expanded, setExpanded] = useState({});
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [creator, setCreator] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [renameNode, setRenameNode] = useState(null); // { node, value }
  const [deleteNode, setDeleteNode] = useState(null); // node to confirm delete
  const selectedFolder = selectedFolderId ? findNode(tree, selectedFolderId) : null;

  useEffect(() => {
    setExpanded((current) => {
      const next = { ...current };
      files.filter((f) => f.type === "folder").forEach((folder) => {
        if (next[folder.id] === undefined) next[folder.id] = true;
      });
      return next;
    });
  }, [files]);

  function startCreate(type, parentId = selectedFolderId) {
    setCreator({ type, parentId: parentId || null, name: type === "folder" ? "new-folder" : "new-file.js" });
    if (parentId) setExpanded((current) => ({ ...current, [parentId]: true }));
  }

  function submitCreate(e) {
    e.preventDefault();
    if (!creator?.name.trim()) return;
    onCreate({
      name: creator.name.trim(),
      type: creator.type,
      parentId: creator.parentId,
      language: inferLanguage(creator.name.trim())
    });
    setCreator(null);
  }

  function selectFolder(folderId) {
    setSelectedFolderId(folderId);
    setCreator(null);
  }

  async function openFolderPicker() {
    if (window.showDirectoryPicker) {
      try {
        const root = await window.showDirectoryPicker({ mode: "read" });
        const allFiles = [];
        async function walk(dir, prefix) {
          for await (const [name, handle] of dir.entries()) {
            if (handle.kind === "directory") {
              await walk(handle, `${prefix}${name}/`);
            } else {
              const file = await handle.getFile();
              Object.defineProperty(file, "webkitRelativePath", { value: `${prefix}${name}` });
              allFiles.push(file);
            }
          }
        }
        await walk(root, "");
        if (allFiles.length) onImportFolder(allFiles);
      } catch {
        // user cancelled
      }
    } else {
      // fallback for Firefox
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.setAttribute("webkitdirectory", "");
      input.onchange = (e) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length) onImportFolder(selected);
      };
      input.click();
    }
  }

  // Handle right-click context menu positioning
  function handleContextMenu(e, node) {
    setMenu({ x: e.clientX, y: e.clientY, node });
  }

  function menuAction(action) {
    const node = menu?.node;
    setMenu(null);
    if (!node) return;
    if (action === "new-file") startCreate("file", node.type === "folder" ? node.id : node.parentId);
    if (action === "new-folder") startCreate("folder", node.type === "folder" ? node.id : node.parentId);
    if (action === "rename") setRenameNode({ node, value: node.name });
    if (action === "delete") setDeleteNode(node);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const movingId = e.dataTransfer?.getData("application/x-workspace-file");
    if (movingId) {
      onMove(movingId, null);
      return;
    }
    const items = Array.from(e.dataTransfer?.items || []);
    if (!items.length) return;
    const filesFromEntries = await collectDroppedFiles(items);
    if (filesFromEntries.length) onImportFolder(filesFromEntries);
  }

  return (
    <aside
      style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
      className={`ide-panel relative border-r transition duration-200 select-none ${dragOver ? "ring-2 ring-inset ring-[#8fb39b]/30 bg-[#8fb39b]/[0.03]" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => menu && setMenu(null)}
    >
      {/* Explorer Header */}
      <div className="flex h-[35px] shrink-0 items-center justify-between border-b px-3" style={{ borderColor: "#3c3c3c" }}>
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#bbbbbb]">Explorer</span>
        <div className="flex items-center gap-0">
          <button className="p-1 text-[#858585] hover:text-[#cccccc]" title="Link local folder" onClick={openFolderPicker}>
            <FolderInput size={14} />
          </button>
          <button className="p-1 text-[#858585] hover:text-[#cccccc]" title="New file" onClick={() => startCreate("file")}>
            <FilePlus size={14} />
          </button>
          <button className="p-1 text-[#858585] hover:text-[#cccccc]" title="New folder" onClick={() => startCreate("folder")}>
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="border-b px-2 py-1.5" style={{ borderColor: "#3c3c3c" }}>
        <label className="flex h-[22px] items-center gap-1.5 border bg-[#3c3c3c] px-2" style={{ borderColor: "#3c3c3c" }}>
          <Search size={11} className="shrink-0 text-[#858585]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search files..."
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#cccccc] outline-none placeholder:text-[#858585]"
          />
        </label>
      </div>

      {/* Target directory feedback indicator */}
      {selectedFolderId && (
        <div className="flex items-center justify-between border-b px-3 py-1 font-mono text-[11px] text-[#858585]" style={{ borderColor: "#3c3c3c", background: "#252526" }}>
          <span>Scope: <span className="text-[#cccccc]">{selectedFolder?.name}</span></span>
          <button className="text-[#858585] hover:text-white" onClick={() => selectFolder(null)}>(reset)</button>
        </div>
      )}

      {/* Creation form */}
      {creator && (
        <form onSubmit={submitCreate} className="border-b px-2 py-1" style={{ borderColor: "#3c3c3c", background: "#252526" }}>
          <div className="flex h-[22px] items-center gap-1.5 border bg-[#3c3c3c] px-2" style={{ borderColor: "#007acc" }}>
            {creator.type === "folder" ? <FolderPlus size={11} className="text-[#007acc]" /> : <FilePlus size={11} className="text-[#007acc]" />}
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-white outline-none placeholder-[#858585]"
              value={creator.name}
              onChange={(e) => setCreator({ ...creator, name: e.target.value })}
              onKeyDown={(e) => e.key === "Escape" && setCreator(null)}
              placeholder={`new-${creator.type}`}
            />
            <button type="button" className="text-[#858585] hover:text-white" onClick={() => setCreator(null)}>
              <X size={10} />
            </button>
          </div>
        </form>
      )}

      {/* File Tree List */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-1">
        {tree.length ? tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            activeFileId={activeFile?.id}
            selectedFolderId={selectedFolderId}
            expanded={expanded}
            onToggle={(id) => setExpanded((current) => ({ ...current, [id]: !(current[id] ?? true) }))}
            onSelectFile={onSelect}
            onSelectFolder={selectFolder}
            onStartCreate={startCreate}
            onContextMenu={handleContextMenu}
            onMove={onMove}
            onDelete={onDelete}
            onRename={onRename}
            localHandles={localHandles}
            onStartRename={(node) => setRenameNode({ node, value: node.name })}
            onStartDelete={(node) => setDeleteNode(node)}
          />
        )) : (
          <div className="mx-2 border border-dashed p-6 text-center font-mono text-[12px] text-[#858585]" style={{ borderColor: "#3c3c3c" }}>
            Empty Workspace
          </div>
        )}
      </div>

      {/* Drag & Drop Overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-[#007acc] text-[11px] font-bold uppercase tracking-wider text-[#cccccc]" style={{ background: "rgba(0,122,204,0.06)" }}>
          Drop folder to import
        </div>
      )}

      {/* Rename Modal */}
      {renameNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs border shadow-2xl overflow-hidden" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
            <div className="border-b px-4 py-2 text-[11px] font-bold text-[#cccccc] uppercase tracking-wider" style={{ borderColor: "#3c3c3c" }}>Rename Item</div>
            <form className="p-4" onSubmit={(e) => { e.preventDefault(); const v = renameNode.value.trim(); if (v) onRename(renameNode.node, v); setRenameNode(null); }}>
              <input
                autoFocus
                className="w-full border bg-[#3c3c3c] px-3 py-2 font-mono text-[12px] text-white outline-none focus:border-[#007acc]"
                style={{ borderColor: "#3c3c3c" }}
                value={renameNode.value}
                onChange={(e) => setRenameNode({ ...renameNode, value: e.target.value })}
                onKeyDown={(e) => e.key === "Escape" && setRenameNode(null)}
              />
              <div className="mt-3 flex justify-end gap-2 text-[12px]">
                <button type="button" onClick={() => setRenameNode(null)} className="border px-3 py-1.5 text-[#cccccc] hover:text-white transition" style={{ borderColor: "#3c3c3c", background: "transparent" }}>Cancel</button>
                <button type="submit" className="px-3 py-1.5 font-bold text-white transition" style={{ background: "#0e639c" }}>Rename</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xs border shadow-2xl overflow-hidden" style={{ background: "#252526", borderColor: "#3c3c3c" }}>
            <div className="border-b px-4 py-2 text-[11px] font-bold text-red-400 uppercase tracking-wider" style={{ borderColor: "#3c3c3c" }}>Delete confirmation</div>
            <div className="p-4">
              <p className="text-[12px] text-[#858585] leading-relaxed">
                Permanently delete <span className="font-mono text-white font-bold">"{deleteNode.name}"</span>? This cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2 text-[12px]">
                <button onClick={() => setDeleteNode(null)} className="border px-3 py-1.5 text-[#cccccc] hover:text-white transition" style={{ borderColor: "#3c3c3c", background: "transparent" }}>Cancel</button>
                <button onClick={() => { onDelete(deleteNode); setDeleteNode(null); }} className="px-3 py-1.5 font-bold text-white transition" style={{ background: "#c72e2e" }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export function inferLanguage(name) {
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".cpp") || name.endsWith(".cc") || name.endsWith(".cxx")) return "cpp";
  if (name.endsWith(".java")) return "java";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".sh")) return "shell";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".go")) return "go";
  return "javascript";
}

async function collectDroppedFiles(items) {
  const files = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      await walkEntry(entry, "", files);
    } else {
      const file = item.getAsFile?.();
      if (file) files.push(file);
    }
  }
  return files;
}

function walkEntry(entry, prefix, out) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        Object.defineProperty(file, "webkitRelativePath", { value: `${prefix}${file.name}` });
        out.push(file);
        resolve();
      }, () => resolve());
      return;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) return resolve();
          for (const child of entries) await walkEntry(child, `${prefix}${entry.name}/`, out);
          readBatch();
        }, () => resolve());
      };
      readBatch();
      return;
    }
    resolve();
  });
}
