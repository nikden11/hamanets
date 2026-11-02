// Гаманець — особистий облік витрат. Інтерфейс.
import { state, load, put, remove, removeMany, putMany, commit, saveSettings, replaceAll, resetToDefaults, snapshot, sortAll } from './db.js';
import * as U from './util.js';
import { summarize, accountBalances, budgetProgress, monthlyTotals, convert } from './calc.js';
import { parseMonefy, buildImport } from './monefy.js';

export const APP_VERSION = '1.0.0';

const { esc, fmtMoney } = U;
const $ = (s, r = document) => r.querySelector(s);

// ---------- Іконки ----------
const ICONS = {
  chevL: '<polyline points="15 18 9 12 15 6"/>',
  chevR: '<polyline points="9 18 15 12 9 6"/>',
  chevD: '<polyline points="6 9 12 15 18 9"/>',
  chevU: '<polyline points="18 15 12 9 6 15"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  back: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  arrowR: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// ---------- Стан інтерфейсу ----------
const ui = {
  tab: 'home',
  accountId: null,
  period: { kind: 'month', anchor: U.today(), custom: null },
  opsCat: null,
  opsSearch: '',
  budgetAnchor: U.today(),
  catTab: 'expense',
};
try {
  const saved = JSON.parse(localStorage.getItem('hamanets-ui') || '{}');
  if (saved.periodKind && saved.periodKind !== 'custom') ui.period.kind = saved.periodKind;
} catch { /* приватний режим — працюємо без запам'ятовування */ }
const saveUi = () => { try { localStorage.setItem('hamanets-ui', JSON.stringify({ periodKind: ui.period.kind })); } catch { } };

const acc = (id) => state.accounts.find((a) => a.id === id);
const cat = (id) => state.categories.find((c) => c.id === id);
const base = () => state.settings.baseCurrency;
const rates = () => state.settings.rates;
const catsOf = (type) => state.categories.filter((c) => c.type === type && !c.archived);
const accounts = () => state.accounts.filter((a) => !a.archived);
const range = () => U.periodRange(ui.period.kind, ui.period.anchor, ui.period.custom);
const NO_CAT = { name: 'Без категорії', icon: '❔', color: '#9aa0a6' };

// ---------- Рендер ----------
function render() {
  applyTheme();
  const views = { home: viewHome, ops: viewOps, budgets: viewBudgets, accounts: viewAccounts };
  $('#app').innerHTML = views[ui.tab]() + tabbar();
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function tabbar() {
  const t = (id, icon, label) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}">${ic(icon)}<span>${label}</span></button>`;
  return `<nav class="tabbar"><div class="tabbar-in">
    ${t('home', 'pie', 'Огляд')}${t('ops', 'list', 'Операції')}${t('budgets', 'target', 'Бюджети')}${t('accounts', 'card', 'Рахунки')}
  </div></nav>`;
}

function headerTop() {
  const a = acc(ui.accountId);
  const label = a ? `${a.icon} <span class="n">${esc(a.name)}</span>` : `<span class="n">Усі рахунки</span>`;
  return `<div class="top-row">
    <button class="acc-switch" data-a="pickAccount">${label}${ic('chevD')}</button>
    <button class="icon-btn" data-a="settings" aria-label="Налаштування">${ic('sliders')}</button>
  </div>`;
}

function periodRow() {
  const all = ui.period.kind === 'all' || ui.period.kind === 'custom';
  return `<div class="period-row">
    <button class="icon-btn" data-a="periodShift" data-dir="-1" ${all ? 'disabled' : ''} aria-label="Попередній">${ic('chevL')}</button>
    <button class="period-label" data-a="pickPeriod">${esc(range().label)}</button>
    <button class="icon-btn" data-a="periodShift" data-dir="1" ${all ? 'disabled' : ''} aria-label="Наступний">${ic('chevR')}</button>
  </div>`;
}

function currentSummary() {
  const r = range();
  return summarize({ txs: state.txs, accounts: state.accounts, accountId: ui.accountId, start: r.start, end: r.end, base: base(), rates: rates() });
}

// ---------- Огляд ----------
// Клітинки навколо діаграми за годинниковою стрілкою (сітка 4×5, центр зайнятий діаграмою)
const RING_POS = [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [5, 3], [5, 2], [5, 1], [4, 1], [3, 1], [2, 1]];
// Порядок заповнення, щоб при неповному наборі кільце було симетричним
const RING_FILL = [0, 1, 2, 3, 7, 8, 9, 10, 5, 12, 4, 13, 6, 11];

function ringSlots(n) {
  const used = new Set(RING_FILL.slice(0, n));
  return RING_POS.filter((_, i) => used.has(i));
}

function donutSvg(segs, size = 200, stroke = 24) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, total = segs.reduce((s, x) => s + x.value, 0);
  let out = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--idle)" stroke-width="${stroke}"/>`;
  if (total > 0) {
    const gap = segs.length > 1 ? 2 : 0;
    let off = 0;
    for (const s of segs) {
      const len = (s.value / total) * C;
      const vis = Math.max(len - gap, 0.5);
      out += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
        stroke-dasharray="${vis} ${C - vis}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      off += len;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}">${out}</svg>`;
}

function viewHome() {
  const s = currentSummary();
  const cats = catsOf('expense');
  const more = cats.length > RING_POS.length;
  const shown = more ? cats.slice(0, RING_POS.length - 1) : cats;
  const slots = ringSlots(shown.length + (more ? 1 : 0));
  const cells = shown.map((c, i) => {
    const amt = s.byCat.get(c.id)?.amount ?? 0;
    const [r, col] = slots[i];
    return `<button class="ring-cat ${amt ? 'on' : ''}" style="grid-area:${r}/${col};--c:${c.color}" data-a="addTx" data-type="expense" data-cat="${c.id}" aria-label="${esc(c.name)}">
      <span class="ring-ico">${c.icon}</span><span class="ring-amt num">${amt ? fmtMoney(amt, s.currency, { short: true }) : esc(c.name)}</span></button>`;
  });
  if (more) {
    const [r, col] = slots[slots.length - 1];
    cells.push(`<button class="ring-cat" style="grid-area:${r}/${col}" data-a="addTx" data-type="expense"><span class="ring-ico">•••</span><span class="ring-amt">Ще</span></button>`);
  }
  const segs = [...s.byCat.entries()].filter(([, v]) => v.type === 'expense')
    .sort((a, b) => b[1].amount - a[1].amount).map(([id, v]) => ({ value: v.amount, color: (cat(id) ?? NO_CAT).color }));

  return `<header class="top">${headerTop()}${periodRow()}</header>
  <section class="ring" id="ring">
    ${cells.join('')}
    <div class="ring-center" data-a="goOps">
      ${donutSvg(segs)}
      <div class="donut-text">
        <div class="inc num">${fmtMoney(s.income, s.currency)}</div>
        <div class="exp num">${fmtMoney(s.expense, s.currency)}</div>
      </div>
    </div>
  </section>
  <div class="big-actions">
    <button class="big minus" data-a="addTx" data-type="expense">${ic('minus')} Витрата</button>
    <button class="big plus" data-a="addTx" data-type="income">${ic('plus')} Дохід</button>
  </div>
  <button class="balance-bar" data-a="goOps"><span>Баланс</span><span class="r"><b class="num ${s.balance < 0 ? 'exp' : ''}">${fmtMoney(s.balance, s.currency)}</b>${ic('chevR')}</span></button>
  ${breakdownCard(s, 'expense', 'Витрати')}
  ${breakdownCard(s, 'income', 'Доходи')}
  ${trendCard()}
  ${backupReminder()}`;
}

function backupReminder() {
  const last = state.settings.lastBackup;
  if (state.txs.length < 20) return '';
  const days = last ? Math.round((U.parseISO(U.today()) - U.parseISO(last)) / 864e5) : null;
  if (days !== null && days < 30) return '';
  return `<div class="card card-pad" style="display:flex;gap:12px;align-items:center">
    <span style="font-size:26px">💾</span>
    <span style="flex:1;font-size:14px">${days === null ? 'Ви ще не робили резервну копію.' : `Остання резервна копія — ${days} дн. тому.`}<br><span class="muted">Дані зберігаються лише на цьому телефоні.</span></span>
    <button class="btn ghost" style="padding:10px 14px" data-a="exportJson">Зберегти</button></div>`;
}

function breakdownCard(s, type, title) {
  const rows = [...s.byCat.entries()].filter(([, v]) => v.type === type).sort((a, b) => b[1].amount - a[1].amount);
  if (!rows.length) return '';
  const total = type === 'expense' ? s.expense : s.income;
  return `<div class="card"><div class="card-h"><span>${title}</span><span class="muted num">${fmtMoney(total, s.currency)}</span></div>
    ${rows.map(([id, v]) => {
      const c = cat(id) ?? NO_CAT;
      const pct = total ? (v.amount / total) * 100 : 0;
      return `<button class="row" data-a="goOps" data-cat="${id}" style="--c:${c.color}">
        <span class="ico">${c.icon}</span>
        <span class="mid"><div class="t1">${esc(c.name)}</div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div></span>
        <span class="amt num">${fmtMoney(v.amount, s.currency)}<small>${pct.toFixed(pct < 10 ? 1 : 0)}% · ${v.count}</small></span>
      </button>`;
    }).join('')}</div>`;
}

function trendCard() {
  if (!state.txs.length) return '';
  const anchor = ui.period.kind === 'all' || ui.period.kind === 'custom' ? U.today() : range().end;
  const txs = ui.accountId ? state.txs.filter((t) => t.accountId === ui.accountId) : state.txs;
  const data = monthlyTotals({ txs, accounts: state.accounts, base: base(), rates: rates(), anchor, n: 6 });
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const curM = anchor.slice(0, 7);
  return `<div class="card"><div class="card-h"><span>6 місяців</span>
    <span class="legend"><span><i style="background:var(--inc)"></i>Доходи</span><span><i style="background:var(--exp)"></i>Витрати</span></span></div>
    <div class="bars">${data.map((d) => `<div class="col"><i class="n" style="height:${(d.income / max) * 100}%"></i><i class="e" style="height:${(d.expense / max) * 100}%"></i></div>`).join('')}</div>
    <div class="bars-x">${data.map((d) => `<span class="${d.month === curM ? 'cur' : ''}">${U.MONTHS_SHORT[+d.month.slice(5) - 1]}</span>`).join('')}</div></div>`;
}

// ---------- Операції ----------
function viewOps() {
  const s = currentSummary();
  const c = ui.opsCat ? cat(ui.opsCat) ?? NO_CAT : null;
  return `<header class="top">${headerTop()}${periodRow()}</header>
  <div class="card stats3">
    <div><small>Доходи</small><b class="inc num">${fmtMoney(s.income, s.currency)}</b></div>
    <div><small>Витрати</small><b class="exp num">${fmtMoney(s.expense, s.currency)}</b></div>
    <div><small>Різниця</small><b class="num">${fmtMoney(s.net, s.currency, { sign: true })}</b></div>
  </div>
  <label class="search">${ic('search')}<input type="search" placeholder="Пошук за нотаткою чи категорією" value="${esc(ui.opsSearch)}" data-in="opsSearch" enterkeyhint="search"></label>
  ${c ? `<div class="chips" style="padding-top:8px"><button class="chip" data-a="clearOpsCat">${c.icon} ${esc(c.name)} ${ic('x')}</button></div>` : ''}
  <div id="ops-list">${opsList(s)}</div>`;
}

function opsList(s = currentSummary()) {
  const q = ui.opsSearch.trim().toLowerCase();
  let list = s.list;
  if (ui.opsCat) list = list.filter((t) => t.categoryId === ui.opsCat);
  if (q) list = list.filter((t) => `${t.note ?? ''} ${(cat(t.categoryId) ?? NO_CAT).name} ${acc(t.accountId)?.name ?? ''}`.toLowerCase().includes(q));
  if (!list.length) {
    return `<div class="empty"><div class="e-ico">🧾</div>${state.txs.length ? 'Немає операцій за цей період' : 'Ще немає жодної операції.<br>Додайте першу кнопкою «Витрата» на головному екрані або імпортуйте історію з Monefy в налаштуваннях.'}</div>`;
  }
  const byDay = new Map();
  for (const t of list) { if (!byDay.has(t.date)) byDay.set(t.date, []); byDay.get(t.date).push(t); }
  const showAcc = !ui.accountId && accounts().length > 1;
  let html = '';
  let n = 0;
  for (const [day, items] of byDay) {
    if (n > 600) { html += `<div class="empty">Показано перші 600 операцій. Звузьте період.</div>`; break; }
    let dayNet = 0;
    for (const t of items) if (t.type !== 'transfer') dayNet += (t.type === 'expense' ? -1 : 1) * convert(t.amount, acc(t.accountId)?.currency ?? base(), s.currency, base(), rates());
    const rel = U.relDay(day);
    html += `<div class="day-h"><span>${rel ? rel + ', ' + U.fmtDate(day) : U.fmtDate(day, { weekday: true })}</span><span class="num">${dayNet ? fmtMoney(dayNet, s.currency, { sign: true }) : ''}</span></div>
      <div class="card" style="margin-top:0">${items.map((t) => txRow(t, showAcc)).join('')}</div>`;
    n += items.length;
  }
  return html;
}

function txRow(t, showAcc) {
  const a = acc(t.accountId);
  if (t.type === 'transfer') {
    const to = acc(t.toAccountId);
    const inc = ui.accountId && t.toAccountId === ui.accountId;
    const amount = inc ? t.toAmount ?? t.amount : t.amount;
    const cur = inc ? to?.currency : a?.currency;
    return `<button class="row" data-a="editTx" data-id="${t.id}" style="--c:var(--accent-soft)">
      <span class="ico">🔁</span>
      <span class="mid"><div class="t1">${esc(a?.name ?? '?')} → ${esc(to?.name ?? '?')}</div><div class="t2">${esc(t.note || 'Переказ')}</div></span>
      <span class="amt num muted">${fmtMoney(amount, cur)}</span></button>`;
  }
  const c = cat(t.categoryId) ?? NO_CAT;
  const sub = [t.note, showAcc ? a?.name : null].filter(Boolean).map(esc).join(' · ');
  return `<button class="row" data-a="editTx" data-id="${t.id}" style="--c:${c.color}">
    <span class="ico">${c.icon}</span>
    <span class="mid"><div class="t1">${esc(c.name)}</div>${sub ? `<div class="t2">${sub}</div>` : ''}</span>
    <span class="amt num ${t.type === 'expense' ? 'exp' : 'inc'}">${t.type === 'expense' ? '−' : '+'}${fmtMoney(t.amount, a?.currency ?? base())}</span></button>`;
}

// ---------- Бюджети ----------
function viewBudgets() {
  const r = U.periodRange('month', ui.budgetAnchor);
  const items = budgetProgress({ budgets: state.budgets, txs: state.txs, accounts: state.accounts, start: r.start, end: r.end, base: base(), rates: rates() })
    .sort((a, b) => (a.categoryId ? 1 : 0) - (b.categoryId ? 1 : 0) || b.ratio - a.ratio);
  const t = U.today();
  const isCur = t >= r.start && t <= r.end;
  const daysLeft = isCur ? U.parseISO(r.end).getDate() - U.parseISO(t).getDate() + 1 : 0;
  const cur = base();

  const body = items.length ? `<div class="card">${items.map((b) => {
    const c = b.categoryId ? cat(b.categoryId) ?? NO_CAT : { name: 'Загальний бюджет', icon: '🎯', color: 'var(--accent-soft)' };
    const pct = Math.min(b.ratio, 1) * 100;
    const color = b.ratio > 1 ? 'var(--exp)' : b.ratio > 0.85 ? 'var(--warn)' : 'var(--inc)';
    const perDay = isCur && b.left > 0 ? ` · ≈${fmtMoney(Math.floor(b.left / daysLeft), cur, { short: true })}/день` : '';
    return `<button class="budget" style="display:block;width:100%;text-align:left;--c:${c.color}" data-a="editBudget" data-id="${b.id}">
      <div class="top-l"><span class="ico">${c.icon}</span><span class="nm">${esc(c.name)}</span><span class="num"><b>${fmtMoney(b.spent, cur, { short: true })}</b> <span class="muted">/ ${fmtMoney(b.amount, cur, { short: true })}</span></span></div>
      <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
      <div class="meta"><span>${Math.round(b.ratio * 100)}%</span><span class="${b.left < 0 ? 'over' : ''}">${b.left < 0 ? `Перевищено на ${fmtMoney(-b.left, cur)}` : `Залишилось ${fmtMoney(b.left, cur)}${perDay}`}</span></div>
    </button>`;
  }).join('')}</div>` : `<div class="empty"><div class="e-ico">🎯</div>Бюджетів ще немає.<br>Задайте місячний ліміт на категорію або загальний — і стежте, скільки ще можна витратити.</div>`;

  return `<header class="top"><div class="top-row"><span class="top-title">Бюджети</span>
    <button class="icon-btn" data-a="editBudget" aria-label="Додати бюджет">${ic('plus')}</button></div>
    <div class="period-row">
      <button class="icon-btn" data-a="budgetShift" data-dir="-1">${ic('chevL')}</button>
      <span class="period-label" style="text-align:center">${esc(r.label)}</span>
      <button class="icon-btn" data-a="budgetShift" data-dir="1">${ic('chevR')}</button>
    </div></header>
    ${body}
    <div class="btns"><button class="btn ghost" data-a="editBudget">${ic('plus')} Додати бюджет</button></div>
    <p class="hint" style="padding:0 20px">Ліміти — на календарний місяць, у базовій валюті (${cur}), враховуються витрати з усіх рахунків.</p>`;
}

// ---------- Рахунки ----------
function viewAccounts() {
  const bal = accountBalances(state.accounts, state.txs);
  let total = 0;
  for (const a of accounts()) if (!a.excludeFromTotal) total += convert(bal.get(a.id), a.currency, base(), base(), rates());
  return `<header class="top"><div class="top-row"><span class="top-title">Рахунки</span>
    <button class="icon-btn" data-a="editAccount" aria-label="Додати рахунок">${ic('plus')}</button></div></header>
  <div class="card card-pad"><div class="muted" style="font-size:14px">Усього</div><div class="num" style="font-size:30px;font-weight:700">${fmtMoney(total, base())}</div></div>
  <div class="card">${accounts().map((a) => {
    const b = bal.get(a.id);
    const other = a.currency !== base() ? `<small>≈ ${fmtMoney(convert(b, a.currency, base(), base(), rates()), base())}</small>` : '';
    return `<div class="row tap" style="--c:${a.color}" data-a="editAccount" data-id="${a.id}">
      <span class="ico">${a.icon}</span>
      <span class="mid"><div class="t1">${esc(a.name)}</div><div class="t2">${a.currency}${a.excludeFromTotal ? ' · не в загальному балансі' : ''}</div></span>
      <span class="amt num ${b < 0 ? 'exp' : ''}">${fmtMoney(b, a.currency)}${other}</span></div>`;
  }).join('')}</div>
  <div class="btns">
    <button class="btn ghost" data-a="transfer">${ic('swap')} Переказ</button>
    <button class="btn ghost" data-a="editAccount">${ic('plus')} Рахунок</button>
  </div>`;
}

// ---------- Шторки ----------
const sheets = [];

function openSheet({ render: r, full = false, cls = '', onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="backdrop" data-a="closeSheet"></div><div class="sheet ${full ? 'full' : ''} ${cls}"></div>`;
  document.body.appendChild(wrap);
  const sh = { wrap, el: wrap.querySelector('.sheet'), render: r, onClose };
  sheets.push(sh);
  refreshSheet(sh);
  void wrap.offsetHeight; // примусовий reflow, щоб спрацювала анімація появи
  wrap.classList.add('in');
  document.body.style.overflow = 'hidden';
  return sh;
}

function refreshSheet(sh = sheets[sheets.length - 1]) {
  if (!sh) return;
  const b = sh.el.querySelector('.sheet-b');
  const scroll = b?.scrollTop ?? 0;
  sh.el.innerHTML = sh.render();
  const nb = sh.el.querySelector('.sheet-b');
  if (nb) nb.scrollTop = scroll;
}

function closeSheet() {
  const sh = sheets.pop();
  if (!sh) return;
  sh.wrap.classList.remove('in');
  sh.wrap.style.pointerEvents = 'none';
  setTimeout(() => sh.wrap.remove(), 260);
  if (!sheets.length) document.body.style.overflow = '';
  sh.onClose?.();
}

const sheetHead = (title, right = '') => `<div class="grabber"></div><div class="sheet-h">
  <button class="icon-btn" data-a="closeSheet" aria-label="Закрити">${ic('x')}</button>
  <div class="ttl">${title}</div><div style="width:44px;display:flex;justify-content:flex-end">${right}</div></div>`;

let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.replaceChildren();
  const span = document.createElement('span');
  span.textContent = msg;
  el.append(span);
  if (action) {
    const b = document.createElement('button');
    b.dataset.a = 'toastAction'; b.textContent = action.label;
    el.append(b);
  }
  el._action = action?.fn;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 5000 : 2200);
}

