'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const requiredPackageFiles = ['package.json', 'maps.json', 'asset-manifest.json'];
const allowedPackageFiles = new Set([...requiredPackageFiles, 'levels.json']);
const skillEditorFileRoute = '/__skill_editor_file';
const allowedJsonWriteRoots = [
  'assets/data/',
  'assets/skill_packs/authoring/',
  'assets/enemy_packs/authoring/',
  'DOC/CODEX_DOC/'
];
const skillAuthoringRoot = 'assets/skill_packs/authoring/';
const skillPackKindConfigs = Object.freeze({
  player: {
    kind: 'player',
    runtimePath: 'assets/data/skills_melee_v4_5.json',
    authoringPrefixes: ['skills_melee']
  },
  enemy: {
    kind: 'enemy',
    runtimePath: 'assets/data/skills_enemy_v1.json',
    authoringPrefixes: ['skills_enemy']
  }
});
const runtimeSkillPackPath = skillPackKindConfigs.player.runtimePath;

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

function normalizeRelativePath(value) {
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
  const fileNames = files.map(file => file?.fileName);
  const fileNameSet = new Set(fileNames);
  if (fileNames.length !== fileNameSet.size) {
    throw new Error('地图包文件名不能重复。');
  }
  if (!requiredPackageFiles.every(fileName => fileNameSet.has(fileName))) {
    throw new Error('地图包必须包含 package.json、maps.json、asset-manifest.json。');
  }
  const invalidFileName = fileNames.find(fileName => !allowedPackageFiles.has(fileName));
  if (invalidFileName) {
    throw new Error(`不允许写入文件：${invalidFileName}`);
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

function normalizeSkillPackKind(kind) {
  const normalized = String(kind || 'player').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(skillPackKindConfigs, normalized)) {
    throw new Error(`未知技能包类型：${kind}`);
  }
  return normalized;
}

function getSkillPackKindConfig(kind) {
  return skillPackKindConfigs[normalizeSkillPackKind(kind)];
}

function isSkillPackPathForKind(filePath, kindConfig) {
  const fileName = path.posix.basename(filePath);
  if (filePath === kindConfig.runtimePath) return true;
  if (!filePath.startsWith(skillAuthoringRoot)) return false;
  return kindConfig.authoringPrefixes.some(prefix => fileName.startsWith(prefix));
}

function normalizeSkillPackPath(inputPath, { mode = 'authoring', kind = 'player' } = {}) {
  const kindConfig = getSkillPackKindConfig(kind);
  const raw = normalizeRelativePath(inputPath);
  if (!raw) throw new Error('缺少技能包路径。');
  if (path.isAbsolute(raw) || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error('只允许项目内相对路径。');
  }
  if (!raw.endsWith('.json')) {
    throw new Error('技能包必须是 .json 文件。');
  }
  const normalized = path.posix.normalize(raw).replace(/^\/+/u, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('路径不能跳出项目目录。');
  }
  if (mode === 'runtime') {
    if (normalized !== kindConfig.runtimePath) {
      throw new Error(`发布目标只能是 ${kindConfig.runtimePath}。`);
    }
  } else if (!normalized.startsWith(skillAuthoringRoot)) {
    throw new Error(`保存工作稿只能写入 ${skillAuthoringRoot}。`);
  } else if (!isSkillPackPathForKind(normalized, kindConfig)) {
    throw new Error(`技能包类型 ${kindConfig.kind} 只能保存到匹配的工作稿文件。`);
  }
  return normalized;
}

function parseSkillPackContent(content) {
  const text = String(content ?? '');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.skills)) {
    throw new Error('技能包必须包含 skills 数组。');
  }
  return { parsed, text };
}

async function writeSkillPackFile(payload, { mode = 'authoring' } = {}) {
  const kind = normalizeSkillPackKind(payload?.kind || 'player');
  const kindConfig = getSkillPackKindConfig(kind);
  const targetPath = normalizeSkillPackPath(
    mode === 'runtime' ? (payload?.targetPath || kindConfig.runtimePath) : payload?.targetPath,
    { mode, kind }
  );
  const { text } = parseSkillPackContent(payload?.content);
  const absolutePath = path.resolve(rootDir, targetPath);
  const relativeToRoot = path.relative(rootDir, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('路径不能跳出项目目录。');
  }
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  const stat = await fs.promises.stat(absolutePath);
  return {
    targetPath,
    bytes: stat.size
  };
}

async function collectSkillJsonFiles(directory) {
  const root = path.resolve(rootDir, directory);
  const files = [];
  async function visit(currentDir) {
    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/^skills.*\.json$/iu.test(entry.name)) continue;
      try {
        const stat = await fs.promises.stat(absolutePath);
        files.push({
          path: path.relative(rootDir, absolutePath).replace(/\\/g, '/'),
          bytes: stat.size,
          mtimeMs: stat.mtimeMs
        });
      } catch {
        // Ignore files that disappear while listing.
      }
    }
  }
  await visit(root);
  return files;
}

async function listRecentSkillJsonFiles(limit = 20, kind = 'player') {
  const kindConfig = getSkillPackKindConfig(kind);
  const allFiles = [
    ...(await collectSkillJsonFiles(skillAuthoringRoot)),
    ...(await collectSkillJsonFiles('assets/data/'))
  ];
  const seen = new Set();
  return allFiles
    .filter(file => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return isSkillPackPathForKind(file.path, kindConfig);
    })
    .sort((a, b) => {
      const delta = Number(b.mtimeMs || 0) - Number(a.mtimeMs || 0);
      return delta || String(b.path).localeCompare(String(a.path));
    })
    .slice(0, Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20)));
}

function createServer() {
  return http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (parsedUrl.pathname === skillEditorFileRoute) {
      handleSkillEditorFile(req, res, parsedUrl);
      return;
    }

    const urlPath = decodeURIComponent(parsedUrl.pathname);

    if (urlPath === '/api/skill-packs/recent' && req.method === 'GET') {
      try {
        const files = await listRecentSkillJsonFiles(
          parsedUrl.searchParams.get('limit') || 20,
          parsedUrl.searchParams.get('kind') || 'player'
        );
        sendJson(res, 200, { ok: true, files });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && (urlPath === '/api/skill-packs/save' || urlPath === '/api/skill-packs/publish')) {
      try {
        const payload = await readJsonBody(req);
        const result = await writeSkillPackFile(payload, {
          mode: urlPath.endsWith('/publish') ? 'runtime' : 'authoring'
        });
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

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
  writeLevelMapPackage,
  getSkillPackKindConfig,
  normalizeSkillPackPath,
  writeSkillPackFile,
  listRecentSkillJsonFiles
};
