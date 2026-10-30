// npm run check:data -- validates the content tables (counts, cross-references, economy rules) and prints a table.
// Uses Vite's SSR loader so the '@/' alias and TypeScript resolve exactly as in the game. Exits non-zero on failure.
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

let exitCode = 0;
try {
  const mod = await server.ssrLoadModule('/src/data/validate.ts');
  const report = mod.validateData();
  const w = Math.max(...report.rows.map((r) => r.check.length));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('check', w)}  ${pad('expected', 12)}  ${pad('actual', 12)}  ok`);
  console.log('-'.repeat(w + 34));
  for (const r of report.rows) {
    const actual = r.actual.length > 60 ? `${r.actual.slice(0, 57)}...` : r.actual;
    console.log(`${pad(r.check, w)}  ${pad(r.expected, 12)}  ${pad(actual, 12)}  ${r.ok ? 'ok' : 'FAIL'}`);
  }
  console.log('');
  if (report.ok) {
    console.log(`check:data ok (${report.rows.length} checks)`);
  } else {
    console.error(`check:data FAILED (${report.errors.length}):`);
    for (const e of report.errors) console.error(`  - ${e}`);
    exitCode = 1;
  }
} catch (err) {
  console.error('check:data crashed:', err);
  exitCode = 1;
} finally {
  await server.close();
}
process.exit(exitCode);
