import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "../services/firebase/config";
import {
  deleteCalendarEvent,
  loadCalendarEvents,
  saveCalendarEvent,
} from "../services/firebase/diary";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_TYPES = [
  { id: "birthday", label: "Birthday", icon: "🎂", color: "#ff69b4" },
  { id: "anniversary", label: "Anniversary", icon: "💍", color: "#e8b4d0" },
  { id: "reminder", label: "Reminder", icon: "🔔", color: "#ffd700" },
  { id: "date", label: "Date", icon: "❤️", color: "#ff8fab" },
  { id: "plan", label: "Plan", icon: "🗓️", color: "#b8e0ff" },
  { id: "note", label: "Note", icon: "📝", color: "#c9f0c8" },
];

const BLANK_FORM = {
  title: "",
  type: "reminder",
  note: "",
  recurring: false,
  day: "",
  month: "",
  year: "",
};

function pad(n) {
  return String(Math.floor(n)).padStart(2, "0");
}

function fmtKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function loadDayNote(dateKey) {
  const uid = auth.currentUser?.uid || "local";
  const snap = await getDoc(doc(db, "dayNotes", `${uid}_${dateKey}`));
  return snap.exists() ? snap.data().text || "" : "";
}

async function saveDayNote(dateKey, text) {
  const uid = auth.currentUser?.uid || "local";
  await setDoc(doc(db, "dayNotes", `${uid}_${dateKey}`), {
    text,
    uid,
    dateKey,
    updatedAt: serverTimestamp(),
  });
}

