import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase/config"; // ← apna firebase config path yahan adjust karo
import { getAuth } from "firebase/auth";  // ← Firebase Auth import
import { PinIcon, PinnedIcon, ThoughtIcon, TodoIcon, QuoteIcon, ReminderIcon, EditIcon, DeleteIcon, SparklesIcon, ReplyIcon, SearchIcon, FlowerIcon } from "./Icons";

// ── Palette of soft feminine note colors ──────────────────────
const NOTE_COLORS = [
  { id: "pink",       bg: "rgba(255,182,193,0.12)", border: "rgba(255,182,193,0.28)", accent: "#ffb6c1", label: "Pink"       },
  { id: "lavender",   bg: "rgba(200,170,255,0.12)", border: "rgba(200,170,255,0.28)", accent: "#c8aaff", label: "Lavender"   },
  { id: "mint",       bg: "rgba(150,230,200,0.10)", border: "rgba(150,230,200,0.25)", accent: "#96e6c8", label: "Mint"       },
  { id: "peach",      bg: "rgba(255,200,150,0.12)", border: "rgba(255,200,150,0.28)", accent: "#ffc896", label: "Peach"      },
  { id: "sky",        bg: "rgba(150,210,255,0.11)", border: "rgba(150,210,255,0.26)", accent: "#96d2ff", label: "Sky"        },
  { id: "rose",       bg: "rgba(255,130,160,0.11)", border: "rgba(255,130,160,0.26)", accent: "#ff82a0", label: "Rose"       },
  { id: "buttercup",  bg: "rgba(255,245,157,0.12)", border: "rgba(255,245,157,0.28)", accent: "#fff59d", label: "Buttercup"  },
  { id: "lilac",      bg: "rgba(224,176,255,0.12)", border: "rgba(224,176,255,0.28)", accent: "#e0b0ff", label: "Lilac"      },
  { id: "blush",      bg: "rgba(222,93,131,0.10)",  border: "rgba(222,93,131,0.25)",  accent: "#de5d83", label: "Blush"      },
  { id: "sage",       bg: "rgba(188,216,193,0.12)", border: "rgba(188,216,193,0.28)", accent: "#bcd8c1", label: "Sage"       },
  { id: "coral",      bg: "rgba(255,127,80,0.10)",  border: "rgba(255,127,80,0.25)",  accent: "#ff7f50", label: "Coral"      },
  { id: "periwinkle", bg: "rgba(204,204,255,0.12)", border: "rgba(204,204,255,0.28)", accent: "#ccccff", label: "Periwinkle" },
  { id: "matcha",     bg: "rgba(197,227,132,0.12)", border: "rgba(197,227,132,0.28)", accent: "#c5e384", label: "Matcha"     },
  { id: "cerulean",   bg: "rgba(152,180,212,0.12)", border: "rgba(152,180,212,0.28)", accent: "#98b4d4", label: "Cerulean"   },
  { id: "champagne",  bg: "rgba(247,231,206,0.15)", border: "rgba(247,231,206,0.30)", accent: "#f7e7ce", label: "Champagne"  },
  { id: "seafoam",    bg: "rgba(113,238,184,0.10)", border: "rgba(113,238,184,0.25)", accent: "#71eeb8", label: "Seafoam"    },
  { id: "apricot",    bg: "rgba(251,206,177,0.12)", border: "rgba(251,206,177,0.28)", accent: "#fbceb1", label: "Apricot"    },
  { id: "plum",       bg: "rgba(221,160,221,0.12)", border: "rgba(221,160,221,0.28)", accent: "#dda0dd", label: "Plum"       },
];

const NOTE_TYPES = [
  { id: "sticky",   label: "Sticky Note",   icon: <PinIcon size={14} /> },
  { id: "thought",  label: "Quick Thought", icon: <ThoughtIcon size={14} /> },
  { id: "todo",     label: "To-Do",         icon: <TodoIcon size={14} /> },
  { id: "quote",    label: "Quote",         icon: <QuoteIcon size={14} /> },
  { id: "reminder", label: "Reminder",      icon: <ReminderIcon size={14} /> },
];

// ── Firebase helpers ──────────────────────────────────────────
const NOTES_COLLECTION = "notes";

