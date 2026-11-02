// Сховище в IndexedDB. Дані живуть лише на пристрої.
// Усі дані тримаємо в пам'яті (`state`), у базу пишемо кожну зміну.

import { uid, PALETTE, cleanCur, cleanColor, cleanIcon } from './util.js';

const DB_NAME = 'hamanets';
const VERSION = 1;
const STORES = ['accounts', 'categories', 'txs', 'budgets', 'meta'];

let db;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

function tx(stores, mode = 'readonly') {
  const t = db.transaction(stores, mode);
  const done = new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  return { t, done };
}

export const state = {
  accounts: [], categories: [], txs: [], budgets: [],
  settings: null, importKeys: [],
};

export const DEFAULT_SETTINGS = {
  id: 'settings',
  baseCurrency: 'UAH',
  rates: { USD: 45.5, EUR: 51.0 },
  ratesDate: null,
  autoRates: true,
  theme: 'auto',
};

const DEFAULT_EXPENSE = [
  ['Продукти', '🛒'], ['Кафе', '🍽️'], ['Транспорт', '🚌'], ['Таксі', '🚕'], ['Авто', '🚗'], ['Дім', '🏠'],
  ['Комуналка', '🧾'], ["Зв'язок", '📱'], ['Одяг', '👕'], ["Здоров'я", '💊'], ['Розваги', '🎬'], ['Спорт', '🏋️'],
  ['Подарунки', '🎁'], ['Тварини', '🐾'],
];
const DEFAULT_INCOME = [['Зарплата', '💼'], ['Депозити', '🏦'], ['Заощадження', '🐷'], ['Інше', '💰']];

function seed() {
  const cats = [
    ...DEFAULT_EXPENSE.map(([name, icon], i) => ({ id: uid(), name, icon, type: 'expense', color: PALETTE[i % PALETTE.length], order: i })),
    ...DEFAULT_INCOME.map(([name, icon], i) => ({ id: uid(), name, icon, type: 'income', color: PALETTE[(i * 3 + 3) % PALETTE.length], order: i })),
  ];
  const accs = [
    { id: uid(), name: 'Готівка', icon: '👛', currency: 'UAH', initialBalance: 0, color: PALETTE[3], order: 0 },
    { id: uid(), name: 'Картка', icon: '💳', currency: 'UAH', initialBalance: 0, color: PALETTE[5], order: 1 },
  ];
  return { cats, accs };
}

export async function load() {
  db = await open();
  const { t, done } = tx(STORES);
  const all = await Promise.all(STORES.map((s) => reqP(t.objectStore(s).getAll())));
  await done;
  const [accounts, categories, txs, budgets, meta] = all;
  state.settings = { ...DEFAULT_SETTINGS, ...(meta.find((m) => m.id === 'settings') ?? {}) };
  state.importKeys = meta.find((m) => m.id === 'importKeys')?.keys ?? [];
  if (!accounts.length && !categories.length && !txs.length) {
    const { cats, accs } = seed();
    await putMany('categories', cats);
    await putMany('accounts', accs);
    await saveSettings();
    state.categories = cats; state.accounts = accs; state.txs = []; state.budgets = [];
    return;
  }
  Object.assign(state, { accounts, categories, txs, budgets });
  sortAll();
}

export function sortAll() {
  state.accounts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  state.categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  state.txs.sort((a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt ?? 0) - (a.createdAt ?? 0)));
}

export async function putMany(store, items) {
  const { t, done } = tx([store], 'readwrite');
  const os = t.objectStore(store);
  for (const it of items) os.put(it);
  await done;
}

// Додати/оновити запис у базі і в state
export async function put(store, item) {
  await putMany(store, [item]);
  const arr = state[store];
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  sortAll();
}

export async function remove(store, id) {
  const { t, done } = tx([store], 'readwrite');
  t.objectStore(store).delete(id);
  await done;
  state[store] = state[store].filter((x) => x.id !== id);
}

