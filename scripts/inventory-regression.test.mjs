import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/function calcSold\(\)\{[^\n]*\}/);
assert.ok(match, 'calcSold() must exist as a single-line function');

const today = '2026-10-21';
const S = {
  set: {},
  exp: [],
  xf: [],
  sales: [
    { type: 'جوجه', date: '2026-10-20', qty: 10, hall: 'A' },
    { type: 'جوجه', date: '2026-10-21', qty: 20, flock: 'future-flock' },
    { type: 'جوجه', date: '2026-10-22', qty: 30, hall: 'A' }
  ],
  flocks: [
    { id: 'current-flock', hall: 'A', date: '2026-10-01', count: 100,
      dead: [{ d: '2026-10-05', n: 5 }, { d: '2026-10-22', n: 7 }] },
    { id: 'future-flock', hall: 'A', date: '2026-10-22', count: 50, dead: [] }
  ]
};
const context = {
  S,
  SO: {},
  td: () => today,
  sum: (items, key) => items.reduce((total, item) => total + (+item[key] || 0), 0)
};
runInNewContext(match[0] + '\ncalcSold();', context);

assert.equal(context.SO['current-flock'], 10,
  'a hall sale should only allocate to flocks already started on the sale date');
assert.equal(context.SO['future-flock'], undefined,
  'a direct sale must not reduce a flock before its start date');
assert.equal(Object.values(context.SO).reduce((a, b) => a + b, 0), 10,
  'future-dated sales must not reduce current inventory');
console.log('PASS inventory regression: date cutoffs and flock-start allocation');

const ledgerMatch = html.match(/function accountLedger\(ac,a\)\{[^\n]*\}/);
assert.ok(ledgerMatch, 'accountLedger() must exist for cash/bank balances');
const ledgerS = {
  set: { openingBalances: { 'صندوق نقدی': 1000, 'بانک': 500 } }
};
const vouchers = [
  { type: 'دریافت', account: 'صندوق نقدی', amount: 250 },
  { type: 'پرداخت', account: 'صندوق نقدی', amount: 100 },
  { type: 'انتقال', account: 'صندوق نقدی', targetAccount: 'بانک', amount: 300 },
  { type: 'انتقال', account: 'بانک', targetAccount: 'صندوق نقدی', amount: 50 },
  { type: 'دریافت', account: 'بانک', amount: 80 }
];
const ledgerContext = { S: ledgerS };
const cash = runInNewContext(ledgerMatch[0] + '\naccountLedger("صندوق نقدی", vouchers)', { ...ledgerContext, vouchers });
const bank = runInNewContext(ledgerMatch[0] + '\naccountLedger("بانک", vouchers)', { ...ledgerContext, vouchers });
assert.equal(cash.opening, 1000);
assert.equal(cash.ins, 250);
assert.equal(cash.outs, 100);
assert.equal(cash.tin, 50);
assert.equal(cash.tout, 300);
assert.equal(cash.balance, 900, 'cash balance must include transfers but not count them as income/expense');
assert.equal(bank.balance, 830, 'bank balance must include inbound/outbound transfers');
assert.equal(cash.ins + bank.ins, 330, 'internal transfers must not inflate receipts');
console.log('PASS financial regression: opening balances, receipts/payments and internal transfers');

