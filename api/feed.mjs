import * as providers from '../server/providers.mjs';
import { tweetsRss } from '../server/parsers.mjs';

const sources = { btc: providers.btc, news: providers.news, spirit: providers.spirit, twitch: providers.twitch, tweets: providers.tweets };
const cache = new Map();
const pending = new Map();
const staleLimits = { btc: 3600, news: 21600, spirit: 86400, twitch: 120, tweets: 21600 };
const lifetimes = { btc: 300, news: 300, spirit: 900, twitch: 60, tweets: 900 };
async function load(source) {
  const previous = cache.get(source);
  if (previous && Date.now() - previous.at < lifetimes[source] * 1000) return { status: 'ok', ...previous.data, updatedAt: new Date(previous.at).toISOString() };
  try {
    if (!pending.has(source)) pending.set(source, sources[source]());
    const data = await pending.get(source);
    const at = Date.now();
    cache.set(source, { data, at });
    return { status: 'ok', ...data, updatedAt: new Date(at).toISOString() };
  } catch (error) {
    if (previous && Date.now() - previous.at < staleLimits[source] * 1000) return { status: 'stale', ...previous.data, updatedAt: new Date(previous.at).toISOString() };
    return { status: error instanceof providers.NotConfigured ? 'unconfigured' : 'unavailable', items: [] };
  } finally { pending.delete(source); }
}
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const query = new URL(req.url, 'https://www.kiran.wtf').searchParams;
  const source = query.get('source');
  if (!Object.hasOwn(sources, source)) return res.status(400).json({ error: 'Unknown feed' });
  const result = await load(source);
  const ok = result.status === 'ok' || result.status === 'stale';
  res.setHeader('Cache-Control', ok ? `public, s-maxage=${lifetimes[source]}, stale-while-revalidate=60` : 'no-store');
  if (query.get('format') === 'rss' && source === 'tweets') {
    if (!ok) return res.status(503).json({ error: 'Tweet feed is not connected or is temporarily unavailable.' });
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.status(200).send(tweetsRss(result.items));
  }
  return res.status(200).json(result);
}
