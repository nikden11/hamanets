import test from 'node:test';
import assert from 'node:assert/strict';
import { calcExpr, periodRange, shiftAnchor, fmtMoney } from '../js/util.js';
import { convert, accountBalances, summarize, budgetProgress, categoryOrder } from '../js/calc.js';
import { parseMonefy, buildImport, parseAmount, parseDate, parseTransferCategory } from '../js/monefy.js';

test('калькулятор', () => {
  assert.equal(calcExpr('12,5+7,5'), 20);
  assert.equal(calcExpr('100−20×2'), 60);
  assert.equal(calcExpr('10÷4'), 2.5);
  assert.equal(calcExpr('15+'), 15);
  assert.ok(Number.isNaN(calcExpr('')));
  assert.ok(Number.isNaN(calcExpr('abc')));
  assert.ok(Number.isNaN(calcExpr('5÷0')));
});

test('періоди', () => {
  assert.deepEqual([periodRange('month', '2026-02-15').start, periodRange('month', '2026-02-15').end], ['2026-02-01', '2026-02-28']);
  const w = periodRange('week', '2026-11-02'); // понеділок
  assert.deepEqual([w.start, w.end], ['2026-11-02', '2026-11-08']);
  assert.equal(shiftAnchor('month', '2026-01-31', 1), '2026-02-01');
  assert.equal(shiftAnchor('year', '2026-05-05', -1), '2025-05-05');
});

test('формат грошей', () => {
  assert.equal(fmtMoney(123456, 'UAH').replace(/\s/g, ' '), '1 234,56 ₴');
  assert.equal(fmtMoney(-500, 'USD').replace(/\s/g, ' '), '−5,00 $');
  // дизайн-система: суми без копійок (округлення лише при показі)
  assert.equal(fmtMoney(128550, 'UAH', { whole: true }).replace(/\s/g, ' '), '1 286 ₴');
  assert.equal(fmtMoney(-49, 'UAH', { whole: true }).replace(/\s/g, ' '), '0 ₴');
  assert.equal(fmtMoney(500000, 'UAH', { whole: true, sign: true }).replace(/\s/g, ' '), '+5 000 ₴');
});

test('конвертація і баланси', () => {
  const rates = { USD: 40 };
  assert.equal(convert(1000, 'USD', 'UAH', 'UAH', rates), 40000);
  assert.equal(convert(40000, 'UAH', 'USD', 'UAH', rates), 1000);
  const accounts = [{ id: 'a', currency: 'UAH', initialBalance: 10000 }, { id: 'b', currency: 'USD', initialBalance: 0 }];
  const txs = [
    { type: 'expense', amount: 2000, accountId: 'a', categoryId: 'c1', date: '2026-11-01' },
    { type: 'income', amount: 5000, accountId: 'a', categoryId: 'i1', date: '2026-11-02' },
    { type: 'transfer', amount: 4000, accountId: 'a', toAccountId: 'b', toAmount: 100, date: '2026-11-03' },
    { type: 'expense', amount: 50, accountId: 'b', categoryId: 'c1', date: '2026-12-01' },
  ];
  const bal = accountBalances(accounts, txs);
  assert.equal(bal.get('a'), 9000);
  assert.equal(bal.get('b'), 50);
  const s = summarize({ txs, accounts, accountId: null, start: '2026-11-01', end: '2026-11-30', base: 'UAH', rates });
  assert.equal(s.expense, 2000);
  assert.equal(s.income, 5000);
  assert.equal(s.balance, 9000 + 100 * 40); // переказ не є витратою
  const sb = summarize({ txs, accounts, accountId: 'b', start: '2026-12-01', end: '2026-12-31', base: 'UAH', rates });
  assert.equal(sb.expense, 50);
  assert.equal(sb.currency, 'USD');
  const bp = budgetProgress({ budgets: [{ id: 'x', categoryId: 'c1', amount: 3000 }, { id: 'y', categoryId: null, amount: 10000 }], txs, accounts, start: '2026-12-01', end: '2026-12-31', base: 'UAH', rates });
  assert.equal(bp[0].spent, 2000);
  assert.equal(bp[1].spent, 2000);
});

test('розбір чисел і дат Monefy', () => {
  assert.equal(parseAmount('-1 234,56'), -1234.56);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('-50'), -50);
  assert.equal(parseAmount('1.234,5'), 1234.5);
  assert.equal(parseAmount('12,000'), 12000);
  assert.equal(parseDate('25/03/2024'), '2024-03-25');
  assert.equal(parseDate('3.4.2024'), '2024-04-03');
  assert.equal(parseDate('2024-03-25'), '2024-03-25');
  assert.equal(parseDate('03/25/2024', 'mdy'), '2024-03-25');
  assert.deepEqual(parseTransferCategory("To 'Картка'"), { dir: 'out', other: 'Картка' });
  assert.deepEqual(parseTransferCategory('From “Cash”'), { dir: 'in', other: 'Cash' });
  assert.equal(parseTransferCategory('Food'), null);
});

