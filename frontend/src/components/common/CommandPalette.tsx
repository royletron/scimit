import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CornerDownLeft, Gift, Inbox, LucideIcon, Moon, Plus, Search, Send, User, Users } from 'lucide-react';
import { useUsers } from '../../hooks/useUsers';
import { useGroups } from '../../hooks/useGroups';
import { useTargets } from '../../hooks/usePlayback';
import { useLogs } from '../../hooks/useLogs';
import { useTheme } from '../../hooks/useTheme';
import { PathText, formatTime } from './ui';

const OPEN_EVENT = 'scimit:palette';
export const openPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

interface Entry {
  id: string;
  section: string;
  label: string;
  sub?: string;
  /** Searchable but not shown (IDs, external IDs) */
  keywords?: string;
  icon: LucideIcon;
  tone?: string;
  mono?: boolean;
  run: () => void;
}

const PER_SECTION = 6;
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

// Every query word must appear somewhere; label prefix matches rank first
function search(entries: Entry[], q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return entries.filter((e) => e.section === 'Actions' || e.section === 'Go to');
  const hits = entries.filter((e) => {
    const hay = `${e.label} ${e.sub ?? ''} ${e.keywords ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const first = words[0];
  hits.sort((a, b) => Number(b.label.toLowerCase().startsWith(first)) - Number(a.label.toLowerCase().startsWith(first)));
  const perSection = new Map<string, number>();
  return hits.filter((e) => {
    const n = (perSection.get(e.section) ?? 0) + 1;
    perSection.set(e.section, n);
    return n <= PER_SECTION;
  });
}

export function CommandPalette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toggle, theme } = useTheme();
  const { data: users } = useUsers();
  const { data: groups } = useGroups();
  const { data: targets } = useTargets();
  const { data: logs } = useLogs({ limit: 200 });
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const open = () => {
    setQuery('');
    setActive(0);
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  };
  const close = () => dialog.current?.close();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dialog.current?.open ? close() : open();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, open);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, open);
    };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const go = (to: string) => () => navigate(to);
    return [
      { id: 'a-user', section: 'Actions', label: 'New user', icon: Plus, run: go('/users?new=1') },
      { id: 'a-group', section: 'Actions', label: 'New group', icon: Plus, run: go('/groups?new=1') },
      { id: 'a-sp', section: 'Actions', label: 'Add SP', icon: Plus, run: go('/playback?new=1') },
      { id: 'a-theme', section: 'Actions', label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', icon: Moon, run: toggle },
      { id: 'p-users', section: 'Go to', label: 'Users', icon: User, run: go('/users') },
      { id: 'p-groups', section: 'Go to', label: 'Groups', icon: Users, run: go('/groups') },
      { id: 'p-logs', section: 'Go to', label: 'Requests', icon: Activity, run: go('/logs') },
      { id: 'p-in', section: 'Go to', label: 'Receive from IdP', sub: 'connection details, bearer token', icon: Inbox, tone: 'text-lagoon', run: go('/connector') },
      { id: 'p-new', section: 'Go to', label: 'What’s new', sub: 'changelog, release notes', icon: Gift, run: go('/changelog') },
      { id: 'p-out', section: 'Go to', label: 'Send to SP', sub: 'targets, sync', icon: Send, tone: 'text-disco', run: go('/playback') },
      ...(users ?? []).map((u) => ({
        id: `u-${u.id}`, section: 'Users', icon: User,
        label: u.rawData?.displayName || u.userName,
        sub: [...new Set([u.userName, u.emailPrimary])].filter((v) => v && v !== (u.rawData?.displayName || u.userName)).join(', ') || undefined,
        keywords: `${u.externalId ?? ''} ${u.id}`,
        run: go(`/users?open=${u.id}`),
      })),
      ...(groups ?? []).map((g) => ({
        id: `g-${g.id}`, section: 'Groups', icon: Users,
        label: g.displayName,
        sub: `${g.members.length} ${g.members.length === 1 ? 'member' : 'members'}`,
        keywords: `${g.externalId ?? ''} ${g.id}`,
        run: go(`/groups?open=${g.id}`),
      })),
      ...(targets ?? []).map((t) => ({
        id: `t-${t.id}`, section: 'SPs', icon: Send, tone: 'text-disco',
        label: t.name, sub: t.url,
        run: go('/playback'),
      })),
      ...(logs?.logs ?? []).map((l) => ({
        id: `l-${l.id}`, section: 'Requests', icon: Activity, mono: true,
        tone: l.direction === 'outbound' ? 'text-disco' : 'text-lagoon',
        label: `${l.method} ${safeDecode(l.path)}`,
        sub: `${l.status_code || 'no response'}, ${formatTime(l.timestamp)}`,
        run: go(`/logs?open=${l.id}`),
      })),
    ];
  }, [users, groups, targets, logs, theme, navigate, toggle]);

  const results = useMemo(() => search(entries, query), [entries, query]);
  const choose = (e?: Entry) => {
    if (!e) return;
    close();
    e.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
  };

  useEffect(() => {
    document.getElementById(`cmd-${results[active]?.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  let lastSection = '';
  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === dialog.current && close()}
      aria-label="Search SCIMit"
      className="palette m-auto mt-[12vh] w-[min(40rem,calc(100vw-2rem))] p-0 rounded-xl bg-paper text-ink border border-line-strong shadow-[0_24px_64px_-16px_rgb(0_0_0/0.45)]"
    >
      <div className="flex items-center gap-3 px-4 border-b border-line">
        <Search size={18} className="text-mute shrink-0" aria-hidden />
        <input
          ref={input}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Search users, groups, requests and SPs"
          aria-label="Search"
          aria-controls="cmd-results"
          aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          className="flex-1 h-14 bg-transparent text-[15px] outline-none placeholder:text-mute"
        />
        <kbd className="text-[11px] text-mute border border-line rounded px-1.5 py-0.5">esc</kbd>
      </div>

      <ul id="cmd-results" role="listbox" className="max-h-[min(26rem,60vh)] overflow-y-auto py-2">
        {results.length === 0 && <li className="px-4 py-8 text-center hint">Nothing matches “{query}”.</li>}
        {results.map((e, i) => {
          const heading = e.section !== lastSection ? (lastSection = e.section) : null;
          const Icon = e.icon;
          return (
            <li key={e.id} role="presentation">
              {heading && <p className="px-4 pt-3 pb-1 text-xs text-mute">{heading}</p>}
              <div
                id={`cmd-${e.id}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(e)}
                className={`mx-2 flex items-center gap-3 h-10 px-2.5 rounded-md cursor-pointer ${i === active ? 'bg-chalk' : ''}`}
              >
                <Icon size={16} className={`shrink-0 ${e.tone ?? 'text-graphite'}`} aria-hidden />
                {e.mono ? (
                  <PathText path={e.label} className="text-[13px] truncate" />
                ) : (
                  <span className="text-[13.5px] truncate">{e.label}</span>
                )}
                {e.sub && <span className="text-xs text-mute truncate min-w-0 flex-1">{e.sub}</span>}
                {i === active && <CornerDownLeft size={14} className="ml-auto shrink-0 text-mute" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
