/* ══════════════════════════════════════════════════════════════
   WhatsApp Chat Reader — renders parsed exports in a
   WhatsApp-style interface. Nothing leaves the browser.
   ══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const P = window.WCR;
  const { timeLabel, dayLabel, listStamp, shortDate, slug, RE_URL } = P;

  /* ─────────────── dom refs ─────────────── */
  const $ = (id) => document.getElementById(id);

  const el = {
    wa: document.querySelector('.wa'),
    fileInput: $('fileInput'),
    dropzone: $('dropzone'),
    dragOverlay: $('dragOverlay'),
    toast: $('toast'),

    addChatBtn: $('addChatBtn'),
    themeBtn: $('themeBtn'),
    themeIcon: $('themeIcon'),
    menuBtn: $('menuBtn'),
    menu: $('menu'),

    globalSearch: $('globalSearch'),
    clearGlobal: $('clearGlobal'),
    chips: $('chips'),
    chatList: $('chatList'),
    msgResults: $('msgResults'),
    listEmpty: $('listEmpty'),
    listEmptyAdd: $('listEmptyAdd'),

    intro: $('intro'),
    conv: $('conv'),
    backBtn: $('backBtn'),
    convId: $('convId'),
    convAvatar: $('convAvatar'),
    convName: $('convName'),
    convSub: $('convSub'),
    convSearchBtn: $('convSearchBtn'),
    convMenuBtn: $('convMenuBtn'),
    convMenu: $('convMenu'),

    scroller: $('scroller'),
    thread: $('thread'),
    renderNote: $('renderNote'),
    floatDate: $('floatDate'),
    toBottom: $('toBottom'),

    drawer: $('drawer'),
    drawerClose: $('drawerClose'),
    drawerTitle: $('drawerTitle'),
    drawerSearch: $('drawerSearch'),
    drawerInfo: $('drawerInfo'),
    convSearch: $('convSearch'),
    convSearchHint: $('convSearchHint'),
    convResults: $('convResults'),

    infoAvatar: $('infoAvatar'),
    infoName: $('infoName'),
    infoSub: $('infoSub'),
    meList: $('meList'),
    filterList: $('filterList'),
    stats: $('stats'),
    closeChatBtn: $('closeChatBtn'),
  };

  /* ─────────────── state ─────────────── */
  const state = {
    chats: [],
    activeId: null,
    chipFilter: 'all',
    globalQuery: '',
    convQuery: '',
    hits: [],
    hitPos: -1,
    nodes: [],       // message index -> element, for the active chat
    seps: [],        // {el, label, top}
    list: [],        // messages currently being rendered
    pending: 0,
    rafId: 0,
    hlRe: null,
    stickBottom: true,
    prevDay: null,
    prevSender: undefined,
    scrollHideT: 0,
  };

  let seq = 1;

  /* ═══════════════ small helpers ═══════════════ */

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nfmt = (n) => Number(n).toLocaleString();

  const NAME_COLORS_LIGHT = ['#e542a3', '#1f7aec', '#c26a00', '#0a9c8c', '#c4532d', '#7f66ff',
    '#b4506d', '#3c8f2f', '#a63dd5', '#0090cd', '#c1272d', '#6a7a00'];
  const NAME_COLORS_DARK = ['#ff9ad1', '#53bdeb', '#ffb84d', '#26d0b8', '#ff9e7a', '#b39dff',
    '#ff9ab0', '#8fdd6e', '#d99cff', '#7fd4ff', '#ff8a8a', '#c8d95e'];

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // WhatsApp gives each participant of a chat a distinct name colour,
  // so assign by position in the chat rather than by hashing the name.
  function colorFor(chat, name) {
    const pal = document.documentElement.dataset.theme === 'dark' ? NAME_COLORS_DARK : NAME_COLORS_LIGHT;
    const i = chat ? chat.senders.findIndex((s) => s.name === name) : -1;
    return pal[(i < 0 ? hashStr(String(name)) : i) % pal.length];
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const AV_PERSON = '<svg viewBox="0 0 212 212" width="100%" height="100%" aria-hidden="true"><path fill="currentColor" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0m0 40a35.6 35.6 0 1 1 0 71.2A35.6 35.6 0 0 1 106 40m0 138.7c-23.7 0-44.9-10.8-58.9-27.8 6.9-13.4 27.1-23.5 58.9-23.5s52 10.1 58.9 23.5c-14 17-35.2 27.8-58.9 27.8"/></svg>';
  const AV_GROUP = '<svg viewBox="0 0 212 212" width="100%" height="100%" aria-hidden="true"><path fill="currentColor" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0M81 52a26 26 0 1 1 0 52 26 26 0 0 1 0-52m50 8a21 21 0 1 1 0 42 21 21 0 0 1 0-42M81 116c24 0 43 8 46 19v18H35v-18c3-11 22-19 46-19m50 4c19 0 34 6 37 15v14h-24v-16c-2-5-7-9-13-13"/></svg>';

  const ICON_LOCK = '<svg class="lock" viewBox="0 0 10 12" width="9" height="11" aria-hidden="true"><path fill="currentColor" d="M5 0a3 3 0 0 0-3 3v2H1.5A1.5 1.5 0 0 0 0 6.5v4A1.5 1.5 0 0 0 1.5 12h7A1.5 1.5 0 0 0 10 10.5v-4A1.5 1.5 0 0 0 8.5 5H8V3a3 3 0 0 0-3-3m0 1.5A1.5 1.5 0 0 1 6.5 3v2h-3V3A1.5 1.5 0 0 1 5 1.5"/></svg>';
  const ICON_MEDIA = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/></svg>';
  const ICON_BAN = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A7.96 7.96 0 0 1 4 12m8 8c-1.8 0-3.5-.6-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20"/></svg>';
  const ICON_TICK = '<svg class="tick" viewBox="0 0 16 11" width="16" height="11" aria-hidden="true"><path fill="currentColor" d="M11.07.65a.5.5 0 0 0-.7.06L5.2 7.3 2.9 5.05a.5.5 0 1 0-.7.72l2.7 2.63a.5.5 0 0 0 .74-.06l5.5-6.98a.5.5 0 0 0-.07-.71m4 0a.5.5 0 0 0-.7.06L9.2 7.3l-.62-.6-.68.86.86.84a.5.5 0 0 0 .74-.06l5.5-6.98a.5.5 0 0 0-.07-.71"/></svg>';
  const ICON_STAR = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="m12 17.27 5.18 3.13-1.37-5.9 4.56-3.95-6.01-.51L12 4.5 9.64 10.04l-6.01.51 4.56 3.95-1.37 5.9z"/></svg>';

  function toast(msg, ms = 3200) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.toast.hidden = true; }, ms);
  }

  /* ═══════════════ text formatting ═══════════════ */

  const M0 = '\u0000', M1 = '\u0001';

  function inlineMd(s) {
    s = s.replace(/```([\s\S]+?)```/g, (_, c) => `<code>${c}</code>`);
    s = s.replace(/(^|[^\w`])`(?!\s)([^`\n]+?)`(?!\w)/g, (_, p, c) => `${p}<code>${c}</code>`);
    s = s.replace(/(^|[^\w*])\*(?!\s)([^*\n]*[^*\s])\*(?!\w)/g, (_, p, c) => `${p}<strong>${c}</strong>`);
    s = s.replace(/(^|[^\w_])_(?!\s)([^_\n]*[^_\s])_(?!\w)/g, (_, p, c) => `${p}<em>${c}</em>`);
    s = s.replace(/(^|[^\w~])~(?!\s)([^~\n]*[^~\s])~(?!\w)/g, (_, p, c) => `${p}<s>${c}</s>`);
    return s;
  }

  function linkify(s) {
    return s.replace(RE_URL, (m) => {
      let url = m, tail = '';
      const tm = /[.,!?;:)\]}'"]+$/.exec(url);
      if (tm) { tail = tm[0]; url = url.slice(0, -tail.length); }
      if (!url) return m;
      const href = /^www\./i.test(url) ? 'https://' + url : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>${tail}`;
    });
  }

  function formatText(raw, hlRe) {
    let s = String(raw);
    if (hlRe) s = s.replace(hlRe, (m) => M0 + m + M1);
    s = escapeHtml(s);
    s = inlineMd(s);
    s = linkify(s);
    return s.split(M0).join('<mark>').split(M1).join('</mark>');
  }

  function highlightPlain(raw, hlRe) {
    if (!hlRe) return escapeHtml(raw);
    return escapeHtml(String(raw).replace(hlRe, (m) => M0 + m + M1))
      .split(M0).join('<mark>').split(M1).join('</mark>');
  }

  const isJumbo = (s) => {
    if (!s || s.length > 12) return false;
    try { return /^(?:\p{Extended_Pictographic}|\uFE0F|\u200d|\s)+$/u.test(s); }
    catch (_) { return false; }
  };

  function makeRe(q) {
    const t = String(q || '').trim();
    if (!t) return null;
    try { return new RegExp(escapeRe(t), 'gi'); } catch (_) { return null; }
  }

  /* ═══════════════ prefs ═══════════════ */

  const savePref = (k, v) => { try { localStorage.setItem('wcr:' + k, v); } catch (_) {} };
  const loadPref = (k) => { try { return localStorage.getItem('wcr:' + k); } catch (_) { return null; } };
  const meKey = (c) => 'me:' + slug(c.name + '|' + c.file);

  /* ═══════════════ chat list ═══════════════ */

  const getChat = (id) => state.chats.find((c) => c.id === id) || null;
  const activeChat = () => getChat(state.activeId);

  // Drops WhatsApp's formatting markers so previews read like the rendered text.
  function stripMd(s) {
    return String(s)
      .replace(/```([\s\S]+?)```/g, '$1')
      .replace(/(^|[^\w`])`(?!\s)([^`\n]+?)`(?!\w)/g, '$1$2')
      .replace(/(^|[^\w*])\*(?!\s)([^*\n]*[^*\s])\*(?!\w)/g, '$1$2')
      .replace(/(^|[^\w_])_(?!\s)([^_\n]*[^_\s])_(?!\w)/g, '$1$2')
      .replace(/(^|[^\w~])~(?!\s)([^~\n]*[^~\s])~(?!\w)/g, '$1$2');
  }

  function previewOf(m) {
    if (m.del) return 'This message was deleted';
    if (m.om) return m.at || m.x || 'Media omitted';
    if (m.x) return stripMd(m.x).replace(/\s*\n+\s*/g, ' ');
    return m.sys ? '' : 'Message';
  }

  function chipMatch(c) {
    if (state.chipFilter === 'favourites') return c.starred;
    if (state.chipFilter === 'groups') return c.isGroup;
    return true;
  }

  function renderChatList() {
    const q = state.globalQuery.trim().toLowerCase();
    const hlRe = makeRe(q);

    let chats = state.chats.filter(chipMatch);
    if (q) {
      chats = chats.filter((c) => c.name.toLowerCase().includes(q) ||
        c.senders.some((s) => s.name.toLowerCase().includes(q)));
    }
    chats.sort((a, b) => b.lastT - a.lastT);

    el.chatList.textContent = '';

    if (q) {
      const h = document.createElement('div');
      h.className = 'res-head';
      h.textContent = 'Chats';
      el.chatList.appendChild(h);
      if (!chats.length) {
        const n = document.createElement('div');
        n.className = 'res-none';
        n.textContent = 'No chats found';
        el.chatList.appendChild(n);
      }
    }

    for (const c of chats) {
      const last = c.messages[c.messages.length - 1];
      const item = document.createElement('button');
      item.className = 'chat-item' + (c.id === state.activeId ? ' on' : '');
      item.dataset.id = c.id;
      item.innerHTML =
        `<span class="avatar av-me">${c.isGroup ? AV_GROUP : AV_PERSON}</span>` +
        '<span class="ci-body">' +
          '<span class="ci-row1">' +
            `<span class="ci-name">${highlightPlain(c.name, hlRe)}</span>` +
            `<span class="ci-time">${listStamp(last.d)}</span>` +
          '</span>' +
          '<span class="ci-row2">' +
            '<span class="ci-msg">' +
              (last.s && c.isGroup ? escapeHtml(last.s.split(' ')[0]) + ': ' : '') +
              escapeHtml(previewOf(last).slice(0, 140)) +
            '</span>' +
            (c.starred ? `<span class="ci-star">${ICON_STAR}</span>` : '') +
            `<span class="ci-count">${nfmt(c.messages.length)}</span>` +
          '</span>' +
        '</span>';
      item.addEventListener('click', () => openChat(c.id));
      el.chatList.appendChild(item);
    }

    el.listEmpty.hidden = state.chats.length > 0;
    renderGlobalMsgResults();
  }

  function renderGlobalMsgResults() {
    const q = state.globalQuery.trim().toLowerCase();
    el.msgResults.textContent = '';
    if (q.length < 2) { el.msgResults.hidden = true; return; }
    el.msgResults.hidden = false;

    const hlRe = makeRe(q);
    const out = [];
    let total = 0;
    for (const c of state.chats) {
      if (!chipMatch(c)) continue;
      for (const m of c.messages) {
        if (m.sys || !m.q.includes(q)) continue;
        total++;
        if (out.length < 60) out.push({ c, m });
      }
    }

    const head = document.createElement('div');
    head.className = 'res-head';
    head.textContent = total ? `Messages (${nfmt(total)})` : 'Messages';
    el.msgResults.appendChild(head);

    if (!total) {
      const n = document.createElement('div');
      n.className = 'res-none';
      n.textContent = 'No messages found';
      el.msgResults.appendChild(n);
      return;
    }

    for (const r of out) {
      const b = document.createElement('button');
      b.className = 'res-item';
      b.innerHTML =
        `<span class="res-top"><span class="res-chat">${escapeHtml(r.c.name)}</span>` +
        `<span class="res-time">${listStamp(r.m.d)}</span></span>` +
        `<span class="res-text">${escapeHtml(r.m.s || '')}: ` +
        `${highlightPlain(previewOf(r.m).slice(0, 220), hlRe)}</span>`;
      b.addEventListener('click', () => {
        openChat(r.c.id);
        el.convSearch.value = q;
        setConvQuery(q);
        openDrawer('search');
        jumpTo(r.m._gi);
      });
      el.msgResults.appendChild(b);
    }

    if (total > out.length) {
      const n = document.createElement('div');
      n.className = 'res-none';
      n.textContent = `Showing first ${out.length} of ${nfmt(total)} matches`;
      el.msgResults.appendChild(n);
    }
  }

  /* ═══════════════ conversation ═══════════════ */

  const visibleMessages = (c) =>
    c.hidden.size ? c.messages.filter((m) => !m.s || !c.hidden.has(m.s)) : c.messages;

  function openChat(id) {
    const c = getChat(id);
    if (!c) return;
    const changed = state.activeId !== id;
    state.activeId = id;
    el.wa.classList.add('open');
    el.intro.hidden = true;
    el.conv.hidden = false;
    if (changed) {
      el.drawer.hidden = true;
      el.convSearchBtn.classList.remove('on');
      el.convSearch.value = '';
      state.convQuery = '';
      state.hits = [];
      state.hitPos = -1;
    }
    renderChatList();
    renderConv();
    buildInfo();
  }

  function closeChat(id) {
    const i = state.chats.findIndex((c) => c.id === id);
    if (i < 0) return;
    state.chats.splice(i, 1);
    if (state.activeId === id) {
      state.activeId = null;
      cancelRender();
      el.thread.textContent = '';
      el.conv.hidden = true;
      el.intro.hidden = false;
      el.drawer.hidden = true;
      el.wa.classList.remove('open');
    }
    renderChatList();
  }

  function renderConv() {
    const c = activeChat();
    if (!c) return;

    el.convName.textContent = c.name;
    el.convAvatar.innerHTML = c.isGroup ? AV_GROUP : AV_PERSON;
    el.convAvatar.classList.add('av-me');
    el.convSub.textContent = c.isGroup
      ? c.senders.map((s) => s.name).join(', ')
      : `${shortDate(c.messages[0].d)} – ${shortDate(c.messages[c.messages.length - 1].d)} · ${nfmt(c.messages.length)} messages`;
    const starItem = el.convMenu.querySelector('[data-act="star"]');
    if (starItem) starItem.textContent = c.starred ? 'Remove from favourites' : 'Add to favourites';

    cancelRender();
    el.thread.textContent = '';
    state.nodes = [];
    state.seps = [];
    state.pending = 0;
    state.list = visibleMessages(c);
    state.prevDay = null;
    state.prevSender = undefined;
    state.hlRe = makeRe(state.convQuery);
    state.stickBottom = true;   // WhatsApp opens on the newest message
    pumpRender(true);
  }

  function cancelRender() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    el.renderNote.hidden = true;
  }

  const BATCH = 300;

  function pumpRender(first) {
    const c = activeChat();
    if (!c) return;
    const list = state.list;
    const frag = document.createDocumentFragment();
    const end = Math.min(state.pending + (first ? 140 : BATCH), list.length);

    for (let i = state.pending; i < end; i++) {
      const m = list[i];

      if (m.dk !== state.prevDay) {
        const sep = document.createElement('div');
        sep.className = 'day-sep';
        const sp = document.createElement('span');
        sp.textContent = dayLabel(m.d);
        sep.appendChild(sp);
        frag.appendChild(sep);
        state.seps.push({ el: sep, label: sp.textContent, top: 0 });
        state.prevDay = m.dk;
        state.prevSender = undefined;
      }

      if (m.sys) {
        const d = document.createElement('div');
        d.className = 'sys';
        const enc = /end-to-end encrypted/i.test(m.x);
        d.innerHTML = (enc ? ICON_LOCK : '') + formatText(m.x, state.hlRe);
        frag.appendChild(d);
        state.nodes[m._gi] = d;
        state.prevSender = undefined;
        continue;
      }

      const out = m.s === c.me;
      const firstOfGroup = m.s !== state.prevSender;
      state.prevSender = m.s;

      const row = document.createElement('div');
      row.className = 'row ' + (out ? 'out' : 'in') + (firstOfGroup ? ' first' : '');

      const bub = document.createElement('div');
      bub.className = 'bubble';

      let html = '';
      if (firstOfGroup && c.isGroup && !out) {
        html += `<span class="who" style="color:${nameColor(m.s)}">${highlightPlain(m.s, state.hlRe)}</span>`;
      }

      if (m.del) {
        html += '<span class="txt"><span class="deleted">' + ICON_BAN +
          (out ? 'You deleted this message' : 'This message was deleted') + '</span></span>';
      } else {
        let body = '';
        if (m.om) body += `<span class="omitted">${ICON_MEDIA}Media omitted</span>`;
        if (m.at) body += `<span class="attach">${highlightPlain(m.at, state.hlRe)}</span>`;
        if (m.x) {
          body += m.om
            ? `<span class="attach">${formatText(m.x, state.hlRe)}</span>`
            : formatText(m.x, state.hlRe);
        }
        if (!body) body = '<span class="blank">no text</span>';
        const jumbo = !m.om && !m.at && isJumbo(m.x) ? ' jumbo' : '';
        html += `<span class="txt${jumbo}">${body}</span>`;
      }

      html += '<span class="meta">' + (m.ed ? '<span class="edited">edited</span>' : '') +
        `<span>${m.tm}</span>` + (out ? ICON_TICK : '') + '</span>';

      bub.innerHTML = html;
      row.appendChild(bub);
      frag.appendChild(row);
      state.nodes[m._gi] = bub;
    }

    el.thread.appendChild(frag);
    state.pending = end;
    if (state.stickBottom) el.scroller.scrollTop = el.scroller.scrollHeight;

    if (end < list.length) {
      el.renderNote.hidden = false;
      state.rafId = requestAnimationFrame(() => pumpRender(false));
    } else {
      el.renderNote.hidden = true;
      state.rafId = 0;
      measureSeps();
      if (state.stickBottom) el.scroller.scrollTop = el.scroller.scrollHeight;
    }
  }

  function flushRender() {
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = 0; }
    while (state.pending < state.list.length) pumpRender(false);
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = 0; }
    el.renderNote.hidden = true;
    measureSeps();
  }

  function measureSeps() {
    for (const s of state.seps) s.top = s.el.offsetTop;
  }

  /* ═══════════════ scrolling chrome ═══════════════ */

  el.scroller.addEventListener('scroll', () => {
    const top = el.scroller.scrollTop;
    const fromBottom = el.scroller.scrollHeight - (top + el.scroller.clientHeight);
    state.stickBottom = fromBottom < 40;
    el.toBottom.hidden = fromBottom < 300;

    if (state.seps.length) {
      let lo = 0, hi = state.seps.length - 1, found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (state.seps[mid].top <= top + 56) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      if (found >= 0) {
        el.floatDate.hidden = false;
        el.floatDate.textContent = state.seps[found].label;
        el.floatDate.classList.add('show');
      }
    }
    clearTimeout(state.scrollHideT);
    state.scrollHideT = setTimeout(() => el.floatDate.classList.remove('show'), 1100);
  }, { passive: true });

  el.toBottom.addEventListener('click', () => {
    flushRender();
    state.stickBottom = true;
    el.scroller.scrollTop = el.scroller.scrollHeight;
  });

  /* ═══════════════ in-chat search ═══════════════ */

  function setConvQuery(q) {
    state.convQuery = q;
    state.hits = [];
    state.hitPos = -1;
    const c = activeChat();
    if (c) {
      const needle = String(q || '').trim().toLowerCase();
      if (needle) {
        for (const m of visibleMessages(c)) {
          if (!m.sys && m.q.includes(needle)) state.hits.push(m._gi);
        }
      }
      renderConv();
    }
    renderConvResults();
  }

  function renderConvResults() {
    const c = activeChat();
    el.convResults.textContent = '';
    const q = state.convQuery.trim();

    if (!c || !q) {
      el.convSearchHint.hidden = false;
      el.convSearchHint.textContent = 'Search for messages in this chat';
      return;
    }
    if (!state.hits.length) {
      el.convSearchHint.hidden = false;
      el.convSearchHint.textContent = `No messages found for "${q}"`;
      return;
    }

    el.convSearchHint.hidden = false;
    el.convSearchHint.textContent =
      `${nfmt(state.hits.length)} message${state.hits.length > 1 ? 's' : ''} found`;

    const hlRe = makeRe(q);
    const cap = state.hits.slice(0, 300);
    cap.forEach((gi, n) => {
      const m = c.messages[gi];
      const b = document.createElement('button');
      b.className = 'dres' + (n === state.hitPos ? ' on' : '');
      b.innerHTML =
        `<span class="dres-top"><span class="dres-who">${escapeHtml(m.s || 'System')}</span>` +
        `<span class="dres-time">${shortDate(m.d)}, ${m.tm}</span></span>` +
        `<span class="dres-text">${highlightPlain(previewOf(m).slice(0, 300), hlRe)}</span>`;
      b.addEventListener('click', () => { state.hitPos = n; jumpTo(gi); renderConvResults(); });
      el.convResults.appendChild(b);
    });

    if (state.hits.length > cap.length) {
      const n = document.createElement('div');
      n.className = 'res-none';
      n.textContent = `Showing first ${cap.length} of ${nfmt(state.hits.length)}`;
      el.convResults.appendChild(n);
    }
  }

  function jumpTo(gi) {
    const c = activeChat();
    if (!c || !c.messages[gi]) return;
    const m = c.messages[gi];
    if (m.s && c.hidden.has(m.s)) {
      c.hidden.delete(m.s);
      buildInfo();
      renderConv();
    }
    if (!state.nodes[gi]) flushRender();
    const node = state.nodes[gi];
    if (!node) return;
    state.stickBottom = false;
    el.scroller.scrollTop = Math.max(0, node.offsetTop - el.scroller.clientHeight / 2.6);
    el.thread.querySelectorAll('.bubble.flash, .sys.flash')
      .forEach((b) => b.classList.remove('flash'));
    void node.offsetWidth;
    node.classList.add('flash');
  }

  /* ═══════════════ drawer ═══════════════ */

  function openDrawer(view) {
    if (!activeChat()) return;
    el.drawer.hidden = false;
    const search = view === 'search';
    el.drawerSearch.hidden = !search;
    el.drawerInfo.hidden = search;
    el.drawerTitle.textContent = search ? 'Search messages' : 'Chat info';
    el.convSearchBtn.classList.toggle('on', search);
    if (search) setTimeout(() => el.convSearch.focus(), 30);
  }

  function buildInfo() {
    const c = activeChat();
    if (!c) return;

    el.infoAvatar.innerHTML = c.isGroup ? AV_GROUP : AV_PERSON;
    el.infoAvatar.classList.add('av-me');
    el.infoName.textContent = c.name;
    el.infoSub.textContent = c.isGroup
      ? `Group · ${c.senders.length} participants`
      : `${c.senders.length} participant${c.senders.length > 1 ? 's' : ''}`;

    el.meList.textContent = '';
    for (const s of c.senders) {
      const b = document.createElement('button');
      b.className = 'me-item' + (s.name === c.me ? ' on' : '');
      b.innerHTML =
        `<span class="dot" style="background:${nameColor(s.name)}">${escapeHtml(initials(s.name))}</span>` +
        `<span class="nm">${escapeHtml(s.name)}</span>` +
        (s.name === c.me ? '<span class="you-tag">You</span>' : `<span class="count">${nfmt(s.n)}</span>`);
      b.addEventListener('click', () => {
        c.me = s.name;
        savePref(meKey(c), s.name);
        buildInfo();
        renderConv();
      });
      el.meList.appendChild(b);
    }

    el.filterList.textContent = '';
    for (const s of c.senders) {
      const row = document.createElement('label');
      row.className = 'filter-row';
      row.innerHTML =
        `<input type="checkbox" ${c.hidden.has(s.name) ? '' : 'checked'} />` +
        `<span class="swatch" style="background:${nameColor(s.name)}"></span>` +
        `<span class="nm">${escapeHtml(s.name)}</span><span class="count">${nfmt(s.n)}</span>`;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) c.hidden.delete(s.name);
        else c.hidden.add(s.name);
        setConvQuery(state.convQuery);
      });
      el.filterList.appendChild(row);
    }

    const ms = c.messages;
    let omitted = 0, words = 0, links = 0, deleted = 0, edited = 0;
    const perDay = new Map();
    for (const m of ms) {
      if (m.om) omitted++;
      if (m.del) deleted++;
      if (m.ed) edited++;
      if (m.x) {
        const t = m.x.trim();
        if (t) words += t.split(/\s+/).length;
        const lm = m.x.match(RE_URL);
        if (lm) links += lm.length;
      }
      perDay.set(m.dk, (perDay.get(m.dk) || 0) + 1);
    }
    let busy = [null, 0];
    for (const e of perDay) if (e[1] > busy[1]) busy = e;
    if (busy[0]) {
      const [by, bm, bd] = busy[0].split('-').map(Number);
      busy[0] = shortDate(new Date(by, bm - 1, bd));
    }

    const rows = [
      ['Messages', nfmt(ms.length)],
      ['First message', shortDate(ms[0].d)],
      ['Last message', shortDate(ms[ms.length - 1].d)],
      ['Active days', nfmt(perDay.size)],
      ['Words', nfmt(words)],
      ['Media omitted', nfmt(omitted)],
      ['Links', nfmt(links)],
      ['Deleted', nfmt(deleted)],
      ['Edited', nfmt(edited)],
      ['Busiest day', busy[1] ? `${busy[0]} (${nfmt(busy[1])})` : '—'],
      ['Dates read as', c.order === 'dmy' ? 'D/M/Y' : c.order === 'mdy' ? 'M/D/Y' : 'Y/M/D'],
    ];
    el.stats.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`)
      .join('');
  }

  /* ═══════════════ file loading ═══════════════ */

  // Registers a parsed chat, restoring the saved "you" choice and
  // replacing an earlier copy of the same file.
  function addChat(chat) {
    chat.id = 'c' + (seq++);
    const saved = loadPref(meKey(chat));
    if (saved && chat.senders.some((s) => s.name === saved)) chat.me = saved;

    const dupe = state.chats.findIndex((c) => c.file === chat.file && c.name === chat.name);
    if (dupe >= 0) state.chats.splice(dupe, 1);

    state.chats.push(chat);
    return chat.id;
  }

  const readFile = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result || ''));
    fr.onerror = () => rej(fr.error);
    fr.readAsText(file, 'utf-8');
  });

  async function loadFiles(fileList) {
    const all = [...fileList];
    const files = all.filter((f) => /\.txt$/i.test(f.name) || f.type === 'text/plain');
    const skipped = all.length - files.length;

    if (!files.length) {
      toast(skipped ? 'Only .txt chat exports can be opened' : 'Nothing to open');
      return;
    }

    let added = 0, failed = 0, firstId = null;
    for (const f of files) {
      let chat = null;
      try {
        chat = P.parseChat(await readFile(f), f.name);
      } catch (_) { chat = null; }

      if (!chat) { failed++; continue; }
      addChat(chat);
      added++;
      if (!firstId) firstId = chat.id;
    }

    renderChatList();
    if (added && (!state.activeId || added === 1)) openChat(firstId);

    const bits = [];
    if (added) bits.push(`${added} chat${added > 1 ? 's' : ''} opened`);
    if (failed) bits.push(`${failed} file${failed > 1 ? 's' : ''} not recognised as a WhatsApp export`);
    if (skipped) bits.push(`${skipped} non-.txt file${skipped > 1 ? 's' : ''} skipped`);
    if (bits.length) toast(bits.join(' · '));
  }

  /* ═══════════════ events ═══════════════ */

  const pick = () => el.fileInput.click();

  el.fileInput.addEventListener('change', () => {
    if (el.fileInput.files.length) loadFiles(el.fileInput.files);
    el.fileInput.value = '';
  });
  el.dropzone.addEventListener('click', pick);
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
  });
  el.addChatBtn.addEventListener('click', pick);
  el.listEmptyAdd.addEventListener('click', pick);

  // drag & drop anywhere in the window
  let dragDepth = 0;
  const hasFiles = (e) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    el.dragOverlay.hidden = false;
  });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });

  const endDrag = () => { dragDepth = 0; el.dragOverlay.hidden = true; };

  window.addEventListener('dragleave', (e) => {
    dragDepth = Math.max(0, dragDepth - 1);
    // relatedTarget is null when the pointer leaves the window entirely
    if (!dragDepth || !e.relatedTarget) endDrag();
  });
  window.addEventListener('dragend', endDrag);
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    endDrag();
    if (e.dataTransfer.files && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
  });

  // theme
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    savePref('theme', t);
    el.themeIcon.innerHTML = t === 'dark'
      ? '<path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m-1-5h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6 5.6 4.2l2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM18.4 4.2l1.4 1.4-2.1 2.1-1.4-1.4zM6.3 16.3l1.4 1.4-2.1 2.1-1.4-1.4z"/>'
      : '<path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.4-9.6c-.36-.2-.73-.3-1.1-.3"/>';
    renderChatList();
    if (state.activeId) { renderConv(); buildInfo(); }
  }
  el.themeBtn.addEventListener('click', () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

  // menus
  const closeMenus = () => { el.menu.hidden = true; el.convMenu.hidden = true; };

  el.menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasHidden = el.menu.hidden;
    closeMenus();
    el.menu.hidden = !wasHidden;
  });
  el.convMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasHidden = el.convMenu.hidden;
    closeMenus();
    el.convMenu.hidden = !wasHidden;
  });
  document.addEventListener('click', closeMenus);

  el.menu.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'add') pick();
    if (t.dataset.act === 'closeAll') {
      state.chats = [];
      state.activeId = null;
      cancelRender();
      el.thread.textContent = '';
      el.conv.hidden = true;
      el.intro.hidden = false;
      el.drawer.hidden = true;
      el.wa.classList.remove('open');
      renderChatList();
    }
  });

  el.convMenu.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    const c = activeChat();
    if (!t || !c) return;
    const act = t.dataset.act;
    if (act === 'info') openDrawer('info');
    if (act === 'search') openDrawer('search');
    if (act === 'star') {
      c.starred = !c.starred;
      t.textContent = c.starred ? 'Remove from favourites' : 'Add to favourites';
      renderChatList();
    }
    if (act === 'close') closeChat(c.id);
  });

  el.convId.addEventListener('click', () => openDrawer('info'));
  el.convSearchBtn.addEventListener('click', () => {
    const showing = !el.drawer.hidden && !el.drawerSearch.hidden;
    if (showing) {
      el.drawer.hidden = true;
      el.convSearchBtn.classList.remove('on');
    } else {
      openDrawer('search');
    }
  });
  el.drawerClose.addEventListener('click', () => {
    el.drawer.hidden = true;
    el.convSearchBtn.classList.remove('on');
  });
  el.closeChatBtn.addEventListener('click', () => {
    const c = activeChat();
    if (c) closeChat(c.id);
  });
  el.backBtn.addEventListener('click', () => {
    el.wa.classList.remove('open');
    el.drawer.hidden = true;
  });

  // chips
  el.chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.chipFilter = b.dataset.filter;
    Array.prototype.forEach.call(el.chips.children, (c) => {
      const on = c === b;
      c.classList.toggle('on', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderChatList();
  });

  // global search
  let gT = 0;
  el.globalSearch.addEventListener('input', () => {
    el.clearGlobal.hidden = !el.globalSearch.value;
    clearTimeout(gT);
    gT = setTimeout(() => {
      state.globalQuery = el.globalSearch.value;
      renderChatList();
    }, 150);
  });
  el.clearGlobal.addEventListener('click', () => {
    el.globalSearch.value = '';
    el.clearGlobal.hidden = true;
    state.globalQuery = '';
    renderChatList();
    el.globalSearch.focus();
  });

  // in-chat search
  let cT = 0;
  el.convSearch.addEventListener('input', () => {
    clearTimeout(cT);
    cT = setTimeout(() => setConvQuery(el.convSearch.value), 220);
  });
  el.convSearch.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(cT);
    if (state.convQuery !== el.convSearch.value) setConvQuery(el.convSearch.value);
    if (!state.hits.length) return;
    state.hitPos = e.shiftKey
      ? (state.hitPos - 1 + state.hits.length) % state.hits.length
      : (state.hitPos + 1) % state.hits.length;
    jumpTo(state.hits[state.hitPos]);
    renderConvResults();
  });

  // shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenus();
      if (!el.drawer.hidden) {
        el.drawer.hidden = true;
        el.convSearchBtn.classList.remove('on');
      }
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'f' && state.activeId) {
      e.preventDefault();
      openDrawer('search');
    } else if (mod && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      pick();
    }
  });

  window.addEventListener('resize', () => { if (state.activeId) measureSeps(); });

  /* ═══════════════ boot ═══════════════ */
  applyTheme(loadPref('theme') === 'dark' ? 'dark' : 'light');

  // debug handle, also used by the smoke test
  window.__wcr = {
    state, addChat, openChat, closeChat, renderChatList, renderConv, buildInfo,
    setConvQuery, jumpTo, flushRender, applyTheme, formatText, loadFiles,
  };
})();