const CSV = `date,account,category,amount,currency,converted amount,currency,description
01/10/2026,Cash,Food,-150.50,UAH,-150.50,UAH,"Сільпо, хліб"
01/10/2026,Cash,Food,-150.50,UAH,-150.50,UAH,"Сільпо, хліб"
02/10/2026,Card,Salary,30000,UAH,30000,UAH,
03/10/2026,Card,To 'Cash',-1000,UAH,-1000,UAH,
03/10/2026,Cash,From 'Card',1000,UAH,1000,UAH,
04/10/2026,USD,Initial balance,500,USD,20000,UAH,
05/10/2026,Card,Таксі,-250,UAH,-250,UAH,Bolt
`;

test('імпорт Monefy CSV', () => {
  const { records, errors } = parseMonefy(CSV);
  assert.equal(errors.length, 0);
  assert.equal(records.length, 7);
  assert.equal(records[0].description, 'Сільпо, хліб');
  const res = buildImport(records, { accounts: [], categories: [], txs: [] });
  assert.equal(res.stats.expense, 3);
  assert.equal(res.stats.income, 1);
  assert.equal(res.stats.transfer, 1);
  assert.equal(res.stats.unmatchedTransfers, 0);
  assert.equal(res.stats.initial, 1);
  assert.deepEqual(res.accounts.map((a) => a.name).sort(), ['Card', 'Cash', 'USD']);
  assert.equal(res.accounts.find((a) => a.name === 'USD').currency, 'USD');
  assert.equal(res.accountInitial.get(res.accounts.find((a) => a.name === 'USD').id), 50000);
  const t = res.txs.find((x) => x.type === 'transfer');
  assert.equal(t.amount, 100000);
  assert.equal(res.categories.find((c) => c.name === 'Таксі').icon, '🚕');

  // Повторний імпорт того самого файлу нічого не додає
  const again = buildImport(records, { accounts: res.accounts, categories: res.categories, txs: res.txs, importKeys: res.extraKeys });
  assert.equal(again.txs.length, 0);
  assert.equal(again.stats.duplicates, 7);
});

test('CSV з крапкою з комою і десятковою комою', () => {
  const csv = 'date;account;category;amount;currency;description\n15.10.2026;Готівка;Продукти;-99,90;UAH;\n';
  const { records } = parseMonefy(csv);
  assert.equal(records[0].amount, -99.9);
  assert.equal(records[0].date, '2026-10-15');
});

test('регресії з рев\'ю', () => {
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('12.50'), 12.5);
  // небезпечна валюта не проходить
  const x = parseMonefy('date,account,category,amount,currency\n01/02/2026,A,B,-1,<img src=x onerror=alert(1)>\n');
  assert.equal(x.records[0].currency, null);
  // неоднозначні дати
  const amb = parseMonefy('date,account,category,amount\n03/04/2026,A,B,-1\n');
  assert.equal(amb.dateAmbiguous, true);
  assert.equal(parseMonefy('date,account,category,amount\n03/04/2026,A,B,-1\n', { dateOrder: 'mdy' }).records[0].date, '2026-03-04');
  // вихід переказу імпортовано раніше, потім прийшла вся пара — дубля немає
  const one = parseMonefy("date,account,category,amount,currency\n03/10/2026,Card,To 'Cash',-1000,UAH\n03/10/2026,Cash,Food,-5,UAH\n").records;
  const r1 = buildImport(one, { accounts: [], categories: [], txs: [] });
  const both = parseMonefy("date,account,category,amount,currency\n03/10/2026,Card,To 'Cash',-1000,UAH\n03/10/2026,Cash,From 'Card',1000,UAH\n03/10/2026,Cash,Food,-5,UAH\n").records;
  const r2 = buildImport(both, { accounts: r1.accounts, categories: r1.categories, txs: r1.txs, importKeys: r1.extraKeys });
  assert.equal(r2.txs.length, 0);
  // непарний переказ між валютами конвертується
  const fx = parseMonefy("date,account,category,amount,currency\n03/10/2026,Card,To 'Usd',-4000,UAH\n").records;
  const usd = { id: 'u', name: 'Usd', currency: 'USD', initialBalance: 0 };
  const r3 = buildImport(fx, { accounts: [usd], categories: [], txs: [] }, { baseCurrency: 'UAH', rates: { USD: 40 } });
  assert.equal(r3.txs[0].toAmount, 10000);
});

test('версії синхронні (app.js ↔ version.json)', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  const v = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8')).version;
  assert.equal(app.match(/APP_VERSION = '([^']+)'/)[1], v);
});

