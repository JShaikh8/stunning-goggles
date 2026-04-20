/**
 * Local-only publish endpoint.
 *
 * Runs the daily pipeline + exports JSON + commits + pushes to GitHub, so the
 * user can refresh production from a button in the UI instead of typing the
 * four shell commands by hand.
 *
 * Hard-disabled on Render (DATA_MODE=static). Also refuses non-localhost
 * connections as a second guard.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PY_REPO = path.resolve(process.cwd(), '..', 'sports-oracle-python');
const UI_REPO = process.cwd();

function isLocal(req: NextRequest): boolean {
  const host = (req.headers.get('host') || '').split(':')[0];
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

type Step = { label: string; cwd: string; cmd: string; args: string[] };

function steps(date: string, mode: 'full' | 'quick'): Step[] {
  const pyArgs = mode === 'quick'
    ? ['run_daily.py', '--only-projections']   // skips ingest, features, reconcile, ML retrain
    : ['run_daily.py'];
  const commitMsg = mode === 'quick' ? `refresh ${date}` : `data ${date}`;
  return [
    {
      label: mode === 'quick'
        ? '[A] Refreshing lineups + projections (~2 min)'
        : '[A] Running full pipeline (reconcile → ingest → features → projections → NRFI → ML → export)',
      cwd: PY_REPO,
      cmd: path.join(PY_REPO, '.venv', 'bin', 'python'),
      args: pyArgs,
    },
    {
      label: '[B] Staging data files (git add public/data)',
      cwd: UI_REPO,
      cmd: 'git',
      args: ['add', 'public/data'],
    },
    {
      label: '[C] Commit (git commit)',
      cwd: UI_REPO,
      cmd: 'git',
      args: ['commit', '-m', commitMsg, '--allow-empty'],
    },
    {
      label: '[D] Push to origin (git push)',
      cwd: UI_REPO,
      cmd: 'git',
      args: ['push'],
    },
  ];
}

function runStep(step: Step, write: (s: string) => void): Promise<number> {
  return new Promise((resolve) => {
    write(`\n▸ ${step.label}\n`);
    const child = spawn(step.cmd, step.args, {
      cwd: step.cwd,
      env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' },
    });
    child.stdout.on('data', (b: Buffer) => write(b.toString()));
    child.stderr.on('data', (b: Buffer) => write(b.toString()));
    child.on('close', (code) => {
      write(`  [exit ${code ?? 0}]\n`);
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      write(`  [spawn error: ${err.message}]\n`);
      resolve(1);
    });
  });
}

export async function POST(req: NextRequest) {
  if (process.env.DATA_MODE === 'static') {
    return new Response('Disabled in static mode', { status: 403 });
  }
  if (!isLocal(req)) {
    return new Response('Forbidden — localhost only', { status: 403 });
  }

  const url = new URL(req.url);
  const modeParam = url.searchParams.get('mode');
  const mode: 'full' | 'quick' = modeParam === 'quick' ? 'quick' : 'full';
  const date = new Date().toISOString().slice(0, 10);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* ignore enqueue-after-close */
        }
      };
      write(`${mode === 'quick' ? 'Refreshing' : 'Publishing'} snapshot for ${date}\n`);
      write(`Python repo: ${PY_REPO}\n`);
      write(`UI repo:     ${UI_REPO}\n`);

      for (const step of steps(date, mode)) {
        const code = await runStep(step, write);
        if (code !== 0) {
          // "git commit" exits 1 when nothing changed — that's OK, keep going.
          const nothingToCommit = step.args[0] === 'commit' && code === 1;
          if (!nothingToCommit) {
            write(`\n✗ Step failed with exit ${code}. Aborting.\n`);
            controller.close();
            return;
          }
          write('  (nothing to commit — continuing)\n');
        }
      }
      write('\n✓ Done. Render will redeploy within ~2 min.\n');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
