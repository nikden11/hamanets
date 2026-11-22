// Гаманець — особистий облік витрат. Інтерфейс.
import { state, load, put, remove, removeMany, putMany, commit, saveSettings, replaceAll, resetToDefaults, snapshot, sortAll } from './db.js';
import * as U from './util.js';
import { summarize, accountBalances, budgetProgress, monthlyTotals, convert, categoryOrder, ringLayout, ringOrder } from './calc.js';
import { parseMonefy, buildImport } from './monefy.js';

export const APP_VERSION = '1.4.0';

const { esc } = U;
const fmtMoney = (m, cur, o = {}) => U.fmtMoney(m, cur, { whole: true, ...o });
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
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  pie: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12h8.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  back: '<path d="M9 5.5h10a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12zM11.5 9.5l5 5M16.5 9.5l-5 5"/>',
  cal: '<path d="M6 5.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2zM4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  note: '<path d="M5 19h4L19 9l-4-4L5 15zM13 7l4 4"/>',
  grid: '<path d="M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM15 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/>',
  import: '<path d="M12 4v10M8 10l4 4 4-4M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>',
  wallet: '<path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18zM4 7.5l11.5-3v3M15.5 13.5h1.5"/>',
  save: '<path d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5zM8 20.5v-6h8v6M8 3.5v4h5"/>',
  restore: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"/>',
  table: '<path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM4.5 10h15M4.5 14.5h15M10 10v9.5"/>',
  coins: '<circle cx="9" cy="9" r="5.5"/><path d="M14.4 9.9a5.5 5.5 0 1 1-4.5 4.5"/>',
  down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  arrowR: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  bars: '<path d="M5.5 20V13M10 20V5M14.5 20v-10M19 20v-5"/>',
  // заповнені варіанти для активної вкладки
  pieF: '<path d="M11 3.6A8.5 8.5 0 1 0 20.4 13H11z" fill="currentColor"/><path d="M13.5 3.6a8.5 8.5 0 0 1 6.9 6.9h-6.9z" fill="currentColor"/>',
  listF: '<path d="M9 6.5h11M9 12h11M9 17.5h11" stroke-width="2.4"/><circle cx="4.5" cy="6.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="17.5" r="1.4" fill="currentColor" stroke="none"/>',
  barsF: '<rect x="4" y="12" width="3.2" height="8.5" rx="1" fill="currentColor"/><rect x="8.4" y="4" width="3.2" height="16.5" rx="1" fill="currentColor"/><rect x="12.9" y="9" width="3.2" height="11.5" rx="1" fill="currentColor"/><rect x="17.4" y="14" width="3.2" height="6.5" rx="1" fill="currentColor"/>',
  targetF: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5" fill="currentColor"/>',
  cardF: '<rect x="1.5" y="4.5" width="21" height="15" rx="2.5" fill="currentColor"/><path d="M1.5 10h21" style="stroke:var(--card)"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// Лінійні іконки категорій з дизайн-системи «Чорнило» (24×24, штрих 1.75).
