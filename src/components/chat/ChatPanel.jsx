import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, doc, setDoc, getDoc, getDocs, updateDoc,
  writeBatch, limit
} from "firebase/firestore";
import { db, auth } from "../../services/firebase/config";

// ── Helpers ──────────────────────────────────────────────────
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function timeLabel(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// ── Search / Add Friend Panel ─────────────────────────────────
function SearchPanel({ onSelectUser, currentUid }) {
  const [query_, setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

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
    } catch (e) {
      setError("Search failed. Try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: "rgba(255,182,193,0.5)", fontSize: 13
          }}>@</span>
          <input
            className="glass-input"
            style={{ width: "100%", paddingLeft: 22, fontSize: 13 }}
            placeholder="username or email"
            value={query_}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button
          className="glass-btn"
          style={{ padding: "8px 14px", fontSize: 12 }}
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "..." : "Find"}
        </button>
      </div>

      {error && <p style={{ fontSize: 11, color: "#ff8a8a", marginBottom: 8 }}>{error}</p>}

      {results.map(u => (
        <div
          key={u.uid}
          onClick={() => onSelectUser(u)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 12, cursor: "pointer",
            background: "rgba(255,182,193,0.06)",
            border: "1px solid rgba(255,182,193,0.12)",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,182,193,0.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,182,193,0.06)"}
        >
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(255,182,193,0.4), rgba(212,163,115,0.4))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0
          }}>
            {u.name?.[0]?.toUpperCase() || "?"}
          </div>
          
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-color)" }}>{u.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{u.username}</div>
          </div>
          
          {/* Emoji replaced with Chat Bubble SVG */}
          <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center" }}>
            <svg 
              viewBox="0 0 24 24" 
              width="18" 
              height="18" 
              fill="currentColor"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Individual Chat Window ────────────────────────────────────