async function fetchDiaryEntriesForDate(dateKey) {
  try {
    const uid = auth.currentUser?.uid;
    const ref = collection(db, "diary_entries");
    const q = uid
      ? query(ref, where("uid", "==", uid), orderBy("createdAt", "desc"))
      : query(ref, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((entry) => (entry.createdAt || "").slice(0, 10) === dateKey);
  } catch {
    return [];
  }
}

function UserBirthdayCountdown({ profile }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!profile || !profile.dob) return null;

  const now = new Date();
  const dobParts = profile.dob.split("-");
  const birthYear = parseInt(dobParts[0], 10);
  const birthMonth = parseInt(dobParts[1], 10) - 1;
  const birthDay = parseInt(dobParts[2], 10);

  const isBirthday = now.getMonth() === birthMonth && now.getDate() === birthDay;
  const currentAge =
    now.getFullYear() -
    birthYear -
    (now.getMonth() < birthMonth || (now.getMonth() === birthMonth && now.getDate() < birthDay) ? 1 : 0);

  if (isBirthday) {
    return (
      <section className="glass-panel" style={{ padding: 18, marginBottom: 16, borderRadius: 22, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#ffb6c1", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
          Birthday Celebration
        </div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, marginTop: 6, color: "#ffb6c1" }}>
          Happy Birthday, {profile.name || "User"}!
        </div>
        <div style={{ fontSize: 13, opacity: 0.62, marginTop: 6 }}>
          Today you turn {now.getFullYear() - birthYear}.
        </div>
      </section>
    );
  }

  const nextYear =
    now.getMonth() < birthMonth || (now.getMonth() === birthMonth && now.getDate() < birthDay)
      ? now.getFullYear()
      : now.getFullYear() + 1;
  const nextBirthday = new Date(nextYear, birthMonth, birthDay, 0, 0, 0);
  const previousBirthday = new Date(nextYear - 1, birthMonth, birthDay, 0, 0, 0);
  const secondsLeft = Math.max(0, Math.floor((nextBirthday - now) / 1000));
  const minutesLeft = Math.floor(secondsLeft / 60);
  const hoursLeft = Math.floor(minutesLeft / 60);
  const daysLeft = Math.ceil((nextBirthday - now) / 86400000);
  const birthdayThisYear = new Date(now.getFullYear(), birthMonth, birthDay, 0, 0, 0);
  const lastBirthday = now >= birthdayThisYear
    ? birthdayThisYear
    : new Date(now.getFullYear() - 1, birthMonth, birthDay, 0, 0, 0);
  let monthsSinceBirthday = (now.getFullYear() - lastBirthday.getFullYear()) * 12 + now.getMonth() - lastBirthday.getMonth();
  if (now.getDate() < lastBirthday.getDate()) monthsSinceBirthday -= 1;
  const monthAnchor = new Date(lastBirthday);
  monthAnchor.setMonth(monthAnchor.getMonth() + monthsSinceBirthday);
  const ageDays = Math.max(0, Math.floor((now - monthAnchor) / 86400000));
  const yearProgress = Math.min(100, Math.max(0, ((now - previousBirthday) / (nextBirthday - previousBirthday)) * 100));

  const StatPill = ({ value, label, accent }) => (
    <div style={{ flex: "1 1 80px", minWidth: 70, background: accent ? "rgba(255,105,180,0.12)" : "rgba(128,128,128,0.08)", border: `1px solid ${accent ? "rgba(255,105,180,0.28)" : "rgba(128,128,128,0.15)"}`, borderRadius: 16, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: accent ? "#ff69b4" : "var(--text-color)", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 9, opacity: 0.45, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );

  return (
    <section className="glass-panel" style={{ padding: 18, marginBottom: 16, borderRadius: 22, gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "#ffb6c1", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>
            {profile.name || "Your"} Birthday
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text-color)" }}>
            {currentAge} yrs, {monthsSinceBirthday} mos, {ageDays} days
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: 1 }}>Next</div>
          <div style={{ fontSize: 13, color: "#ff69b4", fontWeight: 700 }}>
            {new Date(nextYear, birthMonth, birthDay).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.5, marginBottom: 7 }}>
          <span>Year progress</span>
          <span>{Math.round(yearProgress)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(128,128,128,0.12)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${yearProgress}%`, borderRadius: 99, background: "linear-gradient(90deg,#ffb6c1,#ff69b4)" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatPill value={daysLeft} label="Days" accent />
        <StatPill value={pad(hoursLeft % 24)} label="Hrs" accent />
        <StatPill value={pad(minutesLeft % 60)} label="Min" accent />
        <StatPill value={pad(secondsLeft % 60)} label="Sec" accent />
      </div>
    </section>
  );
}

export default function CalendarPage({ showToast }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [userProfile, setUserProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [todayPopups, setTodayPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);
  const [showFormInSheet, setShowFormInSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("events");
  const [dayNote, setDayNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  const [dayDiary, setDayDiary] = useState([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const noteDebounce = useRef(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const selectedDateKey = selectedDay ? `${year}-${pad(month + 1)}-${pad(selectedDay)}` : "";

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then(snap => {
        if (snap.exists()) setUserProfile(snap.data());
      });
    }
    loadCalendarEvents()
      .then((data) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!events.length) return;
    const todayStr = fmtKey(today);
    const todayMonthDay = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    setTodayPopups(
      events.filter((event) =>
        event.recurring ? event.date?.slice(5) === todayMonthDay : event.date === todayStr
      )
    );
  }, [events]);

  useEffect(() => {
    if (!selectedDay || !showDaySheet) {
      setDayNote("");
      setDayDiary([]);
      setNoteDirty(false);
      return;
    }

    setNoteLoading(true);
    loadDayNote(selectedDateKey)
      .then((text) => {
        setDayNote(text);
        setNoteDirty(false);
      })
      .catch(() => setDayNote(""))
      .finally(() => setNoteLoading(false));

    setDiaryLoading(true);
    fetchDiaryEntriesForDate(selectedDateKey)
      .then(setDayDiary)
      .catch(() => setDayDiary([]))
      .finally(() => setDiaryLoading(false));
  }, [selectedDay, showDaySheet, selectedDateKey]);

  const eventMap = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      const key = event.recurring ? `${year}-${event.date?.slice(5)}` : event.date;
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push(event);
    });
    return map;
  }, [events, year]);

  const upcomingEvents = useMemo(() => {
    const monthKey = `${year}-${pad(month + 1)}`;
    return events
      .map((event) => ({
        ...event,
        _cmp: event.recurring ? `${year}-${event.date?.slice(5)}` : event.date,
      }))
      .filter((event) => event._cmp?.startsWith(monthKey))
      .sort((a, b) => a._cmp.localeCompare(b._cmp));
  }, [events, month, year]);

  const selectedDayEvents = selectedDay ? getDayEvents(selectedDay) : [];

  function getDayEvents(day) {
    return eventMap[`${year}-${pad(month + 1)}-${pad(day)}`] || [];
  }

  function getType(id) {
    return EVENT_TYPES.find((type) => type.id === id) || EVENT_TYPES[2];
  }

  function openDay(day) {
    setSelectedDay(day);
    setShowDaySheet(true);
    setShowFormInSheet(false);
    setActiveTab("events");
  }

  function handleNoteChange(value) {
    setDayNote(value);
    setNoteDirty(true);
    clearTimeout(noteDebounce.current);
    noteDebounce.current = setTimeout(() => autoSaveNote(value), 1500);
  }

  async function autoSaveNote(text) {
    if (!selectedDateKey) return;
    setNoteSaving(true);
    try {
      await saveDayNote(selectedDateKey, text);
      setNoteDirty(false);
    } catch {
      showToast?.("Could not save the note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function manualSaveNote() {
    clearTimeout(noteDebounce.current);
    await autoSaveNote(dayNote);
    showToast?.("Note saved.");
  }

  async function handleQuickAdd() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const d = parseInt(form.day) || today.getDate();
    const m = parseInt(form.month) || today.getMonth() + 1;
    const y = parseInt(form.year) || today.getFullYear();

    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2099) {
      showToast?.("Invalid date. Please check the day, month, and year.");
      setSaving(false);
      return;
    }

    const newEvent = {
      title: form.title.trim(),
      type: form.type,
      note: form.note,
      recurring: form.recurring,
      date: `${y}-${pad(m)}-${pad(d)}`,
    };

    try {
      const id = await saveCalendarEvent(newEvent);
      setEvents((prev) => [...prev, { ...newEvent, id }]);
      setForm(BLANK_FORM);
      setShowQuickAdd(false);
      showToast?.("Event saved.");
    } catch {
      showToast?.("Failed to save event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDayAdd() {
    if (!form.title.trim() || !selectedDay || saving) return;
    setSaving(true);
    const newEvent = {
      title: form.title.trim(),
      type: form.type,
      note: form.note,
      recurring: form.recurring,
      date: selectedDateKey,
    };

    try {
      const id = await saveCalendarEvent(newEvent);
      setEvents((prev) => [...prev, { ...newEvent, id }]);
      setForm(BLANK_FORM);
      setShowFormInSheet(false);
      showToast?.("Event saved.");
    } catch {
      showToast?.("Failed to save event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId) {
    try {
      await deleteCalendarEvent(eventId);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      showToast?.("Event deleted.");
    } catch {
      showToast?.("Failed to delete event.");
    }
  }

  const TypeChips = () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {EVENT_TYPES.map((type) => (
        <button
          key={type.id}
          onClick={() => setForm((prev) => ({ ...prev, type: type.id }))}
          style={{
            padding: "6px 11px",
            borderRadius: 20,
            fontSize: 11,
            cursor: "pointer",
            background: form.type === type.id ? `${type.color}33` : "rgba(128,128,128,0.1)",
            border: `1px solid ${form.type === type.id ? type.color : "rgba(128,128,128,0.2)"}`,
            color: form.type === type.id ? type.color : "var(--text-color)",
            fontWeight: form.type === type.id ? 600 : 400,
          }}
        >
          {type.icon} {type.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "18px 16px 40px", minHeight: "100%", position: "relative" }}>
      {todayPopups.map((popup, index) => {
        const type = getType(popup.type);
        return (
          <div key={popup.id || index} style={{ position: "fixed", top: 20 + index * 110, right: 16, zIndex: 9999, background: "rgba(18,8,14,0.95)", backdropFilter: "blur(30px)", border: `1px solid ${type.color}44`, borderLeft: `3px solid ${type.color}`, borderRadius: 16, padding: "14px 18px", maxWidth: 260, boxShadow: `0 8px 32px ${type.color}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: type.color, letterSpacing: 1, marginBottom: 4 }}>{type.icon} TODAY - {type.label.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{popup.title}</div>
                {popup.note && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{popup.note}</div>}
              </div>
              <button onClick={() => setTodayPopups((items) => items.filter((_, itemIndex) => itemIndex !== index))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16 }}>x</button>
            </div>
          </div>
        );
      })}

      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, opacity: 0.42, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 4 }}>
          Calendar Planner
        </div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, background: "linear-gradient(135deg,#ffb6c1,#e8b4d0,#b8e0ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 1, marginBottom: 4 }}>
          Memories, Dates, and Plans
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-color)", opacity: 0.52, lineHeight: 1.5 }}>
          Track important days, personal notes, and diary entries in one place.
        </p>
      </header>

      <UserBirthdayCountdown profile={userProfile} />

      <section className="glass-panel" style={{ padding: 14, marginBottom: 16, borderRadius: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={navButtonStyle}>{"<"}</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600 }}>{MONTHS[month]}</div>
            <div style={{ fontSize: 11, opacity: 0.45 }}>{year}</div>
          </div>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={navButtonStyle}>{">"}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center", marginBottom: 6 }}>
          {DAYS_SHORT.map((dayName) => (
            <div key={dayName} style={{ fontSize: 9, color: "var(--text-color)", opacity: 0.35, fontWeight: 500 }}>{dayName}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {Array.from({ length: firstDay }, (_, index) => <div key={`blank-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const dayEvents = getDayEvents(day);
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const isSelected = selectedDay === day && showDaySheet;

            return (
              <button
                key={day}
                onClick={() => openDay(day)}
                style={{
                  padding: "8px 2px 6px",
                  borderRadius: 11,
                  border: isToday ? "1.5px solid #ffb6c1" : isSelected ? "1px solid rgba(255,182,193,0.45)" : "1px solid transparent",
                  background: isToday ? "rgba(255,182,193,0.18)" : isSelected ? "rgba(255,182,193,0.08)" : "rgba(128,128,128,0.04)",
                  color: "var(--text-color)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  fontWeight: isToday ? 700 : 400,
                  transition: "all 0.18s",
                }}
              >
                {day}
                {dayEvents.length > 0 && (
                  <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                    {dayEvents.slice(0, 3).map((event, dotIndex) => (
                      <div key={`${event.id}-${dotIndex}`} style={{ width: 5, height: 5, borderRadius: "50%", background: getType(event.type).color }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-color)", opacity: 0.45, letterSpacing: 1, textTransform: "uppercase" }}>
            {MONTHS[month]} Events
          </div>
          <div style={{ fontSize: 10, opacity: 0.35 }}>
            {upcomingEvents.length} item{upcomingEvents.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <EmptyState text="Loading calendar events..." />
        ) : upcomingEvents.length === 0 ? (
          <EmptyState text={`No events scheduled in ${MONTHS[month]}.`} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.map((event) => {
              const type = getType(event.type);
              const daysLeft = Math.ceil((new Date(`${event._cmp}T00:00:00`) - new Date(fmtKey(today))) / 86400000);
              return (
                <button key={event.id} className="glass-panel" style={{ padding: "12px 16px", borderRadius: 16, display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${type.color}88`, cursor: "pointer", color: "var(--text-color)", textAlign: "left" }} onClick={() => openDay(parseInt(event._cmp.slice(8, 10)))}>
                  <EventBadge type={type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{event.title}</div>
                    <div style={{ fontSize: 10, opacity: 0.45 }}>
                      {dateLabel(event._cmp)}
                      {event.recurring && " - yearly"}
                    </div>
                    {event.note && <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{event.note}</div>}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", color: daysLeft === 0 ? "#ff69b4" : daysLeft <= 7 ? "#ffd700" : "rgba(255,255,255,0.3)" }}>
                    {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : daysLeft < 0 ? "Past" : `${daysLeft}d`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {EVENT_TYPES.map((type) => (
          <div key={type.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: type.color }} />
            <span style={{ fontSize: 10, opacity: 0.4 }}>{type.label}</span>
          </div>
        ))}
      </section>

      <button onClick={() => { setForm(BLANK_FORM); setShowQuickAdd(true); }} style={fabStyle} title="Add Event">+</button>

      {showQuickAdd && (
        <Modal onClose={() => setShowQuickAdd(false)}>
          <EventForm
            title="Add New Event"
            subtitle="Choose a date, add the details, and save it to the calendar."
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={handleQuickAdd}
            onCancel={() => setShowQuickAdd(false)}
            TypeChips={TypeChips}
            includeDate
          />
        </Modal>
      )}

      {showDaySheet && selectedDay !== null && (
        <DaySheet
          selectedDay={selectedDay}
          month={month}
          year={year}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedDayEvents={selectedDayEvents}
          dayDiary={dayDiary}
          dayNote={dayNote}
          noteLoading={noteLoading}
          noteSaving={noteSaving}
          noteDirty={noteDirty}
          diaryLoading={diaryLoading}
          showFormInSheet={showFormInSheet}
          setShowFormInSheet={setShowFormInSheet}
          setForm={setForm}
          TypeChips={TypeChips}
          form={form}
          saving={saving}
          handleDayAdd={handleDayAdd}
          handleDelete={handleDelete}
          handleNoteChange={handleNoteChange}
          manualSaveNote={manualSaveNote}
          getType={getType}
          selectedDateKey={selectedDateKey}
          onClose={() => { setShowDaySheet(false); setShowFormInSheet(false); }}
        />
      )}
    </div>
  );
}

function EventBadge({ type }) {
  return (
    <div style={{ minWidth: 32, height: 32, borderRadius: 12, background: `${type.color}22`, border: `1px solid ${type.color}44`, color: type.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>
      {type.icon}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ fontSize: 12, opacity: 0.35, textAlign: "center", padding: 20 }}>{text}</div>;
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: "rgba(16,8,14,0.97)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,182,193,0.22)", borderRadius: 28, padding: "28px 22px", boxShadow: "0 20px 60px rgba(255,105,180,0.18)" }}>
        {children}
      </div>
    </div>
  );
}

function EventForm({ title, subtitle, form, setForm, saving, onSave, onCancel, TypeChips, includeDate }) {
  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600, color: "#ffb6c1", marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 20, lineHeight: 1.5 }}>{subtitle}</div>}

      {includeDate && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="glass-input" placeholder="Day" type="number" min="1" max="31" value={form.day} onChange={(event) => setForm((prev) => ({ ...prev, day: event.target.value }))} style={{ width: "28%", textAlign: "center" }} />
          <select className="glass-input" value={form.month} onChange={(event) => setForm((prev) => ({ ...prev, month: event.target.value }))} style={{ flex: 1, cursor: "pointer" }}>
            <option value="">Month</option>
            {MONTHS.map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}
          </select>
          <input className="glass-input" placeholder="Year" type="number" min="2000" max="2099" value={form.year} onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))} style={{ width: "32%" }} />
        </div>
      )}

      <input className="glass-input" style={{ width: "100%", marginBottom: 12 }} placeholder="Event title" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") onSave(); }} />
      <TypeChips />
      <textarea className="glass-input" style={{ width: "100%", minHeight: 64, resize: "none", marginBottom: 12, lineHeight: 1.5 }} placeholder="Optional note" value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, cursor: "pointer", fontSize: 12, opacity: 0.75 }}>
        <input type="checkbox" checked={form.recurring} onChange={(event) => setForm((prev) => ({ ...prev, recurring: event.target.checked }))} style={{ accentColor: "#ff69b4", width: 14, height: 14 }} />
        Repeat every year
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onSave} disabled={saving || !form.title.trim()} style={{ flex: 1, background: "linear-gradient(135deg,rgba(255,105,180,0.3),rgba(232,180,208,0.15))", border: "1px solid rgba(255,105,180,0.45)", color: "#ffb6c1", padding: 11, borderRadius: 22, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving || !form.title.trim() ? 0.5 : 1 }}>
          {saving ? "Saving..." : "Save Event"}
        </button>
        <button onClick={onCancel} style={{ background: "transparent", border: "1px solid rgba(128,128,128,0.25)", color: "var(--text-color)", padding: "11px 18px", borderRadius: 22, fontSize: 12, cursor: "pointer", opacity: 0.6 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DaySheet(props) {
  const {
    selectedDay, month, year, activeTab, setActiveTab, selectedDayEvents, dayDiary,
    dayNote, noteLoading, noteSaving, noteDirty, diaryLoading, showFormInSheet,
    setShowFormInSheet, setForm, TypeChips, form, saving, handleDayAdd, handleDelete,
    handleNoteChange, manualSaveNote, getType, selectedDateKey, onClose,
  } = props;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 20px" }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "rgba(18,10,16,0.97)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,182,193,0.18)", borderRadius: 28, padding: "24px 20px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -20px 60px rgba(255,105,180,0.1)", animation: "sheetUp 0.3s cubic-bezier(0.34,1.2,0.64,1)" }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 600, color: "#ffb6c1" }}>{selectedDay}</div>
            <div style={{ fontSize: 12, opacity: 0.5 }}>{MONTHS[month]}, {year}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setForm(BLANK_FORM); setShowFormInSheet(true); setActiveTab("events"); }} style={{ background: "rgba(255,105,180,0.18)", border: "1px solid rgba(255,105,180,0.35)", color: "#ff69b4", padding: "8px 16px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              + Event
            </button>
            <button onClick={onClose} style={{ background: "rgba(128,128,128,0.12)", border: "1px solid rgba(128,128,128,0.2)", color: "var(--text-color)", width: 32, height: 32, borderRadius: "50%", fontSize: 16, cursor: "pointer", opacity: 0.6 }}>x</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(128,128,128,0.07)", borderRadius: 18, padding: 4 }}>
          {["events", "notes", "diary"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "8px 4px", borderRadius: 14, fontSize: 11, cursor: "pointer", background: activeTab === tab ? "rgba(255,182,193,0.15)" : "transparent", border: activeTab === tab ? "1px solid rgba(255,182,193,0.35)" : "1px solid transparent", color: activeTab === tab ? "#ffb6c1" : "var(--text-color)", opacity: activeTab === tab ? 1 : 0.55 }}>
              {tab[0].toUpperCase() + tab.slice(1)}
              {tab === "events" && selectedDayEvents.length > 0 ? ` (${selectedDayEvents.length})` : ""}
              {tab === "diary" && dayDiary.length > 0 ? ` (${dayDiary.length})` : ""}
            </button>
          ))}
        </div>

        {activeTab === "events" && (
          <DayEventsTab selectedDayEvents={selectedDayEvents} showFormInSheet={showFormInSheet} selectedDay={selectedDay} month={month} getType={getType} handleDelete={handleDelete} form={form} setForm={setForm} TypeChips={TypeChips} saving={saving} handleDayAdd={handleDayAdd} setShowFormInSheet={setShowFormInSheet} />
        )}

        {activeTab === "notes" && (
          <DayNotesTab dayNote={dayNote} noteLoading={noteLoading} noteSaving={noteSaving} noteDirty={noteDirty} handleNoteChange={handleNoteChange} manualSaveNote={manualSaveNote} selectedDay={selectedDay} month={month} selectedDateKey={selectedDateKey} />
        )}

        {activeTab === "diary" && (
          <DayDiaryTab dayDiary={dayDiary} diaryLoading={diaryLoading} />
        )}
      </div>
    </div>
  );
}