const CAT_ICONS = {
  groceries: 'M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2M8.2 20a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM15.7 20a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0z',
  cafe: 'M4 9.5h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v3M12 3.5v3',
  transport: 'M8 3h8a3 3 0 0 1 3 3v9a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3v-9a3 3 0 0 1 3 -3zM5 11h14M8 18v2.5M16 18v2.5M7.9 14.5a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0zM14.9 14.5a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0z',
  taxi: 'M4 16v-3.5l1.8-4.6a2 2 0 0 1 1.9-1.3h8.6a2 2 0 0 1 1.9 1.3l1.8 4.6V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 12.5h16M7 17v2M17 17v2M10 3.5h4v3h-4z',
  car: 'M4 16v-3.5l1.8-4.6a2 2 0 0 1 1.9-1.3h8.6a2 2 0 0 1 1.9 1.3l1.8 4.6V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 12.5h16M7 17v2M17 17v2M6.9 14.6a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0zM15.9 14.6a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0z',
  parking: 'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1 -4 4h-9a4 4 0 0 1 -4 -4v-9a4 4 0 0 1 4 -4zM9.75 17V7h3.5a3 3 0 0 1 0 6h-3.5',
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  utilities: 'M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9.8 8.4A2.4 2.4 0 0 1 12 7.2c1.3 0 2.2.8 2.2 1.9 0 2-4.4 2.3-4.4 4.5 0 1 .9 1.7 2.2 1.7 1 0 1.8-.5 2.2-1.3M9 10.6h6M9 12.8h6',
  phone: 'M9.5 2.5h5a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1 -2.5 2.5h-5a2.5 2.5 0 0 1 -2.5 -2.5v-14a2.5 2.5 0 0 1 2.5 -2.5zM11 18.5h2',
  clothes: 'M8.5 3.5 4 6l1.8 4.2L8 9.4v11.1h8V9.4l2.2.8L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z',
  health: 'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1 -4 4h-9a4 4 0 0 1 -4 -4v-9a4 4 0 0 1 4 -4zM12 8v8M8 12h8',
  leisure: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0zM10.5 9v6l5-3z',
  beauty: 'M7.5 13.5h9v7h-9zM8.75 9.75h6.5v3.75h-6.5zM9.75 9.75V6l4.5-2.75v6.5',
  sport: 'M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11',
  gifts: 'M5 9h14a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1zM5.5 13v7.5h13V13M12 9v11.5M12 9c-1.5-3-4.5-3.5-4.5-1.5S10.5 9 12 9zM12 9c1.5-3 4.5-3.5 4.5-1.5S13.5 9 12 9z',
  pets: 'M12 13c-2.5 0-5 2.6-5 4.8 0 1.6 1.4 2.2 2.6 2.2 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.2 0 2.6-.6 2.6-2.2 0-2.2-2.5-4.8-5-4.8zM4.1 10.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0zM7.7 6.6a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM12.7 6.6a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0zM16.5 10.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0z',
  salary: 'M5.5 7h13a2 2 0 0 1 2 2v8.5a2 2 0 0 1 -2 2h-13a2 2 0 0 1 -2 -2v-8.5a2 2 0 0 1 2 -2zM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17',
  deposits: 'M3.5 9.5 12 4.5l8.5 5zM5 20h14M6.5 10.5v7M10 10.5v7M14 10.5v7M17.5 10.5v7',
  savings: 'M5.5 4.5h13a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-13a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2zM9 11.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0zM12 8.5v-1M12 15.5v-1M6.5 18.5V20M17.5 18.5V20',
  coins: 'M3.5 9a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0zM14.4 9.9a5.5 5.5 0 1 1-4.5 4.5',
  transfer: 'M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5',
  more: 'M5 4.5h4.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1 -.5.5H5a.5.5 0 0 1 -.5 -.5V5a.5.5 0 0 1 .5 -.5zM14.5 4.5H19a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1 -.5.5h-4.5a.5.5 0 0 1 -.5 -.5V5a.5.5 0 0 1 .5 -.5zM5 14h4.5a.5.5 0 0 1 .5.5V19a.5.5 0 0 1 -.5.5H5a.5.5 0 0 1 -.5 -.5v-4.5a.5.5 0 0 1 .5 -.5zM16.75 14v5.5M14 16.75h5.5',
  uncategorized: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0zM7.4 12a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0zM11.4 12a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0zM15.4 12a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0z',
};
const PICK_ICONS = Object.keys(CAT_ICONS).filter((k) => k !== 'transfer' && k !== 'more');
// Старі категорії зберігають емодзі — показуємо замість нього відповідну лінійну іконку (дані не змінюються).
const EMOJI_KEY = {
  '🛒': 'groceries', '🍔': 'cafe', '🍽️': 'cafe', '🍽': 'cafe', '☕': 'cafe', '🍺': 'cafe', '🍷': 'cafe', '🚌': 'transport', '🚇': 'transport',
  '🚕': 'taxi', '🚗': 'car', '⛽': 'car', '🅿️': 'parking', '🅿': 'parking', '🔧': 'car', '🏠': 'home', '🛠️': 'home', '🪴': 'home', '🧹': 'home', '💡': 'utilities', '💄': 'beauty', '💅': 'beauty', '💇': 'beauty', '💇‍♀️': 'beauty',
  '🧾': 'utilities', '📱': 'phone', '🌐': 'phone', '💻': 'phone', '📺': 'phone', '👕': 'clothes', '👟': 'clothes', '💊': 'health', '🩺': 'health',
  '🦷': 'health', '🧑‍⚕️': 'health', '🎬': 'leisure', '🎮': 'leisure', '🎵': 'leisure', '🎨': 'leisure', '🎉': 'gifts', '🏋️': 'sport',
  '⚽': 'sport', '🚲': 'sport', '🎁': 'gifts', '🧸': 'gifts', '🐾': 'pets', '🐶': 'pets', '🐱': 'pets', '💼': 'salary', '🏦': 'deposits',
  '📈': 'deposits', '🐷': 'savings', '🛡️': 'savings', '💰': 'coins', '🪙': 'coins', '💸': 'coins', '💳': 'coins', '🤝': 'coins', '🔁': 'transfer',
};
const NAME_KEY = [
  [/продукт|food|grocer|супермаркет|їжа|еда/i, 'groceries'], [/кафе|ресторан|eating|cafe|restaurant|кава|coffee/i, 'cafe'],
  [/парк|parking/i, 'parking'], [/такс|taxi|uber|bolt/i, 'taxi'], [/транспорт|transport|метро|bus/i, 'transport'], [/авто|car|машин|бенз|fuel|пальне/i, 'car'],
  [/дім|дом|house|home|житл|квартир|оренд|rent/i, 'home'], [/крас|beauty|косм|салон|манік|перук|барбер/i, 'beauty'], [/комун|bills|utilit/i, 'utilities'], [/зв.?язок|связь|communic|телефон|phone|інтернет/i, 'phone'],
  [/одяг|одежд|cloth|взутт/i, 'clothes'], [/здоров|health|аптек|лік|медиц/i, 'health'], [/розваг|развлеч|entertain|кіно|cinema/i, 'leisure'],
  [/спорт|sport|gym|фітнес/i, 'sport'], [/подар|gift/i, 'gifts'], [/тварин|живот|pet/i, 'pets'], [/зарплат|salary|wage/i, 'salary'],
  [/депозит|deposit|відсот/i, 'deposits'], [/заощадж|saving|накоп/i, 'savings'], [/кешбек|cashback|бонус/i, 'coins'],
];
const NAME_FIX = [
  [/парк|parking/i, 'parking', ['car']], [/комун|utilit/i, 'utilities', ['home']],
  [/житл|жильё|жилье|квартир|оренд|rent|housing/i, 'home', ['uncategorized', '']],
  [/крас|beauty|косм|салон|манік|перук|барбер/i, 'beauty', ['uncategorized', '']],
];
function catKey(c) {
  const i = c?.icon;
  const k = CAT_ICONS[i] ? i : EMOJI_KEY[i];
  // Назва важливіша за стару автопідстановку: «Парковка» з машинкою → «P», «Комуналка» з будиночком → рахунок,
  // «Житло»/«Краса» з «•••» → будиночок/помада (дані не мігруються).
  const fix = NAME_FIX.find(([re, , from]) => from.includes(k ?? '') && re.test(c?.name ?? ''));
  if (fix) return fix[1];
  if (k) return k;
  const g = NAME_KEY.find(([re]) => re.test(c?.name ?? ''));
  return g ? g[1] : c?.type === 'income' ? 'coins' : 'uncategorized';
}
const catSvg = (k) => `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path d="${CAT_ICONS[k] ?? CAT_ICONS.uncategorized}"/></svg>`;
const catIco = (c) => catSvg(catKey(c));
// Індекс кольору DS (0…13): з hex дизайн-системи або зі старої палітри (за тим самим порядком).
function catColorIdx(c) {
  const col = String(c?.color ?? '').toUpperCase();
  const i = U.CAT_HEX.indexOf(col);
  if (i >= 0) return i;
  if (col === '#9A5656') return 6; // старий cat-07 «цегла» → «шавлія» (аудит 2.2)
  const j = U.PALETTE.findIndex((x) => x.toUpperCase() === col);
  return j >= 0 ? j % U.CAT_HEX.length : -1;
}
const catColor = (c) => { const i = catColorIdx(c); return i >= 0 ? `var(--cat-${String(i + 1).padStart(2, '0')})` : U.cleanColor(c?.color, 'var(--cat-09)'); };
const MARK = '<svg class="mark" viewBox="176 176 672 672" aria-hidden="true"><circle cx="512" cy="512" r="288" pathLength="100" stroke-dasharray="71 29" stroke-dashoffset="-2" style="stroke:var(--mark)"/><circle cx="512" cy="512" r="288" pathLength="100" stroke-dasharray="21 79" stroke-dashoffset="-77" style="stroke:var(--gold)"/></svg>';

