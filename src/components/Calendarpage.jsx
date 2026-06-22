import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase/config";
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth } from "../firebase/config";
import { deleteCalendarEvent, loadCalendarEvents, saveCalendarEvent } from "../firebase/diary";

const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// EVENT_TYPES keep their own semantic colors (per-event-type, not theme colors)
const EVENT_TYPES = [
  { id: "birthday",    label: "Birthday",    icon: "🎂", color: "#ff69b4" },
  { id: "anniversary", label: "Anniversary", icon: "💍", color: "#e8b4d0" },
  { id: "reminder",    label: "Reminder",    icon: "🔔", color: "#ffd700" },
  { id: "date",        label: "Date",        icon: "❤️",  color: "#ff8fab" },
  { id: "plan",        label: "Plan",        icon: "🗓️", color: "#b8e0ff" },
  { id: "note",        label: "Note",        icon: "📝", color: "#c9f0c8" },
];

const BLANK_FORM = { title: "", type: "reminder", note: "", recurring: false, day: "", month: "", year: "" };

function pad(n)      { return String(Math.floor(n)).padStart(2, "0"); }
function fmtKey(d)   { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function dateLabel(k){ return new Date(`${k}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

async function loadDayNote(dateKey) {
  const uid  = auth.currentUser?.uid || "local";
  const snap = await getDoc(doc(db, "dayNotes", `${uid}_${dateKey}`));
  return snap.exists() ? snap.data().text || "" : "";
}
async function saveDayNote(dateKey, text) {
  const uid = auth.currentUser?.uid || "local";
  await setDoc(doc(db, "dayNotes", `${uid}_${dateKey}`), { text, uid, dateKey, updatedAt: serverTimestamp() });
}
async function fetchDiaryEntriesForDate(dateKey) {
  try {
    const uid = auth.currentUser?.uid;
    const ref = collection(db, "diary_entries");
    const q   = uid ? query(ref, where("uid","==",uid), orderBy("createdAt","desc")) : query(ref, orderBy("createdAt","desc"));
    const snap = await getDocs(q);
    return snap.docs.map(i => ({ id: i.id, ...i.data() })).filter(e => (e.createdAt||"").slice(0,10) === dateKey);
  } catch { return []; }
}

// ── Birthday Countdown ────────────────────────────────────────
function UserBirthdayCountdown({ profile }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n+1), 1000); return () => clearInterval(t); }, []);
  if (!profile?.dob) return null;

  const now        = new Date();
  const [by,bm,bd] = profile.dob.split("-").map(Number);
  const birthMonth = bm - 1;
  const birthDay   = bd;
  const isBirthday = now.getMonth()===birthMonth && now.getDate()===birthDay;
  const currentAge = now.getFullYear()-by-(now.getMonth()<birthMonth||(now.getMonth()===birthMonth&&now.getDate()<birthDay)?1:0);

  if (isBirthday) {
    return (
      <section className="glass-panel" style={{ padding: 18, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Birthday Celebration</div>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "var(--accent)" }}>Happy Birthday, {profile.name || "User"}!</div>
        <div style={{ fontSize: 13, color: "var(--text-color)", opacity: 0.62, marginTop: 6 }}>Today you turn {now.getFullYear()-by}.</div>
      </section>
    );
  }

  const nextYear       = now.getMonth()<birthMonth||(now.getMonth()===birthMonth&&now.getDate()<birthDay) ? now.getFullYear() : now.getFullYear()+1;
  const nextBirthday   = new Date(nextYear, birthMonth, birthDay, 0, 0, 0);
  const prevBirthday   = new Date(nextYear-1, birthMonth, birthDay, 0, 0, 0);
  const secondsLeft    = Math.max(0, Math.floor((nextBirthday - now) / 1000));
  const daysLeft       = Math.ceil((nextBirthday - now) / 86400000);
  const yearProgress   = Math.min(100, Math.max(0, ((now - prevBirthday)/(nextBirthday - prevBirthday))*100));

  const StatPill = ({ value, label, isAccent }) => (
    <div style={{ flex:"1 1 80px", minWidth: 70, background: isAccent ? "var(--accent-bg)" : "var(--input-bg)", border: `1px solid ${isAccent ? "var(--accent-border)" : "var(--input-border)"}`, borderRadius: 16, padding: "10px 8px", textAlign: "center" }}>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: isAccent ? "var(--accent)" : "var(--text-color)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-color)", opacity: 0.45, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );

  return (
    <section className="glass-panel" style={{ padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{profile.name || "Your"} Birthday</div>
          <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-color)" }}>{currentAge} yrs old</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.45, textTransform: "uppercase", letterSpacing: 1 }}>Next</div>
          <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>{new Date(nextYear, birthMonth, birthDay).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}</div>
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-color)", opacity: 0.5, marginBottom: 7 }}>
          <span>Year progress</span><span>{Math.round(yearProgress)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--input-border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${yearProgress}%`, borderRadius: 99, background: "linear-gradient(90deg, var(--accent), var(--accent2))", transition: "width 1s linear" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatPill value={daysLeft}                    label="Days" isAccent />
        <StatPill value={pad(Math.floor(secondsLeft/3600)%24)} label="Hrs"  isAccent />
        <StatPill value={pad(Math.floor(secondsLeft/60)%60)}   label="Min"  isAccent />
        <StatPill value={pad(secondsLeft%60)}          label="Sec" isAccent />
      </div>
    </section>
  );
}

// ── Main Calendar Page ────────────────────────────────────────
export default function CalendarPage({ showToast }) {
  const today  = new Date();
  const [currentMonth,     setCurrentMonth]    = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [userProfile,      setUserProfile]     = useState(null);
  const [events,           setEvents]          = useState([]);
  const [selectedDay,      setSelectedDay]     = useState(null);
  const [showDaySheet,     setShowDaySheet]    = useState(false);
  const [showQuickAdd,     setShowQuickAdd]    = useState(false);
  const [todayPopups,      setTodayPopups]     = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [form,             setForm]            = useState(BLANK_FORM);
  const [showFormInSheet,  setShowFormInSheet] = useState(false);
  const [saving,           setSaving]          = useState(false);
  const [activeTab,        setActiveTab]       = useState("events");
  const [dayNote,          setDayNote]         = useState("");
  const [noteLoading,      setNoteLoading]     = useState(false);
  const [noteSaving,       setNoteSaving]      = useState(false);
  const [noteDirty,        setNoteDirty]       = useState(false);
  const [dayDiary,         setDayDiary]        = useState([]);
  const [diaryLoading,     setDiaryLoading]    = useState(false);
  const noteDebounce = useRef(null);

  const year        = currentMonth.getFullYear();
  const month       = currentMonth.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const selectedDateKey = selectedDay ? `${year}-${pad(month+1)}-${pad(selectedDay)}` : "";

  useEffect(() => {
    if (auth.currentUser) getDoc(doc(db,"users",auth.currentUser.uid)).then(s => { if (s.exists()) setUserProfile(s.data()); });
    loadCalendarEvents().then(setEvents).catch(()=>setEvents([])).finally(()=>setLoading(false));
  }, []);

  useEffect(() => {
    if (!events.length) return;
    const todayStr       = fmtKey(today);
    const todayMonthDay  = `${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    setTodayPopups(events.filter(e => e.recurring ? e.date?.slice(5)===todayMonthDay : e.date===todayStr));
  }, [events]);

  useEffect(() => {
    if (!selectedDay || !showDaySheet) { setDayNote(""); setDayDiary([]); setNoteDirty(false); return; }
    setNoteLoading(true);
    loadDayNote(selectedDateKey).then(t => { setDayNote(t); setNoteDirty(false); }).catch(()=>setDayNote("")).finally(()=>setNoteLoading(false));
    setDiaryLoading(true);
    fetchDiaryEntriesForDate(selectedDateKey).then(setDayDiary).catch(()=>setDayDiary([])).finally(()=>setDiaryLoading(false));
  }, [selectedDay, showDaySheet, selectedDateKey]);

  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const key = e.recurring ? `${year}-${e.date?.slice(5)}` : e.date;
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push(e);
    });
    return map;
  }, [events, year]);

  const upcomingEvents = useMemo(() => {
    const monthKey = `${year}-${pad(month+1)}`;
    return events
      .map(e => ({ ...e, _cmp: e.recurring ? `${year}-${e.date?.slice(5)}` : e.date }))
      .filter(e => e._cmp?.startsWith(monthKey))
      .sort((a,b) => a._cmp.localeCompare(b._cmp));
  }, [events, month, year]);

  const selectedDayEvents = selectedDay ? (eventMap[`${year}-${pad(month+1)}-${pad(selectedDay)}`]||[]) : [];

  function getDayEvents(day) { return eventMap[`${year}-${pad(month+1)}-${pad(day)}`] || []; }
  function getType(id)       { return EVENT_TYPES.find(t => t.id===id) || EVENT_TYPES[2]; }
  function openDay(day)      { setSelectedDay(day); setShowDaySheet(true); setShowFormInSheet(false); setActiveTab("events"); }

  function handleNoteChange(value) {
    setDayNote(value); setNoteDirty(true);
    clearTimeout(noteDebounce.current);
    noteDebounce.current = setTimeout(() => autoSaveNote(value), 1500);
  }
  async function autoSaveNote(text) {
    if (!selectedDateKey) return;
    setNoteSaving(true);
    try { await saveDayNote(selectedDateKey, text); setNoteDirty(false); }
    catch { showToast?.("Could not save the note."); }
    finally { setNoteSaving(false); }
  }
  async function manualSaveNote() { clearTimeout(noteDebounce.current); await autoSaveNote(dayNote); showToast?.("Note saved."); }

  async function handleQuickAdd() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const d=parseInt(form.day)||today.getDate(), m=parseInt(form.month)||today.getMonth()+1, y=parseInt(form.year)||today.getFullYear();
    if (d<1||d>31||m<1||m>12||y<2000||y>2099) { showToast?.("Invalid date."); setSaving(false); return; }
    const newEvent = { title: form.title.trim(), type: form.type, note: form.note, recurring: form.recurring, date: `${y}-${pad(m)}-${pad(d)}` };
    try { const id = await saveCalendarEvent(newEvent); setEvents(prev=>[...prev,{...newEvent,id}]); setForm(BLANK_FORM); setShowQuickAdd(false); showToast?.("Event saved."); }
    catch { showToast?.("Failed to save event."); }
    finally { setSaving(false); }
  }

  async function handleDayAdd() {
    if (!form.title.trim() || !selectedDay || saving) return;
    setSaving(true);
    const newEvent = { title: form.title.trim(), type: form.type, note: form.note, recurring: form.recurring, date: selectedDateKey };
    try { const id = await saveCalendarEvent(newEvent); setEvents(prev=>[...prev,{...newEvent,id}]); setForm(BLANK_FORM); setShowFormInSheet(false); showToast?.("Event saved."); }
    catch { showToast?.("Failed to save event."); }
    finally { setSaving(false); }
  }

  async function handleDelete(eventId) {
    try { await deleteCalendarEvent(eventId); setEvents(prev=>prev.filter(e=>e.id!==eventId)); showToast?.("Event deleted."); }
    catch { showToast?.("Failed to delete event."); }
  }

  const TypeChips = () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {EVENT_TYPES.map(type => (
        <button key={type.id} onClick={() => setForm(prev=>({...prev,type:type.id}))} style={{
          padding: "6px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer",
          background: form.type===type.id ? `${type.color}33` : "var(--input-bg)",
          border: `1px solid ${form.type===type.id ? type.color : "var(--input-border)"}`,
          color: form.type===type.id ? type.color : "var(--text-color)",
          fontWeight: form.type===type.id ? 600 : 400,
        }}>{type.icon} {type.label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "18px 16px 80px", minHeight: "100%", position: "relative" }}>

      {/* Today popups */}
      {todayPopups.map((popup, index) => {
        const type = getType(popup.type);
        return (
          <div key={popup.id||index} style={{ position: "fixed", top: 20+index*110, right: 16, zIndex: 9999, background: "var(--cal-modal-bg)", backdropFilter: "blur(30px)", border: `1px solid ${type.color}44`, borderLeft: `3px solid ${type.color}`, borderRadius: 16, padding: "14px 18px", maxWidth: 260, boxShadow: `0 8px 32px ${type.color}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: type.color, letterSpacing: 1, marginBottom: 4 }}>{type.icon} TODAY — {type.label.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-color)", marginBottom: 4 }}>{popup.title}</div>
                {popup.note && <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.55, lineHeight: 1.4 }}>{popup.note}</div>}
              </div>
              <button onClick={() => setTodayPopups(items=>items.filter((_,i)=>i!==index))} style={{ background: "none", border: "none", color: "var(--text-color)", opacity: 0.4, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          </div>
        );
      })}

      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.42, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 4 }}>Calendar Planner</div>
        <h2 className="font-display gradient-text-pastel" style={{ fontSize: 24, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>Memories, Dates & Plans</h2>
        <p style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.52, lineHeight: 1.5 }}>Track important days, personal notes, and diary entries in one place.</p>
      </header>

      <UserBirthdayCountdown profile={userProfile} />

      {/* Calendar grid */}
      <section className="glass-panel" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(year, month-1, 1))}>{"<"}</button>
          <div style={{ textAlign: "center" }}>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--text-color)" }}>{MONTHS[month]}</div>
            <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45 }}>{year}</div>
          </div>
          <button className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(year, month+1, 1))}>{">"}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center", marginBottom: 6 }}>
          {DAYS_SHORT.map(d => <div key={d} style={{ fontSize: 9, color: "var(--text-color)", opacity: 0.35, fontWeight: 500 }}>{d}</div>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {Array.from({ length: firstDay }, (_, i) => <div key={`b-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day       = i+1;
            const dayEvents = getDayEvents(day);
            const isToday   = today.getFullYear()===year && today.getMonth()===month && today.getDate()===day;
            const isSel     = selectedDay===day && showDaySheet;
            return (
              <button key={day} onClick={() => openDay(day)} style={{
                padding: "8px 2px 6px", borderRadius: 11,
                border:     isToday ? "1.5px solid var(--cal-today-border)" : isSel ? "1px solid var(--cal-selected-border)" : "1px solid transparent",
                background: isToday ? "var(--cal-today-bg)"    : isSel ? "var(--cal-selected-bg)" : "var(--input-bg)",
                color: "var(--text-color)", fontSize: 12, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                fontWeight: isToday ? 700 : 400, transition: "all 0.18s",
              }}>
                {day}
                {dayEvents.length > 0 && (
                  <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                    {dayEvents.slice(0,3).map((e,di) => <div key={`${e.id}-${di}`} style={{ width: 5, height: 5, borderRadius: "50%", background: getType(e.type).color }} />)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Upcoming events */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45, letterSpacing: 1, textTransform: "uppercase" }}>{MONTHS[month]} Events</div>
          <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.35 }}>{upcomingEvents.length} item{upcomingEvents.length===1?"":"s"}</div>
        </div>
        {loading ? <EmptyState text="Loading calendar events..." /> : upcomingEvents.length===0 ? <EmptyState text={`No events scheduled in ${MONTHS[month]}.`} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.map(event => {
              const type     = getType(event.type);
              const daysLeft = Math.ceil((new Date(`${event._cmp}T00:00:00`) - new Date(fmtKey(today))) / 86400000);
              const urgentColor = daysLeft===0 ? "var(--accent)" : daysLeft<=7 ? "#ffd700" : "var(--text-color)";
              return (
                <button key={event.id} className="glass-panel" style={{ padding: "12px 16px", borderRadius: 16, display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${type.color}88`, cursor: "pointer", color: "var(--text-color)", textAlign: "left" }} onClick={() => openDay(parseInt(event._cmp.slice(8,10)))}>
                  <EventBadge type={type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{event.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.45 }}>{dateLabel(event._cmp)}{event.recurring && " - yearly"}</div>
                    {event.note && <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.55, marginTop: 2 }}>{event.note}</div>}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", color: urgentColor, opacity: daysLeft>7?0.3:1 }}>
                    {daysLeft===0?"Today":daysLeft===1?"Tomorrow":daysLeft<0?"Past":`${daysLeft}d`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Legend */}
      <section style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {EVENT_TYPES.map(type => (
          <div key={type.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: type.color }} />
            <span style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.4 }}>{type.label}</span>
          </div>
        ))}
      </section>

      {/* FAB */}
      <button className="cal-fab" onClick={() => { setForm(BLANK_FORM); setShowQuickAdd(true); }} title="Add Event">+</button>

      {/* Quick add modal */}
      {showQuickAdd && (
        <CalModal onClose={() => setShowQuickAdd(false)}>
          <EventForm title="Add New Event" subtitle="Choose a date, add the details, and save it to the calendar." form={form} setForm={setForm} saving={saving} onSave={handleQuickAdd} onCancel={() => setShowQuickAdd(false)} TypeChips={TypeChips} includeDate />
        </CalModal>
      )}

      {/* Day sheet */}
      {showDaySheet && selectedDay!==null && (
        <DaySheet
          selectedDay={selectedDay} month={month} year={year}
          activeTab={activeTab} setActiveTab={setActiveTab}
          selectedDayEvents={selectedDayEvents} dayDiary={dayDiary}
          dayNote={dayNote} noteLoading={noteLoading} noteSaving={noteSaving} noteDirty={noteDirty} diaryLoading={diaryLoading}
          showFormInSheet={showFormInSheet} setShowFormInSheet={setShowFormInSheet}
          setForm={setForm} TypeChips={TypeChips} form={form} saving={saving}
          handleDayAdd={handleDayAdd} handleDelete={handleDelete} handleNoteChange={handleNoteChange}
          manualSaveNote={manualSaveNote} getType={getType} selectedDateKey={selectedDateKey}
          onClose={() => { setShowDaySheet(false); setShowFormInSheet(false); }}
        />
      )}
    </div>
  );
}

