#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import os from 'os';
import fs from 'fs';

const program = new Command();

program
  .name('scimmy')
  .description('Local SCIM 2.0 sink — capture and inspect IDP provisioning requests')
  .option('-p, --port <number>', 'port to listen on', '3088')
  .option('-d, --db <path>', 'path to SQLite database', path.join(os.homedir(), '.scimmy', 'data.db'))
  .parse();

const opts = program.opts<{ port: string; db: string }>();
const port   = parseInt(opts.port, 10);
const dbPath = path.resolve(opts.db);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

process.env.PORT          = String(port);
process.env.DATABASE_PATH = dbPath;

await import(new URL('index.js', import.meta.url).href);
