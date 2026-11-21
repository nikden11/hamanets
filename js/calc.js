// Чисті розрахунки: курси, баланси, зведення за період, бюджети.
// Нічого не знає про DOM чи IndexedDB, тому легко тестується в Node.

// rates: { USD: 41.5, EUR: 48.2 } — скільки одиниць базової валюти за 1 одиницю валюти.
export function convert(minor, from, to, base, rates) {
  if (from === to || !minor) return minor;
  const r = (c) => (c === base ? 1 : rates[c]);
  const rf = r(from), rt = r(to);
  if (!rf || !rt) return minor; // курс невідомий — не перераховуємо, щоб не обнулити
  return Math.round((minor * rf) / rt);
}

export function inRange(date, start, end) {
  return (!start || date >= start) && (!end || date <= end);
}

// Баланс кожного рахунку на дату `until` (включно), у валюті рахунку.
export function accountBalances(accounts, txs, until = null) {
  const bal = new Map(accounts.map((a) => [a.id, a.initialBalance || 0]));
  for (const t of txs) {
    if (until && t.date > until) continue;
    if (t.type === 'expense') add(bal, t.accountId, -t.amount);
    else if (t.type === 'income') add(bal, t.accountId, t.amount);
    else if (t.type === 'transfer') {
      add(bal, t.accountId, -t.amount);
      add(bal, t.toAccountId, t.toAmount ?? t.amount);
    }
  }
  return bal;
}

const add = (m, k, v) => { if (m.has(k)) m.set(k, m.get(k) + v); };

// Зведення для головного екрана.
// accountId = null -> усі рахунки, суми в базовій валюті; інакше — у валюті рахунку.
export function summarize({ txs, accounts, accountId, start, end, base, rates }) {
  const accCur = new Map(accounts.map((a) => [a.id, a.currency]));
  const target = accountId ? accCur.get(accountId) : base;
  const conv = (t, minor, accId = t.accountId) => convert(minor, accCur.get(accId) ?? base, target, base, rates);

  let income = 0, expense = 0, transferIn = 0, transferOut = 0;
  const byCat = new Map(); // categoryId -> {amount, count}
  const list = [];

  for (const t of txs) {
    if (!inRange(t.date, start, end)) continue;
    if (t.type === 'transfer') {
      if (!accountId) { list.push(t); continue; } // між власними рахунками — не дохід і не витрата
      if (t.accountId === accountId) { transferOut += t.amount; list.push(t); }
      else if (t.toAccountId === accountId) { transferIn += t.toAmount ?? t.amount; list.push(t); }
      continue;
    }
    if (accountId && t.accountId !== accountId) continue;
    const v = conv(t, t.amount);
    if (t.type === 'expense') expense += v; else income += v;
    const c = byCat.get(t.categoryId) ?? { amount: 0, count: 0, type: t.type };
    c.amount += v; c.count++;
    byCat.set(t.categoryId, c);
    list.push(t);
  }

  const balances = accountBalances(accounts, txs, end);
  let balance = 0;
  if (accountId) balance = balances.get(accountId) ?? 0;
  else for (const a of accounts) if (!a.excludeFromTotal) balance += convert(balances.get(a.id), a.currency, base, base, rates);

  return { currency: target, income, expense, transferIn, transferOut, net: income - expense, byCat, list, balance };
}

// Бюджети: витрати поточного місяця по категоріях (у базовій валюті) проти ліміту.
export function budgetProgress({ budgets, txs, accounts, start, end, base, rates }) {
  const accCur = new Map(accounts.map((a) => [a.id, a.currency]));
  const spentByCat = new Map();
  let total = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t.date, start, end)) continue;
    const v = convert(t.amount, accCur.get(t.accountId) ?? base, base, base, rates);
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + v);
    total += v;
  }
  return budgets.map((b) => {
    const spent = b.categoryId ? spentByCat.get(b.categoryId) ?? 0 : total;
    return { ...b, spent, left: b.amount - spent, ratio: b.amount ? spent / b.amount : 0 };
  });
}

// Помісячні підсумки для графіка (останні n місяців до anchor включно).
export function monthlyTotals({ txs, accounts, base, rates, anchor, n = 6 }) {
  const accCur = new Map(accounts.map((a) => [a.id, a.currency]));
  const [y, m] = anchor.split('-').map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const res = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]));
  for (const t of txs) {
    if (t.type === 'transfer') continue;
    const r = res.get(t.date.slice(0, 7));
    if (!r) continue;
    const v = convert(t.amount, accCur.get(t.accountId) ?? base, base, base, rates);
    r[t.type] += v;
  }
  return keys.map((k) => ({ month: k, ...res.get(k) }));
}

