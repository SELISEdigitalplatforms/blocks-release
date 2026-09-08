import { useEffect, useState } from "react";

/**
 * `Date.now()`, re-read once a second for as long as `enabled` holds.
 *
 * Returns a value rather than an elapsed count so the caller decides what the clock is
 * measured against. When `enabled` goes false the interval is torn down and the last
 * reading stays put, which is what lets a caller freeze a running total at the instant
 * whatever it was timing finished.
 *
 * Switching `enabled` back on does not re-read immediately: the reading left from the
 * previous run is returned until the first interval fires a second later. Callers that
 * start disabled for a long stretch and then enable will show that one stale second.
 */
export const useTickingNow = (enabled: boolean): number => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(id);
  }, [enabled]);

  return now;
};