// ---------- Стан інтерфейсу ----------
const ui = {
  tab: 'home',
  accountId: null,
  period: { kind: 'month', anchor: U.today(), custom: null },
  opsCat: null,
  opsSearch: '',
  budgetAnchor: U.today(),
  statsYear: new Date().getFullYear(),
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
// Режим кількох рахунків (готівка, картки, валюти). Вимкнено — один спільний облік, без переказів і вибору рахунку.
const multi = () => !!state.settings.multiAccount;
const NO_CAT = { name: 'Без категорії', icon: 'uncategorized', color: '#7A7468' };

// ---------- Рендер ----------
function render() {
  applyTheme();
  if (!multi()) { ui.accountId = null; if (ui.tab === 'accounts') ui.tab = 'home'; }
  const views = { home: viewHome, ops: viewOps, stats: viewStats, budgets: viewBudgets, accounts: viewAccounts };
  const before = ringPositions();
  $('#app').innerHTML = views[ui.tab]() + tabbar();
  moveRing(before);
  // Огляд — статичний екран без прокручування; якщо не влазить (малий iPhone), кільце трохи зменшується.
  document.documentElement.classList.toggle('static', ui.tab === 'home');
  if (ui.tab === 'home') { scrollTo(0, 0); fitHome(); }
}

// Рух кіл (аудит 1.4 / Д4): коло тієї ж категорії переїжджає зі старого місця на нове за 200 мс.
const ringKey = (b) => b.dataset.cat ?? 'more';
function ringPositions() {
  const m = new Map();
  document.querySelectorAll('#ring .ring-cat').forEach((b) => m.set(ringKey(b), [b.style.left, b.style.top]));
  return m;
}
function moveRing(before) {
  if (fitting || !before.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const moved = [];
  document.querySelectorAll('#ring .ring-cat').forEach((b) => {
    const old = before.get(ringKey(b));
    if (!old) { b.classList.add('appear'); return; }
    if (old[0] === b.style.left && old[1] === b.style.top) return;
    moved.push([b, b.style.left, b.style.top]);
    b.style.left = old[0]; b.style.top = old[1];
  });
  if (!moved.length) return;
  $('#ring').classList.add('moving');
  void $('#ring').offsetWidth;
  // якщо шторка ще закривається — рушаємо після неї, щоб рух було видно
  const delay = document.querySelector('.sheet-wrap') ? '.22s' : '0s';
  for (const [b, l, t] of moved) { b.classList.add('glide'); b.style.transitionDelay = delay; b.style.left = l; b.style.top = t; }
}

// Огляд на весь екран: зона кільця розтягується, щоб кнопки стояли над таббаром на будь-якому iPhone;
// на низьких екранах (менше 392px під кільце) — кільце пропорційно стискається.
// Нестача місця спершу забирається з висоти зони (контур кіл пласкішає, до RING_MIN_H), і лише потім —
// масштабом, не дрібніше 0.85, щоб коло лишалось ≥ 44px (аудит №2, N5). Поки відкрита шторка — нічого не перераховуємо (N4).
const RING_MIN_H = 340;
let ringH = 392, ringW = 390, ringK = 1, fitting = false;
const ringWidth = () => Math.min(430, document.documentElement.clientWidth || 390);
function applyRingK(ring = $('#ring')) {
  if (!ring) return;
  ring.style.transform = ringK < 1 ? `scale(${ringK.toFixed(3)})` : '';
  ring.style.marginBottom = ringK < 1 ? `${(-(ringH * (1 - ringK))).toFixed(1)}px` : '';
}
function fitHome() {
  const ring = $('#ring');
  if (!ring || fitting) return;
  if (sheets.length) return applyRingK(ring);
  ringK = 1; applyRingK(ring);
  const free = $('.tabbar').getBoundingClientRect().top - $('.big-actions').getBoundingClientRect().bottom - 12;
  const want = Math.max(RING_MIN_H, Math.min(900, Math.round(ringH + free)));
  if (Math.abs(want - ringH) > 2 || ringWidth() !== ringW) { ringH = want; fitting = true; render(); fitting = false; return fitHome(); }
  if (free >= 0) return;
  ringK = Math.max(0.85, (ringH + free) / ringH);
  applyRingK(ring);
}
// Перерахунок і тоді, коли висоти змінились без resize: довантажився шрифт (цифри — окремий файл),
// iOS після запуску з початкового екрана змінив висоту вікна, застосунок повернувся з фону.
let refitT = 0;
function refit() { clearTimeout(refitT); refitT = setTimeout(() => { if (ui.tab === 'home' && !sheets.length) fitHome(); }, 60); }
addEventListener('resize', refit);
// iOS 27: коли контент заходить під кнопки шапки — під ними з'являється скляна смуга
addEventListener('scroll', () => { $('.top')?.classList.toggle('scrolled', scrollY > 4); }, { passive: true });
addEventListener('orientationchange', refit);
addEventListener('pageshow', refit);
visualViewport?.addEventListener('resize', refit);
// iOS 27: коли контент заходить під кнопки шапки — під ними з'являється скляна смуга
addEventListener('scroll', () => { $('.top')?.classList.toggle('scrolled', scrollY > 4); }, { passive: true });
document.fonts?.addEventListener?.('loadingdone', refit);
document.fonts?.ready.then(refit);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refit(); });
// iOS: у статичному Огляді не даємо сторінці «тягнутися» (пружина), але шторки прокручуються.
document.addEventListener('touchmove', (e) => {
  if (document.documentElement.classList.contains('static') && !sheets.length) e.preventDefault();
}, { passive: false });

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function tabbar() {
  // Активна вкладка — заповнена іконка + жирніший підпис (самого кольору в темній темі замало, аудит 2.1)
  const t = (id, icon, label) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>${ic(ui.tab === id ? icon + 'F' : icon)}<span>${label}</span></button>`;
  return `<nav class="tabbar"><div class="tabbar-in glass">
    ${t('home', 'pie', 'Огляд')}${t('ops', 'list', 'Операції')}${t('stats', 'bars', 'Статистика')}${t('budgets', 'target', 'Бюджети')}${multi() ? t('accounts', 'card', 'Рахунки') : ''}
  </div></nav>`;
}

// Шапка «Скло» (iOS 27): угорі скляні кнопки 44px, нижче — великий заголовок 34px.
// left/right — HTML кнопок; title — текст заголовка; titleAct — дія дотику до заголовка (тоді зі стрілкою ⌄).
function glassHeader({ left = '', right = '', title = '', titleAct = '' }) {
  const t = titleAct ? `<button class="big-title-btn" data-a="${titleAct}">${title}${ic('chevD')}</button>` : title;
  return `<header class="top"><div class="top-row"><div class="grp">${left}</div><div class="grp">${right}</div></div></header>
  <h1 class="big-title">${t}</h1>`;
}
const glassBtn = (act, icon, label, extra = '') => `<button class="icon-btn glass" data-a="${act}" ${extra} aria-label="${label}">${ic(icon)}</button>`;
// скляна капсула ‹ mid › (перемикач періоду)
const glassNav = (act, mid = '', { prev = true, next = true } = {}) => `<div class="glass pill">
    <button class="icon-btn" data-a="${act}" data-dir="-1" ${prev ? '' : 'disabled'} aria-label="Попередній">${ic('chevL')}</button>
    ${mid}
    <button class="icon-btn" data-a="${act}" data-dir="1" ${next ? '' : 'disabled'} aria-label="Наступний">${ic('chevR')}</button></div>`;
// Чип рахунку — лише в режимі кількох рахунків.
function accSwitch() {
  if (!multi()) return '';
  const a = acc(ui.accountId);
  const label = a ? `${a.icon} <span class="n">${esc(a.name)}</span>` : `<span class="n">Усі рахунки</span>`;
  return `<button class="acc-switch glass" data-a="pickAccount">${label}${ic('chevD')}</button>`;
}
// Перемикач періоду (Огляд, Операції): ‹ рік › — стрілки; назва періоду — великим заголовком.
function periodNav(withLabel = false) {
  const all = ui.period.kind === 'all' || ui.period.kind === 'custom';
  const last = range().end >= U.today(); // стрілка в майбутнє вимкнена, якщо поточний період останній
  const year = ui.period.kind === 'month' || ui.period.kind === 'week' || ui.period.kind === 'day' ? (range().start ?? '').slice(0, 4) : '';
  const mid = withLabel ? `<button class="pill-mid btn-mid" data-a="pickPeriod">${esc(range().label)}${ic('chevD')}</button>`
    : year ? `<span class="pill-mid num">${year}</span>` : '';
  return glassNav('periodShift', mid, { prev: !all, next: !all && !last });
}
const periodTitle = () => esc(range().label.replace(/ \d{4}$/, ''));

function currentSummary() {
  const r = range();
  return summarize({ txs: state.txs, accounts: state.accounts, accountId: ui.accountId, start: r.start, end: r.end, base: base(), rates: rates() });
}

// ---------- Огляд ----------
// Кільце: на ньому лише категорії з витратами за період (до 13 + «Ще»), кола — по заокругленому прямокутнику
// навколо діаграми (ringLayout у calc.js, координати в дизайн-сітці 390×392; x масштабується за шириною).
const RING_MAX = 14;
const DONUT = 148; // діаметр діаграми (було 168 — Денис попросив менше, 2026-11-21)

function donutSvg(segs, size = 120, stroke = 10) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, total = segs.reduce((s, x) => s + x.value, 0);
  let out = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--idle)" stroke-width="${stroke}"/>`;
  if (total > 0) {
    const gap = segs.length > 1 ? C * 0.02 : 0;
    let off = 0;
    for (const s of segs) {
      const len = (s.value / total) * C;
      const vis = Math.max(len - gap, 0.5);
      out += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${s.color}" stroke-width="${stroke}"
        stroke-dasharray="${vis} ${C - vis}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      off += len;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}">${out}</svg>`;
}

function viewHome() {
  const s = currentSummary();
  const spent = [...s.byCat.entries()].filter(([, v]) => v.type === 'expense' && v.amount > 0)
    .sort((a, b) => b[1].amount - a[1].amount).map(([id, v]) => ({ c: cat(id) ?? NO_CAT, id, amount: v.amount }));
  const items = ringOrder(spent.length > RING_MAX ? [...spent.slice(0, RING_MAX - 1),
    { more: true, amount: spent.slice(RING_MAX - 1).reduce((t, x) => t + x.amount, 0) }] : spent);
  const segs = items.map((x) => ({ value: x.amount, color: x.more ? 'var(--line-strong)' : catColor(x.c) }));
  const H = Math.max(RING_MIN_H, ringH); // висота зони кільця (fitHome): зайва висота йде в поля зверху й знизу
  const W = ringW = ringWidth();
  // контур іконок прив'язаний до діаграми, а не до висоти екрана (аудит №3, N8): b ≤ 146, a ≤ 152;
  // над верхньою іконкою ≥ 24px під її суму (N4; на найнижчих екранах — до 12px, плавно)
  const top = 56 + 12 * Math.min(1, Math.max(0, (H - 340) / 52));
  const L = ringLayout(items.map((x) => x.amount), { ro: DONUT / 2, cx: W / 2, cy: H / 2, a: Math.min(152, W / 2 - 38), b: Math.min(146, H / 2 - top) });
  const lines = L.map((l, i) => `<path d="${l.d}" style="stroke:${segs[i].color}"/>`).join('');
  const cells = items.map((x, i) => {
    const { x: cx, y, up } = L[i];
    const pos = `left:${cx.toFixed(1)}px;top:${y.toFixed(1)}px;--c:${segs[i].color}`;
    const amt = `<span class="ring-amt num ${up ? 'up' : ''}">${fmtMoney(x.amount, s.currency)}</span>`;
    return x.more
      ? `<button class="ring-cat on" style="${pos}" data-a="addTx" data-type="expense" aria-label="Інші категорії, ${fmtMoney(x.amount, s.currency)}. Додати витрату"><span class="ring-ico">${catSvg('more')}</span>${amt}</button>`
      : `<button class="ring-cat on" style="${pos}" data-a="addTx" data-type="expense" data-cat="${x.c.id}" aria-label="${esc(x.c.name)}, ${fmtMoney(x.amount, s.currency)}. Додати витрату"><span class="ring-ico">${catIco(x.c)}</span>${amt}</button>`;
  });

  return `${glassHeader({ left: periodNav(), right: accSwitch() + glassBtn('settings', 'sliders', 'Налаштування'), title: periodTitle(), titleAct: 'pickPeriod' })}
  <section class="ring" id="ring" style="height:${H}px">
    <svg class="ring-lines" viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines}</svg>
    <div class="ring-center" style="top:${H / 2 - DONUT / 2}px" data-a="goOps" role="button" aria-label="Операції за період">
      ${donutSvg(segs, DONUT, 11)}
      <div class="donut-text">${s.expense || s.income ? `
        <div class="sub">ВИТРАТИ</div>
        <div class="big-sum num exp">${fmtMoney(-s.expense, s.currency)}</div>
        ${s.income > 0 ? `<div class="small-sum num inc">${fmtMoney(s.income, s.currency, { sign: true })}</div>` : ''}` : `
        <div class="big-sum num muted">${fmtMoney(0, s.currency)}</div>
        <div class="hint0">Додайте першу витрату</div>`}
      </div>
    </div>
    ${cells.join('')}
  </section>
  <button class="balance-bar" data-a="openSummary">${balanceInner(s)}</button>
  <div class="big-actions">
    <button class="big minus" data-a="addTx" data-type="expense">${ic('minus')} Витрата</button>
    <button class="big plus" data-a="addTx" data-type="income">${ic('plus')} Дохід</button>
  </div>`;
}

// Баланс за період = доходи − витрати (не залишок на рахунках).
function balanceInner(s) {
  const b = s.income - s.expense;
  return `<span>${ui.period.kind === 'month' ? 'Баланс за місяць' : 'Баланс за період'}</span><span class="r"><b class="num ${b < 0 ? 'exp' : 'inc'}">${fmtMoney(b, s.currency, { sign: true })}</b>${ic('chevR')}</span>`;
}

// Підсумок періоду (шторка): доходи/витрати, розбивка за категоріями, 6 місяців. Відкривається з «Балансу» і з тосту після запису.
function openSummary() {
  openSheet({ full: true, render: () => {
    const s = currentSummary();
    const b = s.income - s.expense;
    return `${sheetHead(range().label)}
    <div class="sheet-b">
      <div class="card"><div class="row static"><span class="mid"><div class="t1">Доходи</div></span><span class="amt num inc">${fmtMoney(s.income, s.currency, { sign: true })}</span></div>
        <div class="row static"><span class="mid"><div class="t1">Витрати</div></span><span class="amt num exp">${fmtMoney(-s.expense, s.currency)}</span></div>
        <div class="row static"><span class="mid"><div class="t1"><b>Баланс</b></div></span><span class="amt num ${b < 0 ? 'exp' : 'inc'}"><b>${fmtMoney(b, s.currency, { sign: true })}</b></span></div></div>
      ${breakdownCard(s, 'expense', 'Витрати')}
      ${breakdownCard(s, 'income', 'Доходи')}
      ${trendCard()}
      <button class="btn ghost" style="width:100%;margin:4px 0 24px" data-a="goOps">Усі операції</button>
    </div>`;
  } });
}

function backupReminder() {
  const last = state.settings.lastBackup;
  if (state.txs.length < 20) return '';
  const days = last ? Math.round((U.parseISO(U.today()) - U.parseISO(last)) / 864e5) : null;
  if (days !== null && days < 30) return '';
  return `<div class="card"><div class="row">
    <span class="ico ui">${ic('save')}</span>
    <span class="mid" style="white-space:normal"><div class="t1" style="white-space:normal">${days === null ? 'Ви ще не робили резервну копію' : `Остання копія — ${days} дн. тому`}</div><div class="t2" style="white-space:normal">Дані зберігаються лише на цьому телефоні.</div></span>
    <button class="btn ghost" style="height:40px;padding:0 14px;font-size:15px" data-a="exportJson">Зберегти</button></div></div>`;
}

function breakdownCard(s, type, title) {
  const rows = [...s.byCat.entries()].filter(([, v]) => v.type === type).sort((a, b) => b[1].amount - a[1].amount);
  if (!rows.length) return '';
  const total = type === 'expense' ? s.expense : s.income;
  return `<div class="card"><div class="card-h"><span>${title}</span><span class="muted num">${fmtMoney(total, s.currency)}</span></div>
    ${rows.map(([id, v]) => {
      const c = cat(id) ?? NO_CAT;
      const pct = total ? (v.amount / total) * 100 : 0;
      return `<button class="row" data-a="goOps" data-cat="${id}" style="--c:${catColor(c)}">
        <span class="ico">${catIco(c)}</span>
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

// ---------- Статистика ----------
function viewStats() {
  const year = ui.statsYear;
  const cur = base();
  const data = monthlyTotals({ txs: state.txs, accounts: state.accounts, base: cur, rates: rates(), anchor: `${year}-12-01`, n: 12 });
  const r = U.periodRange('year', `${year}-01-01`);
  const s = summarize({ txs: state.txs, accounts: state.accounts, accountId: null, start: r.start, end: r.end, base: cur, rates: rates() });
  // Середнє рахуємо по місяцях від першого з даними до поточного (для минулих років — до грудня)
  const now = U.today();
  const lastM = now.slice(0, 4) === String(year) ? +now.slice(5, 7) : now.slice(0, 4) > String(year) ? 12 : 0;
  const firstM = data.findIndex((d) => d.income || d.expense) + 1;
  const months = firstM && lastM >= firstM ? lastM - firstM + 1 : 0;
  const avgE = months ? Math.round(s.expense / months) : 0;
  const avgI = months ? Math.round(s.income / months) : 0;
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const rows = [...s.byCat.entries()].filter(([, v]) => v.type === 'expense').sort((a, b) => b[1].amount - a[1].amount);

  return `${glassHeader({ left: glassNav('statsShift', `<span class="pill-mid num">${year}</span>`), title: 'Статистика' })}
  <div class="card stats3">
    <div><small>Доходи</small><b class="inc num">${fmtMoney(s.income, cur, { short: true })}</b></div>
    <div><small>Витрати</small><b class="exp num">${fmtMoney(s.expense, cur, { short: true })}</b></div>
    <div><small>Залишилось</small><b class="num">${fmtMoney(s.net, cur, { short: true, sign: true })}</b></div>
  </div>
  <div class="card stats3">
    <div><small>Витрати / міс.</small><b class="num">${fmtMoney(avgE, cur, { short: true })}</b></div>
    <div><small>Доходи / міс.</small><b class="num">${fmtMoney(avgI, cur, { short: true })}</b></div>
    <div><small>Заощаджено</small><b class="num">${s.income > 0 ? Math.round((s.net / s.income) * 100) + '%' : '—'}</b></div>
  </div>
  <div class="card"><div class="card-h"><span>По місяцях</span>
    <span class="legend"><span><i style="background:var(--inc)"></i>Доходи</span><span><i style="background:var(--exp)"></i>Витрати</span></span></div>
    <div class="bars" style="gap:4px">${data.map((d) => `<button class="col" data-a="statsMonth" data-m="${d.month}" aria-label="${d.month}"><i class="n" style="height:${(d.income / max) * 100}%"></i><i class="e" style="height:${(d.expense / max) * 100}%"></i></button>`).join('')}</div>
    <div class="bars-x" style="gap:4px">${data.map((d) => `<span class="${d.month === now.slice(0, 7) ? 'cur' : ''}">${U.MONTHS_SHORT[+d.month.slice(5) - 1].slice(0, 3)}</span>`).join('')}</div>
    <p class="hint" style="padding:0 16px 12px;margin:0">Натисніть на місяць, щоб відкрити його на «Огляді».</p></div>
  ${rows.length ? `<div class="card"><div class="card-h"><span>Категорії витрат</span><span class="muted">сер. / міс.</span></div>
    ${rows.map(([id, v]) => {
      const c = cat(id) ?? NO_CAT;
      const pct = s.expense ? (v.amount / s.expense) * 100 : 0;
      return `<button class="row" data-a="statsCat" data-cat="${id}" style="--c:${catColor(c)}">
        <span class="ico">${catIco(c)}</span>
        <span class="mid"><div class="t1">${esc(c.name)}</div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div></span>
        <span class="amt num">${fmtMoney(v.amount, cur, { short: true })}<small>${months ? fmtMoney(Math.round(v.amount / months), cur, { short: true }) : ''} · ${pct.toFixed(pct < 10 ? 1 : 0)}%</small></span>
      </button>`;
    }).join('')}</div>` : `<div class="empty"><div class="e-ico">${ic('bars')}</div>За ${year} рік ще немає операцій</div>`}`;
}

// ---------- Операції ----------
function viewOps() {
  const s = currentSummary();
  const c = ui.opsCat ? cat(ui.opsCat) ?? NO_CAT : null;
  return `${glassHeader({ left: periodNav(true), right: accSwitch(), title: 'Операції' })}
  <div class="card stats3">
    <div><small>Доходи</small><b class="inc num">${fmtMoney(s.income, s.currency, { sign: true })}</b></div>
    <div><small>Витрати</small><b class="exp num">${fmtMoney(-s.expense, s.currency)}</b></div>
    <div><small>Залишок</small><b class="num">${fmtMoney(s.net, s.currency, { sign: true })}</b></div>
  </div>
  <label class="search">${ic('search')}<input type="search" placeholder="Пошук за нотаткою чи категорією" value="${esc(ui.opsSearch)}" data-in="opsSearch" enterkeyhint="search"></label>
  ${c ? `<div class="chips" style="padding-top:8px"><button class="chip" data-a="clearOpsCat" style="--c:${catColor(c)};padding-left:14px"><span class="dot">${catIco(c)}</span>${esc(c.name)} ${ic('x')}</button></div>` : ''}
  <div id="ops-list">${opsList(s)}</div>`;
}

function opsList(s = currentSummary()) {
  const q = ui.opsSearch.trim().toLowerCase();
  let list = s.list;
  if (ui.opsCat) list = list.filter((t) => t.categoryId === ui.opsCat);
  if (q) list = list.filter((t) => `${t.note ?? ''} ${(cat(t.categoryId) ?? NO_CAT).name} ${acc(t.accountId)?.name ?? ''}`.toLowerCase().includes(q));
  if (!list.length) {
    return `<div class="empty"><div class="e-ico">${ic('list')}</div>${state.txs.length ? 'Немає операцій за цей період' : 'Ще немає жодної операції.<br>Додайте першу кнопкою «Витрата» на головному екрані або імпортуйте історію з Monefy в налаштуваннях.'}</div>`;
  }
  const byDay = new Map();
  for (const t of list) { if (!byDay.has(t.date)) byDay.set(t.date, []); byDay.get(t.date).push(t); }
  const showAcc = multi() && !ui.accountId && accounts().length > 1;
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
    return `<button class="row" data-a="editTx" data-id="${t.id}">
      <span class="ico ui">${catSvg('transfer')}</span>
      <span class="mid"><div class="t1">${esc(a?.name ?? '?')} → ${esc(to?.name ?? '?')}</div><div class="t2">${esc(t.note || 'Переказ')}</div></span>
      <span class="amt num muted">${fmtMoney(amount, cur)}</span></button>`;
  }
  const c = cat(t.categoryId) ?? NO_CAT;
  const sub = [t.note, showAcc ? a?.name : null].filter(Boolean).map(esc).join(' · ');
  return `<button class="row" data-a="editTx" data-id="${t.id}" style="--c:${catColor(c)}">
    <span class="ico">${catIco(c)}</span>
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
    const c = b.categoryId ? cat(b.categoryId) ?? NO_CAT : { name: 'Загальний бюджет', total: true };
    const pct = Math.min(b.ratio, 1) * 100;
    const over = b.ratio > 1, near = !over && b.ratio >= 0.85; // ≥ 85% — «Майже вичерпано» (аудит 2.6)
    const color = over ? 'var(--exp)' : near ? 'var(--warn)' : c.total ? 'var(--accent)' : catColor(c);
    const perDay = isCur && b.left > 0 ? ` · ≈${fmtMoney(Math.floor(b.left / daysLeft), cur, { short: true })}/день` : '';
    return `<button class="budget ${over ? 'over-row' : ''}" style="display:block;width:100%;text-align:left;--c:${c.total ? 'var(--accent)' : catColor(c)}" data-a="editBudget" data-id="${b.id}">
      <div class="top-l">${c.total ? `<span class="ico total">${ic('target')}</span>` : `<span class="ico">${catIco(c)}</span>`}<span class="nm">${esc(c.name)}</span><span class="num">${fmtMoney(b.spent, cur).replace(/\s?[^\d\s−+]+$/, '')} з ${fmtMoney(b.amount, cur)}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
      <div class="meta"><span class="${near ? 'near' : ''}">${Math.round(b.ratio * 100)}%${near ? ' · Майже вичерпано' : ''}</span><span class="${b.left < 0 ? 'over' : ''}">${b.left < 0 ? `Перевищено на ${fmtMoney(-b.left, cur)}` : `Залишилось ${fmtMoney(b.left, cur)}${perDay}`}</span></div>
    </button>`;
  }).join('')}</div>` : `<div class="empty"><div class="e-ico">${ic('target')}</div>Бюджетів ще немає.<br>Задайте місячний ліміт на категорію або загальний — і стежте, скільки ще можна витратити.</div>`;

  return `${glassHeader({ left: glassNav('budgetShift', `<span class="pill-mid">${esc(r.label)}</span>`), right: glassBtn('editBudget', 'plus', 'Додати бюджет'), title: 'Бюджети' })}
    ${body}
    <div class="btns"><button class="btn ghost" data-a="editBudget">${ic('plus')} Додати бюджет</button></div>
    <p class="hint" style="padding:0 20px">Ліміти — на календарний місяць, у базовій валюті (${cur}), враховуються витрати з усіх рахунків.</p>`;
}

// ---------- Рахунки ----------
function viewAccounts() {
  const bal = accountBalances(state.accounts, state.txs);
  let total = 0;
  for (const a of accounts()) if (!a.excludeFromTotal) total += convert(bal.get(a.id), a.currency, base(), base(), rates());
  return `${glassHeader({ right: glassBtn('editAccount', 'plus', 'Додати рахунок'), title: 'Рахунки' })}
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
  if (!sheets.length && ui.tab === 'home') fitHome();
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
      <div class="grabber"></div>
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
      ${c ? `<button class="chip ed-cat-chip" data-a="edPickCat" style="--c:${catColor(c)};padding-left:14px"><span class="dot">${catIco(c)}</span>${esc(c.name)}${ic('chevD')}</button>`
    : `<button class="chip ed-cat-chip" data-a="edPickCat">Категорія${ic('chevD')}</button>`}
      ${multi() ? `<button class="chip" data-a="edPickAcc">${a.icon} ${esc(a.name)}</button>` : ''}
      <label class="chip">${ic('cal')} ${rel ?? U.fmtDate(ed.date)}<input type="date" value="${ed.date}" data-in="edDate" max="2100-12-31"></label>
    </div>
    <label class="ed-note">${ic('note')}<input type="text" placeholder="Нотатка" aria-label="Нотатка" value="${esc(ed.note)}" data-in="edNote" enterkeyhint="done" maxlength="200"></label>
    <div class="keypad">
      ${k('1', '1')}${k('2', '2')}${k('3', '3')}${k(ic('back'), 'back', 'op')}
      ${k('4', '4')}${k('5', '5')}${k('6', '6')}${k('−', '−', 'op')}
      ${k('7', '7')}${k('8', '8')}${k('9', '9')}${k('+', '+', 'op')}
      ${k('000', '000')}${k('0', '0')}${k('×', '×', 'op')}${k('÷', '÷', 'op')}
    </div>
    <button class="ok-btn" data-a="edOk">${ed.id ? `${ic('check')} Зберегти` : c ? `${ic('check')} Записати ${ed.type === 'expense' ? 'витрату' : 'дохід'}` : `Обрати категорію ${ic('arrowR')}`}</button>
  </div>`;
}

function edAmountHtml(hasOp, v, a) {
  return `<div class="expr num">${hasOp ? esc(ed.expr) + ' =' : ''}</div>
    <div class="val num">${Number.isFinite(v) ? edMoney(U.toMinor(v), a.currency) : fmtMoney(0, a.currency)}</div>`;
}

// У редакторі копійки показуємо лише якщо вони справді є (напр. при редагуванні імпортованої операції).
const edMoney = (m, cur) => (m % 100 ? U.fmtMoney(m, cur) : fmtMoney(m, cur));

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
  } else if (k === '000') {
    const last = e.split(/[+−×÷]/).pop();
    if (last === '' || last === '0' || last.includes(',') || last.length + 3 > 10) return;
    e += '000';
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
  // Порядок за частотою рахуємо один раз при відкритті сітки — під пальцем він не змінюється.
  if (!ed.catOrder || ed.catOrderType !== ed.type) {
    ed.catOrder = categoryOrder(catsOf(ed.type), state.txs, { type: ed.type, today: U.today() }).map((c) => c.id);
    ed.catOrderType = ed.type;
  }
  const pos = (c) => { const i = ed.catOrder.indexOf(c.id); return i < 0 ? 1e6 : i; }; // нові — в кінці, перед «Нова»
  const cats = [...catsOf(ed.type)].sort((a, b) => pos(a) - pos(b));
  const v = edValue(), a = acc(ed.accountId);
  // Сума видна перед останнім тапом (тап по плитці одразу записує) — аудит №2, N6
  const sum = Number.isFinite(v) && v > 0 ? ` · <span class="num ${ed.type === 'expense' ? 'exp' : 'inc'}">${ed.type === 'expense' ? '−' : '+'}${edMoney(U.toMinor(v), a.currency)}</span>` : '';
  return `${sheetHead((ed.type === 'expense' ? 'Категорія витрати' : 'Категорія доходу') + sum)}
  <div class="sheet-b"><div class="cat-grid">
    ${cats.map((c) => `<button class="cat-tile ${c.id === ed.categoryId ? 'sel' : ''}" style="--c:${catColor(c)}" data-a="edCat" data-id="${c.id}"><span class="ico">${catIco(c)}</span><span>${esc(c.name)}</span></button>`).join('')}
    <button class="cat-tile add" data-a="editCategory" data-type="${ed.type}"><span class="ico">${ic('plus')}</span><span>Нова</span></button>
  </div></div>`;
}

async function saveEditor() {
  const v = edValue();
  if (!(v > 0)) {
    $('#ed-amount')?.classList.add('shake'); // лише похитування, без тосту (DS Keypad)
    setTimeout(() => $('#ed-amount')?.classList.remove('shake'), 300);
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
  toast(`${c.name}: ${t.type === 'expense' ? '−' : '+'}${edMoney(t.amount, acc(t.accountId).currency)}${isNew ? '' : ' · збережено'}`, { label: 'Підсумок', fn: () => openSummary() });
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
  toast(`${f.name} → ${t.name}: ${fmtMoney(rec.amount, f.currency)}`);
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
  catEd = c ? { ...c, icon: catKey(c), color: U.CAT_HEX[Math.max(catColorIdx(c), 0)] }
    : { id: null, name: '', icon: type === 'income' ? 'coins' : 'uncategorized', type, color: freeColor(type), autoIcon: true };
  openSheet({ render: renderCatEditor, onClose: () => { catEd = null; } });
}

// Колір нової категорії: перший cat-01…14, не зайнятий категоріями того ж типу; якщо всі зайняті — найрідший (аудит №2, N2).
function freeColor(type) {
  const n = U.CAT_HEX.map(() => 0);
  for (const c of catsOf(type)) { const i = catColorIdx(c); if (i >= 0) n[i]++; }
  return U.CAT_HEX[n.indexOf(Math.min(...n))];
}
// Іконка нової категорії підбирається за назвою під час набору, поки її не обрали вручну (аудит №2, N3).
function autoIcon(e, sh) {
  if (!e.autoIcon) return;
  const g = NAME_KEY.find(([re]) => re.test(e.name));
  e.icon = g ? g[1] : e.type === 'income' ? 'coins' : 'uncategorized';
  const tile = sh?.querySelector('.cat-tile .ico');
  if (tile) tile.innerHTML = catSvg(e.icon);
  sh?.querySelectorAll('.icon-grid button').forEach((b) => b.classList.toggle('sel', b.dataset.v === e.icon));
}

function renderCatEditor() {
  const e = catEd;
  const used = e.id ? state.txs.filter((t) => t.categoryId === e.id).length : 0;
  const others = state.categories.filter((c) => c.type === e.type && c.id !== e.id);
  return `${sheetHead(e.id ? 'Категорія' : 'Нова категорія')}
  <div class="sheet-b"><div class="form">
    <div style="display:flex;justify-content:center"><span class="cat-tile" style="--c:${catColor(e)}"><span class="ico" style="width:72px;height:72px">${catIco(e)}</span></span></div>
    ${e.id ? '' : `<div class="seg" style="margin:0"><button class="${e.type === 'expense' ? 'on' : ''}" data-a="catType" data-v="expense">Витрата</button><button class="${e.type === 'income' ? 'on' : ''}" data-a="catType" data-v="income">Дохід</button></div>`}
    <div class="field"><label>Назва</label><input type="text" data-in="catName" value="${esc(e.name)}" placeholder="Напр. Кава" maxlength="30"></div>
    <div class="field"><label>Іконка</label>
      <div class="icon-grid">${PICK_ICONS.map((k) => `<button class="${k === catKey(e) ? 'sel' : ''}" data-a="catIconPick" data-v="${k}" aria-label="${k}">${catSvg(k)}</button>`).join('')}</div></div>
    <div class="field"><label>Колір</label><div class="color-grid">${U.CAT_HEX.map((h, i) => `<button class="${i === catColorIdx(e) ? 'sel' : ''}" style="--c:var(--cat-${String(i + 1).padStart(2, '0')})" data-a="catColor" data-v="${h}" aria-label="Колір ${i + 1}"></button>`).join('')}</div></div>
    <button class="btn block" data-a="catSave">${ic('check')} Зберегти</button>
    ${e.id ? `<div class="field" style="margin-top:8px"><label>Видалення${used ? ` · ${used} операцій` : ''}</label>
      ${used && others.length ? `<select id="cat-move">${others.map((c) => `<option value="${c.id}">Перенести операції в: ${esc(c.name)}</option>`).join('')}<option value="">Видалити операції разом із категорією</option></select>` : ''}
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
  if (fromEditor && rec.type === ed.type) {
    // Нова категорія з сітки вибору: якщо сума вже введена — одразу записуємо операцію (аудит 2.4)
    ed.categoryId = rec.id; ed.step = 'amount';
    if (ed.pending && edValue() > 0) return saveEditor();
  }
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
      <div class="sheet-b"><div class="card">${list.map((c, i) => `<div class="row" style="--c:${catColor(c)}">
        <span class="ico">${catIco(c)}</span><button class="mid" style="text-align:left" data-a="editCategory" data-id="${c.id}"><div class="t1">${esc(c.name)}</div></button>
        <button class="icon-btn" data-a="catMove" data-id="${c.id}" data-dir="-1" ${i === 0 ? 'disabled style="opacity:.25"' : ''} aria-label="Вгору">${ic('chevU')}</button>
        <button class="icon-btn" data-a="catMove" data-id="${c.id}" data-dir="1" ${i === list.length - 1 ? 'disabled style="opacity:.25"' : ''} aria-label="Вниз">${ic('chevD')}</button>
      </div>`).join('')}</div>
      <p class="hint" style="padding:0 20px">${ui.catTab === 'expense' ? 'Перші 14 стоять навколо кільця на «Огляді» (решта — через «Ще»). Дотик до кола — швидко додати витрату.' : ''} Стрілками змінюється порядок.</p></div>`;
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
        <div class="field"><label>Категорія</label><select data-in="bCat" ${b ? 'disabled' : ''}>${options.map((c) => `<option value="${c.id ?? ''}" ${(c.id ?? '') === bEd.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
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
      ${backupReminder()}
      <div class="section-t">Дані</div>
      <div class="card">
        <label class="row tap"><span class="ico ui">${ic('wallet')}</span><span class="mid"><div class="t1">Кілька рахунків</div><div class="t2">Готівка, картки, валюти, перекази</div></span><input type="checkbox" class="switch" data-in="multiAcc" ${multi() ? 'checked' : ''}></label>
        <button class="row" data-a="openCategories"><span class="ico ui">${ic('grid')}</span><span class="mid"><div class="t1">Категорії</div><div class="t2">${catsOf('expense').length} витрат · ${catsOf('income').length} доходів</div></span>${ic('chevR')}</button>
        <button class="row" data-a="openImport"><span class="ico ui">${ic('import')}</span><span class="mid"><div class="t1">Імпорт з Monefy</div><div class="t2">CSV-файл з Monefy → Налаштування → Експорт</div></span>${ic('chevR')}</button>
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
        <button class="row" data-a="exportJson"><span class="ico ui">${ic('save')}</span><span class="mid"><div class="t1">Зберегти резервну копію</div><div class="t2">Усі дані в один JSON-файл</div></span>${ic('down')}</button>
        <label class="row tap"><span class="ico ui">${ic('restore')}</span><span class="mid"><div class="t1">Відновити з копії</div><div class="t2">Замінить поточні дані</div></span>${ic('up')}<input type="file" accept=".json,application/json" data-in="restoreJson" hidden></label>
        <button class="row" data-a="exportCsv"><span class="ico ui">${ic('table')}</span><span class="mid"><div class="t1">Експорт у CSV</div><div class="t2">Для Excel; формат як у Monefy</div></span>${ic('down')}</button>
      </div>
      <p class="hint" style="padding:0 20px">Дані зберігаються тільки на цьому телефоні. Робіть резервну копію раз на тиждень-місяць (наприклад, у Файли → iCloud).</p>
      <div class="section-t">Вигляд</div>
      <div class="seg">${[['auto', 'Авто'], ['light', 'Світла'], ['dark', 'Темна']].map(([k, l]) => `<button class="${s.theme === k ? 'on' : ''}" data-a="theme" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="section-t">Небезпечна зона</div>
      <div class="card"><button class="row" data-a="wipe"><span class="ico ui danger">${ic('trash')}</span><span class="mid"><div class="t1 exp">Стерти всі дані</div><div class="t2">Повернути стандартні категорії й рахунки</div></span></button></div>
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
    ${res.categories.length ? `<div class="hint">Категорії: ${res.categories.map((c) => esc(c.name)).join(', ')}</div>` : ''}
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
  openSummary: () => openSummary(),
  goOps: (d) => { while (sheets.length) closeSheet(); ui.tab = 'ops'; ui.opsCat = d.cat || null; ui.opsSearch = ''; render(); scrollTo(0, 0); },
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
  catType: (d) => { catEd.type = d.v; if (!catEd.id) { catEd.color = freeColor(d.v); autoIcon(catEd); } refreshSheet(); },
  catIconPick: (d) => { catEd.icon = d.v; catEd.autoIcon = false; refreshSheet(); },
  catColor: (d) => { catEd.color = d.v; refreshSheet(); },
  catSave: () => saveCategory(),
  catDelete: () => deleteCategory(),

  editBudget: (d) => openBudgetEditor(d.id),
  statsShift: (d) => { ui.statsYear += +d.dir; render(); },
  statsMonth: (d) => { ui.period = { kind: 'month', anchor: `${d.m}-01`, custom: null }; saveUi(); ui.tab = 'home'; render(); scrollTo(0, 0); },
  statsCat: (d) => {
    ui.period = { kind: 'year', anchor: `${ui.statsYear}-01-01`, custom: null };
    ui.tab = 'ops'; ui.opsCat = d.cat; ui.opsSearch = ''; render(); scrollTo(0, 0);
  },
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
  catName: (el) => { catEd.name = el.value; autoIcon(catEd, el.closest('.sheet')); },
  catIcon: (el) => { catEd.icon = el.value.trim(); const i = el.closest('.sheet').querySelector('.cat-tile .ico'); if (i) i.textContent = catEd.icon; },
  bCat: (el) => { bEd.categoryId = el.value; },
  bAmount: (el) => { bEd.amount = el.value; },
  baseCur: (el) => { changeBase(el.value).catch((e) => toast('Помилка: ' + e.message)); },
  rate: (el) => {
    const v = U.calcExpr(el.value);
    if (v > 0) { state.settings.rates[el.dataset.cur] = v; state.settings.autoRates = false; saveSettings(); render(); refreshSheet(); }
  },
  multiAcc: async (el) => {
    state.settings.multiAccount = el.checked;
    await saveSettings();
    refreshSheet(); render();
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

// Помітний відгук на натискання (зауваження Дениса Д2): клас .pressed тримається ще 150 мс після відпускання,
// бо :active на швидкому тапі iPhone майже не видно, а вібрації в PWA на iOS немає.
const PRESSABLE = '.keypad button, .ring-cat, .ring-center, .cat-tile, .big, .ok-btn, .btn, .chip, .tab, .row, .budget, .icon-btn, .period-label, .big-title-btn, .btn-mid, .balance-bar, .seg button, .ed-types button, .icon-grid button, .color-grid button';
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest(PRESSABLE);
  if (!el || el.disabled) return;
  el.classList.add('pressed');
  const release = () => setTimeout(() => el.classList.remove('pressed'), 150);
  el.addEventListener('pointerup', release, { once: true });
  el.addEventListener('pointercancel', release, { once: true });
}, { passive: true });

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
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });

// Автооновлення: на сайті лежить version.json; якщо версія новіша — перезавантажуємось
// (лише коли не відкрито жодної шторки, і не частіше ніж раз на 5 хв, щоб не зациклитись).
let lastUpdateCheck = 0;
async function checkUpdate() {
  if (location.protocol === 'file:' || !navigator.onLine || Date.now() - lastUpdateCheck < 60e3) return;
  lastUpdateCheck = Date.now();
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { version } = await res.json();
    if (!version || version === APP_VERSION || sheets.length) return;
    let last = 0;
    try { last = +localStorage.getItem('hamanets-reload') || 0; } catch { }
    if (Date.now() - last < 5 * 60e3) return;
    try { localStorage.setItem('hamanets-reload', String(Date.now())); } catch { }
    await (await navigator.serviceWorker?.getRegistration())?.update().catch(() => { });
    location.reload();
  } catch { /* офлайн або файлу ще немає */ }
}

// ---------- Старт ----------
(async () => {
  try {
    await load();
  } catch (err) {
    $('#app').innerHTML = `<div class="empty">Не вдалося відкрити сховище даних.<br><small>${esc(err?.message ?? err)}</small></div>`;
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
    checkUpdate();
  }
})();

// Для налагодження в консолі
window.__hamanets = { state, ui, render };
