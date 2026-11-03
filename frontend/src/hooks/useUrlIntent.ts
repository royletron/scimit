import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Run `handle` once when `?key=value` appears in the URL, then drop the param.
 * Used by the command palette to say "open this row" / "start a new user" across pages.
 */
export function useUrlIntent(key: string, handle: (value: string) => void) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key);
  useEffect(() => {
    if (!value) return;
    handle(value);
    const next = new URLSearchParams(params);
    next.delete(key);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

/** Expand-and-reveal helper for table rows with id="row-<id>" */
export const revealRow = (id: string | number) =>
  requestAnimationFrame(() =>
    document.getElementById(`row-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  );
