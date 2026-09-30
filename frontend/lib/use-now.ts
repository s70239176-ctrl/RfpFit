"use client";

import { useEffect, useState } from "react";

/** Wall-clock ms, ticking every second. Only used for display; the contract enforces deadlines. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
