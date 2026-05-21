"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function AuthForm({ mode }) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeErr, setShakeErr] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const isSignup = mode === "signup";

  // Terminal log simulation on the left
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    const rawLogs = [
      "sys: initializing secure handshake...",
      "sys: fetching sandbox endpoints...",
      "sys: standard input/output bound",
      "sys: container runtime status: active",
      "sys: websocket listener active on port 443",
      "sys: awaiting developer credentials..."
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < rawLogs.length) {
        setLogs((prev) => [...prev, rawLogs[idx]]);
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = isSignup ? form : { email: form.email, password: form.password };
      const { data } = await api.post(`/auth/${isSignup ? "signup" : "login"}`, payload);
      setSession(data);
      toast.success("Welcome to Aether!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Authentication failed");
      setShakeErr(true);
      setTimeout(() => setShakeErr(false), 600);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%,60%{transform:translateX(-6px)}
          40%,80%{transform:translateX(6px)}
        }
        .auth-shell {
          min-height: 100vh;
          background: #09090b;
          color: #e2e8ea;
          font-family: Inter, ui-sans-serif, sans-serif;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          overflow: hidden;
        }

        /* LEFT SIDE - VISUAL/TERMINAL */
        .auth-left {
          background: #050608;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          padding: 80px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }

        .auth-left::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(74,222,128,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.02) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
        }

        .auth-left-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #e2e8ea;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-size: 15px;
        }

        .auth-logo-box {
          width: 32px;
          height: 32px;
          background: #4ade80;
          border-radius: 6px;
          color: #050f08;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 900;
          font-style: italic;
        }

        .auth-hero-text {
          max-width: 520px;
          margin: 60px 0;
        }

        .auth-hero-title {
          font-size: clamp(38px, 4vw, 54px);
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.05em;
          color: #f0f3f4;
          margin-bottom: 24px;
        }

        .auth-hero-sub {
          font-size: 15px;
          color: #6b7a7d;
          line-height: 1.6;
        }

        .auth-terminal {
          background: #0d1012;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 20px;
          font-family: "JetBrains Mono", monospace;
          font-size: 12px;
          color: #cbd5e1;
          height: 180px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        .auth-term-header {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding-bottom: 8px;
        }

        .auth-term-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #1f292d;
        }

        .auth-term-line {
          line-height: 1.6;
          color: #4ade80;
          opacity: 0.85;
          animation: fadein 0.3s ease forwards;
        }

        @keyframes fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 0.85; transform: none; }
        }

        /* RIGHT SIDE - FORM */
        .auth-right {
          padding: 80px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
        }

        .auth-right-container {
          max-width: 380px;
          width: 100%;
          margin: 0 auto;
        }

        .auth-form-title {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #f0f3f4;
          margin-bottom: 8px;
        }

        .auth-form-sub {
          font-size: 14px;
          color: #6b7a7d;
          margin-bottom: 40px;
        }

        .auth-group {
          margin-bottom: 24px;
          position: relative;
        }

        .auth-label {
          display: block;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b7a7d;
          margin-bottom: 8px;
          transition: color 0.2s;
        }

        .auth-input-container {
          position: relative;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          transition: border-color 0.25s;
        }

        .auth-input-container:focus-within {
          border-color: #4ade80;
        }

        .auth-input-container:focus-within + .auth-label {
          color: #4ade80;
        }

        .auth-field {
          width: 100%;
          background: transparent;
          border: none;
          padding: 12px 0;
          color: #e2e8ea;
          font-size: 14px;
          outline: none;
        }

        .auth-icon {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          color: #3a484a;
          pointer-events: none;
        }
        .auth-icon-btn {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #3a484a;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .auth-icon-btn:hover {
          color: #8b5cf6;
        }

        .auth-action-btn {
          width: 100%;
          background: #4ade80;
          color: #050f08;
          border: none;
          padding: 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: filter 0.2s, transform 0.2s;
          margin-top: 40px;
        }

        .auth-action-btn:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .auth-action-btn:active {
          transform: translateY(0);
        }

        .auth-toggle-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 13.5px;
          color: #6b7a7d;
        }

        .auth-toggle-link {
          color: #4ade80;
          text-decoration: none;
          font-weight: 700;
          margin-left: 6px;
          border-bottom: 1px solid rgba(74, 222, 128, 0.3);
          padding-bottom: 1px;
          transition: border-color 0.2s;
        }

        .auth-toggle-link:hover {
          border-color: #4ade80;
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .auth-shell {
            grid-template-columns: 1fr;
          }
          .auth-left {
            display: none;
          }
          .auth-right {
            padding: 40px 24px;
          }
        }
      `}</style>

      {/* Left side panel */}
      <div className="auth-left">
        <Link href="/" className="auth-left-logo">
          <div className="auth-logo-box">A</div>
          Aether Elite
        </Link>

        <div className="auth-hero-text">
          <h2 className="auth-hero-title">
            The workspace<br />
            for elite developers.
          </h2>
          <p className="auth-hero-sub">
            Real-time execution sandboxes. Zero environment delays.
            Designed for teams who ship codebase changes at the speed of thought.
          </p>
        </div>

        <div className="auth-terminal">
          <div className="auth-term-header">
            <span className="auth-term-dot" />
            <span className="auth-term-dot" />
            <span className="auth-term-dot" />
          </div>
          {logs.map((log, idx) => (
            <div key={idx} className="auth-term-line">
              &gt; {log}
            </div>
          ))}
        </div>
      </div>

      {/* Right side form */}
      <div className="auth-right">
        <div className="auth-right-container">
          <h1 className="auth-form-title">
            {isSignup ? "Create account" : "Sign In"}
          </h1>
          <p className="auth-form-sub">
            {isSignup ? "Start building in seconds." : "Enter credentials to access workspace."}
          </p>

          <form onSubmit={submit} style={shakeErr ? { animation: "shake 0.5s ease" } : {}}>
            {/* Username (Signup only) */}
            {isSignup && (
              <div className="auth-group">
                <label className="auth-label">Username</label>
                <div className="auth-input-container">
                  <input
                    className="auth-field"
                    placeholder="dev_user"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                  <span className="auth-icon"><User size={16} /></span>
                </div>
              </div>
            )}

            {/* Email */}
            <div className="auth-group">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-container">
                <input
                  className="auth-field"
                  type="email"
                  placeholder="developer@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <span className="auth-icon"><Mail size={16} /></span>
              </div>
            </div>

            {/* Password */}
            <div className="auth-group">
              <label className="auth-label">Password</label>
              <div className="auth-input-container">
                <input
                  className="auth-field"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: 28 }}
                />
                <button
                  type="button"
                  className="auth-icon-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-action-btn" disabled={loading}>
              {loading ? "Authorizing..." : isSignup ? "Create Account" : "Access Workspace"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="auth-toggle-footer">
            {isSignup ? "Already have an account?" : "New to Aether?"}
            <Link href={isSignup ? "/login" : "/signup"} className="auth-toggle-link">
              {isSignup ? "Sign In" : "Sign Up Free"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
