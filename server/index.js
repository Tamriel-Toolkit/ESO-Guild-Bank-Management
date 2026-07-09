import { Buffer } from 'node:buffer'
import cookieParser from 'cookie-parser'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs'
import helmet from 'helmet'
import nodemailer from 'nodemailer'
import path from 'node:path'
import process from 'node:process'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const dataDirectory = path.join(projectRoot, 'data')
const dbPath = process.env.DATABASE_FILE ? path.resolve(projectRoot, process.env.DATABASE_FILE) : path.join(dataDirectory, 'guild-bank.db')
const backupsDirectory = path.join(path.dirname(dbPath), 'backups')
const port = Number(process.env.PORT) || 3001
const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'eso_guild_bank_session'
const publicAppUrl = String(process.env.PUBLIC_APP_URL || 'https://www.esoguildgoldledger.com').replace(/\/$/, '')
const sessionTtlMs = (Number(process.env.SESSION_TTL_DAYS) || 14) * 24 * 60 * 60 * 1000
const emailVerificationTokenTtlMs = (Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS) || 24) * 60 * 60 * 1000
const passwordResetTokenTtlMs = (Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 60) * 60 * 1000
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT) || 300
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT) || 10
const isProduction = process.env.NODE_ENV === 'production'
const guildRoles = new Set(['viewer', 'admin', 'owner'])
const entryTypes = new Set(['deposit', 'withdrawal', 'salesTax'])
const smtpHost = process.env.SMTP_HOST || ''
const smtpPort = Number(process.env.SMTP_PORT) || 587
const smtpSecure =
  typeof process.env.SMTP_SECURE === 'string'
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465
const smtpUser = process.env.SMTP_USER || ''
const smtpPass = process.env.SMTP_PASS || ''
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || ''
const smtpFromName = process.env.SMTP_FROM_NAME || 'ESO Guild Gold Ledger'
const mailCaptureDirectory = process.env.MAIL_CAPTURE_DIRECTORY ? path.resolve(projectRoot, process.env.MAIL_CAPTURE_DIRECTORY) : ''

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
fs.mkdirSync(backupsDirectory, { recursive: true })
if (mailCaptureDirectory) fs.mkdirSync(mailCaptureDirectory, { recursive: true })

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')



