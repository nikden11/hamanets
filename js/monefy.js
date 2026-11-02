// Імпорт CSV-експорту Monefy (Налаштування → Експорт у файл).
// Типовий заголовок: date,account,category,amount,currency,converted amount,currency,description
// Витрати мають від'ємну суму, доходи — додатну. Перекази виглядають як дві операції
// з категоріями на кшталт "To 'Картка'" та "From 'Готівка'".
// Роздільник (кома / крапка з комою / таб) і десятковий знак визначаємо автоматично.

import { uid, toMinor, PALETTE, cleanCur } from './util.js';
import { convert } from './calc.js';

export function detectDelimiter(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, splitLine(first, d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

function splitLine(line, d) {
  return parseCSV(line, d)[0] ?? [];
}

// RFC4180-сумісний парсер (лапки, екрановані лапки, переноси рядків у полях).
export function parseCSV(text, d = ',') {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"' && field === '') q = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

// "1 234,56" / "1,234.56" / "-1234.5" / "−50" -> число
export function parseAmount(s) {
  let v = String(s).trim().replace(/[\s  ']/g, '').replace(/−/g, '-');
  if (!v) return NaN;
  const lastComma = v.lastIndexOf(','), lastDot = v.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Останній із роздільників — десятковий
    if (lastComma > lastDot) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (lastDot > -1 && /^-?\d{1,3}(\.\d{3})+$/.test(v)) {
    v = v.replace(/\./g, ''); // "1.234" — розділювач тисяч (у грошах 3 знаки після крапки не бувають)
  } else if (lastComma > -1) {
    // Одна кома і 1–2 цифри після неї — десяткова; інакше тисячі
    const parts = v.split(',');
    v = parts.length === 2 && parts[1].length <= 2 ? parts.join('.') : parts.join('');
  }
  return Number(v);
}

// Підтримує DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD, а також M/D/YYYY (якщо день > 12).
export function parseDate(s, order = 'dmy') {
  const t = String(s).trim().split(/[ T]/)[0];
  let m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
  if (!m) return null;
  let a = +m[1], b = +m[2], y = +m[3];
  if (y < 100) y += 2000;
  let day = a, mon = b;
  if (order === 'mdy') { day = b; mon = a; }
  if (mon > 12 && day <= 12) [day, mon] = [mon, day];
  return iso(y, mon, day);
}

function iso(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Якщо в файлі є дати на кшталт 03/25/2024 — значить порядок місяць/день.
function guessDateOrder(values) {
  let dmy = 0, mdy = 0;
  for (const v of values) {
    const m = String(v).trim().match(/^(\d{1,2})[-./](\d{1,2})[-./]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return { order: mdy > dmy ? 'mdy' : 'dmy', ambiguous: dmy === 0 && mdy === 0 };
}

const H = {
  date: ['date', 'дата'],
  account: ['account', 'рахунок', 'счет', 'счёт'],
  category: ['category', 'категорія', 'категория'],
  amount: ['amount', 'сума', 'сумма'],
  currency: ['currency', 'валюта'],
  description: ['description', 'опис', 'описание', 'note', 'нотатка', 'примітка', 'комментарий'],
};

// Текст -> масив записів {date, account, category, amount(число зі знаком), currency, description}
// opts.dateOrder — 'dmy' | 'mdy', якщо користувач обрав вручну.
export function parseMonefy(text, opts = {}) {
  text = text.replace(/^﻿/, '');
  const d = detectDelimiter(text);
  const rows = parseCSV(text, d);
  if (rows.length < 2) return { records: [], errors: ['Файл порожній або не схожий на CSV'] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [k, names] of Object.entries(H)) col[k] = header.findIndex((h) => names.includes(h));
  if (col.date < 0 || col.amount < 0 || col.category < 0) {
    return { records: [], errors: [`Не знайдено колонки date/category/amount. Заголовок: ${rows[0].join(' | ').slice(0, 200)}`] };
  }

  const guess = guessDateOrder(rows.slice(1).map((r) => r[col.date]));
  const order = opts.dateOrder ?? guess.order;
  const records = [], errors = [];
  rows.slice(1).forEach((r, i) => {
    const date = parseDate(r[col.date], order);
    const amount = parseAmount(r[col.amount]);
    if (!date || !Number.isFinite(amount)) {
      errors.push(`Рядок ${i + 2}: не вдалося прочитати дату або суму (${r.join(d)})`);
      return;
    }
    records.push({
      date,
      account: (col.account >= 0 ? r[col.account] : '').trim() || 'Готівка',
      category: (r[col.category] ?? '').trim() || 'Без категорії',
      amount,
      currency: col.currency >= 0 ? cleanCur(r[col.currency], null) : null,
      description: (col.description >= 0 ? r[col.description] : '').trim(),
    });
  });
  return { records, errors, dateOrder: order, dateAmbiguous: guess.ambiguous && records.some((r) => +r.date.slice(8) !== +r.date.slice(5, 7)) };
}

// Розпізнає категорії-перекази: "To 'Card'", "From “Cash”", "До 'Картка'", "З «Готівка»" тощо.
const TRANSFER_RE = /^(to|from|до|з|із|зі|від|на|в|у|с|со|из|от)\s*[:\-]?\s*['‘’"“”«„](.+?)['‘’"“”»]$/i;
const OUT_WORDS = new Set(['to', 'до', 'на', 'в', 'у']);

export function parseTransferCategory(cat) {
  const m = cat.match(TRANSFER_RE);
  if (!m) return null;
  return { dir: OUT_WORDS.has(m[1].toLowerCase()) ? 'out' : 'in', other: m[2].trim() };
}

const INITIAL_RE = /^(initial balance|початковий баланс|начальный баланс|початковий залишок)$/i;

const ICON_GUESS = [
  [/продукт|food|grocer|супермаркет|їжа|еда/i, '🛒'],
  [/кафе|ресторан|eating|cafe|restaurant|кава|coffee/i, '🍽️'],
  [/такс|taxi|uber|bolt/i, '🚕'],
  [/транспорт|transport|метро|bus/i, '🚌'],
  [/авто|car|машин|бенз|fuel|пальне/i, '🚗'],
  [/дім|дом|house|home|квартир|оренд|rent/i, '🏠'],
  [/комун|bills|рахунк|счет|utilit/i, '🧾'],
  [/зв.?язок|связь|communic|телефон|phone|інтернет|internet/i, '📱'],
  [/одяг|одежд|cloth|взутт/i, '👕'],
  [/здоров|health|аптек|лік|медиц|doctor/i, '💊'],
  [/розваг|развлеч|entertain|кіно|cinema/i, '🎬'],
  [/спорт|sport|gym|фітнес/i, '🏋️'],
  [/подар|gift/i, '🎁'],
  [/тварин|живот|pet|кіт|пес/i, '🐾'],
  [/гігієн|гигиен|toilet|косметик/i, '🧴'],
  [/освіт|educat|курс|книг|book/i, '📚'],
  [/дит|дет|child|kid/i, '🧸'],
  [/подорож|travel|відпуст|отпуск|trip/i, '✈️'],
  [/зарплат|salary|зп|wage/i, '💼'],
  [/депозит|deposit|відсот|interest/i, '🏦'],
  [/заощадж|saving|накоп/i, '🐷'],
  [/кешбек|cashback|бонус|bonus/i, '🪙'],
];

export const guessIcon = (name, type) =>
  ICON_GUESS.find(([re]) => re.test(name))?.[1] ?? (type === 'income' ? '💰' : '📦');

const norm = (s) => s.trim().toLowerCase();

// Записи -> зміни для бази. existing = {accounts, categories, txs}.
// existing.importKeys — ключі рядків, які не стали операціями (початкові баланси).
// Повертає { accounts, categories, txs (нові), accountInitial: Map(id->delta), extraKeys, stats }
export function buildImport(records, existing, { baseCurrency = 'UAH', rates = {} } = {}) {
  const accounts = [...existing.accounts];
  const categories = [...existing.categories];
  const newAccounts = [], newCategories = [], newTxs = [];
  const accountInitial = new Map();
  const stats = { expense: 0, income: 0, transfer: 0, initial: 0, duplicates: 0, unmatchedTransfers: 0 };

  const findAcc = (name, currency) => {
    let a = accounts.find((x) => norm(x.name) === norm(name));
    if (!a) {
      a = { id: uid(), name, currency: currency || baseCurrency, initialBalance: 0, icon: guessAccIcon(name), color: PALETTE[(accounts.length * 5) % PALETTE.length], order: accounts.length };
      accounts.push(a); newAccounts.push(a);
    }
    return a;
  };
  const findCat = (name, type) => {
    let c = categories.find((x) => x.type === type && norm(x.name) === norm(name));
    if (!c) {
      const n = categories.filter((x) => x.type === type).length;
      c = { id: uid(), name, type, icon: guessIcon(name, type), color: PALETTE[(n * 3 + (type === 'income' ? 7 : 0)) % PALETTE.length], order: n };
      categories.push(c); newCategories.push(c);
    }
    return c;
  };

  // Ключі вже наявних операцій, щоб повторний імпорт не дублював
  const seen = new Set([...existing.txs.flatMap((t) => [t.importKey, t.importKey2]), ...(existing.importKeys ?? [])].filter(Boolean));
  const extraKeys = [];
  const keyCount = new Map();
  const makeKey = (r) => {
    const base = [r.date, norm(r.account), norm(r.category), r.amount, r.description].join('|');
    const n = (keyCount.get(base) ?? 0) + 1; // однакові операції в один день — різні ключі
    keyCount.set(base, n);
    return `${base}#${n}`;
  };

  const outs = [], ins = [];
  for (const r of records) {
    const key = makeKey(r);
    if (seen.has(key)) { stats.duplicates++; continue; }
    const acc = findAcc(r.account, r.currency);
    const tr = parseTransferCategory(r.category);
    if (tr) {
      (r.amount < 0 || tr.dir === 'out' ? outs : ins).push({ r, acc, tr, key });
      continue;
    }
    if (INITIAL_RE.test(r.category)) {
      accountInitial.set(acc.id, (accountInitial.get(acc.id) ?? 0) + toMinor(r.amount));
      stats.initial++;
      extraKeys.push(key);
      continue;
    }
    const type = r.amount < 0 ? 'expense' : 'income';
    const cat = findCat(r.category, type);
    newTxs.push({
      id: uid(), type, amount: Math.abs(toMinor(r.amount)), accountId: acc.id, categoryId: cat.id,
      date: r.date, note: r.description, importKey: key, createdAt: Date.now(),
    });
    stats[type]++;
  }

  // Зводимо пари переказів: вихід з A ("To 'B'") + вхід у B ("From 'A'") того ж дня.
  const usedIn = new Set();
  for (const o of outs) {
    const toAcc = findAcc(o.tr.other, o.r.currency);
    const match = ins.find((i) => !usedIn.has(i) && i.acc.id === toAcc.id && norm(i.tr.other) === norm(o.acc.name) && i.r.date === o.r.date
      && (i.acc.currency !== o.acc.currency || Math.abs(i.r.amount) === Math.abs(o.r.amount)));
    if (match) usedIn.add(match);
    const amount = Math.abs(toMinor(o.r.amount));
    newTxs.push({
      id: uid(), type: 'transfer', amount, accountId: o.acc.id, toAccountId: toAcc.id,
      toAmount: match ? Math.abs(toMinor(match.r.amount)) : convert(amount, o.acc.currency, toAcc.currency, baseCurrency, rates),
      date: o.r.date, note: o.r.description,
      importKey: o.key, importKey2: match?.key, createdAt: Date.now(),
    });
    stats.transfer++;
  }
  // Входи без пари: або їхній вихід уже імпортовано раніше (тоді це дублікат),
  // або рахунок-джерело видалено в Monefy.
  for (const i of ins) {
    if (usedIn.has(i)) continue;
    const fromAcc = findAcc(i.tr.other, i.r.currency);
    const prev = existing.txs.find((t) => t.type === 'transfer' && t.importKey && !t.importKey2 && t.date === i.r.date
      && t.accountId === fromAcc.id && t.toAccountId === i.acc.id);
    if (prev) { extraKeys.push(i.key); stats.duplicates++; continue; }
    const toAmount = Math.abs(toMinor(i.r.amount));
    newTxs.push({
      id: uid(), type: 'transfer', amount: convert(toAmount, i.acc.currency, fromAcc.currency, baseCurrency, rates), accountId: fromAcc.id,
      toAccountId: i.acc.id, toAmount, date: i.r.date, note: i.r.description, importKey: i.key, createdAt: Date.now(),
    });
    stats.transfer++; stats.unmatchedTransfers++;
  }
  const dates = records.map((r) => r.date).sort();
  stats.from = dates[0]; stats.to = dates[dates.length - 1];
  return { accounts: newAccounts, categories: newCategories, txs: newTxs, accountInitial, extraKeys, stats };
}

function guessAccIcon(name) {
  if (/карт|card|mono|приват|privat|bank|банк/i.test(name)) return '💳';
  if (/депоз|deposit|saving|заощ|скарбн/i.test(name)) return '🏦';
  if (/usd|\$|долар|eur|євро/i.test(name)) return '💵';
  return '👛';
}
