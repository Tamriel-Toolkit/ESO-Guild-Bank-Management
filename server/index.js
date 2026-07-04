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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const dataDirectory = path.join(projectRoot, 'data')
const dbPath = process.env.DATABASE_FILE
  ? path.resolve(projectRoot, process.env.DATABASE_FILE)
  : path.join(dataDirectory, 'guild-bank.db')
const backupsDirectory = path.join(path.dirname(dbPath), 'backups')
const port = Number(process.env.PORT) || 3001
const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'eso_guild_bank_session'
const publicAppUrl = String(process.env.PUBLIC_APP_URL || 'https://www.esoguildgoldledger.com').replace(/\/$/, '')
const sessionTtlDays = Number(process.env.SESSION_TTL_DAYS) || 14
const sessionTtlMs = sessionTtlDays * 24 * 60 * 60 * 1000
const emailVerificationTokenTtlMs = (Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS) || 24) * 60 * 60 * 1000
const passwordResetTokenTtlMs = (Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 60) * 60 * 1000
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT) || 300
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT) || 10
const backupRetentionCount = Number(process.env.BACKUP_RETENTION_COUNT) || 20
const backupMinIntervalMs = Number(process.env.BACKUP_MIN_INTERVAL_MS) || 5 * 60 * 1000
const isProduction = process.env.NODE_ENV === 'production'
const guildRoles = new Set(['viewer', 'admin', 'owner'])
const entryTypes = new Set(['deposit', 'withdrawal', 'salesTax'])
const withdrawalCategories = new Set(['traderBid', 'heraldry', 'other'])
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
const mailCaptureDirectory = process.env.MAIL_CAPTURE_DIRECTORY
  ? path.resolve(projectRoot, process.env.MAIL_CAPTURE_DIRECTORY)
  : ''

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
fs.mkdirSync(backupsDirectory, { recursive: true })
if (mailCaptureDirectory) {
  fs.mkdirSync(mailCaptureDirectory, { recursive: true })
}

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
    FOREIGN KEY (rank_id) REFERENCES guild_ranks (id) ON DELETE SET NULL
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
`)

db.prepare(
  `INSERT OR IGNORE INTO guild_members (guild_id, user_id)
   SELECT id, user_id FROM guilds`,
).run()

const guildInviteColumns = db.prepare('PRAGMA table_info(guild_invites)').all()
const userColumns = db.prepare('PRAGMA table_info(users)').all()
const guildColumns = db.prepare('PRAGMA table_info(guilds)').all()
const entryColumns = db.prepare('PRAGMA table_info(entries)').all()
const trackedMemberColumns = db.prepare('PRAGMA table_info(tracked_members)').all()
const guildMemberColumns = db.prepare('PRAGMA table_info(guild_members)').all()
if (!guildInviteColumns.some((column) => column.name === 'single_use')) {
  db.exec('ALTER TABLE guild_invites ADD COLUMN single_use INTEGER NOT NULL DEFAULT 1')
}
if (!guildInviteColumns.some((column) => column.name === 'expires_at')) {
  db.exec('ALTER TABLE guild_invites ADD COLUMN expires_at TEXT')
}
if (!userColumns.some((column) => column.name === 'email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT')
}
if (!userColumns.some((column) => column.name === 'email_verified_at')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT')
}
if (!guildColumns.some((column) => column.name === 'due_scheme')) {
  db.exec("ALTER TABLE guilds ADD COLUMN due_scheme TEXT NOT NULL DEFAULT 'monthly'")
}
if (!guildColumns.some((column) => column.name === 'default_dues_amount')) {
  db.exec('ALTER TABLE guilds ADD COLUMN default_dues_amount INTEGER NOT NULL DEFAULT 0')
}
if (!entryColumns.some((column) => column.name === 'is_donation')) {
  db.exec('ALTER TABLE entries ADD COLUMN is_donation INTEGER NOT NULL DEFAULT 0')
}
if (!entryColumns.some((column) => column.name === 'is_due')) {
  db.exec('ALTER TABLE entries ADD COLUMN is_due INTEGER NOT NULL DEFAULT 0')
}
if (!entryColumns.some((column) => column.name === 'withdrawal_category')) {
  db.exec("ALTER TABLE entries ADD COLUMN withdrawal_category TEXT NOT NULL DEFAULT ''")
}
if (!trackedMemberColumns.some((column) => column.name === 'dues_amount')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN dues_amount INTEGER NOT NULL DEFAULT 0')
}
if (!trackedMemberColumns.some((column) => column.name === 'due_period')) {
  db.exec("ALTER TABLE tracked_members ADD COLUMN due_period TEXT NOT NULL DEFAULT 'monthly'")
}
if (!trackedMemberColumns.some((column) => column.name === 'dues_day')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN dues_day INTEGER NOT NULL DEFAULT 1')
}
if (!trackedMemberColumns.some((column) => column.name === 'uses_default_dues')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN uses_default_dues INTEGER NOT NULL DEFAULT 1')
  db.exec('UPDATE tracked_members SET uses_default_dues = 0 WHERE dues_amount > 0')
}
if (!trackedMemberColumns.some((column) => column.name === 'is_active')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')
}
if (!trackedMemberColumns.some((column) => column.name === 'dues_exempt')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN dues_exempt INTEGER NOT NULL DEFAULT 0')
}
if (!trackedMemberColumns.some((column) => column.name === 'rank_id')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN rank_id TEXT REFERENCES guild_ranks(id) ON DELETE SET NULL')
}
if (!trackedMemberColumns.some((column) => column.name === 'user_id')) {
  db.exec('ALTER TABLE tracked_members ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL')
}
if (!guildMemberColumns.some((column) => column.name === 'role')) {
  db.exec("ALTER TABLE guild_members ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'")
}
db.exec(`
  UPDATE guild_members
  SET role = CASE
    WHEN user_id = (SELECT guilds.user_id FROM guilds WHERE guilds.id = guild_members.guild_id) THEN 'owner'
    WHEN role IS NULL OR role = '' OR role = 'viewer' THEN 'admin'
    ELSE role
  END
