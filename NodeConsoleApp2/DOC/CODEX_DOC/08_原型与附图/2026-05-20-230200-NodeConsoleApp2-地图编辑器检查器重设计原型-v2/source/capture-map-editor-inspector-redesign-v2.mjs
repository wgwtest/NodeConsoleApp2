import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(sourceDir, '..');
const htmlPath = path.join(sourceDir, 'map-editor-inspector-redesign-v2.html');
const reportPath = path.join(packageDir, 'prototype-report.json');
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9461);
const chromePath = resolveChrome();

const screenshots = [
  ['node', '01-1920x1080-右侧节点列表优先.png'],
  ['edge', '02-1920x1080-右侧边列表优先.png'],
  ['bg', '03-1920x1080-左侧背景资源更换入口.png'],
  ['picker', '04-1920x1080-背景资源选择器弹窗.png'],
  ['apply', '05-1920x1080-应用地图设置确认弹窗.png'],
  ['package', '06-1920x1080-导出写回地图包说明弹窗.png']
];

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Google Chrome executable not found. Set CHROME_PATH.');
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

async function captureState(state, fileName) {
  const url = `${pathToFileURL(htmlPath).href}?state=${encodeURIComponent(state)}`;
  const target = await fetchJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  });
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(650);
  const report = await evalExpr(cdp, `({
    state: ${JSON.stringify(state)},
    viewport: { width: innerWidth, height: innerHeight },
    body: { width: document.body.scrollWidth, height: document.body.scrollHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
  })`);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  await writeFile(path.join(packageDir, fileName), Buffer.from(shot.data, 'base64'));
  await cdp.send('Page.close').catch(() => {});
  cdp.close();
  return { fileName, ...report };
}

await mkdir(packageDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${debugPort}`,
  '--window-size=1920,1080',
  'about:blank'
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const reports = [];
  for (const [state, fileName] of screenshots) {
    reports.push(await captureState(state, fileName));
  }
  await writeFile(reportPath, JSON.stringify({
    viewport: { width: 1920, height: 1080 },
    html: path.relative(packageDir, htmlPath),
    screenshots: reports
  }, null, 2));
} finally {
  chrome.kill('SIGTERM');
}
