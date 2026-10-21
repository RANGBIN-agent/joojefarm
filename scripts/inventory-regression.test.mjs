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
