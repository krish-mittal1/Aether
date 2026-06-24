"use client";

import { MessageSquare, Mic, Send, Users, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";

function colorHash(id) {
  if (!id) return "hsl(137, 40%, 62%)";
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 42%, 62%)`;
}

function getInitials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ messages, users, typingUsers, onSend, voiceSlot }) {
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
      <div className="flex h-[35px] shrink-0 items-center border-b px-1" style={{ borderColor: "#3c3c3c" }}>
        {[
          { id: "chat", Icon: MessageSquare, label: "CHAT" },
          { id: "peers", Icon: Users, label: `PEERS (${Math.max(1, users.length)})` },
          { id: "voice", Icon: Mic, label: "VOICE" },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex h-full items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.06em] transition ${
              tab === id ? "text-white" : "text-[#858585] hover:text-[#cccccc]"
            }`}
          >
            {tab === id && <span className="absolute inset-x-0 bottom-0 h-[1px] bg-[#007acc]" />}
            <Icon size={11} />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 px-2 py-0.5" style={{ background: "#007acc", borderRadius: 2 }}>
          <span className="font-mono text-[9px] font-bold text-white">+{Math.max(1, users.length)}</span>
        </div>
      </div>

      {tab === "chat" && (
        <>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {!grouped.length && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center border text-[#858585]" style={{ borderColor: "#3c3c3c", background: "#2d2d2d" }}>
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
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6b7280] text-[9px] font-black text-white shadow-lg">
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
                    className={`max-w-[86%] whitespace-pre-wrap break-words border border-white/10 bg-[#2d2d2d] px-3 py-2 text-[13px] leading-relaxed text-[#cccccc]`}
                    style={{ borderRadius: 2 }}
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

          <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t p-2" style={{ borderColor: "#3c3c3c", background: "#252526" }}>
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
              className="h-[28px] min-w-0 flex-1 border border-transparent bg-[#3c3c3c] px-3 text-[13px] text-white outline-none transition placeholder:text-[#858585] focus:border-[#007acc]"
              style={{ borderRadius: 2 }}
            />
            <button
              type="submit"
              disabled={!content.trim()}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center text-white transition disabled:cursor-not-allowed disabled:text-[#858585]"
              style={{ background: "#007acc", borderRadius: 2 }}
            >
              <Send size={12} />
            </button>
          </form>
        </>
      )}

      {tab === "voice" && (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {voiceSlot || (
            <div className="flex flex-col items-center justify-center gap-3 pt-16 text-center px-4">
              <Mic size={24} className="text-slate-600" />
              <p className="text-xs leading-relaxed text-slate-500">
                Voice chat is not available.<br />Open the Chat panel to use it.
              </p>
            </div>
          )}
        </div>
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
                  <div key={user.id} className={`flex items-center gap-3 border p-2.5 ${isSelf ? "bg-[#094771]/40" : "bg-[#2d2d2d]"}`} style={{ borderColor: isSelf ? "#007acc" : "#3c3c3c", borderRadius: 2 }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-slate-950" style={{ background: colorHash(user.id) }}>
                      {getInitials(user.username)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-100">
                        {user.username}{isSelf && <span className="ml-1 text-[10px] text-[#007acc]">(you)</span>}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-500">{user.email}</div>
                    </div>
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#6fb982] " />
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
