import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, doc, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, writeBatch,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase/config";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function getChatId(uid1, uid2) { return [uid1, uid2].sort().join("_"); }

function timeLabel(ts) {
  if (!ts) return "";
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function fullTimeLabel(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

// ═══════════════════════════════════════════════════════════════
// RESPONSIVE / DEVICE HELPERS
// ═══════════════════════════════════════════════════════════════
function useIsMobile(breakpoint = 680) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [breakpoint]);
  return isMobile;
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

// Tracks the *visual* viewport height so the panel shrinks gracefully
// when the on-screen keyboard opens on mobile, instead of being covered by it.
function useVisualViewportHeight() {
  const [vh, setVh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const update = () => setVh(vv ? vv.height : window.innerHeight);
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return vh;
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
    navigator.maxTouchPoints > 0
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS — browser Notification API
// (works while the tab/window is open, even minimized or in the
//  background. A fully-closed browser needs push via a service worker
//  + FCM, which is a separate backend feature — see chat note.)
// ═══════════════════════════════════════════════════════════════
const NOTIF_PREF_KEY = "awy_chat_notify";

function getNotifPref() {
  try { return localStorage.getItem(NOTIF_PREF_KEY) === "on"; } catch { return false; }
}
function setNotifPref(val) {
  try { localStorage.setItem(NOTIF_PREF_KEY, val ? "on" : "off"); } catch {}
}

// Watches every chat the user is part of and fires a Notification when a
// new message lands from someone else while the tab is hidden / unfocused.
// Reads the lightweight `lastMessage` / `lastSenderId` fields already kept
// on each chat doc — no extra per-message listeners needed.
function useChatNotifications(currentUser, active, onOpenChat) {
  const lastSeenRef  = useRef(new Map());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!currentUser?.uid || !active) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (firstLoadRef.current) {
        snap.docs.forEach(d => {
          lastSeenRef.current.set(d.id, d.data().lastMessageAt?.toMillis?.() || 0);
        });
        firstLoadRef.current = false;
        return;
      }

      snap.docs.forEach(d => {
        const data   = d.data();
        const millis = data.lastMessageAt?.toMillis?.() || 0;
        const prev   = lastSeenRef.current.get(d.id) || 0;
        if (millis <= prev) return;
        lastSeenRef.current.set(d.id, millis);

        const fromOther = data.lastSenderId && data.lastSenderId !== currentUser.uid;
        const tabHidden  = document.hidden || !document.hasFocus();
        if (!fromOther || !tabHidden) return;

        const otherId    = data.participants.find(p => p !== currentUser.uid);
        const senderName = data.participantNames?.[otherId] || "New message";
        try {
          const n = new Notification(senderName, {
            body: data.lastMessage || "Sent you a message",
            tag: `chat_${d.id}`,
            renotify: true,
          });
          n.onclick = () => {
            window.focus();
            onOpenChat?.(d.id, { uid: otherId, name: senderName });
            n.close();
          };
        } catch (e) { console.error("Notification failed:", e); }
      });
    });
    return () => unsub();
  }, [currentUser?.uid, active]);
}

