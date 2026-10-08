import { randomUUID } from 'node:crypto';
import { parseNews, parseResults, safeUrl } from './parsers.mjs';

export class NotConfigured extends Error {}
export function need(...names) {
  if (names.some(name => !process.env[name])) throw new NotConfigured('This feed is not connected yet.');
  return names.map(name => process.env[name]);
}
export async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json', 'User-Agent': 'kiran.wtf/1.0', ...options.headers } });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return response;
}
const json = async (url, options) => (await request(url, options)).json();

// Redis stores rotating OAuth tokens across Vercel instances. Never returned to clients.
async function redis(command) {
  const [url, token] = need('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  if (new URL(url).protocol !== 'https:') throw new Error('Redis requires HTTPS');
  const response = await json(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
  if (response.error) throw new Error('Token storage unavailable');
  return response.result;
}
const memoryTokens = new Map();
async function storedToken(service, create) {
  const key = `kiran:oauth:${service}`;
  const cached = memoryTokens.get(service);
  if (cached?.expiresAt > Date.now() + 60000) return cached;
  const stored = await redis(['GET', key]);
  const previous = stored ? JSON.parse(stored) : null;
  if (previous?.expiresAt > Date.now() + 60000) {
    memoryTokens.set(service, previous);
    return previous;
  }
  // A single refresher owns each single-use refresh token at a time.
  const lock = `${key}:lock`;
  const lockId = randomUUID();
  if (await redis(['SET', lock, lockId, 'NX', 'EX', '45']) !== 'OK') throw new Error('Token refresh in progress');
  try {
    // Re-read after acquiring the lock in case another instance just refreshed.
    const latestRaw = await redis(['GET', key]);
    const latest = latestRaw ? JSON.parse(latestRaw) : previous;
    if (latest?.expiresAt > Date.now() + 60000) return latest;
    const next = await create(latest);
    await redis(['SET', key, JSON.stringify(next)]);
    memoryTokens.set(service, next);
    return next;
  } finally {
    await redis(['EVAL', 'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end', '1', lock, lockId]);
  }
}

export async function btc() {
  const end = new Date();
  const start = new Date(end.getTime() - 72 * 3600000);
  const query = new URLSearchParams({ granularity: '3600', start: start.toISOString(), end: end.toISOString() });
  const candles = await json(`https://api.exchange.coinbase.com/products/BTC-USD/candles?${query}`);
  if (!Array.isArray(candles)) throw new Error('Invalid candle data');
  const points = candles.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[4]) && c[0] * 1000 >= start.getTime()).map(c => ({ time: c[0] * 1000, price: c[4] })).sort((a, b) => a.time - b.time);
  if (points.length < 2) throw new Error('Not enough candle data');
  return { points, currency: 'USD', interval: '1h', source: 'Coinbase' };
}
export async function news() {
  return parseNews(await (await request('https://www.hltv.org/rss/news', { headers: { Accept: 'application/rss+xml' } })).text());
}
export async function spirit() {
  // HLTV can block datacenter traffic; propagate an honest unavailable state.
  return parseResults(await (await request('https://www.hltv.org/results?team=7020', { headers: { Accept: 'text/html' } })).text());
}
export async function twitch() {
  const [clientId, secret, seed] = need('TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_REFRESH_TOKEN');
  const token = await storedToken('twitch', async previous => {
    const fresh = await json('https://id.twitch.tv/oauth2/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: previous?.refreshToken || seed, client_id: clientId, client_secret: secret }) });
    if (!fresh.access_token || !fresh.refresh_token) throw new Error('Invalid Twitch token');
    const validated = await json('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${fresh.access_token}` } });
    if (validated.login?.toLowerCase() !== (process.env.TWITCH_USER_LOGIN || 'kkiran').toLowerCase() || validated.client_id !== clientId || !validated.scopes?.includes('user:read:follows') || !validated.user_id) throw new Error('Twitch authorization missing required scope');
    return { accessToken: fresh.access_token, refreshToken: fresh.refresh_token, userId: validated.user_id, login: validated.login, expiresAt: Date.now() + Math.min(fresh.expires_in, 3600) * 1000 };
  });
  const response = await json(`https://api.twitch.tv/helix/streams/followed?user_id=${encodeURIComponent(token.userId)}&first=100`, { headers: { 'Client-Id': clientId, Authorization: `Bearer ${token.accessToken}` } });
  if (!Array.isArray(response.data)) throw new Error('Invalid Twitch data');
  return { login: token.login, items: response.data.map(stream => ({ id: stream.id, name: stream.user_name, title: stream.title, game: stream.game_name, viewers: stream.viewer_count, url: `https://www.twitch.tv/${encodeURIComponent(stream.user_login)}`, thumbnail: safeUrl(stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')) })) };
}
export async function tweets() {
  const [token] = need('X_BEARER_TOKEN');
  const headers = { Authorization: `Bearer ${token}` };
  const user = await json('https://api.x.com/2/users/by/username/kkir4n', { headers });
  if (!user.data?.id) throw new Error('X user unavailable');
  const result = await json(`https://api.x.com/2/users/${user.data.id}/tweets?max_results=5&tweet.fields=created_at&exclude=retweets,replies`, { headers });
  if (result.errors) throw new Error('X posts unavailable');
  return { items: (result.data || []).map(tweet => ({ id: tweet.id, text: tweet.text, date: tweet.created_at, url: `https://x.com/kkir4n/status/${tweet.id}` })) };
}