db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    email_verified_at TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    selected_guild_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    week_start_date TEXT NOT NULL,
    due_scheme TEXT NOT NULL DEFAULT 'monthly',
    default_dues_amount INTEGER NOT NULL DEFAULT 0,
    last_summary_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    is_donation INTEGER NOT NULL DEFAULT 0,
    is_due INTEGER NOT NULL DEFAULT 0,
    withdrawal_category TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS guild_members (
    guild_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id),
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS guild_ranks (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS tracked_members (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id INTEGER,
    rank_id TEXT,
    name TEXT NOT NULL,
    dues_amount INTEGER NOT NULL DEFAULT 0,
    due_period TEXT NOT NULL DEFAULT 'monthly',
    dues_day INTEGER NOT NULL DEFAULT 1,
    uses_default_dues INTEGER NOT NULL DEFAULT 1,
    dues_exempt INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_active_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE,
    FOREIGN KEY (rank_id) REFERENCES guild_ranks (id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    tracked_member_id TEXT NOT NULL,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    role TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 50,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tracked_member_id) REFERENCES tracked_members (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS guild_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    code_hash TEXT NOT NULL UNIQUE,
    created_by_user_id INTEGER NOT NULL,
    single_use INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS guild_recruitment_settings (
    guild_id TEXT PRIMARY KEY,
    is_public INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    focus TEXT NOT NULL DEFAULT 'PvE',
    activity_times TEXT NOT NULL DEFAULT '',
    requirements TEXT NOT NULL DEFAULT '[]',
    application_questions TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    applicant_user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    answers TEXT NOT NULL DEFAULT '[]',
    reviewer_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS guild_webhooks (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    url TEXT NOT NULL,
    event_types TEXT NOT NULL DEFAULT '[]',
    channel_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    max_participants INTEGER NOT NULL DEFAULT 0,
    event_type TEXT NOT NULL DEFAULT 'standard',
    recurrence_rule TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS event_signups (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id INTEGER,
    occurrence_date TEXT NOT NULL,
    tracked_member_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (tracked_member_id) REFERENCES tracked_members (id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE,
    UNIQUE(event_id, occurrence_date, tracked_member_id)
  );

`)

const tableInfos = {
  users: db.pragma('table_info(users)'),
  guilds: db.pragma('table_info(guilds)'),
  entries: db.pragma('table_info(entries)'),
  guild_members: db.pragma('table_info(guild_members)'),
  tracked_members: db.pragma('table_info(tracked_members)'),
  events: db.pragma('table_info(events)'),
  event_signups: db.pragma('table_info(event_signups)'),
  guild_invites: db.pragma('table_info(guild_invites)'),
  guild_recruitment_settings: db.pragma('table_info(guild_recruitment_settings)'),
  guild_ranks: db.pragma('table_info(guild_ranks)'),
  characters: db.pragma('table_info(characters)'),
  audit_logs: db.pragma('table_info(audit_logs)'),
  applications: db.pragma('table_info(applications)'),
  email_verification_tokens: db.pragma('table_info(email_verification_tokens)'),
  password_reset_tokens: db.pragma('table_info(password_reset_tokens)'),
  guild_webhooks: db.pragma('table_info(guild_webhooks)'),
}

const ensureColumn = (table, column, definition) => {
  if (!tableInfos[table].some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('users', 'email', 'TEXT')
ensureColumn('users', 'email_verified_at', 'TEXT')
ensureColumn('guilds', 'due_scheme', "TEXT NOT NULL DEFAULT 'monthly'")
ensureColumn('guilds', 'default_dues_amount', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('entries', 'is_donation', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('entries', 'is_due', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('entries', 'withdrawal_category', "TEXT NOT NULL DEFAULT ''")
ensureColumn('guild_members', 'role', "TEXT NOT NULL DEFAULT 'viewer'")
ensureColumn('tracked_members', 'user_id', 'INTEGER')
ensureColumn('tracked_members', 'rank_id', 'TEXT')
ensureColumn('tracked_members', 'dues_amount', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('tracked_members', 'due_period', "TEXT NOT NULL DEFAULT 'monthly'")
ensureColumn('tracked_members', 'dues_day', 'INTEGER NOT NULL DEFAULT 1')
ensureColumn('tracked_members', 'uses_default_dues', 'INTEGER NOT NULL DEFAULT 1')
ensureColumn('tracked_members', 'dues_exempt', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('tracked_members', 'is_active', 'INTEGER NOT NULL DEFAULT 1')
ensureColumn('tracked_members', 'last_active_at', 'TEXT')
ensureColumn('guild_invites', 'single_use', 'INTEGER NOT NULL DEFAULT 1')
ensureColumn('guild_invites', 'expires_at', 'TEXT')
ensureColumn('guild_recruitment_settings', 'activity_times', "TEXT NOT NULL DEFAULT ''")
ensureColumn('characters', 'class', 'TEXT NOT NULL')
ensureColumn('characters', 'role', 'TEXT NOT NULL')
ensureColumn('characters', 'level', 'INTEGER NOT NULL DEFAULT 50')
ensureColumn('characters', 'is_primary', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('guild_ranks', 'weight', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('guild_ranks', 'permissions', "TEXT NOT NULL DEFAULT '{}'")
ensureColumn('guilds', 'last_summary_at', 'TEXT')
ensureColumn('audit_logs', 'details', "TEXT NOT NULL DEFAULT '{}'")
ensureColumn('applications', 'status', "TEXT NOT NULL DEFAULT 'pending'")
ensureColumn('applications', 'answers', "TEXT NOT NULL DEFAULT '[]'")
ensureColumn('applications', 'reviewer_notes', "TEXT NOT NULL DEFAULT ''")
ensureColumn('events', 'description', "TEXT NOT NULL DEFAULT ''")
ensureColumn('events', 'max_participants', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('events', 'event_type', "TEXT NOT NULL DEFAULT 'standard'")
ensureColumn('events', 'recurrence_rule', "TEXT NOT NULL DEFAULT 'none'")
ensureColumn('event_signups', 'user_id', 'INTEGER')
ensureColumn('event_signups', 'tracked_member_id', 'TEXT NOT NULL')
ensureColumn('event_signups', 'character_id', 'TEXT NOT NULL')
ensureColumn('event_signups', 'status', "TEXT NOT NULL DEFAULT 'confirmed'")

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
  CREATE INDEX IF NOT EXISTS idx_guilds_user_id ON guilds (user_id);
  CREATE INDEX IF NOT EXISTS idx_entries_guild_id ON entries (guild_id);
  CREATE INDEX IF NOT EXISTS idx_guild_members_user_id ON guild_members (user_id);
  CREATE INDEX IF NOT EXISTS idx_tracked_members_guild_id ON tracked_members (guild_id);
  CREATE INDEX IF NOT EXISTS idx_tracked_members_user_id ON tracked_members (user_id);
  CREATE INDEX IF NOT EXISTS idx_tracked_members_rank_id ON tracked_members (rank_id);
  CREATE INDEX IF NOT EXISTS idx_guild_ranks_guild_id ON guild_ranks (guild_id);
  CREATE INDEX IF NOT EXISTS idx_characters_tracked_member_id ON characters (tracked_member_id);
  CREATE INDEX IF NOT EXISTS idx_guild_invites_guild_id ON guild_invites (guild_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
  CREATE INDEX IF NOT EXISTS idx_events_guild_id ON events (guild_id);
  CREATE INDEX IF NOT EXISTS idx_event_signups_event_id ON event_signups (event_id);
  CREATE INDEX IF NOT EXISTS idx_event_signups_user_id ON event_signups (user_id);
  CREATE INDEX IF NOT EXISTS idx_guild_webhooks_guild_id ON guild_webhooks (guild_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL;
`)

db.prepare(
  `INSERT OR IGNORE INTO guild_recruitment_settings (guild_id)
   SELECT id FROM guilds`,
).run()


const statements = {
  createUser: db.prepare(`INSERT INTO users (username, email, password_hash, password_salt) VALUES (@username, @email, @passwordHash, @passwordSalt)`),
  findUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  updateUserEmail: db.prepare('UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?'),
  markUserEmailVerified: db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?'),
  updateUserPassword: db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'),
  updateUserSelectedGuild: db.prepare('UPDATE users SET selected_guild_id = ? WHERE id = ?'),
  createSession: db.prepare(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (@userId, @tokenHash, @expiresAt)`),
  findSessionUserByTokenHash: db.prepare(`SELECT sessions.token_hash, sessions.expires_at, users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`),
  deleteSessionByTokenHash: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  deleteSessionsByUserId: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  createEmailVerificationToken: db.prepare(`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (@userId, @tokenHash, @expiresAt)`),
  findEmailVerificationTokenByHash: db.prepare(`SELECT t.id, t.user_id AS userId, u.email, u.username FROM email_verification_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ?`),
  consumeEmailVerificationToken: db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL'),
  deleteEmailVerificationTokensForUser: db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?'),
  createPasswordResetToken: db.prepare(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (@userId, @tokenHash, @expiresAt)`),
  findPasswordResetTokenByHash: db.prepare(`SELECT t.id, t.user_id AS userId, u.email, u.username FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ?`),
  consumePasswordResetToken: db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL'),
  deletePasswordResetTokensForUser: db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?'),
  listGuildsForUser: db.prepare(`SELECT g.id, g.name, g.week_start_date AS weekStartDate, g.due_scheme AS dueScheme, g.default_dues_amount AS defaultDuesAmount, g.created_at AS createdAt, g.user_id AS ownerUserId, o.username AS ownerUsername, m.role AS membershipRole FROM guilds g JOIN guild_members m ON m.guild_id = g.id JOIN users o ON o.id = g.user_id WHERE m.user_id = ? ORDER BY g.created_at ASC, g.id ASC`),
  findFirstGuildForUser: db.prepare(`SELECT g.id FROM guilds g JOIN guild_members m ON m.guild_id = g.id WHERE m.user_id = ? ORDER BY g.created_at ASC, g.id ASC LIMIT 1`),
  listEntriesForGuild: db.prepare(`SELECT id, type, amount, is_donation AS isDonation, is_due AS isDue, withdrawal_category AS withdrawalCategory, date, user_name AS user, notes, created_at AS createdAt FROM entries WHERE guild_id = ? ORDER BY date DESC, created_at DESC, id DESC`),
  listGuildMembersForGuild: db.prepare(`SELECT u.id AS userId, u.username, m.role, CASE WHEN u.id = g.user_id THEN 1 ELSE 0 END AS isOwner FROM guild_members m JOIN users u ON u.id = m.user_id JOIN guilds g ON g.id = m.guild_id WHERE m.guild_id = ? ORDER BY isOwner DESC, u.username ASC`),
  listTrackedMembersForGuild: db.prepare(`SELECT id, guild_id AS guildId, user_id AS userId, rank_id AS rankId, name, dues_amount AS duesAmount, due_period AS duePeriod, dues_day AS duesDay, uses_default_dues AS useDefaultDues, dues_exempt AS duesExempt, is_active AS isActive, last_active_at AS lastActiveAt, created_at AS createdAt FROM tracked_members WHERE guild_id = ? ORDER BY is_active DESC, LOWER(name) ASC, created_at ASC, id ASC`),
  findGuildForUser: db.prepare(`SELECT g.id, g.user_id AS ownerUserId, g.name, g.week_start_date AS weekStartDate, g.due_scheme AS dueScheme, g.default_dues_amount AS defaultDuesAmount, m.role AS membershipRole FROM guilds g JOIN guild_members m ON m.guild_id = g.id WHERE g.id = ? AND m.user_id = ?`),
  createGuild: db.prepare(`INSERT INTO guilds (id, user_id, name, week_start_date, due_scheme, default_dues_amount) VALUES (@id, @userId, @name, @weekStartDate, @dueScheme, @defaultDuesAmount)`),
  createGuildMember: db.prepare(`INSERT OR IGNORE INTO guild_members (guild_id, user_id, role) VALUES (?, ?, ?)`),
  findGuildMember: db.prepare(`SELECT guild_id AS guildId, user_id AS userId, role FROM guild_members WHERE guild_id = ? AND user_id = ?`),
  updateGuildMemberRole: db.prepare(`UPDATE guild_members SET role = ? WHERE guild_id = ? AND user_id = ?`),
  deleteGuildMember: db.prepare(`DELETE FROM guild_members WHERE guild_id = ? AND user_id = ?`),
  findTrackedMemberForGuild: db.prepare(`SELECT id, guild_id AS guildId, user_id AS userId, rank_id AS rankId, name, dues_amount AS duesAmount, due_period AS duePeriod, dues_day AS duesDay, uses_default_dues AS useDefaultDues, dues_exempt AS duesExempt, is_active AS isActive, last_active_at AS lastActiveAt FROM tracked_members WHERE id = ? AND guild_id = ?`),
  createTrackedMember: db.prepare(`INSERT INTO tracked_members (id, guild_id, user_id, rank_id, name, dues_amount, due_period, dues_day, uses_default_dues, dues_exempt, is_active, last_active_at) VALUES (@id, @guildId, @userId, @rankId, @name, @duesAmount, @duePeriod, @duesDay, @useDefaultDues, @duesExempt, @isActive, @lastActiveAt)`),
  updateTrackedMember: db.prepare(`UPDATE tracked_members SET name = @name, user_id = @userId, rank_id = @rankId, dues_amount = @duesAmount, due_period = @duePeriod, dues_day = @duesDay, uses_default_dues = @useDefaultDues, dues_exempt = @duesExempt, is_active = @isActive, last_active_at = @lastActiveAt WHERE id = @id AND guild_id = @guildId`),
  deleteTrackedMember: db.prepare('DELETE FROM tracked_members WHERE id = ? AND guild_id = ?'),
  updateGuildSettings: db.prepare(`UPDATE guilds SET name = COALESCE(@name, name), week_start_date = COALESCE(@weekStartDate, week_start_date), due_scheme = COALESCE(@dueScheme, due_scheme), default_dues_amount = COALESCE(@defaultDuesAmount, default_dues_amount) WHERE id = @id AND user_id = @userId`),
  resetTrackedMembersToDefaultForGuild: db.prepare('UPDATE tracked_members SET uses_default_dues = 1, dues_amount = 0 WHERE guild_id = ?'),
  deleteGuild: db.prepare('DELETE FROM guilds WHERE id = ? AND user_id = ?'),
  createGuildInvite: db.prepare(`INSERT INTO guild_invites (guild_id, code_hash, created_by_user_id, single_use, expires_at) VALUES (@guildId, @codeHash, @createdByUserId, @singleUse, @expiresAt)`),
  findGuildInviteByCodeHash: db.prepare(`SELECT i.id, i.guild_id AS guildId, g.user_id AS ownerUserId, i.single_use AS singleUse, i.expires_at AS expiresAt FROM guild_invites i JOIN guilds g ON g.id = i.guild_id WHERE i.code_hash = ? AND (i.expires_at IS NULL OR i.expires_at > ?)`),
  deleteGuildInviteById: db.prepare('DELETE FROM guild_invites WHERE id = ?'),
  deleteExpiredGuildInvites: db.prepare('DELETE FROM guild_invites WHERE expires_at IS NOT NULL AND expires_at <= ?'),
  createAuditLog: db.prepare(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES (@actorUserId, @action, @entityType, @entityId, @details)`),
  listAuditLogsForGuild: db.prepare(`SELECT l.id, l.action, l.entity_type AS entityType, l.entity_id AS entityId, l.details, l.created_at AS createdAt, u.username AS actorUsername FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id WHERE (l.entity_type = 'guild' AND l.entity_id = @guildId) OR json_extract(l.details, '$.guildId') = @guildId ORDER BY l.created_at DESC, l.id DESC LIMIT 200`),
  createEntry: db.prepare(`INSERT INTO entries (id, guild_id, type, amount, is_donation, is_due, withdrawal_category, date, user_name, notes) VALUES (@id, @guildId, @type, @amount, @isDonation, @isDue, @withdrawalCategory, @date, @user, @notes)`),
  findEntryForGuild: db.prepare(`SELECT id, guild_id AS guildId, type, amount, is_donation AS isDonation, is_due AS isDue, withdrawal_category AS withdrawalCategory, date, user_name AS user, notes FROM entries WHERE id = ? AND guild_id = ?`),
  deleteEntry: db.prepare('DELETE FROM entries WHERE id = ? AND guild_id = ?'),
  listRanksForGuild: db.prepare('SELECT id, guild_id AS guildId, name, weight, permissions FROM guild_ranks WHERE guild_id = ? ORDER BY weight ASC, name ASC'),
  createRank: db.prepare('INSERT INTO guild_ranks (id, guild_id, name, weight, permissions) VALUES (@id, @guildId, @name, @weight, @permissions)'),
  updateRank: db.prepare('UPDATE guild_ranks SET name = @name, weight = @weight, permissions = @permissions WHERE id = @id AND guild_id = @guildId'),
  deleteRank: db.prepare('DELETE FROM guild_ranks WHERE id = ? AND guild_id = ?'),
  listEventsForGuild: db.prepare('SELECT id, guild_id AS guildId, title, description, start_time AS startTime, end_time AS endTime, max_participants AS maxParticipants, event_type AS eventType, recurrence_rule AS recurrenceRule FROM events WHERE guild_id = ?'),
  createEvent: db.prepare('INSERT INTO events (id, guild_id, title, description, start_time, end_time, max_participants, event_type, recurrence_rule) VALUES (@id, @guildId, @title, @description, @startTime, @endTime, @maxParticipants, @eventType, @recurrenceRule)'),
  updateEvent: db.prepare('UPDATE events SET title = @title, description = @description, start_time = @startTime, end_time = @endTime, max_participants = @maxParticipants, event_type = @eventType, recurrence_rule = @recurrenceRule WHERE id = @id AND guild_id = @guildId'),
  deleteEvent: db.prepare('DELETE FROM events WHERE id = ? AND guild_id = ?'),
  listSignupsForEvent: db.prepare(`
    SELECT s.id, s.event_id AS eventId, s.occurrence_date AS occurrenceDate, s.tracked_member_id AS trackedMemberId, s.character_id AS characterId, s.status, s.role, s.created_at AS createdAt, m.name AS memberName, c.name AS characterName, c.class AS characterClass
    FROM event_signups s
    JOIN tracked_members m ON m.id = s.tracked_member_id
    JOIN characters c ON c.id = s.character_id
    WHERE s.event_id = ? AND s.occurrence_date = ?
    ORDER BY s.created_at ASC
  `),
  createSignup: db.prepare('INSERT INTO event_signups (id, event_id, occurrence_date, tracked_member_id, character_id, status, role) VALUES (@id, @eventId, @occurrenceDate, @trackedMemberId, @characterId, @status, @role)'),
  updateSignup: db.prepare('UPDATE event_signups SET character_id = @characterId, role = @role, status = @status WHERE id = @id'),
  deleteSignup: db.prepare('DELETE FROM event_signups WHERE id = ?'),
  countConfirmedSignups: db.prepare("SELECT COUNT(*) as count FROM event_signups WHERE event_id = ? AND occurrence_date = ? AND status = 'confirmed'"),
  promoteWaitlist: db.prepare(`
    UPDATE event_signups
    SET status = 'confirmed'
    WHERE id = (
      SELECT id FROM event_signups
      WHERE event_id = ? AND occurrence_date = ? AND status = 'waitlist'
      ORDER BY created_at ASC LIMIT 1
    )
  `),
  listCharactersForMember: db.prepare('SELECT id, tracked_member_id AS trackedMemberId, name, class, role, level, is_primary AS isPrimary FROM characters WHERE tracked_member_id = ? ORDER BY is_primary DESC, name ASC'),
  createCharacter: db.prepare('INSERT INTO characters (id, tracked_member_id, name, class, role, level, is_primary) VALUES (@id, @trackedMemberId, @name, @class, @role, @level, @isPrimary)'),
  clearPrimaryCharactersForMember: db.prepare('UPDATE characters SET is_primary = 0 WHERE tracked_member_id = ?'),
  deleteCharacter: db.prepare('DELETE FROM characters WHERE id = ? AND tracked_member_id = ?'),
  findTrackedMemberByName: db.prepare('SELECT * FROM tracked_members WHERE guild_id = ? AND LOWER(name) = LOWER(?)'),
  linkTrackedMemberToUser: db.prepare('UPDATE tracked_members SET user_id = ? WHERE id = ?'),
  updateTrackedMemberActivity: db.prepare('UPDATE tracked_members SET last_active_at = ? WHERE user_id = ?'),
  listPublicGuilds: db.prepare(
    `SELECT guilds.id, guilds.name, guild_recruitment_settings.focus, guild_recruitment_settings.description, guild_recruitment_settings.activity_times AS activityTimes
     FROM guilds
     JOIN guild_recruitment_settings ON guilds.id = guild_recruitment_settings.guild_id
     WHERE guild_recruitment_settings.is_public = 1
     ORDER BY guilds.name ASC`,
  ),
  findRecruitmentSettings: db.prepare(
    `SELECT guild_id AS guildId, is_public AS isPublic, description, focus, activity_times AS activityTimes, requirements, application_questions AS applicationQuestions
     FROM guild_recruitment_settings
     WHERE guild_id = ?`,
  ),
  createRecruitmentSettings: db.prepare(
    `INSERT INTO guild_recruitment_settings (guild_id, is_public, description, focus, activity_times, requirements, application_questions)
     VALUES (@guildId, @isPublic, @description, @focus, @activityTimes, @requirements, @applicationQuestions)`,
  ),
  updateRecruitmentSettings: db.prepare(
    `UPDATE guild_recruitment_settings
     SET is_public = @isPublic,
         description = @description,
         focus = @focus,
         activity_times = @activityTimes,
         requirements = @requirements,
         application_questions = @applicationQuestions
     WHERE guild_id = @guildId`,
  ),
  createApplication: db.prepare(
    `INSERT INTO applications (id, guild_id, applicant_user_id, status, answers, reviewer_notes)
     VALUES (@id, @guildId, @applicantUserId, @status, @answers, @reviewerNotes)`,
  ),
  listApplicationsForGuild: db.prepare(
    `SELECT applications.id, applications.guild_id AS guildId, applications.applicant_user_id AS applicantUserId,
            applications.status, applications.answers, applications.reviewer_notes AS reviewerNotes,
            applications.created_at AS createdAt, users.username AS applicantUsername
     FROM applications
     JOIN users ON users.id = applications.applicant_user_id
     WHERE applications.guild_id = ?
     ORDER BY applications.created_at DESC`,
  ),
  updateApplication: db.prepare(
    `UPDATE applications
     SET status = @status,
         reviewer_notes = @reviewerNotes
     WHERE id = @id AND guild_id = @guildId`,
  ),
  findApplicationById: db.prepare(
    `SELECT id, guild_id AS guildId, applicant_user_id AS applicantUserId, status, answers, reviewer_notes AS reviewerNotes, created_at AS createdAt
     FROM applications
     WHERE id = ?`,
  ),
  listApplicationsForUser: db.prepare(
    `SELECT applications.id, applications.guild_id AS guildId, guilds.name AS guildName,
            applications.status, applications.answers, applications.reviewer_notes AS reviewerNotes,
            applications.created_at AS createdAt
     FROM applications
     JOIN guilds ON guilds.id = applications.guild_id
     WHERE applications.applicant_user_id = ?
     ORDER BY applications.created_at DESC`,
  ),
  updateGuildLastSummary: db.prepare('UPDATE guilds SET last_summary_at = ? WHERE id = ?'),
  findEventById: db.prepare('SELECT * FROM events WHERE id = ?'),
  findSignupById: db.prepare('SELECT * FROM event_signups WHERE id = ?'),
  listWebhooksForGuild: db.prepare('SELECT * FROM guild_webhooks WHERE guild_id = ?'),
  findWebhookById: db.prepare('SELECT * FROM guild_webhooks WHERE id = ?'),
  createWebhook: db.prepare('INSERT INTO guild_webhooks (id, guild_id, url, event_types, channel_name) VALUES (@id, @guildId, @url, @eventTypes, @channelName)'),
  updateWebhook: db.prepare('UPDATE guild_webhooks SET url = @url, event_types = @eventTypes, channel_name = @channelName WHERE id = @id AND guild_id = @guildId'),
  deleteWebhook: db.prepare('DELETE FROM guild_webhooks WHERE id = ? AND guild_id = ?'),
  listGuilds: db.prepare('SELECT id FROM guilds'),
}

const webhookEmitter = new EventEmitter()

async function sendDiscordWebhook(webhookUrl, payload) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status} ${await response.text()}`)
    }
  } catch (err) {
    console.error('Error sending Discord webhook:', err)
  }
}

webhookEmitter.on('event', async ({ guildId, eventType, data }) => {
  const webhooks = statements.listWebhooksForGuild.all(guildId)
  for (const webhook of webhooks) {
    const types = JSON.parse(webhook.event_types || '[]')
    if (types.includes(eventType)) {
      let content = ''
      let embeds = []

      if (eventType === 'audit_log') {
        content = `**Audit Log:** ${data.action} by ${data.actorUsername || 'System'}`
        embeds = [{
          title: `Action: ${data.action}`,
          description: `Entity: ${data.entityType} (${data.entityId || 'N/A'})`,
          fields: Object.entries(data.details || {}).map(([k, v]) => ({ name: k, value: String(v), inline: true })),
          timestamp: data.createdAt,
        }]
      } else if (eventType === 'application_submitted') {
        content = `**New Application!** User **${data.applicantUsername}** applied to the guild.`
      } else if (eventType === 'application_approved') {
        content = `**Application Approved!** **${data.applicantUsername}** is now a member.`
      } else if (eventType === 'event_created') {
        content = `**New Event Scheduled:** ${data.title}`
        embeds = [{
          title: data.title,
          description: data.description,
          fields: [
            { name: 'Start', value: data.startTime, inline: true },
            { name: 'End', value: data.endTime, inline: true },
            { name: 'Recurrence', value: data.recurrenceRule, inline: true },
          ],
        }]
      } else if (eventType === 'daily_summary') {
        content = `**Daily Guild Bank Summary** for ${data.date}`
        embeds = [{
          title: 'Activity Totals',
          fields: [
            { name: 'Deposits', value: `${data.totals.deposit.toLocaleString()}g`, inline: true },
            { name: 'Withdrawals', value: `${data.totals.withdrawal.toLocaleString()}g`, inline: true },
            { name: 'Sales Tax', value: `${data.totals.salesTax.toLocaleString()}g`, inline: true },
            { name: 'Net', value: `${(data.totals.deposit + data.totals.salesTax - data.totals.withdrawal).toLocaleString()}g`, inline: true },
          ],
        }]
      }

      if (content) {
        await sendDiscordWebhook(webhook.url, { content, embeds })
      }
    }
  }
})

async function sendDailySummaries() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const guilds = statements.listGuilds.all()

  for (const guild of guilds) {
    if (guild.last_summary_at === today) continue

    const entries = statements.listEntriesForGuild.all(guild.id)
    const yesterdayEntries = entries.filter(e => e.date === yesterday)

    if (yesterdayEntries.length > 0) {
      const totals = yesterdayEntries.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + (Number(e.amount) || 0)
        return acc
      }, { deposit: 0, withdrawal: 0, salesTax: 0 })

      webhookEmitter.emit('event', {
        guildId: guild.id,
        eventType: 'daily_summary',
        data: {
          date: yesterday,
          totals
        }
      })
    }
    statements.updateGuildLastSummary.run(today, guild.id)
  }
}