const summaryMatch = html.match(/function linkedPurchasePayments\(p,excludeId\)\{[^\n]*\}\nfunction linkedSaleReceipts\(p,excludeId\)\{[^\n]*\}\nfunction financialSummary\(\)\{[^\n]*\}/);
assert.ok(summaryMatch, 'financial summary and linked settlement helpers must exist');
const financeState = {
  sales: [
    { id: 's1', cust: 'مشتری الف', date: '2026-10-20', due: '2026-10-19', total: 1000, paid: 200 },
    { id: 's2', cust: 'مشتری ب', date: '2026-10-21', due: '2026-10-30', total: 400, paid: 0 },
    { id: 's3', cust: 'مشتری آینده', date: '2026-10-22', total: 9000, paid: 0 }
  ],
  purch: [
    { id: 'p1', sup: 'تأمین‌کننده الف', date: '2026-10-20', total: 600 },
    { id: 'p2', sup: 'تأمین‌کننده ب', date: '2026-10-21', total: 150 },
    { id: 'p3', sup: 'تأمین‌کننده آینده', date: '2026-10-22', total: 7000 }
  ],
  vouchers: [
    { id: 'v1', type: 'دریافت', related: 'فروش:s1', amount: 350 },
    { id: 'v2', type: 'دریافت', related: 'فروش:s2', amount: 100 },
    { id: 'v3', type: 'پرداخت', related: 'خرید:p1', amount: 200 },
    { id: 'v4', type: 'پرداخت', related: 'خرید:p1', date: '2026-10-21', amount: 50 },
    { id: 'v5', type: 'دریافت', related: 'فروش:s2', date: '2026-10-22', amount: 400 },
    { id: 'v6', type: 'پرداخت', related: 'خرید:p2', date: '2026-10-22', amount: 150 }
  ],
  exp: [{ date: '2026-10-21', amount: 50 }, { date: '2026-10-22', amount: 999 }]
};
const finance = runInNewContext(summaryMatch[0] + '\nfinancialSummary()', {
  S: financeState, nm: x => String(x || '').trim(), eTot: x => x.amount, td: () => '2026-10-21'
});
assert.equal(finance.receivable, 950, 'linked customer receipts must reduce receivables without double counting');
assert.equal(finance.payable, 500, 'supplier payments linked to the purchase must reduce payables');
assert.equal(finance.revenue, 1400);
assert.equal(finance.purchaseCost, 750);
assert.equal(finance.expenses, 50);
assert.equal(finance.estimate, 600);
assert.equal(finance.customers.find(x => x.name === 'مشتری الف').due, 650);
assert.equal(finance.customers.find(x => x.name === 'مشتری الف').overdue, 650, 'past-due receivables must be separated from current receivables');
assert.equal(finance.customers.find(x => x.name === 'مشتری ب').overdue, 0, 'future due dates must not count as overdue');
assert.equal(finance.suppliers.find(x => x.name === 'تأمین‌کننده الف').due, 350);
console.log('PASS financial regression: receivables and payables');

const deleteHandler = html.match(/function dl\(b,a,id\)\{[^\n]*\}/);
assert.ok(deleteHandler, 'delete handler must exist');
assert.match(deleteHandler[0], /if\(a=='sales'\|\|a=='purch'\)/,
  'sale/purchase deletion must guard against linked vouchers');
assert.match(deleteHandler[0], /if\(linked\.length\)/,
  'linked voucher guard must stop deletion when related vouchers exist');
console.log('PASS financial regression: linked transaction deletion guard is present');

assert.match(html, /function downloadBackup\(\)/, 'manager must have a JSON backup download action');
assert.match(html, /createdAt:new Date\(\)\.toISOString\(\)/, 'downloaded backup must be timestamped');
assert.match(html, /parsed\.app==='گله‌یار'&&parsed\.format===1&&parsed\.data/, 'restore must accept the exported backup envelope');
assert.match(html, /gelehyar_preimport_backup/, 'restore must preserve an emergency snapshot before replacement');
console.log('PASS financial regression: backup export and guarded restore');


const syncSplitMatch = html.match(/function split\(\)\{[^\n]*\}/);
const syncMergeMatch = html.match(/function merge\(o,f\)\{[^\n]*\}/);
assert.ok(syncSplitMatch && /warehouses:S\.warehouses\|\|\[\]/.test(syncSplitMatch[0]),
  'warehouse definitions must survive local/server split serialization');
assert.ok(syncSplitMatch && /stockLocations:S\.stockLocations\|\|\[\]/.test(syncSplitMatch[0]),
  'stock-location definitions must survive local/server split serialization');
assert.ok(syncMergeMatch && /warehouses:Array\.isArray\(o\.warehouses\)\?o\.warehouses:\[\]/.test(syncMergeMatch[0]),
  'older server payloads must safely load without warehouse definitions');
assert.ok(syncMergeMatch && /stockLocations:Array\.isArray\(o\.stockLocations\)\?o\.stockLocations:\[\]/.test(syncMergeMatch[0]),
  'older server payloads must safely load without stock locations');
console.log('PASS sync regression: warehouse and stock-location data round-trip compatibly');