test('порядок категорій за частотою', () => {
  const cats = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const tx = (categoryId, date, type = 'expense') => ({ type, categoryId, date, amount: 100 });
  const ids = (arr) => arr.map((c) => c.id).join('');
  const opts = { type: 'expense', today: '2026-11-02' };
  // початок місяця (<5 операцій): поточний місяць ×3 + 12 попередніх; старші за рік і доходи не рахуються
  const early = [tx('c', '2026-10-05'), tx('c', '2026-09-01'), tx('c', '2026-08-01'), tx('c', '2026-07-01'),
    tx('b', '2026-11-01'), tx('a', '2025-10-01'), tx('a', '2026-10-01', 'income')];
  assert.equal(ids(categoryOrder(cats, early, opts)), 'cba'); // c=4, b=1×3, a=0
  // ≥5 операцій у місяці — лише поточний місяць
  const full = [...early, tx('a', '2026-11-01'), tx('a', '2026-11-02'), tx('a', '2026-11-02'), tx('b', '2026-11-02')];
  assert.equal(ids(categoryOrder(cats, full, opts)), 'abc'); // a=3, b=2, c=0
  // рівні — порядок з налаштувань
  assert.equal(ids(categoryOrder(cats, [], opts)), 'abc');
});

test('ringLayout: іконки не накладаються, лінії не заходять у кільце, домінуюча стоїть навпроти сегмента', async () => {
  const { ringLayout } = await import('../js/calc.js');
  assert.deepEqual(ringLayout([]), []);
  const sets = [[5920, 2470, 1480], [8420, 3280, 2360, 1900, 1150, 1120, 780], [8420, 3280, 2360, 1900, 1150, 1120, 780, 640, 450, 380, 260, 190, 120, 90],
    [8000, 300, 250, 200, 180, 150, 120, 100, 90, 80, 70, 60]];
  for (const vals of sets) {
    const L = ringLayout(vals);
    assert.equal(L.length, vals.length);
    for (let i = 0; i < L.length; i++) {
      assert.ok(L[i].x >= 30 && L[i].x <= 360 && L[i].y >= 44 && L[i].y <= 348, `межі ${i}`);
      for (let j = i + 1; j < L.length; j++) assert.ok(Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y) > 56, `відстань ${i}-${j}`);
      // усі точки шляху (кінці відрізків, контрольні точки, дуги) — не ближче ro до центру
      const nums = L[i].d.match(/-?\d+(\.\d+)?/g).map(Number);
      const xy = L[i].d.replace(/A[^A-Z]*?(?=C)/g, '').match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g).map((q) => q.split(',').map(Number));
      assert.ok(nums.length > 4 && xy.every(([x, y]) => Math.hypot(x - 195, y - 196) >= 74), `лінія ${i} не всередині кільця`);
    }
  }
  // сегмент 80% — іконка навпроти середини (150°)
  const [big] = ringLayout([8000, 300, 250, 200, 180, 150, 120, 100, 90, 80, 70, 60]);
  const ang = (Math.atan2(big.x - 195, -(big.y - 196)) * 180) / Math.PI;
  assert.ok(Math.abs(ang - 150) < 0.5, `кут ${ang}`);
});

test('ringOrder: великий–малий навперемінно', async () => {
  const { ringOrder } = await import('../js/calc.js');
  assert.deepEqual(ringOrder([9, 7, 5, 3, 1]), [9, 1, 7, 3, 5]);
  assert.deepEqual(ringOrder([4, 2]), [4, 2]);
  assert.deepEqual(ringOrder([]), []);
});

test('monthPace: витрати до того ж дня минулого місяця', async () => {
  const { monthPace } = await import('../js/calc.js');
  const accounts = [{ id: 'a', currency: 'UAH' }];
  const tx = (date, amount) => ({ id: date + amount, type: 'expense', amount, accountId: 'a', date });
  const txs = [tx('2026-10-05', 1000), tx('2026-10-20', 500), tx('2026-10-25', 9000), tx('2026-11-03', 700), tx('2026-11-21', 100)];
  const o = { txs, accounts, accountId: null, base: 'UAH', rates: {} };
  // поточний місяць: 1–22 листопада (800) проти 1–22 жовтня (1500)
  assert.deepEqual(monthPace({ ...o, month: '2026-11', today: '2026-11-22' }), { now: 800, prev: 1500, diff: -700, day: 22, prevMonth: 9 });
  // минулий місяць цілком: жовтень (10500) проти вересня — у вересні витрат немає → null
  assert.equal(monthPace({ ...o, month: '2026-10', today: '2026-11-22' }), null);
  // 31 березня → лютий обрізається до 28
  const t2 = [tx('2026-02-28', 300), tx('2026-03-30', 200)];
  assert.equal(monthPace({ ...o, txs: t2, month: '2026-03', today: '2026-03-31' }).day, 28);
  // майбутній місяць
  assert.equal(monthPace({ ...o, month: '2026-12', today: '2026-11-22' }), null);
});
