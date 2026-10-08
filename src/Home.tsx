import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactSwitch from 'react-switch';
import './dashboard.css';

type FeedStatus = 'loading' | 'ok' | 'stale' | 'unconfigured' | 'unavailable';
type Item = { id?: string; title?: string; text?: string; url: string; date?: string; teams?: string[]; score?: string; won?: boolean; event?: string; name?: string; game?: string; viewers?: number; thumbnail?: string; artist?: string };
type Point = { time: number; price: number };
type Feed = { status: FeedStatus; items: Item[]; points?: Point[]; updatedAt?: string; login?: string };
const blank: Feed = { status: 'loading', items: [] };
const sources = ['btc', 'twitch', 'news', 'spirit', 'tweets'] as const;
type Source = typeof sources[number];
const links = {
  btc: 'https://www.coinbase.com/price/bitcoin', twitch: 'https://www.twitch.tv/kkiran',
  news: 'https://www.hltv.org', spirit: 'https://www.hltv.org/results?team=7020',
  soundcloud: 'https://soundcloud.com/k_kiran', tweets: 'https://x.com/kkir4n',
};
function useFeeds() {
  const [feeds, setFeeds] = useState<Record<Source, Feed>>(() => Object.fromEntries(sources.map(source => [source, blank])) as Record<Source, Feed>);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      sources.forEach(async source => {
        try {
          const response = await fetch(`/api/feed?source=${source}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Feed unavailable');
          const data: Feed = await response.json();
          if (!['ok', 'stale', 'unconfigured', 'unavailable'].includes(data.status) || !Array.isArray(data.items || [])) throw new Error('Invalid feed');
          if (!controller.signal.aborted) setFeeds(previous => ({ ...previous, [source]: { ...data, items: data.items || [] } }));
        } catch {
          if (!controller.signal.aborted) setFeeds(previous => ({ ...previous, [source]: previous[source].status === 'ok' || previous[source].status === 'stale' ? { ...previous[source], status: 'stale' } : { status: 'unavailable', items: [] } }));
        }
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshKey]);
  return { feeds, refresh: () => setRefreshKey(key => key + 1) };
}
const External: React.FC<{ href: string; children: React.ReactNode; className?: string }> = ({ href, children, className }) => <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
function relative(date?: string) {
  if (!date || !Number.isFinite(Date.parse(date))) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
function FeedNote({ feed }: { feed: Feed }) {
  return <span className={`feed-note ${feed.status === 'stale' ? 'is-stale' : ''}`}>{feed.status === 'stale' ? 'cached · ' : ''}{feed.updatedAt ? `checked ${relative(feed.updatedAt)}` : ''}</span>;
}
function EmptyFeed({ feed, source }: { feed: Feed; source: Source }) {
  return <div className="empty-feed" role="status"><span className="empty-symbol">{feed.status === 'loading' ? '⋯' : '↗'}</span><p>{feed.status === 'loading' ? 'tuning in…' : feed.status === 'unconfigured' ? 'this feed isn’t connected yet.' : 'couldn’t reach this feed right now.'}</p>{feed.status !== 'loading' && <External href={links[source]}>open {source === 'news' ? 'HLTV' : source === 'tweets' ? 'X' : source === 'spirit' ? 'Spirit results' : source} ↗</External>}</div>;
}
function Panel({ number, title, href, className = '', children, label }: { number: string; title: string; href: string; className?: string; children: React.ReactNode; label?: React.ReactNode }) {
  return <section className={`desk-panel ${className}`} aria-label={title}><header className="panel-heading"><h2><span className="panel-number">{number}</span>{title}</h2><span className="panel-label">{label}</span><External href={href} className="panel-out" >↗<span className="sr-only">Open {title}</span></External></header>{children}</section>;
}
const dollars = (value: number, decimals = 0) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals });
function Bitcoin({ feed }: { feed: Feed }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = feed.points || [];
  if (!points.length) return <EmptyFeed feed={feed} source="btc" />;
  const first = points[0];
  const last = points[points.length - 1];
  const selected = points[Math.min(hover ?? points.length - 1, points.length - 1)];
  const change = (last.price / first.price - 1) * 100;
  const min = Math.min(...points.map(p => p.price));
  const max = Math.max(...points.map(p => p.price));
  const range = max - min || max * 0.01 || 1;
  const x = (point: Point) => 14 + (point.time - first.time) / Math.max(1, last.time - first.time) * 652;
  const y = (price: number) => 190 - (price - min) / range * 150;
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${x(point)},${y(point.price)}`).join(' ');
  return <div className="btc-body"><div className="btc-summary"><div><span className="eyebrow">BITCOIN / USD</span><div className="btc-price">{dollars(selected.price, 2)}</div></div><div className="btc-change"><span className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span><small>over 72 hours</small></div></div><svg className="btc-chart" viewBox="0 0 760 230" role="img" aria-label={`Bitcoin over the last 72 hours, from ${dollars(first.price)} to ${dollars(last.price)}. One hour closing prices.`} onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const position = ((event.clientX - rect.left) / rect.width * 760 - 14) / 652; const targetTime = first.time + Math.max(0, Math.min(1, position)) * (last.time - first.time); setHover(points.reduce((best, point, index) => Math.abs(point.time - targetTime) < Math.abs(points[best].time - targetTime) ? index : best, 0)); }} onPointerLeave={() => setHover(null)}>
    <defs><linearGradient id="btc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".14" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    {[0, .5, 1].map(step => <g key={step}><line x1="14" x2="666" y1={y(min + range * step)} y2={y(min + range * step)} className="chart-grid" /><text x="680" y={y(min + range * step) + 4} className="chart-label">{dollars(min + range * step)}</text></g>)}
    <path d={`${path} L${x(last)},205 L14,205 Z`} fill="url(#btc-fill)" /><path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    <line x1={x(selected)} x2={x(selected)} y1="24" y2="205" className="chart-cursor" /><circle cx={x(selected)} cy={y(selected.price)} r="4" fill="currentColor" />
    {[first, points[Math.floor(points.length / 2)], last].map((p, i) => <text key={i} x={x(p)} y="225" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="chart-label">{new Date(p.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</text>)}
  </svg><div className="panel-bottom"><span>Coinbase · hourly close · USD</span><FeedNote feed={feed} /></div></div>;
}

type Twitter = { widgets: { createTweet: (id: string, element: HTMLElement, options: Record<string, unknown>) => Promise<HTMLElement | undefined> } };
declare global { interface Window { twttr?: Twitter } }
let twitterReady: Promise<Twitter> | undefined;
function loadTwitter() {
  if (window.twttr?.widgets) return Promise.resolve(window.twttr);
  if (!twitterReady) twitterReady = new Promise<Twitter>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js'; script.async = true;
    const timer = window.setTimeout(() => reject(new Error('Embed timed out')), 15000);
    script.onload = () => { window.clearTimeout(timer); if (window.twttr?.widgets) resolve(window.twttr); else reject(new Error('Embed unavailable')); };
    script.onerror = () => { window.clearTimeout(timer); reject(new Error('Embed unavailable')); };
    document.head.appendChild(script);
  });
  return twitterReady;
}
function Video({ theme }: { theme: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    const target = document.createElement('div');
    ref.current?.replaceChildren(target);
    setStatus('loading');
    loadTwitter().then(twitter => {
      if (cancelled) return;
      return twitter.widgets.createTweet('2105260366133403846', target, { theme, dnt: true, conversation: 'none', align: 'center', width: 360 });
    }).then(element => { if (!cancelled) setStatus(element ? 'ok' : 'unavailable'); }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; };
  }, [theme]);
  return <div className="video-body"><div ref={ref} />{status !== 'ok' && <div className="video-fallback" role="status"><span className="video-play">▷</span><p>{status === 'loading' ? 'loading video…' : 'this post couldn’t be embedded.'}</p><span>@perfectgrrl</span></div>}<External href="https://x.com/perfectgrrl/status/2105260366133403846?s=20" className="video-source">watch the original on X ↗</External></div>;
}

