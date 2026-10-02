const http = require('http');
const crypto = require('crypto');
const { safeStorage, shell } = require('electron');

const OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = text.length % 4 ? '='.repeat(4 - (text.length % 4)) : '';
  return Buffer.from(text + padding, 'base64').toString('utf8');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getHeader(payload, name) {
  const target = String(name || '').toLowerCase();
  const header = (payload?.headers || []).find(
    item => String(item?.name || '').toLowerCase() === target
  );
  return header?.value || '';
}

function parseAddress(value) {
  const text = String(value || '').trim();
  const angle = text.match(/^(?:"?([^"]*?)"?\s*)?<([^<>@\s]+@[^<>@\s]+)>/);
  if (angle) {
    return {
      name: String(angle[1] || '').trim(),
      email: String(angle[2] || '').trim().toLowerCase()
    };
  }
  const match = text.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return {
    name: '',
    email: match ? match[1].toLowerCase() : text.toLowerCase()
  };
}

function findBodyParts(part, result = { plain: [], html: [] }) {
  if (!part) return result;
  const mime = String(part.mimeType || '').toLowerCase();
  const data = part.body?.data;
  if (data) {
    if (mime === 'text/plain') result.plain.push(decodeBase64Url(data));
    else if (mime === 'text/html') result.html.push(decodeBase64Url(data));
  }
  for (const child of part.parts || []) findBodyParts(child, result);
  return result;
}

function bodyTextFromPayload(payload) {
  const parts = findBodyParts(payload);
  if (parts.plain.length) return parts.plain.join('\n\n').trim();
  if (parts.html.length) return stripHtml(parts.html.join('\n'));
  if (payload?.body?.data) return decodeBase64Url(payload.body.data).trim();
  return '';
}

function gmailMessageToRecord(message) {
  const payload = message?.payload || {};
  const sender = parseAddress(getHeader(payload, 'From'));
  const receivedAt = message?.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : (new Date(getHeader(payload, 'Date')).toString() === 'Invalid Date'
      ? new Date().toISOString()
      : new Date(getHeader(payload, 'Date')).toISOString());
  return {
    gmailId: String(message.id),
    threadId: String(message.threadId || ''),
    direction: 'inbound',
    senderEmail: sender.email,
    senderName: sender.name,
    recipient: getHeader(payload, 'To'),
    subject: getHeader(payload, 'Subject') || '(No subject)',
    snippet: String(message.snippet || ''),
    bodyText: bodyTextFromPayload(payload),
    receivedAt,
    unread: Array.isArray(message.labelIds) && message.labelIds.includes('UNREAD'),
    messageIdHeader: getHeader(payload, 'Message-ID'),
    referencesHeader: getHeader(payload, 'References'),
    inReplyToHeader: getHeader(payload, 'In-Reply-To')
  };
}

function safeHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function encodedSubject(value) {
  const subject = safeHeader(value);
  return /[^\x20-\x7E]/.test(subject)
    ? `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
    : subject;
}

function buildRawMessage({ from, to, subject, bodyText, inReplyTo = '', references = '' }) {
  const headers = [
    `From: ${safeHeader(from)}`,
    `To: ${safeHeader(to)}`,
    `Subject: ${encodedSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit'
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${safeHeader(inReplyTo)}`);
  if (references) headers.push(`References: ${safeHeader(references)}`);
  return base64Url(`${headers.join('\r\n')}\r\n\r\n${String(bodyText || '').replace(/\r?\n/g, '\r\n')}`);
}

class RavenpostService {
  constructor(database, resultsDatabase = null) {
    this.db = database;
    this.resultsDatabase = resultsDatabase;
  }

  protect(value) {
    if (!value) return '';
    if (safeStorage.isEncryptionAvailable()) {
      return `safe:${safeStorage.encryptString(String(value)).toString('base64')}`;
    }
    return `b64:${Buffer.from(String(value), 'utf8').toString('base64')}`;
  }

  unprotect(value) {
    const text = String(value || '');
    if (!text) return '';
    if (text.startsWith('safe:')) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Windows protected storage is unavailable for the saved Ravenpost credential.');
      }
      return safeStorage.decryptString(Buffer.from(text.slice(5), 'base64'));
    }
    if (text.startsWith('b64:')) return Buffer.from(text.slice(4), 'base64').toString('utf8');
    return text;
  }

  getSettings() {
    const accountEmail = this.db.getSetting('account_email', '');
    return {
      clientId: this.db.getSetting('client_id', ''),
      hasClientSecret: Boolean(this.db.getSetting('client_secret', '')),
      accountEmail,
      pollSeconds: Math.max(30, Number(this.db.getSetting('poll_seconds', '60')) || 60),
      notificationsEnabled: this.db.getSetting('notifications_enabled', '1') !== '0',
      soundEnabled: this.db.getSetting('sound_enabled', '1') !== '0',
      connected: Boolean(this.db.getSetting('refresh_token', '')),
      lastSyncAt: this.db.getSetting('last_sync_at', ''),
      initialSyncComplete: this.db.getSetting('initial_sync_complete', '0') === '1',
      storageProtected: safeStorage.isEncryptionAvailable()
    };
  }

  saveSettings(input = {}) {
    if (Object.prototype.hasOwnProperty.call(input, 'clientId')) {
      this.db.setSetting('client_id', String(input.clientId || '').trim());
    }
    if (String(input.clientSecret || '').trim()) {
      this.db.setSetting('client_secret', this.protect(String(input.clientSecret).trim()));
    }
    if (input.clearClientSecret) this.db.deleteSetting('client_secret');
    if (Object.prototype.hasOwnProperty.call(input, 'pollSeconds')) {
      const seconds = Math.max(30, Math.min(3600, Number(input.pollSeconds) || 60));
      this.db.setSetting('poll_seconds', String(seconds));
    }
    if (Object.prototype.hasOwnProperty.call(input, 'notificationsEnabled')) {
      this.db.setSetting('notifications_enabled', input.notificationsEnabled ? '1' : '0');
    }
    if (Object.prototype.hasOwnProperty.call(input, 'soundEnabled')) {
      this.db.setSetting('sound_enabled', input.soundEnabled ? '1' : '0');
    }
    return this.getSettings();
  }

  clientCredentials() {
    const clientId = this.db.getSetting('client_id', '').trim();
    const encrypted = this.db.getSetting('client_secret', '');
    const clientSecret = encrypted ? this.unprotect(encrypted) : '';
    if (!clientId) throw new Error('Add your Google OAuth Client ID in Ravenpost Settings first.');
    return { clientId, clientSecret };
  }

  async requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : {}; }
    catch (_) { payload = { raw: text }; }
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.error_description || payload?.error || text || response.statusText;
      throw new Error(`Google API ${response.status}: ${detail}`);
    }
    return payload;
  }

  async exchangeToken(params) {
    return this.requestJson(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params)
    });
  }

  saveTokenPayload(token) {
    if (token.access_token) this.db.setSetting('access_token', this.protect(token.access_token));
    if (token.refresh_token) this.db.setSetting('refresh_token', this.protect(token.refresh_token));
    if (token.expires_in) {
      this.db.setSetting('access_token_expires_at', String(Date.now() + Number(token.expires_in) * 1000 - 30_000));
    }
  }

  async authorize() {
    const { clientId, clientSecret } = this.clientCredentials();
    const state = base64Url(crypto.randomBytes(24));
    const verifier = base64Url(crypto.randomBytes(48));
    const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
    const accountEmail = this.db.getSetting('account_email', '');

    return new Promise((resolve, reject) => {
      let finished = false;
      let timeout = null;
      const server = http.createServer(async (req, res) => {
        try {
          const requestUrl = new URL(req.url, `http://127.0.0.1:${server.address().port}`);
          if (requestUrl.pathname !== '/oauth2callback') {
            res.writeHead(404).end('Not found');
            return;
          }
          const returnedState = requestUrl.searchParams.get('state');
          const code = requestUrl.searchParams.get('code');
          const oauthError = requestUrl.searchParams.get('error');
          if (returnedState !== state) throw new Error('Google sign-in state did not match. Please try connecting again.');
          if (oauthError) throw new Error(`Google sign-in was not completed: ${oauthError}`);
          if (!code) throw new Error('Google did not return an authorization code.');

          const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;
          const params = {
            code,
            client_id: clientId,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: verifier
          };
          if (clientSecret) params.client_secret = clientSecret;
          const token = await this.exchangeToken(params);
          this.saveTokenPayload(token);

          const profile = await this.gmailJson('/users/me/profile');
          if (profile.emailAddress) this.db.setSetting('account_email', profile.emailAddress);
          this.db.setSetting('initial_sync_complete', '0');

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<!doctype html><title>Ravenpost connected</title><body style="font-family:system-ui;background:#101820;color:#eef;padding:40px"><h1>Ravenpost is connected.</h1><p>You can close this tab and return to TribeNet Manager.</p></body>');
          finished = true;
          if (timeout) clearTimeout(timeout);
          server.close();
          resolve(this.getSettings());
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Ravenpost could not connect: ${error.message}`);
          finished = true;
          if (timeout) clearTimeout(timeout);
          server.close();
          reject(error);
        }
      });

      server.on('error', error => {
        if (!finished) {
          finished = true;
          if (timeout) clearTimeout(timeout);
          reject(error);
        }
      });

      server.listen(0, '127.0.0.1', async () => {
        const port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
        const authUrl = new URL(OAUTH_AUTHORIZE_URL);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES.join(' '));
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('include_granted_scopes', 'true');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        if (accountEmail) authUrl.searchParams.set('login_hint', accountEmail);
        try {
          await shell.openExternal(authUrl.toString());
        } catch (error) {
          server.close();
          reject(error);
          return;
        }
        timeout = setTimeout(() => {
          if (finished) return;
          finished = true;
          server.close();
          reject(new Error('Google sign-in timed out. Start Connect Gmail again.'));
        }, 180_000);
      });
    });
  }

  async disconnect() {
    let token = '';
    try {
      const encryptedRefresh = this.db.getSetting('refresh_token', '');
      const encryptedAccess = this.db.getSetting('access_token', '');
      token = encryptedRefresh ? this.unprotect(encryptedRefresh) : (encryptedAccess ? this.unprotect(encryptedAccess) : '');
      if (token) {
        await fetch(OAUTH_REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token })
        });
      }
    } catch (error) {
      console.warn('Ravenpost token revoke failed:', error.message);
    }
    for (const key of ['access_token', 'refresh_token', 'access_token_expires_at', 'account_email', 'last_sync_at', 'initial_sync_complete']) {
      this.db.deleteSetting(key);
    }
    return this.getSettings();
  }

  async accessToken() {
    const encryptedAccess = this.db.getSetting('access_token', '');
    const expiresAt = Number(this.db.getSetting('access_token_expires_at', '0')) || 0;
    if (encryptedAccess && Date.now() < expiresAt) return this.unprotect(encryptedAccess);

    const encryptedRefresh = this.db.getSetting('refresh_token', '');
    if (!encryptedRefresh) throw new Error('Ravenpost is not connected to Gmail yet.');
    const refreshToken = this.unprotect(encryptedRefresh);
    const { clientId, clientSecret } = this.clientCredentials();
    const params = {
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };
    if (clientSecret) params.client_secret = clientSecret;
    const token = await this.exchangeToken(params);
    this.saveTokenPayload(token);
    const refreshed = this.db.getSetting('access_token', '');
    if (!refreshed) throw new Error('Google did not return an access token.');
    return this.unprotect(refreshed);
  }

  async gmailJson(pathname, options = {}) {
    const token = await this.accessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    };
    return this.requestJson(`${GMAIL_API}${pathname}`, { ...options, headers });
  }

  async syncInbox() {
    const initialComplete = this.db.getSetting('initial_sync_complete', '0') === '1';
    const list = await this.gmailJson('/users/me/messages?' + new URLSearchParams({
      labelIds: 'INBOX',
      maxResults: initialComplete ? '75' : '100'
    }).toString());
    const ids = (list.messages || []).map(item => String(item.id));
    const newMessages = [];

    for (const id of ids.reverse()) {
      const existing = this.db.getMessage(id);
      if (existing) continue;
      const full = await this.gmailJson(`/users/me/messages/${encodeURIComponent(id)}?format=full`);
      const record = gmailMessageToRecord(full);
      if (!record.senderEmail) continue;
      this.db.ensureContact(record.senderEmail, record.senderName);
      const saved = this.db.upsertMessage(record);
      if (saved.inserted) newMessages.push(saved.message);
    }

    this.db.setSetting('last_sync_at', new Date().toISOString());
    this.db.setSetting('initial_sync_complete', '1');
    return {
      firstSync: !initialComplete,
      newMessages,
      settings: this.getSettings(),
      counts: this.db.getCounts()
    };
  }

  async sendMessage({ to, subject, bodyText, replyToGmailId = null }) {
    const recipient = String(to || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      throw new Error('Enter a valid recipient email address.');
    }
    const account = this.db.getSetting('account_email', '');
    if (!account) throw new Error('Connect Ravenpost to Gmail before sending mail.');

    let parent = null;
    let threadId = '';
    let finalSubject = String(subject || '').trim() || '(No subject)';
    let inReplyTo = '';
    let references = '';
    if (replyToGmailId) {
      parent = this.db.getMessage(replyToGmailId);
      if (!parent) throw new Error('The message being replied to is not available locally.');
      threadId = parent.threadId || '';
      if (!/^re:/i.test(finalSubject)) finalSubject = `Re: ${finalSubject}`;
      inReplyTo = parent.messageIdHeader || '';
      references = [parent.referencesHeader, parent.messageIdHeader].filter(Boolean).join(' ').trim();
    }

    const raw = buildRawMessage({
      from: account,
      to: recipient,
      subject: finalSubject,
      bodyText,
      inReplyTo,
      references
    });
    const payload = await this.gmailJson('/users/me/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) })
    });

    const now = new Date().toISOString();
    this.db.upsertMessage({
      gmailId: payload.id,
      threadId: payload.threadId || threadId,
      direction: 'outbound',
      senderEmail: account,
      senderName: 'Ravenpost',
      recipient,
      subject: finalSubject,
      snippet: String(bodyText || '').replace(/\s+/g, ' ').slice(0, 180),
      bodyText: String(bodyText || ''),
      receivedAt: now,
      unread: false
    });
    return this.db.getMessage(payload.id);
  }

  listClans() {
    if (!this.resultsDatabase) return [];
    const found = new Map();
    const turns = this.resultsDatabase.listTurns().slice().sort((a, b) => b.turnSort - a.turnSort);
    for (const turn of turns) {
      const detail = this.resultsDatabase.getTurn(turn.turnKey);
      for (const unit of detail?.units || []) {
        if (String(unit.unitType || '').toLowerCase() !== 'tribe') continue;
        const code = String(unit.unitCode || '').trim();
        if (!code || found.has(code)) continue;
        found.set(code, {
          code,
          label: `Tribe ${code}`,
          currentHex: unit.currentHex || null,
          lastSeenTurn: turn.turnKey
        });
      }
    }
    return [...found.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
}

module.exports = {
  RavenpostService,
  SCOPES,
  base64Url,
  decodeBase64Url,
  stripHtml,
  parseAddress,
  bodyTextFromPayload,
  gmailMessageToRecord,
  buildRawMessage
};
