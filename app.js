/* Shanghai Trip – editable itinerary
 * Storage: if served by server.py → saves to trip.json (shared for everyone using the link)
 *          otherwise → saves in this browser's localStorage
 */
(() => {
  'use strict';
  const LS_KEY = 'shanghai-trip-2026';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (s = '') => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const fmt = (n, d = 2) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: d });
  const TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const parseDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const thDate = (dt, withDow = true) => `${withDow ? TH_DOW[dt.getDay()] + ' ' : ''}${dt.getDate()} ${TH_MON[dt.getMonth()]} ${dt.getFullYear() + 543 - 2500}`;

  let state;
  let mode = 'local';
  let view = 'overview';
  let dayIdx = 0;
  let saveTimer;

  /* ---------------- Storage ---------------- */
  async function load() {
    try {
      const r = await fetch('api/trip', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
        mode = 'server';
        const data = await r.json();
        state = data && data.days ? data : clone(window.DEFAULT_TRIP);
        if (!data || !data.days) await persist();
        return;
      }
    } catch (_) { /* static hosting – fall back */ }
    mode = 'local';
    try { state = JSON.parse(localStorage.getItem(LS_KEY)); } catch (_) { state = null; }
    if (!state || !state.days) state = clone(window.DEFAULT_TRIP);
  }
  async function persist() {
    if (mode === 'server') {
      try {
        const r = await fetch('api/trip', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
        if (!r.ok) throw new Error(r.status);
      } catch (e) { toast('⚠️ บันทึกไปเซิร์ฟเวอร์ไม่สำเร็จ'); localStorage.setItem(LS_KEY, JSON.stringify(state)); return; }
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }
  }
  function save(msg = 'บันทึกแล้ว ✓') {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 150);
    render();
    if (msg) toast(msg);
  }

  /* ---------------- Helpers ---------------- */
  const dayDate = (i) => { const d = parseDate(state.trip.start); d.setDate(d.getDate() + i); return d; };
  const allItems = () => state.days.flatMap((d) => d.items);
  const isEditing = () => document.body.classList.contains('editing');
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function findItem(id) {
    for (const d of state.days) { const i = d.items.findIndex((x) => x.id === id); if (i > -1) return { list: d.items, i, day: d }; }
    const i = state.ideas.findIndex((x) => x.id === id);
    if (i > -1) return { list: state.ideas, i, day: null };
    return null;
  }

  /* ---------------- Header & tabs ---------------- */
  function renderHeader() {
    const s = parseDate(state.trip.start), e = parseDate(state.trip.end);
    $('#tripTitle').textContent = state.trip.title;
    $('#tripDates').textContent = `${s.getDate()}–${e.getDate()} ${TH_MON[e.getMonth()]} ${e.getFullYear()}`;
    $('#tripTravelers').textContent = state.trip.travelers;
    document.title = `${state.trip.title} · ${$('#tripDates').textContent}`;
    $('#syncBadge').textContent = mode === 'server' ? '☁️ บันทึกบนเซิร์ฟเวอร์ (แชร์กันได้)' : '💾 บันทึกในเบราว์เซอร์นี้';

    // countdown to outbound departure
    const f = state.flights[0];
    const dep = f ? new Date(`${f.date}T${(f.dep || '00:00').slice(0, 5)}:00+07:00`) : s;
    const end = new Date(`${state.trip.end}T23:59:00+08:00`);
    const now = new Date();
    const cd = $('#countdown');
    if (now < dep) {
      let ms = dep - now;
      const d = Math.floor(ms / 864e5); ms -= d * 864e5;
      const h = Math.floor(ms / 36e5); ms -= h * 36e5;
      const m = Math.floor(ms / 6e4);
      cd.innerHTML = `<div class="cd"><b>${d}</b><span>วัน</span></div><div class="cd"><b>${h}</b><span>ชั่วโมง</span></div><div class="cd"><b>${m}</b><span>นาที</span></div><div class="cd" style="text-align:left"><span>จะได้บิน</span><b style="font-size:1rem">${esc(f ? f.no : '')} ✈️</b></div>`;
    } else if (now <= end) {
      const i = Math.floor((now - parseDate(state.trip.start)) / 864e5);
      cd.innerHTML = `<div class="cd"><b>Day ${i + 1}</b><span>กำลังเที่ยวอยู่! 🎉</span></div>`;
    } else cd.innerHTML = `<div class="cd"><b>จบทริปแล้ว</b><span>ไว้ไปกันใหม่ ❤️</span></div>`;
  }
  function renderTabs() {
    const tabs = [{ k: 'overview', t: 'ภาพรวม', s: 'Overview' }]
      .concat(state.days.map((d, i) => { const dt = dayDate(i); return { k: 'day' + i, t: `Day ${i + 1}`, s: `${TH_DOW[dt.getDay()]} ${dt.getDate()} ${TH_MON[dt.getMonth()]}` }; }))
      .concat([{ k: 'ideas', t: 'ไอเดียสำรอง', s: `${state.ideas.length} ที่` }, { k: 'money', t: 'ค่าใช้จ่าย', s: 'Budget' }, { k: 'tips', t: 'ทิปส์', s: 'Tips' }]);
    const cur = view === 'day' ? 'day' + dayIdx : view;
    $('#tabs').innerHTML = tabs.map((t) => `<button class="tab ${t.k === cur ? 'active' : ''}" data-tab="${t.k}">${t.t}<small>${t.s}</small></button>`).join('');
  }
  function go(k) {
    if (k.startsWith('day')) { view = 'day'; dayIdx = +k.slice(3); } else view = k;
    render();
    window.scrollTo({ top: $('#tabs').offsetTop, behavior: 'smooth' });
  }

  /* ---------------- Overview ---------------- */
  function flightCard(f) {
    return `<div class="card flight">
      <div class="f-head"><span class="pill ${f.dir === 'ขากลับ' ? 'gold' : ''}">${esc(f.dir)} · ${thDate(parseDate(f.date))}</span>
        <button class="btn small edit-only" data-act="edit-flight" data-id="${f.id}">✏️ แก้ไข</button></div>
      <div class="f-route">
        <div><div class="code">${esc(f.from)}</div><div class="time">${esc(f.dep)}</div><div class="name">${esc(f.fromName)}</div></div>
        <div class="f-plane">${esc(f.no)}</div>
        <div class="right"><div class="code">${esc(f.to)}</div><div class="time">${esc(f.arr)}</div><div class="name">${esc(f.toName)}</div></div>
      </div>
      <div class="f-meta"><span>${esc(f.airline)}</span><span>${f.note ? esc(f.note) : 'เวลาท้องถิ่น'}</span></div>
    </div>`;
  }
  function renderOverview() {
    const h = state.hotel;
    const items = allItems(), done = items.filter((x) => x.done).length;
    $('#view-overview').innerHTML = `
      <h2 class="section">✈️ เที่ยวบิน</h2>
      <div class="grid two">${state.flights.map(flightCard).join('')}</div>

      <h2 class="section">🏨 ที่พัก <button class="btn small edit-only" data-act="edit-hotel">✏️ แก้ไข</button></h2>
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
          <div><h3 style="margin:0">${esc(h.name)}</h3><div class="muted">${esc(h.area)}</div></div>
          <div style="text-align:right"><div class="muted">เช็คอิน ${thDate(parseDate(h.checkin))}</div><div class="muted">เช็คเอาท์ ${thDate(parseDate(h.checkout))}</div></div>
        </div>
        <div class="cn-bar">
          <span class="cn-text">🇨🇳 唯庭R酒店(南京路步行街人民广场站店)</span>
          <button type="button" class="btn-copy" data-copy="唯庭R酒店(南京路步行街人民广场站店)" title="คัดลอกชื่อจีนไปค้นหาใน Amap หรือเรียก Didi">📋 คัดลอกชื่อจีน</button>
        </div>
        ${h.note ? `<p class="item-note">${linkify(h.note)}</p>` : ''}
        <div class="links">
          ${h.amap ? `<a class="link-btn amap" href="${esc(h.amap)}" target="_blank" rel="noopener">📍 ลิงก์ Amap</a>` : ''}
          <a class="link-btn amap-search" href="https://www.amap.com/search?query=${encodeURIComponent('唯庭R酒店(南京路步行街人民广场站店)')}" target="_blank" rel="noopener">🔍 ค้นโรงแรมใน Amap</a>
        </div>
      </div>

      <h2 class="section">🗓️ แผนรายวัน <span class="muted">เช็คแล้ว ${done}/${items.length}</span></h2>
      <div class="day-list">
        ${state.days.map((d, i) => {
          const dt = dayDate(i), n = d.items.length, c = d.items.filter((x) => x.done).length;
          return `<div class="card day-row" data-tab="day${i}">
            <div class="day-num"><b>${dt.getDate()}</b><span>${TH_MON[dt.getMonth()]}</span></div>
            <div style="flex:1;min-width:0"><h4>Day ${i + 1} · ${esc(d.title)}</h4>
              <p>${TH_DOW[dt.getDay()]} · ${n} กิจกรรม</p>
              <div class="progress"><i style="width:${n ? (c / n) * 100 : 0}%"></i></div></div>
            <span style="color:var(--muted)">›</span></div>`;
        }).join('')}
      </div>
      <p class="muted" style="margin-top:14px">💡 กดปุ่ม <b>“✏️ โหมดแก้ไข”</b> ด้านบน เพื่อแก้ไข/เพิ่ม/ลบ/ย้ายกิจกรรม เที่ยวบิน ที่พัก และค่าใช้จ่าย</p>`;
  }

  /* ---------------- Day / items ---------------- */
  function itemCard(x, ctx) {
    const long = (x.note || '').split('\n').length > 5 || (x.note || '').length > 260;
    const links = [
      x.amap && `<a class="link-btn amap" href="${esc(x.amap)}" target="_blank" rel="noopener">📍 ลิงก์ Amap</a>`,
      x.cn && `<a class="link-btn amap-search" href="https://www.amap.com/search?query=${encodeURIComponent(x.cn)}" target="_blank" rel="noopener" title="ค้นหาใน Amap">🔍 ค้น Amap</a>`,
      x.tiktok && `<a class="link-btn tt" href="${esc(x.tiktok)}" target="_blank" rel="noopener">🎵 TikTok</a>`,
      ...(x.extraLinks || []).map((l, k) => `<a class="link-btn" href="${esc(l)}" target="_blank" rel="noopener">🔗 ลิงก์ ${k + 2}</a>`),
    ].filter(Boolean).join('');
    return `<div class="card item ${x.done ? 'done' : ''}" data-id="${x.id}">
      <div class="item-top">
        <div class="item-time ${x.time ? '' : 'empty'}">${esc(x.time || '—')}</div>
        <div style="flex:1;min-width:0">
          <h4 class="item-title">${esc(x.title)}</h4>
          ${x.cn ? `
            <div class="cn-bar">
              <span class="cn-text" title="ชื่อจีนสำหรับค้นหาใน Amap">🇨🇳 ${esc(x.cn)}</span>
              <button type="button" class="btn-copy" data-copy="${esc(x.cn)}" title="คัดลอกชื่อภาษาจีน">📋 คัดลอก</button>
            </div>
          ` : ''}
        </div>
        ${ctx === 'day' ? `<button class="check" data-act="toggle" title="เช็คว่าไปแล้ว">${x.done ? '✓' : ''}</button>` : ''}
      </div>
      ${x.note ? `<p class="item-note ${long ? 'clamp' : ''}">${linkify(x.note)}</p>${long ? '<button class="more" data-act="more">อ่านเพิ่ม ▾</button>' : ''}` : ''}
      ${links ? `<div class="links">${links}</div>` : ''}
      <div class="edit-bar">
        <button class="btn small" data-act="edit">✏️ แก้ไข</button>
        <button class="btn small" data-act="up" title="เลื่อนขึ้น">↑</button>
        <button class="btn small" data-act="down" title="เลื่อนลง">↓</button>
        ${ctx === 'day' ? '<button class="btn small" data-act="to-ideas">📦 ย้ายไปไอเดียสำรอง</button>' : '<button class="btn small" data-act="edit">📅 ใส่ในแผนวัน…</button>'}
        <button class="btn small danger" data-act="del">🗑 ลบ</button>
      </div>
    </div>`;
  }
  function renderDay() {
    const d = state.days[dayIdx]; if (!d) return;
    const dt = dayDate(dayIdx);
    $('#view-day').innerHTML = `
      <div class="day-head">
        <div><div class="date">Day ${dayIdx + 1} · ${thDate(dt)}</div><h2>${esc(d.title)}</h2></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn small edit-only" data-act="edit-day">✏️ ชื่อวัน</button>
          <button class="btn small edit-only" data-act="sort-day">⏱ เรียงตามเวลา</button>
        </div>
      </div>
      <div class="timeline">${d.items.length ? d.items.map((x) => itemCard(x, 'day')).join('') : '<div class="card empty">ยังไม่มีกิจกรรม</div>'}</div>
      <button class="btn add edit-only" data-act="add-item">＋ เพิ่มกิจกรรม</button>
      <div style="display:flex;justify-content:space-between;margin-top:18px">
        ${dayIdx > 0 ? `<button class="btn" data-tab="day${dayIdx - 1}">‹ Day ${dayIdx}</button>` : '<span></span>'}
        ${dayIdx < state.days.length - 1 ? `<button class="btn" data-tab="day${dayIdx + 1}">Day ${dayIdx + 2} ›</button>` : '<span></span>'}
      </div>`;
  }
  function renderIdeas() {
    $('#view-ideas').innerHTML = `
      <h2 class="section">📦 ไอเดียสำรอง / ยังไม่ได้ลงแผน</h2>
      <p class="muted" style="margin-top:-6px">ที่เที่ยวจากแผนเดิม Day 1 (ช่วงเช้า) ที่ไม่ทันเพราะเที่ยวบิน FM842 ถึงช่วงบ่าย — เข้าโหมดแก้ไขแล้วกด “ใส่ในแผนวัน…” เพื่อย้ายไปวันที่ต้องการ</p>
      <div class="timeline">${state.ideas.length ? state.ideas.map((x) => itemCard(x, 'ideas')).join('') : '<div class="card empty">ว่าง</div>'}</div>
      <button class="btn add edit-only" data-act="add-idea">＋ เพิ่มไอเดีย</button>`;
  }

  /* ---------------- Money ---------------- */
  function renderMoney() {
    const rate = Number(state.trip.rate) || 0;
    const bTotal = state.budget.reduce((a, b) => a + Number(b.amount || 0), 0);
    const eTotal = state.expenses.reduce((a, b) => a + Number(b.cny || 0), 0);
    const byPayer = {};
    state.expenses.forEach((e) => { const p = e.payer || '—'; byPayer[p] = (byPayer[p] || 0) + Number(e.cny || 0); });
    $('#view-money').innerHTML = `
      <div class="stat-row">
        <div class="card stat"><div class="label">ค่าใช้จ่ายจองล่วงหน้า (ต่อคน)</div><div class="value">฿${fmt(bTotal)}</div></div>
        <div class="card stat"><div class="label">ใช้จ่ายระหว่างทริป</div><div class="value">¥${fmt(eTotal)} <small>≈ ฿${fmt(eTotal * rate, 0)}</small></div></div>
        <div class="card stat"><div class="label">อัตราแลกเปลี่ยน <button class="icon-btn edit-only" data-act="edit-rate" style="font-size:.85rem">✏️</button></div><div class="value">฿${fmt(rate)} <small>/ ¥1</small></div></div>
      </div>

      <h2 class="section">🧾 ค่าใช้จ่ายจองล่วงหน้า (บาท/คน)</h2>
      <div class="card"><table class="tbl">
        <thead><tr><th>รายการ</th><th class="num">บาท</th><th class="act edit-only"></th></tr></thead>
        <tbody>${state.budget.map((b) => `<tr><td>${esc(b.label)}</td><td class="num">${fmt(b.amount)}</td>
          <td class="act edit-only"><button class="icon-btn" data-act="edit-budget" data-id="${b.id}">✏️</button><button class="icon-btn" data-act="del-budget" data-id="${b.id}">🗑</button></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>รวม</td><td class="num">฿${fmt(bTotal)}</td><td class="edit-only"></td></tr></tfoot>
      </table>
      <button class="btn add edit-only" style="margin-top:10px" data-act="add-budget">＋ เพิ่มรายการ</button></div>

      <h2 class="section">💴 บันทึกค่าใช้จ่ายระหว่างทริป <button class="btn small primary" data-act="add-exp">＋ เพิ่ม</button></h2>
      <div class="card">
        ${state.expenses.length ? `<table class="tbl">
          <thead><tr><th>วัน</th><th>รายการ</th><th>จ่ายโดย</th><th class="num">¥</th><th class="num">฿</th><th class="act"></th></tr></thead>
          <tbody>${state.expenses.map((e) => `<tr><td>D${Number(e.day) + 1}</td><td>${esc(e.label)}${e.split ? `<div class="muted">${esc(e.split)}</div>` : ''}</td><td>${esc(e.payer || '')}</td>
            <td class="num">${fmt(e.cny)}</td><td class="num">${fmt(e.cny * rate, 0)}</td>
            <td class="act"><button class="icon-btn" data-act="edit-exp" data-id="${e.id}">✏️</button><button class="icon-btn" data-act="del-exp" data-id="${e.id}">🗑</button></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">รวม</td><td class="num">¥${fmt(eTotal)}</td><td class="num">฿${fmt(eTotal * rate, 0)}</td><td></td></tr></tfoot>
        </table>
        <div class="muted" style="margin-top:10px">${Object.entries(byPayer).map(([p, v]) => `${esc(p)} จ่ายไป ¥${fmt(v)}`).join(' · ')}</div>`
        : '<div class="empty">ยังไม่มีรายการ — กด “＋ เพิ่ม” เพื่อจดค่าใช้จ่ายระหว่างเที่ยว (ไม่ต้องเข้าโหมดแก้ไข)</div>'}
      </div>`;
  }
  function renderTips() {
    $('#view-tips').innerHTML = `
      <h2 class="section">📌 ทิปส์ & สิ่งที่ต้องเตรียม</h2>
      <div class="grid two">${state.tips.map((t) => `<div class="card tip">
        <div style="display:flex;justify-content:space-between;gap:8px"><h4>${esc(t.title)}</h4>
          <span class="edit-only" style="gap:2px"><button class="icon-btn" data-act="edit-tip" data-id="${t.id}">✏️</button><button class="icon-btn" data-act="del-tip" data-id="${t.id}">🗑</button></span></div>
        ${t.text ? `<p>${linkify(t.text)}</p>` : ''}
        ${t.link ? `<div class="links"><a class="link-btn ${/tiktok/.test(t.link) ? 'tt' : ''}" href="${esc(t.link)}" target="_blank" rel="noopener">${/tiktok/.test(t.link) ? '🎵 ดูวิธีใน TikTok' : '🔗 เปิดลิงก์'}</a></div>` : ''}
      </div>`).join('')}</div>
      <button class="btn add edit-only" style="margin-top:12px" data-act="add-tip">＋ เพิ่มทิปส์</button>`;
  }

  function render() {
    renderHeader(); renderTabs();
    $$('.view').forEach((v) => v.classList.remove('active'));
    ({ overview: renderOverview, day: renderDay, ideas: renderIdeas, money: renderMoney, tips: renderTips })[view]();
    $('#view-' + view).classList.add('active');
  }

  /* ---------------- Modal forms ---------------- */
  function openForm(title, fields, onSubmit, extraBtn) {
    $('#modalTitle').textContent = title;
    const f = $('#modalForm');
    f.innerHTML = fields.map((x) => {
      if (x.row) return `<div class="row2">${x.row.map(fieldHtml).join('')}</div>`;
      return fieldHtml(x);
    }).join('') + `<div class="modal-actions">${extraBtn ? `<button type="button" class="btn danger" data-extra style="margin-right:auto">${extraBtn.label}</button>` : ''}
      <button type="button" class="btn" data-close>ยกเลิก</button><button type="submit" class="btn primary">บันทึก</button></div>`;
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f).entries());
      if (onSubmit(v) !== false) closeModal();
    };
    if (extraBtn) $('[data-extra]', f).onclick = () => { if (extraBtn.fn() !== false) closeModal(); };
    $('#modal').hidden = false;
    setTimeout(() => { const first = $('input,textarea,select', f); first && first.focus(); }, 50);
  }
  function fieldHtml(x) {
    const v = esc(x.value ?? '');
    let input;
    if (x.type === 'textarea') input = `<textarea name="${x.name}" placeholder="${esc(x.ph || '')}">${v}</textarea>`;
    else if (x.type === 'select') input = `<select name="${x.name}">${x.options.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(x.value) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
    else input = `<input name="${x.name}" type="${x.type || 'text'}" value="${v}" placeholder="${esc(x.ph || '')}" ${x.req ? 'required' : ''} ${x.step ? `step="${x.step}"` : ''} />`;
    return `<label class="field"><span>${x.label}</span>${input}</label>`;
  }
  function closeModal() { $('#modal').hidden = true; }

  const dayOptions = (withIdeas) => state.days.map((d, i) => ({ v: i, t: `Day ${i + 1} · ${thDate(dayDate(i))}` })).concat(withIdeas ? [{ v: 'ideas', t: '📦 ไอเดียสำรอง' }] : []);

  function editItem(id, targetDay) {
    const loc = id ? findItem(id) : null;
    const x = loc ? loc.list[loc.i] : { id: uid('i'), time: '', title: '', cn: '', note: '', amap: '', tiktok: '', extraLinks: [], done: false };
    const curDay = loc ? (loc.day ? state.days.indexOf(loc.day) : 'ideas') : targetDay;
    openForm(id ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม', [
      { row: [{ name: 'time', label: 'เวลา', type: 'time', value: /^\d{2}:\d{2}$/.test(x.time) ? x.time : '' }, { name: 'day', label: 'วัน', type: 'select', value: curDay, options: dayOptions(true) }] },
      { name: 'title', label: 'ชื่อกิจกรรม / สถานที่', value: x.title, req: true },
      { name: 'cn', label: 'ชื่อภาษาจีน (สำหรับค้นหาใน Amap / Didi)', value: x.cn || '', ph: 'เช่น 迪士尼乐园' },
      { name: 'note', label: 'โน้ต / รายละเอียด', type: 'textarea', value: x.note },
      { name: 'amap', label: 'ลิงก์ Amap', type: 'url', value: x.amap, ph: 'https://surl.amap.com/...' },
      { name: 'tiktok', label: 'ลิงก์ TikTok', type: 'url', value: x.tiktok, ph: 'https://vt.tiktok.com/...' },
      { name: 'extra', label: 'ลิงก์อื่น ๆ (บรรทัดละ 1 ลิงก์)', type: 'textarea', value: (x.extraLinks || []).join('\n') },
    ], (v) => {
      Object.assign(x, {
        time: v.time,
        title: v.title.trim(),
        cn: (v.cn || '').trim(),
        note: v.note.trim(),
        amap: v.amap.trim(),
        tiktok: v.tiktok.trim(),
        extraLinks: v.extra.split('\n').map((s) => s.trim()).filter(Boolean)
      });
      const dest = v.day === 'ideas' ? state.ideas : state.days[+v.day].items;
      if (loc && loc.list !== dest) loc.list.splice(loc.i, 1);
      if (!loc || loc.list !== dest) {
        // insert by time if possible
        let at = dest.length;
        if (x.time) { const k = dest.findIndex((y) => y.time && y.time > x.time); if (k > -1) at = k; }
        dest.splice(at, 0, x);
      }
      save();
    }, loc ? { label: '🗑 ลบ', fn: () => { if (!confirm('ลบกิจกรรมนี้?')) return false; loc.list.splice(loc.i, 1); save('ลบแล้ว'); } } : null);
  }

  function editFlight(id) {
    const f = state.flights.find((x) => x.id === id);
    openForm(`แก้ไขเที่ยวบิน${f.dir}`, [
      { row: [{ name: 'no', label: 'เที่ยวบิน', value: f.no, req: true }, { name: 'date', label: 'วันที่', type: 'date', value: f.date }] },
      { name: 'airline', label: 'สายการบิน', value: f.airline },
      { row: [{ name: 'from', label: 'ต้นทาง (รหัส)', value: f.from }, { name: 'dep', label: 'เวลาออก', value: f.dep }] },
      { name: 'fromName', label: 'ชื่อสนามบินต้นทาง', value: f.fromName },
      { row: [{ name: 'to', label: 'ปลายทาง (รหัส)', value: f.to }, { name: 'arr', label: 'เวลาถึง', value: f.arr }] },
      { name: 'toName', label: 'ชื่อสนามบินปลายทาง', value: f.toName },
      { name: 'note', label: 'หมายเหตุ (เช่น รหัสจอง, เทอร์มินัล)', value: f.note },
    ], (v) => { Object.assign(f, v); save(); });
  }
  function editHotel() {
    const h = state.hotel;
    openForm('แก้ไขที่พัก', [
      { name: 'name', label: 'ชื่อโรงแรม', value: h.name, req: true },
      { name: 'area', label: 'ที่ตั้ง / การเดินทาง', value: h.area },
      { row: [{ name: 'checkin', label: 'เช็คอิน', type: 'date', value: h.checkin }, { name: 'checkout', label: 'เช็คเอาท์', type: 'date', value: h.checkout }] },
      { name: 'amap', label: 'ลิงก์ Amap', type: 'url', value: h.amap },
      { name: 'note', label: 'โน้ต (เช่น เบอร์โทร, ที่อยู่ภาษาจีน, รหัสจอง)', type: 'textarea', value: h.note },
    ], (v) => { Object.assign(h, v); save(); });
  }
  function editTrip() {
    const t = state.trip;
    openForm('แก้ไขข้อมูลทริป', [
      { name: 'title', label: 'ชื่อทริป', value: t.title, req: true },
      { row: [{ name: 'start', label: 'วันเริ่ม', type: 'date', value: t.start }, { name: 'end', label: 'วันสุดท้าย', type: 'date', value: t.end }] },
      { name: 'travelers', label: 'ผู้ร่วมทริป', value: t.travelers },
    ], (v) => {
      if (v.end < v.start) { alert('วันสุดท้ายต้องไม่ก่อนวันเริ่ม'); return false; }
      Object.assign(t, v);
      const n = Math.round((parseDate(t.end) - parseDate(t.start)) / 864e5) + 1;
      while (state.days.length < n) state.days.push({ id: uid('d'), title: 'วันใหม่', items: [] });
      if (state.days.length > n) {
        const extra = state.days.splice(n);
        extra.forEach((d) => state.ideas.push(...d.items));
        if (extra.some((d) => d.items.length)) alert('กิจกรรมของวันที่ถูกตัดออก ถูกย้ายไปที่ “ไอเดียสำรอง” แล้ว');
        dayIdx = Math.min(dayIdx, n - 1);
      }
      save();
    });
  }
  function editBudget(id) {
    const b = id ? state.budget.find((x) => x.id === id) : { id: uid('b'), label: '', amount: 0 };
    openForm(id ? 'แก้ไขรายการ' : 'เพิ่มรายการ', [
      { name: 'label', label: 'รายการ', value: b.label, req: true },
      { name: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', step: '0.01', value: b.amount, req: true },
    ], (v) => { b.label = v.label; b.amount = Number(v.amount); if (!id) state.budget.push(b); save(); });
  }
  function editExpense(id) {
    const e = id ? state.expenses.find((x) => x.id === id) : { id: uid('e'), day: view === 'day' ? dayIdx : 0, label: '', cny: '', payer: '', split: '' };
    const people = (state.trip.travelers || '').split(/[·,]/).map((s) => s.trim()).filter(Boolean);
    openForm(id ? 'แก้ไขค่าใช้จ่าย' : 'เพิ่มค่าใช้จ่าย', [
      { row: [{ name: 'day', label: 'วัน', type: 'select', value: e.day, options: dayOptions(false) }, { name: 'cny', label: 'จำนวน (¥)', type: 'number', step: '0.01', value: e.cny, req: true }] },
      { name: 'label', label: 'รายการ', value: e.label, req: true, ph: 'เช่น Didi รร. → Disneyland' },
      { row: [{ name: 'payer', label: 'จ่ายโดย', type: 'select', value: e.payer, options: [{ v: '', t: '—' }].concat(people.map((p) => ({ v: p, t: p }))) }, { name: 'split', label: 'หาร', value: e.split, ph: 'เช่น หาร 4' }] },
    ], (v) => { Object.assign(e, v, { day: +v.day, cny: Number(v.cny) }); if (!id) state.expenses.push(e); save(); });
  }
  function editTip(id) {
    const t = id ? state.tips.find((x) => x.id === id) : { id: uid('t'), title: '', text: '', link: '' };
    openForm(id ? 'แก้ไขทิปส์' : 'เพิ่มทิปส์', [
      { name: 'title', label: 'หัวข้อ', value: t.title, req: true },
      { name: 'text', label: 'รายละเอียด', type: 'textarea', value: t.text },
      { name: 'link', label: 'ลิงก์', type: 'url', value: t.link },
    ], (v) => { Object.assign(t, v); if (!id) state.tips.push(t); save(); });
  }

  function copyText(str) {
    if (!str) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(() => {
        toast(`คัดลอก “${str}” แล้ว ✓`);
      }).catch(() => {
        copyFallback(str);
      });
    } else {
      copyFallback(str);
    }
  }
  function copyFallback(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      toast(`คัดลอก “${str}” แล้ว ✓`);
    } catch (_) {
      prompt('กด Ctrl+C เพื่อคัดลอก:', str);
    }
    document.body.removeChild(ta);
  }

  /* ---------------- Events ---------------- */
  document.addEventListener('click', (ev) => {
    const copyBtn = ev.target.closest('[data-copy]');
    if (copyBtn) {
      copyText(copyBtn.dataset.copy);
      return;
    }
    const tab = ev.target.closest('[data-tab]');
    if (tab) return go(tab.dataset.tab);
    if (ev.target.closest('[data-close]') || ev.target === $('#modal')) return closeModal();
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const card = btn.closest('.item');
    const loc = card ? findItem(card.dataset.id) : null;
    const id = btn.dataset.id;
    switch (act) {
      case 'toggle': loc.list[loc.i].done = !loc.list[loc.i].done; save(null); break;
      case 'more': { const n = $('.item-note', card); const c = n.classList.toggle('clamp'); btn.textContent = c ? 'อ่านเพิ่ม ▾' : 'ย่อ ▴'; break; }
      case 'edit': editItem(card.dataset.id); break;
      case 'up': case 'down': {
        const j = loc.i + (act === 'up' ? -1 : 1);
        if (j < 0 || j >= loc.list.length) return;
        [loc.list[loc.i], loc.list[j]] = [loc.list[j], loc.list[loc.i]]; save(null); break;
      }
      case 'to-ideas': state.ideas.push(loc.list.splice(loc.i, 1)[0]); save('ย้ายไปไอเดียสำรองแล้ว'); break;
      case 'del': if (confirm('ลบกิจกรรมนี้?')) { loc.list.splice(loc.i, 1); save('ลบแล้ว'); } break;
      case 'add-item': editItem(null, dayIdx); break;
      case 'add-idea': editItem(null, 'ideas'); break;
      case 'sort-day': {
        const d = state.days[dayIdx].items;
        // stable sort: items without time stay after the previous timed item
        let last = '';
        const keyed = d.map((x, k) => { if (x.time) last = x.time; return { x, k, t: x.time || last }; });
        keyed.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.k - b.k));
        state.days[dayIdx].items = keyed.map((o) => o.x); save('เรียงตามเวลาแล้ว'); break;
      }
      case 'edit-day': {
        const d = state.days[dayIdx];
        openForm(`ชื่อของ Day ${dayIdx + 1}`, [{ name: 'title', label: 'ชื่อ/ธีมของวัน', value: d.title, req: true }], (v) => { d.title = v.title; save(); });
        break;
      }
      case 'edit-flight': editFlight(id); break;
      case 'edit-hotel': editHotel(); break;
      case 'edit-budget': editBudget(id); break;
      case 'add-budget': editBudget(); break;
      case 'del-budget': if (confirm('ลบรายการนี้?')) { state.budget = state.budget.filter((x) => x.id !== id); save('ลบแล้ว'); } break;
      case 'add-exp': editExpense(); break;
      case 'edit-exp': editExpense(id); break;
      case 'del-exp': if (confirm('ลบรายการนี้?')) { state.expenses = state.expenses.filter((x) => x.id !== id); save('ลบแล้ว'); } break;
      case 'edit-rate':
        openForm('อัตราแลกเปลี่ยน', [{ name: 'rate', label: '1 หยวน (¥) = ? บาท', type: 'number', step: '0.0001', value: state.trip.rate, req: true }], (v) => { state.trip.rate = Number(v.rate); save(); });
        break;
      case 'edit-tip': editTip(id); break;
      case 'add-tip': editTip(); break;
      case 'del-tip': if (confirm('ลบทิปส์นี้?')) { state.tips = state.tips.filter((x) => x.id !== id); save('ลบแล้ว'); } break;
    }
  });
  $('#tripTitle').addEventListener('click', () => { if (isEditing()) editTrip(); });
  $('#editToggle').addEventListener('click', (e) => {
    const on = document.body.classList.toggle('editing');
    e.currentTarget.setAttribute('aria-pressed', on);
    e.currentTarget.textContent = on ? '✅ เสร็จสิ้น' : '✏️ โหมดแก้ไข';
    toast(on ? 'เปิดโหมดแก้ไข — กดที่ชื่อทริปเพื่อแก้วันที่ได้' : 'ปิดโหมดแก้ไข');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `shanghai-trip-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.days || !data.trip) throw new Error('bad');
      if (!confirm('แทนที่ข้อมูลปัจจุบันด้วยไฟล์นี้?')) return;
      state = data; dayIdx = 0; save('นำเข้าข้อมูลแล้ว');
    } catch (_) { alert('ไฟล์ไม่ถูกต้อง'); }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('รีเซ็ตทุกอย่างกลับเป็นข้อมูลเริ่มต้น? (การแก้ไขทั้งหมดจะหายไป)')) return;
    state = clone(window.DEFAULT_TRIP); dayIdx = 0; view = 'overview'; save('รีเซ็ตแล้ว');
  });

  // keep in sync when another tab edits (local mode)
  window.addEventListener('storage', (e) => { if (mode === 'local' && e.key === LS_KEY && e.newValue) { state = JSON.parse(e.newValue); render(); } });

  load().then(() => {
    // open today's day automatically during the trip
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const i = Math.round((today - parseDate(state.trip.start)) / 864e5);
    if (i >= 0 && i < state.days.length) { view = 'day'; dayIdx = i; }
    render();
    setInterval(renderHeader, 60000);
  });
})();
