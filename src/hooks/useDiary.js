import { useState, useEffect, useCallback } from 'react';
import { fetchAllEntries, saveEntry } from '../services/firebase/diary';
import { calcStreak } from '../utils/diaryUtils';

export function useDiary(user, userName) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllEntries();
      setEntries(data);
    } catch (e) {
      console.error("Failed to load entries:", e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [user, loadEntries]);

  const addEntry = useCallback(async (entryData) => {
    const fullEntry = {
      ...entryData,
      author: userName || user?.displayName || "Anonymous",
    };
    await saveEntry(fullEntry);
    await loadEntries(); // Re-fetch entries to get the new one
  }, [user, userName, loadEntries]);

  const streak = calcStreak(entries);

  return { entries, loading, addEntry, streak, setEntries };
}