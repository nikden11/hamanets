// Дрібні допоміжні функції: гроші, дати, id, екранування.

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

// Значення, які потрапляють у HTML без екранування, — лише з безпечного алфавіту.
export const cleanCur = (c, fallback = 'UAH') => (/^[A-Z]{3}$/.test(String(c ?? '').trim().toUpperCase()) ? String(c).trim().toUpperCase() : fallback);
export const cleanColor = (c, fallback = '#9aa0a6') => (/^#[0-9a-f]{3,8}$/i.test(String(c ?? '')) ? c : fallback);
export const cleanIcon = (i, fallback = '📦') => String(i ?? '').replace(/[<>&"'`=\\/\s]/g, '').slice(0, 12) || fallback;

// ---------- Гроші (зберігаємо цілими копійками) ----------

export const toMinor = (n) => Math.round(Number(n) * 100);
export const fromMinor = (m) => m / 100;

export const CURRENCY_SYMBOLS = {
  UAH: '₴', USD: '$', EUR: '€', PLN: 'zł', GBP: '£', CHF: 'Fr', CZK: 'Kč',
};

export const CURRENCIES = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'CHF', 'CZK'];

const nf = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });

// 123456 -> "1 234,56 ₴"
export function fmtMoney(minor, currency = 'UAH', { short = false, sign = false } = {}) {
  const v = fromMinor(minor);
  const abs = Math.abs(v);
  const num = short && abs >= 1000 ? nf0.format(abs) : nf.format(abs);
  const s = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  const sym = CURRENCY_SYMBOLS[currency] ?? cleanCur(currency, '');
  return `${s}${num} ${sym}`;
}

// ---------- Дати (рядки YYYY-MM-DD у локальному часі) ----------

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = () => toISO(new Date());

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
export const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
export const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];

export function fmtDate(iso, { weekday = false, year = 'auto' } = {}) {
  const d = parseISO(iso);
  const showYear = year === true || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
  let s = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${showYear ? ' ' + d.getFullYear() : ''}`;
  if (weekday) s += `, ${WEEKDAYS[d.getDay()]}`;
  return s;
}

export function relDay(iso) {
  const t = today();
  if (iso === t) return 'Сьогодні';
  if (iso === addDays(t, -1)) return 'Вчора';
  return null;
}

// ---------- Періоди ----------

export const PERIODS = [
  ['day', 'День'], ['week', 'Тиждень'], ['month', 'Місяць'], ['year', 'Рік'], ['all', 'Весь час'], ['custom', 'Інтервал'],
];

// Повертає {start, end, label}; end включно. Для 'all' — null-межі.
export function periodRange(kind, anchor, custom) {
  const d = parseISO(anchor);
  switch (kind) {
    case 'day':
      return { start: anchor, end: anchor, label: relDay(anchor) ?? fmtDate(anchor, { weekday: true }) };
    case 'week': {
      const dow = (d.getDay() + 6) % 7; // понеділок = 0
      const start = addDays(anchor, -dow);
      const end = addDays(start, 6);
      const s = parseISO(start), e = parseISO(end);
      const label = s.getMonth() === e.getMonth()
        ? `${s.getDate()}–${e.getDate()} ${MONTHS_GEN[e.getMonth()]}`
        : `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
      return { start, end, label };
    }
    case 'month': {
      const start = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
      const end = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const label = `${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
      return { start, end, label };
    }
    case 'year':
      return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `${d.getFullYear()} рік` };
    case 'custom': {
      const start = custom?.start ?? anchor, end = custom?.end ?? anchor;
      return { start, end, label: `${fmtDate(start)} – ${fmtDate(end)}` };
    }
    default:
      return { start: null, end: null, label: 'Весь час' };
  }
}

export function shiftAnchor(kind, anchor, dir) {
  const d = parseISO(anchor);
  if (kind === 'day') d.setDate(d.getDate() + dir);
  else if (kind === 'week') d.setDate(d.getDate() + 7 * dir);
  else if (kind === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  else if (kind === 'year') d.setFullYear(d.getFullYear() + dir);
  return toISO(d);
}

// ---------- Калькулятор для клавіатури (без eval) ----------

// Обчислює вираз з + − × ÷ і десятковою комою. Повертає число або NaN.
export function calcExpr(expr) {
  const src = String(expr).replace(/,/g, '.').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (!src) return NaN;
  const tokens = src.match(/\d*\.?\d+|\d+\.|[-+*/]/g);
  if (!tokens || tokens.join('') !== src) return NaN;
  // Відкидаємо оператор у кінці (користувач ще друкує)
  while (tokens.length && /[-+*/]/.test(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return NaN;
  const out = [];
  let op = '+';
  for (const t of tokens) {
    if (/[-+*/]/.test(t)) { op = t; continue; }
    const n = parseFloat(t);
    if (op === '+') out.push(n);
    else if (op === '-') out.push(-n);
    else if (op === '*') out.push(out.pop() * n);
    else if (op === '/') out.push(out.pop() / n);
  }
  const r = out.reduce((a, b) => a + b, 0);
  return Number.isFinite(r) ? Math.round(r * 100) / 100 : NaN;
}

// ---------- Кольори й іконки ----------

export const PALETTE = [
  '#E8505B', '#F6A623', '#F9D423', '#7ED957', '#2EC4B6', '#3A86FF', '#8338EC', '#FF6FB5',
  '#FF8C42', '#06D6A0', '#118AB2', '#9B5DE5', '#F15BB5', '#00BBF9', '#A3A847', '#C77DFF',
  '#EF476F', '#43AA8B', '#577590', '#F94144',
];

export const EMOJIS = [
  '🛒', '🍔', '🍽️', '☕', '🍺', '🚌', '🚕', '🚗', '⛽', '🅿️', '🏠', '💡', '🧾', '📱', '🌐', '👕', '👟',
  '💊', '🩺', '🦷', '🎬', '🎮', '🎵', '📚', '🎓', '🏋️', '⚽', '🎁', '🐾', '👶', '🧴', '💇', '✈️', '🏖️',
  '🏨', '🔧', '🛠️', '🪴', '🧹', '💻', '📺', '🎨', '🚬', '🍷', '💳', '🏦', '💼', '💰', '🐷', '📈', '🪙',
  '💸', '🤝', '❤️', '⛪', '🎉', '🧸', '📦', '🧾', '🛡️', '🚇', '🚲', '🧑‍⚕️', '🐶', '🐱', '🍼', '📝', '➕',
];
