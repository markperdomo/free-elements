import http from 'node:http';
import https from 'node:https';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const secure = process.argv.includes('--https');
const port = Number(process.env.PORT || (secure ? 3443 : 4317));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8' };
export async function serve(request, response) {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const base = pathname.startsWith('/src/') ? path.join(root, 'src') : path.join(root, 'public');
    const relative = pathname.startsWith('/src/') ? pathname.slice(5) : pathname === '/' ? 'index.html' : pathname.slice(1);
    const candidate = path.resolve(base, relative);
    if (!candidate.startsWith(`${base}${path.sep}`)) throw new Error('Outside static root');
    const actual = await realpath(candidate);
    if (!actual.startsWith(`${base}${path.sep}`) || !types[path.extname(actual)]) throw new Error('Unsupported resource');
    const body = await readFile(actual);
    response.writeHead(200, { 'Content-Type': types[path.extname(actual)], 'Content-Length': body.length,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = secure ? https.createServer({ key: await readFile(path.join(root, '.certs/localhost.key')), cert: await readFile(path.join(root, '.certs/localhost.crt')) }, serve) : http.createServer(serve);
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Free Elements: ${secure ? 'https' : 'http'}://localhost:${port}${secure ? '/?host=powerpoint' : '/'}\nPress Ctrl+C to stop.`));
  } catch (error) { console.error(secure ? 'HTTPS certificate unavailable. Run npm run cert first. See docs/INSTALLATION.md for trust setup.' : error.message); process.exitCode = 1; }
}
