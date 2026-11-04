import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, Gift, Inbox, LucideIcon, Moon, RotateCcw, Search, Send, Sun, User, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { subscribeLive } from '../../services/live';
import { useUsers } from '../../hooks/useUsers';
import { useGroups } from '../../hooks/useGroups';
import { useTargets } from '../../hooks/usePlayback';
import { useTheme } from '../../hooks/useTheme';
import { toast } from '../common/toast';
import { openPalette } from '../common/CommandPalette';
import { latestVersion, useWhatsNew } from '../../hooks/useWhatsNew';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  tone?: 'lagoon' | 'disco';
  /** Unseen live activity: shows a coloured count and a one-shot pulse */
  live?: { unseen: number; direction?: string; key: number };
}

function NavItem({ to, label, icon: Icon, count, tone, live }: Item) {
  const liveTone = live?.direction === 'outbound' ? 'text-disco bg-disco-soft' : 'text-lagoon bg-lagoon-soft';
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13.5px] whitespace-nowrap transition-colors ${
          isActive ? 'bg-paper text-ink font-medium shadow-[0_0_0_1px_var(--color-line)]' : 'text-graphite hover:text-ink hover:bg-paper/60'
        }`
      }
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden className={tone === 'lagoon' ? 'text-lagoon' : tone === 'disco' ? 'text-disco' : 'text-graphite'} />
      <span className="flex-1 truncate">{label}</span>
      {live && live.unseen > 0 ? (
        <span className={`relative inline-flex items-center h-[18px] px-1.5 rounded-full font-mono text-[11px] font-semibold ${liveTone}`} aria-label={`${live.unseen} new`}>
          <span key={live.key} className="pulse-ring absolute inset-0 rounded-full" aria-hidden />
          {live.unseen > 99 ? '99+' : live.unseen}
        </span>
      ) : (
        count !== undefined && <span className="font-mono text-xs text-mute">{count}</span>
      )}
    </NavLink>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="hidden md:block px-2.5 mb-1 text-xs text-mute">{label}</p>
      <div className="flex md:block gap-1 md:space-y-0.5">{children}</div>
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Sidebar() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { unseen } = useWhatsNew();
  const { data: users } = useUsers();
  const { data: groups } = useGroups();
  const { data: targets } = useTargets();
  const [live, setLive] = useState<{ unseen: number; direction?: string; key: number }>({ unseen: 0, key: 0 });
  const onRequests = location.pathname === '/logs';

  // Live traffic: count what arrives while you're elsewhere, and keep the directory fresh
  useEffect(
    () =>
      subscribeLive((log) => {
        setLive((l) => ({ unseen: l.unseen + 1, direction: log.direction, key: l.key + 1 }));
        if (log.method !== 'GET') {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['groups'] });
        }
      }),
    [queryClient]
  );
  useEffect(() => {
    if (onRequests) setLive((l) => ({ ...l, unseen: 0 }));
  }, [onRequests, live.key]);

  const handleReset = async () => {
    if (!confirm('Delete all users, groups, request logs and ID mappings? Targets and the bearer token are kept.')) return;
    try {
      await adminApi.reset();
      queryClient.invalidateQueries();
      toast.success('All data reset', 'Targets and the bearer token were kept.');
    } catch {
      toast.error('Reset failed', 'Check that the SCIMit server is running.');
    }
  };

  return (
    <aside className="bg-chalk border-b md:border-b-0 md:border-r border-line md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 flex flex-col">
      <div className="flex items-center gap-2 px-5 h-14 md:h-16 shrink-0">
        <span className="text-[22px] leading-none animate-dance" aria-hidden>🕺</span>
        <span className="wordmark text-[19px] text-ink">SCIMit</span>
        <div className="md:hidden ml-auto flex gap-1">
          <button onClick={openPalette} className="btn btn-ghost btn-sm" aria-label="Search">
            <Search size={15} aria-hidden />
          </button>
          <button onClick={toggle} className="btn btn-ghost btn-sm" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
            {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
          </button>
        </div>
      </div>

      <div className="hidden md:block px-3 mb-5">
        <button
          onClick={openPalette}
          className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md bg-paper text-[13px] text-mute shadow-[0_0_0_1px_var(--color-line)] hover:text-graphite transition-colors"
        >
          <Search size={15} aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[11px] text-mute">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </div>

      <nav className="flex md:flex-col gap-1 md:gap-6 px-3 pb-2.5 md:pb-0 overflow-x-auto md:overflow-visible md:flex-1">
        <Group label="Directory">
          <NavItem to="/users" label="Users" icon={User} count={users?.length} />
          <NavItem to="/groups" label="Groups" icon={Users} count={groups?.length} />
        </Group>
        <Group label="Traffic">
          <NavItem to="/logs" label="Requests" icon={Activity} live={onRequests ? undefined : live} />
        </Group>
        <Group label="Connections">
          <NavItem to="/connector" label="Receive from IdP" icon={Inbox} tone="lagoon" />
          <NavItem to="/playback" label="Send to SP" icon={Send} tone="disco" count={targets?.length} />
        </Group>
      </nav>

      <div className="hidden md:flex flex-col gap-0.5 px-3 pb-4">
        <NavLink
          to="/changelog"
          className={({ isActive }) => `btn btn-ghost btn-sm w-full justify-start ${isActive ? 'bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]' : ''}`}
        >
          <Gift size={14} aria-hidden />
          <span className="flex-1 text-left">What’s new</span>
          {unseen
            ? <span className="h-2 w-2 rounded-full bg-ink" aria-label="New release" />
            : <span className="font-mono text-[11px] text-mute">v{latestVersion}</span>}
        </NavLink>
        <button onClick={toggle} className="btn btn-ghost btn-sm w-full justify-start">
          {theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
        <button onClick={handleReset} className="btn btn-ghost btn-sm w-full justify-start hover:text-err hover:bg-err-soft">
          <RotateCcw size={14} aria-hidden /> Reset all data
        </button>
      </div>
    </aside>
  );
}