// Check every hour if we should send summaries
setInterval(() => {
  const now = new Date()
  // Trigger summaries in the early morning
  if (now.getHours() >= 0 && now.getHours() < 4) {
    sendDailySummaries().catch(console.error)
  }
}, 60 * 60 * 1000)

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', isProduction ? 1 : false)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: apiRateLimitMax,
  handler: (_req, _res, next) => next(createHttpError(429, 'Too many requests were sent in a short time. Please wait a moment and try again.')),
})
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authRateLimitMax,
  handler: (_req, _res, next) => next(createHttpError(429, 'Too many sign-in or account creation attempts were made. Please wait a few minutes and try again.')),
})

function createHttpError(status, message) {
  const error = new Error(message); error.status = status; return error
}

function requireBasicCsrfProtection(req, _res, next) {
  if (!req.path.startsWith('/api') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return next(createHttpError(403, 'This request is missing a required security header. Refresh the page and try again.'))
  next()
}

app.use('/api/auth', authRateLimiter)
app.use('/api', apiRateLimiter)
app.use(requireBasicCsrfProtection)

let backupScheduled = false
let backupPromise = Promise.resolve()
let lastBackupAt = 0
let pendingBackupReason = 'mutation'

function pruneOldBackups() {
  const backupFiles = fs.readdirSync(backupsDirectory, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.db')).map(e => e.name).sort()
  while (backupFiles.length > 20) {
    const oldest = backupFiles.shift()
    fs.rmSync(path.join(backupsDirectory, oldest), { force: true })
  }
}

function scheduleBackup(reason) {
  pendingBackupReason = String(reason || 'mutation').replace(/[^a-z0-9]+/gi, '-')
  if (backupScheduled) return
  backupScheduled = true
  const delay = Math.max(0, 300000 - (Date.now() - lastBackupAt))
  setTimeout(() => {
    backupScheduled = false
    const backupReason = pendingBackupReason
    backupPromise = backupPromise.catch(() => {}).then(async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFilePath = path.join(backupsDirectory, `${timestamp}-${backupReason}.db`)
      await db.backup(backupFilePath)
      lastBackupAt = Date.now()
      pruneOldBackups()
    }).catch(console.error)
  }, delay)
}

function getMailFromAddress() {
  return smtpFromEmail ? `${smtpFromName} <${smtpFromEmail}>` : ''
}

function canDeliverTransactionalEmail() {
  return Boolean(mailCaptureDirectory || (smtpHost && smtpPort && smtpFromEmail))
}

function ensureTransactionalEmailAvailable() {
  if (!canDeliverTransactionalEmail()) {
    throw createHttpError(503, 'Account email is not configured right now. Please try again later.')
  }
}

let mailTransport = null

function getMailTransport() {
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser || smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })
  }

  return mailTransport
}