`)
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL')

db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString())
db.prepare('DELETE FROM email_verification_tokens WHERE expires_at <= ?').run(new Date().toISOString())
db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ?').run(new Date().toISOString())

const statements = {
  createUser: db.prepare(
    `INSERT INTO users (username, email, email_verified_at, password_hash, password_salt, selected_guild_id)
     VALUES (@username, @email, NULL, @passwordHash, @passwordSalt, NULL)`,
  ),
  findUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  deleteUserById: db.prepare('DELETE FROM users WHERE id = ?'),
  updateUserEmail: db.prepare('UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?'),
  markUserEmailVerified: db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?'),
  updateUserPassword: db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'),
  updateUserSelectedGuild: db.prepare('UPDATE users SET selected_guild_id = ? WHERE id = ?'),
  createSession: db.prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES (@userId, @tokenHash, @expiresAt)`,
  ),
  findSessionUserByTokenHash: db.prepare(
    `SELECT sessions.token_hash, sessions.expires_at, users.*
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  ),
  deleteSessionByTokenHash: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  deleteSessionsByUserId: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  createEmailVerificationToken: db.prepare(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES (@userId, @tokenHash, @expiresAt)`,
  ),
  findEmailVerificationTokenByHash: db.prepare(
    `SELECT email_verification_tokens.id,
            email_verification_tokens.user_id AS userId,
            users.email,
            users.username
     FROM email_verification_tokens
     JOIN users ON users.id = email_verification_tokens.user_id
     WHERE email_verification_tokens.token_hash = ?
       AND email_verification_tokens.used_at IS NULL
       AND email_verification_tokens.expires_at > ?`,
  ),
  consumeEmailVerificationToken: db.prepare(
    'UPDATE email_verification_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL',
  ),
  deleteEmailVerificationTokensForUser: db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?'),
  createPasswordResetToken: db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (@userId, @tokenHash, @expiresAt)`,
  ),
  findPasswordResetTokenByHash: db.prepare(
    `SELECT password_reset_tokens.id,
            password_reset_tokens.user_id AS userId,
            users.email,
            users.username
     FROM password_reset_tokens
     JOIN users ON users.id = password_reset_tokens.user_id
     WHERE password_reset_tokens.token_hash = ?
       AND password_reset_tokens.used_at IS NULL
       AND password_reset_tokens.expires_at > ?`,
  ),
  consumePasswordResetToken: db.prepare(
    'UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL',
  ),
  deletePasswordResetTokensForUser: db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?'),
  listGuildsForUser: db.prepare(
    `SELECT guilds.id,
            guilds.name,
            guilds.week_start_date AS weekStartDate,
            guilds.due_scheme AS dueScheme,
            guilds.default_dues_amount AS defaultDuesAmount,
            guilds.created_at AS createdAt,
            guilds.user_id AS ownerUserId,
            owners.username AS ownerUsername,
            guild_members.role AS membershipRole
     FROM guilds
     JOIN guild_members ON guild_members.guild_id = guilds.id
     JOIN users AS owners ON owners.id = guilds.user_id
     WHERE guild_members.user_id = ?
     ORDER BY guilds.created_at ASC, guilds.id ASC`,
  ),
  findFirstGuildForUser: db.prepare(
    `SELECT guilds.id
     FROM guilds
     JOIN guild_members ON guild_members.guild_id = guilds.id
     WHERE guild_members.user_id = ?
     ORDER BY guilds.created_at ASC, guilds.id ASC
     LIMIT 1`,
  ),
  listEntriesForGuild: db.prepare(
    `SELECT id, type, amount, is_donation AS isDonation, is_due AS isDue, withdrawal_category AS withdrawalCategory, date, user_name AS user, notes, created_at AS createdAt
     FROM entries
     WHERE guild_id = ?
     ORDER BY date DESC, created_at DESC, id DESC`,
  ),
  listGuildMembersForGuild: db.prepare(
    `SELECT users.id AS userId,
            users.username,
            guild_members.role AS role,
            CASE WHEN users.id = guilds.user_id THEN 1 ELSE 0 END AS isOwner
     FROM guild_members
     JOIN users ON users.id = guild_members.user_id
     JOIN guilds ON guilds.id = guild_members.guild_id
     WHERE guild_members.guild_id = ?
     ORDER BY isOwner DESC, users.username ASC`,
  ),
  listTrackedMembersForGuild: db.prepare(
    `SELECT id,
            guild_id AS guildId,
            user_id AS userId,
            rank_id AS rankId,
            name,
            dues_amount AS duesAmount,
            due_period AS duePeriod,
            dues_day AS duesDay,
            uses_default_dues AS useDefaultDues,
            dues_exempt AS duesExempt,
            is_active AS isActive,
            last_active_at AS lastActiveAt,
            created_at AS createdAt
     FROM tracked_members
     WHERE guild_id = ?
     ORDER BY is_active DESC, LOWER(name) ASC, created_at ASC, id ASC`,
  ),
  findGuildForUser: db.prepare(
    `SELECT guilds.id,
            guilds.user_id AS ownerUserId,
            guilds.name,
            guilds.week_start_date AS weekStartDate,
            guilds.due_scheme AS dueScheme,
            guilds.default_dues_amount AS defaultDuesAmount,
            guild_members.role AS membershipRole
     FROM guilds
     JOIN guild_members ON guild_members.guild_id = guilds.id
     WHERE guilds.id = ? AND guild_members.user_id = ?`,
  ),
  createGuild: db.prepare(
     `INSERT INTO guilds (id, user_id, name, week_start_date, due_scheme, default_dues_amount)
      VALUES (@id, @userId, @name, @weekStartDate, @dueScheme, @defaultDuesAmount)`,
  ),
  createGuildMember: db.prepare(
    `INSERT OR IGNORE INTO guild_members (guild_id, user_id, role)
     VALUES (?, ?, ?)`,
  ),
  findGuildMember: db.prepare(
    `SELECT guild_id AS guildId, user_id AS userId, role
     FROM guild_members
     WHERE guild_id = ? AND user_id = ?`,
  ),
  updateGuildMemberRole: db.prepare(
    `UPDATE guild_members
     SET role = ?
     WHERE guild_id = ? AND user_id = ?`,
  ),
  findTrackedMemberForGuild: db.prepare(
    `SELECT id,
            guild_id AS guildId,
            user_id AS userId,
            rank_id AS rankId,
            name,
            dues_amount AS duesAmount,
            due_period AS duePeriod,
            dues_day AS duesDay,
            uses_default_dues AS useDefaultDues,
            dues_exempt AS duesExempt,
            is_active AS isActive,
            last_active_at AS lastActiveAt
     FROM tracked_members
     WHERE id = ? AND guild_id = ?`,
  ),
  deleteGuildMember: db.prepare(
    `DELETE FROM guild_members
     WHERE guild_id = ? AND user_id = ?`,
  ),
  createTrackedMember: db.prepare(
    `INSERT INTO tracked_members (id, guild_id, user_id, rank_id, name, dues_amount, due_period, dues_day, uses_default_dues, dues_exempt, is_active, last_active_at)
     VALUES (@id, @guildId, @userId, @rankId, @name, @duesAmount, @duePeriod, @duesDay, @useDefaultDues, @duesExempt, @isActive, @lastActiveAt)`,
  ),
  updateTrackedMember: db.prepare(
    `UPDATE tracked_members
     SET name = @name,
         user_id = @userId,
         rank_id = @rankId,
         dues_amount = @duesAmount,
         due_period = @duePeriod,
         dues_day = @duesDay,
         uses_default_dues = @useDefaultDues,
         dues_exempt = @duesExempt,
         is_active = @isActive,
         last_active_at = @lastActiveAt
     WHERE id = @id AND guild_id = @guildId`,
  ),
  deleteTrackedMember: db.prepare('DELETE FROM tracked_members WHERE id = ? AND guild_id = ?'),
  renameGuild: db.prepare('UPDATE guilds SET name = ? WHERE id = ? AND user_id = ?'),
  updateGuildDueScheme: db.prepare('UPDATE guilds SET due_scheme = ? WHERE id = ? AND user_id = ?'),
  updateGuildDefaultDuesAmount: db.prepare(
    'UPDATE guilds SET default_dues_amount = ? WHERE id = ? AND user_id = ?',
  ),
  resetTrackedMembersToDefaultForGuild: db.prepare(
    'UPDATE tracked_members SET uses_default_dues = 1, dues_amount = 0 WHERE guild_id = ?',
  ),
  updateGuildWeekStartDate: db.prepare(
    'UPDATE guilds SET week_start_date = ? WHERE id = ? AND user_id = ?',
  ),
  deleteGuild: db.prepare('DELETE FROM guilds WHERE id = ? AND user_id = ?'),
  createGuildInvite: db.prepare(
    `INSERT INTO guild_invites (guild_id, code_hash, created_by_user_id, single_use, expires_at)
     VALUES (@guildId, @codeHash, @createdByUserId, @singleUse, @expiresAt)`,
  ),
  findGuildInviteByCodeHash: db.prepare(
    `SELECT guild_invites.id,
            guild_invites.guild_id AS guildId,
            guilds.user_id AS ownerUserId,
            guild_invites.single_use AS singleUse,
            guild_invites.expires_at AS expiresAt
     FROM guild_invites
     JOIN guilds ON guilds.id = guild_invites.guild_id
     WHERE guild_invites.code_hash = ?
       AND (guild_invites.expires_at IS NULL OR guild_invites.expires_at > ?)`,
  ),
  deleteGuildInviteById: db.prepare('DELETE FROM guild_invites WHERE id = ?'),
  deleteExpiredGuildInvites: db.prepare(
    'DELETE FROM guild_invites WHERE expires_at IS NOT NULL AND expires_at <= ?',
  ),
  createAuditLog: db.prepare(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
     VALUES (@actorUserId, @action, @entityType, @entityId, @details)`,
  ),
    listAuditLogsForGuild: db.prepare(
     `SELECT audit_logs.id,
          audit_logs.action,
          audit_logs.entity_type AS entityType,
          audit_logs.entity_id AS entityId,
          audit_logs.details,
          audit_logs.created_at AS createdAt,
          users.username AS actorUsername
      FROM audit_logs
      LEFT JOIN users ON users.id = audit_logs.actor_user_id
      WHERE (audit_logs.entity_type = 'guild' AND audit_logs.entity_id = @guildId)
        OR json_extract(audit_logs.details, '$.guildId') = @guildId
      ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
      LIMIT 200`,
    ),
  createEntry: db.prepare(
    `INSERT INTO entries (id, guild_id, type, amount, is_donation, is_due, withdrawal_category, date, user_name, notes)
     VALUES (@id, @guildId, @type, @amount, @isDonation, @isDue, @withdrawalCategory, @date, @user, @notes)`,
  ),
  findEntryForGuild: db.prepare(
    `SELECT id, guild_id AS guildId, type, amount, is_donation AS isDonation, is_due AS isDue, withdrawal_category AS withdrawalCategory, date, user_name AS user, notes
     FROM entries
     WHERE id = ? AND guild_id = ?`,
  ),
  updateEntry: db.prepare(
    `UPDATE entries
     SET type = @type,
         amount = @amount,
         is_donation = @isDonation,
         is_due = @isDue,
         withdrawal_category = @withdrawalCategory,
         date = @date,
         user_name = @user,
         notes = @notes
     WHERE id = @id AND guild_id = @guildId`,
  ),
  deleteEntry: db.prepare('DELETE FROM entries WHERE id = ? AND guild_id = ?'),
  listRanksForGuild: db.prepare(
    'SELECT id, guild_id AS guildId, name, weight, permissions FROM guild_ranks WHERE guild_id = ? ORDER BY weight ASC, name ASC',
  ),
  createRank: db.prepare(
    'INSERT INTO guild_ranks (id, guild_id, name, weight, permissions) VALUES (@id, @guildId, @name, @weight, @permissions)',
  ),
  updateRank: db.prepare(
    'UPDATE guild_ranks SET name = @name, weight = @weight, permissions = @permissions WHERE id = @id AND guild_id = @guildId',
  ),
  deleteRank: db.prepare('DELETE FROM guild_ranks WHERE id = ? AND guild_id = ?'),
  listCharactersForMember: db.prepare(
    'SELECT id, tracked_member_id AS trackedMemberId, name, class, role, level, is_primary AS isPrimary FROM characters WHERE tracked_member_id = ? ORDER BY is_primary DESC, name ASC',
  ),
  createCharacter: db.prepare(
    'INSERT INTO characters (id, tracked_member_id, name, class, role, level, is_primary) VALUES (@id, @trackedMemberId, @name, @class, @role, @level, @isPrimary)',
  ),
  clearPrimaryCharactersForMember: db.prepare(
    'UPDATE characters SET is_primary = 0 WHERE tracked_member_id = ?',
  ),
  updateCharacter: db.prepare(
    'UPDATE characters SET name = @name, class = @class, role = @role, level = @level, is_primary = @isPrimary WHERE id = @id AND tracked_member_id = @trackedMemberId',
  ),
  deleteCharacter: db.prepare('DELETE FROM characters WHERE id = ? AND tracked_member_id = ?'),
  findTrackedMemberByName: db.prepare(
    'SELECT * FROM tracked_members WHERE guild_id = ? AND LOWER(name) = LOWER(?)',
  ),
  linkTrackedMemberToUser: db.prepare(
    'UPDATE tracked_members SET user_id = ? WHERE id = ?',
  ),
  updateTrackedMemberActivity: db.prepare(
    'UPDATE tracked_members SET last_active_at = ? WHERE user_id = ?',
  ),
}

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', isProduction ? 1 : false)
app.use(
  helmet({
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
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/healthz', (_request, response) => {
  response.json({
    ok: true,
    service: 'eso-guild-gold-ledger',
    publicAppUrl,
    timestamp: new Date().toISOString(),
  })
})

function createHttpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function isSafeHttpMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase())
}

