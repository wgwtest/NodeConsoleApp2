'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const requiredPackageFiles = ['package.json', 'maps.json', 'asset-manifest.json'];
const allowedPackageFiles = new Set([...requiredPackageFiles, 'levels.json']);
const skillEditorFileRoute = '/__skill_editor_file';
const animationAssetFramesRoute = '/api/animation-assets/frames';
const animationAssetFrameDirectoriesRoute = '/api/animation-assets/frame-directories';
const animationAssetImportFrameDirectoryRoute = '/api/animation-assets/import-frame-directory';
const animationAssetImportLocalDirectoryRoute = '/api/animation-assets/import-local-directory';
const animationAssetWriteRoute = '/api/animation-assets/write';
const animationAssetDeleteRoute = '/api/animation-assets/delete';
const allowedJsonWriteRoots = [
  'assets/data/',
  'assets/skill_packs/authoring/',
  'assets/enemy_packs/authoring/',
  'assets/enemy_packs/current/',
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
  ['.mjs', 'text/javascript; charset=utf-8'],
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

function readJsonBody(req, maxChars = 2_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxChars) {
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

function normalizeAnimationSourceDirectory(inputPath) {
  const raw = normalizeRelativePath(inputPath);
  if (!raw) throw new Error('缺少帧序列目录。');
  if (path.isAbsolute(raw) || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error('只允许项目内相对路径。');
  }
  const normalized = path.posix.normalize(raw).replace(/^\/+/u, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('路径不能跳出项目目录。');
  }
  if (!normalized.startsWith('source/character/')) {
    throw new Error('只允许扫描 source/character/ 下的帧序列。');
  }
  return normalized;
}

function normalizeAnimationFrameDirectoryRoot(inputPath) {
  const raw = normalizeRelativePath(inputPath || 'source/character');
  if (!raw) throw new Error('缺少帧序列根目录。');
  if (path.isAbsolute(raw) || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error('只允许项目内相对路径。');
  }
  const normalized = path.posix.normalize(raw).replace(/^\/+/u, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('路径不能跳出项目目录。');
  }
  if (normalized !== 'source/character' && !normalized.startsWith('source/character/')) {
    throw new Error('只允许扫描 source/character 下的帧序列。');
  }
  return normalized;
}

function normalizeAnimationImportDirectoryName(inputName) {
  const name = String(inputName || '').trim();
  if (!name) throw new Error('缺少导入目录名。');
  if (path.isAbsolute(name) || /^[a-zA-Z]:[\\/]/.test(name)) {
    throw new Error('导入目录名不能是绝对路径。');
  }
  if (name.includes('/') || name.includes('\\') || name === '..' || name.includes('..')) {
    throw new Error('导入目录名不能包含路径跳转。');
  }
  if (/[<>:"|?*]/u.test(name)) {
    throw new Error('导入目录名包含非法字符。');
  }
  return name;
}

function normalizeImportedFrameName(inputName) {
  const name = path.posix.basename(String(inputName || '').replace(/\\/g, '/')).trim();
  if (!name) throw new Error('缺少帧文件名。');
  if (name.includes('/') || name.includes('\\') || name === '..' || name.includes('..')) {
    throw new Error('帧文件名不能包含路径跳转。');
  }
  if (!name.toLowerCase().endsWith('.png')) {
    throw new Error('只允许导入 PNG 帧。');
  }
  if (/_sheet\.png$/iu.test(name)) {
    throw new Error('不允许把已构建 sheet 当成原始帧导入。');
  }
  return name;
}

function resolveLocalAnimationSourceDirectory(inputPath) {
  const raw = String(inputPath || '').trim();
  if (!raw) throw new Error('缺少本地帧目录路径。');
  if (raw.includes('\0')) throw new Error('本地帧目录路径非法。');

  if (path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) {
    return path.resolve(raw);
  }

  const normalized = path.posix.normalize(raw.replace(/\\/g, '/')).replace(/^\/+/u, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('本地帧目录路径不能跳出项目目录。');
  }
  return path.resolve(rootDir, normalized);
}

function normalizeAnimationOutputPath(inputPath) {
  const raw = normalizeRelativePath(inputPath);
  if (!raw) throw new Error('缺少输出路径。');
  if (path.isAbsolute(raw) || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error('只允许项目内相对路径。');
  }
  const normalized = path.posix.normalize(raw).replace(/^\/+/u, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('路径不能跳出项目目录。');
  }
  if (!normalized.startsWith('source/character/')) {
    throw new Error('只允许写入 source/character/ 下的动画产物。');
  }
  if (!/(?:_sheet\.png|_sheet\.json)$/iu.test(path.posix.basename(normalized))) {
    throw new Error('动画产物只能是 *_sheet.png 或 *_sheet.json。');
  }
  return normalized;
}

function normalizeAnimationDeletePath(inputPath) {
  const raw = normalizeRelativePath(inputPath).replace(/^(\.\.\/)+/u, '');
  if (!raw) throw new Error('缺少删除路径。');
  if (path.isAbsolute(raw) || /^[a-zA-Z]:\//.test(raw)) {
    throw new Error('只允许删除项目内相对路径。');
  }
  const normalized = path.posix.normalize(raw).replace(/^\/+/u, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('删除路径不能跳出项目目录。');
  }
  if (!normalized.startsWith('source/character/')) {
    throw new Error('只允许删除 source/character/ 下的动画资源。');
  }
  if (normalized === 'source/character' || normalized === 'source/character/') {
    throw new Error('不能删除动画资源根目录。');
  }
  const basename = path.posix.basename(normalized);
  if (/\.[^/]+$/u.test(basename) && !/(?:\.png|\.json)$/iu.test(basename)) {
    throw new Error('动画删除文件只能是 PNG 或 JSON。');
  }
  return normalized;
}

function compareFrameNames(left, right) {
  const leftNumber = Number((String(left).match(/(\d+)(?=\.png$)/iu) || [])[1]);
  const rightNumber = Number((String(right).match(/(\d+)(?=\.png$)/iu) || [])[1]);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), 'zh-CN', { numeric: true });
}

async function listAnimationFrames(directory) {
  const normalized = normalizeAnimationSourceDirectory(directory);
  const absolutePath = path.resolve(rootDir, normalized);
  const relativeToRoot = path.relative(rootDir, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('路径不能跳出项目目录。');
  }
  const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
  const frames = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) continue;
    if (/_sheet\.png$/iu.test(entry.name)) continue;
    const framePath = path.join(absolutePath, entry.name);
    const stat = await fs.promises.stat(framePath);
    frames.push({
      name: entry.name,
      path: `${normalized}/${entry.name}`,
      bytes: stat.size
    });
  }
  frames.sort((left, right) => compareFrameNames(left.name, right.name));
  return {
    directory: normalized,
    frameCount: frames.length,
    frames
  };
}

