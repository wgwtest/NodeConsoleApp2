'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const allowedPackageFiles = new Set(['package.json', 'maps.json', 'asset-manifest.json']);

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeRelativeDirectory(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/u, '');
}

function isAllowedMapPackDirectory(targetDirectory) {
  const normalized = normalizeRelativeDirectory(targetDirectory);
  return normalized.startsWith('assets/map_packs/authoring/')
    || normalized.startsWith('assets/map_packs/current/');
}

async function writeLevelMapPackage(payload) {
  const targetDirectory = normalizeRelativeDirectory(payload?.targetDirectory);
  if (!targetDirectory || !isAllowedMapPackDirectory(targetDirectory)) {
    throw new Error('不允许写入该地图包目录。');
  }

  const files = Array.isArray(payload?.files) ? payload.files : [];
  const fileNames = files.map(file => file?.fileName).sort();
  const expectedNames = [...allowedPackageFiles].sort();
  if (JSON.stringify(fileNames) !== JSON.stringify(expectedNames)) {
    throw new Error('地图包必须包含 package.json、maps.json、asset-manifest.json。');
  }

  const directoryPath = path.resolve(rootDir, targetDirectory);
  const authoringRoot = path.resolve(rootDir, 'assets/map_packs/authoring');
  const currentRoot = path.resolve(rootDir, 'assets/map_packs/current');
  if (!directoryPath.startsWith(`${authoringRoot}${path.sep}`) && !directoryPath.startsWith(`${currentRoot}${path.sep}`)) {
    throw new Error('不允许写入该地图包目录。');
  }

  await fs.promises.mkdir(directoryPath, { recursive: true });
  const writtenFiles = [];
  for (const file of files) {
    const fileName = String(file.fileName || '');
    if (!allowedPackageFiles.has(fileName)) {
      throw new Error(`不允许写入文件：${fileName}`);
    }
    const filePath = path.join(directoryPath, fileName);
    await fs.promises.writeFile(filePath, String(file.content ?? ''), 'utf8');
    writtenFiles.push(fileName);
  }

  return {
    targetDirectory: targetDirectory.endsWith('/') ? targetDirectory : `${targetDirectory}/`,
    writtenFiles
  };
}

function createServer() {
  return http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    if (req.method === 'POST' && (urlPath === '/api/level-map-packs/save' || urlPath === '/api/level-map-packs/publish')) {
      try {
        const payload = await readJsonBody(req);
        const result = await writeLevelMapPackage(payload);
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const safePath = path.normalize(urlPath).replace(/^([/\\])+/, '');
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    tryFile(filePath, res);
  });
}

const server = createServer();

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Static server running at http://127.0.0.1:${port}/`);
  });
}

module.exports = {
  createServer,
  isAllowedMapPackDirectory,
  writeLevelMapPackage
};