function getExpectedOrigin(request) {
  return `${request.protocol}://${request.get('host')}`
}

function isLoopbackHostname(hostname) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(hostname || '').toLowerCase())
}

function hasTrustedOriginMatch(originValue, expectedOrigin) {
  if (originValue === expectedOrigin) {
    return true
  }

  try {
    const parsedOrigin = new URL(originValue)
    const parsedExpectedOrigin = new URL(expectedOrigin)

    if (
      !isProduction &&
      parsedOrigin.protocol === parsedExpectedOrigin.protocol &&
      isLoopbackHostname(parsedOrigin.hostname) &&
      isLoopbackHostname(parsedExpectedOrigin.hostname)
    ) {
      return true
    }
  } catch {
    return false
  }

  return false
}

function hasTrustedRequestOrigin(request) {
  const expectedOrigin = getExpectedOrigin(request)
  const origin = request.get('origin')
  const referer = request.get('referer')
  const fetchSite = request.get('sec-fetch-site')

  if (origin) {
    return hasTrustedOriginMatch(origin, expectedOrigin)
  }

  if (referer) {
    return hasTrustedOriginMatch(referer, expectedOrigin) || referer.startsWith(`${expectedOrigin}/`)
  }

  return fetchSite === 'same-origin' || fetchSite === 'same-site' || !fetchSite
}

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: apiRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, _response, next) => {
    next(createHttpError(429, 'Too many requests were sent in a short time. Please wait a moment and try again.'))
  },
})

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, _response, next) => {
    next(createHttpError(429, 'Too many sign-in or account creation attempts were made. Please wait a few minutes and try again.'))
  },
})

function requireBasicCsrfProtection(request, _response, next) {
  if (!request.path.startsWith('/api') || isSafeHttpMethod(request.method)) {
    next()
    return
  }

  if (request.get('x-requested-with') !== 'XMLHttpRequest') {
    next(createHttpError(403, 'This request is missing a required security header. Refresh the page and try again.'))
    return
  }

  if (!hasTrustedRequestOrigin(request)) {
    next(createHttpError(403, 'This request came from an untrusted origin. Open the app directly and try again.'))
    return
  }

  next()
}

app.use('/api/auth', authRateLimiter)
app.use('/api', apiRateLimiter)
app.use(requireBasicCsrfProtection)

let backupScheduled = false
let backupPromise = Promise.resolve()
let lastBackupAt = 0
let pendingBackupReason = 'mutation'

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function sanitizeBackupReason(reason) {
  return String(reason || 'mutation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mutation'
}

function writeAuditLog({ actorUserId = null, action, entityType, entityId = null, details = {} }) {
  statements.createAuditLog.run({
    actorUserId,
    action,
    entityType,
    entityId: entityId == null ? null : String(entityId),
    details: JSON.stringify(details),
  })
}

function parseAuditLogDetails(rawDetails) {
  try {
    return rawDetails ? JSON.parse(rawDetails) : {}
  } catch {
    return {}
  }
}

function serializeAuditLog(row) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorUsername: row.actorUsername || 'System',
    createdAt: row.createdAt,
    details: parseAuditLogDetails(row.details),
  }
}

