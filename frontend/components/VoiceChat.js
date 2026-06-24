"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function colorHash(id) {
  if (!id) return "hsl(137,40%,62%)";
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash},42%,62%)`;
}

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

export function VoiceChat({ socket, roomId, currentUser }) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState({}); // remoteSid → { user, connected }
  const streamRef = useRef(null);
  const pcMapRef = useRef({}); // remoteSid → RTCPeerConnection
  const audioMapRef = useRef({}); // remoteSid → HTMLAudioElement

  // Create a RTCPeerConnection wired to our socket signaling
  const makePc = useCallback(
    (remoteSid) => {
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("webrtc_ice_candidate", { targetSid: remoteSid, candidate });
        }
      };

      pc.ontrack = ({ streams: [stream] }) => {
        setPeers((prev) => ({
          ...prev,
          [remoteSid]: { ...prev[remoteSid], connected: true },
        }));
        // Wire up audio element
        setTimeout(() => {
          const el = audioMapRef.current[remoteSid];
          if (el && stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
          }
        }, 80);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          pc.close();
          delete pcMapRef.current[remoteSid];
          setPeers((prev) => {
            const next = { ...prev };
            delete next[remoteSid];
            return next;
          });
        }
      };

      // Attach local audio tracks
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));

      pcMapRef.current[remoteSid] = pc;
      return pc;
    },
    [socket]
  );

  // Socket event wiring
  useEffect(() => {
    if (!socket) return;

    // Another user joined voice → we are the caller
    socket.on("voice_joined", async ({ sid, user }) => {
      if (!streamRef.current) return;
      setPeers((prev) => ({ ...prev, [sid]: { user, connected: false } }));
      const pc = makePc(sid);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc_offer", { targetSid: sid, offer });
    });

    // A user left voice
    socket.on("voice_left", ({ sid }) => {
      const pc = pcMapRef.current[sid];
      if (pc) { pc.close(); delete pcMapRef.current[sid]; }
      setPeers((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
    });

    // We received an offer → we are the callee
    socket.on("webrtc_offer", async ({ offer, fromSid, fromUser }) => {
      if (!streamRef.current) return;
      setPeers((prev) => ({ ...prev, [fromSid]: { user: fromUser, connected: false, ...prev[fromSid] } }));
      const pc = makePc(fromSid);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc_answer", { targetSid: fromSid, answer });
    });

    // We received an answer
    socket.on("webrtc_answer", async ({ answer, fromSid }) => {
      const pc = pcMapRef.current[fromSid];
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(answer);
      }
    });

    // ICE candidate from a peer
    socket.on("webrtc_ice_candidate", async ({ candidate, fromSid }) => {
      const pc = pcMapRef.current[fromSid];
      if (pc && candidate) await pc.addIceCandidate(candidate).catch(() => {});
    });

    return () => {
      socket.off("voice_joined");
      socket.off("voice_left");
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice_candidate");
    };
  }, [socket, makePc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pcMapRef.current).forEach((pc) => pc.close());
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function joinVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setActive(true);
      socket.emit("voice_join", { roomId });
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in browser settings and try again."
        : `Could not access microphone: ${err.message}`;
      alert(msg);
    }
  }

  function leaveVoice() {
    Object.values(pcMapRef.current).forEach((pc) => pc.close());
    pcMapRef.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPeers({});
    setActive(false);
    setMuted(false);
    socket.emit("voice_leave", { roomId });
  }

  function toggleMute() {
    if (!streamRef.current) return;
    const next = !muted;
    streamRef.current.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }

  const peerEntries = Object.entries(peers);

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Controls bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1d22] p-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-[#6fb982]" : "bg-slate-600"}`} />
          <span className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-400">
            {active ? (muted ? "Muted" : "In Voice") : "Voice Chat"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {active && (
            <button
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute microphone"}
              className={`rounded-lg p-2 transition ${
                muted
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {muted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          )}
          <button
            onClick={active ? leaveVoice : joinVoice}
            title={active ? "Leave voice" : "Join voice"}
            className={`rounded-lg px-2.5 py-2 text-[10px] font-bold uppercase transition ${
              active
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-[#6fb982]/20 text-[#9ed4aa] hover:bg-[#6fb982]/30"
            }`}
          >
            {active ? <PhoneOff size={12} /> : <Phone size={12} />}
          </button>
        </div>
      </div>

      {/* Self in voice */}
      {active && (
        <div className="flex items-center gap-2 rounded-xl border border-[#6fb982]/20 bg-[#6fb982]/5 p-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-slate-950"
            style={{ background: colorHash(currentUser?.id) }}
          >
            {initials(currentUser?.username)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[11px] font-bold text-slate-200">
              {currentUser?.username}{" "}
              <span className="text-[9px] text-[#9ed4aa]">(you)</span>
            </div>
          </div>
          {muted ? (
            <MicOff size={12} className="shrink-0 text-red-400" />
          ) : (
            <Mic size={12} className="shrink-0 text-[#6fb982]" />
          )}
        </div>
      )}

      {/* Remote peers */}
      {peerEntries.map(([sid, { user, connected }]) => (
        <div
          key={sid}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-slate-950"
            style={{ background: colorHash(user?.id) }}
          >
            {initials(user?.username)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[11px] font-bold text-slate-200">{user?.username}</div>
            <div className="text-[9px] text-slate-500">{connected ? "Connected" : "Connecting…"}</div>
          </div>
          {connected ? (
            <Volume2 size={12} className="shrink-0 text-[#6fb982]" />
          ) : (
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-[#6fb982] border-t-transparent" />
          )}
          {/* Hidden audio output for this peer */}
          <audio
            ref={(el) => {
              if (el) audioMapRef.current[sid] = el;
            }}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />
        </div>
      ))}

      {active && peerEntries.length === 0 && (
        <p className="text-center font-mono text-[10px] italic text-slate-600">
          No one else in voice — share the room link to invite them
        </p>
      )}

      {!active && (
        <p className="text-center font-mono text-[10px] italic text-slate-700">
          Click the phone icon to join voice chat
        </p>
      )}
    </div>
  );
}
