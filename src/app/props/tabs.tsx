'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PropsTabs({ current, date }: { current: 'hr' | 'hits'; date: string }) {
  return (
    <div className="inline-flex items-center rounded-md border border-hairline bg-[var(--surface-1)] p-0.5 font-mono text-[11px] uppercase tracking-widest">
      <Link
        href={`/props?date=${date}&tab=hr`}
        className={cn(
          'rounded px-3 py-1.5 transition',
          current === 'hr'
            ? 'bg-oracle-amber/15 text-oracle-amber'
            : 'text-zinc-500 hover:text-zinc-200',
        )}
      >
        HR
      </Link>
      <Link
        href={`/props?date=${date}&tab=hits`}
        className={cn(
          'rounded px-3 py-1.5 transition',
          current === 'hits'
            ? 'bg-oracle-green/15 text-oracle-green'
            : 'text-zinc-500 hover:text-zinc-200',
        )}
      >
        Hits
      </Link>
    </div>
  );
}
