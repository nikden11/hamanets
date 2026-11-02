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
