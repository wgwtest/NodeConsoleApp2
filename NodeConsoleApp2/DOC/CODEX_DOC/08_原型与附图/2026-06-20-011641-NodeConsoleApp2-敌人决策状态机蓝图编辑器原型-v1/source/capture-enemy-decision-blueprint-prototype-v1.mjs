import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(sourceDir, '..');
const htmlPath = path.join(sourceDir, 'enemy-decision-blueprint-prototype-v1.html');
const reportPath = path.join(packageDir, 'prototype-report.json');
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9474);
const viewport = { width: 1920, height: 1080 };

const shots = [
  {
    view: 'overview',
    fileName: '01-1920x1080-敌人决策蓝图总览态.png',
    title: '敌人决策蓝图总览态'
  },
  {
    view: 'selected',
    fileName: '02-1920x1080-低血判断节点选中态.png',
    title: '低血判断节点选中态'
  },
  {
    view: 'trace',
    fileName: '03-1920x1080-路径预览与校验态.png',
    title: '路径预览与校验态'
  }
];

function browserCandidates() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
}

function resolveBrowser() {
  for (const candidate of browserCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome or Edge executable not found. Set CHROME_PATH or EDGE_PATH.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function waitForJson(url, timeoutMs = 8000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      await sleep(120);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 12000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evalExpr(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result.value;
}

async function captureShot(shot) {
  const url = `${pathToFileURL(htmlPath).href}?view=${shot.view}`;
  const target = await fetchJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  });
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(900);

  const metrics = await evalExpr(cdp, `(() => {
    const nodeRects = [...document.querySelectorAll('.node')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        className: el.className,
        left: Math.round(r.left),
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height)
      };
    });
    const overlaps = [];
    for (let i = 0; i < nodeRects.length; i += 1) {
      for (let j = i + 1; j < nodeRects.length; j += 1) {
        const a = nodeRects[i];
        const b = nodeRects[j];
        const overlap = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (overlap) overlaps.push([a.className, b.className]);
      }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      body: { width: document.body.scrollWidth, height: document.body.scrollHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      title: document.title,
      view: document.body.className,
      nodeCount: nodeRects.length,
      nodeOverlaps: overlaps,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      verticalOverflow: document.documentElement.scrollHeight > innerHeight
    };
  })()`);

  const shotData = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  await writeFile(path.join(packageDir, shot.fileName), Buffer.from(shotData.data, 'base64'));
  await cdp.send('Page.close').catch(() => {});
  cdp.close();
  return { ...shot, ...metrics };
}

await mkdir(packageDir, { recursive: true });

const browserPath = resolveBrowser();
const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${debugPort}`,
  `--window-size=${viewport.width},${viewport.height}`,
  'about:blank'
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const screenshots = [];
  for (const shot of shots) {
    screenshots.push(await captureShot(shot));
  }
  await writeFile(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    viewport,
    browserPath,
    html: path.relative(packageDir, htmlPath),
    screenshots
  }, null, 2));
} finally {
  browser.kill('SIGTERM');
}
