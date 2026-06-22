import { useState, useMemo } from "react";
import CustomDropdown from "../common/CustomDropdown";

const MOOD_COLORS = {
  Happy:       { bg: "rgba(255,215,0,0.1)",    border: "rgba(255,215,0,0.25)",  text: "#ffd700" },
  Calm:        { bg: "rgba(100,200,255,0.1)",  border: "rgba(100,200,255,0.25)", text: "#64c8ff" },
  Neutral:     { bg: "rgba(180,180,180,0.1)",  border: "rgba(180,180,180,0.2)",  text: "#aaaaaa" },
  Sad:         { bg: "rgba(150,150,255,0.1)",  border: "rgba(150,150,255,0.25)", text: "#9696ff" },
  Angry:       { bg: "rgba(255,100,100,0.1)",  border: "rgba(255,100,100,0.25)", text: "#ff6464" },
  Loved:       { bg: "rgba(255,182,193,0.12)", border: "rgba(255,182,193,0.3)",  text: "#ffb6c1" },
  Excited:     { bg: "rgba(255,159,128,0.12)", border: "rgba(255,159,128,0.28)", text: "#ff9f80" },
  Tired:       { bg: "rgba(161,161,170,0.12)", border: "rgba(161,161,170,0.28)", text: "#a1a1aa" },
  Grateful:    { bg: "rgba(167,243,208,0.12)", border: "rgba(167,243,208,0.28)", text: "#8ee6c9" },
  Anxious:     { bg: "rgba(240,171,252,0.12)", border: "rgba(240,171,252,0.28)", text: "#f0abfc" },
  Focused:     { bg: "rgba(184,224,255,0.12)", border: "rgba(184,224,255,0.28)", text: "#b8e0ff" },
  Missing:      { bg: "rgba(135,206,235,0.12)", border: "rgba(135,206,235,0.28)", text: "#87ceeb" }, // Soft Sky Blue
  Nostalgic:    { bg: "rgba(210,180,140,0.12)", border: "rgba(210,180,140,0.28)", text: "#d2b48c" }, // Warm Tan
  Bored:        { bg: "rgba(200,195,185,0.12)", border: "rgba(200,195,185,0.28)", text: "#c8c3b9" }, // Dull Grayish Beige
  Confused:     { bg: "rgba(147,112,219,0.12)", border: "rgba(147,112,219,0.28)", text: "#9370db" }, // Medium Purple
  Frustrated:   { bg: "rgba(255,140,0,0.12)",   border: "rgba(255,140,0,0.28)",   text: "#ff8c00" }, // Dark Orange
  Overwhelmed:  { bg: "rgba(119,136,153,0.12)", border: "rgba(119,136,153,0.28)", text: "#778899" }, // Slate Gray
  Lonely:       { bg: "rgba(70,130,180,0.12)",  border: "rgba(70,130,180,0.28)",  text: "#4682b4" }, // Steel Blue
  Playful:      { bg: "rgba(255,105,180,0.12)", border: "rgba(255,105,180,0.28)", text: "#ff69b4" }, // Hot Pink
  Motivated:    { bg: "rgba(255,165,0,0.12)",   border: "rgba(255,165,0,0.28)",   text: "#ffa500" }, // Bright Orange
  Surprised:    { bg: "rgba(0,255,255,0.12)",   border: "rgba(0,255,255,0.28)",   text: "#00ffff" }, // Cyan
  Proud:        { bg: "rgba(65,105,225,0.12)",  border: "rgba(65,105,225,0.28)",  text: "#4169e1" }, // Royal Blue
  Sick:         { bg: "rgba(143,188,143,0.12)", border: "rgba(143,188,143,0.28)", text: "#8fbc8f" }, // Pale Green
  Chill:        { bg: "rgba(127,255,212,0.12)", border: "rgba(127,255,212,0.28)", text: "#7fffd4" }, // Aquamarine
  Hopeful:      { bg: "rgba(135,206,250,0.12)", border: "rgba(135,206,250,0.28)", text: "#87cefa" }, // Light Sky Blue
  Embarrassed:  { bg: "rgba(240,128,128,0.12)", border: "rgba(240,128,128,0.28)", text: "#f08080" }, // Light Coral
  Sleepy:       { bg: "rgba(123,104,238,0.12)", border: "rgba(123,104,238,0.28)", text: "#7b68ee" }, // Medium Slate Blue
  Fighting:       { bg: "rgba(220,20,60,0.12)",   border: "rgba(220,20,60,0.28)",   text: "#dc143c" }, // Crimson Red
  Furious:        { bg: "rgba(200,0,0,0.12)",     border: "rgba(200,0,0,0.28)",     text: "#c80000" }, // Blood Red
  Annoyed:        { bg: "rgba(189,183,107,0.12)", border: "rgba(189,183,107,0.28)", text: "#bdb76b" }, // Dark Khaki
  Argumentative:  { bg: "rgba(210,105,30,0.12)",  border: "rgba(210,105,30,0.28)",  text: "#d2691e" }, // Burnt Orange
  Rebellious:     { bg: "rgba(139,0,139,0.12)",   border: "rgba(139,0,139,0.28)",   text: "#8b008b" }, // Dark Magenta
  Determined:     { bg: "rgba(255,69,0,0.12)",    border: "rgba(255,69,0,0.28)",    text: "#ff4500" }, // Orange Red
  Heartbroken:    { bg: "rgba(178,34,34,0.12)",   border: "rgba(178,34,34,0.28)",   text: "#b22222" }, // Firebrick Red
  Jealous:        { bg: "rgba(50,205,50,0.12)",   border: "rgba(50,205,50,0.28)",   text: "#32cd32" }, // Lime Green
  Guilty:         { bg: "rgba(112,128,144,0.12)", border: "rgba(112,128,144,0.28)", text: "#708090" }, // Slate Gray
  Defensive:      { bg: "rgba(160,82,45,0.12)",   border: "rgba(160,82,45,0.28)",   text: "#a0522d" }, // Sienna Brown
  Victorious:     { bg: "rgba(218,165,32,0.12)",  border: "rgba(218,165,32,0.28)",  text: "#daa520" }, // Goldenrod
  Disappointed:   { bg: "rgba(176,196,222,0.12)", border: "rgba(176,196,222,0.28)", text: "#b0c4de" }, // Light Steel Blue
  Sarcastic:      { bg: "rgba(154,205,50,0.12)",  border: "rgba(154,205,50,0.28)",  text: "#9acd32" }  // Yellow Green
};

