import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase/config";
import PrivacyPolicy from "../../PrivacyPolicy";
import { PaletteIcon, BrushIcon, LayoutIcon, EyeIcon, GearIcon, SparklesIcon, RoseIcon, MoonStarIcon, WavesIcon, LeafIcon, SunIcon, FeatherIcon } from "../components/common/Icons";

// ── Preset themes ─────────────────────────────────────────────
const PRESETS = [
  {
    id: "midnight",
    label: "Midnight Rose",
    icon: <RoseIcon size={14} />,
    vars: {
      bg: "#0d141e", text: "#f0f0f0", accent: "#ffb6c1", accent2: "#d4a373",
      glass: "0.05", blur: "35", radius: "24",
    },
  },
  {
    id: "dusk",
    label: "Dusty Dusk",
    icon: <MoonStarIcon size={14} />,
    vars: {
      bg: "#1a0f1e", text: "#f5eeff", accent: "#c8aaff", accent2: "#e8b4d0",
      glass: "0.07", blur: "30", radius: "24",
    },
  },
  {
    id: "ocean",
    label: "Deep Ocean",
    icon: <WavesIcon size={14} />,
    vars: {
      bg: "#0a1628", text: "#e8f4ff", accent: "#7ec8e3", accent2: "#4a90d9",
      glass: "0.06", blur: "32", radius: "20",
    },
  },
  {
    id: "forest",
    label: "Velvet Forest",
    icon: <LeafIcon size={14} />,
    vars: {
      bg: "#0d1a0f", text: "#e8f5e9", accent: "#96e6c8", accent2: "#52c47a",
      glass: "0.06", blur: "30", radius: "22",
    },
  },
  {
    id: "sunset",
    label: "Golden Sunset",
    icon: <SunIcon size={14} />,
    vars: {
      bg: "#1a0e06", text: "#fff5e6", accent: "#ffc896", accent2: "#ff9966",
      glass: "0.07", blur: "28", radius: "22",
    },
  },
  {
    id: "chalk",
    label: "Soft Chalk",
    icon: <FeatherIcon size={14} />,
    vars: {
      bg: "#f0ede8", text: "#2a2a2a", accent: "#b07498", accent2: "#9c6644",
      glass: "0.08", blur: "20", radius: "20",
    },
  },
];

// ── Accent color swatches ─────────────────────────────────────
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

// ── Background presets ────────────────────────────────────────
const BG_COLORS = [
  "#0d141e", "#0d0906", "#1a0f1e", "#0a1628",
  "#0d1a0f", "#1a0e06", "#1a1a2e", "#12121a",
  "#f0ede8", "#fff9f5", "#f5eeff",
];