// ---------- Редактор операції ----------
let ed = null;

function openEditor({ type = 'expense', categoryId = null, tx = null } = {}) {
  if (!accounts().length) { toast('Спочатку створіть рахунок'); return; }
  const defAcc = ui.accountId ?? state.settings.lastAccountId;
  ed = tx ? {
    id: tx.id, orig: tx, type: tx.type, expr: String(U.fromMinor(tx.amount)).replace('.', ','), categoryId: tx.categoryId,
    accountId: tx.accountId, date: tx.date, note: tx.note ?? '', step: 'amount',
  } : {
    id: null, type, expr: '', categoryId, accountId: acc(defAcc) && !acc(defAcc).archived ? defAcc : accounts()[0].id,
    date: ui.period.kind === 'day' && ui.period.anchor !== U.today() ? ui.period.anchor : U.today(), note: '', step: 'amount',
  };
  openSheet({ render: renderEditor, full: true, onClose: () => { ed = null; } });
}

function edValue() { return U.calcExpr(ed.expr); }

function renderEditor() {
  if (ed.step === 'category') return renderCatStep();
  const a = acc(ed.accountId);
  const c = ed.categoryId ? cat(ed.categoryId) : null;
  const hasOp = /[+\-−×÷*/]/.test(ed.expr.replace(/^-/, ''));
  const v = edValue();
  const rel = U.relDay(ed.date);
  const k = (label, key, cls = '') => `<button class="${cls}" data-a="key" data-k="${key}">${label}</button>`;
  return `<div class="ed ${ed.type}">
    <div class="ed-top">
      <div class="sheet-h">
        <button class="icon-btn" data-a="closeSheet" aria-label="Закрити">${ic('x')}</button>
        <div class="ed-types">
          <button class="${ed.type === 'expense' ? 'on' : ''}" data-a="edType" data-type="expense">Витрата</button>
          <button class="${ed.type === 'income' ? 'on' : ''}" data-a="edType" data-type="income">Дохід</button>
        </div>
        ${ed.id ? `<button class="icon-btn" data-a="edDelete" aria-label="Видалити">${ic('trash')}</button>` : '<div style="width:44px"></div>'}
      </div>
      <div class="ed-amount" id="ed-amount">${edAmountHtml(hasOp, v, a)}</div>
    </div>
    <div class="ed-chips">
      <button class="chip ed-cat-chip" data-a="edPickCat" style="${c ? `background:${c.color};color:#fff` : ''}">${c ? `${c.icon} ${esc(c.name)}` : 'Категорія…'}</button>
      <button class="chip" data-a="edPickAcc">${a.icon} ${esc(a.name)}</button>
      <label class="chip">${ic('cal')} ${rel ?? U.fmtDate(ed.date)}<input type="date" value="${ed.date}" data-in="edDate" max="2100-12-31"></label>
    </div>
    <div class="ed-note"><input type="text" placeholder="Нотатка" value="${esc(ed.note)}" data-in="edNote" enterkeyhint="done" maxlength="200"></div>
    <div class="keypad">
      ${k('7', '7')}${k('8', '8')}${k('9', '9')}${k('÷', '÷', 'op')}
      ${k('4', '4')}${k('5', '5')}${k('6', '6')}${k('×', '×', 'op')}
      ${k('1', '1')}${k('2', '2')}${k('3', '3')}${k('−', '−', 'op')}
      ${k(',', ',')}${k('0', '0')}${k(ic('back'), 'back', 'op')}${k('+', '+', 'op')}
    </div>
    <button class="ok-btn" data-a="edOk">${c || ed.id ? `${ic('check')} Зберегти` : `Обрати категорію ${ic('arrowR')}`}</button>
  </div>`;
}

function edAmountHtml(hasOp, v, a) {
  return `<div class="expr num">${hasOp ? esc(ed.expr) + ' =' : ''}</div>
    <div class="val num">${Number.isFinite(v) ? fmtMoney(U.toMinor(v), a.currency) : fmtMoney(0, a.currency)}</div>`;
}

function updateEdAmount() {
  const el = $('#ed-amount');
  if (!el) return refreshSheet();
  const hasOp = /[+\-−×÷*/]/.test(ed.expr.replace(/^-/, ''));
  el.innerHTML = edAmountHtml(hasOp, edValue(), acc(ed.accountId));
}

function edKey(k) {
  if (!ed) return;
  const ops = '+−×÷';
  let e = ed.expr;
  if (k === 'back') e = e.slice(0, -1);
  else if (ops.includes(k)) {
    if (!e) return;
    e = ops.includes(e.slice(-1)) || e.endsWith(',') ? e.slice(0, -1) + k : e + k;
  } else if (k === ',') {
    const last = e.split(/[+−×÷]/).pop();
    if (last.includes(',')) return;
    e += last === '' ? '0,' : ',';
  } else {
    const last = e.split(/[+−×÷]/).pop();
    if (last.includes(',') && last.split(',')[1].length >= 2) return;
    if (last.replace(',', '').length >= 10) return;
    e = last === '0' ? e.slice(0, -1) + k : e + k;
  }
  ed.expr = e;
  updateEdAmount();
}

function renderCatStep() {
  const cats = catsOf(ed.type);
  return `${sheetHead(ed.type === 'expense' ? 'Категорія витрати' : 'Категорія доходу')}
  <div class="sheet-b"><div class="cat-grid">
    ${cats.map((c) => `<button class="cat-tile ${c.id === ed.categoryId ? 'sel' : ''}" style="--c:${c.color}" data-a="edCat" data-id="${c.id}"><span class="ico">${c.icon}</span><span>${esc(c.name)}</span></button>`).join('')}
    <button class="cat-tile add" data-a="editCategory" data-type="${ed.type}"><span class="ico">${ic('plus')}</span><span>Нова</span></button>
  </div></div>`;
}

async function saveEditor() {
  const v = edValue();
  if (!(v > 0)) {
    $('#ed-amount')?.classList.add('shake');
    setTimeout(() => $('#ed-amount')?.classList.remove('shake'), 300);
    toast('Введіть суму більше нуля');
    return;
  }
  if (!ed.categoryId || cat(ed.categoryId)?.type !== ed.type) {
    ed.step = 'category'; ed.pending = true; refreshSheet(); return;
  }
  const t = {
    ...(ed.orig ?? {}), id: ed.id ?? U.uid(), type: ed.type, amount: U.toMinor(v), accountId: ed.accountId,
    categoryId: ed.categoryId, date: ed.date, note: ed.note.trim(), createdAt: ed.orig?.createdAt ?? Date.now(),
  };
  delete t.toAccountId; delete t.toAmount;
  await put('txs', t);
  if (!ed.id) { state.settings.lastAccountId = ed.accountId; saveSettings(); }
  const c = cat(t.categoryId);
  const isNew = !ed.id;
  closeSheet();
  render();
  toast(`${c.icon} ${c.name}: ${t.type === 'expense' ? '−' : '+'}${fmtMoney(t.amount, acc(t.accountId).currency)}${isNew ? '' : ' · збережено'}`);
  persistStorage();
}

async function deleteTx(id) {
  const t = state.txs.find((x) => x.id === id);
  if (!t) return;
  await remove('txs', id);
  render();
  toast('Операцію видалено', { label: 'Повернути', fn: async () => { await put('txs', t); render(); } });
}

// ---------- Вибір рахунку / періоду ----------
function pickAccountSheet({ title = 'Рахунок', allowAll = false, selected, onPick }) {
  const bal = accountBalances(state.accounts, state.txs);
  openSheet({
    render: () => `${sheetHead(title)}<div class="sheet-b"><div class="card" style="margin-top:4px">
      ${allowAll ? `<button class="row" data-a="pickAcc" data-id=""><span class="ico" style="--c:var(--accent-soft)">💼</span><span class="mid"><div class="t1">Усі рахунки</div></span>${!selected ? ic('check') : ''}</button>` : ''}
      ${accounts().map((a) => `<button class="row" data-a="pickAcc" data-id="${a.id}" style="--c:${a.color}"><span class="ico">${a.icon}</span>
        <span class="mid"><div class="t1">${esc(a.name)}</div><div class="t2 num">${fmtMoney(bal.get(a.id), a.currency)}</div></span>${selected === a.id ? ic('check') : ''}</button>`).join('')}
    </div></div>`,
  });
  pickAccCb = onPick;
}
let pickAccCb = null;

function pickPeriodSheet() {
  const p = ui.period;
  const custom = p.custom ?? { start: U.periodRange('month', U.today()).start, end: U.today() };
  openSheet({
    render: () => `${sheetHead('Період')}<div class="sheet-b"><div class="card" style="margin-top:4px">
      ${U.PERIODS.filter(([k]) => k !== 'custom').map(([k, l]) => `<button class="row" data-a="setPeriod" data-kind="${k}"><span class="mid"><div class="t1">${l}</div></span>${p.kind === k ? ic('check') : ''}</button>`).join('')}
      <button class="row" data-a="goToday"><span class="mid"><div class="t1">Повернутись до сьогодні</div></span></button>
    </div>
    <div class="section-t">Довільний інтервал</div>
    <div class="form"><div class="two">
      <div class="field"><label>З</label><input type="date" id="pc-start" value="${custom.start}"></div>
      <div class="field"><label>По</label><input type="date" id="pc-end" value="${custom.end}"></div>
    </div><button class="btn block" data-a="setCustom">Показати інтервал</button></div></div>`,
  });
}

// ---------- Переказ ----------
let tr = null;

function openTransfer(tx = null) {
  const accs = accounts();
  if (accs.length < 2) { toast('Для переказу потрібно щонайменше 2 рахунки'); return; }
  tr = tx ? { id: tx.id, orig: tx, from: tx.accountId, to: tx.toAccountId, amount: U.fromMinor(tx.amount), toAmount: U.fromMinor(tx.toAmount ?? tx.amount), date: tx.date, note: tx.note ?? '', toTouched: true }
    : { id: null, from: accs[0].id, to: accs[1].id, amount: '', toAmount: '', date: U.today(), note: '', toTouched: false };
  openSheet({ render: renderTransfer, onClose: () => { tr = null; } });
}

function renderTransfer() {
  const f = acc(tr.from), t = acc(tr.to);
  const diff = f && t && f.currency !== t.currency;
  const opts = (sel) => accounts().map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.icon} ${esc(a.name)} (${a.currency})</option>`).join('');
  return `${sheetHead(tr.id ? 'Переказ' : 'Новий переказ', tr.id ? `<button class="icon-btn" data-a="trDelete" aria-label="Видалити">${ic('trash')}</button>` : '')}
  <div class="sheet-b"><div class="form">
    <div class="field"><label>З рахунку</label><select data-in="trFrom">${opts(tr.from)}</select></div>
    <div class="field"><label>На рахунок</label><select data-in="trTo">${opts(tr.to)}</select></div>
    <div class="${diff ? 'two' : ''}">
      <div class="field"><label>Сума${diff ? `, ${f.currency}` : ''}</label><input inputmode="decimal" data-in="trAmount" value="${tr.amount === '' ? '' : String(tr.amount).replace('.', ',')}" placeholder="0,00"></div>
      ${diff ? `<div class="field"><label>Зараховано, ${t.currency}</label><input inputmode="decimal" data-in="trToAmount" id="tr-to" value="${tr.toAmount === '' ? '' : String(tr.toAmount).replace('.', ',')}" placeholder="0,00"></div>` : ''}
    </div>
    ${diff ? `<p class="hint" style="margin-top:-8px">Сума зарахування рахується за курсом із налаштувань, можна змінити вручну.</p>` : ''}
    <div class="field"><label>Дата</label><input type="date" data-in="trDate" value="${tr.date}"></div>
    <div class="field"><label>Нотатка</label><input type="text" data-in="trNote" value="${esc(tr.note)}" maxlength="200"></div>
    <button class="btn block" data-a="trSave">${ic('check')} Зберегти</button>
  </div></div>`;
}