function EventBadge({ type }) {
  return <div style={{ minWidth: 32, height: 32, borderRadius: 12, background: `${type.color}22`, border: `1px solid ${type.color}44`, color: type.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{type.icon}</div>;
}

function EmptyState({ text }) {
  return <div style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.35, textAlign: "center", padding: 20 }}>{text}</div>;
}

function CalModal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "var(--overlay-bg)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="modal-pop" style={{ width: "100%", maxWidth: 430, background: "var(--cal-modal-bg)", backdropFilter: "blur(40px)", border: "1px solid var(--accent-border)", borderRadius: "var(--glass-radius)", padding: "28px 22px", boxShadow: "0 20px 60px var(--accent-glow)" }}>
        {children}
      </div>
    </div>
  );
}

function EventForm({ title, subtitle, form, setForm, saving, onSave, onCancel, TypeChips, includeDate }) {
  return (
    <div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45, marginBottom: 20, lineHeight: 1.5 }}>{subtitle}</div>}
      {includeDate && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="glass-input" placeholder="Day" type="number" min="1" max="31" value={form.day} onChange={e => setForm(p=>({...p,day:e.target.value}))} style={{ width: "28%", textAlign: "center" }} />
          <select className="glass-input" value={form.month} onChange={e => setForm(p=>({...p,month:e.target.value}))} style={{ flex: 1, cursor: "pointer" }}>
            <option value="">Month</option>
            {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <input className="glass-input" placeholder="Year" type="number" min="2000" max="2099" value={form.year} onChange={e => setForm(p=>({...p,year:e.target.value}))} style={{ width: "32%" }} />
        </div>
      )}
      <input className="glass-input" style={{ width: "100%", marginBottom: 12 }} placeholder="Event title" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} onKeyDown={e => { if (e.key==="Enter") onSave(); }} />
      <TypeChips />
      <textarea className="glass-input" style={{ width: "100%", minHeight: 64, resize: "none", marginBottom: 12, lineHeight: 1.5 }} placeholder="Optional note" value={form.note} onChange={e => setForm(p=>({...p,note:e.target.value}))} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, cursor: "pointer", fontSize: 12, color: "var(--text-color)", opacity: 0.75 }}>
        <input type="checkbox" checked={form.recurring} onChange={e => setForm(p=>({...p,recurring:e.target.checked}))} style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
        Repeat every year
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onSave} disabled={saving || !form.title.trim()} className="accent-btn" style={{ flex: 1, padding: 11, borderRadius: "var(--radius-pill)", fontSize: 13, opacity: saving||!form.title.trim() ? 0.5 : 1 }}>
          {saving ? "Saving…" : "Save Event"}
        </button>
        <button onClick={onCancel} className="glass-btn" style={{ padding: "11px 18px", fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

function DaySheet(props) {
  const { selectedDay, month, year, activeTab, setActiveTab, selectedDayEvents, dayDiary, dayNote, noteLoading, noteSaving, noteDirty, diaryLoading, showFormInSheet, setShowFormInSheet, setForm, TypeChips, form, saving, handleDayAdd, handleDelete, handleNoteChange, manualSaveNote, getType, selectedDateKey, onClose } = props;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--overlay-bg)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 20px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="sheet-up" style={{ width: "100%", maxWidth: 460, background: "var(--cal-modal-bg)", backdropFilter: "blur(40px)", border: "1px solid var(--accent-border)", borderRadius: "var(--glass-radius)", padding: "24px 20px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -20px 60px var(--accent-glow)" }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--accent)" }}>{selectedDay}</div>
            <div style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.5 }}>{MONTHS[month]}, {year}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setForm(BLANK_FORM); setShowFormInSheet(true); setActiveTab("events"); }} className="accent-btn" style={{ padding: "8px 16px", fontSize: 12, borderRadius: 20 }}>+ Event</button>
            <button onClick={onClose} style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-color)", width: 32, height: 32, borderRadius: "50%", fontSize: 16, cursor: "pointer", opacity: 0.6 }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--input-bg)", borderRadius: 18, padding: 4 }}>
          {["events","notes","diary"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 14, fontSize: 11, cursor: "pointer",
              background: activeTab===tab ? "var(--accent-bg)"    : "transparent",
              border:     activeTab===tab ? "1px solid var(--accent-border)" : "1px solid transparent",
              color:      activeTab===tab ? "var(--accent)"        : "var(--text-color)",
              opacity:    activeTab===tab ? 1 : 0.55, transition: "all 0.2s",
            }}>
              {tab[0].toUpperCase()+tab.slice(1)}
              {tab==="events" && selectedDayEvents.length>0 ? ` (${selectedDayEvents.length})` : ""}
              {tab==="diary"  && dayDiary.length>0           ? ` (${dayDiary.length})` : ""}
            </button>
          ))}
        </div>

        {activeTab==="events" && <DayEventsTab selectedDayEvents={selectedDayEvents} showFormInSheet={showFormInSheet} selectedDay={selectedDay} month={month} getType={getType} handleDelete={handleDelete} form={form} setForm={setForm} TypeChips={TypeChips} saving={saving} handleDayAdd={handleDayAdd} setShowFormInSheet={setShowFormInSheet} />}
        {activeTab==="notes"  && <DayNotesTab dayNote={dayNote} noteLoading={noteLoading} noteSaving={noteSaving} noteDirty={noteDirty} handleNoteChange={handleNoteChange} manualSaveNote={manualSaveNote} selectedDay={selectedDay} month={month} selectedDateKey={selectedDateKey} />}
        {activeTab==="diary"  && <DayDiaryTab dayDiary={dayDiary} diaryLoading={diaryLoading} />}
      </div>
    </div>
  );
}

