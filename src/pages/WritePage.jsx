import { useState, useRef, useEffect, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const MOODS = [
  { label: "Happy", icon: "😄" },
  { label: "Calm", icon: "😌" },
  { label: "Neutral", icon: "😐" },
  { label: "Sad", icon: "😢" },
  { label: "Angry", icon: "😡" },
  { label: "Loved", icon: "🥰" },
  { label: "Excited", icon: "🤩" },
  { label: "Tired", icon: "😫" },
  { label: "Grateful", icon: "😇" },
  { label: "Anxious", icon: "😰" },
  { label: "Focused", icon: "🧐" },
  { label: "Missing", icon: "🥺" },
  { label: "Nostalgic", icon: "🕰️" },
  { label: "Bored", icon: "🥱" },
  { label: "Confused", icon: "😕" },
  { label: "Frustrated", icon: "😤" },
  { label: "Overwhelmed", icon: "😵‍💫" },
  { label: "Lonely", icon: "🚶" },
  { label: "Playful", icon: "😜" },
  { label: "Motivated", icon: "💪" },
  { label: "Surprised", icon: "😲" },
  { label: "Proud", icon: "😎" },
  { label: "Sick", icon: "🤒" },
  { label: "Chill", icon: "🤙" },
  { label: "Hopeful", icon: "🤞" },
  { label: "Embarrassed", icon: "😳" },
  { label: "Sleepy", icon: "😴" },
  { label: "Fighting", icon: "🥊" },
  { label: "Furious", icon: "🤬" },
  { label: "Annoyed", icon: "🙄" },
  { label: "Argumentative", icon: "🗣️" },
  { label: "Rebellious", icon: "😈" },
  { label: "Determined", icon: "🔥" },
  { label: "Heartbroken", icon: "💔" },
  { label: "Jealous", icon: "😒" },
  { label: "Guilty", icon: "😔" },
  { label: "Defensive", icon: "🙅‍♂️" },
  { label: "Victorious", icon: "🏆" },
  { label: "Disappointed", icon: "😞" },
  { label: "Sarcastic", icon: "🙃" },
];

const WEATHERS = [
  { label: "Sunny", icon: "☀️" },
  { label: "Cloudy", icon: "☁️" },
  { label: "Rainy", icon: "🌧️" },
  { label: "Cold", icon: "❄️" },
  { label: "Windy", icon: "💨" },
  { label: "Stormy", icon: "⛈️" },
  { label: "Drizzle", icon: "🌦️" },
  { label: "Hot", icon: "🥵" },
  { label: "Humid", icon: "🌫️" },
  { label: "Clear Night", icon: "🌙" },
];

const DRAFT_KEY = "diary_draft";

// ── Horizontal scroll pill row ───────────────────────────────
function PillRow({ items, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 5,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",          // Firefox
        msOverflowStyle: "none",         // IE/Edge
      }}
      className="pill-scroll-row"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="pill-btn"
          onClick={() => onChange(item.label)}
          style={{
            flexShrink: 0,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 11,
            cursor: "pointer",
            whiteSpace: "nowrap",
            background:
              value === item.label
                ? "rgba(255,182,193,0.2)"
                : "rgba(128,128,128,0.08)",
            border:
              value === item.label
                ? "1px solid rgba(255,182,193,0.45)"
                : "1px solid rgba(128,128,128,0.15)",
            color: value === item.label ? "#ffb6c1" : "var(--text-color)",
            fontWeight: value === item.label ? 600 : 400,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              opacity: value === item.label ? 1 : 0.62,
            }}
          >
            {item.icon}
          </span>{" "}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function WritePage({ onSave, showToast }) {
  const [title,        setTitle]        = useState("");
  const [text,         setText]         = useState("");
  const [mood,         setMood]         = useState("Calm");
  const [weather,      setWeather]      = useState("Sunny");
  const [saving,       setSaving]       = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const quillRef = useRef(null);

  const today = new Date();
  const dateString = today.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const rawText   = text.replace(/<[^>]*>/g, "").trim();
  const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = rawText.length;

  // ── Autosave draft every 30s ──────────────────────────────
  const saveDraft = useCallback(() => {
    if (!rawText) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title, text, mood, weather, savedAt: new Date().toISOString() })
      );
    } catch {}
  }, [title, text, mood, weather, rawText]);

  useEffect(() => {
    const interval = setInterval(saveDraft, 30_000);
    return () => clearInterval(interval);
  }, [saveDraft]);

  // ── Restore draft on mount ────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (Date.now() - new Date(draft.savedAt).getTime() < 86_400_000) {
          setTitle(draft.title   || "");
          setText(draft.text     || "");
          setMood(draft.mood     || "Calm");
          setWeather(draft.weather || "Sunny");
          setDraftRestored(true);
        }
      }
    } catch {}
  }, []);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!rawText || saving) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim() || "Untitled", text, mood, weather, date: today.toISOString() });
      setTitle(""); setText(""); setMood("Calm"); setWeather("Sunny");
      clearDraft();
      showToast?.("Entry saved.");
    } catch {
      showToast?.("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const modules = {
    toolbar: [
      [{ size: ["small", false, "large", "huge"] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  };

  return (
    <div
      className="fade-in-page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "10px 16px 12px",
        overflow: "hidden",
      }}
    >
      {/* ── Date + word count ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45, letterSpacing: 0.3 }}>
          {dateString}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.3, letterSpacing: 0.3 }}>
          {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount} chars
        </div>
      </div>

      {/* ── Draft restored banner ── */}
      {draftRestored && (
        <div
          className="draft-banner"
          style={{
            background: "rgba(255,182,193,0.08)",
            border: "1px solid rgba(255,182,193,0.2)",
            borderRadius: 8,
            padding: "6px 12px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--accent)" }}>Draft restored</span>
          <button
            onClick={() => {
              setTitle(""); setText(""); setMood("Calm"); setWeather("Sunny");
              clearDraft(); setDraftRestored(false);
            }}
            style={{ background: "none", border: "none", color: "rgba(255,182,193,0.6)", fontSize: 10, cursor: "pointer" }}
          >
            Discard
          </button>
        </div>
      )}

      {/* ── Mood (single scroll row) ── */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontSize: 9,
            color: "var(--text-color)",
            opacity: 0.38,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          Mood
        </div>
        <PillRow items={MOODS} value={mood} onChange={setMood} />
      </div>

      {/* ── Weather (single scroll row) ── */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 9,
            color: "var(--text-color)",
            opacity: 0.38,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          Weather
        </div>
        <PillRow items={WEATHERS} value={weather} onChange={setWeather} />
      </div>

      {/* ── Title ── */}
      <input
        className="glass-input"
        style={{
          fontSize: 16,
          fontWeight: 600,
          border: "none",
          borderBottom: "1px solid rgba(128,128,128,0.18)",
          borderRadius: 0,
          padding: "6px 2px",
          marginBottom: 10,
          background: "transparent",
          letterSpacing: 0.3,
          color: "var(--text-color)",
          outline: "none",
        }}
        placeholder="Entry title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            quillRef.current?.getEditor()?.focus();
          }
        }}
      />

      {/* ── Rich text editor (flex-grows to fill remaining space) ── */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(128,128,128,0.15)",
          borderRadius: 8,
          minHeight: 0,         // critical: allows flex child to shrink properly
        }}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={text}
          onChange={setText}
          modules={modules}
          placeholder="Dear Diary..."
          style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        />
      </div>

      {/* ── Save row ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <div style={{ fontSize: 10, opacity: 0.28 }}>
          {rawText ? "Autosaves every 30s" : ""}
        </div>
        <button
          className="glass-btn"
          onClick={handleSave}
          disabled={!rawText || saving}
          style={{ minWidth: 100 }}
        >
          {saving ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10, height: 10,
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Saving...
            </span>
          ) : (
            "Save Entry"
          )}
        </button>
      </div>

      {/* ── Global CSS ── */}
      <style>{`
        @keyframes fadeInPage {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .fade-in-page {
          animation: fadeInPage 0.4s ease-out forwards;
        }
        .draft-banner {
          animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        /* Hide scrollbar for pill rows (webkit) */
        .pill-scroll-row::-webkit-scrollbar { display: none; }

        .pill-btn {
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .pill-btn:hover  { transform: translateY(-1.5px); filter: brightness(1.06); }
        .pill-btn:active { transform: scale(0.96); }

        .glass-btn { transition: all 0.2s ease-in-out !important; }
        .glass-btn:hover:not(:disabled)  { transform: translateY(-1px); opacity: 0.95; }
        .glass-btn:active:not(:disabled) { transform: scale(0.98); }

        /* Quill editor stretches inside flex parent */
        .ql-container.ql-snow {
          flex: 1;
          overflow-y: auto;
          border: none !important;
        }
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid rgba(128,128,128,0.15) !important;
          padding: 6px 8px !important;
        }
        .ql-editor {
          font-size: 14px;
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
}