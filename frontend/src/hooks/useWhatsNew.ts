import { useSyncExternalStore } from 'react';
import changelogMd from '../../../CHANGELOG.md?raw';
import { parseChangelog } from '../lib/changelog';

// Bundled at build time, so the page works offline
export const releases = parseChangelog(changelogMd);
export const latestVersion = releases[0]?.version;

const KEY = 'scimit-seen-version';
const listeners = new Set<() => void>();

/** Whether the newest release has been looked at on this browser */
export function useWhatsNew() {
  const seen = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => localStorage.getItem(KEY),
  );
  return {
    unseen: Boolean(latestVersion) && seen !== latestVersion,
    markSeen: () => {
      if (!latestVersion || localStorage.getItem(KEY) === latestVersion) return;
      localStorage.setItem(KEY, latestVersion);
      listeners.forEach((l) => l());
    },
  };
}