const MOOD_ICON = {
  Happy: "😄", Calm: "😌", Neutral: "😐", Sad: "😢", Angry: "😡", Loved: "🥰",
  Excited: "🤩", Tired: "😫", Grateful: "😇", Anxious: "😰", Focused: "🧐",
  Missing: "🥺", Nostalgic: "🕰️", Bored: "🥱", Confused: "😕", Frustrated: "😤", 
  Overwhelmed: "😵‍💫", Lonely: "🚶", Playful: "😜", Motivated: "💪", Surprised: "😲", 
  Proud: "😎", Sick: "🤒", Chill: "🤙", Hopeful: "🤞", Embarrassed: "😳", Sleepy: "😴",
  Fighting: "🥊", Furious: "🤬", Annoyed: "🙄", Argumentative: "🗣️", Rebellious: "😈", 
  Determined: "🔥", Heartbroken: "💔", Jealous: "😒", Guilty: "😔", Defensive: "🙅‍♂️", 
  Victorious: "🏆", Disappointed: "😞", Sarcastic: "🙃"
};

const MOOD_FILTER_OPTIONS = [
  "All", "Happy", "Calm", "Neutral", "Sad", "Angry", "Loved", "Excited",
  "Tired", "Grateful", "Anxious", "Focused", "Missing", "Nostalgic",
  "Bored", "Confused", "Frustrated", "Overwhelmed", "Lonely", "Playful",
  "Motivated", "Surprised", "Proud", "Sick", "Chill", "Hopeful",
  "Embarrassed", "Sleepy", "Fighting", "Furious", "Annoyed",
  "Argumentative", "Rebellious", "Determined", "Heartbroken", "Jealous",
  "Guilty", "Defensive", "Victorious", "Disappointed", "Sarcastic"
].map(m => ({ label: m, value: m }));

const WEATHER_ICON = {
  Sunny: "☀️", Cloudy: "☁️", Rainy: "🌧️", Cold: "❄️", Windy: "💨",
  Stormy: "⛈️", Drizzle: "🌦️", Hot: "🥵", Humid: "🌫️", "Clear Night": "🌙",
};

