import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import PrivacyPolicy from "../../PrivacyPolicy";
import { PaletteIcon, BrushIcon, LayoutIcon, EyeIcon, GearIcon, SparklesIcon, RoseIcon, MoonStarIcon, WavesIcon, LeafIcon, SunIcon, FeatherIcon } from "./Icons";

const PRESETS = [
  { id: "midnight", label: "Midnight Rose",  icon: <RoseIcon size={14} />,     vars: { bg: "#0d141e", text: "#f0f0f0", accent: "#ffb6c1", accent2: "#d4a373", glass: "0.05", blur: "35", radius: "24" } },
  { id: "dusk",     label: "Dusty Dusk",     icon: <MoonStarIcon size={14} />, vars: { bg: "#1a0f1e", text: "#f5eeff", accent: "#c8aaff", accent2: "#e8b4d0", glass: "0.07", blur: "30", radius: "24" } },
  { id: "ocean",    label: "Deep Ocean",     icon: <WavesIcon size={14} />,    vars: { bg: "#0a1628", text: "#e8f4ff", accent: "#7ec8e3", accent2: "#4a90d9", glass: "0.06", blur: "32", radius: "20" } },
  { id: "forest",   label: "Velvet Forest",  icon: <LeafIcon size={14} />,     vars: { bg: "#0d1a0f", text: "#e8f5e9", accent: "#96e6c8", accent2: "#52c47a", glass: "0.06", blur: "30", radius: "22" } },
  { id: "sunset",   label: "Golden Sunset",  icon: <SunIcon size={14} />,      vars: { bg: "#1a0e06", text: "#fff5e6", accent: "#ffc896", accent2: "#ff9966", glass: "0.07", blur: "28", radius: "22" } },
  { id: "chalk",    label: "Soft Chalk",     icon: <FeatherIcon size={14} />,  vars: { bg: "#f0ede8", text: "#2a2a2a", accent: "#b07498", accent2: "#9c6644", glass: "0.08", blur: "20", radius: "20" } },
];

const ACCENT_SWATCHES = [
  { color: "#ffb6c1", label: "Rose Pink" },
  { color: "#c8aaff", label: "Lavender" },
  { color: "#96e6c8", label: "Mint" },
  { color: "#ffc896", label: "Peach" },
  { color: "#7ec8e3", label: "Sky" },
  { color: "#ffd700", label: "Gold" },
  { color: "#ff8fab", label: "Hot Pink" },
  { color: "#b8e0ff", label: "Baby Blue" },
  { color: "#f0abfc", label: "Orchid" },
  { color: "#6ee7b7", label: "Seafoam" },
  { color: "#fb923c", label: "Tangerine" },
  { color: "#a5f3fc", label: "Cyan" },
];

const BG_COLORS = [
  "#0d141e", "#0d0906", "#1a0f1e", "#0a1628",
  "#0d1a0f", "#1a0e06", "#1a1a2e", "#12121a",
  "#f0ede8", "#fff9f5", "#f5eeff",
];

const GLASS_PRESETS = [
  { label: "Ultra",   value: "0.02" },
  { label: "Soft",    value: "0.05" },
  { label: "Mist",    value: "0.08" },
  { label: "Haze",    value: "0.12" },
  { label: "Frosted", value: "0.18" },
];

const FEEDBACK_TYPES = [
  { 
    emoji: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#FFC107">
        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
      </svg>
    ),
    label: "Suggestion"
  },
  { 
    emoji: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#4CAF50">
        <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
      </svg>
    ),
    label: "Bug Report"
  },
  { 
    emoji: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#E91E63">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    ),
    label: "Compliment"
  },
  { 
    emoji: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#F44336">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
    ),
    label: "Urgent Issue"
  },
];
const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent!"];

// ─────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.2, paddingLeft: 4 }}>
        {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
        {title}
      </div>
      <div className="glass-panel" style={{ padding: "8px 16px", borderRadius: "var(--glass-radius)", border: "1px solid var(--glass-border)", background: "var(--glass-bg)" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, hint, action, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-color)" }}>{label}</div>
          {hint && <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45, lineHeight: 1.4, marginTop: 4 }}>{hint}</div>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

const Divider = () => (
  <div style={{ height: 1, background: "var(--divider)", margin: "0" }} />
);

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span className="toggle-knob" />
    </label>
  );
}

