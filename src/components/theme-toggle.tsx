'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('oracle-theme') as 'dark' | 'light' | null) ?? 'dark';
    setMode(stored);
    document.documentElement.classList.toggle('dark', stored === 'dark');
  }, []);

  const apply = (next: 'dark' | 'light') => {
    setMode(next);
    localStorage.setItem('oracle-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded border border-hairline bg-[var(--surface-1)] p-0.5 font-mono text-[10px] uppercase tracking-widest',
        className,
      )}
      role="group"
      aria-label="Theme mode"
    >
      <button
        onClick={() => apply('dark')}
        className={cn(
          'inline-flex items-center gap-1 rounded px-2 py-1 transition',
          mode === 'dark'
            ? 'bg-oracle-green/15 text-oracle-green'
            : 'text-zinc-500 hover:text-zinc-200',
        )}
        aria-pressed={mode === 'dark'}
      >
        <Moon className="h-3 w-3" />
        <span>Dark</span>
      </button>
      <button
        onClick={() => apply('light')}
        className={cn(
          'inline-flex items-center gap-1 rounded px-2 py-1 transition',
          mode === 'light'
            ? 'bg-oracle-amber/15 text-oracle-amber'
            : 'text-zinc-500 hover:text-zinc-200',
        )}
        aria-pressed={mode === 'light'}
      >
        <Sun className="h-3 w-3" />
        <span>Light</span>
      </button>
    </div>
  );
}
