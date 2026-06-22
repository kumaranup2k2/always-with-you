import { useState, useCallback } from 'react';

export function useToast(duration = 2800) {
  const [message, setMessage] = useState('');

  const showToast = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  }, [duration]);

  return { toastMessage: message, showToast };
}