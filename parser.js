/* ══════════════════════════════════════════════════════════════
   WhatsApp export parser — pure functions, no DOM.
   Shared by the browser app and the test script.
   ══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  /* ─────────── date/time labels ─────────── */

  function timeLabel(d) {
    let h = d.getHours();
    const ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${pad2(d.getMinutes())} ${ap}`;
  }

  const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function startOfToday() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }

  function daysAgo(d) {
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((startOfToday() - that) / 86400000);
  }

  function dayLabel(d) {
    const diff = daysAgo(d);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff > 1 && diff < 7) return DAYS[d.getDay()];
    return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  }

  function listStamp(d) {
    const diff = daysAgo(d);
    if (diff === 0) return timeLabel(d);
    if (diff === 1) return 'Yesterday';
    if (diff > 1 && diff < 7) return DAYS[d.getDay()].slice(0, 3);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  /* ─────────── line patterns ─────────── */

  // [08/05/26, 9:25:12 pm] Sender: text          iOS, 12h
  const RE_IOS = /^\[(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\]\s*([\s\S]*)$/i;
  // [08/05/26, 21:25:12] Sender: text            iOS, 24h
  const RE_IOS_24 = /^\[(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\]\s*([\s\S]*)$/;
  // 08/05/26, 9:25 pm - Sender: text             Android, 12h
  const RE_AND = /^(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\s*[-–—]\s*([\s\S]*)$/i;
  // System message (no colon sender): 08/05/26, 9:25 pm - Some system text
  const RE_AND_SYS = /^(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\s*[-–—]\s*([\s\S]*)$/i;
  // 08/05/26, 21:25 - Sender: text               Android, 24h
  const RE_AND_24 = /^(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*[-–—]\s*([\s\S]*)$/;

  const RE_SENDER = /^([^:\n]{1,90}?):[ \t]?([\s\S]*)$/;

  const RE_MEDIA = /^(?:<\s*(?:media|attached)\s+omitted\s*>|(?:image|video|audio|sticker|gif|document|photo|voice message|contact card)\s+omitted)$/i;
  const RE_ATTACHED = /^(.{1,120}?)\s*\((?:file|document|image|video|audio)?\s*attached\)$/i;
  const RE_DELETED = /^(?:this message was deleted|you deleted this message|message deleted)\.?$/i;
  const RE_EDITED = /\s*<[^>]*this message was edited[^>]*>\s*$/i;
  const RE_URL = /(?:https?:\/\/|www\.)[^\s<]+/gi;

  function normalize(raw) {
    return String(raw)
      .replace(/^\uFEFF/, '')
      .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/[\u202f\u00a0]/g, ' ')
      .replace(/\r\n?/g, '\n');
  }

  function matchHeader(line) {
    let m = RE_IOS.exec(line);
    if (m) return { date: m[1], h: +m[2], mi: +m[3], ap: m[4].toLowerCase(), rest: m[5] };
    m = RE_AND.exec(line);
    if (m) return { date: m[1], h: +m[2], mi: +m[3], ap: m[4].toLowerCase(), rest: m[5] };
    m = RE_IOS_24.exec(line);
    if (m) return { date: m[1], h: +m[2], mi: +m[3], ap: null, rest: m[4] };
    m = RE_AND_24.exec(line);
    if (m) return { date: m[1], h: +m[2], mi: +m[3], ap: null, rest: m[4] };
    return null;
  }

  function splitDate(s) {
    const p = s.split(/[/.\-]/).map(Number);
    return p.length === 3 && p.every((n) => Number.isFinite(n)) ? p : null;
  }

  // 'dmy' | 'mdy' | 'ymd'
  function detectOrder(dateParts) {
    let aBig = false, bBig = false;
    for (const p of dateParts) {
      if (p[0] > 31) return 'ymd';
      if (p[0] > 12) aBig = true;
      if (p[1] > 12) bBig = true;
    }
    if (aBig && !bBig) return 'dmy';
    if (bBig && !aBig) return 'mdy';
    return 'dmy'; // WhatsApp's most common export order
  }

  const fullYear = (y) => (y >= 1000 ? y : y + (y > 70 ? 1900 : 2000));

  function buildDate(parts, order, h, mi, ap) {
    let d, mo, y;
    if (order === 'ymd') { y = parts[0]; mo = parts[1]; d = parts[2]; }
    else if (order === 'mdy') { mo = parts[0]; d = parts[1]; y = parts[2]; }
    else { d = parts[0]; mo = parts[1]; y = parts[2]; }
    let hh = h;
    if (ap === 'a') hh = h % 12;
    else if (ap === 'p') hh = (h % 12) + 12;
    return new Date(fullYear(y), mo - 1, d, hh, mi, 0, 0);
  }

  function parseBody(body) {
    let text = body;
    let ed = false;
    if (RE_EDITED.test(text)) { text = text.replace(RE_EDITED, ''); ed = true; }

    if (RE_DELETED.test(text.trim())) return { om: false, attach: null, text: '', del: true, ed };

    let om = false, attach = null;
    const keep = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (RE_MEDIA.test(t)) { om = true; continue; }
      const a = RE_ATTACHED.exec(t);
      if (a) { om = true; attach = a[1]; continue; }
      keep.push(line);
    }
    return { om, attach, text: keep.join('\n').replace(/\s+$/, ''), del: false, ed };
  }

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

  function chatTitle(fileName, senders) {
    let n = String(fileName || '').replace(/\.txt$/i, '').trim();
    n = n.replace(/^whatsapp\s*chat\s*(?:with|-|–|—)?\s*/i, '').trim();
    n = n.replace(/^chat\s*(?:with)\s*/i, '').trim();
    n = n.replace(/^[_\s-]*chat[_\s-]*$/i, '').trim();
    if (!n || /^\d+$/.test(n)) {
      n = senders.length ? senders.map((s) => s.name).slice(0, 3).join(', ') : 'Chat';
    }
    return n;
  }

  // 1:1 exports are named after the *other* person, so whoever is left is you.
  function guessMe(title, senders) {
    if (!senders.length) return null;
    if (senders.length === 2) {
      const t = slug(title);
      const other = senders.find((s) => t && (slug(s.name) === t || slug(s.name).includes(t) || t.includes(slug(s.name))));
      if (other) {
        const me = senders.find((s) => s.name !== other.name);
        if (me) return me.name;
      }
    }
    return senders[0].name;
  }

  function parseChat(rawText, fileName) {
    const lines = normalize(rawText).split('\n');

    // pass 1 — gather headers so the date order can be settled first
    const raw = [];
    for (const line of lines) {
      const h = matchHeader(line);
      if (h) {
        const parts = splitDate(h.date);
        if (parts) { raw.push({ parts, h: h.h, mi: h.mi, ap: h.ap, body: h.rest }); continue; }
      }
      if (raw.length) raw[raw.length - 1].body += '\n' + line;
    }
    if (!raw.length) return null;

    const order = detectOrder(raw.map((r) => r.parts));

    const messages = [];
    const senderCount = new Map();

    for (const r of raw) {
      const when = buildDate(r.parts, order, r.h, r.mi, r.ap);
      if (isNaN(when.getTime())) continue;

      let sender = null;
      let body = r.body;
      const sm = RE_SENDER.exec(r.body);
      if (sm) { sender = sm[1].trim(); body = sm[2]; }

      const p = parseBody(body);
      const m = {
        t: when.getTime(),
        d: when,
        tm: timeLabel(when),
        dk: dayKey(when),
        s: sender,
        x: p.text,
        at: p.attach,
        om: p.om,
        del: p.del,
        ed: p.ed,
        sys: !sender,
      };
      m.q = ((sender ? sender + ' ' : '') + m.x + (m.at ? ' ' + m.at : '')).toLowerCase();
      messages.push(m);
      if (sender) senderCount.set(sender, (senderCount.get(sender) || 0) + 1);
    }

    if (!messages.length) return null;
    messages.forEach((m, i) => { m._gi = i; });

    const senders = [...senderCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => ({ name, n }));

    const title = chatTitle(fileName, senders);
    const isGroup = senders.length > 2 ||
      messages.some((m) => m.sys && /created (this )?group|added |changed the subject|changed this group/i.test(m.x));

    return {
      file: String(fileName || ''),
      name: title,
      isGroup,
      messages,
      senders,
      order,
      me: guessMe(title, senders),
      starred: false,
      hidden: new Set(),
      lastT: messages[messages.length - 1].t,
    };
  }

  const api = {
    parseChat, normalize, matchHeader, detectOrder, parseBody, chatTitle, guessMe, slug,
    timeLabel, dayKey, dayLabel, listStamp, shortDate, pad2,
    MONTHS, MONTHS_FULL, DAYS, RE_URL,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WCR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
