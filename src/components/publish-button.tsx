'use client';

import { useEffect, useRef, useState } from 'react';
import { Rocket, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'full' | 'quick';

export function PublishButton() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<Mode | null>(null);
  const [log, setLog] = useState('');
  const [exitCode, setExitCode] = useState<'ok' | 'fail' | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  // Load last-exported time from meta.json on mount + after each run
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/data/meta.json', { cache: 'no-store' });
        if (res.ok) {
          const meta = await res.json();
          setLastExport(meta.exported_at ?? null);
        }
      } catch {
        /* ignore */
      }
    }
    loadMeta();
    if (exitCode === 'ok') loadMeta();
  }, [exitCode]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function publish(mode: Mode) {
    setRunning(mode);
    setOpen(true);
    setLog('');
    setExitCode(null);
    try {
      const res = await fetch(`/api/publish?mode=${mode}`, { method: 'POST' });
      if (!res.ok || !res.body) {
        setLog(`Request failed: HTTP ${res.status}\n${await res.text()}`);
        setExitCode('fail');
        setRunning(null);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setLog(buf);
      }
      setExitCode(buf.includes('✓ Done.') ? 'ok' : 'fail');
    } catch (err) {
      setLog((l) => l + `\nnetwork error: ${(err as Error).message}\n`);
      setExitCode('fail');
    } finally {
      setRunning(null);
    }
  }

  const ago = relTime(lastExport);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <div className="rounded-md border border-hairline bg-[var(--surface-1)]/90 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500 shadow">
          updated: <span className="text-zinc-200">{ago ?? '—'}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => publish('quick')}
            disabled={running !== null}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-hairline-strong bg-[var(--surface-2)]',
              'px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest',
              'text-zinc-300 shadow-md transition',
              running
                ? 'cursor-not-allowed opacity-60'
                : 'hover:border-oracle-sky/60 hover:bg-oracle-sky/10 hover:text-oracle-sky',
            )}
            aria-label="Refresh lineups"
            title="Re-fetch lineups + regenerate projections (~2 min). Does not retrain ML."
          >
            <RefreshCw className={cn('h-3.5 w-3.5', running === 'quick' && 'animate-spin')} />
            {running === 'quick' ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => publish('full')}
            disabled={running !== null}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-hairline-strong bg-[var(--surface-2)]',
              'px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest',
              'text-zinc-200 shadow-lg transition',
              running
                ? 'cursor-not-allowed opacity-60'
                : 'hover:border-oracle-green/60 hover:bg-oracle-green/10 hover:text-oracle-green',
            )}
            aria-label="Full publish"
            title="Full pipeline: reconcile + ingest + features + ML + export (~15-25 min)"
          >
            <Rocket className={cn('h-4 w-4', running === 'full' && 'animate-spin')} />
            {running === 'full' ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => running === null && setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-hairline-strong bg-[var(--surface-1)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <div className="flex items-center gap-2">
                {running === 'quick' || (!running && log.includes('Refreshing')) ? (
                  <RefreshCw className="h-4 w-4 text-oracle-sky" />
                ) : (
                  <Rocket className="h-4 w-4 text-oracle-green" />
                )}
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-300">
                  {running === 'quick' || (!running && log.startsWith('Refreshing'))
                    ? 'Refresh Lineups'
                    : 'Publish → Render'}
                </span>
                {exitCode === 'ok' && (
                  <span className="font-mono text-[10px] text-oracle-green">DONE</span>
                )}
                {exitCode === 'fail' && (
                  <span className="font-mono text-[10px] text-oracle-rose">FAILED</span>
                )}
              </div>
              <button
                onClick={() => running === null && setOpen(false)}
                disabled={running !== null}
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre
              ref={logRef}
              className="h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] text-zinc-300"
            >
              {log || 'Starting…\n'}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

function relTime(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
