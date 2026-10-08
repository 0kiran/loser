# kiran.wtf

A personal dashboard built with React, TypeScript, and the original local MS PGothic font. Hosted by Vercel from `main` in `0kiran/loser`.

The landing page combines a three-day BTC/USD chart, live followed Twitch channels, HLTV headlines, Spirit results, a SoundCloud profile player, the requested X video, and optional recent tweets/RSS. The previous birthday page remains at `/birthday`; `/list` still shows its guest list.

## Local development

Use Node 22 or newer. Dependencies are recorded in `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
npm run dev:feeds
```

In another terminal in this directory:

```sh
npm start
```

React runs at `http://localhost:3000` and proxies `/api/feed` to the local feed server on port 3100. The feed server reads `.env.local`. Without credentials, public feeds still run; account feeds show a connection status and a source link. It never substitutes sample prices, streams, matches, or tracks.

```sh
npm run build
npm run test:feeds
npm test -- --watchAll=false
```

## Connect the account feeds

Set server-only environment variables in Vercel → Project → Settings → Environment Variables, then redeploy. For local development set the same variables in `.env.local`. Never prefix secrets with `REACT_APP_`, which would expose them in browser JavaScript.

### Twitch: kkiran's following, visible to every visitor

Twitch requires **your** one-time authorization to read your followed streams. Visitors do not log in. The server checks that the authorized account is `kkiran` before returning public stream information.

1. [Register a Twitch app](https://dev.twitch.tv/docs/authentication/register-app/) and set its redirect URI to `http://localhost:3000` for the official CLI authorization flow.
2. Configure the [Twitch CLI](https://dev.twitch.tv/docs/cli/) with that app's client ID and secret. Stop the React dev server while authorizing, since the CLI needs port 3000.
3. Run `twitch token -u -s user:read:follows`, authorize as **kkiran**, and set the returned refresh token as `TWITCH_REFRESH_TOKEN`. Set `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `TWITCH_USER_LOGIN=kkiran` as well. Do not paste tokens into chat or commit them.
4. Connect an Upstash Redis database to Vercel and set its `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The server stores rotated OAuth tokens there so a cold start does not lose authorization. The names must match `.env.example`; map them manually if the integration provides different names.

Reference: [Get Followed Streams](https://dev.twitch.tv/docs/api/reference/#get-followed-streams), [CLI token command](https://dev.twitch.tv/docs/cli/token-command/).

The feed refreshes every minute, lists up to 100 followed channels currently live, and opens streams directly on Twitch. An empty successful response is shown as everyone offline; an authorization failure is shown separately. To reauthorize after revocation, delete `kiran:oauth:twitch` from Redis and replace the seed refresh token.

### SoundCloud profile embed

The official SoundCloud player embeds `https://soundcloud.com/k_kiran` directly. No SoundCloud API credentials, authorization, or token storage are needed. Autoplay is off, and a direct profile link is always available. A profile embed displays the profile's tracks; it does not automatically display liked songs.

Reference: [SoundCloud embed guide](https://soundcloud.com/pages/embed).

### Optional X posts and RSS

Set `X_BEARER_TOKEN` for an app with access to the user-posts endpoint under your X API plan. This populates the latest five original posts from `kkir4n` and enables:

```text
https://www.kiran.wtf/api/feed?source=tweets&format=rss
```

Without a token, the panel shows your profile link and the RSS subscription link stays hidden. The `perfectgrrl` video uses X's official embedded-post widget independently of this token. If X blocks an embed, the original post link remains available. Playback is controlled by X; the site does not download or rehost the video.

## Public feeds and caching

- **BTC:** Coinbase Exchange public hourly BTC/USD candles for the trailing 72 hours. Cache: five minutes. The chart labels prices in USD and supports inspecting points with the pointer.
- **HLTV:** `https://www.hltv.org/rss/news`, newest nine headlines. Cache: five minutes.
- **Spirit:** `https://www.hltv.org/results?team=7020`, newest six results, with duplicate featured matches removed. Cache: 15 minutes. HLTV may block requests from Vercel datacenters or change its HTML. The parser detects unusable results and the panel links to HLTV instead of showing invented scores.
- **X:** 15 minutes. **Twitch:** one minute. SoundCloud’s player loads directly from SoundCloud.

The API uses an allowlist of sources, not a general URL proxy. Secrets and tokens stay server-side. Feed requests have a ten-second upstream timeout. A warm function can retain the last successful response briefly when a source fails; these responses are explicitly labeled as cached with the original timestamp. This cache is best effort across serverless instances, rather than durable feed storage. Redis is used for rotating OAuth tokens, not for public feed history.

## Vercel

The repository root is the folder containing this README and `package.json`. `vercel.json` builds the React app into `build`, deploys `api/feed.mjs` as a Node function, and rewrites the two archived client routes. Server helpers live outside `api/` so they do not become extra endpoints.

Push the reviewed changes to the connected `main` branch to trigger the existing Vercel deployment. This implementation does not register a new site or change the domain configuration.

## Verification limits

The development agent's sandbox blocks outbound network sockets. The production build, TypeScript, parser/handler tests, and mocked UI behavior can be checked locally, but real provider responses, OAuth credentials, third-party embeds, and browser appearance must be checked from an unrestricted local session or Vercel preview. A successful build does not verify live feed availability.
