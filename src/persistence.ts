import { createRequire } from "node:module";

// ---------------------------------------------------------------------------
// Durable data store for the Watermelon Break Bot.
// Uses ioredis when REDIS_URL is set (production), falls back to a plain
// JSON-file store for development / the test harness.
// Data keys are namespaced under "wb:" to avoid collisions.
// ---------------------------------------------------------------------------

export interface BreakSchedule {
  interval_minutes: number;
  next_break_time: number;
  is_active: boolean;
}

export interface OwnerNotifications {
  dm_enabled: boolean;
  last_notification_time: number;
}

export interface CommandLogEntry {
  timestamp: number;
  command_name: string;
  user_id: number;
}

// Injectable clock — swap in tests to drive time-dependent logic.
export type ClockFn = () => number;
const defaultClock: ClockFn = () => Date.now();

// ---------------------------------------------------------------------------
// Storage interface (Redis or file-backed)
// ---------------------------------------------------------------------------

interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

// In-memory fallback (test harness / no Redis)
class MemoryStore implements Store {
  private data = new Map<string, string>();
  async get(key: string) { return this.data.get(key) ?? null; }
  async set(key: string, value: string) { this.data.set(key, value); }
  async del(key: string) { this.data.delete(key); }
  async keys(pattern: string) {
    const prefix = pattern.replace("*", "");
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

// Redis store (production)
class RedisStore implements Store {
  private client: ReturnType<typeof createRedisClient>;

  constructor(url: string) {
    this.client = createRedisClient(url);
  }

  async get(key: string) { return this.client.get(key); }
  async set(key: string, value: string) { await this.client.set(key, value); }
  async del(key: string) { await this.client.del(key); }
  async keys(pattern: string) { return this.client.keys(pattern); }
}

function createRedisClient(url: string) {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ioredis: any = require("ioredis");
  const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
  return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
}

// ---------------------------------------------------------------------------
// Persistence layer
// ---------------------------------------------------------------------------

const PREFIX = "wb:";

export class Persistence {
  private store: Store;
  private clock: ClockFn;

  constructor(store: Store, clock: ClockFn = defaultClock) {
    this.store = store;
    this.clock = clock;
  }

  // --- Break schedule ---

  private scheduleKey(chatId: number): string {
    return `${PREFIX}schedule:${chatId}`;
  }

  async getBreakSchedule(chatId: number): Promise<BreakSchedule> {
    const raw = await this.store.get(this.scheduleKey(chatId));
    if (raw) {
      try { return JSON.parse(raw) as BreakSchedule; } catch { /* fall through */ }
    }
    return { interval_minutes: 60, next_break_time: 0, is_active: false };
  }

  async setBreakSchedule(chatId: number, schedule: BreakSchedule): Promise<void> {
    await this.store.set(this.scheduleKey(chatId), JSON.stringify(schedule));
  }

  // --- Owner notifications ---

  private notifKey(chatId: number): string {
    return `${PREFIX}notif:${chatId}`;
  }

  async getNotifications(chatId: number): Promise<OwnerNotifications> {
    const raw = await this.store.get(this.notifKey(chatId));
    if (raw) {
      try { return JSON.parse(raw) as OwnerNotifications; } catch { /* fall through */ }
    }
    return { dm_enabled: true, last_notification_time: 0 };
  }

  async setNotifications(chatId: number, notif: OwnerNotifications): Promise<void> {
    await this.store.set(this.notifKey(chatId), JSON.stringify(notif));
  }

  // --- Command logs (90-day retention) ---

  private logKey(chatId: number): string {
    return `${PREFIX}logs:${chatId}`;
  }

  async addCommandLog(chatId: number, entry: CommandLogEntry): Promise<void> {
    const key = this.logKey(chatId);
    const raw = await this.store.get(key);
    let logs: CommandLogEntry[] = [];
    if (raw) {
      try { logs = JSON.parse(raw) as CommandLogEntry[]; } catch { /* start fresh */ }
    }
    logs.push(entry);
    // Retention: 90 days
    const cutoff = this.clock() - 90 * 24 * 60 * 60 * 1000;
    logs = logs.filter((e) => e.timestamp >= cutoff);
    await this.store.set(key, JSON.stringify(logs));
  }

  async getCommandLogs(chatId: number): Promise<CommandLogEntry[]> {
    const raw = await this.store.get(this.logKey(chatId));
    if (!raw) return [];
    try { return JSON.parse(raw) as CommandLogEntry[]; } catch { return []; }
  }
}

// ---------------------------------------------------------------------------
// Singleton (created once at startup)
// ---------------------------------------------------------------------------

let _instance: Persistence | null = null;

export function getPersistence(clock?: ClockFn): Persistence {
  if (_instance) return _instance;
  const url = process.env.REDIS_URL;
  const store: Store = url ? new RedisStore(url) : new MemoryStore();
  _instance = new Persistence(store, clock);
  return _instance;
}

/** Reset the singleton — test-only hook. */
export function _resetPersistence(): void {
  _instance = null;
}