const Home: React.FC<{ theme: string; toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
  const { feeds, refresh } = useFeeds();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(interval); }, []);
  const available = (feed: Feed) => feed.status === 'ok' || feed.status === 'stale';
  return <div className="dashboard" id={theme}>
    <div className="desk-shell">
      <header className="site-heading"><Link to="/" className="site-name">ｋｉｒａｎ . wtf</Link><span className="site-caption">a few tabs i never close.</span><div className="theme-control"><span>{theme === 'light' ? 'ʕ´• ᴥ•̥`ʔ' : '(っ´ω｀c)'}</span><ReactSwitch onChange={toggleTheme} checked={theme === 'dark'} onColor="#888" offColor="#000" checkedIcon={false} uncheckedIcon={false} height={18} width={36} handleDiameter={14} aria-label="Toggle dark mode" /></div></header>
      <div className="masthead"><h1>JUST DIE</h1><div className="masthead-side"><span>personal internet<br />headquarters / est. 2025</span><span>too many tabs.<br />not enough time.</span><span className="masthead-face">(×_×)</span></div></div>
      <div className="utility-bar"><span className="clock"><span className="status-dot" />{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} / {now.toLocaleTimeString([], { hour12: false })}</span><nav aria-label="My links"><External href="https://steamcommunity.com/id/kkiran">steam ↗</External><External href="https://x.com/kkir4n">twitter ↗</External><External href="https://soundcloud.com/k_kiran">soundcloud ↗</External></nav><button className="refresh-button" onClick={refresh}>↻ refresh feeds</button></div>
      <main className="desk-grid">
        <Panel number="01" title="the line goes up?" href={links.btc} className="bitcoin-panel" label="BTC / 72H"><Bitcoin feed={feeds.btc} /></Panel>
        <Panel number="02" title="who’s live" href={links.twitch} className="twitch-panel" label={<><span className="live-dot" />TWITCH</>}>
          {available(feeds.twitch) ? <><div className="twitch-intro">{feeds.twitch.items.length} live from my following <FeedNote feed={feeds.twitch} /></div>{feeds.twitch.items.length ? <ul className="stream-list">{feeds.twitch.items.map(item => <li key={item.id}><External href={item.url} className="stream-link">{item.thumbnail && <img src={item.thumbnail} alt="" loading="lazy" />}<div className="stream-copy"><div><strong>{item.name}</strong><span className="live-badge">LIVE</span></div><p>{item.title}</p><small>{item.game || 'Just chatting'} · {item.viewers?.toLocaleString()} viewers</small></div></External></li>)}</ul> : <div className="empty-feed"><span className="empty-symbol">(-_-) zZ</span><p>everyone’s offline. touch grass?</p></div>}</> : <EmptyFeed feed={feeds.twitch} source="twitch" />}
          <div className="panel-bottom"><External href={links.twitch}>open Twitch ↗</External><span>refreshes every minute</span></div>
        </Panel>
        <Panel number="03" title="counter-strike wire" href={links.news} className="news-panel" label="HLTV">
          {available(feeds.news) ? <><ol className="news-list">{feeds.news.items.map((item, i) => <li key={item.url}><span className="story-number">{String(i + 1).padStart(2, '0')}</span><div><External href={item.url}>{item.title}</External><small>{relative(item.date)}</small></div></li>)}</ol><div className="panel-bottom"><span>latest headlines</span><FeedNote feed={feeds.news} /></div></> : <EmptyFeed feed={feeds.news} source="news" />}
        </Panel>
        <Panel number="04" title="spirit watch" href={links.spirit} className="spirit-panel" label="CS2">
          <div className="spirit-banner"><span className="spirit-mark" aria-hidden="true">龍</span><div><strong>TEAM SPIRIT</strong><span>recent results / ride or die</span></div></div>
          {available(feeds.spirit) ? <><ul className="results-list">{feeds.spirit.items.map(item => <li key={item.url}><External href={item.url}><div className="match-meta"><span>{item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'recent'}</span><span>{item.event}</span></div><div className="match-score"><span>{item.teams?.[0]}</span><strong>{item.score}</strong><span>{item.teams?.[1]}</span><b className={item.won ? 'match-win' : 'match-loss'}>{item.won ? 'W' : 'L'}</b></div></External></li>)}</ul><div className="panel-bottom"><span>via HLTV</span><FeedNote feed={feeds.spirit} /></div></> : <EmptyFeed feed={feeds.spirit} source="spirit" />}
        </Panel>
        <Panel number="05" title="in heavy rotation" href={links.soundcloud} className="music-panel" label="SOUNDCLOUD">
          <p className="panel-intro">my corner of SoundCloud. sound on.</p>
          <iframe
            className="soundcloud-profile"
            title="k_kiran on SoundCloud"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(links.soundcloud)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false&color=%23888888`}
            height="450"
            width="100%"
            allow="autoplay"
            loading="lazy"
          />
          <div className="panel-bottom"><span>k_kiran / SoundCloud</span><External href={links.soundcloud}>open profile ↗</External></div>
        </Panel>
        <Panel number="06" title="required viewing" href="https://x.com/perfectgrrl/status/2105260366133403846?s=20" className="video-panel" label="@PERFECTGRRL"><Video theme={theme} /></Panel>
        <Panel number="07" title="posting into the void" href={links.tweets} className="tweets-panel" label="@KKIR4N">
          {available(feeds.tweets) ? <><ul className="tweets-list">{feeds.tweets.items.map(item => <li key={item.id}><div className="tweet-byline"><strong>kiran</strong><span>@kkir4n · {relative(item.date)}</span></div><External href={item.url}>{item.text}</External></li>)}</ul>{!feeds.tweets.items.length && <p className="empty-feed">nothing posted yet.</p>}<div className="panel-bottom"><a href="/api/feed?source=tweets&format=rss">subscribe via RSS ↗</a><FeedNote feed={feeds.tweets} /></div></> : <div className="tweet-profile"><div className="profile-glyph">k.</div><strong>ｋｉｒａｎ</strong><span>@kkir4n</span><p>{feeds.tweets.status === 'loading' ? 'checking for posts…' : feeds.tweets.status === 'unconfigured' ? 'thoughts, occasionally.' : 'posts are unavailable right now.'}</p><External href={links.tweets}>read my posts on X ↗</External></div>}
          <div className="elsewhere"><span className="eyebrow">ALSO FIND ME ON</span><External href="https://steamcommunity.com/id/kkiran"><span>steam</span><span>/ kkiran ↗</span></External><External href="https://soundcloud.com/k_kiran"><span>soundcloud</span><span>/ k_kiran ↗</span></External></div>
        </Panel>
      </main>
      <footer className="desk-footer"><span>ｋｉｒａｎ . wtf <span className="footer-face">(っ´ω｀c)</span></span><span>feeds update while you’re here. go click something.</span><Link to="/birthday">the birthday archive ↗</Link></footer>
    </div>
  </div>;
};
export default Home;
