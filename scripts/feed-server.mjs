import { createServer } from 'node:http';
import handler from '../api/feed.mjs';

createServer(async (req, response) => {
  const url = new URL(req.url, 'http://localhost:3100');
  if (url.pathname !== '/api/feed') { response.writeHead(404); response.end('Not found'); return; }
  const res = {
    setHeader: (name, value) => response.setHeader(name, value),
    status(code) { response.statusCode = code; return this; },
    json(value) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); },
    send(value) { response.end(value); },
  };
  try { await handler(req, res); }
  catch { response.statusCode = 500; res.json({ error: 'Feed unavailable' }); }
}).listen(3100, '127.0.0.1', () => console.log('Feed API: http://127.0.0.1:3100 (leave running alongside npm start)'));
