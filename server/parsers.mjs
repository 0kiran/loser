import { parseDocument } from 'htmlparser2';
import { findAll, findOne, textContent } from 'domutils';

const byTag = name => node => node.type === 'tag' && node.name === name;
const byClass = name => node => node.type === 'tag' && (node.attribs?.class || '').split(/\s+/).includes(name);
const all = (root, predicate) => findAll(predicate, root.children || []);
const first = (root, predicate) => findOne(predicate, root.children || []);
const text = node => node ? textContent(node).replace(/\s+/g, ' ').trim() : '';
export function safeUrl(value, base, allowedHost) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && (!allowedHost || url.hostname === allowedHost) ? url.href : null;
  } catch { return null; }
}

export function parseNews(xml) {
  const root = parseDocument(xml, { xmlMode: true, decodeEntities: true });
  const items = all(root, byTag('item')).map(item => ({
    title: text(first(item, byTag('title'))),
    url: safeUrl(text(first(item, byTag('link'))), 'https://www.hltv.org', 'www.hltv.org'),
    date: text(first(item, byTag('pubDate'))),
  })).filter(item => item.title && item.url).slice(0, 9);
  if (!items.length) throw new Error('HLTV news feed unavailable');
  return { items };
}

export function parseResults(html) {
  const root = parseDocument(html);
  const seen = new Set();
  const items = all(root, byClass('result-con')).flatMap(row => {
    const url = safeUrl(first(row, n => byTag('a')(n) && /^\/matches\//.test(n.attribs?.href || ''))?.attribs.href, 'https://www.hltv.org', 'www.hltv.org');
    const teams = all(row, n => byTag('div')(n) && byClass('team')(n)).map(text);
    const score = text(first(row, byClass('result-score')));
    const scores = score.split(/\s*-\s*/).map(Number);
    const spiritIndex = teams.findIndex(name => /^spirit$/i.test(name));
    if (!url || seen.has(url) || teams.length !== 2 || spiritIndex < 0 || scores.length !== 2 || scores.some(n => !Number.isFinite(n))) return [];
    seen.add(url);
    const timestamp = Number(row.attribs?.['data-zonedgrouping-entry-unix']);
    return [{ url, teams, score, won: scores[spiritIndex] > scores[1 - spiritIndex], event: text(first(row, byClass('event-name'))), date: timestamp > 0 ? new Date(timestamp).toISOString() : null }];
  }).slice(0, 6);
  if (!items.length) throw new Error('HLTV results unavailable');
  return { items };
}

export const escapeXml = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export function tweetsRss(items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>kkir4n on X</title><link>https://x.com/kkir4n</link><description>Recent posts from kiran</description>${items.map(item => `<item><title>${escapeXml(item.text)}</title><description>${escapeXml(item.text)}</description><link>${escapeXml(item.url)}</link><guid isPermaLink="true">${escapeXml(item.url)}</guid>${item.date ? `<pubDate>${escapeXml(new Date(item.date).toUTCString())}</pubDate>` : ''}</item>`).join('')}</channel></rss>`;
}