async function deliverTransactionalEmail({ to, subject, text, html, category }) {
  if (mailCaptureDirectory) {
    const filePath = path.join(mailCaptureDirectory, `${Date.now()}-${category}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify({ to, subject, text, html, category }, null, 2))
    return
  }

  if (!canDeliverTransactionalEmail()) {
    throw createHttpError(503, 'Account email is not configured right now. Please try again later.')
  }

  await getMailTransport().sendMail({
    from: getMailFromAddress(),
    to,
    subject,
    text,
    html,
  })
}

function writeAuditLog({ actorUserId = null, action, entityType, entityId = null, details = {} }) {
  statements.createAuditLog.run({ actorUserId, action, entityType, entityId: entityId == null ? null : String(entityId), details: JSON.stringify(details) })
  const guildId = details.guildId || (entityType === 'guild' ? entityId : null)
  if (guildId) {
    const actor = actorUserId ? statements.findUserById.get(actorUserId) : null
    webhookEmitter.emit('event', {
      guildId,
      eventType: 'audit_log',
      data: {
        action,
        entityType,
        entityId,
        details,
        actorUsername: actor?.username || 'System',
        createdAt: new Date().toISOString(),
      }
    })
  }
}

function serializeUser(userId) {
  const user = statements.findUserById.get(userId)
  if (!user) return null
  const guilds = statements.listGuildsForUser.all(userId).map(g => {
    const ranks = statements.listRanksForGuild.all(g.id).map(r => ({ ...r, permissions: JSON.parse(r.permissions) }))
    const trackedMembers = statements.listTrackedMembersForGuild.all(g.id).map(m => ({
      ...m,
      duePeriod: m.duePeriod === 'weekly' ? 'weekly' : 'monthly',
      useDefaultDues: Boolean(m.useDefaultDues),
      duesExempt: Boolean(m.duesExempt),
      isActive: Boolean(m.isActive),
      characters: statements.listCharactersForMember.all(m.id).map(c => ({ ...c, isPrimary: Boolean(c.isPrimary) })),
    }))

    const userTrackedMember = trackedMembers.find(m => m.userId === userId)
    const permissions = userTrackedMember?.rankId ? ranks.find(r => r.id === userTrackedMember.rankId)?.permissions || {} : {}

    return {
      ...g,
      dueScheme: g.dueScheme === 'weekly' ? 'weekly' : 'monthly',
      defaultDuesAmount: Number(g.defaultDuesAmount) || 0,
      role: g.membershipRole,
      isOwner: g.ownerUserId === userId,
      canEdit: ['admin', 'owner'].includes(g.membershipRole),
      canManageEvents: ['admin', 'owner'].includes(g.membershipRole) || Boolean(permissions.canManageEvents),
      canManagePermissions: g.membershipRole === 'owner',
      canDelete: g.membershipRole === 'owner',
      members: statements.listGuildMembersForGuild.all(g.id).map(m => ({ ...m, isOwner: Boolean(m.isOwner) })),
      ranks,
      trackedMembers,
      entries: statements.listEntriesForGuild.all(g.id),
    }
  })
  const selectedGuildId = guilds.some(g => g.id === user.selected_guild_id) ? user.selected_guild_id : guilds[0]?.id ?? null
  if (selectedGuildId !== user.selected_guild_id) statements.updateUserSelectedGuild.run(selectedGuildId, userId)
  return { username: user.username, email: user.email || '', emailVerified: Boolean(user.email_verified_at), selectedGuildId, guilds }
}

function hashSessionToken(token) { return crypto.createHash('sha256').update(token).digest('hex') }
function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString()
  statements.createSession.run({ userId, tokenHash: hashSessionToken(token), expiresAt })
  res.cookie(sessionCookieName, token, { httpOnly: true, sameSite: 'lax', secure: isProduction, expires: new Date(expiresAt), path: '/' })
}

function getAuthenticatedUser(req) {
  const token = req.cookies?.[sessionCookieName]
  if (!token) return null
  statements.deleteExpiredSessions.run(new Date().toISOString())
  return statements.findSessionUserByTokenHash.get(hashSessionToken(token), new Date().toISOString())
}

function requireAuth(req, _res, next) {
  const user = getAuthenticatedUser(req)
  if (!user) return next(createHttpError(401, 'Your session has expired or you are not signed in. Please log in and try again.'))
  req.user = user; next()
}

function getFirstAccessibleGuildId(userId) {
  return statements.findFirstGuildForUser.get(userId)?.id ?? null
}

function ensureGuildForUser(userId, guildId) {
  const guild = statements.findGuildForUser.get(guildId, userId)
  if (!guild) throw createHttpError(404, 'That guild could not be found or you no longer have access to it.')
  return guild
}
function ensureGuildEditor(userId, guildId) {
  const guild = ensureGuildForUser(userId, guildId)
  if (!['admin', 'owner'].includes(guild.membershipRole)) throw createHttpError(403, 'You have view-only access to this guild. Ask the owner to grant admin access before making changes.')
  return guild
}
function ensureGuildOwner(userId, guildId) {
  const guild = ensureGuildForUser(userId, guildId)
  if (guild.membershipRole !== 'owner') throw createHttpError(403, 'Only the guild owner can manage sharing and member access for this guild.')
  return guild
}

function ensureCanManageEvents(userId, guildId) {
  const guild = ensureGuildForUser(userId, guildId)
  if (['admin', 'owner'].includes(guild.membershipRole)) return guild

  const ranks = statements.listRanksForGuild.all(guildId).map(r => ({ ...r, permissions: JSON.parse(r.permissions) }))
  const trackedMember = statements.listTrackedMembersForGuild.all(guildId).find(m => m.userId === userId)
  const permissions = trackedMember?.rankId ? ranks.find(r => r.id === trackedMember.rankId)?.permissions || {} : {}

  if (!permissions.canManageEvents) {
    throw createHttpError(403, 'You do not have permission to manage events for this guild.')
  }
  return guild
}

function sanitizeText(v, len) { return String(v || '').trim().slice(0, len) }
function validateUsername(u) { if (!/^[a-z0-9_-]{3,30}$/.test(u)) throw createHttpError(400, 'Your username must be 3-30 characters and can only use lowercase letters, numbers, underscores, or hyphens.') }
function validatePassword(p) { if (typeof p !== 'string' || p.length < 10) throw createHttpError(400, 'Your password must be at least 10 characters long.') }
function validateEmail(e) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw createHttpError(400, 'Enter a valid recovery email address.') }
function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString('hex')
  return { passwordHash: crypto.scryptSync(p, salt, 64).toString('hex'), passwordSalt: salt }
}
function verifyPassword(p, u) {
  return crypto.timingSafeEqual(crypto.scryptSync(p, u.password_salt, 64), Buffer.from(u.password_hash, 'hex'))
}

function expandRecurringEvents(event, startLimit, endLimit) {
  const instances = []
  const eventStart = new Date(event.startTime)
  const eventEnd = new Date(event.endTime)
  const duration = eventEnd.getTime() - eventStart.getTime()

  if (event.recurrenceRule === 'none' || !event.recurrenceRule) {
    if (event.startTime < endLimit && event.endTime > startLimit) {
      instances.push({
        ...event,
        occurrenceDate: event.startTime.slice(0, 10),
      })
    }
    return instances
  }

  let current = new Date(eventStart)
  let count = 0
  const maxInstances = 500

  while (current.toISOString() < endLimit && count < maxInstances) {
    const currentEnd = new Date(current.getTime() + duration)
    const occurrenceDate = current.toISOString().slice(0, 10)

    if (currentEnd.toISOString() > startLimit) {
      instances.push({
        ...event,
        startTime: current.toISOString(),
        endTime: currentEnd.toISOString(),
        occurrenceDate,
      })
    }

    if (event.recurrenceRule === 'daily') {
      current.setDate(current.getDate() + 1)
    } else if (event.recurrenceRule === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else {
      break
    }
    count++
  }

  return instances
}

async function issueEmailVerification(user) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + emailVerificationTokenTtlMs).toISOString()
  statements.deleteEmailVerificationTokensForUser.run(user.id)
  statements.createEmailVerificationToken.run({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt })
  const verificationUrl = `${publicAppUrl}/?verify-email=${token}`
  await deliverTransactionalEmail({ to: user.email, category: 'verify-email', subject: 'Verify Email', text: `Verify your email:
${verificationUrl}` })
}

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'eso-guild-gold-ledger', publicAppUrl, timestamp: new Date().toISOString() }))
app.get('/api/session', (req, res) => {
  const u = getAuthenticatedUser(req)
  if (!u) { res.clearCookie(sessionCookieName); return res.json({ user: null }) }
  res.json({ user: serializeUser(u.id) })
})

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const u = String(req.body.username || '').toLowerCase().trim(), e = String(req.body.email || '').toLowerCase().trim(), p = req.body.password
    validateUsername(u); validateEmail(e); validatePassword(p)
    if (statements.findUserByUsername.get(u)) throw createHttpError(409, 'That username is already in use. Choose a different username or log in instead.')
    if (statements.findUserByEmail.get(e)) throw createHttpError(409, 'That recovery email is already attached to another account. Use a different email or recover that account instead.')
    const { passwordHash, passwordSalt } = hashPassword(p)
    const result = statements.createUser.run({ username: u, email: e, passwordHash, passwordSalt })
    writeAuditLog({ actorUserId: result.lastInsertRowid, action: 'auth.signup', entityType: 'user', entityId: result.lastInsertRowid, details: { username: u } })
    ensureTransactionalEmailAvailable()
    await issueEmailVerification({ id: result.lastInsertRowid, email: e })
    createSession(res, result.lastInsertRowid)
    scheduleBackup('auth-signup')
    res.status(201).json({ user: serializeUser(result.lastInsertRowid), notice: 'Account created. Check your email to verify your recovery address.' })
  } catch (err) { next(err) }
})

app.post('/api/auth/login', (req, res, next) => {
  try {
    const u = String(req.body.username || '').toLowerCase().trim(), p = req.body.password
    const user = statements.findUserByUsername.get(u)
    if (!user || !verifyPassword(p, user)) throw createHttpError(401, 'The username or password you entered is incorrect.')
    createSession(res, user.id)
    statements.updateTrackedMemberActivity.run(new Date().toISOString(), user.id)
    res.json({ user: serializeUser(user.id) })
  } catch (err) { next(err) }
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[sessionCookieName]
  if (token) statements.deleteSessionByTokenHash.run(hashSessionToken(token))
  res.clearCookie(sessionCookieName).status(204).end()
})

app.post('/api/auth/email-verification/verify', (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim()
    const record = statements.findEmailVerificationTokenByHash.get(hashSessionToken(token), new Date().toISOString())
    if (!record) throw createHttpError(400, 'This email verification link is invalid or expired.')
    const now = new Date().toISOString()
    statements.consumeEmailVerificationToken.run(now, record.id)
    statements.markUserEmailVerified.run(now, record.userId)
    writeAuditLog({ actorUserId: record.userId, action: 'auth.email_verified', entityType: 'user', entityId: record.userId, details: { email: record.email } })
    scheduleBackup('auth-email-verified')
    res.json({ message: 'Recovery email verified. You can now reset your password if needed.' })
  } catch (err) { next(err) }
})

app.post('/api/auth/password-reset/request', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim(); validateEmail(email)
    const user = statements.findUserByEmail.get(email)
    if (user?.email_verified_at) {
      const token = crypto.randomBytes(32).toString('hex')
      statements.deletePasswordResetTokensForUser.run(user.id)
      statements.createPasswordResetToken.run({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + passwordResetTokenTtlMs).toISOString() })
      const url = `${publicAppUrl}/?reset-password=${token}`
      ensureTransactionalEmailAvailable()
      await deliverTransactionalEmail({ to: email, category: 'password-reset', subject: 'Reset Password', text: `Reset:
${url}` })
      writeAuditLog({ actorUserId: user.id, action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id, details: { email } })
    }
    res.json({ message: 'If that recovery email is attached to an account, a password reset link has been sent.' })
  } catch (err) { next(err) }
})

app.post('/api/auth/password-reset/confirm', (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim(), p = req.body.password; validatePassword(p)
    const record = statements.findPasswordResetTokenByHash.get(hashSessionToken(token), new Date().toISOString())
    if (!record) throw createHttpError(400, 'This password reset link is invalid or expired.')
    const { passwordHash, passwordSalt } = hashPassword(p)
    statements.updateUserPassword.run(passwordHash, passwordSalt, record.userId)
    statements.consumePasswordResetToken.run(new Date().toISOString(), record.id)
    statements.deleteSessionsByUserId.run(record.userId)
    writeAuditLog({ actorUserId: record.userId, action: 'auth.password_reset_completed', entityType: 'user', entityId: record.userId, details: { email: record.email } })
    scheduleBackup('auth-password-reset')
    res.json({ message: 'Password updated. Log in with your new password.' })
  } catch (err) { next(err) }
})

app.post('/api/guilds', requireAuth, (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name, 80)
    if (!name) throw createHttpError(400, 'Enter a guild name before continuing.')
    const id = crypto.randomUUID()
    statements.createGuild.run({ id, userId: req.user.id, name, weekStartDate: req.body.weekStartDate || new Date().toISOString().slice(0, 10), dueScheme: req.body.dueScheme || 'monthly', defaultDuesAmount: Number(req.body.defaultDuesAmount) || 0 })
    statements.createGuildMember.run(id, req.user.id, 'owner')
    statements.createRecruitmentSettings.run({ guildId: id, isPublic: 0, description: '', focus: 'PvE', activityTimes: '', requirements: '[]', applicationQuestions: '[]' })
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.create', entityType: 'guild', entityId: id, details: { name } })
    scheduleBackup('guild-create')
    res.status(201).json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.patch('/api/guilds/:guildId', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    statements.updateGuildSettings.run({ id: g.id, userId: g.ownerUserId, name: req.body.name || null, weekStartDate: req.body.weekStartDate || null, dueScheme: req.body.dueScheme || null, defaultDuesAmount: req.body.defaultDuesAmount !== undefined ? req.body.defaultDuesAmount : null })
    if (req.body.defaultDuesAmount !== undefined) statements.resetTrackedMembersToDefaultForGuild.run(g.id)
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.update', entityType: 'guild', entityId: g.id, details: { updates: Object.keys(req.body) } })
    scheduleBackup('guild-update')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.get('/api/guilds/:guildId/events', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildForUser(req.user.id, req.params.guildId)
    const start = req.query.start || new Date(0).toISOString()
    const end = req.query.end || new Date(Date.now() + 31536000000).toISOString()
    const rawEvents = statements.listEventsForGuild.all(g.id)
    const events = rawEvents.flatMap(e => expandRecurringEvents(e, start, end))
    res.json({ events: events.sort((a, b) => a.startTime.localeCompare(b.startTime)) })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/events', requireAuth, (req, res, next) => {
  try {
    const g = ensureCanManageEvents(req.user.id, req.params.guildId)
    const id = crypto.randomUUID()
    statements.createEvent.run({
      id,
      guildId: g.id,
      title: req.body.title,
      description: req.body.description || '',
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      maxParticipants: Number(req.body.maxParticipants) || 0,
      eventType: req.body.eventType || 'standard',
      recurrenceRule: req.body.recurrenceRule || 'none'
    })
    writeAuditLog({ actorUserId: req.user.id, action: 'event.create', entityType: 'event', entityId: id, details: { guildId: g.id, title: req.body.title } })
    webhookEmitter.emit('event', {
      guildId: g.id,
      eventType: 'event_created',
      data: {
        title: req.body.title,
        description: req.body.description,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        recurrenceRule: req.body.recurrenceRule || 'none',
      }
    })
    res.status(201).json({ id })
  } catch (err) { next(err) }
})

app.patch('/api/guilds/:guildId/events/:eventId', requireAuth, (req, res, next) => {
  try {
    const g = ensureCanManageEvents(req.user.id, req.params.guildId)
    statements.updateEvent.run({
      id: req.params.eventId,
      guildId: g.id,
      title: req.body.title,
      description: req.body.description || '',
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      maxParticipants: Number(req.body.maxParticipants) || 0,
      eventType: req.body.eventType || 'standard',
      recurrenceRule: req.body.recurrenceRule || 'none'
    })
    writeAuditLog({ actorUserId: req.user.id, action: 'event.update', entityType: 'event', entityId: req.params.eventId, details: { guildId: g.id, title: req.body.title } })
    res.json({ message: 'Event updated.' })
  } catch (err) { next(err) }
})

app.delete('/api/guilds/:guildId/events/:eventId', requireAuth, (req, res, next) => {
  try {
    const g = ensureCanManageEvents(req.user.id, req.params.guildId)
    statements.deleteEvent.run(req.params.eventId, g.id)
    writeAuditLog({ actorUserId: req.user.id, action: 'event.delete', entityType: 'event', entityId: req.params.eventId, details: { guildId: g.id } })
    res.json({ message: 'Event deleted.' })
  } catch (err) { next(err) }
})

app.get('/api/guilds/:guildId/events/:eventId/signups', requireAuth, (req, res, next) => {
  try {
    ensureGuildForUser(req.user.id, req.params.guildId)
    const signups = statements.listSignupsForEvent.all(req.params.eventId, req.query.occurrenceDate)
    res.json({ signups })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/events/:eventId/signups', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildForUser(req.user.id, req.params.guildId)
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(req.params.eventId, g.id)
    if (!event) throw createHttpError(404, 'Event not found.')

    const count = statements.countConfirmedSignups.get(event.id, req.body.occurrenceDate).count
    const status = (event.max_participants > 0 && count >= event.max_participants) ? 'waitlist' : 'confirmed'

    const id = crypto.randomUUID()
    statements.createSignup.run({ id, eventId: event.id, occurrenceDate: req.body.occurrenceDate, trackedMemberId: req.body.trackedMemberId, characterId: req.body.characterId, role: req.body.role, status })
    res.status(201).json({ id, status })
  } catch (err) { next(err) }
})

app.patch('/api/signups/:signupId', requireAuth, (req, res, next) => {
  try {
    // Permission check: either owner of signup or event manager
    const signup = db.prepare('SELECT s.*, e.guild_id FROM event_signups s JOIN events e ON e.id = s.event_id WHERE s.id = ?').get(req.params.signupId)
    if (!signup) throw createHttpError(404, 'Signup not found.')

    // Check if user is the member in the signup
    const member = statements.findTrackedMemberForGuild.get(signup.tracked_member_id, signup.guild_id)
    const isOwner = member && member.userId === req.user.id

    if (!isOwner) {
       ensureCanManageEvents(req.user.id, signup.guild_id)
    }

    statements.updateSignup.run({ id: req.params.signupId, characterId: req.body.characterId || signup.character_id, role: req.body.role || signup.role, status: req.body.status || signup.status })
    res.json({ message: 'Signup updated.' })
  } catch (err) { next(err) }
})

app.delete('/api/signups/:signupId', requireAuth, (req, res, next) => {
  try {
    const signup = db.prepare('SELECT s.*, e.guild_id FROM event_signups s JOIN events e ON e.id = s.event_id WHERE s.id = ?').get(req.params.signupId)
    if (!signup) throw createHttpError(404, 'Signup not found.')

    const member = statements.findTrackedMemberForGuild.get(signup.tracked_member_id, signup.guild_id)
    const isOwner = member && member.userId === req.user.id
    if (!isOwner) {
       ensureCanManageEvents(req.user.id, signup.guild_id)
    }

    statements.deleteSignup.run(req.params.signupId)

    if (signup.status === 'confirmed') {
       statements.promoteWaitlist.run(signup.event_id, signup.occurrence_date)
    }

    res.json({ message: 'Signup removed.' })
  } catch (err) { next(err) }
})


app.delete('/api/guilds/:guildId', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildOwner(req.user.id, req.params.guildId)
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.delete', entityType: 'guild', entityId: g.id, details: { name: g.name } })
    statements.deleteGuild.run(g.id, req.user.id)
    scheduleBackup('guild-delete')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.delete('/api/guilds/:guildId/membership', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildForUser(req.user.id, req.params.guildId)
    if (g.ownerUserId === req.user.id) throw createHttpError(400, 'Owners cannot leave.')
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.leave', entityType: 'guild_member', entityId: `${g.id}:${req.user.id}`, details: { guildId: g.id } })
    const transaction = db.transaction(() => {
      statements.deleteGuildMember.run(g.id, req.user.id)
      if (req.user.selected_guild_id === g.id) {
        statements.updateUserSelectedGuild.run(getFirstAccessibleGuildId(req.user.id), req.user.id)
      }
    })
    transaction()
    scheduleBackup('guild-leave')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/invites', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildOwner(req.user.id, req.params.guildId)
    if (req.body.expiresInHours <= 0) throw createHttpError(400, 'Choose a valid invite expiration time.')
    const code = crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')
    const singleUse = req.body.singleUse === false ? 0 : 1
    statements.createGuildInvite.run({ guildId: g.id, codeHash: hashSessionToken(code), createdByUserId: req.user.id, singleUse, expiresAt: null })
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.invite_create', entityType: 'guild_invite', entityId: g.id, details: { guildId: g.id, singleUse: Boolean(singleUse) } })
    scheduleBackup('guild-invite-create')
    res.status(201).json({ code, singleUse: Boolean(singleUse) })
  } catch (err) { next(err) }
})

app.post('/api/invites/redeem', requireAuth, (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase()
    const invite = statements.findGuildInviteByCodeHash.get(hashSessionToken(code), new Date().toISOString())
    if (!invite) throw createHttpError(404, 'That invite code is not valid anymore. It may be incorrect, expired, or already used.')

    const transaction = db.transaction(() => {
      statements.createGuildMember.run(invite.guildId, req.user.id, 'viewer')
      statements.updateUserSelectedGuild.run(invite.guildId, req.user.id)
      const user = statements.findUserById.get(req.user.id)
      const existing = statements.findTrackedMemberByName.get(invite.guildId, user.username)
      if (existing && !existing.user_id) statements.linkTrackedMemberToUser.run(user.id, existing.id)
      if (invite.singleUse) statements.deleteGuildInviteById.run(invite.id)
    })
    transaction()

    writeAuditLog({ actorUserId: req.user.id, action: 'guild.invite_redeem', entityType: 'guild_member', entityId: `${invite.guildId}:${req.user.id}`, details: { guildId: invite.guildId } })
    scheduleBackup('guild-invite-redeem')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.get('/api/guilds/:guildId/audit-logs', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildForUser(req.user.id, req.params.guildId)
    const logs = statements.listAuditLogsForGuild.all({ guildId: g.id }).map(l => ({ ...l, details: JSON.parse(l.details) }))
    res.json({ auditLogs: logs })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/entries', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const id = crypto.randomUUID()
    statements.createEntry.run({ id, guildId: g.id, type: req.body.type, amount: req.body.amount, isDonation: req.body.isDonation ? 1 : 0, isDue: req.body.isDue ? 1 : 0, withdrawalCategory: req.body.withdrawalCategory || '', date: req.body.date, user: req.body.user || '', notes: req.body.notes || '' })
    writeAuditLog({ actorUserId: req.user.id, action: 'entry.create', entityType: 'entry', entityId: id, details: { guildId: g.id, type: req.body.type, amount: req.body.amount } })
    scheduleBackup('entry-create')
    res.status(201).json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.delete('/api/guilds/:guildId/entries/:id', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    statements.deleteEntry.run(req.params.id, g.id)
    writeAuditLog({ actorUserId: req.user.id, action: 'entry.delete', entityType: 'entry', entityId: req.params.id, details: { guildId: g.id } })
    scheduleBackup('entry-delete')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.patch('/api/guilds/:guildId/members/:memberUserId', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildOwner(req.user.id, req.params.guildId)
    statements.updateGuildMemberRole.run(req.body.role, g.id, Number(req.params.memberUserId))
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.member_role_update', entityType: 'guild_member', entityId: `${g.id}:${req.params.memberUserId}`, details: { guildId: g.id, role: req.body.role } })
    scheduleBackup('guild-member-role-update')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.delete('/api/guilds/:guildId/members/:memberUserId', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildOwner(req.user.id, req.params.guildId)
    statements.deleteGuildMember.run(g.id, Number(req.params.memberUserId))
    writeAuditLog({ actorUserId: req.user.id, action: 'guild.member_remove', entityType: 'guild_member', entityId: `${g.id}:${req.params.memberUserId}`, details: { guildId: g.id } })
    scheduleBackup('guild-member-remove')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/tracked-members', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const name = sanitizeText(req.body.name, 80)
    if (!name) throw createHttpError(400, 'Enter a member name before saving them to the guild roster.')
    const id = crypto.randomUUID()
    statements.createTrackedMember.run({ id, guildId: g.id, userId: null, rankId: req.body.rankId || null, name, duesAmount: Number(req.body.duesAmount) || 0, duePeriod: req.body.duePeriod || 'monthly', duesDay: 1, useDefaultDues: req.body.useDefaultDues === false ? 0 : 1, duesExempt: req.body.duesExempt ? 1 : 0, isActive: req.body.isActive === false ? 0 : 1, lastActiveAt: null })
    writeAuditLog({ actorUserId: req.user.id, action: 'tracked_member.create', entityType: 'tracked_member', entityId: id, details: { guildId: g.id, name } })
    scheduleBackup('tracked-member-create')
    res.status(201).json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.patch('/api/guilds/:guildId/tracked-members/:id', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const m = statements.findTrackedMemberForGuild.get(req.params.id, g.id)
    if (!m) throw createHttpError(404, 'That tracked member could not be found. Refresh the page and try again.')
    statements.updateTrackedMember.run({ id: m.id, guildId: g.id, name: req.body.name || m.name, userId: m.userId, rankId: req.body.rankId !== undefined ? req.body.rankId : m.rankId, duesAmount: req.body.duesAmount !== undefined ? Number(req.body.duesAmount) : m.duesAmount, duePeriod: req.body.duePeriod || m.duePeriod, duesDay: 1, useDefaultDues: req.body.useDefaultDues === false ? 0 : (req.body.useDefaultDues === true ? 1 : m.useDefaultDues), duesExempt: req.body.duesExempt === false ? 0 : (req.body.duesExempt === true ? 1 : m.duesExempt), isActive: req.body.isActive === false ? 0 : (req.body.isActive === true ? 1 : m.isActive), lastActiveAt: m.lastActiveAt })
    writeAuditLog({ actorUserId: req.user.id, action: 'tracked_member.update', entityType: 'tracked_member', entityId: m.id, details: { guildId: g.id, name: req.body.name || m.name } })
    scheduleBackup('tracked-member-update')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.delete('/api/guilds/:guildId/tracked-members/:id', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const m = statements.findTrackedMemberForGuild.get(req.params.id, g.id)
    if (!m) throw createHttpError(404, 'That tracked member could not be found. Refresh the page and try again.')
    statements.deleteTrackedMember.run(req.params.id, g.id)
    writeAuditLog({ actorUserId: req.user.id, action: 'tracked_member.delete', entityType: 'tracked_member', entityId: req.params.id, details: { guildId: g.id, name: m.name } })
    scheduleBackup('tracked-member-delete')
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/ranks', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildOwner(req.user.id, req.params.guildId)
    const id = crypto.randomUUID()
    statements.createRank.run({ id, guildId: g.id, name: sanitizeText(req.body.name, 80), weight: Number(req.body.weight) || 0, permissions: JSON.stringify(req.body.permissions || {}) })
    writeAuditLog({ actorUserId: req.user.id, action: 'rank.create', entityType: 'rank', entityId: id, details: { guildId: g.id, name: req.body.name } })
    scheduleBackup('rank-create')
    res.status(201).json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/tracked-members/:memberId/characters', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const m = statements.findTrackedMemberForGuild.get(req.params.memberId, g.id)
    if (!m) throw createHttpError(404, 'Member not found.')
    if (req.body.isPrimary) statements.clearPrimaryCharactersForMember.run(m.id)
    const id = crypto.randomUUID()
    statements.createCharacter.run({ id, trackedMemberId: m.id, name: sanitizeText(req.body.name, 80), class: sanitizeText(req.body.class, 40), role: sanitizeText(req.body.role, 40), level: Number(req.body.level) || 50, isPrimary: req.body.isPrimary ? 1 : 0 })
    statements.updateTrackedMember.run({ id: m.id, guildId: g.id, name: m.name, userId: m.userId, rankId: m.rankId, duesAmount: m.duesAmount, duePeriod: m.duePeriod, duesDay: 1, useDefaultDues: m.useDefaultDues, duesExempt: m.duesExempt, isActive: m.isActive, lastActiveAt: new Date().toISOString() })
    writeAuditLog({ actorUserId: req.user.id, action: 'character.create', entityType: 'character', entityId: id, details: { guildId: g.id, memberId: m.id, name: req.body.name } })
    scheduleBackup('character-create')
    res.status(201).json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/select', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildForUser(req.user.id, req.params.guildId)
    statements.updateUserSelectedGuild.run(g.id, req.user.id)
    res.json({ user: serializeUser(req.user.id) })
  } catch (err) { next(err) }
})

if (isProduction) {
  const distDirectory = path.join(projectRoot, 'dist')
  if (fs.existsSync(distDirectory)) {
    app.use(express.static(distDirectory))
    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(path.join(distDirectory, 'index.html'))
    })
  }
}

app.get('/api/recruitment/discover', (request, response, next) => {
  try {
    const guilds = statements.listPublicGuilds.all()
    response.json({ guilds })
  } catch (error) {
    next(error)
  }
})

app.get('/api/guilds/:guildId/recruitment', (request, response, next) => {
  try {
    const settings = statements.findRecruitmentSettings.get(request.params.guildId)
    if (!settings) {
      throw createHttpError(404, 'Recruitment settings for this guild were not found.')
    }

    const userId = getAuthenticatedUser(request)?.id
    const isMember = userId ? Boolean(statements.findGuildMember.get(request.params.guildId, userId)) : false

    if (!settings.isPublic && !isMember) {
      throw createHttpError(403, 'This guild is not currently recruiting publicly.')
    }

    response.json({
      ...settings,
      isPublic: Boolean(settings.isPublic),
      requirements: JSON.parse(settings.requirements),
      applicationQuestions: JSON.parse(settings.applicationQuestions),
    })
  } catch (error) {
    next(error)
  }
})

function sanitizeRecruitmentSettings(payload) {
  return {
    isPublic: payload?.isPublic ? 1 : 0,
    description: sanitizeText(payload?.description, 2000),
    focus: sanitizeText(payload?.focus, 50) || 'PvE',
    activityTimes: sanitizeText(payload?.activityTimes, 200),
    requirements: JSON.stringify(Array.isArray(payload?.requirements) ? payload.requirements : []),
    applicationQuestions: JSON.stringify(
      Array.isArray(payload?.applicationQuestions) ? payload.applicationQuestions : [],
    ),
  }
}

app.patch('/api/guilds/:guildId/recruitment', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const settings = sanitizeRecruitmentSettings(request.body)

    statements.updateRecruitmentSettings.run({
      guildId: guild.id,
      ...settings,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'guild.recruitment_update',
      entityType: 'guild',
      entityId: guild.id,
      details: settings,
    })

    scheduleBackup('recruitment-update')
    response.json({ message: 'Recruitment settings updated.' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/applications', requireAuth, (request, response, next) => {
  try {
    const guildId = request.params.guildId
    const settings = statements.findRecruitmentSettings.get(guildId)
    if (!settings || !settings.isPublic) {
      throw createHttpError(403, 'This guild is not currently accepting public applications.')
    }

    const answers = Array.isArray(request.body?.answers) ? request.body.answers : []
    const applicationId = crypto.randomUUID()

    statements.createApplication.run({
      id: applicationId,
      guildId,
      applicantUserId: request.user.id,
      status: 'pending',
      answers: JSON.stringify(answers),
      reviewerNotes: '',
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'guild.application_submit',
      entityType: 'application',
      entityId: applicationId,
      details: { guildId },
    })

    webhookEmitter.emit('event', {
      guildId,
      eventType: 'application_submitted',
      data: {
        applicantUsername: request.user.username,
      }
    })

    scheduleBackup('application-submit')
    response.status(201).json({ id: applicationId, message: 'Application submitted successfully.' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/guilds/:guildId/applications', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const applications = statements.listApplicationsForGuild.all(guild.id).map((app) => ({
      ...app,
      answers: JSON.parse(app.answers),
    }))

    response.json({ applications })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId/applications/:applicationId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const application = statements.findApplicationById.get(request.params.applicationId)

    if (!application || application.guildId !== guild.id) {
      throw createHttpError(404, 'Application not found.')
    }

    const status = sanitizeText(request.body?.status, 20)
    const reviewerNotes = sanitizeText(request.body?.reviewerNotes, 1000)

    statements.updateApplication.run({
      id: application.id,
      guildId: guild.id,
      status,
      reviewerNotes,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'guild.application_review',
      entityType: 'application',
      entityId: application.id,
      details: { guildId: guild.id, status },
    })

    if (status === 'accepted') {
       statements.createGuildMember.run(guild.id, application.applicantUserId, 'viewer')
       const applicant = statements.findUserById.get(application.applicantUserId)
       if (applicant) {
         statements.createTrackedMember.run({
           id: crypto.randomUUID(),
           guildId: guild.id,
           userId: applicant.id,
           rankId: null,
           name: applicant.username,
           duesAmount: 0,
           duePeriod: 'monthly',
           duesDay: 1,
           useDefaultDues: 1,
           duesExempt: 0,
           isActive: 1,
           lastActiveAt: null,
         })
       }
       writeAuditLog({
         actorUserId: request.user.id,
         action: 'guild.member_add_via_application',
         entityType: 'guild_member',
         entityId: `${guild.id}:${application.applicantUserId}`,
         details: { guildId: guild.id, applicationId: application.id },
       })

       webhookEmitter.emit('event', {
         guildId: guild.id,
         eventType: 'application_approved',
         data: {
           applicantUsername: applicant.username,
         }
       })
    }

    scheduleBackup('application-review')
    response.json({ message: `Application ${status}.`, user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/my-applications', requireAuth, (request, response, next) => {
  try {
    const applications = statements.listApplicationsForUser.all(request.user.id).map((app) => ({
      ...app,
      answers: JSON.parse(app.answers),
    }))

    response.json({ applications })
  } catch (error) {
    next(error)
  }
})

app.get('/api/guilds/:guildId/webhooks', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const webhooks = statements.listWebhooksForGuild.all(g.id).map(w => ({ ...w, eventTypes: JSON.parse(w.event_types) }))
    res.json({ webhooks })
  } catch (err) { next(err) }
})

app.post('/api/guilds/:guildId/webhooks', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    const id = crypto.randomUUID()
    statements.createWebhook.run({
      id,
      guildId: g.id,
      url: req.body.url,
      eventTypes: JSON.stringify(req.body.eventTypes || []),
      channelName: sanitizeText(req.body.channelName, 100)
    })
    writeAuditLog({ actorUserId: req.user.id, action: 'webhook.create', entityType: 'webhook', entityId: id, details: { guildId: g.id, channelName: req.body.channelName } })
    res.status(201).json({ id, message: 'Webhook added.' })
  } catch (err) { next(err) }
})

app.patch('/api/guilds/:guildId/webhooks/:webhookId', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    statements.updateWebhook.run({
      id: req.params.webhookId,
      guildId: g.id,
      url: req.body.url,
      eventTypes: JSON.stringify(req.body.eventTypes || []),
      channelName: sanitizeText(req.body.channelName, 100)
    })
    writeAuditLog({ actorUserId: req.user.id, action: 'webhook.update', entityType: 'webhook', entityId: req.params.webhookId, details: { guildId: g.id } })
    res.json({ message: 'Webhook updated.' })
  } catch (err) { next(err) }
})

app.delete('/api/guilds/:guildId/webhooks/:webhookId', requireAuth, (req, res, next) => {
  try {
    const g = ensureGuildEditor(req.user.id, req.params.guildId)
    statements.deleteWebhook.run(req.params.webhookId, g.id)
    writeAuditLog({ actorUserId: req.user.id, action: 'webhook.delete', entityType: 'webhook', entityId: req.params.webhookId, details: { guildId: g.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

app.post('/api/auth/email-verification/resend', requireAuth, async (req, res, next) => {
  try {
    ensureTransactionalEmailAvailable()
    const user = statements.findUserById.get(req.user.id)
    if (!user?.email) throw createHttpError(400, 'Add a recovery email before requesting a verification message.')
    if (user.email_verified_at) return res.json({ message: 'Your recovery email is already verified.' })
    await issueEmailVerification(user)
    res.json({ message: 'A fresh verification email has been sent.' })
  } catch (err) { next(err) }
})

app.patch('/api/account/email', requireAuth, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim()
    validateEmail(email)
    const existing = statements.findUserByEmail.get(email)
    if (existing && existing.id !== req.user.id) throw createHttpError(409, 'That recovery email is already attached to another account.')
    const transaction = db.transaction(() => {
      statements.updateUserEmail.run(email, req.user.id)
      writeAuditLog({ actorUserId: req.user.id, action: 'auth.email_update', entityType: 'user', entityId: req.user.id, details: { email } })
    })
    transaction()
    const updatedUser = statements.findUserById.get(req.user.id)
    await issueEmailVerification(updatedUser)
    scheduleBackup('account-email-update')
    res.json({ user: serializeUser(req.user.id), message: 'Recovery email updated. Check your inbox to verify it.' })
  } catch (err) { next(err) }
})

app.use((err, _req, res, _next) => {
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Internal server error.' : err.message })
})

app.listen(port, () => console.log(`ESO Guild Bank API listening on http://localhost:${port}`))