export async function removeMany(store, ids) {
  const set = new Set(ids);
  const { t, done } = tx([store], 'readwrite');
  for (const id of ids) t.objectStore(store).delete(id);
  await done;
  state[store] = state[store].filter((x) => !set.has(x.id));
}

export async function saveSettings() {
  await putMany('meta', [state.settings]);
}

export async function saveImportKeys() {
  await putMany('meta', [{ id: 'importKeys', keys: state.importKeys }]);
}

// Перевірка й очищення записів, що прийшли ззовні (резервна копія, імпорт).
const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isInt = (n) => Number.isInteger(n);
export function sanitizeData(data) {
  const str = (v, n = 200) => String(v ?? '').slice(0, n);
  const accounts = (data.accounts ?? []).filter((a) => a?.id).map((a) => ({
    ...a, id: str(a.id, 64), name: str(a.name, 60) || 'Рахунок', currency: cleanCur(a.currency), icon: cleanIcon(a.icon, '👛'),
    color: cleanColor(a.color), initialBalance: isInt(a.initialBalance) ? a.initialBalance : 0,
  }));
  const categories = (data.categories ?? []).filter((c) => c?.id && (c.type === 'expense' || c.type === 'income')).map((c) => ({
    ...c, id: str(c.id, 64), name: str(c.name, 60) || 'Категорія', icon: cleanIcon(c.icon), color: cleanColor(c.color),
  }));
  const txs = (data.txs ?? []).filter((t) => t?.id && isDate(t.date) && isInt(t.amount) && ['expense', 'income', 'transfer'].includes(t.type))
    .map((t) => ({ ...t, id: str(t.id, 64), note: str(t.note) }));
  const budgets = (data.budgets ?? []).filter((b) => b?.id && isInt(b.amount));
  const importKeys = Array.isArray(data.importKeys) ? data.importKeys.filter((k) => typeof k === 'string') : [];
  const st = data.settings ?? {};
  const rates = {};
  for (const [k, v] of Object.entries(st.rates ?? {})) if (cleanCur(k, '') && Number(v) > 0) rates[cleanCur(k)] = Number(v);
  const settings = { ...st, baseCurrency: cleanCur(st.baseCurrency), rates, theme: ['auto', 'light', 'dark'].includes(st.theme) ? st.theme : 'auto' };
  return { accounts, categories, txs, budgets, importKeys, settings };
}

// Атомарний запис у кілька сховищ: { accounts:[...], txs:[...], meta:[...] }
export async function commit(changes) {
  const stores = Object.keys(changes).filter((k) => changes[k]?.length);
  if (!stores.length) return;
  const { t, done } = tx(stores, 'readwrite');
  for (const s of stores) for (const it of changes[s]) t.objectStore(s).put(it);
  await done;
}

// Повна заміна даних (відновлення з резервної копії / очищення) — одна транзакція
export async function replaceAll(raw) {
  const data = sanitizeData(raw);
  const { t, done } = tx(STORES, 'readwrite');
  for (const s of STORES) t.objectStore(s).clear();
  for (const s of ['accounts', 'categories', 'txs', 'budgets']) for (const it of data[s] ?? []) t.objectStore(s).put(it);
  const settings = { ...DEFAULT_SETTINGS, ...data.settings, id: 'settings' };
  t.objectStore('meta').put(settings);
  t.objectStore('meta').put({ id: 'importKeys', keys: data.importKeys });
  await done;
  Object.assign(state, {
    accounts: data.accounts, categories: data.categories, txs: data.txs, budgets: data.budgets,
    settings, importKeys: data.importKeys,
  });
  sortAll();
}

export async function resetToDefaults() {
  const { cats, accs } = seed();
  await replaceAll({ accounts: accs, categories: cats, txs: [], budgets: [], settings: state.settings });
}

export function snapshot() {
  return {
    app: 'Гаманець', version: 1, exportedAt: new Date().toISOString(),
    accounts: state.accounts, categories: state.categories, txs: state.txs, budgets: state.budgets,
    settings: state.settings, importKeys: state.importKeys,
  };
}