function DayEventsTab({ selectedDayEvents, showFormInSheet, selectedDay, month, getType, handleDelete, form, setForm, TypeChips, saving, handleDayAdd, setShowFormInSheet }) {
  return (
    <div>
      {selectedDayEvents.length===0 && !showFormInSheet ? <EmptyState text='No events on this day. Tap "+ Event" to add one.' /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedDayEvents.map(event => {
            const type = getType(event.type);
            return (
              <div key={event.id} style={{ background: `${type.color}11`, border: `1px solid ${type.color}33`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <EventBadge type={type} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-color)" }}>{event.title}</div>
                  <div style={{ fontSize: 10, color: type.color, marginTop: 2 }}>{type.label}{event.recurring ? " — Yearly" : ""}</div>
                  {event.note && <div style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.6, marginTop: 5, lineHeight: 1.5 }}>{event.note}</div>}
                </div>
                {!event.isDefault && <button onClick={() => handleDelete(event.id)} className="danger-btn" style={{ padding: "3px 10px", fontSize: 11 }}>Delete</button>}
              </div>
            );
          })}
        </div>
      )}
      {showFormInSheet && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--divider)", paddingTop: 16 }}>
          <EventForm title={`New Event — ${selectedDay} ${MONTHS[month]}`} form={form} setForm={setForm} saving={saving} onSave={handleDayAdd} onCancel={() => setShowFormInSheet(false)} TypeChips={TypeChips} />
        </div>
      )}
    </div>
  );
}

