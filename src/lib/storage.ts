/**
 * Cassidey SD Card Storage Service
 *
 * Stores all AI data (memories, knowledge graph, skill progress, chat history)
 * on the device's external storage / SD card so it persists independently of
 * the app and survives reinstalls.
 *
 * Storage layout on Android:
 *   /storage/emulated/0/CassideyAI/
 *     ├── messages.json          — Chat history
 *     ├── learning_progress.json — Knowledge graph, vocabulary, mastery
 *     ├── skill_progress.json    — Skill levels & XP
 *     └── ai_engine.json         — Full AI engine state (KG, vocab, web topics, mastery)
 *
 * Falls back to localStorage when running in a browser (dev / GitHub Pages).
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// ── Detection ────────────────────────────────────────────────────────
const isNative = (): boolean =>
  typeof window !== 'undefined' &&
  // Capacitor bridges are only present when running inside a native shell
  !!(window as any).Capacitor?.isNativePlatform?.();

// ── Base directory on SD card / external storage ────────────────────
const APP_FOLDER = 'CassideyAI';

/** Full Capacitor path used for every read / write */
const baseOpts = { directory: Directory.ExternalStorage, encoding: Encoding.UTF8 };

// ── Low-level helpers ───────────────────────────────────────────────
async function ensureDir(): Promise<void> {
  if (!isNative()) return;
  try {
    // Try to read the directory — creates it if missing
    await Filesystem.readdir({ ...baseOpts, path: APP_FOLDER });
  } catch {
    try {
      await Filesystem.mkdir({ ...baseOpts, path: APP_FOLDER, recursive: true });
    } catch (e) {
      console.warn('[CassideyStorage] Could not create external dir, falling back to Documents:', e);
    }
  }
}

async function writeFile(name: string, data: string): Promise<void> {
  if (!isNative()) {
    localStorage.setItem(name, data);
    return;
  }
  await ensureDir();
  const path = `${APP_FOLDER}/${name}`;
  await Filesystem.writeFile({ ...baseOpts, path, data, recursive: true });
}

async function readFile(name: string): Promise<string | null> {
  if (!isNative()) {
    return localStorage.getItem(name);
  }
  try {
    const path = `${APP_FOLDER}/${name}`;
    const result = await Filesystem.readFile({ ...baseOpts, path });
    return result.data as string;
  } catch {
    return null;            // File doesn't exist yet
  }
}

async function removeFile(name: string): Promise<void> {
  if (!isNative()) {
    localStorage.removeItem(name);
    return;
  }
  try {
    const path = `${APP_FOLDER}/${name}`;
    await Filesystem.deleteFile({ ...baseOpts, path });
  } catch {
    // Ignore — file may not exist
  }
}

// ── One-time migration from localStorage → SD card ──────────────────
let migrationDone = false;

export async function migrateFromLocalStorage(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  if (!isNative()) return;         // No-op on web

  const keys = [
    'cassidey_messages',
    'cassidey_learning_progress',
    'cassidey_skill_progress',
  ];

  for (const key of keys) {
    const local = localStorage.getItem(key);
    if (local) {
      const fileName = key + '.json';
      const existing = await readFile(fileName);
      if (!existing) {
        // Only migrate if the file doesn't already exist on SD card
        await writeFile(fileName, local);
        console.log(`[CassideyStorage] Migrated "${key}" → SD card`);
      }
      // Keep the localStorage copy as backup — don't delete it
    }
  }

  console.log('[CassideyStorage] Migration check complete');
}

// ── Public JSON helpers ─────────────────────────────────────────────

/**
 * Read a JSON file from SD card (or localStorage on web).
 * Returns `fallback` if the file doesn't exist or can't be parsed.
 */
export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const raw = await readFile(fileName);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[CassideyStorage] Failed to parse ${fileName}:`, e);
    return fallback;
  }
}

/**
 * Write a JSON object to SD card (or localStorage on web).
 */
export async function writeJson(fileName: string, data: unknown): Promise<void> {
  await writeFile(fileName, JSON.stringify(data, null, 2));
}

/**
 * Delete a file from SD card (or localStorage on web).
 */
export async function removeJson(fileName: string): Promise<void> {
  await removeFile(fileName);
}

/**
 * Delete ALL Cassidey data from SD card and localStorage.
 */
export async function purgeAll(): Promise<void> {
  const files = [
    'cassidey_messages.json',
    'cassidey_learning_progress.json',
    'cassidey_skill_progress.json',
    'cassidey_ai_engine.json',
  ];
  for (const f of files) await removeFile(f);

  // Also clear the localStorage copies
  localStorage.removeItem('cassidey_messages');
  localStorage.removeItem('cassidey_learning_progress');
  localStorage.removeItem('cassidey_skill_progress');
  localStorage.removeItem('cassidey_ai_engine');
}

// ── Convenience file name constants ─────────────────────────────────
export const STORAGE_KEYS = {
  MESSAGES: 'cassidey_messages.json',
  LEARNING: 'cassidey_learning_progress.json',
  SKILLS: 'cassidey_skill_progress.json',
  AI_ENGINE: 'cassidey_ai_engine.json',
} as const;