async function fbAddNote(data) {
  const docRef = await addDoc(collection(db, NOTES_COLLECTION), {
    ...data,
    pinned:    false,
    replies:   [],
    createdAt: serverTimestamp(),
    updatedAt: null,
  });
  return docRef.id;
}

async function fbUpdateNote(id, data) {
  await updateDoc(doc(db, NOTES_COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

async function fbDeleteNote(id) {
  await deleteDoc(doc(db, NOTES_COLLECTION, id));
}

async function fbAddReply(noteId, replyData) {
  await updateDoc(doc(db, NOTES_COLLECTION, noteId), {
    replies: arrayUnion({
      ...replyData,
      id:        Date.now().toString(),
      createdAt: new Date().toISOString(),
    }),
  });
}

// ── Reply Composer ────────────────────────────────────────────
function ReplyComposer({ noteId, color, onReply, onClose }) {
  const [text,    setText]    = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await onReply(noteId, { content: text.trim() });
      setText("");
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      marginTop: 10,
      background: "rgba(0,0,0,0.12)",
      borderRadius: 12,
      padding: "10px 12px",
      borderLeft: `2px solid ${color.accent}55`,
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{ fontSize: 10, color: color.accent, marginBottom: 6, letterSpacing: 0.5, opacity: 0.8, display: "flex", alignItems: "center", gap: 4 }}>
        <QuoteIcon size={12} /> Write a reply...
      </div>
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && e.ctrlKey) handleSend();
        }}
        placeholder="Your reply..."
        rows={2}
        style={{
          width: "100%", resize: "none",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${color.border}`,
          borderRadius: 8, color: "var(--text-color)",
          fontSize: 12, lineHeight: 1.55,
          padding: "8px 10px", outline: "none",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "1px solid rgba(128,128,128,0.2)",
            color: "var(--text-color)", padding: "4px 10px",
            borderRadius: 14, fontSize: 10, cursor: "pointer", opacity: 0.6,
          }}
        >Cancel</button>
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          style={{
            background: `${color.accent}22`,
            border: `1px solid ${color.accent}55`,
            color: color.accent, padding: "4px 12px",
            borderRadius: 14, fontSize: 10, fontWeight: 600,
            cursor: "pointer", opacity: (sending || !text.trim()) ? 0.4 : 1,
          }}
        >{sending ? "Sending..." : <span style={{ display: "flex", alignItems: "center", gap: 4 }}>Reply <SparklesIcon size={12} /></span>}</button>
      </div>
      <div style={{ fontSize: 9, opacity: 0.28, marginTop: 4, textAlign: "right" }}>
        Ctrl+Enter to send · Esc to cancel
      </div>
    </div>
  );
}

// ── Replies Thread ────────────────────────────────────────────
function RepliesThread({ replies, color }) {
  if (!replies || replies.length === 0) return null;

  return (
    <div style={{ marginTop: 10, borderLeft: `2px solid ${color.accent}30`, paddingLeft: 10 }}>
      <div style={{ fontSize: 9, color: color.accent, letterSpacing: 0.8, opacity: 0.6, marginBottom: 6, textTransform: "uppercase" }}>
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </div>
      {replies.map((reply) => {
        const date = reply.createdAt
          ? new Date(reply.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          : "";
        return (
          <div
            key={reply.id}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${color.border}`,
              borderRadius: 10,
              padding: "7px 10px",
              marginBottom: 6,
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ fontSize: 12, lineHeight: 1.55, opacity: 0.82, whiteSpace: "pre-wrap" }}>
              {reply.content}
            </div>
            <div style={{ fontSize: 9, opacity: 0.3, marginTop: 4, textAlign: "right" }}>
              {date}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ note, color, onSave, onClose }) {
  const [title,   setTitle]   = useState(note.title   || "");
  const [content, setContent] = useState(note.content || "");
  const [saving,  setSaving]  = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, []);

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) return;
    setSaving(true);
    try {
      await onSave(note.id, { content, title });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.18s ease",
      }}
    >
      {/* Modal box */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   "var(--card-bg, #1a1a2e)",
          border:       `1.5px solid ${color.accent}44`,
          borderTop:    `3px solid ${color.accent}`,
          borderRadius: 20,
          padding:      "20px 22px",
          width:        "min(90vw, 420px)",
          boxShadow:    `0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px ${color.border}`,
          animation:    "slideUp 0.22s ease",
        }}
      >
        <div style={{ fontSize: 11, color: color.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <EditIcon size={14} /> Edit Note
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title (optional)..."
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: "none", borderBottom: `1px solid ${color.border}`,
            color: "var(--text-color)", fontSize: 14, fontWeight: 600,
            padding: "4px 0", marginBottom: 12, outline: "none", fontFamily: "inherit",
          }}
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && e.ctrlKey) handleSave();
          }}
          rows={5}
          placeholder="Write something beautiful..."
          style={{
            width: "100%", resize: "vertical",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${color.border}`, borderRadius: 10,
            color: "var(--text-color)", fontSize: 13, lineHeight: 1.6,
            padding: "10px 12px", outline: "none", fontFamily: "inherit", minHeight: 100,
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid var(--input-border)",
              color: "var(--text-color)", padding: "6px 14px",
              borderRadius: 16, fontSize: 11, cursor: "pointer", opacity: 0.65,
            }}
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || (!content.trim() && !title.trim())}
            style={{
              background: `${color.accent}22`, border: `1px solid ${color.accent}55`,
              color: color.accent, padding: "6px 16px",
              borderRadius: 16, fontSize: 11, fontWeight: 600,
              cursor: "pointer", opacity: saving ? 0.5 : 1,
            }}
          >{saving ? "Saving..." : <span style={{ display: "flex", alignItems: "center", gap: 4 }}>Save <TodoIcon size={12} /></span>}</button>
        </div>
        <div style={{ fontSize: 9, opacity: 0.3, marginTop: 6, textAlign: "right" }}>
          Ctrl+Enter to save · Esc to cancel
        </div>
      </div>

      {/* inline keyframe for modal slide-up */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Single Note Card ──────────────────────────────────────────
// isOwner = true  → pin, edit, delete dikhega
// isOwner = false → sirf reply dikhega
function NoteCard({ note, currentUserId, onUpdate, onDelete, onPin, onReply }) {
  // isOwner: dono defined hon aur match karein tabhi true
  const isOwner = Boolean(note.userId && currentUserId && note.userId === currentUserId);

  const [hover,       setHover]       = useState(false);
  const [replyOpen,   setReplyOpen]   = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);

  const color = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
  const type  = NOTE_TYPES.find(t => t.id === note.type)   || NOTE_TYPES[0];

  const replies    = note.replies || [];
  const replyCount = replies.length;

  // ── Todo state ──────────────────────────────────────────────
  const [todos, setTodos] = useState(() => {
    if (note.type !== "todo") return [];
    return (note.content || "").split("\n").filter(Boolean).map((line, i) => ({
      id: i,
      text: line.replace(/^\[x\] |^\[ \] /, ""),
      done: line.startsWith("[x] "),
    }));
  });

  useEffect(() => {
    if (note.type !== "todo") return;
    setTodos(
      (note.content || "").split("\n").filter(Boolean).map((line, i) => ({
        id: i,
        text: line.replace(/^\[x\] |^\[ \] /, ""),
        done: line.startsWith("[x] "),
      }))
    );
  }, [note.content, note.type]);

  const toggleTodo = async (todoId) => {
    if (!isOwner) return; // sirf owner toggle kar sake
    const updated    = todos.map(t => t.id === todoId ? { ...t, done: !t.done } : t);
    setTodos(updated);
    const newContent = updated.map(t => `${t.done ? "[x]" : "[ ]"} ${t.text}`).join("\n");
    await onUpdate(note.id, { content: newContent });
  };

  const [newTodoText, setNewTodoText] = useState("");

  const addTodoItem = async (text) => {
    if (!isOwner || !text.trim()) return;
    const newTodo    = { id: Date.now(), text: text.trim(), done: false };
    const updated    = [...todos, newTodo];
    setTodos(updated);
    const newContent = updated.map(t => `${t.done ? "[x]" : "[ ]"} ${t.text}`).join("\n");
    await onUpdate(note.id, { content: newContent });
  };

  const createdDate = note.createdAt?.toDate
    ? note.createdAt.toDate()
    : new Date(note.createdAt);

  return (
    <>
      {/* Edit modal — only mounts when open */}
      {editOpen && (
        <EditModal
          note={note}
          color={color}
          onSave={onUpdate}
          onClose={() => setEditOpen(false)}
        />
      )}

      <div
        style={{
          background:   color.bg,
          border:       `1px solid ${note.pinned ? color.accent : color.border}`,
          borderTop:    `3px solid ${color.accent}`,
          borderRadius: 18,
          padding:      "14px 16px",
          position:     "relative",
          transition:   "all 0.22s ease",
          transform:    hover ? "translateY(-3px)" : "translateY(0)",
          boxShadow:    hover
            ? `0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px ${color.border}`
            : note.pinned
            ? `0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px ${color.border}`
            : "none",
          cursor:    "default",
          animation: "fadeIn 0.3s ease",
          wordBreak: "break-word",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Pin indicator */}
        {note.pinned && (
          <div style={{ position: "absolute", top: -4, right: 14, color: color.accent }}><PinnedIcon size={16} /></div>
        )}

        {/* Action buttons — owner ko pin+edit+delete, baki ko kuch nahi (hover par) */}
        {hover && isOwner && (
          <div style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 4, animation: "fadeIn 0.15s ease" }}>
            <ActionBtn icon={note.pinned ? <PinnedIcon size={14} /> : <PinIcon size={14} />} title={note.pinned ? "Unpin" : "Pin"}   onClick={() => onPin(note.id)}    color={color.accent} />
            <ActionBtn icon={<EditIcon size={14} />}                         title="Edit"                             onClick={() => setEditOpen(true)} color={color.accent} />
            <ActionBtn icon={<DeleteIcon size={14} />}                          title="Delete"                           onClick={() => onDelete(note.id)} color="var(--danger-color)"      />
          </div>
        )}

        {/* Type badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <span style={{ display: "flex", alignItems: "center" }}>{type.icon}</span>
          <span style={{ fontSize: 9, color: color.accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
            {type.label}
          </span>
          {/* "Your note" badge — sirf owner ko dikhega */}
          {isOwner && (
            <span style={{
              marginLeft: "auto", fontSize: 8, opacity: 0.4,
              background: `${color.accent}18`, border: `1px solid ${color.accent}33`,
              borderRadius: 8, padding: "1px 6px", color: color.accent,
            }}>you</span>
          )}
        </div>

        {/* Content */}
        <div>
          {note.title && (
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: color.accent }}>{note.title}</div>
          )}

          {note.type === "todo" ? (
            <div>
              {todos.map(todo => (
                <div
                  key={todo.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5, cursor: isOwner ? "pointer" : "default" }}
                  onClick={() => isOwner && toggleTodo(todo.id)}
                >
                  <div style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    background: todo.done ? color.accent : "transparent",
                    border: `1.5px solid ${todo.done ? color.accent : color.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}>
                    {todo.done && <span style={{ fontSize: 9, color: "#fff" }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, lineHeight: 1.5, opacity: todo.done ? 0.4 : 0.85, textDecoration: todo.done ? "line-through" : "none" }}>
                    {todo.text}
                  </span>
                </div>
              ))}
              {/* Add item — sirf owner ke liye */}
              {isOwner && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    value={newTodoText}
                    onChange={e => setNewTodoText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { addTodoItem(newTodoText); setNewTodoText(""); } }}
                    placeholder="Add item..."
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${color.border}`,
                      borderRadius: 8, color: "var(--text-color)", fontSize: 11, padding: "4px 10px",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={() => { addTodoItem(newTodoText); setNewTodoText(""); }}
                    style={{ background: `${color.accent}22`, border: "none", color: color.accent, padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}
                  >+</button>
                </div>
              )}
            </div>
          ) : note.type === "quote" ? (
            <div style={{
              borderLeft: `3px solid ${color.accent}66`, paddingLeft: 12,
              fontFamily: "'Playfair Display', serif", fontStyle: "italic",
              fontSize: 13, lineHeight: 1.7, opacity: 0.85,
            }}>
              "{note.content}"
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.65, opacity: 0.85, whiteSpace: "pre-wrap" }}>
              {note.content}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ fontSize: 9, opacity: 0.3 }}>
              {createdDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {note.updatedAt ? " · edited" : ""}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Reply count toggle */}
              {replyCount > 0 && (
                <button
                  onClick={() => setShowReplies(v => !v)}
                  style={{
                    background: showReplies ? `${color.accent}18` : "transparent",
                    border: `1px solid ${color.accent}33`,
                    color: color.accent, padding: "3px 9px",
                    borderRadius: 12, fontSize: 10, cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 4
                  }}
                >
                  <QuoteIcon size={12} /> {replyCount}
                </button>
              )}

              {/* Reply button */}
              <button
                onClick={() => { setReplyOpen(v => !v); setShowReplies(true); }}
                style={{
                  background: replyOpen ? `${color.accent}18` : "transparent",
                  border: `1px solid ${replyOpen ? color.accent + "55" : color.border}`,
                  color: replyOpen ? color.accent : "var(--text-color)",
                  padding: "3px 9px", borderRadius: 12, fontSize: 10,
                  cursor: "pointer", transition: "all 0.15s", opacity: replyOpen ? 1 : 0.55,
                  display: "flex", alignItems: "center", gap: 4
                }}
              >
                <ReplyIcon size={12} /> Reply
              </button>
            </div>
          </div>
        </div>

        {/* Reply composer */}
        {replyOpen && (
          <ReplyComposer
            noteId={note.id}
            color={color}
            onReply={onReply}
            onClose={() => setReplyOpen(false)}
          />
        )}

        {/* Replies thread */}
        {showReplies && replyCount > 0 && (
          <RepliesThread replies={replies} color={color} />
        )}
      </div>
    </>
  );
}

function ActionBtn({ icon, title, onClick, color }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: h ? `${color}22` : "rgba(0,0,0,0.2)",
        border: "none", borderRadius: 8,
        width: 24, height: 24, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        color: color
      }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {icon}
    </button>
  );
}

// ── New Note Composer ────────────────────────────────────────
function NoteComposer({ onAdd }) {
  const [open,    setOpen]    = useState(false);
  const [content, setContent] = useState("");
  const [title,   setTitle]   = useState("");
  const [color,   setColor]   = useState("pink");
  const [type,    setType]    = useState("sticky");
  const [adding,  setAdding]  = useState(false);
  const inputRef = useRef(null);

  const reset = () => { setContent(""); setTitle(""); setColor("pink"); setType("sticky"); setOpen(false); };

  const handleAdd = async () => {
    if (!content.trim() && !title.trim()) return;
    setAdding(true);
    try {
      await onAdd({ content: content.trim(), title: title.trim(), color, type });
      reset();
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selectedColor = NOTE_COLORS.find(c => c.id === color);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", padding: "14px 18px",
          background: "var(--add-note-bg)",
          border: "1.5px dashed var(--add-note-border)",
          borderRadius: 18, color: "var(--add-note-color)",
          fontSize: 13, cursor: "pointer", textAlign: "left",
          transition: "all 0.2s", letterSpacing: 0.3, fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 8,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--add-note-hover-bg)"; e.currentTarget.style.borderColor = "var(--add-note-hover-border)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--add-note-bg)"; e.currentTarget.style.borderColor = "var(--add-note-border)"; }}
      >
        <span style={{ display: "flex", alignItems: "center" }}><SparklesIcon size={16} /></span>
        Add a note, thought, or reminder...
      </button>
    );
  }

  return (
    <div style={{
      background:  selectedColor?.bg || "rgba(255,182,193,0.1)",
      border:      `1.5px solid ${selectedColor?.accent || "#ffb6c1"}55`,
      borderTop:   `3px solid ${selectedColor?.accent || "#ffb6c1"}`,
      borderRadius: 18, padding: "16px 18px",
      animation:   "fadeIn 0.25s ease",
    }}>
      {/* Type chips */}
      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        {NOTE_TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)}
            style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer",
              transition: "all 0.15s",
              background: type === t.id ? `${selectedColor?.accent}22` : "rgba(128,128,128,0.08)",
              border: `1px solid ${type === t.id ? selectedColor?.accent + "66" : "rgba(128,128,128,0.18)"}`,
              color:      type === t.id ? selectedColor?.accent : "var(--text-color)",
              fontWeight: type === t.id ? 600 : 400,
              display: "flex", alignItems: "center", gap: 4
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title (optional)..."
        style={{
          width: "100%", background: "transparent",
          border: "none", borderBottom: `1px solid ${selectedColor?.border || "rgba(255,182,193,0.2)"}`,
          color: "var(--text-color)", fontSize: 13, fontWeight: 600,
          padding: "4px 0", marginBottom: 10, outline: "none", fontFamily: "inherit",
        }}
      />

      {/* Content */}
      <textarea
        ref={inputRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => { if (e.key === "Escape") reset(); if (e.key === "Enter" && e.ctrlKey) handleAdd(); }}
        placeholder={
          type === "todo"       ? "Add items, one per line..."
          : type === "quote"    ? "Write something inspiring..."
          : type === "thought"  ? "What's on your mind?"
          : type === "reminder" ? "Don't forget..."
          : "Write your note..."
        }
        rows={3}
        style={{
          width: "100%", resize: "vertical",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${selectedColor?.border || "rgba(255,182,193,0.2)"}`,
          borderRadius: 10, color: "var(--text-color)", fontSize: 13,
          lineHeight: 1.6, padding: "10px 12px", outline: "none",
          fontFamily: "inherit", minHeight: 70,
        }}
      />

      {/* Color picker + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 10, opacity: 0.45, letterSpacing: 0.5 }}>Color</span>
        {NOTE_COLORS.map(c => (
          <button key={c.id} onClick={() => setColor(c.id)}
            style={{
              width: 18, height: 18, borderRadius: "50%",
              background: c.accent,
              border: color === c.id ? "2.5px solid var(--text-color)" : "1.5px solid rgba(128,128,128,0.3)",
              cursor: "pointer", transition: "transform 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            title={c.label}
          />
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={reset}
            style={{ background: "transparent", border: "1px solid rgba(128,128,128,0.2)", color: "var(--text-color)", padding: "5px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", opacity: 0.6 }}>
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={adding || (!content.trim() && !title.trim())}
            style={{ background: `${selectedColor?.accent}25`, border: `1px solid ${selectedColor?.accent}55`, color: selectedColor?.accent, padding: "5px 16px", borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: (adding || (!content.trim() && !title.trim())) ? 0.4 : 1 }}
          >
            {adding ? "Adding..." : <span style={{ display: "flex", alignItems: "center", gap: 4 }}>Add</span>}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 10, opacity: 0.3, marginTop: 6 }}>Ctrl+Enter to add · Esc to cancel</div>
    </div>
  );
}

// ── Filter Pill ───────────────────────────────────────────────
function FilterPill({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
        transition: "all 0.18s",
        background:  active ? "var(--accent-bg)"     : "var(--input-bg)",
        border:      active ? "1px solid var(--accent-border)" : "1px solid var(--input-border)",
        color:       active ? "var(--accent)"       : "var(--text-color)",
        fontWeight:  active ? 600 : 400,
        display: "flex", alignItems: "center", gap: 6
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {label}
    </button>
  );
}

// ── Main Notes Page ──────────────────────────────────────────
export default function NotesPage({ showToast }) {
  const [notes,         setNotes]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filter,        setFilter]        = useState("all");
  const [filterType,    setFilterType]    = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── Track Firebase Auth state properly ────────────────────
  useEffect(() => {
    const auth = getAuth();
    // onAuthStateChanged se hamesha sahi uid milega
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  // ── Realtime listener — SABKE notes dikhao (community feed) ──
  useEffect(() => {
    const notesRef = collection(db, NOTES_COLLECTION);
    const q        = query(notesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setNotes(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Notes fetch error:", err);
        showToast?.("Could not load notes.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── CRUD ──────────────────────────────────────────────────
  const addNote = useCallback(async (noteData) => {
    try {
      // currentUserId (state se) note mein save hoga — ownership ke liye
      await fbAddNote({ ...noteData, userId: currentUserId });
      showToast?.("Note added");
    } catch {
      showToast?.("Could not add note. Try again.");
    }
  }, [currentUserId, showToast]);

  const updateNote = useCallback(async (id, data) => {
    try {
      await fbUpdateNote(id, data);
    } catch {
      showToast?.("Could not update. Try again.");
    }
  }, [showToast]);

  const deleteNote = useCallback(async (id) => {
    try {
      await fbDeleteNote(id);
      showToast?.("Note deleted.");
    } catch {
      showToast?.("Could not delete note. Try again.");
    }
  }, [showToast]);

  const pinNote = useCallback(async (id) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    try {
      await fbUpdateNote(id, { pinned: !note.pinned });
    } catch {
      showToast?.("Could not pin note. Try again.");
    }
  }, [notes, showToast]);

  const addReply = useCallback(async (noteId, replyData) => {
    try {
      await fbAddReply(noteId, replyData);
      showToast?.("Reply added");
    } catch {
      showToast?.("Could not add reply. Try again.");
    }
  }, [showToast]);

  // ── Filter + search ───────────────────────────────────────
  let displayed = notes.filter(n => {
    const text        = ((n.title || "") + " " + (n.content || "")).toLowerCase();
    const matchSearch = !search || text.includes(search.toLowerCase());
    const matchFilter =
      filter === "all"    ? true :
      filter === "pinned" ? n.pinned :
      filter === "type"   ? n.type === filterType : true;
    return matchSearch && matchFilter;
  });

  displayed = [
    ...displayed.filter(n => n.pinned),
    ...displayed.filter(n => !n.pinned),
  ];

  const pinnedCount = notes.filter(n => n.pinned).length;

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, opacity: 0.5, marginBottom: 6 }}>
        Loading notes...
      </div>
      <div style={{ fontSize: 11, opacity: 0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>Fetching your thoughts <SparklesIcon size={12} /></div>
    </div>
  );

  return (
    <div style={{ padding: "16px 20px 40px" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600,
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          letterSpacing: 1, marginBottom: 4,
        }}>Thoughts</h2>
        <p style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.5, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
          Share your thoughts Anonymously <SparklesIcon size={12} />
        </p>
      </div>

      {/* Composer */}
      <div style={{ marginBottom: 16 }}>
        <NoteComposer onAdd={addNote} />
      </div>

      {/* Search */}
      {notes.length > 0 && (
        <input
          type="text"
          placeholder="Search notes..."
          className="glass-input"
          style={{ width: "100%", marginBottom: 12, fontSize: 12 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {/* Filter pills */}
      {notes.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <FilterPill label={`All (${notes.length})`} active={filter === "all"} onClick={() => { setFilter("all"); setFilterType(null); }} />
          {pinnedCount > 0 && (
            <FilterPill label={`Pinned (${pinnedCount})`} icon={<PinnedIcon size={12} />} active={filter === "pinned"} onClick={() => { setFilter("pinned"); setFilterType(null); }} />
          )}
          {NOTE_TYPES.filter(t => notes.some(n => n.type === t.id)).map(t => (
            <FilterPill key={t.id} label={t.label} icon={t.icon}
              active={filter === "type" && filterType === t.id}
              onClick={() => { setFilter("type"); setFilterType(t.id); }} />
          ))}
        </div>
      )}

      {/* Notes count */}
      {displayed.length > 0 && (
        <div style={{ fontSize: 10, opacity: 0.35, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          {displayed.length} {displayed.length === 1 ? "note" : "notes"}
          {notes.length !== displayed.length ? ` of ${notes.length}` : ""}
        </div>
      )}

      {/* Empty states */}
      {notes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><FlowerIcon size={40} color="var(--accent)" /></div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, opacity: 0.45, fontStyle: "italic", lineHeight: 1.6 }}>
            Your notepad is empty.<br />Capture your first thought!
          </div>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><SearchIcon size={30} color="gray" /></div>
          <div style={{ fontSize: 13, opacity: 0.4, fontStyle: "italic" }}>No notes match your search.</div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}>
          {displayed.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={currentUserId}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onPin={pinNote}
              onReply={addReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}