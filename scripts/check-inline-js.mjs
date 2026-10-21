import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)]
  .map(match => match[1])
  .filter(source => source.trim().length > 0);

if (blocks.length === 0) {
  console.error('No inline JavaScript blocks found in index.html');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'gelehyar-js-check-'));
try {
  for (let i = 0; i < blocks.length; i++) {
    const file = join(dir, `inline-${i + 1}.js`);
    writeFileSync(file, blocks[i], 'utf8');
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`Syntax error in inline script ${i + 1}:`);
      process.stderr.write(result.stderr || result.stdout || 'node --check failed\n');
      process.exit(1);
    }
    console.log(`PASS inline script ${i + 1}`);
  }
  console.log(`Validated ${blocks.length} inline JavaScript block(s).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