// ── Glass intensity presets ───────────────────────────────────
const GLASS_PRESETS = [
  { label: "Ultra", value: "0.02" },
  { label: "Soft",  value: "0.05" },
  { label: "Mist",  value: "0.08" },
  { label: "Haze",  value: "0.12" },
  { label: "Frosted", value: "0.18" },
];

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12, fontWeight: 700, color: "var(--accent)",
        marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.2,
        paddingLeft: 4
      }}>
        {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
        {title}
      </div>
      <div className="glass-panel" style={{
        padding: "8px 16px",
        borderRadius: 20,
        border: "1px solid rgba(128,128,128,0.12)",
        background: "rgba(128, 128, 128, 0.03)"
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────────
function Row({ label, hint, action, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-color)" }}>{label}</div>
          {hint && <div style={{ fontSize: 11, opacity: 0.45, lineHeight: 1.4, marginTop: 4 }}>{hint}</div>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────
const Divider = () => <div style={{ height: 1, background: "rgba(128,128,128,0.1)", margin: "0" }} />;

// ── Toggle ────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span className="toggle-knob" />
    </label>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function SettingsPage({ theme, setTheme, showToast }) {
  const [signingOut, setSigningOut] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Apply a full preset
  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setTheme(prev => ({
      ...prev,
      bg:      preset.vars.bg,
      text:    preset.vars.text,
      accent:  preset.vars.accent,
      accent2: preset.vars.accent2,
      glass:   preset.vars.glass,
      blur:    preset.vars.blur,
      radius:  preset.vars.radius,
    }));
    // Apply accent2 CSS var directly (not in base theme object but we push it)
    document.documentElement.style.setProperty("--accent2", preset.vars.accent2);
    showToast?.(`Theme "${preset.label}" applied ✨`);
  };

  // Single field update
  const update = (key, value) => {
    setActivePreset(null); // deselect preset on manual change
    setTheme(prev => ({ ...prev, [key]: value }));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch {
      showToast?.("Sign out failed.");
      setSigningOut(false);
    }
  };

  const blur = parseFloat(theme.blur ?? 35);
  const radius = parseFloat(theme.radius ?? 24);
  const glass = parseFloat(theme.glass ?? 0.05);

  // Show privacy policy view if selected
  if (showPrivacy) {
    return (
      <div className="fade-in-page" style={{ padding: "18px 20px 60px", overflowY: "auto", height: "100%" }}>
        <button 
          className="glass-btn" 
          style={{ marginBottom: 16, padding: "8px 16px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} 
          onClick={() => setShowPrivacy(false)}
        >
          <span>&larr;</span> Back to Settings
        </button>
        <PrivacyPolicy />
      </div>
    );
  }

  return (
    <div
      className="fade-in-page"
      style={{ padding: "10px 20px 30px", overflowY: "auto", height: "100%" }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: "center", paddingTop: 10 }}>
        <div style={{ 
          display: "inline-flex", alignItems: "center", justifyContent: "center", 
          width: 56, height: 56, borderRadius: "50%", 
          background: "var(--glass-bg)", border: "1px solid var(--accent-border)", 
          marginBottom: 12, boxShadow: "0 8px 32px var(--accent-glow)",
          color: "var(--accent)"
        }}>
           <SparklesIcon size={28} />
        </div>
        <h2
          className="font-display gradient-text-rose"
          style={{ fontSize: 24, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}
        >
          Settings
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.5, letterSpacing: 0.5 }}>
          Make your diary truly yours
        </p>
      </div>

      {/* ── Preset themes ── */}
      <Section title="Themes" icon={<PaletteIcon size={16} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "8px 0" }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-pill)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: activePreset === p.id ? 700 : 500,
                background: activePreset === p.id
                  ? "var(--accent-bg)"
                  : "rgba(128,128,128,0.05)",
                border: activePreset === p.id
                  ? "1px solid var(--accent-strong)"
                  : "1px solid rgba(128,128,128,0.15)",
                color: activePreset === p.id ? "var(--accent)" : "var(--text-color)",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 6,
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
          hint="Used for primary buttons and highlights"
          action={
            <input
              type="color"
              value={theme.accent}
              onChange={e => update("accent", e.target.value)}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent", padding: 0, borderRadius: 8 }}
            />
          }
        >
          <div className="swatch-grid">
            {ACCENT_SWATCHES.map(s => (
              <button
                key={s.color}
                title={s.label}
                className={`color-swatch ${theme.accent === s.color ? "selected" : ""}`}
                style={{ background: s.color }}
                onClick={() => update("accent", s.color)}
              />
            ))}
          </div>
        </Row>
        <Divider />

        <Row 
          label="Background Color" 
          hint="App wallpaper or solid color"
          action={
            <input
              type="color"
              value={theme.bg}
              onChange={e => update("bg", e.target.value)}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent", padding: 0, borderRadius: 8 }}
            />
          }
        >
          <div className="swatch-grid" style={{ marginBottom: 12 }}>
            {BG_COLORS.map(c => (
              <button
                key={c}
                className={`color-swatch ${theme.bg === c ? "selected" : ""}`}
                style={{ background: c, border: c === "#f0ede8" || c === "#fff9f5" ? "1.5px solid rgba(0,0,0,0.15)" : undefined }}
                onClick={() => update("bg", c)}
                title={c}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              className="glass-input"
              style={{ flex: 1, fontSize: 12, padding: "8px 12px" }}
              placeholder="Paste custom image URL here..."
              value={theme.image !== "none" ? theme.image : ""}
              onChange={e => update("image", e.target.value ? `url("${e.target.value}")` : "none")}
            />
            {theme.image !== "none" && (
              <button
                className="glass-btn"
                style={{ padding: "8px 14px", fontSize: 11 }}
                onClick={() => update("image", "none")}
              >
                Clear
              </button>
            )}
          </div>
        </Row>
        <Divider />

        <Row 
          label="Text Color" 
          hint="Light for dark themes, dark for light themes"
          action={
            <input
              type="color"
              value={theme.text}
              onChange={e => update("text", e.target.value)}
              style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent", padding: 0, borderRadius: 8 }}
            />
          }
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {["#f0f0f0", "#ffffff", "#e8e8e8", "#2a2a2a", "#1a1a1a"].map(c => (
              <button
                key={c}
                className={`color-swatch ${theme.text === c ? "selected" : ""}`}
                style={{
                  background: c,
                  width: 24, height: 24,
                  border: c === "#f0f0f0" || c === "#ffffff" || c === "#e8e8e8"
                    ? "1.5px solid rgba(128,128,128,0.4)"
                    : "none",
                }}
                onClick={() => update("text", c)}
                title={c}
              />
            ))}
          </div>
        </Row>
      </Section>

      {/* ── Glass & blur ── */}
      <Section title="Glass & Layout" icon={<LayoutIcon size={16} />}>
        <Row 
          label="Glass Intensity" 
          hint="Transparency of the glass panels"
          action={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(glass * 100)}%</span>}
        >
          <input
            type="range"
            className="glass-slider"
            min="0.01"
            max="0.35"
            step="0.01"
            value={glass}
            onChange={e => update("glass", String(e.target.value))}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {GLASS_PRESETS.map(gp => (
              <button
                key={gp.value}
                onClick={() => update("glass", gp.value)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: theme.glass === gp.value ? "var(--accent-bg)" : "rgba(128,128,128,0.05)",
                  border: theme.glass === gp.value ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
                  color: theme.glass === gp.value ? "var(--accent)" : "var(--text-color)",
                }}
              >
                {gp.label}
              </button>
            ))}
          </div>
        </Row>
        <Divider />

        <Row 
          label="Backdrop Blur" 
          hint="Blur effect behind glass panels"
          action={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(blur)}px</span>}
        >
          <input
            type="range"
            className="glass-slider"
            min="0"
            max="60"
            step="1"
            value={blur}
            onChange={e => update("blur", String(e.target.value))}
          />
        </Row>
        <Divider />

        <Row 
          label="Panel Roundness" 
          hint="Border radius of all cards and inputs"
          action={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(radius)}px</span>}
        >
          <input
            type="range"
            className="glass-slider"
            min="0"
            max="40"
            step="2"
            value={radius}
            onChange={e => update("radius", String(e.target.value))}
          />
        </Row>
      </Section>

      {/* ── Live preview card ── */}
      <Section title="Live Preview" icon={<EyeIcon size={16} />}>
        <div style={{
          padding: "20px",
          background: "var(--glass-bg)",
          borderRadius: `${radius}px`,
          border: "1px solid var(--glass-border)",
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--accent)",
            marginBottom: 8,
          }}>
            Always With You ✦
          </div>
          <div style={{ fontSize: 13, color: "var(--text-color)", opacity: 0.75, marginBottom: 16, lineHeight: 1.6 }}>
            This is how your diary looks with the current theme settings. Feel free to play around with the colors!
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{
              padding: "6px 16px",
              borderRadius: "99px",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              color: "var(--accent)",
              fontSize: 11,
              fontWeight: 600,
            }}>
              Primary
            </div>
            <div style={{
              padding: "6px 16px",
              borderRadius: "99px",
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              color: "var(--text-color)",
              fontSize: 11,
              opacity: 0.8,
            }}>
              Secondary
            </div>
          </div>
        </div>
      </Section>

      {/* ── System & Legal ── */}
      <Section title="System & Legal" icon={<GearIcon size={16} />}>
        <Row 
          label="Restore defaults" 
          hint="Go back to Midnight Rose theme" 
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
          label="Sign out" 
          hint="Return to the cover screen" 
          action={
            <button
              className="glass-btn"
              style={{ 
                fontSize: 12, 
                padding: "8px 16px", 
                opacity: signingOut ? 0.5 : 1, 
                backgroundColor: "#ff4444", 
                color: "#ffffff", 
                border: "none",
                fontWeight: 600
              }}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          } 
        />
      </Section>
    </div>
  );
}