function trAutoTo() {
  const f = acc(tr.from), t = acc(tr.to);
  if (!f || !t || f.currency === t.currency || tr.toTouched) return;
  const v = U.calcExpr(String(tr.amount));
  tr.toAmount = v > 0 ? U.fromMinor(convert(U.toMinor(v), f.currency, t.currency, base(), rates())) : '';
  const el = $('#tr-to');
  if (el) el.value = tr.toAmount === '' ? '' : String(tr.toAmount).replace('.', ',');
}

async function saveTransfer() {
  const num = (x) => U.calcExpr(String(x));
  const amount = num(tr.amount);
  if (tr.from === tr.to) return toast('Оберіть різні рахунки');
  if (!(amount > 0)) return toast('Введіть суму');
  const f = acc(tr.from), t = acc(tr.to);
  const toAmount = f.currency === t.currency ? amount : num(tr.toAmount);
  if (!(toAmount > 0)) return toast('Введіть суму зарахування');
  const rec = {
    ...(tr.orig ?? {}), id: tr.id ?? U.uid(), type: 'transfer', amount: U.toMinor(amount), accountId: tr.from, toAccountId: tr.to,
    toAmount: U.toMinor(toAmount), date: tr.date || U.today(), note: tr.note.trim(), createdAt: tr.orig?.createdAt ?? Date.now(),
  };
  delete rec.categoryId;
  await put('txs', rec);
  closeSheet();
  render();
  toast(`🔁 ${f.name} → ${t.name}: ${fmtMoney(rec.amount, f.currency)}`);
}

