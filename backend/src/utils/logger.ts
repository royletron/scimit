import chalk, { type ChalkInstance } from 'chalk';

// ── Request logging ──────────────────────────────────────────────────────────

const METHOD_COLOR: Record<string, ChalkInstance> = {
  GET:     chalk.cyan,
  POST:    chalk.green,
  PUT:     chalk.yellow,
  PATCH:   chalk.magenta,
  DELETE:  chalk.red,
  HEAD:    chalk.dim,
  OPTIONS: chalk.dim,
};

function colorMethod(method: string): string {
  return (METHOD_COLOR[method] ?? chalk.white)(method.padEnd(7));
}

function colorStatus(status: number): string {
  if (status >= 500) return chalk.bgRed.white(` ${status} `);
  if (status >= 400) return chalk.yellow(`${status}`);
  if (status >= 300) return chalk.cyan(`${status}`);
  return chalk.green(`${status}`);
}

function colorDuration(ms: number): string {
  if (ms > 500) return chalk.red(`${ms}ms`);
  if (ms > 100) return chalk.yellow(`${ms}ms`);
  return chalk.dim(`${ms}ms`);
}

export function logRequest(method: string, urlPath: string, status: number, ms: number): void {
  const scim = urlPath.startsWith('/scim');
  const pathStr = scim ? chalk.white(urlPath.padEnd(38)) : chalk.dim(urlPath.padEnd(38));
  const line = ['  ' + chalk.dim('→'), colorMethod(method), pathStr, colorStatus(status), colorDuration(ms)].join('  ');

  clearWaiting();
  process.stdout.write(line + '\n');
  drawWaiting();
}

// ── Startup ──────────────────────────────────────────────────────────────────

export function logStartup(port: number, dbPath: string, version: string): void {
  const base = `http://localhost:${port}`;
  process.stdout.write('\n');
  process.stdout.write(`  ${chalk.bold.hex('#818cf8')('🕺 SCIMit')} ${chalk.dim('v' + version)}  ${chalk.dim('ready')}\n`);
  process.stdout.write('\n');
  process.stdout.write(`  ${chalk.dim('Dashboard')}  →  ${chalk.cyan.underline(base)}\n`);
  process.stdout.write(`  ${chalk.dim('SCIM')}       →  ${chalk.cyan.underline(`${base}/scim/v2`)}\n`);
  process.stdout.write(`  ${chalk.dim('Database')}   →  ${chalk.dim(dbPath)}\n`);
  process.stdout.write('\n');
  startWaiting();
}

export function logInfo(msg: string): void {
  process.stdout.write(`  ${chalk.dim('·')} ${chalk.dim(msg)}\n`);
}

export function logWarn(msg: string): void {
  process.stdout.write(`  ${chalk.yellow('!')} ${chalk.yellow(msg)}\n`);
}

// ── Animated waiting line ─────────────────────────────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const PROMPTS = [
  'waiting for the beat to drop 🎵',
  'moonwalking through the event loop 🌙',
  'doing the robot at the SCIM endpoint 🤖',
  'disco ball spinning, awaiting requests 🪩',
  'twirling in anticipation 💃',
  'shuffling my feet to the SCIM beat 👟',
  'jazz hands at the ready ✋',
  'vogue-ing in the spotlight 💅',
  'the worm is burrowing through the database 🪱',
  'body-popping between requests 💥',
  'flossing while your IDP thinks 🦷',
  'electric slide fully charged ⚡',
  'limboing under the latency bar 🌴',
  'breakdancing on the event loop floor 📦',
  'the running man is running... somewhere 🏃',
  'waiting for your IDP to find its groove 🎶',
];

const isTTY = Boolean(process.stdout.isTTY);

let spinnerTick  = 0;
let promptIdx    = 0;
let waitingShown = false;
let spinnerTimer: NodeJS.Timeout | null = null;
let promptTimer:  NodeJS.Timeout | null = null;

function clearWaiting(): void {
  if (!isTTY || !waitingShown) return;
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  waitingShown = false;
}

function drawWaiting(): void {
  if (!isTTY) return;
  const frame  = chalk.hex('#818cf8')(SPINNER[spinnerTick % SPINNER.length]);
  const prompt = chalk.dim(PROMPTS[promptIdx]);
  process.stdout.write(`  ${frame}  ${prompt}`);
  waitingShown = true;
}

function startWaiting(): void {
  if (!isTTY) return;

  drawWaiting();

  spinnerTimer = setInterval(() => {
    spinnerTick++;
    clearWaiting();
    drawWaiting();
  }, 100);

  promptTimer = setInterval(() => {
    promptIdx = (promptIdx + 1) % PROMPTS.length;
  }, 60_000);

  const cleanup = () => {
    clearInterval(spinnerTimer!);
    clearInterval(promptTimer!);
    clearWaiting();
    process.exit(0);
  };
  process.once('SIGINT',  cleanup);
  process.once('SIGTERM', cleanup);
}