function DayEventsTab({ selectedDayEvents, showFormInSheet, selectedDay, month, getType, handleDelete, form, setForm, TypeChips, saving, handleDayAdd, setShowFormInSheet }) {
  return (
    <div>
      {selectedDayEvents.length === 0 && !showFormInSheet ? (
        <EmptyState text='No events on this day. Tap "+ Event" to add one.' />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedDayEvents.map((event) => {
            const type = getType(event.type);
            return (
              <div key={event.id} style={{ background: `${type.color}11`, border: `1px solid ${type.color}33`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <EventBadge type={type} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{event.title}</div>
                  <div style={{ fontSize: 10, color: type.color, marginTop: 2 }}>{type.label}{event.recurring ? " - Yearly" : ""}</div>
                  {event.note && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 5, lineHeight: 1.5 }}>{event.note}</div>}
                </div>
                {!event.isDefault && <button onClick={() => handleDelete(event.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.5)", cursor: "pointer", fontSize: 12, padding: 4 }}>Delete</button>}
              </div>
            );
          })}
        </div>
      )}

      {showFormInSheet && (
        <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,182,193,0.1)", paddingTop: 16 }}>
          <EventForm title={`New Event - ${selectedDay} ${MONTHS[month]}`} form={form} setForm={setForm} saving={saving} onSave={handleDayAdd} onCancel={() => setShowFormInSheet(false)} TypeChips={TypeChips} />
        </div>
      )}
    </div>
  );
}