// ---------- Рахунок: редагування ----------
const ACC_ICONS = ['👛', '💳', '🏦', '💵', '💶', '🪙', '🐷', '💰', '📈', '🏠', '🚗', '🎁', '🧳', '🛡️', '💎', '🧾'];

let accEd = null;
function openAccountEditor(id) {
  const a = id ? acc(id) : null;
  accEd = a ? { ...a, initial: U.fromMinor(a.initialBalance || 0) } : {
    id: null, name: '', icon: '💳', currency: base(), initial: 0, color: U.PALETTE[(state.accounts.length * 5) % U.PALETTE.length], excludeFromTotal: false,
  };
  openSheet({ render: renderAccEditor, onClose: () => { accEd = null; } });
}

function renderAccEditor() {
  const e = accEd;
  const nTx = e.id ? state.txs.filter((t) => t.accountId === e.id || t.toAccountId === e.id).length : 0;
  return `${sheetHead(e.id ? 'Рахунок' : 'Новий рахунок')}
  <div class="sheet-b"><div class="form">
    <div class="field"><label>Назва</label><input type="text" data-in="accName" value="${esc(e.name)}" placeholder="Напр. Монобанк" maxlength="40"></div>
    <div class="two">
      <div class="field"><label>Валюта</label><select data-in="accCur" ${nTx ? 'disabled' : ''}>${U.CURRENCIES.map((c) => `<option ${c === e.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Початковий баланс</label><input inputmode="decimal" data-in="accInit" value="${String(e.initial).replace('.', ',')}"></div>
    </div>
    <div class="field"><label>Іконка</label><div class="emoji-grid">${ACC_ICONS.map((x) => `<button class="${x === e.icon ? 'sel' : ''}" data-a="accIcon" data-v="${x}">${x}</button>`).join('')}</div></div>
    <div class="field"><label>Колір</label><div class="color-grid">${U.PALETTE.slice(0, 12).map((c) => `<button class="${c === e.color ? 'sel' : ''}" style="--c:${c}" data-a="accColor" data-v="${c}" aria-label="${c}"></button>`).join('')}</div></div>
    ${nTx ? '<p class="hint" style="margin-top:-8px">Валюту не можна змінити, поки на рахунку є операції.</p>' : ''}
    <label class="check"><input type="checkbox" data-in="accExcl" ${e.excludeFromTotal ? 'checked' : ''}> Не враховувати в загальному балансі</label>
    <button class="btn block" data-a="accSave">${ic('check')} Зберегти</button>
    ${e.id ? `<button class="btn block ghost" data-a="accShow">Показати операції рахунку</button>
      <button class="btn block danger" data-a="accDelete">${ic('trash')} Видалити рахунок${nTx ? ` і ${nTx} операцій` : ''}</button>` : ''}
  </div></div>`;
}

async function saveAccount() {
  const e = accEd;
  if (!e.name.trim()) return toast('Введіть назву рахунку');
  const init = U.calcExpr(String(e.initial || 0));
  const rec = {
    ...(e.id ? acc(e.id) : { order: state.accounts.length }), id: e.id ?? U.uid(), name: e.name.trim(), icon: e.icon, currency: e.currency,
    initialBalance: Number.isFinite(init) ? U.toMinor(init) : 0, color: e.color, excludeFromTotal: !!e.excludeFromTotal,
  };
  ensureRate(rec.currency);
  await put('accounts', rec);
  closeSheet();
  render();
}

const DEFAULT_RATES = { USD: 45.5, EUR: 51, PLN: 12, GBP: 59, CHF: 54, CZK: 2.05 };

function ensureRate(cur) {
  if (cur !== base() && !rates()[cur]) {
    rates()[cur] = DEFAULT_RATES[cur] ?? 1;
    saveSettings();
    toast(`Додано валюту ${cur} — перевірте курс у налаштуваннях`);
  }
}

// ---------- Категорії ----------
let catEd = null;
function openCategoryEditor({ id, type = 'expense' } = {}) {
  const c = id ? cat(id) : null;
  catEd = c ? { ...c } : { id: null, name: '', icon: type === 'income' ? '💰' : '📦', type, color: U.PALETTE[catsOf(type).length % U.PALETTE.length] };
  openSheet({ render: renderCatEditor, onClose: () => { catEd = null; } });
}

function renderCatEditor() {
  const e = catEd;
  const used = e.id ? state.txs.filter((t) => t.categoryId === e.id).length : 0;
  const others = state.categories.filter((c) => c.type === e.type && c.id !== e.id);
  return `${sheetHead(e.id ? 'Категорія' : 'Нова категорія')}
  <div class="sheet-b"><div class="form">
    <div style="display:flex;justify-content:center"><span class="cat-tile" style="--c:${e.color}"><span class="ico" style="width:72px;height:72px;font-size:36px">${e.icon}</span></span></div>
    ${e.id ? '' : `<div class="seg" style="margin:0"><button class="${e.type === 'expense' ? 'on' : ''}" data-a="catType" data-v="expense">Витрата</button><button class="${e.type === 'income' ? 'on' : ''}" data-a="catType" data-v="income">Дохід</button></div>`}
    <div class="field"><label>Назва</label><input type="text" data-in="catName" value="${esc(e.name)}" placeholder="Напр. Кава" maxlength="30"></div>
    <div class="field"><label>Іконка <span style="font-weight:400">(або впишіть будь-який емодзі)</span></label>
      <input type="text" data-in="catIcon" value="${esc(e.icon)}" maxlength="8" style="margin-bottom:8px;width:90px;text-align:center;font-size:22px;padding:6px">
      <div class="emoji-grid">${[...new Set(U.EMOJIS)].map((x) => `<button class="${x === e.icon ? 'sel' : ''}" data-a="catIconPick" data-v="${x}">${x}</button>`).join('')}</div></div>
    <div class="field"><label>Колір</label><div class="color-grid">${U.PALETTE.map((c) => `<button class="${c === e.color ? 'sel' : ''}" style="--c:${c}" data-a="catColor" data-v="${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <button class="btn block" data-a="catSave">${ic('check')} Зберегти</button>
    ${e.id ? `<div class="field" style="margin-top:8px"><label>Видалення${used ? ` · ${used} операцій` : ''}</label>
      ${used && others.length ? `<select id="cat-move">${others.map((c) => `<option value="${c.id}">Перенести операції в: ${c.icon} ${esc(c.name)}</option>`).join('')}<option value="">Видалити операції разом із категорією</option></select>` : ''}
      <button class="btn block danger" style="margin-top:8px" data-a="catDelete">${ic('trash')} Видалити категорію</button></div>` : ''}
  </div></div>`;
}

async function saveCategory() {
  const e = catEd;
  if (!e.name.trim()) return toast('Введіть назву категорії');
  const rec = { ...(e.id ? cat(e.id) : { order: catsOf(e.type).length }), id: e.id ?? U.uid(), name: e.name.trim(), icon: U.cleanIcon(e.icon), type: e.type, color: U.cleanColor(e.color) };
  await put('categories', rec);
  const fromEditor = ed && ed.step === 'category' && !e.id;
  closeSheet();
  if (fromEditor && rec.type === ed.type) ed.categoryId = rec.id;
  refreshSheet();
  render();
}

async function deleteCategory() {
  const e = catEd;
  const used = state.txs.filter((t) => t.categoryId === e.id);
  const moveTo = $('#cat-move')?.value;
  const msg = used.length ? (moveTo ? `Перенести ${used.length} операцій в «${cat(moveTo).name}» і видалити «${e.name}»?` : `Видалити «${e.name}» разом із ${used.length} операціями?`) : `Видалити категорію «${e.name}»?`;
  if (!confirm(msg)) return;
  if (used.length) {
    if (moveTo) {
      const moved = used.map((t) => ({ ...t, categoryId: moveTo }));
      await putMany('txs', moved);
      const byId = new Map(moved.map((t) => [t.id, t]));
      state.txs = state.txs.map((t) => byId.get(t.id) ?? t);
    } else await removeMany('txs', used.map((t) => t.id));
  }
  const b = state.budgets.filter((x) => x.categoryId === e.id);
  if (b.length) await removeMany('budgets', b.map((x) => x.id));
  await remove('categories', e.id);
  closeSheet();
  refreshSheet();
  render();
  toast('Категорію видалено');
}

function categoriesSheet() {
  openSheet({
    full: true,
    render: () => {
      const list = state.categories.filter((c) => c.type === ui.catTab);
      return `${sheetHead('Категорії', `<button class="icon-btn" data-a="editCategory" data-type="${ui.catTab}" aria-label="Додати">${ic('plus')}</button>`)}
      <div class="seg"><button class="${ui.catTab === 'expense' ? 'on' : ''}" data-a="catTab" data-v="expense">Витрати</button><button class="${ui.catTab === 'income' ? 'on' : ''}" data-a="catTab" data-v="income">Доходи</button></div>
      <div class="sheet-b"><div class="card">${list.map((c, i) => `<div class="row" style="--c:${c.color}">
        <span class="ico">${c.icon}</span><button class="mid" style="text-align:left" data-a="editCategory" data-id="${c.id}"><div class="t1">${esc(c.name)}</div></button>
        <button class="icon-btn" data-a="catMove" data-id="${c.id}" data-dir="-1" ${i === 0 ? 'disabled style="opacity:.25"' : ''} aria-label="Вгору">${ic('chevU')}</button>
        <button class="icon-btn" data-a="catMove" data-id="${c.id}" data-dir="1" ${i === list.length - 1 ? 'disabled style="opacity:.25"' : ''} aria-label="Вниз">${ic('chevD')}</button>
      </div>`).join('')}</div>
      <p class="hint" style="padding:0 20px">${ui.catTab === 'expense' ? 'Перші 14 категорій показуються навколо діаграми на головному екрані (решта — через «Ще»).' : ''} Стрілками змінюється порядок.</p></div>`;
    },
  });
}

async function moveCategory(id, dir) {
  const list = state.categories.filter((c) => c.type === ui.catTab);
  const i = list.findIndex((c) => c.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((c, k) => { c.order = k; });
  await putMany('categories', list);
  sortAll();
  refreshSheet();
  render();
}

// ---------- Бюджет: редагування ----------
let bEd = null;
function openBudgetEditor(id) {
  const b = id ? state.budgets.find((x) => x.id === id) : null;
  const usedCats = new Set(state.budgets.map((x) => x.categoryId ?? '__total'));
  const free = [{ id: '', name: 'Загальний бюджет', icon: '🎯' }, ...catsOf('expense')].filter((c) => !usedCats.has(c.id || '__total'));
  if (!b && !free.length) return toast('Бюджети вже задано для всіх категорій');
  bEd = b ? { id: b.id, categoryId: b.categoryId ?? '', amount: U.fromMinor(b.amount) } : { id: null, categoryId: free[0].id, amount: '' };
  openSheet({
    render: () => {
      const options = b ? [b.categoryId ? cat(b.categoryId) ?? NO_CAT : { id: '', name: 'Загальний бюджет', icon: '🎯' }] : free;
      return `${sheetHead(b ? 'Бюджет' : 'Новий бюджет')}<div class="sheet-b"><div class="form">
        <div class="field"><label>Категорія</label><select data-in="bCat" ${b ? 'disabled' : ''}>${options.map((c) => `<option value="${c.id ?? ''}" ${(c.id ?? '') === bEd.categoryId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Ліміт на місяць, ${base()}</label><input inputmode="decimal" data-in="bAmount" value="${bEd.amount === '' ? '' : String(bEd.amount).replace('.', ',')}" placeholder="0"></div>
        <button class="btn block" data-a="bSave">${ic('check')} Зберегти</button>
        ${b ? `<button class="btn block danger" data-a="bDelete">${ic('trash')} Видалити бюджет</button>` : ''}
      </div></div>`;
    },
    onClose: () => { bEd = null; },
  });
}

// ---------- Налаштування ----------
function settingsSheet() {
  openSheet({
    full: true,
    render: () => {
      const s = state.settings;
      const usedCur = [...new Set([...state.accounts.map((a) => a.currency), ...Object.keys(s.rates)])].filter((c) => c !== s.baseCurrency);
      return `${sheetHead('Налаштування')}<div class="sheet-b">
      <div class="section-t">Дані</div>
      <div class="card">
        <button class="row" data-a="openCategories"><span class="ico" style="--c:var(--accent-soft)">🗂️</span><span class="mid"><div class="t1">Категорії</div><div class="t2">${catsOf('expense').length} витрат · ${catsOf('income').length} доходів</div></span>${ic('chevR')}</button>
        <button class="row" data-a="openImport"><span class="ico" style="--c:var(--accent-soft)">📥</span><span class="mid"><div class="t1">Імпорт з Monefy</div><div class="t2">CSV-файл з Monefy → Налаштування → Експорт</div></span>${ic('chevR')}</button>
      </div>
      <div class="section-t">Валюти</div>
      <div class="card"><div class="form" style="padding:14px 16px">
        <div class="field"><label>Базова валюта (загальний баланс, бюджети)</label><select data-in="baseCur">${U.CURRENCIES.map((c) => `<option ${c === s.baseCurrency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        ${usedCur.length ? `<div class="field"><label>Курси: скільки ${s.baseCurrency} за 1 одиницю</label>
          <div class="two">${usedCur.map((c) => `<label class="rate-box"><b>${c}</b><input inputmode="decimal" data-in="rate" data-cur="${c}" value="${String(s.rates[c] ?? '').replace('.', ',')}"></label>`).join('')}</div>
          <p class="hint">${s.autoRates !== false ? `Оновлюються автоматично щодня за курсом НБУ${s.ratesDate ? ` (на ${U.fmtDate(s.ratesDate, { year: true })})` : ''}.` : 'Курс задано вручну — автооновлення вимкнено.'}</p></div>
          <button class="btn ghost block" data-a="nbuRates">${ic('refresh')} Оновити курси НБУ</button>` : ''}
      </div></div>
      <div class="section-t">Резервна копія</div>
      <div class="card">
        <button class="row" data-a="exportJson"><span class="ico" style="--c:var(--inc-soft)">💾</span><span class="mid"><div class="t1">Зберегти резервну копію</div><div class="t2">Усі дані в один JSON-файл</div></span>${ic('down')}</button>
        <label class="row tap"><span class="ico" style="--c:var(--inc-soft)">♻️</span><span class="mid"><div class="t1">Відновити з копії</div><div class="t2">Замінить поточні дані</div></span>${ic('up')}<input type="file" accept=".json,application/json" data-in="restoreJson" hidden></label>
        <button class="row" data-a="exportCsv"><span class="ico" style="--c:var(--inc-soft)">📊</span><span class="mid"><div class="t1">Експорт у CSV</div><div class="t2">Для Excel; формат як у Monefy</div></span>${ic('down')}</button>
      </div>
      <p class="hint" style="padding:0 20px">Дані зберігаються тільки на цьому телефоні. Робіть резервну копію раз на тиждень-місяць (наприклад, у Файли → iCloud).</p>
      <div class="section-t">Вигляд</div>
      <div class="seg">${[['auto', 'Авто'], ['light', 'Світла'], ['dark', 'Темна']].map(([k, l]) => `<button class="${s.theme === k ? 'on' : ''}" data-a="theme" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="section-t">Небезпечна зона</div>
      <div class="card"><button class="row" data-a="wipe"><span class="ico" style="--c:var(--exp-soft)">🗑️</span><span class="mid"><div class="t1 exp">Стерти всі дані</div><div class="t2">Повернути стандартні категорії й рахунки</div></span></button></div>
      <p class="hint" style="text-align:center;padding:16px">Гаманець ${APP_VERSION} · ${state.txs.length} операцій</p>
      </div>`;
    },
  });
}

async function changeBase(newBase) {
  const s = state.settings, old = s.baseCurrency;
  if (newBase === old) return;
  const k = s.rates[newBase];
  if (!k) { toast(`Спочатку задайте курс ${newBase}`); refreshSheet(); return; }
  const nr = {};
  for (const [c, r] of Object.entries(s.rates)) if (c !== newBase) nr[c] = Math.round((r / k) * 10000) / 10000;
  nr[old] = Math.round((1 / k) * 10000) / 10000;
  const budgets = state.budgets.map((b) => ({ ...b, amount: convert(b.amount, old, newBase, newBase, nr) }));
  await commit({ meta: [{ ...s, rates: nr, baseCurrency: newBase }], budgets });
  s.rates = nr; s.baseCurrency = newBase;
  state.budgets = budgets;
  refreshSheet();
  render();
}

async function fetchNbu({ silent = false } = {}) {
  try {
    if (!silent) toast('Завантажую курси…');
    const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
    const data = await res.json();
    const uah = Object.fromEntries(data.map((x) => [x.cc, x.rate]));
    uah.UAH = 1;
    const s = state.settings, b = uah[s.baseCurrency];
    const curs = new Set([...Object.keys(s.rates), ...state.accounts.map((a) => a.currency)]);
    for (const c of curs) if (c !== s.baseCurrency && uah[c] && b) s.rates[c] = Math.round((uah[c] / b) * 10000) / 10000;
    const d = data[0]?.exchangedate?.split('.');
    s.ratesDate = d ? `${d[2]}-${d[1]}-${d[0]}` : U.today();
    s.ratesFetched = U.today();
    if (!silent) s.autoRates = true;
    await saveSettings();
    refreshSheet(); render();
    if (!silent) toast('Курси оновлено');
  } catch {
    if (!silent) toast('Не вдалося завантажити курси. Перевірте інтернет.');
  }
}

// ---------- Імпорт Monefy ----------
let imp = null;
function importSheet() {
  imp = { stage: 'pick' };
  openSheet({ full: true, render: renderImport, onClose: () => { imp = null; } });
}

function renderImport() {
  if (imp.stage === 'pick') {
    return `${sheetHead('Імпорт з Monefy')}<div class="sheet-b"><div class="form">
      <div class="card card-pad" style="margin:0">
        <b>Як вивантажити з Monefy</b>
        <ol style="margin:8px 0 0;padding-left:20px;line-height:1.6">
          <li>Monefy → меню (☰) → <b>Налаштування</b></li>
          <li><b>Експорт у файл</b> (CSV) → «Зберегти у Файли»</li>
          <li>Тут натисніть кнопку нижче й оберіть цей файл</li>
        </ol>
      </div>
      <label class="btn block">${ic('up')} Обрати CSV-файл<input type="file" accept=".csv,text/csv,text/plain,text/comma-separated-values" data-in="importFile" hidden></label>
      <p class="hint">Операції з тією ж датою, сумою й категорією, що вже були імпортовані раніше, пропускаються — файл можна імпортувати повторно.</p>
    </div></div>`;
  }
  const { res, errors, records, wipe } = imp;
  const st = res.stats;
  return `${sheetHead('Перевірка імпорту')}<div class="sheet-b"><div class="form">
    <div class="card card-pad" style="margin:0">Файл: <b>${esc(imp.fileName)}</b><br><span class="muted">${records.length} рядків · ${st.from ? `${U.fmtDate(st.from, { year: true })} – ${U.fmtDate(st.to, { year: true })}` : ''}</span></div>
    <div class="imp-stats">
      <div><b class="exp">${st.expense}</b><small>витрат</small></div>
      <div><b class="inc">${st.income}</b><small>доходів</small></div>
      <div><b>${st.transfer}</b><small>переказів</small></div>
      <div><b>${st.duplicates}</b><small>вже є (пропущено)</small></div>
      <div><b>${res.accounts.length}</b><small>нових рахунків</small></div>
      <div><b>${res.categories.length}</b><small>нових категорій</small></div>
    </div>
    ${res.accounts.length ? `<div class="hint">Рахунки: ${res.accounts.map((a) => `${a.icon} ${esc(a.name)} (${a.currency})`).join(', ')}</div>` : ''}
    ${res.categories.length ? `<div class="hint">Категорії: ${res.categories.map((c) => `${c.icon} ${esc(c.name)}`).join(', ')}</div>` : ''}
    ${st.initial ? `<div class="hint">Початкових балансів: ${st.initial}</div>` : ''}
    ${errors.length ? `<div class="errs">Пропущено рядків з помилками: ${errors.length}<br>${errors.slice(0, 8).map(esc).join('<br>')}</div>` : ''}
    ${imp.dateAmbiguous || imp.dateOrder === 'mdy' ? `<div class="field"><label>Формат дат у файлі (не вдалося визначити напевно)</label>
      <select data-in="impDateOrder"><option value="dmy" ${imp.dateOrder === 'dmy' ? 'selected' : ''}>День/Місяць/Рік (31/12/2026)</option>
      <option value="mdy" ${imp.dateOrder === 'mdy' ? 'selected' : ''}>Місяць/День/Рік (12/31/2026)</option></select></div>` : ''}
    <label class="check"><input type="checkbox" data-in="impWipe" ${wipe ? 'checked' : ''}> Спочатку видалити поточні рахунки, категорії й операції</label>
    <p class="hint" style="margin-top:-8px">Рекомендовано при першому перенесенні — тоді будуть лише ваші категорії й рахунки з Monefy.</p>
    <button class="btn block" data-a="impGo" ${st.expense + st.income + st.transfer + st.initial === 0 && !wipe ? 'disabled' : ''}>${ic('check')} Імпортувати</button>
  </div></div>`;
}

function prepareImport() {
  const existing = imp.wipe ? { accounts: [], categories: [], txs: [], importKeys: [] }
    : { accounts: state.accounts, categories: state.categories, txs: state.txs, importKeys: state.importKeys };
  imp.res = buildImport(imp.records, existing, { baseCurrency: base(), rates: rates() });
}

async function runImport() {
  const { res, wipe } = imp;
  if (wipe && !confirm('Видалити всі поточні дані й замінити їх даними з Monefy?')) return;
  // Рахунки з урахуванням початкових балансів (копії, щоб state не змінився до запису)
  const accs = new Map(res.accounts.map((a) => [a.id, { ...a }]));
  for (const [id, delta] of res.accountInitial) {
    const a = accs.get(id) ?? { ...acc(id) };
    a.initialBalance = (a.initialBalance || 0) + delta;
    accs.set(id, a);
  }
  const settings = { ...state.settings, rates: { ...state.settings.rates } };
  for (const a of accs.values()) if (a.currency !== settings.baseCurrency && !settings.rates[a.currency]) settings.rates[a.currency] = DEFAULT_RATES[a.currency] ?? 1;
  if (wipe) {
    const first = [...accs.values()][0];
    await replaceAll({
      accounts: [...accs.values()], categories: res.categories, txs: res.txs, budgets: [],
      settings: { ...settings, lastAccountId: first?.id }, importKeys: res.extraKeys,
    });
  } else {
    const importKeys = [...state.importKeys, ...res.extraKeys];
    await commit({ accounts: [...accs.values()], categories: res.categories, txs: res.txs, meta: [settings, { id: 'importKeys', keys: importKeys }] });
    for (const a of accs.values()) { const i = state.accounts.findIndex((x) => x.id === a.id); if (i >= 0) state.accounts[i] = a; else state.accounts.push(a); }
    state.categories.push(...res.categories);
    state.txs.push(...res.txs);
    state.importKeys = importKeys;
    state.settings = settings;
    sortAll();
  }
  ui.accountId = null;
  const n = res.txs.length;
  closeSheet(); closeSheet();
  if (state.txs.length) { ui.period = { kind: 'month', anchor: state.txs[0].date, custom: null }; }
  render();
  toast(`Імпортовано ${n} операцій`);
  persistStorage();
}

// ---------- Резервні копії ----------
async function shareOrDownload(name, text, mime) {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

async function exportJson() {
  if (!await shareOrDownload(`hamanets-backup-${U.today()}.json`, JSON.stringify(snapshot(), null, 1), 'application/json')) return;
  state.settings.lastBackup = U.today();
  await saveSettings();
  render();
}

function exportCsv() {
  const q = (v) => /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const lines = ['date,account,category,amount,currency,description'];
  const d = (iso) => iso.split('-').reverse().join('/');
  for (const t of [...state.txs].reverse()) {
    const a = acc(t.accountId);
    if (t.type === 'transfer') {
      const to = acc(t.toAccountId);
      lines.push([d(t.date), a?.name, `To '${to?.name}'`, -U.fromMinor(t.amount), a?.currency, t.note ?? ''].map(q).join(','));
      lines.push([d(t.date), to?.name, `From '${a?.name}'`, U.fromMinor(t.toAmount ?? t.amount), to?.currency, t.note ?? ''].map(q).join(','));
    } else {
      lines.push([d(t.date), a?.name, (cat(t.categoryId) ?? NO_CAT).name, (t.type === 'expense' ? -1 : 1) * U.fromMinor(t.amount), a?.currency, t.note ?? ''].map(q).join(','));
    }
  }
  shareOrDownload(`hamanets-${U.today()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}

async function restoreJson(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.txs) || !Array.isArray(data.accounts)) throw new Error('bad');
    if (!confirm(`Відновити копію від ${data.exportedAt?.slice(0, 10) ?? '?'}: ${data.txs.length} операцій, ${data.accounts.length} рахунків? Поточні дані буде замінено.`)) return;
    await replaceAll(data);
    const dropped = data.txs.length - state.txs.length;
    if (dropped > 0) console.warn(`Пропущено пошкоджених операцій: ${dropped}`);
    ui.accountId = null;
    closeSheet();
    render();
    toast('Дані відновлено');
  } catch {
    toast('Це не схоже на резервну копію Гаманця');
  }
}

let persistAsked = false;
function persistStorage() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => { });
}

// ---------- Обробники подій ----------
const actions = {
  tab: (d) => { ui.tab = d.id; if (d.id !== 'ops') ui.opsCat = null; render(); scrollTo(0, 0); },
  settings: () => settingsSheet(),
  closeSheet: () => closeSheet(),
  toastAction: () => { const el = $('#toast'); el.classList.remove('show'); const f = el._action; el._action = null; return f?.(); },

  pickAccount: () => pickAccountSheet({
    title: 'Показати рахунок', allowAll: true, selected: ui.accountId,
    onPick: (id) => { ui.accountId = id || null; closeSheet(); render(); },
  }),
  pickAcc: (d) => pickAccCb?.(d.id),
  pickPeriod: () => pickPeriodSheet(),
  setPeriod: (d) => { ui.period.kind = d.kind; ui.period.custom = null; saveUi(); closeSheet(); render(); },
  goToday: () => { ui.period.anchor = U.today(); if (ui.period.kind === 'custom') ui.period.kind = 'month'; closeSheet(); render(); },
  setCustom: () => {
    let s = $('#pc-start').value, e = $('#pc-end').value;
    if (!s || !e) return toast('Оберіть обидві дати');
    if (s > e) [s, e] = [e, s];
    ui.period = { kind: 'custom', anchor: s, custom: { start: s, end: e } };
    closeSheet(); render();
  },
  periodShift: (d) => { ui.period.anchor = U.shiftAnchor(ui.period.kind, ui.period.anchor, +d.dir); render(); },
  goOps: (d) => { ui.tab = 'ops'; ui.opsCat = d.cat || null; ui.opsSearch = ''; render(); scrollTo(0, 0); },
  clearOpsCat: () => { ui.opsCat = null; render(); },

  addTx: (d) => openEditor({ type: d.type, categoryId: d.cat || null }),
  editTx: (d) => {
    const t = state.txs.find((x) => x.id === d.id);
    if (t?.type === 'transfer') openTransfer(t); else if (t) openEditor({ tx: t });
  },
  key: (d) => edKey(d.k),
  edType: (d) => { if (ed.type === d.type) return; ed.type = d.type; if (cat(ed.categoryId)?.type !== d.type) ed.categoryId = null; refreshSheet(); },
  edPickCat: () => { ed.step = 'category'; ed.pending = false; refreshSheet(); },
  edCat: (d) => {
    ed.categoryId = d.id; ed.step = 'amount';
    if (ed.pending && edValue() > 0) return saveEditor();
    refreshSheet();
  },
  edPickAcc: () => pickAccountSheet({ selected: ed.accountId, onPick: (id) => { ed.accountId = id; closeSheet(); refreshSheet(); } }),
  edOk: () => saveEditor(),
  edDelete: () => { const id = ed.id; closeSheet(); return deleteTx(id); },

  transfer: () => openTransfer(),
  trSave: () => saveTransfer(),
  trDelete: () => { const id = tr.id; closeSheet(); return deleteTx(id); },

  editAccount: (d) => openAccountEditor(d.id),
  accIcon: (d) => { accEd.icon = d.v; refreshSheet(); },
  accColor: (d) => { accEd.color = d.v; refreshSheet(); },
  accSave: () => saveAccount(),
  accShow: () => { ui.accountId = accEd.id; ui.tab = 'ops'; closeSheet(); render(); },
  accDelete: async () => {
    const id = accEd.id;
    const linked = state.txs.filter((t) => t.accountId === id || t.toAccountId === id);
    if (accounts().length <= 1) return toast('Має лишитися хоча б один рахунок');
    const nTr = linked.filter((t) => t.type === 'transfer').length;
    if (!confirm(`Видалити рахунок «${accEd.name}»${linked.length ? ` і ${linked.length} його операцій` : ''}?${nTr ? `\n\nСеред них ${nTr} переказів — баланс інших рахунків теж зміниться.` : ''}`)) return;
    await removeMany('txs', linked.map((t) => t.id));
    await remove('accounts', id);
    if (ui.accountId === id) ui.accountId = null;
    closeSheet(); render(); toast('Рахунок видалено');
  },

  openCategories: () => categoriesSheet(),
  catTab: (d) => { ui.catTab = d.v; refreshSheet(); },
  catMove: (d) => moveCategory(d.id, +d.dir),
  editCategory: (d) => openCategoryEditor({ id: d.id, type: d.type }),
  catType: (d) => { catEd.type = d.v; refreshSheet(); },
  catIconPick: (d) => { catEd.icon = d.v; refreshSheet(); },
  catColor: (d) => { catEd.color = d.v; refreshSheet(); },
  catSave: () => saveCategory(),
  catDelete: () => deleteCategory(),

  editBudget: (d) => openBudgetEditor(d.id),
  budgetShift: (d) => { ui.budgetAnchor = U.shiftAnchor('month', ui.budgetAnchor, +d.dir); render(); },
  bSave: async () => {
    const v = U.calcExpr(String(bEd.amount));
    if (!(v > 0)) return toast('Введіть ліміт');
    await put('budgets', { id: bEd.id ?? U.uid(), categoryId: bEd.categoryId || null, amount: U.toMinor(v) });
    closeSheet(); render();
  },
  bDelete: async () => { await remove('budgets', bEd.id); closeSheet(); render(); },

  openImport: () => importSheet(),
  impGo: () => runImport(),
  nbuRates: () => fetchNbu(),
  exportJson: () => exportJson(),
  exportCsv: () => exportCsv(),
  theme: (d) => { state.settings.theme = d.v; saveSettings(); applyTheme(); refreshSheet(); },
  wipe: async () => {
    if (!confirm('Стерти ВСІ операції, рахунки, категорії й бюджети? Це не можна скасувати.')) return;
    if (!confirm('Точно? Радимо спершу зберегти резервну копію.')) return;
    await resetToDefaults();
    ui.accountId = null;
    closeSheet(); render(); toast('Дані стерто');
  },
};

const inputs = {
  opsSearch: (el) => { ui.opsSearch = el.value; $('#ops-list').innerHTML = opsList(); },
  edNote: (el) => { ed.note = el.value; },
  edDate: (el) => { if (el.value) { ed.date = el.value; refreshSheet(); } },
  trFrom: (el) => { tr.from = el.value; tr.toTouched = false; if (tr.from === tr.to) tr.to = accounts().find((a) => a.id !== tr.from)?.id; refreshSheet(); trAutoTo(); },
  trTo: (el) => { tr.to = el.value; tr.toTouched = false; refreshSheet(); trAutoTo(); },
  trAmount: (el) => { tr.amount = el.value; trAutoTo(); },
  trToAmount: (el) => { tr.toAmount = el.value; tr.toTouched = true; },
  trDate: (el) => { tr.date = el.value; },
  trNote: (el) => { tr.note = el.value; },
  accName: (el) => { accEd.name = el.value; },
  accCur: (el) => { accEd.currency = el.value; },
  accInit: (el) => { accEd.initial = el.value; },
  accExcl: (el) => { accEd.excludeFromTotal = el.checked; },
  catName: (el) => { catEd.name = el.value; },
  catIcon: (el) => { catEd.icon = el.value.trim(); const i = el.closest('.sheet').querySelector('.cat-tile .ico'); if (i) i.textContent = catEd.icon; },
  bCat: (el) => { bEd.categoryId = el.value; },
  bAmount: (el) => { bEd.amount = el.value; },
  baseCur: (el) => { changeBase(el.value).catch((e) => toast('Помилка: ' + e.message)); },
  rate: (el) => {
    const v = U.calcExpr(el.value);
    if (v > 0) { state.settings.rates[el.dataset.cur] = v; state.settings.autoRates = false; saveSettings(); render(); refreshSheet(); }
  },
  impWipe: (el) => { imp.wipe = el.checked; prepareImport(); refreshSheet(); },
  impDateOrder: (el) => {
    const r = parseMonefy(imp.text, { dateOrder: el.value });
    Object.assign(imp, { records: r.records, errors: r.errors, dateOrder: el.value });
    prepareImport(); refreshSheet();
  },
  importFile: async (el) => {
    const f = el.files[0];
    if (!f) return;
    const text = await readText(f);
    const { records, errors, dateOrder, dateAmbiguous } = parseMonefy(text);
    if (!records.length) { toast(errors[0] ?? 'Не вдалося прочитати файл'); return; }
    imp = { stage: 'preview', fileName: f.name, text, records, errors, dateOrder, dateAmbiguous, wipe: state.txs.length === 0 };
    prepareImport();
    refreshSheet();
  },
  restoreJson: (el) => { if (el.files[0]) restoreJson(el.files[0]); },
};

// Monefy може зберегти CSV у UTF-16 або Windows-1251 — пробуємо кілька кодувань.
async function readText(file) {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1251').decode(buf); }
}

// Поки виконується async-дія (збереження, імпорт…), інші тапи ігноруємо — інакше подвійний тап дублює дані.
let busy = false;
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled || busy) return;
  const fn = actions[el.dataset.a];
  if (!fn) return;
  const r = fn(el.dataset, el, e);
  if (r instanceof Promise) {
    busy = true;
    try { await r; } catch (err) { console.error(err); toast('Помилка: ' + (err?.message ?? err)); } finally { busy = false; }
  }
});

const onInput = (e) => {
  const el = e.target.closest('[data-in]');
  if (!el) return;
  const type = el.type;
  // select/checkbox/file/date — на change; текст — на input
  const wantsChange = el.tagName === 'SELECT' || ['checkbox', 'file', 'date'].includes(type) || el.dataset.in === 'rate';
  if ((e.type === 'change') !== wantsChange) return;
  inputs[el.dataset.in]?.(el, e);
};
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);

// Клавіатура (зручно на комп'ютері)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheets.length) { closeSheet(); return; }
  if (!ed || ed.step !== 'amount' || sheets[sheets.length - 1]?.render !== renderEditor) return;
  if (e.target.matches('input, textarea, select')) { if (e.key === 'Enter') e.target.blur(); return; }
  const map = { '*': '×', '/': '÷', '-': '−', '+': '+', '.': ',', ',': ',', Backspace: 'back' };
  if (/^\d$/.test(e.key)) edKey(e.key);
  else if (map[e.key]) edKey(map[e.key]);
  else if (e.key === 'Enter') saveEditor();
  else return;
  e.preventDefault();
});

