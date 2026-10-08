import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNews, parseResults, tweetsRss, safeUrl } from './parsers.mjs';
import { btc } from './providers.mjs';
import handler from '../api/feed.mjs';

const fixture = `<rss><channel><item><title><![CDATA[Spirit win & celebrate]]></title><link>https://www.hltv.org/news/123/spirit-win</link><pubDate>Wed, 07 Oct 2026 12:00:00 GMT</pubDate></item><item><title>unsafe</title><link>javascript:alert(1)</link></item><item><title>wrong host</title><link>https://example.com/news/1</link></item></channel></rss>`;
test('RSS reads CDATA and dates, and rejects unsafe or offsite links', () => {
  assert.deepEqual(parseNews(fixture).items, [{ title: 'Spirit win & celebrate', url: 'https://www.hltv.org/news/123/spirit-win', date: 'Wed, 07 Oct 2026 12:00:00 GMT' }]);
  assert.equal(safeUrl(undefined, 'https://www.hltv.org'), null);
  assert.equal(safeUrl('http://example.com'), null);
  assert.throws(() => parseNews('<html>blocked</html>'));
});
const resultRow = (id, left, right, score) => `<div class="result-con" data-zonedgrouping-entry-unix="1791374400000"><a href="/matches/${id}/match"><div class="team">${left}</div><div class="result-score"><span>${score[0]}</span> - <span>${score[1]}</span></div><div class="team">${right}</div><span class="event-name">Test &amp; Cup</span></a></div>`;
test('Spirit results deduplicate featured rows and orient wins for either side', () => {
  const html = resultRow('1', 'Spirit', 'Vitality', [2, 1]) + resultRow('1', 'Spirit', 'Vitality', [2, 1]) + resultRow('2', 'G2', 'Spirit', [2, 0]) + resultRow('3', 'G2', 'NAVI', [2, 1]);
  const { items } = parseResults(html);
  assert.equal(items.length, 2);
  assert.equal(items[0].won, true);
  assert.equal(items[1].won, false);
  assert.deepEqual(items[1].teams, ['G2', 'Spirit']);
  assert.equal(items[0].event, 'Test & Cup');
  assert.throws(() => parseResults('<html>Cloudflare challenge</html>'));
});
test('RSS export escapes text and produces stable post URLs and dates', () => {
  const xml = tweetsRss([{ text: '<script>"hello" & goodbye</script>', url: 'https://x.com/kkir4n/status/123', date: '2026-10-07T12:00:00Z' }]);
  assert.ok(!xml.includes('<script>'));
  assert.ok(xml.includes('&lt;script&gt;&quot;hello&quot; &amp; goodbye&lt;/script&gt;'));
  assert.ok(xml.includes('<pubDate>Wed, 07 Oct 2026 12:00:00 GMT</pubDate>'));
});
test('BTC requests a 72-hour window and sorts valid hourly closes chronologically', async () => {
  const original = globalThis.fetch;
  const now = Date.now();
  globalThis.fetch = async url => {
    const query = new URL(url).searchParams;
    assert.equal(query.get('granularity'), '3600');
    assert.equal(Date.parse(query.get('end')) - Date.parse(query.get('start')), 72 * 3600000);
    return new Response(JSON.stringify([[Math.floor(now / 1000), 0, 0, 0, 200], [Math.floor((now - 3600000) / 1000), 0, 0, 0, 100], [Math.floor((now - 100 * 3600000) / 1000), 0, 0, 0, 50], ['bad', 0, 0, 0, 'bad']]));
  };
  try { assert.deepEqual((await btc()).points.map(p => p.price), [100, 200]); }
  finally { globalThis.fetch = original; }
});
async function call(url, method = 'GET') {
  const result = { headers: {} };
  const response = { setHeader(k, v) { result.headers[k] = v; }, status(code) { result.code = code; return this; }, json(body) { result.body = body; }, send(body) { result.body = body; } };
  await handler({ method, url }, response);
  return result;
}
test('public API rejects unknown sources and mutations', async () => {
  assert.equal((await call('/api/feed?source=constructor')).code, 400);
  assert.equal((await call('/api/feed?source=https://example.com')).code, 400);
  const mutation = await call('/api/feed?source=btc', 'POST');
  assert.equal(mutation.code, 405);
  assert.equal(mutation.headers.Allow, 'GET');
});
test('unconfigured Twitch is distinguished from offline, with no credentials in response', async () => {
  const previous = process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_ID;
  try {
    const response = await call('/api/feed?source=twitch');
    assert.equal(response.body.status, 'unconfigured');
    assert.deepEqual(response.body.items, []);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.ok(!JSON.stringify(response.body).includes('TOKEN'));
  } finally { if (previous !== undefined) process.env.TWITCH_CLIENT_ID = previous; }
});
test('unavailable tweet RSS returns 503 instead of a misleading empty feed', async () => {
  const previous = process.env.X_BEARER_TOKEN;
  delete process.env.X_BEARER_TOKEN;
  try { assert.equal((await call('/api/feed?source=tweets&format=rss')).code, 503); }
  finally { if (previous !== undefined) process.env.X_BEARER_TOKEN = previous; }
});
test('provider errors produce an unavailable state, rather than invented results', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('blocked', { status: 403 });
  try {
    const response = await call('/api/feed?source=spirit');
    assert.equal(response.body.status, 'unavailable');
    assert.deepEqual(response.body.items, []);
  } finally { globalThis.fetch = original; }
});