function pruneOldBackups() {
  const backupFiles = fs
    .readdirSync(backupsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.db'))
    .map((entry) => entry.name)
    .sort()

  while (backupFiles.length > backupRetentionCount) {
    const oldestBackup = backupFiles.shift()
    fs.rmSync(path.join(backupsDirectory, oldestBackup), { force: true })
  }
}

function scheduleBackup(reason) {
  pendingBackupReason = sanitizeBackupReason(reason)
  if (backupScheduled) {
    return
  }

  backupScheduled = true
  const delay = Math.max(0, backupMinIntervalMs - (Date.now() - lastBackupAt))

  setTimeout(() => {
    backupScheduled = false
    const backupReason = pendingBackupReason

    backupPromise = backupPromise
      .catch(() => {})
      .then(async () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupFilePath = path.join(backupsDirectory, `${timestamp}-${backupReason}.db`)
        await db.backup(backupFilePath)
        lastBackupAt = Date.now()
        pruneOldBackups()
      })
      .catch((error) => {
        console.error('Database backup failed:', error)
      })
  }, delay)
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function sanitizeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10) {
    throw createHttpError(400, 'Your password must be at least 10 characters long.')
  }
}

function validateUsername(username) {
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    throw createHttpError(
      400,
      'Your username must be 3-30 characters and can only use lowercase letters, numbers, underscores, or hyphens.',
    )
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { passwordHash, passwordSalt: salt }
}

function verifyPassword(password, user) {
  const suppliedHash = crypto.scryptSync(password, user.password_salt, 64)
  const storedHash = Buffer.from(user.password_hash, 'hex')

  return suppliedHash.length === storedHash.length && crypto.timingSafeEqual(suppliedHash, storedHash)
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createOneTimeToken() {
  return crypto.randomBytes(32).toString('hex')
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) {
    throw createHttpError(400, 'Enter a valid recovery email address.')
  }
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
    const safeCategory = String(category || 'message').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
    const filePath = path.join(
      mailCaptureDirectory,
      `${Date.now()}-${process.pid}-${safeCategory}.json`,
    )
    await fs.promises.writeFile(
      filePath,
      JSON.stringify({ to, subject, text, html, category }, null, 2),
      'utf8',
    )
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

async function issueEmailVerification(user, reason = 'auth.email_verification_sent') {
  const token = createOneTimeToken()
  const expiresAt = new Date(Date.now() + emailVerificationTokenTtlMs).toISOString()

  statements.deleteEmailVerificationTokensForUser.run(user.id)
  statements.createEmailVerificationToken.run({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  })

  const verificationUrl = `${publicAppUrl}/?verify-email=${encodeURIComponent(token)}`
  await deliverTransactionalEmail({
    to: user.email,
    category: 'verify-email',
    subject: 'Verify your recovery email for ESO Guild Gold Ledger',
    text: [
      `Hi ${user.username},`,
      '',
      'Verify this email address to enable password recovery for your ESO Guild Gold Ledger account.',
      '',
      verificationUrl,
      '',
      'If you did not request this, you can ignore this message.',
    ].join('\n'),
    html: `<p>Hi ${user.username},</p><p>Verify this email address to enable password recovery for your ESO Guild Gold Ledger account.</p><p><a href="${verificationUrl}">Verify recovery email</a></p><p>If you did not request this, you can ignore this message.</p>`,
  })

  writeAuditLog({
    actorUserId: user.id,
    action: reason,
    entityType: 'user',
    entityId: user.id,
    details: { email: user.email },
  })
}

async function issuePasswordReset(user) {
  const token = createOneTimeToken()
  const expiresAt = new Date(Date.now() + passwordResetTokenTtlMs).toISOString()

  statements.deletePasswordResetTokensForUser.run(user.id)
  statements.createPasswordResetToken.run({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  })

  const resetUrl = `${publicAppUrl}/?reset-password=${encodeURIComponent(token)}`
  await deliverTransactionalEmail({
    to: user.email,
    category: 'password-reset',
    subject: 'Reset your ESO Guild Gold Ledger password',
    text: [
      `Hi ${user.username},`,
      '',
      'Use the link below to reset your ESO Guild Gold Ledger password.',
      '',
      resetUrl,
      '',
      'If you did not request this, you can ignore this message.',
    ].join('\n'),
    html: `<p>Hi ${user.username},</p><p>Use the link below to reset your ESO Guild Gold Ledger password.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this message.</p>`,
  })

  writeAuditLog({
    actorUserId: user.id,
    action: 'auth.password_reset_requested',
    entityType: 'user',
    entityId: user.id,
    details: { email: user.email },
  })
}

function setSessionCookie(response, token, expiresAt) {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    expires: new Date(expiresAt),
    path: '/',
  })
}

function clearSessionCookie(response) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  })
}

function sanitizeEntryPayload(payload) {
  const type = String(payload?.type || '')
  const amount = Math.round(Number(payload?.amount))
  const date = String(payload?.date || '')
  const user = sanitizeText(payload?.user, 80)
  const notes = sanitizeText(payload?.notes, 500)
  const isDonation = type === 'deposit' && Boolean(payload?.isDonation)
  const isDue = type === 'deposit' && Boolean(payload?.isDue)
  const rawWithdrawalCategory = payload?.withdrawalCategory
  const withdrawalCategory =
    type === 'withdrawal'
      ? rawWithdrawalCategory == null || rawWithdrawalCategory === ''
        ? ''
        : String(rawWithdrawalCategory)
      : ''

  if (!entryTypes.has(type)) {
    throw createHttpError(400, 'Choose a valid entry type before saving.')
  }

  if (isDonation && isDue) {
    throw createHttpError(400, 'Choose either Donation or Dues for a deposit, not both.')
  }

  if (withdrawalCategory && !withdrawalCategories.has(withdrawalCategory)) {
    throw createHttpError(400, 'Choose a valid withdrawal purpose before saving.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Enter a gold amount greater than zero.')
  }

  if (!isValidIsoDate(date)) {
    throw createHttpError(400, 'Choose a valid entry date in YYYY-MM-DD format.')
  }

  return {
    type,
    amount,
    isDonation: isDonation ? 1 : 0,
    isDue: isDue ? 1 : 0,
    withdrawalCategory,
    date,
    user,
    notes,
  }
}

function sanitizeGuildName(value) {
  const name = sanitizeText(value, 80)
  if (!name) {
    throw createHttpError(400, 'Enter a guild name before continuing.')
  }

  return name
}

function sanitizeWeekStartDate(value) {
  const weekStartDate = String(value || '') || todayString()
  if (!isValidIsoDate(weekStartDate)) {
    throw createHttpError(400, 'Choose a valid week start date in YYYY-MM-DD format.')
  }

  return weekStartDate
}

function sanitizeDueScheme(value) {
  return value === 'weekly' ? 'weekly' : 'monthly'
}

function sanitizeDefaultDuesAmount(value) {
  const normalizedValue = value === '' || value === null || typeof value === 'undefined' ? 0 : value
  const defaultDuesAmount = Math.round(Number(normalizedValue))

  if (!Number.isFinite(defaultDuesAmount) || defaultDuesAmount < 0) {
    throw createHttpError(400, 'Enter a valid default dues amount.')
  }

  return defaultDuesAmount
}

function sanitizeTrackedMemberPayload(payload) {
  const name = sanitizeText(payload?.name, 80)
  const duesAmount = Math.round(Number(payload?.duesAmount || 0))
  const useDefaultDues = payload?.useDefaultDues !== false ? 1 : 0
  const duesExempt = payload?.duesExempt === true ? 1 : 0
  const isActive = payload?.isActive !== false ? 1 : 0

  if (!name) {
    throw createHttpError(400, 'Enter a member name before saving them to the guild roster.')
  }

  if (!Number.isFinite(duesAmount) || duesAmount < 0) {
    throw createHttpError(400, 'Enter a valid recurring dues amount.')
  }

  if (!useDefaultDues && duesAmount <= 0) {
    throw createHttpError(400, 'Enter a custom dues amount or use the guild default.')
  }

  return {
    name,
    userId: payload?.userId || null,
    rankId: payload?.rankId || null,
    duesAmount: useDefaultDues ? 0 : duesAmount,
    duePeriod: 'monthly',
    duesDay: 1,
    useDefaultDues,
    duesExempt,
    isActive,
    lastActiveAt: payload?.lastActiveAt || null,
  }
}

function normalizeInviteCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function createInviteCode() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase()
  return raw.match(/.{1,4}/g).join('-')
}

function resolveInviteExpiry(expiresInHours) {
  if (expiresInHours === null || typeof expiresInHours === 'undefined' || expiresInHours === '') {
    return null
  }

  const parsedHours = Number(expiresInHours)
  if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
    throw createHttpError(400, 'Choose a valid invite expiration time.')
  }

  return new Date(Date.now() + parsedHours * 60 * 60 * 1000).toISOString()
}

function sanitizeGuildRole(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (!guildRoles.has(normalizedValue)) {
    throw createHttpError(400, 'Choose a valid guild role.')
  }

  return normalizedValue
}

function ensureGuildForUser(userId, guildId) {
  const guild = statements.findGuildForUser.get(guildId, userId)
  if (!guild) {
    throw createHttpError(404, 'That guild could not be found or you no longer have access to it.')
  }

  return guild
}

function ensureGuildOwner(userId, guildId) {
  const guild = ensureGuildForUser(userId, guildId)
  if (guild.membershipRole !== 'owner') {
    throw createHttpError(403, 'Only the guild owner can manage sharing and member access for this guild.')
  }

  return guild
}

function ensureGuildEditor(userId, guildId) {
  const guild = ensureGuildForUser(userId, guildId)
  if (!['admin', 'owner'].includes(guild.membershipRole)) {
    throw createHttpError(403, 'You have view-only access to this guild. Ask the owner to grant admin access before making changes.')
  }

  return guild
}

function getFirstAccessibleGuildId(userId) {
  return statements.findFirstGuildForUser.get(userId)?.id ?? null
}

function serializeUser(userId) {
  const user = statements.findUserById.get(userId)
  if (!user) {
    return null
  }

  const guilds = statements.listGuildsForUser.all(userId).map((guild) => ({
    ...guild,
    dueScheme: guild.dueScheme === 'weekly' ? 'weekly' : 'monthly',
    defaultDuesAmount: Number(guild.defaultDuesAmount) || 0,
    role: sanitizeGuildRole(guild.membershipRole),
    isOwner: guild.ownerUserId === userId,
    canEdit: ['admin', 'owner'].includes(guild.membershipRole),
    canManagePermissions: guild.membershipRole === 'owner',
    canDelete: guild.membershipRole === 'owner',
    members: statements.listGuildMembersForGuild.all(guild.id).map((member) => ({
      ...member,
      role: sanitizeGuildRole(member.role),
      isOwner: Boolean(member.isOwner),
    })),
    ranks: statements.listRanksForGuild.all(guild.id).map(r => ({
      ...r,
      permissions: JSON.parse(r.permissions),
    })),
    trackedMembers: statements.listTrackedMembersForGuild.all(guild.id).map((member) => ({
      ...member,
      duePeriod: member.duePeriod === 'weekly' ? 'weekly' : 'monthly',
      useDefaultDues: Boolean(member.useDefaultDues),
      duesExempt: Boolean(member.duesExempt),
      isActive: Boolean(member.isActive),
      characters: statements.listCharactersForMember.all(member.id).map(c => ({
        ...c,
        isPrimary: Boolean(c.isPrimary),
      })),
    })),
    entries: statements.listEntriesForGuild.all(guild.id),
  }))

  const selectedGuildId = guilds.some((guild) => guild.id === user.selected_guild_id)
    ? user.selected_guild_id
    : guilds[0]?.id ?? null

  if (selectedGuildId !== user.selected_guild_id) {
    statements.updateUserSelectedGuild.run(selectedGuildId, userId)
  }

  return {
    username: user.username,
    email: user.email ?? '',
    emailVerified: Boolean(user.email_verified_at),
    selectedGuildId,
    guilds,
  }
}

function createSession(response, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString()
  statements.createSession.run({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  })
  setSessionCookie(response, token, expiresAt)
}

function getAuthenticatedUser(request) {
  const token = request.cookies?.[sessionCookieName]
  if (!token) {
    return null
  }

  statements.deleteExpiredSessions.run(new Date().toISOString())
  return statements.findSessionUserByTokenHash.get(hashSessionToken(token), new Date().toISOString())
}

function requireAuth(request, _response, next) {
  const user = getAuthenticatedUser(request)
  if (!user) {
    next(createHttpError(401, 'Your session has expired or you are not signed in. Please log in and try again.'))
    return
  }

  request.user = user
  next()
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/session', (request, response) => {
  const user = getAuthenticatedUser(request)
  if (!user) {
    clearSessionCookie(response)
    response.json({ user: null })
    return
  }

  response.json({ user: serializeUser(user.id) })
})

