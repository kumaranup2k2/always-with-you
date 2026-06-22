import { useState, useEffect, useRef } from "react";
import { signInWithPopup, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../firebase/config";

const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function Orb({ style }) {
  return (
    <div style={{
      position: "absolute",
      borderRadius: "50%",
      filter: "blur(60px)",
      pointerEvents: "none",
      ...style
    }} />
  );
}

// ── Username Setup Modal ─────────────────────────────────────
function UsernameSetup({ user, onComplete }) {
  const [displayName, setDisplayName] = useState(user?.displayName?.split(" ")[0] || "");
  const [username, setUsername]       = useState("");
  const [dob, setDob]                 = useState("");
  const [error, setError]             = useState("");
  const [saving, setSaving]           = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) { setError("Please enter your name."); return; }
    if (!username.trim()) { setError("Please choose a username."); return; }
    if (!dob) { setError("Please enter your date of birth."); return; }
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (clean.length < 3) { setError("Username must be at least 3 characters."); return; }
    setSaving(true);
    setError("");
    try {
      // Check if username is taken
      const uSnap = await getDoc(doc(db, "usernames", clean));
      if (uSnap.exists() && uSnap.data().uid !== user.uid) {
        setError("Username already taken. Try another.");
        setSaving(false);
        return;
      }
      // Save username mapping
      await setDoc(doc(db, "usernames", clean), { uid: user.uid, name: displayName.trim() });
      // Save user profile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: displayName.trim(),
        username: clean,
        dob: dob,
        email: user.email,
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString(),
      }, { merge: true });
      // Update Firebase auth profile
      await updateProfile(user, { displayName: displayName.trim() });
      onComplete({ name: displayName.trim(), username: clean, dob });
    } catch (e) {
      setError("Something went wrong. Please try again.");
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)"
    }}>
      <div className="glass-panel" style={{
        width: "100%", maxWidth: 340, padding: "36px 28px", textAlign: "center",
        animation: "modalPop 0.45s cubic-bezier(0.34,1.2,0.64,1)"
      }}>
        {user?.photoURL && (
          <img src={user.photoURL} alt="" style={{
            width: 60, height: 60, borderRadius: "50%", marginBottom: 16,
            border: "2px solid var(--accent-border)"
          }} />
        )}
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600,
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          marginBottom: 6
        }}>Welcome! 🌸</h2>
        <p style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45, marginBottom: 24, lineHeight: 1.6 }}>
          Set up your profile to get started
        </p>

        <div style={{ marginBottom: 14, textAlign: "left" }}>
          <label style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.45, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Your Name
          </label>
          <input
            className="glass-input"
            style={{ width: "100%", fontSize: 14 }}
            placeholder="What should we call you?"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14, textAlign: "left" }}>
          <label style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.45, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Date of Birth
          </label>
          <input
            type="date"
            className="glass-input"
            style={{ width: "100%", fontSize: 14 }}
            value={dob}
            onChange={e => setDob(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 20, textAlign: "left" }}>
          <label style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.45, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Username
          </label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--accent)", opacity: 0.6, fontSize: 14, pointerEvents: "none"
            }}>@</span>
            <input
              className="glass-input"
              style={{ width: "100%", fontSize: 14, paddingLeft: 26 }}
              placeholder="choose_username"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
            />
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
            Letters, numbers, _ and . only. Min 3 chars.
          </p>
        </div>

        {error && (
          <div style={{
            fontSize: 11, color: "var(--error-color)", marginBottom: 14,
            background: "var(--error-bg)", borderRadius: 10,
            padding: "8px 12px", border: "1px solid var(--error-border)"
          }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="glass-btn"
          style={{ width: "100%" }}
        >
          {saving ? "Setting up..." : "Get Started ✨"}
        </button>
      </div>
      <style>{`@keyframes modalPop { from { transform: scale(0.88); opacity:0; } to { transform: scale(1); opacity:1; } }`}</style>
    </div>
  );
}

export default function CoverPage({ onOpen }) {
  const [loading, setLoading]           = useState(false);
  const [isBirthday, setIsBirthday]     = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [error, setError]               = useState(null);
  const [pendingUser, setPendingUser]   = useState(null); // user needing username setup
  const btnRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
    const today = new Date();
    if (today.getDate() === 4 && today.getMonth() === 5) {
      setIsBirthday(true);
      setShowBirthday(true);
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user has a username already
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().username) {
          onOpen();
        } else {
          setPendingUser(user);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will fire above
    } catch (err) {
      console.error("Login Error:", err);
      const msg = err.code === "auth/popup-closed-by-user"
        ? "Sign-in window was closed."
        : err.code === "auth/network-request-failed"
        ? "Network error. Check your connection."
        : "Login failed. Please try again.";
      setError(msg);
      setLoading(false);
    }
  };

  const today = new Date();
  const dateStr = `${DAYS[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]}`;

  // ── Birthday Card ─────────────────────────────────────
  if (showBirthday) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 16, overflow: "hidden",
        position: "relative", backgroundColor: "#0d0906"
      }}>
        <Orb style={{ width: 300, height: 300, top: "10%", left: "5%",  background: "rgba(139, 90, 43, 0.18)" }} />
        <Orb style={{ width: 250, height: 250, bottom: "15%", right: "5%", background: "rgba(255, 105, 180, 0.12)" }} />
        <div className="glass-panel" style={{
          width: "100%", maxWidth: 340, padding: "48px 28px",
          textAlign: "center",
          background: "rgba(139, 90, 43, 0.05)",
          border: "1px solid rgba(255, 182, 193, 0.25)",
          animation: "modalPop 0.6s cubic-bezier(0.34,1.2,0.64,1)"
        }}>
          <div style={{ fontSize: 52, marginBottom: 20, display: "inline-block", animation: "float 3s ease-in-out infinite" }}>🎂</div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 30, fontWeight: 600, letterSpacing: 1,
            background: "linear-gradient(160deg, #ffb6c1 0%, #d4a373 50%, #8b5a2b 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8, lineHeight: 1.3
          }}>
            Happy Birthday<br />🌸
          </h1>
          <div style={{ width: 40, height: 1, background: "rgba(139, 90, 43, 0.3)", margin: "16px auto" }} />
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.75)",
            lineHeight: 1.7, marginBottom: 28, fontStyle: "italic",
            fontFamily: "'Playfair Display', serif"
          }}>
            "May your day be as beautiful as your smile. Here is a little something to keep your thoughts safe, today and always."
          </div>
          <button
            onClick={() => setShowBirthday(false)}
            style={{
              background: "linear-gradient(135deg, rgba(139, 90, 43, 0.4), rgba(255, 182, 193, 0.25))",
              border: "1px solid rgba(255, 182, 193, 0.4)",
              color: "#fff", padding: "11px 28px",
              borderRadius: 30, fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.25s", letterSpacing: 0.5
            }}
          >
            Thank You ☕💕
          </button>
        </div>
        <style>{`
          @keyframes modalPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {/* Username setup modal when user just signed in */}
      {pendingUser && (
        <UsernameSetup
          user={pendingUser}
          onComplete={() => { setPendingUser(null); onOpen(); }}
        />
      )}

      <div style={{
        height: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 16, overflow: "hidden", position: "relative",
        backgroundColor: "#0d0906"
      }}>
        <Orb style={{ width: 350, height: 350, top: "5%", right: "-10%", background: "rgba(255, 182, 193, 0.12)" }} />
        <Orb style={{ width: 280, height: 280, bottom: "10%", left: "-8%", background: "rgba(139, 90, 43, 0.16)" }} />

        <div className="glass-panel" style={{
          width: "100%", maxWidth: 290,
          padding: "36px 24px", textAlign: "center",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.7s ease, transform 0.7s ease"
        }}>
          <div style={{ color: "rgba(255, 182, 193, 0.4)", fontSize: 9, letterSpacing: 4, marginBottom: 18 }}>— ✦ —</div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 18, fontWeight: 600, letterSpacing: 2,
            background: "linear-gradient(180deg, #ffb6c1 0%, #d4a373 45%, #8b5a2b 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 4, lineHeight: 1.3
          }}>
            Always With You
          </h1>

          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 3, textTransform: "uppercase" }}>
            Personal Diary
          </div>

          {isBirthday && (
            <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 6, letterSpacing: 1 }}>
              ✦ Happy Birthday ✦
            </div>
          )}

          <div style={{ width: 36, height: 1, background: "rgba(255, 182, 193, 0.15)", margin: "18px auto" }} />

          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 28 }}>
            {dateStr}
          </div>

          {error && (
            <div style={{
              fontSize: 11, color: "#ff8a8a", marginBottom: 14,
              background: "rgba(255,100,100,0.08)", borderRadius: 10,
              padding: "8px 12px", border: "1px solid rgba(255,100,100,0.15)"
            }}>
              {error}
            </div>
          )}

          <button
            ref={btnRef}
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              background: loading ? "rgba(139, 90, 43, 0.05)" : "rgba(139, 90, 43, 0.15)",
              border: "1px solid rgba(255, 182, 193, 0.25)",
              color: "#fff", padding: "10px 22px", borderRadius: 24,
              fontSize: 12, cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.25s", letterSpacing: 0.5, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8,
              margin: "0 auto", opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? (
              <>
                <span style={{ width: 12, height: 12, border: "1.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }}/>
                Opening...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes shimmer { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
        `}</style>
      </div>
    </>
  );
}