async function listAnimationFrameDirectories(rootDirectory = 'source/character') {
  const normalizedRoot = normalizeAnimationFrameDirectoryRoot(rootDirectory);
  const absoluteRoot = path.resolve(rootDir, normalizedRoot);
  const relativeToRoot = path.relative(rootDir, absoluteRoot);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('路径不能跳出项目目录。');
  }

  const directories = [];
  async function visit(absoluteDirectory) {
    let entries;
    try {
      entries = await fs.promises.readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw error;
    }

    const pngFrames = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.png') && !/_sheet\.png$/iu.test(entry.name))
      .map(entry => entry.name)
      .sort(compareFrameNames);
    if (pngFrames.length && absoluteDirectory !== absoluteRoot) {
      const relativeDirectory = path.relative(rootDir, absoluteDirectory).replace(/\\/g, '/');
      directories.push({
        directory: relativeDirectory,
        frameCount: pngFrames.length,
        firstFrame: `${relativeDirectory}/${pngFrames[0]}`,
        lastFrame: `${relativeDirectory}/${pngFrames[pngFrames.length - 1]}`
      });
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await visit(path.join(absoluteDirectory, entry.name));
    }
  }

  await visit(absoluteRoot);
  directories.sort((left, right) => left.directory.localeCompare(right.directory, 'zh-CN', { numeric: true }));
  return {
    root: normalizedRoot,
    directories
  };
}

async function importAnimationFrameDirectory(payload) {
  const directoryName = normalizeAnimationImportDirectoryName(payload?.directoryName);
  const sourceFiles = Array.isArray(payload?.files) ? payload.files : [];
  if (!sourceFiles.length) throw new Error('缺少要导入的 PNG 帧。');

  const targetDirectory = `source/character/${directoryName}`;
  const absoluteDirectory = path.resolve(rootDir, targetDirectory);
  const relativeToRoot = path.relative(rootDir, absoluteDirectory);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('路径不能跳出项目目录。');
  }

  await fs.promises.mkdir(absoluteDirectory, { recursive: true });
  const written = [];
  const seenNames = new Set();
  for (const file of sourceFiles) {
    const name = normalizeImportedFrameName(file?.name);
    if (seenNames.has(name)) throw new Error(`重复帧文件名：${name}`);
    seenNames.add(name);
    if (file?.encoding !== 'base64') throw new Error('导入帧必须使用 base64 编码。');
    const content = Buffer.from(String(file.content || ''), 'base64');
    if (!content.length) throw new Error(`帧文件为空：${name}`);
    const absolutePath = path.join(absoluteDirectory, name);
    await fs.promises.writeFile(absolutePath, content);
    written.push({
      name,
      path: `${targetDirectory}/${name}`,
      bytes: content.length
    });
  }

  written.sort((left, right) => compareFrameNames(left.name, right.name));
  return {
    directory: targetDirectory,
    frameCount: written.length,
    files: written
  };
}

