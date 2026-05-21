'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const skillEditorFileRoute = '/__skill_editor_file';
const allowedJsonWriteRoots = [
  'assets/data/',
  'DOC/CODEX_DOC/'
];

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon']
]);

function getContentType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body, null, 2));
}

function normalizeProjectJsonPath(inputPath) {
  const raw = String(inputPath || '').trim().replace(/\\/g, '/');
  if (!raw) throw new Error('缺少文件路径');
  if (path.isAbsolute(raw) || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error('只允许项目内相对路径');
  }
  if (!raw.endsWith('.json')) {
    throw new Error('只允许读写 .json 文件');
  }

  const normalized = path.posix.normalize(raw).replace(/^\/+/, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('路径不能跳出项目目录');
  }
  if (!allowedJsonWriteRoots.some(prefix => normalized.startsWith(prefix))) {
    throw new Error(`只允许写入：${allowedJsonWriteRoots.join(', ')}`);
  }

  const absolutePath = path.resolve(rootDir, normalized);
  const relativeToRoot = path.relative(rootDir, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('路径不能跳出项目目录');
  }
  return { normalized, absolutePath };
}

function readRequestBody(req, maxBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleSkillEditorFile(req, res, url) {
  try {
    if (req.method === 'GET') {
      const { normalized, absolutePath } = normalizeProjectJsonPath(url.searchParams.get('path'));
      if (url.searchParams.get('list') === '1') {
        const dir = path.dirname(absolutePath);
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = entries
          .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
          .map(entry => {
            const abs = path.join(dir, entry.name);
            return path.relative(rootDir, abs).replace(/\\/g, '/');
          })
          .filter(filePath => allowedJsonWriteRoots.some(prefix => filePath.startsWith(prefix)))
          .sort((a, b) => a.localeCompare(b));
        sendJson(res, 200, {
          ok: true,
          path: normalized,
          directory: path.dirname(normalized).replace(/\\/g, '/'),
          files
        });
        return;
      }
      const content = await fs.promises.readFile(absolutePath, 'utf8');
      JSON.parse(content);
      sendJson(res, 200, {
        ok: true,
        path: normalized,
        content
      });
      return;
    }

    if (req.method === 'POST') {
      const bodyText = await readRequestBody(req);
      const body = JSON.parse(bodyText || '{}');
      const { normalized, absolutePath } = normalizeProjectJsonPath(body.path);
      const content = String(body.content || '');
      JSON.parse(content);
      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
      const stat = await fs.promises.stat(absolutePath);
      sendJson(res, 200, {
        ok: true,
        path: normalized,
        bytes: stat.size
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    sendJson(res, 400, {
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function tryFile(filePath, res) {
  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr, indexStat) => {
        if (indexErr || !indexStat.isFile()) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Forbidden');
          return;
        }

        res.writeHead(200, { 'Content-Type': getContentType(indexPath) });
        fs.createReadStream(indexPath).pipe(res);
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (parsedUrl.pathname === skillEditorFileRoute) {
    handleSkillEditorFile(req, res, parsedUrl);
    return;
  }

  const urlPath = decodeURIComponent(parsedUrl.pathname);
  const safePath = path.normalize(urlPath).replace(/^([/\\])+/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  tryFile(filePath, res);
});

server.listen(port, () => {
  console.log(`Static server running at http://127.0.0.1:${port}/`);
});
