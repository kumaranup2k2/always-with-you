import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, doc, setDoc, getDoc, deleteDoc,
  updateDoc, where
} from "firebase/firestore";
import { db, auth } from "./config";

const ENTRIES_COL  = "diary_entries";
const SETTINGS_COL = "user_settings";

// ─── Helper: get current user's UID (throws if not logged in) ───
function requireUID() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
}

// ─── Save a new diary entry ────────────────────────────────────
export async function saveEntry(entryData) {
  const uid = requireUID();
  const docRef = await addDoc(collection(db, ENTRIES_COL), {
    ...entryData,
    uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ─── Fetch all entries for the current user (newest first) ────
export async function fetchAllEntries() {
  const uid = requireUID();
  // BUG FIX: Added uid filter so only the logged-in user's entries appear
  const q = query(
    collection(db, ENTRIES_COL),
    where("uid", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
  }));
}

// ─── Delete an entry ──────────────────────────────────────────
export async function deleteEntry(entryId) {
  await deleteDoc(doc(db, ENTRIES_COL, entryId));
}

// ─── Update/edit an existing entry ───────────────────────────
export async function updateEntry(entryId, data) {
  await updateDoc(doc(db, ENTRIES_COL, entryId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ─── Theme sync ───────────────────────────────────────────────
export async function saveUserTheme(userId, themeData) {
  const docRef = doc(db, SETTINGS_COL, userId);
  await setDoc(docRef, { theme: themeData, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function fetchUserTheme(userId) {
  const docRef  = doc(db, SETTINGS_COL, userId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    // Support both old flat schema and new nested schema
    const data = snapshot.data();
    return data.theme ?? data ?? null;
  }
  return null;
}

// ─── Calendar Events ──────────────────────────────────────────
const CAL_COL = "calendarEvents";

export async function loadCalendarEvents() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return JSON.parse(localStorage.getItem("cal_events") || "[]");
  }
  try {
    const q = query(collection(db, CAL_COL), where("uid", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return JSON.parse(localStorage.getItem("cal_events") || "[]");
  }
}

export async function saveCalendarEvent(event) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    const existing = JSON.parse(localStorage.getItem("cal_events") || "[]");
    const id = Date.now().toString();
    existing.push({ ...event, id });
    localStorage.setItem("cal_events", JSON.stringify(existing));
    return id;
  }
  try {
    const ref = await addDoc(collection(db, CAL_COL), { ...event, uid });
    return ref.id;
  } catch {
    const existing = JSON.parse(localStorage.getItem("cal_events") || "[]");
    const id = Date.now().toString();
    existing.push({ ...event, id });
    localStorage.setItem("cal_events", JSON.stringify(existing));
    return id;
  }
}

export async function deleteCalendarEvent(eventId) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    const existing = JSON.parse(localStorage.getItem("cal_events") || "[]");
    localStorage.setItem("cal_events", JSON.stringify(existing.filter((e) => e.id !== eventId)));
    return;
  }
  try {
    await deleteDoc(doc(db, CAL_COL, eventId));
  } catch {
    const existing = JSON.parse(localStorage.getItem("cal_events") || "[]");
    localStorage.setItem("cal_events", JSON.stringify(existing.filter((e) => e.id !== eventId)));
  }
}