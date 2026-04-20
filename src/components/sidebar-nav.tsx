'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CalendarDays, DollarSign, Flame, Hourglass, LineChart, Menu, Target, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/slate',       label: 'Slate',        icon: CalendarDays, sublabel: "Today's games" },
  { href: '/props',       label: 'Props',        icon: Flame,        sublabel: 'HR · Hits research' },
  { href: '/players',     label: 'Players',      icon: Users,        sublabel: 'All batters · pitchers' },
  { href: '/nrfi',        label: 'NRFI',         icon: Hourglass,    sublabel: 'First-inning odds' },
  { href: '/lineups',     label: 'Lineups',      icon: DollarSign,   sublabel: 'FanDuel optimizer' },
  { href: '/calibration', label: 'Calibration',  icon: LineChart,    sublabel: 'Proj vs actual' },
];

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-oracle-green/10">
          <Target className="h-4 w-4 text-oracle-green" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold tracking-tight text-zinc-100">Sports Oracle</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
            MLB · DK · FD · NRFI
          </span>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 p-2.5">
        {ITEMS.map(({ href, label, sublabel, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-start gap-3 rounded-md px-3 py-2.5 transition',
                active
                  ? 'bg-[var(--surface-2)] text-zinc-100'
                  : 'text-zinc-400 hover:bg-[var(--surface-1)] hover:text-zinc-200',
              )}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-oracle-green" />
              )}
              <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0',
                active ? 'text-oracle-green' : 'text-zinc-500 group-hover:text-zinc-300')} />
              <div className="min-w-0 flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                <span className="font-mono text-[10px] text-zinc-600">{sublabel}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-hairline p-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
          model version
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
          factor v2.1 · ml v1.2
        </div>
      </div>
    </>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger — visible below md */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-[var(--surface-1)] text-zinc-300 shadow md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Desktop sidebar — md and up */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-hairline md:bg-[var(--surface-0)]">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-hairline bg-[var(--surface-0)] shadow-2xl md:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-[var(--surface-2)] hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