test('Twitch authorization stays server-side and is reused across requests', async () => {
  const originalFetch = globalThis.fetch;
  const env = { TWITCH_CLIENT_ID: 'test-client', TWITCH_CLIENT_SECRET: 'test-secret', TWITCH_REFRESH_TOKEN: 'seed-refresh', TWITCH_USER_LOGIN: 'kkiran', UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'redis-secret' };
  const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const storage = new Map();
  let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (url === env.UPSTASH_REDIS_REST_URL) {
      assert.equal(options.headers.Authorization, 'Bearer redis-secret');
      const [command, key, value] = JSON.parse(options.body);
      let result;
      if (command === 'GET') result = storage.get(key) || null;
      else if (command === 'SET') { storage.set(key, value); result = 'OK'; }
      else if (command === 'EVAL') result = 1;
      return new Response(JSON.stringify({ result }));
    }
    if (url === 'https://id.twitch.tv/oauth2/token') {
      refreshes++;
      assert.equal(options.body.get('refresh_token'), 'seed-refresh');
      return new Response(JSON.stringify({ access_token: 'private-access', refresh_token: 'rotated-refresh', expires_in: 14400 }));
    }
    if (url === 'https://id.twitch.tv/oauth2/validate') return new Response(JSON.stringify({ client_id: 'test-client', user_id: '123', login: 'kkiran', scopes: ['user:read:follows'] }));
    assert.ok(url.includes('/helix/streams/followed?user_id=123'));
    assert.equal(options.headers.Authorization, 'Bearer private-access');
    return new Response(JSON.stringify({ data: [{ id: 'stream1', user_name: 'Streamer', user_login: 'streamer', title: 'Live now', game_name: 'CS2', viewer_count: 123, thumbnail_url: 'https://static-cdn.jtvnw.net/test-{width}x{height}.jpg' }] }));
  };
  try {
    const { twitch } = await import('./providers.mjs');
    const result = await twitch();
    await twitch();
    assert.equal(refreshes, 1);
    assert.equal(result.login, 'kkiran');
    assert.equal(result.items[0].url, 'https://www.twitch.tv/streamer');
    assert.ok(result.items[0].thumbnail.includes('320x180'));
    assert.ok(!JSON.stringify(result).includes('private-access'));
    const persisted = JSON.parse(storage.get('kiran:oauth:twitch'));
    assert.equal(persisted.refreshToken, 'rotated-refresh');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

