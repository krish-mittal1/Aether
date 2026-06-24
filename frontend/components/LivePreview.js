"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, Maximize2, Minimize2, RefreshCw } from "lucide-react";

const PREVIEWABLE = ["html", "css", "javascript"];

function buildSrcdoc(activeFile, files) {
  if (!activeFile) return "";
  const content = activeFile.content || "";
  const lang = activeFile.language;

  if (lang === "html") {
    const cssFiles = files.filter((f) => f.language === "css" && f.content && f.type === "file");
    let html = content;
    if (cssFiles.length) {
      const injection = cssFiles
        .map((f) => `<style>/* ${f.name} */\n${f.content}</style>`)
        .join("\n");
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${injection}\n</head>`);
      } else {
        html = `${injection}\n${html}`;
      }
    }
    return html;
  }

  if (lang === "css") {
    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#1a1a1a;background:#f8f8f8}
  .preview-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.12em;margin-bottom:20px;font-family:monospace}
  *{box-sizing:border-box}
</style>
<style>${content}</style>
</head>
<body>
  <p class="preview-label">CSS Preview — sample elements</p>
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <h3>Heading 3</h3>
  <p>A paragraph with some <strong>bold</strong> and <em>italic</em> text, a <a href="#">link</a>, and <code>inline code</code>.</p>
  <button>Default Button</button>&nbsp;<button class="primary btn">Primary</button>&nbsp;<button class="secondary btn">Secondary</button>
  <br/><br/>
  <input type="text" placeholder="Text input" />&nbsp;
  <input type="checkbox" id="cb"/><label for="cb"> Checkbox</label>
  <ul><li>List item one</li><li>List item two</li><li>List item three</li></ul>
  <div class="card box container" style="margin-top:16px;padding:16px">A div.card.box.container</div>
  <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Row 1</td><td>100</td></tr><tr><td>Row 2</td><td>200</td></tr></tbody></table>
</body></html>`;
  }

  if (lang === "javascript") {
    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  body{background:#0d1117;color:#e6edf3;font-family:'JetBrains Mono',monospace;font-size:13px;padding:16px;margin:0;line-height:1.5}
  .entry{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #21262d;align-items:flex-start}
  .tag{padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;min-width:42px;text-align:center;flex-shrink:0;margin-top:2px}
  .log .tag{background:#1c2128;color:#8b949e}
  .error .tag{background:#3d1c1c;color:#f85149}
  .warn .tag{background:#2d2208;color:#d29922}
  .info .tag{background:#0d2137;color:#58a6ff}
  .text{white-space:pre-wrap;word-break:break-all;flex:1}
  .header{color:#8b949e;font-size:11px;margin-bottom:8px;border-bottom:1px solid #21262d;padding-bottom:6px}
</style>
</head>
<body>
<div class="header">&gt; Console Output</div>
<script>
(function(){
  const out=document.body;
  const line=(type,...args)=>{
    const div=document.createElement('div');
    div.className='entry '+type;
    const tag=document.createElement('span');
    tag.className='tag';
    tag.textContent=type.toUpperCase();
    const text=document.createElement('span');
    text.className='text';
    text.textContent=args.map(a=>typeof a==='object'&&a!==null?JSON.stringify(a,null,2):String(a)).join(' ');
    div.appendChild(tag);div.appendChild(text);out.appendChild(div);
  };
  const _log=console.log,_err=console.error,_warn=console.warn,_info=console.info;
  console.log=(...a)=>{_log(...a);line('log',...a)};
  console.error=(...a)=>{_err(...a);line('error',...a)};
  console.warn=(...a)=>{_warn(...a);line('warn',...a)};
  console.info=(...a)=>{_info(...a);line('info',...a)};
  window.onerror=(msg,_,l)=>line('error',msg+' (line '+l+')');
  window.onunhandledrejection=e=>line('error','Unhandled promise: '+(e.reason?.message||String(e.reason)));
})();
</script>
<script>
try{
${content}
}catch(e){
  (function(){
    const div=document.createElement('div');
    div.className='entry error';
    const tag=document.createElement('span');tag.className='tag';tag.textContent='ERROR';
    const text=document.createElement('span');text.className='text';text.textContent=e.message;
    div.appendChild(tag);div.appendChild(text);document.body.appendChild(div);
  })();
}
</script>
</body></html>`;
  }

  return "";
}

export function LivePreview({ activeFile, files, className = "" }) {
  const [srcdoc, setSrcdoc] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef(null);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setSrcdoc(buildSrcdoc(activeFile, files));
    setTimeout(() => setRefreshing(false), 300);
  }, [activeFile, files]);

  // Auto-refresh on content change
  useEffect(() => {
    if (!autoRefresh) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 400);
    return () => clearTimeout(debounceRef.current);
  }, [activeFile?.content, activeFile?.id, autoRefresh, refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.id]);

  const canPreview = activeFile && PREVIEWABLE.includes(activeFile.language);

  if (!canPreview) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-3 bg-[#0d1117] text-center ${className}`}>
        <Eye size={24} className="text-slate-600" />
        <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-600">No Preview Available</p>
        <p className="text-[10px] text-slate-700 max-w-[180px]">Open an HTML, CSS, or JavaScript file to see a live preview.</p>
      </div>
    );
  }

  const sandbox = activeFile.language === "css"
    ? "allow-same-origin"
    : "allow-scripts allow-forms allow-same-origin";

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-[60]" : "h-full"} ${className}`}>
      {/* Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 bg-[#161b22] px-3">
        <div className="flex items-center gap-2">
          <Eye size={12} className="text-[#6fb982]" />
          <span className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-400">
            Live Preview
          </span>
          <span className="rounded bg-[#6fb982]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#9ed4aa]">
            {activeFile.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? "Auto-refresh on — click to disable" : "Auto-refresh off — click to enable"}
            className={`rounded p-1.5 text-[10px] transition ${
              autoRefresh ? "text-[#9ed4aa]" : "text-slate-600 hover:text-slate-300"
            }`}
          >
            <span className={`inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase`}>
              AUTO {autoRefresh ? "ON" : "OFF"}
            </span>
          </button>
          <button
            onClick={refresh}
            title="Refresh preview"
            className="rounded p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="rounded p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        key={srcdoc.slice(0, 32)}
        title="live-preview"
        className="flex-1 w-full border-0"
        style={{ background: activeFile.language === "javascript" ? "#0d1117" : "#fff" }}
        srcDoc={srcdoc || "<html><body></body></html>"}
        sandbox={sandbox}
      />
    </div>
  );
}
