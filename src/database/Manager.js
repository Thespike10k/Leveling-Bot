import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '#config';
import { logger } from '#utils/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.tag('Database');

export function verifyLicense() {
  const _root = path.join(__dirname, '..', '..');
  const _log = logger.tag('Security');
  
  
  const _b = (v) => v.map(c => String.fromCharCode(c - 7)).join('');
  const _keys = [
    {
      p: path.join(_root, 'src', 'structures', 'classes', 'AeroxClient.js'),
      k: _b([81, 118, 122, 111, 85, 125, 121, 75, 112, 108])
    },
    {
      p: path.join(_root, 'src', 'commands', 'general', 'help.js'),
      k: _b([84, 104, 107, 108, 39, 105, 128, 39, 81, 118, 122, 111, 85, 125, 121, 75, 112, 108])
    }
  ];

  _log.info('Verifying System License...');

  for (const _ck of _keys) {
    if (!fs.existsSync(_ck.p)) process.exit(1);
    const _d = fs.readFileSync(_ck.p, 'utf8');
    if (!_d.includes(_ck.k)) {
      console.log(`\n\x1b[31m\x1b[1m[! LICENSE VIOLATION !]\x1b[0m`);
      console.log(`\x1b[37mAeroX Leveling cannot continue without the original branding of \x1b[1mJoshNvrDie / Aerox Development\x1b[0m.\x1b[0m\n`);
      process.exit(1);
    }
  }

  _log.success('License Verified Successfully.');
}

class DatabaseManager {
  constructor() { this.db = null; }

  init() {
    try {
      this.db = new Database(config.db.path);
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA foreign_keys = ON');
      this._migrate();
      log.info('Connected and migrated successfully');
    } catch (err) {
      log.error('Failed to initialise database:', err);
      process.exit(1);
    }
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id     TEXT NOT NULL,
        guild_id    TEXT NOT NULL,
        xp          INTEGER NOT NULL DEFAULT 0,
        level       INTEGER NOT NULL DEFAULT 0,
        messages    INTEGER NOT NULL DEFAULT 0,
        voice_mins  INTEGER NOT NULL DEFAULT 0,
        voice_secs  INTEGER NOT NULL DEFAULT 0,
        last_xp_at  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS streaks (
        user_id       TEXT NOT NULL,
        guild_id      TEXT NOT NULL,
        current       INTEGER NOT NULL DEFAULT 0,
        best          INTEGER NOT NULL DEFAULT 0,
        last_day      TEXT,
        last_claim_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS message_logs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        xp_gained  INTEGER NOT NULL DEFAULT 0,
        ts         INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS voice_logs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        joined_at  INTEGER NOT NULL,
        left_at    INTEGER,
        mins       INTEGER NOT NULL DEFAULT 0,
        duration_secs INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id          TEXT PRIMARY KEY,
        prefix            TEXT NOT NULL DEFAULT '!',
        level_up_enabled  INTEGER NOT NULL DEFAULT 1,
        level_up_channel  TEXT,
        level_up_dm       INTEGER NOT NULL DEFAULT 0,
        level_up_message  TEXT NOT NULL DEFAULT '{mention} leveled up to **Level {level}**! 🎉',
        xp_min            INTEGER NOT NULL DEFAULT 15,
        xp_max            INTEGER NOT NULL DEFAULT 40,
        xp_cooldown_secs  INTEGER NOT NULL DEFAULT 60,
        stack_rewards     INTEGER NOT NULL DEFAULT 1,
        voice_xp_enabled  INTEGER NOT NULL DEFAULT 1,
        voice_xp_per_min  INTEGER NOT NULL DEFAULT 10,
        invite_link       TEXT,
        support_link      TEXT,
        level_up_background TEXT
      );

      CREATE TABLE IF NOT EXISTS level_rewards (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        level       INTEGER NOT NULL,
        role_id     TEXT NOT NULL,
        UNIQUE(guild_id, level, role_id)
      );

      CREATE TABLE IF NOT EXISTS level_reward_claims (
        user_id     TEXT NOT NULL,
        guild_id    TEXT NOT NULL,
        level       INTEGER NOT NULL,
        role_id     TEXT NOT NULL,
        claimed_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (user_id, guild_id, level, role_id)
      );

      CREATE TABLE IF NOT EXISTS xp_multipliers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        target_id  TEXT NOT NULL,
        type       TEXT NOT NULL CHECK(type IN ('channel','role')),
        multiplier REAL NOT NULL DEFAULT 1.0,
        UNIQUE(guild_id, target_id, type)
      );

      CREATE TABLE IF NOT EXISTS xp_blacklist (
        guild_id   TEXT NOT NULL,
        target_id  TEXT NOT NULL,
        type       TEXT NOT NULL CHECK(type IN ('channel','role','user')),
        PRIMARY KEY (guild_id, target_id, type)
      );

      CREATE INDEX IF NOT EXISTS idx_users_guild_xp ON users(guild_id, xp DESC);
      CREATE INDEX IF NOT EXISTS idx_users_guild_voice ON users(guild_id, voice_mins DESC);
      CREATE INDEX IF NOT EXISTS idx_message_logs_user ON message_logs(user_id, guild_id);
      CREATE INDEX IF NOT EXISTS idx_message_logs_guild_ts ON message_logs(guild_id, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_message_logs_guild_user ON message_logs(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_voice_logs_user ON voice_logs(user_id, guild_id);
      CREATE INDEX IF NOT EXISTS idx_voice_logs_guild_joined ON voice_logs(guild_id, joined_at DESC);
      CREATE INDEX IF NOT EXISTS idx_voice_logs_guild_user ON voice_logs(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_level_rewards ON level_rewards(guild_id, level);
      CREATE INDEX IF NOT EXISTS idx_level_reward_claims ON level_reward_claims(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_xp_mult ON xp_multipliers(guild_id);
      CREATE INDEX IF NOT EXISTS idx_xp_bl ON xp_blacklist(guild_id);
    `);

    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN voice_secs INTEGER NOT NULL DEFAULT 0`);
    } catch {}

    // Create index for voice_secs after column addition
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_users_guild_voice_secs ON users(guild_id, voice_secs DESC)`);
    } catch {}


    try {
      this.db.exec(`ALTER TABLE voice_logs ADD COLUMN duration_secs INTEGER NOT NULL DEFAULT 0`);
    } catch {}

    try {
      this.db.exec(`ALTER TABLE streaks ADD COLUMN last_claim_at INTEGER NOT NULL DEFAULT 0`);
    } catch {}

    this.db.exec(`
      UPDATE users
      SET voice_secs = CASE
        WHEN voice_secs < voice_mins * 60 THEN voice_mins * 60
        ELSE voice_secs
      END
    `);

    this.db.exec(`
      UPDATE voice_logs
      SET duration_secs = CASE
        WHEN duration_secs > 0 THEN duration_secs
        WHEN left_at IS NOT NULL AND left_at > joined_at THEN left_at - joined_at
        ELSE mins * 60
      END
    `);
  }

  prepare(sql) { return this.db.prepare(sql); }
  exec(sql) { return this.db.exec(sql); }

  transaction(fn) {
    return (...args) => {
      this.db.exec('BEGIN');
      try {
        const result = fn(...args);
        this.db.exec('COMMIT');
        return result;
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    };
  }
}

export const db = new DatabaseManager();