async function importLocalAnimationFrameDirectory(payload) {
  const sourceDirectory = resolveLocalAnimationSourceDirectory(payload?.sourceDirectory);
  const stat = await fs.promises.stat(sourceDirectory);
  if (!stat.isDirectory()) throw new Error('本地帧目录不是文件夹。');

  const directoryName = normalizeAnimationImportDirectoryName(
    payload?.targetName || path.basename(sourceDirectory)
  );
  const targetDirectory = `source/character/${directoryName}`;
  const absoluteTargetDirectory = path.resolve(rootDir, targetDirectory);
  const relativeToRoot = path.relative(rootDir, absoluteTargetDirectory);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('路径不能跳出项目目录。');
  }

  const entries = await fs.promises.readdir(sourceDirectory, { withFileTypes: true });
  const frames = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.png') && !/_sheet\.png$/iu.test(entry.name))
    .map(entry => entry.name)
    .sort(compareFrameNames);
  if (!frames.length) throw new Error('本地帧目录里没有 PNG 帧。');

  await fs.promises.mkdir(absoluteTargetDirectory, { recursive: true });
  const files = [];
  for (const frameName of frames) {
    const name = normalizeImportedFrameName(frameName);
    const sourcePath = path.join(sourceDirectory, name);
    const targetPath = path.join(absoluteTargetDirectory, name);
    await fs.promises.copyFile(sourcePath, targetPath);
    const copiedStat = await fs.promises.stat(targetPath);
    files.push({
      name,
      path: `${targetDirectory}/${name}`,
      bytes: copiedStat.size
    });
  }

  return {
    directory: targetDirectory,
    frameCount: files.length,
    files
  };
}

async function writeAnimationAssetFiles(payload) {
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (!files.length) throw new Error('缺少写入文件。');
  const written = [];
  for (const file of files) {
    const targetPath = normalizeAnimationOutputPath(file?.path);
    const absolutePath = path.resolve(rootDir, targetPath);
    const relativeToRoot = path.relative(rootDir, absolutePath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error('路径不能跳出项目目录。');
    }
    let content;
    if (file?.encoding === 'base64') {
      content = Buffer.from(String(file.content || ''), 'base64');
    } else {
      content = String(file?.content ?? '');
      if (targetPath.endsWith('.json')) JSON.parse(content);
      content = content.endsWith('\n') ? content : `${content}\n`;
    }
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, content);
    const stat = await fs.promises.stat(absolutePath);
    written.push({ path: targetPath, bytes: stat.size });
  }
  return { files: written };
}

async function deleteAnimationAssetPaths(payload) {
  const paths = Array.isArray(payload?.paths) ? payload.paths : [];
  if (!paths.length) throw new Error('缺少删除路径。');
  const uniquePaths = Array.from(new Set(paths.map(normalizeAnimationDeletePath)));
  const orderedPaths = uniquePaths.sort((left, right) => {
    const leftIsFile = /\.[^/]+$/u.test(path.posix.basename(left));
    const rightIsFile = /\.[^/]+$/u.test(path.posix.basename(right));
    if (leftIsFile !== rightIsFile) return leftIsFile ? -1 : 1;
    return left.localeCompare(right, 'zh-CN', { numeric: true });
  });
  const deleted = [];
  for (const targetPath of orderedPaths) {
    const absolutePath = path.resolve(rootDir, targetPath);
    const relativeToRoot = path.relative(rootDir, absolutePath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error('删除路径不能跳出项目目录。');
    }
    let stat;
    try {
      stat = await fs.promises.stat(absolutePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    await fs.promises.rm(absolutePath, { recursive: stat.isDirectory(), force: true });
    deleted.push({ path: targetPath, kind: stat.isDirectory() ? 'directory' : 'file' });
  }
  return { deleted };
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
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }
    if (parsedUrl.pathname === skillEditorFileRoute) {
      handleSkillEditorFile(req, res, parsedUrl);
      return;
    }

    let urlPath;
    try {
      urlPath = decodeURIComponent(parsedUrl.pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

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

    if (urlPath === animationAssetFramesRoute && req.method === 'GET') {
      try {
        const result = await listAnimationFrames(parsedUrl.searchParams.get('dir'));
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (urlPath === animationAssetFrameDirectoriesRoute && req.method === 'GET') {
      try {
        const result = await listAnimationFrameDirectories(parsedUrl.searchParams.get('root'));
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (urlPath === animationAssetImportFrameDirectoryRoute && req.method === 'POST') {
      try {
        const payload = await readJsonBody(req, 80_000_000);
        const result = await importAnimationFrameDirectory(payload);
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (urlPath === animationAssetImportLocalDirectoryRoute && req.method === 'POST') {
      try {
        const payload = await readJsonBody(req, 10_000_000);
        const result = await importLocalAnimationFrameDirectory(payload);
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (urlPath === animationAssetWriteRoute && req.method === 'POST') {
      try {
        const payload = await readJsonBody(req, 30_000_000);
        const result = await writeAnimationAssetFiles(payload);
        sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }

    if (urlPath === animationAssetDeleteRoute && req.method === 'POST') {
      try {
        const payload = await readJsonBody(req, 10_000_000);
        const result = await deleteAnimationAssetPaths(payload);
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
  listRecentSkillJsonFiles,
  listAnimationFrames,
  writeAnimationAssetFiles,
  deleteAnimationAssetPaths
};