function ChatWindow({ chatId, currentUser, otherUser, onBack, onClose }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherPresence, setOtherPresence] = useState(null);
  const bottomRef  = useRef(null);
  const typingTimer = useRef(null);
  const inputRef   = useRef(null);

  // ── Subscribe to messages ────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // Mark incoming messages as seen
      const batch = writeBatch(db);
      let hasPending = false;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.senderId !== currentUser.uid && !data.seen) {
          batch.update(d.ref, { seen: true, seenAt: serverTimestamp() });
          hasPending = true;
        }
      });
      if (hasPending) batch.commit().catch(console.error);
    });
    return () => unsub();
  }, [chatId, currentUser.uid]);

  // ── Subscribe to typing indicator ─────────────────────────
  useEffect(() => {
    const docRef = doc(db, "chats", chatId, "typing", otherUser.uid);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const elapsed = Date.now() - (data.updatedAt?.toMillis?.() || 0);
        setOtherTyping(data.isTyping && elapsed < 5000);
      } else {
        setOtherTyping(false);
      }
    });
    return () => unsub();
  }, [chatId, otherUser.uid]);

  // ── Subscribe to user presence ────────────────────────────
  useEffect(() => {
    const docRef = doc(db, "users", otherUser.uid);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setOtherPresence(snap.data().lastActive);
      }
    });
    return () => unsub();
  }, [otherUser.uid]);

  // Determine if online (active within last 2 minutes)
  const isOnline = otherPresence && (Date.now() - (otherPresence?.toMillis?.() || 0)) < 120000;

  // ── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  // ── Typing indicator broadcast ────────────────────────────
  const setMyTyping = useCallback(async (isTyping) => {
    try {
      await setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
        isTyping,
        updatedAt: serverTimestamp(),
      });
    } catch {}
  }, [chatId, currentUser.uid]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setMyTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setMyTyping(false), 2000);
  };

  // ── Send message ──────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    clearTimeout(typingTimer.current);
    setMyTyping(false);

    try {
      // Ensure chat doc exists
      await setDoc(doc(db, "chats", chatId), {
        participants: [currentUser.uid, otherUser.uid],
        participantNames: {
          [currentUser.uid]: currentUser.name || "",
          [otherUser.uid]: otherUser.name || "",
        },
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text,
        senderId: currentUser.uid,
        senderName: currentUser.name || "",
        createdAt: serverTimestamp(),
        seen: false,
      });
    } catch (e) {
      console.error("Send failed:", e);
    }
  };

  const myUid = currentUser.uid;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderBottom: "1px solid rgba(128,128,128,0.15)",
        background: "rgba(255,182,193,0.05)", flexShrink: 0
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", color: "var(--text-color)",
            cursor: "pointer", display: "flex", alignItems: "center", padding: "4px 8px 4px 0",
            marginRight: -4
          }}
          title="Back to Messages"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(255,182,193,0.4), rgba(212,163,115,0.3))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700,
            border: "1px solid rgba(255,182,193,0.3)"
          }}>
            {otherUser.name?.[0]?.toUpperCase() || "?"}
          </div>
          {isOnline && (
            <div style={{
              position: "absolute", bottom: 0, right: -2, width: 10, height: 10,
              background: "#4ade80", borderRadius: "50%", border: "2px solid #1a0a12",
              boxShadow: "0 0 4px rgba(74, 222, 128, 0.4)"
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{otherUser.name}</div>
          <div style={{ fontSize: 11, color: isOnline && !otherTyping ? "#a7f3d0" : "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {otherTyping ? <span style={{ color: "#ffb6c1", fontWeight: 500 }}>typing...</span> : 
             isOnline ? "Online" : `@${otherUser.username}`}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "rgba(128,128,128,0.1)", border: "1px solid rgba(128,128,128,0.15)",
              color: "rgba(255,255,255,0.4)", borderRadius: 8,
              width: 28, height: 28, cursor: "pointer", flexShrink: 0,
              fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title="Close"
          >✕</button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 6
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center", marginTop: 40,
            fontSize: 12, color: "rgba(255,255,255,0.3)"
          }}>
            Say hello to {otherUser.name}! 👋
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.senderId === myUid;
          const isLast = i === messages.length - 1;
          const showSeen = isMine && isLast && msg.seen;
          const prevMsg = messages[i - 1];
          const showTime = !prevMsg ||
            ((msg.createdAt?.toMillis?.() || 0) - (prevMsg.createdAt?.toMillis?.() || 0)) > 300000;

          return (
            <div key={msg.id}>
              {showTime && msg.createdAt && (
                <div style={{
                  textAlign: "center", fontSize: 9,
                  color: "rgba(255,255,255,0.25)",
                  margin: "8px 0 4px"
                }}>{timeLabel(msg.createdAt)}</div>
              )}
              <div style={{
                display: "flex",
                justifyContent: isMine ? "flex-end" : "flex-start"
              }}>
                <div style={{
                  maxWidth: "70%",
                  background: isMine
                    ? "linear-gradient(135deg, rgba(255,182,193,0.3), rgba(212,163,115,0.25))"
                    : "rgba(128,128,128,0.15)",
                  border: isMine
                    ? "1px solid rgba(255,182,193,0.25)"
                    : "1px solid rgba(128,128,128,0.2)",
                  borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "9px 13px",
                  fontSize: 13,
                  color: "var(--text-color)",
                  lineHeight: 1.4,
                  wordBreak: "break-word"
                }}>
                  {msg.text}
                </div>
              </div>
              {/* Seen indicator */}
              {showSeen && (
                <div style={{
                  textAlign: "right", fontSize: 10,
                  color: "rgba(255,182,193,0.5)",
                  marginTop: 2, paddingRight: 2
                }}>
                  ✓✓ Seen
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {otherTyping && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              background: "rgba(128,128,128,0.15)",
              border: "1px solid rgba(128,128,128,0.2)",
              borderRadius: "18px 18px 18px 4px",
              padding: "10px 16px",
              display: "flex", gap: 4, alignItems: "center"
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "rgba(255,182,193,0.6)",
                  animation: `typingBounce 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`
                }} />
              ))}
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>typing…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8, padding: "12px 14px",
        borderTop: "1px solid rgba(128,128,128,0.12)",
        flexShrink: 0
      }}>
        <input
          ref={inputRef}
          className="glass-input"
          style={{ flex: 1, fontSize: 13, borderRadius: 24, padding: "9px 14px" }}
          placeholder="Message..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          autoFocus
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: input.trim()
              ? "linear-gradient(135deg, rgba(255,182,193,0.4), rgba(212,163,115,0.3))"
              : "rgba(128,128,128,0.1)",
            border: `1px solid ${input.trim() ? "rgba(255,182,193,0.4)" : "rgba(128,128,128,0.15)"}`,
            color: "var(--text-color)",
            cursor: input.trim() ? "pointer" : "not-allowed",
            fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s", flexShrink: 0
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            width="18" 
            height="18" 
            fill="currentColor"
            style={{ marginLeft: "2px", transform: "rotate(-10deg)" }}
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