function DayNotesTab({ dayNote, noteLoading, noteSaving, noteDirty, handleNoteChange, manualSaveNote, selectedDay, month, selectedDateKey }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.5 }}>{noteLoading ? "Loading…" : noteSaving ? "Saving…" : noteDirty ? "Unsaved changes…" : "Auto-saved"}</div>
        {noteDirty && <button onClick={manualSaveNote} className="accent-btn" style={{ padding: "5px 14px", borderRadius: 16, fontSize: 11 }}>Save now</button>}
      </div>
      {noteLoading ? <EmptyState text="Loading notes…" /> : (
        <textarea value={dayNote} onChange={e => handleNoteChange(e.target.value)} placeholder={`Write something about ${selectedDay} ${MONTHS[month]}…\n\nAdd thoughts, memories, plans, or anything you want to remember.`} style={{ width: "100%", minHeight: 220, resize: "none", lineHeight: 1.8, background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 16, padding: 14, fontSize: 13, color: "var(--text-color)", fontFamily: "inherit", outline: "none" }} />
      )}
      <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.3, marginTop: 8, textAlign: "right" }}>Saved as dayNotes/{selectedDateKey}</div>
    </div>
  );
}

function DayDiaryTab({ dayDiary, diaryLoading }) {
  if (diaryLoading) return <EmptyState text="Loading diary entries…" />;
  if (dayDiary.length===0) return <EmptyState text="No diary entry for this day." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {dayDiary.map(entry => {
        const preview = (entry.text||"").replace(/<[^>]*>/g,"").slice(0,150);
        return (
          <div key={entry.id} style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderLeft: "3px solid var(--accent)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div className="font-display" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{entry.title || "Untitled"}</div>
              {entry.mood && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 12, background: "var(--accent-bg)", border: "1px solid var(--accent-border)", color: "var(--accent)", fontWeight: 600 }}>{entry.mood}</span>}
            </div>
            {entry.weather && <div style={{ fontSize: 10, color: "var(--text-color)", opacity: 0.45, marginBottom: 4 }}>Weather: {entry.weather}</div>}
            {preview && <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-color)", opacity: 0.65 }}>{preview}{preview.length>=150?"…":""}</div>}
          </div>
        );
      })}
    </div>
  );
}
