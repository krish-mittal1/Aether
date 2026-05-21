"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, User, Mail, Shield, CheckCircle, Code2, FolderKanban } from "lucide-react";
import { useRequireAuth } from "../../hooks/useRequireAuth";
import { api } from "../../lib/api";

export default function ProfilePage() {
  const { user } = useRequireAuth();
  const [roomCount, setRoomCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get("/rooms")
      .then(({ data }) => setRoomCount(data.length))
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const initials = user.username ? user.username.slice(0, 2).toUpperCase() : "U";

  return (
    <main className="p-shell">
      {/* SCOPED CUSTOM STYLES */}
      <style>{`
        .p-shell {
          min-height: 100vh;
          background: #09090b;
          color: #e2e8ea;
          font-family: Inter, ui-sans-serif, sans-serif;
          padding: 48px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        /* Ambient Designer Grid */
        .p-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(74,222,128,0.038) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.038) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at center, black 40%, transparent 95%);
          pointer-events: none;
          z-index: 0;
        }

        .p-container {
          width: 100%;
          max-width: 640px;
          position: relative;
          z-index: 10;
        }

        .p-back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7a7d;
          text-decoration: none;
          margin-bottom: 24px;
          transition: color 0.2s;
        }
        .p-back-link:hover {
          color: #4ade80;
        }

        .p-card {
          background: #0d1012;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 40px 32px;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6);
        }

        .p-profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 32px;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .p-profile-info {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .p-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 2px solid rgba(74, 222, 128, 0.25);
          background: #111416;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4ade80;
          font-weight: 900;
          font-size: 20px;
          font-style: italic;
          box-shadow: 0 0 15px rgba(74, 222, 128, 0.1);
        }

        .p-username {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #f0f3f4;
        }

        .p-email {
          font-size: 13px;
          color: #6b7a7d;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .p-badges {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .p-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .p-badge-green {
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
          color: #4ade80;
        }

        .p-badge-dark {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #6b7a7d;
        }

        .p-brand-accent {
          font-size: 13px;
          font-weight: 850;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.22);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* METRICS */
        .p-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }
        .p-metric-card {
          background: #111416;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .p-metric-icon {
          width: 38px;
          height: 38px;
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
          border-radius: 8px;
          color: #4ade80;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .p-metric-title {
          font-size: 9.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7a7d;
        }
        .p-metric-val {
          font-size: 16px;
          font-weight: 800;
          color: #f0f3f4;
          margin-top: 2px;
        }

        /* DETAILS */
        .p-section-title {
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7a7d;
          margin-bottom: 12px;
        }
        .p-details-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 16px 20px;
        }
        .p-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          font-family: monospace;
          font-size: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .p-detail-row:last-child {
          border-bottom: none;
        }
        .p-detail-label {
          color: #4a5c5e;
        }
        .p-detail-val {
          color: #b0bec0;
          font-weight: 600;
        }
        .p-detail-val-active {
          color: #4ade80;
        }
      `}</style>

      <div className="p-grid" />

      <div className="p-container">
        {/* Back Link */}
        <Link href="/dashboard" className="p-back-link">
          <ArrowLeft size={13} /> Back to console
        </Link>

        {/* Card */}
        <div className="p-card">
          <div className="p-profile-header">
            {/* Info */}
            <div className="p-profile-info">
              <div className="p-avatar">
                {initials}
              </div>
              <div>
                <h1 className="p-username">{user.username}</h1>
                <p className="p-email">
                  <Mail size={13} style={{ color: "#3e4e50" }} /> {user.email}
                </p>
                <div className="p-badges">
                  <span className="p-badge p-badge-green">
                    Developer Pro
                  </span>
                  <span className="p-badge p-badge-dark">
                    Active Session
                  </span>
                </div>
              </div>
            </div>

            {/* Brand Accent */}
            <div className="p-brand-accent">
              <Code2 size={18} style={{ opacity: 0.3 }} /> Aether
            </div>
          </div>

          {/* Metrics */}
          <div className="p-metrics">
            <div className="p-metric-card">
              <span className="p-metric-icon">
                <FolderKanban size={16} />
              </span>
              <div>
                <div className="p-metric-title">Workspaces</div>
                <div className="p-metric-val">{roomCount} Active</div>
              </div>
            </div>

            <div className="p-metric-card">
              <span className="p-metric-icon">
                <Code2 size={16} />
              </span>
              <div>
                <div className="p-metric-title">Live Editor Core</div>
                <div className="p-metric-val">Ready</div>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div>
            <h3 className="p-section-title">Account Details</h3>
            <div className="p-details-box">
              <div className="p-detail-row">
                <span className="p-detail-label">Account ID</span>
                <span className="p-detail-val" style={{ userSelect: "all" }}>{user.id}</span>
              </div>
              <div className="p-detail-row">
                <span className="p-detail-label">Filesystem Access</span>
                <span className="p-detail-val p-detail-val-active">Enabled</span>
              </div>
              <div className="p-detail-row">
                <span className="p-detail-label">Sandboxed Terminal</span>
                <span className="p-detail-val p-detail-val-active">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
