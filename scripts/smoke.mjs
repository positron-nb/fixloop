#!/usr/bin/env node
/**
 * Production smoke test. Read-only: it never creates data.
 *   SMOKE_URL=https://main.xxxx.amplifyapp.com node scripts/smoke.mjs
 * Checks that the site and SPA deep links load over HTTPS, PWA files are served,
 * HSTS is set, and the AppSync API REFUSES unauthenticated or forged requests.
 */
import { readFileSync } from 'node:fs';

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Usage: SMOKE_URL=https://<your-app> node scripts/smoke.mjs');
  process.exit(1);
}

let outputs = null;
try {
  outputs = JSON.parse(readFileSync(new URL('../amplify_outputs.json', import.meta.url), 'utf8'));
} catch {
  /* API checks are skipped without outputs */
}

const results = [];
async function check(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t, error: e.message });
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

await check('home page loads over HTTPS', async () => {
  const r = await fetch(`${base}/`);
  expect(r.status === 200, `status ${r.status}`);
  const html = await r.text();
  expect(html.includes('<div id="root">'), 'app shell missing');
  expect(html.includes('FixLoop'), 'title missing');
});

await check('QR deep link /a/<code> served by the SPA rewrite', async () => {
  const r = await fetch(`${base}/a/DEMO-H4-WC-01`);
  expect(r.status === 200, `status ${r.status} (add the Amplify rewrite /<*> -> /index.html)`);
  expect((await r.text()).includes('<div id="root">'), 'not the app shell');
});

await check('PWA manifest and service worker served', async () => {
  const m = await fetch(`${base}/manifest.webmanifest`);
  expect(m.status === 200, `manifest ${m.status}`);
  const sw = await fetch(`${base}/sw.js`);
  expect(sw.status === 200, `sw ${sw.status}`);
});

await check('HSTS header present', async () => {
  const r = await fetch(`${base}/`);
  expect(!!r.headers.get('strict-transport-security'), 'missing Strict-Transport-Security');
});

if (outputs?.data?.url) {
  const gql = (query, headers = {}) =>
    fetch(outputs.data.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ query }),
    });
  const refused = async (r) => {
    if (r.status === 401 || r.status === 403) return true;
    const body = await r.json().catch(() => ({}));
    return Array.isArray(body.errors) && body.errors.length > 0;
  };

  await check('API rejects unauthenticated issue listing', async () => {
    expect(await refused(await gql('{ listIssues { items { id } } }')), 'request was NOT refused');
  });
  await check('API rejects unauthenticated reportIssue', async () => {
    expect(await refused(await gql('mutation { reportIssue(assetId: "DEMO-H4-WC-01", issueType: "NO_WATER") }')), 'request was NOT refused');
  });
  await check('API rejects a forged token', async () => {
    expect(await refused(await gql('{ listIssues { items { id } } }', { authorization: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged' })), 'request was NOT refused');
  });
} else {
  console.warn('amplify_outputs.json missing: API checks skipped');
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.ms} ms)${r.ok ? '' : `  -> ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