// Свайп по діаграмі — попередній/наступний період
let touchX = null, touchY = null;
document.addEventListener('touchstart', (e) => {
  if (!e.target.closest('#ring')) { touchX = null; return; }
  touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (touchX === null || ui.period.kind === 'all' || ui.period.kind === 'custom') return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    ui.period.anchor = U.shiftAnchor(ui.period.kind, ui.period.anchor, dx < 0 ? 1 : -1);
    render();
  }
}, { passive: true });

// Якщо застосунок повернувся з фону вже наступного дня — «сьогодні» має зсунутися.
let lastToday = U.today();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const t = U.today();
  if (t === lastToday) return;
  if (ui.period.anchor === lastToday) ui.period.anchor = t;
  if (ui.budgetAnchor === lastToday) ui.budgetAnchor = t;
  lastToday = t;
  if (!sheets.length) render();
});

// ---------- Старт ----------
(async () => {
  try {
    await load();
  } catch (err) {
    $('#app').innerHTML = `<div class="empty"><div class="e-ico">⚠️</div>Не вдалося відкрити сховище даних.<br><small>${esc(err?.message ?? err)}</small></div>`;
    return;
  }
  render();
  // Раз на день тихо оновлюємо курси НБУ, якщо є рахунки в іншій валюті
  const st = state.settings;
  if (st.autoRates !== false && st.ratesFetched !== U.today() && state.accounts.some((a) => a.currency !== st.baseCurrency) && navigator.onLine) {
    fetchNbu({ silent: true });
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
})();

// Для налагодження в консолі
window.__hamanets = { state, ui, render };
