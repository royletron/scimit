import { useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'scimit-theme';
const listeners = new Set<() => void>();

const read = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const apply = (t: Theme) => {
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Theme follows the OS until the user picks one; the pick is remembered. Shared across components. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => !localStorage.getItem(KEY) && apply(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = read() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
  };

  return { theme, toggle };
}
