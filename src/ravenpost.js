(() => {
  const api = window.ravenpost;
  if (!api) return;

  const state = {
    filter: 'inbox',
    messages: [],
    selectedId: null,
    selected: null,
    clans: [],
    settings: null,
    view: 'messages'
  };

  const $ = id => document.getElementById(id);
  const els = {
    sync: $('rpSyncButton'),
    refresh: $('rpRefreshButton'),
    headerStatus: $('rpHeaderStatus'),
    accountEmail: $('rpAccountEmail'),
    connectionDot: $('rpConnectionDot'),
    lastSync: $('rpLastSync'),
    unreadCount: $('rpUnreadCount'),
    unknownCount: $('rpUnknownCount'),
    ignoredCount: $('rpIgnoredCount'),
    listTitle: $('rpListTitle'),
    listEyebrow: $('rpListEyebrow'),
    list: $('rpMessageList'),
    emptyDetail: $('rpEmptyDetail'),
    detail: $('rpMessageDetail'),
    detailType: $('rpDetailType'),
    detailSubject: $('rpDetailSubject'),
    detailSender: $('rpDetailSender'),
    detailEmail: $('rpDetailEmail'),
    detailDate: $('rpDetailDate'),
    detailClan: $('rpDetailClan'),
    unknownBanner: $('rpUnknownBanner'),
    ignoredBanner: $('rpIgnoredBanner'),
    clanSelect: $('rpClanSelect'),
    contactType: $('rpContactType'),
    newClan: $('rpNewClan'),
    directory: $('rpContactDirectory'),
    createClan: $('rpCreateClanButton'),
    replyButton: $('rpReplyButton'),
    replyAllButton: $('rpReplyAllButton'),
    replyRecipients: $('rpReplyRecipients'),
    replyCc: $('rpReplyCc'),
    linkClan: $('rpLinkClanButton'),
    ignoreSender: $('rpIgnoreSenderButton'),
    restoreSender: $('rpRestoreSenderButton'),
    body: $('rpMessageBody'),
    replySection: $('rpReplySection'),
    replyTo: $('rpReplyTo'),
    replyBody: $('rpReplyBody'),
    replyStatus: $('rpReplyStatus'),
    sendReply: $('rpSendReplyButton'),
    composeButton: $('rpComposeButton'),
    composePanel: $('rpComposePanel'),
    composeTo: $('rpComposeTo'),
    composeSubject: $('rpComposeSubject'),
    composeBody: $('rpComposeBody'),
    composeStatus: $('rpComposeStatus'),
    sendCompose: $('rpSendComposeButton'),
    settingsButton: $('rpSettingsButton'),
    settingsPanel: $('rpSettingsPanel'),
    settingsConnection: $('rpSettingsConnection'),
    clientId: $('rpClientId'),
    clientSecret: $('rpClientSecret'),
    pollSeconds: $('rpPollSeconds'),
    includedAddresses: $('rpIncludedAddresses'),
    saveAddresses: $('rpSaveAddressesButton'),
    notifications: $('rpNotificationsEnabled'),
    sound: $('rpSoundEnabled'),
    credentialNote: $('rpCredentialStorageNote'),
    saveSettings: $('rpSaveSettingsButton'),
    saveDelivery: $('rpSaveDeliveryButton'),
    connect: $('rpConnectButton'),
    disconnect: $('rpDisconnectButton'),
    settingsStatus: $('rpSettingsStatus'),
    testRaven: $('rpTestRavenButton'),
    openGoogleConsole: $('rpOpenGoogleConsoleButton'),
    backup: $('rpBackupButton')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function displayDate(value, includeTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay && !includeTime) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString([], includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { day: '2-digit', month: 'short' });
  }

  function senderLabel(message) {
    if (message.contactDisplayName) return message.contactDisplayName;
    if (message.senderName) return message.senderName;
    return message.senderEmail || message.recipient || 'Unknown';
  }

  function setHeaderStatus(text, tone = '') {
    els.headerStatus.textContent = text || '';
    els.headerStatus.dataset.tone = tone;
  }

  function showPanel(name) {
    state.view = name;
    els.emptyDetail.classList.toggle('hidden', !['empty', 'messages'].includes(name));
    els.detail.classList.toggle('hidden', name !== 'message');
    els.composePanel.classList.toggle('hidden', name !== 'compose');
    els.settingsPanel.classList.toggle('hidden', name !== 'settings');
    document.querySelectorAll('.rp-nav-item[data-filter]').forEach(button => {
      button.classList.toggle('active', name === 'messages' && button.dataset.filter === state.filter);
    });
    els.settingsButton.classList.toggle('active', name === 'settings');
  }

  async function loadSettings() {
    state.settings = await api.getSettings();
    const s = state.settings;
    els.accountEmail.textContent = s.accountEmail || (s.connected ? 'Connected' : 'Not connected');
    els.connectionDot.classList.toggle('connected', Boolean(s.connected));
    els.lastSync.textContent = s.connected
      ? (s.lastSyncAt ? `Last raven check ${displayDate(s.lastSyncAt, true)}` : 'Connected · awaiting first sync')
      : 'Gmail not connected';
    els.settingsConnection.textContent = s.connected
      ? (s.accountEmail ? `Connected · ${s.accountEmail}` : 'Connected')
      : 'Not connected';
    els.settingsConnection.classList.toggle('offline', !s.connected);
    els.clientId.value = s.clientId || '';
    els.clientSecret.value = '';
    els.clientSecret.placeholder = s.hasClientSecret
      ? 'Saved securely · leave blank to keep'
      : 'Paste OAuth client secret';
    els.includedAddresses.value = s.includedAddresses || '';
    els.pollSeconds.value = String(s.pollSeconds || 60);
    if (!els.pollSeconds.value) els.pollSeconds.value = '60';
    els.notifications.checked = Boolean(s.notificationsEnabled);
    els.sound.checked = Boolean(s.soundEnabled);
    els.disconnect.disabled = !s.connected;
    els.sync.disabled = !s.connected;
    els.credentialNote.textContent = s.storageProtected
      ? 'Client secret and Google refresh token are protected using your operating system credential storage.'
      : 'Protected credential storage is unavailable. Avoid using this app profile on a shared computer.';
    return s;
  }

  async function loadCounts() {
    const counts = await api.getCounts();
    els.unreadCount.textContent = String(counts.unread || 0);
    els.unknownCount.textContent = String(counts.unknown || 0);
    els.ignoredCount.textContent = String(counts.ignored || 0);
  }

  function renderClans() {
    const current = els.clanSelect.value;
    els.clanSelect.innerHTML = '<option value="">Choose clan…</option>' +
      state.clans.map(clan =>
        `<option value="${escapeHtml(clan.code)}">${escapeHtml(clan.label)}${clan.currentHex ? ` · ${escapeHtml(clan.currentHex)}` : ''}</option>`
      ).join('');
    if (state.clans.some(clan => clan.code === current)) els.clanSelect.value = current;
  }

  async function loadClans() {
    state.clans = await api.listClans();
    renderClans();
  }

  async function loadDirectory() {
    const contacts = await api.listContacts();
    const included = new Set(String(state.settings?.includedAddresses || '').split(/\s+/).filter(Boolean));
    els.directory.innerHTML = contacts.filter(c => included.has(c.email)).map((c, i) => `
      <div class="rp-link-actions" style="margin:8px 0;flex-wrap:wrap">
        <label style="min-width:180px"><strong>${escapeHtml(c.displayName || c.email)}</strong><span style="display:block;font-size:11px">${escapeHtml(c.email)}</span></label>
        <select data-contact-type="${i}">
          <option value="Clan" ${c.contactType === 'Clan' ? 'selected' : ''}>Clan</option>
          <option value="GM" ${c.contactType === 'GM' ? 'selected' : ''}>GM</option>
          <option value="Other" ${c.contactType === 'Other' ? 'selected' : ''}>Other</option>
        </select>
        <select data-contact-clan="${i}">
          <option value="">Choose clan…</option>
          ${state.clans.map(cl => `<option value="${escapeHtml(cl.code)}" ${cl.code === c.clanCode ? 'selected' : ''}>${escapeHtml(cl.label)}</option>`).join('')}
        </select>
        <button class="button" data-save-contact="${i}">Save</button>
      </div>`).join('') || '<p>No approved contacts imported yet.</p>';
    const visible = contacts.filter(c => included.has(c.email));
    els.directory.querySelectorAll('[data-save-contact]').forEach(button => button.addEventListener('click', async () => {
      const i = Number(button.dataset.saveContact);
      const type = els.directory.querySelector('[data-contact-type="' + i + '"]').value;
      const clanCode = els.directory.querySelector('[data-contact-clan="' + i + '"]').value;
      try {
        await api.updateContact(visible[i].email, { status: 'linked', contactType: type, clanCode });
        await loadDirectory();
      } catch (error) { setHeaderStatus(error.message, 'error'); }
    }));
  }

  function folderTitle(filter) {
    return ({
      inbox: 'Inbox',
      unknown: 'Unknown Senders',
      linked: 'Linked Clans / Tribes',
      sent: 'Sent Ravens',
      ignored: 'Not Interested',
      all: 'All Mail'
    })[filter] || 'Inbox';
  }

  function renderMessages() {
    els.listTitle.textContent = folderTitle(state.filter);
    els.listEyebrow.textContent = state.filter === 'sent' ? 'OUTGOING RAVENS' : 'RAVENPOST';
    if (!state.messages.length) {
      els.list.innerHTML = `<div class="rp-empty">${
        state.filter === 'unknown' ? 'No unknown senders.' :
        state.filter === 'ignored' ? 'No senders are marked Not Interested.' :
        state.filter === 'sent' ? 'No ravens sent yet.' :
        'No ravens in this folder.'
      }</div>`;
      return;
    }
    els.list.innerHTML = state.messages.map(message => {
      const outgoing = message.direction === 'outbound';
      const sender = outgoing ? `To: ${message.recipient || 'Unknown'}` : senderLabel(message);
      const pill = message.contactStatus === 'linked'
        ? `<span class="rp-mini-pill">${escapeHtml(message.clanCode || 'Linked')}</span>`
        : (!outgoing && message.contactStatus === 'unlinked'
          ? '<span class="rp-mini-pill unknown">Unknown</span>' : '');
      return `
        <button class="rp-message-row ${message.unread ? 'unread' : ''} ${state.selectedId === message.gmailId ? 'selected' : ''}"
                data-message-id="${escapeHtml(message.gmailId)}">
          <div class="rp-row-top">
            <span class="rp-row-sender">${escapeHtml(sender)}</span>
            <span class="rp-row-date">${escapeHtml(displayDate(message.receivedAt))}</span>
          </div>
          <div class="rp-row-subject">${pill}<strong>${escapeHtml(message.subject || '(No subject)')}</strong></div>
          <div class="rp-row-snippet">${escapeHtml(message.snippet || '')}</div>
        </button>`;
    }).join('');

    els.list.querySelectorAll('[data-message-id]').forEach(button => {
      button.addEventListener('click', () => selectMessage(button.dataset.messageId));
    });
  }

  async function loadMessages({ preserveSelection = true } = {}) {
    const previous = preserveSelection ? state.selectedId : null;
    state.messages = await api.listMessages(state.filter, 250);
    if (previous && !state.messages.some(message => message.gmailId === previous)) {
      state.selectedId = null;
      state.selected = null;
      showPanel('empty');
    }
    renderMessages();
  }

  function renderContactAction(message) {
    const inbound = message.direction !== 'outbound';
    const status = message.contactStatus || 'unlinked';
    els.unknownBanner.classList.toggle('hidden', !inbound || status === 'not_interested');
    if (inbound) {
      els.contactType.value = message.contactType || 'Clan';
      els.clanSelect.value = message.clanCode || '';
      els.contactType.dispatchEvent(new Event('change'));
    }
    els.ignoredBanner.classList.toggle('hidden', !inbound || status !== 'not_interested');
    const linked = inbound && status === 'linked';
    els.detailClan.classList.toggle('hidden', !linked);
    els.detailClan.textContent = linked ? (message.contactType === 'Clan' ? `Clan ${message.clanCode}` : message.contactType) : '';
  }

  async function selectMessage(gmailId) {
    state.selectedId = gmailId;
    renderMessages();
    const message = await api.getMessage(gmailId);
    if (!message) return;
    state.selected = message;
    showPanel('message');

    const outgoing = message.direction === 'outbound';
    els.detailType.textContent = outgoing ? 'OUTGOING RAVEN' : 'INCOMING RAVEN';
    els.detailSubject.textContent = message.subject || '(No subject)';
    els.detailSender.textContent = outgoing ? `To ${message.recipient}` : senderLabel(message);
    els.detailEmail.textContent = outgoing ? (message.senderEmail || '') : (message.senderEmail || '');
    els.detailDate.textContent = displayDate(message.receivedAt, true);
    els.body.textContent = message.bodyText || message.snippet || '(No message body)';
    els.replySection.classList.toggle('hidden', outgoing);
    els.replyTo.textContent = outgoing ? '' : message.senderEmail;
    if (!outgoing) setReplyMode(false);
    els.replyBody.value = '';
    els.replyStatus.textContent = '';
    renderContactAction(message);

    if (message.unread) {
      await api.markRead(gmailId);
      state.selected.unread = false;
      const row = state.messages.find(item => item.gmailId === gmailId);
      if (row) row.unread = false;
      renderMessages();
      await loadCounts();
    }
  }

  async function refreshAll() {
    await Promise.all([loadSettings(), loadCounts(), loadClans()]);
    await loadDirectory();
    await loadMessages();
  }

  async function chooseFilter(filter) {
    state.filter = filter;
    state.selectedId = null;
    state.selected = null;
    showPanel('messages');
    els.emptyDetail.classList.remove('hidden');
    els.detail.classList.add('hidden');
    await loadMessages({ preserveSelection: false });
  }

  async function updateCurrentContact(update) {
    if (!state.selected?.senderEmail) return;
    try {
      await api.updateContact(state.selected.senderEmail, update);
      await Promise.all([loadCounts(), loadMessages({ preserveSelection: false })]);
      state.selected = await api.getMessage(state.selectedId);
      if (state.selected) {
        renderContactAction(state.selected);
        renderMessages();
      } else {
        state.selectedId = null;
        showPanel('empty');
      }
    } catch (error) {
      setHeaderStatus(error.message, 'error');
    }
  }

  async function syncGmail() {
    if (!state.settings?.connected) {
      openSettings();
      els.settingsStatus.textContent = 'Add your Google OAuth credentials and connect Gmail first.';
      return;
    }
    els.sync.disabled = true;
    setHeaderStatus('Calling the ravens…');
    try {
      const result = await api.syncNow();
      const count = result.newMessages?.length || 0;
      setHeaderStatus(result.firstSync
        ? `Matching Gmail history imported · ${count} messages`
        : (count ? `${count} new raven${count === 1 ? '' : 's'} arrived` : 'Ravenpost is up to date'));
      await refreshAll();
    } catch (error) {
      setHeaderStatus(error.message, 'error');
    } finally {
      els.sync.disabled = !state.settings?.connected;
    }
  }

  function openCompose() {
    showPanel('compose');
    els.composeStatus.textContent = '';
    els.composeTo.focus();
  }

  function openSettings() {
    showPanel('settings');
    els.settingsStatus.textContent = '';
    refreshAll().catch(error => {
      els.settingsStatus.textContent = error.message;
    });
  }

  async function saveOauthSettings() {
    els.settingsStatus.textContent = 'Saving…';
    try {
      state.settings = await api.saveSettings({
        clientId: els.clientId.value,
        clientSecret: els.clientSecret.value
      });
      els.clientSecret.value = '';
      await loadSettings();
      els.settingsStatus.textContent = 'OAuth settings saved locally.';
      return true;
    } catch (error) {
      els.settingsStatus.textContent = error.message;
      return false;
    }
  }

  async function saveDeliverySettings() {
    els.settingsStatus.textContent = 'Saving…';
    try {
      state.settings = await api.saveSettings({
        pollSeconds: Number(els.pollSeconds.value),
        notificationsEnabled: els.notifications.checked,
        soundEnabled: els.sound.checked
      });
      await loadSettings();
      els.settingsStatus.textContent = 'Automatic delivery settings saved.';
    } catch (error) {
      els.settingsStatus.textContent = error.message;
    }
  }

  async function saveIncludedAddresses() {
    els.settingsStatus.textContent = 'Saving included addresses…';
    try {
      state.settings = await api.saveSettings({ includedAddresses: els.includedAddresses.value });
      els.settingsStatus.textContent = 'Addresses saved. Importing matching history…';
      if (state.settings.connected) {
        const result = await api.syncNow();
        await refreshAll();
        els.settingsStatus.textContent = 'History imported. ' + (result.newMessages?.length || 0) + ' messages added.';
      } else {
        els.settingsStatus.textContent = 'Addresses saved. Connect Gmail to import their history.';
      }
    } catch (error) {
      els.settingsStatus.textContent = error.message;
    }
  }

  async function connectGmail() {
    const saved = await saveOauthSettings();
    if (!saved) return;
    els.connect.disabled = true;
    els.settingsStatus.textContent = 'Opening Google sign-in in your browser…';
    try {
      const result = await api.authorize();
      state.settings = result.settings;
      await refreshAll();
      els.settingsStatus.textContent = 'Gmail connected. Approved correspondence has been imported quietly; future new mail will alert you.';
    } catch (error) {
      els.settingsStatus.textContent = error.message;
    } finally {
      els.connect.disabled = false;
    }
  }

  async function disconnectGmail() {
    if (!confirm('Disconnect Ravenpost from Gmail? Local message history and Clan / Tribe links will remain.')) return;
    els.settingsStatus.textContent = 'Disconnecting…';
    try {
      state.settings = await api.disconnect();
      await loadSettings();
      els.settingsStatus.textContent = 'Gmail disconnected. Local Ravenpost history was kept.';
    } catch (error) {
      els.settingsStatus.textContent = error.message;
    }
  }

  function parseEmails(value) {
    const matches = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches.map(email => email.toLowerCase()))];
  }

  function setReplyMode(all) {
    const message = state.selected;
    if (!message) return;
    const own = String(state.settings?.accountEmail || '').toLowerCase();
    const from = message.senderEmail.toLowerCase();
    const otherTo = parseEmails(message.recipient).filter(email => email !== own && email !== from);
    const cc = parseEmails(message.cc).filter(email => email !== own && email !== from && !otherTo.includes(email));
    els.replyRecipients.value = from;
    els.replyCc.value = all ? [...otherTo, ...cc].join(', ') : '';
    els.replyButton.classList.toggle('accent', !all);
    els.replyAllButton.classList.toggle('accent', all);
  }

  async function sendReply() {
    if (!state.selected || state.selected.direction === 'outbound') return;
    const bodyText = els.replyBody.value.trim();
    if (!bodyText) {
      els.replyStatus.textContent = 'Write a reply first.';
      return;
    }
    const to = parseEmails(els.replyRecipients.value);
    const cc = parseEmails(els.replyCc.value).filter(address => !to.includes(address));
    if (to.length !== 1) {
      els.replyStatus.textContent = 'Choose exactly one To recipient; put additional recipients in CC.';
      return;
    }
    if (![...to, ...cc].length || !confirm('Send Raven to: ' + to.concat(cc).join(', ') + '?')) return;
    els.sendReply.disabled = true;
    els.replyStatus.textContent = 'Sending raven…';
    try {
      await api.sendMessage({
        to: to[0],
        cc: cc.join(', '),
        subject: state.selected.subject || '(No subject)',
        bodyText,
        replyToGmailId: state.selected.gmailId
      });
      els.replyBody.value = '';
      els.replyStatus.textContent = 'Raven sent.';
      await loadCounts();
    } catch (error) {
      els.replyStatus.textContent = error.message;
    } finally {
      els.sendReply.disabled = false;
    }
  }

  async function sendCompose() {
    const payload = {
      to: els.composeTo.value.trim(),
      subject: els.composeSubject.value.trim(),
      bodyText: els.composeBody.value.trim()
    };
    if (!payload.to || !payload.bodyText) {
      els.composeStatus.textContent = 'Recipient and message are required.';
      return;
    }
    els.sendCompose.disabled = true;
    els.composeStatus.textContent = 'Sending raven…';
    try {
      await api.sendMessage(payload);
      els.composeStatus.textContent = 'Raven sent.';
      els.composeTo.value = '';
      els.composeSubject.value = '';
      els.composeBody.value = '';
      state.filter = 'sent';
      await chooseFilter('sent');
    } catch (error) {
      els.composeStatus.textContent = error.message;
    } finally {
      els.sendCompose.disabled = false;
    }
  }

  async function testRavenCall() {
    try {
      const played = await window.RavenpostSound?.play?.();
      if (!played) els.settingsStatus.textContent = 'The raven call could not play on this device.';
    } catch (error) {
      els.settingsStatus.textContent = error.message;
    }
  }

  document.querySelectorAll('.rp-nav-item[data-filter]').forEach(button => {
    button.addEventListener('click', () => chooseFilter(button.dataset.filter));
  });
  els.sync.addEventListener('click', syncGmail);
  els.refresh.addEventListener('click', () => loadMessages());
  els.composeButton.addEventListener('click', openCompose);
  els.settingsButton.addEventListener('click', openSettings);
  els.linkClan.addEventListener('click', () => updateCurrentContact({
    status: 'linked',
    contactType: els.contactType.value,
    clanCode: els.clanSelect.value
  }));
  els.contactType.addEventListener('change', () => {
    const isClan = els.contactType.value === 'Clan';
    els.clanSelect.classList.toggle('hidden', !isClan);
    els.newClan.classList.toggle('hidden', !isClan);
    els.createClan.classList.toggle('hidden', !isClan);
  });
  els.createClan.addEventListener('click', async () => {
    try {
      state.clans = await api.createClan(els.newClan.value);
      renderClans();
      await loadDirectory();
      els.clanSelect.value = els.newClan.value.trim();
      els.newClan.value = '';
    } catch (error) { setHeaderStatus(error.message, 'error'); }
  });
  els.replyButton.addEventListener('click', () => setReplyMode(false));
  els.replyAllButton.addEventListener('click', () => setReplyMode(true));
  els.ignoreSender.addEventListener('click', () => updateCurrentContact({ status: 'not_interested' }));
  els.restoreSender.addEventListener('click', () => updateCurrentContact({ status: 'unlinked' }));
  els.sendReply.addEventListener('click', sendReply);
  els.sendCompose.addEventListener('click', sendCompose);
  els.saveSettings.addEventListener('click', saveOauthSettings);
  els.saveDelivery.addEventListener('click', saveDeliverySettings);
  els.saveAddresses.addEventListener('click', saveIncludedAddresses);
  els.connect.addEventListener('click', connectGmail);
  els.disconnect.addEventListener('click', disconnectGmail);
  els.testRaven.addEventListener('click', testRavenCall);
  els.openGoogleConsole.addEventListener('click', () =>
    api.openExternal('https://console.cloud.google.com/apis/credentials')
  );
  els.backup.addEventListener('click', async () => {
    try {
      const path = await api.createBackup();
      els.settingsStatus.textContent = `Ravenpost backup created: ${path}`;
    } catch (error) {
      els.settingsStatus.textContent = error.message;
    }
  });

  api.onNewMail(async payload => {
    setHeaderStatus(`New raven from ${payload.senderName || payload.senderEmail || 'unknown sender'}`);
    await Promise.all([loadCounts(), loadMessages()]);
  });

  api.onSyncStatus(async payload => {
    if (payload.state === 'error') {
      setHeaderStatus(`Ravenpost sync failed: ${payload.message}`, 'error');
      return;
    }
    await loadCounts();
    if (payload.newCount > 0) await loadMessages();
    await loadSettings();
  });

  api.onContactsChanged(async () => {
    await Promise.all([loadCounts(), loadMessages()]);
  });

  (async () => {
    try {
      await refreshAll();
      showPanel('messages');
    } catch (error) {
      setHeaderStatus(error.message, 'error');
    }
  })();
})();
