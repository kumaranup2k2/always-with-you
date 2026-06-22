import { useState, useEffect } from "react";
import WritePage    from "../../pages/WritePage";
import ReadEntries  from "./ReadEntries";
import SettingsPage from "../../pages/SettingsPage";
import CalendarPage from "../../pages/CalendarPage";
import NotesPage    from "../../pages/NotesPage";
import ChatPanel    from "../chat/ChatPanel";
import Toast        from "../common/Toast";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { useDiary } from "../../hooks/useDiary";
import { useChatUnread } from "../../hooks/useChatUnread";

export default function DiaryBook({ onClose }) {
  const [tab, setTab] = useState("write");
  const [showChat, setShowChat] = useState(false);

  const { user, userProfile, authLoading } = useAuth();
  const { theme, setTheme } = useTheme(user);
  const { toastMessage, showToast } = useToast();
  const userName = userProfile?.name || user?.displayName;
  const { entries, loading: entriesLoading, addEntry, streak, setEntries } = useDiary(user, userName);
  const totalUnread = useChatUnread(user);

  // Close diary if user logs out
  useEffect(() => {
    if (!authLoading && !user) {
      onClose();
    }
  }, [authLoading, user, onClose]);

  // ── Save entry ─────────────────────────────────────────────
  async function handleSave(entryData) {
    try {
      await addEntry(entryData);
      setTab("read");
      showToast("Entry saved.");
    } catch (e) {
      console.error("Save failed", e);
      showToast("Save failed. Try again.");
      throw e;
    }
  }

  const loading = authLoading || entriesLoading;

  const TABS = [
    { id: "write",    label: "Write" },
    { id: "read",     label: "Read" },
    { id: "notes",    label: "Thoughts" },
    { id: "calendar", label: "Calendar" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <div style={{
        height: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 20, overflow: "hidden",
      }}>
        <div className="glass-panel" style={{ width: "100%", maxWidth: 900, height: "90vh" }}>

          {/* Top bar */}
          <div style={{
            padding: "14px 22px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid var(--divider)",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.35, letterSpacing: 0.5 }}>
              {userName ? `Hello, ${userName} ✦` : ""}
            </div>

            <div
              className="font-display gradient-text-gold"
              style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2 }}
            >
              Always With You
            </div>

            {streak > 0 && (
              <div className="streak-badge">🔥 {streak}d</div>
            )}
          </div>

          {/* Capsule nav */}
          <div className="capsule-nav-container">
            <div className="capsule-nav">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`capsule-btn ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page content */}
          <div
            key={tab}
            style={{
              flex: 1, overflowY: "auto", position: "relative",
              animation: "fadeIn 0.3s ease",
            }}
          >
            {tab === "write"    && <WritePage onSave={handleSave} showToast={showToast} key="write" />}
            {tab === "read"     && <ReadEntries entries={entries} loading={loading} onEntriesUpdate={setEntries} showToast={showToast} key="read" />}
            {tab === "notes"    && <NotesPage showToast={showToast} key="notes" />}
            {tab === "calendar" && <CalendarPage showToast={showToast} key="calendar" />}
            {tab === "settings" && <SettingsPage theme={theme} setTheme={setTheme} showToast={showToast} key="settings" />}
          </div>
        </div>

        <Toast message={toastMessage} />
      </div>

      {/* Floating chat button */}
      <button
        onClick={() => setShowChat(v => !v)}
        style={{
          position:      "fixed",
          bottom:        28,
          right:         28,
          width:         56,
          height:        56,
          borderRadius:  "50%",
          background:    `linear-gradient(135deg, ${theme.accent}4d, ${theme.accent2 || "#d4a373"}4d)`,
          border:        `1px solid ${theme.accent}66`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow:     `0 8px 32px ${theme.accent}40, 0 2px 8px rgba(0,0,0,0.3)`,
          cursor:        "pointer",
          display:       "flex",
          alignItems:    "center",
          justifyContent: "center",
          color:         "rgba(255,255,255,0.9)",
          transition:    "all 0.3s cubic-bezier(0.34,1.2,0.64,1)",
          zIndex:        1000,
          transform:     showChat ? "scale(1.1) rotate(90deg)" : "scale(1)",
        }}
        title="Messages"
      >
        {totalUnread > 0 && !showChat && (
          <div style={{
            position:   "absolute",
            top:        -4, right: -4,
            background: "var(--accent)",
            color:      "#000",
            fontSize:   11, fontWeight: 800,
            borderRadius: "50%",
            width:  22, height: 22,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow:  "0 2px 8px var(--accent-glow)",
            animation:  "pulse 2s infinite",
          }}>
            {totalUnread > 9 ? "9+" : totalUnread}
          </div>
        )}
        {showChat ? (
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
            strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
            strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: "translateY(1px)" }}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>

      {showChat && (
        <ChatPanel
          currentUser={userProfile || { uid: user?.uid, name: userName, username: userProfile?.username }}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}