const SORT_OPTIONS  = ["Newest", "Oldest", "By Mood"];
// Reading-time estimate (pure function, no firebase)
const readTime = (html = "") => {
  const words = html.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

export default function ReadEntries({ entries, loading }) {
  const [search,     setSearch]     = useState("");
  const [sort,       setSort]       = useState("Newest");
  const [expandedId, setExpandedId] = useState(null);
  const [filterMood, setFilterMood] = useState("All");

  // useMemo so filtering/sorting only recalculates when inputs change
  // No firebase reads here — works purely on the `entries` prop passed from parent
  const filtered = useMemo(() => {
    let result = entries.filter(e => {
      const rawText   = (e.text || "").replace(/<[^>]*>/g, "").toLowerCase();
      const matchSearch =
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        rawText.includes(search.toLowerCase());
      const matchMood = filterMood === "All" || e.mood === filterMood;
      return matchSearch && matchMood;
    });

    if (sort === "Newest")  result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === "Oldest")  result = [...result].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sort === "By Mood") result = [...result].sort((a, b) => (a.mood || "").localeCompare(b.mood || ""));

    return result;
  }, [entries, search, sort, filterMood]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, opacity: 0.5, marginBottom: 6 }}>
        Loading entries...
      </div>
      <div style={{ fontSize: 11, opacity: 0.3 }}>Fetching your memories</div>
    </div>
  );

  return (
    <div style={{ padding: "16px 20px" }}>

      {/* Search */}
      <input
        type="text"
        placeholder="Search your memories..."
        className="glass-input"
        style={{ width: "100%", marginBottom: 12 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Controls row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div 
          className="pill-scroll-row"
          style={{ display: "flex", gap: 6, flex: 1, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {MOOD_FILTER_OPTIONS.map(m => (
            <button
              key={m.value}
              className="pill-btn"
              onClick={() => setFilterMood(m.value)}
              style={{
                flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", transition: "all 0.2s",
                background: filterMood === m.value ? "var(--accent-bg)" : "rgba(128,128,128,0.08)",
                border: `1px solid ${filterMood === m.value ? "var(--accent-border)" : "rgba(128,128,128,0.15)"}`,
                color: filterMood === m.value ? "var(--accent)" : "var(--text-color)",
                fontWeight: filterMood === m.value ? 600 : 400,
                display: "flex", alignItems: "center", gap: 4
              }}
            >
              {m.value !== "All" && <span style={{ fontSize: 12 }}>{MOOD_ICON[m.value]}</span>}
              {m.label}
            </button>
          ))}
        </div>
        <CustomDropdown
          label="Sort"
          options={SORT_OPTIONS.map(s => ({ label: s, value: s }))}
          value={sort}
          onChange={setSort}
        />
      </div>

      {/* Entry count */}
      <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.4, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>
        {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        {entries.length !== filtered.length ? ` of ${entries.length}` : ""}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌸</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, opacity: 0.45, fontStyle: "italic" }}>
            {search || filterMood !== "All"
              ? "No entries match your search."
              : "No entries yet. Start writing!"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(entry => {
            const isExpanded = expandedId === entry.id;
            const moodStyle  = MOOD_COLORS[entry.mood] || MOOD_COLORS.Neutral;
            const preview    = (entry.text || "").replace(/<[^>]*>/g, "").slice(0, 160);

            return (
              <div
                key={entry.id}
                className="entry-card glass-panel"
                style={{
                  padding: "18px 20px", borderRadius: 18,
                  border: "1px solid rgba(128,128,128,0.12)",
                  transition: "all 0.3s ease",
                }}
              >
                {/* Header — click to expand/collapse */}
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Playfair Display', serif", marginBottom: 4, lineHeight: 1.3 }}>
                      {entry.title}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.45, letterSpacing: 0.3 }}>
                      {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                        weekday: "long", day: "numeric", month: "short", year: "numeric",
                      })}
                      {" · "}
                      {readTime(entry.text)} min read
                    </div>
                  </div>

                  {/* Mood + weather badges */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 12, flexShrink: 0 }}>
                    {entry.weather && (
                      <span style={{ fontSize: 14 }} title={entry.weather}>
                        {WEATHER_ICON[entry.weather] || "WX"}
                      </span>
                    )}
                    {entry.mood && (
                      <span
                        className="mood-pill"
                        style={{
                          background: moodStyle.bg,
                          border: `1px solid ${moodStyle.border}`,
                          color: moodStyle.text,
                          fontSize: 10,
                        }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 800 }}>{MOOD_ICON[entry.mood] || "MD"}</span> {entry.mood}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, opacity: 0.35, marginLeft: 4,
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.3s", display: "inline-block",
                    }}>▾</span>
                  </div>
                </div>

                {/* Preview (collapsed) */}
                {!isExpanded && preview && (
                  <div style={{
                    fontSize: 13, lineHeight: 1.65, opacity: 0.65,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                  }}>
                    {preview}{preview.length >= 160 && "…"}
                  </div>
                )}

                {/* Full content (expanded) */}
                {isExpanded && (
                  <div
                    style={{ fontSize: 13, lineHeight: 1.75, animation: "fadeIn 0.3s ease" }}
                    dangerouslySetInnerHTML={{ __html: entry.text }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Local styles for hide scrollbar and hover effects */}
      <style>{`
        .pill-scroll-row::-webkit-scrollbar { display: none; }
        .pill-btn:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}
