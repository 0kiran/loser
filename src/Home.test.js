import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home';

jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
let root;
let container;
let savedFetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  savedFetch = global.fetch;
  window.twttr = { widgets: { createTweet: jest.fn().mockResolvedValue(undefined) } };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = savedFetch;
  delete window.twttr;
});
const render = async () => act(async () => { root.render(<Home theme="light" toggleTheme={() => {}} />); });
test('keeps the dashboard and source links usable when providers fail', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network unavailable'));
  await render();
  expect(new URL(container.querySelector('iframe.soundcloud-profile').src).searchParams.get('url')).toBe('https://soundcloud.com/k_kiran');
  expect(container.querySelector('h1').textContent).toBe('JUST DIE');
  expect(container.querySelectorAll('section').length).toBe(7);
  expect(container.textContent).toContain('couldn’t reach this feed right now.');
  expect(container.querySelector('a[href="https://steamcommunity.com/id/kkiran"]')).not.toBeNull();
  expect(container.querySelector('a[href="https://x.com/kkir4n"]')).not.toBeNull();
  expect(container.querySelector('a[href="/api/feed?source=tweets&format=rss"]')).toBeNull();
  expect(container.querySelector('a[href="https://x.com/perfectgrrl/status/2105260366133403846?s=20"]')).not.toBeNull();
});
test('renders public feeds and players without a visitor login, and refreshes on demand', async () => {
  const payloads = {
    btc: { status: 'ok', points: [{ time: Date.now() - 7200000, price: 100 }, { time: Date.now(), price: 105 }] },
    twitch: { status: 'ok', items: [{ id: 'live1', name: 'Live channel', title: 'A stream', game: 'Counter-Strike', viewers: 42, url: 'https://www.twitch.tv/example' }] },
    news: { status: 'ok', items: [{ title: 'A headline', url: 'https://www.hltv.org/news/1/test' }] },
    spirit: { status: 'ok', items: [{ teams: ['Spirit', 'G2'], score: '2 - 1', won: true, url: 'https://www.hltv.org/matches/1/test' }] },
    tweets: { status: 'ok', items: [{ id: 'post1', text: 'A thought', url: 'https://x.com/kkir4n/status/1' }] },
  };
  global.fetch = jest.fn(async url => ({ ok: true, json: async () => payloads[new URL(url, 'https://www.kiran.wtf').searchParams.get('source')] }));
  await render();
  expect(container.textContent).toContain('Live channel');
  expect(container.textContent).toContain('A headline');
  expect(container.querySelector('.match-win').textContent).toBe('W');
  expect(container.querySelectorAll('iframe').length).toBe(1);
  expect(container.querySelector('svg[aria-label*="Bitcoin"]')).not.toBeNull();
  expect(container.querySelector('a[href="/api/feed?source=tweets&format=rss"]')).not.toBeNull();
  expect(container.querySelector('input[type="password"]')).toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(5);
  await act(async () => container.querySelector('.refresh-button').click());
  expect(global.fetch).toHaveBeenCalledTimes(10);
});
test('distinguishes all-offline Twitch from an unconnected account', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', items: [] }) });
  await render();
  expect(container.textContent).toContain('everyone’s offline. touch grass?');
  expect(container.textContent).not.toContain('this feed isn’t connected yet.');
});