// Порядок категорій у сітці вибору — за КІЛЬКІСТЮ операцій (не сумою) у поточному місяці.
// Поки в місяці менше 5 операцій цього типу, додаємо останні 12 місяців (поточний місяць з вагою ×3),
// щоб 1-го числа порядок не «стрибав». Рівні — у порядку з налаштувань.
export function categoryOrder(cats, txs, { type, today }) {
  const month = today.slice(0, 7);
  const from = `${+month.slice(0, 4) - 1}${month.slice(4)}`; // той самий місяць рік тому
  const cur = new Map(), past = new Map();
  let curN = 0;
  for (const t of txs) {
    if (t.type !== type || !t.categoryId) continue;
    const m = t.date.slice(0, 7);
    if (m === month) { cur.set(t.categoryId, (cur.get(t.categoryId) ?? 0) + 1); curN++; }
    else if (m >= from && m < month) past.set(t.categoryId, (past.get(t.categoryId) ?? 0) + 1);
  }
  const score = (id) => (curN >= 5 ? cur.get(id) ?? 0 : (cur.get(id) ?? 0) * 3 + (past.get(id) ?? 0));
  return cats.map((c, i) => ({ c, i, s: score(c.id) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c);
}

// Розміщення кіл навколо кільця (дизайн 390×392, центр 195×196). values — суми сегментів за годинниковою
// стрілкою від 12-ї години. Кола стоять на контурі «заокруглений прямокутник» (суперeліпс n=4, A×B)
// навпроти середини свого сегмента; сусіди розсуваються вздовж контуру, щоб центри були не ближче за gap px.
// Порядок сегментів на кільці: великий–малий навперемінно (1-й, останній, 2-й, передостанній…), щоб дрібні
// сегменти стояли між великими, а не «віялом» в одному місці (аудит №2, N1). Вхід — масив за спаданням.
export function ringOrder(items) {
  const out = [];
  for (let i = 0, j = items.length - 1; i <= j;) { out.push(items[i++]); if (i <= j) out.push(items[j--]); }
  return out;
}

export function ringLayout(values, { cx = 195, cy = 196, ro = 84, a = 158, b = 146, n = 4, gap = 76, end = 22 } = {}) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!values.length || total <= 0) return [];
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (r, d) => [cx + r * Math.sin(rad(d)), cy - r * Math.cos(rad(d))];
  const rr = (d) => 1 / Math.pow(Math.pow(Math.abs(Math.sin(rad(d))) / a, n) + Math.pow(Math.abs(Math.cos(rad(d))) / b, n), 1 / n);
  const S = [0];
  let prev = pt(rr(0), 0);
  for (let k = 1; k <= 720; k++) { const q = pt(rr(k / 2), k / 2); S.push(S[k - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1])); prev = q; }
  const P = S[720];
  const toLen = (d) => { const f = (((d % 360) + 360) % 360) * 2, k = Math.floor(f); return S[k] + (S[Math.min(k + 1, 720)] - S[k]) * (f - k); };
  const toDeg = (len) => { let lo = 0, hi = 720; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= len) lo = m; else hi = m; } return (lo + (len - S[lo]) / ((S[hi] - S[lo]) || 1)) / 2; };
  const mids = [];
  let acc = 0;
  for (const v of values) { mids.push(((acc + v / 2) / total) * 360); acc += v; }
  // розсування вздовж контуру
  const cnt = mids.length, g = Math.min(gap, P / cnt);
  const idx = mids.map((_, i) => i).sort((i, j) => mids[i] - mids[j]);
  const p = idx.map((i) => toLen(mids[i]));
  for (let it = 0; it < 400 && cnt > 1; it++) {
    let moved = false;
    for (let k = 0; k < cnt; k++) {
      const last = k === cnt - 1, d = (last ? p[0] + P : p[k + 1]) - p[k];
      if (d < g - 0.01) { const s = (g - d) / 2; p[k] -= s; if (last) p[0] += s; else p[k + 1] += s; moved = true; }
    }
    if (!moved) break;
  }
  const pos = [];
  idx.forEach((i, k) => { pos[i] = toDeg(((p[k] % P) + P) % P); });
  return mids.map((m, i) => {
    const [x, y] = pt(rr(pos[i]), pos[i]);
    // лінія — плавна крива (без зламу): виходить з кільця по радіусу і м'яко повертає до іконки
    const p1 = pt(ro + 2, m);
    const c = pt(ro + 2 + 0.3 * Math.hypot(x - p1[0], y - p1[1]), m);
    const dx = x - c[0], dy = y - c[1], dl = Math.hypot(dx, dy) || 1;
    const p3 = [x - (dx / dl) * end, y - (dy / dl) * end];
    return { x, y, up: y < cy - 70, line: [p1, c, p3] };
  });
}