// ── Conversations List ────────────────────────────────────────
function ConversationList({ currentUser, onSelectChat }) {
  const [convos, setConvos]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const list = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const otherId = data.participants.find(p => p !== currentUser.uid);
        let otherUser = { uid: otherId, name: data.participantNames?.[otherId] || "User", username: "" };
        try {
          const uDoc = await getDoc(doc(db, "users", otherId));
          if (uDoc.exists()) otherUser = { uid: otherId, ...uDoc.data() };
        } catch {}

        // Check unread
        let unreadCount = 0;
        try {
          const msgQ = query(
            collection(db, "chats", d.id, "messages"),
            where("seen", "==", false)
          );
          const unreadSnap = await getDocs(msgQ);
          unreadCount = unreadSnap.docs.filter(doc => doc.data().senderId !== currentUser.uid).length;
        } catch (e) {
          console.error("Unread msg error:", e);
        }

        return {
          chatId: d.id,
          otherUser,
          lastMessage: data.lastMessage || "",
          lastMessageAt: data.lastMessageAt,
          updatedAt: data.updatedAt?.toMillis?.() || 0,
          unread: unreadCount,
        };
      }));
      
      // Sort client-side
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      
      setConvos(list.filter(Boolean));
      setLoading(false);
    }, (error) => {
      console.error("Chats query error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
      Loading chats...
    </div>
  );

  if (convos.length === 0) return (
    <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
      No conversations yet.<br/>Search a username above to start chatting!
    </div>
  );

  return (
    <div style={{ padding: "0 8px" }}>
      {convos.map(c => (
        <div
          key={c.chatId}
          onClick={() => onSelectChat(c.chatId, c.otherUser)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 10px", borderRadius: 12, cursor: "pointer",
            transition: "all 0.18s", marginBottom: 2
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,182,193,0.07)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, rgba(255,182,193,0.35), rgba(212,163,115,0.3))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 700, position: "relative"
          }}>
            {c.otherUser.name?.[0]?.toUpperCase() || "?"}
            {c.unread > 0 && (
              <div style={{
                position: "absolute", top: -2, right: -2,
                width: 16, height: 16, borderRadius: "50%",
                background: "#ffb6c1", color: "#000",
                fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>{c.unread > 9 ? "9+" : c.unread}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: c.unread > 0 ? 700 : 500,
              color: "var(--text-color)", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis"
            }}>{c.otherUser.name}</div>
            <div style={{
              fontSize: 11, color: c.unread > 0 ? "rgba(255,182,193,0.7)" : "rgba(255,255,255,0.3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              fontWeight: c.unread > 0 ? 600 : 400
            }}>{c.lastMessage || "Start chatting"}</div>
          </div>
          {c.lastMessageAt && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
              {timeLabel(c.lastMessageAt)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Chat Panel ───────────────────────────────────────────
export default function ChatPanel({ currentUser, onClose }) {
  const [view, setView]       = useState("home"); // "home" | "search" | "chat"
  const [activeChat, setActiveChat] = useState(null); // { chatId, otherUser }

  const handleSelectUser = (otherUser) => {
    const chatId = getChatId(currentUser.uid, otherUser.uid);
    setActiveChat({ chatId, otherUser });
    setView("chat");
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 94,
      right: 28,
      width: 340,
      height: 520,
      zIndex: 999,
      display: "flex",
      flexDirection: "column",
      animation: "chatPop 0.3s cubic-bezier(0.34,1.2,0.64,1)"
    }}>
      <div className="glass-panel" style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Header */}
        {view !== "chat" && (
          <div style={{
            padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid rgba(128,128,128,0.15)",
            flexShrink: 0
          }}>
            {view !== "home" && (
              <button
                onClick={() => setView("home")}
                style={{
                  background: "none", border: "none",
                  color: "rgba(255,182,193,0.7)", fontSize: 18,
                  cursor: "pointer", padding: "0 6px 0 0", lineHeight: 1
                }}
              >‹</button>
            )}
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: 14,
              fontWeight: 600, letterSpacing: 1,
              background: "linear-gradient(135deg, #ffb6c1, #d4a373)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              flex: 1
            }}>
              {view === "search" ? "Find Friends" : "Messages"}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {view === "home" && (
                <button
                  onClick={() => setView("search")}
                  title="Search"
                  style={{
                    background: "rgba(255,182,193,0.12)", border: "1px solid rgba(255,182,193,0.2)",
                    color: "rgba(255,182,193,0.8)", borderRadius: 8,
                    width: 28, height: 28, cursor: "pointer",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  <svg 
                    viewBox="0 0 24 24" 
                    width="16" 
                    height="16" 
                    fill="currentColor"
                  >
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "rgba(128,128,128,0.1)", border: "1px solid rgba(128,128,128,0.15)",
                  color: "rgba(255,255,255,0.4)", borderRadius: 8,
                  width: 28, height: 28, cursor: "pointer",
                  fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >✕</button>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "hidden", display: "flex", flexDirection: "column" }}>
          {view === "home" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ConversationList
                currentUser={currentUser}
                onSelectChat={(chatId, otherUser) => { setActiveChat({ chatId, otherUser }); setView("chat"); }}
              />
            </div>
          )}
          {view === "search" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <SearchPanel
                currentUid={currentUser.uid}
                onSelectUser={handleSelectUser}
              />
            </div>
          )}
          {view === "chat" && activeChat && (
            <ChatWindow
              chatId={activeChat.chatId}
              currentUser={currentUser}
              otherUser={activeChat.otherUser}
              onBack={() => setView("home")}
              onClose={onClose}
            />
          )}
        </div>

        {/* My username badge */}
        {view === "home" && currentUser?.username && (
          <div style={{
            padding: "8px 14px",
            borderTop: "1px solid rgba(128,128,128,0.1)",
            fontSize: 10, color: "rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", gap: 4, flexShrink: 0
          }}>
            <span>Your ID:</span>
            <span style={{ color: "rgba(255,182,193,0.5)", fontWeight: 600 }}>@{currentUser.username}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes chatPop {
          from { transform: scale(0.88) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
