import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Q2 (v10.129.0; audit OPS-02, DB-SEC-10, OPS-08; owner decision D10, 20 Oct 2026: "replay every migration").
//
// An empty PGlite set up as a new Supabase project would be, then every file in supabase/migrations applied in
// the order `supabase db push` applies them, each exactly as written (no text is rewritten). What the platform
// provides comes from ./supabase-standin:
//   - platform.sql: the API roles, Supabase's default grants, auth, storage, vault and the realtime publication;
//   - pg_cron.sql and pg_net.sql: installed as extensions, so the migrations' own `create extension` statements
//     create them (and a migration that used cron before creating it would fail here, as in production).
// pgcrypto, pg_trgm and uuid-ossp are PGlite's real builds of those extensions.
//
// v10.130.0 (Q3a): three suites replay, and three replays at once slowed the rest of the run past its timeouts.
// The replayed database is saved once to the temp folder, under a hash of every migration, every stand-in file
// and the PGlite version, and the other suites load that copy (under a second instead of three or four). A
// changed migration is a different hash, so it is always replayed afresh; a copy that fails to load is rebuilt.

export const MIGRATIONS_DIR = new URL('../../../../../supabase/migrations/', import.meta.url);
const STANDIN = new URL('./supabase-standin/', import.meta.url);
const EXTENSIONS = { pgcrypto, pg_trgm, uuid_ossp };

/** Every migration, in the order `supabase db push` applies them (file name order). */
export const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

/** The extensions the migrations create that PGlite does not ship: name → control lines and install script. */
const STANDIN_EXTENSIONS: Record<string, { version: string; control: string; script: string }> = {
  pg_cron: { version: '1.6', control: 'relocatable = false\nschema = pg_catalog\nsuperuser = true\n', script: 'pg_cron.sql' },
  pg_net: { version: '0.14', control: 'relocatable = false\nsuperuser = true\n', script: 'pg_net.sql' },
};

interface EmscriptenFs { writeFile(path: string, data: string): void }

/** PGlite keeps its Emscripten module protected; the stand-in extension files are written into its share dir. */
function fsOf(db: PGlite): EmscriptenFs {
  const fs = (db as unknown as { mod?: { FS?: EmscriptenFs } }).mod?.FS;
  if (!fs) throw new Error('PGlite no longer exposes its file system (mod.FS); update helpers/replayMigrations.ts');
  return fs;
}

export class MigrationFailed extends Error {
  constructor(readonly file: string, reason: unknown) {
    super(`${file} failed to apply: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

/** PGlite's version (its package does not export package.json, so it is found next to the resolved entry). */
function pgliteVersion(): string {
  let dir = dirname(createRequire(import.meta.url).resolve('@electric-sql/pglite'));
  for (let i = 0; i < 5; i++, dir = dirname(dir)) {
    const pkg = join(dir, 'package.json');
    if (!existsSync(pkg)) continue;
    const json = JSON.parse(readFileSync(pkg, 'utf8')) as { name?: string; version?: string };
    if (json.name === '@electric-sql/pglite') return json.version ?? 'unknown';
  }
  return 'unknown';
}

/** What the replay depends on: every migration (name and text), every stand-in file and PGlite's version. */
function replayKey(files: string[]): string {
  const h = createHash('sha256');
  h.update(`pglite ${pgliteVersion()}\n`);
  for (const f of ['platform.sql', 'pg_cron.sql', 'pg_net.sql']) h.update(`${f}\n`).update(readFileSync(new URL(f, STANDIN)));
  h.update(JSON.stringify(STANDIN_EXTENSIONS));
  for (const f of files) h.update(`${f}\n`).update(readFileSync(new URL(f, MIGRATIONS_DIR)));
  return h.digest('hex').slice(0, 24);
}

async function replayFromScratch(files: string[]): Promise<PGlite> {
  const db = new PGlite({ extensions: EXTENSIONS });
  await db.waitReady;
  const share = (await db.query<{ setting: string }>(`select setting from pg_config where name = 'SHAREDIR'`)).rows[0].setting;
  const fs = fsOf(db);
  for (const [name, ext] of Object.entries(STANDIN_EXTENSIONS)) {
    fs.writeFile(`${share}/extension/${name}.control`,
      `comment = '${name} stand-in (Vyact tests)'\ndefault_version = '${ext.version}'\n${ext.control}`);
    fs.writeFile(`${share}/extension/${name}--${ext.version}.sql`, readFileSync(new URL(ext.script, STANDIN), 'utf8'));
  }
  await db.exec(readFileSync(new URL('platform.sql', STANDIN), 'utf8'));
  for (const file of files) {
    try {
      await db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8'));
    } catch (e) {
      await db.close();
      throw new MigrationFailed(file, e);
    }
  }
  return db;
}

/**
 * A fresh database with the platform stand-ins and every migration applied (from the saved copy when this exact
 * set was replayed before). Throws MigrationFailed naming the first file that does not apply.
 */
export async function replayMigrations(): Promise<{ db: PGlite; applied: string[] }> {
  const files = migrationFiles();
  const saved = join(tmpdir(), `vyact-migration-replay-${replayKey(files)}.tar`);
  if (existsSync(saved)) {
    try {
      const db = new PGlite({ loadDataDir: new Blob([readFileSync(saved)]), extensions: EXTENSIONS });
      await db.waitReady;
      return { db, applied: files };
    } catch {
      /* fault-ok: an unreadable saved copy is replaced by a fresh replay below */
    }
  }
  const db = await replayFromScratch(files);
  // Save it before any suite writes to it. Written under a temporary name and renamed, so a suite running at the
  // same moment never reads half a file.
  const tmp = `${saved}.${process.pid}.${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmp, new Uint8Array(await (await db.dumpDataDir('none')).arrayBuffer()));
  try { renameSync(tmp, saved); }
  catch { if (existsSync(tmp)) unlinkSync(tmp); /* fault-ok: another suite saved the same copy first */ }
  // A copy under any other hash is for migrations this checkout no longer has (about 45 MB each).
  for (const f of readdirSync(tmpdir())) {
    if (!/^vyact-migration-replay-[0-9a-f]+\.tar$/.test(f) || join(tmpdir(), f) === saved) continue;
    try { unlinkSync(join(tmpdir(), f)); }
    catch { /* fault-ok: a copy another run is reading is left for that run to clear */ }
  }
  return { db, applied: files };
}
