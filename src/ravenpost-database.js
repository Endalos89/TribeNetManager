const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

class RavenpostDatabase {
  constructor(userDataPath) {
    this.dataDir = path.join(userDataPath, 'data');
    this.backupDir = path.join(userDataPath, 'backups');
    this.dbPath = path.join(this.dataDir, 'ravenpost.sqlite');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ravenpost_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ravenpost_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'unlinked'
          CHECK(status IN ('unlinked', 'linked', 'not_interested')),
        clan_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ravenpost_contacts_status
        ON ravenpost_contacts(status, email);

      CREATE TABLE IF NOT EXISTS ravenpost_messages (
        gmail_id TEXT PRIMARY KEY,
        thread_id TEXT,
        direction TEXT NOT NULL DEFAULT 'inbound'
          CHECK(direction IN ('inbound', 'outbound')),
        sender_email TEXT NOT NULL DEFAULT '',
        sender_name TEXT NOT NULL DEFAULT '',
        recipient TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        snippet TEXT NOT NULL DEFAULT '',
        body_text TEXT NOT NULL DEFAULT '',
        received_at TEXT NOT NULL,
        unread INTEGER NOT NULL DEFAULT 0,
        message_id_header TEXT NOT NULL DEFAULT '',
        references_header TEXT NOT NULL DEFAULT '',
        in_reply_to_header TEXT NOT NULL DEFAULT '',
        synced_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ravenpost_messages_received
        ON ravenpost_messages(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ravenpost_messages_sender
        ON ravenpost_messages(sender_email, received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ravenpost_messages_thread
        ON ravenpost_messages(thread_id, received_at ASC);
    `);
  }

  getSetting(key, fallback = null) {
    const row = this.db.prepare(
      'SELECT value FROM ravenpost_settings WHERE key = ?'
    ).get(String(key));
    return row ? row.value : fallback;
  }

  setSetting(key, value) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO ravenpost_settings(key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(String(key), String(value ?? ''), now);
    return true;
  }

  deleteSetting(key) {
    this.db.prepare('DELETE FROM ravenpost_settings WHERE key = ?').run(String(key));
  }

  ensureContact(email, displayName = '') {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO ravenpost_contacts(email, display_name, status, created_at, updated_at)
      VALUES (?, ?, 'unlinked', ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        display_name = CASE
          WHEN excluded.display_name <> '' THEN excluded.display_name
          ELSE ravenpost_contacts.display_name
        END,
        updated_at = excluded.updated_at
    `).run(normalized, String(displayName || '').trim(), now, now);
    return this.getContact(normalized);
  }

  getContact(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const row = this.db.prepare(`
      SELECT id, email, display_name AS displayName, status,
             clan_code AS clanCode, created_at AS createdAt, updated_at AS updatedAt
      FROM ravenpost_contacts
      WHERE email = ?
    `).get(normalized);
    return row || null;
  }

  updateContact(email, update = {}) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('An email address is required.');
    this.ensureContact(normalized, update.displayName || '');
    const status = ['unlinked', 'linked', 'not_interested'].includes(update.status)
      ? update.status
      : 'unlinked';
    const clanCode = status === 'linked' ? String(update.clanCode || '').trim() : null;
    if (status === 'linked' && !clanCode) throw new Error('Choose a Clan / Tribe before linking this sender.');
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE ravenpost_contacts
      SET status = ?, clan_code = ?, updated_at = ?
      WHERE email = ?
    `).run(status, clanCode, now, normalized);
    return this.getContact(normalized);
  }

  listContacts(status = null) {
    const params = [];
    let where = '';
    if (status && ['unlinked', 'linked', 'not_interested'].includes(status)) {
      where = 'WHERE c.status = ?';
      params.push(status);
    }
    return this.db.prepare(`
      SELECT c.id, c.email, c.display_name AS displayName, c.status,
             c.clan_code AS clanCode, c.created_at AS createdAt, c.updated_at AS updatedAt,
             COUNT(m.gmail_id) AS messageCount,
             MAX(m.received_at) AS lastMessageAt
      FROM ravenpost_contacts c
      LEFT JOIN ravenpost_messages m
        ON lower(m.sender_email) = lower(c.email) AND m.direction = 'inbound'
      ${where}
      GROUP BY c.id
      ORDER BY COALESCE(MAX(m.received_at), c.updated_at) DESC, c.email ASC
    `).all(...params).map(row => ({
      ...row,
      messageCount: Number(row.messageCount || 0)
    }));
  }

  upsertMessage(message) {
    if (!message?.gmailId) throw new Error('Gmail message ID is required.');
    const existing = this.getMessage(message.gmailId);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO ravenpost_messages(
        gmail_id, thread_id, direction, sender_email, sender_name, recipient,
        subject, snippet, body_text, received_at, unread, message_id_header,
        references_header, in_reply_to_header, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(gmail_id) DO UPDATE SET
        thread_id = excluded.thread_id,
        direction = excluded.direction,
        sender_email = excluded.sender_email,
        sender_name = excluded.sender_name,
        recipient = excluded.recipient,
        subject = excluded.subject,
        snippet = excluded.snippet,
        body_text = excluded.body_text,
        received_at = excluded.received_at,
        unread = excluded.unread,
        message_id_header = excluded.message_id_header,
        references_header = excluded.references_header,
        in_reply_to_header = excluded.in_reply_to_header,
        synced_at = excluded.synced_at
    `).run(
      String(message.gmailId),
      String(message.threadId || ''),
      message.direction === 'outbound' ? 'outbound' : 'inbound',
      normalizeEmail(message.senderEmail),
      String(message.senderName || '').trim(),
      String(message.recipient || '').trim(),
      String(message.subject || ''),
      String(message.snippet || ''),
      String(message.bodyText || ''),
      message.receivedAt || now,
      message.unread ? 1 : 0,
      String(message.messageIdHeader || ''),
      String(message.referencesHeader || ''),
      String(message.inReplyToHeader || ''),
      now
    );
    return { inserted: !existing, message: this.getMessage(message.gmailId) };
  }

