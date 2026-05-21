"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

/* ──────────────────────────────────────────
   CUSTOM CURSOR
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

    const over = () => ring.current && (ring.current.style.transform += " scale(2.2)");
    const out = () => {};
    document.querySelectorAll("a,button").forEach(el => {
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
function MagBtn({ children, href, className = "", style = {} }) {
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
  return (
    <Link href={href} ref={ref} className={className} style={{ ...style, transition: "transform 0.35s cubic-bezier(0.23,1,0.32,1)", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
      onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {children}
    </Link>
  );
}

/* ──────────────────────────────────────────
   SCROLL REVEAL – CLIP PATH
────────────────────────────────────────── */
function Reveal({ children, delay = 0, dir = "up", className = "" }) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const from = dir === "left" ? "translateX(-40px)" : dir === "right" ? "translateX(40px)" : "translateY(36px)";
  return (
    <div ref={ref} className={className} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : from,
      transition: `opacity 0.7s ${delay}ms cubic-bezier(0.16,1,0.3,1), transform 0.7s ${delay}ms cubic-bezier(0.16,1,0.3,1)`,
    }}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────
   WORD-BY-WORD REVEAL
────────────────────────────────────────── */
function WordReveal({ text, className = "" }) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const words = text.split(" ");
  return (
    <span ref={ref} className={className} style={{ display: "block" }} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}>
          <span style={{
            display: "inline-block",
            transform: v ? "none" : "translateY(110%)",
            opacity: v ? 1 : 0,
            transition: `transform 0.6s ${i * 55}ms cubic-bezier(0.16,1,0.3,1), opacity 0.4s ${i * 55}ms ease`,
          }}>{w}</span>
        </span>
      ))}
    </span>
  );
}

