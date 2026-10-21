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