  getMessage(gmailId) {
    const row = this.db.prepare(`
      SELECT m.gmail_id AS gmailId, m.thread_id AS threadId, m.direction,
             m.sender_email AS senderEmail, m.sender_name AS senderName,
             m.recipient, m.subject, m.snippet, m.body_text AS bodyText,
             m.received_at AS receivedAt, m.unread,
             m.message_id_header AS messageIdHeader,
             m.references_header AS referencesHeader,
             m.in_reply_to_header AS inReplyToHeader,
             m.synced_at AS syncedAt,
             c.status AS contactStatus, c.clan_code AS clanCode,
             c.display_name AS contactDisplayName
      FROM ravenpost_messages m
      LEFT JOIN ravenpost_contacts c ON lower(c.email) = lower(m.sender_email)
      WHERE m.gmail_id = ?
    `).get(String(gmailId));
    return row ? { ...row, unread: Boolean(row.unread) } : null;
  }

  listMessages(filter = 'inbox', limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    let where = "m.direction = 'inbound' AND COALESCE(c.status, 'unlinked') <> 'not_interested'";
    if (filter === 'unknown') {
      where = "m.direction = 'inbound' AND COALESCE(c.status, 'unlinked') = 'unlinked'";
    } else if (filter === 'ignored') {
      where = "m.direction = 'inbound' AND c.status = 'not_interested'";
    } else if (filter === 'linked') {
      where = "m.direction = 'inbound' AND c.status = 'linked'";
    } else if (filter === 'sent') {
      where = "m.direction = 'outbound'";
    } else if (filter === 'all') {
      where = "m.direction = 'outbound' OR COALESCE(c.status, 'unlinked') <> 'not_interested'";
    }
    return this.db.prepare(`
      SELECT m.gmail_id AS gmailId, m.thread_id AS threadId, m.direction,
             m.sender_email AS senderEmail, m.sender_name AS senderName,
             m.recipient, m.subject, m.snippet, m.received_at AS receivedAt,
             m.unread, COALESCE(c.status, 'unlinked') AS contactStatus,
             c.clan_code AS clanCode, c.display_name AS contactDisplayName
      FROM ravenpost_messages m
      LEFT JOIN ravenpost_contacts c ON lower(c.email) = lower(m.sender_email)
      WHERE ${where}
      ORDER BY datetime(m.received_at) DESC, m.gmail_id DESC
      LIMIT ?
    `).all(safeLimit).map(row => ({ ...row, unread: Boolean(row.unread) }));
  }

  markRead(gmailId) {
    this.db.prepare('UPDATE ravenpost_messages SET unread = 0 WHERE gmail_id = ?').run(String(gmailId));
    return this.getMessage(gmailId);
  }

  getCounts() {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN m.direction = 'inbound'
                  AND COALESCE(c.status, 'unlinked') <> 'not_interested'
                  AND m.unread = 1 THEN 1 ELSE 0 END) AS unread,
        SUM(CASE WHEN m.direction = 'inbound'
                  AND COALESCE(c.status, 'unlinked') = 'unlinked' THEN 1 ELSE 0 END) AS unknown,
        SUM(CASE WHEN m.direction = 'inbound'
                  AND c.status = 'not_interested' THEN 1 ELSE 0 END) AS ignored
      FROM ravenpost_messages m
      LEFT JOIN ravenpost_contacts c ON lower(c.email) = lower(m.sender_email)
    `).get() || {};
    return {
      unread: Number(row.unread || 0),
      unknown: Number(row.unknown || 0),
      ignored: Number(row.ignored || 0)
    };
  }

  createBackup() {
    this.db.exec('PRAGMA wal_checkpoint(FULL);');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `ravenpost-manual-${stamp}.sqlite`);
    fs.copyFileSync(this.dbPath, backupPath);
    return backupPath;
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = { RavenpostDatabase, normalizeEmail };