/* ──────────────────────────────────────────
   SLOT COUNTER
────────────────────────────────────────── */
function SlotCounter({ to, suffix = "" }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        let start = 0;
        const dur = 1800, steps = 60;
        const inc = to / steps;
        const t = setInterval(() => {
          start += inc;
          if (start >= to) { setVal(to); clearInterval(t); }
          else setVal(Math.floor(start));
        }, dur / steps);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ──────────────────────────────────────────
   TILT CARD
────────────────────────────────────────── */
function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
  };
  const handleLeave = () => {
    if (ref.current) ref.current.style.transform = "perspective(700px) rotateY(0) rotateX(0) scale(1)";
  };
  return (
    <div ref={ref} className={className} onMouseMove={handleMove} onMouseLeave={handleLeave}
      style={{ transition: "transform 0.4s cubic-bezier(0.23,1,0.32,1)", transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────
   LIVE CODE TYPER
────────────────────────────────────────── */
const CODE_LINES = [
  `import { CollabRoom } from "aether-core"`,
  ``,
  `// Spin up a collaborative workspace`,
  `const room = await CollabRoom.create({`,
  `  lang: "python",  sandbox: true,`,
  `  cursors: true,   chat: true,`,
  `})`,
  ``,
  `room.on("edit", delta => editor.apply(delta))`,
  `room.on("join", user => showCursor(user))`,
];

function CodeTyper() {
  const [lines, setLines] = useState([""]);
  const [li, setLi] = useState(0);
  const [ci, setCi] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const full = CODE_LINES[li] ?? "";
    if (ci <= full.length) {
      const t = setTimeout(() => {
        setLines(prev => { const n = [...prev]; n[li] = full.slice(0, ci); return n; });
        setCi(ci + 1);
      }, ci === full.length ? 0 : 28 + Math.random() * 18);
      return () => clearTimeout(t);
    } else {
      if (li + 1 < CODE_LINES.length) {
        const t = setTimeout(() => { setLines(prev => [...prev, ""]); setLi(li + 1); setCi(0); }, 80);
        return () => clearTimeout(t);
      } else setDone(true);
    }
  }, [ci, li, done]);

  const colorize = (line) => {
    if (line.startsWith("//")) return <span style={{ color: "#5a8f60" }}>{line}</span>;
    return line
      .replace(/(import|from|const|await|true|false)/g, "§KW§$1§/KW§")
      .replace(/(".*?")/g, "§ST§$1§/ST§")
      .split("§")
      .map((seg, i) => {
        if (seg.startsWith("KW§")) return <span key={i} style={{ color: "#c084fc" }}>{seg.slice(3)}</span>;
        if (seg.startsWith("ST§")) return <span key={i} style={{ color: "#fbbf24" }}>{seg.slice(3)}</span>;
        if (seg.startsWith("/KW§") || seg.startsWith("/ST§")) return null;
        return <span key={i} style={{ color: "#cbd5e1" }}>{seg}</span>;
      });
  };

  return (
    <div className="ct-wrap">
      <div className="ct-header">
        <div className="ct-dots"><span /><span /><span /></div>
        <span className="ct-fname">room.js</span>
        <span className="ct-badge">● Live</span>
      </div>
      <div className="ct-body">
        {lines.map((line, i) => (
          <div key={i} className="ct-line">
            <span className="ct-num">{i + 1}</span>
            <span className="ct-code">{colorize(line)}{i === li && !done && <span className="ct-cur" />}</span>
          </div>
        ))}
      </div>
      <div className="ct-status">
        <span style={{ color: "#4ade80" }}>● Connected</span>
        <span>3 online</span>
        <span style={{ marginLeft: "auto" }}>Python 3.11</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   MARQUEE
────────────────────────────────────────── */
const LANGS = ["Python", "JavaScript", "TypeScript", "Go", "Rust", "C++", "Java", "Ruby", "PHP", "Swift", "Kotlin", "Elixir"];
function Marquee() {
  const items = [...LANGS, ...LANGS];
  return (
    <div className="mq-wrap" aria-hidden="true">
      <div className="mq-track">
        {items.map((l, i) => (
          <span key={i} className="mq-item">
            <span className="mq-dot" />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   FEATURE DATA
────────────────────────────────────────── */
const FEATS = [
  { num: "01", title: "Instant Rooms", body: "One click. One link. Your teammate is in the same editor, no installs, no accounts needed on their end." },
  { num: "02", title: "Live Cursors", body: "Every collaborator's cursor moves in real time. Named, colored, silky at 60fps. You see exactly what they're typing." },
  { num: "03", title: "Stream Chat", body: "Chat is baked into the IDE panel. Discuss the code while staring at it. No Slack, no Discord, no context switch." },
  { num: "04", title: "Sandboxed Run", body: "Docker-isolated execution. Python, JS, Go, Rust — run anything, break nothing. Output appears in under 200ms." },
  { num: "05", title: "Monaco Core", body: "The VS Code engine. Full IntelliSense, multi-cursor, 30+ language syntax, all running in the browser." },
  { num: "06", title: "Local Folder Sync", body: "Link your disk to the browser with the File System Access API. Edit locally and remotely simultaneously." },
];

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <main className="p-shell">

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,800&display=swap');

        :root {
          --bg:      #09090b;
          --bg1:     #0c0d0f;
          --bg2:     #111216;
          --bg3:     #171920;
          --border:  rgba(255,255,255,0.06);
          --bord-g:  rgba(139,92,246,0.3);
          --green:   #8b5cf6;
          --text:    #e2e8ea;
          --muted:   #6b7a7d;
          --mono:    "JetBrains Mono","Fira Code",Consolas,monospace;
        }
        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

        .p-shell {
          background: var(--bg);
          color: var(--text);
          font-family: Inter, ui-sans-serif, sans-serif;
          overflow-x: hidden;
          cursor: none;
        }

        /* CURSOR */
        .c-dot {
          position: fixed; z-index: 9999;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--green);
          pointer-events: none;
          will-change: transform;
          top: 0; left: 0;
          mix-blend-mode: difference;
        }
        .c-ring {
          position: fixed; z-index: 9998;
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 1.5px solid rgba(139,92,246,0.55);
          pointer-events: none;
          will-change: transform;
          top: 0; left: 0;
          transition: transform 0s, border-color 0.2s, width 0.25s, height 0.25s;
        }
        .c-ring.c-ring-hover {
          width: 56px; height: 56px;
          border-color: var(--green);
          margin: -8px;
        }

        @media (pointer: coarse) {
          .c-dot, .c-ring { display: none !important; }
          .p-shell { cursor: auto !important; }
        }

        /* NAV */
        .p-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 500;
          height: 60px;
          transition: background 0.4s, border-color 0.4s;
        }
        .p-nav.p-scrolled {
          background: rgba(9,9,11,0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .p-nav-i {
          max-width: 1280px; margin: 0 auto;
          padding: 0 32px; height: 100%;
          display: flex; align-items: center; justify-content: space-between;
        }
        .p-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; color: #eef1f2;
          font-size: 16px; font-weight: 800;
          letter-spacing: -0.04em;
        }
        .p-logo-box {
          width: 30px; height: 30px;
          background: var(--green); border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: #050f08; font-size: 16px; font-weight: 900; font-style: italic;
        }
        .p-nav-links { display: flex; gap: 28px; }
        .p-nav-links a {
          color: var(--muted); font-size: 14px; font-weight: 500;
          text-decoration: none; transition: color 0.2s;
        }
        .p-nav-links a:hover { color: var(--text); }
        .p-nav-r { display: flex; align-items: center; gap: 12px; }
        .p-nav-login {
          color: var(--muted); font-size: 14px;
          text-decoration: none; transition: color 0.2s;
        }
        .p-nav-login:hover { color: var(--text); }
        .p-nav-cta {
          background: var(--green);
          color: #040d06; font-size: 13px; font-weight: 700;
          padding: 8px 18px; border-radius: 7px;
          transition: filter 0.2s;
        }
        .p-nav-cta:hover { filter: brightness(1.1); }

        /* ───── HERO ───── */
        .p-hero {
          min-height: 100vh;
          padding: 140px 32px 80px;
          max-width: 1280px; margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .p-hero-left {}
        .p-hero-chip {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid var(--bord-g);
          background: rgba(139,92,246,0.05);
          padding: 5px 12px; border-radius: 100px;
          font-size: 12px; font-weight: 600;
          color: var(--green); letter-spacing: 0.04em;
          margin-bottom: 32px;
          animation: fadeup 0.6s ease both;
        }
        .p-chip-pulse {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--green);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.7)}
          50%{box-shadow:0 0 0 8px rgba(74,222,128,0)}
        }
        @keyframes fadeup { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }

        .p-hero-h1 {
          font-size: clamp(52px, 6vw, 82px);
          font-weight: 900;
          line-height: 0.96;
          letter-spacing: -0.05em;
          color: #f4f6f7;
          margin-bottom: 28px;
        }
        .p-h1-accent { color: var(--green); }
        .p-hero-sub {
          font-size: 17px; color: var(--muted);
          line-height: 1.65; max-width: 440px;
          margin-bottom: 44px; font-weight: 400;
        }
        .p-hero-btns { display: flex; gap: 14px; align-items: center; }
        .p-btn-primary {
          background: var(--green);
          color: #040d06; font-weight: 800;
          font-size: 15px; padding: 14px 28px;
          border-radius: 9px;
        }
        .p-btn-primary:hover { filter: brightness(1.08); }
        .p-btn-ghost {
          color: var(--muted); font-size: 14px; font-weight: 500;
          border: 1px solid var(--border);
          padding: 13px 22px; border-radius: 9px;
          background: var(--bg2);
          transition: border-color 0.2s, color 0.2s;
        }
        .p-btn-ghost:hover { border-color: rgba(255,255,255,0.18); color: var(--text); }

        /* hero right: code typer */
        .p-hero-right {
          position: relative;
        }
        .p-hero-badge-float {
          position: absolute;
          top: -18px; right: -12px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px; color: #8aacae;
          z-index: 2;
        }
        .p-hero-badge-float strong { color: var(--green); display: block; font-size: 18px; font-weight: 900; }

        /* CODE TYPER */
        .ct-wrap {
          background: #0d1114;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.7);
        }
        .ct-header {
          height: 38px;
          background: #161c1e;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 10px;
          padding: 0 16px;
        }
        .ct-dots { display: flex; gap: 6px; }
        .ct-dots span { width: 10px; height: 10px; border-radius: 50%; background: #2e3a3c; }
        .ct-fname { font-size: 12px; color: #6a7a7c; font-family: var(--mono); margin-left: 4px; }
        .ct-badge { margin-left: auto; font-size: 11px; color: var(--green); font-weight: 600; }
        .ct-body {
          padding: 20px 0;
          min-height: 220px;
          font-family: var(--mono);
        }
        .ct-line {
          display: grid; grid-template-columns: 40px 1fr;
          line-height: 1.75; font-size: 13px;
        }
        .ct-num { text-align: right; padding-right: 16px; color: #3a4a4c; user-select: none; }
        .ct-code { color: #cbd5e1; padding-right: 20px; white-space: pre; }
        .ct-cur {
          display: inline-block; width: 2px; height: 1em;
          background: var(--green); vertical-align: text-top;
          animation: blink 0.8s steps(1) infinite; margin-left: 1px;
        }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        .ct-status {
          height: 26px; display: flex; align-items: center; gap: 16px;
          padding: 0 16px; background: #161c1e;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 11px; color: var(--muted); font-family: var(--mono);
        }

        /* ───── MARQUEE ───── */
        .mq-wrap {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--bg1);
          overflow: hidden;
          padding: 18px 0;
        }
        .mq-track {
          display: flex; gap: 0;
          width: max-content;
          animation: marquee 28s linear infinite;
        }
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .mq-item {
          display: flex; align-items: center; gap: 10px;
          font-size: 14px; font-weight: 600;
          color: var(--muted);
          padding: 0 32px;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .mq-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--bord-g); }
        .mq-wrap:hover .mq-track { animation-play-state: paused; }

        /* ───── SECTION SHELL ───── */
        .s-wrap { border-top: 1px solid var(--border); }
        .s-inner {
          max-width: 1280px; margin: 0 auto;
          padding: 100px 32px;
        }
        .s-alt { background: var(--bg1); }
        .s-tag {
          display: inline-block;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--green); margin-bottom: 18px;
        }
        .s-h2 {
          font-size: clamp(36px, 4.5vw, 58px);
          font-weight: 900; letter-spacing: -0.04em;
          color: #f0f3f4; line-height: 1.0;
          margin-bottom: 20px;
        }
        .s-sub {
          font-size: 17px; color: var(--muted);
          line-height: 1.65; max-width: 500px;
        }

        /* ───── FEATURES ───── */
        .f-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          margin-top: 64px;
        }
        .f-card {
          background: var(--bg);
          padding: 36px 30px;
          transition: background 0.25s;
          cursor: default;
        }
        .f-card:hover { background: var(--bg2); }
        .f-num {
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.08em; color: var(--green);
          margin-bottom: 20px;
          font-family: var(--mono);
        }
        .f-title {
          font-size: 20px; font-weight: 800;
          color: #e8f0f2; margin-bottom: 12px;
          letter-spacing: -0.03em;
        }
        .f-body { font-size: 14px; color: var(--muted); line-height: 1.65; }

        /* ───── STATS STRIP ───── */
        .stat-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-left: 1px solid var(--border);
        }
        .stat-block {
          padding: 48px 32px;
          border-right: 1px solid var(--border);
          border-top: 1px solid var(--border);
        }
        .stat-n {
          font-size: 52px; font-weight: 900;
          letter-spacing: -0.05em;
          color: #f0f3f4; line-height: 1;
          margin-bottom: 8px;
        }
        .stat-n sup { font-size: 28px; color: var(--green); }
        .stat-l { font-size: 14px; color: var(--muted); font-weight: 500; }

        /* ───── SPLIT SECTIONS ───── */
        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px; align-items: center;
        }
        .split-grid.flip { direction: rtl; }
        .split-grid.flip > * { direction: ltr; }
        .split-visual {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg1);
        }
        .split-text-lede {
          font-size: 14px; font-weight: 600;
          color: var(--green); margin-bottom: 16px;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .split-h { 
          font-size: clamp(32px, 3.5vw, 46px);
          font-weight: 900; letter-spacing: -0.04em;
          color: #f0f3f4; line-height: 1.05;
          margin-bottom: 20px;
        }
        .split-p {
          font-size: 16px; color: var(--muted);
          line-height: 1.7; margin-bottom: 32px;
        }
        .split-link {
          display: inline-flex; align-items: center; gap: 8px;
          color: var(--green); font-size: 14px; font-weight: 700;
          text-decoration: none; letter-spacing: -0.01em;
          border-bottom: 1px solid rgba(139,92,246,0.35);
          padding-bottom: 2px;
          transition: border-color 0.2s, gap 0.2s;
        }
        .split-link:hover { gap: 14px; border-color: var(--green); }

        /* sandbox visual */
        .sb-panel { font-family: var(--mono); }
        .sb-topbar {
          display: flex; gap: 8px; padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--bg2);
        }
        .sb-lang {
          font-size: 11px; padding: 4px 12px; border-radius: 100px;
          background: rgba(139,92,246,0.08);
          border: 1px solid var(--bord-g);
          color: var(--green); font-weight: 600;
          cursor: default;
        }
        .sb-lang.inactive {
          background: transparent; border-color: var(--border);
          color: var(--muted);
        }
        .sb-code { padding: 20px 18px; font-size: 12.5px; line-height: 1.8; }
        .kw { color: #c084fc; }
        .fn { color: #60a5fa; }
        .st { color: #fbbf24; }
        .cm { color: #4a6060; }
        .pl { color: #cbd5e1; }
        .sb-out {
          padding: 14px 18px; border-top: 1px solid var(--border);
          background: #070909;
        }
        .sb-out-tag { font-size: 9px; color: var(--green); font-weight: 700; letter-spacing: 0.1em; margin-bottom: 8px; }
        .sb-out-val { font-size: 13px; color: #86efac; }
        .sb-out-meta { font-size: 11px; color: #2e4040; margin-top: 4px; }

        /* cursor demo visual */
        .cur-demo {
          padding: 24px;
          font-family: var(--mono);
          font-size: 12.5px; line-height: 1.8;
          background: var(--bg1);
          position: relative;
        }
        .cur-line { white-space: nowrap; }
        .cur-highlight {
          background: rgba(139,92,246,0.07);
          border-left: 2px solid var(--green);
          padding: 0 8px; border-radius: 2px;
          position: relative;
        }
        .cur-tag {
          position: absolute;
          top: -20px; left: 0;
          font-size: 10px; color: var(--bg);
          background: var(--green);
          padding: 2px 8px; border-radius: 4px;
          font-weight: 700;
          white-space: nowrap;
        }
        .cur-highlight2 {
          background: rgba(96,165,250,0.07);
          border-left: 2px solid #60a5fa;
          padding: 0 8px; border-radius: 2px;
          position: relative;
        }
        .cur-tag2 {
          position: absolute; top: -20px; left: 0;
          font-size: 10px; color: #fff;
          background: #3b5bdb; padding: 2px 8px;
          border-radius: 4px; font-weight: 700; white-space: nowrap;
        }
        .cur-statusbar {
          display: flex; align-items: center; gap: 14px;
          padding: 10px 18px;
          background: #161c1e;
          border-top: 1px solid var(--border);
          font-size: 11px; color: var(--muted); font-family: var(--mono);
        }

        /* ───── BIG POSTER CTA ───── */
        .poster {
          min-height: 70vh;
          display: flex; flex-direction: column;
          align-items: flex-start; justify-content: center;
          padding: 100px 32px;
          max-width: 1280px; margin: 0 auto;
          position: relative;
        }
        .poster-num {
          font-size: 200px; font-weight: 900;
          letter-spacing: -0.08em;
          color: rgba(255,255,255,0.03);
          line-height: 1;
          position: absolute; right: 20px; top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          user-select: none;
        }
        .poster-tag {
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--green); margin-bottom: 24px;
        }
        .poster-h {
          font-size: clamp(52px, 7vw, 96px);
          font-weight: 900; letter-spacing: -0.05em;
          color: #f0f3f4; line-height: 0.94;
          margin-bottom: 36px; max-width: 900px;
        }
        .poster-sub {
          font-size: 18px; color: var(--muted);
          line-height: 1.6; max-width: 480px; margin-bottom: 52px;
        }
        .poster-btns { display: flex; gap: 14px; align-items: center; }
        .poster-primary {
          background: var(--green); color: #040d06;
          font-weight: 800; font-size: 16px;
          padding: 16px 34px; border-radius: 10px;
        }
        .poster-ghost {
          color: var(--muted); font-size: 15px; font-weight: 500;
          border: 1px solid var(--border); padding: 15px 26px;
          border-radius: 10px; background: var(--bg2);
          transition: border-color 0.2s, color 0.2s;
        }
        .poster-ghost:hover { border-color: rgba(255,255,255,0.18); color: var(--text); }

        /* ───── FOOTER ───── */
        .p-foot {
          border-top: 1px solid var(--border);
          background: var(--bg1);
        }
        .p-foot-i {
          max-width: 1280px; margin: 0 auto;
          padding: 28px 32px;
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 16px;
        }
        .p-foot-links { display: flex; gap: 22px; }
        .p-foot-links a { color: var(--muted); font-size: 13px; text-decoration: none; transition: color 0.2s; }
        .p-foot-links a:hover { color: var(--text); }
        .p-foot-copy { font-size: 12px; color: #3a4a4c; }
        .p-foot-cta {
          font-size: 13px; font-weight: 700;
          color: var(--green); text-decoration: none;
          border: 1px solid var(--bord-g);
          padding: 9px 20px; border-radius: 8px;
          background: rgba(139,92,246,0.05);
          transition: background 0.2s;
        }
        .p-foot-cta:hover { background: rgba(139,92,246,0.1); }

        /* ───── RESPONSIVE ───── */
        @media (max-width: 1024px) {
          .p-hero { grid-template-columns: 1fr; gap: 60px; }
          .split-grid { grid-template-columns: 1fr; gap: 40px; }
          .split-grid.flip { direction: ltr; }
          .f-grid { grid-template-columns: 1fr 1fr; }
          .stat-strip { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 680px) {
          .p-hero { padding-top: 100px; }
          .f-grid { grid-template-columns: 1fr; }
          .stat-strip { grid-template-columns: 1fr 1fr; }
          .p-nav-links { display: none; }
          .poster-num { display: none; }
        }
      `}</style>

      <Cursor />

      {/* ── NAV ── */}
      <header className={`p-nav ${scrolled ? "p-scrolled" : ""}`}>
        <div className="p-nav-i">
          <MagBtn href="/" className="p-logo">
            <span className="p-logo-box">A</span>
            Aether Elite
          </MagBtn>
          <nav className="p-nav-links" aria-label="Main">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard">Features</Link>
            <Link href="/dashboard">Docs</Link>
            <Link href="/dashboard">Community</Link>
          </nav>
          <div className="p-nav-r">
            <Link href="/login" className="p-nav-login">Log In</Link>
            <MagBtn href="/signup" className="p-nav-cta">Sign Up Free</MagBtn>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="p-hero">
        <div className="p-hero-left">
          <div className="p-hero-chip">
            <span className="p-chip-pulse" />
            Sandboxed execution now live — 30+ languages
          </div>
          <h1 className="p-hero-h1">
            <WordReveal text="Real-time code." />
            <span className="p-h1-accent">
              <WordReveal text="Zero friction." />
            </span>
          </h1>
          <p className="p-hero-sub">
            Collaborative code editor with live cursors, stream chat, and
            sandboxed multi-language execution. Built for teams who ship fast.
          </p>
          <div className="p-hero-btns">
            <MagBtn href="/signup" className="p-btn-primary">Start for free →</MagBtn>
            <MagBtn href="/login" className="p-btn-ghost">Log into a room</MagBtn>
          </div>
        </div>
        <div className="p-hero-right">
          <div className="p-hero-badge-float">
            <strong><SlotCounter to={3} suffix="" />  online</strong>
            collaborators
          </div>
          <CodeTyper />
        </div>
      </section>

      {/* ── LANGUAGES MARQUEE ── */}
      <Marquee />

      {/* ── STATS ── */}
      <div className="s-wrap">
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
          <div className="stat-strip">
            {[
              { n: 12, suf: "K+", l: "Developers" },
              { n: 48, suf: "K+", l: "Rooms Created" },
              { n: 30, suf: "+",  l: "Languages" },
              { n: 99, suf: ".9%", l: "Uptime" },
            ].map(({ n, suf, l }) => (
              <Reveal key={l} className="stat-block">
                <div className="stat-n"><SlotCounter to={n} suffix={suf} /></div>
                <div className="stat-l">{l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div className="s-wrap">
        <div className="s-inner">
          <Reveal>
            <span className="s-tag">Everything you need</span>
            <h2 className="s-h2">No fluff.<br />Just the tools.</h2>
          </Reveal>
          <div className="f-grid">
            {FEATS.map((f, i) => (
              <Reveal key={f.num} delay={i * 60}>
                <TiltCard className="f-card">
                  <div className="f-num">{f.num}</div>
                  <div className="f-title">{f.title}</div>
                  <div className="f-body">{f.body}</div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── LIVE CURSORS ── */}
      <div className="s-wrap s-alt">
        <div className="s-inner">
          <div className="split-grid">
            <Reveal dir="left">
              <div className="split-text-lede">Live Collaboration</div>
              <h2 className="split-h">Every cursor.<br />Every keystroke.<br />In sync.</h2>
              <p className="split-p">
                Sub-50ms latency. Named cursors. Selection highlights. You always know
                where your teammate is and what they're changing — in real time, at 60fps.
              </p>
              <Link href="/signup" className="split-link">Start a shared room →</Link>
            </Reveal>
            <Reveal dir="right" delay={100}>
              <div className="split-visual">
                <div className="cur-demo">
                  <div className="cur-line"><span className="kw">import</span><span className="pl"> &#123; CollabRoom &#125; </span><span className="kw">from</span><span className="st"> "aether"</span></div>
                  <div style={{ height: 12 }} />
                  <div className="cur-line"><span className="kw">const </span><span className="pl">room = </span><span className="kw">await </span><span className="fn">CollabRoom.create</span><span className="pl">&#40;&#123;</span></div>
                  <div className="cur-line" style={{ marginTop: 4 }}>
                    <div className="cur-highlight" style={{ display: "inline-block", width: "100%" }}>
                      <span className="cur-tag">● Alice</span>
                      <span className="pl">&nbsp;&nbsp;lang: </span><span className="st">"python"</span><span className="pl">, cursors: </span><span className="kw">true</span>
                    </div>
                  </div>
                  <div className="cur-line" style={{ marginTop: 8 }}>
                    <div className="cur-highlight2" style={{ display: "inline-block", width: "100%" }}>
                      <span className="cur-tag2">● Bob</span>
                      <span className="pl">&nbsp;&nbsp;sandbox: </span><span className="kw">true</span>
                    </div>
                  </div>
                  <div className="cur-line"><span className="pl">&#125;&#41;;</span></div>
                  <div style={{ height: 12 }} />
                  <div className="cur-line"><span className="cm">// 3 collaborators · all changes synced</span></div>
                </div>
                <div className="cur-statusbar">
                  <span style={{ color: "var(--green)" }}>● Live</span>
                  <span>3 online</span>
                  <span style={{ marginLeft: "auto" }}>room://aef-x92k</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── SANDBOXED EXECUTION ── */}
      <div className="s-wrap">
        <div className="s-inner">
          <div className="split-grid flip">
            <Reveal dir="right">
              <div className="split-text-lede">Secure Execution</div>
              <h2 className="split-h">Write it.<br />Run it.<br />Right here.</h2>
              <p className="split-p">
                Fully isolated Docker containers per execution. Python, Go, Rust, JS, Java
                — spin up any runtime with zero local setup. Output in under 200ms.
              </p>
              <Link href="/signup" className="split-link">Try the sandbox →</Link>
            </Reveal>
            <Reveal dir="left" delay={100}>
              <div className="split-visual">
                <div className="sb-panel">
                  <div className="sb-topbar">
                    <span className="sb-lang">Python</span>
                    <span className="sb-lang inactive">Go</span>
                    <span className="sb-lang inactive">Rust</span>
                    <span className="sb-lang inactive">JS</span>
                  </div>
                  <div className="sb-code">
                    <div><span className="kw">def </span><span className="fn">fib</span><span className="pl">&#40;n&#41;:</span></div>
                    <div><span className="pl">&nbsp;&nbsp;</span><span className="kw">if </span><span className="pl">n &lt;= 1: </span><span className="kw">return </span><span className="pl">n</span></div>
                    <div><span className="kw">&nbsp;&nbsp;return </span><span className="fn">fib</span><span className="pl">&#40;n-1&#41; + </span><span className="fn">fib</span><span className="pl">&#40;n-2&#41;</span></div>
                    <div style={{ height: 10 }} />
                    <div><span className="fn">print</span><span className="pl">&#40;[</span><span className="fn">fib</span><span className="pl">&#40;i&#41; </span><span className="kw">for </span><span className="pl">i </span><span className="kw">in </span><span className="fn">range</span><span className="pl">&#40;10&#41;]&#41;</span></div>
                  </div>
                  <div className="sb-out">
                    <div className="sb-out-tag">▸ OUTPUT</div>
                    <div className="sb-out-val">&#91;0, 1, 1, 2, 3, 5, 8, 13, 21, 34&#93;</div>
                    <div className="sb-out-meta">Finished in 38ms · python:3.11-slim · Docker</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── BIG POSTER CTA ── */}
      <div className="s-wrap">
        <div className="poster">
          <div className="poster-num">∞</div>
          <Reveal>
            <div className="poster-tag">Ready when you are</div>
            <h2 className="poster-h">
              <WordReveal text="Stop waiting." /><br />
              <WordReveal text="Start building" />{" "}
              <span style={{ color: "var(--green)" }}>
                <WordReveal text="together." />
              </span>
            </h2>
            <p className="poster-sub">
              Free to start. No credit card. No install. Open a room and send your
              team the link — they're coding with you in 10 seconds.
            </p>
            <div className="poster-btns">
              <MagBtn href="/signup" className="poster-primary">Create Free Account →</MagBtn>
              <MagBtn href="/login" className="poster-ghost">Log In</MagBtn>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="p-foot">
        <div className="p-foot-i">
          <div className="p-foot-links">
            <Link href="/">Home</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard">Docs</Link>
            <Link href="/dashboard">Community</Link>
          </div>
          <span className="p-foot-copy">© 2025 Aether Elite</span>
          <Link href="/signup" className="p-foot-cta">Start Coding →</Link>
        </div>
      </footer>
    </main>
  );
}
