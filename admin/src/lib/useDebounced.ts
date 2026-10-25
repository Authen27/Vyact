import { useEffect, useState } from 'react';

/** The value, once it has stopped changing for `ms` (v1.5.0: the lists search on the server as you type). */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