// ═══════════════════════════════════════════════════════════════
// EMOJI PICKER — no external library
// ═══════════════════════════════════════════════════════════════
const EMOJI_GROUPS = [
  { label: "😊 Smileys", emojis: ["😀","😁","😂","🤣","😃","😄","😅","😆","😇","😈","😉","😊","😋","😌","😍","🥰","😎","😏","😐","😑","😒","😓","😔","😕","😖","😗","😘","😙","😚","😛","😜","😝","😞","😟","😠","😡","😢","😣","😤","😥","😦","😧","😨","😩","😪","😫","😬","😭","😮","😯","😰","😱","😲","😳","😴","😵","😶","😷","🙁","🙂","🙃","🙄","🤐","🤑","🤒","🤓","🤔","🤕","🤗","🤨","🤩","🤪","🤫","🤬","🤭","🤮","🤯","🥱","🥲","🥳","🥴","🥵","🥶","🥹","🫠","🫡"] },
  { label: "❤️ Hearts",  emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","🫀","💌","💋","🥰","😍"] },
  { label: "👋 Hands",   emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","💅","🤳"] },
  { label: "🌸 Nature",  emojis: ["🌸","🌹","🌺","🌻","🌼","🌷","🌱","🌿","🍀","🍁","🍂","🍃","🌾","☘️","🌵","🌴","🌳","🌲","🍄","🦋","🐝","🐛","🐞","🌍","🌕","⭐","🌟","💫","✨","☀️","🌈","⛅","☁️","🌧️","❄️","🌊","🌙","🔥","💧","🌬️"] },
  { label: "🍕 Food",    emojis: ["🍕","🍔","🌮","🌯","🥗","🍜","🍣","🍱","🍩","🎂","🍰","🧁","🍫","🍬","🍭","🍦","🍨","🍧","🧃","☕","🍵","🧋","🥤","🍺","🥂","🍾","🥃","🍷","🧇","🥞","🍿"] },
  { label: "⚽ Sport",   emojis: ["⚽","🏀","🏈","⚾","🎾","🏐","🎱","🏓","🏸","🥊","🎯","🎳","🏹","🏋️","🤸","🏊","🚴","🎤","🎧","🎹","🥁","🎸","🎺","🎮","🎲","♟️","🎭","🎨","🃏","🎰"] },
  { label: "💎 Objects", emojis: ["💎","💍","👑","🎀","🎁","🎈","🎉","🎊","🧨","✨","🎆","🎇","🪄","🔮","💡","🔦","📱","💻","⌚","📷","🔑","🗝️","💰","💳","📝","📌","📍","📎","✂️","🔧","🔨","⚙️","🧲","🛡️","⚔️","🪞","🧸","🪆"] },
];

const QUICK_REACTIONS = ["❤️","😂","😮","😢","😡","👍","👎","🔥","💯","🎉"];

function EmojiPicker({ onSelect, onClose, isMini }) {
  const [tab, setTab]     = useState(0);
  const [search, setSearch] = useState("");
  const pickerRef         = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = search
    ? EMOJI_GROUPS.flatMap(g => g.emojis).filter(e => e.includes(search))
    : EMOJI_GROUPS[tab].emojis;

  return (
    <div ref={pickerRef} style={{
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: isMini ? 0 : "auto",
      right: isMini ? "auto" : 0,
      width: isMini ? 260 : 300,
      background: "var(--dropdown-bg)",
      backdropFilter: "blur(40px)",
      border: "1px solid var(--glass-border)",
      borderRadius: 16,
      boxShadow: "var(--dropdown-shadow)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      animation: "slideUp 0.18s ease",
    }}>
      {/* Search */}
      <div style={{ padding: "10px 10px 4px" }}>
        <input
          className="glass-input"
          style={{ width: "100%", fontSize: 16, padding: "8px 10px" }}
          placeholder="Search emoji…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="no-scrollbar" style={{ display: "flex", overflowX: "auto", padding: "4px 8px", gap: 3 }}>
          {EMOJI_GROUPS.map((g, i) => (
            <button key={g.label} onClick={() => setTab(i)} style={{
              background:  tab === i ? "var(--accent-bg)" : "transparent",
              border:      tab === i ? "1px solid var(--accent-border)" : "1px solid transparent",
              color:       "var(--text-color)",
              fontSize:    11,
              padding:     "5px 9px",
              borderRadius: 8,
              cursor:      "pointer",
              whiteSpace:  "nowrap",
              flexShrink:  0,
              opacity:     tab === i ? 1 : 0.55,
            }}>
              {g.label.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="no-scrollbar" style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: 1,
        padding: "4px 8px 10px",
        maxHeight: 180,
        overflowY: "auto",
      }}>
        {filtered.map((e, i) => (
          <button key={i} onClick={() => onSelect(e)} title={e} style={{
            background: "transparent",
            border: "none",
            fontSize: 21,
            cursor: "pointer",
            borderRadius: 6,
            padding: "5px",
          }}
            onMouseEnter={el => el.currentTarget.style.background = "var(--accent-bg)"}
            onMouseLeave={el => el.currentTarget.style.background = "transparent"}
          >{e}</button>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "span 8", textAlign: "center", padding: 14, fontSize: 11, color: "var(--text-color)", opacity: 0.4 }}>
            No results 😅
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IMAGE LIGHTBOX
// ═══════════════════════════════════════════════════════════════
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "zoom-out",
        animation: "fadeIn 0.2s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <img
        src={src} alt="shared"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "92vw", maxHeight: "88vh",
          borderRadius: 14,
          boxShadow: "0 12px 60px rgba(0,0,0,0.8)",
          objectFit: "contain",
          cursor: "default",
          animation: "zoomIn 0.22s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: "max(18px, env(safe-area-inset-top))", right: "max(18px, env(safe-area-inset-right))",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff", width: 40, height: 40,
          borderRadius: "50%", fontSize: 18,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REACTION BAR
// ═══════════════════════════════════════════════════════════════
function ReactionBar({ reactions = {}, myUid, onReact }) {
  const entries = Object.entries(reactions).filter(([, uids]) => uids.length > 0);
  if (!entries.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
      {entries.map(([emoji, uids]) => (
        <button key={emoji} onClick={() => onReact(emoji)} style={{
          background:  uids.includes(myUid) ? "var(--accent-bg)"    : "var(--input-bg)",
          border:      uids.includes(myUid) ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
          borderRadius: 20, padding: "4px 10px", fontSize: 12, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 3,
          color: "var(--text-color)",
        }}>
          <span>{emoji}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: uids.includes(myUid) ? "var(--accent)" : "inherit" }}>
            {uids.length}
          </span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════
function MessageBubble({ msg, isMine, showTime, currentUser, chatId, onReply, isNew }) {
  const [hover, setHover]         = useState(false);
  const [tapped, setTapped]       = useState(false);
  const [pressing, setPressing]   = useState(false);
  const [showReact, setShowReact] = useState(false);
  const [lightbox, setLightbox]   = useState(false);
  const reactRef       = useRef(null);
  const wrapRef         = useRef(null);
  const pressTimer     = useRef(null);
  const longPressFired = useRef(false);
  const [touch]         = useState(isTouchDevice);

  const actionsVisible = hover || tapped;

  useEffect(() => {
    if (!showReact) return;
    const h = (e) => { if (reactRef.current && !reactRef.current.contains(e.target)) setShowReact(false); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [showReact]);

  // Tapping anywhere outside closes the long-press action toolbar
  useEffect(() => {
    if (!tapped) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setTapped(false); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [tapped]);

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const handleReact = async (emoji) => {
    setShowReact(false);
    try {
      const msgRef  = doc(db, "chats", chatId, "messages", msg.id);
      const current = (msg.reactions || {})[emoji] || [];
      const already = current.includes(currentUser.uid);
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: already
          ? current.filter(u => u !== currentUser.uid)
          : [...current, currentUser.uid],
      });
    } catch (e) { console.error("React failed:", e); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
        deleted: true, text: "", imageUrl: null,
      });
    } catch (e) { console.error("Delete failed:", e); }
  };

  // Long-press support — hover doesn't exist on touch, so a held tap
  // reveals the same action toolbar instead.
  const startPress = () => {
    if (!touch) return;
    setPressing(true);
    longPressFired.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setTapped(true);
      setPressing(false);
    }, 420);
  };
  const cancelPress = () => {
    clearTimeout(pressTimer.current);
    setPressing(false);
  };
  const consumeLongPress = () => {
    if (longPressFired.current) { longPressFired.current = false; return true; }
    return false;
  };

  const isDeleted = msg.deleted;

  return (
    <div
      ref={wrapRef}
      style={{ marginBottom: 2, ...(isNew ? { animation: "messageIn 0.32s cubic-bezier(0.16,1,0.3,1)" } : {}) }}
    >
      {/* Time separator */}
      {showTime && msg.createdAt && (
        <div style={{
          textAlign: "center", fontSize: 9,
          color: "var(--text-color)", opacity: 0.25,
          margin: "12px 0 6px",
        }}>
          {fullTimeLabel(msg.createdAt)}
        </div>
      )}

      {/* Reply-to preview */}
      {msg.replyTo && !isDeleted && (
        <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 2 }}>
          <div className="msg-bubble-wrap" style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            borderLeft: "3px solid var(--accent)",
            borderRadius: 10, padding: "5px 10px",
            fontSize: 11, color: "var(--text-color)", opacity: 0.65,
          }}>
            <div style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, marginBottom: 2 }}>
              ↩ {msg.replyTo.senderName}
            </div>
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {msg.replyTo.type === "image" ? "📷 Photo" : msg.replyTo.text}
            </div>
          </div>
        </div>
      )}

      {/* Row */}
      <div
        style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 5 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Action toolbar — hover (desktop) or long-press (touch) */}
        {actionsVisible && !isDeleted && (
          <div style={{
            display: "flex", gap: 4, alignItems: "center",
            order: isMine ? -1 : 1,
            animation: "fadeIn 0.12s ease",
          }}>
            {/* Quick emoji reactions */}
            {QUICK_REACTIONS.slice(0, 3).map(e => (
              <button key={e} onClick={() => handleReact(e)} style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                borderRadius: "50%", width: 30, height: 30, fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
                onMouseEnter={el => el.currentTarget.style.transform = "scale(1.2)"}
                onMouseLeave={el => el.currentTarget.style.transform = "scale(1)"}
              >{e}</button>
            ))}

            {/* More reactions picker */}
            <div ref={reactRef} style={{ position: "relative" }}>
              <button onClick={() => setShowReact(p => !p)} style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                borderRadius: "50%", width: 30, height: 30, fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>＋</button>
              {showReact && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  [isMine ? "right" : "left"]: 0,
                  background: "var(--dropdown-bg)",
                  backdropFilter: "blur(40px)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14, padding: 8,
                  display: "flex", flexWrap: "wrap", gap: 4,
                  maxWidth: 200,
                  boxShadow: "var(--dropdown-shadow)",
                  zIndex: 9999,
                  animation: "slideUp 0.15s ease",
                }}>
                  {QUICK_REACTIONS.map(e => (
                    <button key={e} onClick={() => handleReact(e)} style={{
                      background: "transparent", border: "none",
                      fontSize: 22, cursor: "pointer", padding: 5,
                      borderRadius: 6,
                    }}
                      onMouseEnter={el => el.currentTarget.style.background = "var(--accent-bg)"}
                      onMouseLeave={el => el.currentTarget.style.background = "transparent"}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Reply */}
            <button onClick={() => onReply(msg)} title="Reply" style={{
              background: "var(--input-bg)", border: "1px solid var(--input-border)",
              borderRadius: "50%", width: 30, height: 30, fontSize: 15,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>↩</button>

            {/* Delete (own messages only) */}
            {isMine && (
              <button onClick={handleDelete} title="Delete" style={{
                background: "var(--danger-bg)", border: "1px solid var(--danger-border)",
                borderRadius: "50%", width: 30, height: 30, fontSize: 14,
                cursor: "pointer", color: "var(--danger-color)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>🗑</button>
            )}
          </div>
        )}

        {/* BUBBLE */}
        <div className="msg-bubble-wrap">
          {isDeleted ? (
            <div style={{
              padding: "8px 13px",
              borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: "var(--input-bg)", border: "1px solid var(--input-border)",
              fontSize: 12, color: "var(--text-color)", opacity: 0.35, fontStyle: "italic",
            }}>
              🚫 Message deleted
            </div>
          ) : msg.type === "image" ? (
            /* Image bubble */
            <div
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onClick={() => { if (consumeLongPress()) return; if (!msg.uploading) setLightbox(true); }}
              style={{
                borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                overflow: "hidden",
                border: isMine ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
                cursor: msg.uploading ? "default" : "zoom-in",
                transform: pressing ? "scale(0.97)" : "scale(1)",
                transition: "transform 0.15s ease",
                WebkitTapHighlightColor: "transparent",
              }}>
              {msg.uploading ? (
                <div style={{
                  width: 200, height: 150, background: "var(--input-bg)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 10,
                }}>
                  <div style={{ width: 36, height: 36, border: "3px solid var(--input-border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.5 }}>
                    {msg.progress ? `${msg.progress}%` : "Uploading…"}
                  </div>
                  {/* Mini progress bar */}
                  <div style={{ width: "70%", height: 3, borderRadius: 99, background: "var(--input-border)" }}>
                    <div style={{ height: "100%", width: `${msg.progress || 0}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
                  </div>
                </div>
              ) : (
                <img
                  src={msg.imageUrl} alt="shared"
                  style={{ display: "block", maxWidth: 230, maxHeight: 300, objectFit: "cover" }}
                />
              )}
              {msg.text && (
                <div style={{ padding: "6px 12px 8px", background: isMine ? "var(--accent-bg)" : "var(--input-bg)", fontSize: 12, color: "var(--text-color)" }}>
                  {msg.text}
                </div>
              )}
            </div>
          ) : (
            /* Text bubble */
            <div
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              style={{
                padding: "9px 13px",
                borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: isMine ? "var(--accent-bg)"    : "var(--input-bg)",
                border:     isMine ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
                fontSize: 14, color: "var(--text-color)", lineHeight: 1.5,
                wordBreak: "break-word", whiteSpace: "pre-wrap",
                transform: pressing ? "scale(0.97)" : "scale(1)",
                transition: "transform 0.15s ease",
                WebkitTapHighlightColor: "transparent",
              }}>
              {msg.text}
            </div>
          )}

          {/* Reactions */}
          <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
            <ReactionBar reactions={msg.reactions} myUid={currentUser.uid} onReact={handleReact} />
          </div>

          {/* Timestamp + read receipt */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: isMine ? "flex-end" : "flex-start", marginTop: 2 }}>
            <span style={{ fontSize: 9, color: "var(--text-color)", opacity: 0.22 }}>
              {msg.createdAt ? timeLabel(msg.createdAt) : ""}
            </span>
            {isMine && !isDeleted && (
              <span style={{ fontSize: 10, color: msg.seen ? "var(--accent)" : "var(--text-color)", opacity: msg.seen ? 0.85 : 0.3, fontWeight: 700 }}>
                {msg.seen ? "✓✓" : "✓"}
              </span>
            )}
          </div>
        </div>
      </div>

      {lightbox && msg.imageUrl && <Lightbox src={msg.imageUrl} onClose={() => setLightbox(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEARCH PANEL
// ═══════════════════════════════════════════════════════════════
function SearchPanel({ onSelectUser, currentUid }) {
  const [query_, setQuery]    = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSearch = async () => {
    const q = query_.trim().toLowerCase().replace(/^@/, "");
    if (!q) return;
    setLoading(true); setError(""); setResults([]);
    try {
      const snap = await getDoc(doc(db, "usernames", q));
      if (snap.exists() && snap.data().uid !== currentUid) {
        const userSnap = await getDoc(doc(db, "users", snap.data().uid));
        if (userSnap.exists()) setResults([{ ...userSnap.data(), id: userSnap.id }]);
        else setError("User not found.");
      } else if (snap.data()?.uid === currentUid) {
        setError("That's you! Search for someone else.");
      } else {
        setError("No user found with that username.");
      }
    } catch { setError("Search failed. Try again."); }
    setLoading(false);
  };

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--accent)", opacity: 0.5, fontSize: 13 }}>@</span>
          <input
            className="glass-input"
            style={{ width: "100%", paddingLeft: 24, fontSize: 16 }}
            placeholder="username"
            value={query_}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            autoFocus
          />
        </div>
        <button className="glass-btn" style={{ padding: "9px 16px", fontSize: 13 }} onClick={handleSearch} disabled={loading}>
          {loading ? "…" : "Find"}
        </button>
      </div>

      {error && <p style={{ fontSize: 11, color: "var(--error-color)", marginBottom: 10 }}>{error}</p>}

      {results.map(u => (
        <div key={u.uid} className="tap-row" onClick={() => onSelectUser(u)} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "13px 14px", borderRadius: "var(--radius-md)", cursor: "pointer",
          background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--accent-strong)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--accent-bg)"}
        >
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
            {u.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-color)" }}>{u.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.4 }}>@{u.username}</div>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ color: "var(--accent)", opacity: 0.7 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHAT WINDOW
// ═══════════════════════════════════════════════════════════════
function ChatWindow({ chatId, currentUser, otherUser, onBack, onClose, isFullscreen }) {
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [otherTyping,   setOtherTyping]   = useState(false);
  const [otherPresence, setOtherPresence] = useState(null);
  const [replyTo,       setReplyTo]       = useState(null);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [showInfo,      setShowInfo]      = useState(false);
  const [showJump,      setShowJump]      = useState(false);
  const [newMsgIds,     setNewMsgIds]     = useState(() => new Set());

  const bottomRef     = useRef(null);
  const typingTimer   = useRef(null);
  const inputRef      = useRef(null);
  const fileInputRef  = useRef(null);
  const scrollRef     = useRef(null);
  const nearBottomRef = useRef(true);
  const seenIdsRef    = useRef(new Set());
  const firstLoadRef  = useRef(true);

  // Messages
  useEffect(() => {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Only flag messages as "new" (for the entrance animation) once we've
      // already seen the initial batch — otherwise every message would
      // animate in at once whenever a chat is opened.
      if (firstLoadRef.current) {
        list.forEach(m => seenIdsRef.current.add(m.id));
        firstLoadRef.current = false;
      } else {
        const fresh = new Set();
        list.forEach(m => {
          if (!seenIdsRef.current.has(m.id)) { fresh.add(m.id); seenIdsRef.current.add(m.id); }
        });
        if (fresh.size) setNewMsgIds(fresh);
      }

      setMessages(list);

      const batch = writeBatch(db);
      let pending = false;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.senderId !== currentUser.uid && !data.seen && !data.deleted) {
          batch.update(d.ref, { seen: true, seenAt: serverTimestamp() });
          pending = true;
        }
      });
      if (pending) batch.commit().catch(console.error);
    });
  }, [chatId, currentUser.uid]);

  // Clear the "new" flag shortly after the entrance animation has played
  useEffect(() => {
    if (newMsgIds.size === 0) return;
    const t = setTimeout(() => setNewMsgIds(new Set()), 500);
    return () => clearTimeout(t);
  }, [newMsgIds]);

  // Typing
  useEffect(() => {
    return onSnapshot(doc(db, "chats", chatId, "typing", otherUser.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setOtherTyping(d.isTyping && (Date.now() - (d.updatedAt?.toMillis?.() || 0)) < 5000);
      } else setOtherTyping(false);
    });
  }, [chatId, otherUser.uid]);

  // Presence
  useEffect(() => {
    return onSnapshot(doc(db, "users", otherUser.uid), (snap) => {
      if (snap.exists()) setOtherPresence(snap.data().lastActive);
    });
  }, [otherUser.uid]);

  // Smart auto-scroll: only snap to bottom if we're already near it, or the
  // newest message is our own. Otherwise surface a "new messages" pill so
  // we never yank someone away from history they're reading.
  useEffect(() => {
    const last = messages[messages.length - 1];
    const mine = last && last.senderId === currentUser.uid;
    if (nearBottomRef.current || mine) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowJump(false);
    } else if (messages.length) {
      setShowJump(true);
    }
  }, [messages, otherTyping, currentUser.uid]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = dist < 120;
    if (nearBottomRef.current) setShowJump(false);
  };

  const jumpToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJump(false);
  };

  const isOnline = otherPresence && (Date.now() - (otherPresence?.toMillis?.() || 0)) < 120000;

  const setMyTyping = useCallback(async (val) => {
    try { await setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), { isTyping: val, updatedAt: serverTimestamp() }); } catch {}
  }, [chatId, currentUser.uid]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
    setMyTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setMyTyping(false), 2000);
  };

  const ensureChat = async (lastMsg) => {
    await setDoc(doc(db, "chats", chatId), {
      participants:     [currentUser.uid, otherUser.uid],
      participantNames: { [currentUser.uid]: currentUser.name || "", [otherUser.uid]: otherUser.name || "" },
      lastMessage:      lastMsg,
      lastMessageAt:    serverTimestamp(),
      updatedAt:        serverTimestamp(),
    }, { merge: true });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || uploading) return;
    setInput("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    clearTimeout(typingTimer.current);
    setMyTyping(false);
    const reply = replyTo;
    setReplyTo(null);
    nearBottomRef.current = true; // sending always brings you to the bottom
    try {
      await ensureChat(text);
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text, type: "text",
        senderId:   currentUser.uid,
        senderName: currentUser.name || "",
        createdAt:  serverTimestamp(),
        seen:       false,
        reactions:  {},
        ...(reply ? { replyTo: { id: reply.id, text: reply.text || "", senderName: reply.senderName || "", type: reply.type || "text" } } : {}),
      });
    } catch (e) { console.error("Send failed:", e); }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image."); return; }
    if (file.size > 10 * 1024 * 1024)   { alert("Image must be under 10 MB."); return; }
    e.target.value = "";

    setUploading(true);
    setUploadPct(0);
    nearBottomRef.current = true;

    const tempId   = `temp_${Date.now()}`;
    const localUrl = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      id: tempId, senderId: currentUser.uid, senderName: currentUser.name || "",
      type: "image", imageUrl: localUrl, uploading: true, progress: 0,
      createdAt: null, seen: false, reactions: {},
    }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const storageRef = ref(storage, `chat_images/${chatId}/${Date.now()}_${file.name}`);
      const task       = uploadBytesResumable(storageRef, file);

      await new Promise((res, rej) => {
        task.on("state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadPct(pct);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, progress: pct } : m));
          },
          rej, res
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);
      URL.revokeObjectURL(localUrl);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      await ensureChat("📷 Photo");
      await addDoc(collection(db, "chats", chatId, "messages"), {
        type: "image", imageUrl: url, text: input.trim() || "",
        senderId:   currentUser.uid, senderName: currentUser.name || "",
        createdAt:  serverTimestamp(), seen: false, reactions: {},
        ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text || "", senderName: replyTo.senderName || "", type: "image" } } : {}),
      });
      setReplyTo(null);
    } catch (err) {
      console.error("Upload failed:", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert("Upload failed. Check Firebase Storage rules.");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape") { setReplyTo(null); setShowEmoji(false); }
  };

  const totalMsgs    = messages.filter(m => !m.deleted).length;
  const sharedPhotos = messages.filter(m => m.type === "image" && !m.deleted).length;
  const safeTop       = "max(14px, env(safe-area-inset-top))";
  const safeBottom    = "max(14px, env(safe-area-inset-bottom))";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── HEADER ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: isFullscreen ? `${safeTop} 20px 14px` : "10px 14px",
        borderBottom: "1px solid var(--divider)",
        background: "var(--accent-bg)", flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px 6px 4px 0" }} title="Back">
          <svg width={isFullscreen ? 22 : 20} height={isFullscreen ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        {/* Avatar + name — tap to toggle info */}
        <button onClick={() => setShowInfo(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, padding: 0, textAlign: "left" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: isFullscreen ? 42 : 36, height: isFullscreen ? 42 : 36,
              borderRadius: "50%", background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isFullscreen ? 18 : 15, fontWeight: 700, color: "var(--accent)",
            }}>
              {otherUser.name?.[0]?.toUpperCase() || "?"}
            </div>
            {isOnline && (
              <div style={{ position: "absolute", bottom: 0, right: -2, width: 10, height: 10, background: "var(--online-dot)", borderRadius: "50%", border: "2px solid var(--bg-color)" }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isFullscreen ? 15 : 13, fontWeight: 600, color: "var(--text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {otherUser.name}
            </div>
            <div style={{ fontSize: 10, color: isOnline && !otherTyping ? "var(--online-dot)" : "var(--text-color)", opacity: isOnline && !otherTyping ? 1 : 0.45 }}>
              {otherTyping
                ? <span style={{ color: "var(--accent)", fontWeight: 500 }}>typing…</span>
                : isOnline ? "Online now" : `@${otherUser.username || ""}`
              }
            </div>
          </div>
        </button>

        {onClose && (
          <button onClick={onClose} style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-color)", borderRadius: "var(--radius-sm)", width: 30, height: 30, cursor: "pointer", flexShrink: 0, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.55 }}>✕</button>
        )}
      </div>

      {/* ── CHAT INFO BAR ── */}
      {showInfo && (
        <div style={{ background: "var(--glass-bg)", borderBottom: "1px solid var(--divider)", padding: "12px 20px", animation: "slideDown 0.2s ease", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", gap: 16 }}>
            {[
              { label: "Messages", value: totalMsgs },
              { label: "Photos",   value: sharedPhotos },
              { label: "Status",   value: isOnline ? "🟢 Online" : "⚫ Offline" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--accent)" }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "var(--text-color)", opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="no-scrollbar"
          style={{
            height: "100%", overflowY: "auto",
            padding: isFullscreen ? "16px 20px" : "10px 12px",
            display: "flex", flexDirection: "column",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", marginTop: 60, fontSize: 12, color: "var(--text-color)", opacity: 0.3 }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>👋</div>
              Say hello to <strong>{otherUser.name}</strong>!
            </div>
          )}

          {messages.map((msg, i) => {
            const prevMsg  = messages[i - 1];
            const showTime = !prevMsg || ((msg.createdAt?.toMillis?.() || 0) - (prevMsg.createdAt?.toMillis?.() || 0)) > 300000;
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMine={msg.senderId === currentUser.uid}
                showTime={showTime}
                currentUser={currentUser}
                chatId={chatId}
                onReply={setReplyTo}
                isNew={newMsgIds.has(msg.id) || msg.id.startsWith("temp_")}
              />
            );
          })}

          {/* Typing dots */}
          {otherTyping && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <div style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: "18px 18px 18px 4px", padding: "10px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Jump-to-bottom pill — only shown when scrolled up and a new message lands */}
        {showJump && (
          <button onClick={jumpToBottom} style={{
            position: "absolute", bottom: 14, right: 16,
            background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
            color: "var(--accent)", borderRadius: 20, padding: "7px 14px",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            boxShadow: "var(--dropdown-shadow)",
            display: "flex", alignItems: "center", gap: 5,
            animation: "slideUp 0.18s ease",
          }}>
            ↓ New messages
          </button>
        )}
      </div>

      {/* ── REPLY PREVIEW BAR ── */}
      {replyTo && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "7px 14px", borderTop: "1px solid var(--divider)",
          background: "var(--accent-bg)", flexShrink: 0,
          animation: "slideUp 0.18s ease",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>↩ Replying to {replyTo.senderName}</div>
            <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {replyTo.type === "image" ? "📷 Photo" : replyTo.text}
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "var(--text-color)", opacity: 0.45, cursor: "pointer", fontSize: 17, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── INPUT BAR ── */}
      <div style={{
        padding: isFullscreen ? `10px 20px ${safeBottom}` : "8px 12px 10px",
        borderTop: replyTo ? "none" : "1px solid var(--divider)",
        flexShrink: 0, position: "relative",
      }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>

          {/* Image button */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Send photo" style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "var(--input-bg)", border: "1px solid var(--input-border)",
            color: "var(--text-color)", opacity: uploading ? 0.3 : 0.65,
            cursor: uploading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {uploading ? (
              <div style={{ width: 14, height: 14, border: "2px solid var(--input-border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </button>

          {/* Emoji button */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setShowEmoji(p => !p)} title="Emoji" style={{
              width: 38, height: 38, borderRadius: "50%",
              background: showEmoji ? "var(--accent-bg)" : "var(--input-bg)",
              border: showEmoji ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
              fontSize: 17, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>😊</button>
            {showEmoji && (
              <EmojiPicker
                onSelect={(e) => { setInput(p => p + e); setShowEmoji(false); inputRef.current?.focus(); }}
                onClose={() => setShowEmoji(false)}
                isMini={!isFullscreen}
              />
            )}
          </div>

          {/* Text area */}
          <textarea
            ref={inputRef}
            className="glass-input no-scrollbar"
            style={{
              flex: 1, fontSize: 16, borderRadius: 20,
              padding: "9px 14px", resize: "none",
              minHeight: 38, maxHeight: 110,
              lineHeight: 1.4, overflowY: "auto",
            }}
            placeholder="Message…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          {/* Send button */}
          <button onClick={sendMessage} disabled={!input.trim() || uploading} title="Send" style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            background:  input.trim() ? "var(--accent-bg)"    : "var(--input-bg)",
            border:      input.trim() ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
            color:       input.trim() ? "var(--accent)"        : "var(--text-color)",
            cursor:      input.trim() ? "pointer"              : "not-allowed",
            opacity:     input.trim() ? 1 : 0.3,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginLeft: 1, transform: "rotate(-10deg)" }}>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div style={{ marginTop: 6, height: 3, borderRadius: 99, background: "var(--input-border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${uploadPct}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATIONS LIST
// ═══════════════════════════════════════════════════════════════
function ConversationList({ currentUser, onSelectChat }) {
  const [convos,  setConvos]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const list = await Promise.all(snap.docs.map(async (d) => {
        const data    = d.data();
        const otherId = data.participants.find(p => p !== currentUser.uid);
        let otherUser = { uid: otherId, name: data.participantNames?.[otherId] || "User", username: "" };
        try {
          const uDoc = await getDoc(doc(db, "users", otherId));
          if (uDoc.exists()) otherUser = { uid: otherId, ...uDoc.data() };
        } catch {}
        let unread = 0;
        try {
          const msgQ = query(collection(db, "chats", d.id, "messages"), where("seen", "==", false));
          const snap2 = await getDocs(msgQ);
          unread = snap2.docs.filter(doc => doc.data().senderId !== currentUser.uid).length;
        } catch {}
        return {
          chatId: d.id, otherUser,
          lastMessage: data.lastMessage || "",
          lastMessageAt: data.lastMessageAt,
          updatedAt: data.updatedAt?.toMillis?.() || 0,
          unread,
        };
      }));
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setConvos(list.filter(Boolean));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [currentUser?.uid]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 50, color: "var(--text-color)", opacity: 0.3, fontSize: 13 }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>💬</div>
      Loading chats…
    </div>
  );

  if (convos.length === 0) return (
    <div style={{ textAlign: "center", padding: 50, color: "var(--text-color)", opacity: 0.3, fontSize: 12 }}>
      <div style={{ fontSize: 34, marginBottom: 12 }}>🌸</div>
      No conversations yet.<br />
      <span style={{ opacity: 0.6 }}>Search a username to start chatting!</span>
    </div>
  );

  return (
    <div style={{ padding: "4px 8px" }}>
      {convos.map(c => (
        <div key={c.chatId} className="tap-row" onClick={() => onSelectChat(c.chatId, c.otherUser)} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 10px", borderRadius: "var(--radius-md)",
          cursor: "pointer", marginBottom: 2,
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--accent-bg)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, position: "relative", color: "var(--accent)" }}>
            {c.otherUser.name?.[0]?.toUpperCase() || "?"}
            {c.unread > 0 && (
              <div style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "var(--accent)", color: "var(--bg-color)", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg-color)" }}>
                {c.unread > 9 ? "9+" : c.unread}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: c.unread > 0 ? 700 : 500, color: "var(--text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.otherUser.name}
            </div>
            <div style={{ fontSize: 11, color: c.unread > 0 ? "var(--accent)" : "var(--text-color)", opacity: c.unread > 0 ? 0.8 : 0.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: c.unread > 0 ? 600 : 400 }}>
              {c.lastMessage || "Start chatting"}
            </div>
          </div>
          {c.lastMessageAt && (
            <div style={{ fontSize: 9, color: "var(--text-color)", opacity: 0.25, flexShrink: 0 }}>
              {timeLabel(c.lastMessageAt)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CHAT PANEL  ←  fullscreen + mobile-sheet + swipe-to-dismiss
// ═══════════════════════════════════════════════════════════════
export default function ChatPanel({ currentUser, onClose }) {
  const [view,         setView]         = useState("home");
  const [activeChat,   setActiveChat]   = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragY,        setDragY]        = useState(0);

  const isMobile  = useIsMobile(680);
  const winSize   = useViewportSize();
  const mobileVh  = useVisualViewportHeight();
  const dragState = useRef({ active: false, startY: 0 });

  // On a phone, a floating mini-bubble doesn't make sense — always use the
  // full-screen sheet there. On desktop the toggle still works as before.
  const effectiveFullscreen = isFullscreen || isMobile;

  const handleSelectUser = (otherUser) => {
    const chatId = getChatId(currentUser.uid, otherUser.uid);
    setActiveChat({ chatId, otherUser });
    setView("chat");
  };

  // ── Swipe-down-to-dismiss (mobile only, via the grab handle) ──
  const onGrabStart = (e) => {
    dragState.current = { active: true, startY: e.touches[0].clientY };
  };
  const onGrabMove = (e) => {
    if (!dragState.current.active) return;
    const dy = e.touches[0].clientY - dragState.current.startY;
    if (dy > 0) setDragY(dy);
  };
  const onGrabEnd = () => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    if (dragY > 110) { onClose?.(); return; }
    setDragY(0);
  };

  // ── Panel geometry — always expressed as top/left/width/height so the
  //     mini ⇄ fullscreen toggle can animate smoothly on desktop. ──
  const MINI_W = 360, MINI_H = 560, MINI_MARGIN_R = 28, MINI_MARGIN_B = 94;

  const panelRect = effectiveFullscreen
    ? { top: 0, left: 0, width: winSize.w, height: isMobile ? mobileVh : winSize.h, radius: 0 }
    : {
        top:    Math.max(20, winSize.h - MINI_H - MINI_MARGIN_B),
        left:   Math.max(12, winSize.w - MINI_W - MINI_MARGIN_R),
        width:  MINI_W,
        height: MINI_H,
        radius: "var(--glass-radius)",
      };

  const panelStyle = {
    position: "fixed",
    top: panelRect.top,
    left: panelRect.left,
    width: panelRect.width,
    height: panelRect.height,
    zIndex: 9990,
    transition: isMobile
      ? "none"
      : "top 0.35s cubic-bezier(0.16,1,0.3,1), left 0.35s cubic-bezier(0.16,1,0.3,1), width 0.35s cubic-bezier(0.16,1,0.3,1), height 0.35s cubic-bezier(0.16,1,0.3,1)",
    transform: dragY ? `translateY(${dragY}px)` : undefined,
    opacity: dragY ? Math.max(1 - dragY / 400, 0.5) : 1,
  };

  return (
    <>
      <div
        className={isMobile ? "chat-sheet" : "chat-pop"}
        style={{ display: "flex", flexDirection: "column", ...panelStyle }}
      >
        <div className="glass-panel" style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column", overflow: "hidden",
          borderRadius: panelRect.radius,
        }}>

          {/* ── DRAG HANDLE — mobile only, swipe down to close ── */}
          {isMobile && (
            <div
              onTouchStart={onGrabStart}
              onTouchMove={onGrabMove}
              onTouchEnd={onGrabEnd}
              style={{
                display: "flex", justifyContent: "center",
                padding: "max(8px, env(safe-area-inset-top)) 0 2px",
                flexShrink: 0, touchAction: "none", cursor: "grab",
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--input-border)" }} />
            </div>
          )}

          {/* ── HEADER (home + search views) ── */}
          {view !== "chat" && (
            <div style={{
              padding: effectiveFullscreen ? "12px 22px 16px" : "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid var(--divider)", flexShrink: 0,
            }}>
              {view !== "home" && (
                <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 22, cursor: "pointer", padding: "0 8px 0 0", lineHeight: 1 }}>‹</button>
              )}

              <div className="font-display gradient-text-rose" style={{ fontSize: effectiveFullscreen ? 18 : 14, fontWeight: 600, letterSpacing: 1, flex: 1 }}>
                {view === "search" ? "Find Friends" : "Messages"}
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {/* New chat search */}
                {view === "home" && (
                  <button onClick={() => setView("search")} title="New chat" style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", color: "var(--accent)", borderRadius: "var(--radius-sm)", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                  </button>
                )}

                {/* ── FULLSCREEN TOGGLE — desktop only; mobile is always fullscreen ── */}
                {!isMobile && (
                  <button
                    onClick={() => setIsFullscreen(p => !p)}
                    title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
                    style={{
                      background: isFullscreen ? "var(--accent-bg)" : "var(--input-bg)",
                      border:     isFullscreen ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
                      color:      isFullscreen ? "var(--accent)" : "var(--text-color)",
                      borderRadius: "var(--radius-sm)",
                      width: 32, height: 32, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: 0.8,
                    }}
                  >
                    {isFullscreen ? (
                      /* Compress icon */
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="10" y1="14" x2="3" y2="21" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                      </svg>
                    ) : (
                      /* Expand icon */
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Close */}
                <button onClick={onClose} style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-color)", opacity: 0.5, borderRadius: "var(--radius-sm)", width: 32, height: 32, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            </div>
          )}

          {/* ── CONTENT ── */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {view === "home" && (
              <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <ConversationList
                  currentUser={currentUser}
                  onSelectChat={(id, u) => { setActiveChat({ chatId: id, otherUser: u }); setView("chat"); }}
                />
              </div>
            )}
            {view === "search" && (
              <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <SearchPanel currentUid={currentUser.uid} onSelectUser={handleSelectUser} />
              </div>
            )}
            {view === "chat" && activeChat && (
              <ChatWindow
                chatId={activeChat.chatId}
                currentUser={currentUser}
                otherUser={activeChat.otherUser}
                onBack={() => setView("home")}
                onClose={onClose}
                isFullscreen={effectiveFullscreen}
              />
            )}
          </div>

          {/* ── MY USERNAME FOOTER ── */}
          {view === "home" && currentUser?.username && (
            <div style={{ padding: "7px 16px max(7px, env(safe-area-inset-bottom))", borderTop: "1px solid var(--divider)", fontSize: 10, color: "var(--text-color)", opacity: 0.3, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span>Your ID:</span>
              <span style={{ color: "var(--accent)", opacity: 0.6, fontWeight: 600 }}>@{currentUser.username}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CSS ── */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-5px); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes messageIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes chatPopIn {
          from { transform: scale(0.88) translateY(20px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .chat-pop   { animation: chatPopIn 0.3s cubic-bezier(0.16,1,0.3,1); }
        .chat-sheet { animation: sheetSlideUp 0.32s cubic-bezier(0.16,1,0.3,1); }

        /* Bubbles get a bit more breathing room on narrow screens */
        .msg-bubble-wrap { max-width: 68%; }
        @media (max-width: 680px) {
          .msg-bubble-wrap { max-width: 84%; }
        }

        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }

        /* Instant, no-flash taps everywhere in the panel */
        .chat-pop button, .chat-sheet button {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform 0.12s ease, background 0.15s ease, opacity 0.15s ease;
        }
        .chat-pop button:not(:disabled):active, .chat-sheet button:not(:disabled):active {
          transform: scale(0.93);
        }
        .tap-row {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform 0.12s ease, background 0.15s ease;
        }
        .tap-row:active { transform: scale(0.98); }

        @media (prefers-reduced-motion: reduce) {
          .chat-pop, .chat-sheet, .chat-pop *, .chat-sheet * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}