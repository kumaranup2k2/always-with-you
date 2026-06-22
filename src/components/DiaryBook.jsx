import { useState, useEffect, useCallback, useRef } from "react";
import WritePage    from "./WritePage";
import ReadEntries  from "./ReadEntries";
import SettingsPage from "./SettingsPage";
import CalendarPage from "./Calendarpage";
import NotesPage    from "./Notespage";
import ChatPanel    from "./ChatPanel";
import { auth }     from "../firebase/config";
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

function Toast({ message }) {
  return <div className={`toast ${message ? "show" : ""}`}>{message}</div>;
}

function calcStreak(entries) {
  if (!entries.length) return 0;
  const days = new Set(entries.map(e => new Date(e.createdAt).toLocaleDateString("en-CA")));
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toLocaleDateString("en-CA");
    if (days.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// Convert any hex color to rgb components string "r,g,b"
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : "255,182,193";
}

// Derive a full set of CSS variables from the theme object
function buildCssVars(theme) {
  const accent  = theme.accent  || "#ffb6c1";
  const accent2 = theme.accent2 || "#d4a373";
  const text    = theme.text    || "#f0f0f0";
  const blur    = parseFloat(theme.blur   ?? 35);
  const radius  = parseFloat(theme.radius ?? 24);
  const glass   = parseFloat(theme.glass  ?? 0.05);

  // Hex → rgba helpers using hex directly
  const a = (hex, alpha) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

  return {
    "--bg-color":            theme.bg,
    "--bg-image":            theme.image || "none",
    "--text-color":          text,
    "--glass-bg":            `rgba(128,128,128,${glass})`,
    "--glass-blur":          `${blur}px`,
    "--glass-radius":        `${radius}px`,
    "--accent":              accent,
    "--accent2":             accent2,
    "--accent3":             a(accent2, 0.7),
    "--accent-glow":         a(accent, 0.15),
    "--accent-bg":           a(accent, 0.12),
    "--accent-border":       a(accent, 0.28),
    "--accent-strong":       a(accent, 0.45),
    "--input-focus-border":  a(accent, 0.45),
    "--input-focus-bg":      a(accent, 0.05),
    "--input-focus-shadow":  `0 0 0 3px ${a(accent, 0.07)}`,
    "--nav-active-bg":       a(accent, 0.15),
    "--nav-active-shadow":   `0 2px 10px ${a(accent, 0.12)}, inset 0 0 0 1px ${a(accent, 0.2)}`,
    "--dropdown-item-hover": a(accent, 0.12),
    "--scrollbar-thumb":     a(accent, 0.18),
    "--scrollbar-hover":     a(accent, 0.35),
    "--toast-border":        a(accent, 0.25),
    "--streak-bg":           `linear-gradient(135deg, ${a(accent, 0.15)}, ${a(accent2, 0.1)})`,
    "--streak-border":       a(accent, 0.25),
    "--card-hover-border":   a(accent, 0.2),
    "--card-hover-shadow":   `0 12px 36px rgba(0,0,0,0.2)`,
    "--cal-today-bg":        a(accent, 0.18),
    "--cal-today-border":    a(accent, 0.8),
    "--cal-selected-bg":     a(accent, 0.08),
    "--cal-selected-border": a(accent, 0.45),
    "--add-note-bg":         a(accent, 0.06),
    "--add-note-border":     a(accent, 0.25),
    "--add-note-color":      a(accent, 0.6),
    "--add-note-hover-bg":   a(accent, 0.1),
    "--add-note-hover-border": a(accent, 0.45),
    "--text-muted":          a(text, 0.45),
    "--text-faint":          a(text, 0.28),
    "--online-dot":          "#4ade80",
    "--error-color":         "#ff8a8a",
    "--danger-color":        "#ff6464",
    "--danger-bg":           "rgba(255,80,80,0.15)",
    "--danger-border":       "rgba(255,80,80,0.35)",
  };
}

export default function DiaryBook({ onClose }) {
  const [tab,         setTab]         = useState("write");
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState("");
  const [themeReady,  setThemeReady]  = useState(false);
  const [userName,    setUserName]    = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [showChat,    setShowChat]    = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const themeSyncTimer = useRef(null);

  // ── Online Presence Heartbeat ──────────────────────────────
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const uid = auth.currentUser.uid;
    const updatePresence = async () => {
      try { await updateDoc(doc(db, "users", uid), { lastActive: serverTimestamp() }); } catch {}
    };
    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    const handleVisibility = () => { if (document.visibilityState === "visible") updatePresence(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [auth.currentUser?.uid]);

  const [theme, setTheme] = useState(() => ({
    bg:      localStorage.getItem("theme_bg")      || "#0d141e",
    image:   localStorage.getItem("theme_image")   || "none",
    text:    localStorage.getItem("theme_text")    || "#f0f0f0",
    glass:   localStorage.getItem("theme_glass")   || "0.05",
    blur:    localStorage.getItem("theme_blur")    || "35",
    radius:  localStorage.getItem("theme_radius")  || "24",
    accent:  localStorage.getItem("theme_accent")  || "#ffb6c1",
    accent2: localStorage.getItem("theme_accent2") || "#d4a373",
  }));

  // ── Apply ALL CSS variables whenever theme changes (smooth transition) ──
  useEffect(() => {
    const root = document.documentElement;
    const vars = buildCssVars(theme);
    // Batch-set all vars in one rAF for smoothest transition
    requestAnimationFrame(() => {
      Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    });

    // Persist
    localStorage.setItem("theme_bg",      theme.bg);
    localStorage.setItem("theme_image",   theme.image);
    localStorage.setItem("theme_text",    theme.text);
    localStorage.setItem("theme_glass",   String(theme.glass));
    localStorage.setItem("theme_blur",    String(theme.blur));
    localStorage.setItem("theme_radius",  String(theme.radius));
    localStorage.setItem("theme_accent",  theme.accent);
    localStorage.setItem("theme_accent2", theme.accent2);
  }, [theme]);

  // ── Cloud sync theme (debounced 900ms) ────────────────────
  useEffect(() => {
    if (!themeReady || !auth.currentUser) return;
    clearTimeout(themeSyncTimer.current);
    themeSyncTimer.current = setTimeout(async () => {
      try {
        const { saveUserTheme } = await import("../firebase/diary");
        await saveUserTheme(auth.currentUser.uid, theme);
      } catch (e) { console.error("Theme auto-sync failed:", e); }
    }, 900);
    return () => clearTimeout(themeSyncTimer.current);
  }, [theme, themeReady]);

  // ── Watch auth state ───────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { if (!user) onClose(); });
    return () => unsub();
  }, [onClose]);

  // ── Load entries + cloud theme + user profile ──────────────
  useEffect(() => {
    async function loadData() {
      try {
        const { fetchAllEntries, fetchUserTheme } = await import("../firebase/diary");
        if (auth.currentUser) {
          const cloudTheme = await fetchUserTheme(auth.currentUser.uid);
          if (cloudTheme) setTheme(prev => ({ ...prev, ...cloudTheme }));
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data();
            setUserProfile(profile);
            setUserName(profile.name || auth.currentUser.displayName || "");
          } else {
            setUserName(auth.currentUser.displayName || "");
          }
        }
        const data = await fetchAllEntries();
        setEntries(data);
      } catch (e) { console.error("Load error:", e); }
      finally { setLoading(false); setThemeReady(true); }
    }
    loadData();
  }, []);

  // ── Global Unread Chat Listener ────────────────────────────
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", auth.currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      let unreadSum = 0;
      await Promise.all(snap.docs.map(async (d) => {
        try {
          const msgQ    = query(collection(db, "chats", d.id, "messages"), where("seen", "==", false));
          const msgSnap = await getDocs(msgQ);
          unreadSum += msgSnap.docs.filter(doc => doc.data().senderId !== auth.currentUser.uid).length;
        } catch {}
      }));
      setTotalUnread(unreadSum);
    });
    return () => unsub();
  }, [auth.currentUser?.uid]);

  // ── Toast helper ───────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }, []);

  // ── Save entry ─────────────────────────────────────────────
  async function handleSave(entryData) {
    try {
      const { saveEntry, fetchAllEntries } = await import("../firebase/diary");
      await saveEntry({ ...entryData, author: userName || auth.currentUser?.displayName || "Anonymous" });
      const updated = await fetchAllEntries();
      setEntries(updated);
      setTab("read");
    } catch (e) { console.error("Save failed", e); throw e; }
  }

  const streak = calcStreak(entries);
  const TABS = [
    { id: "write",    label: "Write" },
    { id: "read",     label: "Read" },
    { id: "notes",    label: "Notes" },
    { id: "calendar", label: "Calendar" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "hidden" }}>
        <div className="glass-panel" style={{ width: "100%", maxWidth: 900, height: "90vh" }}>

          {/* Top bar */}
          <div style={{ padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.35, letterSpacing: 0.5 }}>
              {userName ? `Hello, ${userName} ✦` : ""}
            </div>
            <div className="font-display gradient-text-gold" style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2 }}>
              Always With You
            </div>
            {streak > 0 && <div className="streak-badge">🔥 {streak}d</div>}
          </div>

          {/* Capsule nav */}
          <div className="capsule-nav-container">
            <div className="capsule-nav">
              {TABS.map(t => (
                <button key={t.id} className={`capsule-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page content */}
          <div key={tab} style={{ flex: 1, overflowY: "auto", position: "relative", animation: "fadeIn 0.3s ease" }}>
            {tab === "write"    && <WritePage onSave={handleSave} showToast={showToast} />}
            {tab === "read"     && <ReadEntries entries={entries} loading={loading} onEntriesUpdate={setEntries} showToast={showToast} />}
            {tab === "notes"    && <NotesPage showToast={showToast} />}
            {tab === "calendar" && <CalendarPage showToast={showToast} />}
            {tab === "settings" && <SettingsPage theme={theme} setTheme={setTheme} showToast={showToast} />}
          </div>
        </div>
        <Toast message={toast} />
      </div>

      {/* Floating chat button — uses only CSS vars, zero hardcoded colors */}
      <button
        onClick={() => setShowChat(v => !v)}
        style={{
          position:       "fixed",
          bottom:         28,
          right:          28,
          width:          56,
          height:         56,
          borderRadius:   "50%",
          background:     "var(--accent-bg)",
          border:         "1px solid var(--accent-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow:      "0 8px 32px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.3)",
          cursor:         "pointer",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          color:          "var(--accent)",
          transition:     "all 0.3s cubic-bezier(0.34,1.2,0.64,1)",
          zIndex:         1000,
          transform:      showChat ? "scale(1.1) rotate(90deg)" : "scale(1)",
        }}
        title="Messages"
      >
        {totalUnread > 0 && !showChat && (
          <div style={{
            position: "absolute", top: -4, right: -4,
            background: "var(--accent)", color: "var(--bg-color)",
            fontSize: 11, fontWeight: 800,
            borderRadius: "50%", width: 22, height: 22,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px var(--accent-glow)",
            animation: "pulse 2s infinite",
          }}>
            {totalUnread > 9 ? "9+" : totalUnread}
          </div>
        )}
        {showChat ? (
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "translateY(1px)" }}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>

      {showChat && (
        <ChatPanel
          currentUser={userProfile || { uid: auth.currentUser?.uid, name: userName, username: userProfile?.username }}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
