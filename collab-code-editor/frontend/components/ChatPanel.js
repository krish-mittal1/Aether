"use client";

import { MessageSquare, Send, Users, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";

function colorHash(id) {
  if (!id) return "hsl(174, 70%, 56%)";
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 68%, 62%)`;
}

function getInitials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ messages, users, typingUsers, onSend }) {
  const [content, setContent] = useState("");
  const [tab, setTab] = useState("chat");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    onSend(content.trim());
    setContent("");
    inputRef.current?.focus();
  }

  const grouped = messages.reduce((acc, message, index) => {
    const prev = messages[index - 1];
    const sameUser = prev && prev.sender?.id === message.sender?.id;
    const sameMinute = prev && Math.abs(new Date(message.createdAt) - new Date(prev.createdAt)) < 60000;
    acc.push({ ...message, isGrouped: sameUser && sameMinute });
    return acc;
  }, []);

  return (
    <aside className="ide-panel flex h-full w-full shrink-0 select-none flex-col font-sans">
      <div className="flex h-12 shrink-0 items-center border-b border-[#8fb39b]/10 px-3">
        {[
          { id: "chat", Icon: MessageSquare, label: "CHAT" },
          { id: "peers", Icon: Users, label: `PEERS (${Math.max(1, users.length)})` },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex h-full items-center gap-1.5 px-3 text-[12px] font-black uppercase tracking-[0.12em] transition ${
              tab === id ? "text-[#8fb39b]" : "text-slate-500 hover:text-slate-200"
            }`}
          >
            {tab === id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#8fb39b] " />}
            <Icon size={12} />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 rounded-full bg-[#8fb39b] px-2 py-0.5 ">
          <span className="font-mono text-[9px] font-black text-slate-950">+{Math.max(1, users.length)}</span>
        </div>
      </div>

      {tab === "chat" && (
        <>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {!grouped.length && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#8fb39b]/15 bg-[#8fb39b]/5 text-[#b7c9bd]">
                  <MessageSquare size={18} />
                </div>
                <p className="text-xs leading-relaxed text-slate-500">No messages yet.<br />Start the room conversation.</p>
              </div>
            )}

            {grouped.map((message) => {
              const isSelf = message.sender?.id === currentUser?.id;
              const senderName = message.sender?.username || "User";
              const avatarColor = colorHash(message.sender?.id);
              return (
                <div key={message.id} className={`flex flex-col ${isSelf ? "items-end" : "items-start"} ${message.isGrouped ? "mt-1" : "mt-4"}`}>
                  {!message.isGrouped && (
                    <div className="mb-1.5 flex items-center gap-2">
                      {isSelf ? (
                        <>
                          <span className="font-mono text-[9px] text-slate-500">{formatTime(message.createdAt)}</span>
                          <span className="max-w-[120px] truncate text-xs font-bold text-slate-300">You</span>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ec4899] text-[9px] font-black text-white shadow-lg">
                            {getInitials(senderName)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-slate-950 shadow-lg"
                            style={{ background: avatarColor }}
                          >
                            {getInitials(senderName)}
                          </div>
                          <span className="max-w-[120px] truncate text-xs font-bold text-slate-300">
                            {senderName}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500">{formatTime(message.createdAt)}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[86%] whitespace-pre-wrap break-words rounded-[20px] border border-slate-800 bg-[#070b10] px-4 py-2.5 text-[14px] leading-relaxed text-slate-200 shadow-sm`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="h-7 shrink-0 px-4 font-mono text-[12px] italic text-slate-600">
            {typingUsers.length > 0 && `${typingUsers.slice(0, 2).join(", ")} editing...`}
          </div>

          <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-slate-700/20 bg-[#060b10]/90 p-3">
            <input
              ref={inputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
              placeholder="Message..."
              maxLength={2000}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-800 bg-[#030508] px-5 text-sm text-white outline-none focus:border-[#8fb39b] transition placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={!content.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8fb39b] text-slate-950 hover:bg-[#8fb39b]/90 transition  disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
            >
              <Send size={14} />
            </button>
          </form>
        </>
      )}

      {tab === "peers" && (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          {!users.length ? (
            <div className="flex flex-col items-center justify-center gap-3 pt-16 text-center">
              <Wifi size={24} className="text-slate-600" />
              <p className="text-xs leading-relaxed text-slate-500">No peers connected.<br />Share the invite link.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <div key={user.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${isSelf ? "border-[#8fb39b]/20 bg-[#8fb39b]/[0.07]" : "border-slate-700/20 bg-white/[0.035]"}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-slate-950" style={{ background: colorHash(user.id) }}>
                      {getInitials(user.username)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-100">
                        {user.username}{isSelf && <span className="ml-1 text-[10px] text-[#8fb39b]">(you)</span>}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-500">{user.email}</div>
                    </div>
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#8fb39b] " />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