function DayNotesTab({ dayNote, noteLoading, noteSaving, noteDirty, handleNoteChange, manualSaveNote, selectedDay, month, selectedDateKey }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, opacity: 0.5 }}>
          {noteLoading ? "Loading..." : noteSaving ? "Saving..." : noteDirty ? "Unsaved changes..." : "Auto-saved"}
        </div>
        {noteDirty && <button onClick={manualSaveNote} style={{ background: "rgba(255,105,180,0.18)", border: "1px solid rgba(255,105,180,0.35)", color: "#ff69b4", padding: "5px 14px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Save now</button>}
      </div>

      {noteLoading ? (
        <EmptyState text="Loading notes..." />
      ) : (
        <textarea value={dayNote} onChange={(event) => handleNoteChange(event.target.value)} placeholder={`Write something about ${selectedDay} ${MONTHS[month]}...\n\nAdd thoughts, memories, plans, or anything you want to remember.`} style={{ width: "100%", minHeight: 220, resize: "none", lineHeight: 1.8, background: "rgba(255,182,193,0.04)", border: "1px solid rgba(255,182,193,0.15)", borderRadius: 16, padding: 14, fontSize: 13, color: "var(--text-color)", fontFamily: "inherit", outline: "none" }} />
      )}

      <div style={{ fontSize: 10, opacity: 0.3, marginTop: 8, textAlign: "right" }}>
        Saved as dayNotes/{selectedDateKey}
      </div>
    </div>
  );
}

function DayDiaryTab({ dayDiary, diaryLoading }) {
  if (diaryLoading) return <EmptyState text="Loading diary entries..." />;
  if (dayDiary.length === 0) return <EmptyState text="No diary entry for this day." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {dayDiary.map((entry) => {
        const preview = (entry.text || "").replace(/<[^>]*>/g, "").slice(0, 150);
        return (
          <div key={entry.id} style={{ background: "rgba(200,170,255,0.08)", border: "1px solid rgba(200,170,255,0.2)", borderLeft: "3px solid rgba(200,170,255,0.5)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Playfair Display',serif", color: "#c8aaff" }}>
                {entry.title || "Untitled"}
              </div>
              {entry.mood && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 12, background: "rgba(200,170,255,0.15)", border: "1px solid rgba(200,170,255,0.3)", color: "#c8aaff", fontWeight: 600 }}>{entry.mood}</span>}
            </div>
            {entry.weather && <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 4 }}>Weather: {entry.weather}</div>}
            {preview && <div style={{ fontSize: 12, lineHeight: 1.65, opacity: 0.65 }}>{preview}{preview.length >= 150 ? "..." : ""}</div>}
          </div>
        );
      })}
    </div>
  );
}

const navButtonStyle = {
  background: "rgba(255,182,193,0.12)",
  border: "1px solid rgba(255,182,193,0.22)",
  color: "#ffb6c1",
  width: 32,
  height: 32,
  borderRadius: "50%",
  cursor: "pointer",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const fabStyle = {
  position: "fixed",
  bottom: 60,
  right: 10,
  zIndex: 500,
  width: 54,
  height: 54,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#ff69b4,#e8b4d0)",
  border: "none",
  color: "#fff",
  fontSize: 28,
  fontWeight: 300,
  cursor: "pointer",
  boxShadow: "0 6px 24px rgba(255,105,180,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