function needsBorder(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────

export default function SettingsPage({ theme, setTheme, showToast }) {
  const [signingOut,      setSigningOut]      = useState(false);
  const [activePreset,    setActivePreset]    = useState(null);
  const [showPrivacy,     setShowPrivacy]     = useState(false);

  // Feedback state
  const [feedback,        setFeedback]        = useState({ type: null, rating: 0, message: "" });
  const [feedbackSent,    setFeedbackSent]    = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // ── Helpers ──────────────────────────────

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setTheme(prev => ({ ...prev, ...preset.vars }));
    showToast?.(`Theme "${preset.label}" applied ✨`);
  };

  const update = (key, value) => {
    setActivePreset(null);
    setTheme(prev => ({ ...prev, [key]: value }));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(auth); }
    catch { showToast?.("Sign out failed. Please try again."); setSigningOut(false); }
  };

const submitFeedback = async () => {
  if (!feedback.message.trim() || !feedback.type) return;
  setSendingFeedback(true);
  try {
    // 🔁 Replace with your Firebase call, e.g.:
    // await addDoc(collection(db, "feedback"), {
    //   type: feedback.type,
    //   rating: feedback.rating,
    //   message: feedback.message,
    //   createdAt: serverTimestamp(),
    // });
    await new Promise(r => setTimeout(r, 800)); // simulated network delay
    setFeedbackSent(true);
    
    // Emoji 🌸 ki jagah JSX aur SVG set kiya gaya hai
    showToast?.(
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        Thank you for your feedback!
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="#4CAF50" // Green color
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </span>
    );
  } catch {
    showToast?.("Failed to send feedback. Please try again.");
  } finally {
    setSendingFeedback(false);
  }
};

  const resetFeedback = () => {
    setFeedbackSent(false);
    setFeedback({ type: null, rating: 0, message: "" });
  };

  const blur   = parseFloat(theme.blur   ?? 35);
  const radius = parseFloat(theme.radius ?? 24);
  const glass  = parseFloat(theme.glass  ?? 0.05);

  const feedbackReady = feedback.message.trim().length > 0 && feedback.type !== null;

  // ── Privacy Policy overlay ────────────────

  if (showPrivacy) {
    return (
      <div className="fade-in-page" style={{ padding: "18px 20px 60px", overflowY: "auto", height: "100%" }}>
        <button
          className="glass-btn"
          style={{ marginBottom: 16, padding: "8px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => setShowPrivacy(false)}
        >
          ← Back to Settings
        </button>
        <PrivacyPolicy />
      </div>
    );
  }

  // ── Main render ──────────────────────────

  return (
    <div className="fade-in-page" style={{ padding: "10px 20px 30px", overflowY: "auto", height: "100%" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32, textAlign: "center", paddingTop: 10 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--glass-bg)", border: "1px solid var(--accent-border)",
          marginBottom: 12, boxShadow: "0 8px 32px var(--accent-glow)", color: "var(--accent)",
        }}>
          <SparklesIcon size={28} />
        </div>
        <h2 className="font-display gradient-text-rose" style={{ fontSize: 24, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>
          Settings
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.5, letterSpacing: 0.5 }}>
          Make your diary truly yours
        </p>
      </div>

      {/* ── Preset Themes ── */}
      <Section title="Themes" icon={<PaletteIcon size={16} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "8px 0" }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              style={{
                padding: "8px 14px", borderRadius: "var(--radius-pill)", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
                fontWeight:  activePreset === p.id ? 700 : 500,
                background:  activePreset === p.id ? "var(--accent-bg)"              : "var(--input-bg)",
                border:      activePreset === p.id ? "1px solid var(--accent-strong)" : "1px solid var(--input-border)",
                color:       activePreset === p.id ? "var(--accent)"                  : "var(--text-color)",
                transition:  "all 0.22s cubic-bezier(0.25,0.8,0.25,1)",
                display:     "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ display: "flex" }}>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Colors & Background ── */}
      <Section title="Colors & Background" icon={<BrushIcon size={16} />}>

        <Row
          label="Accent Color"
          hint="Used for primary buttons, highlights, and glows"
          action={
            <input type="color" value={theme.accent} onChange={e => update("accent", e.target.value)}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent", padding: 0, borderRadius: 8 }} />
          }
        >
          <div className="swatch-grid">
            {ACCENT_SWATCHES.map(s => (
              <button
                key={s.color} title={s.label}
                className={`color-swatch ${theme.accent === s.color ? "selected" : ""}`}
                style={{ background: s.color, outline: needsBorder(s.color) ? "1.5px solid var(--glass-border)" : undefined }}
                onClick={() => update("accent", s.color)}
              />
            ))}
          </div>
        </Row>
        <Divider />

        <Row
          label="Background Color"
          hint="App wallpaper or solid dark / light base"
          action={
            <input type="color" value={theme.bg} onChange={e => update("bg", e.target.value)}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent", padding: 0, borderRadius: 8 }} />
          }
        >
          <div className="swatch-grid" style={{ marginBottom: 12 }}>
            {BG_COLORS.map(c => (
              <button
                key={c}
                className={`color-swatch ${theme.bg === c ? "selected" : ""}`}
                style={{ background: c, outline: needsBorder(c) ? "1.5px solid var(--glass-border)" : undefined }}
                onClick={() => update("bg", c)}
                title={c}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              className="glass-input"
              style={{ flex: 1, fontSize: 12, padding: "8px 12px" }}
              placeholder="Paste a custom image URL…"
              value={theme.image !== "none" ? theme.image : ""}
              onChange={e => update("image", e.target.value ? `url("${e.target.value}")` : "none")}
            />
            {theme.image !== "none" && (
              <button className="glass-btn" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => update("image", "none")}>
                Clear
              </button>
            )}
          </div>
        </Row>
        <Divider />

        <Row
          label="Text Color"
          hint="Light for dark themes · Dark for light themes"
          action={
            <input type="color" value={theme.text} onChange={e => update("text", e.target.value)}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent", padding: 0, borderRadius: 8 }} />
          }
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {["#f0f0f0", "#ffffff", "#e8e8e8", "#2a2a2a", "#1a1a1a"].map(c => (
              <button
                key={c}
                className={`color-swatch ${theme.text === c ? "selected" : ""}`}
                style={{ background: c, width: 24, height: 24, outline: needsBorder(c) ? "1.5px solid var(--glass-border)" : undefined }}
                onClick={() => update("text", c)}
                title={c}
              />
            ))}
          </div>
        </Row>

      </Section>

      {/* ── Glass & Layout ── */}
      <Section title="Glass & Layout" icon={<LayoutIcon size={16} />}>

        <Row
          label="Glass Intensity"
          hint="Controls the transparency of all glass panels"
          action={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(glass * 100)}%</span>}
        >
          <input type="range" className="glass-slider" min="0.01" max="0.35" step="0.01" value={glass}
            onChange={e => update("glass", String(e.target.value))} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {GLASS_PRESETS.map(gp => (
              <button
                key={gp.value}
                onClick={() => update("glass", gp.value)}
                style={{
                  padding: "4px 12px", borderRadius: "var(--radius-pill)", fontSize: 10,
                  cursor: "pointer", fontFamily: "inherit",
                  background: theme.glass === gp.value ? "var(--accent-bg)"              : "var(--input-bg)",
                  border:     theme.glass === gp.value ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
                  color:      theme.glass === gp.value ? "var(--accent)"                  : "var(--text-color)",
                  transition: "all 0.18s",
                }}
              >{gp.label}</button>
            ))}
          </div>
        </Row>
        <Divider />

        <Row
          label="Backdrop Blur"
          hint="Blur strength applied behind glass surfaces"
          action={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(blur)}px</span>}
        >
          <input type="range" className="glass-slider" min="0" max="60" step="1" value={blur}
            onChange={e => update("blur", String(e.target.value))} />
        </Row>
        <Divider />

        <Row
          label="Panel Roundness"
          hint="Border radius applied to cards, inputs, and modals"
          action={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(radius)}px</span>}
        >
          <input type="range" className="glass-slider" min="0" max="40" step="2" value={radius}
            onChange={e => update("radius", String(e.target.value))} />
        </Row>

      </Section>

      {/* ── Live Preview ── */}
      <Section title="Live Preview" icon={<EyeIcon size={16} />}>
        <div style={{
          padding: 20,
          background: "var(--glass-bg)",
          borderRadius: `${radius}px`,
          border: "1px solid var(--glass-border)",
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          transition: "all var(--theme-transition)",
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>
            Always With You ✦
          </div>
          <div style={{ fontSize: 13, color: "var(--text-color)", opacity: 0.75, marginBottom: 16, lineHeight: 1.6 }}>
            This is how your diary looks with the current theme. Play with the settings above to make it your own.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ padding: "6px 16px", borderRadius: "99px", background: "var(--accent-bg)", border: "1px solid var(--accent-border)", color: "var(--accent)", fontSize: 11, fontWeight: 600 }}>Primary</div>
            <div style={{ padding: "6px 16px", borderRadius: "99px", background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-color)", fontSize: 11, opacity: 0.8 }}>Secondary</div>
          </div>
        </div>
      </Section>

      {/* ── Feedback & Report ── */}
      <Section title="Feedback & Report" icon={<span style={{ fontSize: 16, lineHeight: 1 }}>💌</span>}>

        {feedbackSent ? (
          /* ── Success state ── */
          <div style={{ textAlign: "center", padding: "28px 0 16px" }}>
            <div style={{ fontSize: 40 }}>🌸</div>
            <div style={{ fontWeight: 700, color: "var(--accent)", marginTop: 12, fontSize: 15 }}>
              Thank You!
            </div>
            <div style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.5, marginTop: 6, lineHeight: 1.7 }}>
              Your feedback has been received.<br />We truly appreciate you taking the time.
            </div>
            <button
              className="glass-btn"
              style={{ marginTop: 18, fontSize: 11, padding: "8px 22px" }}
              onClick={resetFeedback}
            >
              Send Another
            </button>
          </div>
        ) : (
          <>
            {/* ── Category ── */}
            <Row label="Category" hint="Select the type of feedback you'd like to share">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FEEDBACK_TYPES.map(({ emoji, label }) => {
                  const active = feedback.type === label;
                  return (
                    <button
                      key={label}
                      onClick={() => setFeedback(f => ({ ...f, type: label }))}
                      style={{
                        padding: "6px 14px", borderRadius: "var(--radius-pill)",
                        fontSize: 11, fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                        background:  active ? "var(--accent-bg)"              : "var(--input-bg)",
                        border:      active ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
                        color:       active ? "var(--accent)"                  : "var(--text-color)",
                        transition:  "all 0.18s",
                        display:     "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <span>{emoji}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </Row>

            <Divider />

            {/* ── Star Rating ── */}
            <Row label="Rate Your Experience" hint="Optional — we value your honest opinion">
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setFeedback(f => ({ ...f, rating: f.rating === n ? 0 : n }))}
                    style={{
                      background: "none", 
                      border: "none", 
                      cursor: "pointer",
                      padding: "2px 4px", 
                      lineHeight: 1,
                      display: "inline-flex", // SVG ko center align karne ke liye
                      alignItems: "center",
                      filter: feedback.rating >= n ? "none" : "grayscale(1) opacity(0.3)",
                      transition: "transform 0.12s, filter 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.25)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    title={STAR_LABELS[n]}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="#FFD700" 
                      width="28" 
                      height="28"
                      style={{ transition: "all 0.2s" }}
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
                {feedback.rating > 0 && (
                  <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 6, fontWeight: 600 }}>
                    {STAR_LABELS[feedback.rating]}
                  </span>
                )}
              </div>
            </Row>

            <Divider />

            {/* ── Message ── */}
            <Row label="Your Message" hint="Describe your experience, idea, or issue in detail">
              <textarea
                className="glass-input"
                rows={4}
                placeholder="Share your thoughts — we read every single message…"
                value={feedback.message}
                onChange={e => setFeedback(f => ({ ...f, message: e.target.value }))}
                style={{
                  width: "100%", resize: "vertical",
                  fontSize: 13, lineHeight: 1.6,
                  padding: "12px 14px",
                  minHeight: 100,
                }}
              />
            </Row>

            {/* ── Submit ── */}
            <div style={{ padding: "4px 0 8px" }}>
              <button
                onClick={submitFeedback}
                disabled={!feedbackReady || sendingFeedback}
                style={{
                  width: "100%", padding: "12px 16px",
                  borderRadius: "var(--radius-pill)", fontSize: 13,
                  fontWeight: 700, fontFamily: "inherit", letterSpacing: 0.4,
                  cursor:     feedbackReady && !sendingFeedback ? "pointer" : "not-allowed",
                  background: "linear-gradient(135deg, var(--accent-bg), rgba(212,163,115,0.12))",
                  border:     "1px solid var(--accent-border)",
                  color:      "var(--accent)",
                  opacity:    feedbackReady ? 1 : 0.4,
                  transition: "all 0.22s",
                  boxShadow:  feedbackReady ? "0 4px 20px var(--accent-glow)" : "none",
                }}
              >
                {sendingFeedback ? "Sending…  ✦" : "Submit Feedback  ✦"}
              </button>
              {!feedback.type && (
                <p style={{ fontSize: 10, textAlign: "center", color: "var(--text-color)", opacity: 0.35, marginTop: 8 }}>
                  Please select a category above to continue.
                </p>
              )}
            </div>
          </>
        )}

      </Section>

      {/* ── System & Legal ── */}
      <Section title="System & Legal" icon={<GearIcon size={16} />}>
        <Row
          label="Restore Defaults"
          hint="Reset to the Midnight Rose theme"
          action={
            <button className="glass-btn" style={{ fontSize: 11, padding: "8px 16px" }} onClick={() => applyPreset(PRESETS[0])}>
              Reset
            </button>
          }
        />
        <Divider />
        <Row
          label="Privacy Policy"
          hint="Read our privacy and data guidelines"
          action={
            <button className="glass-btn" style={{ fontSize: 11, padding: "8px 16px" }} onClick={() => setShowPrivacy(true)}>
              View
            </button>
          }
        />
        <Divider />
        <Row
          label="Sign Out"
          hint="Return to the cover screen"
          action={
            <button
              className="danger-btn"
              style={{ opacity: signingOut ? 0.5 : 1 }}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          }
        />
      </Section>

    </div>
  );
}