app.post('/api/auth/signup', async (request, response, next) => {
  try {
    const username = normalizeUsername(request.body?.username)
    const email = normalizeEmail(request.body?.email)
    const password = request.body?.password

    validateUsername(username)
    validateEmail(email)
    validatePassword(password)
    ensureTransactionalEmailAvailable()

    if (statements.findUserByUsername.get(username)) {
      throw createHttpError(409, 'That username is already in use. Choose a different username or log in instead.')
    }
    if (statements.findUserByEmail.get(email)) {
      throw createHttpError(409, 'That recovery email is already attached to another account. Use a different email or recover that account instead.')
    }

    const { passwordHash, passwordSalt } = hashPassword(password)
    const result = statements.createUser.run({
      username,
      email,
      passwordHash,
      passwordSalt,
    })
    writeAuditLog({
      actorUserId: result.lastInsertRowid,
      action: 'auth.signup',
      entityType: 'user',
      entityId: result.lastInsertRowid,
      details: { username },
    })

    const createdUser = statements.findUserById.get(result.lastInsertRowid)
    await issueEmailVerification(createdUser)
    createSession(response, result.lastInsertRowid)
    scheduleBackup('auth-signup')
    response.status(201).json({
      user: serializeUser(result.lastInsertRowid),
      notice: 'Account created. Check your email to verify your recovery address.',
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', (request, response, next) => {
  try {
    const username = normalizeUsername(request.body?.username)
    const password = request.body?.password

    validateUsername(username)
    validatePassword(password)

    const user = statements.findUserByUsername.get(username)
    if (!user || !verifyPassword(password, user)) {
      throw createHttpError(401, 'The username or password you entered is incorrect.')
    }

    createSession(response, user.id)
    // Update activity tracking when logging in
    statements.updateTrackedMemberActivity.run(new Date().toISOString(), user.id)
    response.json({ user: serializeUser(user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', (request, response) => {
  const token = request.cookies?.[sessionCookieName]
  if (token) {
    statements.deleteSessionByTokenHash.run(hashSessionToken(token))
  }

  clearSessionCookie(response)
  response.status(204).end()
})

app.post('/api/auth/email-verification/verify', async (request, response, next) => {
  try {
    const token = String(request.body?.token || '').trim()
    if (!token) {
      throw createHttpError(400, 'This email verification link is invalid or expired.')
    }

    const verificationRecord = statements.findEmailVerificationTokenByHash.get(
      hashSessionToken(token),
      new Date().toISOString(),
    )
    if (!verificationRecord) {
      throw createHttpError(400, 'This email verification link is invalid or expired.')
    }

    const now = new Date().toISOString()
    const transaction = db.transaction(() => {
      statements.consumeEmailVerificationToken.run(now, verificationRecord.id)
      statements.markUserEmailVerified.run(now, verificationRecord.userId)
      writeAuditLog({
        actorUserId: verificationRecord.userId,
        action: 'auth.email_verified',
        entityType: 'user',
        entityId: verificationRecord.userId,
        details: { email: verificationRecord.email },
      })
    })

    transaction()
    scheduleBackup('auth-email-verified')
    response.json({ message: 'Recovery email verified. You can now reset your password if needed.' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/password-reset/request', async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body?.email)
    validateEmail(email)
    ensureTransactionalEmailAvailable()

    const user = statements.findUserByEmail.get(email)
    if (user?.email_verified_at) {
      await issuePasswordReset(user)
    }

    response.json({
      message: 'If that recovery email is attached to an account, a password reset link has been sent.',
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/password-reset/confirm', (request, response, next) => {
  try {
    const token = String(request.body?.token || '').trim()
    const password = request.body?.password

    if (!token) {
      throw createHttpError(400, 'This password reset link is invalid or expired.')
    }
    validatePassword(password)

    const resetRecord = statements.findPasswordResetTokenByHash.get(
      hashSessionToken(token),
      new Date().toISOString(),
    )
    if (!resetRecord) {
      throw createHttpError(400, 'This password reset link is invalid or expired.')
    }

    const { passwordHash, passwordSalt } = hashPassword(password)
    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      statements.updateUserPassword.run(passwordHash, passwordSalt, resetRecord.userId)
      statements.consumePasswordResetToken.run(now, resetRecord.id)
      statements.deletePasswordResetTokensForUser.run(resetRecord.userId)
      statements.deleteSessionsByUserId.run(resetRecord.userId)
      writeAuditLog({
        actorUserId: resetRecord.userId,
        action: 'auth.password_reset_completed',
        entityType: 'user',
        entityId: resetRecord.userId,
        details: { email: resetRecord.email },
      })
    })

    transaction()
    scheduleBackup('auth-password-reset')
    response.json({ message: 'Password updated. Log in with your new password.' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/email-verification/resend', requireAuth, async (request, response, next) => {
  try {
    ensureTransactionalEmailAvailable()
    const user = statements.findUserById.get(request.user.id)
    if (!user?.email) {
      throw createHttpError(400, 'Add a recovery email before requesting a verification message.')
    }
    if (user.email_verified_at) {
      response.json({ message: 'Your recovery email is already verified.' })
      return
    }

    await issueEmailVerification(user, 'auth.email_verification_resent')
    response.json({ message: 'A fresh verification email has been sent.' })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/account/email', requireAuth, async (request, response, next) => {
  try {
    ensureTransactionalEmailAvailable()
    const email = normalizeEmail(request.body?.email)
    const password = request.body?.password

    validateEmail(email)
    validatePassword(password)

    const user = statements.findUserById.get(request.user.id)
    if (!user || !verifyPassword(password, user)) {
      throw createHttpError(401, 'The password you entered did not match your account.')
    }

    const existingUserForEmail = statements.findUserByEmail.get(email)
    if (existingUserForEmail && existingUserForEmail.id !== request.user.id) {
      throw createHttpError(409, 'That recovery email is already attached to another account. Use a different email or recover that account instead.')
    }

    const transaction = db.transaction(() => {
      statements.updateUserEmail.run(email, request.user.id)
      statements.deleteEmailVerificationTokensForUser.run(request.user.id)
      writeAuditLog({
        actorUserId: request.user.id,
        action: 'account.recovery_email_updated',
        entityType: 'user',
        entityId: request.user.id,
        details: { email },
      })
    })

    transaction()
    const updatedUser = statements.findUserById.get(request.user.id)
    await issueEmailVerification(updatedUser)
    scheduleBackup('account-recovery-email-update')
    response.json({
      user: serializeUser(request.user.id),
      message: 'Recovery email updated. Check your inbox to verify it.',
    })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/account', requireAuth, (request, response, next) => {
  try {
    const password = request.body?.password

    validatePassword(password)

    const user = statements.findUserById.get(request.user.id)
    if (!user || !verifyPassword(password, user)) {
      throw createHttpError(401, 'The password you entered did not match your account. Account deletion was cancelled.')
    }

    const transaction = db.transaction(() => {
      writeAuditLog({
        actorUserId: request.user.id,
        action: 'account.delete',
        entityType: 'user',
        entityId: request.user.id,
        details: { username: user.username },
      })
      statements.deleteUserById.run(request.user.id)
    })

    transaction()
    scheduleBackup('account-delete')
    clearSessionCookie(response)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds', requireAuth, (request, response, next) => {
  try {
    const name = sanitizeGuildName(request.body?.name)
    const weekStartDate = sanitizeWeekStartDate(request.body?.weekStartDate || todayString())
    const dueScheme = sanitizeDueScheme(request.body?.dueScheme)
    const defaultDuesAmount = sanitizeDefaultDuesAmount(request.body?.defaultDuesAmount)
    const guildId = crypto.randomUUID()

    const transaction = db.transaction(() => {
      statements.createGuild.run({
        id: guildId,
        userId: request.user.id,
        name,
        weekStartDate,
        dueScheme,
        defaultDuesAmount,
      })
      statements.createGuildMember.run(guildId, request.user.id, 'owner')
      writeAuditLog({
        actorUserId: request.user.id,
        action: 'guild.create',
        entityType: 'guild',
        entityId: guildId,
        details: { name, weekStartDate, dueScheme, defaultDuesAmount },
      })

      if (!request.user.selected_guild_id) {
        statements.updateUserSelectedGuild.run(guildId, request.user.id)
      }
    })

    transaction()
    scheduleBackup('guild-create')
    response.status(201).json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/guilds/:guildId/audit-logs', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildForUser(request.user.id, request.params.guildId)

    response.json({
      auditLogs: statements.listAuditLogsForGuild
        .all({ guildId: guild.id })
        .map(serializeAuditLog),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/import-guest', requireAuth, (request, response, next) => {
  try {
    const name = sanitizeGuildName(request.body?.name || 'Imported Guest Guild')
    const weekStartDate = sanitizeWeekStartDate(request.body?.weekStartDate || todayString())
    const dueScheme = sanitizeDueScheme(request.body?.dueScheme)
    const defaultDuesAmount = sanitizeDefaultDuesAmount(request.body?.defaultDuesAmount)
    const entries = Array.isArray(request.body?.entries) ? request.body.entries : []

    const normalizedEntries = entries.map((entry) => ({
      id: crypto.randomUUID(),
      guildId: '',
      ...sanitizeEntryPayload(entry),
    }))

    const guildId = crypto.randomUUID()
    const transaction = db.transaction(() => {
      statements.createGuild.run({
        id: guildId,
        userId: request.user.id,
        name,
        weekStartDate,
        dueScheme,
        defaultDuesAmount,
      })
      statements.createGuildMember.run(guildId, request.user.id, 'owner')

      for (const entry of normalizedEntries) {
        statements.createEntry.run({ ...entry, guildId })
      }

      writeAuditLog({
        actorUserId: request.user.id,
        action: 'guild.import_guest',
        entityType: 'guild',
        entityId: guildId,
        details: { name, weekStartDate, dueScheme, defaultDuesAmount, entryCount: normalizedEntries.length },
      })

      statements.updateUserSelectedGuild.run(guildId, request.user.id)
    })

    transaction()
    scheduleBackup('guild-import')
    response.status(201).json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const updates = []

    if (typeof request.body?.name !== 'undefined') {
      const name = sanitizeGuildName(request.body.name)
      statements.renameGuild.run(name, guild.id, guild.ownerUserId)
      updates.push('name')
    }

    if (typeof request.body?.weekStartDate !== 'undefined') {
      const weekStartDate = sanitizeWeekStartDate(request.body.weekStartDate)
      statements.updateGuildWeekStartDate.run(weekStartDate, guild.id, guild.ownerUserId)
      updates.push('weekStartDate')
    }

    if (typeof request.body?.dueScheme !== 'undefined') {
      const dueScheme = sanitizeDueScheme(request.body.dueScheme)
      statements.updateGuildDueScheme.run(dueScheme, guild.id, guild.ownerUserId)
      updates.push('dueScheme')
    }

    if (typeof request.body?.defaultDuesAmount !== 'undefined') {
      const defaultDuesAmount = sanitizeDefaultDuesAmount(request.body.defaultDuesAmount)
      statements.updateGuildDefaultDuesAmount.run(defaultDuesAmount, guild.id, guild.ownerUserId)
      statements.resetTrackedMembersToDefaultForGuild.run(guild.id)
      updates.push('defaultDuesAmount')
    }

    if (updates.length === 0) {
      throw createHttpError(400, 'No guild changes were submitted. Update the guild name, dues settings, or week start date and try again.')
    }

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'guild.update',
      entityType: 'guild',
      entityId: guild.id,
      details: { updates, body: request.body },
    })

    scheduleBackup('guild-update')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/select', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildForUser(request.user.id, request.params.guildId)
    statements.updateUserSelectedGuild.run(guild.id, request.user.id)
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)

    const transaction = db.transaction(() => {
      writeAuditLog({
        actorUserId: request.user.id,
        action: 'guild.delete',
        entityType: 'guild',
        entityId: guild.id,
        details: { name: guild.name },
      })
      statements.deleteGuild.run(guild.id, request.user.id)
      if (request.user.selected_guild_id === guild.id) {
        statements.updateUserSelectedGuild.run(getFirstAccessibleGuildId(request.user.id), request.user.id)
      }
    })

    transaction()
    scheduleBackup('guild-delete')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId/membership', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildForUser(request.user.id, request.params.guildId)

    if (guild.ownerUserId === request.user.id) {
      throw createHttpError(400, 'You are the owner of this guild. Owners cannot leave; delete the guild instead if you no longer want it.')
    }

    const transaction = db.transaction(() => {
      writeAuditLog({
        actorUserId: request.user.id,
        action: 'guild.leave',
        entityType: 'guild_member',
        entityId: `${guild.id}:${request.user.id}`,
        details: { guildId: guild.id },
      })
      statements.deleteGuildMember.run(guild.id, request.user.id)

      if (request.user.selected_guild_id === guild.id) {
        statements.updateUserSelectedGuild.run(getFirstAccessibleGuildId(request.user.id), request.user.id)
      }
    })

    transaction()
    scheduleBackup('guild-leave')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/invites', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)
    const code = createInviteCode()
    const singleUse = request.body?.singleUse === false ? 0 : 1
    const expiresAt = resolveInviteExpiry(request.body?.expiresInHours)
    statements.deleteExpiredGuildInvites.run(new Date().toISOString())
    statements.createGuildInvite.run({
      guildId: guild.id,
      codeHash: hashSessionToken(normalizeInviteCode(code)),
      createdByUserId: request.user.id,
      singleUse,
      expiresAt,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'guild.invite_create',
      entityType: 'guild_invite',
      entityId: guild.id,
      details: { guildId: guild.id, singleUse: Boolean(singleUse), expiresAt },
    })

    scheduleBackup('guild-invite-create')
    response.status(201).json({ code, singleUse: Boolean(singleUse), expiresAt })
  } catch (error) {
    next(error)
  }
})

app.post('/api/invites/redeem', requireAuth, (request, response, next) => {
  try {
    const normalizedCode = normalizeInviteCode(request.body?.code)
    if (!normalizedCode) {
      throw createHttpError(400, 'Enter an invite code before trying to join a shared guild.')
    }

    statements.deleteExpiredGuildInvites.run(new Date().toISOString())
    const invite = statements.findGuildInviteByCodeHash.get(
      hashSessionToken(normalizedCode),
      new Date().toISOString(),
    )
    if (!invite) {
      throw createHttpError(404, 'That invite code is not valid anymore. It may be incorrect, expired, or already used.')
    }

    const transaction = db.transaction(() => {
      statements.createGuildMember.run(invite.guildId, request.user.id, 'viewer')
      statements.updateUserSelectedGuild.run(invite.guildId, request.user.id)

      // Sync with tracked members if a member with the same name exists
      const user = statements.findUserById.get(request.user.id)
      if (user) {
        const existingTrackedMember = statements.findTrackedMemberByName.get(invite.guildId, user.username)
        if (existingTrackedMember && !existingTrackedMember.user_id) {
          statements.linkTrackedMemberToUser.run(user.id, existingTrackedMember.id)
        }
      }

      writeAuditLog({
        actorUserId: request.user.id,
        action: 'guild.invite_redeem',
        entityType: 'guild_member',
        entityId: `${invite.guildId}:${request.user.id}`,
        details: { guildId: invite.guildId, singleUse: Boolean(invite.singleUse) },
      })
      if (invite.singleUse) {
        statements.deleteGuildInviteById.run(invite.id)
      }
    })

    transaction()
    scheduleBackup('guild-invite-redeem')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId/members/:memberUserId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)
    const memberUserId = Number(request.params.memberUserId)

    if (!Number.isInteger(memberUserId)) {
      throw createHttpError(400, 'The selected member could not be identified. Refresh the page and try again.')
    }

    if (memberUserId === guild.ownerUserId) {
      throw createHttpError(400, 'The guild owner cannot be removed from the guild member list.')
    }

    if (!statements.findGuildMember.get(guild.id, memberUserId)) {
      throw createHttpError(404, 'That guild member was not found. They may have already left or been removed.')
    }

    const transaction = db.transaction(() => {
      writeAuditLog({
        actorUserId: request.user.id,
        action: 'guild.member_remove',
        entityType: 'guild_member',
        entityId: `${guild.id}:${memberUserId}`,
        details: { guildId: guild.id, memberUserId },
      })
      statements.deleteGuildMember.run(guild.id, memberUserId)

      const member = statements.findUserById.get(memberUserId)
      if (member?.selected_guild_id === guild.id) {
        statements.updateUserSelectedGuild.run(getFirstAccessibleGuildId(memberUserId), memberUserId)
      }
    })

    transaction()
    scheduleBackup('guild-member-remove')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId/members/:memberUserId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)
    const memberUserId = Number(request.params.memberUserId)

    if (!Number.isInteger(memberUserId)) {
      throw createHttpError(400, 'The selected member could not be identified. Refresh the page and try again.')
    }

    if (memberUserId === guild.ownerUserId) {
      throw createHttpError(400, 'The guild owner role cannot be changed from this screen.')
    }

    const member = statements.findGuildMember.get(guild.id, memberUserId)
    if (!member) {
      throw createHttpError(404, 'That guild member was not found. They may have already left or been removed.')
    }

    const role = sanitizeGuildRole(request.body?.role)
    if (role === 'owner') {
      throw createHttpError(400, 'Transfer ownership is not supported here. Choose viewer or admin.')
    }

    statements.updateGuildMemberRole.run(role, guild.id, memberUserId)
    writeAuditLog({
      actorUserId: request.user.id,
      action: 'guild.member_role_update',
      entityType: 'guild_member',
      entityId: `${guild.id}:${memberUserId}`,
      details: { guildId: guild.id, memberUserId, role },
    })

    scheduleBackup('guild-member-role-update')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/tracked-members', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const trackedMember = sanitizeTrackedMemberPayload(request.body)
    const trackedMemberId = crypto.randomUUID()

    statements.createTrackedMember.run({
      id: trackedMemberId,
      guildId: guild.id,
      ...trackedMember,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'tracked_member.create',
      entityType: 'tracked_member',
      entityId: trackedMemberId,
      details: { guildId: guild.id, ...trackedMember },
    })

    scheduleBackup('tracked-member-create')
    response.status(201).json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId/tracked-members/:trackedMemberId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const existingTrackedMember = statements.findTrackedMemberForGuild.get(
      request.params.trackedMemberId,
      guild.id,
    )

    if (!existingTrackedMember) {
      throw createHttpError(404, 'That tracked member could not be found. Refresh the page and try again.')
    }

    const trackedMember = sanitizeTrackedMemberPayload(request.body)
    statements.updateTrackedMember.run({
      id: request.params.trackedMemberId,
      guildId: guild.id,
      ...trackedMember,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'tracked_member.update',
      entityType: 'tracked_member',
      entityId: request.params.trackedMemberId,
      details: { guildId: guild.id, ...trackedMember },
    })

    scheduleBackup('tracked-member-update')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId/tracked-members/:trackedMemberId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const existingTrackedMember = statements.findTrackedMemberForGuild.get(
      request.params.trackedMemberId,
      guild.id,
    )

    if (!existingTrackedMember) {
      throw createHttpError(404, 'That tracked member could not be found. Refresh the page and try again.')
    }

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'tracked_member.delete',
      entityType: 'tracked_member',
      entityId: request.params.trackedMemberId,
      details: { guildId: guild.id, name: existingTrackedMember.name },
    })

    statements.deleteTrackedMember.run(request.params.trackedMemberId, guild.id)
    scheduleBackup('tracked-member-delete')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/ranks', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)
    const name = sanitizeText(request.body?.name, 80)
    if (!name) throw createHttpError(400, 'Enter a rank name.')
    const id = crypto.randomUUID()
    const weight = Number(request.body?.weight) || 0
    const permissions = JSON.stringify(request.body?.permissions || {})

    statements.createRank.run({ id, guildId: guild.id, name, weight, permissions })
    writeAuditLog({
      actorUserId: request.user.id,
      action: 'rank.create',
      entityType: 'rank',
      entityId: id,
      details: { guildId: guild.id, name, weight },
    })
    scheduleBackup('rank-create')
    response.status(201).json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId/ranks/:rankId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)
    const name = sanitizeText(request.body?.name, 80)
    if (!name) throw createHttpError(400, 'Enter a rank name.')
    const weight = Number(request.body?.weight) || 0
    const permissions = JSON.stringify(request.body?.permissions || {})

    statements.updateRank.run({ id: request.params.rankId, guildId: guild.id, name, weight, permissions })
    writeAuditLog({
      actorUserId: request.user.id,
      action: 'rank.update',
      entityType: 'rank',
      entityId: request.params.rankId,
      details: { guildId: guild.id, name, weight },
    })
    scheduleBackup('rank-update')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId/ranks/:rankId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildOwner(request.user.id, request.params.guildId)
    statements.deleteRank.run(request.params.rankId, guild.id)
    writeAuditLog({
      actorUserId: request.user.id,
      action: 'rank.delete',
      entityType: 'rank',
      entityId: request.params.rankId,
      details: { guildId: guild.id },
    })
    scheduleBackup('rank-delete')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/tracked-members/:memberId/characters', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const member = statements.findTrackedMemberForGuild.get(request.params.memberId, guild.id)
    if (!member) throw createHttpError(404, 'Member not found.')

    const id = crypto.randomUUID()
    const { name, class: className, role, level, isPrimary } = request.body
    if (!name || !className || !role) throw createHttpError(400, 'Name, Class, and Role are required.')

    if (isPrimary) {
      statements.clearPrimaryCharactersForMember.run(member.id)
    }

    statements.createCharacter.run({
      id,
      trackedMemberId: member.id,
      name: sanitizeText(name, 80),
      class: sanitizeText(className, 40),
      role: sanitizeText(role, 40),
      level: Number(level) || 50,
      isPrimary: isPrimary ? 1 : 0,
    })

    // Update last_active_at when data is touched
    statements.updateTrackedMember.run({
      ...member,
      rankId: member.rankId,
      lastActiveAt: new Date().toISOString(),
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'character.create',
      entityType: 'character',
      entityId: id,
      details: { guildId: guild.id, memberId: member.id, name },
    })
    scheduleBackup('character-create')
    response.status(201).json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId/tracked-members/:memberId/characters/:characterId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const member = statements.findTrackedMemberForGuild.get(request.params.memberId, guild.id)
    if (!member) throw createHttpError(404, 'Member not found.')

    const { name, class: className, role, level, isPrimary } = request.body
    if (isPrimary) {
      statements.clearPrimaryCharactersForMember.run(member.id)
    }
    statements.updateCharacter.run({
      id: request.params.characterId,
      trackedMemberId: member.id,
      name: sanitizeText(name, 80),
      class: sanitizeText(className, 40),
      role: sanitizeText(role, 40),
      level: Number(level) || 50,
      isPrimary: isPrimary ? 1 : 0,
    })

    statements.updateTrackedMember.run({
      ...member,
      rankId: member.rankId,
      lastActiveAt: new Date().toISOString(),
    })

    scheduleBackup('character-update')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId/tracked-members/:memberId/characters/:characterId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    statements.deleteCharacter.run(request.params.characterId, request.params.memberId)
    scheduleBackup('character-delete')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/guilds/:guildId/entries', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    const entry = sanitizeEntryPayload(request.body)

    const entryId = crypto.randomUUID()
    statements.createEntry.run({
      id: entryId,
      guildId: guild.id,
      ...entry,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'entry.create',
      entityType: 'entry',
      entityId: entryId,
      details: {
        guildId: guild.id,
        type: entry.type,
        isDonation: Boolean(entry.isDonation),
        isDue: Boolean(entry.isDue),
        withdrawalCategory: entry.withdrawalCategory,
        amount: entry.amount,
        date: entry.date,
      },
    })

    scheduleBackup('entry-create')
    response.status(201).json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/guilds/:guildId/entries/:entryId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    if (!statements.findEntryForGuild.get(request.params.entryId, guild.id)) {
      throw createHttpError(404, 'That entry could not be found. It may have already been changed or deleted.')
    }

    const entry = sanitizeEntryPayload(request.body)
    statements.updateEntry.run({
      id: request.params.entryId,
      guildId: guild.id,
      ...entry,
    })

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'entry.update',
      entityType: 'entry',
      entityId: request.params.entryId,
      details: {
        guildId: guild.id,
        type: entry.type,
        isDonation: Boolean(entry.isDonation),
        isDue: Boolean(entry.isDue),
        withdrawalCategory: entry.withdrawalCategory,
        amount: entry.amount,
        date: entry.date,
      },
    })

    scheduleBackup('entry-update')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/guilds/:guildId/entries/:entryId', requireAuth, (request, response, next) => {
  try {
    const guild = ensureGuildEditor(request.user.id, request.params.guildId)
    if (!statements.findEntryForGuild.get(request.params.entryId, guild.id)) {
      throw createHttpError(404, 'That entry could not be found. It may have already been changed or deleted.')
    }

    writeAuditLog({
      actorUserId: request.user.id,
      action: 'entry.delete',
      entityType: 'entry',
      entityId: request.params.entryId,
      details: { guildId: guild.id },
    })
    statements.deleteEntry.run(request.params.entryId, guild.id)
    scheduleBackup('entry-delete')
    response.json({ user: serializeUser(request.user.id) })
  } catch (error) {
    next(error)
  }
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

app.use((error, _request, response, next) => {
  void next
  const status = error.status || 500
  const message = status >= 500 ? 'Internal server error.' : error.message
  response.status(status).json({ error: message })
})

app.listen(port, () => {
  console.log(`ESO Guild Bank API listening on http://localhost:${port}`)
})